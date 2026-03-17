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

    const forwardedFor = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userIp = forwardedFor.split(",")[0].trim();

    const merchantOid = `ORDER${agencyId.replace(/-/g, "").slice(0, 8)}${Date.now()}`;
    const paymentAmount = Math.round(amount * 100);
    const email = "billing@turzzai.com";
    const debugOn = "1";
    const testMode = "1";
    const noInstallment = "0";
    const maxInstallment = "0";
    const timeoutLimit = "30";
    const currency = "TL";
    const appBaseUrl = req.headers.get("origin") || "https://gezi-rehberim.lovable.app";
    const merchantOkUrl = `${appBaseUrl}/admin?payment=success`;
    const merchantFailUrl = `${appBaseUrl}/admin?payment=failed`;
    const cleanAgencyName = (agencyName || "Agency").replace(/[^\x00-\x7F]/g, "");

    const userBasket = btoa(
      JSON.stringify([[`${planType} Plan - ${isYearly ? "Yillik" : "Aylik"}`, amount.toFixed(2), 1]])
    );

    // PayTR docs: hash_str = merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode
    // paytr_token = base64(hmac_sha256(hash_str + merchant_salt, merchant_key))
    const hashStr = `${merchantId}${userIp}${merchantOid}${email}${paymentAmount}${userBasket}${noInstallment}${maxInstallment}${currency}${testMode}`;

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

    const postValues = new URLSearchParams({
      merchant_id: merchantId,
      user_ip: userIp,
      merchant_oid: merchantOid,
      email,
      payment_amount: paymentAmount.toString(),
      paytr_token: paytrToken,
      user_basket: userBasket,
      debug_on: debugOn,
      no_installment: noInstallment,
      max_installment: maxInstallment,
      user_name: cleanAgencyName,
      user_address: "Turkiye",
      user_phone: "5551234567",
      merchant_ok_url: merchantOkUrl,
      merchant_fail_url: merchantFailUrl,
      timeout_limit: timeoutLimit,
      currency,
      test_mode: testMode,
      lang: "tr",
    });

    const paytrResponse = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: postValues.toString(),
    });

    const paytrRaw = await paytrResponse.text();
    let paytrJson: { status?: string; token?: string; reason?: string } = {};

    try {
      paytrJson = JSON.parse(paytrRaw);
    } catch {
      throw new Error(`PayTR yanıtı okunamadı: ${paytrRaw.slice(0, 120)}`);
    }

    if (!paytrResponse.ok || paytrJson.status !== "success" || !paytrJson.token) {
      throw new Error(paytrJson.reason || "PayTR token alınamadı");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: dbError } = await supabase.from("payment_transactions").insert({
      agency_id: agencyId,
      order_id: merchantOid,
      amount,
      currency: "TRY",
      plan_type: planType,
      is_yearly: isYearly,
      status: "pending",
      sipay_response: { provider: "paytr", test_mode: 1, token_created: true },
    });

    if (dbError) {
      throw dbError;
    }

    const iframeUrl = `https://www.paytr.com/odeme/guvenli/${paytrJson.token}`;

    return new Response(
      JSON.stringify({
        success: true,
        iframeUrl,
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
