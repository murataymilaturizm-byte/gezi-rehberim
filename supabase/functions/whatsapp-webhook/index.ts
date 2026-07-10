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
  subscribeAppToWabaWithRetry,
  verifyMetaSignatureDetailed,
} from "../_shared/metaWhatsapp.ts";
import { maskPhone, maskMessage } from "../shared/utils/log-mask.ts";
// R2: fire-and-forget mesaj sayacı RPC fail'lerini görünür kıl (billing drift önle)
import { logCritical } from "../_shared/error-sink.ts";
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
    // K1: Raw body önce string olarak al — HMAC doğrulaması için
    const rawBody = await req.text();

    // K1: Meta webhook HMAC-SHA256 imza doğrulaması
    // testMode (Supabase Studio test çağrıları) için imza zorunlu değil
    const _signature = req.headers.get("x-hub-signature-256");
    const _appSecret = Deno.env.get("META_APP_SECRET") || Deno.env.get("WHATSAPP_APP_SECRET") || "";
    const _isTestModeRaw = rawBody.includes('"testMode"') && rawBody.includes("true");
    // K1 EMERGENCY MODE: META_SIGNATURE_VERIFY_MODE env'i ile davranış kontrol edilir.
    //   "enforce" (DEFAULT): fail → 401 reject (production'da olması gereken)
    //   "warn":              fail → log + geçişe izin (acil kurtarma — secret düzelene kadar geçici)
    // Secret'ı düzeltip "enforce"a dönmek ŞART — "warn" güvenlik açığıdır.
    const _verifyMode = (Deno.env.get("META_SIGNATURE_VERIFY_MODE") || "enforce").toLowerCase();
    const _enforce = _verifyMode !== "warn";

    if (_signature && _appSecret) {
      const _result = await verifyMetaSignatureDetailed(rawBody, _signature, _appSecret);
      if (!_result.valid) {
        // K1: DETAYLI debug log — kullanıcı kök sebebi anlayabilsin.
        // - reason: hangi aşamada fail (LENGTH_MISMATCH, HASH_MISMATCH, BAD_PREFIX, ...)
        // - computedPrefix/providedPrefix: ilk 8 char (tam hash sızmaz, karşılaştırma için yeterli)
        // - secretFingerprint: sha256(secret) ilk 8 char — secret değeri sızmaz, "doğru secret mı?" karşılaştırması için
        // - bodyLength: Meta gerçekten body gönderdi mi
        console.warn("[webhook] ❌ HMAC signature verification FAILED", {
          reason: _result.reason,
          computedPrefix: _result.computedPrefix,
          providedPrefix: _result.providedPrefix,
          bodyLength: _result.bodyLength,
          secretLength: _result.secretLength,
          secretFingerprint: _result.secretFingerprint,
          verifyMode: _verifyMode,
        });
        if (_enforce) {
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // warn modunda devam et — bot ayağa kalksın ama log'da görünür kalsın
        console.warn("[webhook] ⚠️  Signature INVALID but MODE=warn — request PASSING (TEMPORARY, fix secret then switch to enforce)");
      } else {
        // Başarılı verify — log düzeyi info, sadece secret fingerprint görünür (debugging için ipucu)
        console.log(`[webhook] ✓ HMAC verified (fp=${_result.secretFingerprint})`);
      }
    } else if (_appSecret && !_isTestModeRaw) {
      // App secret config'li ama imza yok → reject (gerçek Meta her zaman imza yollar)
      console.warn("[webhook] ❌ Missing x-hub-signature-256 header — rejecting");
      if (_enforce) {
        return new Response(JSON.stringify({ error: "Missing signature" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.warn("[webhook] ⚠️  Signature MISSING but MODE=warn — request PASSING");
    }
    // App secret YOKSA: backward-compat (eski deployment) — sadece logla, geçişe izin ver
    else if (!_appSecret) {
      console.warn("[webhook] ⚠️  META_APP_SECRET not configured — signature verification SKIPPED");
    }

    const body = JSON.parse(rawBody);
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
      // 2026-07-10 B4: desteklenmeyen-tip NAZİK YANIT (7-dil). Eskiden müşteri
      // sesli/konum/sticker atınca bot TAMAMEN SESSİZ kalıyordu (caption'sız
      // medyada ise `[audio]` literal'i NLU'ya gidip saçma cevap üretiyordu).
      // Medya/konum/sticker/kişi-kartı → "yazılı mesaj" ricası; reaction/
      // edited/deleted/unknown → SESSİZ (doğru davranış — tepkiye cevap verilmez).
      const _politeTypes = new Set(["image", "audio", "video", "document", "location", "sticker", "contacts", "voice"]);
      if (userPhone && webhookData.msgType && _politeTypes.has(webhookData.msgType)) {
        const _agUn = await resolveAgencyByPhoneNumberId(supabase, webhookData.phoneNumberId);
        const _mcUn = _agUn?.agency ? getMetaCredentials(_agUn.agency) : null;
        if (_mcUn?.accessToken && _mcUn?.phoneNumberId) {
          // Dil: profil tercihi varsa o, yoksa acente ilk-dili, yoksa tr
          let _unLang = "tr";
          try {
            const { data: _pUn } = await supabase
              .from("whatsapp_user_profiles").select("language_preference")
              .eq("phone", userPhone).eq("agency_id", _agUn.agency.id).maybeSingle();
            _unLang = _pUn?.language_preference || (_agUn.agency.enabled_languages?.[0]) || "tr";
          } catch { /* dil çözülemezse tr */ }
          const _unMsgs: Record<string, string> = {
            tr: "Şu an yalnızca yazılı mesajları işleyebiliyorum 🙏 Lütfen isteğinizi kısaca yazar mısınız?",
            en: "I can only process written messages right now 🙏 Could you please type your request?",
            de: "Ich kann derzeit nur Textnachrichten verarbeiten 🙏 Könnten Sie Ihre Anfrage bitte kurz schreiben?",
            fr: "Je ne peux traiter que les messages écrits pour le moment 🙏 Pourriez-vous écrire votre demande ?",
            es: "Por ahora solo puedo procesar mensajes escritos 🙏 ¿Podría escribir su solicitud?",
            ru: "Сейчас я могу обрабатывать только текстовые сообщения 🙏 Напишите, пожалуйста, ваш запрос.",
            ar: "يمكنني حالياً معالجة الرسائل النصية فقط 🙏 هل يمكنك كتابة طلبك؟",
          };
          await sendWhatsAppMessage(_mcUn.phoneNumberId, _mcUn.accessToken, userPhone, _unMsgs[_unLang] || _unMsgs.tr);
          console.log(`[webhook] B4 desteklenmeyen-tip nazik-yanıt: type=${webhookData.msgType}, lang=${_unLang}`);
        }
      }
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

    // Self-healing: mesaj geldi ama webhook_subscribed false → arka planda subscribe et
    if (agency.meta_waba_id && !(agency as any).webhook_subscribed) {
      subscribeAppToWabaWithRetry(agency.meta_waba_id, metaCredentials.accessToken)
        .then((ok) => {
          if (ok) {
            supabase.from("agencies")
              .update({ webhook_subscribed: true })
              .eq("id", agency.id)
              .then(() => console.info(`[self-heal] webhook_subscribed=true for agency ${agency.id}`));
          }
        })
        .catch(() => {});
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
    // K6: PII masking — telefon son 4 hane görünür, ham mesaj loglara çıkmıyor
    console.log("📱 WhatsApp FSM:", maskPhone(userPhone), "| msg:", maskMessage(rawMessage));
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
    // K2: müşteriye günde 1 kez "hizmet kapalı" canlı bildirim (spam değil)
    const _subStatus: string = (agency as any).subscription_status ?? "active";
    const _msgLimit: number = planFeatures?.message_limit ?? ((agency as any).message_limit ?? -1);
    const _isExpired = _subStatus === "expired" || _subStatus === "cancelled" || _subStatus === "suspended";
    const _isLimitReached = _msgLimit > 0 && _msgCount >= _msgLimit;

    if (_isExpired || _isLimitReached) {
      const _reason = _isExpired ? `subscription_${_subStatus}` : "message_limit_reached";
      console.warn(`[webhook] Message dropped — agency "${agency.name}" reason: ${_reason}`);

      // 24h cooldown: bu müşteriye son 24 saatte aynı bildirim atıldı mı?
      const _since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: _recentNotice } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("agency_id", agency.id)
        .eq("phone", userPhone)
        .eq("role", "system")
        .like("content", "[unavailable]%")
        .gte("created_at", _since)
        .limit(1)
        .maybeSingle();

      if (!_recentNotice) {
        // Canlı bildirim — 7 dil canned response
        const _unavMsgs: Record<string, string> = {
          tr: "Üzgünüm, hizmetimiz şu anda geçici olarak kullanılamıyor. 🙏 Lütfen daha sonra tekrar yazın veya doğrudan acentemizle iletişime geçin.",
          en: "Sorry, our service is temporarily unavailable. 🙏 Please try again later or contact our agency directly.",
          de: "Entschuldigung, unser Service ist vorübergehend nicht verfügbar. 🙏 Bitte später erneut versuchen oder direkt unsere Agentur kontaktieren.",
          ru: "Извините, наш сервис временно недоступен. 🙏 Попробуйте позже или свяжитесь с нашим агентством напрямую.",
          ar: "آسف، خدمتنا غير متوفرة مؤقتاً. 🙏 يرجى المحاولة لاحقاً أو التواصل مع وكالتنا مباشرة.",
          fr: "Désolé, notre service est temporairement indisponible. 🙏 Veuillez réessayer plus tard ou contacter directement notre agence.",
          es: "Lo sentimos, nuestro servicio está temporalmente no disponible. 🙏 Por favor intente más tarde o contacte directamente con nuestra agencia.",
        };
        const _unavMsg = _unavMsgs[_prelimLang] || _unavMsgs.tr;
        // Meta 24h penceresi: müşteri az önce bize yazdığı için pencere AÇIK — free text gönderilebilir
        await sendWhatsAppMessage(metaCredentials.phoneNumberId, metaCredentials.accessToken,
          userPhone, _unavMsg).catch((e) => console.error("[K2 unav send fail]", e));
        // Conversations'a işaretle (cooldown takibi)
        supabase.from("whatsapp_conversations").insert({
          agency_id: agency.id, phone: userPhone,
          role: "system",
          content: `[unavailable] ${_reason}`,
          metadata: { dropped_reason: _reason, customer_notified: true },
        }).catch(() => {});
      } else {
        // 24h içinde zaten bildirim atılmış — sessiz
        console.log("[K2] Suppressed unav notice (24h cooldown)", maskPhone(userPhone));
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    let toursRaw: any[];
    try {
      toursRaw = await getCachedTours(supabase, agency.id);
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
        if (_catchMeta?.accessToken && _catchPhone) {
          await sendWhatsAppMessage(_catchMeta.phoneNumberId, _catchMeta.accessToken, _catchPhone, _unavMsgs[_catchLang] || _unavMsgs.tr);
        }
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
          // R2: await + try/catch — RPC fail olursa sessiz kayıp yerine error-sink'e gider.
          // Akış bozulmasın (sayaç hatası mesaj göndermeyi engellemesin) ama görünür kalsın.
          try {
            const { error: _cntErr } = await supabase.rpc("increment_agency_message_count", { p_agency_id: agency.id });
            if (_cntErr) throw _cntErr;
          } catch (_cntErr: any) {
            await logCritical({
              event: "MESSAGE_COUNTER_FAIL",
              error: _cntErr?.message || String(_cntErr),
              context: { agencyId: agency.id, path: "canned_response" },
              agencyId: agency.id,
              severity: "error",
            });
          }
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
        // R2: aynı pattern — billing drift önle
        try {
          const { error: _cntErr } = await supabase.from("agencies")
            .update({ monthly_message_count: (_msgCount ?? 0) + 1 })
            .eq("id", agency.id);
          if (_cntErr) throw _cntErr;
        } catch (_cntErr: any) {
          await logCritical({
            event: "MESSAGE_COUNTER_FAIL",
            error: _cntErr?.message || String(_cntErr),
            context: { agencyId: agency.id, path: "faq_response" },
            agencyId: agency.id,
            severity: "error",
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // === BOT PAUSE CHECK ===
    // Acente panelden "takeover" yaptıysa bot cevap vermez.
    {
      const { data: profile } = await supabase
        .from("whatsapp_user_profiles")
        .select("bot_paused, bot_paused_until")
        .eq("phone", userPhone)
        .eq("agency_id", agency.id)
        .maybeSingle();

      if (profile?.bot_paused) {
        const pausedUntil = profile.bot_paused_until ? new Date(profile.bot_paused_until) : null;
        if (!pausedUntil || pausedUntil > new Date()) {
          console.log(`[whatsapp-webhook] Bot paused for ${maskPhone(userPhone)} — saving message, skipping AI`);
          await supabase.from("whatsapp_conversations").insert({
            phone: userPhone, role: "user", content: rawMessage, agency_id: agency.id,
          });
          return new Response(JSON.stringify({ success: true, skipped: "bot_paused" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
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

    // === Monthly counter increment (her başarılı işlemde) ===
    // R2: Önceden .then(() => {}) fire-and-forget'ti — RPC fail olursa sessizce kaybolup
    // billing drift yapıyordu. Şimdi await + try/catch + error-sink (akış bozulmaz).
    try {
      const { error: _cntErr } = await supabase.from("agencies")
        .update({ monthly_message_count: (_msgCount ?? 0) + 1 })
        .eq("id", agency.id);
      if (_cntErr) throw _cntErr;
    } catch (_cntErr: any) {
      await logCritical({
        event: "MESSAGE_COUNTER_FAIL",
        error: _cntErr?.message || String(_cntErr),
        context: { agencyId: agency.id, path: "main_flow" },
        agencyId: agency.id,
        severity: "error",
      });
    }

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
