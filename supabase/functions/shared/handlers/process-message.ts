// Unified message processing core — hem demo-chat hem whatsapp-webhook tarafından kullanılır.
// Tüm kanal-bağımsız rezervasyon akış mantığı burada toplanır.
// I/O (DB, WhatsApp API, HTTP response) ChannelAdapter üzerinden soyutlanmıştır.

import type { ConversationContext, ProcessingInput } from "../fsm/types.ts";
import {
  createInitialContext,
  processTransition,
  getNextExpectedInput,
  getCancellationMessage,
} from "../fsm/state-machine.ts";
import { sanitizeInput, isInputTooLong } from "../fsm/validator.ts";
import { analyzeUserMessage, mapNLUIntentToFSMIntent } from "../fsm/nlu.ts";
import {
  detectLanguageChangeIntent,
  getDefaultToneForLanguage,
  formatDateForLanguage,
} from "../fsm/localization.ts";
import { detectLanguage } from "../fsm/language.ts";
import { buildSystemPrompt } from "../fsm/prompt-builder.ts";
import { validateAIResponse } from "../fsm/response-validator.ts";
import { extractEmail, isNegativePaxMessage } from "../fsm/simple-extractor.ts";
import { findTourById } from "../fsm/tour-matcher.ts";
import { findMatchingTours } from "../services/tour-matching.ts";
import { extractAllInfo } from "../services/info-extractor.ts";
import { buildNLUContextBase } from "../services/context-manager.ts";
import { buildAIFallbackResponse } from "../services/fallback-response.ts";
import { callAI } from "../services/ai.ts";
import { generatePaymentMessage } from "../services/payment-message.ts";
import { getExchangeRatesOnce } from "../utils/exchange-rates.ts";
import { formatPriceSync } from "../utils/currency-display.ts";
import type { ChannelAdapter, ProcessMessageInput, ProcessMessageResult } from "./types.ts";

