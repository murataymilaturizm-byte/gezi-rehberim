// dispatch-central-notification — Turzz merkezi WhatsApp bildirim dispatcher'ı.
//
// İKİ AKIŞ (event_type prefix'ine göre):
//
//   A) Turzz ekibi akışı (Faz 1) — event_type 'agency_' ile BAŞLAMIYORSA
//      DB trigger → pg_net → bu fonksiyon
//      → central_event_templates'ten şablon çöz
//      → turzz_team_recipients (active + notification_types @> [event]) alıcılar
//      → her alıcıya Meta template gönder
//      → template_send_log.agency_id = TURZZ_CENTRAL_AGENCY_ID
//
//   B) Acente akışı (Faz 2) — event_type 'agency_' ile BAŞLIYORSA
//      → central_event_templates'ten şablon çöz (aynı tablo)
//      → payload.agency_id'den agency_notification_settings çöz
//      → enabled + event-specific toggle + phone kontrolü; biri eksikse SKIP
//      → Tek acente telefonuna Meta template gönder
//      → template_send_log.agency_id = payload.agency_id (GERÇEK acente — RLS acentenin
//        kendi panelinde geçmişini görmesini sağlar)
//
// HATA YUTMA:
//   Tetikleyen DB transaction'ı ASLA bloke etme. Tüm hatalar logCritical + 200 OK döner.
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
import { isServiceRoleCall, unauthorized } from "../_shared/edge-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EventType =
  // Turzz ekibi (Faz 1)
  | "new_agency_signup"
  | "new_contact_form"
  | "new_reservation"
  // Acente (Faz 2) — 'agency_' prefix'i akış ayrımının taşıyıcısı, isimlerle oynama
  | "agency_new_reservation"
  | "agency_new_support"
  // P7-C (2026-07-29): tur-dışı hizmet talebi (agency_leads)
  | "agency_new_lead";

const VALID_EVENT_TYPES: ReadonlySet<string> = new Set<EventType>([
  "new_agency_signup",
  "new_contact_form",
  "new_reservation",
  "agency_new_reservation",
  "agency_new_support",
  "agency_new_lead",
]);

// Acente akışı için event → toggle kolonu eşlemesi (agency_notification_settings).
const AGENCY_EVENT_TOGGLE: Record<string, string> = {
  agency_new_reservation: "notify_new_reservation",
  agency_new_support:     "notify_support",
  agency_new_lead:        "notify_new_lead",
};

function isAgencyEvent(et: string): boolean {
  return et.startsWith("agency_");
}

// ═══════════════════════════════════════════════════════════════════════════
// SABİT positional variable sırası — Meta {{1}}..{{N}} bu listeden çekilir.
//
// Her event_type için, payload alanlarının {{N}} sırasını burası belirler.
// {{N}}  →  list[N-1]  →  stringValues[list[N-1]]  →  Meta'ya parametre.
//
// Listede OLMAYAN bir alan, Meta şablonunda {{N}} ile gösterilemez — positional
// modda boş string gelir. Listeye yeni alan eklemek/sıralamayı değiştirmek
// Meta şablonu ile koordineli yapılmalı (şablon "Sayın {{2}}" yazıyorsa
// list[1] o event için "müşteri adı" alanı olmalı).
//
// DİKKAT: send-template-message MODE 3'teki POSITIONAL_VAR_ORDER pattern'i ile
// aynı amaç — ama burada per-event ayrı liste (Faz 1+2'nin tüm event'lerini kapsar).
// ═══════════════════════════════════════════════════════════════════════════
const EVENT_VARIABLE_ORDER: Record<string, readonly string[]> = {
  // Turzz ekibi (Faz 1)
  new_reservation:        ["agency_name", "full_name", "tour_name", "date", "pax", "total_amount", "currency"],
  new_agency_signup:      ["name", "plan_type"],
  new_contact_form:       ["name", "email", "message"],
  // Acente (Faz 2)
  agency_new_reservation: ["full_name", "tour_name", "date", "pax", "total_amount", "currency"],
  agency_new_support:     ["phone", "type", "message"],
  // P7-C: {{1}}=talep özeti (ilk ~80 karakter), {{2}}=müşteri telefonu
  agency_new_lead:        ["request_text", "phone"],
};

// ─── Variable helper'ları (mirror of send-template-message/index.ts:17-41) ─────
// Mantık send-template-message'a yakın ama positional sıralama EVENT_VARIABLE_ORDER ile
// SABİT — payload key sırası (jsonb kanonik) artık etkilemiyor.
function extractOrderedVariables(content: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const m of (content.match(/\{(\w+)\}/g) || [])) {
    const name = m.replace(/[{}]/g, "");
    if (!seen.has(name)) { seen.add(name); ordered.push(name); }
  }
  return ordered;
}

