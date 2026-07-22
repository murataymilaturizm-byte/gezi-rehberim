// send-manual-message — Panelden manuel WhatsApp mesajı gönderme
// POST { agencyId, phone, message, pauseBot? }
// WhatsApp 24-saatlik mesajlaşma penceresi kontrolü yapılır.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getMetaCredentials } from "../_shared/metaWhatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    // ── Auth: caller kimliği doğrula ──────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const { agencyId, phone, message, pauseBot = false } = await req.json();

    if (!agencyId || !phone || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields: agencyId, phone, message" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // ── Ownership: bu agency caller'a ait mi? ─────────────────────────────────
    const { data: ownerCheck } = await supabase
      .from("agencies")
      .select("id")
      .eq("id", agencyId)
      .eq("user_id", user.id)
      .single();
    if (!ownerCheck) {
      return new Response(JSON.stringify({ error: "Agency not found or unauthorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Agency Meta credentials (DB önce, global env fallback — Aymila gibi)
    const { data: agency, error: agErr } = await supabase
      .from("agencies")
      .select("id, name, meta_phone_number_id")
      .eq("id", agencyId)
      .single();

    if (agErr) {
      return new Response(JSON.stringify({ error: "Agency not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // 2026-07-22: token agency_secrets'tan (service-role).
    const { hydrateAgencySecrets } = await import("../_shared/agency-secrets.ts");
    await hydrateAgencySecrets(supabase, agency);

    const creds = getMetaCredentials(agency);
    if (!creds.accessToken || !creds.phoneNumberId) {
      return new Response(JSON.stringify({ error: "WhatsApp credentials not configured for this agency" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // WhatsApp 24-hour session check
    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const normalizedPhone = phone.replace("whatsapp:", "").replace("+", "").trim();

    const { data: recentMsgs } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("phone", normalizedPhone)
      .eq("agency_id", agencyId)
      .eq("role", "user")
      .gte("created_at", windowStart)
      .limit(1);

    if (!recentMsgs || recentMsgs.length === 0) {
      return new Response(
        JSON.stringify({
          error: "CUSTOMER_OUTSIDE_24H_WINDOW",
          message: "Müşteri son 24 saat içinde mesaj atmadı. WhatsApp politikası gereği şablon mesaj kullanın.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via Meta Cloud API
    const metaRes = await fetch(
      `https://graph.facebook.com/v18.0/${creds.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalizedPhone,
          type: "text",
          text: { body: message },
        }),
      }
    );

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      console.error("[send-manual-message] Meta API error:", errText);
      throw new Error(`Meta API error ${metaRes.status}: ${errText}`);
    }

    const metaResult = await metaRes.json();
    const metaMessageId = metaResult.messages?.[0]?.id;

    // Save to conversation history (role = 'assistant' so it shows on right side).
    // BUG FIX: Önceden insert error kontrolü YOKTU. Metadata kolonu DB'de eksikse
    // veya başka hata olursa SILENT FAIL ediyordu → mesaj Meta'ya gidiyor ama DB'ye
    // yazılmıyor → frontend ekranında görünmüyordu. Şimdi { error } destructure +
    // log + response'a uyarı (Meta gönderimi başarılı, sadece kayıt fail).
    const { error: _insertErr } = await supabase.from("whatsapp_conversations").insert({
      phone: normalizedPhone,
      agency_id: agencyId,
      role: "assistant",
      content: message,
      metadata: { sent_by: "agency_manual", meta_message_id: metaMessageId },
    });
    if (_insertErr) {
      // Meta'ya gönderim başarılı ama DB kayıt fail — kritik. Frontend'in re-fetch'i
      // mesajı görmez, kullanıcı tekrar yazmaya kalkışabilir → çift gönderim riski.
      console.error("[send-manual-message] DB insert FAILED (Meta send succeeded):", _insertErr.message);
      // Hala 200 dön (Meta'ya gerçekten gitti) ama frontend warning gösterebilsin
      return new Response(JSON.stringify({
        success: true,
        messageId: metaMessageId,
        warning: "DB_INSERT_FAILED",
        warningDetail: _insertErr.message,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Bot pause (if requested)
    if (pauseBot) {
      const pausedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await (supabase as any)
        .from("whatsapp_user_profiles")
        .upsert(
          { phone: normalizedPhone, agency_id: agencyId, bot_paused: true, bot_paused_until: pausedUntil },
          { onConflict: "phone,agency_id" }
        );
      console.log(`[send-manual-message] Bot paused for ${normalizedPhone} until ${pausedUntil}`);
    }

    console.log(`[send-manual-message] Sent to ${normalizedPhone}, msgId=${metaMessageId}`);

    return new Response(
      JSON.stringify({ success: true, messageId: metaMessageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[send-manual-message] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
