import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const metaAppId = Deno.env.get("META_APP_ID");
    const metaBusinessId = Deno.env.get("META_BUSINESS_ID");

    if (!metaAppId || !metaBusinessId) {
      return new Response(
        JSON.stringify({ error: "Meta App credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify JWT - get user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action } = await req.json();

    // Action: get-config — return app ID for frontend SDK
    if (action === "get-config") {
      return new Response(
        JSON.stringify({
          appId: metaAppId,
          configId: metaBusinessId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: exchange-token — exchange code for token and save credentials
    if (action === "exchange-token") {
      const { code, agencyId } = await req.json().catch(() => ({}));
      const body = await req.json().catch(() => null);
      
      // Re-parse since we already consumed the body
      // Actually let me fix this - parse once at the top
    }

    // Let me restructure - parse body once
    return await handleRequest(req, supabase, user, metaAppId, metaBusinessId);
  } catch (error) {
    console.error("❌ Meta Embedded Signup error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleRequest(
  _req: Request,
  _supabase: any,
  _user: any,
  _metaAppId: string,
  _metaBusinessId: string
) {
  // placeholder - will be replaced with proper implementation
  return new Response(
    JSON.stringify({ error: "Not implemented" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
