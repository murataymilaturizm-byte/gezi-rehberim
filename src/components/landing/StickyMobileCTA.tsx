// StickyMobileCTA — sadece mobilde (md altı) ekranın altında sürekli görünen
// "14 gün ücretsiz başla" çağrı butonu. Masaüstünde bu bar render edilmez
// (md:hidden) — masaüstünde header'daki ana CTA zaten her zaman görünür.
//
// TASARIM:
//   • Bottom sticky, fixed positioning, z-40 (ScrollTop z-40 ile aynı katmanda
//     ama yatay olarak çakışmaz — ScrollTop sağ alt köşede dairesel; CTA tam
//     genişlik bar olarak alt kenara yapışır).
//   • Backdrop-blur + bg-card/95 → arka sayfa hafif görünür ama metin opak.
//     Dialog/toast fix'iyle aynı bg-card pattern → şeffaflık riski yok, light+dark uyumlu.
//   • Sayfa sonunda görünür içeriği örtmemesi için Index.tsx tarafında footer'ın
//     altına 76px spacer (mobile only) ekleniyor.

import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export const StickyMobileCTA = () => {
  const { t } = useTranslation();

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur-md px-3 py-2.5 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.08)]"
      role="region"
      aria-label={t("hero.startFreeTrial", { defaultValue: "14 gün ücretsiz başla" })}
    >
      <Button
        asChild
        className="w-full h-11 bg-gradient-ocean hover:opacity-90 active:scale-[0.99] transition-all duration-200 font-semibold shadow-md"
      >
        <a
          href="/auth?mode=signup"
          className="inline-flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>
            {t("stickyMobileCTA.label", { defaultValue: "14 Gün Ücretsiz Başla" })}
          </span>
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </a>
      </Button>
    </div>
  );
};
