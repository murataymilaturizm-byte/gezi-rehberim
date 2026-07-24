// Demo Chat — Slim HTTP wrapper (Faz 4)
// Tüm core business logic shared/handlers/process-message.ts içinde.
// DemoChatAdapter: frontend conversationState (stateless context) + DB history.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { sanitizeInput, isInputTooLong } from "../shared/fsm/validator.ts";
import { detectLanguageChangeIntent, pickLocalized } from "../shared/fsm/localization.ts";
import { detectLanguage } from "../shared/fsm/language.ts";
import { getCachedTours } from "../shared/utils/tour-cache.ts";
import { processChatMessage } from "../shared/handlers/process-message.ts";
import { detectCannedResponseTrigger, buildCannedResponse } from "../shared/services/canned-responses.ts";
import { analyzeUserMessage } from "../shared/fsm/nlu.ts";
import { DemoChatAdapter } from "./adapter.ts";
import { CONFIG, corsHeaders } from "./config/constants.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json();
    const {
      message: rawMessage,
      sessionId,
      conversationState: incomingContext,
      conversationStyle,
      // FIX: Frontend i18n.language — ilk mesajda detection'ı override eder.
      language: bodyLanguage,
    } = body;
    // 7 dil whitelist'i — diğer girdiler güvenle yoksayılır.
    const SUPPORTED_LANGS = ["tr", "en", "de", "ru", "ar", "fr", "es"];
    const seedLanguage = (typeof bodyLanguage === "string" && SUPPORTED_LANGS.includes(bodyLanguage))
      ? bodyLanguage
      : undefined;

    // === NLU A/B DEBUG YOLU (KORUMALI — FAZ NLU-pilot-A ölçüm, 2026-07-09) ===
    // GÜVENLİK: X-NLU-AB header'ı NLU_AB_TOKEN secret'ıyla TAM eşleşmezse yol
    // TAMAMEN kapalı — hiçbir sinyal sızmaz, normal akışa dokunulmaz. Eşleşirse:
    // mesajı SADECE NLU'dan iki modelde (Haiku + Sonnet) geçir, ham çıktıları
    // yan yana döndür. STATE'e YAZMAZ, rezervasyon akışına GİRMEZ, DB'ye dokunmaz.
    // Rate-limit/sessionId ZORUNLULUKLARINDAN ÖNCE (ölçüm izole). Secret rotate
    // edilebilir; token yoksa endpoint normal davranır (debug varlığı gizli).
    {
      const _abToken = req.headers.get("X-NLU-AB");
      const _abSecret = Deno.env.get("NLU_AB_TOKEN");
      if (_abToken && _abSecret && _abToken === _abSecret) {
        const _abMsg = sanitizeInput(rawMessage || "");
        const _abSummary = typeof body.summary === "string" ? body.summary : undefined;
        const _abState = typeof body.state === "string" ? body.state : undefined;
        const _abTour = body.selectedTour || undefined;
        const _HAIKU = "claude-haiku-4-5-20251001";
        const _SONNET = "claude-sonnet-4-6";
        const _slim = (r: any) => ({
          model: r?._model, intent: r?.intent, language: r?.language,
          entities: r?.entities, updates: r?.updates,
          clarification_needed: r?.clarification_needed, usage: r?._usage,
        });
        const [_h, _s] = await Promise.all([
          analyzeUserMessage(_abMsg, _abSummary, _abState, _abTour, undefined, _HAIKU).catch((e) => ({ error: String(e), _model: _HAIKU })),
          analyzeUserMessage(_abMsg, _abSummary, _abState, _abTour, undefined, _SONNET).catch((e) => ({ error: String(e), _model: _SONNET })),
        ]);
        return new Response(JSON.stringify({
          ab: true, message: _abMsg,
          context: { summary: _abSummary, state: _abState, tour: _abTour?.title },
          haiku: _slim(_h), sonnet: _slim(_s),
        }, null, 2), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECURITY (FIX 1): Demo endpoint SADECE kendi DEMO_AGENCY_ID'sine kilitli.
    // Public endpoint olduğu için body'den gelen herhangi bir agencyId değeri
    // sessizce yoksayılır — cross-agency leak vektörü kapatıldı. Eski davranış:
    //   const agencyId = body.agencyId || CONFIG.DEMO_AGENCY_ID;
    // Saldırgan body'ye {agencyId: "<target_uuid>"} koyarak hedef acenteye
    // konuşma/rezervasyon enjekte edebiliyordu.
    const agencyId: string = CONFIG.DEMO_AGENCY_ID;
    // currentLang error-response için: önce mevcut context, sonra frontend seed, son çare tr.
    const currentLang: string = (incomingContext as any)?.language || seedLanguage || "tr";

    // === INPUT UZUNLUK KONTROLÜ ===
    if (isInputTooLong(rawMessage)) {
      const _tlMsgs: Record<string, string> = {
        tr: "Mesajınız çok uzun (max 2000 karakter), lütfen daha kısa yazın.",
        en: "Your message is too long (max 2000 chars), please shorten it.",
        de: "Ihre Nachricht ist zu lang (max 2000 Zeichen), bitte kürzen.",
        ru: "Сообщение слишком длинное (макс. 2000 символов).",
        ar: "رسالتك طويلة جداً (الحد الأقصى 2000 حرف).",
        fr: "Votre message est trop long (max 2000 caractères).",
        es: "Su mensaje es demasiado largo (máx 2000 caracteres).",
      };
      return new Response(JSON.stringify({
        response: _tlMsgs[currentLang] || _tlMsgs.tr,
        conversationState: incomingContext,
        isError: true,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const message = sanitizeInput(rawMessage || "");

    // === IP RATE LIMIT: 30 istek/dakika + 500 istek/saat ===
    // 2026-06-19: Saatlik 100 → 500. Bir IP'den çoklu müşteri (paylaşımlı WiFi/NAT)
    // ve aktif test 100'ü saatte aşıyordu. 500 cömert ama spam'i hâlâ engeller.
    // FIX 4: SaatLİK IP limiti eklendi. sessionId rotation ile saatlik session
    // limitini (50/saat) bypass eden saldırı vektörünü kapatır; aynı IP'den
    // 100/saat eşiği aşılırsa istek reddedilir. Meşru demo kullanımı bu
    // eşiği geçmez (tipik test ~10-30 mesaj). 20/dk eşiği KORUNDU.
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || null;
    if (clientIP) {
      const _rlMsgs: Record<string, string> = {
        tr: "Çok hızlı istek gönderiyorsunuz. 🙏 Lütfen bir dakika bekleyin.",
        en: "You're sending requests too quickly. 🙏 Please wait.",
        de: "Zu viele Anfragen. 🙏 Bitte warten.",
        ru: "Слишком много запросов. 🙏 Подождите.",
        ar: "طلبات كثيرة جداً. 🙏 يرجى الانتظار.",
        fr: "Trop de requêtes. 🙏 Patientez.",
        es: "Demasiadas solicitudes. 🙏 Por favor espere.",
      };
      // 1) Dakikalık IP limiti — kısa süreli burst koruma (20 → 30: insan hızı için pay).
      const { data: _ipRl, error: _ipRle } = await supabase.rpc("check_rate_limit", {
        p_identifier: clientIP,
        p_identifier_type: "ip",
        p_window_seconds: 60,
        p_max_requests: 30,
      });
      if (!_ipRle && _ipRl && !_ipRl.allowed) {
        return new Response(JSON.stringify({
          response: _rlMsgs[currentLang] || _rlMsgs.tr,
          conversationState: incomingContext,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // 2) FIX 4: Saatlik IP limiti — sessionId rotation bypass'ı kapatır.
      // identifier aynı, identifier_type "ip" — rate_limit_events tablosunda
      // aynı pencerede aynı kayıtlar sayılır; iki kontrol birbirini etkilemez
      // (her birinin penceresi farklı: 60s vs 3600s).
      const { data: _ipHRl, error: _ipHRle } = await supabase.rpc("check_rate_limit", {
        p_identifier: clientIP,
        p_identifier_type: "ip",
        p_window_seconds: 3600,
        p_max_requests: 500,
      });
      if (!_ipHRle && _ipHRl && !_ipHRl.allowed) {
        return new Response(JSON.stringify({
          response: _rlMsgs[currentLang] || _rlMsgs.tr,
          conversationState: incomingContext,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // === SESSION RATE LIMIT: 200 mesaj/saat ===
    // 2026-06-19: 50 → 200. Uzun bir rezervasyon ~30-40 mesaj; yavaş yazan/düzeltme
    // yapan müşteri 50'yi aşıyordu. 200 hâlâ tek session abuse'u engeller.
    {
      const { data: _sessRl, error: _sessRle } = await supabase.rpc("check_rate_limit", {
        p_identifier: sessionId,
        p_identifier_type: "session",
        p_window_seconds: 3600,
        p_max_requests: 200,
        p_agency_id: agencyId,
      });
      if (!_sessRle && _sessRl && !_sessRl.allowed) {
        const _sMsgs: Record<string, string> = {
          tr: "Bu oturumda çok fazla mesaj gönderdiniz. Lütfen daha sonra deneyin.",
          en: "Too many messages this session. Please try again later.",
          de: "Zu viele Nachrichten. Bitte später erneut versuchen.",
          ru: "Слишком много сообщений. Попробуйте позже.",
          ar: "رسائل كثيرة جداً. يرجى المحاولة لاحقاً.",
          fr: "Trop de messages. Réessayez plus tard.",
          es: "Demasiados mensajes. Intente más tarde.",
        };
        return new Response(JSON.stringify({
          response: _sMsgs[currentLang] || _sMsgs.tr,
          conversationState: incomingContext,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // === AGENCY YÜKLE ===
    const { data: agencyRaw } = await supabase
      .from("agencies")
      .select(
        "id, name, city, address, phone_public, website_url, working_hours, maps_url, cancellation_policy, payment_instructions, primary_currency, language_currencies, collect_email, show_multi_currency, conversation_style, enabled_languages",
      )
      .eq("id", agencyId)
      .single();

    const agency = agencyRaw ?? {
      id: agencyId,
      name: "Demo Agency",
      collect_email: false,
      primary_currency: "TRY",
      payment_instructions: null,
      language_currencies: null,
    };

    // === HIZLI DİL TESPİTİ (tur localization için) ===
    // Öncelik: explicit language-change ("english please") > karakter tabanlı > frontend seed > context default.
    let _prelimLang = currentLang;
    const _changeIntent = detectLanguageChangeIntent(message);
    if (_changeIntent) {
      _prelimLang = _changeIntent;
    } else {
      const _charLang = detectLanguage(rawMessage || "");
      if (_charLang) _prelimLang = _charLang;
      else if (seedLanguage) _prelimLang = seedLanguage;
    }

    // === CANNED (acente-veri hızlı cevabı) — LLM'den önce kısa-devre ===
    // 2026-07-24: webhook ile kanal-paritesi. Alan boşsa yönlendirme döner.
    const _cannedKey = detectCannedResponseTrigger(message, _prelimLang);
    if (_cannedKey) {
      const _canned = buildCannedResponse(_cannedKey, _prelimLang, agency as any);
      if (_canned) {
        return new Response(JSON.stringify({
          response: _canned,
          conversationState: incomingContext,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // === TURLARI YÜKLE + LOCALİZE ===
    let toursRaw: any[];
    try {
      toursRaw = await getCachedTours(supabase, agencyId);
    } catch (_cacheErr: any) {
      if (_cacheErr?.message === "TOUR_DATA_UNAVAILABLE") {
        const _unavMsgs: Record<string, string> = {
          tr: "Üzgünüm, tur bilgilerini şu an yükleyemedim. Lütfen birkaç dakika sonra tekrar yazın.",
          en: "Sorry, I couldn't load tour information right now. Please try again in a few minutes.",
          de: "Entschuldigung, Tourdaten können gerade nicht geladen werden. Bitte in wenigen Minuten erneut versuchen.",
          ru: "Извините, не удалось загрузить туры. Попробуйте через несколько минут.",
          ar: "آسف، لا أستطيع تحميل بيانات الجولات الآن. يرجى المحاولة بعد دقائق.",
          fr: "Désolé, impossible de charger les informations des circuits. Réessayez dans quelques minutes.",
          es: "Lo siento, no puedo cargar la información de tours. Intente en unos minutos.",
        };
        return new Response(JSON.stringify({
          response: _unavMsgs[currentLang] || _unavMsgs.tr,
          conversationState: incomingContext,
          isError: true,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw _cacheErr;
    }
    const today = new Date().toISOString().split("T")[0];
    const tours = toursRaw
      .map((tour: any) => ({
        id: tour.id,
        title: pickLocalized(tour, "title", _prelimLang),
        destination: pickLocalized(tour, "destination", _prelimLang),
        // BUG #2/#3 FIX: tüm dil varyantları matching için (title + destination)
        title_tr: tour.title, title_en: tour.title_en, title_de: tour.title_de,
        title_ru: tour.title_ru, title_ar: tour.title_ar, title_fr: tour.title_fr, title_es: tour.title_es,
        destination_tr: tour.destination,
        destination_en: tour.destination_en, destination_de: tour.destination_de,
        destination_ru: tour.destination_ru, destination_ar: tour.destination_ar,
        destination_fr: tour.destination_fr, destination_es: tour.destination_es,
        type: tour.type,
        currency: tour.currency,
        program_kisa: pickLocalized(tour, "program_kisa", _prelimLang),
        gezilecek_yerler: tour.gezilecek_yerler,
        toplanma_saati: tour.toplanma_saati,
        hareket_noktasi: tour.hareket_noktasi,
        tur_sure: tour.tur_sure,
        konaklama: tour.konaklama,
        ulasim: tour.ulasim,
        dates: (tour.dates || []).filter(
          (d: any) => d.departure_date >= today && d.remaining_quota > 0,
        ),
      }))
      .filter((t: any) => t.dates.length > 0);

    // === ADAPTER + CORE PROCESSING ===
    const adapter = new DemoChatAdapter(
      supabase,
      agencyId,
      sessionId,
      incomingContext,
      conversationStyle,
    );

    const result = await processChatMessage({
      message: rawMessage,       // process-message.ts sanitize eder
      adapter,
      agency,
      supabase,
      tours,
      paymentInstructions: agency.payment_instructions ?? null,
      languageCurrencies: agency.language_currencies ?? null,
      primaryCurrency: agency.primary_currency ?? "TRY",
      returningUserName: null,   // Demo-chat'te kullanıcı profili yok
      // FIX: Frontend explicit dili → ilk mesajda detection'ı override eder.
      seedLanguage,
    });

    return new Response(JSON.stringify({
      response: result.response ?? "",
      conversationState: result.newContext ?? incomingContext,
      ...(result.success ? {} : { isError: true }),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[demo-chat] Critical error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      response: "Üzgünüm, şu anda yanıt veremiyorum. Lütfen tekrar deneyin.",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
