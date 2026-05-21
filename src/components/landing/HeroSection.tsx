import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Zap, ArrowRight, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { AIMascot } from "./AIMascot";
import { HeroWhatsAppDemo } from "./HeroWhatsAppDemo";
import { AnimatedBackground } from "./AnimatedBackground";

interface HeroSectionProps {
  onDemoClick: () => void;
}

const scrollToPricing = () => {
  const el = document.getElementById("pricing");
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export const HeroSection = ({ onDemoClick }: HeroSectionProps) => {
  const { t } = useTranslation();
  const [mascotThinking, setMascotThinking] = useState(false);

  return (
    <>
      <AnimatedBackground />
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 md:gap-10 lg:gap-8 items-center">
          {/* SOL — Değer önerisi + CTA */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="space-y-5 lg:space-y-6 text-center lg:text-start"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/50 border border-border">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-accent-foreground">{t("hero.title")}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              {t("hero.subtitle")} <br />
              <span className="bg-gradient-ocean bg-clip-text text-transparent">{t("hero.highlight")}</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl lg:max-w-none mx-auto lg:mx-0">
              {t("hero.description")}
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center lg:items-start gap-3 sm:gap-4 pt-2">
              <Button
                size="lg"
                className="group bg-gradient-ocean hover:opacity-90 transition-all duration-300 hover:scale-105 text-lg px-8 min-h-[52px] w-full sm:w-auto animate-glow-pulse"
                asChild
              >
                <a href="/auth?mode=signup">
                  {t("hero.cta")}
                  <ArrowRight className="w-5 h-5 ms-2 rtl:rotate-180 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                </a>
              </Button>
              <button
                type="button"
                onClick={onDemoClick}
                className="inline-flex items-center justify-center gap-1 text-base font-medium text-foreground/80 hover:text-primary transition-colors group min-h-[44px]"
              >
                {t("hero.watchDemo")}
                <ChevronDown className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={scrollToPricing}
              className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {t("hero.priceHint")}
              <ArrowRight className="w-3 h-3 rtl:rotate-180" />
            </button>
          </motion.div>

          {/* SAĞ — AI Mascot + WhatsApp animasyonu */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            className="relative flex flex-col items-center gap-3 sm:gap-4 lg:gap-3"
          >
            {/* Mascot: mobilde gizli (mobil zaten kompakt), md+'da büyük */}
            <div className="hidden sm:block">
              <AIMascot thinking={mascotThinking} className="max-w-[120px] md:max-w-[140px] lg:max-w-[150px]" />
            </div>
            <HeroWhatsAppDemo onThinkingChange={setMascotThinking} />
          </motion.div>
        </div>
      </div>
    </>
  );
};
