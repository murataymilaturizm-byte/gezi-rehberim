// OperationsSection — landing'de chatbot'un yanına acente arka-ofis operasyon
// araçlarını tanıtan bölüm. Konum: FeaturesSection altı, HowItWorksSection öncesi.
//
// TASARIM KARARLARI:
//   • Renk paleti SABİT: krem (--background, --card) + turuncu (--primary, --secondary).
//     Yeni hex YOK; etkileyicilik tipografi hiyerarşisi, ritim, mockup'tan gelir.
//   • Layout: md+ yatay split — sol başlık+kartlar, sağ CSS-only otobüs koltuk mockup.
//     Mobilde stack — mockup kartların ALTINA düşer (görsel kalite mobilde de korunur).
//   • 4 kart 2×2 grid (görev gereği). Armchair / FileText / ClipboardList / Wallet
//     ikonları admin panelin gerçek ikonlarıyla birebir (kullanıcı admin'den geliyorsa
//     tanışıklık hissi).
//   • Mockup: küçük bus seat grid (2+2 düzen + orta kapı boşluğu) — gerçek SeatPlanDialog
//     dilini taklit eder; krem zemin + turuncu accent koltuklar.
//   • Mikro-etkileşim: stagger fade-up, hover -translate-y-1 + shadow, hep ölçülü.

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Armchair,
  FileText,
  ClipboardList,
  Wallet,
  ArrowRight,
  Sparkles,
  DoorOpen,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

interface OperationsSectionProps {
  onDemoClick?: () => void;
}

