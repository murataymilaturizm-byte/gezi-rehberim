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
import { Plane, MessageSquare, BarChart3, Users, Shield, Zap, CheckCircle2, ArrowRight, Check, Star, Quote, TrendingUp, ArrowUp, Bot, Sparkles, Brain, Clock, Bell, TrendingUpIcon } from "lucide-react";
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

const Index = () => {
  const { t } = useTranslation();
  const sectionsRef = useRef<(HTMLElement | null)[]>([]);
  const [isYearly, setIsYearly] = useState(true);
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
      const yearlyPrice = basePrice * 12;
      const discountedPrice = yearlyPrice * 0.9; // %10 indirim
      return discountedPrice;
    }
    return basePrice;
  };

  const formatPrice = (priceStr: string, yearly: boolean) => {
    if (priceStr === t("pricing.custom")) return t("pricing.custom");
    const price = parseFloat(priceStr.replace(".", "").replace("€", "").replace(",", ""));
    if (isNaN(price)) return priceStr;
    
    const finalPrice = calculatePrice(price, yearly);
    return finalPrice.toLocaleString('tr-TR');
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
        t("pricing.enterprise.features.messages"),
        t("pricing.enterprise.features.unlimitedTours"),
        t("pricing.enterprise.features.allLanguages"),
        t("pricing.enterprise.features.customStyles"),
        t("pricing.enterprise.features.allFeatures"),
        t("pricing.enterprise.features.feedback"),
        t("pricing.enterprise.features.prioritySupport"),
        t("pricing.enterprise.features.customIntegration")
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
              <Button asChild variant="ghost" className="hidden md:inline-flex hover:scale-105 transition-transform duration-300">
                <a href="/yardim">{t("nav.help")}</a>
              </Button>
              <Button asChild variant="outline" className="hidden lg:inline-flex hover:scale-105 transition-transform duration-300">
                <a href="/nasil-baslarim">{t("nav.gettingStarted")}</a>
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
                <a href="/nasil-baslarim">{t("nav.gettingStarted")}</a>
              </Button>
            </div>
          </div>
        </div>
      </section>


      {/* Stats Section */}
      <section ref={(el) => (sectionsRef.current[1] = el)} className="py-16 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {stats.map((stat, index) => (
              <Card 
                key={index} 
                className="border-border/50 shadow-card text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group"
              >
                <CardContent className="p-6 space-y-2">
                  <stat.icon className={`w-8 h-8 ${stat.color} mx-auto transition-transform duration-300 group-hover:scale-110`} />
                  <div className="text-3xl md:text-4xl font-bold text-foreground">
                    {stat.value}
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {stat.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stat.subtext}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={(el) => (sectionsRef.current[2] = el)} className="py-20 bg-card/30 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("features.title")}
            </h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t("features.subtitle")}
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="border-border/50 shadow-card hover:shadow-xl transition-all duration-500 hover:-translate-y-2 bg-gradient-to-br from-card to-card/50 group cursor-pointer"
              >
                <CardContent className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-ocean flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <feature.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <h4 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors duration-300">{feature.title}</h4>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-sm font-semibold text-primary">{feature.metric}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section ref={(el) => (sectionsRef.current[3] = el)} className="py-20 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("benefits.title")}
            </h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t("benefits.subtitle")}
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {benefits.map((benefit, index) => (
              <Card key={index} className="border-border/50 shadow-card hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="space-y-2 flex-1">
                      <h4 className="text-lg font-bold text-foreground">{benefit.title}</h4>
                      <p className="text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section ref={(el) => (sectionsRef.current[4] = el)} className="py-20 bg-gradient-to-br from-secondary/5 to-primary/5 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("howItWorks.title")}
            </h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t("howItWorks.subtitle")}
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
            <Card className="border-border/50 shadow-card hover:shadow-lg transition-all duration-300 relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-ocean flex items-center justify-center text-primary-foreground font-bold text-xl shadow-lg">
                1
              </div>
              <CardContent className="p-6 pt-8 space-y-4">
                <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                  <MessageSquare className="w-7 h-7 text-primary" />
                </div>
                <h4 className="text-xl font-semibold text-foreground text-center">{t("howItWorks.step1.title")}</h4>
                <p className="text-muted-foreground text-center">
                  {t("howItWorks.step1.description")}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-card hover:shadow-lg transition-all duration-300 relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-ocean flex items-center justify-center text-primary-foreground font-bold text-xl shadow-lg">
                2
              </div>
              <CardContent className="p-6 pt-8 space-y-4">
                <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                  <Brain className="w-7 h-7 text-primary" />
                </div>
                <h4 className="text-xl font-semibold text-foreground text-center">{t("howItWorks.step2.title")}</h4>
                <p className="text-muted-foreground text-center">
                  {t("howItWorks.step2.description")}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-card hover:shadow-lg transition-all duration-300 relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-ocean flex items-center justify-center text-primary-foreground font-bold text-xl shadow-lg">
                3
              </div>
              <CardContent className="p-6 pt-8 space-y-4">
                <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7 text-primary" />
                </div>
                <h4 className="text-xl font-semibold text-foreground text-center">{t("howItWorks.step3.title")}</h4>
                <p className="text-muted-foreground text-center">
                  {t("howItWorks.step3.description")}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-16 text-center">
            <p className="text-lg text-muted-foreground mb-6">
              {t("howItWorks.footer")}
            </p>
            <Button size="lg" className="bg-gradient-ocean hover:opacity-90" onClick={scrollToDemo}>
              {t("howItWorks.demoButton")}
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section ref={(el) => (sectionsRef.current[5] = el)} className="py-20 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">{t("advanced.badge")}</span>
            </div>
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("advanced.title")}
            </h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t("advanced.subtitle")}
            </p>
          </div>

          <div className="max-w-6xl mx-auto space-y-12">
            {/* Intelligent User Profiles */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <Card className="border-border/50 shadow-card p-8 order-2 md:order-1">
                <CardContent className="p-0 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-ocean flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h4 className="text-2xl font-bold text-foreground">{t("advanced.userProfiles.title")}</h4>
                  <p className="text-muted-foreground">
                    {t("advanced.userProfiles.description")}
                  </p>
                  <div className="space-y-3 pt-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="text-sm text-foreground">{t("advanced.userProfiles.feature1")}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="text-sm text-foreground">{t("advanced.userProfiles.feature2")}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="text-sm text-foreground">{t("advanced.userProfiles.feature3")}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="hidden md:flex order-1 md:order-2 md:justify-center">
                <div className="w-full max-w-sm aspect-square bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl flex items-center justify-center">
                  <Users className="w-32 h-32 text-primary/40" />
                </div>
              </div>
            </div>

            {/* Conversation Analytics */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="hidden md:flex md:justify-center">
                <div className="w-full max-w-sm aspect-square bg-gradient-to-br from-secondary/20 to-primary/20 rounded-2xl flex items-center justify-center">
                  <BarChart3 className="w-32 h-32 text-secondary/40" />
                </div>
              </div>
              <Card className="border-border/50 shadow-card p-8">
                <CardContent className="p-0 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-ocean flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h4 className="text-2xl font-bold text-foreground">{t("advanced.analytics.title")}</h4>
                  <p className="text-muted-foreground">
                    {t("advanced.analytics.description")}
                  </p>
                  <div className="space-y-3 pt-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-secondary"></div>
                      <span className="text-sm text-foreground">{t("advanced.analytics.feature1")}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-secondary"></div>
                      <span className="text-sm text-foreground">{t("advanced.analytics.feature2")}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-secondary"></div>
                      <span className="text-sm text-foreground">{t("advanced.analytics.feature3")}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Auto Reminders */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <Card className="border-border/50 shadow-card p-8 order-2 md:order-1">
                <CardContent className="p-0 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-ocean flex items-center justify-center">
                    <Bell className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h4 className="text-2xl font-bold text-foreground">{t("advanced.reminders.title")}</h4>
                  <p className="text-muted-foreground">
                    {t("advanced.reminders.description")}
                  </p>
                  <div className="space-y-3 pt-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="text-sm text-foreground">{t("advanced.reminders.feature1")}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="text-sm text-foreground">{t("advanced.reminders.feature2")}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="text-sm text-foreground">{t("advanced.reminders.feature3")}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="hidden md:flex order-1 md:order-2 md:justify-center">
                <div className="w-full max-w-sm aspect-square bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl flex items-center justify-center">
                  <Bell className="w-32 h-32 text-primary/40" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section ref={(el) => (sectionsRef.current[6] = el)} className="py-20 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
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
                    <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-500/20">
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

          <div className="text-center mt-12">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>{t("advanced.stats")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section ref={(el) => {
        sectionsRef.current[7] = el;
        if (el) demoRef.current = el as HTMLDivElement;
      }} className="py-20 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/50 border border-border mb-4">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-accent-foreground">{t("demo.badge")}</span>
            </div>
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
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

      {/* Pricing Section */}
      <section ref={(el) => (sectionsRef.current[8] = el)} className="py-20 bg-card/30 opacity-0 translate-y-8 transition-all duration-700">
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
                <span className="ml-2 text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
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
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">
                        {formatPrice(plan.price, isYearly)}
                      </span>
                      <span className="text-muted-foreground">
                        {plan.price === t("pricing.custom") ? plan.period : isYearly ? "₺/yıl" : "₺/ay"}
                      </span>
                    </div>
                    {isYearly && plan.monthlyPrice > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground line-through">
                          {(plan.monthlyPrice * 12).toLocaleString('tr-TR')}₺/yıl
                        </p>
                        <p className="text-sm text-green-600 font-medium">
                          {(plan.monthlyPrice * 12 * 0.1).toLocaleString('tr-TR')}₺ {t("pricing.savings")}
                        </p>
                      </div>
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
                    <a href={`/auth?mode=signup&plan=${plan.name.toLowerCase().replace('ı', 'i')}&billing=${isYearly ? 'yearly' : 'monthly'}`}>
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
      <section ref={(el) => (sectionsRef.current[9] = el)} className="py-20 opacity-0 translate-y-8 transition-all duration-700">
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

      {/* CTA Section */}
      <section ref={(el) => (sectionsRef.current[10] = el)} className="py-20 relative overflow-hidden opacity-0 translate-y-8 transition-all duration-700">
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
      <footer className="border-t border-border/50 bg-card/50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-ocean flex items-center justify-center">
                <Plane className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground">TurzzAI</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="/nasil-baslarim" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("footer.gettingStarted")}
              </a>
              <a href="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("footer.login")}
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("footer.rights")}
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
