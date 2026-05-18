// Main Chat Handler v3.4.0

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { CONFIG, corsHeaders } from "../config/constants.ts";
import { logger } from "../utils/logger.ts";
import { DEMO_TOURS, DEMO_PAYMENT_INSTRUCTIONS } from "../config/demo-tours.ts";

import { loadOrCreateContext, buildNLUContext } from "../services/context-manager.ts";
import { loadToursFromDatabase, getLocalizedTours, enrichToursWithSoldPax } from "../services/tour-loader.ts";
import { findMatchingTours, findTourById } from "../services/tour-matching.ts";
import { extractReservationInfo } from "../services/info-extractor.ts";
import { getAgencyData, extractPaymentInfoText } from "../services/agency-cache.ts";
import { saveReservation, saveComplaint, saveConversation, getConversationHistory } from "../services/reservation.ts";
import { buildCompleteSystemPrompt } from "../services/prompt-builder-helper.ts";
import { callAI } from "../services/ai.ts";
import { validateAIResponse } from "../../shared/fsm/response-validator.ts";
import { generatePaymentMessage } from "../services/payment.ts";
import { formatPriceSync } from "../../shared/utils/currency-display.ts";
import { getExchangeRatesOnce } from "../../shared/utils/exchange-rates.ts";

import { processTransition, getNextExpectedInput, getCancellationMessage } from "../../shared/fsm/state-machine.ts";
import { sanitizeInput, isInputTooLong } from "../../shared/fsm/validator.ts";
import { analyzeUserMessage, mapNLUIntentToFSMIntent } from "../../shared/fsm/nlu.ts";
import { formatDateForLanguage } from "../../shared/fsm/localization.ts";
import type { ProcessingInput, ConversationContext } from "../../shared/fsm/types.ts";

import { createErrorResponse, createSuccessResponse, createUserFacingErrorResponse, DemoChatError } from "./error-handler.ts";
import type { RequestData, Tour, ChatResponse } from "../types/index.ts";

const VERSION = "v3.4.0";

async function parseRequest(req: Request): Promise<RequestData> {
  const body = await req.json();
  const { message: rawMessage, sessionId, conversationState, conversationStyle } = body;
  if (!sessionId) throw new DemoChatError("VALIDATION", "Session ID required", 400);
  return {
    message: sanitizeInput(rawMessage),
    sessionId,
    conversationState,
    conversationStyle,
    inputTooLong: isInputTooLong(rawMessage),
  };
}

/**
 * Deterministik tarih listesi mesajı
 * Tek tarih olsa bile kullanıcıya göster — otomatik seçme
 */
function buildDateSelectionMessage(
  tour: any,
  language: string,
  exRates: Record<string, number> = {},
  showDual = false,
): string {
  const tourCurrency = tour.currency || "TRY";
  const dateLines = tour.dates
    .map((d: any, idx: number) => {
      const dateText = formatDateForLanguage(d.departure_date, language);
      const priceText = d.price_adult
        ? ` - ${formatPriceSync(d.price_adult, tourCurrency, language, exRates, showDual)}`
        : "";
      const remaining = d.remaining_quota !== undefined ? d.remaining_quota : d.quota;
      const quotaText =
        remaining !== undefined ? (language === "tr" ? ` (${remaining} kişilik yer)` : ` (${remaining} spots)`) : "";
      return `${idx + 1}) ${dateText}${priceText}${quotaText}`;
    })
    .join("\n");

  const msgs: Record<string, string> = {
    tr: `*${tour.title}* için müsait tarihler:\n${dateLines}\n\nHangi tarihi tercih edersiniz?`,
    en: `Available dates for *${tour.title}*:\n${dateLines}\n\nWhich date do you prefer?`,
    de: `Verfügbare Termine für *${tour.title}*:\n${dateLines}\n\nWelches Datum bevorzugen Sie?`,
    ru: `Доступные даты для *${tour.title}*:\n${dateLines}\n\nКакую дату вы предпочитаете?`,
    ar: `التواريخ المتاحة لـ *${tour.title}*:\n${dateLines}\n\nما التاريخ الذي تفضله؟`,
    fr: `Dates disponibles pour *${tour.title}* :\n${dateLines}\n\nQuelle date préférez-vous ?`,
    es: `Fechas disponibles para *${tour.title}*:\n${dateLines}\n\n¿Qué fecha prefieres?`,
  };
  return msgs[language] || msgs.tr;
}

