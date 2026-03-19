// Main Chat Handler

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Config & Utils
import { CONFIG, corsHeaders } from "../config/constants.ts";
import { logger } from "../utils/logger.ts";
import { DEMO_TOURS, DEMO_PAYMENT_INSTRUCTIONS } from "../config/demo-tours.ts";

// Services
import { loadOrCreateContext, buildNLUContext } from "../services/context-manager.ts";
import { loadToursFromDatabase, getLocalizedTours } from "../services/tour-loader.ts";
import { findMatchingTours, findTourById } from "../services/tour-matching.ts";
import { extractReservationInfo } from "../services/info-extractor.ts";
import { getAgencyData, extractPaymentInfoText } from "../services/agency-cache.ts";
import { saveReservation, saveComplaint, saveConversation, getConversationHistory } from "../services/reservation.ts";
import { buildCompleteSystemPrompt } from "../services/prompt-builder-helper.ts";
import { callAI } from "../services/ai.ts";
import { generatePaymentMessage } from "../services/payment.ts";

// FSM imports
import { processTransition, getNextExpectedInput } from "../../shared/fsm/state-machine.ts";
import { sanitizeInput } from "../../shared/fsm/validator.ts";
import { analyzeUserMessage, mapNLUIntentToFSMIntent } from "../../shared/fsm/nlu.ts";
import type { ProcessingInput, ConversationContext } from "../../shared/fsm/types.ts";

// Handlers
import { createErrorResponse, createSuccessResponse, DemoChatError } from "./error-handler.ts";

import type { RequestData, Tour, ChatResponse } from "../types/index.ts";

const VERSION = "v3.1.0";

/**
 * Parse and validate incoming request
 */
async function parseRequest(req: Request): Promise<RequestData> {
  const body = await req.json();
  const { message: rawMessage, sessionId, conversationState, conversationStyle } = body;
  
  if (!sessionId) {
    throw new DemoChatError("VALIDATION", "Session ID required", 400);
  }
  
  return {
    message: sanitizeInput(rawMessage),
    sessionId,
    conversationState,
    conversationStyle,
  };
}

/**
 * Main chat request handler
 */
