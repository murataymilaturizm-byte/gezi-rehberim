// send-feedback-survey — Acente-yönetilebilir tur sonrası memnuniyet anketi cron'u.
//
// REFACTOR (eski → yeni):
//   ESKİ: Hardcoded dün biten tur + 7-dil kod-içi mesaj + FREE-FORM gönderim
//         (24h kuralı sorunu — müşteri tur bitimi sonrası mesaj atmamışsa Meta reddeder).
//   YENİ: agency_event_templates'ten okur — acente seçtiği offset_hours (+24/+48/...) +
//         template_key + language ile MÜŞTERİ DİLİNE göre TEMPLATE-BASED gönderim.
//         send-template-message MODE 3 reuse (Meta template, 24h MUAF).
//
// AKIŞ:
//   1. agency_event_templates'te event_type='feedback_survey' enabled=true satırlar
//   2. Her satır için:
//      - Plan gate (plan_features.has_feedback)
//      - Pencere: today - offset_hours (örn +24 → dün biten turlar)
//      - O acentenin pencerede biten tur_dates'lerinin CONFIRMED rezervasyonları
//      - Müşteri dili satırın language'ı ile eşleşiyorsa
//      - last_feedback_sent_at < 7 gün önce ise (cooldown)
//      - send-template-message MODE 3 → last_feedback_sent_at = now()
//
// Acente eşleştirme yapmadıysa veya enabled=false → graceful skip.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone } from "../_shared/phone.ts";
import { feedbackWindowBounds, buildFeedbackWindowOrFilter } from "../_shared/feedback-window.ts";
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

interface TourDateRow {
  id: string;
  departure_date: string;
  tours: { title: string; agency_id: string } | { title: string; agency_id: string }[];
}

interface RegistrationRow {
  id: string;
  full_name: string;
  phone: string;
}

interface UserProfileRow {
  id: string;
  phone: string;
  language_preference: string | null;
  last_feedback_sent_at: string | null;
}

