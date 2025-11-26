import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, Clock, CreditCard } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { tr } from "date-fns/locale";
import { SipayPaymentForm } from "./SipayPaymentForm";

interface SubscriptionInfo {
  plan_type: string;
  trial_ends_at: string | null;
  subscription_status: string;
  subscription_ends_at: string | null;
}

interface AgencyInfo {
  id: string;
  name: string;
}

export const SubscriptionBanner = () => {
  const { t } = useTranslation();
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [agencyInfo, setAgencyInfo] = useState<AgencyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

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
        setSubscriptionInfo({
          plan_type: agencyData.plan_type,
          trial_ends_at: agencyData.trial_ends_at,
          subscription_status: agencyData.subscription_status,
          subscription_ends_at: agencyData.subscription_ends_at,
        });
        setAgencyInfo({
          id: agencyData.id,
          name: agencyData.name,
        });
      }
    } catch (error) {
      console.error("Error loading subscription info:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePrice = (planType: string, isYearly: boolean = false): number => {
    const prices: Record<string, { monthly: number; yearly: number }> = {
      starter: { monthly: 999, yearly: 9990 },
      professional: { monthly: 2499, yearly: 24990 },
      enterprise: { monthly: 4999, yearly: 49990 },
    };

    const plan = prices[planType] || prices.starter;
    return isYearly ? plan.yearly : plan.monthly;
  };

  if (loading || !subscriptionInfo) return null;

  const getRemainingDays = () => {
    const targetDate = subscriptionInfo.subscription_status === 'trial' 
      ? subscriptionInfo.trial_ends_at 
      : subscriptionInfo.subscription_ends_at;
    
    if (!targetDate) return null;
    return differenceInDays(new Date(targetDate), new Date());
  };

  const remainingDays = getRemainingDays();

  // Eğer trial veya aktif değilse ve süresi dolduysa kritik uyarı göster
  if (subscriptionInfo.subscription_status === 'expired' || remainingDays !== null && remainingDays <= 0) {
    return (
      <>
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("admin.subscription.expired")}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              {t("admin.subscription.expiredMessage")}
            </span>
            <Button size="sm" className="ml-4" onClick={() => setShowPaymentModal(true)}>
              <CreditCard className="w-4 h-4 mr-2" />
              {t("admin.subscription.makePayment")}
            </Button>
          </AlertDescription>
        </Alert>

        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Abonelik Yenileme</DialogTitle>
            </DialogHeader>
            {agencyInfo && (
              <SipayPaymentForm
                agencyId={agencyInfo.id}
                agencyName={agencyInfo.name}
                planType={subscriptionInfo.plan_type}
                isYearly={false}
                amount={calculatePrice(subscriptionInfo.plan_type, false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Trial süresinde uyarı göster (son 7 gün)
  if (subscriptionInfo.subscription_status === 'trial' && remainingDays !== null && remainingDays <= 7) {
    return (
      <>
        <Alert className="mb-6 border-primary/50 bg-primary/5">
          <Clock className="h-4 w-4 text-primary" />
          <AlertTitle>{t("admin.subscription.trialPeriod")}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              {t(`admin.agency.plans.${subscriptionInfo.plan_type}`)} {t("admin.subscription.packageTrial")}{" "}
              <strong>{remainingDays} {t("admin.subscription.days")}</strong> {t("admin.subscription.willEnd")}.
              {subscriptionInfo.trial_ends_at && (
                <span className="text-muted-foreground ml-1">
                  ({format(new Date(subscriptionInfo.trial_ends_at), "d MMMM yyyy", { locale: tr })})
                </span>
              )}
            </span>
            <Button size="sm" variant="default" className="ml-4 bg-gradient-ocean" onClick={() => setShowPaymentModal(true)}>
              <CreditCard className="w-4 h-4 mr-2" />
              {t("admin.subscription.activatePlan")}
            </Button>
          </AlertDescription>
        </Alert>

        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Abonelik Aktivasyonu</DialogTitle>
            </DialogHeader>
            {agencyInfo && (
              <SipayPaymentForm
                agencyId={agencyInfo.id}
                agencyName={agencyInfo.name}
                planType={subscriptionInfo.plan_type}
                isYearly={false}
                amount={calculatePrice(subscriptionInfo.plan_type, false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return null;
};
