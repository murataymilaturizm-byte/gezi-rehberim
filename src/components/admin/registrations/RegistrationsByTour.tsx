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
import { Card, CardContent } from "@/components/ui/card";
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
    <Accordion type="multiple" className="space-y-2">
      {grouped.map((tour) => (
        <AccordionItem
          key={tour.tourId}
          value={tour.tourId}
          className="border rounded-lg bg-card overflow-hidden"
        >
          <AccordionTrigger className="px-4 py-3 hover:bg-accent/50 hover:no-underline">
            <div className="flex flex-1 items-center justify-between gap-3 pr-2">
              <div className="text-left min-w-0">
                <p className="font-semibold truncate">{tour.tourTitle}</p>
                {tour.tourDestination && (
                  <p className="text-xs text-muted-foreground truncate">{tour.tourDestination}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="font-mono text-xs">
                  {tour.totalRegs} {t("admin.registrations.records", { defaultValue: "kayıt" })}
                </Badge>
                <Badge variant="secondary" className="font-mono text-xs gap-1">
                  <Users className="w-3 h-3" />
                  {tour.totalPax}
                </Badge>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-2 pb-2">
            <div className="space-y-3">
              {tour.dateGroupsArr.map((dg) => (
                <Card key={dg.dateId} className="border-l-4 border-l-primary/40">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-baseline justify-between gap-2 border-b pb-2">
                      <p className="text-sm font-medium">
                        {dg.departureDate
                          ? format(new Date(dg.departureDate), "d MMM yyyy", { locale: dateLocale })
                          : "—"}
                        {dg.returnDate && (
                          <span className="text-muted-foreground">
                            {" → "}
                            {format(new Date(dg.returnDate), "d MMM yyyy", { locale: dateLocale })}
                          </span>
                        )}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {dg.regs.length} {t("admin.registrations.records", { defaultValue: "kayıt" })}
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      {dg.regs.map((reg) => {
                        const unitPrice = reg.tour_dates?.price_adult || 0;
                        const totalPrice = unitPrice * reg.pax;
                        const waUrl = buildWhatsAppUrl(reg.phone);
                        return (
                          <div
                            key={reg.id}
                            className={`flex items-center gap-2 rounded-md border bg-background p-2 ${
                              reg.status === "CANCELLED" ? "opacity-50" : ""
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{reg.full_name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {reg.phone} · {reg.pax} {t("common.people", { defaultValue: "kişi" })}
                              </p>
                            </div>
                            <div className="hidden sm:flex flex-col items-end shrink-0 text-xs">
                              <Badge
                                variant={
                                  reg.payment_status === "PAID"
                                    ? "default"
                                    : reg.payment_status === "DEPOSIT"
                                    ? "secondary"
                                    : "outline"
                                }
                                className="text-[10px]"
                              >
                                {paymentStatusLabels[reg.payment_status || "UNPAID"]}
                              </Badge>
                              {totalPrice > 0 && (
                                <span className="font-semibold mt-0.5">
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
                  </CardContent>
                </Card>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};
