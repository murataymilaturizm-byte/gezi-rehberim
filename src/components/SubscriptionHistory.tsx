import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
// Madde 2: Dile göre para birimi dönüşümü (PricingSection ile aynı pattern)
import { useCurrencyConverter } from "@/hooks/useCurrencyConverter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LemonSqueezyButton } from "./LemonSqueezyButton";
// Sorun 2: ek-kota satın alma — Dashboard ile aynı bileşen.
import { ExtraQuotaPurchase } from "./ExtraQuotaPurchase";
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
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";

const DATE_LOCALE_MAP = { tr, en: enUS, de, ru, ar, fr, es };
import { generateInvoicePDF } from "@/utils/invoiceGenerator";
import { clearPlanFeaturesCache } from "@/utils/planFeatures";
import { BankTransferDialog } from "./BankTransferDialog";
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
  Building2,
  Landmark,
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
  lemonsqueezy_customer_id?: string | null;
  /**
   * Sorun 1: DB-driven faturalama periyodu. Hero card bu değere göre fiyat gösterir,
   * ekrandaki isYearly toggle'a değil. LS webhook variant_id'den okuyarak buraya yazacak
   * (LS bağlantısı sonra). Default: 'monthly'.
   */
  billing_cycle?: 'monthly' | 'yearly';
  message_limit?: number | null;
}

interface PlanOption {
  id: "starter" | "professional" | "enterprise";
  name: string;
  price: number;
  features: string[];
  icon: any;
  popular?: boolean;
}

// ─── PlanCard ────────────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: PlanOption;
  isCurrentPlan: boolean;
  isYearly: boolean;
  /** compact = the "other plans" row inside an active subscription */
  compact?: boolean;
  /** If provided, show LemonSqueezy subscribe button */
  agencyId?: string | null;
  userEmail?: string;
  /** If provided, show "switch" button (active-sub flow) */
  onSwitch?: (plan: PlanOption) => void;
  onBankTransfer?: (plan: PlanOption) => void;
  formatPrice: (price: number | null | undefined, yearly: boolean) => string;
  calculatePrice: (base: number | null | undefined, yearly: boolean) => number;
  // i18next t() signature — defaultValue + interpolation options destekler
  t: (key: string, options?: any) => string;
}

