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
    const metaAppSecret = Deno.env.get("META_APP_SECRET");

    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    // Return app config for frontend SDK initialization
    if (action === "get-config") {
      const metaAppId = Deno.env.get("META_APP_ID");
      // META_CONFIG_ID = Embedded Signup Configuration ID (öncelikli)
      // META_BUSINESS_ID = fallback (eski secret adı)
      const metaConfigId = Deno.env.get("META_CONFIG_ID") || Deno.env.get("META_BUSINESS_ID");

      if (!metaAppId) {
        return new Response(
          JSON.stringify({ error: "META_APP_ID not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ appId: metaAppId, configId: metaConfigId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange the code from Embedded Signup for a long-lived token
    if (action === "exchange-token") {
      const { code, agencyId } = body;

      if (!code || !agencyId) {
        return new Response(
          JSON.stringify({ error: "Missing code or agencyId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify agency belongs to user
      const { data: agency, error: agencyError } = await supabase
        .from("agencies")
        .select("id, user_id")
        .eq("id", agencyId)
        .eq("user_id", user.id)
        .single();

      if (agencyError || !agency) {
        return new Response(
          JSON.stringify({ error: "Agency not found or unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const metaAppId = Deno.env.get("META_APP_ID")!;

      if (!metaAppSecret) {
        return new Response(
          JSON.stringify({ error: "META_APP_SECRET not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 1: Exchange code for short-lived token
      const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${metaAppId}&client_secret=${metaAppSecret}&code=${code}`;
      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        console.error("❌ Token exchange failed:", tokenData.error);
        return new Response(
          JSON.stringify({ error: "Token exchange failed", details: tokenData.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const shortLivedToken = tokenData.access_token;

      // Step 2: Exchange for long-lived token
      const longTokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${metaAppId}&client_secret=${metaAppSecret}&fb_exchange_token=${shortLivedToken}`;
      const longTokenRes = await fetch(longTokenUrl);
      const longTokenData = await longTokenRes.json();

      const accessToken = longTokenData.access_token || shortLivedToken;

      // Step 3: Get shared WABA info using debug_token or /me/businesses
      const wabaInfo = await getSharedWABAInfo(accessToken, metaAppId);

      // Step 4: Get phone number info from WABA
      let phoneNumberId = "";
      let phoneNumber = "";

      if (wabaInfo.wabaId) {
        const phoneInfo = await getWABAPhoneNumbers(wabaInfo.wabaId, accessToken);
        phoneNumberId = phoneInfo.phoneNumberId || "";
        phoneNumber = phoneInfo.phoneNumber || "";
      }

      // Step 5: Save to agency
      const updateData: Record<string, any> = {
        meta_access_token: accessToken,
        whatsapp_status: "active",
        whatsapp_connected_at: new Date().toISOString(),
      };

      if (wabaInfo.wabaId) updateData.meta_waba_id = wabaInfo.wabaId;
      if (phoneNumberId) updateData.meta_phone_number_id = phoneNumberId;
      if (phoneNumber) updateData.whatsapp_phone_number = phoneNumber;

      const { error: updateError } = await supabase
        .from("agencies")
        .update(updateData)
        .eq("id", agencyId);

      if (updateError) {
        console.error("❌ Failed to save credentials:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to save credentials" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Also update whatsapp_integrations if exists
      await supabase
        .from("whatsapp_integrations")
        .update({
          status: "active",
          meta_access_token: accessToken,
          meta_waba_id: wabaInfo.wabaId || null,
          meta_phone_number_id: phoneNumberId || null,
          whatsapp_phone: phoneNumber || null,
          activated_at: new Date().toISOString(),
        })
        .eq("agency_id", agencyId);

      console.log("✅ Embedded Signup completed for agency:", agencyId);

      return new Response(
        JSON.stringify({
          success: true,
          phoneNumber,
          phoneNumberId,
          wabaId: wabaInfo.wabaId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Disconnect WhatsApp — Meta bilgilerini temizle
    if (action === "disconnect") {
      const { agencyId } = body;

      if (!agencyId) {
        return new Response(
          JSON.stringify({ error: "agencyId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Agency sahipliği doğrula
      const { data: agencyCheck } = await supabase
        .from("agencies")
        .select("id")
        .eq("id", agencyId)
        .eq("user_id", user.id)
        .single();

      if (!agencyCheck) {
        return new Response(
          JSON.stringify({ error: "Agency not found or unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: agencyError } = await supabase
        .from("agencies")
        .update({
          meta_access_token: null,
          meta_phone_number_id: null,
          meta_waba_id: null,
          whatsapp_phone_number: null,
          whatsapp_status: "pending",
          whatsapp_connected_at: null,
        })
        .eq("id", agencyId);

      if (agencyError) {
        console.error("[disconnect] Agency update failed:", agencyError);
        return new Response(
          JSON.stringify({ error: "Failed to disconnect" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // whatsapp_integrations tablosunu da temizle
      await supabase
        .from("whatsapp_integrations")
        .update({ status: "pending", meta_access_token: null, meta_phone_number_id: null, meta_waba_id: null, whatsapp_phone: null })
        .eq("agency_id", agencyId);

      console.info("[disconnect] WhatsApp disconnected for agency:", agencyId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Meta Embedded Signup error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Get shared WABA info from the Embedded Signup flow
 */
async function getSharedWABAInfo(
  accessToken: string,
  _appId: string
): Promise<{ wabaId: string }> {
  try {
    // Try to get WABA via /me endpoint with business scopes
    const res = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${accessToken}`
    );
    const userData = await res.json();
    console.log("📘 User data from token:", userData?.id, userData?.name);

    // Get shared WABAs
    const wabaRes = await fetch(
      `https://graph.facebook.com/v18.0/${userData.id}/owned_whatsapp_business_accounts?access_token=${accessToken}`
    );
    const wabaData = await wabaRes.json();

    if (wabaData?.data?.[0]?.id) {
      return { wabaId: wabaData.data[0].id };
    }

    // Try client_whatsapp_business_accounts as fallback
    const clientRes = await fetch(
      `https://graph.facebook.com/v18.0/${userData.id}/client_whatsapp_business_accounts?access_token=${accessToken}`
    );
    const clientData = await clientRes.json();

    if (clientData?.data?.[0]?.id) {
      return { wabaId: clientData.data[0].id };
    }

    console.warn("⚠️ Could not find WABA from token, will need manual entry");
    return { wabaId: "" };
  } catch (error) {
    console.error("❌ Error getting WABA info:", error);
    return { wabaId: "" };
  }
}

/**
 * Get phone numbers registered under a WABA
 */
async function getWABAPhoneNumbers(
  wabaId: string,
  accessToken: string
): Promise<{ phoneNumberId: string; phoneNumber: string }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${wabaId}/phone_numbers?access_token=${accessToken}`
    );
    const data = await res.json();

    if (data?.data?.[0]) {
      return {
        phoneNumberId: data.data[0].id || "",
        phoneNumber: data.data[0].display_phone_number?.replace(/[\s\-\+]/g, "") || "",
      };
    }

    return { phoneNumberId: "", phoneNumber: "" };
  } catch (error) {
    console.error("❌ Error getting phone numbers:", error);
    return { phoneNumberId: "", phoneNumber: "" };
  }
}
