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

const VERSION = "v3.3.0";

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
 * Deterministik tarih listesi oluştur
 * AI'ya bırakmadan doğrudan tarih listesi mesajı döner
 */
function buildDateSelectionMessage(tour: any, language: string): string {
  const dateLines = tour.dates
    .map((d: any, idx: number) => {
      const dateText = formatDateForLanguage(d.departure_date, language);
      const priceText = d.price_adult ? ` - ${d.price_adult} ${tour.currency || "TRY"}` : "";
      const remaining = d.remaining_quota !== undefined ? d.remaining_quota : d.quota;
      const quotaText =
        remaining !== undefined ? (language === "tr" ? ` (${remaining} kişilik yer)` : ` (${remaining} spots)`) : "";
      return `${idx + 1}) ${dateText}${priceText}${quotaText}`;
    })
    .join("\n");

  const messages: Record<string, string> = {
    tr: `*${tour.title}* için müsait tarihler:\n${dateLines}\n\nHangi tarihi tercih edersiniz?`,
    en: `Available dates for *${tour.title}*:\n${dateLines}\n\nWhich date do you prefer?`,
    de: `Verfügbare Termine für *${tour.title}*:\n${dateLines}\n\nWelches Datum bevorzugen Sie?`,
    ru: `Доступные даты для *${tour.title}*:\n${dateLines}\n\nКакую дату вы предпочитаете?`,
    ar: `التواريخ المتاحة لـ *${tour.title}*:\n${dateLines}\n\nما التاريخ الذي تفضله؟`,
    fr: `Dates disponibles pour *${tour.title}* :\n${dateLines}\n\nQuelle date préférez-vous ?`,
    es: `Fechas disponibles para *${tour.title}*:\n${dateLines}\n\n¿Qué fecha prefieres?`,
  };

  return messages[language] || messages.tr;
}

