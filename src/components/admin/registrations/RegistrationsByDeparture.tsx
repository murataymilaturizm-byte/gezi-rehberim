import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
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
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map((g) => {
        const occupancyPct =
          g.quota && g.quota > 0 ? Math.min(100, Math.round((g.soldPax / g.quota) * 100)) : null;
        const isFull = g.quota != null && g.soldPax >= g.quota;
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
            className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{g.tourTitle}</p>
                  {g.tourDestination && (
                    <p className="text-xs text-muted-foreground truncate">{g.tourDestination}</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
              </div>

              <div className="text-sm">
                <p className="font-medium">
                  {g.departureDate
                    ? format(new Date(g.departureDate), "d MMM yyyy", { locale: dateLocale })
                    : "—"}
                  {g.returnDate && (
                    <span className="text-muted-foreground">
                      {" → "}
                      {format(new Date(g.returnDate), "d MMM yyyy", { locale: dateLocale })}
                    </span>
                  )}
                </p>
              </div>

              {g.quota != null ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Users className="w-3 h-3" />
                      {t("admin.registrations.occupancy", { defaultValue: "Doluluk" })}
                    </span>
                    <span className="font-mono font-semibold">
                      {g.soldPax}/{g.quota}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isFull
                          ? "bg-destructive"
                          : occupancyPct! >= 80
                          ? "bg-orange-500"
                          : "bg-primary"
                      }`}
                      style={{ width: `${occupancyPct ?? 0}%` }}
                    />
                  </div>
                  {isFull && (
                    <Badge variant="destructive" className="text-[10px]">
                      {t("admin.registrations.full", { defaultValue: "Kontenjan dolu" })}
                    </Badge>
                  )}
                </div>
              ) : (
                <Badge variant="outline" className="font-mono text-xs">
                  {g.totalRegs} {t("admin.registrations.records", { defaultValue: "kayıt" })}
                </Badge>
              )}

              {/* Faz 2 yer tutucu: araç bilgisi (transport_type) — şu an veri yok, gösterilmez.
                  Kart layout'u Faz 2'de araç chip'i + plan ikonu eklenince genişleyebilir. */}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