function buildTemplateComponents(
  content: string,
  values: Record<string, string>,
  positionalOrder: readonly string[] | null,
): any[] {
  const vars = extractOrderedVariables(content);
  if (vars.length === 0) return [];

  const isPositional = vars.every((v) => /^\d+$/.test(v));

  if (!isPositional) {
    // Named mod — {full_name} gibi. Değişmedi, doğrudan name lookup.
    const parameters = vars.map((v) => ({ type: "text", text: (values[v] ?? "") + "" }));
    return [{ type: "body", parameters }];
  }

  // Positional mod ({{1}}, {{2}}, ...) — SABİT sıra
  if (!positionalOrder) {
    // Güvenli boş — event için sabit sıra tanımsızsa positional doldurmaz.
    // (Kabul edilen 5 event tanımlı; bu dal yalnızca beklenmeyen yeni event'lerde
    // ya da debug template'lerinde devreye girer.)
    console.warn("[dispatch-central] positional template but no order defined — empty params");
    const parameters = vars.map(() => ({ type: "text", text: "" }));
    return [{ type: "body", parameters }];
  }

  // {{N}} (sayı) → list[N-1] alanı → stringValues[alan].
  // vars dizisinin SIRASI yerine SAYISAL DEĞER kullanılır — şablonda {{3}} {{1}} {{2}}
  // sırayla yazılsa bile Meta parametre dizisini doğru index'lerle alır.
  const parameters = vars.map((numStr) => {
    const idx = parseInt(numStr, 10) - 1;
    const field = idx >= 0 && idx < positionalOrder.length ? positionalOrder[idx] : null;
    return { type: "text", text: field ? (values[field] ?? "") + "" : "" };
  });

  return [{ type: "body", parameters }];
}

