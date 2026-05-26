import { Button } from "@/components/ui/button";
import { ExternalLink, Mail, MessageCircle } from "lucide-react";

// ════════════════════════════════════════════════════════════════════════
// POS-DISABLED: LemonSqueezy ödeme akışı GEÇİCİ olarak devre dışı.
// POS onayı gelmediği için tüm ödeme CTA'ları landing iletişim formuna
// yönlendiriliyor. POS aktif olunca POS_ENABLED = true yap → eski akış
// kendiliğinden geri gelir. Kod tamamen korunuyor (silinmiyor).
// ════════════════════════════════════════════════════════════════════════
const POS_ENABLED = false;
const CONTACT_HREF = "/#contact"; // landing FAQ section anchor

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
  // Enterprise → iletişim formu (POS-yok döneminde mailto yerine landing form)
  if (planId === "enterprise") {
    // POS gelse de Enterprise her zaman iletişim — self-service değil.
    return (
      <Button variant={variant} className={className} asChild>
        <a href={CONTACT_HREF}>
          <MessageCircle className="w-4 h-4 mr-2" />
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

  // POS-DISABLED: checkoutUrl üretiliyor ama kullanılmıyor.
  // POS_ENABLED=true yapılınca aşağıdaki ternary eski checkout linki dönecek.
  const checkoutUrl = `https://${STORE_SLUG}.lemonsqueezy.com/buy/${variantId}${params.toString() ? `?${params.toString()}` : ""}`;

  if (!POS_ENABLED) {
    // POS-yok dönemi: starter/professional için de iletişim formu.
    // Ayrıca silinmeyen ENTERPRISE_EMAIL/Mail import bağımlılıkları kalır
    // (POS gelince geri açılacak — referans olmadan import lint kapacak).
    void Mail; void ENTERPRISE_EMAIL;
    return (
      <Button variant={variant} className={className} asChild>
        <a href={CONTACT_HREF}>
          <MessageCircle className="w-4 h-4 mr-2" />
          {label ?? "İletişime Geçin"}
        </a>
      </Button>
    );
  }

  return (
    <Button variant={variant} className={className} asChild>
      <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="w-4 h-4 mr-2" />
        {label ?? "Abone Ol"}
      </a>
    </Button>
  );
};
