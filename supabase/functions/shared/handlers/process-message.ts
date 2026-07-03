// Unified message processing core — hem demo-chat hem whatsapp-webhook tarafından kullanılır.
// Tüm kanal-bağımsız rezervasyon akış mantığı burada toplanır.
// I/O (DB, WhatsApp API, HTTP response) ChannelAdapter üzerinden soyutlanmıştır.

import type { ConversationContext, ProcessingInput } from "../fsm/types.ts";
import {
  createInitialContext,
  processTransition,
  getNextExpectedInput,
  getCancellationMessage,
  detectConfirmation,
  detectNegativeResponse,
} from "../fsm/state-machine.ts";
import { sanitizeInput, isInputTooLong, detectInjection } from "../fsm/validator.ts";
import { analyzeUserMessage, mapNLUIntentToFSMIntent } from "../fsm/nlu.ts";
import {
  detectLanguageChangeIntent,
  getDefaultToneForLanguage,
  formatDateForLanguage,
} from "../fsm/localization.ts";
import { detectLanguage } from "../fsm/language.ts";
import { buildSystemPrompt, buildTransitionPrompt, getMultipleTourWarning, getStagePrompt } from "../fsm/prompt-builder.ts";
import { validateAIResponse, validateInjectionResponse, validateFieldReask } from "../fsm/response-validator.ts";
import { extractEmail, isNegativePaxMessage } from "../fsm/simple-extractor.ts";
import { findTourById } from "../fsm/tour-matcher.ts";
import { findMatchingTours, TOUR_CHANGE_PHRASE_RE } from "../services/tour-matching.ts";
import { isNluFullNameTourLeak, isNluFullNameNegationLeak } from "../services/nlu-validation.ts";
import { shouldTriggerNameAskPersist, shouldFireUnknownTour, shouldTriggerAutoDateAck, shouldTriggerManualDateAck, shouldTriggerSummaryReask } from "../services/bypass-gates.ts";
import { hasQuotaForPax, getQuotaRemaining, hasAnyAvailableDate } from "../services/quota-check.ts";
import { extractAllInfo, getLocalizedTourTitle } from "../services/info-extractor.ts";
import { buildNLUContextBase } from "../services/context-manager.ts";
import { buildAIFallbackResponse } from "../services/fallback-response.ts";
import { DATE_QUERY_RE, DATE_INTENTS } from "../constants/date-detection.ts";
import { CHANGE_KEYWORDS_RE } from "../constants/change-detection.ts";
import { QUESTION_SIGNAL_RE } from "../constants/question-detection.ts";
import { produceTourChangeContext, shouldApplyEarlyTourChange, buildTourChangePrefix } from "../services/tour-change.ts";
import { callAI } from "../services/ai.ts";
import { generatePaymentMessage, safeDepositPercentage } from "../services/payment-message.ts";
import { getExchangeRatesOnce } from "../utils/exchange-rates.ts";
import { formatPriceSync } from "../utils/currency-display.ts";
import { isValidPax, isValidPhone, MAX_PAX_PER_RESERVATION } from "../utils/validation.ts";
import { maskPhone } from "../utils/log-mask.ts";
// K4: TEK yuvarlama kuralı — tüm kapora/toplam hesapları buradan.
import { calculateTotal, calculateDeposit } from "../utils/finance.ts";
import type { ChannelAdapter, ProcessMessageInput, ProcessMessageResult } from "./types.ts";