// ─── template_send_log yazımı (non-blocking, mirror of send-template-message:57-70) ───
// agency_id parametre: Turzz ekibi gönderiminde TURZZ_CENTRAL_AGENCY_ID; acente
// gönderiminde gerçek acente UUID'si (RLS ile acente kendi panelinde geçmişi görsün).
async function logSend(
  sb: any,
  payload: {
    agency_id: string;
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
      agency_id: payload.agency_id,
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

  // GÜVENLİK (launch-öncesi): yalnız iç çağrı (_dispatch_central_notification
  // DB trigger'ı → service-role, migration 20260723120000). Anon → 401.
  if (!isServiceRoleCall(req)) return unauthorized(corsHeaders);

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

    // ─── Payload → string map (her iki akış için ortak) ──────────────────────
    const stringValues: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) {
      stringValues[k] = v == null ? "" : String(v);
    }

    // ─── Enrichment: agency_name (new_reservation gibi event'lerde lazım) ────
    // Trigger payload'ı agency_id taşıyor ama agency_name yok. EVENT_VARIABLE_ORDER
    // listesi "agency_name" içeriyorsa bu alanı acentenin tablosundan çekip
    // stringValues'a inject et. Lookup fail olursa boş string — gönderim devam etsin.
    const orderForEvent = EVENT_VARIABLE_ORDER[event_type] ?? null;
    if (orderForEvent && orderForEvent.includes("agency_name") && stringValues.agency_id) {
      try {
        const { data: ag } = await sb
          .from("agencies")
          .select("name")
          .eq("id", stringValues.agency_id)
          .maybeSingle();
        stringValues.agency_name = ag?.name ? String(ag.name) : "";
      } catch (_e) {
        // Sessiz — Meta'ya boş gönderilir, gönderim akışı bozulmaz.
        stringValues.agency_name = "";
      }
    }

    const components = buildTemplateComponents(tmpl.content, stringValues, orderForEvent);

    // ═══════════════════════════════════════════════════════════════════════
    // ACENTE AKIŞI (Faz 2) — event_type 'agency_' ile başlıyorsa
    // ═══════════════════════════════════════════════════════════════════════
    if (isAgencyEvent(event_type)) {
      const targetAgencyId = String(payload.agency_id || "").trim();
      if (!targetAgencyId) {
        await logCritical({
          event: "AGENCY_DISPATCH_NO_AGENCY_ID",
          error: new Error("payload.agency_id missing for agency_* event"),
          context: { event_type, payloadKeys: Object.keys(payload) },
          severity: "error",
        });
        return new Response(
          JSON.stringify({ ok: true, skipped: true, reason: "NO_AGENCY_ID" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // 4a) Acente ayarları
      const { data: settings, error: settingsErr } = await sb
        .from("agency_notification_settings")
        .select("phone, enabled, notify_new_reservation, notify_support")
        .eq("agency_id", targetAgencyId)
        .maybeSingle();

      if (settingsErr) {
        await logCritical({
          event: "AGENCY_DISPATCH_SETTINGS_QUERY_FAILED",
          error: new Error(settingsErr.message),
          context: { event_type, targetAgencyId },
          severity: "error",
        });
        return new Response(
          JSON.stringify({ ok: true, skipped: true, reason: "SETTINGS_QUERY_FAILED" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!settings) {
        console.info(`[dispatch-central/agency] no settings row for agency=${targetAgencyId.slice(0, 8)} — skipping`);
        return new Response(
          JSON.stringify({ ok: true, skipped: true, reason: "NO_AGENCY_SETTINGS" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!settings.enabled) {
        console.info(`[dispatch-central/agency] disabled for agency=${targetAgencyId.slice(0, 8)} — skipping`);
        return new Response(
          JSON.stringify({ ok: true, skipped: true, reason: "AGENCY_NOTIFICATIONS_DISABLED" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Event-specific toggle
      const toggleCol = AGENCY_EVENT_TOGGLE[event_type];
      if (toggleCol && settings[toggleCol] === false) {
        console.info(`[dispatch-central/agency] ${toggleCol}=false for agency=${targetAgencyId.slice(0, 8)} — skipping`);
        return new Response(
          JSON.stringify({ ok: true, skipped: true, reason: "EVENT_TOGGLE_OFF", toggle: toggleCol }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const agencyPhoneRaw = (settings.phone || "").trim();
      if (!agencyPhoneRaw) {
        console.info(`[dispatch-central/agency] no phone for agency=${targetAgencyId.slice(0, 8)} — skipping`);
        return new Response(
          JSON.stringify({ ok: true, skipped: true, reason: "NO_AGENCY_PHONE" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const agencyPhone = normalizePhone(agencyPhoneRaw);

      // 4b) Gönder + logla (log.agency_id = GERÇEK acente id → acente RLS ile görsün)
      try {
        const result = await sendWhatsAppTemplate(
          creds.phoneNumberId,
          creds.accessToken,
          agencyPhone,
          templateKey,
          language,
          components,
        );

        await logSend(sb, {
          agency_id:       targetAgencyId,
          template_type:   event_type,                 // 'agency_new_*' — acente filtresinde kullanır
          language,
          recipient_phone: agencyPhone,
          recipient_name:  null,
          success:         result.success,
          error_message:   result.success ? null : (result.error || "unknown"),
        });

        console.info(
          `[dispatch-central/agency] event=${event_type} agency=${targetAgencyId.slice(0, 8)} success=${result.success}`,
        );

        return new Response(
          JSON.stringify({
            ok: true,
            event_type,
            target: "agency",
            agency_id: targetAgencyId,
            sent: result.success ? 1 : 0,
            failed: result.success ? 0 : 1,
            messageId: result.messageId,
            error: result.error,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (sendErr: any) {
        const errMsg = sendErr?.message || String(sendErr);
        await logSend(sb, {
          agency_id:       targetAgencyId,
          template_type:   event_type,
          language,
          recipient_phone: agencyPhone,
          recipient_name:  null,
          success:         false,
          error_message:   errMsg,
        });
        return new Response(
          JSON.stringify({ ok: true, skipped: true, reason: "SEND_FAILED", error: errMsg }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TURZZ EKİBİ AKIŞI (Faz 1) — değişmedi
    // ═══════════════════════════════════════════════════════════════════════

    // 4) Alıcılar (turzz_team_recipients)
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

    // 5) Best-effort gönderim — Turzz ekibi alıcılarına paralel.
    //    Faz 1 davranışı korunur: log.agency_id = TURZZ_CENTRAL_AGENCY_ID.
    //    (Variable mapping/components yukarıda ortak alanda hazırlandı.)
    const results = await Promise.allSettled(
      recipients.map(async (r: any) => {
        const phone = normalizePhone(r.phone);
        if (!phone) {
          await logSend(sb, {
            agency_id: TURZZ_CENTRAL_AGENCY_ID,
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
            agency_id: TURZZ_CENTRAL_AGENCY_ID,
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
            agency_id: TURZZ_CENTRAL_AGENCY_ID,
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
