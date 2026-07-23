// send-tour-reminders — Acente-yönetilebilir tur hatırlatma cron'u.
//
// REFACTOR (eski → yeni):
//   ESKİ: Hardcoded 3 gün önce + 7-dil kod-içi mesaj + FREE-FORM gönderim (24h kuralı
//         yüzünden çoğunlukla başarısız: müşteri 24h penceresi dışındaysa Meta reddeder).
//   YENİ: agency_event_templates'ten okur — acente seçtiği offset_hours (-72/-24/...) +
//         template_key + language ile MÜŞTERİ DİLİNE göre TEMPLATE-BASED gönderim
//         (24h muaf). send-template-message MODE 3 (registrationId-bazlı otomatik
//         değişken doldurma) reuse edilir.
//
// AKIŞ:
//   1. agency_event_templates'te event_type='tour_reminder' enabled=true satırlar
//   2. Her satır için:
//      - Plan gate (plan_features.has_reminders)
//      - Pencere: today + |offset_hours| ile +24h arası (gün granül)
//      - Acentenin o penceredeki active rezervasyonları (reminder_sent=false)
//      - Her rezervasyon için müşteri language_preference belirle
//      - Eğer müşteri dili satırın language'ı ile eşleşiyorsa → send-template-message MODE 3
//      - Başarılı: reminder_sent=true (tekrar gönderim engeli)
//
// CRON: Günlük çalışacak (Supabase Dashboard scheduler veya pg_cron). 24-saat pencere
// günlük taramayla tüm uygun rezervasyonları yakalar.
//
// Acente eşleştirme yapmadıysa veya enabled=false → graceful skip (hata değil).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone } from "../_shared/phone.ts";
import { isServiceRoleCall, unauthorized } from "../_shared/edge-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MatchingRow {
  id: string;
  agency_id: string;
  template_key: string;
  language: string;
  offset_hours: number;
}

interface RegistrationRow {
  id: string;
  full_name: string;
  phone: string;
  status: string;
  tour_dates: { departure_date: string } | { departure_date: string }[];
}

