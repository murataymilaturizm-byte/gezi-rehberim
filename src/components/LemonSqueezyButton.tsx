import { Button } from "@/components/ui/button";
import { ExternalLink, Mail } from "lucide-react";

// Variant ID'leri (Lemon Squeezy Dashboard'dan alınan sabit değerler)
const VARIANT_IDS: Record<string, { monthly: string; yearly: string }> = {
  starter:      { monthly: "1031857", yearly: "1031887" },
  professional: { monthly: "1031861", yearly: "1031891" },
};

const STORE_SLUG = (import.meta as any).env?.VITE_LS_STORE_SLUG ?? "turzz";
const ENTERPRISE_EMAIL = "info@turzzai.com";

interface Props {
  planId: "starter" | "professional" | "enterprise";
  isYearly: boolean;
  agencyId?: string;
  userEmail?: string;
  label?: string;
  className?: string;
  variant?: "default" | "outline" | "secondary";
}

export const LemonSqueezyButton = ({
  planId,
  isYearly,
  agencyId,
  userEmail,
  label,
  className,
  variant = "default",
}: Props) => {
  // Enterprise → iletişim maili
  if (planId === "enterprise") {
    const subject = encodeURIComponent("Kurumsal Plan Talebi");
    const body = encodeURIComponent(
      `Merhaba,\n\nKurumsal plan hakkında bilgi almak istiyorum.\n\nAcente ID: ${agencyId ?? "-"}`,
    );
    return (
      <Button variant={variant} className={className} asChild>
        <a href={`mailto:${ENTERPRISE_EMAIL}?subject=${subject}&body=${body}`}>
          <Mail className="w-4 h-4 mr-2" />
          {label ?? "İletişime Geçin"}
        </a>
      </Button>
    );
  }

  const variantSet = VARIANT_IDS[planId];
  if (!variantSet) return null;

  const variantId = isYearly ? variantSet.yearly : variantSet.monthly;

  const params = new URLSearchParams();
  if (userEmail) params.set("checkout[email]", userEmail);
  if (agencyId)  params.set("checkout[custom][agency_id]", agencyId);

  const checkoutUrl = `https://${STORE_SLUG}.lemonsqueezy.com/buy/${variantId}${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <Button variant={variant} className={className} asChild>
      <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="w-4 h-4 mr-2" />
        {label ?? "Abone Ol"}
      </a>
    </Button>
  );
};
