import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plane, MessageSquare, BarChart3, Users, Shield, Zap, CheckCircle2, ArrowRight, Check, Star, Quote, TrendingUp, ArrowUp, Bot, Sparkles, Brain, Clock, Bell, TrendingUpIcon, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DemoChat } from "@/components/DemoChat";
import { supabase } from "@/integrations/supabase/client";
import turzzLogo from "@/assets/turzz-logo-orange.png";
import { useToast } from "@/hooks/use-toast";
import { SalesChatWidget } from "@/components/SalesChatWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { contactFormSchema, checkRateLimit, sanitizeHtml } from "@/utils/validation";
import { IndexBlogSection } from "@/components/IndexBlogSection";
import { useCurrencyConverter } from "@/hooks/useCurrencyConverter";

// Dile göre varsayılan para birimi (frontend / edge ile tutarlı)
const LANG_TO_CURRENCY: Record<string, string> = {
  tr: "TRY", en: "USD", de: "EUR", fr: "EUR",
  es: "EUR", ru: "RUB", ar: "SAR",
};

const PLAN_PRICES_TRY = { starter: 2999, professional: 4999, enterprise: 7999 } as const;

const Index = () => {
  const { t, i18n } = useTranslation();
  const sectionsRef = useRef<(HTMLElement | null)[]>([]);
  const [isYearly, setIsYearly] = useState(true);
  const { convert, convertAndFormat, loading: ratesLoading } = useCurrencyConverter("USD");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const demoRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  const scrollToDemo = () => {
    demoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observers = sectionsRef.current.map((section, index) => {
      if (!section) return null;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("animate-fade-in");
              entry.target.classList.remove("opacity-0", "translate-y-8");
            }
          });
        },
        { threshold: 0.1 }
      );

      observer.observe(section);
      return observer;
    });

    return () => {
      observers.forEach((observer) => observer?.disconnect());
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const features = [
    {
      icon: MessageSquare,
      title: t("features.whatsapp.title"),
      description: t("features.whatsapp.description"),
      metric: t("features.whatsapp.metric")
    },
    {
      icon: TrendingUp,
      title: t("features.analytics.title"),
      description: t("features.analytics.description"),
      metric: t("features.analytics.metric")
    },
    {
      icon: Users,
      title: t("features.multi.title"),
      description: t("features.multi.description"),
      metric: t("features.multi.metric")
    },
    {
      icon: CheckCircle2,
      title: t("features.reservation.title"),
      description: t("features.reservation.description"),
      metric: t("features.reservation.metric")
    },
    {
      icon: Bell,
      title: t("features.reminders.title"),
      description: t("features.reminders.description"),
      metric: t("features.reminders.metric")
    },
    {
      icon: Shield,
      title: t("features.payment.title"),
      description: t("features.payment.description"),
      metric: t("features.payment.metric")
    }
  ];

  const benefits = [
    {
      icon: Clock,
      title: t("benefits.timeSaving.title"),
      description: t("benefits.timeSaving.description")
    },
    {
      icon: TrendingUpIcon,
      title: t("benefits.moreSales.title"),
      description: t("benefits.moreSales.description")
    },
    {
      icon: Brain,
      title: t("benefits.customerTracking.title"),
      description: t("benefits.customerTracking.description")
    },
    {
      icon: CheckCircle2,
      title: t("benefits.roi.title"),
      description: t("benefits.roi.description")
    }
  ];

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

  const testimonials = [
    {
      name: t("testimonials.items.yasinCetin.name"),
      company: t("testimonials.items.yasinCetin.company"),
      role: t("testimonials.items.yasinCetin.role"),
      content: t("testimonials.items.yasinCetin.content"),
      rating: 5,
      result: t("testimonials.items.yasinCetin.result")
    },
    {
      name: t("testimonials.items.sitkiOgrak.name"),
      company: t("testimonials.items.sitkiOgrak.company"),
      role: t("testimonials.items.sitkiOgrak.role"),
      content: t("testimonials.items.sitkiOgrak.content"),
      rating: 5,
      result: t("testimonials.items.sitkiOgrak.result")
    },
    {
      name: t("testimonials.items.mustafaGulmez.name"),
      company: t("testimonials.items.mustafaGulmez.company"),
      role: t("testimonials.items.mustafaGulmez.role"),
      content: t("testimonials.items.mustafaGulmez.content"),
      rating: 5,
      result: t("testimonials.items.mustafaGulmez.result")
    }
  ];

  const stats = [
    {
      icon: TrendingUp,
      value: t("stats.salesIncrease.value"),
      label: t("stats.salesIncrease.label"),
      color: "text-primary",
      subtext: t("stats.salesIncrease.subtext")
    },
    {
      icon: Clock,
      value: t("stats.timeSaved.value"),
      label: t("stats.timeSaved.label"),
      color: "text-secondary",
      subtext: t("stats.timeSaved.subtext")
    },
    {
      icon: MessageSquare,
      value: t("stats.availability.value"),
      label: t("stats.availability.label"),
      color: "text-primary",
      subtext: t("stats.availability.subtext")
    },
    {
      icon: Users,
      value: t("stats.paymentTime.value"),
      label: t("stats.paymentTime.label"),
      color: "text-secondary",
      subtext: t("stats.paymentTime.subtext")
    }
  ];

  const faqs = [
    {
      question: t("faq.items.salesIncrease.question"),
      answer: t("faq.items.salesIncrease.answer")
    },
    {
      question: t("faq.items.setup.question"),
      answer: t("faq.items.setup.answer")
    },
    {
      question: t("faq.items.whatsappCost.question"),
      answer: t("faq.items.whatsappCost.answer")
    },
    {
      question: t("faq.items.payment.question"),
      answer: t("faq.items.payment.answer")
    },
    {
      question: t("faq.items.tourLimit.question"),
      answer: t("faq.items.tourLimit.answer")
    },
    {
      question: t("faq.items.cancellation.question"),
      answer: t("faq.items.cancellation.answer")
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Turzz AI - Seyahat Acenteleri için WhatsApp Chatbot"
        description="WhatsApp üzerinden 7/24 otomatik tur satışı. 7 dil desteği, AI destekli rezervasyon asistanı. 14 gün ücretsiz deneyin."
        canonical="/"
      />
      {/* Header */}
      <header className="border-b border-border/50 bg-card/95 backdrop-blur-lg sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={turzzLogo} alt="Turzz Logo" className="h-14 sm:h-16 w-auto transition-transform duration-300 hover:scale-105" />
              <div className="hidden sm:block">
                <p className="text-sm text-muted-foreground">{t("hero.subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <LanguageSelector />
              <ThemeToggle />
              <a href="/whatsapp-chatbot-seyahat-acentesi" className="hidden lg:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
                Özellikler
              </a>
              <a href="/karsilastir/turzz-vs-manuel-whatsapp" className="hidden lg:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
                Karşılaştır
              </a>
              <a href="/blog" className="hidden lg:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
                Blog
              </a>
              <Button asChild variant="ghost" className="hidden md:inline-flex hover:scale-105 transition-transform duration-300">
                <a href="/yardim">{t("nav.help")}</a>
              </Button>
              <Button asChild className="bg-gradient-ocean hover:opacity-90 transition-all duration-300 hover:scale-105">
                <a href="/auth">{t("auth.login")}</a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section ref={(el) => (sectionsRef.current[0] = el)} className="relative overflow-hidden py-20 md:py-32 opacity-0 translate-y-8 transition-all duration-700">
        <div className="absolute inset-0 bg-gradient-hero opacity-10"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/50 border border-border mb-4">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-accent-foreground">{t("hero.title")}</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
              {t("hero.subtitle")} <br />
              <span className="bg-gradient-ocean bg-clip-text text-transparent">{t("hero.highlight")}</span>
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              {t("hero.description")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" className="bg-gradient-ocean hover:opacity-90 transition-all duration-300 hover:scale-105 text-lg px-8" asChild>
                <a href="/auth?mode=signup">
                  {t("hero.cta")}
                  <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 transition-all duration-300 hover:scale-105" onClick={scrollToDemo}>
                {t("hero.demo")}
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 transition-all duration-300 hover:scale-105" asChild>
                <a href="/whatsapp-chatbot-seyahat-acentesi">Özelliklerimizi Keşfet</a>
              </Button>
            </div>
          </div>
        </div>
      </section>


      {/* Features Section - Horizontal cards with accent left border */}
      <section ref={(el) => (sectionsRef.current[1] = el)} className="py-16 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              {t("features.title")}
            </h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t("features.subtitle")}
            </p>
          </div>
          
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-4 items-stretch">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-start gap-5 p-5 rounded-xl border border-border/50 bg-card hover:shadow-lg transition-all duration-300 hover:border-primary/30 group h-full"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-ocean flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform duration-300 group-hover:scale-110">
                  <feature.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{feature.description}</p>
                  <Badge className="hidden sm:inline-flex mt-2 bg-primary/10 text-primary border-primary/20">
                    {feature.metric}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section - Timeline style */}
      <section ref={(el) => (sectionsRef.current[2] = el)} className="py-16 bg-card/50 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              {t("howItWorks.title")}
            </h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t("howItWorks.subtitle")}
            </p>
          </div>

          <div className="max-w-3xl mx-auto relative">
            {/* Vertical line */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-border hidden md:block" />
            
            {[
              { icon: MessageSquare, step: 1, title: t("howItWorks.step1.title"), desc: t("howItWorks.step1.description") },
              { icon: Brain, step: 2, title: t("howItWorks.step2.title"), desc: t("howItWorks.step2.description") },
              { icon: CheckCircle2, step: 3, title: t("howItWorks.step3.title"), desc: t("howItWorks.step3.description") },
            ].map((item, index) => (
              <div key={index} className={`flex items-start gap-4 mb-8 last:mb-0 md:w-1/2 ${index % 2 === 0 ? 'md:pr-10 md:ml-0' : 'md:pl-10 md:ml-auto'}`}>
                <div className="md:hidden w-12 h-12 rounded-full bg-gradient-ocean flex items-center justify-center text-primary-foreground font-bold text-lg flex-shrink-0 shadow-md">
                  {item.step}
                </div>
                <div className={`hidden md:flex absolute left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-gradient-ocean items-center justify-center text-primary-foreground font-bold shadow-md`} style={{ top: `${index * 96 + 8}px` }}>
                  {item.step}
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-lg font-bold text-foreground">{item.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Button size="lg" className="bg-gradient-ocean hover:opacity-90" onClick={scrollToDemo}>
              {t("howItWorks.demoButton")}
            </Button>
          </div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section ref={(el) => {
        sectionsRef.current[3] = el;
        if (el) demoRef.current = el as HTMLDivElement;
      }} className="py-16 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/50 border border-border mb-3">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-accent-foreground">{t("demo.badge")}</span>
            </div>
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              {t("demo.title")}
            </h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t("demo.subtitle")}
            </p>
          </div>

          <DemoChat />

          <div className="text-center mt-8">
            <p className="text-sm text-muted-foreground mb-4">
              {t("demo.note")}
            </p>
            <Button size="lg" className="bg-gradient-ocean hover:opacity-90" asChild>
              <a href="/auth?mode=signup">
                {t("demo.cta")}
                <ArrowRight className="w-5 h-5 ml-2" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section ref={(el) => (sectionsRef.current[4] = el)} className="py-16 bg-card/50 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              {t("testimonials.title")}
            </h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t("testimonials.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-border/50 shadow-card hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-card to-card/50">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <Quote className="w-10 h-10 text-primary/20" />
                    <Badge variant="secondary" className="bg-success/10 text-success dark:text-success-foreground border-success/20">
                      {testimonial.result}
                    </Badge>
                  </div>
                  
                  <div className="flex gap-1">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-secondary text-secondary" />
                    ))}
                  </div>

                  <p className="text-foreground leading-relaxed">
                    "{testimonial.content}"
                  </p>

                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-ocean flex items-center justify-center">
                        <span className="text-lg font-semibold text-primary-foreground">
                          {testimonial.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{testimonial.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {testimonial.role}, {testimonial.company}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-10">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>{t("advanced.stats")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section ref={(el) => (sectionsRef.current[5] = el)} className="py-20 bg-card/30 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("pricing.title")}
            </h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-6">
              {t("pricing.subtitle")}
            </p>
            
            {/* 14 Days Free Trial Banner */}
            <div className="mb-6">
              <a 
                href="/auth?mode=signup"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-ocean text-primary-foreground mb-4 animate-pulse hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Sparkles className="w-5 h-5" />
                <span className="text-lg font-bold">{t("pricing.trial")}</span>
                <Sparkles className="w-5 h-5" />
              </a>
            </div>

            {/* Billing Period Toggle */}
            <div className="flex items-center justify-center gap-3 p-4 bg-card rounded-lg w-fit mx-auto border border-border">
              <Label htmlFor="landing-billing-toggle" className={!isYearly ? "font-semibold" : "text-muted-foreground"}>
                {t("pricing.monthly")}
              </Label>
              <Switch
                id="landing-billing-toggle"
                checked={isYearly}
                onCheckedChange={setIsYearly}
              />
              <Label htmlFor="landing-billing-toggle" className={isYearly ? "font-semibold" : "text-muted-foreground"}>
                {t("pricing.yearly")}
              </Label>
              {isYearly && (
                <span className="ml-2 text-sm bg-success/10 text-success dark:text-success-foreground px-3 py-1 rounded-full font-medium border border-success/20">
                  {t("pricing.save")}
                </span>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
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
                      En Popüler
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
      </section>

      {/* FAQ Section */}
      <section ref={(el) => (sectionsRef.current[6] = el)} className="py-20 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                {t("faq.title")}
              </h3>
              <p className="text-muted-foreground text-lg">
                {t("faq.subtitle")}
              </p>
            </div>

            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="border border-border/50 rounded-lg px-6 bg-card shadow-sm"
                >
                  <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline py-4">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-4">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="text-center mt-8">
              <p className="text-muted-foreground mb-4">
                {t("contact.question")}
              </p>
            </div>

            {/* Contact Form */}
            <Card className="mt-8 border-border/50 shadow-card max-w-2xl mx-auto">
              <CardContent className="p-8">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  
                  // Rate limiting check (max 3 submissions per 10 minutes)
                  if (!checkRateLimit('contact_form', 3, 10 * 60 * 1000)) {
                    toast({
                      title: "⚠️ Çok Fazla Deneme",
                      description: "Lütfen 10 dakika sonra tekrar deneyin. Spam koruması aktif.",
                      variant: "destructive"
                    });
                    return;
                  }
                  
                  setIsSubmittingForm(true);

                  try {
                    const formData = new FormData(e.currentTarget);
                    const data = {
                      name: formData.get('name') as string,
                      email: formData.get('email') as string,
                      message: formData.get('message') as string
                    };

                    // Validate form data with enhanced security
                    const validatedData = contactFormSchema.parse(data);

                    // Additional XSS protection - sanitize message content
                    const sanitizedMessage = sanitizeHtml(validatedData.message);

                    // Save to Supabase
                    const { error } = await supabase
                      .from('contact_forms')
                      .insert({
                        name: validatedData.name,
                        email: validatedData.email,
                        message: sanitizedMessage,
                        status: 'new'
                      });

                    if (error) throw error;

                    toast({
                      title: t("contact.successTitle"),
                      description: t("contact.successMessage"),
                    });

                    // Reset form
                    (e.target as HTMLFormElement).reset();
                  } catch (error) {
                    if (error instanceof Error && 'errors' in error) {
                      // Zod validation error
                      const zodError = error as any;
                      toast({
                        title: t("contact.formErrorTitle"),
                        description: zodError.errors[0]?.message || "Form doğrulama hatası",
                        variant: "destructive"
                      });
                    } else {
                      console.error('Contact form error:', error);
                      toast({
                        title: t("contact.errorTitle"),
                        description: t("contact.errorMessage"),
                        variant: "destructive"
                      });
                    }
                  } finally {
                    setIsSubmittingForm(false);
                  }
                }} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-foreground">{t("contact.nameLabel")}</Label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      maxLength={100}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder={t("contact.namePlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground">{t("contact.emailLabel")}</Label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      maxLength={255}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder={t("contact.emailPlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-foreground">{t("contact.messageLabel")}</Label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      maxLength={1000}
                      rows={4}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      placeholder={t("contact.messagePlaceholder")}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-ocean hover:opacity-90"
                    disabled={isSubmittingForm}
                  >
                    {isSubmittingForm ? t("contact.sending") : t("contact.sendButton")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Özellikler Section ───────────────────────────────────── */}
      <section id="ozellikler" className="py-20 bg-card/30">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Acentenize Özel Çözümler</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              WhatsApp üzerinden satış, rezervasyon ve müşteri hizmetini tek platformda yönetin.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: MessageSquare,
                title: "WhatsApp Business Chatbot",
                desc: "Müşteri mesajlarını 7/24 otomatik yanıtlayın. Gece 2'de gelen sorulara bile anında cevap.",
                href: "/whatsapp-chatbot-seyahat-acentesi",
                color: "text-green-500",
                bg: "bg-green-500/10",
              },
              {
                icon: Brain,
                title: "AI Destekli Rezervasyon",
                desc: "Yapay zeka tarih, kişi, isim ve telefon bilgilerini adım adım toplayarak otomatik rezervasyon oluşturur.",
                href: "/ai-tur-rezervasyonu",
                color: "text-purple-500",
                bg: "bg-purple-500/10",
              },
              {
                icon: Globe,
                title: "7 Dilde Müşteri Hizmetleri",
                desc: "Alman, Rus, Arap turist kendi dilinde yazar, chatbot aynı dilde yanıt verir. Çevirmen gerekmez.",
                href: "/cok-dilli-musteri-hizmetleri",
                color: "text-blue-500",
                bg: "bg-blue-500/10",
              },
              {
                icon: Zap,
                title: "Otomatik Tur Yönetimi",
                desc: "Kontenjan takibi, tur hatırlatıcıları, müşteri segmentasyonu — hepsi otomatik.",
                href: "/tur-otomasyonu",
                color: "text-orange-500",
                bg: "bg-orange-500/10",
              },
            ].map((item) => (
              <Card
                key={item.href}
                className="border-border/50 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 group cursor-pointer"
                onClick={() => window.location.href = item.href}
              >
                <CardContent className="p-6 flex flex-col h-full">
                  <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <item.icon className={`w-6 h-6 ${item.color}`} />
                  </div>
                  <h3 className="font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{item.title}</h3>
                  <p className="text-sm text-muted-foreground flex-1">{item.desc}</p>
                  <a href={item.href} className={`text-sm ${item.color} mt-4 inline-flex items-center gap-1 hover:underline font-medium`}>
                    Detaylı bilgi <ArrowRight className="w-3 h-3" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Çözümler Section ──────────────────────────────────────── */}
      <section id="cozumler" className="py-20">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Sektöre Özel Çözümler</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Her acente tipine uygun özelleştirilmiş yapılar.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: TrendingUp,
                title: "İncoming Acenteler",
                desc: "Yabancı turistlere 7 dilde, 7/24 hizmet. Kültürel hassasiyetle, anında yanıt.",
                bullets: ["Almanca, Rusça, Arapça otomatik", "Saat farkı sorun değil — 7/24 aktif", "Yabancı turist pazarına direkt erişim"],
                href: "/cozum/incoming-acenteler",
                color: "text-teal-500",
                bg: "from-teal-500/10 to-teal-500/5",
              },
              {
                icon: Clock,
                title: "Günübirlik Tur Operatörleri",
                desc: "Hızlı rezervasyon, son dakika satışları, dinamik kontenjan yönetimi.",
                bullets: ["Anlık yer sorgulama ve rezervasyon", "Son dakika doluluğu otomatik kapanır", "Gece satışlarını da kaçırmayın"],
                href: "/cozum/gunubirlik-tur",
                color: "text-yellow-500",
                bg: "from-yellow-500/10 to-yellow-500/5",
              },
              {
                icon: Star,
                title: "Butik Acenteler",
                desc: "Kişisel dokunuş + modern teknoloji. Küçük bütçeyle büyük şirket görünümü.",
                bullets: ["2.999₺/ay'dan başlayan paket", "Kurulum 5-10 dakika", "1 çalışan maliyetinin %20'si"],
                href: "/cozum/butik-acenteler",
                color: "text-pink-500",
                bg: "from-pink-500/10 to-pink-500/5",
              },
            ].map((item) => (
              <Card key={item.href} className={`border-border/50 bg-gradient-to-b ${item.bg} hover:shadow-lg hover:-translate-y-1 transition-all duration-300`}>
                <CardContent className="p-7 flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <item.icon className={`w-8 h-8 ${item.color}`} />
                    <h3 className="font-bold text-foreground text-lg">{item.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{item.desc}</p>
                  <ul className="space-y-2 flex-1">
                    {item.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-foreground/80">
                        <CheckCircle2 className={`w-4 h-4 ${item.color} flex-shrink-0 mt-0.5`} />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <a href={item.href} className={`text-sm ${item.color} mt-5 inline-flex items-center gap-1 hover:underline font-medium`}>
                    Daha fazla <ArrowRight className="w-3 h-3" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Blog Section ──────────────────────────────────────────── */}
      <IndexBlogSection />

      {/* CTA Section */}
      <section ref={(el) => (sectionsRef.current[7] = el)} className="py-20 relative overflow-hidden opacity-0 translate-y-8 transition-all duration-700">
        <div className="absolute inset-0 bg-gradient-ocean opacity-5"></div>
        <div className="container mx-auto px-4 relative z-10">
          <Card className="max-w-4xl mx-auto border-border/50 shadow-card bg-gradient-to-br from-card to-accent/10">
            <CardContent className="p-12 text-center space-y-6">
              <h3 className="text-3xl md:text-4xl font-bold text-foreground">
                {t("cta.title")}
              </h3>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t("cta.subtitle")}
              </p>
              <Button size="lg" className="bg-gradient-ocean hover:opacity-90 text-lg px-8" asChild>
                <a href="/auth?mode=signup">
                  {t("cta.button")}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/50 py-12 pb-24 md:pb-12">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Ürün */}
            <div>
              <h4 className="font-semibold text-foreground text-sm mb-3 uppercase tracking-wider">Ürün</h4>
              <ul className="space-y-2">
                {[
                  { href: "/whatsapp-chatbot-seyahat-acentesi", label: "WhatsApp Chatbot" },
                  { href: "/ai-tur-rezervasyonu", label: "AI Tur Rezervasyonu" },
                  { href: "/cok-dilli-musteri-hizmetleri", label: "Çok Dilli Hizmet" },
                  { href: "/tur-otomasyonu", label: "Tur Otomasyonu" },
                ].map((item) => (
                  <li key={item.href}>
                    <a href={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            {/* Çözümler */}
            <div>
              <h4 className="font-semibold text-foreground text-sm mb-3 uppercase tracking-wider">Çözümler</h4>
              <ul className="space-y-2">
                {[
                  { href: "/cozum/incoming-acenteler", label: "İncoming Acenteler" },
                  { href: "/cozum/gunubirlik-tur", label: "Günübirlik Tur" },
                  { href: "/cozum/butik-acenteler", label: "Butik Acenteler" },
                  { href: "/karsilastir/turzz-vs-manuel-whatsapp", label: "Karşılaştırma" },
                ].map((item) => (
                  <li key={item.href}>
                    <a href={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            {/* Şirket */}
            <div>
              <h4 className="font-semibold text-foreground text-sm mb-3 uppercase tracking-wider">Şirket</h4>
              <ul className="space-y-2">
                {[
                  { href: "/#hakkimizda", label: "Hakkımızda" },
                  { href: "mailto:info@turzzai.com", label: "İletişim" },
                  { href: "/privacy-policy", label: "KVKK Politikası" },
                  { href: "/terms-of-service", label: "Kullanım Koşulları" },
                ].map((item) => (
                  <li key={item.href}>
                    <a href={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            {/* Kaynaklar */}
            <div>
              <h4 className="font-semibold text-foreground text-sm mb-3 uppercase tracking-wider">Kaynaklar</h4>
              <ul className="space-y-2">
                {[
                  { href: "/blog", label: "Blog" },
                  { href: "/yardim", label: "Yardım Merkezi" },
                  { href: "/nasil-baslarim", label: "Nasıl Başlarım?" },
                  { href: "/auth?mode=signup", label: "Demo İste" },
                ].map((item) => (
                  <li key={item.href}>
                    <a href={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <img src={turzzLogo} alt="Turzz AI" className="h-8 w-auto" />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              © {new Date().getFullYear()} Turzz AI. Tüm hakları saklıdır.
            </p>
          </div>
        </div>
      </footer>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-40 w-12 h-12 rounded-full bg-gradient-ocean hover:opacity-90 shadow-elegant hover:shadow-glow animate-fade-in transition-all duration-300 hover:scale-110 group"
          size="icon"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-5 h-5 transition-transform duration-300 group-hover:-translate-y-1" />
        </Button>
      )}

      {/* Sales Chat Widget */}
      <SalesChatWidget />
    </div>
  );
};

export default Index;
