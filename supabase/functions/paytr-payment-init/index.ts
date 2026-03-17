import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agencyId, planType, isYearly, amount, agencyName } = await req.json();

    if (!agencyId || !planType || typeof amount !== "number" || amount <= 0) {
      throw new Error("Invalid payment payload");
    }

    const merchantId = Deno.env.get("PAYTR_MERCHANT_ID");
    const merchantKey = Deno.env.get("PAYTR_MERCHANT_KEY");
    const merchantSalt = Deno.env.get("PAYTR_MERCHANT_SALT");

    if (!merchantId || !merchantKey || !merchantSalt) {
      throw new Error("PayTR credentials not configured");
    }

    // Get user IP
    const forwardedFor = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userIp = forwardedFor.split(",")[0].trim();

    // Generate order ID
    const merchantOid = `ORDER${agencyId.replace(/-/g, "").slice(0, 8)}${Date.now()}`;
    
    // Payment details - Direct API uses decimal format like "999.00"
    const paymentAmount = amount.toFixed(2);
    const email = "billing@turzzai.com";
    const testMode = "1";
    const non3d = "0"; // Use 3D Secure
    const currency = "TL";
    const paymentType = "card";
    const installmentCount = "0"; // No installment

    const appBaseUrl = req.headers.get("origin") || "https://gezi-rehberim.lovable.app";
    const merchantOkUrl = `${appBaseUrl}/admin?payment=success`;
    const merchantFailUrl = `${appBaseUrl}/admin?payment=failed`;

    // Sanitize for safe encoding
    const cleanAgencyName = (agencyName || "Agency").replace(/[^\x00-\x7F]/g, "A");
    const planLabel = `${planType} Plan ${isYearly ? "Yillik" : "Aylik"}`;

    const userBasket = JSON.stringify([[planLabel, paymentAmount, 1]]);

    // Direct API hash: merchant_id + user_ip + merchant_oid + email + payment_amount + payment_type + installment_count + currency + test_mode + non_3d
    const hashStr = `${merchantId}${userIp}${merchantOid}${email}${paymentAmount}${paymentType}${installmentCount}${currency}${testMode}${non3d}`;

    const encoder = new TextEncoder();
    const keyData = encoder.encode(merchantKey);
    const msgData = encoder.encode(hashStr + merchantSalt);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    const paytrToken = btoa(String.fromCharCode(...Array.from(new Uint8Array(signature))));

    // Save transaction to DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("payment_transactions").insert({
      agency_id: agencyId,
      order_id: merchantOid,
      amount,
      currency: "TRY",
      plan_type: planType,
      is_yearly: isYearly,
      status: "pending",
      sipay_response: { provider: "paytr_direct", test_mode: 1 },
    });

    // Return all form fields needed for Direct API POST to https://www.paytr.com/odeme
    const formFields = {
      merchant_id: merchantId,
      user_ip: userIp,
      merchant_oid: merchantOid,
      email,
      payment_type: paymentType,
      payment_amount: paymentAmount,
      currency,
      test_mode: testMode,
      non_3d: non3d,
      merchant_ok_url: merchantOkUrl,
      merchant_fail_url: merchantFailUrl,
      user_name: cleanAgencyName,
      user_address: "Turkiye",
      user_phone: "5551234567",
      user_basket: userBasket,
      debug_on: "1",
      client_lang: "tr",
      paytr_token: paytrToken,
      non3d_test_failed: "0",
      installment_count: installmentCount,
    };

    return new Response(
      JSON.stringify({
        success: true,
        formFields,
        postUrl: "https://www.paytr.com/odeme",
        orderId: merchantOid,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ PayTR init error:", errorMessage);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
