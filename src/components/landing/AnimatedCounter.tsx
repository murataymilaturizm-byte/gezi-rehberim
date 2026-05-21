// Görünür olunca 0'dan hedefe sayan number counter.
// framer-motion useInView + useMotionValue + animate.
// prefers-reduced-motion altında otomatik son değere atlar (browser respects animation overrides).

import { useEffect, useRef } from "react";
import { animate, useInView, useMotionValue, useTransform } from "framer-motion";
import { motion } from "framer-motion";

interface AnimatedCounterProps {
  /** Hedef sayı */
  to: number;
  /** Ön ek (örn: "$") */
  prefix?: string;
  /** Son ek (örn: "+", "%", "★") */
  suffix?: string;
  /** Animasyon süresi (saniye) */
  duration?: number;
  /** Sayı formatlaması: locale ile binlik ayırıcı */
  locale?: string;
  className?: string;
}

export const AnimatedCounter = ({
  to,
  prefix = "",
  suffix = "",
  duration = 1.8,
  locale = "tr-TR",
  className = "",
}: AnimatedCounterProps) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => {
    const value = Math.round(latest);
    return `${prefix}${value.toLocaleString(locale)}${suffix}`;
  });

  useEffect(() => {
    if (!inView) return;
    const controls = animate(count, to, { duration, ease: "easeOut" });
    return () => controls.stop();
  }, [inView, to, duration, count]);

  return (
    <motion.span ref={ref} className={className}>
      {rounded}
    </motion.span>
  );
};