export async function handleChatRequest(req: Request): Promise<Response> {
  let language = "tr";
  
  try {
    // 1. Parse and validate request
    const requestData = await parseRequest(req);
    const { message, sessionId, conversationState, conversationStyle } = requestData;

    logger.start(VERSION);

    // 2. Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. Load tours from database, fallback to demo tours if none found
    let rawTours = await loadToursFromDatabase(supabase);
    if (!rawTours || rawTours.length === 0) {
      logger.info("No tours in DB for demo agency, using static DEMO_TOURS");
      rawTours = DEMO_TOURS as any[];
    }

    // 4. Load or create context
    const { context, runtimeDetectedLang } = await loadOrCreateContext({
      clientState: conversationState,
      message,
      conversationStyle,
    });
    language = context.language;

    // 5. Create localized tours
    const availableTours = getLocalizedTours(rawTours, context.language);
    logger.info(`Using ${availableTours.length} tours (localized to: ${context.language})`);

    logger.debug("Message received", { 
      message, 
      stage: context.stage, 
      lang: context.language, 
      tone: context.tone, 
      collectionStep: context.collectionStep 
    });

    // 6. Build NLU context and analyze message
    const nluContext = buildNLUContext(context);
    logger.debug("NLU Context", nluContext);

    const nluResult = await analyzeUserMessage(
      message,
      nluContext,
      context.stage,
      context.currentTour,
      DEMO_TOURS
    );

    const detectedIntent = mapNLUIntentToFSMIntent(nluResult.intent);
    logger.intent(nluResult.intent, detectedIntent);

    const expectedInput = getNextExpectedInput(context);
    logger.debug("Expected input", expectedInput);

    // 7. Match tours
    const { selectedTour, multipleMatches } = findMatchingTours(
      message,
      nluResult.entities,
      availableTours,
      expectedInput,
      nluResult.intent
    );

    // 8. Extract reservation info
    const extractedInfo = extractReservationInfo({
      message,
      nluEntities: nluResult.entities,
      nluUpdates: nluResult.updates,
      context,
      availableTours,
      expectedInput,
      detectedIntent,
    });

    logger.debug("Extracted info", extractedInfo);

    // 9. Process FSM transition
    const input: ProcessingInput = {
      userMessage: message,
      detectedIntent,
      extractedInfo,
      selectedTour: selectedTour as any,
      language: context.language,
    };

    const newContext = processTransition(context, input);
    logger.transition(context.stage, newContext.stage);

    // 10. Load agency data
    const agencyData = await getAgencyData(supabase);
    const paymentInstructions = agencyData?.payment_instructions ?? DEMO_PAYMENT_INSTRUCTIONS ?? null;
    const paymentInfo = extractPaymentInfoText(paymentInstructions);

    // 11. Build system prompt
    const systemPrompt = buildCompleteSystemPrompt({
      context: newContext,
      availableTours,
      agencyData,
      paymentInfo,
      multipleTourMatches: multipleMatches,
      selectedTour,
    });

    // 12. Get conversation history
    const conversationHistory = await getConversationHistory(supabase, sessionId);

    // 13. Call AI
    const messagesForAI = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: message },
    ];

    logger.info("Calling AI...");
    const aiResponse = await callAI(messagesForAI, CONFIG.DEFAULT_AI_TEMPERATURE);

    // 14. Handle payment info for completed reservations
    let finalResponse = aiResponse;

    if (newContext.stage === "COMPLETED" && !newContext.paymentInfoSent && paymentInstructions) {
      const priceAdult =
        newContext.currentTour?.dates?.find((d: any) => d.id === newContext.reservationInfo.dateId)?.price_adult || 0;

      const paxAdult = newContext.reservationInfo.paxAdult || 1;
      const totalPrice = priceAdult * paxAdult;

      const depositPercentage =
        typeof paymentInstructions === "object" &&
        paymentInstructions !== null &&
        typeof (paymentInstructions as any).deposit_percentage === "number"
          ? (paymentInstructions as any).deposit_percentage
          : CONFIG.DEFAULT_DEPOSIT_PERCENTAGE;

      const depositAmount = Math.round((totalPrice * depositPercentage) / 100);

      const currentTourData = newContext.currentTour 
        ? findTourById(newContext.currentTour.id, availableTours) 
        : null;
      const tourCurrency = currentTourData?.currency || "TRY";

      const paymentMessage = await generatePaymentMessage(
        paymentInstructions,
        newContext.language,
        totalPrice,
        depositAmount,
        tourCurrency,
        {
          languageCurrencies: agencyData?.language_currencies,
          primaryCurrency: agencyData?.primary_currency || "TRY",
        }
      );

      if (paymentMessage) {
        finalResponse = aiResponse + paymentMessage;
        newContext.paymentInfoSent = true;
      }
    }

    // 15. Save reservation ONLY when transitioning TO COMPLETED (not when already completed)
    // This prevents duplicate reservations when user sends more messages after completion
    const isNewlyCompleted = context.stage !== "COMPLETED" && 
                              newContext.stage === "COMPLETED" && 
                              newContext.reservationConfirmed;
    let reservationFailed = false;
    if (isNewlyCompleted && newContext.reservationInfo) {
      const saveResult = await saveReservation(supabase, newContext);
      if (!saveResult.success) {
        reservationFailed = true;
        logger.error("Reservation save failed, will not confirm to user", { error: saveResult.error });
        
        // Build user-friendly error with agency contact info
        const agencyPhone = agencyData?.phone_public || "";
        const agencyName = agencyData?.name || "";
        const phoneInfo = agencyPhone ? ` 📞 ${agencyPhone}` : "";
        
        const errorMessages: Record<string, string> = {
          tr: `Rezervasyonunuz oluşturulurken bir sorun yaşandı. Lütfen ${agencyName} ile iletişime geçiniz.${phoneInfo}`,
          en: `There was an issue creating your reservation. Please contact ${agencyName} directly.${phoneInfo}`,
          de: `Bei der Erstellung Ihrer Reservierung ist ein Problem aufgetreten. Bitte kontaktieren Sie ${agencyName}.${phoneInfo}`,
          ar: `حدثت مشكلة أثناء إنشاء حجزك. يرجى التواصل مع ${agencyName}.${phoneInfo}`,
          fr: `Un problème est survenu lors de la création de votre réservation. Veuillez contacter ${agencyName}.${phoneInfo}`,
          es: `Hubo un problema al crear su reserva. Por favor contacte a ${agencyName}.${phoneInfo}`,
          ru: `При создании бронирования возникла проблема. Пожалуйста, свяжитесь с ${agencyName}.${phoneInfo}`,
        };
        finalResponse = errorMessages[language] || errorMessages["tr"];
        // Reset context so user can retry
        newContext.stage = context.stage;
        newContext.reservationConfirmed = false;
      }
    }

    // 16. Save complaint if detected
    if (nluResult.intent === "complaint_feedback") {
      await saveComplaint(supabase, sessionId, message);
    }

    // 17. Save conversation messages
    await saveConversation(supabase, sessionId, message, finalResponse);

    // 18. Return response
    const responseData: ChatResponse = {
      response: finalResponse,
      conversationState: newContext,
    };

    return createSuccessResponse(responseData);

  } catch (error) {
    if (error instanceof DemoChatError) {
      return createErrorResponse(error.type, error.statusCode, language, error);
    }
    
    logger.error("Chat request failed", error);
    return createErrorResponse("UNKNOWN", 500, language, error);
  }
}
