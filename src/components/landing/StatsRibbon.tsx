// Hero altı sayısal şerit — görünür olunca sayar.
// NOT: Sayılar şu an PLACEHOLDER. Gerçek metrikler geldiğinde değiştirilmeli.
// Source of truth: src/components/landing/StatsRibbon.tsx (bu dosya).

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Building2, MessageSquare, Star, Globe } from "lucide-react";
import { AnimatedCounter } from "./AnimatedCounter";

const ITEMS = [
  { icon: Building2, value: 500, suffix: "+", labelKey: "statsRibbon.agencies", color: "text-primary" },
  { icon: MessageSquare, value: 100000, suffix: "+", labelKey: "statsRibbon.messages", color: "text-secondary" },
  { icon: Star, value: 4.9, suffix: " ★", labelKey: "statsRibbon.satisfaction", color: "text-primary", decimals: 1 },
  { icon: Globe, value: 7, suffix: "", labelKey: "statsRibbon.languages", color: "text-secondary" },
] as const;

export const StatsRibbon = () => {
  const { t, i18n } = useTranslation();

  return (
    <div className="container mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-6 md:p-8 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-card"
      >
        {ITEMS.map((item, idx) => (
          <motion.div
            key={item.labelKey}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: idx * 0.08, ease: "easeOut" }}
            className="flex flex-col items-center text-center gap-1.5"
          >
            <item.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${item.color}`} />
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
              {"decimals" in item && item.decimals ? (
                // AnimatedCounter şu an integer; star rating için sabit gösterim
                <span>{item.value.toFixed(item.decimals)}{item.suffix}</span>
              ) : (
                <AnimatedCounter to={item.value} suffix={item.suffix} locale={i18n.language === "tr" ? "tr-TR" : "en-US"} />
              )}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground">{t(item.labelKey)}</div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
