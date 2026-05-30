import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, MessageCircle, FileSpreadsheet, FileText, Users, Bus } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { formatPrice } from "@/utils/currency";
import type { DepartureGroup } from "./RegistrationsByDeparture";
import type { RegistrationRow } from "./types";

const DATE_LOCALE_MAP = { tr, en: enUS, de, ru, ar, fr, es };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: DepartureGroup | null;
  onViewDetail: (registration: RegistrationRow) => void;
}

/**
 * Faz 1 (Kayıtlar — sefer detay): Bir seferin yolcu listesi + doluluk özeti.
 *
 * Faz 2 hazırlığı:
 *  - "Excel İndir" ve "PDF İndir" butonları ZATEN UI'da, sadece disabled+tooltip (Yakında).
 *    Faz 2'de aktif olunca UI refactor olmayacak.
 *  - Yolcu sıralama created_at ASC — Faz 2'de seat otomatik atama bu sıraya bağlanabilir.
 *  - Araç (Bus ikon yer tutucu) gösteriliyor; Faz 2'de tour_dates.transport_type +
 *    seat_layout JSONB eklenince oturma planı buraya gelir.
 *  - Status değiştirme bu dialog'da YOK — kayıt detayını açmak için satır eye butonu mevcut
 *    RegistrationDetailDialog'u açıyor (status update orada, merkezi useRegistrations hook'u).
 */
export const DepartureDetailDialog = ({ open, onOpenChange, group, onViewDetail }: Props) => {
  const { t, i18n } = useTranslation();
  const dateLocale = DATE_LOCALE_MAP[i18n.language as keyof typeof DATE_LOCALE_MAP] || tr;

  if (!group) return null;

  const paymentStatusLabels: Record<string, string> = {
    UNPAID: t("admin.paymentStatusLabels.UNPAID"),
    DEPOSIT: t("admin.paymentStatusLabels.DEPOSIT"),
    PAID: t("admin.paymentStatusLabels.PAID"),
  };

  // İptal edilenleri sona at; içeride created_at ASC (Faz 2 seat atama sırası)
  const sortedRegs = [...group.regs].sort((a, b) => {
    const aCancelled = a.status === "CANCELLED";
    const bCancelled = b.status === "CANCELLED";
    if (aCancelled !== bCancelled) return aCancelled ? 1 : -1;
    return (a.created_at || "").localeCompare(b.created_at || "");
  });

  const occupancyPct =
    group.quota && group.quota > 0
      ? Math.min(100, Math.round((group.soldPax / group.quota) * 100))
      : null;
  const isFull = group.quota != null && group.soldPax >= group.quota;
  const dateText = group.departureDate
    ? format(new Date(group.departureDate), "d MMM yyyy", { locale: dateLocale })
    : "—";
  const returnText = group.returnDate
    ? ` → ${format(new Date(group.returnDate), "d MMM yyyy", { locale: dateLocale })}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="truncate">{group.tourTitle}</span>
          </DialogTitle>
          <DialogDescription>
            {dateText}
            {returnText}
            {group.tourDestination && <span> · {group.tourDestination}</span>}
          </DialogDescription>
        </DialogHeader>

        {/* Doluluk özeti + Faz 2 yer tutucular */}
        <div className="grid gap-3 sm:grid-cols-3 border-y py-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Users className="w-3 h-3" />
              {t("admin.registrations.occupancy", { defaultValue: "Doluluk" })}
            </p>
            {group.quota != null ? (
              <>
                <p className="font-mono font-semibold text-lg">
                  {group.soldPax}
                  <span className="text-muted-foreground">/{group.quota}</span>
                </p>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
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
                  <Badge variant="destructive" className="text-[10px] mt-1">
                    {t("admin.registrations.full", { defaultValue: "Kontenjan dolu" })}
                  </Badge>
                )}
              </>
            ) : (
              <p className="font-mono font-semibold">{group.totalRegs}</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t("admin.registrations.records", { defaultValue: "Kayıt" })}
            </p>
            <p className="font-mono font-semibold text-lg">{group.totalRegs}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Bus className="w-3 h-3" />
              {t("admin.registrations.vehicle", { defaultValue: "Araç" })}
            </p>
            {/* Faz 2 yer tutucu — şu an transport_type verisi YOK */}
            <p className="text-sm text-muted-foreground italic">
              {t("admin.registrations.comingSoon", { defaultValue: "Yakında" })}
            </p>
          </div>
        </div>

        {/* Faz 2 hazırlığı — Excel/PDF butonları DISABLED + tooltip */}
        <TooltipProvider delayDuration={150}>
          <div className="flex flex-wrap gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="outline" size="sm" disabled>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    {t("admin.registrations.exportExcel", { defaultValue: "Excel İndir" })}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {t("admin.registrations.comingSoon", { defaultValue: "Yakında" })}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="outline" size="sm" disabled>
                    <FileText className="w-4 h-4 mr-2" />
                    {t("admin.registrations.exportPdf", { defaultValue: "PDF İndir" })}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {t("admin.registrations.comingSoon", { defaultValue: "Yakında" })}
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        {/* Yolcu listesi */}
        <ScrollArea className="flex-1 max-h-[50vh] -mx-1 px-1">
          <div className="space-y-1.5">
            {sortedRegs.map((reg, idx) => {
              const isCancelled = reg.status === "CANCELLED";
              const unitPrice = reg.tour_dates?.price_adult || 0;
              const totalPrice = unitPrice * reg.pax;
              const waUrl = buildWhatsAppUrl(reg.phone);
              return (
                <div
                  key={reg.id}
                  className={`flex items-center gap-2 rounded-md border bg-card p-2.5 ${
                    isCancelled ? "opacity-50" : ""
                  }`}
                >
                  <span className="text-xs font-mono text-muted-foreground w-6 shrink-0 text-right">
                    {idx + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {reg.full_name}
                      {isCancelled && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          {t("admin.status.cancelled", { defaultValue: "İptal" })}
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {reg.phone} · {reg.pax} {t("common.people", { defaultValue: "kişi" })}
                      {reg.note && <span> · {reg.note}</span>}
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
                        {formatPrice(totalPrice, group.currency, { showCode: false })}
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
