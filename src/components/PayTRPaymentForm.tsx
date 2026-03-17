import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CreditCard, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  agencyName,
}: PayTRPaymentFormProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardOwner, setCardOwner] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cvv, setCvv] = useState("");

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const rawCardNumber = cardNumber.replace(/\s/g, "");
    if (!cardOwner || rawCardNumber.length < 15 || !expiryMonth || !expiryYear || cvv.length < 3) {
      toast.error("Lütfen tüm kart bilgilerini eksiksiz doldurun");
      return;
    }

    setIsProcessing(true);

    try {
      // Get form fields from backend (token + hidden fields)
      const { data, error } = await supabase.functions.invoke("paytr-payment-init", {
        body: { agencyId, planType, isYearly, amount, agencyName },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Payment initialization failed");

      // Create a hidden form and POST directly to PayTR
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.postUrl; // https://www.paytr.com/odeme

      // Add all hidden fields from backend
      const formFields = data.formFields;
      for (const [key, value] of Object.entries(formFields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value as string;
        form.appendChild(input);
      }

      // Add card fields (these go directly to PayTR, never to our server)
      const cardFields: Record<string, string> = {
        cc_owner: cardOwner,
        card_number: rawCardNumber,
        expiry_month: expiryMonth,
        expiry_year: expiryYear,
        cvv: cvv,
      };

      for (const [key, value] of Object.entries(cardFields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Ödeme başlatılamadı");
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Lock className="h-4 w-4" />
        <span>Güvenli ödeme - Bilgileriniz şifrelenerek PayTR'ye iletilir</span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cc_owner">Kart Sahibi Adı</Label>
        <Input
          id="cc_owner"
          placeholder="Ad Soyad"
          value={cardOwner}
          onChange={(e) => setCardOwner(e.target.value.toUpperCase())}
          required
          disabled={isProcessing}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="card_number">Kart Numarası</Label>
        <div className="relative">
          <Input
            id="card_number"
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            maxLength={19}
            required
            disabled={isProcessing}
          />
          <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="expiry_month">Ay</Label>
          <select
            id="expiry_month"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={expiryMonth}
            onChange={(e) => setExpiryMonth(e.target.value)}
            required
            disabled={isProcessing}
          >
            <option value="">Ay</option>
            {Array.from({ length: 12 }, (_, i) => {
              const m = (i + 1).toString();
              return (
                <option key={m} value={m}>
                  {m.padStart(2, "0")}
                </option>
              );
            })}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="expiry_year">Yıl</Label>
          <select
            id="expiry_year"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={expiryYear}
            onChange={(e) => setExpiryYear(e.target.value)}
            required
            disabled={isProcessing}
          >
            <option value="">Yıl</option>
            {Array.from({ length: 12 }, (_, i) => {
              const y = (26 + i).toString();
              return (
                <option key={y} value={y}>
                  20{y}
                </option>
              );
            })}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cvv">CVV</Label>
          <Input
            id="cvv"
            placeholder="000"
            value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
            maxLength={4}
            required
            disabled={isProcessing}
            type="password"
          />
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-3 text-sm">
        <div className="flex justify-between">
          <span>Plan:</span>
          <span className="font-medium">{planType} ({isYearly ? "Yıllık" : "Aylık"})</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Tutar:</span>
          <span className="font-bold text-primary">{amount.toLocaleString("tr-TR")} ₺</span>
        </div>
      </div>

      <Button type="submit" disabled={isProcessing} className="w-full" size="lg">
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Ödeme İşleniyor...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            {amount.toLocaleString("tr-TR")} ₺ Öde
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        🔒 Ödemeniz PayTR güvenlik altyapısı ile korunmaktadır
      </p>
    </form>
  );
};
