// Hero altı özellik şeridi — sayısal placeholder'lar kaldırıldı, özellik kartları kullanılıyor.
// Source of truth: src/components/landing/StatsRibbon.tsx (bu dosya).

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Globe, Clock, Zap, Rocket } from "lucide-react";

const ITEMS = [
  { icon: Globe, labelKey: "statsRibbon.langs", color: "text-primary" },
  { icon: Clock, labelKey: "statsRibbon.support", color: "text-secondary" },
  { icon: Zap, labelKey: "statsRibbon.booking", color: "text-primary" },
  { icon: Rocket, labelKey: "statsRibbon.setup", color: "text-secondary" },
] as const;

export const StatsRibbon = () => {
  const { t } = useTranslation();

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
            <item.icon className={`w-6 h-6 sm:w-7 sm:h-7 ${item.color}`} />
            <div className="text-sm sm:text-base font-semibold text-foreground leading-tight">{t(item.labelKey)}</div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
