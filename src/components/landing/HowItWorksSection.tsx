import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MessageSquare, Brain, CheckCircle2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface HowItWorksSectionProps {
  onDemoClick: () => void;
}

export const HowItWorksSection = ({ onDemoClick }: HowItWorksSectionProps) => {
  const { t } = useTranslation();

  const steps = [
    { icon: MessageSquare, step: 1, title: t("howItWorks.step1.title"), desc: t("howItWorks.step1.description") },
    { icon: Brain, step: 2, title: t("howItWorks.step2.title"), desc: t("howItWorks.step2.description") },
    { icon: CheckCircle2, step: 3, title: t("howItWorks.step3.title"), desc: t("howItWorks.step3.description") },
  ];

  return (
    <div className="container mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          {t("howItWorks.title")}
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          {t("howItWorks.subtitle")}
        </p>
      </motion.div>

      {/* Horizontal step cards (md+) — process feel with connecting arrows */}
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6 md:gap-4 relative">
        {steps.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: index * 0.15, ease: "easeOut" }}
            className="group relative"
          >
            {/* Connecting arrow (only between cards on md+) */}
            {index < steps.length - 1 && (
              <div className="hidden md:flex absolute top-8 -end-3 z-10 w-6 h-6 rounded-full bg-card border border-border items-center justify-center shadow-sm">
                <ArrowRight className="w-3 h-3 text-primary rtl:rotate-180" />
              </div>
            )}

            <div className="relative h-full p-6 rounded-2xl border border-border/50 bg-card hover:shadow-lg hover:border-primary/30 transition-all duration-300 group-hover:-translate-y-1">
              {/* Step number badge */}
              <div className="flex items-center gap-3 mb-4">
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-ocean flex items-center justify-center text-primary-foreground font-bold text-lg shadow-md group-hover:shadow-[0_0_24px_-2px_hsl(var(--primary)/0.5)] transition-shadow duration-300">
                  {item.step}
                </div>
                <item.icon className="w-7 h-7 text-primary/70 group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.desc}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mt-10 text-center"
      >
        <Button
          size="lg"
          className="bg-gradient-ocean hover:opacity-90 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_24px_-4px_hsl(var(--primary)/0.5)]"
          onClick={onDemoClick}
        >
          {t("howItWorks.demoButton")}
        </Button>
      </motion.div>
    </div>
  );
};
