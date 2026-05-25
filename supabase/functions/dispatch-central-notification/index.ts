// dispatch-central-notification — Turzz merkezi WhatsApp bildirim dispatcher'ı.
//
// AKIŞ:
//   DB trigger → pg_net.http_post → bu fonksiyon
//   bu fonksiyon → central_event_templates'ten event → template_key + language çöz
//                → message_templates'ten içerik + variables çek (meta_status='APPROVED' şart)
//                → turzz_team_recipients'ten active=TRUE + notification_types @> [event_type] alıcılar
//                → her alıcıya Meta template gönder (Promise.allSettled, biri fail diğerine etki etmez)
//                → her gönderim sonucu template_send_log'a yazılır (agency_id = TURZZ_CENTRAL_AGENCY_ID)
//
// HATA YUTMA:
//   Tetikleyen DB transaction'ı ASLA bloke etme. Tüm hatalar logCritical + 200 OK döner.
//   (Trigger pg_net.http_post async — zaten tx dışı, ama yine de fail-safe.)
//
// send-template-message DOSYASINI DEĞİŞTİRMİYORUZ — gerekli helper'lar buraya kopya (mini, mirror).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  getCentralWhatsAppCredentials,
  TURZZ_CENTRAL_AGENCY_ID,
} from "../_shared/centralWhatsApp.ts";
import { sendWhatsAppTemplate } from "../_shared/metaWhatsapp.ts";
import { logCritical } from "../_shared/error-sink.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EventType = "new_agency_signup" | "new_contact_form" | "new_reservation";
const VALID_EVENT_TYPES: ReadonlySet<string> = new Set<EventType>([
  "new_agency_signup",
  "new_contact_form",
  "new_reservation",
]);

// ─── Variable helper'ları (mirror of send-template-message/index.ts:17-41) ─────
// Eğer ileride değişirse iki yerde güncelleyin — kasıtlı duplikasyon (send-template-message
// dosyasına dokunmamak için).
function extractOrderedVariables(content: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const m of (content.match(/\{(\w+)\}/g) || [])) {
    const name = m.replace(/[{}]/g, "");
    if (!seen.has(name)) { seen.add(name); ordered.push(name); }
  }
  return ordered;
}

function buildTemplateComponents(content: string, values: Record<string, string>): any[] {
  const vars = extractOrderedVariables(content);
  if (vars.length === 0) return [];

  // Pozisyonel ({{1}}, {{2}}) → değerleri payload'dan sırayla al (anahtar isimleri ile DEĞİL,
  // pozisyona göre — yani bu durumda super_admin "name, email, message" sırasını şablonda
  // tutmaya dikkat etmeli). Named tercih edilir.
  const isPositional = vars.every((v) => /^\d+$/.test(v));
  const valuesArr = Object.values(values);

  const parameters = isPositional
    ? vars.map((_, i) => ({ type: "text", text: (valuesArr[i] ?? "") + "" }))
    : vars.map((v) => ({ type: "text", text: (values[v] ?? "") + "" }));

  return [{ type: "body", parameters }];
}