function buildFallbackResponse(options: {
  language: string;
  nluIntent: string;
  availableTours: Tour[];
  currentTour: Tour | null;
}): string {
  const { language, nluIntent, availableTours, currentTour } = options;

  if (currentTour?.dates?.length) {
    return buildDateSelectionMessage(currentTour, language);
  }

  if (nluIntent === "greeting" || nluIntent === "browse_tours") {
    const list = availableTours.slice(0, 6).map((tour) => `• ${tour.title}`).join("\n");
    const msgs: Record<string, string> = {
      tr: `Merhaba! Şu an size hızlıca yardımcı olayım. Mevcut turlarımız:\n${list}\n\nHangi tur hakkında bilgi almak istersiniz?`,
      en: `Hello! Here are our available tours:\n${list}\n\nWhich tour would you like to learn about?`,
    };
    return msgs[language] || msgs.tr;
  }

  const msgs: Record<string, string> = {
    tr: "Şu anda sistem yoğunluğu var ama devam edebiliriz. İsterseniz tur adını tekrar yazın, size uygun tarihleri hemen listeleyeyim.",
    en: "The system is a bit busy right now, but we can continue. Please send the tour name again and I’ll list the available dates right away.",
  };

  return msgs[language] || msgs.tr;
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

    // === INPUT UZUNLUK KONTROLÜ ===
    if (requestData.inputTooLong) {
      const _reqLang = (conversationState as any)?.language || "tr";
      const _tlMsgs: Record<string, string> = {
        tr: "Mesajınız çok uzun, lütfen daha kısa bir mesaj gönderin (maksimum 2000 karakter).",
        en: "Your message is too long. Please send a shorter message (max 2000 characters).",
        de: "Ihre Nachricht ist zu lang. Bitte senden Sie eine kürzere Nachricht (max. 2000 Zeichen).",
        ru: "Ваше сообщение слишком длинное. Отправьте более короткое сообщение (макс. 2000 символов).",
        ar: "رسالتك طويلة جداً، يرجى إرسال رسالة أقصر (الحد الأقصى 2000 حرف).",
        fr: "Votre message est trop long, veuillez envoyer un message plus court (max 2000 caractères).",
        es: "Su mensaje es demasiado largo, envíe un mensaje más corto (máx. 2000 caracteres).",
      };
      return new Response(JSON.stringify({
        response: _tlMsgs[_reqLang] || _tlMsgs.tr,
        conversationState,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === IP RATE LİMİT: 20 istek/dakika ===
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "unknown";
    if (clientIP !== "unknown") {
      const { data: _ipRl, error: _ipRle } = await supabase.rpc("check_rate_limit", {
        p_identifier: clientIP,
        p_identifier_type: "ip",
        p_window_seconds: 60,
        p_max_requests: 20,
      });
      if (!_ipRle && _ipRl && !_ipRl.allowed) {
        const _rlLang = (conversationState as any)?.language || "tr";
        const _rlMsgs: Record<string, string> = {
          tr: "Çok hızlı istek gönderiyorsunuz. 🙏 Lütfen bir dakika bekleyin.",
          en: "You're sending requests too quickly. 🙏 Please wait a moment.",
          de: "Sie senden Anfragen zu schnell. 🙏 Bitte warten Sie einen Moment.",
          ru: "Вы отправляете запросы слишком быстро. 🙏 Подождите минуту.",
          ar: "أنت ترسل الطلبات بسرعة كبيرة. 🙏 يرجى الانتظار لحظة.",
          fr: "Vous envoyez des requêtes trop rapidement. 🙏 Veuillez attendre un moment.",
          es: "Está enviando solicitudes muy rápido. 🙏 Por favor espere un momento.",
        };
        return new Response(JSON.stringify({
          response: _rlMsgs[_rlLang] || _rlMsgs.tr,
          conversationState,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // === SESSION RATE LİMİT: 50 mesaj/saat ===
    {
      const { data: _sessRl, error: _sessRle } = await supabase.rpc("check_rate_limit", {
        p_identifier: sessionId,
        p_identifier_type: "session",
        p_window_seconds: 3600,
        p_max_requests: 50,
      });
      if (!_sessRle && _sessRl && !_sessRl.allowed) {
        const _sLang = (conversationState as any)?.language || "tr";
        const _sMsgs: Record<string, string> = {
          tr: "Bu oturumda çok fazla mesaj gönderdiniz. Lütfen daha sonra tekrar deneyin.",
          en: "You've sent too many messages in this session. Please try again later.",
          de: "Sie haben in dieser Sitzung zu viele Nachrichten gesendet. Bitte versuchen Sie es später erneut.",
          ru: "Вы отправили слишком много сообщений в этом сеансе. Попробуйте позже.",
          ar: "لقد أرسلت رسائل كثيرة جداً في هذه الجلسة. يرجى المحاولة لاحقاً.",
          fr: "Vous avez envoyé trop de messages dans cette session. Veuillez réessayer plus tard.",
          es: "Ha enviado demasiados mensajes en esta sesión. Por favor intente más tarde.",
        };
        return new Response(JSON.stringify({
          response: _sMsgs[_sLang] || _sMsgs.tr,
          conversationState,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const [loadedTours, agencyData, contextResult] = await Promise.all([
      loadToursFromDatabase(supabase),
      getAgencyData(supabase),
      loadOrCreateContext({
        clientState: conversationState,
        message,
        conversationStyle,
      }),
    ]);

    // Tours
    let rawTours = loadedTours;
    if (!rawTours || rawTours.length === 0) {
      logger.info("No tours in DB, using DEMO_TOURS");
      rawTours = DEMO_TOURS as any[];
    }
    rawTours = await enrichToursWithSoldPax(supabase, rawTours);

    // Context
    const { context } = contextResult;
    language = context.language;
    const previousContext: ConversationContext = { ...context };

    const availableTours = getLocalizedTours(rawTours, context.language);
    logger.info(`Using ${availableTours.length} tours (lang: ${context.language})`);

    logger.debug("Message", { message, stage: context.stage, collectionStep: context.collectionStep });

    // NLU — availableTours kullan (DEMO_TOURS DEĞİL)
    const nluContext = buildNLUContext(context);
    const nluResult = await analyzeUserMessage(message, nluContext, context.stage, context.currentTour, availableTours);

    let detectedIntent = mapNLUIntentToFSMIntent(nluResult.intent);
    logger.intent(nluResult.intent, detectedIntent);

    // NLU dil tespitini context'e yaz.
    // Haiku regex'ten çok daha doğru tespit eder — birincil kaynak olarak kullan.
    const SUPPORTED_LANGS = ["tr", "en", "de", "ru", "ar", "fr", "es"] as const;
    type SupportedLang = typeof SUPPORTED_LANGS[number];
    const nluLang = nluResult.language as string | undefined;
    if (nluLang && (SUPPORTED_LANGS as readonly string[]).includes(nluLang)) {
      const typed = nluLang as SupportedLang;
      if (typed !== context.language) {
        logger.info("LANGUAGE_FROM_NLU", { prev: context.language, next: typed });
        context.language = typed;
        language = typed; // local primitive'i de sync et — hata mesajları stale "tr" kullanmasın
      }
    }

    const expectedInput = getNextExpectedInput(context);

    // Tur eşleştir
    const { selectedTour, multipleMatches } = findMatchingTours(
      message,
      nluResult.entities,
      availableTours,
      expectedInput,
      nluResult.intent,
    );

    // Stage koruma: COLLECTING_INFO / CONFIRMING'de NLU yanlışlıkla tour_search döndürdüyse
    // provide_info'ya dönüştür. Kullanıcı pax/isim/telefon veriyor, tur araması değil.
    // COLLECTING_INFO → TOUR_SELECTED regex geçişi bu override'dan etkilenmez (kendi pattern'ini kullanır).
    if (
      (context.stage === "COLLECTING_INFO" || context.stage === "CONFIRMING") &&
      nluResult.intent === "tour_search"
    ) {
      logger.info("INTENT_OVERRIDE", {
        from: "tour_search",
        to: "provide_info",
        reason: "stage_protection",
        stage: context.stage,
        collectionStep: context.collectionStep,
      });
      nluResult.intent = "provide_info";
      detectedIntent = mapNLUIntentToFSMIntent("provide_info");
    }

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

    // CONTEXT_AFTER_NLU — NLU + extraction sonrası tam durum
    logger.info("CONTEXT_AFTER_NLU", {
      stage: context.stage,
      collectionStep: context.collectionStep,
      nluIntent: nluResult.intent,
      mappedIntent: detectedIntent,
      // NLU'dan gelen ham entity'ler
      nluEntities: nluResult.entities,
      nluUpdates: nluResult.updates,
      // Extraction sonucu
      extractedDate: extractedInfo.selectedDate,
      extractedDateId: extractedInfo.dateId,
      extractedPax: extractedInfo.paxAdult,
      extractedName: extractedInfo.fullName,
      extractedPhone: extractedInfo.phone ? "[MASKED]" : undefined,
      // Mevcut context'teki rezervasyon bilgisi
      existingDateId: context.reservationInfo?.dateId,
      existingPax: context.reservationInfo?.paxAdult,
      existingName: context.reservationInfo?.fullName,
      currentTourId: context.currentTour?.id,
      selectedTourFromNLU: selectedTour ? (selectedTour as any).id : null,
    });

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

    // Çoklu para birimi için döviz kurları (bir kez al, aşağıda paylaş)
    const _showDualCurrency = (agencyData as any)?.show_multi_currency !== false;
    const _exRates = _showDualCurrency ? await getExchangeRatesOnce().catch(() => ({})) : {};

    // Kullanıcı iptal etti → AI çağırmadan direkt yanıt dön
    if (newContext.justCancelled) {
      newContext.justCancelled = false;
      const cancelReply = getCancellationMessage(newContext.language);
      await saveConversation(supabase, sessionId, message, cancelReply);
      return createSuccessResponse({ response: cancelReply, conversationState: newContext });
    }

    if (
      newContext.stage === "TOUR_SELECTED" &&
      newContext.currentTour &&
      ["tour_search", "select_tour", "reservation_intent"].includes(nluResult.intent) &&
      newContext.currentTour.id !== context.currentTour?.id
    ) {
      const selectedTourData = findTourById(newContext.currentTour.id, availableTours);
      if (selectedTourData?.dates?.length) {
        const dateReply = buildDateSelectionMessage(selectedTourData, newContext.language, _exRates, _showDualCurrency);
        await saveConversation(supabase, sessionId, message, dateReply);
        return createSuccessResponse({ response: dateReply, conversationState: newContext });
      }
    }

    // === DETERMİNİSTİK TARİH LİSTESİ ===
    // COLLECTING_INFO + waiting_for_date → tarih listesi göster
    // Guard: dateId zaten set ise (kullanıcı az önce tarih verdi) listeyi tekrar GÖSTERME
    if (
      newContext.stage === "COLLECTING_INFO" &&
      newContext.collectionStep === "waiting_for_date" &&
      newContext.currentTour &&
      !newContext.reservationInfo?.dateId
    ) {
      const tourForDates = findTourById(newContext.currentTour.id, availableTours);
      if (tourForDates?.dates?.length) {
        // Kullanıcı var olmayan tarih girdiyse (selectedDate set ama dateId yok) bilgilendirici preamble
        const requestedDate = newContext.reservationInfo?.selectedDate;
        const unavailablePreambles: Record<string, string> = {
          tr: requestedDate ? `"${requestedDate}" tarihi bu tur için müsait değil.\n\n` : "",
          en: requestedDate ? `The date "${requestedDate}" is not available for this tour.\n\n` : "",
          de: requestedDate ? `Das Datum "${requestedDate}" ist für diese Tour nicht verfügbar.\n\n` : "",
          ru: requestedDate ? `Дата "${requestedDate}" недоступна для этого тура.\n\n` : "",
          ar: requestedDate ? `التاريخ "${requestedDate}" غير متاح لهذه الجولة.\n\n` : "",
          fr: requestedDate ? `La date "${requestedDate}" n'est pas disponible pour ce circuit.\n\n` : "",
          es: requestedDate ? `La fecha "${requestedDate}" no está disponible para este tour.\n\n` : "",
        };
        const preamble = unavailablePreambles[newContext.language] ?? unavailablePreambles.en;
        const dateListMsg = buildDateSelectionMessage(tourForDates, newContext.language, _exRates, _showDualCurrency);
        const dateReply = preamble + dateListMsg;
        // selectedDate temizle: DB'de olmayan tarih context'e bırakılmamalı
        newContext.reservationInfo = { ...newContext.reservationInfo, selectedDate: undefined };
        await saveConversation(supabase, sessionId, message, dateReply);
        return createSuccessResponse({ response: dateReply, conversationState: newContext });
      }
    }

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
              const msgs: Record<string, string> = {
                tr: `Üzgünüz, seçtiğiniz tarih için yeterli kontenjan bulunmamaktadır (kalan: ${remainingQuota} kişi).\n\n📅 *Müsait Diğer Tarihler:*\n${availableDatesList.join("\n")}\n\nBu tarihlerden birini seçmek ister misiniz?`,
                en: `Sorry, the selected date doesn't have enough spots (remaining: ${remainingQuota}).\n\n📅 *Available Dates:*\n${availableDatesList.join("\n")}\n\nWould you like to choose one of these dates?`,
              };
              quotaMsg = msgs[lang] || msgs["tr"];
            } else {
              const msgs: Record<string, string> = {
                tr: `Üzgünüz, seçtiğiniz tarih için yeterli kontenjan bulunmamaktadır (kalan: ${remainingQuota} kişi). Şu an bu tur için müsait başka tarih de bulunmuyor.\n\nLütfen ${agencyData?.name || ""} ile iletişime geçiniz.${agencyPhone}`,
                en: `Sorry, there are not enough spots (remaining: ${remainingQuota}). No other dates available.\n\nPlease contact ${agencyData?.name || ""}.${agencyPhone}`,
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
        const errCode = saveResult.error || "UNKNOWN";
        const lang = language || "tr";

        if (errCode === "QUOTA_EXCEEDED") {
          // Sadece tarih sil — isim/telefon/kişi sayısı KORUNUR
          newContext.reservationInfo.dateId = undefined;
          newContext.reservationInfo.selectedDate = undefined;
          newContext.stage = "COLLECTING_INFO";
          newContext.reservationConfirmed = false;
          newContext.collectionStep = "waiting_for_date";
          const _msgs: Record<string, string> = {
            tr: `Üzgünüm, seçtiğiniz tarih için kontenjan dolmuş. 😔 Başka bir tarih seçer misiniz?`,
            en: `Sorry, the date you selected is fully booked. 😔 Could you choose another date?`,
            de: `Es tut mir leid, das gewählte Datum ist ausgebucht. 😔 Können Sie ein anderes Datum wählen?`,
            ru: `Извините, выбранная дата забронирована. 😔 Можете выбрать другую дату?`,
            ar: `آسف، التاريخ محجوز بالكامل. 😔 هل يمكنك اختيار تاريخ آخر؟`,
            fr: `Désolé, la date est complète. 😔 Pouvez-vous choisir une autre date ?`,
            es: `Lo siento, la fecha está reservada. 😔 ¿Puede elegir otra fecha?`,
          };
          reservationErrorMessage = _msgs[lang] || _msgs.tr;

        } else if (errCode === "DUPLICATE") {
          // Zaten kayıtlı → BROWSING'e geç
          newContext.stage = "BROWSING";
          newContext.reservationConfirmed = false;
          newContext.reservationInfo = {};
          const _msgs: Record<string, string> = {
            tr: `Bu tur için zaten kayıtlı görünüyorsunuz. ℹ️ Detaylar için ${agencyName} ile iletişime geçin.${phoneInfo}`,
            en: `You appear to already be registered for this tour. ℹ️ Please contact ${agencyName}.${phoneInfo}`,
            de: `Sie scheinen bereits angemeldet zu sein. ℹ️ Bitte kontaktieren Sie ${agencyName}.${phoneInfo}`,
            ru: `Похоже, вы уже зарегистрированы. ℹ️ Свяжитесь с ${agencyName}.${phoneInfo}`,
            ar: `يبدو أنك مسجل بالفعل. ℹ️ يرجى التواصل مع ${agencyName}.${phoneInfo}`,
            fr: `Vous semblez déjà inscrit. ℹ️ Veuillez contacter ${agencyName}.${phoneInfo}`,
            es: `Parece que ya está registrado. ℹ️ Contacte a ${agencyName}.${phoneInfo}`,
          };
          reservationErrorMessage = _msgs[lang] || _msgs.tr;

        } else if (errCode === "TOUR_DATE_NOT_FOUND") {
          // Tarih DB'de artık yok — tarih sil, bilgiler koru
          newContext.reservationInfo.dateId = undefined;
          newContext.reservationInfo.selectedDate = undefined;
          newContext.stage = "COLLECTING_INFO";
          newContext.reservationConfirmed = false;
          newContext.collectionStep = "waiting_for_date";
          const _msgs: Record<string, string> = {
            tr: `Seçtiğiniz tarih artık mevcut değil. 😔 Lütfen başka bir tarih seçin.`,
            en: `The date you selected is no longer available. 😔 Please choose another date.`,
            de: `Das gewählte Datum ist nicht mehr verfügbar. 😔 Bitte wählen Sie ein anderes.`,
            ru: `Выбранная дата больше не доступна. 😔 Выберите другую.`,
            ar: `التاريخ لم يعد متاحاً. 😔 يرجى اختيار تاريخ آخر.`,
            fr: `La date n'est plus disponible. 😔 Veuillez en choisir une autre.`,
            es: `La fecha ya no está disponible. 😔 Elija otra por favor.`,
          };
          reservationErrorMessage = _msgs[lang] || _msgs.tr;

        } else if (errCode === "TOUR_NOT_FOUND") {
          // Tur DB'de artık yok — tümünü temizle, BROWSING'e geç
          newContext.stage = "BROWSING";
          newContext.currentTour = null;
          newContext.reservationInfo = {};
          newContext.reservationConfirmed = false;
          const _msgs: Record<string, string> = {
            tr: `Seçtiğiniz tur artık mevcut değil. 😔 Güncel turlarımıza bakabilirsiniz.`,
            en: `The tour you selected is no longer available. 😔 Please check our current tours.`,
            de: `Die gewählte Tour ist nicht mehr verfügbar. 😔 Bitte sehen Sie unsere aktuellen Touren.`,
            ru: `Выбранный тур больше не доступен. 😔 Посмотрите наши актуальные туры.`,
            ar: `الجولة لم تعد متاحة. 😔 يرجى الاطلاع على جولاتنا الحالية.`,
            fr: `Le circuit n'est plus disponible. 😔 Consultez nos circuits actuels.`,
            es: `El tour ya no está disponible. 😔 Consulte nuestros tours actuales.`,
          };
          reservationErrorMessage = _msgs[lang] || _msgs.tr;

        } else {
          // Bilinmeyen hata — önceki stage'e geri dön, tekrar denenebilir
          newContext.stage = context.stage;
          newContext.reservationConfirmed = false;
          const _msgs: Record<string, string> = {
            tr: `Rezervasyonunuz oluşturulurken bir sorun yaşandı. Lütfen ${agencyName} ile iletişime geçiniz.${phoneInfo}`,
            en: `There was an issue creating your reservation. Please contact ${agencyName}.${phoneInfo}`,
            de: `Problem bei der Reservierung. Bitte kontaktieren Sie ${agencyName}.${phoneInfo}`,
            ru: `Проблема при создании. Свяжитесь с ${agencyName}.${phoneInfo}`,
            ar: `حدثت مشكلة. يرجى التواصل مع ${agencyName}.${phoneInfo}`,
            fr: `Un problème est survenu. Veuillez contacter ${agencyName}.${phoneInfo}`,
            es: `Hubo un problema. Por favor contacte a ${agencyName}.${phoneInfo}`,
          };
          reservationErrorMessage = _msgs[lang] || _msgs.tr;
        }
        reservationSaveFailed = true;
      }
    }

    // System prompt
    const systemPrompt = buildCompleteSystemPrompt({
      context: newContext,
      previousContext,
      availableTours,
      agencyData,
      paymentInfo,
      multipleTourMatches: multipleMatches,
      selectedTour,
    });

    const conversationHistory = await getConversationHistory(supabase, sessionId);

    // Rezervasyon hatası
    if (reservationSaveFailed) {
      await saveConversation(supabase, sessionId, message, reservationErrorMessage);
      return createSuccessResponse({ response: reservationErrorMessage, conversationState: newContext });
    }

    // === DETERMİNİSTİK TAMAMLAMA MESAJI ===
    if (isNewlyCompleted && !reservationSaveFailed && newContext.reservationInfo) {
      const selectedTourData = newContext.currentTour ? findTourById(newContext.currentTour.id, availableTours) : null;
      const selectedDateData = selectedTourData?.dates?.find((d: any) => d.id === newContext.reservationInfo.dateId);

      const formattedDate = selectedDateData?.departure_date
        ? formatDateForLanguage(selectedDateData.departure_date, newContext.language)
        : newContext.reservationInfo.selectedDate || "-";

      const adultCount = newContext.reservationInfo.paxAdult || 0;
      const childCount = newContext.reservationInfo.paxChild || 0;
      const paxTextMap: Record<string, string> = {
        tr: `${adultCount} Yetişkin${childCount ? `, ${childCount} Çocuk` : ""}`,
        en: `${adultCount} Adult${childCount ? `, ${childCount} Child` : ""}`,
        de: `${adultCount} Erwachsene${childCount ? `, ${childCount} Kind${childCount > 1 ? "er" : ""}` : ""}`,
        ru: `${adultCount} взросл${adultCount === 1 ? "ый" : "ых"}${childCount ? `, ${childCount} ребёнок` : ""}`,
        ar: `${adultCount} بالغ${childCount ? `، ${childCount} طفل` : ""}`,
        fr: `${adultCount} adulte${adultCount > 1 ? "s" : ""}${childCount ? `, ${childCount} enfant${childCount > 1 ? "s" : ""}` : ""}`,
        es: `${adultCount} adulto${adultCount > 1 ? "s" : ""}${childCount ? `, ${childCount} niño${childCount > 1 ? "s" : ""}` : ""}`,
      };
      const paxText = paxTextMap[newContext.language] || paxTextMap.en;

      const _demoTourTitle = selectedTourData?.title || newContext.reservationInfo.tourTitle || "-";
      const _name = newContext.reservationInfo.fullName || "";
      const completionMessages: Record<string, string> = {
        tr: `Bilgilerinizi aldım ${_name}, çok teşekkür ederim! 😊\n*${_demoTourTitle}* için ön kaydınızı başarıyla gerçekleştirdim.\n\n*Kayıt Özetiniz:*\n• *Tur:* ${_demoTourTitle}\n• *Tarih:* ${formattedDate}\n• *Kişi:* ${paxText}\n• *İsim:* ${_name || "-"}\n• *Telefon:* ${newContext.reservationInfo.phone || "-"}\n\nEkip arkadaşlarımız size en kısa sürede ulaşacaktır.`,
        en: `Thank you, ${_name}! 😊\nYour pre-registration for *${_demoTourTitle}* has been created successfully.\n\n*Registration Summary:*\n• *Tour:* ${_demoTourTitle}\n• *Date:* ${formattedDate}\n• *People:* ${paxText}\n• *Name:* ${_name || "-"}\n• *Phone:* ${newContext.reservationInfo.phone || "-"}\n\nOur team will contact you shortly.`,
        de: `Vielen Dank, ${_name}! 😊\nIhre Voranmeldung für *${_demoTourTitle}* wurde erfolgreich erstellt.\n\n*Buchungsübersicht:*\n• *Tour:* ${_demoTourTitle}\n• *Datum:* ${formattedDate}\n• *Personen:* ${paxText}\n• *Name:* ${_name || "-"}\n• *Telefon:* ${newContext.reservationInfo.phone || "-"}\n\nUnser Team wird sich in Kürze bei Ihnen melden.`,
        ru: `Спасибо, ${_name}! 😊\nВаша предварительная запись на *${_demoTourTitle}* успешно оформлена.\n\n*Сводка бронирования:*\n• *Тур:* ${_demoTourTitle}\n• *Дата:* ${formattedDate}\n• *Количество:* ${paxText}\n• *Имя:* ${_name || "-"}\n• *Телефон:* ${newContext.reservationInfo.phone || "-"}\n\nНаши специалисты свяжутся с вами в ближайшее время.`,
        ar: `شكراً لك، ${_name}! 😊\nتم تسجيل طلبك المسبق لجولة *${_demoTourTitle}* بنجاح.\n\n*ملخص الحجز:*\n• *الجولة:* ${_demoTourTitle}\n• *التاريخ:* ${formattedDate}\n• *عدد الأشخاص:* ${paxText}\n• *الاسم:* ${_name || "-"}\n• *الهاتف:* ${newContext.reservationInfo.phone || "-"}\n\nسيتواصل معك فريقنا في أقرب وقت.`,
        fr: `Merci, ${_name}! 😊\nVotre pré-inscription pour *${_demoTourTitle}* a été créée avec succès.\n\n*Récapitulatif :*\n• *Circuit :* ${_demoTourTitle}\n• *Date :* ${formattedDate}\n• *Personnes :* ${paxText}\n• *Nom :* ${_name || "-"}\n• *Téléphone :* ${newContext.reservationInfo.phone || "-"}\n\nNotre équipe vous contactera très prochainement.`,
        es: `¡Gracias, ${_name}! 😊\nSu registro previo para *${_demoTourTitle}* ha sido creado con éxito.\n\n*Resumen:*\n• *Tour:* ${_demoTourTitle}\n• *Fecha:* ${formattedDate}\n• *Personas:* ${paxText}\n• *Nombre:* ${_name || "-"}\n• *Teléfono:* ${newContext.reservationInfo.phone || "-"}\n\nNuestro equipo se pondrá en contacto pronto.`,
      };

      let deterministicReply = completionMessages[newContext.language] || completionMessages.tr;

      if (paymentInstructions) {
        if (!selectedDateData) {
          logger.error("PAYMENT_BLOCK_SKIPPED_NULL_DATE", {
            tourId: newContext.currentTour?.id,
            dateId: newContext.reservationInfo.dateId,
            language: newContext.language,
          });
        } else {
          const adultPrice = selectedDateData.price_adult || 0;
          const childPrice = selectedDateData.price_child ?? adultPrice;
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

    let aiResponse = "";
    try {
      logger.info("Calling AI...");
      aiResponse = await callAI(messagesForAI, CONFIG.DEFAULT_AI_TEMPERATURE);
    } catch (error) {
      logger.error("AI call failed, using fallback response", error);
      const fallbackResponse = buildFallbackResponse({
        language: newContext.language,
        nluIntent: nluResult.intent,
        availableTours,
        currentTour: newContext.currentTour ? findTourById(newContext.currentTour.id, availableTours) : null,
      });
      await saveConversation(supabase, sessionId, message, fallbackResponse);
      return createSuccessResponse({ response: fallbackResponse, conversationState: newContext });
    }

    let finalResponse = typeof aiResponse === "string" ? aiResponse.trim() : "";

    // Katman 2 güvenlik: AI'nın yetkisiz rezervasyon onayı iddiasını engelle.
    if (finalResponse) {
      const validation = validateAIResponse(finalResponse, newContext.language, newContext.stage);
      if (validation.wasModified) {
        logger.error("Response validator modified AI output", { stage: newContext.stage });
        finalResponse = validation.text;
      }
    }

    if (!finalResponse) {
      finalResponse = buildFallbackResponse({
        language: newContext.language,
        nluIntent: nluResult.intent,
        availableTours,
        currentTour: newContext.currentTour ? findTourById(newContext.currentTour.id, availableTours) : null,
      });
    }

    // Ödeme bilgisi (gerekirse)
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
        finalResponse = finalResponse + paymentMessage;
        newContext.paymentInfoSent = true;
      }
    }

    if (nluResult.intent === "complaint_feedback") {
      await saveComplaint(supabase, sessionId, message);
    }

    await saveConversation(supabase, sessionId, message, finalResponse);

    return createSuccessResponse({ response: finalResponse, conversationState: newContext });
  } catch (error) {
    if (error instanceof DemoChatError) {
      return createUserFacingErrorResponse(error.type, language, error);
    }
    logger.error("Chat request failed", error);
    return createUserFacingErrorResponse("UNKNOWN", language, error);
  }
}
