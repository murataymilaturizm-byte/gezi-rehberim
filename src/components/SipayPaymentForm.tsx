// Ödeme sistemi Lemon Squeezy'e geçirildi.
// Bu dosya backward-compat için korunuyor — LemonSqueezyButton'a proxy ediyor.
// PayTR/Sipay kodu: src/components/PayTRPaymentForm.tsx (geri dönüş için saklandı)

import { LemonSqueezyButton } from "./LemonSqueezyButton";

interface SipayPaymentFormProps {
  agencyId: string;
  planType: string;
  isYearly: boolean;
  amount: number;
  agencyName: string;
  userEmail?: string;
}

export const SipayPaymentForm = ({
  agencyId,
  planType,
  isYearly,
  userEmail,
}: SipayPaymentFormProps) => {
  const validPlan = (["starter", "professional", "enterprise"] as const).find(
    (p) => p === planType,
  ) ?? "starter";

  return (
    <LemonSqueezyButton
      planId={validPlan}
      isYearly={isYearly}
      agencyId={agencyId}
      userEmail={userEmail}
      label="Abone Ol"
      className="w-full"
    />
  );
};
