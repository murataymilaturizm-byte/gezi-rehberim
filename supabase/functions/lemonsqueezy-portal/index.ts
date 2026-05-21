import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // ── Auth: caller kimliği doğrula ──────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // ─────────────────────────────────────────────────────────────────────────

    const { agencyId } = await req.json();

    if (!agencyId) {
      return new Response(
        JSON.stringify({ error: "agencyId gerekli" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── Ownership: bu agency caller'a ait mi? ─────────────────────────────────
    const { data: ownerCheck } = await supabase
      .from("agencies")
      .select("id")
      .eq("id", agencyId)
      .eq("user_id", user.id)
      .single();
    if (!ownerCheck) {
      return new Response(
        JSON.stringify({ error: "Agency not found or unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Agency'nin LS customer ID'sini al
    const { data: agency, error: agencyError } = await supabase
      .from("agencies")
      .select("lemonsqueezy_customer_id, name")
      .eq("id", agencyId)
      .single();

    if (agencyError || !agency) {
      return new Response(
        JSON.stringify({ error: "Acente bulunamadı" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!agency.lemonsqueezy_customer_id) {
      return new Response(
        JSON.stringify({ error: "Bu acentenin Lemon Squeezy aboneliği bulunamadı" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Lemon Squeezy API'dan customer portal URL'ini al
    const lsApiKey = Deno.env.get("LEMONSQUEEZY_API_KEY");
    if (!lsApiKey) {
      throw new Error("LEMONSQUEEZY_API_KEY tanımlı değil");
    }

    const response = await fetch(
      `https://api.lemonsqueezy.com/v1/customers/${agency.lemonsqueezy_customer_id}`,
      {
        headers: {
          "Authorization": `Bearer ${lsApiKey}`,
          "Accept": "application/vnd.api+json",
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LS_PORTAL_API_ERROR", { status: response.status, body: errorText });
      throw new Error(`Lemon Squeezy API hatası: ${response.status}`);
    }

    const data = await response.json();
    const portalUrl: string | undefined = data.data?.attributes?.urls?.customer_portal;

    if (!portalUrl) {
      throw new Error("Lemon Squeezy'den portal URL alınamadı");
    }

    console.info("LS_PORTAL_URL_FETCHED", { agencyId, agencyName: agency.name });

    return new Response(
      JSON.stringify({ url: portalUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("LS_PORTAL_ERROR", { error: String(error) });
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
