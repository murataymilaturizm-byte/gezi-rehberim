import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmptyState } from "@/components/EmptyState";
import { RegistrationsListSkeleton } from "@/components/admin/skeletons/RegistrationsListSkeleton";
import { ClipboardList, Users, ChevronRight } from "lucide-react";
import type { RegistrationRow, StatusValue } from "./types";

const DATE_LOCALE_MAP = { tr, en: enUS, de, ru, ar, fr, es };

interface Props {
  registrations: RegistrationRow[];
  loading: boolean;
  onStatusChange: (id: string, newStatus: StatusValue) => void;
  onViewDetail: (registration: RegistrationRow) => void;
}

/**
 * Tasarım Turu 2 PARÇA 2 — Tur Bazlı.
 *
 * Hybrid: tur kartı (eyebrow destinasyon + tur adı + 3 stat chip) → açılınca
 *   ① Yatay TIMELINE: seferlerin tarih dizisi, her nokta = bir sefer,
 *      nokta yoğunluğu/opaklık = doluluk (yüksek=dolgun primary, düşük=açık)
 *      Hover'da küçük popover (tarih + doluluk).
 *   ② Altında: ticket-stub kart listesi (Parça 1 dilinin kompakt hali).
 *
 * RENK: timeline dolulukları primary opaklık varyasyonu — yeni hex YOK.
 *   Full ise destructive (kontenjan dolu = uyarı, palet sabit).
 */
