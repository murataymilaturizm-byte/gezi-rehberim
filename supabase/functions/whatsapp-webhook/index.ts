// WhatsApp webhook - Clean FSM with shared core (Meta Cloud API)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { createInitialContext, processTransition, getNextExpectedInput, getCancellationMessage } from "../shared/fsm/state-machine.ts";
import { sanitizeInput, isInputTooLong } from "../shared/fsm/validator.ts";
import { buildSystemPrompt } from "../shared/fsm/prompt-builder.ts";
import { detectLanguage } from "../shared/fsm/language.ts";
import { analyzeUserMessage, mapNLUIntentToFSMIntent } from "../shared/fsm/nlu.ts";
import { extractEmail, isNegativePaxMessage } from "../shared/fsm/simple-extractor.ts";
import {
  pickLocalized,
  detectLanguageChangeIntent,
  getDefaultToneForLanguage,
  formatDateForLanguage,
} from "../shared/fsm/localization.ts";
import { findTourById } from "../shared/fsm/tour-matcher.ts";
import { validateAIResponse } from "../shared/fsm/response-validator.ts";
import type { ConversationContext, ProcessingInput, ConversationTone } from "../shared/fsm/types.ts";
import { getExchangeRatesOnce } from "../shared/utils/exchange-rates.ts";
import { formatPriceSync, CONVERSION_NOTES } from "../shared/utils/currency-display.ts";
import { getCachedTours } from "../shared/utils/tour-cache.ts";
import { markAsRead, showTypingIndicator } from "../shared/utils/whatsapp-status.ts";

