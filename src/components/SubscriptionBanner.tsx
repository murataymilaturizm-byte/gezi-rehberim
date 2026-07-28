import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, Clock, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { daysLeftUtc, packageEndDate } from "@/lib/subscription-days";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";

const DATE_LOCALE_MAP = { tr, en: enUS, de, ru, ar, fr, es };

interface SubscriptionInfo {
  plan_type: string;
  trial_ends_at: string | null;
  subscription_status: string;
  subscription_ends_at: string | null;
}

interface SubscriptionBannerProps {
  onNavigateToPlan?: () => void;
}

export const SubscriptionBanner = ({ onNavigateToPlan }: SubscriptionBannerProps) => {
  const { t, i18n } = useTranslation();
  const dateLocale = DATE_LOCALE_MAP[i18n.language as keyof typeof DATE_LOCALE_MAP] || tr;
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  // P4-1a: kritik-bant oturum-bazlı kapatma (her yeni girişte yeniden görünür)
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("pkgExpiryDismissed") === "1");
  // P5-2e: bekleyen havale-bildirimi (varsa bant nötr moda geçer)
  const [hasPendingPayment, setHasPendingPayment] = useState(false);

  useEffect(() => {
    loadSubscriptionInfo();
  }, []);

  const loadSubscriptionInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agencyData, error } = await supabase
        .from("agencies")
        .select("id, name, plan_type, trial_ends_at, subscription_status, subscription_ends_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (agencyData) {
        const { count: _pendingCount } = await (supabase as any)
          .from("payment_requests")
          .select("id", { count: "exact", head: true })
          .eq("agency_id", agencyData.id)
          .eq("status", "pending");
        setHasPendingPayment((_pendingCount ?? 0) > 0);
        setSubscriptionInfo({
          plan_type: agencyData.plan_type,
          trial_ends_at: agencyData.trial_ends_at,
          subscription_status: agencyData.subscription_status,
          subscription_ends_at: agencyData.subscription_ends_at,
        });
      }
    } catch (error) {
      console.error("Error loading subscription info:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !subscriptionInfo) return null;

  // P4-1 (2026-07-28): tek-kaynak UTC-gün-granül hesap (subscription-days.ts).
  // Eski differenceInDays saat/timezone-hassastı; "bugün son gün" artık 0.
  const remainingDays = daysLeftUtc(packageEndDate(subscriptionInfo));

  const handleNavigateToPlan = () => {
    if (onNavigateToPlan) {
      onNavigateToPlan();
    }
  };

  // Eğer trial veya aktif değilse ve süresi dolduysa/iptal edildiyse kritik uyarı göster
  if (
    subscriptionInfo.subscription_status === 'expired' ||
    subscriptionInfo.subscription_status === 'cancelled' ||
    (remainingDays !== null && remainingDays <= 0)
  ) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t("admin.subscription.expired")}</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            {t("admin.subscription.expiredMessage")}
          </span>
          <Button size="sm" className="ml-4" onClick={handleNavigateToPlan}>
            <CreditCard className="w-4 h-4 mr-2" />
            {t("admin.subscription.makePayment")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // P5-2e (2026-07-28): bekleyen ödeme-bildirimi varsa NÖTR mod — müşteri "ödedim"
  // dedikten sonra kırmızı bağırma devam etmesin (kritik/expired dallarından ÖNCE).
  if (hasPendingPayment) {
    return (
      <Alert className="mb-6 border-primary/40 bg-primary/5">
        <Clock className="h-4 w-4 text-primary" />
        <AlertTitle>{t("admin.subscription.paymentPendingTitle")}</AlertTitle>
        <AlertDescription>{t("admin.subscription.paymentPendingMsg")}</AlertDescription>
      </Alert>
    );
  }

  // P5-1a (2026-07-28): SÜRE DOLDU (tarih geçmiş, status hâlâ active olabilir) —
  // KESME YOK (ürün-kararı: yalnız-uyarı), bant KAPATILAMAZ bu modda.
  if (remainingDays !== null && remainingDays < 0) {
    return (
      <Alert variant="destructive" className="mb-6 border-2">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t("admin.subscription.expiredBandTitle")}</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
          <span>{t("admin.subscription.expiredBandMsg")}</span>
          <Button size="sm" className="shrink-0" onClick={handleNavigateToPlan}>
            <CreditCard className="w-4 h-4 mr-2" />
            {t("admin.subscription.makePayment")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // P4-1a (2026-07-28): ≤7 gün KRİTİK üst-bant — HER status'ta (eski hâl yalnız
  // trial'dı → active+6g acente hiç uyarı görmüyordu, kök-kanıt). Kapatılabilir
  // (sessionStorage — oturum-bazlı; her yeni girişte yeniden görünür). Yumuşak
  // pulse (sert blink yerine — görsel karar Murat'ta).
  if (remainingDays !== null && remainingDays >= 0 && remainingDays <= 7 && !dismissed) {
    return (
      <Alert variant="destructive" className="mb-6 border-2 [animation:pulse_2.5s_ease-in-out_infinite]">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t("admin.subscription.expiryBandTitle")}</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
          <span>
            {remainingDays === 0
              ? t("admin.subscription.lastDay")
              : t("admin.subscription.daysLeftBadge", { count: remainingDays })}
            {" — "}{t("admin.subscription.expiryBandMsg")}
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={handleNavigateToPlan}>
              <CreditCard className="w-4 h-4 mr-2" />
              {t("admin.subscription.makePayment")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { sessionStorage.setItem("pkgExpiryDismissed", "1"); setDismissed(true); }}>
              ✕
            </Button>
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  // Trial süresinde uyarı göster (son 7 gün)
  if (subscriptionInfo.subscription_status === 'trial' && remainingDays !== null && remainingDays <= 7) {
    return (
      <Alert className="mb-6 border-primary/50 bg-primary/5">
        <Clock className="h-4 w-4 text-primary" />
        <AlertTitle>{t("admin.subscription.trialPeriod")}</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            {t(`admin.agency.plans.${subscriptionInfo.plan_type}`)} {t("admin.subscription.packageTrial")}{" "}
            <strong>{remainingDays} {t("admin.subscription.days")}</strong> {t("admin.subscription.willEnd")}.
            {subscriptionInfo.trial_ends_at && (
              <span className="text-muted-foreground ml-1">
                ({format(new Date(subscriptionInfo.trial_ends_at), "d MMMM yyyy", { locale: dateLocale })})
              </span>
            )}
          </span>
          <Button size="sm" variant="default" className="ml-4 bg-gradient-ocean" onClick={handleNavigateToPlan}>
            <CreditCard className="w-4 h-4 mr-2" />
            {t("admin.subscription.activatePlan")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};
