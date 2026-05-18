// WhatsApp webhook — Slim I/O wrapper (Faz 3)
// Kanal-spesifik kurulum + processChatMessage çağrısı.
// Tüm core business logic shared/handlers/process-message.ts içinde.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { sanitizeInput, isInputTooLong } from "../shared/fsm/validator.ts";
import { detectLanguageChangeIntent } from "../shared/fsm/localization.ts";
import { pickLocalized } from "../shared/fsm/localization.ts";
import { getCachedTours } from "../shared/utils/tour-cache.ts";
import { markAsRead, showTypingIndicator } from "../shared/utils/whatsapp-status.ts";
import { checkFAQ } from "./services/faq.ts";
import { detectCannedResponseTrigger, getCannedResponse } from "./services/canned-responses.ts";
import { upsertUserProfile, enrichConversationInsights } from "./services/profile.ts";
import {
  extractMetaWebhookData,
  sendWhatsAppMessage,
  resolveAgencyByPhoneNumberId,
  getMetaCredentials,
} from "../_shared/metaWhatsapp.ts";
import { truncateForWhatsApp } from "./utils/format.ts";
import { processChatMessage } from "../shared/handlers/process-message.ts";
import { WhatsAppAdapter } from "./adapter.ts";
import type { ConversationTone } from "../shared/fsm/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── GET: Webhook doğrulama ───────────────────────────────────────────────────
async function handleVerify(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const incomingToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !incomingToken) {
    return new Response("Bad Request", { status: 400 });
  }

  let verified = false;
  let agencyName = "";
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data } = await supabase.from("agencies").select("id, name")
      .eq("meta_verify_token", incomingToken).maybeSingle();
    if (data) { verified = true; agencyName = data.name; }
  } catch (_e) {}

  if (!verified) {
    const envToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || Deno.env.get("META_VERIFY_TOKEN");
    if (envToken && incomingToken === envToken) { verified = true; agencyName = "env-configured"; }
  }

  if (verified) {
    console.log(`✅ Webhook verified: ${agencyName}`);
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

// ─── POST: Mesaj işleme ───────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return handleVerify(req);

  let _catchPhone: string | undefined;
  let _catchLang = "tr";
  let _catchMeta: { phoneNumberId: string; accessToken: string } | undefined;

  try {
    const body = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // === Test mode ===
    if (body?.testMode === true) {
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
      const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
      if (!phoneNumberId || !accessToken) {
        return new Response(JSON.stringify({ error: "Missing WHATSAPP credentials" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await sendWhatsAppMessage(phoneNumberId, accessToken,
        body.testPhone?.replace("+", "").trim(), body.testMessage || "🧪 Test");
      return new Response(JSON.stringify({ success: result.success, ...result }), {
        status: result.success ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Webhook payload parse ===
    const webhookData = extractMetaWebhookData(body);
    if (!webhookData) {
      return new Response(JSON.stringify({ error: "Invalid webhook data" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (webhookData.isStatus) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPhone = webhookData.from;
    _catchPhone = userPhone;
    const rawMessage = webhookData.message;

    if (!userPhone || !rawMessage) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Agency + Meta credentials ===
    const { agency, error: agencyError } = await resolveAgencyByPhoneNumberId(supabase, webhookData.phoneNumberId);
    if (agencyError || !agency) {
      console.error(`🚫 Agency not found: ${agencyError}`);
      return new Response(JSON.stringify({ error: "Agency not found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metaCredentials = getMetaCredentials(agency);
    _catchMeta = metaCredentials;
    if (!metaCredentials.accessToken || !metaCredentials.phoneNumberId) {
      return new Response(JSON.stringify({ error: "WhatsApp not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Read receipt + typing (fire-and-forget) ===
    if (webhookData.messageId) {
      const _pid = metaCredentials.phoneNumberId;
      const _tok = metaCredentials.accessToken;
      const _mid = webhookData.messageId;
      markAsRead(_pid, _tok, _mid).then((ok) => {
        if (ok) showTypingIndicator(_pid, _tok, _mid).catch(() => {});
      }).catch(() => {});
    }

    // === Input too long (ÖNCE kontrol et — DB işlemlerinden önce) ===
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
      await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken,
        userPhone, _tlMsgs[_tlLang] || _tlMsgs.tr);
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = sanitizeInput(rawMessage);
    console.log("📱 WhatsApp FSM:", userPhone.slice(-4));
    console.log(`🏢 Agency: ${agency.name}`);

    // === DB-tabanlı dedup + context/history preload ===
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
      } else if (_ar?.error === "DUPLICATE_MESSAGE") {
        console.log(`[dedup] Duplicate skipped: ${webhookData.messageId}`);
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else if (_ar?.success) {
        _preloadedContext = typeof _ar.context === "string" ? _ar.context : null;
        _preloadedHistory = Array.isArray(_ar.history) ? _ar.history : null;
      }
    }

    // Hızlı dil tespiti (preloaded context'ten veya mesaj analizinden)
    let _prelimLang = "tr";
    if (_preloadedContext) {
      try { _prelimLang = (JSON.parse(_preloadedContext) as any).language || "tr"; } catch {}
    }
    if (_prelimLang === "tr") _prelimLang = detectLanguageChangeIntent(message) || "tr";
    _catchLang = _prelimLang;

    // === Per-phone rate limit ===
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
        const _rlMsgs: Record<string, string> = {
          tr: "Çok hızlı mesaj gönderiyorsunuz. 🙏 Lütfen bir dakika bekleyin.",
          en: "You're sending messages too quickly. 🙏 Please wait a moment.",
          de: "Sie senden Nachrichten zu schnell. 🙏 Bitte warten Sie einen Moment.",
          ru: "Вы отправляете сообщения слишком быстро. 🙏 Подождите минуту.",
          ar: "أنت ترسل الرسائل بسرعة كبيرة. 🙏 يرجى الانتظار لحظة.",
          fr: "Vous envoyez des messages trop rapidement. 🙏 Veuillez attendre un moment.",
          es: "Está enviando mensajes muy rápido. 🙏 Por favor espere un momento.",
        };
        await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken,
          userPhone, _rlMsgs[_prelimLang] || _rlMsgs.tr);
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // === Plan features ===
    const { data: planFeatures } = await supabase
      .from("plan_features").select("*").eq("plan_type", agency.plan_type).single();

    // === Monthly message counter reset ===
    const _now = new Date();
    const _msgCount: number = (agency as any).monthly_message_count ?? 0;
    const _lastReset = (agency as any).last_message_reset_date
      ? new Date((agency as any).last_message_reset_date) : null;
    if (!_lastReset || _lastReset.getMonth() !== _now.getMonth() || _lastReset.getFullYear() !== _now.getFullYear()) {
      await supabase.from("agencies").update({ monthly_message_count: 0, last_message_reset_date: _now.toISOString() })
        .eq("id", agency.id);
      (agency as any).monthly_message_count = 0;
    }

    // === Abonelik + mesaj limiti ===
    const _subStatus: string = (agency as any).subscription_status ?? "active";
    if (_subStatus === "expired" || _subStatus === "cancelled" || _subStatus === "suspended") {
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const _msgLimit: number = planFeatures?.message_limit ?? ((agency as any).message_limit ?? -1);
    if (_msgLimit > 0 && _msgCount >= _msgLimit) {
      console.warn(`Agency "${agency.name}" monthly message limit reached`);
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Kullanıcı mesajını kaydet ===
    await supabase.from("whatsapp_conversations").insert({
      phone: userPhone, role: "user", content: message, agency_id: agency.id,
    });

    // === Kullanıcı profili (plan özelliği) ===
    let returningUserName: string | null = null;
    if (planFeatures?.has_user_profiles) {
      await upsertUserProfile(supabase, userPhone, agency.id, message, agency?.enabled_languages || ["tr"]);
      const { data: userProfile } = await supabase
        .from("whatsapp_user_profiles").select("full_name, total_bookings")
        .eq("phone", userPhone).eq("agency_id", agency.id).single();
      if (userProfile?.full_name && userProfile?.total_bookings > 0) {
        returningUserName = userProfile.full_name.split(" ")[0];
      }
    }

    // === Turları yükle + localize ===
    const toursRaw = await getCachedTours(supabase, agency.id);
    const today = new Date().toISOString().split("T")[0];
    const tours = toursRaw
      .map((tour: any) => ({
        id: tour.id,
        title: pickLocalized(tour, "title", _prelimLang),
        destination: pickLocalized(tour, "destination", _prelimLang),
        type: tour.type,
        currency: tour.currency,
        program_kisa: pickLocalized(tour, "program_kisa", _prelimLang),
        gezilecek_yerler: tour.gezilecek_yerler,
        toplanma_saati: tour.toplanma_saati,
        hareket_noktasi: tour.hareket_noktasi,
        tur_sure: tour.tur_sure,
        konaklama: tour.konaklama,
        ulasim: tour.ulasim,
        dates: (tour.dates || []).filter((d: any) => d.departure_date >= today && d.remaining_quota > 0),
      }))
      .filter((tour: any) => tour.dates.length > 0);

    // === Canned responses + FAQ (plan özelliği, hızlı çıkış) ===
    if (planFeatures?.has_templates) {
      const cannedTrigger = detectCannedResponseTrigger(message, _prelimLang);
      if (cannedTrigger) {
        const canned = getCannedResponse(cannedTrigger, _prelimLang);
        if (canned) {
          await supabase.from("whatsapp_conversations")
            .insert({ phone: userPhone, role: "assistant", content: canned, agency_id: agency.id });
          await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken,
            userPhone, truncateForWhatsApp(canned));
          supabase.from("agencies").update({ monthly_message_count: (_msgCount ?? 0) + 1 }).eq("id", agency.id).then(() => {});
          return new Response(JSON.stringify({ success: true }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const faqResponse = await checkFAQ(supabase, message, agency.id, _prelimLang);
      if (faqResponse) {
        await supabase.from("whatsapp_conversations")
          .insert({ phone: userPhone, role: "assistant", content: faqResponse, agency_id: agency.id });
        await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken,
          userPhone, truncateForWhatsApp(faqResponse));
        supabase.from("agencies").update({ monthly_message_count: (_msgCount ?? 0) + 1 }).eq("id", agency.id).then(() => {});
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // === CORE MESSAGE PROCESSING ===
    const adapter = new WhatsAppAdapter(
      supabase, agency, userPhone,
      metaCredentials.phoneNumberId, metaCredentials.accessToken,
      _preloadedContext, _preloadedHistory,
    );

    const result = await processChatMessage({
      message: rawMessage,  // process-message.ts sanitize eder + isInputTooLong tekrar kontrol eder
      adapter,
      agency,
      supabase,
      tours,
      paymentInstructions: agency.payment_instructions ?? null,
      languageCurrencies: agency.language_currencies ?? null,
      primaryCurrency: agency.primary_currency ?? "TRY",
      returningUserName,
    });

    // === Post-processing (plan-gated, webhook-spesifik) ===
    if (planFeatures?.has_user_profiles && result.response && result.newContext) {
      const intent = (result.newContext as any)._lastIntent || "general";
      await enrichConversationInsights(supabase, userPhone, agency.id, message, result.response, intent);
    }

    // === Monthly counter increment (her başarılı işlemde, fire-and-forget) ===
    supabase.from("agencies").update({ monthly_message_count: (_msgCount ?? 0) + 1 }).eq("id", agency.id).then(() => {});

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ Critical error:", error);

    if (_catchPhone && _catchMeta?.accessToken && _catchMeta?.phoneNumberId) {
      const errMsgs: Record<string, string> = {
        tr: "Üzgünüm, şu anda teknik bir sorun yaşıyorum. Lütfen birkaç dakika sonra tekrar deneyin.",
        en: "Sorry, I'm experiencing a technical issue. Please try again in a few minutes.",
        de: "Entschuldigung, ich habe ein technisches Problem. Bitte in wenigen Minuten erneut versuchen.",
        ru: "Извините, у меня техническая проблема. Попробуйте через несколько минут.",
        ar: "آسف، أواجه مشكلة تقنية. يرجى المحاولة بعد بضع دقائق.",
        fr: "Désolé, je rencontre un problème technique. Veuillez réessayer dans quelques minutes.",
        es: "Lo siento, tengo un problema técnico. Por favor intenta de nuevo en unos minutos.",
      };
      try {
        await sendWhatsAppMessage(
          _catchMeta.phoneNumberId, _catchMeta.accessToken, _catchPhone,
          errMsgs[_catchLang] || errMsgs.tr,
        );
      } catch (_se) { console.error("Failed to send error message:", _se); }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