import {
  extractMetaWebhookData,
  sendWhatsAppMessage,
  resolveAgencyByPhoneNumberId,
  getMetaCredentials,
} from "../_shared/metaWhatsapp.ts";
import { truncateForWhatsApp } from "./utils/format.ts";
import { generatePaymentMessage } from "./services/payment-message.ts";
import { upsertUserProfile, enrichConversationInsights } from "./services/profile.ts";
import { checkFAQ } from "./services/faq.ts";
import { detectCannedResponseTrigger, getCannedResponse } from "./services/canned-responses.ts";
import { findMatchingTours } from "../shared/services/tour-matching.ts";
import { extractAllInfo } from "../shared/services/info-extractor.ts";
import { buildNLUContextBase, getConversationHistory } from "../shared/services/context-manager.ts";
import { buildAIFallbackResponse } from "../shared/services/fallback-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Atomic save: assistant mesajı + system context TEK transaction'da
// Birinin başarısız olup diğerinin kalması engellenir (bot konuştu ama state kayboldu bugunu çözer)
async function saveConversationAtomic(
  supabase: any,
  phone: string,
  agencyId: string,
  assistantMessage: string,
  context: ConversationContext,
): Promise<void> {
  const { data, error } = await supabase.rpc("save_conversation_atomic", {
    p_phone: phone,
    p_agency_id: agencyId,
    p_assistant_message: assistantMessage,
    p_context: JSON.stringify(context),
  });
  if (error || !data?.success) {
    console.error("[save_atomic_fallback]", error?.message || data?.error);
    // Fallback: ayrı ayrı kaydet (eski davranış, atomik değil ama veri kaybı önlenir)
    await supabase.from("whatsapp_conversations").insert({ phone, agency_id: agencyId, role: "assistant", content: assistantMessage });
    await supabase.from("whatsapp_conversations").insert({ phone, agency_id: agencyId, role: "system", content: JSON.stringify(context) });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const incomingToken = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode !== "subscribe" || !incomingToken) {
      return new Response("Bad Request", { status: 400 });
    }

    // Önce DB'den agencies.meta_verify_token ile eşleşen kaydı ara (multi-tenant)
    let verified = false;
    let agencyName = "";
    try {
      const supabaseVerify = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      const { data: agencyRow } = await supabaseVerify
        .from("agencies")
        .select("id, name")
        .eq("meta_verify_token", incomingToken)
        .maybeSingle();
      if (agencyRow) {
        verified = true;
        agencyName = agencyRow.name;
      }
    } catch (_e) {
      // DB sorgusu başarısız → env var fallback'e düş
    }

    // Fallback: WHATSAPP_VERIFY_TOKEN veya META_VERIFY_TOKEN env var
    if (!verified) {
      const envToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || Deno.env.get("META_VERIFY_TOKEN");
      if (envToken && incomingToken === envToken) {
        verified = true;
        agencyName = "env-configured";
      }
    }

    if (verified) {
      console.log(`✅ Webhook verified for: ${agencyName}`);
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    console.warn(`[webhook] Verify failed — no match for token: ${incomingToken.slice(0, 8)}***`);
    return new Response("Forbidden", { status: 403 });
  }

  // Catch bloğundan hata mesajı göndermek için hoist edilmiş değişkenler
  let _catchPhone: string | undefined;
  let _catchLang = "tr";
  let _catchMeta: { phoneNumberId: string; accessToken: string } | undefined;

  try {
    const body = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // === Test Mode ===
    if (body?.testMode === true) {
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
      const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
      if (!phoneNumberId || !accessToken) {
        return new Response(JSON.stringify({ error: "Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const testPhone = body.testPhone?.replace("+", "").trim();
      const testMessage = body.testMessage || "🧪 Test mesajı";
      const result = await sendWhatsAppMessage(phoneNumberId, accessToken, testPhone, testMessage);
      return new Response(JSON.stringify({ success: result.success, ...result }), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookData = extractMetaWebhookData(body);
    if (!webhookData) {
      return new Response(JSON.stringify({ error: "Invalid webhook data" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (webhookData.isStatus) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPhone = webhookData.from;
    _catchPhone = userPhone;
    const rawMessage = webhookData.message;

    if (!userPhone || !rawMessage) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🔍 Webhook phoneNumberId: "${webhookData.phoneNumberId}", from: "${userPhone}"`);
    const { agency, error: agencyError } = await resolveAgencyByPhoneNumberId(supabase, webhookData.phoneNumberId);

    if (agencyError || !agency) {
      console.error(`🚫 Agency not found: ${agencyError}`);
      return new Response(JSON.stringify({ error: "Agency not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metaCredentials = getMetaCredentials(agency);
    _catchMeta = metaCredentials;
    if (!metaCredentials.accessToken || !metaCredentials.phoneNumberId) {
      console.error(`❌ Agency ${agency.name} has no Meta WhatsApp credentials configured`);
      return new Response(JSON.stringify({ error: "WhatsApp not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === READ RECEIPT + TYPING INDICATOR — Fire-and-forget ===
    // Ana akışı yavaşlatmaz; hata olursa sessiz geç
    if (webhookData.messageId) {
      const _pid = metaCredentials.phoneNumberId;
      const _tok = metaCredentials.accessToken;
      const _mid = webhookData.messageId;
      // Önce garantili read receipt, ardından opsiyonel typing
      markAsRead(_pid, _tok, _mid).then((ok) => {
        if (ok) showTypingIndicator(_pid, _tok, _mid).catch(() => {});
      }).catch(() => {});
    }

    // === INPUT UZUNLUK KONTROLÜ: sanitize ve DB işlemlerinden ÖNCE ===
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
      await sendWhatsAppMessage(
        metaCredentials.phoneNumberId, metaCredentials.accessToken,
        userPhone, _tlMsgs[_tlLang] || _tlMsgs.tr,
      );
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = sanitizeInput(rawMessage);
    console.log("📱 WhatsApp FSM:", userPhone.slice(-4));
    console.log(`🏢 Agency: ${agency.name}`);

    // === DB-TABANLI DEDUP + CONTEXT/HİSTORY PRELOAD ===
    // Aynı messageId bir kez işlenir (cold start'ta sıfırlanan Map'in aksine kalıcı)
    // Advisory lock context yükleme sırasında race'i önler (xact sonunda serbest kalır)
    let _preloadedContext: string | null = null;
    let _preloadedHistory: Array<{ role: string; content: string }> | null = null;

    if (webhookData.messageId) {
      const { data: _ar, error: _ae } = await supabase.rpc("process_whatsapp_message_atomic", {
        p_message_id: webhookData.messageId,
        p_agency_id: agency.id,
        p_phone: userPhone,
      });
      if (_ae) {
        console.error("[process_atomic_failed]", _ae.message);
        // RPC başarısız → DB bağlantı sorunu vs. Best effort ile devam et
      } else if (_ar?.error === "DUPLICATE_MESSAGE") {
        console.log(`[dedup] Duplicate messageId skipped: ${webhookData.messageId}`);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else if (_ar?.success) {
        _preloadedContext = typeof _ar.context === "string" ? _ar.context : null;
        _preloadedHistory = Array.isArray(_ar.history) ? _ar.history : null;
        console.log(`[dedup] Registered messageId: ${webhookData.messageId}`);
      }
    }

    // === PER-PHONE RATE LİMİT: 30 mesaj/dakika ===
    {
      const { data: _rl, error: _rle } = await supabase.rpc("check_rate_limit", {
        p_identifier: userPhone,
        p_identifier_type: "phone",
        p_window_seconds: 60,
        p_max_requests: 30,
        p_agency_id: agency.id,
      });
      if (_rle) {
        console.error("[rate_limit_rpc_error]", _rle.message);
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else if (_rl && !_rl.allowed) {
        console.warn(`[rate_limit] Phone ${userPhone.slice(-4)} hit limit (${_rl.count}/${_rl.max})`);
        const _rlLang = (() => {
          if (_preloadedContext) {
            try { return (JSON.parse(_preloadedContext) as any).language || "tr"; } catch {}
          }
          return detectLanguageChangeIntent(message) || "tr";
        })();
        const _rlMsgs: Record<string, string> = {
          tr: "Çok hızlı mesaj gönderiyorsunuz. 🙏 Lütfen bir dakika bekleyin.",
          en: "You're sending messages too quickly. 🙏 Please wait a moment.",
          de: "Sie senden Nachrichten zu schnell. 🙏 Bitte warten Sie einen Moment.",
          ru: "Вы отправляете сообщения слишком быстро. 🙏 Подождите минуту.",
          ar: "أنت ترسل الرسائل بسرعة كبيرة. 🙏 يرجى الانتظار لحظة.",
          fr: "Vous envoyez des messages trop rapidement. 🙏 Veuillez attendre un moment.",
          es: "Está enviando mensajes muy rápido. 🙏 Por favor espere un momento.",
        };
        await sendWhatsAppMessage(
          metaCredentials.phoneNumberId, metaCredentials.accessToken,
          userPhone, _rlMsgs[_rlLang] || _rlMsgs.tr,
        );
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const paymentInstructions = agency.payment_instructions ?? null;
    const languageCurrencies = agency.language_currencies ?? null;
    const primaryCurrency = agency.primary_currency ?? "TRY";

    let paymentInfo: string | undefined = undefined;
    if (typeof paymentInstructions === "string") {
      paymentInfo = paymentInstructions;
    } else if (
      paymentInstructions &&
      typeof paymentInstructions === "object" &&
      typeof (paymentInstructions as any).text === "string"
    ) {
      paymentInfo = (paymentInstructions as any).text;
    }

    const { data: planFeatures } = await supabase
      .from("plan_features")
      .select("*")
      .eq("plan_type", agency.plan_type)
      .single();

    console.log("📊 Plan:", agency.plan_type, "Features:", {
      user_profiles: planFeatures?.has_user_profiles,
      reminders: planFeatures?.has_reminders,
      follow_ups: planFeatures?.has_follow_ups,
      templates: planFeatures?.has_templates,
      feedback: planFeatures?.has_feedback,
      analytics: planFeatures?.has_analytics,
    });

    // === FIX 7: Monthly message counter reset ===
    const _now = new Date();
    const _lastReset = (agency as any).last_message_reset_date
      ? new Date((agency as any).last_message_reset_date)
      : null;
    if (!_lastReset || _lastReset.getMonth() !== _now.getMonth() || _lastReset.getFullYear() !== _now.getFullYear()) {
      await supabase.from("agencies").update({
        monthly_message_count: 0,
        last_message_reset_date: _now.toISOString(),
      }).eq("id", agency.id);
      (agency as any).monthly_message_count = 0;
      console.log(`🔄 Monthly message count reset for: ${agency.name}`);
    }

    // === FIX 3: Subscription status check ===
    const _subStatus: string = (agency as any).subscription_status ?? "active";
    if (_subStatus === "expired" || _subStatus === "cancelled" || _subStatus === "suspended") {
      console.warn(`🚫 Agency "${agency.name}" blocked — subscription_status=${_subStatus}`);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === FIX 2: Message limit check ===
    const _msgLimit: number = planFeatures?.message_limit ?? ((agency as any).message_limit ?? -1);
    const _msgCount: number = (agency as any).monthly_message_count ?? 0;
    if (_msgLimit !== -1 && _msgCount >= _msgLimit) {
      console.warn(`⚠️ Agency "${agency.name}" monthly message limit reached: ${_msgCount}/${_msgLimit}`);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("whatsapp_conversations").insert({
      phone: userPhone,
      role: "user",
      content: message,
      agency_id: agency.id,
    });

    // === KULLANICI PROFİLİ - SADECE İSİMLE SELAMLAMA ===
    let returningUserName: string | null = null;
    if (planFeatures?.has_user_profiles) {
      await upsertUserProfile(supabase, userPhone, agency.id, message, agency?.enabled_languages || ["tr"]);
      console.log("✅ User profile updated");

      const { data: userProfile } = await supabase
        .from("whatsapp_user_profiles")
        .select("full_name, total_bookings")
        .eq("phone", userPhone)
        .eq("agency_id", agency.id)
        .single();

      if (userProfile?.full_name && userProfile?.total_bookings > 0) {
        returningUserName = userProfile.full_name.split(" ")[0];
        console.log(`👤 Returning user: ${returningUserName}`);
      }
    } else {
      console.log("⏭️ User profiles disabled for plan:", agency.plan_type);
    }

    // getCachedTours: tur yapısını 10 dakika cache'ler, quota'yı her seferinde taze çeker
    const toursRaw = await getCachedTours(supabase, agency.id);
    console.log(`📦 Tours: ${toursRaw.length}`);

    // Preload'dan gelen context kullan; RPC başarısız olduysa DB'den al
    let _ctxContent: string | null = _preloadedContext;
    if (_ctxContent === null) {
      const { data: _esc } = await supabase
        .from("whatsapp_conversations")
        .select("content")
        .eq("phone", userPhone)
        .eq("agency_id", agency.id)
        .eq("role", "system")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      _ctxContent = _esc?.content ?? null;
    }
    const existingState = _ctxContent ? { content: _ctxContent } : null;

    let context: ConversationContext;
    const languageChangeIntent = detectLanguageChangeIntent(message);
    const runtimeDetectedLang = await detectLanguage(message);

    // Problem 2 fix: Agency'nin seçtiği üslubu önceliklendir
    const _agencyTone = ((agency as any).conversation_style || null) as ConversationTone | null;

    if (existingState?.content) {
      try {
        const parsed = JSON.parse(existingState.content);
        if (isValidContext(parsed)) {
          context = parsed;
          if (languageChangeIntent && languageChangeIntent !== context.language) {
            context.language = languageChangeIntent;
            // Dil değişse de agency tonu korunur
            context.tone = (_agencyTone ?? getDefaultToneForLanguage(languageChangeIntent)) as ConversationTone;
          } else if (runtimeDetectedLang && runtimeDetectedLang !== context.language) {
            // Guard: uzun ASCII metinler (lorem ipsum vb.) dil değişimi tetiklemesin.
            // Kısa mesajlar (<200 karakter) veya Latin dışı karakter içeren metinler için dil değişimi kabul edilir.
            const _hasNonAscii = /[^\x00-\x7F]/.test(message);
            const _isShortMessage = message.length < 200;
            if (_hasNonAscii || _isShortMessage) {
              context.language = runtimeDetectedLang;
            }
          }
          // Her yüklemede agency tone override: DB'deki üslup context'i güncel tutar
          if (_agencyTone) context.tone = _agencyTone;
          _catchLang = context.language;
          console.log(`✅ Loaded context - Stage: ${context.stage}, Lang: ${context.language}, Tone: ${context.tone}`);
        } else {
          throw new Error("Invalid context");
        }
      } catch (_e) {
        console.log("⚠️ Creating fresh context");
        const initialLang = languageChangeIntent || runtimeDetectedLang || "tr";
        context = createInitialContext(initialLang, (_agencyTone ?? getDefaultToneForLanguage(initialLang)) as ConversationTone);
      }
    } else {
      console.log("🆕 Fresh context");
      const initialLang = languageChangeIntent || runtimeDetectedLang || "tr";
      context = createInitialContext(initialLang, (_agencyTone ?? getDefaultToneForLanguage(initialLang)) as ConversationTone);
    }

    const enabledLanguages = (agency as any).enabled_languages || ["tr"];
    if (!enabledLanguages.includes(context.language)) {
      // FIX 5: Log language fallback so we can diagnose plan/language mismatches
      console.warn(
        `🌐 Language fallback: detected="${context.language}" not in enabled=[${enabledLanguages.join(",")}] for agency="${agency.name}". Falling back to "${enabledLanguages[0]}".`,
      );
      context.language = enabledLanguages[0];
      // Agency tonu language fallback'te de korunur
      context.tone = (_agencyTone ?? getDefaultToneForLanguage(context.language)) as ConversationTone;
    }

    // Agency email toplama ayarını her mesajda context'e yaz (admin toggle anlık etki etsin)
    context.collectEmail = (agency as any).collect_email === true;

    const today = new Date().toISOString().split("T")[0];

    // getCachedTours'dan gelen toursRaw'da sold_pax + remaining_quota zaten var
    const tours = toursRaw
      .map((tour: any) => ({
        id: tour.id,
        title: pickLocalized(tour, "title", context.language),
        destination: pickLocalized(tour, "destination", context.language),
        type: tour.type,
        currency: tour.currency,
        program_kisa: pickLocalized(tour, "program_kisa", context.language),
        gezilecek_yerler: tour.gezilecek_yerler,
        toplanma_saati: tour.toplanma_saati,
        hareket_noktasi: tour.hareket_noktasi,
        tur_sure: tour.tur_sure,
        konaklama: tour.konaklama,
        ulasim: tour.ulasim,
        dates: (tour.dates || [])
          .filter((d: any) => d.departure_date >= today && d.remaining_quota > 0),
      }))
      .filter((tour: any) => tour.dates.length > 0);

    const currentLang = context.language || "tr";

    if (planFeatures?.has_templates) {
      const cannedTrigger = detectCannedResponseTrigger(message, currentLang);
      if (cannedTrigger) {
        const response = getCannedResponse(cannedTrigger, currentLang);
        if (response) {
          await supabase
            .from("whatsapp_conversations")
            .insert({ phone: userPhone, role: "assistant", content: response, agency_id: agency.id });
          await sendWhatsAppMessage(
            metaCredentials.phoneNumberId,
            metaCredentials.accessToken,
            userPhone,
            truncateForWhatsApp(response),
          );
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const faqResponse = await checkFAQ(supabase, message, agency.id, currentLang);
      if (faqResponse) {
        await supabase
          .from("whatsapp_conversations")
          .insert({ phone: userPhone, role: "assistant", content: faqResponse, agency_id: agency.id });
        await sendWhatsAppMessage(
          metaCredentials.phoneNumberId,
          metaCredentials.accessToken,
          userPhone,
          truncateForWhatsApp(faqResponse),
        );
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Preload'dan gelen history kullan; yoksa DB'den çek.
    // Her iki kaynak da DESC (yeniden eskiye) döndürür — tek reverse ile ASC yapılır.
    // Double-reverse bug: daha önce NLU'da bir, AI'da bir reverse yapılıyordu;
    // ikincisi birincisini iptal edip AI DESC history alıyordu → hallucination.
    const recentMsgs = await getConversationHistory(supabase, userPhone, agency.id, _preloadedHistory, 20);
    const historyAsc = [...recentMsgs].reverse(); // DESC → ASC, recentMsgs'i mutate ETMİYOR

    const conversationSummary = historyAsc
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join("\n");

    const nluContext = (conversationSummary ? conversationSummary + "\n\n" : "") + buildNLUContextBase(context);

    console.log("📋 NLU Context (stage):", context.stage, context.collectionStep);

    const nluResult = await analyzeUserMessage(message, nluContext, context.stage, context.currentTour, tours);
    console.log("🧠 Intent:", nluResult.intent);

    let fsmIntent = mapNLUIntentToFSMIntent(nluResult.intent);

    if (nluResult.intent === "complaint_feedback") {
      const { error: complaintError } = await supabase.from("complaints").insert({
        agency_id: agency.id,
        phone: userPhone,
        message: message,
        type: "complaint",
        status: "new",
      });
      if (complaintError) console.error("❌ Error saving complaint:", complaintError);
      else console.log("✅ Complaint saved successfully");
    }

    const { selectedTour, multipleMatches: multipleTourMatches } = findMatchingTours(
      message,
      nluResult.entities,
      tours,
      getNextExpectedInput(context),
      nluResult.intent,
    );
    if (selectedTour) console.log("🎫 Tour matched:", selectedTour.title);
    else if (multipleTourMatches.length > 1) console.log("🎫 Multiple tours matched:", multipleTourMatches.length);
    else console.log("❌ No tour match found");

    // Stage koruma: COLLECTING_INFO / CONFIRMING'de NLU yanlışlıkla tour_search döndürdüyse
    // provide_info'ya dönüştür. Demo-chat ile aynı mantık.
    if (
      (context.stage === "COLLECTING_INFO" || context.stage === "CONFIRMING") &&
      nluResult.intent === "tour_search"
    ) {
      console.info("INTENT_OVERRIDE", {
        from: "tour_search",
        to: "provide_info",
        reason: "stage_protection",
        stage: context.stage,
        collectionStep: context.collectionStep,
      });
      nluResult.intent = "provide_info";
      fsmIntent = mapNLUIntentToFSMIntent("provide_info");
    }

    // Tüm bilgi çıkarma (10 inline blok → tek servis çağrısı)
    const extractedInfo = extractAllInfo({ message, nluResult, fsmIntent, context, tours });

    // Negatif / geçersiz kişi sayısı kontrolü — FSM'den önce yakala
    if (context.collectionStep === "waiting_for_pax" && isNegativePaxMessage(message)) {
      const _negLang = context.language || "tr";
      const _negMsgs: Record<string, string> = {
        tr: "Geçerli bir kişi sayısı belirtmelisiniz (en az 1 kişi).",
        en: "Please enter a valid number of people (at least 1).",
        de: "Bitte geben Sie eine gültige Personenzahl an (mindestens 1).",
        ru: "Укажите корректное количество человек (минимум 1).",
        ar: "يرجى إدخال عدد صحيح من الأشخاص (1 على الأقل).",
        fr: "Veuillez indiquer un nombre valide de personnes (au moins 1).",
        es: "Por favor indique un número válido de personas (mínimo 1).",
      };
      const _negReply = _negMsgs[_negLang] || _negMsgs.tr;
      await saveConversationAtomic(supabase, userPhone, agency.id, _negReply, context);
      await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken, userPhone, _negReply);
      supabase.from("agencies").update({ monthly_message_count: (_msgCount ?? 0) + 1 }).eq("id", agency.id).then(() => {});
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expectedInput = getNextExpectedInput(context);
    console.log("📝 Extracted info:", extractedInfo);

    const input: ProcessingInput = {
      userMessage: message,
      detectedIntent: fsmIntent,
      extractedInfo,
      selectedTour,
      language: context.language,
    };

    const newContext = processTransition(context, input);
    console.log(`🔄 ${context.stage} → ${newContext.stage}`);

    // FIX 2+3: Geçersiz tarih temizliği — dateId olmayan selectedDate context'te kalmasın.
    // Temizlemeden önce preamble için kaydet (FIX 3: "X tarihi müsait değil" mesajı).
    const _invalidDateForPreamble =
      newContext.collectionStep === "waiting_for_date" &&
      newContext.reservationInfo?.selectedDate &&
      !newContext.reservationInfo?.dateId
        ? newContext.reservationInfo.selectedDate
        : undefined;
    if (_invalidDateForPreamble) {
      newContext.reservationInfo = { ...newContext.reservationInfo, selectedDate: undefined };
      console.log("[webhook] Cleared unmatched selectedDate:", _invalidDateForPreamble);
    }

    // Kullanıcı iptal etti → AI çağırmadan direkt yanıt dön
    if (newContext.justCancelled) {
      newContext.justCancelled = false;
      const cancelReply = getCancellationMessage(newContext.language);
      await saveConversationAtomic(supabase, userPhone, agency.id, cancelReply, newContext);
      await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken, userPhone, cancelReply);
      supabase.from("agencies").update({ monthly_message_count: (_msgCount ?? 0) + 1 }).eq("id", agency.id).then(() => {});
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deterministic date listing (do not depend on AI for this step)
    if (
      newContext.stage === "COLLECTING_INFO" &&
      newContext.collectionStep === "waiting_for_date" &&
      newContext.currentTour
    ) {
      const selectedTourForDates = findTourById(newContext.currentTour.id, tours);
      if (selectedTourForDates?.dates?.length) {
        const _exRates = await getExchangeRatesOnce().catch(() => ({}));
        const _tourCurrency = selectedTourForDates.currency || "TRY";
        const _showDual = (agency as any).show_multi_currency !== false;
        const dateLines = selectedTourForDates.dates
          .map((d: any, idx: number) => {
            const dateText = formatDateForLanguage(d.departure_date, newContext.language);
            const priceText = d.price_adult
              ? ` - ${formatPriceSync(d.price_adult, _tourCurrency, newContext.language, _exRates, _showDual)}`
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

        const dateSelectionMessages: Record<string, string> = {
          tr: `*${selectedTourForDates.title}* için müsait tarihler:\n${dateLines}\n\nHangi tarihi tercih edersiniz?`,
          en: `Available dates for *${selectedTourForDates.title}*:\n${dateLines}\n\nWhich date do you prefer?`,
          de: `Verfügbare Termine für *${selectedTourForDates.title}*:\n${dateLines}\n\nWelches Datum bevorzugen Sie?`,
          ru: `Доступные даты для *${selectedTourForDates.title}*:\n${dateLines}\n\nКакую дату вы предпочитаете?`,
          ar: `التواريخ المتاحة لـ *${selectedTourForDates.title}*:\n${dateLines}\n\nما التاريخ الذي تفضله؟`,
          fr: `Dates disponibles pour *${selectedTourForDates.title}* :\n${dateLines}\n\nQuelle date préférez-vous ?`,
          es: `Fechas disponibles para *${selectedTourForDates.title}*:\n${dateLines}\n\n¿Qué fecha prefieres?`,
        };

        // FIX 3: Kullanıcının girdiği tarih DB'de yoksa preamble göster
        let dateReply = dateSelectionMessages[newContext.language] || dateSelectionMessages.tr;
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

        await saveConversationAtomic(supabase, userPhone, agency.id, dateReply, newContext);
        await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken, userPhone, truncateForWhatsApp(dateReply));

        // FIX 2: Increment monthly message counter (fire-and-forget)
        supabase.from("agencies").update({ monthly_message_count: (_msgCount ?? 0) + 1 }).eq("id", agency.id).then(() => {});

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // === EMAIL TOPLAMA ADIMI ===
    if (newContext.stage === "COLLECTING_INFO" && newContext.collectionStep === "waiting_for_email") {
      const _lang = newContext.language || "tr";

      if (context.collectionStep !== "waiting_for_email") {
        // İlk kez bu adıma girdi → email iste (deterministik)
        const _askMsgs: Record<string, string> = {
          tr: `Son olarak, email adresinizi paylaşmak ister misiniz? 📧 Özel fırsatları iletebiliriz.\n\n(Atlamak için \"geç\" yazabilirsiniz)`,
          en: `Finally, would you like to share your email? 📧 We can send you special offers.\n\n(Type "skip" to pass)`,
          de: `Möchten Sie zum Schluss Ihre E-Mail teilen? 📧 Wir senden Ihnen exklusive Angebote.\n\n(\"überspringen\" zum Auslassen)`,
          ru: `Напоследок, хотите поделиться email? 📧 Будем отправлять специальные предложения.\n\n(Напишите \"пропустить\" для пропуска)`,
          ar: `أخيراً، هل ترغب في مشاركة بريدك الإلكتروني؟ 📧 سنرسل لك عروضاً خاصة.\n\n(اكتب \"تخطي\" للتجاوز)`,
          fr: `Enfin, souhaitez-vous partager votre email? 📧 Nous vous enverrons des offres spéciales.\n\n(Tapez \"passer\" pour ignorer)`,
          es: `Por último, ¿desea compartir su email? 📧 Le enviaremos ofertas especiales.\n\n(Escriba \"saltar\" para omitir)`,
        };
        const _askReply = _askMsgs[_lang] || _askMsgs.tr;
        await saveConversationAtomic(supabase, userPhone, agency.id, _askReply, newContext);
        await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken, userPhone, _askReply);
        supabase.from("agencies").update({ monthly_message_count: (_msgCount ?? 0) + 1 }).eq("id", agency.id).then(() => {});
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Kullanıcı zaten email adımındaydı ve @ içeriyordu ama format geçersiz
      if (message.includes("@") && !extractEmail(message)) {
        const _invalidMsgs: Record<string, string> = {
          tr: "Bu email adresi geçersiz görünüyor. Doğru formatta tekrar girer misiniz? (örn: ad@domain.com)",
          en: "This email address looks invalid. Could you enter it in the correct format? (e.g., name@domain.com)",
          de: "Diese E-Mail-Adresse scheint ungültig. Bitte im richtigen Format eingeben. (z.B. name@domain.com)",
          ru: "Этот email адрес выглядит неверным. Введите в правильном формате. (напр. name@domain.com)",
          ar: "هذا البريد الإلكتروني يبدو غير صحيح. هل يمكنك إدخاله بالشكل الصحيح؟ (مثال: name@domain.com)",
          fr: "Cette adresse email semble invalide. Veuillez l'entrer au bon format. (ex: nom@domain.com)",
          es: "Esta dirección de email parece inválida. ¿Puede ingresarla en el formato correcto? (ej: nombre@domain.com)",
        };
        const _invalidReply = _invalidMsgs[_lang] || _invalidMsgs.tr;
        await saveConversationAtomic(supabase, userPhone, agency.id, _invalidReply, newContext);
        await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken, userPhone, _invalidReply);
        supabase.from("agencies").update({ monthly_message_count: (_msgCount ?? 0) + 1 }).eq("id", agency.id).then(() => {});
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Geçerli email veya skip: FSM extractedInfo'yu işledi, normal akış devam eder
    }

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
            console.log(`⚠️ Quota exceeded: ${remainingQuota} remaining, ${paxAdult} requested`);
            const agencyPhone = agency.phone_public ? ` 📞 ${agency.phone_public}` : "";

            // Aynı turun diğer müsait tarihlerini bul
            const currentTourData = toursRaw.find((t: any) => t.id === newContext.reservationInfo.tourId);
            const otherAvailableDates = (currentTourData?.dates || []).filter((d: any) => {
              if (d.id === dateId) return false; // Dolu olan tarihi atla
              if (d.departure_date < today) return false; // Geçmiş tarihleri atla
              return true;
            });

            // Her tarih için kota kontrolü yap
            const availableDatesList: string[] = [];
            for (const d of otherAvailableDates) {
              const { count: usedForDate } = await supabase
                .from("registrations")
                .select("pax", { count: "exact" })
                .eq("tour_date_id", d.id)
                .neq("status", "CANCELLED");

              const usedCount = usedForDate || 0;
              const available = (d.quota || 999) - usedCount;
              if (available >= paxAdult) {
                // Tarihi formatla
                const _dateLocaleMap: Record<string, string> = {
                  tr: "tr-TR", en: "en-GB", de: "de-DE", ru: "ru-RU",
                  ar: "ar-SA", fr: "fr-FR", es: "es-ES",
                };
                const dateStr = new Date(d.departure_date).toLocaleDateString(
                  _dateLocaleMap[newContext.language] || "en-GB",
                  { day: "numeric", month: "long", year: "numeric" },
                );
                const _quotaCurrency = currentTourData?.currency || "TRY";
                const _quotaRates = await getExchangeRatesOnce().catch(() => ({}));
                const priceStr = d.price_adult
                  ? ` (${formatPriceSync(d.price_adult, _quotaCurrency, newContext.language, _quotaRates, (agency as any).show_multi_currency !== false)})`
                  : "";
                availableDatesList.push(`• ${dateStr}${priceStr}`);
              }
            }

            // Mesajı oluştur
            let quotaMsg = "";
            const lang = newContext.language || "tr";

            if (availableDatesList.length > 0) {
              const dateListStr = availableDatesList.join("\n");
              const msgs: Record<string, string> = {
                tr: `Üzgünüz, seçtiğiniz tarih için yeterli kontenjan bulunmamaktadır (kalan: ${remainingQuota} kişi).\n\n📅 *Müsait Diğer Tarihler:*\n${dateListStr}\n\nBu tarihlerden birini seçmek ister misiniz?`,
                en: `Sorry, the selected date doesn't have enough spots (remaining: ${remainingQuota}).\n\n📅 *Available Dates:*\n${dateListStr}\n\nWould you like to choose one of these dates?`,
                de: `Das gewählte Datum hat leider nicht genügend Plätze (verbleibend: ${remainingQuota}).\n\n📅 *Verfügbare Termine:*\n${dateListStr}\n\nMöchten Sie einen dieser Termine wählen?`,
                ru: `К сожалению, на выбранную дату недостаточно мест (осталось: ${remainingQuota}).\n\n📅 *Доступные даты:*\n${dateListStr}\n\nХотите выбрать одну из этих дат?`,
                ar: `عذراً، لا توجد أماكن كافية للتاريخ المحدد (المتبقي: ${remainingQuota}).\n\n📅 *التواريخ المتاحة:*\n${dateListStr}\n\nهل تريد اختيار أحد هذه التواريخ؟`,
                fr: `Désolé, il n'y a pas assez de places pour la date sélectionnée (restantes : ${remainingQuota}).\n\n📅 *Dates disponibles :*\n${dateListStr}\n\nSouhaitez-vous choisir l'une de ces dates ?`,
                es: `Lo sentimos, no hay suficientes plazas para la fecha seleccionada (restantes: ${remainingQuota}).\n\n📅 *Fechas disponibles:*\n${dateListStr}\n\n¿Le gustaría elegir una de estas fechas?`,
              };
              quotaMsg = msgs[lang] || msgs["tr"];
            } else {
              // Hiç müsait tarih yok — acenteyle iletişime geç
              const msgs: Record<string, string> = {
                tr: `Üzgünüz, seçtiğiniz tarih için yeterli kontenjan bulunmamaktadır (kalan: ${remainingQuota} kişi). Şu an bu tur için müsait başka tarih de bulunmuyor.\n\nLütfen ${agency.name} ile iletişime geçiniz.${agencyPhone}`,
                en: `Sorry, there are not enough spots for your selected date (remaining: ${remainingQuota}). There are no other available dates for this tour at the moment.\n\nPlease contact ${agency.name}.${agencyPhone}`,
                de: `Für das gewählte Datum sind nicht genügend Plätze verfügbar (verbleibend: ${remainingQuota}). Aktuell sind keine weiteren Termine verfügbar.\n\nBitte kontaktieren Sie ${agency.name}.${agencyPhone}`,
                ru: `На выбранную дату недостаточно мест (осталось: ${remainingQuota}). Других доступных дат для этого тура нет.\n\nПожалуйста, свяжитесь с ${agency.name}.${agencyPhone}`,
                ar: `لا توجد أماكن كافية للتاريخ المحدد (المتبقي: ${remainingQuota}). لا توجد تواريخ أخرى متاحة حالياً.\n\nيرجى التواصل مع ${agency.name}.${agencyPhone}`,
                fr: `Désolé, il n'y a pas assez de places pour la date sélectionnée (restantes : ${remainingQuota}). Il n'y a actuellement pas d'autres dates disponibles pour ce circuit.\n\nVeuillez contacter ${agency.name}.${agencyPhone}`,
                es: `Lo sentimos, no hay suficientes plazas para la fecha seleccionada (restantes: ${remainingQuota}). Actualmente no hay otras fechas disponibles para este tour.\n\nPor favor, contacte a ${agency.name}.${agencyPhone}`,
              };
              quotaMsg = msgs[lang] || msgs["tr"];
            }
            newContext.stage = "COLLECTING_INFO";
            newContext.reservationConfirmed = false;
            newContext.reservationInfo.dateId = undefined;
            newContext.reservationInfo.selectedDate = undefined;
            newContext.collectionStep = "waiting_for_date";
            await saveConversationAtomic(supabase, userPhone, agency.id, quotaMsg, newContext);
            await sendWhatsAppMessage(
              metaCredentials.phoneNumberId,
              metaCredentials.accessToken,
              userPhone,
              truncateForWhatsApp(quotaMsg),
            );
            return new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }
    }

    // Deterministic completion handling (save first, then respond)
    const justCompletedReservation =
      newContext.stage === "COMPLETED" && newContext.reservationConfirmed && context.stage !== "COMPLETED";

    if (justCompletedReservation) {
      const { tourId, dateId, fullName, phone: regPhone, paxAdult } = newContext.reservationInfo;
      const reservationPhone = regPhone || userPhone;

      const missingOrder = !dateId
        ? "waiting_for_date"
        : !paxAdult
          ? "waiting_for_pax"
          : !fullName
            ? "waiting_for_name"
            : !reservationPhone
              ? "waiting_for_phone"
              : null;

      if (missingOrder) {
        const missingMsgs: Record<string, string> = {
          tr: "Rezervasyonu tamamlayabilmem için eksik bilgileri adım adım tamamlayalım.",
          en: "Let's complete the missing details step by step to finalize your reservation.",
        };
        newContext.stage = "COLLECTING_INFO";
        newContext.reservationConfirmed = false;
        newContext.collectionStep = missingOrder as any;

        const missingReply = missingMsgs[newContext.language] || missingMsgs.tr;
        await saveConversationAtomic(supabase, userPhone, agency.id, missingReply, newContext);
        await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken, userPhone, truncateForWhatsApp(missingReply));
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const totalPax = (paxAdult || 0) + (newContext.reservationInfo.paxChild || 0);
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

      if (rpcError || !rpcResult?.success) {
        const errCode = (rpcResult?.error || "UNKNOWN") as string;
        const lang = newContext.language || "tr";
        const agPhone = agency.phone_public ? ` 📞 ${agency.phone_public}` : "";

        let errorReply: string;

        if (errCode === "QUOTA_EXCEEDED") {
          // Sadece tarih bilgisini sil — isim/telefon/kişi sayısı KORUNUR
          newContext.reservationInfo.dateId = undefined;
          newContext.reservationInfo.selectedDate = undefined;
          newContext.stage = "COLLECTING_INFO";
          newContext.reservationConfirmed = false;
          newContext.collectionStep = "waiting_for_date";

          // Aynı turun diğer tarihlerini göster
          const _quotaTour = tours.find((t: any) => t.id === tourId);
          let _dateLines = "";
          if (_quotaTour?.dates && _quotaTour.dates.length > 1) {
            const _qRates = await getExchangeRatesOnce().catch(() => ({}));
            const _qDual = (agency as any).show_multi_currency !== false;
            _dateLines = "\n\n" + _quotaTour.dates
              .filter((d: any) => d.id !== dateId)
              .map((d: any, i: number) => {
                const _dt = formatDateForLanguage(d.departure_date, lang);
                const _pr = d.price_adult
                  ? ` - ${formatPriceSync(d.price_adult, _quotaTour.currency || "TRY", lang, _qRates, _qDual)}`
                  : "";
                return `${i + 1}) ${_dt}${_pr}`;
              })
              .join("\n");
          }

          const _qMsgs: Record<string, string> = {
            tr: `Üzgünüm, seçtiğiniz tarih için kontenjan dolmuş. 😔 Başka bir tarih seçer misiniz?${_dateLines}`,
            en: `Sorry, the date you selected is fully booked. 😔 Could you choose another date?${_dateLines}`,
            de: `Es tut mir leid, das gewählte Datum ist ausgebucht. 😔 Können Sie ein anderes Datum wählen?${_dateLines}`,
            ru: `Извините, выбранная дата уже забронирована. 😔 Можете выбрать другую дату?${_dateLines}`,
            ar: `آسف، التاريخ الذي اخترته محجوز بالكامل. 😔 هل يمكنك اختيار تاريخ آخر؟${_dateLines}`,
            fr: `Désolé, la date que vous avez choisie est complète. 😔 Pouvez-vous choisir une autre date ?${_dateLines}`,
            es: `Lo siento, la fecha que eligió está completamente reservada. 😔 ¿Puede elegir otra fecha?${_dateLines}`,
          };
          errorReply = _qMsgs[lang] || _qMsgs.tr;

        } else if (errCode === "DUPLICATE") {
          // Zaten kayıtlı → rezervasyon bilgilerini temizle, BROWSING'e geç
          newContext.stage = "BROWSING";
          newContext.reservationConfirmed = false;
          newContext.reservationInfo = {};

          const _dMsgs: Record<string, string> = {
            tr: `Bu tur için zaten kayıtlı görünüyorsunuz. ℹ️ Detaylar için lütfen bizimle iletişime geçin.${agPhone}`,
            en: `You appear to already be registered for this tour. ℹ️ Please contact us for details.${agPhone}`,
            de: `Sie scheinen bereits für diese Tour angemeldet zu sein. ℹ️ Bitte kontaktieren Sie uns für Details.${agPhone}`,
            ru: `Похоже, вы уже зарегистрированы на этот тур. ℹ️ Свяжитесь с нами для подробностей.${agPhone}`,
            ar: `يبدو أنك مسجل بالفعل في هذه الجولة. ℹ️ يرجى التواصل معنا للتفاصيل.${agPhone}`,
            fr: `Vous semblez déjà inscrit à ce circuit. ℹ️ Veuillez nous contacter pour plus de détails.${agPhone}`,
            es: `Parece que ya está registrado para este tour. ℹ️ Contáctenos para más detalles.${agPhone}`,
          };
          errorReply = _dMsgs[lang] || _dMsgs.tr;

        } else if (errCode === "TOUR_DATE_NOT_FOUND") {
          // Tarih DB'de artık yok (race condition) — sadece tarih sil, bilgiler koru
          newContext.reservationInfo.dateId = undefined;
          newContext.reservationInfo.selectedDate = undefined;
          newContext.stage = "COLLECTING_INFO";
          newContext.reservationConfirmed = false;
          newContext.collectionStep = "waiting_for_date";

          const _tdfMsgs: Record<string, string> = {
            tr: `Seçtiğiniz tarih artık mevcut değil. 😔 Lütfen başka bir tarih seçin.`,
            en: `The date you selected is no longer available. 😔 Please choose another date.`,
            de: `Das gewählte Datum ist nicht mehr verfügbar. 😔 Bitte wählen Sie ein anderes Datum.`,
            ru: `Выбранная дата больше не доступна. 😔 Пожалуйста, выберите другую дату.`,
            ar: `التاريخ الذي اخترته لم يعد متاحاً. 😔 يرجى اختيار تاريخ آخر.`,
            fr: `La date que vous avez choisie n'est plus disponible. 😔 Veuillez choisir une autre date.`,
            es: `La fecha que eligió ya no está disponible. 😔 Por favor elija otra fecha.`,
          };
          errorReply = _tdfMsgs[lang] || _tdfMsgs.tr;

        } else if (errCode === "TOUR_NOT_FOUND") {
          // Tur DB'de artık yok (race condition) — tümünü temizle, tur listesi sun
          newContext.stage = "BROWSING";
          newContext.currentTour = null;
          newContext.reservationInfo = {};
          newContext.reservationConfirmed = false;

          const _tourListStr = tours.length
            ? "\n" + tours.map((t: any, i: number) => `${i + 1}) ${t.title}`).join("\n")
            : "";
          const _tnfMsgs: Record<string, string> = {
            tr: `Seçtiğiniz tur artık mevcut değil. 😔 İşte güncel tur listemiz:${_tourListStr}`,
            en: `The tour you selected is no longer available. 😔 Here's our current list:${_tourListStr}`,
            de: `Die gewählte Tour ist nicht mehr verfügbar. 😔 Hier ist unsere aktuelle Liste:${_tourListStr}`,
            ru: `Выбранный тур больше не доступен. 😔 Вот наш актуальный список:${_tourListStr}`,
            ar: `الجولة التي اخترتها لم تعد متاحة. 😔 إليك قائمة الجولات الحالية:${_tourListStr}`,
            fr: `Le circuit que vous avez choisi n'est plus disponible. 😔 Voici notre liste actuelle :${_tourListStr}`,
            es: `El tour que eligió ya no está disponible. 😔 Aquí está nuestra lista actual:${_tourListStr}`,
          };
          errorReply = _tnfMsgs[lang] || _tnfMsgs.tr;

        } else {
          // Bilinmeyen hata — stage sıfırlanmaz, kullanıcı tekrar deneyebilir
          newContext.reservationConfirmed = false;

          const _genMsgs: Record<string, string> = {
            tr: `Üzgünüm, beklenmedik bir sorun oluştu. 😔 Lütfen birazdan tekrar deneyin veya bizimle iletişime geçin.${agPhone}`,
            en: `Sorry, an unexpected issue occurred. 😔 Please try again shortly or contact us.${agPhone}`,
            de: `Es tut mir leid, ein unerwartetes Problem ist aufgetreten. 😔 Bitte versuchen Sie es später erneut oder kontaktieren Sie uns.${agPhone}`,
            ru: `Извините, произошла непредвиденная проблема. 😔 Попробуйте позже или свяжитесь с нами.${agPhone}`,
            ar: `آسف، حدثت مشكلة غير متوقعة. 😔 يرجى المحاولة لاحقاً أو التواصل معنا.${agPhone}`,
            fr: `Désolé, un problème inattendu s'est produit. 😔 Veuillez réessayer plus tard ou nous contacter.${agPhone}`,
            es: `Lo siento, ocurrió un problema inesperado. 😔 Por favor intente nuevamente más tarde o contáctenos.${agPhone}`,
          };
          errorReply = _genMsgs[lang] || _genMsgs.tr;
        }

        await saveConversationAtomic(supabase, userPhone, agency.id, errorReply, newContext);
        await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken, userPhone, truncateForWhatsApp(errorReply));
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const selectedTourForSummary = tours.find((t: any) => t.id === tourId);
      const selectedDateForSummary = selectedTourForSummary?.dates?.find((d: any) => d.id === dateId);
      const formattedDate = selectedDateForSummary?.departure_date
        ? formatDateForLanguage(selectedDateForSummary.departure_date, newContext.language)
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

      const _tourTitle = selectedTourForSummary?.title || newContext.reservationInfo.tourTitle || "-";
      const _emailLine = newContext.reservationInfo.email ? `\n• *Email:* ${newContext.reservationInfo.email}` : "";
      const completionMessages: Record<string, string> = {
        tr: `Bilgilerinizi aldım ${fullName || ""}, çok teşekkür ederim! 😊\n*${_tourTitle}* için ön kaydınızı başarıyla gerçekleştirdim.\n\n*Kayıt Özetiniz:*\n• *Tur:* ${_tourTitle}\n• *Tarih:* ${formattedDate}\n• *Kişi:* ${paxText}\n• *İsim:* ${fullName || "-"}\n• *Telefon:* ${reservationPhone || "-"}${_emailLine}\n\nKesin rezervasyon ve ödeme detayları için ekip arkadaşlarımız size en kısa sürede ulaşacaktır.`,
        en: `Thank you ${fullName || ""}! 😊\nYour pre-registration for *${_tourTitle}* is completed.\n\n*Reservation Summary:*\n• *Tour:* ${_tourTitle}\n• *Date:* ${formattedDate}\n• *People:* ${paxText}\n• *Name:* ${fullName || "-"}\n• *Phone:* ${reservationPhone || "-"}${_emailLine}\n\nOur team will contact you shortly for final booking and payment details.`,
        de: `Vielen Dank, ${fullName || ""}! 😊\nIhre Voranmeldung für *${_tourTitle}* wurde erfolgreich abgeschlossen.\n\n*Buchungsübersicht:*\n• *Tour:* ${_tourTitle}\n• *Datum:* ${formattedDate}\n• *Personen:* ${paxText}\n• *Name:* ${fullName || "-"}\n• *Telefon:* ${reservationPhone || "-"}${_emailLine}\n\nUnser Team wird sich in Kürze mit Ihnen in Verbindung setzen, um die Buchung und Zahlungsdetails zu besprechen.`,
        ru: `Спасибо, ${fullName || ""}! 😊\nВаша предварительная запись на тур *${_tourTitle}* успешно оформлена.\n\n*Сводка бронирования:*\n• *Тур:* ${_tourTitle}\n• *Дата:* ${formattedDate}\n• *Количество:* ${paxText}\n• *Имя:* ${fullName || "-"}\n• *Телефон:* ${reservationPhone || "-"}${_emailLine}\n\nНаши специалисты свяжутся с вами в ближайшее время для подтверждения бронирования и уточнения деталей оплаты.`,
        ar: `شكراً لك، ${fullName || ""}! 😊\nتم تسجيل طلبك المسبق لجولة *${_tourTitle}* بنجاح.\n\n*ملخص الحجز:*\n• *الجولة:* ${_tourTitle}\n• *التاريخ:* ${formattedDate}\n• *عدد الأشخاص:* ${paxText}\n• *الاسم:* ${fullName || "-"}\n• *الهاتف:* ${reservationPhone || "-"}${_emailLine}\n\nسيتواصل معك فريقنا في أقرب وقت لتأكيد الحجز وتفاصيل الدفع.`,
        fr: `Merci, ${fullName || ""}! 😊\nVotre pré-inscription pour *${_tourTitle}* a été réalisée avec succès.\n\n*Récapitulatif de réservation :*\n• *Circuit :* ${_tourTitle}\n• *Date :* ${formattedDate}\n• *Personnes :* ${paxText}\n• *Nom :* ${fullName || "-"}\n• *Téléphone :* ${reservationPhone || "-"}${_emailLine}\n\nNotre équipe vous contactera très prochainement pour finaliser la réservation et les modalités de paiement.`,
        es: `¡Gracias, ${fullName || ""}! 😊\nSu registro previo para *${_tourTitle}* ha sido completado con éxito.\n\n*Resumen de reserva:*\n• *Tour:* ${_tourTitle}\n• *Fecha:* ${formattedDate}\n• *Personas:* ${paxText}\n• *Nombre:* ${fullName || "-"}\n• *Teléfono:* ${reservationPhone || "-"}${_emailLine}\n\nNuestro equipo se pondrá en contacto con usted muy pronto para finalizar la reserva y los detalles de pago.`,
      };

      let finalReply = completionMessages[newContext.language] || completionMessages.tr;

      if (paymentInstructions && selectedDateForSummary) {
        const depositPercentage =
          (paymentInstructions &&
            typeof paymentInstructions === "object" &&
            (paymentInstructions as any).deposit_percentage) ||
          30;
        const totalPrice =
          adultCount * (selectedDateForSummary.price_adult || 0) +
          childCount * (selectedDateForSummary.price_child || selectedDateForSummary.price_adult || 0);
        const depositAmount = Math.ceil((totalPrice * depositPercentage) / 100);

        if (totalPrice > 0) {
          const paymentMessage = await generatePaymentMessage(
            paymentInstructions,
            newContext.language,
            totalPrice,
            depositAmount,
            selectedTourForSummary?.currency || "TRY",
            { languageCurrencies, primaryCurrency },
          );
          if (paymentMessage) {
            finalReply += paymentMessage;
            newContext.paymentInfoSent = true;
          }
        }
      }

      if (planFeatures?.has_templates && rpcResult?.registration_id) {
        const { data: template } = await supabase
          .from("message_templates")
          .select("*")
          .eq("agency_id", agency.id)
          .eq("template_key", "reservation_confirmed")
          .eq("language", newContext.language)
          .eq("is_active", true)
          .maybeSingle();

        if (template) {
          let templateContent = template.content;
          templateContent = templateContent.replace("{customer_name}", fullName || "");
          templateContent = templateContent.replace("{tour_name}", selectedTourForSummary?.title || "");
          templateContent = templateContent.replace("{tour_date}", selectedDateForSummary?.departure_date || "");
          templateContent = templateContent.replace("{pax}", String(adultCount + childCount));
          finalReply += "\n\n" + templateContent;
        }
      }

      if (planFeatures?.has_user_profiles) {
        await supabase
          .from("whatsapp_user_profiles")
          .upsert(
            {
              phone: userPhone,
              agency_id: agency.id,
              full_name: fullName,
              total_bookings: 1,
              last_interaction_at: new Date().toISOString(),
              email: newContext.reservationInfo.email || null,
              email_opted_in: !!newContext.reservationInfo.email,
            },
            { onConflict: "phone,agency_id" },
          );
      }

      await saveConversationAtomic(supabase, userPhone, agency.id, finalReply, newContext);
      await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken, userPhone, truncateForWhatsApp(finalReply));

      // FIX 2: Increment monthly message counter (fire-and-forget)
      supabase.from("agencies").update({ monthly_message_count: (_msgCount ?? 0) + 1 }).eq("id", agency.id).then(() => {});

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      paymentInfo: paymentInfo,
      multipleTourMatches: multipleTourMatches.length > 1 ? multipleTourMatches : undefined,
    };

    // Tur değişikliği uyarısı
    let tourSwitchWarning = "";
    if (
      newContext.stage === "COLLECTING_INFO" &&
      selectedTour &&
      newContext.currentTour &&
      selectedTour.id !== newContext.currentTour.id
    ) {
      tourSwitchWarning =
        newContext.language === "tr"
          ? `\n\n🚨 KRİTİK UYARI: Kullanıcı "${newContext.currentTour.title}" için rezervasyon yapıyor ama "${selectedTour.title}" hakkında bir şey söyledi. Tur değişikliği için onay iste, otomatik değiştirme!`
          : `\n\n🚨 CRITICAL: User is booking "${newContext.currentTour.title}" but mentioned "${selectedTour.title}". Ask for confirmation before switching. NEVER switch automatically!`;
    }

    // === COMPLETED AŞAMASI: ESKİ REZERVASYONDAN BAHSETME ===
    let completedStagePrompt = "";
    if (context.stage === "COMPLETED" && newContext.stage === "COMPLETED") {
      // Aynı tur hakkında soru - bilgi ver
      completedStagePrompt =
        newContext.language === "tr"
          ? `\n\n✅ TAMAMLANAN REZERVASYon SONRASI:
Kullanıcının ${context.currentTour?.title || "önceki tur"} için rezervasyonu tamamlandı.
Kullanıcı şu an soru soruyor. Sadece sorusunu yanıtla.
KESİNLİKLE "rezervasyonunuz tamamlandı" veya "kaydınız oluşturuldu" DEME - bu zaten yapıldı.
Doğal bir konuşma gibi devam et.`
          : `\n\n✅ POST-RESERVATION STATE:
User's reservation for ${context.currentTour?.title || "previous tour"} is already completed.
User is asking a question now. Just answer their question naturally.
DO NOT say "your reservation is confirmed" or "booking completed" - that already happened.
Continue naturally.`;
    } else if (context.stage === "COMPLETED" && newContext.stage === "TOUR_SELECTED") {
      // Farklı tura geçiş - eski rezervasyondan hiç bahsetme
      completedStagePrompt =
        newContext.language === "tr"
          ? `\n\n🔄 YENİ TUR SEÇİLDİ:
Kullanıcı yeni bir tur seçti: ${newContext.currentTour?.title}.
Önceki rezervasyondan (${context.currentTour?.title}) KESİNLİKLE bahsetme.
Sanki yeni bir konuşma başlıyormuş gibi sadece yeni tura odaklan.
"Kaydınız tamamlandı" veya önceki tura dair HİÇBİR ŞEY söyleme.`
          : `\n\n🔄 NEW TOUR SELECTED:
User selected a new tour: ${newContext.currentTour?.title}.
DO NOT mention the previous reservation (${context.currentTour?.title}) at all.
Focus only on the new tour as if starting fresh.
Never say anything about the previous booking.`;
    }

    // === DÖNEN KULLANICI SELAMLAMA ===
    let returningUserPrompt = "";
    if (returningUserName && context.stage === "GREETING") {
      returningUserPrompt =
        newContext.language === "tr"
          ? `\n\n👤 DÖNEN MÜŞTERİ: Adı "${returningUserName}". Sadece selamlarken adıyla hitap et. Önceki rezervasyon bilgilerini ASLA hatırlatma veya sorma. Sıfırdan başla.`
          : `\n\n👤 RETURNING CUSTOMER: Name is "${returningUserName}". Only greet by name. NEVER mention previous reservations. Start fresh.`;
    }

    // === KENDİ KENDİNE ÇELİŞME ÖNLEME ===
    // Bot bu konuşmada tur listesi gösterdiyse asla "tur yok" dememeli.
    // "başka tarih var mı", "diğer turlar" soruları mevcut tur bağlamında yanıtlanmalı.
    let antiContradictionPrompt = "";
    if (tours.length > 0 && newContext.stage !== "GREETING") {
      const _tourTitles = tours.slice(0, 5).map((t: any) => t.title).join(", ");
      antiContradictionPrompt = newContext.language === "tr"
        ? `\n\n🔄 TUR TUTARLILIK KURALI: Sistemde aktif turlar var (${_tourTitles}). Kullanıcı "başka tarih var mı", "diğer tarihler", "başka seçenek" vb. sorarsa ASLA "tur yok" ya da "tarih bulunamadı" deme. Hangi tura ait tarih sorduğunu netleştir veya mevcut tarihleri göster.`
        : `\n\n🔄 TOUR CONSISTENCY RULE: Active tours exist (${_tourTitles}). If user asks "any other dates?", "other options", etc., NEVER say "no tours" or "no dates found". Clarify which tour they mean or show available dates.`;
    }

    const systemPrompt =
      buildSystemPrompt(promptContext) + tourSwitchWarning + completedStagePrompt + returningUserPrompt + antiContradictionPrompt;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    // Build conversation history for AI context — historyAsc zaten ASC sıralı
    const conversationMessages = historyAsc
      .filter((m) => m.role !== "system")
      .map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));

    // AI 10 saniyeden uzun sürerse müşteriye tekrar "yazıyor..." gönder
    let _typingRepeatTimer: ReturnType<typeof setTimeout> | null = null;
    if (webhookData.messageId) {
      const _p2 = metaCredentials.phoneNumberId;
      const _t2 = metaCredentials.accessToken;
      const _m2 = webhookData.messageId;
      _typingRepeatTimer = setTimeout(() => {
        showTypingIndicator(_p2, _t2, _m2).catch(() => {});
      }, 8000);
    }

    if (_typingRepeatTimer) clearTimeout(_typingRepeatTimer);

    let reply: string;
    try {
      const _aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 2000,
          system: systemPrompt,
          messages: [
            ...conversationMessages,
            { role: "user", content: message },
          ],
        }),
      });

      if (!_aiRes.ok) throw new Error(`AI HTTP ${_aiRes.status}`);

      const _aiData = await _aiRes.json();
      reply = (_aiData.content || [])
        .filter((b: any) => b?.type === "text")
        .map((b: any) => b.text)
        .join("");
      console.log("🤖 Reply:", reply.substring(0, 80));
    } catch (_aiErr) {
      console.error("[webhook] AI call failed:", _aiErr);
      const _fallback = buildAIFallbackResponse(newContext, agency.phone_public || undefined);
      await saveConversationAtomic(supabase, userPhone, agency.id, _fallback, newContext);
      await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken, userPhone, _fallback);
      supabase.from("agencies").update({ monthly_message_count: (_msgCount ?? 0) + 1 }).eq("id", agency.id).then(() => {});
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Demo-chat ile aynı güvenlik katmanı: AI yetkisiz rezervasyon onayı iddiasını engelle.
    const validationResult = validateAIResponse(reply, newContext.language, newContext.stage);
    if (validationResult.wasModified) {
      console.error("WA_AI_FALSE_RESERVATION_CLAIM", {
        stage: newContext.stage,
        matchedPattern: validationResult.matchedPattern,
      });
      reply = validationResult.text;
    }

    let finalReply = reply;

    // Ödeme mesajı ekle
    if (
      newContext.stage === "COMPLETED" &&
      newContext.reservationConfirmed &&
      !newContext.paymentInfoSent &&
      paymentInstructions
    ) {
      const depositPercentage =
        (paymentInstructions &&
          typeof paymentInstructions === "object" &&
          (paymentInstructions as any).deposit_percentage) ||
        30;
      const tourForReservation = toursRaw.find((t: any) => t.id === newContext.reservationInfo.tourId);
      const selectedTourDate = tourForReservation?.dates?.find((d: any) => d.id === newContext.reservationInfo.dateId);

      if (!selectedTourDate) {
        console.error("WA_PAYMENT_BLOCK_SKIPPED_NULL_DATE", {
          tourId: newContext.reservationInfo.tourId,
          dateId: newContext.reservationInfo.dateId,
          language: newContext.language,
        });
      } else {
        const paxAdult = newContext.reservationInfo.paxAdult || 0;
        const paxChild = newContext.reservationInfo.paxChild || 0;
        const totalPrice =
          paxAdult * (selectedTourDate.price_adult || 0) +
          paxChild * (selectedTourDate.price_child || selectedTourDate.price_adult || 0);
        const depositAmount = Math.ceil((totalPrice * depositPercentage) / 100);
        const paymentMessage = await generatePaymentMessage(
          paymentInstructions,
          newContext.language,
          totalPrice,
          depositAmount,
          tourForReservation?.currency || "TRY",
          { languageCurrencies, primaryCurrency },
        );
        if (paymentMessage) {
          finalReply = reply + paymentMessage;
          newContext.paymentInfoSent = true;
        }
      }
    }

    // Reservation completion save/response is handled deterministically above.

    await saveConversationAtomic(supabase, userPhone, agency.id, finalReply, newContext);

    if (planFeatures?.has_user_profiles) {
      await enrichConversationInsights(supabase, userPhone, agency.id, message, finalReply, fsmIntent || "general");
    }

    await sendWhatsAppMessage(
      metaCredentials.phoneNumberId,
      metaCredentials.accessToken,
      userPhone,
      truncateForWhatsApp(finalReply),
    );

    // FIX 2: Increment monthly message counter (fire-and-forget)
    supabase.from("agencies").update({ monthly_message_count: (_msgCount ?? 0) + 1 }).eq("id", agency.id).then(() => {});

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Critical error:", error);

    // Müşteriye nazik hata mesajı gönder (phone ve meta bilgileri varsa)
    if (_catchPhone && _catchMeta?.accessToken && _catchMeta?.phoneNumberId) {
      const errorMessages: Record<string, string> = {
        tr: "Üzgünüm, şu anda teknik bir sorun yaşıyorum. Lütfen birkaç dakika sonra tekrar deneyin.",
        en: "Sorry, I'm experiencing a technical issue. Please try again in a few minutes.",
        de: "Entschuldigung, ich habe gerade ein technisches Problem. Bitte in wenigen Minuten erneut versuchen.",
        ru: "Извините, у меня техническая проблема. Пожалуйста, попробуйте через несколько минут.",
        ar: "آسف، أواجه مشكلة تقنية. يرجى المحاولة بعد بضع دقائق.",
        fr: "Désolé, je rencontre un problème technique. Veuillez réessayer dans quelques minutes.",
        es: "Lo siento, tengo un problema técnico. Por favor intenta de nuevo en unos minutos.",
      };
      const errMsg = errorMessages[_catchLang] || errorMessages.tr;
      try {
        await sendWhatsAppMessage(_catchMeta.phoneNumberId, _catchMeta.accessToken, _catchPhone, errMsg);
      } catch (sendErr) {
        console.error("❌ Failed to send error message to customer:", sendErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function isValidContext(obj: any): obj is ConversationContext {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.stage === "string" &&
    typeof obj.language === "string" &&
    typeof obj.tone === "string"
  );
}
