import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SipayPaymentForm } from "./SipayPaymentForm";
import type { PaymentStatus } from "./PaymentStatusIndicator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { tr } from "date-fns/locale";
import { generateInvoicePDF } from "@/utils/invoiceGenerator";
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  CreditCard, 
  TrendingUp,
  Calendar,
  Ban,
  Zap,
  AlertCircle,
  Crown,
  ArrowRight,
  Download,
  Building2
} from "lucide-react";

interface SubscriptionHistoryItem {
  id: string;
  event_type: string;
  plan_type: string | null;
  amount: number | null;
  currency: string | null;
  payment_method: string | null;
  transaction_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

interface AgencySubscription {
  id: string;
  plan_type: string;
  trial_ends_at: string | null;
  subscription_status: string;
  subscription_ends_at: string | null;
  name?: string;
}

interface PlanOption {
  id: "starter" | "professional" | "enterprise";
  name: string;
  price: number;
  features: string[];
  icon: any;
  popular?: boolean;
}

export const SubscriptionHistory = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const eventTypeLabels: Record<string, string> = {
    trial_started: t("admin.subscription.eventTypes.trial_started"),
    trial_ended: t("admin.subscription.eventTypes.trial_ended"),
    payment_success: t("admin.subscription.eventTypes.payment_success"),
    payment_failed: t("admin.subscription.eventTypes.payment_failed"),
    plan_changed: t("admin.subscription.eventTypes.plan_changed"),
    subscription_activated: t("admin.subscription.eventTypes.subscription_activated"),
    subscription_expired: t("admin.subscription.eventTypes.subscription_expired"),
    subscription_cancelled: t("admin.subscription.eventTypes.subscription_cancelled")
  };
  
  const statusLabels: Record<string, string> = {
    success: t("admin.subscription.status.success"),
    failed: t("admin.subscription.status.failed"),
    pending: t("admin.subscription.status.pending"),
    cancelled: t("admin.subscription.status.cancelled")
  };

