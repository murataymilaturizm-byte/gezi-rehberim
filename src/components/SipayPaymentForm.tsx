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
      console.log("💳 Initializing payment via backend...");

      // Call backend to initialize payment
      const { data, error } = await supabase.functions.invoke('sipay-payment-init', {
        body: {
          agencyId,
          planType,
          isYearly,
          amount,
          agencyName
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Payment initialization failed");

      console.log("✅ Payment data received from backend");

      // Save transaction to database
      const { error: dbError } = await supabase
        .from("payment_transactions")
        .insert({
          agency_id: agencyId,
          order_id: data.paymentData.order_id,
          amount: amount,
          currency: "TRY",
          plan_type: planType,
          is_yearly: isYearly,
          status: "pending",
          sipay_response: data.paymentData
        });

      if (dbError) throw dbError;

      // Create form and submit to Sipay
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.sipayUrl;
      
      Object.entries(data.paymentData).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = String(value);
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