// ─── template_send_log yazımı (non-blocking, mirror of send-template-message:57-70) ───
async function logSend(
  sb: any,
  payload: {
    template_type: string;
    language: string;
    recipient_phone: string;
    recipient_name?: string | null;
    success: boolean;
    error_message?: string | null;
  },
): Promise<void> {
  try {
    await sb.from("template_send_log").insert({
      agency_id: TURZZ_CENTRAL_AGENCY_ID,
      template_type: payload.template_type,
      language: payload.language,
      recipient_phone: payload.recipient_phone,
      recipient_name: payload.recipient_name ?? null,
      registration_id: null,
      success: payload.success,
      error_message: payload.error_message ?? null,
      sent_at: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[dispatch-central] log insert failed:", e?.message || String(e));
  }
}

// ─── Telefon normalize: Meta '+' istemiyor, sadece rakam ─────────────────────
function normalizePhone(raw: string): string {
  return (raw || "").replace("whatsapp:", "").replace("+", "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const event_type = String(body?.event_type || "").trim();
    const payload = (body?.payload ?? {}) as Record<string, any>;

    if (!event_type || !VALID_EVENT_TYPES.has(event_type)) {
      // Bilinmeyen event — sessizce 200 dön, log düş.
      console.warn("[dispatch-central] invalid event_type:", event_type);
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "INVALID_EVENT_TYPE", event_type }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ─── 1) Merkezi credential ────────────────────────────────────────────────
    let creds;
    try {
      creds = await getCentralWhatsAppCredentials();
    } catch (e: any) {
      // logCritical zaten helper içinde yazıldı.
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "NO_CENTRAL_CREDS", error: e?.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── 2) event → template_key + language çöz ───────────────────────────────
    const { data: mapping, error: mapErr } = await sb
      .from("central_event_templates")
      .select("template_key, language")
      .eq("event_type", event_type)
      .eq("active", true)
      .maybeSingle();

    if (mapErr || !mapping) {
      await logCritical({
        event: "CENTRAL_DISPATCH_NO_MAPPING",
        error: new Error(`No active central template mapping for event_type=${event_type}`),
        context: { event_type, dbError: mapErr?.message },
        severity: "warning",
      });
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "NO_MAPPING", event_type }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const templateKey = mapping.template_key as string;
    const language = (mapping.language as string) || "tr";

    // ─── 3) message_templates'ten içerik + meta_status APPROVED kontrolü ─────
    //   Turzz central templates → agency_id = TURZZ_CENTRAL_AGENCY_ID
    const { data: tmpl, error: tmplErr } = await sb
      .from("message_templates")
      .select("template_key, language, content, meta_status, is_active")
      .eq("agency_id", TURZZ_CENTRAL_AGENCY_ID)
      .eq("template_key", templateKey)
      .eq("language", language)
      .maybeSingle();

    if (tmplErr || !tmpl) {
      await logCritical({
        event: "CENTRAL_DISPATCH_TEMPLATE_NOT_FOUND",
        error: new Error(`message_templates row not found for ${templateKey}/${language}`),
        context: { event_type, templateKey, language, dbError: tmplErr?.message },
        severity: "warning",
      });
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "TEMPLATE_NOT_FOUND" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (tmpl.meta_status !== "APPROVED" || tmpl.is_active === false) {
      await logCritical({
        event: "CENTRAL_DISPATCH_TEMPLATE_NOT_APPROVED",
        error: new Error(`template ${templateKey} is not APPROVED+active`),
        context: { event_type, templateKey, language, meta_status: tmpl.meta_status, is_active: tmpl.is_active },
        severity: "warning",
      });
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "TEMPLATE_NOT_APPROVED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── 4) Alıcılar ──────────────────────────────────────────────────────────
    const { data: recipients, error: recErr } = await sb
      .from("turzz_team_recipients")
      .select("phone, name")
      .eq("active", true)
      .contains("notification_types", [event_type]);

    if (recErr) {
      await logCritical({
        event: "CENTRAL_DISPATCH_RECIPIENT_QUERY_FAILED",
        error: new Error(recErr.message),
        context: { event_type },
        severity: "error",
      });
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "RECIPIENT_QUERY_FAILED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!recipients || recipients.length === 0) {
      console.info(`[dispatch-central] no recipients for event_type=${event_type} — skipping`);
      return new Response(
        JSON.stringify({ ok: true, sent: 0, reason: "NO_RECIPIENTS" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── 5) Variable mapping — payload'dan ────────────────────────────────────
    // payload alanlarını string'e dönüştür (Meta text param istiyor).
    const stringValues: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) {
      stringValues[k] = v == null ? "" : String(v);
    }
    const components = buildTemplateComponents(tmpl.content, stringValues);

    // ─── 6) Best-effort gönderim ──────────────────────────────────────────────
    const results = await Promise.allSettled(
      recipients.map(async (r: any) => {
        const phone = normalizePhone(r.phone);
        if (!phone) {
          await logSend(sb, {
            template_type: templateKey,
            language,
            recipient_phone: r.phone || "",
            recipient_name: r.name,
            success: false,
            error_message: "EMPTY_PHONE",
          });
          return { phone: r.phone, success: false, error: "EMPTY_PHONE" };
        }

        try {
          const result = await sendWhatsAppTemplate(
            creds.phoneNumberId,
            creds.accessToken,
            phone,
            templateKey,
            language,
            components,
          );

          await logSend(sb, {
            template_type: templateKey,
            language,
            recipient_phone: phone,
            recipient_name: r.name,
            success: result.success,
            error_message: result.success ? null : (result.error || "unknown"),
          });

          return { phone, success: result.success, messageId: result.messageId, error: result.error };
        } catch (sendErr: any) {
          const errMsg = sendErr?.message || String(sendErr);
          await logSend(sb, {
            template_type: templateKey,
            language,
            recipient_phone: phone,
            recipient_name: r.name,
            success: false,
            error_message: errMsg,
          });
          return { phone, success: false, error: errMsg };
        }
      }),
    );

    const summary = results.map((r) => (r.status === "fulfilled" ? r.value : { success: false, error: String(r.reason) }));
    const okCount = summary.filter((s: any) => s?.success).length;
    const failCount = summary.length - okCount;

    console.info(
      `[dispatch-central] event=${event_type} template=${templateKey}/${language} sent=${okCount}/${summary.length}`,
    );

    return new Response(
      JSON.stringify({ ok: true, event_type, template: templateKey, language, sent: okCount, failed: failCount, results: summary }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    // Genel safety net — DB transaction'ı asla bozma; her zaman 200 dön.
    console.error("[dispatch-central] FATAL:", err?.message || err);
    await logCritical({
      event: "CENTRAL_DISPATCH_FATAL",
      error: err,
      context: {},
      severity: "critical",
    });
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "FATAL", error: err?.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
