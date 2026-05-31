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
import { Eye, MessageCircle, FileSpreadsheet, FileText, Users, Bus, UsersRound, Loader2, Armchair } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { formatPrice } from "@/utils/currency";
import type { DepartureGroup } from "./RegistrationsByDeparture";
import type { RegistrationRow } from "./types";
import { PassengerEditorDialog } from "./PassengerEditorDialog";
import { SeatPlanDialog } from "./SeatPlanDialog";
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
  type ManifestRegistrationMeta,
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
  // Faz 2-B: Koltuk planı dialog state'i
  const [seatPlanOpen, setSeatPlanOpen] = useState(false);

  /**
   * Manifesto için bu seferin tüm yolcularını çek (CANCELLED rezervasyon yolcuları
   * HARİÇ — manifesto sadece aktif rezervasyonları gösterir).
   * RLS sayesinde sadece acentenin kendi yolcuları döner.
   */
  const fetchManifestPassengers = async (): Promise<ManifestPassenger[]> => {
    if (!group) return [];
    // Faz 2-B Çözüm A: aktif rezervasyonları created_at ASC sırasıyla al — eski
    // rezervasyon önce gösterilir (group.regs DESC sıralı yüklenmiş olabilir).
    const activeRegsSorted = group.regs
      .filter((r) => r.status !== "CANCELLED")
      .slice()
      .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    const activeRegIds = activeRegsSorted.map((r) => r.id);
    if (activeRegIds.length === 0) return [];

    const { data, error } = await db
      .from("registration_passengers")
      .select("passenger_order, full_name, identity_no, passport_no, birth_date, is_child, registration_id")
      .in("registration_id", activeRegIds)
      .order("passenger_order", { ascending: true });

    if (error) throw error;

    // Çözüm A: group-based sort → önce registration_id (created_at sırası), sonra
    // passenger_order ASC. Aynı rezervasyonun yolcuları arka arkaya. Display sıra
    // numarası 1'den ardışık (DB passenger_order DEĞİŞMEZ, sadece display).
    const regOrderMap = new Map<string, number>();
    activeRegsSorted.forEach((r, i) => regOrderMap.set(r.id, i));

    const sorted = ((data as unknown as Array<{
      full_name: string;
      identity_no?: string | null;
      passport_no?: string | null;
      birth_date?: string | null;
      is_child?: boolean;
      passenger_order: number;
      registration_id: string;
    }>) || []).sort((a, b) => {
      const aIdx = regOrderMap.get(a.registration_id) ?? 999;
      const bIdx = regOrderMap.get(b.registration_id) ?? 999;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return a.passenger_order - b.passenger_order;
    });

    return sorted.map((p, idx) => ({
      passenger_order: idx + 1, // display sırası 1'den
      full_name: p.full_name,
      identity_no: p.identity_no,
      passport_no: p.passport_no,
      birth_date: p.birth_date,
      is_child: p.is_child,
      // Faz 2-D: bakiye grubu tespiti için (grup ilk yolcusunda bakiye gösterilir)
      registration_id: p.registration_id,
    }));
  };

  /**
   * Faz 2-D: Manifest extra context — tour_dates'ten personel (tour_leader, captain)
   * ve registrationMeta (her aktif rezervasyonun ödeme bakiyesi). Tek fetch.
   * RLS get_user_agency_id() otomatik filtreler.
   */
  const fetchManifestExtras = async (): Promise<{
    tourLeaderName: string | null;
    captainName: string | null;
    registrationMeta: ManifestRegistrationMeta[];
  }> => {
    if (!group) return { tourLeaderName: null, captainName: null, registrationMeta: [] };
    const { data: tdRow } = await db
      .from("tour_dates")
      .select("tour_leader_name, captain_name")
      .eq("id", group.dateId)
      .single();
    const activeRegs = group.regs.filter((r) => r.status !== "CANCELLED");
    const meta: ManifestRegistrationMeta[] = activeRegs.map((r) => {
      const total = Number(r.total_amount ?? 0);
      const paid = Number(r.paid_amount ?? 0);
      return {
        registration_id: r.id,
        total,
        paid,
        remaining: Math.max(0, total - paid),
        currency: r.tours?.currency || "TRY",
      };
    });
    return {
      tourLeaderName: tdRow?.tour_leader_name || null,
      captainName: tdRow?.captain_name || null,
      registrationMeta: meta,
    };
  };

  const handleExportExcel = async () => {
    if (!group) return;
    setExportingExcel(true);
    try {
      const [passengers, extras] = await Promise.all([
        fetchManifestPassengers(),
        fetchManifestExtras(),
      ]);
      if (passengers.length === 0) {
        toast({
          title: t("admin.manifest.noPassengers", { defaultValue: "Yolcu bulunamadı" }),
          variant: "destructive",
        });
        return;
      }
      // vehiclePlate + guideName tour_dates'ten (DepartureGroup henüz bu alanları taşımıyor; ek query basit)
      const { data: tdMeta } = await db
        .from("tour_dates")
        .select("vehicle_plate, guide_name")
        .eq("id", group.dateId)
        .single();
      exportPassengerManifestToExcel(passengers, {
        tourTitle: group.tourTitle,
        tourDestination: group.tourDestination,
        departureDate: group.departureDate,
        returnDate: group.returnDate,
        vehiclePlate: tdMeta?.vehicle_plate || undefined,
        guideName: tdMeta?.guide_name || undefined,
        tourLeaderName: extras.tourLeaderName || undefined,
        captainName: extras.captainName || undefined,
        registrationMeta: extras.registrationMeta,
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
      const [passengers, extras] = await Promise.all([
        fetchManifestPassengers(),
        fetchManifestExtras(),
      ]);
      if (passengers.length === 0) {
        toast({
          title: t("admin.manifest.noPassengers", { defaultValue: "Yolcu bulunamadı" }),
          variant: "destructive",
        });
        return;
      }
      const { data: tdMeta } = await db
        .from("tour_dates")
        .select("vehicle_plate, guide_name")
        .eq("id", group.dateId)
        .single();
      generatePassengerManifestPDF(passengers, {
        tourTitle: group.tourTitle,
        tourDestination: group.tourDestination,
        departureDate: group.departureDate,
        returnDate: group.returnDate,
        vehiclePlate: tdMeta?.vehicle_plate || undefined,
        guideName: tdMeta?.guide_name || undefined,
        tourLeaderName: extras.tourLeaderName || undefined,
        captainName: extras.captainName || undefined,
        registrationMeta: extras.registrationMeta,
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
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Faz 2-C: Dialog header — eyebrow + title + chip-style description */}
        <DialogHeader className="px-6 py-5 border-b border-border/60">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">
            {t("admin.registrations.departureDetail", { defaultValue: "Sefer Detayı" })}
          </p>
          <DialogTitle className="text-lg font-semibold tracking-tight truncate">
            {group.tourTitle}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-1.5 mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/40 text-xs font-medium text-foreground/80 tabular-nums">
              {dateText}{returnText}
            </span>
            {group.tourDestination && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/40 text-xs font-medium text-foreground/80">
                {group.tourDestination}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
        {/* Faz 2-C: Doluluk özeti — stats card pattern (3 sütun, divide-x, büyük sayılar) */}
        <div className="grid sm:grid-cols-3 gap-0 divide-x divide-border/60 rounded-lg border border-border/60 bg-muted/20 overflow-hidden">
          <div className="p-4 space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium inline-flex items-center gap-1">
              <Users className="w-3 h-3" />
              {t("admin.registrations.occupancy", { defaultValue: "Doluluk" })}
            </p>
            {group.quota != null ? (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-mono tabular-nums font-bold leading-none">
                    {group.soldPax}
                  </span>
                  <span className="text-base font-mono tabular-nums text-muted-foreground leading-none">
                    /{group.quota}
                  </span>
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
                {isFull && (
                  <span className="inline-flex items-center text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/30 mt-1">
                    {t("admin.registrations.full", { defaultValue: "Kontenjan dolu" })}
                  </span>
                )}
              </>
            ) : (
              <span className="text-2xl font-mono tabular-nums font-bold leading-none">
                {group.totalRegs}
              </span>
            )}
          </div>
          <div className="p-4 space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">
              {t("admin.registrations.records", { defaultValue: "Kayıt" })}
            </p>
            <span className="text-2xl font-mono tabular-nums font-bold leading-none block">
              {group.totalRegs}
            </span>
          </div>
          <div className="p-4 space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium inline-flex items-center gap-1">
              <Bus className="w-3 h-3" />
              {t("admin.registrations.vehicle", { defaultValue: "Araç" })}
            </p>
            <p className="text-sm text-muted-foreground italic">
              {t("admin.registrations.comingSoon", { defaultValue: "Yakında" })}
            </p>
          </div>
        </div>

        <div className="inline-flex rounded-lg border border-border/60 bg-card divide-x divide-border/60 overflow-hidden flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportExcel}
            disabled={exportingExcel || exportingPdf}
            className="rounded-none border-0 h-9"
          >
            {exportingExcel ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-2" />
            )}
            {t("admin.registrations.exportExcel", { defaultValue: "Excel İndir" })}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportPdf}
            disabled={exportingPdf || exportingExcel}
            className="rounded-none border-0 h-9"
          >
            {exportingPdf ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            {t("admin.registrations.exportPdf", { defaultValue: "PDF İndir" })}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSeatPlanOpen(true)}
            className="rounded-none border-0 h-9"
          >
            <Armchair className="w-4 h-4 mr-2" />
            {t("admin.seatPlan.openButton", { defaultValue: "Koltuk Planı" })}
          </Button>
        </div>

        {/* Faz 2-C: Yolcu listesi borderless flow — divide-y + hover bg */}
        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
          <div className="divide-y divide-border/40">
            {sortedRegs.map((reg, idx) => {
              const isCancelled = reg.status === "CANCELLED";
              const unitPrice = reg.tour_dates?.price_adult || 0;
              const totalPrice = unitPrice * reg.pax;
              const waUrl = buildWhatsAppUrl(reg.phone);
              return (
                <div
                  key={reg.id}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors ${
                    isCancelled ? "opacity-60 grayscale-[40%]" : ""
                  }`}
                >
                  <span className="text-[11px] font-mono text-muted-foreground/60 w-7 shrink-0 text-right tabular-nums">
                    {idx + 1}
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
                    <p className="text-xs text-muted-foreground truncate tabular-nums">
                      {reg.phone} · <span className="font-mono">{reg.pax}</span> {t("common.people", { defaultValue: "kişi" })}
                      {reg.note && <span> · {reg.note}</span>}
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
        </div>
        </div>
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

    {/* Faz 2-B: Koltuk Planı — sefer ayarları + otobüs şeması + atama + PDF. */}
    <SeatPlanDialog
      open={seatPlanOpen}
      onOpenChange={(o) => {
        setSeatPlanOpen(o);
        if (!o) onDataChange?.();
      }}
      group={group}
      onDataChange={onDataChange}
    />
    </>
  );
};
