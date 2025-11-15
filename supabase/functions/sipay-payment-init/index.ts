import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    console.log("💳 Payment initialization request:", { agencyId, planType, isYearly, amount });

    // Get Sipay credentials from environment
    const merchantId = Deno.env.get('VITE_SIPAY_MERCHANT_ID');
    const appSecret = Deno.env.get('VITE_SIPAY_APP_SECRET');

    if (!merchantId || !appSecret) {
      console.error("❌ Sipay credentials not found in environment");
      throw new Error('Sipay credentials not configured');
    }

    console.log("✅ Sipay credentials loaded");

    // Generate order ID
    const orderId = `ORDER-${agencyId.substring(0, 8)}-${Date.now()}`;

    // Prepare callback URL (use SUPABASE_URL instead of VITE_SUPABASE_URL in edge functions)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const callbackUrl = `${supabaseUrl}/functions/v1/sipay-callback`;
    
    console.log("📍 Callback URL:", callbackUrl);

    // Generate hash (SHA-256)
    const hashString = `${merchantId}${orderId}${amount.toFixed(2)}TRY${appSecret}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(hashString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log("🔐 Hash generated for order:", orderId);

    // Prepare payment data
    const paymentData = {
      merchant_id: merchantId,
      order_id: orderId,
      amount: amount.toFixed(2),
      currency: 'TRY',
      installment: '1',
      customer_name: agencyName,
      customer_email: 'billing@turzzai.com',
      success_url: callbackUrl,
      failure_url: callbackUrl,
      language: 'tr',
      hash: hash,
      merchant_key: appSecret,
      metadata: JSON.stringify({
        agency_id: agencyId,
        purchase_type: "plan",
        plan_type: planType,
        is_yearly: isYearly,
        amount: amount,
      })
    };

    // Return payment data for frontend to submit
    // Use TEST URL for testing with test cards
    const sipayUrl = 'https://test.sipay.com.tr/api/payment';
    
    console.log("🔗 Sipay URL:", sipayUrl);
    
    return new Response(
      JSON.stringify({
        success: true,
        paymentData,
        sipayUrl
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
