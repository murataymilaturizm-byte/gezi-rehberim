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
import { findMatchingTours } from "../services/tour-matching.ts";
import { isNluFullNameTourLeak, isNluFullNameNegationLeak } from "../services/nlu-validation.ts";
import { shouldTriggerNameAskPersist, shouldFireUnknownTour, shouldTriggerAutoDateAck, shouldTriggerSummaryReask } from "../services/bypass-gates.ts";
import { hasQuotaForPax, getQuotaRemaining, hasAnyAvailableDate } from "../services/quota-check.ts";
import { extractAllInfo, getLocalizedTourTitle } from "../services/info-extractor.ts";
import { buildNLUContextBase } from "../services/context-manager.ts";
import { buildAIFallbackResponse } from "../services/fallback-response.ts";
import { DATE_QUERY_RE, DATE_INTENTS } from "../constants/date-detection.ts";
import { produceTourChangeContext, shouldApplyEarlyTourChange, buildTourChangePrefix } from "../services/tour-change.ts";
import { callAI } from "../services/ai.ts";
import { generatePaymentMessage, safeDepositPercentage } from "../services/payment-message.ts";
import { getExchangeRatesOnce } from "../utils/exchange-rates.ts";
import { formatPriceSync } from "../utils/currency-display.ts";
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
  const historyAsc = await adapter.loadHistory(10);

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
  if (shouldApplyEarlyTourChange(context, selectedTour)) {
    const _prevStage = context.stage;
    const _prevTourTitle = context.currentTour?.title;
    context = {
      ...produceTourChangeContext(context, selectedTour),
      stage: "COLLECTING_INFO" as any,
      reservationConfirmed: false,                       // CONFIRMING'den geri dönüş temizliği
    };
    console.log(
      `[process-message] DETERMINISTIC tour-change: ${_prevStage} → COLLECTING_INFO ` +
      `("${_prevTourTitle}" → "${selectedTour.title}")`,
    );
  }

  // B2: Orijinal intent'i stage korumadan ÖNCE kaydet
  const _prePromotionIntent = nluResult.intent;

  // Stage koruma: COLLECTING_INFO / CONFIRMING'de tour_search → provide_info
  // B-2 fix (2026-06-09): reservation_intent de aynı şekilde provide_info'ya ezilir.
  // Rezervasyon zaten devam ediyorken NLU "kullanıcı yeni rezervasyon başlatmak istiyor"
  // sanıp tur değişimi transition'ını tetikliyordu (Özge bug'ının kaynağı). İsim/telefon
  // verirken gelen mesaj asla yeni rezervasyon değildir; mevcut akışın devamıdır.
  if (
    (context.stage === "COLLECTING_INFO" || context.stage === "CONFIRMING") &&
    (nluResult.intent === "tour_search" || nluResult.intent === "reservation_intent")
  ) {
    nluResult.intent = "provide_info";
    fsmIntent = mapNLUIntentToFSMIntent("provide_info");
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
  //   - SADECE context.stage === "CONFIRMING" (original stage). COLLECTING_INFO'da etkilenmez.
  //   - SADECE extracted.fullName/phone mevcuttan farklıysa (aynı değer override yapmaz).
  //   - NLU prompt full_name ekstraksiyonu dar (2-3 kelime proper noun) → "evet"ten isim
  //     üretmez, uydurma riski düşük.
  //   - F-savunması katmanları (NLU prompt + Blok 3 sigortası) extracted'a girene kadar
  //     temizler — bu seviyede leak yok.
  const _confInfo = context.reservationInfo;
  const _confExt = nluResult.updates as any;
  const _isConfirmingFullNameChange =
    !!_confExt?.fullName && !!_confInfo?.fullName &&
    _confExt.fullName !== _confInfo.fullName;
  const _isConfirmingPhoneChange =
    !!_confExt?.phone && !!_confInfo?.phone &&
    _confExt.phone !== _confInfo.phone;
  if (
    context.stage === "CONFIRMING" &&
    nluResult.intent === "provide_info" &&
    (_isConfirmingFullNameChange || _isConfirmingPhoneChange)
  ) {
    console.log(`[process-message] BUG B PROMOTE: CONFIRMING + provide_info + ${_isConfirmingFullNameChange ? "fullName" : "phone"} farklı → intent → change_info`);
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
    await _save(negReply, context);
    await adapter.sendResponse(negReply);
    return { success: true, response: negReply, newContext: context };
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

  // === 9b. GEÇERSİZ TELEFON KONTROLÜ (BUG 4) ===
  // waiting_for_phone'dayken kullanıcı kısa/geçersiz numara girdiyse erken dön
  if (
    newContext.collectionStep === "waiting_for_phone" &&
    context.collectionStep === "waiting_for_phone" &&
    !extractedInfo.phone &&
    /^\d+$/.test(message.trim()) &&
    message.trim().length < 10
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

    const _unknownMsgs: Record<string, string> = {
      tr: `"${unknownTourQuery}" turu sistemimizde bulunmuyor. 😔\n\nMüsait turlarımız:\n${_tourListLinesU}\n\nHangisi ilginizi çeker?`,
      en: `"${unknownTourQuery}" tour is not in our system. 😔\n\nAvailable tours:\n${_tourListLinesU}\n\nWhich interests you?`,
      de: `"${unknownTourQuery}" Tour ist nicht in unserem System. 😔\n\nVerfügbare Touren:\n${_tourListLinesU}\n\nWelche interessiert Sie?`,
      ru: `Тура "${unknownTourQuery}" нет в нашей системе. 😔\n\nДоступные туры:\n${_tourListLinesU}\n\nКакой вас интересует?`,
      ar: `جولة "${unknownTourQuery}" غير موجودة في نظامنا. 😔\n\nالجولات المتاحة:\n${_tourListLinesU}\n\nما الذي يثير اهتمامك؟`,
      fr: `Le circuit "${unknownTourQuery}" n'est pas dans notre système. 😔\n\nCircuits disponibles :\n${_tourListLinesU}\n\nLequel vous intéresse ?`,
      es: `El tour "${unknownTourQuery}" no está en nuestro sistema. 😔\n\nTours disponibles:\n${_tourListLinesU}\n\n¿Cuál le interesa?`,
    };
    const _unknownReply = _unknownMsgs[context.language] || _unknownMsgs.tr;
    await _save(_unknownReply, context);
    await adapter.sendResponse(_unknownReply);
    return { success: true, response: _unknownReply, newContext: context };
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
  const _askingViaQuery = DATE_QUERY_RE.test(message) && DATE_INTENTS.includes(fsmIntent);
  const _isUserAskingDates =
    !!newContext.currentTour &&
    (
      // (a) Veri-toplama akışında tarih adımı: otomatik
      (newContext.stage === "COLLECTING_INFO" && newContext.collectionStep === "waiting_for_date") ||
      // (b) Kullanıcı tarih sorusu sordu (TOUR_SELECTED veya COLLECTING_INFO herhangi adım)
      ((newContext.stage === "TOUR_SELECTED" || newContext.stage === "COLLECTING_INFO") && _askingViaQuery)
    );

  if (_isUserAskingDates) {
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
    const _pax = info.paxAdult ?? "";
    const _name = info.fullName || "";
    const _phone = info.phone || "";

    const _labels: Record<string, { tour: string; date: string; pax: string; name: string; phone: string; confirm: string }> = {
      tr: { tour: "Tur",     date: "Tarih",   pax: "Kişi sayısı", name: "Ad-Soyad", phone: "Telefon",   confirm: "Bilgiler doğru mu, onaylıyor musunuz? ✅" },
      en: { tour: "Tour",    date: "Date",    pax: "People",      name: "Name",     phone: "Phone",     confirm: "Are these details correct? Do you confirm? ✅" },
      de: { tour: "Tour",    date: "Datum",   pax: "Personen",    name: "Name",     phone: "Telefon",   confirm: "Sind die Angaben korrekt? Bestätigen Sie? ✅" },
      ru: { tour: "Тур",     date: "Дата",    pax: "Человек",     name: "Имя",      phone: "Телефон",   confirm: "Данные верны? Подтверждаете? ✅" },
      ar: { tour: "الجولة", date: "التاريخ", pax: "عدد الأشخاص", name: "الاسم",    phone: "الهاتف",    confirm: "هل المعلومات صحيحة؟ هل تؤكد؟ ✅" },
      fr: { tour: "Circuit", date: "Date",    pax: "Personnes",   name: "Nom",      phone: "Téléphone", confirm: "Les informations sont-elles correctes ? Confirmez-vous ? ✅" },
      es: { tour: "Tour",    date: "Fecha",   pax: "Personas",    name: "Nombre",   phone: "Teléfono",  confirm: "¿Los datos son correctos? ¿Confirma? ✅" },
    };
    const L = _labels[_lang] || _labels.tr;

    const _summaryLines = [
      _tourTitle ? `📋 ${L.tour}: *${_tourTitle}*` : "",
      _dateText  ? `📅 ${L.date}: ${_dateText}`    : "",
      _pax !== "" ? `👥 ${L.pax}: ${_pax}`         : "",
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
    const _pax = info.paxAdult ?? "";
    const _name = info.fullName || "";
    const _phone = info.phone || "";

    // Mevcut :13 ile aynı label yapısı (tutarlı görünüm). FARK: confirm metni
    // daha sade — "Bilgileri tekrar görmenizi istedim" yok (kullanıcı o cümleyi
    // kurmadı, tuhaf). Özet zaten üstte, sade soru yeter.
    const _labels: Record<string, { tour: string; date: string; pax: string; name: string; phone: string; reask: string }> = {
      tr: { tour: "Tur",     date: "Tarih",   pax: "Kişi sayısı", name: "Ad-Soyad", phone: "Telefon",   reask: "Onaylıyor musunuz, yoksa değiştirmek istediğiniz bir şey var mı? ✅" },
      en: { tour: "Tour",    date: "Date",    pax: "People",      name: "Name",     phone: "Phone",     reask: "Do you confirm, or is there something you'd like to change? ✅" },
      de: { tour: "Tour",    date: "Datum",   pax: "Personen",    name: "Name",     phone: "Telefon",   reask: "Bestätigen Sie, oder möchten Sie etwas ändern? ✅" },
      ru: { tour: "Тур",     date: "Дата",    pax: "Человек",     name: "Имя",      phone: "Телефон",   reask: "Подтверждаете или хотите что-то изменить? ✅" },
      ar: { tour: "الجولة", date: "التاريخ", pax: "عدد الأشخاص", name: "الاسم",    phone: "الهاتف",    reask: "هل تؤكد أم تريد تغيير شيء ما؟ ✅" },
      fr: { tour: "Circuit", date: "Date",    pax: "Personnes",   name: "Nom",      phone: "Téléphone", reask: "Confirmez-vous, ou souhaitez-vous changer quelque chose ? ✅" },
      es: { tour: "Tour",    date: "Fecha",   pax: "Personas",    name: "Nombre",   phone: "Teléfono",  reask: "¿Confirma o desea cambiar algo? ✅" },
    };
    const L = _labels[_lang] || _labels.tr;

    const _summaryLines = [
      _tourTitle ? `📋 ${L.tour}: *${_tourTitle}*` : "",
      _dateText  ? `📅 ${L.date}: ${_dateText}`    : "",
      _pax !== "" ? `👥 ${L.pax}: ${_pax}`         : "",
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

    const missingStep = !tourId ? "waiting_for_date"  // tourId yoksa tur seçimi eksik
      : !effDateId ? "waiting_for_date"
      : !effPaxAdult ? "waiting_for_pax"
      : !effFullName ? "waiting_for_name"
      : !effPhone ? "waiting_for_phone"
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

  // === 14b. FIX 3 — SAHTE ONAY GUARD ===
  // CONFIRMING stage'de "evet" verdi AMA justCompleted=false kaldı → FSM geçişi olmadı.
  // AI'a bırakma: "onaylandı" uydurmadan önce state'i sıfırla, clean reset yap.
  if (
    context.stage === "CONFIRMING" &&
    !justCompleted &&
    detectConfirmation(message, context.language)
  ) {
    console.warn("[process-message] FIX3: Confirmation detected but FSM didn't transition — state inconsistency, resetting");
    newContext.stage = "BROWSING";
    newContext.currentTour = null;
    newContext.reservationInfo = {};
    newContext.reservationConfirmed = false;
    newContext.collectionStep = undefined;
    const _incMsgs: Record<string, string> = {
      tr: "İşleminizde bir uyumsuzluk oluştu, baştan başlayalım — hangi turlar ilginizi çeker?",
      en: "There was an issue processing your session. Let's start fresh — which tours interest you?",
      de: "Bei der Verarbeitung Ihrer Sitzung ist ein Fehler aufgetreten. Fangen wir von vorne an — welche Touren interessieren Sie?",
      ru: "Произошла ошибка при обработке вашей сессии. Начнём заново — какие туры вас интересуют?",
      ar: "حدثت مشكلة في معالجة جلستك. لنبدأ من جديد — ما الجولات التي تهمك؟",
      fr: "Un problème est survenu dans votre session. Recommençons — quels circuits vous intéressent ?",
      es: "Hubo un problema al procesar su sesión. Empecemos de nuevo — ¿qué tours le interesan?",
    };
    const _incReply = _incMsgs[newContext.language] || _incMsgs.tr;
    await _save(_incReply, newContext);
    await adapter.sendResponse(_incReply);
    return { success: false, error: "state_inconsistency", response: _incReply, newContext };
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
    );
    if (reaskCheck.wasModified) {
      console.warn(`[process-message] Field-reask blocked: ${reaskCheck.matchedPattern}`);
      reply = reaskCheck.text;
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