  const planLabels: Record<string, string> = {
    starter: t("admin.agency.plans.starter"),
    professional: t("admin.agency.plans.professional"),
    enterprise: t("admin.agency.plans.enterprise")
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "trial_started":
      case "subscription_activated":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "payment_success":
        return <CreditCard className="h-4 w-4 text-green-600" />;
      case "payment_failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "plan_changed":
        return <TrendingUp className="h-4 w-4 text-primary" />;
      case "trial_ended":
      case "subscription_expired":
        return <Calendar className="h-4 w-4 text-muted-foreground" />;
      case "subscription_cancelled":
        return <Ban className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="default" className="bg-green-600">{statusLabels[status]}</Badge>;
      case "failed":
        return <Badge variant="destructive">{statusLabels[status]}</Badge>;
      case "pending":
        return <Badge variant="secondary">{statusLabels[status]}</Badge>;
      case "cancelled":
        return <Badge variant="outline">{statusLabels[status]}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const [history, setHistory] = useState<SubscriptionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<AgencySubscription | null>(null);
  const [changingPlan, setChangingPlan] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(false);

  const planOptions: PlanOption[] = [
    {
      id: "starter",
      name: "Başlangıç",
      price: 2999,
      features: [
        "💬 1.000 mesaj/ay",
        "🏨 10 tura kadar",
        "🌍 1 dil (Türkçe)",
        "👔 Profesyonel üslup",
        "📊 Temel raporlama",
        "💾 30 gün geçmiş"
      ],
      icon: Zap
    },
    {
      id: "professional",
      name: "Profesyonel",
      price: 4999,
      features: [
        "💬 5.000 mesaj/ay",
        "🏨 Sınırsız tur",
        "🌍 3 dil desteği",
        "🎭 4 konuşma üslubu",
        "👥 Kullanıcı profilleri",
        "🔔 Otomatik hatırlatmalar",
        "📧 Otomatik takip mesajları",
        "📊 Gelişmiş analizler",
        "💾 90 gün geçmiş"
      ],
      icon: TrendingUp,
      popular: true
    },
    {
      id: "enterprise",
      name: "Kurumsal",
      price: 14999,
      features: [
        "💬 Sınırsız mesaj",
        "🏨 Sınırsız tur",
        "🌍 7 dil desteği",
        "🎨 4 konuşma üslubu",
        "👥 Gelişmiş profiller",
        "🔔 Akıllı hatırlatmalar",
        "📧 Otomatik takip & anket",
        "📊 Premium analizler",
        "🚀 7/24 destek",
        "💾 Sınırsız geçmiş"
      ],
      icon: Crown
    }
  ];

  const calculatePrice = (basePrice: number | null | undefined, yearly: boolean) => {
    const price = basePrice || 0;
    if (yearly && price > 0) {
      const yearlyPrice = price * 12;
      const discountedPrice = yearlyPrice * 0.9; // %10 indirim
      return discountedPrice;
    }
    return price;
  };

  const formatPrice = (price: number | null | undefined, yearly: boolean) => {
    const safePrice = price || 0;
    if (safePrice === 0) return t("admin.subscription.customPrice");
    if (yearly) {
      return `${safePrice.toLocaleString('tr-TR')}₺/${t("admin.subscription.yearly").toLowerCase()}`;
    }
    return `${safePrice.toLocaleString('tr-TR')}₺/${t("admin.subscription.monthly").toLowerCase()}`;
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's agency with subscription info
      const { data: agencyData, error: agencyError } = await supabase
        .from("agencies")
        .select("id, plan_type, trial_ends_at, subscription_status, subscription_ends_at, name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (agencyError) throw agencyError;
      
      if (agencyData) {
        setAgencyId(agencyData.id);
        setSubscription(agencyData);

        // Load subscription history
        const { data: historyData, error: historyError } = await supabase
          .from("subscription_history")
          .select("*")
          .eq("agency_id", agencyData.id)
          .order("created_at", { ascending: false });

        if (historyError) throw historyError;
        setHistory(historyData || []);
      }
      // If no agencyData, subscription stays null - show plan selection without payment
    } catch (error) {
      console.error("Error loading subscription history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (item: SubscriptionHistoryItem) => {
    if (!subscription) return;

    try {
      // Generate invoice number from transaction ID or item ID
      const invoiceNumber = item.transaction_id 
        ? `TRZ-${item.transaction_id.substring(0, 8).toUpperCase()}`
        : `TRZ-${item.id.substring(0, 8).toUpperCase()}`;

      const planNames: Record<string, string> = {
        starter: t("admin.agency.plans.starter"),
        professional: t("admin.agency.plans.professional"),
        enterprise: t("admin.agency.plans.enterprise")
      };

      // Get agency name
      const { data: agencyData } = await supabase
        .from("agencies")
        .select("name")
        .eq("id", agencyId)
        .single();

      generateInvoicePDF({
        invoiceNumber,
        transactionId: item.transaction_id || item.id.substring(0, 12),
        date: item.created_at,
        agencyName: agencyData?.name || "Acente",
        planName: item.plan_type ? planNames[item.plan_type] : "Standart",
        amount: item.amount || 0,
        currency: item.currency || "TRY",
        paymentMethod: item.payment_method || "Kredi Kartı"
      });

      toast({
        title: "Başarılı! ✅",
        description: "Fatura indirildi",
      });
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast({
        title: "Hata",
        description: "Fatura oluşturulamadı",
        variant: "destructive"
      });
    }
  };

  const formatAmount = (amount: number | null, currency: string | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency || 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const handlePlanChange = (plan: PlanOption) => {
    if (!subscription) return;

    // Check if trial or expired
    if (subscription.subscription_status === "trial") {
      toast({
        title: "Uyarı",
        description: "Deneme süresindeyken plan değiştiremezsiniz. Önce ödeme yapmalısınız.",
        variant: "destructive"
      });
      return;
    }

    if (subscription.subscription_status === "expired" || subscription.subscription_status === "cancelled") {
      toast({
        title: "Uyarı",
        description: "Aboneliğiniz aktif değil. Önce ödeme yapmalısınız.",
        variant: "destructive"
      });
      return;
    }

    if (plan.id === subscription.plan_type) {
      toast({
        title: "Bilgi",
        description: "Zaten bu plandayınız.",
      });
      return;
    }

    setSelectedPlan(plan);
    setConfirmDialogOpen(true);
  };

  const confirmPlanChange = async () => {
    if (!agencyId || !selectedPlan) return;

    setChangingPlan(true);

    try {
      // Update agency plan
      const { error: updateError } = await supabase
        .from("agencies")
        .update({
          plan_type: selectedPlan.id,
        })
        .eq("id", agencyId);

      if (updateError) throw updateError;

      // Add to subscription history
      const { error: historyError } = await supabase
        .from("subscription_history")
        .insert({
          agency_id: agencyId,
          event_type: "plan_changed",
          plan_type: selectedPlan.id,
          status: "success",
          notes: `Plan değiştirildi: ${subscription?.plan_type} → ${selectedPlan.id}`
        });

      if (historyError) throw historyError;

      toast({
        title: "Başarılı! ✅",
        description: `Planınız ${selectedPlan.name} olarak değiştirildi`,
      });

      // Refresh data
      loadHistory();
      setConfirmDialogOpen(false);
      setSelectedPlan(null);
    } catch (error: any) {
      console.error("Error changing plan:", error);
      toast({
        title: "Hata",
        description: error.message || "Plan değiştirilemedi",
        variant: "destructive"
      });
    } finally {
      setChangingPlan(false);
    }
  };

  // Payment is now handled by PayTR via SipayPaymentForm component

  const getRemainingDays = () => {
    if (!subscription) return null;
    
    const targetDate = subscription.subscription_status === 'trial' 
      ? subscription.trial_ends_at 
      : subscription.subscription_ends_at;
    
    if (!targetDate) return null;
    return differenceInDays(new Date(targetDate), new Date());
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">{t("admin.subscription.loading")}</div>
    );
  }

  const remainingDays = getRemainingDays();
  const currentPlan = planOptions.find(p => p.id === subscription?.plan_type);

  return (
    <>
      {/* No Agency / No Subscription - Show plan selection */}
      {!subscription && (
        <Card className="shadow-card mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Plan Seçin</CardTitle>
                <CardDescription>
                  Hesabınız henüz bir plana bağlı değil. Aşağıdan bir plan seçerek başlayın.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Billing Period Toggle */}
            <div className="flex items-center justify-center gap-3 p-4 bg-muted/50 rounded-lg w-fit mx-auto">
              <Label htmlFor="billing-toggle-no-sub" className={!isYearly ? "font-semibold" : "text-muted-foreground"}>
                {t("admin.subscription.monthly")}
              </Label>
              <Switch
                id="billing-toggle-no-sub"
                checked={isYearly}
                onCheckedChange={setIsYearly}
              />
              <Label htmlFor="billing-toggle-no-sub" className={isYearly ? "font-semibold" : "text-muted-foreground"}>
                {t("admin.subscription.yearly")}
              </Label>
              {isYearly && (
                <span className="ml-2 text-sm bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                  {t("admin.subscription.discount10")}
                </span>
              )}
            </div>

            {/* Plan Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              {planOptions.map((plan) => (
                <Card 
                  key={plan.id} 
                  className={`relative border-border hover:border-primary/50 transition-all ${
                    plan.popular ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-ocean text-primary-foreground">
                        {t("admin.subscription.popular")}
                      </Badge>
                    </div>
                  )}
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <plan.icon className="h-5 w-5 text-primary" />
                      <h5 className="font-semibold text-lg text-foreground">{plan.name}</h5>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        {formatPrice(calculatePrice(plan.price, isYearly), isYearly)}
                      </p>
                      {isYearly && plan.price > 0 && (
                        <div className="mt-1">
                          <p className="text-xs text-muted-foreground line-through">
                            {(plan.price * 12).toLocaleString('tr-TR')}₺/{t("admin.subscription.yearly").toLowerCase()}
                          </p>
                          <p className="text-xs text-green-600 font-medium">
                            {t("admin.subscription.discounted")}
                          </p>
                        </div>
                      )}
                    </div>
                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 text-primary flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {agencyId ? (
                      <SipayPaymentForm
                        agencyId={agencyId}
                        planType={plan.id}
                        isYearly={isYearly}
                        amount={calculatePrice(plan.price, isYearly)}
                        agencyName="Acenta"
                      />
                    ) : (
                      <Alert className="border-primary/20">
                        <Building2 className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Ödeme yapabilmek için önce acente bilgilerinizi kaydetmeniz gerekmektedir. Lütfen "Acente Bilgileri" bölümünden bilgilerinizi girin.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Plan Card */}
      {subscription && (
        <Card className="shadow-card mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {currentPlan?.icon && <currentPlan.icon className="h-5 w-5 text-primary" />}
                <div>
                  <CardTitle>{t("admin.subscription.currentPlan")}</CardTitle>
                  <CardDescription>
                    {subscription.subscription_status === "trial" 
                      ? t("admin.subscription.inTrialPeriod")
                      : subscription.subscription_status === "active"
                      ? t("admin.subscription.activeSubscription")
                      : t("admin.subscription.subscriptionStatus") + " " + subscription.subscription_status
                    }
                  </CardDescription>
                </div>
              </div>
              {remainingDays !== null && remainingDays > 0 && (
                <Badge variant={remainingDays <= 7 ? "destructive" : "secondary"}>
                  {remainingDays} {t("admin.subscription.daysRemaining")}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Billing Period Toggle */}
            <div className="flex items-center justify-center gap-3 p-4 bg-muted/50 rounded-lg w-fit mx-auto">
              <Label htmlFor="billing-toggle" className={!isYearly ? "font-semibold" : "text-muted-foreground"}>
                {t("admin.subscription.monthly")}
              </Label>
              <Switch
                id="billing-toggle"
                checked={isYearly}
                onCheckedChange={setIsYearly}
              />
              <Label htmlFor="billing-toggle" className={isYearly ? "font-semibold" : "text-muted-foreground"}>
                {t("admin.subscription.yearly")}
              </Label>
              {isYearly && (
                <span className="ml-2 text-sm bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                  {t("admin.subscription.discount10")}
                </span>
              )}
            </div>
            {/* Current Plan Info */}
            <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground">{currentPlan?.name}</h3>
                  <div className="mt-1">
                    <p className="text-2xl font-bold text-primary">
                      {currentPlan && formatPrice(calculatePrice(currentPlan.price, isYearly), isYearly)}
                    </p>
                    {isYearly && currentPlan && currentPlan.price > 0 && (
                      <div className="mt-1">
                        <p className="text-sm text-muted-foreground line-through">
                          {(currentPlan.price * 12).toLocaleString('tr-TR')}₺/yıl
                        </p>
                        <p className="text-sm text-green-600 font-medium">
                          %10 indirimli ({(currentPlan.price * 12 * 0.1).toLocaleString('tr-TR')}₺ tasarruf)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <ul className="space-y-2">
                {currentPlan?.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Warning for trial/expired status - show all plans with payment */}
            {(subscription.subscription_status === "trial" || 
              subscription.subscription_status === "expired" || 
              subscription.subscription_status === "cancelled") && (
              <div className="space-y-4">
                <Alert className="border-primary/50 bg-primary/5">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  <AlertDescription>
                    {subscription.subscription_status === "trial" && (
                      <>
                        <strong>{t("admin.subscription.trialPeriod")}:</strong> {t("admin.subscription.trialWarning").replace('Deneme Süresi: ', '')}
                      </>
                    )}
                    {(subscription.subscription_status === "expired" || subscription.subscription_status === "cancelled") && (
                      <>
                        <strong>{t("admin.subscription.expired")}:</strong> Aboneliğiniz sona erdi. Devam etmek için bir plan seçip ödeme yapın.
                      </>
                    )}
                  </AlertDescription>
                </Alert>
                
                <div className="grid md:grid-cols-3 gap-4">
                  {planOptions.map((plan) => (
                    <Card 
                      key={plan.id} 
                      className={`relative border-border hover:border-primary/50 transition-all ${
                        plan.popular ? 'ring-2 ring-primary' : ''
                      } ${plan.id === subscription.plan_type ? 'border-primary bg-primary/5' : ''}`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-gradient-ocean text-primary-foreground">
                            {t("admin.subscription.popular")}
                          </Badge>
                        </div>
                      )}
                      <CardContent className="p-6 space-y-4">
                        <div className="flex items-center gap-2">
                          <plan.icon className="h-5 w-5 text-primary" />
                          <h5 className="font-semibold text-lg text-foreground">{plan.name}</h5>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-primary">
                            {formatPrice(calculatePrice(plan.price, isYearly), isYearly)}
                          </p>
                          {isYearly && plan.price > 0 && (
                            <div className="mt-1">
                              <p className="text-xs text-muted-foreground line-through">
                                {(plan.price * 12).toLocaleString('tr-TR')}₺/{t("admin.subscription.yearly").toLowerCase()}
                              </p>
                              <p className="text-xs text-green-600 font-medium">
                                {t("admin.subscription.discounted")}
                              </p>
                            </div>
                          )}
                        </div>
                        <ul className="space-y-2">
                          {plan.features.map((feature, index) => (
                            <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CheckCircle2 className="h-3 w-3 text-primary flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                        {agencyId && (
                          <SipayPaymentForm
                            agencyId={agencyId}
                            planType={plan.id}
                            isYearly={isYearly}
                            amount={calculatePrice(plan.price, isYearly)}
                            agencyName={subscription.name || "Acenta"}
                          />
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Other Plans */}
            {subscription.subscription_status === "active" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-foreground">{t("admin.subscription.availablePlans")}</h4>
                  <p className="text-sm text-muted-foreground">{t("admin.subscription.planChangeNote").split('.')[0]}</p>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  {planOptions
                    .filter(plan => plan.id !== subscription.plan_type)
                    .map((plan) => (
                      <Card 
                        key={plan.id} 
                        className={`relative border-border hover:border-primary/50 transition-all cursor-pointer ${
                          plan.popular ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => handlePlanChange(plan)}
                      >
                        {plan.popular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <Badge className="bg-gradient-ocean text-primary-foreground">
                              {t("admin.subscription.popular")}
                            </Badge>
                          </div>
                        )}
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <plan.icon className="h-5 w-5 text-primary" />
                            <h5 className="font-semibold text-foreground">{plan.name}</h5>
                          </div>
                          <div>
                            <p className="text-xl font-bold text-primary">
                              {formatPrice(calculatePrice(plan.price, isYearly), isYearly)}
                            </p>
                            {isYearly && plan.price > 0 && (
                              <div className="mt-1">
                                <p className="text-xs text-muted-foreground line-through">
                                  {(plan.price * 12).toLocaleString('tr-TR')}₺/{t("admin.subscription.yearly").toLowerCase()}
                                </p>
                                <p className="text-xs text-green-600 font-medium">
                                  {t("admin.subscription.discounted")}
                                </p>
                              </div>
                            )}
                          </div>
                          <ul className="space-y-1">
                            {plan.features.slice(0, 3).map((feature, index) => (
                              <li key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
                                <CheckCircle2 className="h-3 w-3 text-primary flex-shrink-0" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                          <Button 
                            className="w-full bg-gradient-ocean hover:opacity-90" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlanChange(plan);
                            }}
                          >
                            {t("admin.subscription.switchToPlan")}
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Subscription History */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>{t("admin.subscription.transactionHistory")}</CardTitle>
              <CardDescription>
                {t("admin.subscription.historyDescription")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <History className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-foreground font-medium">Henüz işlem geçmişi yok</p>
              <p className="text-sm text-muted-foreground">
                Ödemeler, plan değişiklikleri ve diğer işlemler burada görünecek
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>İşlem</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>İşlem No</TableHead>
                  <TableHead className="text-right">Fatura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">
                      {format(new Date(item.created_at), "d MMM yyyy, HH:mm", { locale: tr })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getEventIcon(item.event_type)}
                        <span className="text-sm font-medium">
                          {eventTypeLabels[item.event_type] || item.event_type}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.plan_type ? (
                        <Badge variant="outline">
                          {planLabels[item.plan_type] || item.plan_type}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatAmount(item.amount, item.currency)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(item.status)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {item.transaction_id || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {/* Show download button only for successful payments */}
                      {(item.event_type === "payment_success" || 
                        item.event_type === "subscription_activated") && 
                        item.status === "success" && 
                        item.amount ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadInvoice(item)}
                          className="hover:bg-primary/10"
                        >
                          <Download className="h-4 w-4 text-primary" />
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-start gap-3 text-sm">
              <div className="flex-1 space-y-2">
                <p className="font-medium text-foreground">Fatura ve Dekont</p>
                <p className="text-muted-foreground">
                  Ödeme dekontlarınızı ve faturalarınızı email adresinize gönderiyoruz.
                  Geçmiş faturalar için destek ekibimizle iletişime geçebilirsiniz.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Confirmation Dialog */}
    <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Plan Değişikliğini Onayla</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Planınızı <strong>{currentPlan?.name}</strong> planından{" "}
              <strong>{selectedPlan?.name}</strong> planına değiştirmek istediğinize emin misiniz?
            </p>
            {selectedPlan && (
              <div className="p-3 rounded-lg bg-muted space-y-2">
                <p className="text-sm font-medium text-foreground">Yeni Plan Özellikleri:</p>
                <ul className="space-y-1">
                  {selectedPlan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-primary flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-2">
                  <p className="text-lg font-bold text-primary">
                    {formatPrice(calculatePrice(selectedPlan.price, isYearly), isYearly)}
                  </p>
                  {isYearly && selectedPlan.price > 0 && (
                    <p className="text-sm text-green-600 font-medium">
                      %10 indirim uygulanacak ({(selectedPlan.price * 12 * 0.1).toLocaleString('tr-TR')}₺ tasarruf)
                    </p>
                  )}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Plan değişikliği hemen aktif olacaktır. Fatura döneminiz değişmeden devam edecektir.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={changingPlan}>İptal</AlertDialogCancel>
          <AlertDialogAction 
            onClick={confirmPlanChange}
            disabled={changingPlan}
            className="bg-gradient-ocean hover:opacity-90"
          >
            {changingPlan ? "Değiştiriliyor..." : "Planı Değiştir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
};
