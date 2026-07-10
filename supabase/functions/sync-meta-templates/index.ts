// sync-meta-templates — Meta Graph API'den template listesini çekip DB'yi upsert eder
// POST { agencyId } → yeni template INSERT, var olan UPDATE (meta_status + content)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { agencyId } = await req.json();
    if (!agencyId) {
      return new Response(JSON.stringify({ error: "agencyId required" }), {
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

    const { data: agency } = await supabase
      .from("agencies")
      .select("meta_access_token, meta_waba_id")
      .eq("id", agencyId)
      .single();

    // 2026-07-10: net eksik-alan mesajı (özellikle manuel kurulumda waba_id boş
    // kalıyordu → "şablonları eşleştir" sessizce patlıyordu).
    if (!agency?.meta_access_token || !agency?.meta_waba_id) {
      const _eksik = !agency?.meta_waba_id
        ? "WABA kimliği (meta_waba_id) eksik — WhatsApp ayarlarından 'Manuel Bağlantı' ile numaranızı doğrulayın (WABA otomatik keşfedilir)."
        : "Meta erişim token'ı eksik — WhatsApp bağlantısını yeniden kurun.";
      return new Response(JSON.stringify({ error: _eksik, code: "CREDENTIALS_MISSING" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch template list from Meta Graph API
    const url = `https://graph.facebook.com/v18.0/${agency.meta_waba_id}/message_templates?fields=id,name,status,category,language,components&limit=100`;
    const metaRes = await fetch(url, {
      headers: { Authorization: `Bearer ${agency.meta_access_token}` },
    });

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      console.error("[sync-meta-templates] Meta API error:", errText);
      // 2026-07-10: token-scope hatasını NET mesaja çevir (sessiz-boş liste YASAK).
      let _parsed: any = {};
      try { _parsed = JSON.parse(errText); } catch { /* düz metin */ }
      const _code = _parsed?.error?.code;
      let _msg = `Meta API hatası (HTTP ${metaRes.status}).`;
      if (_code === 190) _msg = "Token geçersiz veya süresi dolmuş — Meta System User token'ınızı yenileyin.";
      else if (_code === 200 || _code === 10 || _code === 803) _msg = "Token yetkisi eksik (whatsapp_business_management izni gerekli) — System User token'ını doğru izinlerle yeniden oluşturun.";
      else if (_code === 100) _msg = "WABA kimliği geçersiz görünüyor — WhatsApp bağlantısını yeniden doğrulayın.";
      return new Response(JSON.stringify({ error: _msg, code: _code ?? null, detail: errText.slice(0, 300) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metaData = await metaRes.json();
    const metaTemplates: Array<{ id: string; name: string; status: string; category: string; language: string }> = metaData.data || [];

    console.log(`[sync-meta-templates] Fetched ${metaTemplates.length} templates from Meta for agency ${agencyId.slice(0, 8)}`);

    // Meta 'en_US', 'tr_TR' formatı döndürüyor — 2 harfe indir
    const normalizeLang = (lang: string): string =>
      (lang || "tr").split("_")[0].split("-")[0].toLowerCase();

    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (const mt of metaTemplates) {
      const lang = normalizeLang(mt.language); // 'en_US' → 'en', 'tr_TR' → 'tr'

      // Meta template body içeriğini ve değişkenleri çıkar
      const components: any[] = (mt as any).components || [];
      const bodyComponent = components.find((c: any) => c.type === "BODY");
      const content = bodyComponent?.text || "";
      const variableMatches = content.match(/\{\{\d+\}\}/g) || [];
      const variables = variableMatches.map((v: string) => v.replace(/\{\{|\}\}/g, ""));

      console.log(`[sync] Processing: ${mt.name}/${mt.language} → normalized lang: ${lang}`);

      // Eski normalize edilmemiş kayıt varsa sil (örn. 'en_US' → 'en'e geçiş)
      if (mt.language !== lang) {
        await (supabase as any)
          .from("message_templates")
          .delete()
          .eq("agency_id", agencyId)
          .eq("template_key", mt.name)
          .eq("language", mt.language); // eski: 'en_US'
        console.log(`[sync] Cleaned up old non-normalized record: ${mt.name}/${mt.language}`);
      }

      // Normalize edilmiş dil ile kayıt var mı kontrol et
      const { data: existing } = await (supabase as any)
        .from("message_templates")
        .select("id")
        .eq("agency_id", agencyId)
        .eq("template_key", mt.name)
        .eq("language", lang) // normalize: 'en'
        .maybeSingle();

      if (existing) {
        // VAR → meta alanları + content güncelle (is_active da güncellenir)
        const updatePayload: Record<string, any> = {
          meta_template_id: mt.id,
          meta_status: mt.status,
          is_active: mt.status === "APPROVED",   // status değişince is_active senkronize et
          meta_category: mt.category,
          meta_last_synced_at: new Date().toISOString(),
        };
        if (content) updatePayload.content = content;

        const { error } = await (supabase as any)
          .from("message_templates")
          .update(updatePayload)
          .eq("id", existing.id);

        if (error) {
          console.warn(`[sync] Update failed for ${mt.name}/${lang}:`, error.message);
          failed++;
        } else {
          updated++;
        }
      } else {
        // YOK → INSERT (normalize edilmiş dil ile)
        const { error } = await (supabase as any)
          .from("message_templates")
          .insert({
            agency_id: agencyId,
            template_key: mt.name,
            language: lang, // normalize: 'en'
            subject: mt.name.replace(/_/g, " "),
            content: content || mt.name,
            variables,
            is_active: mt.status === "APPROVED",
            meta_template_id: mt.id,
            meta_status: mt.status,
            meta_category: mt.category,
            meta_last_synced_at: new Date().toISOString(),
          });

        if (error) {
          console.error(`[sync] Insert failed for ${mt.name}/${lang}:`, error.message);
          failed++;
        } else {
          inserted++;
          console.log(`[sync] Inserted: ${mt.name}/${lang}`);
        }
      }
    }

    console.log(`[sync-meta-templates] Done: inserted=${inserted} updated=${updated} failed=${failed}`);

    return new Response(
      JSON.stringify({ success: true, total: metaTemplates.length, inserted, updated, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[sync-meta-templates] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
