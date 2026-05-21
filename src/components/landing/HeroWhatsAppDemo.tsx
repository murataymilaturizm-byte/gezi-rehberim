// Hero'da pre-scripted müşteri ↔ bot WhatsApp konuşma animasyonu.
// 9 mesajlı genişletilmiş senaryo: tur sorgusu → tarih → fiyat → rezervasyon → onay.
// framer-motion ile baloncuk giriş, CSS keyframe ile typing dots, auto-scroll.
// İçerik 7 dilde i18n'den geliyor (heroDemo namespace).
// onThinkingChange callback ile AIMascot ile senkron çalışabilir.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

type Bubble =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "bot"; text: string }
  | { id: number; role: "typing"; from: "user" | "bot" };

interface HeroWhatsAppDemoProps {
  /** Bot mesaj üretirken çağrılır (typing başlangıcında true, sonunda false). */
  onThinkingChange?: (thinking: boolean) => void;
}

export const HeroWhatsAppDemo = ({ onThinkingChange }: HeroWhatsAppDemoProps) => {
  const { t } = useTranslation();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Son mesaja otomatik scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [bubbles]);

  useEffect(() => {
    let mounted = true;
    let timers: ReturnType<typeof setTimeout>[] = [];
    let idCounter = 0;

    // Script: (delay, bubble, thinking-flag)
    const script: { delay: number; bubble: Omit<Bubble, "id">; thinking?: boolean }[] = [
      { delay: 500, bubble: { role: "user", text: t("heroDemo.msg1") } },
      { delay: 700, bubble: { role: "typing", from: "bot" }, thinking: true },
      { delay: 1500, bubble: { role: "bot", text: t("heroDemo.msg2") }, thinking: false },
      { delay: 2200, bubble: { role: "user", text: t("heroDemo.msg3") } },
      { delay: 700, bubble: { role: "typing", from: "bot" }, thinking: true },
      { delay: 1400, bubble: { role: "bot", text: t("heroDemo.msg4") }, thinking: false },
      { delay: 2200, bubble: { role: "user", text: t("heroDemo.msg5") } },
      { delay: 700, bubble: { role: "typing", from: "bot" }, thinking: true },
      { delay: 1600, bubble: { role: "bot", text: t("heroDemo.msg6") }, thinking: false },
      { delay: 2000, bubble: { role: "user", text: t("heroDemo.msg7") } },
      { delay: 700, bubble: { role: "typing", from: "bot" }, thinking: true },
      { delay: 1300, bubble: { role: "bot", text: t("heroDemo.msg8") }, thinking: false },
      { delay: 2500, bubble: { role: "typing", from: "bot" }, thinking: true },
      { delay: 1400, bubble: { role: "bot", text: t("heroDemo.msg9") }, thinking: false },
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
            idCounter += 1;
            const newBubble = { id: idCounter, ...step.bubble } as Bubble;
            setBubbles((prev) => {
              // Typing'leri her zaman yeni mesaj veya yeni typing ile değiştir
              const cleaned = prev.filter((b) => b.role !== "typing");
              return [...cleaned, newBubble];
            });
          }, acc),
        );
      });
      // Sona ulaşınca 5 saniye bekle, başa dön
      timers.push(
        setTimeout(() => {
          if (!mounted) return;
          run();
        }, acc + 5000),
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
    <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[360px] rounded-3xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-slate-800 dark:to-slate-900 shadow-card overflow-hidden border border-border/50">
      {/* WhatsApp benzeri başlık */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#075E54] text-white">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
          T
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{t("heroDemo.botName")}</div>
          <div className="text-[11px] text-white/80 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            {t("heroDemo.online")}
          </div>
        </div>
      </div>

      {/* Konuşma alanı — sabit yükseklik + auto-scroll */}
      <div
        ref={scrollRef}
        className="relative px-3 py-4 h-[360px] sm:h-[400px] md:h-[420px] overflow-y-auto"
        style={{
          backgroundImage:
            "radial-gradient(hsl(120 30% 90% / 0.4) 1.5px, transparent 1.5px)",
          backgroundSize: "20px 20px",
        }}
      >
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {bubbles.map((b) => {
              if (b.role === "typing") {
                return (
                  <motion.div
                    key={b.id}
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
                  key={b.id}
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 text-sm leading-snug shadow-sm whitespace-pre-line ${
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
