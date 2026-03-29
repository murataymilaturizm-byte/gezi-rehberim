// Main Chat Handler

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Config & Utils
import { CONFIG, corsHeaders } from "../config/constants.ts";
import { logger } from "../utils/logger.ts";
import { DEMO_TOURS, DEMO_PAYMENT_INSTRUCTIONS } from "../config/demo-tours.ts";

// Services
import { loadOrCreateContext, buildNLUContext } from "../services/context-manager.ts";
import { loadToursFromDatabase, getLocalizedTours, enrichToursWithSoldPax } from "../services/tour-loader.ts";
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
import { formatDateForLanguage } from "../../shared/fsm/localization.ts";
import type { ProcessingInput, ConversationContext } from "../../shared/fsm/types.ts";

// Handlers
import { createErrorResponse, createSuccessResponse, DemoChatError } from "./error-handler.ts";

import type { RequestData, Tour, ChatResponse } from "../types/index.ts";

const VERSION = "v3.2.0";

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
    // Enrich with sold pax data for accurate quota
    rawTours = await enrichToursWithSoldPax(supabase, rawTours);

    // 4. Load or create context
    const { context, runtimeDetectedLang } = await loadOrCreateContext({
      clientState: conversationState,
      message,
      conversationStyle,
    });
    language = context.language;

    // Önceki context'i sakla — COMPLETED sonrası prompt uyarıları için
    const previousContext: ConversationContext = { ...context };

    // 5. Create localized tours
    const availableTours = getLocalizedTours(rawTours, context.language);
    logger.info(`Using ${availableTours.length} tours (localized to: ${context.language})`);

    logger.debug("Message received", {
      message,
      stage: context.stage,
      lang: context.language,
      tone: context.tone,
      collectionStep: context.collectionStep,
    });

    // 6. Build NLU context and analyze message
    const nluContext = buildNLUContext(context);
    logger.debug("NLU Context", nluContext);

    const nluResult = await analyzeUserMessage(message, nluContext, context.stage, context.currentTour, DEMO_TOURS);

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
      nluResult.intent,
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

    // 9.1 Date selection must be deterministic (no AI dependency)
    if (
      newContext.stage === "COLLECTING_INFO" &&
      newContext.collectionStep === "waiting_for_date" &&
      newContext.currentTour
    ) {
      const selectedTourForDates = findTourById(newContext.currentTour.id, availableTours);
      if (selectedTourForDates?.dates?.length) {
        const dateLines = selectedTourForDates.dates
          .map((d: any, idx: number) => {
            const dateText = formatDateForLanguage(d.departure_date, newContext.language);
            const priceText = d.price_adult
              ? ` - ${d.price_adult} ${selectedTourForDates.currency || "TRY"}`
              : "";
            const remaining = d.remaining_quota !== undefined ? d.remaining_quota : d.quota;
            const quotaText =
              remaining !== undefined
                ? newContext.language === "tr"
                  ? ` (${remaining} kişilik yer)`
                  : ` (${remaining} spots)`
                : "";
            return `${idx + 1}) ${dateText}${priceText}${quotaText}`;
          })
          .join("\n");

        const dateMessages: Record<string, string> = {
          tr: `*${selectedTourForDates.title}* için müsait tarihler:\n${dateLines}\n\nHangi tarihi tercih edersiniz?`,
          en: `Available dates for *${selectedTourForDates.title}*:\n${dateLines}\n\nWhich date do you prefer?`,
          de: `Verfügbare Termine für *${selectedTourForDates.title}*:\n${dateLines}\n\nWelches Datum bevorzugen Sie?`,
          ru: `Доступные даты для *${selectedTourForDates.title}*:\n${dateLines}\n\nКакую дату вы предпочитаете?`,
          ar: `التواريخ المتاحة لـ *${selectedTourForDates.title}*:\n${dateLines}\n\nما التاريخ الذي تفضله؟`,
          fr: `Dates disponibles pour *${selectedTourForDates.title}* :\n${dateLines}\n\nQuelle date préférez-vous ?`,
          es: `Fechas disponibles para *${selectedTourForDates.title}*:\n${dateLines}\n\n¿Qué fecha prefieres?`,
        };

        const dateSelectionReply = dateMessages[newContext.language] || dateMessages.tr;
        await saveConversation(supabase, sessionId, message, dateSelectionReply);

        return createSuccessResponse({
          response: dateSelectionReply,
          conversationState: newContext,
        });
      }
    }

    // 10. Load agency data
    const agencyData = await getAgencyData(supabase);
    const paymentInstructions = agencyData?.payment_instructions ?? DEMO_PAYMENT_INSTRUCTIONS ?? null;
    const paymentInfo = extractPaymentInfoText(paymentInstructions);

    // 11. === KOTA KONTROLÜ ===
    // Rezervasyon tamamlanmadan önce kota var mı kontrol et
    if (newContext.stage === "COMPLETED" && newContext.reservationConfirmed && context.stage !== "COMPLETED") {
      const { dateId, paxAdult } = newContext.reservationInfo;
      if (dateId && paxAdult) {
        const { data: tourDate } = await supabase.from("tour_dates").select("quota").eq("id", dateId).single();

        if (tourDate?.quota !== null && tourDate?.quota !== undefined) {
          const { count: existingPax } = await supabase
            .from("registrations")
            .select("pax", { count: "exact" })
            .eq("tour_date_id", dateId)
            .neq("status", "CANCELLED");

          const usedQuota = existingPax || 0;
          const remainingQuota = tourDate.quota - usedQuota;

          if (remainingQuota < paxAdult) {
            logger.info(`Quota exceeded: ${remainingQuota} remaining, ${paxAdult} requested`);

            const today = new Date().toISOString().split("T")[0];
            const agencyPhone = agencyData?.phone_public ? ` 📞 ${agencyData.phone_public}` : "";
            const currentTourRaw = rawTours.find((t: any) => t.id === newContext.reservationInfo.tourId);

            // Diğer müsait tarihleri bul
            const otherDates = (currentTourRaw?.dates || []).filter((d: any) => {
              if (d.id === dateId) return false;
              if (d.departure_date < today) return false;
              return true;
            });

            const availableDatesList: string[] = [];
            for (const d of otherDates) {
              const { count: usedForDate } = await supabase
                .from("registrations")
                .select("pax", { count: "exact" })
                .eq("tour_date_id", d.id)
                .neq("status", "CANCELLED");

              const available = (d.quota || 999) - (usedForDate || 0);
              if (available >= paxAdult) {
                const dateStr = new Date(d.departure_date).toLocaleDateString(
                  newContext.language === "tr"
                    ? "tr-TR"
                    : newContext.language === "de"
                      ? "de-DE"
                      : newContext.language === "ru"
                        ? "ru-RU"
                        : "en-GB",
                  { day: "numeric", month: "long", year: "numeric" },
                );
                const priceStr = d.price_adult ? ` (${d.price_adult} ${currentTourRaw?.currency || "TRY"})` : "";
                availableDatesList.push(`• ${dateStr}${priceStr}`);
              }
            }

            const lang = newContext.language || "tr";
            let quotaMsg = "";

            if (availableDatesList.length > 0) {
              const dateListStr = availableDatesList.join("\n");
              const msgs: Record<string, string> = {
                tr: `Üzgünüz, seçtiğiniz tarih için yeterli kontenjan bulunmamaktadır (kalan: ${remainingQuota} kişi).\n\n📅 *Müsait Diğer Tarihler:*\n${dateListStr}\n\nBu tarihlerden birini seçmek ister misiniz?`,
                en: `Sorry, the selected date doesn't have enough spots (remaining: ${remainingQuota}).\n\n📅 *Available Dates:*\n${dateListStr}\n\nWould you like to choose one of these dates?`,
                de: `Das gewählte Datum hat leider nicht genügend Plätze (verbleibend: ${remainingQuota}).\n\n📅 *Verfügbare Termine:*\n${dateListStr}\n\nMöchten Sie einen dieser Termine wählen?`,
                ru: `На выбранную дату недостаточно мест (осталось: ${remainingQuota}).\n\n📅 *Доступные даты:*\n${dateListStr}\n\nХотите выбрать одну из этих дат?`,
                ar: `عذراً، لا توجد أماكن كافية (المتبقي: ${remainingQuota}).\n\n📅 *التواريخ المتاحة:*\n${dateListStr}\n\nهل تريد اختيار أحد هذه التواريخ؟`,
              };
              quotaMsg = msgs[lang] || msgs["tr"];
            } else {
              const msgs: Record<string, string> = {
                tr: `Üzgünüz, seçtiğiniz tarih için yeterli kontenjan bulunmamaktadır (kalan: ${remainingQuota} kişi). Şu an bu tur için müsait başka tarih de bulunmuyor.\n\nLütfen ${agencyData?.name || ""} ile iletişime geçiniz.${agencyPhone}`,
                en: `Sorry, there are not enough spots (remaining: ${remainingQuota}). There are no other available dates.\n\nPlease contact ${agencyData?.name || ""}.${agencyPhone}`,
                de: `Nicht genügend Plätze (verbleibend: ${remainingQuota}). Keine weiteren Termine verfügbar.\n\nBitte kontaktieren Sie ${agencyData?.name || ""}.${agencyPhone}`,
                ru: `Недостаточно мест (осталось: ${remainingQuota}). Других дат нет.\n\nСвяжитесь с ${agencyData?.name || ""}.${agencyPhone}`,
                ar: `لا توجد أماكن كافية (المتبقي: ${remainingQuota}). لا تواريخ أخرى.\n\nتواصل مع ${agencyData?.name || ""}.${agencyPhone}`,
              };
              quotaMsg = msgs[lang] || msgs["tr"];
            }

            // Context'i geri al
            newContext.stage = "COLLECTING_INFO";
            newContext.reservationConfirmed = false;
            newContext.reservationInfo.dateId = undefined;
            newContext.reservationInfo.selectedDate = undefined;
            newContext.collectionStep = "waiting_for_date";

            const responseData: ChatResponse = {
              response: quotaMsg,
              conversationState: newContext,
            };
            return createSuccessResponse(responseData);
          }
        }
      }
    }

    // 12. === RESERVATION SAVE — AI'DAN ÖNCE ===
    // Rezervasyon kaydını AI çağrısından ÖNCE yap, böylece hata olursa AI "tamamlandı" demez
    const isNewlyCompleted =
      context.stage !== "COMPLETED" && newContext.stage === "COMPLETED" && newContext.reservationConfirmed;

    let reservationSaveFailed = false;
    let reservationErrorMessage = "";

    if (isNewlyCompleted && newContext.reservationInfo) {
      const saveResult = await saveReservation(supabase, newContext);
      if (!saveResult.success) {
        logger.error("Reservation save failed", { error: saveResult.error });

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
        reservationErrorMessage = errorMessages[language] || errorMessages["tr"];
        reservationSaveFailed = true;

        // Context'i geri al — AI'a COMPLETED gösterme
        newContext.stage = context.stage;
        newContext.reservationConfirmed = false;
      }
    }

    // 13. Build system prompt — previousContext'i geç
    const systemPrompt = buildCompleteSystemPrompt({
      context: newContext,
      previousContext,
      availableTours,
      agencyData,
      paymentInfo,
      multipleTourMatches: multipleMatches,
      selectedTour,
    });

    // 14. Get conversation history
    const conversationHistory = await getConversationHistory(supabase, sessionId);

    // 15. If reservation save failed, return error directly — AI çağırmaya gerek yok
    if (reservationSaveFailed) {
      await saveConversation(supabase, sessionId, message, reservationErrorMessage);

      const responseData: ChatResponse = {
        response: reservationErrorMessage,
        conversationState: newContext,
      };
      return createSuccessResponse(responseData);
    }

    // 16. Call AI
    const messagesForAI = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: message },
    ];

    logger.info("Calling AI...");
    const aiResponse = await callAI(messagesForAI, CONFIG.DEFAULT_AI_TEMPERATURE);

    // 17. Handle payment info for completed reservations
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

      const currentTourData = newContext.currentTour ? findTourById(newContext.currentTour.id, availableTours) : null;
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
        },
      );

      if (paymentMessage) {
        finalResponse = aiResponse + paymentMessage;
        newContext.paymentInfoSent = true;
      }
    }

    // 18. Save complaint if detected
    if (nluResult.intent === "complaint_feedback") {
      await saveComplaint(supabase, sessionId, message);
    }

    // 19. Save conversation messages
    await saveConversation(supabase, sessionId, message, finalResponse);

    // 20. Return response
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