// send-template-message MODE 3 (registrationId-bazlı) HTTP invoke — tour reminder ile aynı.
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GÜVENLİK (launch-öncesi): yalnız iç çağrı (pg_cron → service-role). Anon → 401.
  if (!isServiceRoleCall(req)) return unauthorized(corsHeaders);

  try {
    console.log("🕐 feedback_survey job started at:", new Date().toISOString());

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ── 1) Aktif feedback_survey eşleştirmeleri ──────────────────────────────
    const { data: matchings, error: mErr } = await supabase
      .from("agency_event_templates")
      .select("id, agency_id, template_key, language, offset_hours")
      .eq("event_type", "feedback_survey")
      .eq("enabled", true);

    if (mErr) {
      console.error("❌ matchings fetch error:", mErr);
      throw mErr;
    }

    const rows = (matchings ?? []) as unknown as MatchingRow[];
    if (rows.length === 0) {
      console.log("📭 No active feedback_survey matchings.");
      return new Response(
        JSON.stringify({ success: true, message: "No matchings configured", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    console.log(`📋 ${rows.length} active feedback_survey matchings`);

    // ── Plan gate cache (has_feedback) ───────────────────────────────────────
    const planCache = new Map<string, boolean>();
    async function hasFeedbackEnabled(agencyId: string): Promise<boolean> {
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
        .select("has_feedback")
        .eq("plan_type", agency.plan_type)
        .single();
      const flag = !!pf?.has_feedback;
      planCache.set(agencyId, flag);
      return flag;
    }

    let totalSent = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // F-0-EK / P8-3 deseni (2026-07-29): "skipped: N" tek başına sessizdi —
    // 0 mı yoksa sebebi ne, gövdeden okunamıyordu. Artık sebep kırılımı dönüyor.
    // Kırılım kodları: NO_PLAN · NO_TOUR_DATES · LANG_MISMATCH · COOLDOWN.
    // (NO_PROFILE artık bir atlama sebebi DEĞİL — F-0-FIX ile gönderime dönüştü;
    //  yine de kaç gönderimin profilsiz yapıldığı `noProfileSent` ile ölçülüyor.)
    const skipReasons: Record<string, number> = {};
    let noProfileSent = 0;
    const bump = (reason: string) => {
      totalSkipped++;
      skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
    };

    // ── 2) Her eşleştirme için pencere ───────────────────────────────────────
    for (const m of rows) {
      // F-2+F-3 (2026-07-27): pencere TEK-KAYNAK _shared/feedback-window.ts.
      // Bitiş = coalesce(return_date, departure_date); aralık [now−14g, now−offset]
      // gün-granül + feedback_sent_at IS NULL (aşağıda) → kaçan gün telafi edilir,
      // çift-gönderim kayıt-kilidiyle engellenir. Eski tek-günlük pencere kaçırma
      // sonrası kalıcı kayıp üretiyordu (A2-EK kök raporu).
      const { floor: startDate, ceil: endDate } = feedbackWindowBounds(Date.now(), m.offset_hours);

      console.log(
        `🎯 matching agency=${m.agency_id.slice(0, 8)} lang=${m.language} ` +
          `offset=+${m.offset_hours}h window=${startDate}→${endDate} (coalesce-bitiş)`,
      );

      const planOk = await hasFeedbackEnabled(m.agency_id);
      if (!planOk) {
        console.log(`⏭️ plan skip: ${m.agency_id.slice(0, 8)} — has_feedback=false`);
        bump("NO_PLAN");
        continue;
      }

      // Pencerede BİTEN tour_dates — coalesce(return_date, departure_date) bazlı
      // (or-filtre; tours!inner.agency_id bu acenteye sabitler, seed/null-agency elenir).
      const { data: tds, error: tdErr } = await supabase
        .from("tour_dates")
        .select(`id, departure_date, return_date, tours!inner(title, agency_id)`)
        .or(buildFeedbackWindowOrFilter(startDate, endDate))
        .eq("tours.agency_id", m.agency_id);

      if (tdErr) {
        console.error(`❌ tour_dates fetch error ${m.agency_id}:`, tdErr);
        totalErrors++;
        continue;
      }

      const tdList = (tds ?? []) as unknown as TourDateRow[];
      if (tdList.length === 0) {
        console.log(`📭 no completed tours in window for ${m.agency_id.slice(0, 8)}/${m.language}`);
        bump("NO_TOUR_DATES");
        continue;
      }
      console.log(`📅 ${tdList.length} tour dates in window`);

      for (const td of tdList) {
        // CONFIRMED + HENÜZ ANKET GİTMEMİŞ rezervasyonlar (F-3: kayıt-bazlı
        // çift-gönderim kilidi — pencere genişlediği için şart; 10-Tem test-damgalı
        // eski kayıtlar da bu filtreyle güvenle dışarıda kalır).
        const { data: regs, error: regErr } = await supabase
          .from("registrations")
          .select("id, full_name, phone")
          .eq("tour_date_id", td.id)
          .eq("status", "CONFIRMED")
          .is("feedback_sent_at", null);

        if (regErr) {
          console.error(`❌ regs fetch error td=${td.id}:`, regErr);
          totalErrors++;
          continue;
        }

        for (const reg of (regs ?? []) as unknown as RegistrationRow[]) {
          try {
            const normalizedPhone = normalizePhone(reg.phone);
            const { data: profile } = await supabase
              .from("whatsapp_user_profiles")
              .select("id, phone, language_preference, last_feedback_sent_at")
              .eq("phone", normalizedPhone)
              .eq("agency_id", m.agency_id)
              .maybeSingle();

            // F-0-FIX (2026-07-29): profil YOKSA artık ATLAMIYORUZ.
            //
            // Kök vaka: müşteri WhatsApp'tan bot akışıyla rezervasyon yaptı ama
            // İLETİŞİM numarası olarak BAŞKA bir numara verdi (yazan …0303,
            // rezervasyona yazılan …8989). Profil yalnız YAZAN numara için açılır
            // (upsertUserProfile inbound mesajda çalışır) → rezervasyon telefonunun
            // profili hiç olmaz. Eski kod bu müşteriyi sessizce eliyordu; oysa
            // AYNI müşteriye tur-hatırlatması GİTMİŞTİ (send-tour-reminders profil
            // yokluğunda dil-varsayılanına düşüyor). İki cron tutarsızdı.
            //
            // Profil yoksa: acentenin bu eşleşme için seçtiği dil (m.language) —
            // "tr" sabitinden isabetli, çünkü acente şablonu zaten o dilde.
            //
            // COOLDOWN: profil yoksa last_feedback_sent_at damgası da yoktur,
            // dolayısıyla 7-gün kontrolü uygulanamaz. Çift-gönderim riski YOK:
            // kayıt-bazlı `feedback_sent_at IS NULL` kilidi (yukarıdaki sorgu +
            // gönderim sonrası damga) her rezervasyon için tek gönderim garantiler.
            // Profil-cooldown'u yalnız "aynı kişinin FARKLI rezervasyonları" içindir;
            // profilsiz müşteride o senaryo zaten izlenemez.
            const p = (profile ?? null) as UserProfileRow | null;
            const customerLang = p?.language_preference || m.language;

            // Dil eşleşmesi (profilsizde customerLang === m.language olduğu için
            // bu dal profilsiz müşteriyi ASLA elemez — fix'in can damarı).
            if (customerLang !== m.language) {
              bump("LANG_MISMATCH");
              continue;
            }

            // Cooldown — son 7 günde anket gönderildiyse atla (yalnız profilliyken)
            if (p?.last_feedback_sent_at) {
              const diffDays =
                (Date.now() - new Date(p.last_feedback_sent_at).getTime()) /
                (1000 * 60 * 60 * 24);
              if (diffDays < 7) {
                console.log(
                  `⏭️ cooldown: ${reg.phone} ${diffDays.toFixed(1)}d since last survey`,
                );
                bump("COOLDOWN");
                continue;
              }
            }

            // send-template-message MODE 3 invoke
            const result = await invokeSendTemplate({
              registrationId: reg.id,
              templateKey: m.template_key,
              language: m.language,
            });

            if (result.success) {
              const _nowIso = new Date().toISOString();
              // Profil varsa cooldown damgası; yoksa atlanır (damgalanacak satır yok).
              if (p?.id) {
                await supabase
                  .from("whatsapp_user_profiles")
                  .update({ last_feedback_sent_at: _nowIso })
                  .eq("id", p.id);
              }
              // B3: rezervasyona da yaz → cevap-yakalama penceresi (feedback_sent_at + 72h).
              await supabase
                .from("registrations")
                .update({ feedback_sent_at: _nowIso })
                .eq("id", reg.id);
              totalSent++;
              if (!p) noProfileSent++;
              console.log(
                `✅ survey sent reg=${reg.id.slice(0, 8)} lang=${customerLang}` +
                  (p ? "" : " (profilsiz — acente dili)"),
              );
            } else {
              totalErrors++;
              console.error(`❌ send failed reg=${reg.id.slice(0, 8)}: ${result.error}`);
            }

            await new Promise((r) => setTimeout(r, 500));
          } catch (e) {
            totalErrors++;
            console.error(`❌ reg error ${reg.id}:`, e instanceof Error ? e.message : e);
          }
        }
      }
    }

    console.log(
      `✅ Done. sent=${totalSent} (profilsiz=${noProfileSent}) skipped=${totalSkipped} ` +
        `${JSON.stringify(skipReasons)} errors=${totalErrors}`,
    );
    return new Response(
      JSON.stringify({
        success: true,
        sent: totalSent,
        sent_without_profile: noProfileSent,
        skipped: totalSkipped,
        skip_reasons: skipReasons,
        errors: totalErrors,
        matchings: rows.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("❌ feedback_survey job error:", error);
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
