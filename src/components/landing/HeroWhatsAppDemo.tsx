// Hero'da pre-scripted müşteri ↔ bot WhatsApp konuşma animasyonu.
// framer-motion ile baloncuk giriş, CSS keyframe ile typing dots.
// İçerik 7 dilde i18n'den geliyor (heroDemo namespace).
// onThinkingChange callback ile AIMascot ile senkron çalışabilir.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

type Bubble =
  | { role: "user"; text: string }
  | { role: "bot"; text: string }
  | { role: "typing"; from: "user" | "bot" };

interface HeroWhatsAppDemoProps {
  /** Bot mesaj üretirken çağrılır (typing başlangıcında true, sonunda false). */
  onThinkingChange?: (thinking: boolean) => void;
}

export const HeroWhatsAppDemo = ({ onThinkingChange }: HeroWhatsAppDemoProps) => {
  const { t } = useTranslation();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  useEffect(() => {
    let mounted = true;
    let timers: ReturnType<typeof setTimeout>[] = [];

    const script: { delay: number; bubble: Bubble; thinking?: boolean }[] = [
      { delay: 500, bubble: { role: "user", text: t("heroDemo.msg1") } },
      { delay: 800, bubble: { role: "typing", from: "bot" }, thinking: true },
      { delay: 1600, bubble: { role: "bot", text: t("heroDemo.msg2") }, thinking: false },
      { delay: 2000, bubble: { role: "user", text: t("heroDemo.msg3") } },
      { delay: 800, bubble: { role: "typing", from: "bot" }, thinking: true },
      { delay: 1400, bubble: { role: "bot", text: t("heroDemo.msg4") }, thinking: false },
    ];

    const run = () => {
      if (!mounted) return;
      setBubbles([]);
      onThinkingChange?.(false);
      let acc = 0;
      script.forEach((step) => {
        acc += step.delay;
        timers.push(
          setTimeout(() => {
            if (!mounted) return;
            if (step.thinking !== undefined) onThinkingChange?.(step.thinking);
            setBubbles((prev) => {
              // Typing bubble'ı her zaman tek tut: önce typing'leri sil
              const cleaned = prev.filter((b) => b.role !== "typing");
              if (step.bubble.role === "typing") return [...cleaned, step.bubble];
              return [...cleaned, step.bubble];
            });
          }, acc),
        );
      });
      // Sona ulaşınca 4 saniye bekle, başa dön
      timers.push(
        setTimeout(() => {
          if (!mounted) return;
          run();
        }, acc + 4000),
      );
    };

    run();
    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
      onThinkingChange?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  return (
    <div className="relative mx-auto w-full max-w-[360px] rounded-3xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-slate-800 dark:to-slate-900 shadow-card overflow-hidden border border-border/50">
      {/* WhatsApp benzeri başlık */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#075E54] text-white">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
          T
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{t("heroDemo.botName")}</div>
          <div className="text-[11px] text-white/80">{t("heroDemo.online")}</div>
        </div>
      </div>

      {/* Konuşma alanı */}
      <div
        className="relative px-3 py-4 min-h-[340px] max-h-[340px] overflow-hidden"
        style={{
          backgroundImage:
            "radial-gradient(hsl(120 30% 90% / 0.4) 1.5px, transparent 1.5px)",
          backgroundSize: "20px 20px",
        }}
      >
        <div className="flex flex-col gap-2 justify-end h-full">
          <AnimatePresence initial={false}>
            {bubbles.map((b, idx) => {
              const key = `${idx}-${b.role}`;
              if (b.role === "typing") {
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className={`flex ${b.from === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className="bg-white dark:bg-slate-700 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-typing-dot-1" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-typing-dot-2" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-typing-dot-3" />
                    </div>
                  </motion.div>
                );
              }
              const isUser = b.role === "user";
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 text-sm leading-snug shadow-sm ${
                      isUser
                        ? "bg-[#dcf8c6] text-slate-900 rounded-2xl rounded-br-sm"
                        : "bg-white dark:bg-slate-700 dark:text-slate-50 text-slate-900 rounded-2xl rounded-bl-sm"
                    }`}
                  >
                    {b.text}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
