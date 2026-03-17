import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PaymentStatusIndicator } from "./PaymentStatusIndicator";
import type { PaymentStatus } from "./PaymentStatusIndicator";

interface PayTRPaymentFormProps {
  agencyId: string;
  planType: string;
  isYearly: boolean;
  amount: number;
  agencyName: string;
}

export const PayTRPaymentForm = ({ 
  agencyId, 
  planType, 
  isYearly, 
  amount,
  agencyName 
}: PayTRPaymentFormProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);

  const handlePayment = async () => {
    setIsProcessing(true);
    setPaymentStatus("pending");

    try {
      console.log("💳 Initializing PayTR payment via backend...");

      // Call backend to initialize payment
      const { data, error } = await supabase.functions.invoke('paytr-payment-init', {
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

      console.log("✅ PayTR payment data received from backend");

      // Create iframe for PayTR token URL
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '600px';
      iframe.style.border = 'none';
      iframe.id = 'paytr-iframe';
      iframe.src = data.iframeUrl;

      // Create a modal container
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      `;

      const container = document.createElement('div');
      container.style.cssText = `
        background: white;
        border-radius: 8px;
        width: 90%;
        max-width: 800px;
        height: 90vh;
        max-height: 700px;
        position: relative;
        padding: 20px;
      `;

      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: #ff4444;
        color: white;
        border: none;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        cursor: pointer;
        font-size: 18px;
      `;
      closeBtn.onclick = () => {
        document.body.removeChild(modal);
        setPaymentStatus(null);
        setIsProcessing(false);
      };

      container.appendChild(closeBtn);
      container.appendChild(iframe);
      modal.appendChild(container);
      document.body.appendChild(modal);

      setPaymentStatus("processing");
      toast.success("PayTR ödeme sayfasına yönlendiriliyorsunuz...");

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
