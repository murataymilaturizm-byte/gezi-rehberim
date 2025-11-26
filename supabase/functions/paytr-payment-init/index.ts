import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agencyId, planType, isYearly, amount, agencyName } = await req.json();

    console.log("💳 PayTR payment initialization request:", { agencyId, planType, isYearly, amount });

    // Get PayTR credentials from environment
    const merchantId = Deno.env.get('PAYTR_MERCHANT_ID');
    const merchantKey = Deno.env.get('PAYTR_MERCHANT_KEY');
    const merchantSalt = Deno.env.get('PAYTR_MERCHANT_SALT');

    if (!merchantId || !merchantKey || !merchantSalt) {
      console.error("❌ PayTR credentials not found in environment");
      throw new Error('PayTR credentials not configured');
    }

    console.log("✅ PayTR credentials loaded");

    // Generate order ID
    const merchantOid = `ORDER-${agencyId.substring(0, 8)}-${Date.now()}`;

    // Callback URLs
    const baseUrl = `https://ncuswacwpqcxhmlhvfgq.supabase.co/functions/v1`;
    const merchantOkUrl = `${baseUrl}/paytr-callback`;
    const merchantFailUrl = `${baseUrl}/paytr-callback`;
    
    console.log("📍 Callback URLs:", { merchantOkUrl, merchantFailUrl });

    // Get client IP (required by PayTR)
    const userIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

    // User basket (required by PayTR)
    const userBasket = btoa(JSON.stringify([
      [`${planType} Plan - ${isYearly ? 'Yıllık' : 'Aylık'}`, amount.toFixed(2), 1]
    ]));

    // Payment amount in kuruş (cents)
    const paymentAmount = Math.round(amount * 100);

    // Generate PayTR token (hash)
    const hashStr = `${userBasket}${merchantOid}${paymentAmount}${merchantOkUrl}${merchantFailUrl}${merchantSalt}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(merchantKey);
    const msgData = encoder.encode(hashStr);
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    const hashArray = Array.from(new Uint8Array(signature));
    const paytrToken = btoa(String.fromCharCode(...hashArray));

    console.log("🔐 PayTR token generated for order:", merchantOid);

    // Supabase client for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Save transaction to database
    const { error: dbError } = await supabase
      .from("payment_transactions")
      .insert({
        agency_id: agencyId,
        order_id: merchantOid,
        amount: amount,
        currency: "TRY",
        plan_type: planType,
        is_yearly: isYearly,
        status: "pending",
        sipay_response: { provider: "paytr", test_mode: 1 }
      });

    if (dbError) {
      console.error("❌ Database error:", dbError);
      throw dbError;
    }

    // Prepare payment data for frontend
    const paymentData = {
      merchant_id: merchantId,
      user_ip: userIp,
      merchant_oid: merchantOid,
      email: 'billing@turzzai.com',
      payment_amount: paymentAmount.toString(),
      user_basket: userBasket,
      no_installment: '0',
      max_installment: '0',
      user_name: agencyName,
      user_address: 'Türkiye',
      user_phone: '5551234567',
      merchant_ok_url: merchantOkUrl,
      merchant_fail_url: merchantFailUrl,
      timeout_limit: '30',
      debug_on: '1',
      test_mode: '1', // Test mode enabled
      lang: 'tr',
      paytr_token: paytrToken,
    };

    // PayTR iframe endpoint
    const paytrUrl = 'https://www.paytr.com/odeme/guvenli/' + merchantId;
    
    console.log("🔗 PayTR URL:", paytrUrl);
    console.log("⚠️ TEST MODE: Test kartları kullanılabilir!");
    
    return new Response(
      JSON.stringify({
        success: true,
        paymentData,
        paytrUrl,
        iframeToken: paytrToken
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error("❌ Payment initialization error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
