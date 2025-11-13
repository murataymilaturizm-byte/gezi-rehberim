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
    const paymentResult = await req.json();
    console.log("Sipay callback received:", paymentResult);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const orderId = paymentResult.order_id;
    const status = paymentResult.status; // success, failed, etc.
    const transactionId = paymentResult.transaction_id;

    // Get transaction details
    const { data: transaction, error: transactionError } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("order_id", orderId)
      .single();

    if (transactionError) {
      console.error("Transaction not found:", transactionError);
      throw new Error("Transaction not found");
    }

    // Update transaction status
    await supabase
      .from("payment_transactions")
      .update({
        status: status === "success" ? "completed" : "failed",
        transaction_id: transactionId,
        callback_response: paymentResult,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);

    if (status === "success") {
      // Get metadata
      const metadata = transaction.sipay_response?.metadata 
        ? JSON.parse(transaction.sipay_response.metadata)
        : {};
      
      const agencyId = metadata.agency_id || transaction.agency_id;
      const purchaseType = metadata.purchase_type || "plan";
      const planType = metadata.plan_type || transaction.plan_type;
      const isYearly = metadata.is_yearly || transaction.is_yearly;
      const quotaAmount = metadata.quota_amount;

      if (purchaseType === "extra_quota") {
        // Extra quota purchase - add to existing message limit
        const { data: currentAgency } = await supabase
          .from("agencies")
          .select("message_limit")
          .eq("id", agencyId)
          .single();

        const newLimit = (currentAgency?.message_limit || 0) + quotaAmount;

        const { error: updateError } = await supabase
          .from("agencies")
          .update({
            message_limit: newLimit,
          })
          .eq("id", agencyId);

        if (updateError) {
          console.error("Error updating agency quota:", updateError);
        }

        // Add to subscription history
        await supabase
          .from("subscription_history")
          .insert({
            agency_id: agencyId,
            event_type: "quota_purchase",
            plan_type: `extra_${quotaAmount}`,
            amount: transaction.amount,
            currency: "TRY",
            payment_method: "credit_card",
            transaction_id: transactionId,
            status: "success",
            notes: `${quotaAmount} mesaj ekstra kota satın alındı`,
          });

        console.log(`Extra quota purchased: ${quotaAmount} messages for agency ${agencyId}`);
      } else {
        // Plan purchase - regular subscription
        // Calculate subscription end date
        const subscriptionEndsAt = new Date();
        if (isYearly) {
          subscriptionEndsAt.setFullYear(subscriptionEndsAt.getFullYear() + 1);
        } else {
          subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1);
        }

        // Update agency subscription
        const { error: updateError } = await supabase
          .from("agencies")
          .update({
            plan_type: planType,
            subscription_status: "active",
            subscription_ends_at: subscriptionEndsAt.toISOString(),
          })
          .eq("id", agencyId);

        if (updateError) {
          console.error("Error updating agency:", updateError);
        }

        // Add to subscription history
        const { error: historyError } = await supabase
          .from("subscription_history")
          .insert({
            agency_id: agencyId,
            event_type: "payment_success",
            plan_type: planType,
            amount: transaction.amount,
            currency: "TRY",
            payment_method: "credit_card",
            transaction_id: transactionId,
            status: "success",
            notes: isYearly 
              ? "Yıllık abonelik ödemesi (%10 indirimli)" 
              : "Aylık abonelik ödemesi",
          });

        if (historyError) {
          console.error("Error adding to history:", historyError);
        }

        console.log("Payment successful, subscription activated");
      }
    } else {
      // Payment failed, add to history
      await supabase
        .from("subscription_history")
        .insert({
          agency_id: transaction.agency_id,
          event_type: "payment_failed",
          plan_type: transaction.plan_type,
          amount: transaction.amount,
          currency: "TRY",
          payment_method: "credit_card",
          transaction_id: transactionId,
          status: "failed",
          notes: `Ödeme başarısız: ${paymentResult.error_message || "Bilinmeyen hata"}`,
        });

      console.log("Payment failed");
    }

    // Redirect user to appropriate page
    const baseUrl = SUPABASE_URL ? SUPABASE_URL.replace('.supabase.co', '.lovable.app') : 'https://turzzai.lovable.app';
    const redirectUrl = status === "success"
      ? `${baseUrl}/admin?payment=success`
      : `${baseUrl}/admin?payment=failed`;

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: redirectUrl,
      },
    });
  } catch (error) {
    console.error("Callback error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Callback failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
