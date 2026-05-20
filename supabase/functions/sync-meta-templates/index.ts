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
    const { agencyId } = await req.json();
    if (!agencyId) {
      return new Response(JSON.stringify({ error: "agencyId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: agency } = await supabase
      .from("agencies")
      .select("meta_access_token, meta_waba_id")
      .eq("id", agencyId)
      .single();

    if (!agency?.meta_access_token || !agency?.meta_waba_id) {
      return new Response(JSON.stringify({ error: "Meta credentials missing (meta_access_token / meta_waba_id)" }), {
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
      return new Response(JSON.stringify({ error: `Meta API error: ${metaRes.status}`, detail: errText }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metaData = await metaRes.json();
    const metaTemplates: Array<{ id: string; name: string; status: string; category: string; language: string }> = metaData.data || [];

    console.log(`[sync-meta-templates] Fetched ${metaTemplates.length} templates from Meta for agency ${agencyId.slice(0, 8)}`);

    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (const mt of metaTemplates) {
      // Meta template body içeriğini ve değişkenleri çıkar
      const components: any[] = mt.components || [];
      const bodyComponent = components.find((c: any) => c.type === "BODY");
      const content = bodyComponent?.text || "";
      const variableMatches = content.match(/\{\{\d+\}\}/g) || [];
      const variables = variableMatches.map((v: string) => v.replace(/\{\{|\}\}/g, ""));

      // Önce var mı kontrol et
      const { data: existing } = await (supabase as any)
        .from("message_templates")
        .select("id")
        .eq("agency_id", agencyId)
        .eq("template_key", mt.name)
        .eq("language", mt.language)
        .maybeSingle();

      if (existing) {
        // VAR → sadece meta alanlarını güncelle (content değişmişse onu da)
        const updatePayload: Record<string, any> = {
          meta_template_id: mt.id,
          meta_status: mt.status,
          meta_category: mt.category,
          meta_last_synced_at: new Date().toISOString(),
        };
        if (content) updatePayload.content = content;

        const { error } = await (supabase as any)
          .from("message_templates")
          .update(updatePayload)
          .eq("id", existing.id);

        if (error) {
          console.warn(`[sync] Update failed for ${mt.name}/${mt.language}:`, error.message);
          failed++;
        } else {
          updated++;
        }
      } else {
        // YOK → INSERT (Meta'dan gelen tam kayıt)
        const { error } = await (supabase as any)
          .from("message_templates")
          .insert({
            agency_id: agencyId,
            template_key: mt.name,
            language: mt.language,
            subject: mt.name.replace(/_/g, " "),
            content,
            variables,
            is_active: mt.status === "APPROVED",
            meta_template_id: mt.id,
            meta_status: mt.status,
            meta_category: mt.category,
            meta_last_synced_at: new Date().toISOString(),
          });

        if (error) {
          console.error(`[sync] Insert failed for ${mt.name}/${mt.language}:`, error.message);
          failed++;
        } else {
          inserted++;
          console.log(`[sync] Inserted new template: ${mt.name}/${mt.language}`);
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
