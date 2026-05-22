import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MessageSquare, Database, AlertCircle, ChevronDown, Crown, Zap, Globe, Palette, Users, Bell, BarChart3, FileText, Star, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getPlanFeatures, type PlanFeatures } from "@/utils/planFeatures";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";
// Sorun 2: ek-kota satın alma ortak bileşene taşındı (Dashboard + Planım'da kullanılır)
import { ExtraQuotaPurchase } from "@/components/ExtraQuotaPurchase";

const DATE_LOCALE_MAP = { tr, en: enUS, de, ru, ar, fr, es };

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
  const { t, i18n } = useTranslation();
  const dateLocale = DATE_LOCALE_MAP[i18n.language as keyof typeof DATE_LOCALE_MAP] || tr;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [planFeatures, setPlanFeatures] = useState<PlanFeatures | null>(null);
  // Sorun 2: ek-kota state'i (purchaseDialogOpen / purchasing / selectedQuotaPackage)
  // ExtraQuotaPurchase bileşenine taşındı — burada gereksiz.
  const [showFeatures, setShowFeatures] = useState(false);
  // Sorun 2: ExtraQuotaPurchase agency_id ister — burada saklayıp prop olarak iletiyoruz.
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    loadUsageData();
  }, []);

  const loadUsageData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email ?? "");

      const { data, error } = await supabase
        .from('agencies')
        // Sorun 2: id eklendi (ExtraQuotaPurchase'a prop olarak verilecek — agencyId)
        .select('id, monthly_message_count, message_limit, plan_type, last_message_reset_date, subscription_status, trial_ends_at, subscription_ends_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) { setUsage(null); setLoading(false); return; }
      setAgencyId((data as any).id ?? null);

      const normalizedUsage: UsageData = {
        monthly_message_count: Number(data.monthly_message_count ?? 0),
        message_limit: Number(data.message_limit ?? 0),
        plan_type: data.plan_type || "starter",
        last_message_reset_date: data.last_message_reset_date || new Date().toISOString(),
        subscription_status: data.subscription_status || "trial",
        trial_ends_at: data.trial_ends_at ?? undefined,
        subscription_ends_at: data.subscription_ends_at ?? undefined,
      };

      setUsage(normalizedUsage);
      const features = await getPlanFeatures(normalizedUsage.plan_type);
      setPlanFeatures(features);
    } catch (error) {
      console.error('Error loading usage data:', error);
      toast({ title: t("admin.toast.error"), description: t("admin.usageStats.loadError"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Sorun 2: handlePurchaseExtraQuota → ExtraQuotaPurchase bileşenine taşındı.
  // Buradan kaldırıldı — davranış aynı, sadece yer değişti.

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">{t("admin.loading")}</div>
        </CardContent>
      </Card>
    );
  }

  if (!usage) return null;

  const usagePercentage = usage.message_limit <= 0 || usage.message_limit === -1
    ? 0
    : (usage.monthly_message_count / usage.message_limit) * 100;
  const isNearLimit = usagePercentage >= 80 && usage.message_limit > 0;
  const isOverLimit = usagePercentage >= 100 && usage.message_limit > 0;

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'starter': return { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", badge: "bg-blue-500" };
      case 'professional': return { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", badge: "bg-purple-500" };
      case 'enterprise': return { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", badge: "bg-amber-500" };
      default: return { bg: "bg-muted", text: "text-muted-foreground", badge: "bg-muted-foreground" };
    }
  };

  const getPlanName = (plan: string) => {
    switch (plan) {
      case 'starter': return t("admin.agency.plans.starter");
      case 'professional': return t("admin.agency.plans.professional");
      case 'enterprise': return t("admin.agency.plans.enterprise");
      default: return plan;
    }
  };

  const formatDate = (dateString: string) => format(new Date(dateString), 'dd MMM yyyy', { locale: dateLocale });

  const getDaysRemaining = (endDate: string) => {
    const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const dailyAvg = Math.round(usage.monthly_message_count / Math.max(new Date().getDate(), 1));
  const planColors = getPlanColor(usage.plan_type);

  return (
    <Card className="shadow-card overflow-hidden">
      {/* Active Plan Header */}
      <div className={cn("p-3 sm:p-4 border-b", planColors.bg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", planColors.bg)}>
              <Crown className={cn("h-4 w-4", planColors.text)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{getPlanName(usage.plan_type)}</span>
                <Badge className={cn("text-[10px] px-1.5 py-0 text-white", planColors.badge)}>
                  {usage.subscription_status === 'active' ? t("admin.usageStats.statusActive") 
                    : usage.subscription_status === 'trial' ? t("admin.usageStats.statusTrial") 
                    : t("admin.usageStats.statusExpired")}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {usage.subscription_status === 'trial' && usage.trial_ends_at
                  ? `${getDaysRemaining(usage.trial_ends_at)} ${t("admin.usageStats.daysRemaining")}`
                  : usage.subscription_status === 'active' && usage.subscription_ends_at
                  ? `${t("admin.usageStats.renewalDate")}: ${formatDate(usage.subscription_ends_at)}`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      <CardContent className="p-3 sm:p-4 space-y-3">
        {/* Message Usage - Compact */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{t("admin.usageStats.messageQuota")}</span>
            </div>
            <span className="text-xs font-semibold">
              {usage.monthly_message_count.toLocaleString('tr-TR')}
              {usage.message_limit === -1 ? " / ∞" : ` / ${usage.message_limit.toLocaleString('tr-TR')}`}
            </span>
          </div>

          {usage.message_limit !== -1 && (
            <div className="space-y-1">
              <Progress
                value={Math.min(usagePercentage, 100)}
                className={cn("h-2", isOverLimit ? "bg-destructive/20" : isNearLimit ? "bg-warning/20" : "")}
              />
              {(isOverLimit || isNearLimit) && (
                <p className={cn("text-[10px] flex items-center gap-1", isOverLimit ? "text-destructive" : "text-warning")}>
                  <AlertCircle className="w-3 h-3" />
                  {isOverLimit ? t("admin.usageStats.quotaFull") : t("admin.usageStats.quotaNearLimit", { percent: Math.round(100 - usagePercentage) })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/40 p-2 text-center">
            <div className="text-xs font-bold">{dailyAvg}</div>
            <p className="text-[9px] text-muted-foreground">{t("admin.usageStats.messagesPerDay")}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2 text-center">
            <div className="text-xs font-bold">{formatDate(usage.last_message_reset_date)}</div>
            <p className="text-[9px] text-muted-foreground">{t("admin.usageStats.lastReset")}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2 text-center">
            <div className="text-xs font-bold">
              {usage.monthly_message_count === 0 || usage.message_limit === -1
                ? "∞"
                : `${Math.max(0, Math.round((usage.message_limit - usage.monthly_message_count) / Math.max(dailyAvg, 1)))}${t("admin.usageStats.days")}`}
            </div>
            <p className="text-[9px] text-muted-foreground">{t("admin.usageStats.estimatedDuration")}</p>
          </div>
        </div>

        {/* Sorun 2: Ek-kota satın alma artık ortak bileşende.
            Dashboard'da compact buton; Planım'da normal buton (compact=false). */}
        <ExtraQuotaPurchase
          agencyId={agencyId}
          userEmail={userEmail}
          messageLimit={usage.message_limit}
          subscriptionStatus={usage.subscription_status}
          compact
        />
        {/* Bileşen kendi içinde "active + sınırlı plan" koşulunu kontrol eder; aksi halde null döner. */}

        {/* Package Features - Collapsible */}
        {planFeatures && (
          <Collapsible open={showFeatures} onOpenChange={setShowFeatures}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full text-left py-1.5 px-2 rounded-md hover:bg-accent/50 transition-colors">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Zap className="h-3.5 w-3.5" />
                  {t("admin.usageStats.packageFeatures")}
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", showFeatures && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-2 gap-1.5 pt-2">
                {[
                  { icon: MessageSquare, text: planFeatures.message_limit === -1 ? t("admin.usageStats.dynamicFeatures.unlimitedMessages") : t("admin.usageStats.dynamicFeatures.messagesPerMonth", { count: planFeatures.message_limit }), show: true },
                  { icon: Database, text: (planFeatures.max_tours === -1 || planFeatures.max_tours >= 9999) ? t("admin.usageStats.dynamicFeatures.unlimitedTours") : t("admin.usageStats.dynamicFeatures.maxTours", { count: planFeatures.max_tours }), show: true },
                  { icon: Globe, text: planFeatures.max_languages >= 7 ? t("admin.usageStats.dynamicFeatures.allLanguages") : t("admin.usageStats.dynamicFeatures.languageSupport", { count: planFeatures.max_languages }), show: true },
                  { icon: Palette, text: planFeatures.available_styles.length >= 4 ? t("admin.usageStats.dynamicFeatures.allStyles") : t("admin.usageStats.dynamicFeatures.limitedStyles", { count: planFeatures.available_styles.length }), show: true },
                  { icon: Users, text: t("admin.usageStats.dynamicFeatures.userProfiles"), show: planFeatures.has_user_profiles },
                  { icon: Bell, text: t("admin.usageStats.dynamicFeatures.autoReminders"), show: planFeatures.has_reminders },
                  { icon: BarChart3, text: t("admin.usageStats.dynamicFeatures.advancedAnalytics"), show: planFeatures.has_analytics },
                  { icon: FileText, text: t("admin.usageStats.dynamicFeatures.messageTemplates"), show: planFeatures.has_templates },
                  { icon: Star, text: t("admin.usageStats.dynamicFeatures.feedbackSurveys"), show: planFeatures.has_feedback },
                  { icon: Send, text: t("admin.usageStats.dynamicFeatures.followUpMessages"), show: planFeatures.has_follow_ups },
                ].filter(f => f.show).map((feature, i) => (
                  <div key={i} className="flex items-center gap-1.5 p-1.5 rounded-md bg-muted/30 text-[11px]">
                    <feature.icon className="h-3 w-3 text-primary shrink-0" />
                    <span className="truncate">{feature.text}</span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
};
