import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plane, MessageSquare, BarChart3, Users, Shield, Zap, CheckCircle2, ArrowRight, Check, Star, Quote, TrendingUp, ArrowUp, Bot, Sparkles, Brain, Clock, Bell, TrendingUpIcon, Globe, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { DemoChat } from "@/components/DemoChat";
import turzzLogo from "@/assets/turzz-logo-orange.png";
import { SalesChatWidget } from "@/components/SalesChatWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { IndexBlogSection } from "@/components/IndexBlogSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { FooterSection } from "@/components/landing/FooterSection";
import { StatsRibbon } from "@/components/landing/StatsRibbon";

const Index = () => {
  const { t } = useTranslation();
  const sectionsRef = useRef<(HTMLElement | null)[]>([]);
  const [isYearly, setIsYearly] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const demoRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SEOHead
        title="Turzz AI - Seyahat Acenteleri için WhatsApp Chatbot"
        description="WhatsApp üzerinden 7/24 otomatik tur satışı. 7 dil desteği, AI destekli rezervasyon asistanı. 14 gün ücretsiz deneyin."
        canonical="/"
      />
      {/* Header */}
      <header className="border-b border-border/50 bg-card/95 backdrop-blur-lg sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <img src={turzzLogo} alt="Turzz Logo" className="h-10 sm:h-14 md:h-16 w-auto transition-transform duration-300 hover:scale-105" />
              <div className="hidden sm:block">
                <p className="text-sm text-muted-foreground">{t("hero.subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <LanguageSelector />
              <ThemeToggle />
              <a href="/whatsapp-chatbot-seyahat-acentesi" className="hidden lg:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
                {t("nav.features")}
              </a>
              <a href="/karsilastir/turzz-vs-manuel-whatsapp" className="hidden lg:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
                {t("nav.compare")}
              </a>
              <a href="/blog" className="hidden lg:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
                {t("nav.blog")}
              </a>
              <Button asChild variant="ghost" className="hidden md:inline-flex hover:scale-105 transition-transform duration-300">
                <a href="/yardim">{t("nav.help")}</a>
              </Button>
              <Button asChild size="sm" className="bg-gradient-ocean hover:opacity-90 transition-all duration-300 hover:scale-105 sm:size-default">
                <a href="/auth">{t("auth.login")}</a>
              </Button>

              {/* Mobile hamburger menu (lg altı) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("nav.menu", "Menü")}>
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <a href="/whatsapp-chatbot-seyahat-acentesi">{t("nav.features")}</a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/karsilastir/turzz-vs-manuel-whatsapp">{t("nav.compare")}</a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/blog">{t("nav.blog")}</a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="md:hidden">
                    <a href="/yardim">{t("nav.help")}</a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section
          Mobile padding (py-10 sm:py-16) korundu — kullanıcı bozma talimatı.
          Masaüstünde üst boşluğu kompaktlaştırıldı: md/lg'de pt küçük, pb makul. */}
      <section ref={(el) => (sectionsRef.current[0] = el)} className="relative overflow-hidden py-10 sm:py-16 md:pt-10 md:pb-20 lg:pt-12 lg:pb-20 opacity-0 translate-y-8 transition-all duration-700">
        <HeroSection onDemoClick={scrollToDemo} />
      </section>

      {/* Stats Ribbon — Hero altı sosyal kanıt şeridi */}
      <section className="pb-12 -mt-8 relative z-10">
        <StatsRibbon />
      </section>

      {/* Features Section - Horizontal cards with accent left border */}
      <section ref={(el) => (sectionsRef.current[1] = el)} className="py-16 opacity-0 translate-y-8 transition-all duration-700">
        <FeaturesSection />
      </section>

      {/* How It Works Section - Timeline style */}
      <section ref={(el) => (sectionsRef.current[2] = el)} className="py-16 bg-card/50 opacity-0 translate-y-8 transition-all duration-700">
        <HowItWorksSection onDemoClick={scrollToDemo} />
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
                <ArrowRight className="w-5 h-5 ms-2 rtl:rotate-180" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section ref={(el) => (sectionsRef.current[4] = el)} className="py-16 bg-card/50 opacity-0 translate-y-8 transition-all duration-700">
        <TestimonialsSection />
      </section>

      {/* Pricing Section */}
      <section id="pricing" ref={(el) => (sectionsRef.current[5] = el)} className="py-20 bg-card/30 opacity-0 translate-y-8 transition-all duration-700 scroll-mt-20">
        <PricingSection isYearly={isYearly} setIsYearly={setIsYearly} />
      </section>

      {/* FAQ Section */}
      <section ref={(el) => (sectionsRef.current[6] = el)} className="py-20 opacity-0 translate-y-8 transition-all duration-700">
        <FaqSection />
      </section>

      {/* ── Detaylı Rehberler Section ───────────────────────────────── */}
      <section id="ozellikler" className="py-20 bg-card/30">
        <div className="container mx-auto px-4 max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{t("indexFeatures.title")}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("indexFeatures.subtitle")}
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: MessageSquare, title: t("indexFeatures.whatsapp.title"), desc: t("indexFeatures.whatsapp.desc"), href: "/whatsapp-chatbot-seyahat-acentesi", color: "text-green-500", bg: "bg-green-500/10" },
              { icon: Brain, title: t("indexFeatures.ai.title"), desc: t("indexFeatures.ai.desc"), href: "/ai-tur-rezervasyonu", color: "text-purple-500", bg: "bg-purple-500/10" },
              { icon: Globe, title: t("indexFeatures.multilingual.title"), desc: t("indexFeatures.multilingual.desc"), href: "/cok-dilli-musteri-hizmetleri", color: "text-blue-500", bg: "bg-blue-500/10" },
              { icon: Zap, title: t("indexFeatures.automation.title"), desc: t("indexFeatures.automation.desc"), href: "/tur-otomasyonu", color: "text-orange-500", bg: "bg-orange-500/10" },
            ].map((item, idx) => (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: idx * 0.07, ease: "easeOut" }}
                whileHover={{ y: -4 }}
              >
                <Card
                  className="relative border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300 group cursor-pointer h-full"
                  onClick={() => window.location.href = item.href}
                >
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 group-hover:shadow-md`}>
                      <item.icon className={`w-6 h-6 ${item.color}`} />
                    </div>
                    <h3 className="font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{item.title}</h3>
                    <p className="text-sm text-muted-foreground flex-1">{item.desc}</p>
                    <a href={item.href} className={`text-sm ${item.color} mt-4 inline-flex items-center gap-1 hover:underline font-medium`}>
                      {t("cta.learnMore")} <ArrowRight className="w-3 h-3 rtl:rotate-180 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                    </a>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Çözümler Section (segmentler) ───────────────────────────── */}
      <section id="cozumler" className="py-20">
        <div className="container mx-auto px-4 max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{t("indexSolutions.title")}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("indexSolutions.subtitle")}
            </p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: TrendingUp, title: t("indexSolutions.incoming.title"), desc: t("indexSolutions.incoming.desc"), bullets: t("indexSolutions.incoming.bullets", { returnObjects: true }) as string[], href: "/cozum/incoming-acenteler", color: "text-teal-500", bg: "from-teal-500/10 to-teal-500/5", ring: "hover:ring-teal-500/30" },
              { icon: Clock, title: t("indexSolutions.dayTour.title"), desc: t("indexSolutions.dayTour.desc"), bullets: t("indexSolutions.dayTour.bullets", { returnObjects: true }) as string[], href: "/cozum/gunubirlik-tur", color: "text-yellow-500", bg: "from-yellow-500/10 to-yellow-500/5", ring: "hover:ring-yellow-500/30" },
              { icon: Star, title: t("indexSolutions.boutique.title"), desc: t("indexSolutions.boutique.desc"), bullets: t("indexSolutions.boutique.bullets", { returnObjects: true }) as string[], href: "/cozum/butik-acenteler", color: "text-pink-500", bg: "from-pink-500/10 to-pink-500/5", ring: "hover:ring-pink-500/30" },
            ].map((item, idx) => (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: idx * 0.1, ease: "easeOut" }}
                whileHover={{ y: -4 }}
              >
                <Card className={`border-border/50 bg-gradient-to-b ${item.bg} hover:shadow-lg transition-all duration-300 h-full ring-1 ring-transparent ${item.ring}`}>
                  <CardContent className="p-7 flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 rounded-xl bg-card/60 backdrop-blur-sm shadow-sm">
                        <item.icon className={`w-7 h-7 ${item.color}`} />
                      </div>
                      <h3 className="font-bold text-foreground text-lg">{item.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{item.desc}</p>
                    <ul className="space-y-2 flex-1">
                      {Array.isArray(item.bullets) && item.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-sm text-foreground/80">
                          <CheckCircle2 className={`w-4 h-4 ${item.color} flex-shrink-0 mt-0.5`} />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <a href={item.href} className={`text-sm ${item.color} mt-5 inline-flex items-center gap-1 hover:underline font-medium group`}>
                      {t("cta.more")} <ArrowRight className="w-3 h-3 rtl:rotate-180 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                    </a>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Blog Section ──────────────────────────────────────────── */}
      <IndexBlogSection />

      {/* CTA Section — final dönüşüm bölümü, gradient-hero + animasyonlu blob'lar */}
      <section ref={(el) => (sectionsRef.current[7] = el)} className="py-20 relative overflow-hidden opacity-0 translate-y-8 transition-all duration-700">
        {/* Gradient hero arka plan + yumuşak blob hareketi (decorative) */}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-hero opacity-[0.08] animate-gradient-shift" style={{ backgroundSize: "200% 200%" }} />
        <div aria-hidden="true" className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-primary/20 blur-3xl animate-blob-float-slow pointer-events-none" />
        <div aria-hidden="true" className="absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-secondary/20 blur-3xl animate-blob-float-fast pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="relative max-w-4xl mx-auto"
          >
            {/* Outer glow ring */}
            <div className="absolute -inset-0.5 bg-gradient-ocean rounded-2xl blur-md opacity-30 pointer-events-none" aria-hidden="true" />
            <Card className="relative border-border/50 shadow-card bg-gradient-to-br from-card via-card to-accent/10 backdrop-blur-sm overflow-hidden">
              {/* Top accent stripe */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-ocean" aria-hidden="true" />
              <CardContent className="p-8 sm:p-12 text-center space-y-6 relative">
                <motion.div
                  initial={{ scale: 0.95 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-ocean shadow-md mb-2 animate-glow-pulse"
                >
                  <Sparkles className="w-8 h-8 text-primary-foreground" />
                </motion.div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                  {t("cta.title")}
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  {t("cta.subtitle")}
                </p>
                <Button
                  size="lg"
                  className="group bg-gradient-ocean hover:opacity-90 text-lg px-8 hover:scale-105 hover:shadow-[0_0_32px_-4px_hsl(var(--primary)/0.6)] transition-all duration-300"
                  asChild
                >
                  <a href="/auth?mode=signup">
                    {t("cta.button")}
                    <ArrowRight className="w-5 h-5 ms-2 rtl:rotate-180 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <FooterSection />

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