export const OperationsSection = ({ onDemoClick }: OperationsSectionProps) => {
  const { t } = useTranslation();

  const cards = [
    {
      icon: Armchair,
      title: t("operations.cards.seatPlan.title", { defaultValue: "Otobüs Koltuk Planı" }),
      desc: t("operations.cards.seatPlan.desc", {
        defaultValue: "2+2 ve 2+1 düzen, sürükle-bırak atama, orta kapı boşluğu, PDF çıktı.",
      }),
    },
    {
      icon: FileText,
      title: t("operations.cards.manifest.title", { defaultValue: "Yolcu Listesi & Manifesto" }),
      desc: t("operations.cards.manifest.desc", {
        defaultValue: "PDF ve Excel çıktı, grup renklendirme, koşullu pasaport, bakiye satırı.",
      }),
    },
    {
      icon: ClipboardList,
      title: t("operations.cards.registration.title", { defaultValue: "Kayıt & Sefer Yönetimi" }),
      desc: t("operations.cards.registration.desc", {
        defaultValue: "3 görünüm (liste/tur/sefer), zaman çizelgesi, hızlı düzenleme, filtreleme.",
      }),
    },
    {
      icon: Wallet,
      title: t("operations.cards.balance.title", { defaultValue: "Bakiye Takibi" }),
      desc: t("operations.cards.balance.desc", {
        defaultValue: "Otomatik hesap, snapshot + canlı fallback, ödeme özeti, audit korunur.",
      }),
    },
  ];

  return (
    <div className="container mx-auto px-4">
      {/* ── Başlık bloğu ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="text-center max-w-3xl mx-auto mb-12"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold tracking-wide uppercase text-primary">
            {t("operations.eyebrow", { defaultValue: "Operasyon Yönetimi" })}
          </span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-[1.1] tracking-tight mb-4">
          {t("operations.title", {
            defaultValue: "Sadece Chatbot Değil — Acentenizi Komple Yönetin",
          })}
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
          {t("operations.subtitle", {
            defaultValue:
              "Rezervasyon geldikten sonra: koltuk, manifesto, kayıt, bakiye — hepsi tek panelde, kayıpsız ve hızlı.",
          })}
        </p>
      </motion.div>

      {/* ── Yatay split: sol kart grid, sağ mockup ──────────────────────── */}
      <div className="grid lg:grid-cols-[1fr,1.05fr] gap-8 lg:gap-12 items-center max-w-6xl mx-auto">
        {/* SOL — 4 kart 2×2 */}
        <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: idx * 0.08, ease: "easeOut" }}
              >
                <Card className="h-full border-border/60 hover:border-primary/40 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 bg-card group">
                  <CardContent className="p-5 sm:p-6">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center mb-4 transition-colors">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground text-base leading-snug mb-2 group-hover:text-primary transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {card.desc}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* SAĞ — CSS-only koltuk planı mockup'ı */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="relative max-w-md mx-auto lg:max-w-full w-full"
        >
          {/* Decorative glow (subtle, palette-respecting) */}
          <div
            className="absolute -inset-4 bg-gradient-to-br from-primary/15 to-secondary/10 rounded-3xl blur-2xl opacity-60 pointer-events-none"
            aria-hidden="true"
          />

          {/* Panel frame */}
          <div className="relative rounded-2xl border border-border/60 bg-card shadow-xl overflow-hidden">
            {/* Mock browser/app top bar */}
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/60 bg-muted/30">
              <div className="w-2.5 h-2.5 rounded-full bg-destructive/30" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
              <div className="flex-1 text-center">
                <span className="inline-block text-[10px] font-mono tracking-wide text-muted-foreground">
                  {t("operations.mockup.url", { defaultValue: "turzzai.com/admin · koltuk planı" })}
                </span>
              </div>
            </div>

            {/* Panel content */}
            <div className="p-5 sm:p-6 space-y-4">
              {/* Header chip row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/15 border border-primary/30 text-[10px] font-semibold text-primary uppercase tracking-wider">
                  {t("operations.mockup.tag", { defaultValue: "Sefer" })}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {t("operations.mockup.tour", { defaultValue: "Pamukkale Turu" })}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("operations.mockup.date", { defaultValue: "12 Haz 2026" })}
                </span>
              </div>

              {/* Capacity bar */}
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {t("operations.mockup.occupancy", { defaultValue: "Doluluk" })}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-foreground font-semibold">
                    14 / 18
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-ocean"
                    style={{ width: "78%" }}
                  />
                </div>
              </div>

              {/* Seat grid — 2+2 düzen, orta kapı boşluğu */}
              <div className="bg-muted/30 rounded-xl p-4">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground text-center mb-2 font-semibold">
                  {t("operations.mockup.frontLabel", { defaultValue: "Ön" })}
                </div>
                <div
                  className="grid gap-1.5 mx-auto max-w-[220px]"
                  style={{ gridTemplateColumns: "1fr 1fr 16px 1fr 1fr" }}
                >
                  {/* Sıra 1 — dolu */}
                  <SeatMock filled num="1" />
                  <SeatMock filled num="2" />
                  <span aria-hidden="true" />
                  <SeatMock filled num="3" />
                  <SeatMock filled num="4" />
                  {/* Sıra 2 — dolu */}
                  <SeatMock filled num="5" />
                  <SeatMock filled num="6" />
                  <span aria-hidden="true" />
                  <SeatMock filled num="7" />
                  <SeatMock filled num="8" />
                  {/* Sıra 3 — orta kapı (sağ taraf) */}
                  <SeatMock filled num="9" />
                  <SeatMock filled num="10" />
                  <span aria-hidden="true" />
                  <DoorMock />
                  {/* Sıra 4 */}
                  <SeatMock filled num="11" />
                  <SeatMock num="12" />
                  <span aria-hidden="true" />
                  <SeatMock filled num="13" />
                  <SeatMock filled num="14" />
                  {/* Sıra 5 */}
                  <SeatMock num="15" />
                  <SeatMock num="16" />
                  <span aria-hidden="true" />
                  <SeatMock filled num="17" />
                  <SeatMock filled num="18" />
                </div>
              </div>

              {/* Action chip row */}
              <div className="flex flex-wrap gap-1.5">
                <ActionChip>{t("operations.mockup.actions.pdf", { defaultValue: "PDF" })}</ActionChip>
                <ActionChip>{t("operations.mockup.actions.excel", { defaultValue: "Excel" })}</ActionChip>
                <ActionChip>{t("operations.mockup.actions.seatPlan", { defaultValue: "Koltuk" })}</ActionChip>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── CTA bloğu ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" }}
        className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-12 max-w-md sm:max-w-none mx-auto"
      >
        <Button
          size="lg"
          className="w-full sm:w-auto bg-gradient-ocean hover:opacity-90 hover:scale-[1.02] transition-all duration-300 shadow-md hover:shadow-[0_0_28px_-4px_hsl(var(--primary)/0.5)]"
          asChild
        >
          <a href="/auth?mode=signup">
            <Sparkles className="w-4 h-4 me-2" />
            {t("operations.cta.primary", { defaultValue: "14 Gün Ücretsiz Dene" })}
            <ArrowRight className="w-4 h-4 ms-2 rtl:rotate-180" />
          </a>
        </Button>
        {onDemoClick && (
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto hover:bg-accent/50 hover:border-primary/40 transition-all duration-300"
            onClick={onDemoClick}
          >
            {t("operations.cta.secondary", { defaultValue: "Demoyu İzle" })}
          </Button>
        )}
      </motion.div>
    </div>
  );
};

// ── Mockup yardımcı sub-component'leri ────────────────────────────────────

const SeatMock = ({ filled, num }: { filled?: boolean; num: string }) => (
  <div
    className={`relative h-7 rounded-md flex items-center justify-center text-[8px] font-mono tabular-nums transition-colors ${
      filled
        ? "bg-primary/20 border-2 border-primary/40 text-primary"
        : "bg-background border-2 border-dashed border-muted-foreground/35 text-muted-foreground"
    }`}
  >
    {filled && (
      <span
        className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-primary"
        aria-hidden="true"
      />
    )}
    <span className="absolute top-0 left-0.5 opacity-60 text-[7px] leading-none">
      {num}
    </span>
  </div>
);

const DoorMock = () => (
  <div
    style={{ gridColumn: "4 / 6" }}
    className="h-7 rounded-md border-2 border-dashed border-muted-foreground/40 bg-muted/50 flex items-center justify-center gap-1 text-[8px] uppercase tracking-wider text-muted-foreground font-semibold"
  >
    <DoorOpen className="w-2.5 h-2.5" />
    <span>{`Kapı`}</span>
  </div>
);

const ActionChip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/50 border border-border/60 text-[10px] font-mono text-muted-foreground">
    {children}
  </span>
);
