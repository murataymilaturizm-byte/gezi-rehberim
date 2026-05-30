import { useState } from "react";
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
import { Eye, MessageCircle, FileSpreadsheet, FileText, Users, Bus, UsersRound, Loader2 } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { formatPrice } from "@/utils/currency";
import type { DepartureGroup } from "./RegistrationsByDeparture";
import type { RegistrationRow } from "./types";
import { PassengerEditorDialog } from "./PassengerEditorDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// NOT: registration_passengers tablosu Faz 2-A migration sonrası types.ts'e gelene
// kadar `(supabase as any)` cast'i kullanılıyor. Types regenerate edildikten sonra
// kaldırılabilir. Detaylı not için PassengerEditorDialog.tsx başına bak.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import {
  exportPassengerManifestToExcel,
  type ManifestPassenger,
} from "@/utils/passengerManifestExporter";
import { generatePassengerManifestPDF } from "@/utils/passengerManifestGenerator";

const DATE_LOCALE_MAP = { tr, en: enUS, de, ru, ar, fr, es };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: DepartureGroup | null;
  onViewDetail: (registration: RegistrationRow) => void;
  /** Yolcu ekle/sil sonrası registrations'da pax değişti → parent listeyi yenile */
  onDataChange?: () => void;
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
export const DepartureDetailDialog = ({ open, onOpenChange, group, onViewDetail, onDataChange }: Props) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const dateLocale = DATE_LOCALE_MAP[i18n.language as keyof typeof DATE_LOCALE_MAP] || tr;

  // Faz 2-A: Yolcu editörü state'i + manifesto export loading state'leri
  const [passengerEditorOpen, setPassengerEditorOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<{ id: string; fullName: string; pax: number } | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  /**
   * Manifesto için bu seferin tüm yolcularını çek (CANCELLED rezervasyon yolcuları
   * HARİÇ — manifesto sadece aktif rezervasyonları gösterir).
   * RLS sayesinde sadece acentenin kendi yolcuları döner.
   */
  const fetchManifestPassengers = async (): Promise<ManifestPassenger[]> => {
    if (!group) return [];
    const activeRegIds = group.regs
      .filter((r) => r.status !== "CANCELLED")
      .map((r) => r.id);
    if (activeRegIds.length === 0) return [];

    const { data, error } = await db
      .from("registration_passengers")
      .select("passenger_order, full_name, identity_no, passport_no, birth_date, is_child, registration_id")
      .in("registration_id", activeRegIds)
      .order("passenger_order", { ascending: true });

    if (error) throw error;

    // Manifesto'da yolcular sıralı (rezervasyon order'a göre değil, global sıra)
    // — basit sıralama: passenger_order ASC zaten yapıldı, ek olarak registration order'ı
    // korumak için array'i baştan tekrar order'la (1, 2, 3...)
    return ((data as unknown as Array<{
      full_name: string;
      identity_no?: string | null;
      passport_no?: string | null;
      birth_date?: string | null;
      is_child?: boolean;
    }>) || []).map((p, idx) => ({
      passenger_order: idx + 1,
      full_name: p.full_name,
      identity_no: p.identity_no,
      passport_no: p.passport_no,
      birth_date: p.birth_date,
      is_child: p.is_child,
    }));
  };

  const handleExportExcel = async () => {
    if (!group) return;
    setExportingExcel(true);
    try {
      const passengers = await fetchManifestPassengers();
      if (passengers.length === 0) {
        toast({
          title: t("admin.manifest.noPassengers", { defaultValue: "Yolcu bulunamadı" }),
          variant: "destructive",
        });
        return;
      }
      exportPassengerManifestToExcel(passengers, {
        tourTitle: group.tourTitle,
        tourDestination: group.tourDestination,
        departureDate: group.departureDate,
        returnDate: group.returnDate,
        // vehiclePlate + guideName — Faz 2-B'de tour_dates'ten dolacak
      });
    } catch (err: any) {
      console.error("Manifest Excel export error:", err);
      toast({
        title: t("admin.manifest.exportError", { defaultValue: "Çıktı oluşturulamadı" }),
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    if (!group) return;
    setExportingPdf(true);
    try {
      const passengers = await fetchManifestPassengers();
      if (passengers.length === 0) {
        toast({
          title: t("admin.manifest.noPassengers", { defaultValue: "Yolcu bulunamadı" }),
          variant: "destructive",
        });
        return;
      }
      generatePassengerManifestPDF(passengers, {
        tourTitle: group.tourTitle,
        tourDestination: group.tourDestination,
        departureDate: group.departureDate,
        returnDate: group.returnDate,
      });
    } catch (err: any) {
      console.error("Manifest PDF generate error:", err);
      toast({
        title: t("admin.manifest.exportError", { defaultValue: "Çıktı oluşturulamadı" }),
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setExportingPdf(false);
    }
  };

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
    <>
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

        {/* Faz 2-A: Yolcu Listesi (Manifesto) — Excel + PDF aktif */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={exportingExcel || exportingPdf}
          >
            {exportingExcel ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-2" />
            )}
            {t("admin.registrations.exportExcel", { defaultValue: "Excel İndir" })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={exportingPdf || exportingExcel}
          >
            {exportingPdf ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            {t("admin.registrations.exportPdf", { defaultValue: "PDF İndir" })}
          </Button>
        </div>

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
                      onClick={() => {
                        setEditorTarget({
                          id: reg.id,
                          fullName: reg.full_name,
                          pax: reg.pax,
                        });
                        setPassengerEditorOpen(true);
                      }}
                      aria-label={t("admin.registrations.editPassengers", { defaultValue: "Yolcuları Düzenle" })}
                      title={t("admin.registrations.editPassengers", { defaultValue: "Yolcuları Düzenle" })}
                      disabled={isCancelled}
                    >
                      <UsersRound className="w-3.5 h-3.5" />
                    </Button>
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

    {/* Faz 2-A: Yolcu Editörü — bu sefere ait bir rezervasyonun yolcularını düzenler. */}
    <PassengerEditorDialog
      open={passengerEditorOpen}
      onOpenChange={(o) => {
        setPassengerEditorOpen(o);
        if (!o) {
          setEditorTarget(null);
          // Yolcu ekle/sil yapılmış olabilir → pax değişmiş olabilir, parent listeyi yenile.
          onDataChange?.();
        }
      }}
      registrationId={editorTarget?.id ?? null}
      registrationFullName={editorTarget?.fullName}
      initialPax={editorTarget?.pax ?? 1}
    />
    </>
  );
};
