import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowRight, ArrowUp, Menu, Phone } from "lucide-react";

// Turzz destek hattı — landing header'ında görünür. Layout.tsx ile birebir aynı değerler.
const SUPPORT_PHONE_DISPLAY = "0850 242 77 50";
const SUPPORT_PHONE_HREF = "tel:+908502427750";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DemoChat } from "@/components/DemoChat";
import turzzLogo from "@/assets/turzz-logo-orange.png";
import { SalesChatWidget } from "@/components/SalesChatWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { IndexBlogSection } from "@/components/IndexBlogSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { OperationsSection } from "@/components/landing/OperationsSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { ContactCollapsible } from "@/components/landing/ContactCollapsible";
import { FaqSection } from "@/components/landing/FaqSection";
import { FooterSection } from "@/components/landing/FooterSection";
import { StatsRibbon } from "@/components/landing/StatsRibbon";
import { StickyMobileCTA } from "@/components/landing/StickyMobileCTA";

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
    const observers = sectionsRef.current.map((section) => {
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
              {/* Destek telefonu — masaüstü: ikon + numara, mobil: sadece ikon (Layout.tsx ile aynı stil) */}
              <a
                href={SUPPORT_PHONE_HREF}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-foreground hover:text-primary transition-colors"
                aria-label={t("nav.callSupport", { defaultValue: "Destek Hattı" })}
              >
                <Phone className="h-4 w-4 text-primary" />
                <span className="font-medium tabular-nums">{SUPPORT_PHONE_DISPLAY}</span>
              </a>
              <a
                href={SUPPORT_PHONE_HREF}
                className="md:hidden inline-flex p-2 rounded-md hover:bg-accent transition-colors"
                aria-label={t("nav.callSupport", { defaultValue: "Destek Hattı" })}
                title={SUPPORT_PHONE_DISPLAY}
              >
                <Phone className="h-5 w-5 text-primary" />
              </a>
              <LanguageSelector />
              <ThemeToggle />
              <a href="/whatsapp-chatbot-seyahat-acentesi" className="hidden lg:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
                {t("nav.features")}
              </a>
              <a href="/cozum/incoming-acenteler" className="hidden lg:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
                {t("nav.solutions")}
              </a>
              <a href="/blog" className="hidden lg:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
                {t("nav.blog")}
              </a>
              <a href="/yardim" className="hidden lg:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
                {t("nav.help")}
              </a>
              <a href="/#pricing" className="hidden lg:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
                {t("nav.pricing")}
              </a>
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
                    <a href="/cozum/incoming-acenteler">{t("nav.solutions")}</a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/blog">{t("nav.blog")}</a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/yardim">{t("nav.help")}</a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/#pricing">{t("nav.pricing")}</a>
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

      {/* Operations Section — chatbot dışı arka-ofis araçları (koltuk, manifesto, kayıt, bakiye).
          Anlatı: bot + operasyon = komple sistem. */}
      <section ref={(el) => (sectionsRef.current[2] = el)} id="operasyon" className="py-16 sm:py-20 bg-card/40 opacity-0 translate-y-8 transition-all duration-700 scroll-mt-20">
        <OperationsSection onDemoClick={scrollToDemo} />
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

      {/* Contact Collapsible — Pricing altı "Bize Ulaşın" açılır form.
          Önceden FaqSection altındaydı; sadeleştirme turunda buraya taşındı. */}
      <section id="contact" className="scroll-mt-20">
        <ContactCollapsible />
      </section>

      {/* FAQ Section — sadece accordion (form ContactCollapsible'a taşındı) */}
      <section ref={(el) => (sectionsRef.current[6] = el)} className="py-20 opacity-0 translate-y-8 transition-all duration-700">
        <FaqSection />
      </section>

      {/* Blog Section — compact list (sadeleştirme: kart→liste) */}
      <IndexBlogSection />

      {/* Footer */}
      <FooterSection />

      {/* Mobil sticky CTA için footer altına spacer — bar 64px civarı + 8 güvenlik = h-20.
          Masaüstünde bar render edilmez, spacer da gizli (md:hidden). */}
      <div className="h-20 md:hidden" aria-hidden="true" />

      {/* Scroll to Top Button — mobilde sticky CTA ile çakışmaması için bottom-24,
          masaüstünde bottom-6 (CTA yok). */}
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-40 w-12 h-12 rounded-full bg-gradient-ocean hover:opacity-90 shadow-elegant hover:shadow-glow animate-fade-in transition-all duration-300 hover:scale-110 group"
          size="icon"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-5 h-5 transition-transform duration-300 group-hover:-translate-y-1" />
        </Button>
      )}

      {/* Sticky mobile CTA — sadece md altı (md:hidden) */}
      <StickyMobileCTA />

      {/* Sales Chat Widget */}
      <SalesChatWidget />
    </div>
  );
};

export default Index;