export const RegistrationsByTour = ({
  registrations,
  loading,
  onViewDetail,
}: Props) => {
  const { t, i18n } = useTranslation();
  const dateLocale = DATE_LOCALE_MAP[i18n.language as keyof typeof DATE_LOCALE_MAP] || tr;

  const grouped = useMemo(() => {
    const map = new Map<string, {
      tourId: string;
      tourTitle: string;
      tourDestination: string;
      currency: string;
      totalRegs: number;
      totalPax: number;
      dates: Map<string, {
        dateId: string;
        departureDate: string;
        returnDate?: string | null;
        quota: number | null;
        soldPax: number;
        regs: RegistrationRow[];
      }>;
    }>();

    for (const reg of registrations) {
      const tourId = reg.tour_id || reg.tours?.id || "unknown";
      if (!map.has(tourId)) {
        map.set(tourId, {
          tourId,
          tourTitle: reg.tours?.title || "—",
          tourDestination: reg.tours?.destination || "",
          currency: reg.tours?.currency || "TRY",
          totalRegs: 0,
          totalPax: 0,
          dates: new Map(),
        });
      }
      const tour = map.get(tourId)!;
      tour.totalRegs++;
      if (reg.status !== "CANCELLED") tour.totalPax += reg.pax;

      const dateId = reg.tour_date_id || reg.tour_dates?.id || "unknown-date";
      if (!tour.dates.has(dateId)) {
        tour.dates.set(dateId, {
          dateId,
          departureDate: reg.tour_dates?.departure_date || "",
          returnDate: reg.tour_dates?.return_date,
          quota: reg.tour_dates?.quota ?? null,
          soldPax: 0,
          regs: [],
        });
      }
      const d = tour.dates.get(dateId)!;
      if (reg.status !== "CANCELLED") d.soldPax += reg.pax;
      d.regs.push(reg);
    }

    return Array.from(map.values())
      .sort((a, b) => b.totalRegs - a.totalRegs)
      .map((tour) => {
        const datesArr = Array.from(tour.dates.values()).sort((a, b) =>
          (a.departureDate || "").localeCompare(b.departureDate || "")
        );
        // Ortalama doluluk
        const withQuota = datesArr.filter((d) => d.quota != null && d.quota > 0);
        const avgOccupancy =
          withQuota.length > 0
            ? Math.round(
                withQuota.reduce((s, d) => s + (d.soldPax / d.quota!) * 100, 0) /
                  withQuota.length
              )
            : null;
        return { ...tour, datesArr, avgOccupancy };
      });
  }, [registrations]);

  if (loading) return <RegistrationsListSkeleton />;
  if (registrations.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title={t("registrations.emptyTitle")}
        description={t("registrations.emptyDescription")}
      />
    );
  }

  return (
    <Accordion type="multiple" className="space-y-3">
      {grouped.map((tour, idx) => (
        <AccordionItem
          key={tour.tourId}
          value={tour.tourId}
          className="border border-border/60 rounded-lg bg-card overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ animationDelay: `${idx * 30}ms` }}
        >
          <AccordionTrigger className="px-5 py-4 hover:bg-accent/30 hover:no-underline">
            <div className="flex flex-1 items-center justify-between gap-3 pr-2">
              <div className="flex items-center gap-3 min-w-0">
                {/* Dairesel mini sayaç — sefer sayısı */}
                <span className="shrink-0 inline-grid place-content-center w-10 h-10 rounded-full bg-primary/10 text-primary text-sm font-mono tabular-nums font-bold">
                  {tour.datesArr.length}
                </span>
                <div className="text-left min-w-0 space-y-0.5">
                  {tour.tourDestination && (
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold truncate">
                      {tour.tourDestination}
                    </p>
                  )}
                  <p className="text-base font-semibold tracking-tight truncate">
                    {tour.tourTitle}
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 shrink-0 text-xs">
                <StatChip
                  value={tour.datesArr.length}
                  label={t("admin.registrations.tripsShort", { defaultValue: "sefer" })}
                />
                <StatChip
                  value={tour.totalPax}
                  label={t("common.people", { defaultValue: "kişi" })}
                  icon={<Users className="w-3 h-3" />}
                />
                {tour.avgOccupancy != null && (
                  <StatChip
                    value={`%${tour.avgOccupancy}`}
                    label={t("admin.registrations.avgOccupancy", { defaultValue: "ort. dolu" })}
                  />
                )}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5 pt-1">
            <div className="space-y-4">
              {/* ① Yatay timeline */}
              <TourTimeline
                dates={tour.datesArr}
                onSelectDate={(dateId) => {
                  // Sefer kartına tıkla efekti: bu turun ilk reg'i ile detay aç değil,
                  // sefer kartını click etmek için TicketCardCompact kullanıcılarımız zaten var.
                  // Burada timeline noktası → popover gösteriyor; navigasyon kompakt kart üzerinden.
                  void dateId;
                }}
                dateLocale={dateLocale}
                t={t}
                currency={tour.currency}
              />

              {/* ② Kompakt ticket-stub liste */}
              <div className="grid gap-3 sm:grid-cols-2">
                {tour.datesArr.map((d) => (
                  <CompactTicketStub
                    key={d.dateId}
                    departureDate={d.departureDate}
                    returnDate={d.returnDate}
                    quota={d.quota}
                    soldPax={d.soldPax}
                    regCount={d.regs.length}
                    dateLocale={dateLocale}
                    onClick={() => {
                      // İlk aktif registration üzerinden onViewDetail değil;
                      // tıklama → DepartureDetailDialog için group oluştur AMA bu component
                      // sadece RegistrationDetailDialog'a açılır. Kullanıcı tıklayınca
                      // o seferin İLK kaydının detayını açalım (Faz 1 davranışı korunur).
                      const firstActive = d.regs.find((r) => r.status !== "CANCELLED");
                      if (firstActive) onViewDetail(firstActive);
                    }}
                  />
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// StatChip — başlıkta küçük "X / label" rozet
// ────────────────────────────────────────────────────────────────────────────
const StatChip = ({
  value,
  label,
  icon,
}: {
  value: number | string;
  label: string;
  icon?: React.ReactNode;
}) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border/40">
    {icon}
    <span className="font-mono tabular-nums font-semibold text-foreground">{value}</span>
    <span className="text-muted-foreground text-[11px]">{label}</span>
  </span>
);

// ────────────────────────────────────────────────────────────────────────────
// TourTimeline — yatay nokta dizisi, doluluk yoğunluğuna göre opaklık varyasyonu
// ────────────────────────────────────────────────────────────────────────────
interface TourTimelineProps {
  dates: Array<{
    dateId: string;
    departureDate: string;
    quota: number | null;
    soldPax: number;
    regs: RegistrationRow[];
  }>;
  onSelectDate: (dateId: string) => void;
  dateLocale: typeof tr;
  t: (k: string, opts?: Record<string, unknown>) => string;
  currency: string;
}

const TourTimeline = ({ dates, dateLocale, t }: TourTimelineProps) => {
  if (dates.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/40 bg-muted/15 p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold mb-3">
        {t("admin.registrations.timeline", { defaultValue: "Sefer Zaman Çizelgesi" })}
      </p>
      {/* Yatay scrollable timeline */}
      <div className="flex items-end gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {dates.map((d) => {
          const pct =
            d.quota && d.quota > 0
              ? Math.min(100, Math.round((d.soldPax / d.quota) * 100))
              : null;
          const isFull = d.quota != null && d.soldPax >= d.quota;
          // Doluluk yoğunluğu → bg-primary opaklık varyasyonu (YENİ HEX YOK)
          let dotBg = "bg-muted-foreground/15";
          let dotSize = "w-7 h-7";
          if (pct != null) {
            if (isFull) dotBg = "bg-destructive/80";
            else if (pct >= 80) dotBg = "bg-primary/80";
            else if (pct >= 50) dotBg = "bg-primary/60";
            else if (pct >= 25) dotBg = "bg-primary/40";
            else if (pct > 0) dotBg = "bg-primary/25";
            else dotBg = "bg-muted-foreground/20";
            // Boyut ufak değişkenlik — doluluk yüksek = biraz daha büyük "ağırlık" hissi
            dotSize = pct >= 50 ? "w-8 h-8" : "w-7 h-7";
          }

          return (
            <Popover key={d.dateId}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="group shrink-0 flex flex-col items-center gap-1.5 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md px-1"
                  aria-label={d.departureDate}
                >
                  <div
                    className={`${dotSize} rounded-full ${dotBg} flex items-center justify-center text-[10px] font-mono tabular-nums font-bold text-white shadow-sm transition-transform duration-200 group-hover:scale-110`}
                  >
                    {pct != null ? `${pct}` : "·"}
                  </div>
                  <span className="text-[10px] font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                    {d.departureDate
                      ? format(new Date(d.departureDate), "d MMM", { locale: dateLocale })
                      : "—"}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="center">
                <p className="text-sm font-semibold tabular-nums">
                  {d.departureDate
                    ? format(new Date(d.departureDate), "d MMMM yyyy", { locale: dateLocale })
                    : "—"}
                </p>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                    {t("admin.registrations.occupancy", { defaultValue: "Doluluk" })}
                  </span>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-lg font-mono tabular-nums font-bold">
                      {d.soldPax}
                    </span>
                    {d.quota != null && (
                      <span className="text-sm font-mono tabular-nums text-muted-foreground">
                        /{d.quota}
                      </span>
                    )}
                  </div>
                </div>
                {pct != null && (
                  <div className="h-1 mt-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full ${
                        isFull ? "bg-destructive/80" : pct >= 80 ? "bg-primary/80" : "bg-primary/60"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// CompactTicketStub — Parça 1 ticket-stub'ın 2-col grid'e uyacak kompakt hali
// ────────────────────────────────────────────────────────────────────────────
interface CompactTicketStubProps {
  departureDate: string;
  returnDate?: string | null;
  quota: number | null;
  soldPax: number;
  regCount: number;
  dateLocale: typeof tr;
  onClick: () => void;
}

const CompactTicketStub = ({
  departureDate,
  returnDate,
  quota,
  soldPax,
  regCount,
  dateLocale,
  onClick,
}: CompactTicketStubProps) => {
  const pct =
    quota && quota > 0 ? Math.min(100, Math.round((soldPax / quota) * 100)) : null;
  const isFull = quota != null && soldPax >= quota;

  const dateParts = departureDate
    ? {
        day: format(new Date(departureDate), "d", { locale: dateLocale }),
        month: format(new Date(departureDate), "MMM", { locale: dateLocale }),
      }
    : { day: "—", month: "" };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-lg border border-border/60 bg-card overflow-hidden hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-[transform,box-shadow,border-color] duration-200"
    >
      <div className="flex">
        <div className="shrink-0 w-[56px] bg-muted/30 border-r border-dashed border-border/60 flex flex-col items-center justify-center py-3 px-1 group-hover:translate-x-0.5 transition-transform duration-200">
          <span className="text-xl font-bold tabular-nums leading-none tracking-tighter">
            {dateParts.day}
          </span>
          <span className="text-[9px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mt-1">
            {dateParts.month}
          </span>
        </div>
        <div className="flex-1 min-w-0 p-3 flex flex-col gap-1.5">
          {returnDate && (
            <p className="text-[10px] text-muted-foreground/70 font-mono tabular-nums">
              →{" "}
              {format(new Date(returnDate), "d MMM", { locale: dateLocale })}
            </p>
          )}
          {quota != null ? (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-0.5">
                  <span className="text-lg font-mono tabular-nums font-bold leading-none">
                    {soldPax}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-muted-foreground leading-none">
                    /{quota}
                  </span>
                </div>
                <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                  %{pct}
                </span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    isFull ? "bg-destructive/80" : pct! >= 80 ? "bg-primary/80" : "bg-primary/60"
                  }`}
                  style={{ width: `${pct ?? 0}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-mono tabular-nums font-bold leading-none">
                {regCount}
              </span>
              <span className="text-[10px] text-muted-foreground/70">
                kayıt
              </span>
            </div>
          )}
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 self-center mr-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
      </div>
    </button>
  );
};
