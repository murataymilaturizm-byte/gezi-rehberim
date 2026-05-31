import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { RegistrationsListSkeleton } from "@/components/admin/skeletons/RegistrationsListSkeleton";
import { ClipboardList, Eye, MessageCircle, Users } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { formatPrice } from "@/utils/currency";
import type { RegistrationRow, StatusValue } from "./types";

const DATE_LOCALE_MAP = { tr, en: enUS, de, ru, ar, fr, es };

interface Props {
  registrations: RegistrationRow[];
  loading: boolean;
  onStatusChange: (id: string, newStatus: StatusValue) => void;
  onViewDetail: (registration: RegistrationRow) => void;
}

/**
 * Faz 1 (Kayıtlar 2/3): Tur bazlı görünüm.
 *
 * Client-side gruplama: tour_id → tarih_id (departure) → kayıtlar.
 * Mevcut yüklü veriyi işliyor; ek query veya RPC YOK.
 *
 * Mevcut RegistrationsList ile aynı satır bilgisi — DRY için aynı action handler'ları
 * (onStatusChange, onViewDetail) parent'tan props ile geliyor. WhatsApp template trigger'ı
 * useRegistrations.handleStatusChange içinde, bozulmuyor.
 */
export const RegistrationsByTour = ({
  registrations,
  loading,
  onViewDetail,
}: Props) => {
  const { t, i18n } = useTranslation();
  const dateLocale = DATE_LOCALE_MAP[i18n.language as keyof typeof DATE_LOCALE_MAP] || tr;

  const paymentStatusLabels: Record<string, string> = {
    UNPAID: t("admin.paymentStatusLabels.UNPAID"),
    DEPOSIT: t("admin.paymentStatusLabels.DEPOSIT"),
    PAID: t("admin.paymentStatusLabels.PAID"),
  };

  // tour_id → { tourMeta, dateGroups: Map<dateId, { dateMeta, regs }> }
  const grouped = useMemo(() => {
    const map = new Map<string, {
      tourId: string;
      tourTitle: string;
      tourDestination: string;
      currency: string;
      totalRegs: number;
      totalPax: number;
      dateGroups: Map<string, {
        dateId: string;
        departureDate: string;
        returnDate?: string | null;
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
          dateGroups: new Map(),
        });
      }
      const tourEntry = map.get(tourId)!;
      tourEntry.totalRegs++;
      if (reg.status !== "CANCELLED") tourEntry.totalPax += reg.pax;

      const dateId = reg.tour_date_id || reg.tour_dates?.id || "unknown-date";
      if (!tourEntry.dateGroups.has(dateId)) {
        tourEntry.dateGroups.set(dateId, {
          dateId,
          departureDate: reg.tour_dates?.departure_date || "",
          returnDate: reg.tour_dates?.return_date,
          regs: [],
        });
      }
      tourEntry.dateGroups.get(dateId)!.regs.push(reg);
    }

    // Tur listesini totalRegs DESC + sefer listesini departure_date ASC sırala
    return Array.from(map.values())
      .sort((a, b) => b.totalRegs - a.totalRegs)
      .map((tour) => ({
        ...tour,
        dateGroupsArr: Array.from(tour.dateGroups.values()).sort((a, b) =>
          (a.departureDate || "").localeCompare(b.departureDate || "")
        ),
      }));
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
      {grouped.map((tour) => (
        <AccordionItem
          key={tour.tourId}
          value={tour.tourId}
          className="border border-border/60 rounded-lg bg-card overflow-hidden"
        >
          <AccordionTrigger className="px-5 py-4 hover:bg-accent/30 hover:no-underline">
            <div className="flex flex-1 items-center justify-between gap-3 pr-2">
              <div className="flex items-center gap-3 min-w-0">
                {/* Dairesel mini sayaç — sefer sayısı (mevcut primary opaklığı, yeni renk yok) */}
                <span className="shrink-0 inline-grid place-content-center w-9 h-9 rounded-full bg-primary/10 text-primary text-xs font-mono tabular-nums font-semibold">
                  {tour.dateGroupsArr.length}
                </span>
                <div className="text-left min-w-0 space-y-0.5">
                  {tour.tourDestination && (
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium truncate">
                      {tour.tourDestination}
                    </p>
                  )}
                  <p className="text-base font-semibold tracking-tight truncate">{tour.tourTitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs">
                <span className="text-muted-foreground">
                  <span className="font-mono tabular-nums font-semibold text-foreground">
                    {tour.totalRegs}
                  </span>{" "}
                  {t("admin.registrations.records", { defaultValue: "kayıt" })}
                </span>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span className="font-mono tabular-nums font-semibold text-foreground">
                    {tour.totalPax}
                  </span>{" "}
                  {t("common.people", { defaultValue: "kişi" })}
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3">
            <div className="space-y-3">
              {tour.dateGroupsArr.map((dg) => (
                <div key={dg.dateId} className="rounded-md border border-border/60 border-l-4 border-l-primary/40 bg-background overflow-hidden">
                  <div className="px-4 py-2.5 bg-muted/30 border-b border-border/40 flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium tabular-nums">
                      {dg.departureDate
                        ? format(new Date(dg.departureDate), "d MMM yyyy", { locale: dateLocale })
                        : "—"}
                      {dg.returnDate && (
                        <span className="text-muted-foreground font-normal">
                          {" → "}
                          {format(new Date(dg.returnDate), "d MMM yyyy", { locale: dateLocale })}
                        </span>
                      )}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      <span className="font-mono tabular-nums font-semibold text-foreground">
                        {dg.regs.length}
                      </span>{" "}
                      {t("admin.registrations.records", { defaultValue: "kayıt" })}
                    </span>
                  </div>
                  <div className="divide-y divide-border/40">
                    {dg.regs.map((reg) => {
                      const unitPrice = reg.tour_dates?.price_adult || 0;
                      const totalPrice = unitPrice * reg.pax;
                      const waUrl = buildWhatsAppUrl(reg.phone);
                      return (
                        <div
                          key={reg.id}
                          className={`flex items-center gap-3 py-2.5 px-3 hover:bg-accent/20 transition-colors ${
                            reg.status === "CANCELLED" ? "opacity-60 grayscale-[40%]" : ""
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{reg.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {reg.phone} ·{" "}
                              <span className="font-mono tabular-nums">{reg.pax}</span>{" "}
                              {t("common.people", { defaultValue: "kişi" })}
                            </p>
                          </div>
                          <div className="hidden sm:flex flex-col items-end shrink-0 text-xs gap-0.5">
                            <Badge
                              variant={
                                reg.payment_status === "PAID"
                                  ? "default"
                                  : reg.payment_status === "DEPOSIT"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="text-[10px] font-medium"
                            >
                              {paymentStatusLabels[reg.payment_status || "UNPAID"]}
                            </Badge>
                            {totalPrice > 0 && (
                              <span className="font-mono tabular-nums font-semibold">
                                {formatPrice(totalPrice, tour.currency, { showCode: false })}
                              </span>
                            )}
                          </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => onViewDetail(reg)}
                                aria-label={t("admin.registrations.viewDetail")}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              {waUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 border-green-500/40 text-green-700 dark:text-green-400 hover:bg-green-500/5"
                                  asChild
                                >
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={t("common.openWhatsApp")}
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};
