import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShoppingCart, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Sorun 2 (Planım) + UsageStats (Dashboard) ortak ek-kota satın alma bileşeni.
 *
 * Eskiden UsageStats.tsx içine gömülüydü; Planım sayfasında ek kota satın alma
 * yoktu. Bileşen extract edildi — hem Dashboard hem Planım'da kullanılır.
 *
 * Görünürlük koşulu: subscription_status === 'active' && messageLimit !== -1.
 * Trial'da gizli (zaten upgrade'e zorlanıyor), enterprise'da gizli (sınırsız plan).
 *
 * LS BAĞLANTISI (sonraki iş):
 *   - Buton şu an LemonSqueezy checkout URL'ine yönlendirir (purchase_type=extra_quota custom data).
 *   - LS webhook bu custom_data'yı görüp `agencies.message_limit += quota_amount` yapacak.
 *   - Şu an webhook tarafı YOK — LS onayı bekliyor.
 */

interface ExtraQuotaPurchaseProps {
  /** Acente id (parent'tan; UsageStats/SubscriptionHistory zaten yüklü taşıyor) */
  agencyId: string | null;
  /** Kullanıcı email — LS checkout prefill (varsa). */
  userEmail?: string;
  /** Mevcut mesaj limiti. -1 = sınırsız (enterprise) → bileşen render etmez. */
  messageLimit: number;
  /** Abonelik durumu. 'active' dışında bileşen render etmez. */
  subscriptionStatus: string;
  /** Dashboard içinde küçük buton, Planım'da normal — Card layout farklı. */
  compact?: boolean;
}

export function ExtraQuotaPurchase({
  agencyId,
  userEmail,
  messageLimit,
  subscriptionStatus,
  compact = false,
}: ExtraQuotaPurchaseProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedQuotaPackage, setSelectedQuotaPackage] = useState<"500" | "1000">("500");

  // Sınırsız plan (enterprise) → bileşen tamamen gizli (ek kota anlamsız).
  // agencyId yoksa render edilmez (henüz user data yüklenmemiş).
  if (messageLimit === -1 || !agencyId) {
    return null;
  }

  // Trial / expired / cancelled durumda: satın alma kapalı ama bilgilendirme göster.
  // Önceden tamamen null dönüyordu → test edenler "ek kota nerede" diye kafa karıştırıyordu.
  if (subscriptionStatus !== "active") {
    // compact mode (Dashboard) → bilgi gösterme, yer kısıtlı; sadece Planım'da göster
    if (compact) return null;
    return (
      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <span className="font-medium">
            {t("admin.usageStats.extraQuotaTitle")}
          </span>
          {" — "}
          {subscriptionStatus === "trial"
            ? t("admin.usageStats.extraQuotaTrialHint", {
                defaultValue: "Deneme süresi bitip abonelik aktifleştikten sonra ek mesaj kotası satın alabilirsiniz.",
              })
            : t("admin.usageStats.extraQuotaInactiveHint", {
                defaultValue: "Abonelik aktif olduğunda ek mesaj kotası satın alabilirsiniz.",
              })}
        </AlertDescription>
      </Alert>
    );
  }

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Extra kota için LemonSqueezy checkout (purchase_type custom data ile).
      // LS webhook bu metadata'yı görüp message_limit'i artıracak (sonraki iş).
      const storeSlug = (import.meta as any).env?.VITE_LS_STORE_SLUG ?? "turzz";
      // Variant_id starter aylık (1031857) — gerçek paket fiyatlandırması purchase_type + quota_amount custom_data ile webhook tarafında yapılır.
      const variantId = "1031857";
      const params = new URLSearchParams({
        "checkout[email]": userEmail ?? user.email ?? "",
        "checkout[custom][agency_id]": agencyId,
        "checkout[custom][purchase_type]": "extra_quota",
        "checkout[custom][quota_amount]": selectedQuotaPackage,
      });
      window.open(
        `https://${storeSlug}.lemonsqueezy.com/buy/${variantId}?${params.toString()}`,
        "_blank",
        "noopener,noreferrer",
      );
      setOpen(false);
    } catch (error: any) {
      console.error("Error purchasing quota:", error);
      toast({
        title: t("admin.toast.error"),
        description: error.message || t("admin.usageStats.paymentError"),
        variant: "destructive",
      });
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={compact ? "outline" : "default"}
          size={compact ? "sm" : "default"}
          className={cn(
            "w-full",
            compact ? "h-8 text-xs" : "",
            !compact ? "bg-gradient-ocean hover:opacity-90 text-primary-foreground" : "",
          )}
        >
          <ShoppingCart className={compact ? "w-3.5 h-3.5 mr-1.5" : "w-4 h-4 mr-2"} />
          {t("admin.usageStats.buyExtraQuota")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.usageStats.extraQuotaTitle")}</DialogTitle>
          <DialogDescription>{t("admin.usageStats.extraQuotaDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            {[{ amount: "500", price: "1.500 ₺" }, { amount: "1000", price: "2.699 ₺", popular: true, discount: true }].map((pkg) => (
              <button
                key={pkg.amount}
                onClick={() => setSelectedQuotaPackage(pkg.amount as "500" | "1000")}
                className={cn(
                  "w-full p-4 border-2 rounded-lg transition-all text-start",
                  selectedQuotaPackage === pkg.amount
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-lg">{t(`admin.usageStats.quota${pkg.amount}Messages`)}</div>
                    <div className="text-sm text-muted-foreground">{t("admin.usageStats.extraQuotaLabel")}</div>
                    {pkg.popular && (
                      <Badge variant="secondary" className="mt-1">
                        {t("admin.usageStats.popular")}
                      </Badge>
                    )}
                  </div>
                  <div className="text-end shrink-0">
                    <div className="font-bold text-xl">{pkg.price}</div>
                    <div className="text-xs text-muted-foreground">{t("admin.usageStats.oneTime")}</div>
                    {pkg.discount && (
                      <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                        {t("admin.usageStats.discount10")}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="bg-muted/50 p-3 rounded-lg text-sm">
            <p className="text-muted-foreground">{t("admin.usageStats.quotaInfo")}</p>
          </div>
          <Button onClick={handlePurchase} disabled={purchasing} className="w-full">
            {purchasing ? t("admin.usageStats.redirecting") : t("admin.usageStats.goToPayment")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
