// create-meta-template — Panel'den oluşturulan template'i Meta WABA'ya gönderir
// POST { agencyId, templateKey, language, category, bodyText, variableExamples }
// Meta onayı genellikle birkaç dakika - saat arası sürer.
//
// named → indexed dönüşüm burada yapılır:
// "Merhaba {full_name}, {tour_name}" → "Merhaba {{1}}, {{2}}"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// {full_name} → {{1}}, sırayla index'ler; değişken adlarını döndürür
function namedToIndexed(content: string): { text: string; varNames: string[] } {
  const varNames: string[] = [];
  const seen = new Map<string, number>();
  let idx = 1;

  const text = content.replace(/\{(\w+)\}/g, (_match, name) => {
    if (seen.has(name)) return `{{${seen.get(name)}}}`;
    seen.set(name, idx);
    varNames.push(name);
    return `{{${idx++}}}`;
  });

  return { text, varNames };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // JWT doğrulama
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { agencyId, templateKey, language, category, bodyText, variableExamples } = await req.json();

    if (!agencyId || !templateKey || !language || !bodyText) {
      return new Response(JSON.stringify({ error: "agencyId, templateKey, language, bodyText required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Agency doğrula
    const { data: agency } = await supabase
      .from("agencies")
      .select("id, meta_waba_id, meta_access_token, user_id")
      .eq("id", agencyId)
      .single();

    if (!agency || agency.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Agency not found or unauthorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wabaId      = agency.meta_waba_id;
    const accessToken = agency.meta_access_token || Deno.env.get("WHATSAPP_ACCESS_TOKEN");

    if (!wabaId || !accessToken) {
      return new Response(JSON.stringify({ error: "WABA ID or access token not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Named → indexed dönüşüm
    const { text: indexedBody, varNames } = namedToIndexed(bodyText);

    // Meta template name: lowercase, sadece harf/rakam/underscore
    const metaName = templateKey.toLowerCase().replace(/[^a-z0-9_]/g, "_");

    const component: any = { type: "BODY", text: indexedBody };

    // Variable örnek değerleri (Meta zorunlu tutar)
    const examples = variableExamples || varNames.map(v => `örnek_${v}`);
    if (varNames.length > 0) {
      component.example = { body_text: [examples] };
    }

    const payload = {
      name: metaName,
      language,
      category: category || "UTILITY",
      components: [component],
    };

    console.log(`[create-meta-template] Creating: ${metaName} (${language}) for WABA ${wabaId}`);
    console.log(`[create-meta-template] Body: "${indexedBody}"`);

    const metaRes = await fetch(
      `https://graph.facebook.com/v18.0/${wabaId}/message_templates`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const metaData = await metaRes.json();

    if (!metaRes.ok) {
      console.error("[create-meta-template] Meta error:", JSON.stringify(metaData));
      return new Response(
        JSON.stringify({ success: false, error: metaData?.error?.message || "Meta API error" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[create-meta-template] Created: id=${metaData.id} status=${metaData.status}`);

    // DB'ye meta_template_id ve PENDING status yaz
    await (supabase as any)
      .from("message_templates")
      .update({
        meta_template_id: metaData.id,
        meta_status: metaData.status || "PENDING",
        meta_category: category || "UTILITY",
        meta_last_synced_at: new Date().toISOString(),
      })
      .eq("agency_id", agencyId)
      .eq("template_key", templateKey)
      .eq("language", language);

    return new Response(
      JSON.stringify({
        success: true,
        metaTemplateId: metaData.id,
        status: metaData.status || "PENDING",
        varNames,
        indexedBody,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[create-meta-template] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