// send-template-message MODE 3 (registrationId-bazlı) HTTP invoke.
// Edge function-to-function call — Bearer SERVICE_ROLE_KEY ile.
// send-template-message zaten otomatik değişken doldurma (full_name, tour_name,
// date, pax, total_amount, currency, meeting_time, meeting_point) + sendWhatsAppTemplate
// (Meta template, 24h MUAF) + template_send_log audit yapar.
async function invokeSendTemplate(opts: {
  registrationId: string;
  templateKey: string;
  language: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-template-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "X-Internal-Secret": Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "",
      },
      body: JSON.stringify(opts),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `send-template-message HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = await res.json();
    if (data && data.success === false) {
      return { success: false, error: data.error || data.debug?.metaError || "unknown" };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GÜVENLİK (launch-öncesi): yalnız iç çağrı (pg_cron → service-role). Anon → 401.
  if (!isServiceRoleCall(req)) return unauthorized(corsHeaders);

  try {
    console.log("🕐 tour_reminder job started at:", new Date().toISOString());

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ── 1) Aktif tour_reminder eşleştirmeleri ────────────────────────────────
    const { data: matchings, error: mErr } = await (supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (c: string, v: unknown) => {
            eq: (c2: string, v2: unknown) => Promise<{ data: MatchingRow[] | null; error: unknown }>;
          };
        };
      };
    })
      .from("agency_event_templates")
      .select("id, agency_id, template_key, language, offset_hours")
      .eq("event_type", "tour_reminder")
      .eq("enabled", true);

    if (mErr) {
      console.error("❌ matchings fetch error:", mErr);
      throw mErr;
    }

    const rows = (matchings ?? []) as MatchingRow[];
    if (rows.length === 0) {
      console.log("📭 No active tour_reminder matchings — nothing to do.");
      return new Response(
        JSON.stringify({ success: true, message: "No matchings configured", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    console.log(`📋 ${rows.length} active tour_reminder matchings`);

    // ── Plan gate cache (her acente için 1 kez sor) ──────────────────────────
    const planCache = new Map<string, boolean>();
    async function hasRemindersEnabled(agencyId: string): Promise<boolean> {
      if (planCache.has(agencyId)) return planCache.get(agencyId)!;
      const { data: agency } = await supabase
        .from("agencies")
        .select("plan_type")
        .eq("id", agencyId)
        .single();
      if (!agency) {
        planCache.set(agencyId, false);
        return false;
      }
      const { data: pf } = await supabase
        .from("plan_features")
        .select("has_reminders")
        .eq("plan_type", agency.plan_type)
        .single();
      const flag = !!pf?.has_reminders;
      planCache.set(agencyId, flag);
      return flag;
    }

    let totalSent = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // ── 2) Her eşleştirme için pencere taraması ──────────────────────────────
    for (const m of rows) {
      const hoursOffset = Math.abs(m.offset_hours); // -72 → 72 (önce N saat)
      const nowMs = Date.now();
      const startMs = nowMs + hoursOffset * 3600 * 1000;
      const endMs = startMs + 24 * 3600 * 1000; // 24 saat pencere (günlük cron tarama)

      const startDate = new Date(startMs).toISOString().split("T")[0];
      const endDate = new Date(endMs).toISOString().split("T")[0];

      console.log(
        `🎯 matching agency=${m.agency_id.slice(0, 8)} lang=${m.language} ` +
          `offset=${m.offset_hours}h window=${startDate}→${endDate}`,
      );

      // Plan gate
      const planOk = await hasRemindersEnabled(m.agency_id);
      if (!planOk) {
        console.log(`⏭️ plan skip: ${m.agency_id.slice(0, 8)} — has_reminders=false`);
        continue;
      }

      // Pencere rezervasyonları — 2026-07-10 (karar 2): yalnız CONFIRMED.
      // NEW (henüz kesinleşmemiş) müşteriye "yarın görüşürüz" gitmesin; CANCELLED
      // zaten dışarıda. ÖDEME FİLTRESİ YOK (araçta-nakit meşru senaryo — karar 2a).
      // Anket (send-feedback-survey) zaten CONFIRMED-only. Ödeme-bazlı gönderim
      // seçimi (panel: tümü/kaporalı/tam) → launch-sonrası backlog (M).
      const { data: regs, error: regErr } = await supabase
        .from("registrations")
        .select(`id, full_name, phone, status, tour_dates!inner(departure_date)`)
        .eq("agency_id", m.agency_id)
        .eq("reminder_sent", false)
        .eq("status", "CONFIRMED")
        .gte("tour_dates.departure_date", startDate)
        .lt("tour_dates.departure_date", endDate);

      if (regErr) {
        console.error(`❌ regs fetch error ${m.agency_id}:`, regErr);
        totalErrors++;
        continue;
      }

      const regsList = (regs ?? []) as unknown as RegistrationRow[];
      if (regsList.length === 0) {
        console.log(`📭 no regs in window for ${m.agency_id.slice(0, 8)}/${m.language}`);
        continue;
      }
      console.log(`👥 ${regsList.length} regs in window`);

      // ── 3) Her rezervasyon: dil eşleşmesi + template gönderim ──────────────
      for (const reg of regsList) {
        try {
          // Müşteri dil tercihi
          const normalizedPhone = normalizePhone(reg.phone);
          const { data: profile } = await supabase
            .from("whatsapp_user_profiles")
            .select("language_preference")
            .eq("phone", normalizedPhone)
            .eq("agency_id", m.agency_id)
            .maybeSingle();
          const customerLang = (profile?.language_preference as string | undefined) || "tr";

          // Bu satırın dili müşteri diliyle eşleşmiyorsa — başka bir m içinde işlenir
          // (acente o dil için başka eşleştirme yaptıysa). Burada bu rezervasyon atlanır.
          if (customerLang !== m.language) {
            totalSkipped++;
            continue;
          }

          // send-template-message MODE 3 invoke
          const result = await invokeSendTemplate({
            registrationId: reg.id,
            templateKey: m.template_key,
            language: m.language,
          });

          if (result.success) {
            await supabase
              .from("registrations")
              .update({
                reminder_sent: true,
                reminder_sent_at: new Date().toISOString(),
              })
              .eq("id", reg.id);
            totalSent++;
            console.log(`✅ sent reg=${reg.id.slice(0, 8)} lang=${customerLang}`);
          } else {
            totalErrors++;
            console.error(`❌ send failed reg=${reg.id.slice(0, 8)}: ${result.error}`);
          }

          // Rate limiting — Meta hızını aşmamak için
          await new Promise((r) => setTimeout(r, 500));
        } catch (e) {
          totalErrors++;
          console.error(`❌ reg error ${reg.id}:`, e instanceof Error ? e.message : e);
        }
      }
    }

    console.log(
      `✅ Done. sent=${totalSent} skipped=${totalSkipped} errors=${totalErrors}`,
    );
    return new Response(
      JSON.stringify({
        success: true,
        sent: totalSent,
        skipped: totalSkipped,
        errors: totalErrors,
        matchings: rows.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("❌ tour_reminder job error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