function PlanCard({
  plan,
  isCurrentPlan,
  isYearly,
  compact = false,
  agencyId,
  userEmail,
  onSwitch,
  onBankTransfer,
  formatPrice,
  calculatePrice,
  t,
}: PlanCardProps) {
  const IconComp = plan.icon;
  const displayedFeatures = compact ? plan.features.slice(0, 3) : plan.features;

  // Köklü tasarım: landing PricingSection kalitesinde — gradient, glow, scale,
  // premium typography. compact mode (mevcut sub'da diğer planlar) için sade.
  // h-full + flex-col: kartlar yan yana aynı yüksekte, CTA butonu altta hizalı.
  return (
    <Card
      className={[
        "relative overflow-hidden h-full flex flex-col motion-safe:transition-all motion-safe:duration-300",
        // Popüler plan: glow + ring + scale + premium gradient
        plan.popular && !compact
          ? "ring-2 ring-primary shadow-2xl shadow-primary/30 lg:scale-[1.04] z-10"
          : "border-border",
        // Mevcut plan: yeşil ring + success bg
        isCurrentPlan ? "ring-2 ring-success shadow-lg shadow-success/20 bg-success/5" : "",
        // Hover lift (popüler ve mevcut hariç — onlar zaten vurgulu)
        !plan.popular && !isCurrentPlan ? "motion-safe:hover:shadow-xl motion-safe:hover:-translate-y-1 motion-safe:hover:border-primary/40" : "",
        onSwitch ? "cursor-pointer motion-safe:hover:scale-[1.02]" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onSwitch ? () => onSwitch(plan) : undefined}
    >
      {/* Popüler için arka plan gradient blur — premium his */}
      {plan.popular && !compact && (
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/8 via-transparent to-secondary/8 pointer-events-none" aria-hidden />
      )}

      {/* Popüler badge */}
      {plan.popular && !compact && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
          <Badge className="bg-gradient-ocean text-primary-foreground shadow-md font-semibold px-3 py-1 motion-safe:animate-glow-pulse">
            ⭐ {t("admin.subscription.popular")}
          </Badge>
        </div>
      )}

      {/* Mevcut plan badge */}
      {isCurrentPlan && (
        <div className="absolute -top-3 right-3 z-20">
          <Badge className="bg-success text-success-foreground shadow-md font-semibold px-3 py-1">
            ✓ {t("admin.subscription.currentPlan")}
          </Badge>
        </div>
      )}

      {/* flex-1 + flex-col: features esnek alan, CTA mt-auto ile alta sabit */}
      <CardContent className={[
        "flex-1 flex flex-col",
        compact ? "p-4 space-y-3" : "p-6 sm:p-7 space-y-5",
      ].join(" ")}>
        {/* Header — Icon kutusunda + plan adı premium */}
        <div className="flex items-center gap-2.5">
          <div className={[
            "rounded-lg p-2 flex items-center justify-center shrink-0",
            plan.popular ? "bg-gradient-ocean text-white shadow-md" : "bg-primary/10 text-primary",
          ].join(" ")}>
            <IconComp className={compact ? "h-4 w-4" : "h-5 w-5"} />
          </div>
          <h5 className={[
            "font-bold text-foreground leading-tight",
            compact ? "text-base" : "text-xl",
          ].join(" ")}>
            {plan.name}
          </h5>
        </div>

        {/* Madde 2: Enterprise için sabit fiyat YOK — "İletişime Geçin".
            Firmaya özel fiyatlandırma; LemonSqueezy üzerinden self-service değil. */}
        {plan.id === "enterprise" ? (
          <div className="space-y-1">
            <p className={[
              "font-bold tracking-tight",
              "bg-gradient-ocean bg-clip-text text-transparent",
              compact ? "text-lg" : "text-2xl",
            ].join(" ")}>
              {t("pricing.contactForPricing", { defaultValue: "İletişime Geçin" })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("pricing.contactForPricingHint", { defaultValue: "Firmaya özel fiyatlandırma" })}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className={[
              "font-bold tracking-tight",
              plan.popular && !compact
                ? "bg-gradient-ocean bg-clip-text text-transparent"
                : "text-foreground",
              compact ? "text-2xl" : "text-4xl",
            ].join(" ")}>
              {formatPrice(calculatePrice(plan.price, isYearly), isYearly)}
            </p>
            {isYearly && plan.price > 0 && (
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground line-through">
                  {(plan.price * 12).toLocaleString()}/{t("admin.subscription.yearly").toLowerCase()}
                </p>
                <p className="text-xs text-success font-semibold flex items-center gap-1">
                  💰 {t("admin.subscription.discounted")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Features — flex-1 ile esner, CTA hep altta hizalı kalır */}
        <ul className={[
          "flex-1",
          compact ? "space-y-1.5" : "space-y-2.5",
        ].join(" ")}>
          {displayedFeatures.map((feature, index) => (
            <li
              key={index}
              className={[
                "flex items-start gap-2 leading-snug",
                compact ? "text-xs" : "text-sm",
                "text-foreground/80",
              ].join(" ")}
            >
              <CheckCircle2
                className={[
                  "shrink-0 mt-0.5 text-success",
                  compact ? "h-3.5 w-3.5" : "h-4 w-4",
                ].join(" ")}
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA — mt-auto: kart yüksekliği farklı olsa bile buton ALTTA hizalı.
            popüler için gradient ocean (landing CTA stiliyle aynı).
            Madde 2: Enterprise için LemonSqueezy yerine iletişim CTA (mailto). */}
        {plan.id === "enterprise" && !onSwitch && (
          <div className="mt-auto pt-2">
            <Button asChild className="w-full bg-gradient-ocean hover:opacity-90">
              {/* POS-yok dönemi: mailto yerine landing iletişim formuna scroll (FaqSection #contact). */}
              <a href="/#contact">
                {t("pricing.cta.contact", { defaultValue: "İletişime Geç" })}
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </div>
        )}
        {plan.id !== "enterprise" && agencyId && !onSwitch && (
          <div className="mt-auto pt-2">
            <LemonSqueezyButton
              planId={plan.id}
              isYearly={isYearly}
              agencyId={agencyId}
              userEmail={userEmail ?? ""}
              label={t("admin.subscription.subscribe")}
              className={[
                "w-full motion-safe:transition-all motion-safe:duration-200",
                plan.popular ? "bg-gradient-ocean hover:opacity-90 text-primary-foreground shadow-md" : "",
              ].join(" ")}
            />
            {/* P5-2a (2026-07-28): Havale/EFT manuel-ödeme — BankTransferDialog açar.
                PayTR-hazırlık: kart-butonu bilinçli YOK (çalışmayan buton koyma). */}
            {onBankTransfer && (
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={(e) => { e.stopPropagation(); onBankTransfer(plan); }}
              >
                <Landmark className="h-4 w-4 mr-2" />
                {t("bankTransfer.payByTransfer")}
              </Button>
            )}
          </div>
        )}
        {!agencyId && !onSwitch && (
          <div className="mt-auto pt-2">
            <Alert className="border-primary/20">
              <Building2 className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {t("subscription.needAgencyInfo")}
              </AlertDescription>
            </Alert>
          </div>
        )}
        {onSwitch && plan.id === "enterprise" && (
          // POS-yok dönemi: Enterprise her halükarda iletişim formuna scroll.
          <Button asChild className="w-full bg-gradient-ocean hover:opacity-90 mt-auto" size="sm">
            <a href="/#contact" onClick={(e) => e.stopPropagation()}>
              {t("pricing.cta.contact", { defaultValue: "İletişime Geç" })}
              <ArrowRight className="h-4 w-4 ml-2" />
            </a>
          </Button>
        )}
        {onSwitch && plan.id !== "enterprise" && (
          // POS-DISABLED: "Bu plana geç" da iletişim formuna yönlendiriliyor.
          // POS gelince onSwitch(plan) çağrısı (handlePlanChange) yeniden açılacak.
          <Button
            asChild
            className="w-full bg-gradient-ocean hover:opacity-90 mt-auto"
            size="sm"
          >
            <a href="/#contact" onClick={(e) => e.stopPropagation()}>
              {t("pricing.cta.contact", { defaultValue: "İletişime Geç" })}
              <ArrowRight className="h-4 w-4 ml-2" />
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

// Madde 2: Dile göre varsayılan para birimi (PricingSection ile aynı tablo)
const LANG_TO_CURRENCY: Record<string, string> = {
  tr: "TRY", en: "USD", de: "EUR", fr: "EUR",
  es: "EUR", ru: "RUB", ar: "SAR",
};
const CURRENCY_SYM: Record<string, string> = {
  TRY: "₺", USD: "$", EUR: "€", SAR: "﷼", RUB: "₽", GBP: "£",
};

export const SubscriptionHistory = () => {
  const { t, i18n } = useTranslation();
  // Madde 2: Plan fiyatlarını kullanıcı diline göre dönüştür (Dashboard ile tutarlı).
  // LemonSqueezy TRY tahsil eder (gerçek tahsilat TL) — ama GÖSTERİM dile göre döner.
  const { convert, loading: ratesLoading } = useCurrencyConverter("USD");
  const _userLang = i18n.language || "tr";
  const _userCurrency = LANG_TO_CURRENCY[_userLang] || "USD";
  const _showInUserCurrency = _userCurrency !== "TRY";
  const { toast } = useToast();
  const dateLocale =
    DATE_LOCALE_MAP[i18n.language as keyof typeof DATE_LOCALE_MAP] || tr;

  const eventTypeLabels: Record<string, string> = {
    trial_started: t("admin.subscription.eventTypes.trial_started"),
    trial_ended: t("admin.subscription.eventTypes.trial_ended"),
    payment_success: t("admin.subscription.eventTypes.payment_success"),
    payment_failed: t("admin.subscription.eventTypes.payment_failed"),
    plan_changed: t("admin.subscription.eventTypes.plan_changed"),
    subscription_activated: t(
      "admin.subscription.eventTypes.subscription_activated"
    ),
    subscription_expired: t(
      "admin.subscription.eventTypes.subscription_expired"
    ),
    subscription_cancelled: t(
      "admin.subscription.eventTypes.subscription_cancelled"
    ),
  };

  const statusLabels: Record<string, string> = {
    success: t("admin.subscription.status.success"),
    failed: t("admin.subscription.status.failed"),
    pending: t("admin.subscription.status.pending"),
    cancelled: t("admin.subscription.status.cancelled"),
  };

  const planLabels: Record<string, string> = {
    starter: t("admin.agency.plans.starter"),
    professional: t("admin.agency.plans.professional"),
    enterprise: t("admin.agency.plans.enterprise"),
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "trial_started":
      case "subscription_activated":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "payment_success":
        return <CreditCard className="h-4 w-4 text-success" />;
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
        return (
          <Badge variant="default" className="bg-success text-success-foreground">
            {statusLabels[status]}
          </Badge>
        );
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
  const [subscription, setSubscription] = useState<AgencySubscription | null>(
    null
  );
  const [changingPlan, setChangingPlan] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [isYearly, setIsYearly] = useState(false);
  // P5-2a: havale-dialog hedef planı
  const [bankPlan, setBankPlan] = useState<PlanOption | null>(null);

  const planOptions: PlanOption[] = [
    {
      id: "starter",
      name: t("admin.agency.plans.starter"),
      price: 3999,
      features: (
        t("admin.subscription.plans.starter.features", {
          returnObjects: true,
        }) as string[]
      ),
      icon: Zap,
    },
    {
      id: "professional",
      name: t("admin.agency.plans.professional"),
      price: 5999,
      features: (
        t("admin.subscription.plans.professional.features", {
          returnObjects: true,
        }) as string[]
      ),
      icon: TrendingUp,
      popular: true,
    },
    {
      id: "enterprise",
      name: t("admin.agency.plans.enterprise"),
      price: 7999,
      features: (
        t("admin.subscription.plans.enterprise.features", {
          returnObjects: true,
        }) as string[]
      ),
      icon: Crown,
    },
  ];

  const calculatePrice = (
    basePrice: number | null | undefined,
    yearly: boolean
  ) => {
    const price = basePrice || 0;
    if (yearly && price > 0) {
      return price * 12 * 0.9;
    }
    return price;
  };

  // Madde 2: formatPrice — TRY tabanlı plan fiyatını kullanıcı diline göre döndür.
  // Kurlar yüklenmediyse TRY göster (PricingSection'da aynı davranış).
  const formatPrice = (
    price: number | null | undefined,
    yearly: boolean
  ) => {
    const safePrice = price || 0;
    if (safePrice === 0) return t("admin.subscription.customPrice");
    const suffix = yearly
      ? `/${t("admin.subscription.yearly").toLowerCase()}`
      : `/${t("admin.subscription.monthly").toLowerCase()}`;

    // TRY veya kurlar henüz yüklenmemiş → kullanıcı diline TRY göster
    if (!_showInUserCurrency || ratesLoading) {
      const _formatted = safePrice.toLocaleString(_userLang);
      return `${_formatted}₺${suffix}`;
    }
    // Diğer para birimlerinde göster (USD/EUR/RUB/SAR vb.)
    const _converted = Math.round(convert(safePrice, "TRY", _userCurrency));
    const _formatted = _converted.toLocaleString("en-US");
    const _sym = CURRENCY_SYM[_userCurrency] ?? _userCurrency;
    return `${_formatted}${_sym}${suffix}`;
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email ?? "");

      const { data: agencyData, error: agencyError } = await supabase
        .from("agencies")
        .select(
          // Sorun 1: billing_cycle eklendi (hero card DB-driven fiyat için)
          // Sorun 2: message_limit eklendi (ExtraQuotaPurchase görünürlük koşulu için)
          "id, plan_type, trial_ends_at, subscription_status, subscription_ends_at, name, lemonsqueezy_customer_id, billing_cycle, message_limit"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (agencyError) throw agencyError;

      if (agencyData) {
        setAgencyId(agencyData.id);
        setSubscription(agencyData);

        const { data: historyData, error: historyError } = await supabase
          .from("subscription_history")
          .select("*")
          .eq("agency_id", agencyData.id)
          .order("created_at", { ascending: false });

        if (historyError) throw historyError;
        setHistory(historyData || []);
      }
    } catch (error) {
      console.error("Error loading subscription history:", error);
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (item: SubscriptionHistoryItem) => {
    if (!subscription) return;

    try {
      const invoiceNumber = item.transaction_id
        ? `TRZ-${item.transaction_id.substring(0, 8).toUpperCase()}`
        : `TRZ-${item.id.substring(0, 8).toUpperCase()}`;

      const planNames: Record<string, string> = {
        starter: t("admin.agency.plans.starter"),
        professional: t("admin.agency.plans.professional"),
        enterprise: t("admin.agency.plans.enterprise"),
      };

      // Sorun 3: subscription.name zaten loadHistory'de yüklü (line 74 select'inde 'name').
      // Ekstra agency name re-query KALDIRILDI — gereksiz round-trip.

      generateInvoicePDF({
        invoiceNumber,
        transactionId: item.transaction_id || item.id.substring(0, 12),
        date: item.created_at,
        agencyName: subscription.name || t("admin.logs.agency"),
        planName: item.plan_type ? planNames[item.plan_type] : "Standart",
        amount: item.amount || 0,
        currency: item.currency || "TRY",
        paymentMethod:
          item.payment_method || t("admin.subscription.paymentMethod"),
      });

      toast({
        title: t("common.successTitle"),
        description: t("admin.subscription.invoiceDownloaded"),
      });
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast({
        title: t("common.error"),
        description: t("subscription.invoiceError"),
        variant: "destructive",
      });
    }
  };

  const formatAmount = (amount: number | null, currency: string | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat(i18n.language || "tr-TR", {
      style: "currency",
      currency: currency || "TRY",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleManageSubscription = async () => {
    if (!agencyId) return;
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "lemonsqueezy-portal",
        { body: { agencyId } }
      );
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else {
        throw new Error("Portal URL alınamadı");
      }
    } catch (err: any) {
      toast({
        title: t("common.error"),
        description: err.message || t("subscription.portalError"),
        variant: "destructive",
      });
    } finally {
      setLoadingPortal(false);
    }
  };

  const handlePlanChange = (plan: PlanOption) => {
    if (!subscription) return;

    if (subscription.subscription_status === "trial") {
      toast({
        title: t("common.warning"),
        description: t("subscription.trialChangeError"),
        variant: "destructive",
      });
      return;
    }

    if (
      subscription.subscription_status === "expired" ||
      subscription.subscription_status === "cancelled"
    ) {
      toast({
        title: t("common.warning"),
        description: t("subscription.inactiveError"),
        variant: "destructive",
      });
      return;
    }

    if (plan.id === subscription.plan_type) {
      toast({
        title: t("common.success"),
        description: t("subscription.sameplanError"),
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
      const { error: updateError } = await supabase
        .from("agencies")
        .update({ plan_type: selectedPlan.id })
        .eq("id", agencyId);

      if (updateError) throw updateError;

      const { error: historyError } = await supabase
        .from("subscription_history")
        .insert({
          agency_id: agencyId,
          event_type: "plan_changed",
          plan_type: selectedPlan.id,
          status: "success",
          notes: t("admin.subscription.planChangedNote", {
            from: subscription?.plan_type,
            to: selectedPlan.id,
          }),
        });

      if (historyError) throw historyError;

      // K2 fix: plan özellikleri cache'ini temizle — yeni limit/style/feature anında etkili
      clearPlanFeaturesCache();
      // whatsapp-webhook her istekte agency'i fresh okuyor (cache yok),
      // demo-chat ise plan_type kullanmıyor — frontend cache temizliği yeterli

      toast({
        title: t("common.successTitle"),
        description: t("subscription.planChanged"),
      });

      loadHistory();
      setConfirmDialogOpen(false);
      setSelectedPlan(null);
    } catch (error: any) {
      console.error("Error changing plan:", error);
      toast({
        title: t("common.error"),
        description: t("subscription.planChangeError"),
        variant: "destructive",
      });
    } finally {
      setChangingPlan(false);
    }
  };

  const getRemainingDays = () => {
    if (!subscription) return null;
    const targetDate =
      subscription.subscription_status === "trial"
        ? subscription.trial_ends_at
        : subscription.subscription_ends_at;
    if (!targetDate) return null;
    return differenceInDays(new Date(targetDate), new Date());
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t("admin.subscription.loading")}
      </div>
    );
  }

  const remainingDays = getRemainingDays();
  const currentPlan = planOptions.find(
    (p) => p.id === subscription?.plan_type
  );
  // Sorun 1c: Hero card için DB-driven faturalama periyodu.
  // Ekrandaki isYearly state'i ASLA hero card'ı etkilemez — sadece "Diğer Planlar" grid'ini.
  const isSubscriptionYearly = subscription?.billing_cycle === 'yearly';
  // Sorun 1f: Trial veya henüz aktif olmayan abonelikte fiyat göstermek yanıltıcı —
  // "Deneme sürümü" gösterimi kullanılır, billing_cycle değerine bakılmaz.
  const isTrialOrInactive =
    subscription?.subscription_status === 'trial' ||
    subscription?.subscription_status === 'expired' ||
    subscription?.subscription_status === 'cancelled';

  // Shared billing period toggle
  const BillingToggle = ({ id }: { id: string }) => (
    <div className="flex items-center justify-center gap-3 p-4 bg-muted/50 rounded-lg w-fit mx-auto">
      <Label
        htmlFor={id}
        className={!isYearly ? "font-semibold" : "text-muted-foreground"}
      >
        {t("admin.subscription.monthly")}
      </Label>
      <Switch id={id} checked={isYearly} onCheckedChange={setIsYearly} />
      <Label
        htmlFor={id}
        className={isYearly ? "font-semibold" : "text-muted-foreground"}
      >
        {t("admin.subscription.yearly")}
      </Label>
      {isYearly && (
        <span className="ml-2 text-sm bg-success/10 text-success px-2 py-1 rounded-full font-medium">
          {t("admin.subscription.discount10")}
        </span>
      )}
    </div>
  );

  return (
    <>
      {/* ── No subscription: show plan selection ─────────────────────────── */}
      {!subscription && (
        <Card className="shadow-card mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>{t("subscription.planTitle")}</CardTitle>
                <CardDescription>{t("subscription.noPlan")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <BillingToggle id="billing-toggle-no-sub" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 pt-3 px-1">
              {planOptions.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isCurrentPlan={false}
                  isYearly={isYearly}
                  agencyId={agencyId}
                  userEmail={userEmail}
                  onBankTransfer={(p) => setBankPlan(p)}
                  formatPrice={formatPrice}
                  calculatePrice={calculatePrice}
                  t={t}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Has subscription ──────────────────────────────────────────────── */}
      {subscription && (
        <Card className="shadow-card mb-6">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {currentPlan?.icon && (
                  <currentPlan.icon className="h-5 w-5 text-primary" />
                )}
                <div>
                  <CardTitle>{t("admin.subscription.currentPlan")}</CardTitle>
                  <CardDescription>
                    {subscription.subscription_status === "trial"
                      ? t("admin.subscription.inTrialPeriod")
                      : subscription.subscription_status === "active"
                      ? t("admin.subscription.activeSubscription")
                      : t("admin.subscription.subscriptionStatus") +
                        " " +
                        subscription.subscription_status}
                  </CardDescription>
                </div>
              </div>
              {remainingDays !== null && remainingDays > 0 && (
                <Badge
                  variant={remainingDays <= 7 ? "destructive" : "secondary"}
                  className={
                    remainingDays <= 7
                      ? "animate-pulse text-sm px-3 py-1"
                      : "text-sm px-3 py-1"
                  }
                >
                  {remainingDays} {t("admin.subscription.daysRemaining")}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sorun 1c: BillingToggle hero card'tan KALDIRILDI — artık her grid'in
                üstünde ayrı ayrı görünüyor. Hero card sabit, DB-driven. */}

            {/* Current plan HERO — landing kalitesinde premium özet kart.
                Sorun 1c: fiyat/periyot ekrandaki isYearly state'inden DEĞİL,
                subscription.billing_cycle DB değerinden okunur. */}
            <div className="relative overflow-hidden rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-7 shadow-lg">
              {/* Decorative blob (subtle premium feel) */}
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" aria-hidden />

              <div className="relative flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                  {/* Büyük ikon kutusu */}
                  {currentPlan?.icon && (
                    <div className="rounded-xl p-3 bg-gradient-ocean text-white shadow-md shrink-0">
                      <currentPlan.icon className="h-6 w-6 sm:h-7 sm:w-7" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                      {t("admin.subscription.currentPlan")}
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                      {currentPlan?.name}
                    </h3>

                    {/* Sorun 1f: TRIAL/expired/cancelled → fiyat göstermek yanıltıcı.
                        "Deneme sürümü — henüz aktif abonelik yok" gösterimi. */}
                    {isTrialOrInactive ? (
                      <p className="text-sm text-muted-foreground mt-2 leading-snug">
                        {subscription.subscription_status === 'trial'
                          ? t("admin.subscription.trialNoActive", { defaultValue: "Deneme sürümü — henüz aktif abonelik yok" })
                          : t("admin.subscription.subscriptionInactive", { defaultValue: "Abonelik aktif değil" })}
                      </p>
                    ) : (
                      <>
                        {/* Sorun 1c: DB-driven fiyat — isSubscriptionYearly = subscription.billing_cycle === 'yearly' */}
                        <p className="text-2xl sm:text-3xl font-bold bg-gradient-ocean bg-clip-text text-transparent mt-2 leading-none">
                          {currentPlan &&
                            formatPrice(calculatePrice(currentPlan.price, isSubscriptionYearly), isSubscriptionYearly)}
                        </p>

                        {/* Sorun 1d: Faturalama periyodu rozeti (DB-driven, 7 dil) */}
                        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
                          <Calendar className="h-3 w-3" />
                          {t("admin.subscription.billingCycle", { defaultValue: "Faturalama" })}:{" "}
                          {isSubscriptionYearly
                            ? t("admin.subscription.yearly")
                            : t("admin.subscription.monthly")}
                        </div>

                        {isSubscriptionYearly && currentPlan && currentPlan.price > 0 && (
                          <div className="mt-2 space-y-0.5">
                            <p className="text-xs text-muted-foreground line-through">
                              {(currentPlan.price * 12).toLocaleString(i18n.language || "tr")}₺/{t("admin.subscription.yearly").toLowerCase()}
                            </p>
                            <p className="text-xs text-success font-semibold flex items-center gap-1">
                              💰 {t("admin.subscription.discounted")} — {(currentPlan.price * 12 * 0.1).toLocaleString(i18n.language || "tr")}₺ {t("admin.subscription.savings")}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  <CheckCircle2 className="h-7 w-7 sm:h-9 sm:w-9 text-success" />
                </div>
              </div>

              {/* Features — yatay grid (geniş ekranda 2 sütun, mobile 1 sütun) */}
              <ul className="relative mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                {currentPlan?.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-foreground/90">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    <span className="leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Manage subscription (LemonSqueezy customers only) */}
            {subscription.subscription_status === "active" &&
              subscription.lemonsqueezy_customer_id && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManageSubscription}
                    disabled={loadingPortal}
                  >
                    {loadingPortal
                      ? t("admin.subscription.loading")
                      : t("admin.subscription.renewSubscription") + " →"}
                  </Button>
                </div>
              )}

            {/* Sorun 2: Ek-kota satın alma — Dashboard ile aynı bileşen, Planım'da da var.
                Bileşen kendi içinde "active + sınırlı plan" koşulunu kontrol eder; aksi halde null. */}
            <ExtraQuotaPurchase
              agencyId={agencyId}
              userEmail={userEmail}
              messageLimit={Number(subscription.message_limit ?? 0)}
              subscriptionStatus={subscription.subscription_status}
            />


            {/* Trial / expired / cancelled: show all plans with payment */}
            {(subscription.subscription_status === "trial" ||
              subscription.subscription_status === "expired" ||
              subscription.subscription_status === "cancelled") && (
              <div className="space-y-4">
                <Alert className="border-primary/50 bg-primary/5">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  <AlertDescription>
                    {subscription.subscription_status === "trial" && (
                      <>
                        <strong>{t("admin.subscription.trialPeriod")}:</strong>{" "}
                        {t("admin.subscription.trialWarning").replace(
                          "Deneme Süresi: ",
                          ""
                        )}
                      </>
                    )}
                    {(subscription.subscription_status === "expired" ||
                      subscription.subscription_status === "cancelled") && (
                      <>
                        <strong>{t("admin.subscription.expired")}:</strong>{" "}
                        {t("admin.subscription.expiredMessage")}
                      </>
                    )}
                  </AlertDescription>
                </Alert>

                {/* Sorun 1e: Toggle bu grid'in ÜSTÜNDE — kapsamı net (sadece bu planlar). */}
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground text-center">
                    {t("admin.subscription.toggleHint", { defaultValue: "Yeni plan için faturalama periyodu seçin:" })}
                  </p>
                  <BillingToggle id="billing-toggle-trial" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 pt-3 px-1">
                  {planOptions.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      isCurrentPlan={plan.id === subscription.plan_type}
                      isYearly={isYearly}
                      agencyId={agencyId}
                      userEmail={userEmail}
                      onBankTransfer={(p) => setBankPlan(p)}
                      formatPrice={formatPrice}
                      calculatePrice={calculatePrice}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Active subscription: show other plans for switching */}
            {subscription.subscription_status === "active" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-semibold text-foreground">
                    {t("admin.subscription.availablePlans")}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {t("admin.subscription.planChangeNote").split(".")[0]}
                  </p>
                </div>
                {/* Sorun 1e: Toggle "Diğer Planlar" grid'inin ÜSTÜNDE — sadece bu grid'i etkiler.
                    Hero card (mevcut plan) toggle değişiminden ETKİLENMEZ. */}
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground text-center">
                    {t("admin.subscription.toggleHint", { defaultValue: "Yeni plan için faturalama periyodu seçin:" })}
                  </p>
                  <BillingToggle id="billing-toggle-active" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 pt-3 px-1">
                  {planOptions
                    .filter((plan) => plan.id !== subscription.plan_type)
                    .map((plan) => (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        isCurrentPlan={false}
                        isYearly={isYearly}
                        compact
                        onSwitch={handlePlanChange}
                        formatPrice={formatPrice}
                        calculatePrice={calculatePrice}
                        t={t}
                      />
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Transaction history ───────────────────────────────────────────── */}
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
                <p className="text-foreground font-medium">
                  {t("admin.subscription.noTransactionsYet")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("admin.subscription.firstTransactionHint")}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.subscription.date")}</TableHead>
                    <TableHead>{t("admin.subscription.event")}</TableHead>
                    <TableHead>{t("admin.subscription.plan")}</TableHead>
                    <TableHead>{t("admin.subscription.amount")}</TableHead>
                    <TableHead>{t("admin.subscription.subscriptionStatus").replace(":", "")}</TableHead>
                    <TableHead>{t("admin.subscription.method")}</TableHead>
                    <TableHead className="text-right">
                      {t("admin.subscription.invoice")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm">
                        {format(new Date(item.created_at), "d MMM yyyy, HH:mm", {
                          locale: dateLocale,
                        })}
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
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">
                        {item.transaction_id || "-"}
                      </TableCell>
                      <TableCell className="text-right">
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
                  <p className="font-medium text-foreground">
                    {t("admin.subscription.invoiceInfo")}
                  </p>
                  <p className="text-muted-foreground">
                    {t("admin.subscription.invoiceDescription")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Plan change confirmation dialog ──────────────────────────────── */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.subscription.confirmPlanChange")}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {t("admin.subscription.confirmChangeDescription", {
                  currentPlan: currentPlan?.name,
                  newPlan: selectedPlan?.name,
                })}
              </p>
              {selectedPlan && (
                <div className="p-3 rounded-lg bg-muted space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {t("admin.subscription.newPlanFeatures")}
                  </p>
                  <ul className="space-y-1">
                    {selectedPlan.features.map((feature, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2">
                    <p className="text-lg font-bold text-primary">
                      {formatPrice(
                        calculatePrice(selectedPlan.price, isYearly),
                        isYearly
                      )}
                    </p>
                    {isYearly && selectedPlan.price > 0 && (
                      <p className="text-sm text-success font-medium">
                        {t("admin.subscription.discountWillApply", {
                          amount: (
                            selectedPlan.price *
                            12 *
                            0.1
                          ).toLocaleString(i18n.language || "tr"),
                        })}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {t("admin.subscription.planChangeNote")}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changingPlan}>
              {t("admin.subscription.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPlanChange}
              disabled={changingPlan}
              className="bg-gradient-ocean hover:opacity-90"
            >
              {changingPlan
                ? t("admin.subscription.changing")
                : t("admin.subscription.changePlan")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* P5-2a: Havale/EFT ödeme dialogu */}
      <BankTransferDialog
        open={!!bankPlan}
        onOpenChange={(v) => { if (!v) setBankPlan(null); }}
        agencyId={agencyId}
        plan={bankPlan?.id || "starter"}
        period={isYearly ? "yearly" : "monthly"}
        amount={bankPlan ? calculatePrice(bankPlan.price, isYearly) : null}
      />
    </>
  );
};
