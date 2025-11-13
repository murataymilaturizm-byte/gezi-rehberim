import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, Clock, CreditCard } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { tr } from "date-fns/locale";

interface SubscriptionInfo {
  plan_type: string;
  trial_ends_at: string | null;
  subscription_status: string;
  subscription_ends_at: string | null;
}

export const SubscriptionBanner = () => {
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscriptionInfo();
  }, []);

  const loadSubscriptionInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agencyData, error } = await supabase
        .from("agencies")
        .select("plan_type, trial_ends_at, subscription_status, subscription_ends_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setSubscriptionInfo(agencyData);
    } catch (error) {
      console.error("Error loading subscription info:", error);
    } finally {
      setLoading(false);
    }
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
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Abonelik Süresi Doldu</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            Hizmetlerimize devam etmek için lütfen aboneliğinizi yenileyin.
          </span>
          <Button size="sm" className="ml-4">
            <CreditCard className="w-4 h-4 mr-2" />
            Ödeme Yap
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Trial süresinde uyarı göster (son 7 gün)
  if (subscriptionInfo.subscription_status === 'trial' && remainingDays !== null && remainingDays <= 7) {
    const planLabels: Record<string, string> = {
      starter: "Başlangıç",
      professional: "Profesyonel",
      enterprise: "Kurumsal"
    };

    return (
      <Alert className="mb-6 border-primary/50 bg-primary/5">
        <Clock className="h-4 w-4 text-primary" />
        <AlertTitle>Deneme Süresi</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            {planLabels[subscriptionInfo.plan_type]} paketinizin deneme süresi{" "}
            <strong>{remainingDays} gün</strong> sonra sona erecek.
            {subscriptionInfo.trial_ends_at && (
              <span className="text-muted-foreground ml-1">
                ({format(new Date(subscriptionInfo.trial_ends_at), "d MMMM yyyy", { locale: tr })})
              </span>
            )}
          </span>
          <Button size="sm" variant="default" className="ml-4 bg-gradient-ocean">
            <CreditCard className="w-4 h-4 mr-2" />
            Planı Aktifleştir
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};
