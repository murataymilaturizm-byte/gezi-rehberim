import { useState, useEffect, useMemo } from "react";
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
import { Eye, MessageCircle, FileSpreadsheet, FileText, Users, UsersRound, Loader2, Armchair, UserCheck } from "lucide-react";
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
  // Faz 2-C2 PARÇA 1: Ekip paneli için tour_dates'ten personel + count-up animasyon
  const [extras, setExtras] = useState<{
    guide_name?: string | null;
    tour_leader_name?: string | null;
    captain_name?: string | null;
  } | null>(null);
  // SeatPlanDialog'da ekip alanları (guide/tourLeader/captain) güncellenince refetch
  // tetiklemek için artan sayaç — onClose'da increment.
  const [extrasReloadKey, setExtrasReloadKey] = useState(0);

  useEffect(() => {
    if (!open || !group) return;
    let aborted = false;
    (async () => {
      const { data, error } = await db
        .from("tour_dates")
        .select("guide_name, tour_leader_name, captain_name")
        .eq("id", group.dateId)
        .single();
      if (aborted) return;
      if (error) {
        console.warn("DepartureDetail extras fetch failed:", error.message);
        setExtras(null);
      } else {
        setExtras(data || null);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [open, group?.dateId, extrasReloadKey]);

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

  // Faz 2-C2 PARÇA 1: Sağ panel ödeme özeti — mevcut total_amount/paid_amount'tan
  // (yeni veri yok, sadece ekrana getir). Aktif (non-CANCELLED) rezervasyonların
  // toplamı; currency tek tur olduğu için sefer'in currency'sini kullan.
  const paymentSummary = useMemo(() => {
    if (!group) return { total: 0, paid: 0, remaining: 0, currency: "TRY" };
    let total = 0;
    let paid = 0;
    for (const r of group.regs) {
      if (r.status === "CANCELLED") continue;
      total += Number(r.total_amount ?? 0);
      paid += Number(r.paid_amount ?? 0);
    }
    return {
      total,
      paid,
      remaining: Math.max(0, total - paid),
      currency: group.currency || "TRY",
    };
  }, [group]);

  // Count-up animasyonu için dialog open=true → enabled
  const animatedSoldPax = useCountUp(group?.soldPax ?? 0, open);

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
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Faz 2-C2 PARÇA 1: Dialog header */}
        <DialogHeader className="px-6 py-5 border-b border-border/60 flex-shrink-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold">
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

        {/* Faz 2-C2 PARÇA 1: İki-kolon operasyon kokpiti.
            SOL: yolcu listesi (kaydırılabilir). SAĞ: sticky paneller (Durum / Kısa Yol / Ekip / Ödeme).
            Mobil: flex-col-reverse → sağ panel ÜSTTE, yolcu listesi altta. */}
        <div className="flex-1 min-h-0 flex flex-col-reverse md:flex-row overflow-hidden">
          {/* SOL — Yolcu listesi */}
          <div className="flex-1 min-h-0 overflow-y-auto md:border-r border-border/60">
            <div className="px-6 py-5">
              <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-border/40">
                <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold inline-flex items-center gap-1.5">
                  <UsersRound className="w-3 h-3" />
                  {t("admin.registrations.passengersHeader", { defaultValue: "Yolcular" })}
                </h3>
                <span className="text-xs font-mono tabular-nums text-muted-foreground">
                  {sortedRegs.filter((r) => r.status !== "CANCELLED").length}
                  {sortedRegs.some((r) => r.status === "CANCELLED") &&
                    ` + ${sortedRegs.filter((r) => r.status === "CANCELLED").length}`}
                </span>
              </div>
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

          {/* SAĞ — Sticky operasyon paneli */}
          <aside className="md:w-[300px] shrink-0 overflow-y-auto bg-muted/15 md:border-l-0 border-b md:border-b-0 border-border/60">
            <div className="px-5 py-5 space-y-4">
              {/* DURUM */}
              <Panel
                label={t("admin.registrations.statusPanel", { defaultValue: "Durum" })}
                icon={<Users className="w-3 h-3" />}
              >
                {group.quota != null ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-mono tabular-nums font-bold leading-none">
                        {animatedSoldPax}
                      </span>
                      <span className="text-base font-mono tabular-nums text-muted-foreground leading-none">
                        /{group.quota}
                      </span>
                      <span className="ml-auto text-[11px] uppercase tracking-wider text-muted-foreground font-mono tabular-nums">
                        %{occupancyPct}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all duration-700 ease-out ${
                          isFull
                            ? "bg-destructive/80"
                            : occupancyPct! >= 80
                            ? "bg-primary/80"
                            : "bg-primary/60"
                        }`}
                        style={{ width: `${occupancyPct ?? 0}%` }}
                      />
                    </div>
                    {isFull ? (
                      <span className="inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/30">
                        {t("admin.registrations.full", { defaultValue: "Kontenjan dolu" })}
                      </span>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        <span className="font-mono tabular-nums font-semibold text-foreground">
                          {Math.max(0, group.quota - group.soldPax)}
                        </span>{" "}
                        {t("admin.registrations.remainingShort", {
                          defaultValue: "kalan koltuk",
                        })}
                      </p>
                    )}
                  </>
                ) : (
                  <div>
                    <span className="text-3xl font-mono tabular-nums font-bold leading-none">
                      {group.totalRegs}
                    </span>
                    <p className="text-[11px] text-muted-foreground/70 italic mt-1">
                      {t("admin.registrations.noQuotaSet", {
                        defaultValue: "Kontenjan ayarlı değil",
                      })}
                    </p>
                  </div>
                )}
              </Panel>

              {/* KISA YOL — Excel / PDF / Koltuk Planı */}
              <Panel
                label={t("admin.registrations.shortcutsPanel", { defaultValue: "Kısa Yol" })}
              >
                <div className="grid gap-1.5">
                  <ShortcutButton
                    icon={
                      exportingExcel ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="w-4 h-4" />
                      )
                    }
                    label={t("admin.registrations.exportExcel", { defaultValue: "Excel İndir" })}
                    onClick={handleExportExcel}
                    disabled={exportingExcel || exportingPdf}
                  />
                  <ShortcutButton
                    icon={
                      exportingPdf ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )
                    }
                    label={t("admin.registrations.exportPdf", { defaultValue: "PDF İndir" })}
                    onClick={handleExportPdf}
                    disabled={exportingPdf || exportingExcel}
                  />
                  <ShortcutButton
                    icon={<Armchair className="w-4 h-4" />}
                    label={t("admin.seatPlan.openButton", { defaultValue: "Koltuk Planı" })}
                    onClick={() => setSeatPlanOpen(true)}
                  />
                </div>
              </Panel>

              {/* EKİP — Rehber / Tur Lideri / Kaptan (Faz 2-D alanları) */}
              {(extras?.guide_name || extras?.tour_leader_name || extras?.captain_name) && (
                <Panel
                  label={t("admin.registrations.teamPanel", { defaultValue: "Ekip" })}
                  icon={<UserCheck className="w-3 h-3" />}
                >
                  <div className="space-y-1.5 text-xs">
                    {extras.guide_name && (
                      <TeamRow
                        label={t("admin.seatPlan.guideName", { defaultValue: "Rehber" })}
                        value={extras.guide_name}
                      />
                    )}
                    {extras.tour_leader_name && (
                      <TeamRow
                        label={t("admin.seatPlan.tourLeaderName", { defaultValue: "Tur Lideri" })}
                        value={extras.tour_leader_name}
                      />
                    )}
                    {extras.captain_name && (
                      <TeamRow
                        label={t("admin.seatPlan.captainName", { defaultValue: "Kaptan" })}
                        value={extras.captain_name}
                      />
                    )}
                  </div>
                </Panel>
              )}

              {/* ÖDEME ÖZETİ */}
              {paymentSummary.total > 0 && (
                <Panel
                  label={t("admin.registrations.paymentSummary.title", {
                    defaultValue: "Ödeme Özeti",
                  })}
                >
                  <div className="space-y-2 text-xs">
                    <PaymentRow
                      label={t("admin.registrations.paymentSummary.total", {
                        defaultValue: "Toplam",
                      })}
                      value={formatPrice(paymentSummary.total, paymentSummary.currency, {
                        showCode: false,
                      })}
                    />
                    <PaymentRow
                      label={t("admin.registrations.paymentSummary.paid", {
                        defaultValue: "Ödenmiş",
                      })}
                      value={formatPrice(paymentSummary.paid, paymentSummary.currency, {
                        showCode: false,
                      })}
                    />
                    <div className="h-px bg-border/60 my-1" />
                    <PaymentRow
                      label={t("admin.registrations.paymentSummary.remaining", {
                        defaultValue: "Kalan",
                      })}
                      value={formatPrice(
                        paymentSummary.remaining,
                        paymentSummary.currency,
                        { showCode: false }
                      )}
                      emphasize
                    />
                  </div>
                </Panel>
              )}
            </div>
          </aside>
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

    {/* Faz 2-B: Koltuk Planı — sefer ayarları + otobüs şeması + atama + PDF.
        Kapanırken extras (Ekip paneli kaynağı) refetch tetiklenir — kullanıcı SeatPlan
        içinde tour_leader_name/captain_name doldurduktan sonra DepartureDetail hâlâ
        açıkken eski (boş) değerlerin asılı kalmaması için. */}
    <SeatPlanDialog
      open={seatPlanOpen}
      onOpenChange={(o) => {
        setSeatPlanOpen(o);
        if (!o) {
          onDataChange?.();
          setExtrasReloadKey((k) => k + 1);
        }
      }}
      group={group}
      onDataChange={onDataChange}
    />
    </>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Sağ panel — yardımcı sub-component'ler
// ────────────────────────────────────────────────────────────────────────────

const Panel = ({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="rounded-lg border border-border/60 bg-card p-4 space-y-2.5">
    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold inline-flex items-center gap-1.5">
      {icon}
      {label}
    </p>
    {children}
  </div>
);

const ShortcutButton = ({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="group flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-md text-sm font-medium border border-border/50 bg-background hover:bg-accent/50 hover:border-primary/40 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all duration-150"
  >
    <span className="text-muted-foreground group-hover:text-primary transition-colors">{icon}</span>
    <span className="flex-1 truncate">{label}</span>
  </button>
);

const TeamRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
      {label}
    </span>
    <span className="text-foreground font-medium truncate">{value}</span>
  </div>
);

const PaymentRow = ({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) => (
  <div className="flex items-baseline justify-between gap-2">
    <span
      className={`text-[10px] uppercase tracking-wider font-medium ${
        emphasize ? "text-foreground" : "text-muted-foreground/70"
      }`}
    >
      {label}
    </span>
    <span
      className={`font-mono tabular-nums ${
        emphasize ? "font-bold text-base text-foreground" : "font-semibold"
      }`}
    >
      {value}
    </span>
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// useCountUp — 0'dan target değere yumuşak animasyon (sadece enabled=true iken).
// requestAnimationFrame + easeOutCubic; dialog açıldığında bir kez tetiklenir.
// ────────────────────────────────────────────────────────────────────────────
function useCountUp(target: number, enabled: boolean, duration = 600) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setVal(target);
      return;
    }
    setVal(0);
    const start = performance.now();
    let raf: number;
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * ease));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, enabled]);
  return val;
}