export async function processChatMessage(input: ProcessMessageInput): Promise<ProcessMessageResult> {
  const { message: rawMessage, adapter, agency, supabase, tours, paymentInstructions, languageCurrencies, primaryCurrency, returningUserName } = input;

  // === 1. INPUT UZUNLUK KONTROLÜ ===
  if (isInputTooLong(rawMessage)) {
    const _tlLang = detectLanguageChangeIntent(rawMessage.slice(0, 200)) || "tr";
    const _tlMsgs: Record<string, string> = {
      tr: "Mesajınız çok uzun, lütfen daha kısa bir mesaj gönderin (maksimum 2000 karakter).",
      en: "Your message is too long. Please send a shorter message (max 2000 characters).",
      de: "Ihre Nachricht ist zu lang. Bitte senden Sie eine kürzere Nachricht (max. 2000 Zeichen).",
      ru: "Ваше сообщение слишком длинное. Отправьте более короткое сообщение (макс. 2000 символов).",
      ar: "رسالتك طويلة جداً، يرجى إرسال رسالة أقصر (الحد الأقصى 2000 حرف).",
      fr: "Votre message est trop long, veuillez envoyer un message plus court (max 2000 caractères).",
      es: "Su mensaje es demasiado largo, envíe un mensaje más corto (máx. 2000 caracteres).",
    };
    await adapter.sendErrorResponse(_tlMsgs[_tlLang] || _tlMsgs.tr);
    return { success: false, error: "input_too_long" };
  }

  const message = sanitizeInput(rawMessage);

  // === 2. CONTEXT YÜKLE ===
  const loadedContext = await adapter.loadContext();

  // === 3. DİL TESPİTİ ===
  const languageChangeIntent = detectLanguageChangeIntent(message);
  const runtimeDetectedLang = await detectLanguage(message);

  // === 4. CONTEXT BAŞLAT / GÜNCELLE ===
  let context: ConversationContext;
  if (loadedContext) {
    context = loadedContext;
    if (languageChangeIntent && languageChangeIntent !== context.language) {
      context.language = languageChangeIntent;
      context.tone = getDefaultToneForLanguage(languageChangeIntent) as any;
    } else if (runtimeDetectedLang && runtimeDetectedLang !== context.language) {
      const _hasNonAscii = /[^\x00-\x7F]/.test(message);
      const _isShortMsg = message.length < 200;
      if (_hasNonAscii || _isShortMsg) context.language = runtimeDetectedLang;
    }
  } else {
    const lang = languageChangeIntent || runtimeDetectedLang || "tr";
    context = createInitialContext(lang, getDefaultToneForLanguage(lang) as any);
  }

  // Agency email toplama ayarını her mesajda sync et (admin toggle anlık etki etsin)
  context.collectEmail = agency.collect_email === true;

  // === 5. HISTORY YÜKLE (NLU + AI için) ===
  const historyAsc = await adapter.loadHistory(20); // Zaten ASC, adapter'dan geliyor

  // === 6. NLU CONTEXT + ANALIZ ===
  const historySummary = historyAsc.map((m) => `${m.role}: ${m.content}`).join("\n");
  const nluContextStr = (historySummary ? historySummary + "\n\n" : "") + buildNLUContextBase(context);

  const nluResult = await analyzeUserMessage(message, nluContextStr, context.stage, context.currentTour, tours);
  console.log("[process-message] Intent:", nluResult.intent, "| Stage:", context.stage, "| Lang:", context.language);

  // NLU dil tespitini uygula (ASCII guard ile)
  if (nluResult.language) {
    const SUPPORTED = ["tr", "en", "de", "ru", "ar", "fr", "es"];
    if (SUPPORTED.includes(nluResult.language) && nluResult.language !== context.language) {
      const _hasNonAscii = /[^\x00-\x7F]/.test(message);
      const _isShortMsg = message.length < 200;
      if (_hasNonAscii || _isShortMsg) {
        context.language = nluResult.language;
      }
    }
  }

  let fsmIntent = mapNLUIntentToFSMIntent(nluResult.intent);

  // Şikayet kaydı (fire-and-forget)
  if (nluResult.intent === "complaint_feedback") {
    supabase.from("complaints").insert({ agency_id: agency.id, message, type: "complaint", status: "new" }).then(() => {});
  }

  // === 7. TUR EŞLEŞTİRME ===
  const { selectedTour, multipleMatches: multipleTourMatches } = findMatchingTours(
    message,
    nluResult.entities,
    tours,
    getNextExpectedInput(context),
    nluResult.intent,
  );
  if (selectedTour) console.log("[process-message] Tour matched:", selectedTour.title);

  // Stage koruma: COLLECTING_INFO / CONFIRMING'de tour_search → provide_info
  if (
    (context.stage === "COLLECTING_INFO" || context.stage === "CONFIRMING") &&
    nluResult.intent === "tour_search"
  ) {
    nluResult.intent = "provide_info";
    fsmIntent = mapNLUIntentToFSMIntent("provide_info");
  }

  // === 8. BİLGİ ÇIKARMA ===
  const extractedInfo = extractAllInfo({ message, nluResult, fsmIntent, context, tours });

  // Negatif pax kontrolü
  if (context.collectionStep === "waiting_for_pax" && isNegativePaxMessage(message)) {
    const _negMsgs: Record<string, string> = {
      tr: "Geçerli bir kişi sayısı belirtmelisiniz (en az 1 kişi).",
      en: "Please enter a valid number of people (at least 1).",
      de: "Bitte geben Sie eine gültige Personenzahl an (mindestens 1).",
      ru: "Укажите корректное количество человек (минимум 1).",
      ar: "يرجى إدخال عدد صحيح من الأشخاص (1 على الأقل).",
      fr: "Veuillez indiquer un nombre valide de personnes (au moins 1).",
      es: "Por favor indique un número válido de personas (mínimo 1).",
    };
    const negReply = _negMsgs[context.language] || _negMsgs.tr;
    await adapter.saveResponse(negReply, context);
    await adapter.sendResponse(negReply);
    return { success: true, response: negReply, newContext: context };
  }

  // === 9. FSM GEÇİŞİ ===
  const fsmInput: ProcessingInput = {
    userMessage: message,
    detectedIntent: fsmIntent,
    extractedInfo,
    selectedTour: selectedTour as any,
    language: context.language,
  };
  const newContext = processTransition(context, fsmInput);
  console.log(`[process-message] ${context.stage} → ${newContext.stage}`);

  // FIX: Geçersiz tarih cleanup (dateId olmadan context'e sızmayı engelle)
  const _invalidDateForPreamble =
    newContext.collectionStep === "waiting_for_date" &&
    newContext.reservationInfo?.selectedDate &&
    !newContext.reservationInfo?.dateId
      ? newContext.reservationInfo.selectedDate
      : undefined;
  if (_invalidDateForPreamble) {
    newContext.reservationInfo = { ...newContext.reservationInfo, selectedDate: undefined };
  }

  // === 10. İPTAL MESAJI (deterministik) ===
  if (newContext.justCancelled) {
    newContext.justCancelled = false;
    const cancelReply = getCancellationMessage(newContext.language);
    await adapter.saveResponse(cancelReply, newContext);
    await adapter.sendResponse(cancelReply);
    return { success: true, response: cancelReply, newContext };
  }

  // === 11. TARİH LİSTESİ (deterministik) ===
  if (
    newContext.stage === "COLLECTING_INFO" &&
    newContext.collectionStep === "waiting_for_date" &&
    newContext.currentTour
  ) {
    const tourForDates = findTourById(newContext.currentTour.id, tours);
    if (tourForDates?.dates?.length) {
      const _exRates = await getExchangeRatesOnce().catch(() => ({}));
      const _tourCurrency = tourForDates.currency || "TRY";
      const _showDual = agency.show_multi_currency !== false;
      const dateLines = tourForDates.dates
        .map((d: any, idx: number) => {
          const dateText = formatDateForLanguage(d.departure_date, newContext.language);
          const priceText = d.price_adult
            ? ` - ${formatPriceSync(d.price_adult, _tourCurrency, newContext.language, _exRates, _showDual)}`
            : "";
          const remaining = d.remaining_quota !== undefined ? d.remaining_quota : d.quota;
          const quotaText = remaining !== undefined
            ? newContext.language === "tr" ? ` (${remaining} kişilik yer)` : ` (${remaining} spots)`
            : "";
          return `${idx + 1}) ${dateText}${priceText}${quotaText}`;
        })
        .join("\n");

      const dateSelMsgs: Record<string, string> = {
        tr: `*${tourForDates.title}* için müsait tarihler:\n${dateLines}\n\nHangi tarihi tercih edersiniz?`,
        en: `Available dates for *${tourForDates.title}*:\n${dateLines}\n\nWhich date do you prefer?`,
        de: `Verfügbare Termine für *${tourForDates.title}*:\n${dateLines}\n\nWelches Datum bevorzugen Sie?`,
        ru: `Доступные даты для *${tourForDates.title}*:\n${dateLines}\n\nКакую дату вы предпочитаете?`,
        ar: `التواريخ المتاحة لـ *${tourForDates.title}*:\n${dateLines}\n\nما التاريخ الذي تفضله؟`,
        fr: `Dates disponibles pour *${tourForDates.title}* :\n${dateLines}\n\nQuelle date préférez-vous ?`,
        es: `Fechas disponibles para *${tourForDates.title}*:\n${dateLines}\n\n¿Qué fecha prefieres?`,
      };

      let dateReply = dateSelMsgs[newContext.language] || dateSelMsgs.tr;
      if (_invalidDateForPreamble) {
        const _preambles: Record<string, string> = {
          tr: `"${_invalidDateForPreamble}" tarihi bu tur için müsait değil. 😔\n\n`,
          en: `Sorry, "${_invalidDateForPreamble}" is not available for this tour. 😔\n\n`,
          de: `Leider ist "${_invalidDateForPreamble}" für diese Tour nicht verfügbar. 😔\n\n`,
          ru: `К сожалению, "${_invalidDateForPreamble}" недоступно для этого тура. 😔\n\n`,
          ar: `للأسف، "${_invalidDateForPreamble}" غير متاح لهذه الجولة. 😔\n\n`,
          fr: `Désolé, "${_invalidDateForPreamble}" n'est pas disponible pour ce circuit. 😔\n\n`,
          es: `Lo siento, "${_invalidDateForPreamble}" no está disponible para este tour. 😔\n\n`,
        };
        dateReply = (_preambles[newContext.language] || _preambles.tr) + dateReply;
      }

      await adapter.saveResponse(dateReply, newContext);
      await adapter.sendResponse(dateReply);
      return { success: true, response: dateReply, newContext };
    }
  }

  // === 12. EMAİL ADIMI (deterministik) ===
  if (newContext.stage === "COLLECTING_INFO" && newContext.collectionStep === "waiting_for_email") {
    const _lang = newContext.language || "tr";
    if (context.collectionStep !== "waiting_for_email") {
      const _askMsgs: Record<string, string> = {
        tr: `Son olarak, email adresinizi paylaşmak ister misiniz? 📧 Özel fırsatları iletebiliriz.\n\n(Atlamak için "geç" yazabilirsiniz)`,
        en: `Finally, would you like to share your email? 📧 We can send you special offers.\n\n(Type "skip" to pass)`,
        de: `Möchten Sie zum Schluss Ihre E-Mail teilen? 📧 Wir senden Ihnen exklusive Angebote.\n\n("überspringen" zum Auslassen)`,
        ru: `Напоследок, хотите поделиться email? 📧 Будем отправлять специальные предложения.\n\n(Напишите "пропустить" для пропуска)`,
        ar: `أخيراً، هل ترغب في مشاركة بريدك الإلكتروني؟ 📧 سنرسل لك عروضاً خاصة.\n\n(اكتب "تخطي" للتجاوز)`,
        fr: `Enfin, souhaitez-vous partager votre email? 📧 Nous vous enverrons des offres spéciales.\n\n(Tapez "passer" pour ignorer)`,
        es: `Por último, ¿desea compartir su email? 📧 Le enviaremos ofertas especiales.\n\n(Escriba "saltar" para omitir)`,
      };
      const askReply = _askMsgs[_lang] || _askMsgs.tr;
      await adapter.saveResponse(askReply, newContext);
      await adapter.sendResponse(askReply);
      return { success: true, response: askReply, newContext };
    }
    if (message.includes("@") && !extractEmail(message)) {
      const _invalidMsgs: Record<string, string> = {
        tr: "Bu email adresi geçersiz görünüyor. Doğru formatta tekrar girer misiniz? (örn: ad@domain.com)",
        en: "This email address looks invalid. Could you enter it in the correct format? (e.g., name@domain.com)",
        de: "Diese E-Mail-Adresse scheint ungültig. Bitte im richtigen Format eingeben. (z.B. name@domain.com)",
        ru: "Этот email выглядит неверным. Введите в правильном формате. (напр. name@domain.com)",
        ar: "هذا البريد الإلكتروني يبدو غير صحيح. (مثال: name@domain.com)",
        fr: "Cette adresse email semble invalide. (ex: nom@domain.com)",
        es: "Esta dirección de email parece inválida. (ej: nombre@domain.com)",
      };
      const invalidReply = _invalidMsgs[_lang] || _invalidMsgs.tr;
      await adapter.saveResponse(invalidReply, newContext);
      await adapter.sendResponse(invalidReply);
      return { success: true, response: invalidReply, newContext };
    }
  }

  // === 13. KOTA KONTROLÜ (COMPLETED'a geçildi, ama RPC öncesi) ===
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
          const lang = newContext.language || "tr";
          const agPhone = agency.phone_public ? ` 📞 ${agency.phone_public}` : "";
          const _quotaTour = tours.find((t: any) => t.id === newContext.reservationInfo.tourId);
          let _dateLines = "";
          if (_quotaTour?.dates && _quotaTour.dates.length > 1) {
            const _qRates = await getExchangeRatesOnce().catch(() => ({}));
            const _qDual = agency.show_multi_currency !== false;
            _dateLines = "\n\n" + _quotaTour.dates
              .filter((d: any) => d.id !== dateId)
              .map((d: any, i: number) => {
                const dt = formatDateForLanguage(d.departure_date, lang);
                const pr = d.price_adult
                  ? ` - ${formatPriceSync(d.price_adult, _quotaTour.currency || "TRY", lang, _qRates, _qDual)}`
                  : "";
                return `${i + 1}) ${dt}${pr}`;
              })
              .join("\n");
          }
          const _qMsgs: Record<string, string> = {
            tr: `Üzgünüm, seçtiğiniz tarih için kontenjan dolmuş. 😔 Başka bir tarih seçer misiniz?${_dateLines}`,
            en: `Sorry, the date you selected is fully booked. 😔 Could you choose another date?${_dateLines}`,
            de: `Das gewählte Datum ist ausgebucht. 😔 Bitte ein anderes Datum wählen.${_dateLines}`,
            ru: `Извините, выбранная дата полностью занята. 😔 Выберите другую дату.${_dateLines}`,
            ar: `آسف، التاريخ محجوز بالكامل. 😔 اختر تاريخاً آخر.${_dateLines}`,
            fr: `Désolé, la date choisie est complète. 😔 Choisissez une autre date.${_dateLines}`,
            es: `Lo siento, la fecha está completa. 😔 Elija otra fecha.${_dateLines}`,
          };
          newContext.reservationInfo.dateId = undefined;
          newContext.reservationInfo.selectedDate = undefined;
          newContext.stage = "COLLECTING_INFO";
          newContext.reservationConfirmed = false;
          newContext.collectionStep = "waiting_for_date";
          const qReply = _qMsgs[lang] || _qMsgs.tr;
          await adapter.saveResponse(qReply, newContext);
          await adapter.sendResponse(qReply);
          return { success: true, response: qReply, newContext };
        }
      }
    }
  }

  // === 14. REZERVASYON KAYDET (COMPLETED) ===
  const justCompleted =
    newContext.stage === "COMPLETED" && newContext.reservationConfirmed && context.stage !== "COMPLETED";

  console.log("[process-message] justCompleted check:", {
    justCompleted,
    newStage: newContext.stage,
    reservationConfirmed: newContext.reservationConfirmed,
    oldStage: context.stage,
    tourId: newContext.reservationInfo?.tourId,
    dateId: newContext.reservationInfo?.dateId,
    hasPax: !!newContext.reservationInfo?.paxAdult,
    hasName: !!newContext.reservationInfo?.fullName,
    hasPhone: !!newContext.reservationInfo?.phone,
  });

  if (justCompleted) {
    const { tourId, dateId, fullName, phone: regPhone, paxAdult } = newContext.reservationInfo;
    const reservationPhone = regPhone || adapter.identifier || "";

    const missingStep = !tourId ? "waiting_for_date"  // tourId yoksa tur seçimi eksik
      : !dateId ? "waiting_for_date"
      : !paxAdult ? "waiting_for_pax"
      : !fullName ? "waiting_for_name"
      : !reservationPhone ? "waiting_for_phone"
      : null;
    console.log("[process-message] reservation missingStep:", missingStep, "| tourId:", tourId, "| dateId:", dateId);

    if (missingStep) {
      newContext.stage = "COLLECTING_INFO";
      newContext.reservationConfirmed = false;
      newContext.collectionStep = missingStep as any;
      const missMsgs: Record<string, string> = {
        tr: "Rezervasyonu tamamlayabilmem için eksik bilgileri adım adım tamamlayalım.",
        en: "Let's complete the missing details to finalize your reservation.",
      };
      const missReply = missMsgs[newContext.language] || missMsgs.tr;
      await adapter.saveResponse(missReply, newContext);
      await adapter.sendResponse(missReply);
      return { success: true, response: missReply, newContext };
    }

    const totalPax = (paxAdult || 0) + (newContext.reservationInfo.paxChild || 0);
    console.log("[process-message] calling create_reservation RPC:", { tourId, dateId, fullName, totalPax, agencyId: agency.id });
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "create_reservation_with_quota_check",
      {
        p_tour_id: tourId,
        p_tour_date_id: dateId,
        p_full_name: fullName,
        p_phone: reservationPhone,
        p_pax: totalPax,
        p_agency_id: agency.id,
        p_source_channel: "WHATSAPP",
        p_email: newContext.reservationInfo.email || null,
      }
    );

    console.log("[process-message] create_reservation RPC result:", { success: rpcResult?.success, error: rpcResult?.error, rpcError: rpcError?.message });
    if (rpcError || !rpcResult?.success) {
      const errCode = rpcResult?.error || "UNKNOWN";
      const lang = newContext.language || "tr";
      const agPhone = agency.phone_public ? ` 📞 ${agency.phone_public}` : "";
      let errorReply = "";

      if (errCode === "QUOTA_EXCEEDED") {
        newContext.reservationInfo.dateId = undefined;
        newContext.reservationInfo.selectedDate = undefined;
        newContext.stage = "COLLECTING_INFO";
        newContext.reservationConfirmed = false;
        newContext.collectionStep = "waiting_for_date";
        const _msgs: Record<string, string> = {
          tr: "Üzgünüm, seçtiğiniz tarih için kontenjan dolmuş. 😔 Başka bir tarih seçer misiniz?",
          en: "Sorry, the date you selected is fully booked. 😔 Could you choose another date?",
          de: "Es tut mir leid, das gewählte Datum ist ausgebucht. 😔 Bitte ein anderes Datum wählen.",
          ru: "Извините, выбранная дата уже занята. 😔 Выберите другую дату.",
          ar: "آسف، التاريخ محجوز بالكامل. 😔 اختر تاريخاً آخر.",
          fr: "Désolé, la date est complète. 😔 Choisissez une autre date.",
          es: "Lo siento, la fecha está completa. 😔 Elija otra fecha.",
        };
        errorReply = _msgs[lang] || _msgs.tr;
      } else if (errCode === "DUPLICATE") {
        newContext.stage = "BROWSING";
        newContext.reservationConfirmed = false;
        newContext.reservationInfo = {};
        const _msgs: Record<string, string> = {
          tr: `Bu tur için zaten kayıtlı görünüyorsunuz. ℹ️ Detaylar için ${agency.name} ile iletişime geçin.${agPhone}`,
          en: `You appear to already be registered for this tour. ℹ️ Please contact ${agency.name}.${agPhone}`,
        };
        errorReply = _msgs[lang] || _msgs.tr;
      } else if (errCode === "TOUR_DATE_NOT_FOUND") {
        newContext.reservationInfo.dateId = undefined;
        newContext.reservationInfo.selectedDate = undefined;
        newContext.stage = "COLLECTING_INFO";
        newContext.reservationConfirmed = false;
        newContext.collectionStep = "waiting_for_date";
        const _msgs: Record<string, string> = {
          tr: "Seçtiğiniz tarih artık mevcut değil. 😔 Lütfen başka bir tarih seçin.",
          en: "The date you selected is no longer available. 😔 Please choose another date.",
        };
        errorReply = _msgs[lang] || _msgs.tr;
      } else if (errCode === "TOUR_NOT_FOUND") {
        newContext.stage = "BROWSING";
        newContext.currentTour = null;
        newContext.reservationInfo = {};
        newContext.reservationConfirmed = false;
        const _msgs: Record<string, string> = {
          tr: "Seçtiğiniz tur artık mevcut değil. 😔 Güncel turlarımıza bakabilirsiniz.",
          en: "The tour you selected is no longer available. 😔 Please check our current tours.",
        };
        errorReply = _msgs[lang] || _msgs.tr;
      } else {
        newContext.stage = context.stage;
        newContext.reservationConfirmed = false;
        const _msgs: Record<string, string> = {
          tr: `Rezervasyonunuz oluşturulurken bir sorun yaşandı. Lütfen ${agency.name} ile iletişime geçiniz.${agPhone}`,
          en: `There was an issue creating your reservation. Please contact ${agency.name}.${agPhone}`,
        };
        errorReply = _msgs[lang] || _msgs.tr;
      }
      await adapter.saveResponse(errorReply, newContext);
      await adapter.sendResponse(errorReply);
      return { success: false, error: errCode, response: errorReply, newContext };
    }

    // Rezervasyon başarılı → deterministik tamamlama mesajı
    const selectedTourFull = tours.find((t: any) => t.id === tourId);
    const selectedDateFull = selectedTourFull?.dates?.find((d: any) => d.id === dateId);
    const formattedDate = selectedDateFull?.departure_date
      ? formatDateForLanguage(selectedDateFull.departure_date, newContext.language)
      : newContext.reservationInfo.selectedDate || "-";

    const adultCount = newContext.reservationInfo.paxAdult || 0;
    const childCount = newContext.reservationInfo.paxChild || 0;
    const paxTextMap: Record<string, string> = {
      tr: `${adultCount} yetişkin${childCount ? `, ${childCount} çocuk` : ""}`,
      en: `${adultCount} adult${childCount ? `, ${childCount} child` : ""}`,
      de: `${adultCount} Erwachsene${childCount ? `, ${childCount} Kind${childCount > 1 ? "er" : ""}` : ""}`,
      ru: `${adultCount} взросл${adultCount === 1 ? "ый" : "ых"}${childCount ? `, ${childCount} ребёнок` : ""}`,
      ar: `${adultCount} بالغ${childCount ? `، ${childCount} طفل` : ""}`,
      fr: `${adultCount} adulte${adultCount > 1 ? "s" : ""}${childCount ? `, ${childCount} enfant${childCount > 1 ? "s" : ""}` : ""}`,
      es: `${adultCount} adulto${adultCount > 1 ? "s" : ""}${childCount ? `, ${childCount} niño${childCount > 1 ? "s" : ""}` : ""}`,
    };
    const paxText = paxTextMap[newContext.language] || paxTextMap.en;
    const tourTitle = selectedTourFull?.title || newContext.reservationInfo.tourTitle || "-";
    const emailLine = newContext.reservationInfo.email ? `\n• *Email:* ${newContext.reservationInfo.email}` : "";
    const completionMsgs: Record<string, string> = {
      tr: `Bilgilerinizi aldım ${fullName || ""}, çok teşekkür ederim! 😊\n*${tourTitle}* için ön kaydınızı başarıyla gerçekleştirdim.\n\n*Kayıt Özetiniz:*\n• *Tur:* ${tourTitle}\n• *Tarih:* ${formattedDate}\n• *Kişi:* ${paxText}\n• *İsim:* ${fullName || "-"}\n• *Telefon:* ${reservationPhone || "-"}${emailLine}\n\nEkip arkadaşlarımız size en kısa sürede ulaşacaktır.`,
      en: `Thank you, ${fullName || ""}! 😊\nYour pre-registration for *${tourTitle}* is complete.\n\n*Summary:*\n• *Tour:* ${tourTitle}\n• *Date:* ${formattedDate}\n• *People:* ${paxText}\n• *Name:* ${fullName || "-"}\n• *Phone:* ${reservationPhone || "-"}${emailLine}\n\nOur team will contact you shortly.`,
      de: `Vielen Dank, ${fullName || ""}! 😊\nIhre Voranmeldung für *${tourTitle}* wurde abgeschlossen.\n\n*Übersicht:*\n• *Tour:* ${tourTitle}\n• *Datum:* ${formattedDate}\n• *Personen:* ${paxText}\n• *Name:* ${fullName || "-"}\n• *Telefon:* ${reservationPhone || "-"}${emailLine}\n\nUnser Team meldet sich in Kürze.`,
      ru: `Спасибо, ${fullName || ""}! 😊\nВаша предварительная запись на *${tourTitle}* оформлена.\n\n*Сводка:*\n• *Тур:* ${tourTitle}\n• *Дата:* ${formattedDate}\n• *Количество:* ${paxText}\n• *Имя:* ${fullName || "-"}\n• *Телефон:* ${reservationPhone || "-"}${emailLine}\n\nНаши специалисты свяжутся с вами.`,
      ar: `شكراً، ${fullName || ""}! 😊\nتم تسجيل طلبك لـ *${tourTitle}*.\n\n*ملخص:*\n• *الجولة:* ${tourTitle}\n• *التاريخ:* ${formattedDate}\n• *الأشخاص:* ${paxText}\n• *الاسم:* ${fullName || "-"}\n• *الهاتف:* ${reservationPhone || "-"}${emailLine}\n\nسيتواصل معك فريقنا.`,
      fr: `Merci, ${fullName || ""}! 😊\nVotre pré-inscription pour *${tourTitle}* est réalisée.\n\n*Récapitulatif:*\n• *Circuit:* ${tourTitle}\n• *Date:* ${formattedDate}\n• *Personnes:* ${paxText}\n• *Nom:* ${fullName || "-"}\n• *Téléphone:* ${reservationPhone || "-"}${emailLine}\n\nNotre équipe vous contactera prochainement.`,
      es: `¡Gracias, ${fullName || ""}! 😊\nSu registro para *${tourTitle}* está completado.\n\n*Resumen:*\n• *Tour:* ${tourTitle}\n• *Fecha:* ${formattedDate}\n• *Personas:* ${paxText}\n• *Nombre:* ${fullName || "-"}\n• *Teléfono:* ${reservationPhone || "-"}${emailLine}\n\nNuestro equipo se pondrá en contacto.`,
    };

    let completionReply = completionMsgs[newContext.language] || completionMsgs.tr;

    // Ödeme bilgisi
    if (paymentInstructions && selectedDateFull) {
      const depPct = (typeof paymentInstructions === "object" && paymentInstructions?.deposit_percentage) || 30;
      const totalPrice = adultCount * (selectedDateFull.price_adult || 0) +
        childCount * (selectedDateFull.price_child || selectedDateFull.price_adult || 0);
      const depositAmt = Math.ceil((totalPrice * depPct) / 100);
      if (totalPrice > 0) {
        const payMsg = await generatePaymentMessage(
          paymentInstructions, newContext.language, totalPrice, depositAmt,
          selectedTourFull?.currency || "TRY", { languageCurrencies, primaryCurrency }
        );
        if (payMsg) {
          completionReply += payMsg;
          newContext.paymentInfoSent = true;
        }
      }
    }

    // Kanal-spesifik template eki (WhatsApp message_templates)
    if (adapter.getCompletionTemplateAddendum) {
      const tmpl = await adapter.getCompletionTemplateAddendum({
        tourId: tourId || "",
        dateId: dateId || "",
        fullName: fullName || "",
        pax: adultCount + childCount,
        language: newContext.language,
        agencyId: agency.id,
      }).catch(() => null);
      if (tmpl) completionReply += "\n\n" + tmpl;
    }

    await adapter.saveResponse(completionReply, newContext);
    await adapter.sendResponse(completionReply);
    return { success: true, response: completionReply, newContext };
  }

  // === 15. SYSTEM PROMPT ===
  const currentTourFull = newContext.currentTour ? findTourById(newContext.currentTour.id, tours) : null;
  const promptContext = {
    stage: newContext.stage,
    collectionStep: newContext.collectionStep,
    currentTour: currentTourFull || newContext.currentTour,
    reservationInfo: newContext.reservationInfo,
    availableTours: tours,
    language: newContext.language,
    tone: newContext.tone,
    agencyName: agency.name,
    agencyCity: agency.city,
    agencyAddress: agency.address,
    agencyPhone: agency.phone_public,
    agencyWebsite: agency.website_url,
    agencyWorkingHours: agency.working_hours,
    agencyMapsUrl: agency.maps_url,
    agencyCancellationPolicy: agency.cancellation_policy,
    paymentInfo: typeof paymentInstructions === "string" ? paymentInstructions
      : (paymentInstructions as any)?.text || undefined,
    multipleTourMatches: multipleTourMatches.length > 1 ? multipleTourMatches : undefined,
  };

  let tourSwitchWarning = "";
  if (newContext.stage === "COLLECTING_INFO" && selectedTour && newContext.currentTour &&
      selectedTour.id !== newContext.currentTour.id) {
    tourSwitchWarning = newContext.language === "tr"
      ? `\n\n🚨 KRİTİK: Kullanıcı "${newContext.currentTour.title}" için rezervasyon yapıyor ama "${selectedTour.title}" hakkında bir şey söyledi. Tur değişikliği için onay iste!`
      : `\n\n🚨 CRITICAL: User is booking "${newContext.currentTour.title}" but mentioned "${selectedTour.title}". Ask for confirmation!`;
  }

  let completedStagePrompt = "";
  if (context.stage === "COMPLETED" && newContext.stage === "COMPLETED") {
    completedStagePrompt = newContext.language === "tr"
      ? `\n\n✅ TAMAMLANAN REZERVASYON SONRASI: Sadece soruyu yanıtla. "Rezervasyonunuz tamamlandı" deme.`
      : `\n\n✅ POST-RESERVATION: Just answer the question. DO NOT say "your reservation is confirmed".`;
  }

  let returningUserPrompt = "";
  if (returningUserName) {
    returningUserPrompt = newContext.language === "tr"
      ? `\n\n👤 DÖNEN MÜŞTERİ: Adı "${returningUserName}". Sadece selamlarken adıyla hitap et.`
      : `\n\n👤 RETURNING CUSTOMER: Name is "${returningUserName}". Only greet by name.`;
  }

  let antiContradictionPrompt = "";
  if (tours.length > 0 && newContext.stage !== "GREETING") {
    const _titles = tours.slice(0, 5).map((t: any) => t.title).join(", ");
    antiContradictionPrompt = newContext.language === "tr"
      ? `\n\n🔄 TUR TUTARLILIK: Sistemde aktif turlar var (${_titles}). "Tur yok" ya da "tarih bulunamadı" deme.`
      : `\n\n🔄 TOUR CONSISTENCY: Active tours exist (${_titles}). NEVER say "no tours" or "no dates found".`;
  }

  const systemPrompt = buildSystemPrompt(promptContext as any) +
    tourSwitchWarning + completedStagePrompt + returningUserPrompt + antiContradictionPrompt;

  // === 16. AI ÇAĞRISI ===
  let reply: string;
  try {
    reply = await callAI({ systemPrompt, history: historyAsc, userMessage: message });
    console.log("[process-message] AI reply:", reply.substring(0, 80));
  } catch (_aiErr) {
    console.error("[process-message] AI call failed:", _aiErr);
    reply = buildAIFallbackResponse(newContext, agency.phone_public || undefined);
    await adapter.saveResponse(reply, newContext);
    await adapter.sendResponse(reply);
    return { success: true, response: reply, newContext };
  }

  // === 17. YANIT DOĞRULAMA ===
  const validation = validateAIResponse(reply, newContext.language, newContext.stage);
  if (validation.wasModified) {
    console.warn("[process-message] Response validator modified AI output");
    reply = validation.text;
  }

  // === 18. ÖDEME MESAJI (AI cevabından sonra, daha önce gönderilmediyse) ===
  if (newContext.stage === "COMPLETED" && !newContext.paymentInfoSent && paymentInstructions) {
    const priceAdult = newContext.currentTour?.dates?.find((d: any) => d.id === newContext.reservationInfo.dateId)?.price_adult || 0;
    const paxAdult = newContext.reservationInfo.paxAdult || 1;
    const totalPrice = priceAdult * paxAdult;
    const depPct = (typeof paymentInstructions === "object" && (paymentInstructions as any)?.deposit_percentage) || 30;
    const depositAmt = Math.round((totalPrice * depPct) / 100);
    const tourCurr = (currentTourFull as any)?.currency || "TRY";
    if (totalPrice > 0) {
      const payMsg = await generatePaymentMessage(
        paymentInstructions, newContext.language, totalPrice, depositAmt,
        tourCurr, { languageCurrencies, primaryCurrency }
      );
      if (payMsg) {
        reply = reply + payMsg;
        newContext.paymentInfoSent = true;
      }
    }
  }

  // === 19. KAYDET VE GÖNDER ===
  await adapter.saveResponse(reply, newContext);
  await adapter.sendResponse(reply);
  return { success: true, response: reply, newContext };
}
