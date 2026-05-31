import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { RegistrationsListSkeleton } from "@/components/admin/skeletons/RegistrationsListSkeleton";
import { ClipboardList, Users, ChevronRight } from "lucide-react";
import type { RegistrationRow } from "./types";

const DATE_LOCALE_MAP = { tr, en: enUS, de, ru, ar, fr, es };

interface Props {
  registrations: RegistrationRow[];
  loading: boolean;
  onSelectDeparture: (group: DepartureGroup) => void;
}

/**
 * Bir sefere (tour_date_id) ait yolcular + doluluk özeti.
 * RegistrationsByDeparture'dan DepartureDetailDialog'a geçen veri.
 */
export interface DepartureGroup {
  dateId: string;
  tourId: string;
  tourTitle: string;
  tourDestination: string;
  currency: string;
  departureDate: string;
  returnDate?: string | null;
  quota: number | null;
  soldPax: number;        // status !== 'CANCELLED' olan kayıtların pax toplamı
  totalRegs: number;
  regs: RegistrationRow[];
}

/**
 * Faz 1 (Kayıtlar 3/3): Sefer bazlı görünüm.
 *
 * Client-side gruplama: tour_date_id → kayıtlar. Her sefer için doluluk
 * (sold_pax = SUM(pax) WHERE status != 'CANCELLED', remaining = quota - sold_pax).
 * quota null/eksikse doluluk gösterilmiyor — sadece kayıt sayısı.
 *
 * Sefere tıklanınca DepartureDetailDialog açılır (parent yönetir).
 * Faz 2'de bu dialog otobüs/oturma planı + manifesto çıktısıyla genişleyecek.
 */
export const RegistrationsByDeparture = ({
  registrations,
  loading,
  onSelectDeparture,
}: Props) => {
  const { t, i18n } = useTranslation();
  const dateLocale = DATE_LOCALE_MAP[i18n.language as keyof typeof DATE_LOCALE_MAP] || tr;

  const groups = useMemo<DepartureGroup[]>(() => {
    const map = new Map<string, DepartureGroup>();

    for (const reg of registrations) {
      const dateId = reg.tour_date_id || reg.tour_dates?.id || `unknown-${reg.tour_id}`;
      if (!map.has(dateId)) {
        map.set(dateId, {
          dateId,
          tourId: reg.tour_id || reg.tours?.id || "",
          tourTitle: reg.tours?.title || "—",
          tourDestination: reg.tours?.destination || "",
          currency: reg.tours?.currency || "TRY",
          departureDate: reg.tour_dates?.departure_date || "",
          returnDate: reg.tour_dates?.return_date,
          quota: reg.tour_dates?.quota ?? null,
          soldPax: 0,
          totalRegs: 0,
          regs: [],
        });
      }
      const g = map.get(dateId)!;
      g.totalRegs++;
      // CANCELLED kayıtlar kontenjanı işgal etmez — atomic RPC ve tour-cache aynı kuralı uyguluyor
      if (reg.status !== "CANCELLED") g.soldPax += reg.pax;
      g.regs.push(reg);
    }

    // Yakın tarihli sefer önce
    return Array.from(map.values()).sort((a, b) =>
      (a.departureDate || "").localeCompare(b.departureDate || "")
    );
  }, [registrations]);

  if (loading) return <RegistrationsListSkeleton />;

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title={t("registrations.emptyTitle")}
        description={t("registrations.emptyDescription")}
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => {
        const occupancyPct =
          g.quota && g.quota > 0 ? Math.min(100, Math.round((g.soldPax / g.quota) * 100)) : null;
        const isFull = g.quota != null && g.soldPax >= g.quota;
        // Faz 2-C: sol kenar accent doluluk durumuna göre (RENK YOK, sadece mevcut palet opaklıkları).
        const accentBorder =
          g.quota == null
            ? "border-l-muted-foreground/20"
            : isFull
            ? "border-l-destructive/80"
            : occupancyPct! >= 80
            ? "border-l-primary/80"
            : g.soldPax > 0
            ? "border-l-primary/40"
            : "border-l-muted-foreground/20";
        return (
          <Card
            key={g.dateId}
            role="button"
            tabIndex={0}
            onClick={() => onSelectDeparture(g)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectDeparture(g);
              }
            }}
            className={`cursor-pointer border-l-4 ${accentBorder} hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-[transform,box-shadow,border-color] duration-200`}
          >
            <CardContent className="p-5 space-y-4">
              {/* Eyebrow: tarih + sağ üst full badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium tabular-nums">
                    {g.departureDate
                      ? format(new Date(g.departureDate), "d MMM yyyy", { locale: dateLocale })
                      : "—"}
                    {g.returnDate && (
                      <span>
                        {" → "}
                        {format(new Date(g.returnDate), "d MMM yyyy", { locale: dateLocale })}
                      </span>
                    )}
                  </p>
                  <p className="text-base font-semibold tracking-tight truncate">
                    {g.tourTitle}
                  </p>
                  {g.tourDestination && (
                    <p className="text-xs text-muted-foreground truncate">{g.tourDestination}</p>
                  )}
                </div>
                <div className="flex items-start gap-2 shrink-0">
                  {isFull && (
                    <span className="inline-flex items-center text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/30">
                      {t("admin.registrations.full", { defaultValue: "Kontenjan dolu" })}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                </div>
              </div>

              {g.quota != null ? (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                      <Users className="w-3 h-3" />
                      {t("admin.registrations.occupancy", { defaultValue: "Doluluk" })}
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-mono tabular-nums font-bold leading-none">
                        {g.soldPax}
                      </span>
                      <span className="text-base font-mono tabular-nums text-muted-foreground font-normal leading-none">
                        /{g.quota}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-muted-foreground ml-1.5">
                        ({occupancyPct}%)
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isFull
                          ? "bg-destructive/80"
                          : occupancyPct! >= 80
                          ? "bg-primary/80"
                          : "bg-primary/60"
                      }`}
                      style={{ width: `${occupancyPct ?? 0}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                      {t("admin.registrations.records", { defaultValue: "Kayıt" })}
                    </span>
                    <span className="text-2xl font-mono tabular-nums font-bold leading-none">
                      {g.totalRegs}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 italic">
                    {t("admin.registrations.noQuotaSet", { defaultValue: "Kontenjan ayarlı değil" })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