export async function handleChatRequest(req: Request): Promise<Response> {
  let language = "tr";

  try {
    const requestData = await parseRequest(req);
    const { message, sessionId, conversationState, conversationStyle } = requestData;

    logger.start(VERSION);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Tours yükle
    let rawTours = await loadToursFromDatabase(supabase);
    if (!rawTours || rawTours.length === 0) {
      logger.info("No tours in DB, using DEMO_TOURS");
      rawTours = DEMO_TOURS as any[];
    }
    rawTours = await enrichToursWithSoldPax(supabase, rawTours);

    // Context yükle
    const { context, runtimeDetectedLang } = await loadOrCreateContext({
      clientState: conversationState,
      message,
      conversationStyle,
    });
    language = context.language;

    const previousContext: ConversationContext = { ...context };

    // Turları lokalize et
    const availableTours = getLocalizedTours(rawTours, context.language);
    logger.info(`Using ${availableTours.length} tours (lang: ${context.language})`);

    logger.debug("Message received", {
      message,
      stage: context.stage,
      lang: context.language,
      tone: context.tone,
      collectionStep: context.collectionStep,
    });

    // NLU — availableTours kullan (DEMO_TOURS değil!)
    const nluContext = buildNLUContext(context);
    const nluResult = await analyzeUserMessage(
      message,
      nluContext,
      context.stage,
      context.currentTour,
      availableTours, // ← Düzeltildi: DEMO_TOURS yerine availableTours
    );

    const detectedIntent = mapNLUIntentToFSMIntent(nluResult.intent);
    logger.intent(nluResult.intent, detectedIntent);

    const expectedInput = getNextExpectedInput(context);

    // Tur eşleştir
    const { selectedTour, multipleMatches } = findMatchingTours(
      message,
      nluResult.entities,
      availableTours,
      expectedInput,
      nluResult.intent,
    );

    // Bilgi çıkar
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

    // FSM geçişi
    const input: ProcessingInput = {
      userMessage: message,
      detectedIntent,
      extractedInfo,
      selectedTour: selectedTour as any,
      language: context.language,
    };

    const newContext = processTransition(context, input);
    logger.transition(context.stage, newContext.stage);

    // === DEterministik TARIH LİSTESİ ===
    // COLLECTING_INFO + waiting_for_date → AI'ya bırakma, direkt listele
    if (
      newContext.stage === "COLLECTING_INFO" &&
      newContext.collectionStep === "waiting_for_date" &&
      newContext.currentTour
    ) {
      const tourForDates = findTourById(newContext.currentTour.id, availableTours);
      if (tourForDates?.dates?.length) {
        const dateReply = buildDateSelectionMessage(tourForDates, newContext.language);
        await saveConversation(supabase, sessionId, message, dateReply);
        return createSuccessResponse({
          response: dateReply,
          conversationState: newContext,
        });
      }
    }

    // Agency data yükle
    const agencyData = await getAgencyData(supabase);
    const paymentInstructions = agencyData?.payment_instructions ?? DEMO_PAYMENT_INSTRUCTIONS ?? null;
    const paymentInfo = extractPaymentInfoText(paymentInstructions);

    // === KOTA KONTROLÜ ===
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
              };
              quotaMsg = msgs[lang] || msgs["tr"];
            } else {
              const msgs: Record<string, string> = {
                tr: `Üzgünüz, seçtiğiniz tarih için yeterli kontenjan bulunmamaktadır (kalan: ${remainingQuota} kişi). Şu an bu tur için müsait başka tarih de bulunmuyor.\n\nLütfen ${agencyData?.name || ""} ile iletişime geçiniz.${agencyPhone}`,
                en: `Sorry, there are not enough spots (remaining: ${remainingQuota}). There are no other available dates.\n\nPlease contact ${agencyData?.name || ""}.${agencyPhone}`,
              };
              quotaMsg = msgs[lang] || msgs["tr"];
            }

            newContext.stage = "COLLECTING_INFO";
            newContext.reservationConfirmed = false;
            newContext.reservationInfo.dateId = undefined;
            newContext.reservationInfo.selectedDate = undefined;
            newContext.collectionStep = "waiting_for_date";

            await saveConversation(supabase, sessionId, message, quotaMsg);
            return createSuccessResponse({ response: quotaMsg, conversationState: newContext });
          }
        }
      }
    }

    // === REZERVASYON KAYDET — AI'DAN ÖNCE ===
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
          fr: `Un problème est survenu. Veuillez contacter ${agencyName}.${phoneInfo}`,
          es: `Hubo un problema. Por favor contacte a ${agencyName}.${phoneInfo}`,
          ru: `При создании бронирования возникла проблема. Свяжитесь с ${agencyName}.${phoneInfo}`,
        };
        reservationErrorMessage = errorMessages[language] || errorMessages["tr"];
        reservationSaveFailed = true;
        newContext.stage = context.stage;
        newContext.reservationConfirmed = false;
      }
    }

    // System prompt oluştur
    const systemPrompt = buildCompleteSystemPrompt({
      context: newContext,
      previousContext,
      availableTours,
      agencyData,
      paymentInfo,
      multipleTourMatches: multipleMatches,
      selectedTour,
    });

    // Konuşma geçmişi
    const conversationHistory = await getConversationHistory(supabase, sessionId);

    // Rezervasyon kaydı başarısız → AI çağırma
    if (reservationSaveFailed) {
      await saveConversation(supabase, sessionId, message, reservationErrorMessage);
      return createSuccessResponse({ response: reservationErrorMessage, conversationState: newContext });
    }

    // === DEterministik TAMAMLAMA MESAJI ===
    if (isNewlyCompleted && !reservationSaveFailed && newContext.reservationInfo) {
      const selectedTourData = newContext.currentTour ? findTourById(newContext.currentTour.id, availableTours) : null;
      const selectedDateData = selectedTourData?.dates?.find((d: any) => d.id === newContext.reservationInfo.dateId);

      const formattedDate = selectedDateData?.departure_date
        ? formatDateForLanguage(selectedDateData.departure_date, newContext.language)
        : newContext.reservationInfo.selectedDate || "-";

      const adultCount = newContext.reservationInfo.paxAdult || 0;
      const childCount = newContext.reservationInfo.paxChild || 0;
      const paxText =
        newContext.language === "tr"
          ? `${adultCount} Yetişkin${childCount ? `, ${childCount} Çocuk` : ""}`
          : `${adultCount} Adult${childCount ? `, ${childCount} Child` : ""}`;

      const completionMessages: Record<string, string> = {
        tr: `Bilgilerinizi aldım ${newContext.reservationInfo.fullName || ""}, çok teşekkür ederim! 😊\n*${selectedTourData?.title || newContext.reservationInfo.tourTitle || "Tur"}* için ön kaydınızı başarıyla gerçekleştirdim.\n\n*Kayıt Özetiniz:*\n• *Tur:* ${selectedTourData?.title || newContext.reservationInfo.tourTitle || "-"}\n• *Tarih:* ${formattedDate}\n• *Kişi:* ${paxText}\n• *İsim:* ${newContext.reservationInfo.fullName || "-"}\n• *Telefon:* ${newContext.reservationInfo.phone || "-"}\n\nKesin rezervasyon ve ödeme detayları için ekip arkadaşlarımız size en kısa sürede ulaşacaktır.`,
        en: `Thank you, ${newContext.reservationInfo.fullName || ""}! 😊\nYour pre-registration for *${selectedTourData?.title || newContext.reservationInfo.tourTitle || "Tour"}* has been created successfully.\n\n*Registration Summary:*\n• *Tour:* ${selectedTourData?.title || newContext.reservationInfo.tourTitle || "-"}\n• *Date:* ${formattedDate}\n• *People:* ${paxText}\n• *Name:* ${newContext.reservationInfo.fullName || "-"}\n• *Phone:* ${newContext.reservationInfo.phone || "-"}\n\nOur team will contact you shortly for final booking and payment details.`,
      };

      let deterministicReply = completionMessages[newContext.language] || completionMessages.tr;

      if (paymentInstructions) {
        const adultPrice = selectedDateData?.price_adult || 0;
        const childPrice = selectedDateData?.price_child ?? adultPrice;
        const totalPrice = adultCount * adultPrice + childCount * childPrice;

        const depositPercentage =
          typeof paymentInstructions === "object" &&
          paymentInstructions !== null &&
          typeof (paymentInstructions as any).deposit_percentage === "number"
            ? (paymentInstructions as any).deposit_percentage
            : CONFIG.DEFAULT_DEPOSIT_PERCENTAGE;

        const depositAmount = Math.round((totalPrice * depositPercentage) / 100);
        const tourCurrency = selectedTourData?.currency || "TRY";

        if (totalPrice > 0) {
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
            deterministicReply += paymentMessage;
            newContext.paymentInfoSent = true;
          }
        }
      }

      await saveConversation(supabase, sessionId, message, deterministicReply);
      return createSuccessResponse({ response: deterministicReply, conversationState: newContext });
    }

    // AI çağrısı
    const messagesForAI = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: message },
    ];

    logger.info("Calling AI...");
    const aiResponse = await callAI(messagesForAI, CONFIG.DEFAULT_AI_TEMPERATURE);

    let finalResponse = aiResponse;

    // Ödeme bilgisi ekle (COMPLETED ama deterministik bloktan geçmedi)
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

    // Şikayet kaydet
    if (nluResult.intent === "complaint_feedback") {
      await saveComplaint(supabase, sessionId, message);
    }

    // Konuşmayı kaydet
    await saveConversation(supabase, sessionId, message, finalResponse);

    return createSuccessResponse({ response: finalResponse, conversationState: newContext });
  } catch (error) {
    if (error instanceof DemoChatError) {
      return createErrorResponse(error.type, error.statusCode, language, error);
    }
    logger.error("Chat request failed", error);
    return createErrorResponse("UNKNOWN", 500, language, error);
  }
}