export async function processChatMessage(input: ProcessMessageInput): Promise<ProcessMessageResult> {
  const { message: rawMessage, adapter, agency, supabase, tours, paymentInstructions, languageCurrencies, primaryCurrency, returningUserName, seedLanguage } = input;

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

  // K4: Prompt injection şüphesi tespiti — mesaj engellenmez, sadece flag set edilir
  const _isSuspectedInjection = detectInjection(rawMessage);
  if (_isSuspectedInjection) {
    console.warn("[process-message] K4: Suspected prompt injection detected:", rawMessage.slice(0, 100));
  }

  // _save: saveTransaction varsa atomik (user+assistant+ctx), yoksa sadece assistant+ctx
  const _save = (reply: string, ctx: ConversationContext): Promise<void> =>
    adapter.saveTransaction
      ? adapter.saveTransaction(message, reply, ctx)
      : adapter.saveResponse(reply, ctx);

  // === 2. CONTEXT YÜKLE ===
  // KATMAN 1: loadContext artık { context, stale? } döner. Stale varsa visible reset + early return.
  const _loadResult = await adapter.loadContext();
  const loadedContext = _loadResult.context;

  // === 3. DİL TESPİTİ ===
  // Öncelik: explicit "english please" intent > karakter tabanlı script > frontend seedLanguage (demo dropdown).
  // seedLanguage WhatsApp'ta yok; demo-chat'te kullanıcının i18n.language seçimi.
  // Bu hiyerarşi sayesinde ASCII metinli ilk mesajda da doğru dilde cevap üretilir.
  const languageChangeIntent = detectLanguageChangeIntent(message);
  const runtimeDetectedLang = detectLanguage(message);

  // === SORUN 4: enabled_languages yetkilendirme yardımcıları ===
  // Acente enabled_languages boşsa/tanımsızsa kısıtlama yok (null = tüm diller serbest)
  const _enabledLangs: string[] | null = (Array.isArray(agency.enabled_languages) && (agency.enabled_languages as string[]).length > 0)
    ? (agency.enabled_languages as string[])
    : null;
  const _isLangEnabled = (lang: string): boolean =>
    _enabledLangs === null || _enabledLangs.includes(lang);
  // Tespit edilen dil kapalıysa → acentenin ilk açık diline veya "tr"'ye düş
  const _bestLang = (detected: string): string =>
    _isLangEnabled(detected) ? detected : (_enabledLangs?.[0] ?? "tr");

  // === KATMAN 1: STALE STATE GÖRÜNÜR RESET ===
  // Eski davranış: loadContext null dönerse sessizce fresh context + AI çalışırdı.
  // AI history'i okuyup eski yarım rezervasyon bilgilerini sızdırırdı ("müsait değil" saçmalığı).
  // Yeni davranış: stale sentinel varsa kullanıcıya AÇIK mesaj + AI'ya hiç gitme (history sızıntısı kesilir).
  if (_loadResult.stale) {
    const _stale = _loadResult.stale;
    // FIX: Frontend explicit dil (demo dropdown) > açık dil değiştirme niyeti > script-based
    // tespit > stale'in son dili > "tr". Önceki sıralama lastLanguage'i ilk koyuyordu, bu da
    // kullanıcı bayatlamadan beri dili değiştirmişse stale reset'i eski dilde yapıyordu.
    const _seedHere = seedLanguage && (Array.isArray(agency.enabled_languages) && agency.enabled_languages.length > 0
      ? agency.enabled_languages.includes(seedLanguage)
      : true) ? seedLanguage : undefined;
    const _lang = _bestLang(languageChangeIntent || runtimeDetectedLang || _seedHere || _stale.lastLanguage || "tr");
    const _agPhone = agency.phone_public ? ` 📞 ${agency.phone_public}` : "";

    // Yarım rezervasyon vardıysa: "iptal edildi, baştan başlayalım" — kullanıcı tarihi/pax'ı yeniden seçmeli
    // Yarım rezervasyon yoksa: yumuşak "tekrar hoş geldiniz" — kullanıcı muhtemelen yeni iş için yazıyor
    const _hadReservation = _stale.hadReservationInProgress;
    const _resetMsgs: Record<string, string> = _hadReservation
      ? {
          tr: `Önceki yarım rezervasyonunuz iptal edildi (${_stale.ageMinutes} dakikadır yanıt alınmadı). Yeniden başlayalım — hangi tur ilginizi çeker?${_agPhone}`,
          en: `Your previous incomplete reservation has been cancelled (no response for ${_stale.ageMinutes} minutes). Let's start over — which tour interests you?${_agPhone}`,
          de: `Ihre vorherige unvollständige Reservierung wurde storniert (keine Antwort seit ${_stale.ageMinutes} Minuten). Beginnen wir neu — welche Tour interessiert Sie?${_agPhone}`,
          ru: `Ваше предыдущее незавершённое бронирование отменено (нет ответа ${_stale.ageMinutes} мин.). Начнём заново — какой тур вас интересует?${_agPhone}`,
          ar: `تم إلغاء حجزك السابق غير المكتمل (لا استجابة منذ ${_stale.ageMinutes} دقيقة). لنبدأ من جديد — ما الجولة التي تهمك؟${_agPhone}`,
          fr: `Votre réservation précédente incomplète a été annulée (pas de réponse depuis ${_stale.ageMinutes} minutes). Recommençons — quel circuit vous intéresse ?${_agPhone}`,
          es: `Su reserva incompleta anterior ha sido cancelada (sin respuesta durante ${_stale.ageMinutes} minutos). Empecemos de nuevo — ¿qué tour le interesa?${_agPhone}`,
        }
      : {
          tr: `Tekrar hoş geldiniz! 👋 Size nasıl yardımcı olabilirim?${_agPhone}`,
          en: `Welcome back! 👋 How can I help you?${_agPhone}`,
          de: `Willkommen zurück! 👋 Wie kann ich Ihnen helfen?${_agPhone}`,
          ru: `С возвращением! 👋 Чем могу помочь?${_agPhone}`,
          ar: `أهلاً بعودتك! 👋 كيف يمكنني مساعدتك؟${_agPhone}`,
          fr: `Bon retour ! 👋 Comment puis-je vous aider ?${_agPhone}`,
          es: `¡Bienvenido de nuevo! 👋 ¿Cómo puedo ayudarle?${_agPhone}`,
        };
    const _resetReply = _resetMsgs[_lang] || _resetMsgs.tr;
    // Fresh context — yeni stage GREETING/BROWSING'e dönmüş gibi
    const _freshCtx = createInitialContext(_lang, getDefaultToneForLanguage(_lang) as any);
    _freshCtx.collectEmail = agency.collect_email === true;
    console.log(`[process-message] L1 stale reset: lastStage=${_stale.lastStage} age=${_stale.ageMinutes}min hadReservation=${_hadReservation}`);
    await _save(_resetReply, _freshCtx);
    await adapter.sendResponse(_resetReply);
    return { success: true, response: _resetReply, newContext: _freshCtx };
  }

  // === 4. CONTEXT BAŞLAT / GÜNCELLE ===
  // FIX: seedLanguage (frontend explicit) — detection'ı yenmek için. Demo dropdown'unda
  // kullanıcı "EN" seçtiyse ve mesaj saf ASCII İngilizce ise detection null döner; eskiden
  // ilk mesajda TR'ye düşüyordu, ikinci mesajda NLU dili düzeltiyordu (one-message delay).
  const _effectiveSeed = seedLanguage && _isLangEnabled(seedLanguage) ? seedLanguage : undefined;

  let context: ConversationContext;
  if (loadedContext) {
    context = loadedContext;
    if (languageChangeIntent && languageChangeIntent !== context.language) {
      // Müşteri açıkça dil değiştirdi — sadece acentenin açtığı dillere izin ver
      if (_isLangEnabled(languageChangeIntent)) {
        context.language = languageChangeIntent;
        context.tone = getDefaultToneForLanguage(languageChangeIntent) as any;
      }
    } else if (runtimeDetectedLang && runtimeDetectedLang !== context.language) {
      const _hasNonAscii = /[^\x00-\x7F]/.test(message);
      const _isShortMsg = message.length < 200;
      if (_hasNonAscii || _isShortMsg) {
        if (_isLangEnabled(runtimeDetectedLang)) context.language = runtimeDetectedLang;
        // Aksi hâlde mevcut context.language'ı koru (acente bu dili açmamış)
      }
    } else if (_effectiveSeed && _effectiveSeed !== context.language && !runtimeDetectedLang) {
      // Detection sinyali yok ama frontend explicit dil göndermiş — kullanıcının seçimi otorite.
      context.language = _effectiveSeed;
      context.tone = getDefaultToneForLanguage(_effectiveSeed) as any;
    }
  } else {
    // Yeni context: explicit change > script-based > frontend seed > tr.
    const _detectedLang = languageChangeIntent || runtimeDetectedLang || _effectiveSeed || "tr";
    const lang = _bestLang(_detectedLang);
    context = createInitialContext(lang, getDefaultToneForLanguage(lang) as any);
  }

  // Agency email toplama ayarını her mesajda sync et (admin toggle anlık etki etsin)
  context.collectEmail = agency.collect_email === true;

  // === KATMAN 3: ERKEN REVALIDATION ===
  // Stale değil ama reservationInfo.dateId set → seçilen tarih hâlâ geçerli mi?
  // Mevcut Check B (line ~570) sadece RPC öncesi çalışıyordu — kullanıcı yarım yolda
  // "müsait" gibi davranıp son adımda "müsait değil" şokuyla karşılaşıyordu.
  // Bunu BAŞA çekerek tarih dolduysa/silindiyse erken haber ver + alternatif tarihleri öner.
  //
  // FIX (A1): COMPLETED state'de ATLA. Bu blok YARIM rezervasyon içindir
  // (COLLECTING_INFO/CONFIRMING/TOUR_SELECTED). COMPLETED finalize edilmiş bir
  // rezervasyondur; tarihinin geçmiş olması çözülmesi gereken bir sorun değil,
  // "geçmiş bir gezi"dir. Eskiden blok COMPLETED'de tetikleniyor, dateId'yi temizleyip
  // tourId'yi (Antalya) koruyor, stage'i COLLECTING_INFO+waiting_for_date yapıyordu →
  // kullanıcı eski tura kilitleniyor, çıkamıyordu. "Önceki tura kilitlenme" bug'ının
  // PRIMARY kök sebebi buydu.
  if (context.stage !== "COMPLETED" && context.reservationInfo?.dateId && context.reservationInfo?.tourId) {
    const _resTour = tours.find((t: any) => t.id === context.reservationInfo!.tourId);
    const _resDate = _resTour?.dates?.find((d: any) => d.id === context.reservationInfo!.dateId);
    const _today = new Date().toISOString().slice(0, 10);
    const _isPast = _resDate && _resDate.departure_date < _today;
    const _quotaFull = _resDate && (_resDate.remaining_quota ?? _resDate.quota ?? 1) <= 0;
    const _stillValid = _resTour && _resDate && !_isPast && !_quotaFull;

    if (!_stillValid) {
      console.log("[process-message] L3 early revalidation FAIL:", {
        hasTour: !!_resTour, hasDate: !!_resDate, isPast: _isPast, quotaFull: _quotaFull,
        tourId: context.reservationInfo.tourId, dateId: context.reservationInfo.dateId,
      });

      // Alternatif tarihleri topla (sadece geçmemiş + kontenjanı olan)
      const _alts = (_resTour?.dates || [])
        .filter((d: any) => d.id !== context.reservationInfo!.dateId
          && d.departure_date >= _today
          && (d.remaining_quota ?? d.quota ?? 1) > 0)
        .slice(0, 5);
      const _altList = _alts.length > 0
        ? "\n\n" + _alts.map((d: any, i: number) => {
            const _dt = d.departure_date;
            const _pr = d.price_adult ? ` – ${d.price_adult.toLocaleString("tr-TR")} ${(_resTour as any).currency || "TRY"}` : "";
            return `${i + 1}) ${_dt}${_pr}`;
          }).join("\n")
        : "";

      // reservationInfo'daki tarihi temizle — kullanıcı yeni tarih seçecek
      // Tur kalsın (kullanıcı aynı tura ilgileniyor olabilir)
      context.reservationInfo = {
        ...context.reservationInfo,
        dateId: undefined,
        selectedDate: undefined,
      };
      context.stage = "COLLECTING_INFO";
      context.collectionStep = "waiting_for_date";
      context.reservationConfirmed = false;

      const _revLang = context.language || "tr";
      const _revalMsgs: Record<string, string> = {
        tr: `Seçtiğiniz tarih artık mevcut değil veya kontenjan dolmuş. ${_resTour ? `*${_resTour.title}* için` : ""} müsait tarihler:${_altList || "\n\nŞu anda başka müsait tarih bulunmuyor. Lütfen başka bir tur seçer misiniz?"}`,
        en: `The date you selected is no longer available or fully booked. Available dates ${_resTour ? `for *${_resTour.title}*` : ""}:${_altList || "\n\nNo other dates available right now. Could you pick another tour?"}`,
        de: `Das gewählte Datum ist nicht mehr verfügbar oder ausgebucht. Verfügbare Termine ${_resTour ? `für *${_resTour.title}*` : ""}:${_altList || "\n\nAktuell keine weiteren Termine verfügbar. Bitte wählen Sie eine andere Tour."}`,
        ru: `Выбранная дата больше недоступна или полностью забронирована. Доступные даты ${_resTour ? `для *${_resTour.title}*` : ""}:${_altList || "\n\nДругих доступных дат нет. Выберите другой тур, пожалуйста."}`,
        ar: `التاريخ المحدد لم يعد متاحاً أو محجوزاً بالكامل. التواريخ المتاحة ${_resTour ? `لـ *${_resTour.title}*` : ""}:${_altList || "\n\nلا توجد تواريخ متاحة أخرى حالياً. يرجى اختيار جولة أخرى."}`,
        fr: `La date sélectionnée n'est plus disponible ou complète. Dates disponibles ${_resTour ? `pour *${_resTour.title}*` : ""}:${_altList || "\n\nAucune autre date disponible. Veuillez choisir un autre circuit."}`,
        es: `La fecha seleccionada ya no está disponible o está completa. Fechas disponibles ${_resTour ? `para *${_resTour.title}*` : ""}:${_altList || "\n\nNo hay otras fechas disponibles. Por favor elija otro tour."}`,
      };
      const _revalReply = _revalMsgs[_revLang] || _revalMsgs.tr;
      await _save(_revalReply, context);
      await adapter.sendResponse(_revalReply);
      return { success: true, response: _revalReply, newContext: context };
    }
  }

  // FIX 4: önceki stage'i AI prompt'una ver (demo-chat ile davranış paritesi)
  const previousContext = { ...context };

  // === 5. HISTORY YÜKLE (NLU + AI için) ===
  // B3 + token optimizasyonu: 10 mesajla sınırla. Daha önce 20'ydi; FSM zaten seçili tur/tarih/pax/
  // isim/telefon gibi YAPISAL state'i `context` üzerinden taşıyor, history sadece üslup ve son
  // 1-2 turluk bağlam için. Tipik rezervasyon 10-12 mesaj sürüyor; 10 mesaj son birkaç turluk
  // bağlamı her zaman kapsar. Çağrı başına ~300 token tasarruf (history hem Sonnet hem NLU input'una giriyor).
  // 2026-06-24 FIX A1: history cutoff (S1/S2/S3 conversation history kirlenmesi).
  // context.historyCutoffAt CONFIRMING→COMPLETED action'da set edilir → bu zamandan
  // SONRAKİ mesajlar döner. Eski rezervasyon history'si NLU/LLM'e GİTMEZ.
  // Geriye dönük güvenlik: historyCutoffAt undefined ise adapter filter atlar.
  const historyAsc = await adapter.loadHistory(10, context.historyCutoffAt);

  // === 6. NLU CONTEXT + ANALIZ ===
  const historySummary = historyAsc.map((m) => `${m.role}: ${m.content}`).join("\n");
  const nluContextStr = (historySummary ? historySummary + "\n\n" : "") + buildNLUContextBase(context);

  const nluResult = await analyzeUserMessage(message, nluContextStr, context.stage, context.currentTour, tours);
  console.log("[process-message] Intent:", nluResult.intent, "| Stage:", context.stage, "| Lang:", context.language);

  // === 6b. A GATE — NLU fullName tour-leak savunma (2026-06-20 Sorun 2) ====
  // Canlı bug (execution e9fc320d): kullanıcı waiting_for_name adımında
  // "efes turuna geçelim" yazdı → NLU CRITICAL RULE'u ihlal etti, fullName=
  // "Efes Turuna Geçelim" çıkardı → state'e isim olarak yazıldı → bot
  // "Teşekkürler Efes!" diye seslendi, isim adımını atladı.
  //
  // Bu gate LLM'den BAĞIMSIZ. NLU sistem prompt'u (CRITICAL RULE) birinci
  // savunma; bu gate ikinci ve deterministik savunma. DAR mantık: sadece
  // fullName kelimelerinde TOUR_KEYWORD_STOPWORDS (turu/turuna/tour/ausflug
  // /...) varsa REDDET. Verb listesine bakmaz, gerçek soyadları (Geçer/Alıcı)
  // etkilemez. Karışık mesaj korunur: "ben Murat Yılmaz, Antalya turuna
  // geçelim" → NLU doğru parse ederse fullName="Murat Yılmaz" → leak=false.
  if (nluResult.updates?.fullName) {
    const _leak = nluResult.updates.fullName;
    if (isNluFullNameTourLeak(_leak)) {
      console.log(
        `[process-message] BLOCKED NLU fullName tour-leak: "${_leak}"`,
      );
      delete nluResult.updates.fullName;
      if (nluResult.entities) {
        (nluResult.entities as any).full_name = "";
      }
    } else if (isNluFullNameNegationLeak(_leak)) {
      // 2026-06-21 Sorun F (K3 katman): her durumda negation sigortası.
      // K2 (nlu.ts:432) 4+ word + negation reddi yaptı; K3 burada 2-word
      // edge'leri ("Ahmet Değil") + sanity. Murat onayı (2026-06-21):
      // "Değil" diye soyad yok → 2-word edge kasıtlı reddedilir.
      console.log(
        `[process-message] BLOCKED NLU fullName negation-leak: "${_leak}"`,
      );
      delete nluResult.updates.fullName;
      if (nluResult.entities) {
        (nluResult.entities as any).full_name = "";
      }
    }
  }

  // NLU dil tespitini uygula (ASCII guard + enabled_languages kontrolü)
  // FIX (ASCII-only ilk mesaj): WhatsApp'ta seedLanguage yok; yabancı turist ilk
  // mesajı saf ASCII (örn. "I want to book a tour") yazınca karakter-tabanlı
  // detection null dönüyor ve "tr" fallback'a düşülüyordu. NLU dili context.language
  // ile guard'lı eşitlemede, uzun ASCII mesaj (≥200 char) _hasNonAscii=false +
  // _isShortMsg=false yüzünden override edilemiyordu — bu da "1 mesaj gecikme"
  // davranışı yaratıyordu (ilk mesaj TR, ikinci mesajda dil düzeliyor).
  // Çözüm: ilk mesajda (messageCount===0, yeni context) NLU dilini her zaman kabul et
  // — bu noktada başka dil sinyali zaten yok, NLU dili otorite. Whitelist korunur.
  if (nluResult.language) {
    const SUPPORTED = ["tr", "en", "de", "ru", "ar", "fr", "es"];
    if (SUPPORTED.includes(nluResult.language) && nluResult.language !== context.language) {
      const _hasNonAscii = /[^\x00-\x7F]/.test(message);
      const _isShortMsg = message.length < 200;
      // YENİ context = messageCount henüz processTransition'a girmedi = 0.
      // Loaded context'te en az 1 mesaj olur → guard eski davranışını korur (uzun
      // ASCII Türkçe metinde araya bir EN kelime gelirse dil değişmesin).
      const _isFirstMessage = context.messageCount === 0;
      if (_hasNonAscii || _isShortMsg || _isFirstMessage) {
        if (_isLangEnabled(nluResult.language)) {
          context.language = nluResult.language;
          // İlk mesajda tone'u da NLU diline göre re-set et — başka dilden geliyorsa
          // varsayılan tone uyumlu olsun (örn. EN için kurumsal tone TR'den farklı olabilir).
          if (_isFirstMessage) {
            context.tone = getDefaultToneForLanguage(nluResult.language) as any;
          }
        } else {
          // Acente bu dili açmamış — mevcut dili koru
          console.log(`[process-message] S4: Detected lang ${nluResult.language} not in enabled_languages (${_enabledLangs}), keeping ${context.language}`);
        }
      }
    }
  }

  let fsmIntent = mapNLUIntentToFSMIntent(nluResult.intent);

  // Şikayet kaydı (fire-and-forget)
  if (nluResult.intent === "complaint_feedback") {
    supabase.from("complaints").insert({ agency_id: agency.id, phone: adapter.identifier, message, type: "complaint", status: "new" }).then(() => {});
  }

  // 2026-06-23 Sorun D: orijinal tur ID'sini sakla — sonraki bypass'ların hangi
  // turdan değiştiğini bilmesi için. Erken-müdahale context.currentTour'u mutate
  // ediyor (line ~373), state-machine transition newContext.currentTour'u
  // değiştiriyor. Her iki yolda da bu orijinal ID karşılaştırma kaynağı.
  const _originalTourId = context.currentTour?.id;

  // ============================================================================
  // === NİTELİK ÖN-TESPİT KATMANI (X8 + B1 + B-TEMA) — 2026-06-26 R4 MİMARİ ====
  // ============================================================================
  // Konum: fsmIntent map SONRASI, findMatchingTours/extractAllInfo/FSM ÖNCESİ.
  //
  // Mimari kanıt (Bug 1/2/3 canlı kanıt):
  //   Bug 3 — "2 kişi için 3000 bütçem var" → eski konumda B1 (L1003) ÇOK GEÇTİ:
  //     L529 extractAllInfo pax=2 çıkarıyor
  //     L870 FSM geçişi stage=COLLECTING_INFO'ya alıyor
  //     B1 stage guard FALSE → atlanır → "ad soyad?" mesajı
  //   KÖK ÇÖZÜM: B1'i tüm state-değiştirici katmanların ÖNÜNE taşı (BU KATMAN).
  //   Bu sayede:
  //     - tour-matching ÇALIŞMAZ → unknownTourQuery üretilmez
  //     - extractAllInfo ÇALIŞMAZ → pax çıkmaz, rezervasyon akışına kaçmaz
  //     - FSM geçişi ÇALIŞMAZ → stage mutasyonu yok
  //
  // Stage-bağımsız: pattern eşleşmesi YETERLİ filtre (Murat ilke 3 mimari uygulaması).
  // Kullanıcı hangi stage'de olursa olsun fiyat/superlatif/tema sorabilir.
  // ----------------------------------------------------------------------------

  // --- STAGE GUARD: YENİ KATMAN SADECE KEŞİF AŞAMASINDA ÇALIŞIR ---
  // 2026-06-26 R5 telefon bug fix: rezervasyon adımında (COLLECTING_INFO) kullanıcı
  // telefon/pax/isim girer — fiyat sorgusu DEĞİL. Eski R4'te stage-bağımsız guard
  // "05445655656" telefonunu 54456-55656 fiyat aralığı sanıp rezervasyonu böldü.
  // Kök çözüm: nitelik ön-tespit katmanı SADECE keşif (GREETING/BROWSING/TOUR_SELECTED)
  // aşamasında çalışsın. Bu Bug 3'ü (taşıma sayesinde extractAllInfo'dan önce çalışıyor)
  // hâlâ çözer çünkü "2 kişi 3000 bütçem" GREETING/BROWSING'de gelir → B1 yakalar.
  const _isExploreStage = context.stage === "GREETING"
      || context.stage === "BROWSING"
      || context.stage === "TOUR_SELECTED";

  // --- X8: SUPERLATİF FİYAT (en ucuz / en pahalı) ---
  // LLM (Haiku) sayı karşılaştırmada güvenilmez. Pattern eşleşince tours array
  // price_adult'a göre sıralanır, deterministik mesaj döner.
  const _superlativeAsc = /(?<![\p{L}\p{N}])(en\s+(ucuz|uygun|hesaplı|hesapli|düşük|dusuk)|cheapest|lowest\s+price|cheapest\s+tour)/iu;
  const _superlativeDesc = /(?<![\p{L}\p{N}])(en\s+(pahalı|pahali|yüksek|yuksek)|most\s+expensive|highest\s+price)/iu;
  const _matchesAsc = _superlativeAsc.test(message);
  const _matchesDesc = _superlativeDesc.test(message);
  if (_isExploreStage && (_matchesAsc || _matchesDesc) && tours.length > 0) {
    const _toursPriced = tours
      .map((t: any) => ({ tour: t, price: t.dates?.[0]?.price_adult }))
      .filter((x: any) => typeof x.price === "number" && x.price > 0);
    if (_toursPriced.length > 0) {
      _toursPriced.sort((a: any, b: any) =>
        _matchesDesc ? b.price - a.price : a.price - b.price
      );
      const _top = _toursPriced[0];
      const _lang = context.language || "tr";
      const _topTitle = getLocalizedTourTitle(_top.tour.title || "", _lang);
      const _exRatesX8 = await getExchangeRatesOnce().catch(() => ({}));
      const _showDualX8 = agency.show_multi_currency !== false;
      const _priceTextX8 = formatPriceSync(
        _top.price,
        _top.tour.currency || "TRY",
        _lang,
        _exRatesX8,
        _showDualX8,
        languageCurrencies,
      );
      const _superlativeMsgs: Record<string, { cheapest: string; expensive: string }> = {
        tr: {
          cheapest:  `En uygun fiyatlı turumuz *${_topTitle}* — ${_priceTextX8} (kişi başı). Hakkında bilgi almak ister misiniz? 😊`,
          expensive: `En pahalı turumuz *${_topTitle}* — ${_priceTextX8} (kişi başı). Hakkında bilgi almak ister misiniz? 😊`,
        },
        en: {
          cheapest:  `Our most affordable tour is *${_topTitle}* — ${_priceTextX8} (per person). Would you like more info? 😊`,
          expensive: `Our most expensive tour is *${_topTitle}* — ${_priceTextX8} (per person). Would you like more info? 😊`,
        },
        de: {
          cheapest:  `Unsere günstigste Tour ist *${_topTitle}* — ${_priceTextX8} (pro Person). Möchten Sie mehr Infos? 😊`,
          expensive: `Unsere teuerste Tour ist *${_topTitle}* — ${_priceTextX8} (pro Person). Möchten Sie mehr Infos? 😊`,
        },
        fr: {
          cheapest:  `Notre circuit le moins cher est *${_topTitle}* — ${_priceTextX8} (par personne). Plus d'informations ? 😊`,
          expensive: `Notre circuit le plus cher est *${_topTitle}* — ${_priceTextX8} (par personne). Plus d'informations ? 😊`,
        },
        es: {
          cheapest:  `Nuestro tour más económico es *${_topTitle}* — ${_priceTextX8} (por persona). ¿Más información? 😊`,
          expensive: `Nuestro tour más caro es *${_topTitle}* — ${_priceTextX8} (por persona). ¿Más información? 😊`,
        },
        ru: {
          cheapest:  `Самый доступный тур — *${_topTitle}* — ${_priceTextX8} (с человека). Хотите больше информации? 😊`,
          expensive: `Самый дорогой тур — *${_topTitle}* — ${_priceTextX8} (с человека). Хотите больше информации? 😊`,
        },
        ar: {
          cheapest:  `أوفر جولة لدينا *${_topTitle}* — ${_priceTextX8} (للشخص). هل تريد المزيد من المعلومات؟ 😊`,
          expensive: `أغلى جولة لدينا *${_topTitle}* — ${_priceTextX8} (للشخص). هل تريد المزيد من المعلومات؟ 😊`,
        },
      };
      const _msgSet = _superlativeMsgs[_lang] || _superlativeMsgs.tr;
      const _x8Reply = _matchesDesc ? _msgSet.expensive : _msgSet.cheapest;
      console.log(`[process-message] X8 superlatif fiyat: ${_matchesDesc ? "DESC (en pahalı)" : "ASC (en ucuz)"} → ${_top.tour.title} (${_top.price})`);
      await _save(_x8Reply, context);
      await adapter.sendResponse(_x8Reply);
      return { success: true, response: _x8Reply, newContext: context };
    }
  }

  // --- B1: FİYAT ARALIĞI / BÜTÇE ---
  // R1: pattern + 7 dil. R2: bütçe/budget genişletme. R3: agresif fallback.
  // R4 (BU): mimari taşıma — stage-bağımsız, extractAllInfo/FSM öncesi.
  const _priceRangePats: RegExp[] = [
    /(\d{2,6})\s*(?:tl|₺)?\s*(?:ile|ila|ve|-|–|—|to|and)\s*(\d{2,6})\s*(?:tl|₺)?\s*(?:aras[ıi])?/i,
    /between\s+(\d{2,6})\s+(?:and|to)\s+(\d{2,6})/i,
    /zwischen\s+(\d{2,6})\s+und\s+(\d{2,6})/i,
    /entre\s+(\d{2,6})\s+(?:et|y)\s+(\d{2,6})/i,
    /между\s+(\d{2,6})\s+и\s+(\d{2,6})/i,
    /بين\s+(\d{2,6})\s+و\s*(\d{2,6})/i,
  ];
  const _priceMaxPats: RegExp[] = [
    /(\d{2,6})\s*(?:tl|₺)?\s*alt[ıi](?:n(?:da?)?)?/i,
    /(\d{2,6})\s*(?:tl|₺)?\s*(?:aşağ[ıi]|aşağıs[ıi])/i,
    /(\d{2,6})['’]?\s*[eaıi]?\s+kadar/i,
    /(?:en\s+fazla|max(?:imum)?)\s+(\d{2,6})/i,
    /b[üu]t[çc]e[mn]?\s+(\d{2,6})/i,
    /(\d{2,6})\s*(?:tl|₺)?\s*b[üu]t[çc]e[mn]?/i,
    /budget(?:\s+(?:is|of|de|von))?\s+(\d{2,6})/i,
    /(\d{2,6})\s*(?:tl|₺)?\s*budget/i,
    /presupuesto\s+(?:de\s+)?(\d{2,6})/i,
    /бюджет\s+(?:в\s+)?(\d{2,6})/i,
    /ميزانية\s*(?:قدرها\s+)?(\d{2,6})/i,
    /(\d{2,6})\s*(?:and\s+)?(?:below|under|or\s+less)/i,
    /(?:up\s+to|less\s+than|max(?:imum)?)\s+(\d{2,6})/i,
    /bis\s+(?:zu\s+)?(\d{2,6})/i,
    /unter\s+(\d{2,6})/i,
    /jusqu['’]\s*à\s+(\d{2,6})/i,
    /moins\s+de\s+(\d{2,6})/i,
    /hasta\s+(\d{2,6})/i,
    /menos\s+de\s+(\d{2,6})/i,
    /до\s+(\d{2,6})/i,
    /менее\s+(\d{2,6})/i,
    /حتى\s+(\d{2,6})/i,
    /أقل\s+من\s+(\d{2,6})/i,
  ];
  const _priceMinPats: RegExp[] = [
    /(\d{2,6})\s*(?:tl|₺)?\s*(?:[üu]st[üu]|[üu]st[üu]nde?|[üu]zerinde?)/i,
    /(\d{2,6})['’]?\s*[dn]?[ae]n?\s+(?:fazla|y[üu]ksek)/i,
    /(?:over|above|more\s+than)\s+(\d{2,6})/i,
    /(\d{2,6})\s*(?:or\s+more|and\s+up)/i,
    /über\s+(\d{2,6})/i,
    /mehr\s+als\s+(\d{2,6})/i,
    /plus\s+de\s+(\d{2,6})/i,
    /más\s+de\s+(\d{2,6})/i,
    /более\s+(\d{2,6})/i,
    /أكثر\s+من\s+(\d{2,6})/i,
  ];

  let _priceLower: number | null = null;
  let _priceUpper: number | null = null;
  let _priceMatched = false;

  // R5: stage guard GERİ EKLENDİ (telefon bug fix). Pattern + fallback rezervasyon
  // adımında ÇALIŞMAMALI — keşif aşamasında (GREETING/BROWSING/TOUR_SELECTED) çalışır.
  if (_isExploreStage && tours.length > 0) {
    for (const p of _priceRangePats) {
      const m = message.match(p);
      if (m && m[1] && m[2]) {
        const a = parseInt(m[1], 10);
        const b = parseInt(m[2], 10);
        if (a >= 100 && b >= 100) {
          _priceLower = Math.min(a, b);
          _priceUpper = Math.max(a, b);
          _priceMatched = true;
          break;
        }
      }
    }
    if (!_priceMatched) {
      for (const p of _priceMaxPats) {
        const m = message.match(p);
        if (m && m[1]) {
          const v = parseInt(m[1], 10);
          if (v >= 100) { _priceUpper = v; _priceMatched = true; break; }
        }
      }
    }
    if (!_priceMatched) {
      for (const p of _priceMinPats) {
        const m = message.match(p);
        if (m && m[1]) {
          const v = parseInt(m[1], 10);
          if (v >= 100) { _priceLower = v; _priceMatched = true; break; }
        }
      }
    }
    // KÖK FALLBACK (R3'ten aynı — 2+ sayı bağlam-bağımsız, 1 sayı + ctx şart)
    // 2026-06-26 R5 FIX: \b word boundary eklendi. "05445655656" gibi bitişik 11+
    // hane telefon numaralarını fiyat sanıp aralık üretmesin (canlı bug kanıtı).
    // Bitişik diziler word-boundary olmadığından match etmez; ayrı sayı token'ları
    // ("3000 ile 5000") match eder. Stage guard ile çift-katmanlı koruma.
    if (!_priceMatched) {
      const _nums = Array.from(message.matchAll(/\b\d{3,6}\b/g))
        .map((m) => parseInt(m[0], 10))
        .filter((n) => n >= 100 && n <= 100000);
      if (_nums.length >= 2) {
        _priceLower = Math.min(_nums[0], _nums[1]);
        _priceUpper = Math.max(_nums[0], _nums[1]);
        _priceMatched = true;
        console.log(`[process-message] B1 KÖK FALLBACK (range, contextless): nums=${_nums.slice(0, 2)}`);
      } else if (_nums.length === 1) {
        const _priceCtxRe = /b[üu]t[çc]e|alt[ıi]|aşağ[ıi]|[üu]st[üu]|[üu]zeri|fazla|kadar|aras[ıi]|ila|ile\s+\d|ve\s+\d|tl|₺|lira|budget|under|over|less\s+than|more\s+than|cheaper|expensive|between|up\s+to|hasta|menos|m[áa]s|entre|jusqu|moins|plus\s+de|bis|unter|über|до|более|менее|между|أقل|أكثر|حتى|بين/iu;
        if (_priceCtxRe.test(message)) {
          _priceUpper = _nums[0];
          _priceMatched = true;
          console.log(`[process-message] B1 KÖK FALLBACK (upper, with ctx): num=${_nums[0]}`);
        }
      }
    }
  }

  if (_priceMatched) {
    const _priced = tours
      .map((t: any) => ({ tour: t, price: t.dates?.[0]?.price_adult }))
      .filter((x: any) => typeof x.price === "number" && x.price > 0);
    const _filtered = _priced.filter((x: any) => {
      if (_priceLower !== null && x.price < _priceLower) return false;
      if (_priceUpper !== null && x.price > _priceUpper) return false;
      return true;
    }).sort((a: any, b: any) => a.price - b.price);

    const _exRatesB1 = await getExchangeRatesOnce().catch(() => ({}));
    const _showDualB1 = agency.show_multi_currency !== false;
    const _langB1 = context.language || "tr";

    const _summary: Record<string, string> =
      _priceLower !== null && _priceUpper !== null
        ? { tr: `${_priceLower}-${_priceUpper}₺`, en: `${_priceLower}-${_priceUpper} TRY`, de: `${_priceLower}-${_priceUpper} TRY`, fr: `${_priceLower}-${_priceUpper} TRY`, es: `${_priceLower}-${_priceUpper} TRY`, ru: `${_priceLower}-${_priceUpper} TRY`, ar: `${_priceLower}-${_priceUpper} TRY` }
        : _priceUpper !== null
        ? { tr: `${_priceUpper}₺ altı`, en: `under ${_priceUpper} TRY`, de: `unter ${_priceUpper} TRY`, fr: `moins de ${_priceUpper} TRY`, es: `menos de ${_priceUpper} TRY`, ru: `до ${_priceUpper} TRY`, ar: `أقل من ${_priceUpper} TRY` }
        : { tr: `${_priceLower}₺ üstü`, en: `over ${_priceLower} TRY`, de: `über ${_priceLower} TRY`, fr: `plus de ${_priceLower} TRY`, es: `más de ${_priceLower} TRY`, ru: `более ${_priceLower} TRY`, ar: `أكثر من ${_priceLower} TRY` };

    if (_filtered.length === 0) {
      const _cheapest = _priced.sort((a: any, b: any) => a.price - b.price)[0];
      let _b1NoneReply: string;
      if (_cheapest) {
        const _priceText = formatPriceSync(_cheapest.price, _cheapest.tour.currency || "TRY", _langB1, _exRatesB1, _showDualB1, languageCurrencies);
        const _topTitle = getLocalizedTourTitle(_cheapest.tour.title || "", _langB1);
        const _noneMsgs: Record<string, string> = {
          tr: `${_summary.tr} bütçesine uygun turumuz yok. En uygun fiyatlı turumuz *${_topTitle}* — ${_priceText} (kişi başı). 😊`,
          en: `We don't have a tour in the ${_summary.en} range. Our most affordable tour is *${_topTitle}* — ${_priceText} (per person). 😊`,
          de: `Wir haben keine Tour im Bereich ${_summary.de}. Unsere günstigste Tour ist *${_topTitle}* — ${_priceText} (pro Person). 😊`,
          fr: `Nous n'avons pas de circuit dans la fourchette ${_summary.fr}. Notre circuit le moins cher est *${_topTitle}* — ${_priceText} (par personne). 😊`,
          es: `No tenemos un tour en el rango ${_summary.es}. Nuestro tour más económico es *${_topTitle}* — ${_priceText} (por persona). 😊`,
          ru: `У нас нет тура в диапазоне ${_summary.ru}. Самый доступный тур — *${_topTitle}* — ${_priceText} (с человека). 😊`,
          ar: `لا توجد جولة في نطاق ${_summary.ar}. أوفر جولة لدينا *${_topTitle}* — ${_priceText} (للشخص). 😊`,
        };
        _b1NoneReply = _noneMsgs[_langB1] || _noneMsgs.tr;
      } else {
        const _fallbacks: Record<string, string> = {
          tr: `Bu bütçeye uygun turumuz şu anda yok. Lütfen acentemizle iletişime geçin.`,
          en: `We don't have a tour matching that budget right now. Please contact our agency.`,
          de: `Derzeit keine Tour in diesem Budget. Bitte kontaktieren Sie unsere Agentur.`,
          fr: `Aucun circuit dans ce budget actuellement. Contactez notre agence.`,
          es: `No hay tours en ese presupuesto ahora. Contacte nuestra agencia.`,
          ru: `Сейчас нет туров в этом бюджете. Свяжитесь с агентством.`,
          ar: `لا توجد جولات في هذه الميزانية حالياً. يرجى التواصل مع وكالتنا.`,
        };
        _b1NoneReply = _fallbacks[_langB1] || _fallbacks.tr;
      }
      console.log(`[process-message] B1 fiyat aralığı: lower=${_priceLower} upper=${_priceUpper} → eşleşme YOK`);
      await _save(_b1NoneReply, context);
      await adapter.sendResponse(_b1NoneReply);
      return { success: true, response: _b1NoneReply, newContext: context };
    }

    const _listLinesB1 = _filtered.slice(0, 8).map((x: any, i: number) => {
      const _priceText = formatPriceSync(x.price, x.tour.currency || "TRY", _langB1, _exRatesB1, _showDualB1, languageCurrencies);
      return `${i + 1}) ${getLocalizedTourTitle(x.tour.title || "", _langB1)} — ${_priceText}`;
    }).join("\n");

    const _b1Msgs: Record<string, string> = {
      tr: `${_summary.tr} bütçenize uygun turlarımız:\n${_listLinesB1}\n\nHangisi ilginizi çeker? 😊`,
      en: `Tours within your ${_summary.en} budget:\n${_listLinesB1}\n\nWhich interests you? 😊`,
      de: `Touren in Ihrem Budget (${_summary.de}):\n${_listLinesB1}\n\nWelche interessiert Sie? 😊`,
      fr: `Circuits dans votre budget (${_summary.fr}) :\n${_listLinesB1}\n\nLequel vous intéresse ? 😊`,
      es: `Tours dentro de tu presupuesto (${_summary.es}):\n${_listLinesB1}\n\n¿Cuál te interesa? 😊`,
      ru: `Туры в вашем бюджете (${_summary.ru}):\n${_listLinesB1}\n\nКакой вас интересует? 😊`,
      ar: `جولات ضمن ميزانيتك (${_summary.ar}):\n${_listLinesB1}\n\nأيها يثير اهتمامك؟ 😊`,
    };
    const _b1Reply = _b1Msgs[_langB1] || _b1Msgs.tr;
    console.log(`[process-message] B1 fiyat aralığı: lower=${_priceLower} upper=${_priceUpper} matches=${_filtered.length}`);
    await _save(_b1Reply, context);
    await adapter.sendResponse(_b1Reply);
    return { success: true, response: _b1Reply, newContext: context };
  }

  // --- B-DUR: SÜRE FİLTRESİ (tours.type ENUM eşleştirmesi) ---
  // 2026-06-27 köşe 6 fix: "1 günlük tur" / "2 gecelik" UNKNOWN_TOUR'a düşüyordu.
  // tour-matching SADECE title/destination/aliases'a bakıyor; tours.type (DAYTRIP/N2/N3)
  // ENUM eşleştirmeye girmiyordu. Süre kelimesi → type map, tours.filter, deterministik
  // mesaj. "2/3 günlük" KASITLI olarak match edilmiyor (N1 yok, muğlak).
  // Sıra: B-DUR önce, B-TEMA sonra. "günübirlik doğa turu" → DAYTRIP filtreli liste.
  const _DURATION_PATTERNS: { regex: RegExp; type: "DAYTRIP" | "N2" | "N3" }[] = [
    // DAYTRIP — TR (günübirlik, 1 günlük, günlük tur, günlük gezi) + 6 dil
    // (?<!\d\s) "günlük tur" → "3 günlük tur" gibi sayı+boşluk öncülü match'i engeller
    // (muğlak: N1 yok, "3 günlük" = 2 gece N2 mi 3 gece N3 mi belirsiz → tour-matching'e bırak)
    {
      regex: /(?<![\p{L}\p{N}])(g[üu]n[üu]birlik|1\s*g[üu]nl[üu]k|(?<!\d\s)g[üu]nl[üu]k\s+(?:bir\s+)?(?:tur|gezi?)|day\s*[-\s]?trip|one[-\s]?day(?:\s+tour)?|tages(?:tour|ausflug)|eint[äa]gig|excursion\s+(?:d['’]une\s+)?journ[ée]e|excursi[óo]n\s+de\s+un\s+d[íi]a|paseo\s+diurno|однодневн|дневной\s+тур|رحلة\s*يومية|جولة\s*يومية)/iu,
      type: "DAYTRIP",
    },
    // N2 — "2 gece" / "2 gecelik" + 6 dil
    {
      regex: /(?<![\p{L}\p{N}])(2\s*gece(?:lik)?|2[-\s]?nights?|2\s*N[äa]chte|2\s*nuits?|2\s*noches?|2\s*ноч[иией]?|ليلتين|جولة\s*لليلتين)/iu,
      type: "N2",
    },
    // N3 — "3 gece" / "3 gecelik" + 6 dil
    {
      regex: /(?<![\p{L}\p{N}])(3\s*gece(?:lik)?|3[-\s]?nights?|3\s*N[äa]chte|3\s*nuits?|3\s*noches?|3\s*ноч[иией]?|3\s*ليالي)/iu,
      type: "N3",
    },
  ];

  let _matchedType: "DAYTRIP" | "N2" | "N3" | null = null;
  for (const dp of _DURATION_PATTERNS) {
    if (dp.regex.test(message)) {
      _matchedType = dp.type;
      break;
    }
  }

  if (
    _isExploreStage &&
    _matchedType &&
    tours.length > 0
  ) {
    const _filtered = tours.filter((t: any) => t.type === _matchedType);
    const _langDur = context.language || "tr";

    // Süre kategorisi → 7 dil yerelleştirilmiş etiket
    const _typeLabel: Record<string, Record<string, string>> = {
      DAYTRIP: { tr: "günübirlik", en: "day", de: "Tages", fr: "d'une journée", es: "de un día", ru: "однодневные", ar: "اليومية" },
      N2:      { tr: "2 gecelik",  en: "2-night", de: "2-Nächte", fr: "2 nuits", es: "2 noches", ru: "2-ночные", ar: "لليلتين" },
      N3:      { tr: "3 gecelik",  en: "3-night", de: "3-Nächte", fr: "3 nuits", es: "3 noches", ru: "3-ночные", ar: "3 ليالي" },
    };
    const _label = _typeLabel[_matchedType][_langDur] || _typeLabel[_matchedType].tr;

    const _exRatesDur = await getExchangeRatesOnce().catch(() => ({}));
    const _showDualDur = agency.show_multi_currency !== false;

    if (_filtered.length === 0) {
      // O type'ta tur yok → mevcut tüm turları öner (UNKNOWN_TOUR'a düşürme)
      const _allTours = tours.slice(0, 8).map((t: any, i: number) => {
        const _firstDate = t.dates?.[0];
        const _priceText = _firstDate?.price_adult
          ? ` — ${formatPriceSync(_firstDate.price_adult, t.currency || "TRY", _langDur, _exRatesDur, _showDualDur, languageCurrencies)}`
          : "";
        return `${i + 1}) ${getLocalizedTourTitle(t.title, _langDur)}${_priceText}`;
      }).join("\n");

      const _noneMsgs: Record<string, string> = {
        tr: `${_label} turumuz şu anda yok. Mevcut turlarımız:\n${_allTours}\n\nHangisi ilginizi çeker? 😊`,
        en: `We don't have ${_label} tours right now. Our available tours:\n${_allTours}\n\nWhich interests you? 😊`,
        de: `Wir haben derzeit keine ${_label}-Touren. Verfügbare Touren:\n${_allTours}\n\nWelche interessiert Sie? 😊`,
        fr: `Pas de circuit ${_label} pour le moment. Circuits disponibles :\n${_allTours}\n\nLequel vous intéresse ? 😊`,
        es: `No tenemos tours ${_label} ahora. Tours disponibles:\n${_allTours}\n\n¿Cuál te interesa? 😊`,
        ru: `Сейчас нет ${_label} туров. Доступные туры:\n${_allTours}\n\nКакой вас интересует? 😊`,
        ar: `لا توجد جولات ${_label} حالياً. الجولات المتاحة:\n${_allTours}\n\nأيها يثير اهتمامك؟ 😊`,
      };
      const _reply = _noneMsgs[_langDur] || _noneMsgs.tr;
      await _save(_reply, context);
      await adapter.sendResponse(_reply);
      return { success: true, response: _reply, newContext: context };
    }

    // Filtreli liste (type eşleşen turlar)
    const _filteredList = _filtered.slice(0, 8).map((t: any, i: number) => {
      const _firstDate = t.dates?.[0];
      const _priceText = _firstDate?.price_adult
        ? ` — ${formatPriceSync(_firstDate.price_adult, t.currency || "TRY", _langDur, _exRatesDur, _showDualDur, languageCurrencies)}`
        : "";
      return `${i + 1}) ${getLocalizedTourTitle(t.title, _langDur)}${_priceText}`;
    }).join("\n");

    const _msgs: Record<string, string> = {
      tr: `${_label} turlarımız:\n${_filteredList}\n\nHangisi ilginizi çeker? 😊`,
      en: `Our ${_label} tours:\n${_filteredList}\n\nWhich interests you? 😊`,
      de: `Unsere ${_label}-Touren:\n${_filteredList}\n\nWelche interessiert Sie? 😊`,
      fr: `Nos circuits ${_label} :\n${_filteredList}\n\nLequel vous intéresse ? 😊`,
      es: `Nuestros tours ${_label}:\n${_filteredList}\n\n¿Cuál te interesa? 😊`,
      ru: `Наши ${_label} туры:\n${_filteredList}\n\nКакой вас интересует? 😊`,
      ar: `جولاتنا ${_label}:\n${_filteredList}\n\nأيها يثير اهتمامك؟ 😊`,
    };
    const _reply = _msgs[_langDur] || _msgs.tr;
    await _save(_reply, context);
    await adapter.sendResponse(_reply);
    return { success: true, response: _reply, newContext: context };
  }

  // --- B-TEMA: TEMA SÖZLÜĞÜ — yumuşatılmış mesaj ---
  // R4: selectedTour/multipleTourMatches kontrolü kaldırıldı (henüz hesaplanmadı).
  // currentTour kontrolü tutuldu — rezervasyon ortasında tema sorusu LLM'e bırakılsın.
  const _themeKeywordsRe = /(?<![\p{L}\p{N}])(do[ğg]a|macera|k[üu]lt[üu]r|tarihi|tarihsel|romantik|deniz|aile|nature|adventure|cultural|historical|historic|romantic|family|natur(?!al)|abenteuer|kultur|historisch|romantisch|familie|aventure|culturel|historique|romantique|famille|naturaleza|aventura|histórico|romántico|familia|природа|приключени|культурн|историческ|романтическ|семейн|طبيعة|مغامرة|ثقافة|تاريخي|رومانسي|عائلي)/iu;

  if (
    _isExploreStage &&
    tours.length > 0 &&
    !context.currentTour &&
    _themeKeywordsRe.test(message)
  ) {
    const _exRatesBT = await getExchangeRatesOnce().catch(() => ({}));
    const _showDualBT = agency.show_multi_currency !== false;
    const _langBT = context.language || "tr";
    const _tourListBT = tours.slice(0, 8).map((t: any, i: number) => {
      const _firstDate = t.dates?.[0];
      const _priceText = _firstDate?.price_adult
        ? ` — ${formatPriceSync(_firstDate.price_adult, t.currency || "TRY", _langBT, _exRatesBT, _showDualBT, languageCurrencies)}`
        : "";
      return `${i + 1}) ${getLocalizedTourTitle(t.title, _langBT)}${_priceText}`;
    }).join("\n");
    const _themeMsgs: Record<string, string> = {
      tr: `Tema bazlı özel filtremiz henüz yok, ama tüm turlarımız şunlar:\n${_tourListBT}\n\nHangisi ilginizi çeker? 😊`,
      en: `We don't have theme-based filtering yet, but here are all our tours:\n${_tourListBT}\n\nWhich interests you? 😊`,
      de: `Wir haben noch keine themenbasierte Filterung, hier sind alle unsere Touren:\n${_tourListBT}\n\nWelche interessiert Sie? 😊`,
      fr: `Nous n'avons pas encore de filtrage par thème, voici tous nos circuits :\n${_tourListBT}\n\nLequel vous intéresse ? 😊`,
      es: `Aún no tenemos filtrado por tema, pero estos son todos nuestros tours:\n${_tourListBT}\n\n¿Cuál te interesa? 😊`,
      ru: `У нас пока нет фильтрации по тематике, но вот все наши туры:\n${_tourListBT}\n\nКакой вас интересует? 😊`,
      ar: `لا تتوفر لدينا تصفية حسب الموضوع بعد، ولكن إليك جميع جولاتنا:\n${_tourListBT}\n\nما الذي يثير اهتمامك؟ 😊`,
    };
    const _btReply = _themeMsgs[_langBT] || _themeMsgs.tr;
    console.log(`[process-message] B-TEMA yumuşatma: tema sözlüğü match → liste`);
    await _save(_btReply, context);
    await adapter.sendResponse(_btReply);
    return { success: true, response: _btReply, newContext: context };
  }

  // === NİTELİK ÖN-TESPİT KATMANI SON ===========================================
  // ============================================================================

  // === 7. TUR EŞLEŞTİRME ===
  const { selectedTour, multipleMatches: multipleTourMatches, unknownTourQuery } = findMatchingTours(
    message,
    nluResult.entities,
    tours,
    getNextExpectedInput(context),
    nluResult.intent,
  );
  if (selectedTour) console.log("[process-message] Tour matched:", selectedTour.title);
  if (unknownTourQuery) console.log("[process-message] UNKNOWN_TOUR signal:", unknownTourQuery);

  // 2026-06-25 KÖK 5 devamı: erken-müdahale uygulandı mı bayrağı (extractAllInfo'ya
  // geçirilir → Blok 10 tek-tarih otomatik atama ATLAYACAK → yeni turun tarihi
  // kullanıcıya sorulur, sessiz atama olmaz).
  let _tourJustChangedThisTurn = false;

  // === 7b. ERKEN TUR DEĞİŞİMİ (2026-06-20 Bug 1 v2) ========================
  // Tour-matching kanıtsal selectedTour mevcut currentTour'dan farklıysa VE stage
  // COLLECTING_INFO/CONFIRMING ise: stage koruma intent'i ezmeden (line ~326)
  // önce deterministik tur değişimini uygula. Aksi halde pattern-bazlı transition
  // tetiklenmez ve LLM yeni tur adıyla eski turun tarihini sunar (canlı bug
  // execution 801fed7d kanıtı: "Efes Antik Kent Turu için 15.12.2026 - 900₺"
  // ama state currentTour=Kapadokya, dateId=b...001 Kapadokya'nın).
  //
  // Çakışma güvenliği: erken müdahale context.currentTour'u günceller; sonraki
  // state-machine transition condition'ı (selectedTour.id !== ctx.currentTour.id)
  // artık equal görür → kendiliğinden atlar. Çifte değişim yok.
  if (shouldApplyEarlyTourChange(context, selectedTour, fsmIntent, message)) {
    const _prevStage = context.stage;
    const _prevTourTitle = context.currentTour?.title;
    context = {
      ...produceTourChangeContext(context, selectedTour),
      stage: "COLLECTING_INFO" as any,
      reservationConfirmed: false,                       // CONFIRMING'den geri dönüş temizliği
    };
    _tourJustChangedThisTurn = true;  // KÖK 5 devamı: Blok 10 (tek-tarih oto atama) ATLAYACAK
    console.log(
      `[process-message] DETERMINISTIC tour-change: ${_prevStage} → COLLECTING_INFO ` +
      `("${_prevTourTitle}" → "${selectedTour.title}")`,
    );
  }

  // === 7c. BELİRSİZ TUR DEĞİŞİMİ — destinasyon-specific "hangisi?" sorusu ===
  // 2026-06-25 KÖK 5 FIX 2 (canlı kanıt — "kapadokya turuna geçmek istiyorum"):
  // Tur değişim ifadesi var AMA selectedTour=null (Strateji 1+1.5 daraltma yetmedi,
  // multipleMatches hâlâ > 1). Bu durumda kullanıcıya SADECE eşleşen destinasyon
  // turlarını listele + "hangisi?" sor. Sonraki turn'de spesifik tur seçilince
  // FIX 1 daraltma çalışır.
  //
  // KRİTİK AYRIM: SADECE rezervasyon-esnası tur değişim bağlamında. Yeni rezervasyon
  // (GREETING/TOUR_SELECTED) çoklu-eşleşme davranışı (A3 mevcut B2 list) BOZULMAZ.
  const _hasExplicitTourChangeNoMatch =
    TOUR_CHANGE_PHRASE_RE.test(message) &&
    !selectedTour &&
    multipleTourMatches.length > 1 &&
    (context.stage === "COLLECTING_INFO" || context.stage === "CONFIRMING");
  if (_hasExplicitTourChangeNoMatch) {
    const _lang = context.language || "tr";
    const _tourListLines = multipleTourMatches.slice(0, 8).map((t: any, i: number) => {
      return `${i + 1}) ${getLocalizedTourTitle(t.title, _lang)}`;
    }).join("\n");
    const _ambiguousMsgs: Record<string, string> = {
      tr: `Birden fazla tur seçeneğimiz var:\n${_tourListLines}\n\nHangisini tercih edersiniz?`,
      en: `We have multiple tour options:\n${_tourListLines}\n\nWhich one would you prefer?`,
    };
    const _ambReply = _ambiguousMsgs[_lang] || _ambiguousMsgs.tr;
    console.log(`[process-message] KÖK 5 FIX2: belirsiz tur değişim (${multipleTourMatches.length} match) → destinasyon-specific liste`);
    await _save(_ambReply, context);
    await adapter.sendResponse(_ambReply);
    return { success: true, response: _ambReply, newContext: context };
  }

  // B2: Orijinal intent'i stage korumadan ÖNCE kaydet
  const _prePromotionIntent = nluResult.intent;

  // Stage koruma: COLLECTING_INFO / CONFIRMING'de tour_search → provide_info
  // B-2 fix (2026-06-09): reservation_intent de aynı şekilde provide_info'ya ezilir.
  // Rezervasyon zaten devam ediyorken NLU "kullanıcı yeni rezervasyon başlatmak istiyor"
  // sanıp tur değişimi transition'ını tetikliyordu (Özge bug'ının kaynağı). İsim/telefon
  // verirken gelen mesaj asla yeni rezervasyon değildir; mevcut akışın devamıdır.
  //
  // 2026-06-25 KÖK 5 FIX (canlı G2 — tarih sonrası tur değiştirme):
  // İSTİSNA: GERÇEK tur değişimi sinyalinde stage koruma atla. 3 koşul birden:
  //   (1) Mesajda AÇIK tur değişim ifadesi (TOUR_CHANGE_PHRASE_RE)
  //   (2) NLU tour_name veya destination çıkardı
  //   (3) Çıkarılan tur adı/destinasyon mesajda gerçekten geçiyor (isNluOutputInMessage
  //       benzeri — NLU history'den uydurmasın). Mevcut findMatchingTours sonucu
  //       (selectedTour DOLU + currentTour'dan FARKLI) bu kontrolü ZATEN içeriyor.
  // Bu istisna fsmIntent'i korur → state-machine'e doğru intent ulaşır.
  // Özge bug korunur: "Özge Yılmazer" mesajında açık ifade YOK → istisna tetiklenmez.
  const _hasExplicitTourChange =
    TOUR_CHANGE_PHRASE_RE.test(message) &&
    selectedTour !== null &&
    selectedTour.id !== context.currentTour?.id;
  if (
    (context.stage === "COLLECTING_INFO" || context.stage === "CONFIRMING") &&
    (nluResult.intent === "tour_search" || nluResult.intent === "reservation_intent") &&
    !_hasExplicitTourChange
  ) {
    nluResult.intent = "provide_info";
    fsmIntent = mapNLUIntentToFSMIntent("provide_info");
  } else if (_hasExplicitTourChange) {
    console.log(`[process-message] KÖK 5: gerçek tur değişimi (${selectedTour?.title}) — stage koruma ATLANDI`);
  }

  // 2026-06-23 BUG B PROVIDE_INFO VARYANT (exec 94ee1378/d36d9550):
  // CONFIRMING'de "aslında adım Fırat Fırmaz" → NLU intent=provide_info (change_info DEĞİL)
  // + extracted.fullName="Fırat Fırmaz" + mevcut "Mustafa Eken". Mevcut Bug B fix
  // (isExplicitCorrection = intent==="change_info") devreye girmedi → !merged.fullName=false
  // → override atlandı → isim yutuldu.
  //
  // ÇÖZÜM: ORIGINAL stage CONFIRMING iken + intent provide_info + extracted.fullName/phone
  // mevcuttan FARKLI ise → intent'i "change_info"'ya PROMOTE et. Böylece state-machine'e
  // change_info ulaşır, mevcut Bug B fix override çalışır.
  //
  // GÜVENLİK:
  //   - context.stage === "COLLECTING_INFO" veya "CONFIRMING" (rezervasyon-öncesi).
  //     COMPLETED ayrı yol: 14a-3 acente yönlendirme bypass'ı (DB yalan vaadi yok).
  //   - GREETING/BROWSING/TOUR_SELECTED'da etkilenmez (mevcut isim/telefon YOK → ilk doldurma).
  //   - SADECE _confInfo.fullName/phone DOLU iken (`!!_confInfo?.fullName`) — ilk doldurma değil
  //     düzeltme niyeti şart. waiting_for_name'de mevcut isim boş → promote TETİKLENMEZ.
  //   - SADECE extracted.fullName/phone mevcuttan FARKLIYSA (aynı değer override yapmaz).
  //   - NLU prompt full_name ekstraksiyonu dar (2-3 kelime proper noun) → uydurma riski düşük.
  //   - F-savunması katmanları (NLU prompt + Blok 3 sigortası) extracted'a girene kadar
  //     temizler — bu seviyede leak yok.
  //
  // 2026-06-25 FIX KÖK 1 (canlı kanıt — Ege tuzağı):
  //   COLLECTING_INFO/waiting_for_phone'da isim="İsmail Koca" + "aslında adım Osman fırfır"
  //   → eski guard sadece CONFIRMING'di → COLLECTING_INFO'da promote olmadı →
  //   !merged.fullName=false → override yutuldu. Ekran "Teşekkürler Osman!" ama state "İsmail"
  //   (LLM history'ye bakıp sahte kabul mesajı).
  //   Çözüm: PROMOTE guard'ı COLLECTING_INFO'yu da kapsasın. `!!_confInfo.fullName` koşulu
  //   ilk doldurma akışını korur (waiting_for_name'de mevcut isim boş → promote yok).
  const _confInfo = context.reservationInfo;
  const _confExt = nluResult.updates as any;
  const _isConfirmingFullNameChange =
    !!_confExt?.fullName && !!_confInfo?.fullName &&
    _confExt.fullName !== _confInfo.fullName;
  const _isConfirmingPhoneChange =
    !!_confExt?.phone && !!_confInfo?.phone &&
    _confExt.phone !== _confInfo.phone;
  if (
    (context.stage === "COLLECTING_INFO" || context.stage === "CONFIRMING") &&
    nluResult.intent === "provide_info" &&
    (_isConfirmingFullNameChange || _isConfirmingPhoneChange)
  ) {
    console.log(`[process-message] BUG B PROMOTE: ${context.stage} + provide_info + ${_isConfirmingFullNameChange ? "fullName" : "phone"} farklı → intent → change_info`);
    nluResult.intent = "change_info";
    fsmIntent = mapNLUIntentToFSMIntent("change_info");
  }

  // B-6 fix (2026-06-09): CONFIRMING'de "hayır" net redi → state KORUNUR, netleştirme sorusu sor.
  // Eski davranış: detectConfirmation false, detectCancellation false ("hayır" pattern'de yok),
  // değişiklik transition'ı da tetiklenmez → state takılı, LLM serbest cevap üretir (belirsiz).
  // Yeni: deterministik netleştirme mesajı ile bot kullanıcıya neyi değiştirmek istediğini sorar.
  if (context.stage === "CONFIRMING" && detectNegativeResponse(message, context.language)) {
    const _negMsgs: Record<string, string> = {
      tr: "Anladım. Hangi bilgiyi değiştirmek istersiniz — tarih, kişi sayısı, isim veya telefon? Yoksa rezervasyonu tamamen iptal mi etmek istiyorsunuz?",
      en: "I understand. Which detail would you like to change — date, number of people, name, or phone? Or would you like to cancel the reservation entirely?",
      de: "Verstanden. Welche Angabe möchten Sie ändern — Datum, Personenzahl, Name oder Telefon? Oder möchten Sie die Reservierung ganz stornieren?",
      ru: "Понял. Какие данные вы хотите изменить — дату, количество человек, имя или телефон? Или вы хотите полностью отменить бронирование?",
      ar: "فهمت. ما المعلومة التي تريد تغييرها — التاريخ، عدد الأشخاص، الاسم أو الهاتف؟ أم تريد إلغاء الحجز بالكامل؟",
      fr: "Compris. Quelle information souhaitez-vous modifier — date, nombre de personnes, nom ou téléphone ? Ou souhaitez-vous annuler complètement la réservation ?",
      es: "Entendido. ¿Qué información desea cambiar — fecha, número de personas, nombre o teléfono? ¿O prefiere cancelar la reserva por completo?",
    };
    const _negReply = _negMsgs[context.language] || _negMsgs.tr;
    await _save(_negReply, context);  // state KORUNUR (newContext yerine context)
    await adapter.sendResponse(_negReply);
    return { success: true, response: _negReply, newContext: context };
  }

  // === 8. BİLGİ ÇIKARMA ===
  // 2026-06-29 O1 fix: selectedTour (bu turn'de tour-matching çıktısı) parametre olarak
  // geçirilir → birleşik mesajda (tur+tarih aynı turn) Blok 9 dateId resolution
  // context.currentTour henüz null olsa bile selectedTour'u fallback kullanır.
  const extractedInfo = extractAllInfo({ message, nluResult, fsmIntent, context, tours, tourJustChanged: _tourJustChangedThisTurn, selectedTour });

  // === 8-PP. PROVIDE PROMOTE — BUG B PROMOTE'un simetriği (2026-07-03) ===
  // Canlı vaka (exec 771f2a84, "Yılda Fufu"): waiting_for_name'de kullanıcı ismi
  // yazdı → Haiku intent=general sınıfladı → isInformationalMessage intent
  // listesi TRUE → T12 action mergeReservationInfo(isInformational=TRUE) →
  // Kural 4 erken-return → isim (ve o turn'deki HER extract) SESSİZCE DÜŞTÜ.
  // LLM history'den "aldım" uydurup telefon sordu (sahte kabul). SINIF bug:
  // intent-kilitli merge isim/telefon/pax/tarih İLK toplamalarının hepsini
  // etkiliyor — Haiku "çıplak veri → general" sapması sistematik veri kaybı.
  //
  // K1 dersiyle aynı ilke: NLU intent'i tutarsız, deterministik kanıt otorite.
  // Kanıt: BEKLENEN adımın TAM O alanı extract katmanından (K3/Sorun F
  // gate'lerinden geçerek) çıktı → kullanıcı "somut veri sundu" = provide_info
  // semantiğinin ta kendisi → intent'i yükselt.
  //
  // GÜVENLİK ŞARTLARI:
  //   - SADECE fsmIntent==="general" (general_question/support_request/greeting
  //     DOKUNULMAZ — FAQ akışı, R6 muafiyeti, after-sales etkilenmez)
  //   - SADECE COLLECTING_INFO + beklenen adımın alanı (çapraz alan yükseltmez:
  //     waiting_for_name'de telefon extract'i promote tetiklemez)
  //   - Mesaj SORU DEĞİL (QUESTION_SIGNAL_RE, 7 dil + ?/؟) — Kural 4'ün asıl
  //     koruduğu "3 gün mü sürüyor?" sınıfı informational kalır
  //   - Hayriye (BUG 2) korunur: içeriksiz "tamam" (extract yok) promote edilmez
  //     → T13 CONFIRMING'e general ile geçemez
  //   - Sorun F/K3 korunur: "Murat değil aslında Ahmet" Blok 5 blacklist'te
  //     düşer → extract yok → promote yok
  //   - SADECE fsmIntent değişir; nluResult ham çıktısı, extractedInfo ve diğer
  //     guard'lar dokunulmaz.
  if (fsmIntent === "general" && context.stage === "COLLECTING_INFO") {
    const _ppExpectedFieldByStep: Record<string, string[]> = {
      waiting_for_name: ["fullName"],
      waiting_for_phone: ["phone"],
      waiting_for_pax: ["paxAdult"],
      waiting_for_date: ["dateId", "selectedDate"],
    };
    const _ppFields = _ppExpectedFieldByStep[context.collectionStep || ""] || [];
    const _ppFilledField = _ppFields.find((f) => !!(extractedInfo as any)[f]);
    if (_ppFilledField && !QUESTION_SIGNAL_RE.test(message)) {
      console.log(`[process-message] PROVIDE PROMOTE: step=${context.collectionStep} + extractedInfo.${_ppFilledField} dolu + intent=general → provide_info`);
      fsmIntent = "provide_info";
    }
  }

  // === 8a. F4 KATMAN 2 — ÇELİŞKİ TESPİTİ + İKİ DALLI SON-ONAY ===
  // 2026-06-25 (Katman 1 = 619417f detectConfirmation negative pattern kelime listesi
  // KALIYOR). Katman 2 kelime-bağımsız alt-ağ — Katman 1 kaçırırsa (liste-dışı fiil) +
  // NLU yanlış sınıflandırırsa devreye girer.
  //
  // TEŞHİS — F4 Katman 1 sonrası "ismi Ahmet yap onaylıyorum" 3 yola gider:
  //   (a) NLU change_info → state-machine değiştirir + stage COLLECTING_INFO,
  //       özet+onay garantisi M1'e bağlı (kırılgan)
  //   (b) NLU confirm_reservation → CONFIRMING→COMPLETED reddeder (msg uzun) +
  //       change_info weak signal yok → no-op → :13-PERSIST eski özet
  //       (DEĞİŞİKLİK YUTULUR — en kötü)
  //   (c) NLU provide_info + farklı isim → BUG B PROMOTE → (a) yolu
  //
  // Katman 2 her 3 yolu da deterministik kapatır: extractedInfo'da mevcut alanı
  // FARKLI değerle değiştiren değer + CONFIRMING + onay sinyali → state-machine
  // ATLA, değişikliği uygula + state CONFIRMING + özet+onay deterministik.
  //
  // İki dal:
  //   DAL 1 (NLU NET): _hasNewValue → değişiklik UYGULA + özet+onay → RETURN
  //   DAL 2 (BELİRSİZ): sinyal var ama değer yok → netleştirme → RETURN
  //
  // REGRESYON GUARD'LARI (KRİTİK):
  //   - Saf "evet"/"onaylıyorum" → extractedInfo boş, mesajda alan/fiil yok → atla
  //   - "evet yapalım" → "yap" çekim eki (lookahead engelle) → DAL 2 tetiklenmez
  //   - Saf "ismi Ahmet yap" (onaysız) → _hasConfirmSignal FALSE → atla
  //   - context.stage CONFIRMING DEĞİL → atla
  //   - BUG B PROMOTE yukarıda fsmIntent change_info'ya çevirebilir; Katman 2
  //     yine ÇALIŞIR (yolun garantisizliğini tamamlar) — state-machine'i bypass
  //     edip değişiklik+özet+onay deterministik verir. Çift işlem YOK çünkü
  //     RETURN ile state-machine atlanır.
  const _l2ConfirmIntents = new Set(["confirm_reservation", "confirm"]);
  const _l2HasConfirmSignal =
    _l2ConfirmIntents.has(nluResult.intent as string) ||
    detectConfirmation(message, context.language);
  const _l2Ext = extractedInfo as any;
  const _l2Cur = (context.reservationInfo || {}) as any;
  const _l2DiffFN = !!_l2Ext.fullName && !!_l2Cur.fullName && _l2Cur.fullName !== _l2Ext.fullName;
  const _l2DiffPh = !!_l2Ext.phone && !!_l2Cur.phone && _l2Cur.phone !== _l2Ext.phone;
  const _l2DiffPx = typeof _l2Ext.paxAdult === "number" && typeof _l2Cur.paxAdult === "number" && _l2Cur.paxAdult !== _l2Ext.paxAdult;
  const _l2DiffDid = !!_l2Ext.dateId && !!_l2Cur.dateId && _l2Cur.dateId !== _l2Ext.dateId;
  const _l2DiffSd = !!_l2Ext.selectedDate && !!_l2Cur.selectedDate && _l2Cur.selectedDate !== _l2Ext.selectedDate;
  const _l2HasNewValue = _l2DiffFN || _l2DiffPh || _l2DiffPx || _l2DiffDid || _l2DiffSd;

  // DAL 2 için "değişiklik sinyali": mesajda alan adı (sıkı kelime sınırı) veya
  // değiştirme fiili (sade emir kalıbı, çekim eki olmadan).
  const _l2FieldPattern = /(?<![\p{L}\p{N}])(isim|ismi|adı|adın|adım|soyad|surname|name|nom|nombre|имя|اسم|telefon|numara|phone|tel|gsm|téléphone|teléfono|телефон|هاتف|tarih|date|gün|day|datum|jour|día|дата|تاريخ|ki[şs]i|pax|person|people|kinder|personen|personnes|personas|человек)(?![\p{L}\p{N}])/iu;
  // "yap/olsun/ayarla" sıkı kelime — çekim eki ("yapalım") match etmez
  // "değiştir/düzelt/güncelle" çekim eki serbest (F4 ile aynı strateji)
  const _l2VerbPattern = /(?<![\p{L}\p{N}])(yap|olsun|ayarla|kur|set|make|adjust|aceptar)(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])(değiştir|düzelt|güncelle|değişiklik|change|modify|edit|update|correct|fix|ändern|korrigieren|modifier|corriger|cambiar|modificar|изменить|исправить|تعديل|تغيير|اجعل)/iu;
  const _l2HasChangeSignal = _l2FieldPattern.test(message) || _l2VerbPattern.test(message);

  // ── DAL 1 — somut yeni değer var → değişiklik UYGULA + özet+onay ──
  if (
    context.stage === "CONFIRMING" &&
    _l2HasConfirmSignal &&
    _l2HasNewValue
  ) {
    const _l2Updated = { ..._l2Cur };
    if (_l2DiffFN) _l2Updated.fullName = _l2Ext.fullName;
    if (_l2DiffPh) _l2Updated.phone = _l2Ext.phone;
    if (_l2DiffPx) {
      _l2Updated.paxAdult = _l2Ext.paxAdult;
      if (typeof _l2Ext.paxChild === "number") _l2Updated.paxChild = _l2Ext.paxChild;
    }
    if (_l2DiffDid) _l2Updated.dateId = _l2Ext.dateId;
    if (_l2DiffSd) _l2Updated.selectedDate = _l2Ext.selectedDate;

    const _l2Context: ConversationContext = {
      ...context,
      reservationInfo: _l2Updated,
      collectionStep: "ready_for_confirmation" as any,
      lastUserMessage: message,
      messageCount: context.messageCount + 1,
      lastUpdated: new Date().toISOString(),
    };

    // Özet+onay (FIX 3 / :13-PERSIST ile aynı format — DRY ileride helper'a)
    const _lang = _l2Context.language || "tr";
    const _tourTitle = _l2Context.currentTour
      ? getLocalizedTourTitle(_l2Context.currentTour.title || "", _lang)
      : "";
    const _dateText = _l2Updated.selectedDate ? formatDateForLanguage(_l2Updated.selectedDate, _lang) : "";
    const _paxAdult = _l2Updated.paxAdult ?? "";
    const _paxChild = _l2Updated.paxChild;
    const _name = _l2Updated.fullName || "";
    const _phone = _l2Updated.phone || "";

    const _l2Labels: Record<string, { tour: string; date: string; pax: string; adult: string; child: string; name: string; phone: string; reask: string }> = {
      tr: { tour: "Tur",     date: "Tarih",   pax: "Kişi sayısı", adult: "yetişkin",    child: "çocuk",   name: "Ad-Soyad", phone: "Telefon",   reask: "Bilgileri güncelledim. Onaylıyor musunuz? ✅" },
      en: { tour: "Tour",    date: "Date",    pax: "People",      adult: "adult",       child: "child",   name: "Name",     phone: "Phone",     reask: "I've updated the details. Do you confirm? ✅" },
      de: { tour: "Tour",    date: "Datum",   pax: "Personen",    adult: "Erwachsener", child: "Kind",    name: "Name",     phone: "Telefon",   reask: "Ich habe die Angaben aktualisiert. Bestätigen Sie? ✅" },
      ru: { tour: "Тур",     date: "Дата",    pax: "Человек",     adult: "взрослый",    child: "ребёнок", name: "Имя",      phone: "Телефон",   reask: "Я обновил данные. Подтверждаете? ✅" },
      ar: { tour: "الجولة", date: "التاريخ", pax: "عدد الأشخاص", adult: "بالغ",        child: "طفل",     name: "الاسم",    phone: "الهاتف",    reask: "تم تحديث البيانات. هل تؤكد؟ ✅" },
      fr: { tour: "Circuit", date: "Date",    pax: "Personnes",   adult: "adulte",      child: "enfant",  name: "Nom",      phone: "Téléphone", reask: "J'ai mis à jour les informations. Confirmez-vous ? ✅" },
      es: { tour: "Tour",    date: "Fecha",   pax: "Personas",    adult: "adulto",      child: "niño",    name: "Nombre",   phone: "Teléfono",  reask: "He actualizado los datos. ¿Confirma? ✅" },
    };
    const L = _l2Labels[_lang] || _l2Labels.tr;
    const _paxText = _paxAdult !== ""
      ? (typeof _paxChild === "number" && _paxChild > 0
          ? `${_paxAdult} ${L.adult}, ${_paxChild} ${L.child}`
          : `${_paxAdult}`)
      : "";
    const _summaryLines = [
      _tourTitle ? `📋 ${L.tour}: *${_tourTitle}*` : "",
      _dateText  ? `📅 ${L.date}: ${_dateText}`    : "",
      _paxText   ? `👥 ${L.pax}: ${_paxText}`      : "",
      _name      ? `👤 ${L.name}: ${_name}`        : "",
      _phone     ? `📱 ${L.phone}: ${_phone}`      : "",
    ].filter(Boolean).join("\n");
    const _l2Reply = `${_summaryLines}\n\n${L.reask}`;

    const _diffs = [_l2DiffFN && "name", _l2DiffPh && "phone", _l2DiffPx && "pax", _l2DiffDid && "date", _l2DiffSd && "selectedDate"].filter(Boolean).join(",");
    console.log(`[process-message] F4 Katman 2 DAL 1: çelişki yakalandı (diffs=${_diffs}) — değişiklik uygula + özet+onay`);
    await _save(_l2Reply, _l2Context);
    await adapter.sendResponse(_l2Reply);
    return { success: true, response: _l2Reply, newContext: _l2Context };
  }

  // ── DAL 2 — sinyal var ama somut değer yok → netleştirme ──
  if (
    context.stage === "CONFIRMING" &&
    _l2HasConfirmSignal &&
    !_l2HasNewValue &&
    _l2HasChangeSignal
  ) {
    const _l2DisambigMsgs: Record<string, string> = {
      tr: "Değiştirmek istediğiniz bir bilgi mi var, yoksa rezervasyonu onaylıyor musunuz? Lütfen değişikliği belirtin veya 'onaylıyorum' yazın.",
      en: "Do you want to change something, or do you confirm the reservation? Please specify the change or write 'confirm'.",
      de: "Möchten Sie etwas ändern oder bestätigen Sie die Reservierung? Bitte geben Sie die Änderung an oder schreiben Sie 'bestätigen'.",
      fr: "Voulez-vous changer quelque chose ou confirmez-vous la réservation ? Veuillez préciser le changement ou écrire 'confirmer'.",
      es: "¿Quiere cambiar algo o confirma la reserva? Por favor, especifique el cambio o escriba 'confirmo'.",
      ru: "Хотите что-то изменить или подтверждаете бронирование? Уточните изменение или напишите 'подтверждаю'.",
      ar: "هل تريد تغيير شيء أم تؤكد الحجز؟ يرجى تحديد التغيير أو كتابة 'تأكيد'.",
    };
    const _l2DisambigReply = _l2DisambigMsgs[context.language] || _l2DisambigMsgs.tr;
    console.log(`[process-message] F4 Katman 2 DAL 2: belirsiz (onay+sinyal ama değer yok) — netleştirme`);
    await _save(_l2DisambigReply, context);
    await adapter.sendResponse(_l2DisambigReply);
    return { success: true, response: _l2DisambigReply, newContext: context };
  }

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
    await _save(negReply, context);
    await adapter.sendResponse(negReply);
    return { success: true, response: negReply, newContext: context };
  }

  // === PAX AŞIM (>9) — 2026-06-26 R6: deterministik acente yönlendirme ===
  // NLU/extractor pax >9 değerini sessizce reddediyor (isValidPax FALSE → set yok).
  // AMA kullanıcıya neden reddedildiği gösterilmeli: ham NLU pax değerine bak,
  // >9 ise grup rezervasyonu için acente yönlendirme mesajı 7 dil deterministik.
  // NOT: Aşım mesajı sadece NLU pax yakaladığında tetiklenir. simple-extractor
  // path'inden gelen büyük sayı bu mesajı görmeyebilir AMA isValidPax merge (state-
  // machine.ts:137) yine de rezervasyonu durdurur (CONFIRMING'e geçmez) — yanlış
  // rezervasyon oluşmaz, en kötü sessizce reddedilir.
  if (context.collectionStep === "waiting_for_pax") {
    const _rawPax = (nluResult.entities as { people_count?: { adults?: number } })?.people_count?.adults;
    if (typeof _rawPax === "number" && _rawPax > MAX_PAX_PER_RESERVATION) {
      const _agPhone = agency.phone_public ? ` 📞 ${agency.phone_public}` : "";
      const _excessMsgs: Record<string, string> = {
        tr: `${MAX_PAX_PER_RESERVATION} kişiden fazla grup rezervasyonu için lütfen acentemizle iletişime geçin.${_agPhone}`,
        en: `For group reservations of more than ${MAX_PAX_PER_RESERVATION} people, please contact our agency.${_agPhone}`,
        de: `Für Gruppenreservierungen mit mehr als ${MAX_PAX_PER_RESERVATION} Personen kontaktieren Sie bitte unsere Agentur.${_agPhone}`,
        fr: `Pour les réservations de groupe de plus de ${MAX_PAX_PER_RESERVATION} personnes, veuillez contacter notre agence.${_agPhone}`,
        es: `Para reservas grupales de más de ${MAX_PAX_PER_RESERVATION} personas, contacte con nuestra agencia.${_agPhone}`,
        ru: `Для групповых бронирований более ${MAX_PAX_PER_RESERVATION} человек, пожалуйста, свяжитесь с нашим агентством.${_agPhone}`,
        ar: `للحجوزات الجماعية لأكثر من ${MAX_PAX_PER_RESERVATION} أشخاص، يرجى التواصل مع وكالتنا.${_agPhone}`,
      };
      const _excessReply = _excessMsgs[context.language] || _excessMsgs.tr;
      console.log(`[process-message] PAX AŞIM: ${_rawPax} > ${MAX_PAX_PER_RESERVATION} → acente yönlendirme`);
      await _save(_excessReply, context);
      await adapter.sendResponse(_excessReply);
      return { success: true, response: _excessReply, newContext: context };
    }
  }

  // === MAX PAX KONTROLÜ (BUG 2) — 50+ kişi grubu için ofisle iletişim ===
  const _extractedPax = extractedInfo.paxAdult ?? extractedInfo.pax;
  if (_extractedPax && _extractedPax > 50) {
    const _agPhone = agency.phone_public ? ` 📞 ${agency.phone_public}` : "";
    const _maxPaxMsgs: Record<string, string> = {
      tr: `${_extractedPax} kişilik grup için lütfen ofisimizle iletişime geçin.${_agPhone}\n\nBireysel online rezervasyonlar için kaç kişi istiyorsunuz? (maksimum 50)`,
      en: `For a group of ${_extractedPax}, please contact our office for a special offer.${_agPhone}\n\nFor online booking, how many people? (max 50)`,
      de: `Für ${_extractedPax} Personen kontaktieren Sie uns bitte für ein Gruppenangebot.${_agPhone}\n\nFür Online-Buchung: Wie viele Personen? (max. 50)`,
      ru: `Для группы ${_extractedPax} человек свяжитесь с нами.${_agPhone}\n\nДля онлайн-бронирования: сколько человек? (макс. 50)`,
      ar: `لحجز ${_extractedPax} أشخاص يرجى التواصل مع مكتبنا.${_agPhone}\n\nكم شخص تريد حجز؟ (الحد الأقصى 50)`,
      fr: `Pour ${_extractedPax} personnes, contactez-nous pour une offre de groupe.${_agPhone}\n\nPour réservation en ligne : combien de personnes ? (max. 50)`,
      es: `Para ${_extractedPax} personas, contáctenos para una oferta grupal.${_agPhone}\n\n¿Cuántas personas para reserva online? (máx. 50)`,
    };
    const _maxReply = _maxPaxMsgs[context.language] || _maxPaxMsgs.tr;
    await _save(_maxReply, context);
    await adapter.sendResponse(_maxReply);
    return { success: true, response: _maxReply, newContext: context };
  }

  // === 8b. SORUN H — KONTENJAN ÖNDEN KONTROL (β + pax) ===
  // 2026-06-22: 3 katmanlı önden kontrol (α etiket :11'de, β tarih atama,
  // pax atama). γ RPC AYNEN korunur (race safety 4. kat).
  //
  // Helpers: hasQuotaForPax / getQuotaRemaining (services/quota-check.ts) — TEK
  // doğruluk kaynağı (alt-date filter de aynı helper'ı kullanır artık).
  //
  // remaining_quota tour-cache._refreshQuota tarafından her sorguda taze hazır,
  // ek DB çağrısı YOK.

  // Inline helper: müsait tarih listesi metni (TR + EN şimdi, diğer 5 dil
  // çok-dil eşitleme fazına). β + pax bypass'larda ortak — DRY.
  async function _buildAvailableDatesText(
    tour: any,
    neededPax: number,
    lang: string,
  ): Promise<string> {
    if (!tour?.dates?.length) return "";
    const _eR = await getExchangeRatesOnce().catch(() => ({}));
    const _sD = agency.show_multi_currency !== false;
    const lines = tour.dates
      .filter((d: any) => hasQuotaForPax(d, neededPax))
      .map((d: any, i: number) => {
        const dt = formatDateForLanguage(d.departure_date, lang);
        const pr = d.price_adult
          ? ` - ${formatPriceSync(d.price_adult, tour.currency || "TRY", lang, _eR, _sD, languageCurrencies)}`
          : "";
        const remaining = getQuotaRemaining(d);
        const qLabels: Record<string, string> = {
          tr: ` (${remaining} kişilik yer)`, en: ` (${remaining} spots)`,
          de: ` (${remaining} Plätze)`,      ru: ` (${remaining} мест)`,
          ar: ` (${remaining} مقاعد)`,        fr: ` (${remaining} places)`,
          es: ` (${remaining} plazas)`,
        };
        return `${i + 1}) ${dt}${pr}${qLabels[lang] || qLabels.en}`;
      })
      .join("\n");
    return lines;
  }

  // β KATMANI — tarih dolu reddi (extractedInfo.dateRejectedFull flag set)
  if ((extractedInfo as any)?.dateRejectedFull) {
    const _lang = context.language || "tr";
    const _rej = (extractedInfo as any).dateRejectedFull;
    const _rejDateLabel = formatDateForLanguage(_rej.departureDate, _lang);
    const _curTour = context.currentTour ? findTourById(context.currentTour.id, tours) : null;
    const _altText = _curTour
      ? await _buildAvailableDatesText(_curTour, 1, _lang)
      : "";
    const _hasAlt = _altText.trim().length > 0;

    const _msgs: Record<string, string> = _hasAlt
      ? {
          tr: `Maalesef *${_rejDateLabel}* dolu. 😔\n\nMüsait tarihler:\n${_altText}\n\nHangi tarihi tercih edersiniz?`,
          en: `Sorry, *${_rejDateLabel}* is fully booked. 😔\n\nAvailable dates:\n${_altText}\n\nWhich date do you prefer?`,
          de: `Leider ist *${_rejDateLabel}* ausgebucht. 😔\n\nVerfügbare Termine:\n${_altText}\n\nWelches Datum bevorzugen Sie?`,
          ru: `К сожалению, *${_rejDateLabel}* уже занят. 😔\n\nДоступные даты:\n${_altText}\n\nКакую дату вы предпочитаете?`,
          ar: `للأسف، *${_rejDateLabel}* محجوز بالكامل. 😔\n\nالتواريخ المتاحة:\n${_altText}\n\nما التاريخ الذي تفضله؟`,
          fr: `Désolé, *${_rejDateLabel}* est complet. 😔\n\nDates disponibles:\n${_altText}\n\nQuelle date préférez-vous ?`,
          es: `Lo siento, *${_rejDateLabel}* está completo. 😔\n\nFechas disponibles:\n${_altText}\n\n¿Qué fecha prefieres?`,
        }
      : {
          tr: `Maalesef *${_rejDateLabel}* dolu ve şu anda başka müsait tarih bulunmuyor. 😔\n\nLütfen daha sonra tekrar deneyin veya acentemizle iletişime geçin.`,
          en: `Sorry, *${_rejDateLabel}* is fully booked and no other dates are available right now. 😔\n\nPlease try later or contact our agency.`,
          de: `Leider ist *${_rejDateLabel}* ausgebucht und derzeit keine anderen Termine verfügbar. 😔\n\nBitte versuchen Sie es später oder kontaktieren Sie uns.`,
          ru: `К сожалению, *${_rejDateLabel}* занят и других дат сейчас нет. 😔\n\nПопробуйте позже или свяжитесь с нами.`,
          ar: `للأسف، *${_rejDateLabel}* محجوز ولا توجد تواريخ أخرى متاحة. 😔\n\nيرجى المحاولة لاحقاً أو التواصل معنا.`,
          fr: `*${_rejDateLabel}* est complet et aucune autre date n'est disponible. 😔\n\nVeuillez réessayer plus tard ou nous contacter.`,
          es: `*${_rejDateLabel}* está completo y no hay otras fechas disponibles. 😔\n\nIntente más tarde o contáctenos.`,
        };
    // 2026-06-23 Sorun D: tur değişim prefix (erken-müdahale context'i mutate
    // etti → context.currentTour.id şu an YENİ tur; _originalTourId orijinal).
    const _tcPrefixBeta = buildTourChangePrefix(
      _originalTourId,
      context.currentTour?.id,
      context.currentTour ? getLocalizedTourTitle(context.currentTour.title || "", _lang) : "",
      _lang,
    );
    const _betaReply = _tcPrefixBeta + (_msgs[_lang] || _msgs.tr);
    console.log(`[process-message] H-β tetiklendi (tarih dolu: ${_rej.departureDate}, remaining=${_rej.remaining}, altDates=${_hasAlt}, tourChanged=${!!_tcPrefixBeta})`);
    await _save(_betaReply, context);
    await adapter.sendResponse(_betaReply);
    return { success: true, response: _betaReply, newContext: context };
  }

  // pax KATMANI — pax atama yeterli kontenjan yok
  // Senaryo: tarihte 2 yer, kullanıcı "5 kişi" dedi. Tarih state'te dolu, pax
  // bu turn'de extract edildi → state-machine'den ÖNCE kontrol et.
  const _paxPending = (extractedInfo as any)?.paxAdult;
  const _activeTourFull = context.currentTour ? findTourById(context.currentTour.id, tours) : null;
  const _activeDateId = (extractedInfo as any)?.dateId ?? context.reservationInfo?.dateId;
  const _activeDate = _activeTourFull?.dates?.find((d: any) => d.id === _activeDateId);
  if (_paxPending && _activeDate && !hasQuotaForPax(_activeDate, _paxPending)) {
    const _lang = context.language || "tr";
    const _remaining = getQuotaRemaining(_activeDate);
    const _dateLabel = formatDateForLanguage(_activeDate.departure_date, _lang);
    // pax niyetini koru, dateId silinecek (state'e geri çekilecek waiting_for_date'e)
    // Burada SADECE mesaj atıyoruz — state-machine extractedInfo.dateId'yi state'e yazmadı,
    // dateRejectedFull flag de yok, state.reservationInfo aynen kalır. Bu turn sonrası
    // state.dateId hâlâ eski dolu olan; kullanıcı bir sonraki turn yeni tarih derse OK.
    // Bu fix β'nın doğal devamı, kullanıcı pax niyetini sonraki tarih seçiminde kullanır.
    const _altText = _activeTourFull
      ? await _buildAvailableDatesText(_activeTourFull, _paxPending, _lang)
      : "";
    const _hasAlt = _altText.trim().length > 0;
    const _msgs: Record<string, string> = _hasAlt
      ? {
          tr: `*${_paxPending} kişi* için *${_dateLabel}* tarihinde sadece *${_remaining} yer* var. 😔\n\nMüsait tarihler:\n${_altText}\n\nBaşka tarih seçer misiniz?`,
          en: `Only *${_remaining} seats* available for *${_paxPending} people* on *${_dateLabel}*. 😔\n\nAvailable dates:\n${_altText}\n\nCould you choose another date?`,
          de: `Nur *${_remaining} Plätze* für *${_paxPending} Personen* am *${_dateLabel}*. 😔\n\nVerfügbare Termine:\n${_altText}\n\nKönnten Sie ein anderes Datum wählen?`,
          ru: `Для *${_paxPending} человек* на *${_dateLabel}* осталось всего *${_remaining} мест*. 😔\n\nДоступные даты:\n${_altText}\n\nВыберете другую дату?`,
          ar: `لـ *${_paxPending} أشخاص* في *${_dateLabel}* يوجد فقط *${_remaining} مقاعد*. 😔\n\nالتواريخ المتاحة:\n${_altText}\n\nهل يمكنك اختيار تاريخ آخر؟`,
          fr: `Seulement *${_remaining} places* pour *${_paxPending} personnes* le *${_dateLabel}*. 😔\n\nDates disponibles:\n${_altText}\n\nPouvez-vous choisir une autre date ?`,
          es: `Solo *${_remaining} lugares* para *${_paxPending} personas* el *${_dateLabel}*. 😔\n\nFechas disponibles:\n${_altText}\n\n¿Puede elegir otra fecha?`,
        }
      : {
          tr: `*${_paxPending} kişi* için *${_dateLabel}* tarihinde sadece *${_remaining} yer* var ve uygun başka tarih yok. 😔\n\nDaha az kişi olarak deneyebilir veya acentemize danışabilirsiniz.`,
          en: `Only *${_remaining} seats* for *${_paxPending} people* on *${_dateLabel}* and no alternative dates available. 😔\n\nTry fewer people or contact our agency.`,
          de: `Nur *${_remaining} Plätze* für *${_paxPending} Personen* am *${_dateLabel}* — keine anderen Termine. 😔\n\nVersuchen Sie weniger Personen oder kontaktieren Sie uns.`,
          ru: `Только *${_remaining} мест* для *${_paxPending} человек* на *${_dateLabel}*, других дат нет. 😔\n\nПопробуйте меньше человек или свяжитесь с нами.`,
          ar: `فقط *${_remaining} مقاعد* لـ *${_paxPending} أشخاص* في *${_dateLabel}* ولا توجد تواريخ أخرى. 😔\n\nحاول بعدد أقل أو تواصل معنا.`,
          fr: `Seulement *${_remaining} places* pour *${_paxPending} personnes* le *${_dateLabel}* — pas d'autres dates. 😔\n\nEssayez avec moins de personnes ou contactez-nous.`,
          es: `Solo *${_remaining} lugares* para *${_paxPending} personas* el *${_dateLabel}* — no hay otras fechas. 😔\n\nIntente con menos personas o contáctenos.`,
        };
    // 2026-06-23 Sorun D: tur değişim prefix (β ile aynı kalıp).
    const _tcPrefixPax = buildTourChangePrefix(
      _originalTourId,
      context.currentTour?.id,
      context.currentTour ? getLocalizedTourTitle(context.currentTour.title || "", _lang) : "",
      _lang,
    );
    const _paxRejReply = _tcPrefixPax + (_msgs[_lang] || _msgs.tr);
    console.log(`[process-message] H-pax tetiklendi (date=${_activeDate.departure_date}, remaining=${_remaining}, neededPax=${_paxPending}, tourChanged=${!!_tcPrefixPax})`);
    await _save(_paxRejReply, context);
    await adapter.sendResponse(_paxRejReply);
    return { success: true, response: _paxRejReply, newContext: context };
  }

  // === A1 (LOG-ONLY) — AKIŞ-İÇİ DEĞİŞTİRME TESPİT İSKELETİ (Yaklaşım A) ===
  // 2026-06-27: davranış değiştirmez, sadece [A-DETECT] log basar.
  // A2'de gerçek davranış (RETURN + deterministik mesaj) eklenecek — şimdilik
  // canlı veriden sınıflandırma doğruluğunu / yanlış-pozitif oranını gözlemle.
  //
  // 3 katman koşulu (spec madde 2):
  //   K1 (dolu)   : reservationInfo[field] DOLU mu?
  //   K2 (kelime) : mesajda net değişiklik kelimesi VAR mı? (7 dil pattern)
  //   K3 (farklı) : extractedInfo'dan çıkan yeni değer mevcut değerden FARKLI mı?
  //                 (tarih için dateId karşılaştırması — selectedDate STRING değil)
  //
  // Sınıflar:
  //   NORMAL                 : K1 fail (alan boş, ilk giriş) — A girmez
  //   AÇIK                   : K1+K2+K3 TRUE — değişiklik niyeti net
  //   BELİRSİZ               : K1+K3 TRUE, K2 FALSE, stage=CONFIRMING — teyit istenecek
  //   BELİRSİZ-AKIŞ-ORTASI   : K1+K3 TRUE, K2 FALSE, stage≠CONFIRMING — gözlem için
  {
    // 2026-07-03 X9-change fix: pattern shared/constants/change-detection.ts'e
    // taşındı (DRY) — info-extractor Blok 1 üçüncü kabul yolu da aynı kaynağı kullanır.
    const _hasChangeKeyword = CHANGE_KEYWORDS_RE.test(message);
    const _info = (context.reservationInfo || {}) as any;
    const _ext = extractedInfo as any;

    const _shortVal = (v: unknown): string => {
      if (v === null || v === undefined) return "null";
      const s = String(v);
      // dateId UUID gibi uzun değerleri kısalt
      return s.length > 16 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;
    };

    const _fieldsToCheck: Array<{ field: string; isFilled: boolean; extracted: unknown; current: unknown }> = [
      { field: "pax",   isFilled: !!_info.paxAdult, extracted: _ext.paxAdult, current: _info.paxAdult },
      // K3 tarih için dateId (spec tuzağı: selectedDate string "10 aralık 2026" vs "2026-12-10" farklı görünür)
      { field: "date",  isFilled: !!_info.dateId,    extracted: _ext.dateId,   current: _info.dateId },
      { field: "name",  isFilled: !!_info.fullName,  extracted: _ext.fullName, current: _info.fullName },
      { field: "phone", isFilled: !!_info.phone,     extracted: _ext.phone,    current: _info.phone },
    ];

    for (const fc of _fieldsToCheck) {
      // extractedInfo'da yeni değer YOKSA log gürültüsüne girme
      if (fc.extracted === undefined || fc.extracted === null || fc.extracted === "") continue;

      const _isDifferent = fc.extracted !== fc.current;

      let _class: string;
      if (!fc.isFilled) {
        _class = "NORMAL"; // ilk giriş, A girmez
      } else if (!_isDifferent) {
        continue; // aynı değer, gürültüsüz
      } else if (_hasChangeKeyword) {
        _class = "AÇIK";
      } else if (context.stage === "CONFIRMING") {
        _class = "BELİRSİZ";
      } else {
        _class = "BELİRSİZ-AKIŞ-ORTASI";
      }

      console.log(
        `[A-DETECT] field=${fc.field} | dolu=${fc.isFilled} | kelime=${_hasChangeKeyword} | farklı=${_isDifferent}(${_shortVal(fc.current)}→${_shortVal(fc.extracted)}) | stage=${context.stage} | step=${context.collectionStep} | sınıf=${_class}`,
      );
    }

    // === A2 — paxAdult AÇIK DAL (yalnızca pax; date/name/phone/BELİRSİZ → A3) ===
    // 2026-06-27: pax değişikliği için deterministik bildirim + özet/eksik-soru + RETURN.
    // Diğer alanlar (date/name/phone) ve BELİRSİZ sınıfı A3'te ele alınacak — A2'de
    // sadece pax + AÇIK için davranış. NORMAL/BELİRSİZ/farklı-field → A2 girmez, mevcut akış.
    // Tip normalize: extractedInfo.paxAdult string olabilir, Number(...) ile karşılaştır.
    const _paxFilled = !!_info.paxAdult;
    const _paxExtRaw = _ext.paxAdult;
    const _paxExt =
      typeof _paxExtRaw === "number"
        ? _paxExtRaw
        : _paxExtRaw === undefined || _paxExtRaw === null || _paxExtRaw === ""
          ? null
          : Number(_paxExtRaw);
    const _paxDifferent =
      _paxExt !== null && Number.isFinite(_paxExt) && _paxExt !== _info.paxAdult;

    if (_paxFilled && _hasChangeKeyword && _paxDifferent) {
      // 1. Yeni reservationInfo (paxChild varsa update; yoksa mevcut KORU)
      const _newInfo: any = { ..._info, paxAdult: _paxExt };
      if (_ext.paxChild !== undefined && _ext.paxChild !== null) {
        _newInfo.paxChild = _ext.paxChild;
      }

      // 2. Sonraki step (inline determineCollectionStep mantığı — pax dolu zaten)
      const _hasDate = !!_newInfo.dateId;
      const _hasName = !!_newInfo.fullName;
      const _hasPhone = !!_newInfo.phone;
      const _allFilled = _hasDate && _hasName && _hasPhone;

      const _nextStage = (_allFilled ? "CONFIRMING" : "COLLECTING_INFO") as any;
      const _nextStep = (_allFilled
        ? "ready_for_confirmation"
        : !_hasDate
          ? "waiting_for_date"
          : !_hasName
            ? "waiting_for_name"
            : "waiting_for_phone") as any;

      const _langA2 = context.language || "tr";
      const _oldPax = _info.paxAdult;

      // 3. Bildirim prefix (7 dil)
      const _prefixMsgs: Record<string, string> = {
        tr: `*Kişi sayısını* ${_oldPax} → ${_paxExt} olarak güncelledim. ✨`,
        en: `*Number of people* updated from ${_oldPax} → ${_paxExt}. ✨`,
        de: `*Personenzahl* von ${_oldPax} → ${_paxExt} aktualisiert. ✨`,
        fr: `*Nombre de personnes* mis à jour de ${_oldPax} → ${_paxExt}. ✨`,
        es: `*Número de personas* actualizado de ${_oldPax} → ${_paxExt}. ✨`,
        ru: `*Количество человек* обновлено с ${_oldPax} → ${_paxExt}. ✨`,
        ar: `تم تحديث *عدد الأشخاص* من ${_oldPax} إلى ${_paxExt}. ✨`,
      };
      const _prefix = _prefixMsgs[_langA2] || _prefixMsgs.tr;

      let _replyBody: string;
      if (_allFilled) {
        // Mevcut PHONE→CONFIRMING özet formatı kopyası (yeni template DEĞİL — tutarlılık)
        const _labelsA2: Record<string, { tour: string; date: string; pax: string; adult: string; child: string; name: string; phone: string; confirm: string }> = {
          tr: { tour: "Tur",     date: "Tarih",   pax: "Kişi sayısı", adult: "yetişkin",    child: "çocuk",   name: "Ad-Soyad", phone: "Telefon",   confirm: "Bilgiler doğru mu, onaylıyor musunuz? ✅" },
          en: { tour: "Tour",    date: "Date",    pax: "People",      adult: "adult",       child: "child",   name: "Name",     phone: "Phone",     confirm: "Are these details correct? Do you confirm? ✅" },
          de: { tour: "Tour",    date: "Datum",   pax: "Personen",    adult: "Erwachsener", child: "Kind",   name: "Name",     phone: "Telefon",   confirm: "Sind die Angaben korrekt? Bestätigen Sie? ✅" },
          ru: { tour: "Тур",     date: "Дата",    pax: "Человек",     adult: "взрослый",    child: "ребёнок", name: "Имя",      phone: "Телефон",   confirm: "Данные верны? Подтверждаете? ✅" },
          ar: { tour: "الجولة", date: "التاريخ", pax: "عدد الأشخاص", adult: "بالغ",         child: "طفل",    name: "الاسم",    phone: "الهاتف",    confirm: "هل المعلومات صحيحة؟ هل تؤكد؟ ✅" },
          fr: { tour: "Circuit", date: "Date",    pax: "Personnes",   adult: "adulte",      child: "enfant", name: "Nom",      phone: "Téléphone", confirm: "Les informations sont-elles correctes ? Confirmez-vous ? ✅" },
          es: { tour: "Tour",    date: "Fecha",   pax: "Personas",    adult: "adulto",      child: "niño",   name: "Nombre",   phone: "Teléfono",  confirm: "¿Los datos son correctos? ¿Confirma? ✅" },
        };
        const L = _labelsA2[_langA2] || _labelsA2.tr;
        const _tourTitle = context.currentTour
          ? getLocalizedTourTitle(context.currentTour.title || "", _langA2)
          : "";
        const _dateText = _newInfo.selectedDate ? formatDateForLanguage(_newInfo.selectedDate, _langA2) : "";
        const _paxText = typeof _newInfo.paxChild === "number" && _newInfo.paxChild > 0
          ? `${_paxExt} ${L.adult}, ${_newInfo.paxChild} ${L.child}`
          : `${_paxExt}`;
        const _summary = [
          _tourTitle ? `📋 ${L.tour}: *${_tourTitle}*` : "",
          _dateText  ? `📅 ${L.date}: ${_dateText}`    : "",
          _paxText   ? `👥 ${L.pax}: ${_paxText}`      : "",
          _newInfo.fullName ? `👤 ${L.name}: ${_newInfo.fullName}` : "",
          _newInfo.phone    ? `📱 ${L.phone}: ${_newInfo.phone}`   : "",
        ].filter(Boolean).join("\n");
        _replyBody = `${_summary}\n\n${L.confirm}`;
      } else {
        // Eksik alan sorusu (7 dil × 3 olası step)
        const _stepQuestions: Record<string, Record<string, string>> = {
          waiting_for_phone: {
            tr: "Telefon numaranızı alabilir miyim? 📱",
            en: "Could I have your phone number? 📱",
            de: "Könnte ich Ihre Telefonnummer haben? 📱",
            fr: "Puis-je avoir votre numéro de téléphone ? 📱",
            es: "¿Puedo tener su número de teléfono? 📱",
            ru: "Могу я узнать ваш номер телефона? 📱",
            ar: "هل يمكنني الحصول على رقم هاتفك؟ 📱",
          },
          waiting_for_name: {
            tr: "Ad-Soyadınızı söyler misiniz? 👤",
            en: "Could you tell me your full name? 👤",
            de: "Können Sie mir Ihren vollständigen Namen sagen? 👤",
            fr: "Pouvez-vous me dire votre nom complet ? 👤",
            es: "¿Puede decirme su nombre completo? 👤",
            ru: "Назовите ваше полное имя? 👤",
            ar: "هل يمكنك إخباري باسمك الكامل؟ 👤",
          },
          waiting_for_date: {
            tr: "Hangi tarihi tercih edersiniz? 📅",
            en: "Which date do you prefer? 📅",
            de: "Welches Datum bevorzugen Sie? 📅",
            fr: "Quelle date préférez-vous ? 📅",
            es: "¿Qué fecha prefiere? 📅",
            ru: "Какую дату вы предпочитаете? 📅",
            ar: "أي تاريخ تفضل؟ 📅",
          },
        };
        const _qSet = _stepQuestions[_nextStep] || _stepQuestions.waiting_for_phone;
        _replyBody = _qSet[_langA2] || _qSet.tr;
      }

      const _replyA2 = `${_prefix}\n\n${_replyBody}`;
      const _newCtx: any = { ...context, reservationInfo: _newInfo, stage: _nextStage, collectionStep: _nextStep };

      console.log(`[A] paxAdult açık değişiklik uygulandı: ${_oldPax}→${_paxExt}, stage=${_nextStage}, step=${_nextStep}`);

      await _save(_replyA2, _newCtx);
      await adapter.sendResponse(_replyA2);
      return { success: true, response: _replyA2, newContext: _newCtx };
    }

    // === A3 — date/name/phone AÇIK DAL + BELİRSİZ DAL (CONFIRMING, 4 alan) ===
    // 2026-06-27: A2-pax dışında kalan 3 alan için AÇIK dal + tüm alanlar için BELİRSİZ.
    // Sıra: date AÇIK → name AÇIK → phone AÇIK → BELİRSİZ (sadece CONFIRMING).
    // Çoklu-alan: tek-alan öncelikli (Karar A) — ilk eşleşen alan RETURN, diğeri sonraki tur.
    // phone AÇIK: yeni değer isValidPhone'dan GEÇMELİ (geçersizse değiştirme, soru sor).

    const _langA3 = context.language || "tr";

    // 7 dil özet labelleri (A2 ile aynı format, inline kopya — A4'te helper refactor)
    const _labelsA3: Record<string, { tour: string; date: string; pax: string; adult: string; child: string; name: string; phone: string; confirm: string }> = {
      tr: { tour: "Tur",     date: "Tarih",   pax: "Kişi sayısı", adult: "yetişkin",    child: "çocuk",   name: "Ad-Soyad", phone: "Telefon",   confirm: "Bilgiler doğru mu, onaylıyor musunuz? ✅" },
      en: { tour: "Tour",    date: "Date",    pax: "People",      adult: "adult",       child: "child",   name: "Name",     phone: "Phone",     confirm: "Are these details correct? Do you confirm? ✅" },
      de: { tour: "Tour",    date: "Datum",   pax: "Personen",    adult: "Erwachsener", child: "Kind",   name: "Name",     phone: "Telefon",   confirm: "Sind die Angaben korrekt? Bestätigen Sie? ✅" },
      ru: { tour: "Тур",     date: "Дата",    pax: "Человек",     adult: "взрослый",    child: "ребёнок", name: "Имя",      phone: "Телефон",   confirm: "Данные верны? Подтверждаете? ✅" },
      ar: { tour: "الجولة", date: "التاريخ", pax: "عدد الأشخاص", adult: "بالغ",         child: "طفل",    name: "الاسم",    phone: "الهاتف",    confirm: "هل المعلومات صحيحة؟ هل تؤكد؟ ✅" },
      fr: { tour: "Circuit", date: "Date",    pax: "Personnes",   adult: "adulte",      child: "enfant", name: "Nom",      phone: "Téléphone", confirm: "Les informations sont-elles correctes ? Confirmez-vous ? ✅" },
      es: { tour: "Tour",    date: "Fecha",   pax: "Personas",    adult: "adulto",      child: "niño",   name: "Nombre",   phone: "Teléfono",  confirm: "¿Los datos son correctos? ¿Confirma? ✅" },
    };

    const _stepQuestionsA3: Record<string, Record<string, string>> = {
      waiting_for_phone: {
        tr: "Telefon numaranızı alabilir miyim? 📱",
        en: "Could I have your phone number? 📱",
        de: "Könnte ich Ihre Telefonnummer haben? 📱",
        fr: "Puis-je avoir votre numéro de téléphone ? 📱",
        es: "¿Puedo tener su número de teléfono? 📱",
        ru: "Могу я узнать ваш номер телефона? 📱",
        ar: "هل يمكنني الحصول على رقم هاتفك؟ 📱",
      },
      waiting_for_name: {
        tr: "Ad-Soyadınızı söyler misiniz? 👤",
        en: "Could you tell me your full name? 👤",
        de: "Können Sie mir Ihren vollständigen Namen sagen? 👤",
        fr: "Pouvez-vous me dire votre nom complet ? 👤",
        es: "¿Puede decirme su nombre completo? 👤",
        ru: "Назовите ваше полное имя? 👤",
        ar: "هل يمكنك إخباري باسمك الكامل؟ 👤",
      },
      waiting_for_date: {
        tr: "Hangi tarihi tercih edersiniz? 📅",
        en: "Which date do you prefer? 📅",
        de: "Welches Datum bevorzugen Sie? 📅",
        fr: "Quelle date préférez-vous ? 📅",
        es: "¿Qué fecha prefiere? 📅",
        ru: "Какую дату вы предпочитаете? 📅",
        ar: "أي تاريخ تفضل؟ 📅",
      },
    };

    // Helper: değişikliği uygula → step + body inşa et + reply döndür
    const _buildA3Reply = (prefix: string, newInfo: any): { reply: string; newCtx: any; nextStage: string; nextStep: string } => {
      const _hasDate = !!newInfo.dateId;
      const _hasName = !!newInfo.fullName;
      const _hasPhone = !!newInfo.phone;
      const _hasPax = !!newInfo.paxAdult;
      const _allFilled = _hasDate && _hasPax && _hasName && _hasPhone;

      const _nextStage = _allFilled ? "CONFIRMING" : "COLLECTING_INFO";
      const _nextStep = _allFilled
        ? "ready_for_confirmation"
        : !_hasDate ? "waiting_for_date"
        : !_hasPax ? "waiting_for_pax"
        : !_hasName ? "waiting_for_name"
        : "waiting_for_phone";

      let _body: string;
      if (_allFilled) {
        const L = _labelsA3[_langA3] || _labelsA3.tr;
        const _tourTitle = context.currentTour
          ? getLocalizedTourTitle(context.currentTour.title || "", _langA3)
          : "";
        const _dateText = newInfo.selectedDate ? formatDateForLanguage(newInfo.selectedDate, _langA3) : "";
        const _paxText = typeof newInfo.paxChild === "number" && newInfo.paxChild > 0
          ? `${newInfo.paxAdult} ${L.adult}, ${newInfo.paxChild} ${L.child}`
          : `${newInfo.paxAdult}`;
        const _summary = [
          _tourTitle ? `📋 ${L.tour}: *${_tourTitle}*` : "",
          _dateText  ? `📅 ${L.date}: ${_dateText}`    : "",
          _paxText   ? `👥 ${L.pax}: ${_paxText}`      : "",
          newInfo.fullName ? `👤 ${L.name}: ${newInfo.fullName}` : "",
          newInfo.phone    ? `📱 ${L.phone}: ${newInfo.phone}`   : "",
        ].filter(Boolean).join("\n");
        _body = `${_summary}\n\n${L.confirm}`;
      } else {
        const _qSet = _stepQuestionsA3[_nextStep] || _stepQuestionsA3.waiting_for_phone;
        _body = _qSet[_langA3] || _qSet.tr;
      }

      const _reply = `${prefix}\n\n${_body}`;
      const _newCtx: any = { ...context, reservationInfo: newInfo, stage: _nextStage, collectionStep: _nextStep };
      return { reply: _reply, newCtx: _newCtx, nextStage: _nextStage, nextStep: _nextStep };
    };

    // --- date AÇIK ---
    const _dateFilled = !!_info.dateId;
    const _dateExt = _ext.dateId;
    const _dateDifferent = _dateExt !== undefined && _dateExt !== null && _dateExt !== "" && _dateExt !== _info.dateId;
    if (_dateFilled && _hasChangeKeyword && _dateDifferent) {
      const _newInfo: any = { ..._info, dateId: _dateExt };
      if (_ext.selectedDate) _newInfo.selectedDate = _ext.selectedDate;

      const _oldDateText = _info.selectedDate ? formatDateForLanguage(_info.selectedDate, _langA3) : String(_info.dateId);
      const _newDateText = _ext.selectedDate ? formatDateForLanguage(_ext.selectedDate, _langA3) : String(_dateExt);

      const _prefixMsgs: Record<string, string> = {
        tr: `*Tarihi* ${_oldDateText} → ${_newDateText} olarak güncelledim. ✨`,
        en: `*Date* updated from ${_oldDateText} → ${_newDateText}. ✨`,
        de: `*Datum* von ${_oldDateText} → ${_newDateText} aktualisiert. ✨`,
        fr: `*Date* mise à jour de ${_oldDateText} → ${_newDateText}. ✨`,
        es: `*Fecha* actualizada de ${_oldDateText} → ${_newDateText}. ✨`,
        ru: `*Дата* обновлена с ${_oldDateText} → ${_newDateText}. ✨`,
        ar: `تم تحديث *التاريخ* من ${_oldDateText} إلى ${_newDateText}. ✨`,
      };
      const _prefix = _prefixMsgs[_langA3] || _prefixMsgs.tr;
      const { reply, newCtx, nextStage, nextStep } = _buildA3Reply(_prefix, _newInfo);
      console.log(`[A] dateId açık değişiklik uygulandı: ${_info.dateId}→${_dateExt}, stage=${nextStage}, step=${nextStep}`);
      await _save(reply, newCtx);
      await adapter.sendResponse(reply);
      return { success: true, response: reply, newContext: newCtx };
    }

    // --- name AÇIK ---
    const _normalizeName = (s: unknown): string =>
      typeof s === "string" ? s.trim().toLowerCase().replace(/\s+/g, " ") : "";
    const _nameFilled = !!_info.fullName;
    const _nameExt = _ext.fullName;
    const _nameDifferent =
      typeof _nameExt === "string" &&
      _nameExt.trim() !== "" &&
      _normalizeName(_nameExt) !== _normalizeName(_info.fullName);
    if (_nameFilled && _hasChangeKeyword && _nameDifferent) {
      const _newInfo: any = { ..._info, fullName: _nameExt };
      const _oldName = _info.fullName || "";

      const _prefixMsgs: Record<string, string> = {
        tr: `*Ad-Soyadı* ${_oldName} → ${_nameExt} olarak güncelledim. ✨`,
        en: `*Name* updated from ${_oldName} → ${_nameExt}. ✨`,
        de: `*Name* von ${_oldName} → ${_nameExt} aktualisiert. ✨`,
        fr: `*Nom* mis à jour de ${_oldName} → ${_nameExt}. ✨`,
        es: `*Nombre* actualizado de ${_oldName} → ${_nameExt}. ✨`,
        ru: `*Имя* обновлено с ${_oldName} → ${_nameExt}. ✨`,
        ar: `تم تحديث *الاسم* من ${_oldName} إلى ${_nameExt}. ✨`,
      };
      const _prefix = _prefixMsgs[_langA3] || _prefixMsgs.tr;
      const { reply, newCtx, nextStage, nextStep } = _buildA3Reply(_prefix, _newInfo);
      console.log(`[A] fullName açık değişiklik uygulandı: ${_oldName}→${_nameExt}, stage=${nextStage}, step=${nextStep}`);
      await _save(reply, newCtx);
      await adapter.sendResponse(reply);
      return { success: true, response: reply, newContext: newCtx };
    }

    // --- phone AÇIK (yeni değer isValidPhone'dan GEÇMELİ) ---
    const _normalizePhoneDigits = (s: unknown): string =>
      typeof s === "string" ? s.replace(/[\s\-\(\)\.\+]/g, "") : "";
    const _phoneFilled = !!_info.phone;
    const _phoneExt = _ext.phone;
    const _phoneDifferent =
      typeof _phoneExt === "string" &&
      _phoneExt.trim() !== "" &&
      _normalizePhoneDigits(_phoneExt) !== _normalizePhoneDigits(_info.phone);

    // --- A4-mini: phone REDDET (niyet var, geçerli değer extract edilemedi) ---
    // 2026-06-27: kullanıcı "aslında telefonum abc def olsun" derse, info-extractor
    // normalizePhone null döner → extractedInfo.phone undefined → A3 phone AÇIK dalı
    // hiç girmez (LLM'e düşer, garip cevaplar). Hedef: değişiklik niyetini yakala,
    // nazik "tam telefon" mesajı dön. State KORUNUR.
    // Yanlış-pozitif daraltma: detectConfirmation ile "aslında telefonum doğru"
    // gibi onay ifadelerini eler (REDDET girmez, onay akışı devam eder).
    const _phoneMentionRe = /(?<![\p{L}\p{N}])(telefon|telefonu|telefonum|telefonumu|telefonunu|numara|numaramı|numaranız|numaranızı|cep|gsm|phone|telephone|number|mobile|téléphone|teléfono|телефон|номер|هاتف|رقم)/iu;
    const _phoneExtMissing = _phoneExt === undefined || _phoneExt === null || (typeof _phoneExt === "string" && _phoneExt.trim() === "");
    const _phoneMention = _phoneMentionRe.test(message);
    const _notConfirmation = !detectConfirmation(message, _langA3);
    if (_phoneFilled && _hasChangeKeyword && _phoneMention && _phoneExtMissing && _notConfirmation) {
      const _missingMsgs: Record<string, string> = {
        tr: `Telefon numaranızı tam olarak alabilir miyim? 📱\n\n(örn: 0532 123 45 67 veya +90 532 123 45 67)`,
        en: `Could I get your full phone number? 📱\n\n(e.g. +90 532 123 45 67)`,
        de: `Könnte ich Ihre vollständige Telefonnummer haben? 📱\n\n(z.B. +90 532 123 45 67)`,
        fr: `Pouvez-vous me donner votre numéro de téléphone complet ? 📱\n\n(ex: +90 532 123 45 67)`,
        es: `¿Puede darme su número de teléfono completo? 📱\n\n(ej: +90 532 123 45 67)`,
        ru: `Могу я получить ваш полный номер телефона? 📱\n\n(напр. +90 532 123 45 67)`,
        ar: `هل يمكنني الحصول على رقم هاتفك بالكامل؟ 📱\n\n(مثال: +90 532 123 45 67)`,
      };
      const _missReply = _missingMsgs[_langA3] || _missingMsgs.tr;
      console.log(`[A] phone değişiklik REDDEDİLDİ (niyet var, geçerli değer yok): ${message.slice(0, 60)}`);
      await _save(_missReply, context);
      await adapter.sendResponse(_missReply);
      return { success: true, response: _missReply, newContext: context };
    }

    if (_phoneFilled && _hasChangeKeyword && _phoneDifferent) {
      // Dikkat #2: yeni telefon geçerli mi? Geçersizse değiştirme, soru sor.
      if (!isValidPhone(String(_phoneExt))) {
        const _invalidMsgs: Record<string, string> = {
          tr: `"${_phoneExt}" geçerli bir telefon numarası değil. 📱\n\nLütfen tam numaranızı girin (örn: 0532 123 45 67 veya +90 532 123 45 67)`,
          en: `"${_phoneExt}" is not a valid phone number. 📱\n\nPlease enter your full number (e.g. +90 532 123 45 67)`,
          de: `"${_phoneExt}" ist keine gültige Telefonnummer. 📱\n\nBitte vollständige Nummer eingeben (z.B. +90 532 123 45 67)`,
          ru: `"${_phoneExt}" — неверный номер телефона. 📱\n\nВведите полный номер (напр. +90 532 123 45 67)`,
          ar: `"${_phoneExt}" ليس رقم هاتف صحيح. 📱\n\nيرجى إدخال رقمك الكامل (مثال: +90 532 123 45 67)`,
          fr: `"${_phoneExt}" n'est pas un numéro valide. 📱\n\nVeuillez entrer votre numéro complet (ex: +90 532 123 45 67)`,
          es: `"${_phoneExt}" no es un número válido. 📱\n\nIngrese su número completo (ej: +90 532 123 45 67)`,
        };
        const _invReply = _invalidMsgs[_langA3] || _invalidMsgs.tr;
        console.log(`[A] phone değişiklik REDDEDİLDİ (isValidPhone=false): ${_phoneExt}`);
        await _save(_invReply, context);
        await adapter.sendResponse(_invReply);
        return { success: true, response: _invReply, newContext: context };
      }

      const _newInfo: any = { ..._info, phone: _phoneExt };
      const _oldPhone = _info.phone || "";

      const _prefixMsgs: Record<string, string> = {
        tr: `*Telefonu* ${_oldPhone} → ${_phoneExt} olarak güncelledim. ✨`,
        en: `*Phone* updated from ${_oldPhone} → ${_phoneExt}. ✨`,
        de: `*Telefon* von ${_oldPhone} → ${_phoneExt} aktualisiert. ✨`,
        fr: `*Téléphone* mis à jour de ${_oldPhone} → ${_phoneExt}. ✨`,
        es: `*Teléfono* actualizado de ${_oldPhone} → ${_phoneExt}. ✨`,
        ru: `*Телефон* обновлён с ${_oldPhone} → ${_phoneExt}. ✨`,
        ar: `تم تحديث *الهاتف* من ${_oldPhone} إلى ${_phoneExt}. ✨`,
      };
      const _prefix = _prefixMsgs[_langA3] || _prefixMsgs.tr;
      const { reply, newCtx, nextStage, nextStep } = _buildA3Reply(_prefix, _newInfo);
      console.log(`[A] phone açık değişiklik uygulandı: ${_oldPhone}→${_phoneExt}, stage=${nextStage}, step=${nextStep}`);
      await _save(reply, newCtx);
      await adapter.sendResponse(reply);
      return { success: true, response: reply, newContext: newCtx };
    }

    // --- PROMOSYON: phone kuru geçerli telefon → A3 phone AÇIK davranışı (kelime ŞART DEĞİL) ---
    // 2026-06-27: CONFIRMING'de geçerli kuru "05559876543" → BELİRSİZ'e düşmek temkinli ve UX
    // bozuyor. Telefon kazara yazılamaz (10-15 hane digit dizisi); geçerli + farklı + onay-değil
    // → kasıtlı değişiklik. Direkt güncelle, BELİRSİZ teyit sorma.
    // Sıra (KRİTİK):
    //   A3 phone AÇIK (kelime + değer) → A4-mini REDDET (kelime + değer yok) → PROMOSYON → BELİRSİZ
    // _notConfirmation: "evet onaylıyorum" gibi net onayda PROMOSYON girmesin (onay akışı aksın).
    if (
      _phoneFilled &&
      context.stage === "CONFIRMING" &&
      _phoneDifferent &&
      typeof _phoneExt === "string" &&
      isValidPhone(_phoneExt) &&
      _notConfirmation
    ) {
      const _newInfo: any = { ..._info, phone: _phoneExt };
      const _oldPhone = _info.phone || "";

      const _prefixMsgs: Record<string, string> = {
        tr: `*Telefonu* ${_oldPhone} → ${_phoneExt} olarak güncelledim. ✨`,
        en: `*Phone* updated from ${_oldPhone} → ${_phoneExt}. ✨`,
        de: `*Telefon* von ${_oldPhone} → ${_phoneExt} aktualisiert. ✨`,
        fr: `*Téléphone* mis à jour de ${_oldPhone} → ${_phoneExt}. ✨`,
        es: `*Teléfono* actualizado de ${_oldPhone} → ${_phoneExt}. ✨`,
        ru: `*Телефон* обновлён с ${_oldPhone} → ${_phoneExt}. ✨`,
        ar: `تم تحديث *الهاتف* من ${_oldPhone} إلى ${_phoneExt}. ✨`,
      };
      const _prefix = _prefixMsgs[_langA3] || _prefixMsgs.tr;
      const { reply, newCtx, nextStage, nextStep } = _buildA3Reply(_prefix, _newInfo);
      console.log(`[A] phone PROMOSYON (kuru geçerli telefon, kelime yok) uygulandı: ${_oldPhone}→${_phoneExt}, stage=${nextStage}, step=${nextStep}`);
      await _save(reply, newCtx);
      await adapter.sendResponse(reply);
      return { success: true, response: reply, newContext: newCtx };
    }

    // --- BELİRSİZ DAL (sadece CONFIRMING, 4 alanın HERHANGİ biri için) ---
    // Koşul: HERHANGİ alan dolu + farklı + kelime YOK + stage=CONFIRMING
    // Davranış: değer UYGULAMA, değer TAHMİN ETME. Tek-net teyit sorusu.
    if (context.stage === "CONFIRMING" && !_hasChangeKeyword) {
      const _belirsizField =
        (_paxFilled && _paxDifferent) ? "pax"
        : (_dateFilled && _dateDifferent) ? "date"
        : (_nameFilled && _nameDifferent) ? "name"
        : (_phoneFilled && _phoneDifferent) ? "phone"
        : null;

      if (_belirsizField) {
        const _belirsizMsgs: Record<string, string> = {
          tr: "Tam anlayamadım — rezervasyonunuzu onaylıyor musunuz, yoksa değiştirmek istediğiniz bir şey mi var? 🤔",
          en: "I didn't quite understand — would you like to confirm your reservation, or is there something you'd like to change? 🤔",
          de: "Ich habe das nicht ganz verstanden — möchten Sie Ihre Reservierung bestätigen oder etwas ändern? 🤔",
          fr: "Je n'ai pas bien compris — souhaitez-vous confirmer votre réservation ou y a-t-il quelque chose à modifier ? 🤔",
          es: "No entendí bien — ¿desea confirmar su reserva o hay algo que quiera cambiar? 🤔",
          ru: "Я не совсем понял — хотите подтвердить бронирование или что-то изменить? 🤔",
          ar: "لم أفهم تماماً — هل تريد تأكيد حجزك أم هناك شيء تريد تغييره؟ 🤔",
        };
        const _belReply = _belirsizMsgs[_langA3] || _belirsizMsgs.tr;
        console.log(`[A] BELİRSİZ teyit soruldu: field=${_belirsizField}, stage=CONFIRMING`);
        await _save(_belReply, context);
        await adapter.sendResponse(_belReply);
        return { success: true, response: _belReply, newContext: context };
      }
    }

    // A2/A3: hiçbir dal tetiklenmedi → RETURN yok, mevcut akışa devam.
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

  // FIX: Geçersiz tarih cleanup — dateId yoksa selectedDate her zaman invalid (BUG 1)
  // extractedInfo da kontrol edilir: TOUR_SELECTED'da FSM geçmeden gelen tarih de yakalanır
  const _invalidDateForPreamble =
    (newContext.reservationInfo?.selectedDate && !newContext.reservationInfo?.dateId)
      ? newContext.reservationInfo.selectedDate
      : (extractedInfo.selectedDate && !extractedInfo.dateId && newContext.currentTour)
        ? extractedInfo.selectedDate
        : undefined;
  if (_invalidDateForPreamble) {
    newContext.reservationInfo = { ...newContext.reservationInfo, selectedDate: undefined };
    // stage waiting_for_date'e çek ki date list deterministik olarak gösterilsin
    if (newContext.stage === "TOUR_SELECTED" || newContext.stage === "COLLECTING_INFO") {
      newContext.stage = "COLLECTING_INFO" as any;
      newContext.collectionStep = "waiting_for_date" as any;
    }
    console.log("[process-message] Invalid date cleaned up:", _invalidDateForPreamble);
  }

  // === 9b. GEÇERSİZ TELEFON KONTROLÜ (BUG 4 + 2026-06-26 R6) ===
  // waiting_for_phone'dayken kullanıcı geçersiz girdi yazdıysa erken dön.
  // R6: eski "sadece rakam + <10 hane" koşulu "abc def" / "telefonum yok" / boş
  // mesajları YAKALAMAYIP CONFIRMING özetine kaçırıyordu (canlı bug). Yeni:
  // isValidPhone tek-helper → format-bağımsız tüm geçersiz girdiler yakalanır.
  if (
    newContext.collectionStep === "waiting_for_phone" &&
    context.collectionStep === "waiting_for_phone" &&
    !extractedInfo.phone &&
    !isValidPhone(message.trim()) &&
    // 2026-06-29 D1 FIX: FAQ intent muafiyeti (canlı bug: waiting_for_phone'da
    // "iptal şartları?" → telefon çıkmaz + isValidPhone FALSE → R6 tetiklenir →
    // kullanıcı FAQ cevabı yerine "geçerli telefon değil" görüyordu. İsim/pax
    // adımlarında böyle guard yok, sadece telefon korumalı). FAQ → R6 skip,
    // LLM cevap üretir, KÖK 6 (L3393+) waiting_for_phone suffix'i alta ekler
    // (FAQ commit ebf0f17 doğal tamamlayıcısı). Geçersiz telefon ("abc def" =
    // intent general, FAQ DEĞİL) HÂLÂ guard'a takılır, asıl işi korunur.
    //
    // TODO (genişletme turu): bu FAQ intent listesi 3 yerde tekrar ediyor
    //   - burada (R6)
    //   - _isInfoQuestionFsmIntent (L1978)
    //   - _isInfoQuestionForFlowReturn (L3393)
    // Helper'a çıkarma ve SENKRON intent listesi tutma — post-launch refactor.
    fsmIntent !== "general_question" &&
    fsmIntent !== "support_request"
  ) {
    const _phInvalidMsgs: Record<string, string> = {
      tr: `"${message.trim()}" geçerli bir telefon numarası değil. 📱\n\nLütfen tam numaranızı girin (örn: 0532 123 45 67 veya +90 532 123 45 67)`,
      en: `"${message.trim()}" is not a valid phone number. 📱\n\nPlease enter your full number (e.g. +90 532 123 45 67)`,
      de: `"${message.trim()}" ist keine gültige Telefonnummer. 📱\n\nBitte vollständige Nummer eingeben (z.B. +90 532 123 45 67)`,
      ru: `"${message.trim()}" — неверный номер телефона. 📱\n\nВведите полный номер (напр. +90 532 123 45 67)`,
      ar: `"${message.trim()}" ليس رقم هاتف صحيح. 📱\n\nيرجى إدخال رقمك الكامل (مثال: +90 532 123 45 67)`,
      fr: `"${message.trim()}" n'est pas un numéro valide. 📱\n\nVeuillez entrer votre numéro complet (ex: +90 532 123 45 67)`,
      es: `"${message.trim()}" no es un número válido. 📱\n\nIngrese su número completo (ej: +90 532 123 45 67)`,
    };
    const _phReply = _phInvalidMsgs[newContext.language] || _phInvalidMsgs.tr;
    await _save(_phReply, newContext);
    await adapter.sendResponse(_phReply);
    return { success: true, response: _phReply, newContext };
  }

  // === FIX O6: Aktif tur yoksa deterministik mesaj — AI uydurmasın ===
  // COMPLETED stage hariç: after-sales mesajları tur listesine ihtiyaç duymaz.
  if (tours.length === 0 && newContext.stage !== "COMPLETED") {
    const _agPhone = agency.phone_public ? ` 📞 ${agency.phone_public}` : "";
    const _noTourMsgs: Record<string, string> = {
      tr: `Şu anda aktif turumuzu bulamıyoruz. Yeni tarihler ve bilgi için lütfen acentemizle iletişime geçin.${_agPhone}`,
      en: `We currently don't have any available tours. Please contact our agency for new dates and information.${_agPhone}`,
      de: `Wir haben derzeit keine verfügbaren Touren. Für neue Termine und Informationen wenden Sie sich bitte an unsere Agentur.${_agPhone}`,
      ru: `В настоящее время у нас нет доступных туров. Пожалуйста, свяжитесь с нашим агентством для получения информации.${_agPhone}`,
      ar: `لا تتوفر لدينا جولات متاحة حالياً. يرجى التواصل مع وكالتنا للحصول على معلومات.${_agPhone}`,
      fr: `Nous n'avons actuellement aucun circuit disponible. Contactez notre agence pour de nouvelles dates et informations.${_agPhone}`,
      es: `Actualmente no tenemos tours disponibles. Por favor contacte nuestra agencia para fechas y más información.${_agPhone}`,
    };
    const _noTourReply = _noTourMsgs[newContext.language] || _noTourMsgs.tr;
    console.warn("[process-message] O6: No available tours — returning deterministic message");
    await _save(_noTourReply, newContext);
    await adapter.sendResponse(_noTourReply);
    return { success: true, response: _noTourReply, newContext };
  }

  // === X8 + B1 + B-TEMA: 2026-06-26 R4 — ERKEN KATMANA TAŞINDI ===
  // (bkz. yukarıda fsmIntent map sonrası "NİTELİK ÖN-TESPİT KATMANI")

  // === B2: Akış ortası tur listesi (deterministik) ===
  // Müşteri COLLECTING_INFO/CONFIRMING'de genel "başka tur var mı?" sorusu sordu.
  // Belirli bir tur eşleşmedi; mevcut akış state'i korunarak tur listesi gösteriliyor.
  if (
    _prePromotionIntent === "tour_search" &&
    (context.stage === "COLLECTING_INFO" || context.stage === "CONFIRMING") &&
    newContext.stage === context.stage &&
    !selectedTour &&
    tours.length > 0
  ) {
    const _exRatesB2 = await getExchangeRatesOnce().catch(() => ({}));
    const _showDualB2 = agency.show_multi_currency !== false;
    const _tourListLines = tours.slice(0, 8).map((t: any, i: number) => {
      const _firstDate = t.dates?.[0];
      const _priceText = _firstDate?.price_adult
        ? ` — ${formatPriceSync(_firstDate.price_adult, t.currency || "TRY", newContext.language, _exRatesB2, _showDualB2, languageCurrencies)}`
        : "";
      return `${i + 1}) ${getLocalizedTourTitle(t.title, newContext.language)}${_priceText}`;
    }).join("\n");

    const _switchNotes: Record<string, string> = {
      tr: `Mevcut turumuz: *${getLocalizedTourTitle(newContext.currentTour?.title || "", newContext.language)}*. Değiştirmek için tur adını yazın — tarih ve kişi bilgileriniz korunur.`,
      en: `Current tour: *${getLocalizedTourTitle(newContext.currentTour?.title || "", newContext.language)}*. To switch, type the tour name — your date and pax info is preserved.`,
      de: `Aktuelle Tour: *${getLocalizedTourTitle(newContext.currentTour?.title || "", newContext.language)}*. Zum Wechseln Tourname eingeben — Datum und Personenzahl bleiben erhalten.`,
      ru: `Текущий тур: *${getLocalizedTourTitle(newContext.currentTour?.title || "", newContext.language)}*. Чтобы переключить, напишите название тура — дата и кол-во человек сохранятся.`,
      ar: `الجولة الحالية: *${getLocalizedTourTitle(newContext.currentTour?.title || "", newContext.language)}*. للتبديل، اكتب اسم الجولة — بياناتك محفوظة.`,
      fr: `Circuit actuel : *${getLocalizedTourTitle(newContext.currentTour?.title || "", newContext.language)}*. Pour changer, tapez le nom — vos date et participants sont conservés.`,
      es: `Tour actual: *${getLocalizedTourTitle(newContext.currentTour?.title || "", newContext.language)}*. Para cambiar, escribe el nombre del tour — tu fecha y personas se conservan.`,
    };
    const _listHeaders: Record<string, string> = {
      tr: "Müsait turlarımız:",
      en: "Our available tours:",
      de: "Unsere verfügbaren Touren:",
      ru: "Доступные туры:",
      ar: "جولاتنا المتاحة:",
      fr: "Nos circuits disponibles :",
      es: "Nuestros tours disponibles:",
    };
    const _b2Reply =
      `${_listHeaders[newContext.language] || _listHeaders.tr}\n${_tourListLines}\n\n` +
      (_switchNotes[newContext.language] || _switchNotes.en);
    await _save(_b2Reply, newContext);
    await adapter.sendResponse(_b2Reply);
    return { success: true, response: _b2Reply, newContext };
  }

  // === 10. İPTAL MESAJI (deterministik) ===
  if (newContext.justCancelled) {
    newContext.justCancelled = false;
    const cancelReply = getCancellationMessage(newContext.language);
    await _save(cancelReply, newContext);
    await adapter.sendResponse(cancelReply);
    return { success: true, response: cancelReply, newContext };
  }

  // === 10b. UNKNOWN_TOUR (deterministik B dalı) — 2026-06-20 Bug 2 kök çözümü ===
  // Kullanıcı bir tur arıyor (intent tour_search/reservation_intent + anlamlı kelime)
  // AMA findMatchingTours hiçbir tur'la eşleyemedi → DB'de yok. LLM'e bırakmak yerine
  // deterministik "X turu sistemimizde yok, müsait turlarımız: ..." mesajı.
  //
  // 2026-06-21 SORUN A FIX: shouldFireUnknownTour helper'ı kullanılıyor. State'te
  // tur seçiliyse (context.currentTour dolu) UNKNOWN_TOUR ATILMAZ — kullanıcı
  // mevcut rezervasyon akışında "rezervasyon yapmak istiyorum" gibi mesaj yazarsa
  // "yapmak turu yok" absürdü çıkmaz. KABUL EDİLEN SINIR: kullanıcı GERÇEKTEN yeni
  // tur arıyorsa ama NLU yakalayamadıysa, LLM cevaplar (yanlış-negatif kabul).
  if (shouldFireUnknownTour(context as any, selectedTour, multipleTourMatches.length, unknownTourQuery, tours.length)) {
    const _exRatesU = await getExchangeRatesOnce().catch(() => ({}));
    const _showDualU = agency.show_multi_currency !== false;
    const _tourListLinesU = tours.slice(0, 8).map((t: any, i: number) => {
      const _firstDate = t.dates?.[0];
      const _priceText = _firstDate?.price_adult
        ? ` — ${formatPriceSync(_firstDate.price_adult, t.currency || "TRY", context.language, _exRatesU, _showDualU, languageCurrencies)}`
        : "";
      return `${i + 1}) ${getLocalizedTourTitle(t.title, context.language)}${_priceText}`;
    }).join("\n");

    // 2026-06-26 B4 fix: "${query} turu" suffix çift-tur ekiyle absürd okunuyordu
    // ("kayak turu turu sistemimizde yok"). Suffix kaldırıldı — "kayak turu sistemimizde
    // bulunmuyor" + "kayak sistemimizde bulunmuyor" her ikisi de doğal okunur.
    const _unknownMsgs: Record<string, string> = {
      tr: `"${unknownTourQuery}" sistemimizde bulunmuyor. 😔\n\nMüsait turlarımız:\n${_tourListLinesU}\n\nHangisi ilginizi çeker?`,
      en: `"${unknownTourQuery}" is not in our system. 😔\n\nAvailable tours:\n${_tourListLinesU}\n\nWhich interests you?`,
      de: `"${unknownTourQuery}" ist nicht in unserem System. 😔\n\nVerfügbare Touren:\n${_tourListLinesU}\n\nWelche interessiert Sie?`,
      ru: `"${unknownTourQuery}" нет в нашей системе. 😔\n\nДоступные туры:\n${_tourListLinesU}\n\nКакой вас интересует?`,
      ar: `"${unknownTourQuery}" غير موجود في نظامنا. 😔\n\nالجولات المتاحة:\n${_tourListLinesU}\n\nما الذي يثير اهتمامك؟`,
      fr: `"${unknownTourQuery}" n'est pas dans notre système. 😔\n\nCircuits disponibles :\n${_tourListLinesU}\n\nLequel vous intéresse ?`,
      es: `"${unknownTourQuery}" no está en nuestro sistema. 😔\n\nTours disponibles:\n${_tourListLinesU}\n\n¿Cuál le interesa?`,
    };
    const _unknownReply = _unknownMsgs[context.language] || _unknownMsgs.tr;
    await _save(_unknownReply, context);
    await adapter.sendResponse(_unknownReply);
    return { success: true, response: _unknownReply, newContext: context };
  }

  // === 10c. VİZE DETERMİNİSTİK CEVAP (DATA-GAP FIX 3, 2026-07-03) ===
  // Vize = en yüksek tekil hasar alanı: yanlış "vize gerekmiyor" cevabı
  // müşterinin seyahatini iptal ettirebilir. LLM'e HİÇ düşmez.
  // NLU HAM intent'ine bakılır (nluResult.intent === "visa_support") — G12
  // haritasında visa_support → general_question'a maplenir, FSM intent'inde
  // ayrım kaybolur. Ham intent'te ayrım var.
  // R6 etkileşimi: visa_support → general_question → R6 muafiyet listesinde ✅
  //   (telefon adımında vize sorusu R6'ya takılmaz; ayrıca bu blok R6'dan
  //   SONRA olduğundan R6 muafiyeti zaten mesajı buraya ulaştırır).
  // Tur bağlamı YOKKEN de deterministik yönlendirme (LLM'e bırakılmaz):
  //   vize turdan bağımsız da kişisel duruma bağlıdır; genel soruda LLM'in
  //   uydurma riskini açmanın gereği yok — karar: her durumda deterministik.
  // visa_required=false GÜVENİLMEZ (şema DEFAULT false — boş bırakılmış tur
  //   false görünür): "vize gerekmez" DEMEYİZ. Sadece visa_notes doluysa
  //   içerik verilir; visa_required=true + notes boşsa "gerekli + acenteye
  //   danışın"; diğer her durumda genel yönlendirme.
  if (nluResult.intent === "visa_support") {
    const _visaTour = newContext.currentTour ? findTourById(newContext.currentTour.id, tours) : null;
    const _agPhoneV = agency.phone_public ? ` 📞 ${agency.phone_public}` : "";
    let _visaReply: string;
    if (_visaTour?.visa_notes) {
      const _vn: Record<string, string> = {
        tr: `🛂 *${getLocalizedTourTitle(_visaTour.title, newContext.language)}* vize bilgisi:\n${_visaTour.visa_notes}\n\nKişisel durumunuza göre gereklilikler değişebilir — kesin bilgi için acentemize danışabilirsiniz.${_agPhoneV}`,
        en: `🛂 Visa info for *${getLocalizedTourTitle(_visaTour.title, newContext.language)}*:\n${_visaTour.visa_notes}\n\nRequirements may vary by personal situation — please confirm with our agency.${_agPhoneV}`,
        de: `🛂 Visa-Info für *${getLocalizedTourTitle(_visaTour.title, newContext.language)}*:\n${_visaTour.visa_notes}\n\nAnforderungen können je nach persönlicher Situation variieren — bitte bestätigen Sie mit unserer Agentur.${_agPhoneV}`,
        ru: `🛂 Визовая информация для *${getLocalizedTourTitle(_visaTour.title, newContext.language)}*:\n${_visaTour.visa_notes}\n\nТребования могут зависеть от личной ситуации — уточните в нашем агентстве.${_agPhoneV}`,
        ar: `🛂 معلومات التأشيرة لـ *${getLocalizedTourTitle(_visaTour.title, newContext.language)}*:\n${_visaTour.visa_notes}\n\nقد تختلف المتطلبات حسب حالتك الشخصية — يرجى التأكيد مع وكالتنا.${_agPhoneV}`,
        fr: `🛂 Infos visa pour *${getLocalizedTourTitle(_visaTour.title, newContext.language)}* :\n${_visaTour.visa_notes}\n\nLes exigences peuvent varier selon votre situation — veuillez confirmer avec notre agence.${_agPhoneV}`,
        es: `🛂 Información de visa para *${getLocalizedTourTitle(_visaTour.title, newContext.language)}*:\n${_visaTour.visa_notes}\n\nLos requisitos pueden variar según su situación — confirme con nuestra agencia.${_agPhoneV}`,
      };
      _visaReply = _vn[newContext.language] || _vn.en;
    } else if (_visaTour?.visa_required === true) {
      const _vr: Record<string, string> = {
        tr: `🛂 *${getLocalizedTourTitle(_visaTour.title, newContext.language)}* için vize gereklidir. Gereklilikler kişisel duruma göre değişebildiği için detaylı bilgiyi acentemizden almanızı rica ederiz.${_agPhoneV}`,
        en: `🛂 A visa is required for *${getLocalizedTourTitle(_visaTour.title, newContext.language)}*. As requirements vary by personal situation, please contact our agency for details.${_agPhoneV}`,
        de: `🛂 Für *${getLocalizedTourTitle(_visaTour.title, newContext.language)}* ist ein Visum erforderlich. Da die Anforderungen variieren, wenden Sie sich bitte an unsere Agentur.${_agPhoneV}`,
        ru: `🛂 Для *${getLocalizedTourTitle(_visaTour.title, newContext.language)}* требуется виза. Требования зависят от личной ситуации — обратитесь в наше агентство.${_agPhoneV}`,
        ar: `🛂 التأشيرة مطلوبة لـ *${getLocalizedTourTitle(_visaTour.title, newContext.language)}*. تختلف المتطلبات حسب الحالة الشخصية — يرجى التواصل مع وكالتنا.${_agPhoneV}`,
        fr: `🛂 Un visa est requis pour *${getLocalizedTourTitle(_visaTour.title, newContext.language)}*. Les exigences variant selon la situation, veuillez contacter notre agence.${_agPhoneV}`,
        es: `🛂 Se requiere visa para *${getLocalizedTourTitle(_visaTour.title, newContext.language)}*. Los requisitos varían según la situación — contacte con nuestra agencia.${_agPhoneV}`,
      };
      _visaReply = _vr[newContext.language] || _vr.en;
    } else {
      const _vg: Record<string, string> = {
        tr: `🛂 Vize gereklilikleri kişisel duruma (uyruk, pasaport türü vb.) göre değişebildiği için bu konuda net bilgiyi acentemizden almanızı rica ederiz.${_agPhoneV}`,
        en: `🛂 Visa requirements depend on your personal situation (nationality, passport type, etc.), so please contact our agency for accurate information.${_agPhoneV}`,
        de: `🛂 Visabestimmungen hängen von Ihrer persönlichen Situation ab (Nationalität, Passtyp usw.) — bitte wenden Sie sich für genaue Informationen an unsere Agentur.${_agPhoneV}`,
        ru: `🛂 Визовые требования зависят от вашей личной ситуации (гражданство, тип паспорта и т.д.) — за точной информацией обратитесь в наше агентство.${_agPhoneV}`,
        ar: `🛂 تعتمد متطلبات التأشيرة على حالتك الشخصية (الجنسية، نوع جواز السفر وغيرها) — يرجى التواصل مع وكالتنا للحصول على معلومات دقيقة.${_agPhoneV}`,
        fr: `🛂 Les exigences de visa dépendent de votre situation personnelle (nationalité, type de passeport, etc.) — veuillez contacter notre agence pour des informations précises.${_agPhoneV}`,
        es: `🛂 Los requisitos de visa dependen de su situación personal (nacionalidad, tipo de pasaporte, etc.) — contacte con nuestra agencia para información precisa.${_agPhoneV}`,
      };
      _visaReply = _vg[newContext.language] || _vg.en;
    }
    console.log(`[process-message] :10c VISA deterministik cevap (tour=${_visaTour?.id ?? "yok"}, notes=${!!_visaTour?.visa_notes}, required=${_visaTour?.visa_required === true})`);
    await _save(_visaReply, newContext);
    await adapter.sendResponse(_visaReply);
    return { success: true, response: _visaReply, newContext };
  }

  // === 11. TARİH LİSTESİ (deterministik) — D5: tarih sorusu HER stage'de yakalar ===
  // 2026-06-19 (Bug A3 kök çözümü): LLM artık tarih KONUŞMUYOR. Tarih listesi
  // YALNIZ deterministik gönderilir. Tetik koşulları:
  //   (a) COLLECTING_INFO+waiting_for_date → mevcut otomatik akış
  //   (b) TOUR_SELECTED veya COLLECTING_INFO HERHANGİ adımda kullanıcı tarih
  //       sorusu sorarsa (intent + tarih kelime) → A3 ve TOUR_SELECTED A3-kuzeni
  //       senaryoları DETERMINISTIK kapanır. "⛔ TARİH YASAK" diktası asla
  //       primary koruma değil, sadece defansif suffix.
  // ELSE dalı: tour.dates boş → deterministik "tarih yok, acenteye yönlendir" (D3).
  // DATE_QUERY_RE + DATE_INTENTS tek-kaynak: ../constants/date-detection.ts (test
  // davranışsal olarak orayı çağırır — substring değil, runtime regex doğrulaması).
  //
  // 2026-06-25 KÖK 6 FIX (canlı G1 — waiting_for_date'te "iptal şartları"):
  // (a) dalı (waiting_for_date otomatik) mesaj İÇERİĞİNE bakmıyordu → bilgi sorusu
  // intent'leri (general_question, support_request) de :11'e takılıyor, tarih
  // listesi tekrar gösteriliyordu → kullanıcı sorusu yutuluyordu.
  // Çözüm: (a) dalına intent guard. Bilgi sorusu intent'lerinde :11 ATLA → LLM
  // cevaplasın + midFlowReturnPrompt akışa döndürür ("...tarih seçimine devam...").
  // Bug C (detectCancellationGuarded) ile aynı niyet/akış ayrımı pattern'i.
  const _isInfoQuestionFsmIntent =
    fsmIntent === "general_question" || fsmIntent === "support_request";
  const _askingViaQuery = DATE_QUERY_RE.test(message) && DATE_INTENTS.includes(fsmIntent);
  // 2026-06-25 BUG-X1 FIX (c) dal: TOUR_SELECTED'da rezervasyon başlatma niyeti
  // → tarih listesi deterministik göster. Canlı kanıt (exec 8f65305e): "pamukkale
  // turuna kayıt olmak istiyorum" → TOUR_SELECTED'a geçti AMA (a) sağlanmadı
  // (COLLECTING_INFO değil) + (b) sağlanmadı (DATE_QUERY_RE eşleşmez) → :11 atlandı
  // → LLM "müsait tarihleri kontrol ediyorum" der ama liste atlar (M1 kırılganlık).
  // (c) dalı: TOUR_SELECTED + reservation_intent/tour_selected → deterministik liste.
  // SADECE bu 2 intent — tour_search/general_question (KÖK 6) etkilenmez.
  const _isNewReservationIntent =
    newContext.stage === "TOUR_SELECTED" &&
    (fsmIntent === "reservation_intent" || fsmIntent === "tour_selected");
  const _isUserAskingDates =
    !!newContext.currentTour &&
    !_isInfoQuestionFsmIntent &&   // KÖK 6: bilgi sorusu intent'leri :11'i atlatır
    (
      // (a) Veri-toplama akışında tarih adımı: otomatik
      (newContext.stage === "COLLECTING_INFO" && newContext.collectionStep === "waiting_for_date") ||
      // (b) Kullanıcı tarih sorusu sordu (TOUR_SELECTED veya COLLECTING_INFO herhangi adım)
      ((newContext.stage === "TOUR_SELECTED" || newContext.stage === "COLLECTING_INFO") && _askingViaQuery) ||
      // (c) BUG-X1 fix: TOUR_SELECTED'da rezervasyon başlatma niyeti
      _isNewReservationIntent
    );

  // 2026-07-01 PROBLEM 1 fix: (d) takılma güvenlik ağı _isUserAskingDates ÜST guard'ından
  // ÇIKARILDI (canlı kanıt de045d24: NLU faq_general → FSM general_question →
  // _isInfoQuestionFsmIntent TRUE → üst guard FALSE → (d) hiç ulaşılamıyordu, TAM DA
  // en çok gereken senaryoda devre dışıydı). Ayrı koşul olarak yeniden ifade edildi:
  // FAQ intent guard'ından BAĞIMSIZ — amacı zaten o intent'lerin takılma yarattığı
  // durumu kapatmak.
  // Yanlış-pozitif daraltma: mesajda sayı VAR koşulu. Gerçek FAQ ("iptal şartları?" —
  // sayı yok) tetiklenmez → LLM FAQ cevap verir. Rezervasyon sinyali içeren mesaj
  // ("pamukkale 3 kişi 20 aralık" — sayı var) tetiklenir → liste.
  // NOT: PROBLEM 2 (state-machine tour_search informational bypass) çözüldükten sonra
  // NLU doğru parse senaryosunda state COLLECTING_INFO'ya geçer, bu dal ULAŞILMAZ.
  // Bu dal SADECE NLU'nun rezervasyon niyetini faq_general/general_question sandığı
  // sigorta edge senaryoları için.
  const _isStuckOnTourSelected =
    newContext.stage === "TOUR_SELECTED" &&
    !!newContext.currentTour &&
    !extractedInfo.dateId &&
    /\d/.test(message);

  if (_isUserAskingDates || _isStuckOnTourSelected) {
    const tourForDates = findTourById(newContext.currentTour!.id, tours);
    const _displayTitleNoDates = getLocalizedTourTitle(
      tourForDates?.title || newContext.currentTour!.title || "",
      newContext.language,
    );
    if (tourForDates?.dates?.length) {
      const _exRates = await getExchangeRatesOnce().catch(() => ({}));
      const _tourCurrency = tourForDates.currency || "TRY";
      const _showDual = agency.show_multi_currency !== false;
      const dateLines = tourForDates.dates
        .map((d: any, idx: number) => {
          const dateText = formatDateForLanguage(d.departure_date, newContext.language);
          const priceText = d.price_adult
            ? ` - ${formatPriceSync(d.price_adult, _tourCurrency, newContext.language, _exRates, _showDual, languageCurrencies)}`
            : "";
          // 2026-06-22 Sorun H α katmanı: dolu tarih ETİKETLE (gizleme değil).
          // Şeffaflık — kullanıcı tarihin var ama dolu olduğunu görür.
          // getQuotaRemaining tek-kaynak (quota-check.ts).
          const remaining = getQuotaRemaining(d);
          const isFull = remaining <= 0;
          const fullLabels: Record<string, string> = {
            tr: " (DOLU)",   en: " (FULL)",   de: " (VOLL)",
            ru: " (ПОЛНО)",  ar: " (ممتلئ)",  fr: " (COMPLET)",
            es: " (COMPLETO)",
          };
          const quotaText = isFull
            ? (fullLabels[newContext.language] || fullLabels.en)
            : ({
                tr: ` (${remaining} kişilik yer)`,
                en: ` (${remaining} spots)`,
                de: ` (${remaining} Plätze)`,
                ru: ` (${remaining} мест)`,
                ar: ` (${remaining} مقاعد)`,
                fr: ` (${remaining} places)`,
                es: ` (${remaining} plazas)`,
              }[newContext.language] ?? ` (${remaining} spots)`);
          return `${idx + 1}) ${dateText}${priceText}${quotaText}`;
        })
        .join("\n");

      const _displayTitle = getLocalizedTourTitle(tourForDates.title, newContext.language);
      const dateSelMsgs: Record<string, string> = {
        tr: `*${_displayTitle}* için müsait tarihler:\n${dateLines}\n\nHangi tarihi tercih edersiniz?`,
        en: `Available dates for *${_displayTitle}*:\n${dateLines}\n\nWhich date do you prefer?`,
        de: `Verfügbare Termine für *${_displayTitle}*:\n${dateLines}\n\nWelches Datum bevorzugen Sie?`,
        ru: `Доступные даты для *${_displayTitle}*:\n${dateLines}\n\nКакую дату вы предпочитаете?`,
        ar: `التواريخ المتاحة لـ *${_displayTitle}*:\n${dateLines}\n\nما التاريخ الذي تفضله؟`,
        fr: `Dates disponibles pour *${_displayTitle}* :\n${dateLines}\n\nQuelle date préférez-vous ?`,
        es: `Fechas disponibles para *${_displayTitle}*:\n${dateLines}\n\n¿Qué fecha prefieres?`,
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

      // 2026-06-23 Sorun D: tur değişim prefix (FSM transition sonrası
      // newContext.currentTour kullan — state-machine yolu A/B veya erken-müdahale
      // sonrası newContext.currentTour orijinal _originalTourId'den farklıysa
      // prefix oluşur. _invalidDateForPreamble'dan ÖNCE eklenir — okuma sırası:
      // "Şimdi *Pamukkale* için devam ediyoruz. Müsait tarihler: ..."
      const _tcPrefixDates = buildTourChangePrefix(
        _originalTourId,
        newContext.currentTour?.id,
        getLocalizedTourTitle(tourForDates.title || "", newContext.language),
        newContext.language,
      );
      dateReply = _tcPrefixDates + dateReply;

      await _save(dateReply, newContext);
      await adapter.sendResponse(dateReply);
      return { success: true, response: dateReply, newContext };
    } else {
      // D3 (2026-06-19): ELSE dalı — tour.dates boş → deterministik yönlendirme.
      // Önceden bu dal yoktu; tourForDates.dates boşsa blok sessizce atlıyordu,
      // akış LLM'e geçiyordu, LLM tarih uyduruyordu. Artık deterministik mesaj.
      const _noDatesMsgs: Record<string, string> = {
        tr: `*${_displayTitleNoDates}* için şu anda aktif müsait tarih bulunmuyor. 😔\n\nEn güncel bilgi için acentemizle iletişime geçebilirsiniz.`,
        en: `No active dates available for *${_displayTitleNoDates}* at the moment. 😔\n\nPlease contact our agency for the latest information.`,
        de: `Derzeit keine verfügbaren Termine für *${_displayTitleNoDates}*. 😔\n\nBitte wenden Sie sich an unsere Agentur.`,
        ru: `В данный момент нет доступных дат для *${_displayTitleNoDates}*. 😔\n\nСвяжитесь с нашим агентством для актуальной информации.`,
        ar: `لا توجد تواريخ متاحة لـ *${_displayTitleNoDates}* حالياً. 😔\n\nيرجى التواصل مع وكالتنا.`,
        fr: `Pas de dates disponibles pour *${_displayTitleNoDates}* actuellement. 😔\n\nVeuillez contacter notre agence.`,
        es: `No hay fechas disponibles para *${_displayTitleNoDates}* en este momento. 😔\n\nPor favor contacte a nuestra agencia.`,
      };
      const noDateReply = _noDatesMsgs[newContext.language] || _noDatesMsgs.tr;
      await _save(noDateReply, newContext);
      await adapter.sendResponse(noDateReply);
      return { success: true, response: noDateReply, newContext };
    }
  }

  // === 11a-AUTO-DATE-ACK. TEK-TARİH OTOMATİK ATAMA ONAYI ===
  // 2026-06-21 Sorun C fix (exec 8d0d72ae). info-extractor Blok 10 tek-tarih
  // turunda dateAutoAssigned=true set ettiyse, kullanıcıya seçilen tarihi
  // GÖSTERİP onaylatarak pax sorar. Şeffaflık + LLM bağımsız.
  //
  // Flag-tabanlı dar gate (dateId varlığına BAKMAZ):
  //   - Kullanıcı kendi tarih verdiyse (Blok 2/3/8/9) flag YOK → bypass NO → çift
  //     mesaj riski sıfır (kullanıcı zaten "14 aralık" deyince mevcut akış doğru).
  //   - SADECE Blok 10 otomatik atama yaptığında flag VAR → bypass çalışır.
  //
  // FİYAT GRACEFUL FALLBACK: exchange rate / formatPriceSync başarısız olursa
  // (currency null, throw, vs.) bypass mesajı YİNE GİDER, sadece fiyat kısmı
  // atlanır. Tarih onayı asıl iş, fiyat bonus — akışı bloklamaz.
  if (shouldTriggerAutoDateAck(context, newContext, (extractedInfo as any)?.dateAutoAssigned === true)) {
    const _lang = newContext.language || "tr";
    const _selectedDate = (newContext.reservationInfo as any)?.selectedDate || "";
    const _displayDate = _selectedDate
      ? formatDateForLanguage(_selectedDate, _lang)
      : "";
    const _tourA = newContext.currentTour
      ? findTourById(newContext.currentTour.id, tours)
      : null;
    const _displayTitle = _tourA
      ? getLocalizedTourTitle(_tourA.title, _lang)
      : (newContext.currentTour?.title || "");

    // Fiyat hesaplama — try/catch içinde, başarısızsa _priceText="" kalır
    let _priceText = "";
    try {
      const _firstDateA = _tourA?.dates?.[0];
      if (_firstDateA?.price_adult) {
        const _exRatesAck = await getExchangeRatesOnce().catch(() => ({}));
        const _showDualAck = agency.show_multi_currency !== false;
        _priceText = formatPriceSync(
          _firstDateA.price_adult,
          _tourA?.currency || "TRY",
          _lang,
          _exRatesAck,
          _showDualAck,
          languageCurrencies,
        );
      }
    } catch (_priceErr) {
      console.warn("[process-message] :11a-AUTO-DATE-ACK price format failed, fiyatsız devam:", _priceErr);
      _priceText = "";
    }

    const _msgs: Record<string, string> = {
      tr: _priceText
        ? `*${_displayDate}* tarihinde *${_displayTitle}* için rezervasyon başlatıyorum. (Kişi başı ${_priceText}) ✨\n\nKaç kişi katılacaksınız? 😊`
        : `*${_displayDate}* tarihinde *${_displayTitle}* için rezervasyon başlatıyorum. ✨\n\nKaç kişi katılacaksınız? 😊`,
      en: _priceText
        ? `Starting reservation for *${_displayTitle}* on *${_displayDate}*. (Per person ${_priceText}) ✨\n\nHow many people? 😊`
        : `Starting reservation for *${_displayTitle}* on *${_displayDate}*. ✨\n\nHow many people? 😊`,
      de: _priceText
        ? `Buche *${_displayTitle}* am *${_displayDate}*. (Pro Person ${_priceText}) ✨\n\nWie viele Personen? 😊`
        : `Buche *${_displayTitle}* am *${_displayDate}*. ✨\n\nWie viele Personen? 😊`,
      ru: _priceText
        ? `Начинаю бронирование *${_displayTitle}* на *${_displayDate}*. (С человека ${_priceText}) ✨\n\nСколько человек? 😊`
        : `Начинаю бронирование *${_displayTitle}* на *${_displayDate}*. ✨\n\nСколько человек? 😊`,
      ar: _priceText
        ? `أبدأ حجز *${_displayTitle}* في *${_displayDate}*. (للشخص ${_priceText}) ✨\n\nكم شخصاً؟ 😊`
        : `أبدأ حجز *${_displayTitle}* في *${_displayDate}*. ✨\n\nكم شخصاً؟ 😊`,
      fr: _priceText
        ? `Je commence votre réservation pour *${_displayTitle}* le *${_displayDate}*. (Par personne ${_priceText}) ✨\n\nCombien de personnes ? 😊`
        : `Je commence votre réservation pour *${_displayTitle}* le *${_displayDate}*. ✨\n\nCombien de personnes ? 😊`,
      es: _priceText
        ? `Iniciando reserva para *${_displayTitle}* el *${_displayDate}*. (Por persona ${_priceText}) ✨\n\n¿Cuántas personas? 😊`
        : `Iniciando reserva para *${_displayTitle}* el *${_displayDate}*. ✨\n\n¿Cuántas personas? 😊`,
    };
    // 2026-06-23 Sorun D: tur değişim prefix (yeni tek-tarihli tura erken-müdahale
    // sonrası auto-date senaryosu — kullanıcı önce tur değiştirdi, yeni tur tek
    // tarihli, Blok 10 dateAutoAssigned set etti, transition waiting_for_pax'a
    // düştü. Bypass mesajının önüne tur değişim ack'i.).
    const _tcPrefixAck = buildTourChangePrefix(
      _originalTourId,
      newContext.currentTour?.id,
      _displayTitle,
      _lang,
    );
    const askReply = _tcPrefixAck + (_msgs[_lang] || _msgs.tr);
    console.log(`[process-message] :11a-AUTO-DATE-ACK tetiklendi (date=${_selectedDate}, transition→waiting_for_pax, tourChanged=${!!_tcPrefixAck})`);
    await _save(askReply, newContext);
    await adapter.sendResponse(askReply);
    return { success: true, response: askReply, newContext };
  }

  // === 11a-MANUAL-DATE-ACK. MANUEL TARİH SEÇİMİ → PAX (deterministik) ===
  // 2026-06-25 BUG-X5 FIX (canlı exec a62db908):
  // Pamukkale (çoklu-tarihli) tur seçildi → "10 aralık" → bot "*Antalya Rafting*
  // turumuz için 10 Aralık not ettim" (YANLIŞ TUR ADI, state Pamukkale doğru).
  // LLM (Haiku) history sızıntısı — keşif aşamasında konuşulan Antalya'yı pax-ack
  // mesajına yansıttı. M1 LLM compliance kırılganlığı.
  //
  // :11a-AUTO-DATE-ACK (yukarıda) SADECE dateAutoAssigned=true ile tetiklendiği
  // için çoklu-tarihli turda manuel tarih seçimi LLM'e bırakılıyordu → risk.
  //
  // FIX: Manuel tarih→pax geçişi için deterministik bypass. State'ten
  // currentTour.title + selectedDate okur. Tur adı GÜVENİLİR state kaynağı
  // (Murat C ilkesi — deterministik, M1'e güvenme).
  //
  // ÇAKIŞMA GUARD'I: :11a-AUTO-DATE-ACK YUKARIDA kontrol edilip return ediyor —
  // dateAutoAssigned=true durumu yakalanmış olur. Burası SADECE manuel seçimde
  // (dateAutoAssigned=false) tetiklenir.
  if (shouldTriggerManualDateAck(
    context,
    newContext,
    (extractedInfo as any)?.dateAutoAssigned === true,
    !!(newContext.reservationInfo as any)?.selectedDate,
  )) {
    const _lang = newContext.language || "tr";
    const _selectedDateM = (newContext.reservationInfo as any)?.selectedDate || "";
    const _displayDateM = _selectedDateM
      ? formatDateForLanguage(_selectedDateM, _lang)
      : "";
    const _tourM = newContext.currentTour
      ? findTourById(newContext.currentTour.id, tours)
      : null;
    const _displayTitleM = _tourM
      ? getLocalizedTourTitle(_tourM.title, _lang)
      : (newContext.currentTour?.title || "");

    // Fiyat hesaplama — try/catch içinde, başarısızsa _priceTextM="" kalır (:11a ile aynı pattern)
    let _priceTextM = "";
    try {
      const _selDateObj = _tourM?.dates?.find((d: any) => d.id === (newContext.reservationInfo as any)?.dateId)
        || _tourM?.dates?.[0];
      if (_selDateObj?.price_adult) {
        const _exRatesAckM = await getExchangeRatesOnce().catch(() => ({}));
        const _showDualAckM = agency.show_multi_currency !== false;
        _priceTextM = formatPriceSync(
          _selDateObj.price_adult,
          _tourM?.currency || "TRY",
          _lang,
          _exRatesAckM,
          _showDualAckM,
          languageCurrencies,
        );
      }
    } catch (_priceErrM) {
      console.warn("[process-message] :11a-MANUAL-DATE-ACK price format failed, fiyatsız devam:", _priceErrM);
      _priceTextM = "";
    }

    // 7 dil — :11a-AUTO-DATE-ACK ile aynı stil + template
    const _msgsM: Record<string, string> = {
      tr: _priceTextM
        ? `*${_displayDateM}* tarihinde *${_displayTitleM}* için rezervasyon başlatıyorum. (Kişi başı ${_priceTextM}) ✨\n\nKaç kişi katılacaksınız? 👥`
        : `*${_displayDateM}* tarihinde *${_displayTitleM}* için rezervasyon başlatıyorum. ✨\n\nKaç kişi katılacaksınız? 👥`,
      en: _priceTextM
        ? `Starting reservation for *${_displayTitleM}* on *${_displayDateM}*. (Per person ${_priceTextM}) ✨\n\nHow many people? 👥`
        : `Starting reservation for *${_displayTitleM}* on *${_displayDateM}*. ✨\n\nHow many people? 👥`,
      de: _priceTextM
        ? `Buche *${_displayTitleM}* am *${_displayDateM}*. (Pro Person ${_priceTextM}) ✨\n\nWie viele Personen? 👥`
        : `Buche *${_displayTitleM}* am *${_displayDateM}*. ✨\n\nWie viele Personen? 👥`,
      ru: _priceTextM
        ? `Начинаю бронирование *${_displayTitleM}* на *${_displayDateM}*. (С человека ${_priceTextM}) ✨\n\nСколько человек? 👥`
        : `Начинаю бронирование *${_displayTitleM}* на *${_displayDateM}*. ✨\n\nСколько человек? 👥`,
      ar: _priceTextM
        ? `أبدأ حجز *${_displayTitleM}* في *${_displayDateM}*. (للشخص ${_priceTextM}) ✨\n\nكم شخصاً؟ 👥`
        : `أبدأ حجز *${_displayTitleM}* في *${_displayDateM}*. ✨\n\nكم شخصاً؟ 👥`,
      fr: _priceTextM
        ? `Je commence votre réservation pour *${_displayTitleM}* le *${_displayDateM}*. (Par personne ${_priceTextM}) ✨\n\nCombien de personnes ? 👥`
        : `Je commence votre réservation pour *${_displayTitleM}* le *${_displayDateM}*. ✨\n\nCombien de personnes ? 👥`,
      es: _priceTextM
        ? `Iniciando reserva para *${_displayTitleM}* el *${_displayDateM}*. (Por persona ${_priceTextM}) ✨\n\n¿Cuántas personas? 👥`
        : `Iniciando reserva para *${_displayTitleM}* el *${_displayDateM}*. ✨\n\n¿Cuántas personas? 👥`,
    };

    // Tur değişim prefix (tarih seçiminden önce tur değiştirildiyse — KÖK 5 ile uyumlu)
    const _tcPrefixAckM = buildTourChangePrefix(
      _originalTourId,
      newContext.currentTour?.id,
      _displayTitleM,
      _lang,
    );
    const askReplyM = _tcPrefixAckM + (_msgsM[_lang] || _msgsM.tr);
    console.log(`[process-message] :11a-MANUAL-DATE-ACK tetiklendi (date=${_selectedDateM}, tour=${_displayTitleM}, tourChanged=${!!_tcPrefixAckM})`);
    await _save(askReplyM, newContext);
    await adapter.sendResponse(askReplyM);
    return { success: true, response: askReplyM, newContext };
  }

  // === 11b. PAX → NAME GEÇİŞİ (deterministik) — 2026-06-19 Murat bug kökü ===
  // pax dolduğunda waiting_for_name'e geçilen İLK turn'de LLM çağrılmaz; bot sabit
  // metni atar. LLM compliance hatası riski sıfır. Mevcut :519 tarih + :583 email
  // bloklarıyla aynı pattern.
  if (
    newContext.stage === "COLLECTING_INFO" &&
    newContext.collectionStep === "waiting_for_name" &&
    context.collectionStep !== "waiting_for_name"
  ) {
    const _lang = newContext.language || "tr";
    const _msgs: Record<string, string> = {
      tr: "Teşekkürler! 😊 Ad ve soyadınızı alabilir miyim?",
      en: "Thank you! 😊 May I have your full name?",
      de: "Vielen Dank! 😊 Darf ich Ihren vollständigen Namen erfahren?",
      ru: "Спасибо! 😊 Назовите, пожалуйста, ваше имя и фамилию.",
      ar: "شكراً لك! 😊 هل يمكنني الحصول على الاسم الكامل؟",
      fr: "Merci ! 😊 Puis-je avoir votre nom complet ?",
      es: "¡Gracias! 😊 ¿Puede darme su nombre completo?",
    };
    const askReply = _msgs[_lang] || _msgs.tr;
    await _save(askReply, newContext);
    await adapter.sendResponse(askReply);
    return { success: true, response: askReply, newContext };
  }

  // === 11b-PERSIST. WAITING_FOR_NAME NO-OP — yanlış sinyal koruması ===
  // 2026-06-20 Yan #5 fix. Canlı bug (execution 109fef4c): waiting_for_name'de
  // kullanıcı "1 kişi" yazdı, state pax dolu, intent=provide_info, fullName=null.
  // Mevcut :11b transition gate'i tetiklenmedi (no-op). LLM context'e bakıp
  // "Teşekkürler! Kaç kişi katılacaksınız?" diye saçma cevap üretti.
  //
  // BİLİNEN SINIR: NLU bir off-topic soruyu (örn. "iki günlük müydü?") yanlışlıkla
  // provide_info+paxAdult olarak sınıflandırırsa bu bypass TETİKLENİR ve meşru
  // soruyu "Önce ismi alalım" ile keser. midFlowReturnPrompt bu yolda ÇALIŞMAZ
  // (bypass erken çıkış yapıyor, LLM hiç çağrılmıyor, prompt katmanı devreye
  // girmiyor). Bu kabul edilen bir sınır — eski "Kaç kişi?" saçma cevabı daha
  // büyük UX kaybı. Trade-off davranışsal testte "bilinen sınır" olarak belgeli.
  if (shouldTriggerNameAskPersist(context, newContext, nluResult)) {
    const _lang = newContext.language || "tr";

    // 2026-06-21 Sorun B fix: pax değişimi bildirim. Canlı bug (exec 184bb422):
    // bypass tetiklendiğinde mergeReservationInfo paxAdult'ı üzerine yazıyor
    // (state-machine.ts:110-112, waiting_for_name'de tarih dolu → hasDate=true
    // → yeni pax KOŞULSUZ yazılır), AMA mesaj sadece "ad-soyad alalım" diyor.
    // Kullanıcı 2→1 değişimini GÖRMÜYOR (sessiz update).
    //
    // Bildirim SADECE bu turn'de YENİ paxAdult değeri geldi VE öncekinden
    // farklıysa eklenir. Aksi halde sade "Önce ad-soyad" mesajı.
    //
    // BİLİNEN SINIR genişlemesi: :11b-PERSIST'in NLU yanlış sınıflandırma
    // sınırı pax-bildirimine yansır — NLU "iki günlük müydü?"yu paxAdult=2
    // diye yanlış parse ederse bildirim "2 kişi aldım" yanlış gider. DÜZELTME
    // İMKÂNI VAR: kullanıcı sonraki turn'de "hayır 1 kişi" derse merge yine
    // üzerine yazar → bildirim "1 kişi aldım" düzeltilir. Sistem kilitlenmez,
    // sessiz-yanlış → gürültülü-yanlış (görünür) trade-off kabul edildi.
    const _newPax = (nluResult.updates as any)?.paxAdult;
    const _oldPax = (context.reservationInfo as any)?.paxAdult;
    const _paxAcked = !!_newPax && _newPax !== _oldPax;

    const _ackPrefix: Record<string, string> = _paxAcked ? {
      tr: `*${_newPax} kişi* olarak güncelledim. `,
      en: `Updated to *${_newPax} ${_newPax === 1 ? "person" : "people"}*. `,
      de: `Aktualisiert auf *${_newPax} ${_newPax === 1 ? "Person" : "Personen"}*. `,
      ru: `Обновлено до *${_newPax}*. `,
      ar: `تم التحديث إلى *${_newPax}*. `,
      fr: `Mis à jour à *${_newPax} ${_newPax === 1 ? "personne" : "personnes"}*. `,
      es: `Actualizado a *${_newPax} ${_newPax === 1 ? "persona" : "personas"}*. `,
    } : { tr: "", en: "", de: "", ru: "", ar: "", fr: "", es: "" };

    // 2026-06-22 F-msg revize: Sorun F'in canlı doğrulamasında ortaya çıkan
    // kuyruk — kullanıcı "Murat değil aslında Ahmet" yazıp reddedilince bot
    // jenerik "Önce ad-soyad alalım" diyordu, kullanıcı ne yanlış yaptığını
    // anlamıyordu. Mesajları açıklayıcı tona çevir + ÖRNEK İSİM ekle.
    //
    // paxAck VAR ("Şimdi") + paxAck YOK ("Lütfen") iki varyant — örnek isim
    // her ikisinde de var (Ahmet Yılmaz / Max Mustermann / Jean Dupont / ...).
    const _baseMsgs: Record<string, string> = _paxAcked ? {
      tr: "Şimdi *tam ad ve soyadınızı* yazar mısınız? (örn. Ahmet Yılmaz) 😊",
      en: "Now could you write your *full name and surname*? (e.g. Ahmet Yılmaz) 😊",
      de: "Könnten Sie nun Ihren *Vor- und Nachnamen* schreiben? (z.B. Max Mustermann) 😊",
      ru: "Теперь напишите, пожалуйста, *имя и фамилию*. (например, Иван Иванов) 😊",
      ar: "هل يمكنك كتابة *الاسم الكامل واللقب* الآن؟ (مثال: أحمد يلماز) 😊",
      fr: "Pouvez-vous maintenant écrire votre *nom et prénom* ? (ex: Jean Dupont) 😊",
      es: "¿Puede ahora escribir su *nombre completo y apellido*? (ej: Juan García) 😊",
    } : {
      tr: "Lütfen *tam ad ve soyadınızı* yazar mısınız? (örn. Ahmet Yılmaz) 😊",
      en: "Could you write your *full name and surname*? (e.g. Ahmet Yılmaz) 😊",
      de: "Könnten Sie bitte Ihren *Vor- und Nachnamen* schreiben? (z.B. Max Mustermann) 😊",
      ru: "Напишите, пожалуйста, *имя и фамилию*. (например, Иван Иванов) 😊",
      ar: "يرجى كتابة *الاسم الكامل واللقب*. (مثال: أحمد يلماز) 😊",
      fr: "Pourriez-vous écrire votre *nom et prénom* ? (ex: Jean Dupont) 😊",
      es: "¿Podría escribir su *nombre completo y apellido*? (ej: Juan García) 😊",
    };

    const askReply = (_ackPrefix[_lang] || _ackPrefix.tr) + (_baseMsgs[_lang] || _baseMsgs.tr);
    console.log(`[process-message] :11b-PERSIST tetiklendi (no-op, intent=${nluResult.intent}, fullName yok, paxAck=${_paxAcked})`);
    await _save(askReply, newContext);
    await adapter.sendResponse(askReply);
    return { success: true, response: askReply, newContext };
  }

  // === 11c. NAME → PHONE GEÇİŞİ (deterministik) ===
  // İsim dolduğunda waiting_for_phone'a geçilen İLK turn'de LLM çağrılmaz.
  // Hitap için isim ilk kelimesi kullanılır (cinsiyet tahmini YOK, sade).
  if (
    newContext.stage === "COLLECTING_INFO" &&
    newContext.collectionStep === "waiting_for_phone" &&
    context.collectionStep !== "waiting_for_phone"
  ) {
    const _lang = newContext.language || "tr";
    const _fullName = (newContext.reservationInfo as any)?.fullName || "";
    const _firstName = String(_fullName).trim().split(/\s+/)[0] || "";
    const _msgs: Record<string, string> = {
      tr: _firstName
        ? `Teşekkürler ${_firstName}! 📱 Telefon numaranızı alabilir miyim?`
        : "Teşekkürler! 📱 Telefon numaranızı alabilir miyim?",
      en: _firstName
        ? `Thank you ${_firstName}! 📱 May I have your phone number?`
        : "Thank you! 📱 May I have your phone number?",
      de: _firstName
        ? `Vielen Dank, ${_firstName}! 📱 Darf ich Ihre Telefonnummer erfahren?`
        : "Vielen Dank! 📱 Darf ich Ihre Telefonnummer erfahren?",
      ru: _firstName
        ? `Спасибо, ${_firstName}! 📱 Скажите, пожалуйста, ваш номер телефона.`
        : "Спасибо! 📱 Скажите, пожалуйста, ваш номер телефона.",
      ar: _firstName
        ? `شكراً ${_firstName}! 📱 هل يمكنني الحصول على رقم هاتفك؟`
        : "شكراً لك! 📱 هل يمكنني الحصول على رقم هاتفك؟",
      fr: _firstName
        ? `Merci ${_firstName} ! 📱 Puis-je avoir votre numéro de téléphone ?`
        : "Merci ! 📱 Puis-je avoir votre numéro de téléphone ?",
      es: _firstName
        ? `¡Gracias, ${_firstName}! 📱 ¿Me puede dar su número de teléfono?`
        : "¡Gracias! 📱 ¿Me puede dar su número de teléfono?",
    };
    const askReply = _msgs[_lang] || _msgs.tr;
    await _save(askReply, newContext);
    await adapter.sendResponse(askReply);
    return { success: true, response: askReply, newContext };
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
      await _save(askReply, newContext);
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
      await _save(invalidReply, newContext);
      await adapter.sendResponse(invalidReply);
      return { success: true, response: invalidReply, newContext };
    }
  }

  // === 13. PHONE → CONFIRMING GEÇİŞİ (deterministik) — 2026-06-19 Murat bug kökü ===
  // Tüm alanlar dolduğunda CONFIRMING'e geçilen İLK turn'de özet+onay deterministik
  // gönderilir, LLM çağrılmaz. Bu turn'de bot pax/isim/telefon TEKRAR SORAMAZ
  // (canlı bug kanıtı: LLM dolu state'te bile "Kaç kişi?" diyordu).
  if (newContext.stage === "CONFIRMING" && context.stage !== "CONFIRMING") {
    const _lang = newContext.language || "tr";
    const info = (newContext.reservationInfo as any) || {};
    const _tourTitle = newContext.currentTour
      ? getLocalizedTourTitle(newContext.currentTour.title || "", _lang)
      : "";
    const _dateText = info.selectedDate ? formatDateForLanguage(info.selectedDate, _lang) : "";
    // 2026-06-25 KÖK 2 ince ayar: paxChild gösterimi (canlı kanıt 058bb668 — ilk
    // özet "Kişi sayısı: 3" diyordu, ikinci özet (LLM) "3 yetişkin, 2 çocuk" doğru.
    // İlk bypass mevcut sadece paxAdult'a bakıyordu. Tutarlı için pax satırı
    // "X yetişkin, Y çocuk" formatına çevrildi (paxChild yoksa "X yetişkin").
    const _paxAdult = info.paxAdult ?? "";
    const _paxChild = info.paxChild;
    const _name = info.fullName || "";
    const _phone = info.phone || "";

    // 2026-07-02 K1 KATMAN 3: confirm satırına net anahtar-kelime yönlendirmesi.
    // detectConfirmation dar bir onay-kelime whitelist'i kullanır; kullanıcıyı doğru
    // kelimeye yönlendirmek Haiku'nun intent sınıflandırma tutarsızlığından bağımsız
    // olarak COMPLETED'a geçişi güvenilir kılar (canlı yanlış-negatif dersini kapatır).
    const _labels: Record<string, { tour: string; date: string; pax: string; adult: string; child: string; name: string; phone: string; confirm: string }> = {
      tr: { tour: "Tur",     date: "Tarih",   pax: "Kişi sayısı", adult: "yetişkin",  child: "çocuk",   name: "Ad-Soyad", phone: "Telefon",   confirm: "Bilgiler doğru mu? Onaylıyorsanız *evet* yazın ✅" },
      en: { tour: "Tour",    date: "Date",    pax: "People",      adult: "adult",     child: "child",   name: "Name",     phone: "Phone",     confirm: "Are these details correct? Reply *yes* to confirm ✅" },
      de: { tour: "Tour",    date: "Datum",   pax: "Personen",    adult: "Erwachsener", child: "Kind",  name: "Name",     phone: "Telefon",   confirm: "Sind die Angaben korrekt? Antworten Sie *ja* zur Bestätigung ✅" },
      ru: { tour: "Тур",     date: "Дата",    pax: "Человек",     adult: "взрослый",  child: "ребёнок", name: "Имя",      phone: "Телефон",   confirm: "Данные верны? Напишите *да* для подтверждения ✅" },
      ar: { tour: "الجولة", date: "التاريخ", pax: "عدد الأشخاص", adult: "بالغ",      child: "طفل",     name: "الاسم",    phone: "الهاتف",    confirm: "هل المعلومات صحيحة؟ اكتب *نعم* للتأكيد ✅" },
      fr: { tour: "Circuit", date: "Date",    pax: "Personnes",   adult: "adulte",    child: "enfant",  name: "Nom",      phone: "Téléphone", confirm: "Les informations sont-elles correctes ? Répondez *oui* pour confirmer ✅" },
      es: { tour: "Tour",    date: "Fecha",   pax: "Personas",    adult: "adulto",    child: "niño",    name: "Nombre",   phone: "Teléfono",  confirm: "¿Los datos son correctos? Responda *sí* para confirmar ✅" },
    };
    const L = _labels[_lang] || _labels.tr;

    // paxChild varsa "X yetişkin, Y çocuk"; yoksa sadece "X" (mevcut sade davranış)
    const _paxText = _paxAdult !== ""
      ? (typeof _paxChild === "number" && _paxChild > 0
          ? `${_paxAdult} ${L.adult}, ${_paxChild} ${L.child}`
          : `${_paxAdult}`)
      : "";

    const _summaryLines = [
      _tourTitle ? `📋 ${L.tour}: *${_tourTitle}*` : "",
      _dateText  ? `📅 ${L.date}: ${_dateText}`    : "",
      _paxText   ? `👥 ${L.pax}: ${_paxText}`      : "",
      _name      ? `👤 ${L.name}: ${_name}`        : "",
      _phone     ? `📱 ${L.phone}: ${_phone}`      : "",
    ].filter(Boolean).join("\n");

    const summaryReply = `${_summaryLines}\n\n${L.confirm}`;
    await _save(summaryReply, newContext);
    await adapter.sendResponse(summaryReply);
    return { success: true, response: summaryReply, newContext };
  }

  // === 13-PERSIST. CONFIRMING NO-OP — belirsiz cevap özet+onay tekrar ===
  // 2026-06-22 Sorun G fix (canlı bug exec 06ae0554, M1 ailesi):
  //   CONFIRMING'de "tabi olabilir" → NLU general (canlı kanıt), detectConfirmation
  //   FALSE, change_info FALSE → no-op. LLM çağrılır → "Telefon numaranızı?"
  //   (telefon dolu olmasına rağmen) M1 LLM compliance kırılganlığı.
  //
  // FIX: deterministik özet+onay tekrar. shouldTriggerSummaryReask intent
  //   allow-list ile DARALTILMIŞ — meşru sorular (hotel_details/faq_general/
  //   payment_methods/cancellation_policy/...) ve gerçek düzeltme (provide_info,
  //   "0555 123 45 67" gibi) LLM'e gider. SADECE belirsiz/içeriksiz intent'ler
  //   (confirm_reservation/general/greeting) bypass tetikler.
  if (shouldTriggerSummaryReask(context, newContext, nluResult.intent)) {
    const _lang = newContext.language || "tr";
    const info = (newContext.reservationInfo as any) || {};
    const _tourTitle = newContext.currentTour
      ? getLocalizedTourTitle(newContext.currentTour.title || "", _lang)
      : "";
    const _dateText = info.selectedDate ? formatDateForLanguage(info.selectedDate, _lang) : "";
    // 2026-06-25 KÖK 2 ince ayar: paxChild gösterimi (:13 ile tutarlı)
    const _paxAdult = info.paxAdult ?? "";
    const _paxChild = info.paxChild;
    const _name = info.fullName || "";
    const _phone = info.phone || "";

    // Mevcut :13 ile aynı label yapısı (tutarlı görünüm). FARK: confirm metni
    // daha sade — "Bilgileri tekrar görmenizi istedim" yok (kullanıcı o cümleyi
    // kurmadı, tuhaf). Özet zaten üstte, sade soru yeter.
    const _labels: Record<string, { tour: string; date: string; pax: string; adult: string; child: string; name: string; phone: string; reask: string }> = {
      tr: { tour: "Tur",     date: "Tarih",   pax: "Kişi sayısı", adult: "yetişkin",    child: "çocuk",   name: "Ad-Soyad", phone: "Telefon",   reask: "Onaylıyor musunuz, yoksa değiştirmek istediğiniz bir şey var mı? ✅" },
      en: { tour: "Tour",    date: "Date",    pax: "People",      adult: "adult",       child: "child",   name: "Name",     phone: "Phone",     reask: "Do you confirm, or is there something you'd like to change? ✅" },
      de: { tour: "Tour",    date: "Datum",   pax: "Personen",    adult: "Erwachsener", child: "Kind",    name: "Name",     phone: "Telefon",   reask: "Bestätigen Sie, oder möchten Sie etwas ändern? ✅" },
      ru: { tour: "Тур",     date: "Дата",    pax: "Человек",     adult: "взрослый",    child: "ребёнок", name: "Имя",      phone: "Телефон",   reask: "Подтверждаете или хотите что-то изменить? ✅" },
      ar: { tour: "الجولة", date: "التاريخ", pax: "عدد الأشخاص", adult: "بالغ",        child: "طفل",     name: "الاسم",    phone: "الهاتف",    reask: "هل تؤكد أم تريد تغيير شيء ما؟ ✅" },
      fr: { tour: "Circuit", date: "Date",    pax: "Personnes",   adult: "adulte",      child: "enfant",  name: "Nom",      phone: "Téléphone", reask: "Confirmez-vous, ou souhaitez-vous changer quelque chose ? ✅" },
      es: { tour: "Tour",    date: "Fecha",   pax: "Personas",    adult: "adulto",      child: "niño",    name: "Nombre",   phone: "Teléfono",  reask: "¿Confirma o desea cambiar algo? ✅" },
    };
    const L = _labels[_lang] || _labels.tr;

    const _paxText = _paxAdult !== ""
      ? (typeof _paxChild === "number" && _paxChild > 0
          ? `${_paxAdult} ${L.adult}, ${_paxChild} ${L.child}`
          : `${_paxAdult}`)
      : "";

    const _summaryLines = [
      _tourTitle ? `📋 ${L.tour}: *${_tourTitle}*` : "",
      _dateText  ? `📅 ${L.date}: ${_dateText}`    : "",
      _paxText   ? `👥 ${L.pax}: ${_paxText}`      : "",
      _name      ? `👤 ${L.name}: ${_name}`        : "",
      _phone     ? `📱 ${L.phone}: ${_phone}`      : "",
    ].filter(Boolean).join("\n");

    const reaskReply = `${_summaryLines}\n\n${L.reask}`;
    console.log(`[process-message] :13-PERSIST tetiklendi (CONFIRMING no-op, intent=${nluResult.intent}, özet tekrar)`);
    await _save(reaskReply, newContext);
    await adapter.sendResponse(reaskReply);
    return { success: true, response: reaskReply, newContext };
  }

  // === 14. REZERVASYON KAYDET (COMPLETED) ===
  const justCompleted =
    newContext.stage === "COMPLETED" && newContext.reservationConfirmed && context.stage !== "COMPLETED";

  // K6: PII masking — isim/telefon log'a çıkmasın, sadece "var/yok" durumu
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

    // KRİTİK: Telefon format koruması — placeholder/bozuk değer DB'ye yazılmasın
    const _phoneDigits = reservationPhone.replace(/[\s\-\(\)\.]/g, "");
    const _phoneOk = /^\+?\d{7,15}$/.test(_phoneDigits);
    if (reservationPhone && !_phoneOk) {
      // K6: PII masking
      console.error("[process-message] Invalid phone format — requeuing for phone collection", {
        regPhone: maskPhone(regPhone),
        identifier: maskPhone(adapter.identifier),
        reservationPhone: maskPhone(reservationPhone),
      });
      newContext.stage = "COLLECTING_INFO";
      newContext.reservationConfirmed = false;
      newContext.collectionStep = "waiting_for_phone";
      if (newContext.reservationInfo) newContext.reservationInfo.phone = undefined;
      const _phMsgs: Record<string, string> = {
        tr: "Telefon numaranızı net olarak alamadım, lütfen tekrar yazar mısınız? 📱 (örn: 0555 123 45 67)",
        en: "I couldn't get your phone number clearly, please send it again. 📱 (e.g., +90 555 123 45 67)",
        de: "Ich konnte Ihre Telefonnummer nicht klar erfassen, bitte erneut senden. 📱",
        ru: "Не удалось получить номер телефона, отправьте ещё раз. 📱",
        ar: "لم أتمكن من الحصول على رقم هاتفك بوضوح، يرجى إعادة كتابته. 📱",
        fr: "Je n'ai pas pu obtenir votre numéro de téléphone, veuillez l'envoyer à nouveau. 📱",
        es: "No pude obtener su número de teléfono, por favor envíelo de nuevo. 📱",
      };
      const _phReply = _phMsgs[newContext.language] || _phMsgs.tr;
      await _save(_phReply, newContext);
      await adapter.sendResponse(_phReply);
      return { success: false, error: "invalid_phone", response: _phReply, newContext };
    }

    // BUG 1 FIX (Hayriye case, 2026-06-XX): missingStep hesaplanırken state'in
    // context.reservationInfo'sundan FALLBACK al. Eğer newContext.reservationInfo'da
    // bir alan eksik gözüküyor AMA önceki context.reservationInfo'da DOLU ise,
    // yeniden topla yerine eski değeri kullan. CONFIRMING→COMPLETED action'ı
    // reservationInfo'ya dokunmaz; ama bug 2 bypass'ları varsa fullName'in başka
    // bir transition'da kaybolma riski savunmacı olarak kapatılır.
    const oldInfo = (context.reservationInfo || {}) as any;
    const effFullName = fullName || oldInfo.fullName;
    const effPaxAdult = paxAdult || oldInfo.paxAdult;
    const effDateId   = dateId   || oldInfo.dateId;
    const effPhone    = reservationPhone || oldInfo.phone;
    if (effFullName && !fullName) {
      console.warn("[process-message] BUG1 SAFETY: fullName missing from newContext but present in old context — restoring");
      if (newContext.reservationInfo) newContext.reservationInfo.fullName = effFullName;
    }

    // R6: paxAdult/phone için tek-helper FORMAT validasyonu — kayıt-anı son sigorta.
    // Eğer invalid değer state'e sızdıysa (üçüncü path/edge bypass), buradan
    // re-collect'e yönlendir. RPC'ye geçersiz değer geçmez.
    const missingStep = !tourId ? "waiting_for_date"  // tourId yoksa tur seçimi eksik
      : !effDateId ? "waiting_for_date"
      : !isValidPax(effPaxAdult) ? "waiting_for_pax"
      : !effFullName ? "waiting_for_name"
      : !isValidPhone(effPhone) ? "waiting_for_phone"
      : null;
    console.log("[process-message] reservation missingStep:", missingStep, "| tourId:", tourId, "| dateId:", dateId);

    if (missingStep) {
      newContext.stage = "COLLECTING_INFO";
      newContext.reservationConfirmed = false;
      newContext.collectionStep = missingStep as any;
      const missMsgs: Record<string, string> = {
        tr: "Rezervasyonu tamamlayabilmem için eksik bilgileri adım adım tamamlayalım.",
        en: "Let's complete the missing details to finalize your reservation.",
        de: "Lassen Sie uns die fehlenden Angaben für Ihre Reservierung ergänzen.",
        ru: "Давайте заполним недостающие данные для завершения бронирования.",
        ar: "دعنا نكمل البيانات الناقصة لإتمام حجزك.",
        fr: "Complétez les informations manquantes pour finaliser votre réservation.",
        es: "Completemos los datos que faltan para finalizar su reserva.",
      };
      const missReply = missMsgs[newContext.language] || missMsgs.tr;
      await _save(missReply, newContext);
      await adapter.sendResponse(missReply);
      return { success: true, response: missReply, newContext };
    }

    // FIX 2: Tur ve tarih hâlâ yüklü listede var mı? Bayat state koruması.
    const _tourInList = tours.find((t: any) => t.id === tourId);
    const _dateInList = _tourInList?.dates?.find((d: any) => d.id === dateId);
    if (!_tourInList || !_dateInList) {
      console.warn("[process-message] Stale state: tour/date no longer in loaded list", { tourId, dateId });
      newContext.stage = "BROWSING";
      newContext.currentTour = null;
      newContext.reservationInfo = {};
      newContext.reservationConfirmed = false;
      newContext.collectionStep = undefined;
      const _staleMsgs: Record<string, string> = {
        tr: "Bilgileriniz güncellenmiş olabilir, baştan bakalım — hangi turlar ilginizi çeker?",
        en: "Your information may have been updated. Let's start fresh — which tours interest you?",
        de: "Ihre Informationen haben sich möglicherweise geändert. Fangen wir von vorne an — welche Touren interessieren Sie?",
        ru: "Ваши данные могли измениться. Начнём заново — какие туры вас интересуют?",
        ar: "قد تكون معلوماتك قد تغيرت. لنبدأ من جديد — ما الجولات التي تهمك؟",
        fr: "Vos informations ont peut-être changé. Recommençons — quels circuits vous intéressent ?",
        es: "Su información puede haber cambiado. Empecemos de nuevo — ¿qué tours le interesan?",
      };
      const _staleReply = _staleMsgs[newContext.language] || _staleMsgs.tr;
      await _save(_staleReply, newContext);
      await adapter.sendResponse(_staleReply);
      return { success: false, error: "stale_state", response: _staleReply, newContext };
    }

    const totalPax = (paxAdult || 0) + (newContext.reservationInfo.paxChild || 0);
    // K3: total_amount SNAPSHOT — rezervasyon kaydında "o anki fiyat" korunur.
    // tours.find ile child fiyatına da ulaşırız (calculateTotal pax dağılımını destekler).
    const _selDateForRpc = tours
      .find((tr: any) => tr.id === tourId)
      ?.dates?.find((d: any) => d.id === dateId);
    const _totalAmountForRpc = calculateTotal(
      paxAdult || 0,
      _selDateForRpc?.price_adult,
      newContext.reservationInfo.paxChild || 0,
      _selDateForRpc?.price_child,
    );
    // K6: fullName loga çıkmasın, sadece "var/yok" durumu
    console.log("[process-message] calling create_reservation RPC:", { tourId, dateId, hasName: !!fullName, totalPax, totalAmount: _totalAmountForRpc, agencyId: agency.id });
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
        p_total_amount: _totalAmountForRpc > 0 ? _totalAmountForRpc : null,
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
        const _quotaTour = tours.find((t: any) => t.id === tourId);
        let _altDates = "";
        if (_quotaTour?.dates && _quotaTour.dates.length > 1) {
          const _qRates = await getExchangeRatesOnce().catch(() => ({}));
          const _qDual = agency.show_multi_currency !== false;
          // 2026-06-22 Sorun H DRY: inline filter → hasQuotaForPax helper (Murat A ilkesi)
          _altDates = "\n\n" + _quotaTour.dates
            .filter((d: any) => d.id !== dateId && hasQuotaForPax(d, 1))
            .map((d: any, i: number) => {
              const dt = formatDateForLanguage(d.departure_date, lang);
              const pr = d.price_adult
                ? ` - ${formatPriceSync(d.price_adult, _quotaTour.currency || "TRY", lang, _qRates, _qDual, languageCurrencies)}`
                : "";
              return `${i + 1}) ${dt}${pr}`;
            })
            .join("\n");
        }
        const _msgs: Record<string, string> = {
          tr: `Üzgünüm, seçtiğiniz tarih için kontenjan dolmuş. 😔 Başka bir tarih seçer misiniz?${_altDates}`,
          en: `Sorry, the date you selected is fully booked. 😔 Could you choose another date?${_altDates}`,
          de: `Es tut mir leid, das gewählte Datum ist ausgebucht. 😔 Bitte ein anderes Datum wählen.${_altDates}`,
          ru: `Извините, выбранная дата уже занята. 😔 Выберите другую дату.${_altDates}`,
          ar: `آسف، التاريخ محجوز بالكامل. 😔 اختر تاريخاً آخر.${_altDates}`,
          fr: `Désolé, la date est complète. 😔 Choisissez une autre date.${_altDates}`,
          es: `Lo siento, la fecha está completa. 😔 Elija otra fecha.${_altDates}`,
        };
        errorReply = _msgs[lang] || _msgs.tr;
      } else if (errCode === "DUPLICATE") {
        newContext.stage = "BROWSING";
        newContext.reservationConfirmed = false;
        newContext.reservationInfo = {};
        const _msgs: Record<string, string> = {
          tr: `Bu tur için zaten kayıtlı görünüyorsunuz. ℹ️ Detaylar için ${agency.name} ile iletişime geçin.${agPhone}`,
          en: `You appear to already be registered for this tour. ℹ️ Please contact ${agency.name}.${agPhone}`,
          de: `Sie scheinen bereits für diese Tour angemeldet zu sein. ℹ️ Bitte kontaktieren Sie ${agency.name}.${agPhone}`,
          ru: `Похоже, вы уже записаны на этот тур. ℹ️ Обратитесь в ${agency.name}.${agPhone}`,
          ar: `يبدو أنك مسجل بالفعل في هذه الجولة. ℹ️ يرجى التواصل مع ${agency.name}.${agPhone}`,
          fr: `Vous semblez déjà inscrit pour ce circuit. ℹ️ Contactez ${agency.name}.${agPhone}`,
          es: `Parece que ya está registrado para este tour. ℹ️ Contacte con ${agency.name}.${agPhone}`,
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
          de: "Das gewählte Datum ist nicht mehr verfügbar. 😔 Bitte wählen Sie ein anderes Datum.",
          ru: "Выбранная дата больше недоступна. 😔 Выберите другую дату.",
          ar: "التاريخ المحدد لم يعد متاحاً. 😔 يرجى اختيار تاريخ آخر.",
          fr: "La date choisie n'est plus disponible. 😔 Veuillez choisir une autre date.",
          es: "La fecha seleccionada ya no está disponible. 😔 Elija otra fecha.",
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
          de: "Die gewählte Tour ist nicht mehr verfügbar. 😔 Schauen Sie sich unsere aktuellen Touren an.",
          ru: "Выбранный тур больше не доступен. 😔 Ознакомьтесь с нашими актуальными турами.",
          ar: "الجولة المحددة لم تعد متاحة. 😔 يرجى الاطلاع على جولاتنا الحالية.",
          fr: "Le circuit sélectionné n'est plus disponible. 😔 Consultez nos circuits actuels.",
          es: "El tour seleccionado ya no está disponible. 😔 Consulte nuestros tours actuales.",
        };
        errorReply = _msgs[lang] || _msgs.tr;
      } else {
        newContext.stage = context.stage;
        newContext.reservationConfirmed = false;
        const _msgs: Record<string, string> = {
          tr: `Rezervasyonunuz oluşturulurken bir sorun yaşandı. Lütfen ${agency.name} ile iletişime geçiniz.${agPhone}`,
          en: `There was an issue creating your reservation. Please contact ${agency.name}.${agPhone}`,
          de: `Bei Ihrer Reservierung ist ein Problem aufgetreten. Bitte kontaktieren Sie ${agency.name}.${agPhone}`,
          ru: `При создании бронирования возникла ошибка. Обратитесь в ${agency.name}.${agPhone}`,
          ar: `حدثت مشكلة أثناء إنشاء حجزك. يرجى التواصل مع ${agency.name}.${agPhone}`,
          fr: `Un problème est survenu lors de la réservation. Contactez ${agency.name}.${agPhone}`,
          es: `Hubo un problema al crear su reserva. Contacte con ${agency.name}.${agPhone}`,
        };
        errorReply = _msgs[lang] || _msgs.tr;
      }
      await _save(errorReply, newContext);
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
    const tourTitle = getLocalizedTourTitle(
      selectedTourFull?.title || newContext.reservationInfo.tourTitle || "-",
      newContext.language,
    );
    const emailLine = newContext.reservationInfo.email ? `\n• *Email:* ${newContext.reservationInfo.email}` : "";

    // Toplam tutar hesabı (completion mesajı için — payment block ile aynı formül)
    const _totalPrice = adultCount * (selectedDateFull?.price_adult || 0) +
      childCount * (selectedDateFull?.price_child || selectedDateFull?.price_adult || 0);
    const _tourCurrencyCode = selectedTourFull?.currency || "TRY";
    const _exRatesTotal = await getExchangeRatesOnce().catch(() => ({}));
    const _showDualTotal = agency.show_multi_currency !== false;
    const _totalText = _totalPrice > 0
      ? formatPriceSync(_totalPrice, _tourCurrencyCode, newContext.language, _exRatesTotal, _showDualTotal, languageCurrencies)
      : "";
    const _totalLabels: Record<string, string> = {
      tr: "Toplam", en: "Total", de: "Gesamt", ru: "Итого",
      ar: "الإجمالي", fr: "Total", es: "Total",
    };
    const _totalLine = _totalText
      ? `\n• *${_totalLabels[newContext.language] || _totalLabels.en}:* ${_totalText}`
      : "";

    // Yeni kompakt format: tek başlık + özet + toplam (tekrar YOK)
    const completionMsgs: Record<string, string> = {
      tr: `✅ *Rezervasyonunuz onaylandı, ${fullName || ""}!* 🎉\n\n• *Tur:* ${tourTitle}\n• *Tarih:* ${formattedDate}\n• *Kişi:* ${paxText}\n• *Telefon:* ${reservationPhone || "-"}${emailLine}${_totalLine}`,
      en: `✅ *Reservation confirmed, ${fullName || ""}!* 🎉\n\n• *Tour:* ${tourTitle}\n• *Date:* ${formattedDate}\n• *People:* ${paxText}\n• *Phone:* ${reservationPhone || "-"}${emailLine}${_totalLine}`,
      de: `✅ *Reservierung bestätigt, ${fullName || ""}!* 🎉\n\n• *Tour:* ${tourTitle}\n• *Datum:* ${formattedDate}\n• *Personen:* ${paxText}\n• *Telefon:* ${reservationPhone || "-"}${emailLine}${_totalLine}`,
      ru: `✅ *Бронирование подтверждено, ${fullName || ""}!* 🎉\n\n• *Тур:* ${tourTitle}\n• *Дата:* ${formattedDate}\n• *Количество:* ${paxText}\n• *Телефон:* ${reservationPhone || "-"}${emailLine}${_totalLine}`,
      ar: `✅ *تم تأكيد حجزك، ${fullName || ""}!* 🎉\n\n• *الجولة:* ${tourTitle}\n• *التاريخ:* ${formattedDate}\n• *الأشخاص:* ${paxText}\n• *الهاتف:* ${reservationPhone || "-"}${emailLine}${_totalLine}`,
      fr: `✅ *Réservation confirmée, ${fullName || ""}!* 🎉\n\n• *Circuit:* ${tourTitle}\n• *Date:* ${formattedDate}\n• *Personnes:* ${paxText}\n• *Téléphone:* ${reservationPhone || "-"}${emailLine}${_totalLine}`,
      es: `✅ *Reserva confirmada, ${fullName || ""}!* 🎉\n\n• *Tour:* ${tourTitle}\n• *Fecha:* ${formattedDate}\n• *Personas:* ${paxText}\n• *Teléfono:* ${reservationPhone || "-"}${emailLine}${_totalLine}`,
    };

    let completionReply = completionMsgs[newContext.language] || completionMsgs.tr;

    // Ödeme bilgisi
    if (paymentInstructions && selectedDateFull) {
      // K5: deposit_percentage 0-100 dışındaysa güvenli varsayılan
      const depPct = safeDepositPercentage(
        typeof paymentInstructions === "object" ? paymentInstructions?.deposit_percentage : null
      );
      // K4: TEK kaynak — calculateTotal/Deposit (önceki Math.ceil tutarsızlığı giderildi)
      const totalPrice = calculateTotal(
        adultCount,
        selectedDateFull.price_adult,
        childCount,
        selectedDateFull.price_child,
      );
      const depositAmt = calculateDeposit(totalPrice, depPct);
      // O3: price NULL/0 ise totalPrice=0 → ödeme mesajı atlanır (rezervasyon halen kayıtlı
      // ama müşteri yanlış kapora görmez). Acente paneli "Birim Fiyat boş" uyarısı verir.
      if (totalPrice <= 0) {
        console.warn("[process-message] O3: skipping payment message — totalPrice=0", {
          adultCount, childCount,
          priceAdult: selectedDateFull.price_adult, priceChild: selectedDateFull.price_child,
          dateId: selectedDateFull.id,
        });
      }
      if (totalPrice > 0) {
        const payMsg = await generatePaymentMessage(
          paymentInstructions, newContext.language, totalPrice, depositAmt,
          selectedTourFull?.currency || "TRY",
          { languageCurrencies, primaryCurrency, agencyPhone: agency.phone_public }
        );
        if (payMsg) {
          completionReply += payMsg;
          newContext.paymentInfoSent = true;
        }
      }
    }

    // Kanal-spesifik template eki (WhatsApp message_templates)
    if (adapter.getCompletionTemplateAddendum) {
      // K5: deposit_percentage 0-100 dışındaysa güvenli varsayılan
      const _depPct2 = safeDepositPercentage(
        typeof paymentInstructions === "object" ? paymentInstructions?.deposit_percentage : null
      );
      // K4: tek kaynak
      const _tPrice = calculateTotal(
        adultCount,
        selectedDateFull?.price_adult,
        childCount,
        selectedDateFull?.price_child,
      );
      const tmpl = await adapter.getCompletionTemplateAddendum({
        tourId: tourId || "",
        tourTitle: tourTitle,
        dateId: dateId || "",
        formattedDate: formattedDate,
        fullName: fullName || "",
        pax: adultCount + childCount,
        totalPrice: _tPrice,
        currency: selectedTourFull?.currency || "TRY",
        language: newContext.language,
        agencyId: agency.id,
      }).catch(() => null);
      if (tmpl) completionReply += "\n\n" + tmpl;
    }

    // İletişim footer (agency.phone_public varsa)
    if (agency.phone_public) {
      const _contactLabels: Record<string, string> = {
        tr: "Sorularınız için",
        en: "For questions",
        de: "Bei Fragen",
        ru: "По вопросам",
        ar: "للأسئلة",
        fr: "Pour vos questions",
        es: "Para consultas",
      };
      const _contactLabel = _contactLabels[newContext.language] || _contactLabels.en;
      completionReply += `\n\n📞 ${_contactLabel}: ${agency.phone_public}`;
    }

    await _save(completionReply, newContext);
    await adapter.sendResponse(completionReply);
    return { success: true, response: completionReply, newContext };
  }

  // === 14a. O9 — AFTER-SALES İPTAL/DEĞİŞİKLİK DETERMİNİSTİK MESAJ ===
  // Müşteri COMPLETED stage'inde "iptal et", "değiştir" gibi mesaj attı.
  // BOT DB'DE STATUS DEĞİŞTİRMEZ (güvenlik). Talebi acenteye yönlendirir +
  // complaints tablosuna kayıt bırakır (panel'de görünür). Kontenjan/K4 trigger'ı
  // acente CANCELLED yaptığında zaten doğru çalışıyor.
  //
  // 2026-06-24 FIX 2b (SORUN 3 — exec ffb73402):
  //   "iptal şartları nedir?" → NLU cancellation_policy → FSM general_question.
  //   _bookingActionRe "iptal" kelimesini yakalıyordu → bilgi sorusunu "talep" sayıp
  //   "Talebinizi aldık ✅..." yanlış mesajı atıyordu. Bug C (detectCancellationGuarded)
  //   ile aynı niyet/bilgi ayrımı sorunu — tutarlı guard: FSM intent general_question
  //   ise bu bypass'ı atla, LLM after-sales prompt'uyla cevaplasın.
  if (
    context.stage === "COMPLETED" &&
    newContext.stage === "COMPLETED" &&
    fsmIntent !== "general_question"   // bilgi sorgulama (cancellation_policy/faq/...) — LLM cevaplasın
  ) {
    const _msgLower = message.toLowerCase();
    const _bookingActionRe = /\b(iptal|cancel|annul|annuler|cancelar|stornier|отмен|إلغاء|إلغ)|değiştir|change|modif|cambiar|ändern|изменить|تعديل|تغيير\b/i;
    const _isCancelOrChange = _bookingActionRe.test(_msgLower);
    if (_isCancelOrChange) {
      const _agPhone = agency.phone_public ? ` 📞 ${agency.phone_public}` : "";
      const _ackMsgs: Record<string, string> = {
        tr: `Talebinizi aldık ✅ Acentemiz en kısa sürede sizinle iletişime geçecek. Acil durumlar için doğrudan arayabilirsiniz.${_agPhone}`,
        en: `We've received your request ✅ Our agency will contact you shortly. For urgent matters, please call us directly.${_agPhone}`,
        de: `Wir haben Ihre Anfrage erhalten ✅ Unsere Agentur wird sich in Kürze mit Ihnen in Verbindung setzen. Bei dringenden Anliegen rufen Sie uns bitte direkt an.${_agPhone}`,
        ru: `Мы получили ваш запрос ✅ Наше агентство свяжется с вами в ближайшее время. По срочным вопросам звоните напрямую.${_agPhone}`,
        ar: `لقد استلمنا طلبك ✅ ستتواصل وكالتنا معك في أقرب وقت. للأمور العاجلة يرجى الاتصال مباشرة.${_agPhone}`,
        fr: `Nous avons bien reçu votre demande ✅ Notre agence vous contactera prochainement. Pour les urgences, appelez-nous directement.${_agPhone}`,
        es: `Hemos recibido su solicitud ✅ Nuestra agencia se pondrá en contacto con usted en breve. Para asuntos urgentes, llámenos directamente.${_agPhone}`,
      };
      const _ackReply = _ackMsgs[newContext.language] || _ackMsgs.tr;

      // Complaint kaydı (panel'de "açık talep" olarak görünür)
      supabase.from("complaints").insert({
        agency_id: agency.id,
        phone: adapter.identifier,
        message,
        type: "after_sales_action",
        status: "new",
      }).then(() => {}, () => {});

      await _save(_ackReply, newContext);
      await adapter.sendResponse(_ackReply);
      return { success: true, response: _ackReply, newContext };
    }
  }

  // === 14a-3. COMPLETED'de DEĞİŞİKLİK TALEBİ → ACENTE YÖNLENDİRME ===
  // 2026-06-24 KARAR (Murat — exec ea455bf9 sonrası yön değişikliği):
  //   Rezervasyon ONAYLANDIKTAN SONRA isim/telefon/tarih/pax değişikliği DB'ye
  //   yazılmış kaydı etkilemez (bot DB güncellemiyor). State'te değiştirmek
  //   yalan vaat üretir. Bunun yerine acenteye yönlendir.
  //
  // YAKALAMA KOŞULLARI (intent-bazlı, regex'ten bağımsız):
  //   - intent === "change_info" → açık değişiklik niyeti
  //   - intent === "provide_info" + (extracted.fullName/phone/dateId/paxAdult mevcuttan FARKLI)
  //     → "aslında adım Osman" gibi örtük değişiklik
  //
  // INTENT AYRIMI (KRİTİK — yeni rezervasyon yutmasın):
  //   - tour_search / reservation_intent → YENİ REZERVASYON niyeti, ATLA
  //     (state-machine COMPLETED→TOUR_SELECTED/BROWSING zaten yeni akışı başlatır)
  //   - general / greeting → Bug A bypass (14a-2) yakalar, ATLA
  //   - general_question (cancellation_policy/payment_methods/faq bilgi sorgu) → ATLA
  //     (LLM after-sales prompt'uyla cevaplar — Fix 2 korunur)
  //   - support_request (after_sales eylem — ödedim/dekont) → 14a yakalamış olabilir
  //     veya LLM cevap; bu bypass ATLA (değişiklik talebi değil)
  if (
    context.stage === "COMPLETED" &&
    newContext.stage === "COMPLETED" &&
    newContext.reservationConfirmed === true
  ) {
    const _curInfo = newContext.reservationInfo || {};
    const _ext = (extractedInfo as any) || {};
    const _isFullNameChange =
      !!_ext.fullName && !!_curInfo.fullName && _ext.fullName !== _curInfo.fullName;
    const _isPhoneChange =
      !!_ext.phone && !!_curInfo.phone && _ext.phone !== _curInfo.phone;
    const _isPaxChange =
      !!_ext.paxAdult && !!_curInfo.paxAdult && _ext.paxAdult !== _curInfo.paxAdult;
    const _isDateChange =
      !!_ext.dateId && !!_curInfo.dateId && _ext.dateId !== _curInfo.dateId;
    const _anyFieldChange = _isFullNameChange || _isPhoneChange || _isPaxChange || _isDateChange;

    const _isChangeRequest =
      nluResult.intent === "change_info" ||
      (nluResult.intent === "provide_info" && _anyFieldChange);

    if (_isChangeRequest) {
      const _agPhone = agency.phone_public ? ` 📞 ${agency.phone_public}` : "";
      const _redirectMsgs: Record<string, string> = {
        tr: `Rezervasyonunuz onaylandı ✅ İsim, telefon veya diğer bilgilerde değişiklik için lütfen acentemizle iletişime geçin.${_agPhone}`,
        en: `Your reservation is confirmed ✅ For changes to name, phone or other details, please contact our agency directly.${_agPhone}`,
      };
      const _redirectReply = _redirectMsgs[newContext.language] || _redirectMsgs.tr;
      const _changedFields = [
        _isFullNameChange ? "fullName" : null,
        _isPhoneChange ? "phone" : null,
        _isPaxChange ? "pax" : null,
        _isDateChange ? "date" : null,
      ].filter(Boolean).join(",") || "intent-only";
      console.log(`[process-message] 14a-3 COMPLETED değişiklik → acente yönlendirme (intent=${nluResult.intent}, fields=${_changedFields})`);

      // Complaint kaydı — acente panelde görsün
      supabase.from("complaints").insert({
        agency_id: agency.id,
        phone: adapter.identifier,
        message,
        type: "after_sales_action",
        status: "new",
      }).then(() => {}, () => {});

      await _save(_redirectReply, newContext);
      await adapter.sendResponse(_redirectReply);
      return { success: true, response: _redirectReply, newContext };
    }
  }

  // === 14a-2. BUG A FIX — COMPLETED after-sales ack (general/greeting) ===
  // 2026-06-23 (exec 4858c2f0 kanıtı): COMPLETED'de "teşekkürler" → NLU intent=general
  // → state-machine transition #4 (eskiden general/greeting allow-list'te) tetikleniyor,
  // resetForNewReservation reservationInfo={} → state UÇUYOR → LLM BROWSING prompt'unda
  // "telefon ver" diye saçma soru üretiyordu.
  //
  // İki katmanlı fix:
  //   1. state-machine.ts: transition #4 allow-list daraltıldı (greeting/general çıktı)
  //      → state-machine artık no-op kalır (COMPLETED → COMPLETED).
  //   2. Burada (process-message): no-op senaryosunda deterministik kapanış mesajı,
  //      LLM atlanır, state OLDUĞU GİBİ KORUNUR (reservationInfo değişmez).
  //
  // ALLOW-LIST: sadece general + greeting. Meşru after-sales niyetleri yutmaz:
  //   - tour_search/browse_tours → state-machine BROWSING'e geçirir (yeni tur akışı)
  //   - reservation_intent + tur → state-machine TOUR_SELECTED'a geçirir
  //   - change_info/cancellation → mevcut 14a after-sales bypass yakalar (yukarıda)
  //   - faq_general/payment_methods/... → LLM after-sales kuralları cevaplar
  //   - provide_info → riskli, LLM yorumlasın (yeni rezervasyon başlatıyor olabilir)
  //
  // STATE: SİLİNMEZ. reservationConfirmed=true + reservationInfo dolu kalır → kullanıcı
  // sonraki turn "iptal" derse 14a bypass çalışır, "başka tur" derse state-machine
  // yeni rezervasyon yoluna geçirir.
  if (
    context.stage === "COMPLETED" &&
    newContext.stage === "COMPLETED" &&
    newContext.reservationConfirmed === true &&
    (nluResult.intent === "general" || nluResult.intent === "greeting")
  ) {
    // TR + EN, diğer 5 dil çok-dil eşitleme fazına bırakıldı (TR fallback).
    const _ackBugAMsgs: Record<string, string> = {
      tr: "Rezervasyonunuz tamamlandı ✅ Başka bir konuda yardımcı olabilir miyim?",
      en: "Your reservation is complete ✅ Is there anything else I can help with?",
    };
    const _ackBugAReply = _ackBugAMsgs[newContext.language] || _ackBugAMsgs.tr;
    console.log(`[process-message] COMPLETED after-sales ack → deterministik kapanış (intent=${nluResult.intent})`);
    await _save(_ackBugAReply, newContext);
    await adapter.sendResponse(_ackBugAReply);
    return { success: true, response: _ackBugAReply, newContext };
  }

  // === 14b. FIX 3 — SAHTE ONAY GUARD (DEFANSİF, state-koruyan) ===
  // 2026-06-25 inceleme + yeniden yazım (Murat kararı: state-koruyan versiyon):
  //
  // ESKI DAVRANIŞ (64c51841, 2026-05-21): tetiklendiğinde BROWSING reset yapardı —
  // tour + reservationInfo (date/pax/name/phone) + reservationConfirmed HEPSI silinirdi.
  // Yanlış tetiklenirse KATASTROFİK veri kaybı. Tetikleme koşulu (detectConfirmation
  // TRUE + !justCompleted) state-machine ve buradaki çağrı tutarsızlığı gerektiriyor —
  // teoride imkânsız (aynı sync fonksiyon). Canlı log'da `FIX3` hiç görülmedi.
  //
  // YENİ DAVRANIŞ: state KORU + özet+onay tekrar (Bug C pattern :13-PERSIST gibi).
  // Edge case'de bile veri kaybı yok. Kullanıcıya alarmist hata mesajı yerine
  // normal "onaylıyor musunuz?" sorusu gider.
  //
  // Sonraki savunma katmanları zaten LLM uydurma riskini kapsıyor:
  //   - B-6 detectNegativeResponse (CONFIRMING + "hayır" → netleştirme)
  //   - :13-PERSIST (CONFIRMING + ambiguous intent → özet+onay tekrar)
  //   - K4 validateFieldReask (CONFIRMING/COMPLETED'de dolu-alan yutkunması)
  //   - Fix A1 historyCutoffAt (history kirlenmesi)
  // Bu guard ARTIK son katman değil, INSURANCE — gerçekten tetiklenmezse pasif kalır.
  if (
    context.stage === "CONFIRMING" &&
    !justCompleted &&
    detectConfirmation(message, context.language)
  ) {
    console.warn(
      `[process-message] FIX3: detectConfirmation TRUE but FSM didn't complete ` +
      `(newStage=${newContext.stage}). State KORUNUYOR, özet+onay tekrar.`,
    );
    // STATE KORU — yeni değişkenle context'e geri çek (transition farklı yere
    // götürdüyse de eski CONFIRMING bilgileri korunur; reservationInfo silinmez).
    const _preservedContext: ConversationContext = {
      ...context,
      lastUserMessage: message,
      messageCount: context.messageCount + 1,
      lastUpdated: new Date().toISOString(),
    };
    // Özet+onay tekrar — :13-PERSIST ile aynı format (tutarlı görünüm).
    const _lang = _preservedContext.language || "tr";
    const info = (_preservedContext.reservationInfo as any) || {};
    const _tourTitle = _preservedContext.currentTour
      ? getLocalizedTourTitle(_preservedContext.currentTour.title || "", _lang)
      : "";
    const _dateText = info.selectedDate ? formatDateForLanguage(info.selectedDate, _lang) : "";
    const _paxAdult = info.paxAdult ?? "";
    const _paxChild = info.paxChild;
    const _name = info.fullName || "";
    const _phone = info.phone || "";

    const _fix3Labels: Record<string, { tour: string; date: string; pax: string; adult: string; child: string; name: string; phone: string; reask: string }> = {
      tr: { tour: "Tur",     date: "Tarih",   pax: "Kişi sayısı", adult: "yetişkin",    child: "çocuk",   name: "Ad-Soyad", phone: "Telefon",   reask: "Onaylıyor musunuz, yoksa değiştirmek istediğiniz bir şey var mı? ✅" },
      en: { tour: "Tour",    date: "Date",    pax: "People",      adult: "adult",       child: "child",   name: "Name",     phone: "Phone",     reask: "Do you confirm, or is there something you'd like to change? ✅" },
      de: { tour: "Tour",    date: "Datum",   pax: "Personen",    adult: "Erwachsener", child: "Kind",    name: "Name",     phone: "Telefon",   reask: "Bestätigen Sie, oder möchten Sie etwas ändern? ✅" },
      ru: { tour: "Тур",     date: "Дата",    pax: "Человек",     adult: "взрослый",    child: "ребёнок", name: "Имя",      phone: "Телефон",   reask: "Подтверждаете или хотите что-то изменить? ✅" },
      ar: { tour: "الجولة", date: "التاريخ", pax: "عدد الأشخاص", adult: "بالغ",        child: "طفل",     name: "الاسم",    phone: "الهاتف",    reask: "هل تؤكد أم تريد تغيير شيء ما؟ ✅" },
      fr: { tour: "Circuit", date: "Date",    pax: "Personnes",   adult: "adulte",      child: "enfant",  name: "Nom",      phone: "Téléphone", reask: "Confirmez-vous, ou souhaitez-vous changer quelque chose ? ✅" },
      es: { tour: "Tour",    date: "Fecha",   pax: "Personas",    adult: "adulto",      child: "niño",    name: "Nombre",   phone: "Teléfono",  reask: "¿Confirma o desea cambiar algo? ✅" },
    };
    const L = _fix3Labels[_lang] || _fix3Labels.tr;
    const _paxText = _paxAdult !== ""
      ? (typeof _paxChild === "number" && _paxChild > 0
          ? `${_paxAdult} ${L.adult}, ${_paxChild} ${L.child}`
          : `${_paxAdult}`)
      : "";
    const _summaryLines = [
      _tourTitle ? `📋 ${L.tour}: *${_tourTitle}*` : "",
      _dateText  ? `📅 ${L.date}: ${_dateText}`    : "",
      _paxText   ? `👥 ${L.pax}: ${_paxText}`      : "",
      _name      ? `👤 ${L.name}: ${_name}`        : "",
      _phone     ? `📱 ${L.phone}: ${_phone}`      : "",
    ].filter(Boolean).join("\n");
    const fix3Reply = `${_summaryLines}\n\n${L.reask}`;
    await _save(fix3Reply, _preservedContext);
    await adapter.sendResponse(fix3Reply);
    return { success: true, response: fix3Reply, newContext: _preservedContext };
  }

  // === 15. SYSTEM PROMPT ===
  const currentTourFull = newContext.currentTour ? findTourById(newContext.currentTour.id, tours) : null;
  // BUG 6: AI prompt'una giden reservationInfo'da tur adını hedef dile çevir
  // Bu olmadan CONFIRMING özeti her zaman TR tur adı gösteriyor
  const _promptReservationInfo = newContext.reservationInfo?.tourTitle
    ? {
        ...newContext.reservationInfo,
        tourTitle: getLocalizedTourTitle(newContext.reservationInfo.tourTitle, newContext.language),
      }
    : newContext.reservationInfo;

  const promptContext = {
    stage: newContext.stage,
    collectionStep: newContext.collectionStep,
    currentTour: currentTourFull || newContext.currentTour,
    reservationInfo: _promptReservationInfo,
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
    previousContext,
  };

  let tourSwitchWarning = "";
  if (newContext.stage === "COLLECTING_INFO" && selectedTour && newContext.currentTour &&
      selectedTour.id !== newContext.currentTour.id) {
    tourSwitchWarning = newContext.language === "tr"
      ? `\n\n🚨 KRİTİK: Kullanıcı "${newContext.currentTour.title}" için rezervasyon yapıyor ama "${selectedTour.title}" hakkında bir şey söyledi. Tur değişikliği için onay iste!`
      : `\n\n🚨 CRITICAL: User is booking "${newContext.currentTour.title}" but mentioned "${selectedTour.title}". Ask for confirmation!`;
  }

  // Stage geçiş farkındalığı: yeni rezervasyon, after-sales, bilgi değişikliği
  const completedStagePrompt = buildTransitionPrompt(promptContext as any);

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

  // B1: Akış ortası bilgi sorusu — AI'ya adıma dönüş ipucu
  // T10 FIX: collectionStep tutma şartı KALDIRILDI — sadece stage korunması yeterli.
  // NLU soruyu farklı intent'e maplerse (örn. provide_info→general_question) collectionStep
  // değişebilir; B1 yine de enjekte edilmeli ki AI soruyu cevaplayıp toplanan adıma dönsün.
  // Yeni-rezervasyon (B2) / iptal (justCancelled) / sahte-onay (FIX3) yolları yukarıdaki erken
  // return'lerle zaten yakalanır — buraya düşmez, B1 yanlışlıkla onları yakalamaz.
  let midFlowReturnPrompt = "";
  if (
    (context.stage === "COLLECTING_INFO" || context.stage === "CONFIRMING") &&
    newContext.stage === context.stage
  ) {
    const _stepHints: Record<string, Record<string, string>> = {
      waiting_for_date:  { tr: "tarih seçimini", en: "date selection", de: "Datum", ru: "выбор даты", ar: "اختيار التاريخ", fr: "choix de la date", es: "selección de fecha" },
      waiting_for_pax:   { tr: "kişi sayısını", en: "number of people", de: "Personenzahl", ru: "кол-во человек", ar: "عدد الأشخاص", fr: "nombre de personnes", es: "número de personas" },
      waiting_for_name:  { tr: "adı soyadı", en: "full name", de: "Namen", ru: "полное имя", ar: "الاسم الكامل", fr: "nom complet", es: "nombre completo" },
      waiting_for_phone: { tr: "telefon numarasını", en: "phone number", de: "Telefonnummer", ru: "номер телефона", ar: "رقم الهاتف", fr: "numéro de téléphone", es: "número de teléfono" },
      waiting_for_email: { tr: "email adresini", en: "email address", de: "E-Mail-Adresse", ru: "email", ar: "البريد الإلكتروني", fr: "adresse e-mail", es: "correo electrónico" },
      ready_for_confirmation: { tr: "bilgileri onaylamasını", en: "confirmation of details", de: "Bestätigung", ru: "подтверждение", ar: "التأكيد", fr: "confirmation", es: "confirmación" },
    };
    const _stepHint = newContext.collectionStep && _stepHints[newContext.collectionStep]
      ? (_stepHints[newContext.collectionStep][newContext.language] || _stepHints[newContext.collectionStep].en)
      : null;
    if (_stepHint) {
      midFlowReturnPrompt = newContext.language === "tr"
        ? `\n\n↩️ AKIŞ İPUCU: Soruyu kısa ve net yanıtladıktan sonra MUTLAKA şu adıma dön ve "${_stepHint}" talep et. Toplanan bilgileri UNUTMA.`
        : `\n\n↩️ FLOW HINT: After answering briefly and clearly, ALWAYS return to: request "${_stepHint}". Do NOT forget collected info.`;
    }
  }

  // B3: Off-topic sorularda kısa yanıt direktifi — token israfını önle
  let offTopicBrevityPrompt = "";
  if (
    ["general", "greeting"].includes(_prePromotionIntent) &&
    newContext.stage !== "COMPLETED" &&
    newContext.stage !== "CONFIRMING"
  ) {
    offTopicBrevityPrompt = newContext.language === "tr"
      ? `\n\n⚡ KISA YANIT: Bu mesaj tur/rezervasyon dışı. Maksimum 2 cümle yanıt ver, sonra turlarımıza davet et.`
      : `\n\n⚡ BRIEF REPLY: This message is off-topic. Respond in max 2 sentences, then invite to our tours.`;
  }

  // PROMPT CACHING: prompt'u iki bloğa ayır.
  // - CACHED (gerçek statik prefix): rol/üslup/format/agency/guards/translation directive.
  //   Aynı (agency, language, tone) için her çağrı arası BİT BİT aynı → cache hit.
  // - DYNAMIC (suffix, cache dışı): stage prompt + 6 conditional add-on + multi-tour warning.
  //   Stage prompt eskiden cached prefix'in İÇİNDEYDİ; tourDetails/collectedInfo/summary/
  //   canlı kontenjan her çağrıda değiştiği için cache prefix'i kirletip read=0 yapıyordu.
  //   Şimdi dynamic suffix'in BAŞINA alındı — toplam prompt string'i öncekiyle BİT BİT AYNI,
  //   sadece cached/dynamic blok sınırı kaydı.
  const systemPromptCached = buildSystemPrompt(promptContext as any);
  const _stagePrompt = getStagePrompt(promptContext as any);
  const _multiTourWarning = getMultipleTourWarning(promptContext as any, newContext.language);
  // Sıra ÖNEMLİ: getStagePrompt eskiden buildSystemPrompt'ta `getFormatPrompt` ile
  // `getAgencyInfo` arasında \n\n ile birleşiyordu. Aynı semantiği korumak için stage prompt'u
  // suffix'in en başına, `\n\n` separator ile koyuyoruz. Toplam string SIRASI değişmemiş olur:
  // cached(date+role+tone+format+agency+directives) + "\n\n" + stage + add-on'lar.
  const systemPromptDynamic =
    "\n\n" + _stagePrompt +
    tourSwitchWarning + completedStagePrompt + returningUserPrompt + antiContradictionPrompt +
    midFlowReturnPrompt + offTopicBrevityPrompt + _multiTourWarning;

  // === 16. AI ÇAĞRISI ===
  let reply: string;
  try {
    reply = await callAI({
      systemPromptCached,
      systemPromptDynamic,
      history: historyAsc,
      userMessage: message,
    });
    console.log("[process-message] AI reply:", reply.substring(0, 80));
  } catch (_aiErr) {
    console.error("[process-message] AI call failed:", _aiErr);
    reply = buildAIFallbackResponse(newContext, agency.phone_public || undefined);
    await _save(reply, newContext);
    await adapter.sendResponse(reply);
    return { success: true, response: reply, newContext };
  }

  // === 17. YANIT DOĞRULAMA ===
  const validation = validateAIResponse(reply, newContext.language, newContext.stage);
  if (validation.wasModified) {
    console.warn("[process-message] Response validator modified AI output");
    reply = validation.text;
  }

  // === 17a. BUG D — Field-reask post-validation (M1 compliance ikinci geçit) ===
  // Canlı kanıt (exec 4afff98b, 5f003988, ceee9f4d): CONFIRMING/COMPLETED'de
  // telefon/isim/tarih/pax DOLU iken Haiku "telefon numaranızı alabilir miyim?"
  // diye dolu alanı tekrar soruyor. Prompt 3 katman yasak içeriyor (CONFIRMING
  // YASAK listesi + filledFieldsGuard + midFlowReturnPrompt) ama Haiku ihlal
  // ediyor. Deterministik post-LLM düzeltme: CONFIRMING'de TAM ÖZET+onay
  // sorusuyla replace, COMPLETED'de kapanış mesajıyla.
  //
  // ÇİFT-MODIFY GÜVENLİĞİ: validation.wasModified=true ise (sahte-onay yakalanmış)
  // reply zaten REDIRECT_MESSAGES'a değişti — içinde "telefon iste" kalıbı yok,
  // ikinci pattern eşleşmez. Yine de !wasModified guard ile açık şekilde atla.
  if (!validation.wasModified) {
    const reaskCheck = validateFieldReask(
      reply,
      newContext.language,
      newContext.stage,
      newContext.collectionStep,
      newContext.reservationInfo,
      currentTourFull || newContext.currentTour,
      newContext.tone,
      fsmIntent,  // BULGU 2 fix: change_info niyet-farkında skip
      message,
    );
    if (reaskCheck.wasModified) {
      console.warn(`[process-message] Field-reask blocked: ${reaskCheck.matchedPattern}`);
      reply = reaskCheck.text;
    }
  }

  // === 17a-2. KÖK 6 İNCE AYAR — Akış-içi bilgi sorusu → DOĞRU adıma yönlendir ===
  // Canlı (exec 6da00133, 50f02727): KÖK 6 ana fix bilgi sorusunu :11'den
  // atlatıyor → LLM cevap üretiyor ✓ AMA waiting_for_pax'ta (tarih SEÇİLİ iken)
  // LLM yine "Hangi tarihi seçmek istersiniz?" diye yönlendirdi. midFlowReturnPrompt
  // (LLM prompt'una hint) M1 compliance kırılgan — Haiku uymuyor.
  //
  // Deterministik post-LLM suffix: bilgi sorusu intent'i (general_question /
  // support_request) + COLLECTING_INFO + collectionStep ∈ {pax,name,phone,email}
  // → LLM cevabında doğru adım keyword'ü YOKSA bizim deterministik soruyu ekle.
  // Varsa (LLM zaten doğru sormuş) dokunma.
  //
  // İSTİSNALAR:
  //   - waiting_for_date: :11 zaten KÖK 6 ile atlandı; LLM kendi tarih cevabı
  //     verir + tarih listesi sunar (M1 prompt hint'ine bu noktada uyuyor).
  //     Burada dokunma → "tarih yok + bilgi sorusu → cevap + tarih listesi"
  //     mevcut davranışı regresyon olmasın.
  //   - CONFIRMING / ready_for_confirmation: K4 validateFieldReask zaten
  //     özet+onay suffix'i sağlıyor (BUG D fix).
  const _isInfoQuestionForFlowReturn =
    fsmIntent === "general_question" || fsmIntent === "support_request";
  if (
    _isInfoQuestionForFlowReturn &&
    newContext.stage === "COLLECTING_INFO" &&
    newContext.collectionStep &&
    newContext.collectionStep !== "waiting_for_date" &&
    newContext.collectionStep !== "ready_for_confirmation"
  ) {
    const _flowQs: Record<string, Record<string, string>> = {
      waiting_for_pax: {
        tr: "Kaç kişi katılacaksınız?",
        en: "How many people will join?",
        de: "Wie viele Personen nehmen teil?",
        fr: "Combien de personnes participeront?",
        es: "¿Cuántas personas participarán?",
        ru: "Сколько человек будет?",
        ar: "كم عدد الأشخاص الذين سيشاركون؟",
      },
      waiting_for_name: {
        tr: "Ad-soyadınızı alabilir miyim?",
        en: "Could you share your full name?",
        de: "Können Sie mir Ihren vollständigen Namen mitteilen?",
        fr: "Pourriez-vous me donner votre nom complet?",
        es: "¿Podría darme su nombre completo?",
        ru: "Назовите, пожалуйста, ваше полное имя.",
        ar: "هل يمكنني الحصول على اسمك الكامل؟",
      },
      waiting_for_phone: {
        tr: "Telefon numaranızı alabilir miyim?",
        en: "May I have your phone number?",
        de: "Könnten Sie mir Ihre Telefonnummer geben?",
        fr: "Puis-je avoir votre numéro de téléphone?",
        es: "¿Me podría dar su número de teléfono?",
        ru: "Назовите, пожалуйста, ваш номер телефона.",
        ar: "هل يمكنني الحصول على رقم هاتفك؟",
      },
      waiting_for_email: {
        tr: "Email adresinizi alabilir miyim?",
        en: "May I have your email address?",
        de: "Könnten Sie mir Ihre E-Mail-Adresse geben?",
        fr: "Puis-je avoir votre adresse e-mail?",
        es: "¿Me podría dar su correo electrónico?",
        ru: "Назовите, пожалуйста, ваш email.",
        ar: "هل يمكنني الحصول على بريدك الإلكتروني؟",
      },
    };
    // LLM cevabında bu adımın anahtar kelimesi var mı? Varsa zaten doğru sordu.
    const _flowKws: Record<string, RegExp> = {
      waiting_for_pax: /(kaç\s*kişi|kac\s*kisi|kişi\s*say|kisi\s*say|how\s*many|wie\s*viele|combien|cuántas|cuantas|сколько|كم)/i,
      waiting_for_name: /(ad[\s-]?soyad|isminiz|adınız|adiniz|full\s*name|your\s*name|ihr\s*name|nom\s*complet|nombre\s*completo|ваше\s*имя|اسم)/i,
      waiting_for_phone: /(telefon|phone|numaranız|numaraniz|téléphone|teléfono|телефон|هاتف)/i,
      waiting_for_email: /(\bemail\b|e-?mail|e-?posta|почт|بريد)/i,
    };
    const _step = newContext.collectionStep;
    const _qsTable = _flowQs[_step];
    const _kw = _flowKws[_step];
    if (_qsTable && _kw && !_kw.test(reply)) {
      const _suffix = _qsTable[newContext.language] || _qsTable.en;
      reply = reply.trimEnd() + "\n\n" + _suffix;
      console.log(`[process-message] KÖK6 ince ayar: ${_step} → akış-döndürme suffix eklendi (lang=${newContext.language})`);
    }
  }

  // === 17b. K4: Injection post-validation — şüpheli cevaplarda fiyat manipülasyonu bloğu ===
  if (_isSuspectedInjection) {
    const _injBlock = validateInjectionResponse(reply, newContext.language);
    if (_injBlock) {
      console.warn("[process-message] K4: Injection post-validation blocked suspicious price/discount claim in AI reply");
      reply = _injBlock;
    }
  }

  // === 18. ÖDEME MESAJI (AI cevabından sonra, daha önce gönderilmediyse) ===
  if (newContext.stage === "COMPLETED" && !newContext.paymentInfoSent && paymentInstructions) {
    const _selDate = newContext.currentTour?.dates?.find((d: any) => d.id === newContext.reservationInfo.dateId);
    const priceAdult = _selDate?.price_adult ?? null;
    const priceChild = _selDate?.price_child ?? null;
    const paxAdult = newContext.reservationInfo.paxAdult || 1;
    const paxChild = newContext.reservationInfo.paxChild || 0;
    // K4: tek kaynak (calculateTotal/Deposit)
    const totalPrice = calculateTotal(paxAdult, priceAdult, paxChild, priceChild);
    // K5: deposit_percentage 0-100 dışındaysa güvenli varsayılan
    const depPct = safeDepositPercentage(
      typeof paymentInstructions === "object" ? (paymentInstructions as any)?.deposit_percentage : null
    );
    const depositAmt = calculateDeposit(totalPrice, depPct);
    const tourCurr = (currentTourFull as any)?.currency || "TRY";
    // O3: NULL/0 fiyat ise ödeme mesajı atlanır
    if (totalPrice <= 0) {
      console.warn("[process-message] O3 (AI-path): skipping payment message — totalPrice=0", {
        paxAdult, paxChild, priceAdult, priceChild,
      });
    }
    if (totalPrice > 0) {
      const payMsg = await generatePaymentMessage(
        paymentInstructions, newContext.language, totalPrice, depositAmt,
        tourCurr, { languageCurrencies, primaryCurrency, agencyPhone: agency.phone_public }
      );
      if (payMsg) {
        reply = reply + payMsg;
        newContext.paymentInfoSent = true;
      }
    }
  }

  // === 19. KAYDET VE GÖNDER ===
  await _save(reply, newContext);
  await adapter.sendResponse(reply);
  return { success: true, response: reply, newContext };
}
