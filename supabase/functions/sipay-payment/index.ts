import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { planType, isYearly, agencyId, purchaseType, quotaAmount } = await req.json();

    const SIPAY_MERCHANT_ID = Deno.env.get("SIPAY_MERCHANT_ID");
    const SIPAY_APP_SECRET = Deno.env.get("SIPAY_APP_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SIPAY_MERCHANT_ID || !SIPAY_APP_SECRET) {
      throw new Error("Sipay credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get agency details
    const { data: agency, error: agencyError } = await supabase
      .from("agencies")
      .select("agency_name")
      .eq("id", agencyId)
      .single();

    if (agencyError) throw agencyError;

    let amount = 0;
    let description = "";
    
    // Calculate amount based on purchase type
    if (purchaseType === "extra_quota") {
      // Extra quota purchase
      const quotaPrices: Record<number, number> = {
        500: 1500,
        1000: 2699,
      };
      amount = quotaPrices[quotaAmount] || 1500;
      description = `${quotaAmount} mesaj ekstra kota`;
    } else {
      // Plan purchase
      const planPrices: Record<string, number> = {
        starter: 3999,
        professional: 7999,
        enterprise: 9999,
      };

      amount = planPrices[planType] || 3999;
      if (isYearly) {
        amount = amount * 12 * 0.9; // %10 discount for yearly
      }
      description = `${planType} plan ${isYearly ? "(yıllık)" : "(aylık)"}`;
    }

    // Generate unique order ID
    const orderId = `ORDER-${agencyId.substring(0, 8)}-${Date.now()}`;
    
    // Prepare Sipay payment request
    const paymentData: any = {
      merchant_id: SIPAY_MERCHANT_ID,
      order_id: orderId,
      amount: amount.toFixed(2),
      currency: "TRY",
      installment: "1",
      customer_name: agency.agency_name,
      customer_email: "billing@turzzai.com", // This should come from user data
      success_url: `${SUPABASE_URL}/functions/v1/sipay-callback`,
      failure_url: `${SUPABASE_URL}/functions/v1/sipay-callback`,
      language: "tr",
      merchant_key: SIPAY_APP_SECRET,
      // Additional metadata
      metadata: JSON.stringify({
        agency_id: agencyId,
        purchase_type: purchaseType || "plan",
        plan_type: planType,
        is_yearly: isYearly,
        quota_amount: quotaAmount,
        amount: amount,
      }),
    };

    // Generate hash for security
    const hashString = `${paymentData.merchant_id}${paymentData.order_id}${paymentData.amount}${paymentData.currency}${SIPAY_APP_SECRET}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(hashString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    paymentData.hash = hash;

    // Call Sipay API (Sandbox for testing)
    // Note: Change to production URL when going live: https://api.sipay.com.tr/api/payment
    const sipayUrl = "https://sandbox-api.sipay.com.tr/api/payment";
    console.log(`🚀 Calling Sipay API: ${sipayUrl}`);
    
    const sipayResponse = await fetch(sipayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentData),
    });

    const sipayResult = await sipayResponse.json();
    console.log("📨 Sipay API response:", JSON.stringify(sipayResult, null, 2));

    if (!sipayResponse.ok) {
      console.error("❌ Sipay API error response:", sipayResult);
      throw new Error(sipayResult.message || "Sipay API request failed");
    }

    console.log("Sipay payment initiated:", sipayResult);

    // Store payment transaction
    const { error: transactionError } = await supabase
      .from("payment_transactions")
      .insert({
        agency_id: agencyId,
        order_id: orderId,
        plan_type: planType || `extra_quota_${quotaAmount}`,
        amount: amount,
        currency: "TRY",
        is_yearly: isYearly || false,
        status: "pending",
        sipay_response: sipayResult,
      });

    if (transactionError) {
      console.error("Error storing transaction:", transactionError);
    }

    console.log(`✅ Payment URL generated successfully for order: ${orderId}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        payment_url: sipayResult.payment_url || sipayResult.redirect_url,
        order_id: orderId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Sipay payment error:", error);
    
    // Return more detailed error information
    const errorMessage = error instanceof Error ? error.message : "Payment initialization failed";
    const errorDetails = {
      error: errorMessage,
      timestamp: new Date().toISOString(),
      details: error instanceof Error ? error.stack : null
    };
    
    return new Response(
      JSON.stringify(errorDetails),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
