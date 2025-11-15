import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PaymentStatusIndicator } from "./PaymentStatusIndicator";
import type { PaymentStatus } from "./PaymentStatusIndicator";

interface SipayPaymentFormProps {
  agencyId: string;
  planType: string;
  isYearly: boolean;
  amount: number;
  agencyName: string;
}

export const SipayPaymentForm = ({ 
  agencyId, 
  planType, 
  isYearly, 
  amount,
  agencyName 
}: SipayPaymentFormProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);

  const handlePayment = async () => {
    setIsProcessing(true);
    setPaymentStatus("pending");

    try {
      // Generate order ID
      const orderId = `ORDER-${agencyId.substring(0, 8)}-${Date.now()}`;
      
      // Get Sipay credentials from environment (these will be public but secured with hash)
      const merchantId = import.meta.env.VITE_SIPAY_MERCHANT_ID;
      const appSecret = import.meta.env.VITE_SIPAY_APP_SECRET;

      console.log("🔍 Environment check:", {
        merchantId: merchantId ? "✅ Found" : "❌ Missing",
        appSecret: appSecret ? "✅ Found" : "❌ Missing",
        allEnvVars: import.meta.env
      });

      if (!merchantId || !appSecret) {
        console.error("❌ Sipay credentials missing:", { merchantId, appSecret });
        throw new Error("Sipay credentials not configured. Please check environment variables.");
      }

      // Prepare callback URLs
      const callbackUrl = `${window.location.origin}/admin?payment_callback=true`;
      
      // Generate hash (SHA-256)
      const hashString = `${merchantId}${orderId}${amount.toFixed(2)}TRY${appSecret}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(hashString);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Save transaction to database
      const { error: dbError } = await supabase
        .from("payment_transactions")
        .insert({
          agency_id: agencyId,
          order_id: orderId,
          amount: amount,
          currency: "TRY",
          plan_type: planType,
          is_yearly: isYearly,
          status: "pending",
          sipay_response: {
            merchant_id: merchantId,
            order_id: orderId,
            metadata: JSON.stringify({
              agency_id: agencyId,
              purchase_type: "plan",
              plan_type: planType,
              is_yearly: isYearly,
              amount: amount,
            })
          }
        });

      if (dbError) throw dbError;

      // Create form and submit to Sipay
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://api.sipay.com.tr/api/payment';
      
      const fields = {
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

      Object.entries(fields).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      
      setPaymentStatus("processing");
      toast.success("Sipay ödeme sayfasına yönlendiriliyorsunuz...");
      
      // Submit form after a short delay
      setTimeout(() => {
        form.submit();
      }, 1000);

    } catch (error: any) {
      console.error("Payment initialization error:", error);
      setPaymentStatus("failed");
      toast.error(error.message || "Ödeme başlatılamadı");
      setTimeout(() => {
        setPaymentStatus(null);
        setIsProcessing(false);
      }, 3000);
    }
  };

  return (
    <>
      <Button
        onClick={handlePayment}
        disabled={isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Ödeme Hazırlanıyor...
          </>
        ) : (
          "Ödemeye Geç"
        )}
      </Button>

      <PaymentStatusIndicator
        status={paymentStatus}
        isOpen={paymentStatus !== null}
        onClose={() => setPaymentStatus(null)}
      />
    </>
  );
};
