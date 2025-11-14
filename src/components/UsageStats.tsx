import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, Calendar, Database, TrendingUp, AlertCircle, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UsageData {
  monthly_message_count: number;
  message_limit: number;
  plan_type: string;
  last_message_reset_date: string;
  subscription_status: string;
  trial_ends_at?: string;
  subscription_ends_at?: string;
}

export const UsageStats = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedQuotaPackage, setSelectedQuotaPackage] = useState<"500" | "1000">("500");

  useEffect(() => {
    loadUsageData();
  }, []);

  const loadUsageData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('agencies')
        .select('monthly_message_count, message_limit, plan_type, last_message_reset_date, subscription_status, trial_ends_at, subscription_ends_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      // Super admin veya agency'si olmayan kullanıcılar için
      if (!data) {
        setUsage(null);
        setLoading(false);
        return;
      }
      
      setUsage(data);
    } catch (error) {
      console.error('Error loading usage data:', error);
      toast({
        title: t("admin.toast.error"),
        description: t("admin.usageStats.loadError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseExtraQuota = async () => {
    setPurchasing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get agency ID
      const { data: agency } = await supabase
        .from('agencies')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!agency) throw new Error("Agency not found");

      // Call sipay-payment edge function with quota purchase type
      const { data, error } = await supabase.functions.invoke('sipay-payment', {
        body: {
          purchaseType: 'extra_quota',
          quotaAmount: parseInt(selectedQuotaPackage),
          agencyId: agency.id,
        }
      });

      if (error) throw error;

      if (data?.payment_url) {
        // Redirect to Sipay payment page
        window.location.href = data.payment_url;
      } else {
        throw new Error("Payment URL not received");
      }
    } catch (error: any) {
      console.error('Error purchasing quota:', error);
      toast({
        title: t("admin.toast.error"),
        description: error.message || t("admin.usageStats.paymentError"),
        variant: "destructive",
      });
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            {t("admin.usageStats.packageUsage")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">{t("admin.loading")}</div>
        </CardContent>
      </Card>
    );
  }

  // Super admin veya agency olmayan kullanıcılar için gösterme
  if (!usage) {
    return null;
  }

  const usagePercentage = usage.message_limit === -1 
    ? 0 
    : (usage.monthly_message_count / usage.message_limit) * 100;

  const isNearLimit = usagePercentage >= 80 && usage.message_limit !== -1;
  const isOverLimit = usagePercentage >= 100 && usage.message_limit !== -1;

  const getPlanBadgeColor = (planType: string) => {
    switch (planType) {
      case 'starter': return 'bg-blue-500';
      case 'professional': return 'bg-purple-500';
      case 'enterprise': return 'bg-amber-500';
      default: return 'bg-gray-500';
    }
  };

  const getPlanName = (planType: string) => {
    switch (planType) {
      case 'starter': return t("admin.dashboard.starter");
      case 'professional': return t("admin.dashboard.professional");
      case 'enterprise': return t("admin.dashboard.enterprise");
      default: return planType;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Paket Bilgisi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              {t("admin.usageStats.activePackage")}
            </span>
            <Badge className={getPlanBadgeColor(usage.plan_type)}>
              {getPlanName(usage.plan_type)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("admin.usageStats.status")}</span>
              <Badge variant={usage.subscription_status === 'active' ? 'default' : usage.subscription_status === 'trial' ? 'secondary' : 'destructive'}>
                {usage.subscription_status === 'active' ? t("admin.usageStats.statusActive") : usage.subscription_status === 'trial' ? t("admin.usageStats.statusTrial") : t("admin.usageStats.statusExpired")}
              </Badge>
            </div>
            
            {usage.subscription_status === 'trial' && usage.trial_ends_at && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("admin.usageStats.trialPeriod")}</span>
                <span className="font-medium">{getDaysRemaining(usage.trial_ends_at)} {t("admin.usageStats.daysRemaining")}</span>
              </div>
            )}
            
            {usage.subscription_status === 'active' && usage.subscription_ends_at && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("admin.usageStats.renewalDate")}</span>
                <span className="font-medium">{formatDate(usage.subscription_ends_at)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mesaj Kullanımı */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              {t("admin.usageStats.messageQuota")}
            </span>
            {isNearLimit && !isOverLimit && (
              <AlertCircle className="w-5 h-5 text-warning" />
            )}
            {isOverLimit && (
              <AlertCircle className="w-5 h-5 text-destructive" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("admin.usageStats.usedThisMonth")}</span>
              <span className="font-medium">
                {usage.monthly_message_count.toLocaleString('tr-TR')} 
                {usage.message_limit === -1 ? ` (${t("admin.usageStats.unlimited")})` : ` / ${usage.message_limit.toLocaleString('tr-TR')}`}
              </span>
            </div>
            
            {usage.message_limit !== -1 && (
              <>
                <Progress 
                  value={Math.min(usagePercentage, 100)} 
                  className={isOverLimit ? 'bg-destructive/20' : isNearLimit ? 'bg-warning/20' : ''}
                />
                
                {isOverLimit && (
                  <div className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {t("admin.usageStats.quotaFull")}
                  </div>
                )}
                
                {isNearLimit && !isOverLimit && (
                  <div className="text-xs text-warning flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {t("admin.usageStats.quotaNearLimit", { percent: Math.round(100 - usagePercentage) })}
                  </div>
                )}
              </>
            )}
            
            <div className="flex items-center justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">{t("admin.usageStats.lastReset")}</span>
              <span className="font-medium">{formatDate(usage.last_message_reset_date)}</span>
            </div>
          </div>

          {/* Ekstra Kota Satın Alma Butonu - Sadece ücretli paket kullanıcıları için */}
          {usage.subscription_status === 'active' && usage.message_limit !== -1 && (
            <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full mt-4" size="sm">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {t("admin.usageStats.buyExtraQuota")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("admin.usageStats.extraQuotaTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("admin.usageStats.extraQuotaDescription")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-3">
                    <button
                      onClick={() => setSelectedQuotaPackage("500")}
                      className={`w-full p-4 border-2 rounded-lg transition-all ${
                        selectedQuotaPackage === "500"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <div className="font-semibold text-lg">{t("admin.usageStats.quota500Messages")}</div>
                          <div className="text-sm text-muted-foreground">{t("admin.usageStats.extraQuotaLabel")}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-xl">1.500 ₺</div>
                          <div className="text-xs text-muted-foreground">{t("admin.usageStats.oneTime")}</div>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setSelectedQuotaPackage("1000")}
                      className={`w-full p-4 border-2 rounded-lg transition-all ${
                        selectedQuotaPackage === "1000"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <div className="font-semibold text-lg">{t("admin.usageStats.quota1000Messages")}</div>
                          <div className="text-sm text-muted-foreground">{t("admin.usageStats.extraQuotaLabel")}</div>
                          <Badge variant="secondary" className="mt-1">{t("admin.usageStats.popular")}</Badge>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-xl">2.699 ₺</div>
                          <div className="text-xs text-muted-foreground">{t("admin.usageStats.oneTime")}</div>
                          <div className="text-xs text-green-600 font-medium">{t("admin.usageStats.discount10")}</div>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="bg-muted/50 p-3 rounded-lg text-sm">
                    <p className="text-muted-foreground">
                      {t("admin.usageStats.quotaInfo")}
                    </p>
                  </div>

                  <Button 
                    onClick={handlePurchaseExtraQuota} 
                    disabled={purchasing}
                    className="w-full"
                  >
                    {purchasing ? t("admin.usageStats.redirecting") : t("admin.usageStats.goToPayment")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>

      {/* Günlük Ortalama */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            {t("admin.usageStats.avgUsage")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("admin.usageStats.dailyAvg")}</span>
              <span className="font-medium">
                ~{Math.round(usage.monthly_message_count / new Date().getDate())} {t("admin.usageStats.messagesPerDay")}
              </span>
            </div>
            
            {usage.message_limit !== -1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("admin.usageStats.estimatedDuration")}</span>
                <span className="font-medium">
                  {usage.monthly_message_count === 0 
                    ? t("admin.usageStats.notUsedYet")
                    : Math.round((usage.message_limit - usage.monthly_message_count) / (usage.monthly_message_count / new Date().getDate())) + ` ${t("admin.usageStats.days")}`
                  }
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Paket Detayları */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {t("admin.usageStats.packageFeatures")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {usage.plan_type === 'starter' && (
              <>
                <div className="flex items-center gap-2">
                  <span>💬 {t("admin.usageStats.features.starter.messages")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💾 {t("admin.usageStats.features.starter.history")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>📧 {t("admin.usageStats.features.starter.support")}</span>
                </div>
              </>
            )}
            
            {usage.plan_type === 'professional' && (
              <>
                <div className="flex items-center gap-2">
                  <span>💬 {t("admin.usageStats.features.professional.messages")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💾 {t("admin.usageStats.features.professional.history")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>⚡ {t("admin.usageStats.features.professional.support")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🎯 {t("admin.usageStats.features.professional.profiles")}</span>
                </div>
              </>
            )}
            
            {usage.plan_type === 'enterprise' && (
              <>
                <div className="flex items-center gap-2">
                  <span>💬 {t("admin.usageStats.features.enterprise.messages")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💾 {t("admin.usageStats.features.enterprise.history")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🚀 {t("admin.usageStats.features.enterprise.support")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🔌 {t("admin.usageStats.features.enterprise.api")}</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};