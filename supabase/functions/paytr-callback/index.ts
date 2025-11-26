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
    console.log("📥 PayTR callback received");

    // Get PayTR credentials
    const merchantKey = Deno.env.get('PAYTR_MERCHANT_KEY');
    const merchantSalt = Deno.env.get('PAYTR_MERCHANT_SALT');

    if (!merchantKey || !merchantSalt) {
      throw new Error('PayTR credentials not configured');
    }

    // Parse callback data
    const formData = await req.formData();
    const merchant_oid = formData.get('merchant_oid') as string;
    const status = formData.get('status') as string;
    const total_amount = formData.get('total_amount') as string;
    const hash = formData.get('hash') as string;

    console.log("📦 Callback data:", { merchant_oid, status, total_amount });

    if (!merchant_oid) {
      throw new Error('Missing order_id in callback');
    }

    // Verify hash
    const hashStr = `${merchant_oid}${merchantSalt}${status}${total_amount}`;
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
    const calculatedHash = btoa(String.fromCharCode(...hashArray));

    if (hash !== calculatedHash) {
      console.error("❌ Hash verification failed");
      return new Response('OK', { status: 200 }); // PayTR requires 'OK' response
    }

    console.log("✅ Hash verified");

    // Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get transaction
    const { data: transaction, error: txError } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("order_id", merchant_oid)
      .maybeSingle();

    if (txError || !transaction) {
      console.error("❌ Transaction not found:", txError);
      return new Response('OK', { status: 200 });
    }

    // Payment successful (status === 'success')
    if (status === 'success') {
      console.log("✅ Payment successful");

      // Update transaction status
      await supabase
        .from("payment_transactions")
        .update({
          status: 'completed',
          callback_response: { status, total_amount, hash },
          transaction_id: merchant_oid,
        })
        .eq("order_id", merchant_oid);

      // Calculate subscription dates
      const now = new Date();
      const subscriptionEndsAt = new Date(now);
      if (transaction.is_yearly) {
        subscriptionEndsAt.setFullYear(subscriptionEndsAt.getFullYear() + 1);
      } else {
        subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1);
      }

      // Update agency subscription
      await supabase
        .from("agencies")
        .update({
          subscription_status: 'active',
          plan_type: transaction.plan_type,
          subscription_ends_at: subscriptionEndsAt.toISOString(),
          trial_ends_at: null,
        })
        .eq("id", transaction.agency_id);

      // Insert subscription history
      await supabase
        .from("subscription_history")
        .insert({
          agency_id: transaction.agency_id,
          event_type: 'subscription_activated',
          status: 'completed',
          plan_type: transaction.plan_type,
          amount: transaction.amount,
          currency: transaction.currency,
          payment_method: 'paytr',
          transaction_id: merchant_oid,
        });

      console.log("✅ Subscription activated successfully");

      // Redirect to success page
      const redirectUrl = `https://turzzai.lovable.app/admin?payment=success&order_id=${merchant_oid}`;
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': redirectUrl,
        },
      });

    } else {
      console.log("❌ Payment failed");

      // Update transaction status
      await supabase
        .from("payment_transactions")
        .update({
          status: 'failed',
          callback_response: { status, total_amount, hash },
        })
        .eq("order_id", merchant_oid);

      // Insert failure history
      await supabase
        .from("subscription_history")
        .insert({
          agency_id: transaction.agency_id,
          event_type: 'payment_failed',
          status: 'failed',
          plan_type: transaction.plan_type,
          amount: transaction.amount,
          currency: transaction.currency,
          payment_method: 'paytr',
          transaction_id: merchant_oid,
        });

      // Redirect to failure page
      const redirectUrl = `https://turzzai.lovable.app/admin?payment=failed&order_id=${merchant_oid}`;
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': redirectUrl,
        },
      });
    }

  } catch (error) {
    console.error("❌ Callback error:", error);
    return new Response('OK', { status: 200 }); // PayTR requires 'OK' response
  }
});
