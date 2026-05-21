import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, Sparkles } from "lucide-react";
import { useCurrencyConverter } from "@/hooks/useCurrencyConverter";

// Dile göre varsayılan para birimi (frontend / edge ile tutarlı)
const LANG_TO_CURRENCY: Record<string, string> = {
  tr: "TRY", en: "USD", de: "EUR", fr: "EUR",
  es: "EUR", ru: "RUB", ar: "SAR",
};

const PLAN_PRICES_TRY = { starter: 2999, professional: 4999, enterprise: 7999 } as const;

interface PricingSectionProps {
  isYearly: boolean;
  setIsYearly: (yearly: boolean) => void;
}

export const PricingSection = ({ isYearly, setIsYearly }: PricingSectionProps) => {
  const { t, i18n } = useTranslation();
  const { convert, loading: ratesLoading } = useCurrencyConverter("USD");

  const calculatePrice = (basePrice: number, yearly: boolean) => {
    if (yearly && typeof basePrice === 'number' && !isNaN(basePrice)) {
      return basePrice * 12 * 0.9; // %10 yıllık indirim
    }
    return basePrice;
  };

  // Kullanıcının diline göre para birimi
  const userCurrency = LANG_TO_CURRENCY[i18n.language] || "USD";
  const showInUserCurrency = userCurrency !== "TRY";

  // Plan için gösterim fiyatı: kullanıcı diline göre otomatik dönüşüm
  const getPlanDisplayPrice = (planKey: keyof typeof PLAN_PRICES_TRY, yearly: boolean): string => {
    const baseTRY = PLAN_PRICES_TRY[planKey];
    const finalTRY = calculatePrice(baseTRY, yearly);

    if (!showInUserCurrency || ratesLoading) {
      return finalTRY.toLocaleString("tr-TR");
    }

    const converted = convert(finalTRY, "TRY", userCurrency);
    // Yuvarla: 0 ondalık (USD/EUR büyük fiyatlar için yeterli)
    return Math.round(converted).toLocaleString("en-US");
  };

  const getCurrencyUnit = (yearly: boolean): string => {
    const sym: Record<string, string> = {
      TRY: "₺", USD: "$", EUR: "€", SAR: "﷼", RUB: "₽", GBP: "£",
    };
    const s = sym[userCurrency] ?? userCurrency;
    const period = yearly ? (i18n.language === "tr" ? "/yıl" : "/yr") : (i18n.language === "tr" ? "/ay" : "/mo");
    return `${s}${period}`;
  };

  // Eski formatPrice — "custom" etiketi için hâlâ kullanılıyor
  const formatPrice = (priceStr: string, yearly: boolean) => {
    if (priceStr === t("pricing.custom")) return t("pricing.custom");
    const price = parseFloat(priceStr.replace(/[^\d]/g, ""));
    if (isNaN(price)) return priceStr;
    return calculatePrice(price, yearly).toLocaleString("tr-TR");
  };

  const pricingPlans = [
    {
      name: t("pricing.starter.name"),
      price: t("pricing.starter.price"),
      monthlyPrice: 2999,
      period: t("pricing.starter.period"),
      description: t("pricing.starter.description"),
      features: [
        t("pricing.starter.features.messages"),
        t("pricing.starter.features.tours"),
        t("pricing.starter.features.languages"),
        t("pricing.starter.features.style"),
        t("pricing.starter.features.basicFeatures")
      ],
      highlighted: false
    },
    {
      name: t("pricing.professional.name"),
      price: t("pricing.professional.price"),
      monthlyPrice: 4999,
      period: t("pricing.professional.period"),
      description: t("pricing.professional.description"),
      badge: t("pricing.professional.badge"),
      features: [
        t("pricing.professional.features.messages"),
        t("pricing.professional.features.tours"),
        t("pricing.professional.features.languages"),
        t("pricing.professional.features.allStyles"),
        t("pricing.professional.features.userProfiles"),
        t("pricing.professional.features.reminders"),
        t("pricing.professional.features.templates"),
        t("pricing.professional.features.followUps"),
        t("pricing.professional.features.analytics")
      ],
      highlighted: true
    },
    {
      name: t("pricing.enterprise.name"),
      price: t("pricing.enterprise.price"),
      monthlyPrice: 7999,
      period: t("pricing.enterprise.period"),
      description: t("pricing.enterprise.description"),
      features: [
        t("pricing.enterprise.features.allProFeatures"),
        t("pricing.enterprise.features.messages"),
        t("pricing.enterprise.features.allLanguages"),
        t("pricing.enterprise.features.customStyles"),
        t("pricing.enterprise.features.feedback"),
        t("pricing.enterprise.features.prioritySupport"),
        t("pricing.enterprise.features.multiAgency"),
        t("pricing.enterprise.features.apiAccess"),
        t("pricing.enterprise.features.paymentCollection")
      ],
      highlighted: false
    }
  ];

  return (
    <div className="container mx-auto px-4">
      <div className="text-center mb-8">
        <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4">
          {t("pricing.title")}
        </h3>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
          {t("pricing.subtitle")}
        </p>

        {/* 14 Days Free Trial Banner */}
        <div className="mb-6">
          <a
            href="/auth?mode=signup"
            className="inline-flex items-center gap-2 px-4 sm:px-6 py-3 rounded-full bg-gradient-ocean text-primary-foreground mb-4 animate-pulse hover:opacity-90 transition-opacity cursor-pointer min-h-[48px]"
          >
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-base sm:text-lg font-bold">{t("pricing.trial")}</span>
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </a>
        </div>

        {/* Billing Period Toggle */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4 bg-card rounded-lg w-fit mx-auto border border-border">
          <Label htmlFor="landing-billing-toggle" className={`cursor-pointer ${!isYearly ? "font-semibold" : "text-muted-foreground"}`}>
            {t("pricing.monthly")}
          </Label>
          <Switch
            id="landing-billing-toggle"
            checked={isYearly}
            onCheckedChange={setIsYearly}
          />
          <Label htmlFor="landing-billing-toggle" className={`cursor-pointer ${isYearly ? "font-semibold" : "text-muted-foreground"}`}>
            {t("pricing.yearly")}
          </Label>
          {isYearly && (
            <span className="text-xs sm:text-sm bg-success/10 text-success dark:text-success-foreground px-2 sm:px-3 py-1 rounded-full font-medium border border-success/20">
              {t("pricing.save")}
            </span>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto">
        {pricingPlans.map((plan, index) => (
          <Card
            key={index}
            className={`border-border/50 shadow-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${
              plan.highlighted ? 'ring-2 ring-primary relative' : ''
            }`}
          >
            {plan.highlighted && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <Badge className="bg-gradient-ocean text-primary-foreground px-4 py-1">
                  {t("pricing.mostPopular")}
                </Badge>
              </div>
            )}
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <h4 className="text-2xl font-bold text-foreground">{plan.name}</h4>
                <p className="text-muted-foreground text-sm">{plan.description}</p>
              </div>

              <div>
                {plan.price === t("pricing.custom") ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">{t("pricing.custom")}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">
                        {getPlanDisplayPrice(
                          plan.name === t("pricing.starter.name")
                            ? "starter"
                            : plan.name === t("pricing.professional.name")
                              ? "professional"
                              : "enterprise",
                          isYearly,
                        )}
                      </span>
                      <span className="text-muted-foreground">{getCurrencyUnit(isYearly)}</span>
                    </div>
                    {/* TRY dışındaki para birimlerinde TL karşılığını göster */}
                    {showInUserCurrency && plan.monthlyPrice > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ≈ ₺{calculatePrice(plan.monthlyPrice, isYearly).toLocaleString("tr-TR")}
                      </p>
                    )}
                    {isYearly && plan.monthlyPrice > 0 && (
                      <div className="mt-1">
                        <p className="text-sm text-success font-medium">
                          {t("pricing.savings")}: {showInUserCurrency
                            ? `${Math.round(convert(plan.monthlyPrice * 12 * 0.1, "TRY", userCurrency)).toLocaleString("en-US")} ${userCurrency}`
                            : `${(plan.monthlyPrice * 12 * 0.1).toLocaleString("tr-TR")}₺`
                          }
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <Button
                className={`w-full ${
                  plan.highlighted
                    ? 'bg-gradient-ocean hover:opacity-90'
                    : 'bg-secondary hover:opacity-90'
                }`}
                asChild
              >
                <a
                  href={
                    plan.name === t("pricing.enterprise.name")
                      ? "mailto:info@turzzai.com?subject=Kurumsal%20Plan%20Talebi"
                      : `/auth?mode=signup&plan=${plan.name.toLowerCase().replace('ı', 'i')}&billing=${isYearly ? 'yearly' : 'monthly'}`
                  }
                  target={plan.name === t("pricing.enterprise.name") ? undefined : undefined}
                >
                  {plan.name === t("pricing.enterprise.name") ? t("pricing.cta.contact") : t("pricing.cta.start")}
                </a>
              </Button>

              <div className="space-y-3 pt-4 border-t border-border">
                {plan.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center mt-12">
        <p className="text-muted-foreground">
          {t("pricing.trialNote")}
        </p>
      </div>
    </div>
  );
};
