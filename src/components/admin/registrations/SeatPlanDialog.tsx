import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Loader2,
  Save,
  Settings,
  Sparkles,
  FileText,
  X,
  DoorOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";
import type { DepartureGroup } from "./RegistrationsByDeparture";
import { generateSeatPlanPDF } from "@/utils/seatPlanGenerator";

const DATE_LOCALE_MAP = { tr, en: enUS, de, ru, ar, fr, es };

// Faz 2-B: registration_passengers tablosu types.ts'te yok — cast.
// Types regenerate edildikten sonra `db = supabase as any` kaldırılabilir.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type TransportType = "BUS" | "PLANE" | "BOAT" | "PRIVATE" | "OTHER";
type SeatLayout = "2+2" | "2+1";

interface PassengerSeat {
  id: string;
  registration_id: string;
  passenger_order: number;
  full_name: string;
  is_child?: boolean;
  seat_no: string | null;
  status?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: DepartureGroup | null;
  onDataChange?: () => void;
}

/**
 * Faz 2-B: Otobüs Koltuk Planı dialog'u.
 *
 * Yapı:
 *  1) Sefer ayarları formu (transport_type, seat_layout, seat_count, vehicle_plate, guide_name).
 *     transport_type='BUS' + seat_layout + seat_count dolu değilse şema render edilmez.
 *  2) Otobüs şeması (CSS Grid): 2+2 → 5 sütun (sol/sol/koridor/sağ/sağ), 2+1 → 4 sütun.
 *     Her koltuk tıklanabilir kart; atanmamışsa boş, atanmışsa yolcu baş harfleri görünür.
 *  3) Atanmamış yolcular paneli (seat_no NULL olan aktif rezervasyon yolcuları).
 *  4) Otomatik Ata butonu: grup-bazlı (registration_id grupla, içinde passenger_order ASC),
 *     sıralı boş koltuklara dağıt → aynı rezervasyon yolcuları arka arkaya koltuk numarası alır.
 *  5) PDF İndir: seatPlanGenerator.
 *
 * GÜVENLİK: agency_id frontend'den geçirilmez. tour_dates UPDATE ve seat_no UPDATE'leri
 * RLS get_user_agency_id() ile filtreler. tour_date_id trigger ile parent'tan zorlanır.
 * Çakışma DB partial unique index ile korunur — UPDATE hata dönerse UI toast gösterir.
 */
export const SeatPlanDialog = ({ open, onOpenChange, group, onDataChange }: Props) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const dateLocale = DATE_LOCALE_MAP[i18n.language as keyof typeof DATE_LOCALE_MAP] || tr;

  // Sefer ayarları state (formdan tour_dates'e UPDATE edilir)
  const [transportType, setTransportType] = useState<TransportType | "">("");
  const [seatLayout, setSeatLayout] = useState<SeatLayout | "">("");
  const [seatCount, setSeatCount] = useState<string>("");
  const [vehiclePlate, setVehiclePlate] = useState<string>("");
  const [guideName, setGuideName] = useState<string>("");
  // Faz 2-D: kapı sırası + 2 ek personel
  const [doorRow, setDoorRow] = useState<string>("");
  const [tourLeaderName, setTourLeaderName] = useState<string>("");
  const [captainName, setCaptainName] = useState<string>("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [passengers, setPassengers] = useState<PassengerSeat[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Reload ayarları ve yolcular dialog açılınca
  useEffect(() => {
    if (!open || !group) return;
    let aborted = false;
    (async () => {
      setLoading(true);
      try {
        // Tour date ayarlarını çek (Faz 2-D: door_row + tour_leader_name + captain_name dahil)
        const { data: tdRow, error: tdErr } = await db
          .from("tour_dates")
          .select("transport_type, seat_layout, seat_count, vehicle_plate, guide_name, door_row, tour_leader_name, captain_name")
          .eq("id", group.dateId)
          .single();
        if (tdErr) throw tdErr;
        if (aborted) return;
        setTransportType((tdRow?.transport_type as TransportType) || "");
        setSeatLayout((tdRow?.seat_layout as SeatLayout) || "");
        setSeatCount(tdRow?.seat_count != null ? String(tdRow.seat_count) : "");
        setVehiclePlate(tdRow?.vehicle_plate || "");
        setGuideName(tdRow?.guide_name || "");
        setDoorRow(tdRow?.door_row != null ? String(tdRow.door_row) : "");
        setTourLeaderName(tdRow?.tour_leader_name || "");
        setCaptainName(tdRow?.captain_name || "");

        // Settings dolu değilse ya da BUS değilse — settings formunu aç
        const needsSettings =
          !tdRow?.transport_type ||
          tdRow.transport_type !== "BUS" ||
          !tdRow.seat_layout ||
          !tdRow.seat_count;
        setSettingsOpen(needsSettings);

        // Aktif rezervasyonların yolcularını çek
        const activeRegIds = group.regs
          .filter((r) => r.status !== "CANCELLED")
          .map((r) => r.id);
        if (activeRegIds.length === 0) {
          setPassengers([]);
        } else {
          const { data: pData, error: pErr } = await db
            .from("registration_passengers")
            .select("id, registration_id, passenger_order, full_name, is_child, seat_no")
            .in("registration_id", activeRegIds)
            .order("passenger_order", { ascending: true });
          if (pErr) throw pErr;
          if (aborted) return;
          setPassengers((pData as unknown as PassengerSeat[]) || []);
        }
      } catch (err: any) {
        console.error("SeatPlan load error:", err);
        toast({
          title: t("admin.seatPlan.loadError", { defaultValue: "Koltuk planı yüklenemedi" }),
          description: err?.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group?.dateId]);

  const isBusConfigured =
    transportType === "BUS" && seatLayout && Number(seatCount) > 0;

  const rowSize = seatLayout === "2+2" ? 4 : 3;
  const totalSeats = Number(seatCount) || 0;
  // Sol taraf her zaman 2 koltuk (otobüs standardı); sağ taraf 2+2'de 2, 2+1'de 1 — kapı bu pozisyon(lar)ı kaplar.
  const leftSize = 2;
  const rightSize = seatLayout === "2+2" ? 2 : 1;
  // Kapı yoksa kullanılan "natural" satır sayısı (input max'ı için).
  const rowCount = totalSeats > 0 ? Math.ceil(totalSeats / rowSize) : 0;
  const doorRowNumRaw = doorRow && Number(doorRow) > 0 ? Number(doorRow) : null;

  // Faz 2-D2 (Kapı modeli düzeltmesi): Kapı bir EK satır DEĞİL; koltuk sırasının SAĞ tarafına gömülü.
  // Numaralandırma sürekli — kapı koltuk YOK ETMEZ, settings'te girilen koltuk sayısı korunur.
  // Örnek (44 koltuk, 2+2, doorRow=5):
  //   r1-4 dolu (1-16), r5 SOL=17,18 SAĞ=KAPI, r6 = 19-22, ... r12 = 43-44 (son yarım). 12 görsel satır.
  // Kapı sırasında sol 2 koltuk numaralanır; sağ 2 (2+2) veya 1 (2+1) pozisyon kapı kaplar.
  const { hasDoor, doorRowNum, seatPositionMap } = useMemo(() => {
    if (totalSeats === 0) {
      return {
        hasDoor: false,
        doorRowNum: null as number | null,
        seatPositionMap: new Map<number, { row: number; col: number }>(),
      };
    }
    const positions = new Map<number, { row: number; col: number }>();
    let seatCounter = 1;
    let row = 1;
    let doorReached = false;
    while (seatCounter <= totalSeats) {
      const isDoorRow = doorRowNumRaw != null && row === doorRowNumRaw;
      if (isDoorRow) doorReached = true;
      const seatsInThisRow = isDoorRow ? leftSize : rowSize;
      for (let i = 0; i < seatsInThisRow && seatCounter <= totalSeats; i++) {
        const positionInRow = i + 1;
        // Grid koridoru (col 3) atlanır → sağ koltuklar col 4, 5'e gider.
        const col = positionInRow >= 3 ? positionInRow + 1 : positionInRow;
        positions.set(seatCounter, { row, col });
        seatCounter++;
      }
      row++;
    }
    return {
      hasDoor: doorReached,
      doorRowNum: doorReached ? doorRowNumRaw : null,
      seatPositionMap: positions,
    };
  }, [totalSeats, doorRowNumRaw, rowSize, leftSize]);

  // Koltuk → yolcu map (atanmış olanlar)
  const seatToPassenger = useMemo(() => {
    const m = new Map<string, PassengerSeat>();
    for (const p of passengers) {
      if (p.seat_no) m.set(p.seat_no, p);
    }
    return m;
  }, [passengers]);

  // Atanmamış yolcular — group-bazlı sıralı (registration created_at sırası, içinde passenger_order)
  const unassignedPassengers = useMemo(() => {
    const regOrder = new Map<string, number>();
    const sortedRegs = (group?.regs || [])
      .filter((r) => r.status !== "CANCELLED")
      .slice()
      .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    sortedRegs.forEach((r, i) => regOrder.set(r.id, i));

    return passengers
      .filter((p) => !p.seat_no)
      .slice()
      .sort((a, b) => {
        const aIdx = regOrder.get(a.registration_id) ?? 999;
        const bIdx = regOrder.get(b.registration_id) ?? 999;
        if (aIdx !== bIdx) return aIdx - bIdx;
        return a.passenger_order - b.passenger_order;
      });
  }, [passengers, group]);

  const assignedCount = passengers.filter((p) => !!p.seat_no).length;

  const handleSaveSettings = async () => {
    if (!group) return;
    if (transportType === "BUS") {
      if (!seatLayout || !seatCount || Number(seatCount) <= 0) {
        toast({
          title: t("admin.seatPlan.fillRequired", {
            defaultValue: "Düzen ve koltuk sayısı zorunlu",
          }),
          variant: "destructive",
        });
        return;
      }
    }
    setSavingSettings(true);
    try {
      const _doorRowVal =
        transportType === "BUS" && doorRow && Number(doorRow) > 0 ? Number(doorRow) : null;
      const { error } = await db
        .from("tour_dates")
        .update({
          transport_type: transportType || null,
          seat_layout: transportType === "BUS" ? seatLayout || null : null,
          seat_count: transportType === "BUS" && seatCount ? Number(seatCount) : null,
          vehicle_plate: vehiclePlate || null,
          guide_name: guideName || null,
          // Faz 2-D
          door_row: _doorRowVal,
          tour_leader_name: tourLeaderName || null,
          captain_name: captainName || null,
        })
        .eq("id", group.dateId);
      if (error) throw error;
      toast({ title: t("admin.seatPlan.saved", { defaultValue: "Sefer ayarları kaydedildi" }) });
      setSettingsOpen(false);
      onDataChange?.();
    } catch (err: any) {
      console.error("SeatPlan settings save error:", err);
      toast({
        title: t("admin.seatPlan.saveError", { defaultValue: "Kaydedilemedi" }),
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  /**
   * Otomatik atama algoritması (sade — grup-bazlı zip):
   *  1. Aktif rezervasyonları created_at ASC sırala (eski önce).
   *  2. Her grup içinde passenger_order ASC.
   *  3. Büyük gruplar önce (4 kişilik ailenin tam sıraya gelmesi için).
   *  4. Boş koltukları 1..seat_count'tan al, sıralı dağıt.
   * Aynı rezervasyon yolcuları arka arkaya koltuk numarası alır → çoğu zaman yan yana düşer.
   */
  const handleAutoAssign = async () => {
    if (!group || !isBusConfigured) return;
    setAssigning(true);
    try {
      // 1+2) Grupla, içinde passenger_order ASC
      const activeRegs = (group.regs || [])
        .filter((r) => r.status !== "CANCELLED")
        .slice()
        .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
      const groupsMap = new Map<string, PassengerSeat[]>();
      for (const reg of activeRegs) {
        groupsMap.set(reg.id, []);
      }
      for (const p of passengers) {
        if (groupsMap.has(p.registration_id)) {
          groupsMap.get(p.registration_id)!.push(p);
        }
      }
      for (const arr of groupsMap.values()) {
        arr.sort((a, b) => a.passenger_order - b.passenger_order);
      }

      // 3) Büyük gruplar önce — 4'lü aile tam bir 2+2 sıraya gelsin
      const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => b.length - a.length);
      const flatList = sortedGroups.flat();

      // 4) Boş koltukları hesapla
      const assignedSeats = new Set(
        passengers.map((p) => p.seat_no).filter((s): s is string => !!s)
      );
      const freeSeats: string[] = [];
      for (let s = 1; s <= totalSeats; s++) {
        if (!assignedSeats.has(String(s))) freeSeats.push(String(s));
      }

      // 5) zip — flatList her elementine sıralı freeSeats ataması
      const updates: Array<{ id: string; seat_no: string }> = [];
      const limit = Math.min(flatList.length, freeSeats.length);
      for (let i = 0; i < limit; i++) {
        const p = flatList[i];
        if (!p.seat_no) {
          updates.push({ id: p.id, seat_no: freeSeats[i] });
        }
      }

      if (updates.length === 0) {
        toast({
          title: t("admin.seatPlan.allAssigned", {
            defaultValue: "Tüm yolcular zaten atanmış",
          }),
        });
        return;
      }

      // 6) Bulk UPDATE (her satır için ayrı — Supabase upsert risk: trigger önemli)
      for (const u of updates) {
        const { error } = await db
          .from("registration_passengers")
          .update({ seat_no: u.seat_no })
          .eq("id", u.id);
        if (error) {
          // Partial unique index çakışması olabilir (concurrent update)
          if (error.code === "23505") {
            console.warn("Seat conflict on auto-assign, skipping:", u);
            continue;
          }
          throw error;
        }
      }

      // Local state güncelle
      setPassengers((prev) =>
        prev.map((p) => {
          const u = updates.find((x) => x.id === p.id);
          return u ? { ...p, seat_no: u.seat_no } : p;
        })
      );
      toast({
        title: t("admin.seatPlan.autoAssignDone", {
          defaultValue: "Otomatik atama tamamlandı",
        }),
        description: `${updates.length} ${t("admin.seatPlan.passengerShort", {
          defaultValue: "yolcu",
        })}`,
      });
    } catch (err: any) {
      console.error("Auto assign error:", err);
      toast({
        title: t("admin.seatPlan.assignError", { defaultValue: "Atama başarısız" }),
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleAssignSeat = async (passengerId: string, seatNo: string | null) => {
    try {
      const { error } = await db
        .from("registration_passengers")
        .update({ seat_no: seatNo })
        .eq("id", passengerId);
      if (error) {
        if (error.code === "23505") {
          toast({
            title: t("admin.seatPlan.full", { defaultValue: "Koltuk dolu" }),
            variant: "destructive",
          });
          return;
        }
        throw error;
      }
      setPassengers((prev) =>
        prev.map((p) => (p.id === passengerId ? { ...p, seat_no: seatNo } : p))
      );
    } catch (err: any) {
      console.error("Seat assign error:", err);
      toast({
        title: t("admin.seatPlan.assignError", { defaultValue: "Atama başarısız" }),
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  const handleExportPdf = async () => {
    if (!group || !isBusConfigured) return;
    setExportingPdf(true);
    try {
      generateSeatPlanPDF({
        tourTitle: group.tourTitle,
        tourDestination: group.tourDestination,
        departureDate: group.departureDate,
        returnDate: group.returnDate,
        vehiclePlate: vehiclePlate || null,
        guideName: guideName || null,
        // Faz 2-D
        tourLeaderName: tourLeaderName || null,
        captainName: captainName || null,
        doorRow: doorRowNum,
        seatLayout: seatLayout as SeatLayout,
        seatCount: totalSeats,
        assignments: passengers
          .filter((p) => !!p.seat_no)
          .map((p) => ({
            seat_no: p.seat_no!,
            full_name: p.full_name,
            is_child: p.is_child,
          })),
      });
    } catch (err: any) {
      console.error("Seat plan PDF error:", err);
      toast({
        title: t("admin.seatPlan.pdfError", { defaultValue: "PDF oluşturulamadı" }),
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setExportingPdf(false);
    }
  };

  if (!group) return null;

  const dateText = group.departureDate
    ? format(new Date(group.departureDate), "d MMM yyyy", { locale: dateLocale })
    : "—";
  const returnText = group.returnDate
    ? ` → ${format(new Date(group.returnDate), "d MMM yyyy", { locale: dateLocale })}`
    : "";

  const initials = (name: string) => {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // CSS Grid template — 2+2: 5 col (2 sol + koridor + 2 sağ), 2+1: 4 col.
  // Koltuk pozisyonları yukarıdaki seatPositionMap'ten geliyor (kapı sırasında sağ
  // tarafı boş bırakır, kapı div'i o boşluğu doldurur).
  const gridTemplate =
    seatLayout === "2+2"
      ? "grid-cols-[1fr_1fr_24px_1fr_1fr]"
      : "grid-cols-[1fr_1fr_24px_1fr]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] sm:max-h-[88vh] flex flex-col overflow-hidden p-0 gap-0 bg-card">
        <DialogHeader className="flex-shrink-0 px-6 py-5 border-b border-border/60">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            {t("admin.seatPlan.eyebrow", { defaultValue: "Sefer Düzeni" })}
          </p>
          <DialogTitle className="text-lg font-semibold tracking-tight">
            {t("admin.seatPlan.title", { defaultValue: "Koltuk Planı" })}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-1.5 mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/40 text-xs font-medium text-foreground truncate max-w-[200px]">
              {group.tourTitle}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/40 text-xs font-medium text-foreground tabular-nums">
              {dateText}{returnText}
            </span>
            {vehiclePlate && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/40 text-xs font-medium text-foreground font-mono tabular-nums">
                {vehiclePlate}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 min-h-0 flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {/* Sefer Ayarları */}
            {settingsOpen ? (
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">
                  {t("admin.seatPlan.settings", { defaultValue: "Sefer Ayarları" })}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="transport_type" className="text-xs">
                      {t("admin.seatPlan.transportType", { defaultValue: "Sefer Tipi" })}
                    </Label>
                    <Select
                      value={transportType}
                      onValueChange={(v) => setTransportType(v as TransportType)}
                    >
                      <SelectTrigger id="transport_type">
                        <SelectValue
                          placeholder={t("admin.seatPlan.transportType", { defaultValue: "Sefer Tipi" })}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BUS">
                          {t("admin.seatPlan.transportTypes.BUS", { defaultValue: "Otobüs" })}
                        </SelectItem>
                        <SelectItem value="PLANE">
                          {t("admin.seatPlan.transportTypes.PLANE", { defaultValue: "Uçak" })}
                        </SelectItem>
                        <SelectItem value="BOAT">
                          {t("admin.seatPlan.transportTypes.BOAT", { defaultValue: "Tekne" })}
                        </SelectItem>
                        <SelectItem value="PRIVATE">
                          {t("admin.seatPlan.transportTypes.PRIVATE", { defaultValue: "Özel Araç" })}
                        </SelectItem>
                        <SelectItem value="OTHER">
                          {t("admin.seatPlan.transportTypes.OTHER", { defaultValue: "Diğer" })}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {transportType === "BUS" && (
                    <>
                      <div className="space-y-1">
                        <Label htmlFor="seat_layout" className="text-xs">
                          {t("admin.seatPlan.layout", { defaultValue: "Düzen" })}
                        </Label>
                        <Select
                          value={seatLayout}
                          onValueChange={(v) => setSeatLayout(v as SeatLayout)}
                        >
                          <SelectTrigger id="seat_layout">
                            <SelectValue placeholder="2+2 / 2+1" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2+2">2+2</SelectItem>
                            <SelectItem value="2+1">2+1</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="seat_count" className="text-xs">
                          {t("admin.seatPlan.seatCount", { defaultValue: "Koltuk Sayısı" })}
                        </Label>
                        <Input
                          id="seat_count"
                          type="number"
                          min={1}
                          max={100}
                          value={seatCount}
                          onChange={(e) => setSeatCount(e.target.value)}
                          placeholder="44"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="vehicle_plate" className="text-xs">
                          {t("admin.seatPlan.vehiclePlate", { defaultValue: "Plaka" })}
                        </Label>
                        <Input
                          id="vehicle_plate"
                          value={vehiclePlate}
                          onChange={(e) => setVehiclePlate(e.target.value)}
                          placeholder="34 ABC 123"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="door_row" className="text-xs">
                          {t("admin.seatPlan.doorRow", { defaultValue: "Orta Kapı Boşluğu" })}
                        </Label>
                        <Input
                          id="door_row"
                          type="number"
                          min={1}
                          max={Math.max(1, rowCount - 1) || 99}
                          value={doorRow}
                          onChange={(e) => setDoorRow(e.target.value)}
                          placeholder={t("admin.seatPlan.doorRowPlaceholder", { defaultValue: "boş = kapı yok" })}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          {t("admin.seatPlan.doorRowHelp", {
                            defaultValue: "Kapının olduğu sıra numarasını girin (kapı sıranın sağ tarafına açılır; sol koltuklar dolu kalır)",
                          })}
                        </p>
                      </div>
                    </>
                  )}

                  {/* Faz 2-D: Personel — her zaman görünür (BUS dışı seferlerde de işe yarayabilir) */}
                  <div className="space-y-1">
                    <Label htmlFor="guide_name" className="text-xs">
                      {t("admin.seatPlan.guideName", { defaultValue: "Rehber" })}
                    </Label>
                    <Input
                      id="guide_name"
                      value={guideName}
                      onChange={(e) => setGuideName(e.target.value)}
                      placeholder={t("admin.seatPlan.guideName", { defaultValue: "Rehber" })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="tour_leader_name" className="text-xs">
                      {t("admin.seatPlan.tourLeaderName", { defaultValue: "Tur Lideri" })}
                    </Label>
                    <Input
                      id="tour_leader_name"
                      value={tourLeaderName}
                      onChange={(e) => setTourLeaderName(e.target.value)}
                      placeholder={t("admin.seatPlan.tourLeaderName", { defaultValue: "Tur Lideri" })}
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="captain_name" className="text-xs">
                      {t("admin.seatPlan.captainName", { defaultValue: "Kaptan" })}
                    </Label>
                    <Input
                      id="captain_name"
                      value={captainName}
                      onChange={(e) => setCaptainName(e.target.value)}
                      placeholder={t("admin.seatPlan.captainName", { defaultValue: "Kaptan" })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  {isBusConfigured && (
                    <Button
                      variant="outline"
                      onClick={() => setSettingsOpen(false)}
                      disabled={savingSettings}
                    >
                      {t("common.cancel", { defaultValue: "İptal" })}
                    </Button>
                  )}
                  <Button onClick={handleSaveSettings} disabled={savingSettings}>
                    {savingSettings ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {t("admin.seatPlan.save", { defaultValue: "Kaydet" })}
                  </Button>
                </div>
              </div>
            ) : !isBusConfigured ? (
              <div className="py-8 text-center text-sm text-muted-foreground space-y-3">
                <p>
                  {t("admin.seatPlan.notBus", {
                    defaultValue:
                      "Bu sefer otobüs değil. Koltuk planı sadece otobüs seferlerinde kullanılır.",
                  })}
                </p>
                <Button variant="outline" onClick={() => setSettingsOpen(true)}>
                  <Settings className="w-4 h-4 mr-2" />
                  {t("admin.seatPlan.settings", { defaultValue: "Sefer Ayarları" })}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* P2: Settings COLLAPSED bar — tek satır özet + Düzenle */}
                <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border/60 bg-muted/20 flex-wrap">
                  <div className="flex items-center gap-2 text-xs flex-wrap min-w-0">
                    <span className="inline-flex items-center gap-1 font-medium text-foreground">
                      <Settings className="w-3 h-3 text-muted-foreground" />
                      {t("admin.seatPlan.transportTypes.BUS", { defaultValue: "Otobüs" })}
                    </span>
                    <span className="text-muted-foreground/60">·</span>
                    <span className="font-mono tabular-nums">{seatLayout}</span>
                    <span className="text-muted-foreground/60">·</span>
                    <span>
                      <span className="font-mono tabular-nums font-semibold">{totalSeats}</span>{" "}
                      <span className="text-muted-foreground">
                        {t("admin.seatPlan.seats", { defaultValue: "koltuk" })}
                      </span>
                    </span>
                    {doorRowNum != null && (
                      <>
                        <span className="text-muted-foreground/60">·</span>
                        <span className="text-muted-foreground">
                          {t("admin.seatPlan.middleDoor", { defaultValue: "Orta Kapı" })}
                        </span>{" "}
                        <span className="font-mono tabular-nums font-semibold">{doorRowNum}</span>
                      </>
                    )}
                    {vehiclePlate && (
                      <>
                        <span className="text-muted-foreground/60">·</span>
                        <span className="font-mono tabular-nums">{vehiclePlate}</span>
                      </>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSettingsOpen(true)}
                    className="h-7 px-2 text-xs"
                  >
                    <Settings className="w-3.5 h-3.5 mr-1" />
                    {t("admin.seatPlan.edit", { defaultValue: "Düzenle" })}
                  </Button>
                </div>

                {/* Toolbar — Doluluk özet + Otomatik Ata + PDF (kompakt) */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm flex items-baseline gap-1">
                    <span className="text-2xl font-mono tabular-nums font-bold leading-none">
                      {assignedCount}
                    </span>
                    <span className="text-base font-mono tabular-nums text-muted-foreground leading-none">
                      /{totalSeats}
                    </span>
                    <span className="ml-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      {t("admin.seatPlan.assigned", { defaultValue: "atandı" })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAutoAssign}
                      disabled={assigning || unassignedPassengers.length === 0}
                    >
                      {assigning ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      {t("admin.seatPlan.autoAssign", { defaultValue: "Otomatik Ata" })}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportPdf}
                      disabled={exportingPdf}
                    >
                      {exportingPdf ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4 mr-2" />
                      )}
                      {t("admin.seatPlan.exportPdf", { defaultValue: "PDF İndir" })}
                    </Button>
                  </div>
                </div>

                {/* P2: İki-kolon yapı — sol grid, sağ sticky atanmamış panel */}
                <div className="flex flex-col md:flex-row gap-4">

                {/* SOL — Otobüs şeması (geniş alan) */}
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium text-center mb-1">
                    {seatLayout === "2+2"
                      ? `${t("admin.seatPlan.layout", { defaultValue: "Düzen" })} · 2+2`
                      : `${t("admin.seatPlan.layout", { defaultValue: "Düzen" })} · 2+1`}
                  </div>
                  <div className="max-w-md mx-auto py-6 px-4 bg-muted/20 rounded-xl border border-border/40">
                  {/* Implicit CSS Grid row sizing: parent height yok → satırlar içerik
                      yüksekliği kadar olur. Her koltuk h-14 (56px); kapı da aynı yükseklikte
                      (sıraya gömülü). */}
                  <div
                    className={`grid ${gridTemplate} gap-2`}
                    role="grid"
                  >
                    {/* Kapı — koltuk sırasının SAĞ tarafına gömülü, sol koltukları yok etmez.
                        2+2: cols 4-5 (2 pozisyon), 2+1: col 4 (1 pozisyon). Yükseklik h-14
                        (koltuklarla aynı). Koltuk numaralandırma sürekli; kapı sırasında
                        sol 2 koltuk numaralanır, sağ taraf bu div ile kaplanır. */}
                    {hasDoor && (
                      <div
                        style={{
                          gridRow: doorRowNum as number,
                          gridColumn: `4 / ${4 + rightSize}`,
                        }}
                        className="h-14 rounded-md border-2 border-dashed border-muted-foreground/40 bg-muted/50 flex flex-col items-center justify-center gap-0.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium"
                        aria-label={t("admin.seatPlan.middleDoor", { defaultValue: "Orta Kapı" })}
                      >
                        <DoorOpen className="w-3.5 h-3.5" />
                        {t("admin.seatPlan.middleDoor", { defaultValue: "Orta Kapı" })}
                      </div>
                    )}
                    {Array.from({ length: totalSeats }).map((_, idx) => {
                      const seatNo = idx + 1;
                      const pos = seatPositionMap.get(seatNo);
                      if (!pos) return null;
                      const assigned = seatToPassenger.get(String(seatNo));
                      return (
                        <SeatCell
                          key={`s-${seatNo}`}
                          row={pos.row}
                          col={pos.col}
                          seatNo={seatNo}
                          passenger={assigned}
                          initials={assigned ? initials(assigned.full_name) : null}
                          isChild={!!assigned?.is_child}
                          unassignedPassengers={unassignedPassengers}
                          onAssign={(pid) => handleAssignSeat(pid, String(seatNo))}
                          onClear={() =>
                            assigned ? handleAssignSeat(assigned.id, null) : undefined
                          }
                          tLabels={{
                            assign: t("admin.seatPlan.assignPassenger", {
                              defaultValue: "Yolcu Ata",
                            }),
                            clear: t("admin.seatPlan.removeAssignment", {
                              defaultValue: "Atamayı Kaldır",
                            }),
                            empty: t("admin.seatPlan.empty", { defaultValue: "Boş" }),
                            noUnassigned: t("admin.seatPlan.noUnassigned", {
                              defaultValue: "Atanmamış yolcu yok",
                            }),
                            child: t("admin.passengers.isChild", { defaultValue: "Çocuk" }),
                          }}
                        />
                      );
                    })}
                  </div>
                  </div>
                </div>

                {/* SAĞ — Sticky atanmamış yolcular paneli */}
                <aside className="md:w-[220px] shrink-0 md:sticky md:top-0 md:self-start">
                  <div className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
                    <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold flex items-center justify-between">
                      <span>
                        {t("admin.seatPlan.unassigned", { defaultValue: "Atanmamış Yolcular" })}
                      </span>
                      <span className="font-mono tabular-nums text-foreground font-bold">
                        {unassignedPassengers.length}
                      </span>
                    </h3>
                    {unassignedPassengers.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        {t("admin.seatPlan.allAssigned", { defaultValue: "Tüm yolcular atandı" })}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-[300px] md:max-h-[400px] overflow-y-auto -mx-1 px-1">
                        {unassignedPassengers.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs hover:bg-accent/40 hover:border-primary/30 transition-colors cursor-grab active:cursor-grabbing"
                            title={t("admin.seatPlan.assignHint", {
                              defaultValue:
                                "Atamak için bir koltuk seçin (boş koltuğa tıkla → yolcuyu listeden seç)",
                            })}
                          >
                            <span className="shrink-0 font-mono tabular-nums text-muted-foreground text-[10px]">
                              #{p.passenger_order}
                            </span>
                            <span className="flex-1 truncate">{p.full_name}</span>
                            {p.is_child && (
                              <span className="shrink-0 text-[9px] bg-orange-500/15 text-orange-700 dark:text-orange-400 rounded px-1 font-medium">
                                {t("admin.passengers.isChild", { defaultValue: "Çocuk" })}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </aside>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close", { defaultValue: "Kapat" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface SeatCellProps {
  row: number;
  col: number;
  seatNo: number;
  passenger?: PassengerSeat;
  initials: string | null;
  isChild: boolean;
  unassignedPassengers: PassengerSeat[];
  onAssign: (passengerId: string) => void;
  onClear: () => void;
  tLabels: {
    assign: string;
    clear: string;
    empty: string;
    noUnassigned: string;
    child: string;
  };
}

const SeatCell = ({
  row,
  col,
  seatNo,
  passenger,
  initials,
  isChild,
  unassignedPassengers,
  onAssign,
  onClear,
  tLabels,
}: SeatCellProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          style={{ gridRow: row, gridColumn: col }}
          className={`
            relative h-14 rounded-md border-2 text-xs font-medium transition-all duration-150
            ${
              passenger
                ? isChild
                  ? "bg-orange-500/15 border-orange-500/40 hover:bg-orange-500/25 hover:-translate-y-0.5"
                  : "bg-primary/15 border-primary/40 hover:bg-primary/25 hover:-translate-y-0.5"
                : "bg-background border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary/60 hover:bg-primary/5 hover:text-primary hover:-translate-y-0.5"
            }
          `}
          aria-label={passenger ? `${seatNo}: ${passenger.full_name}` : `${tLabels.assign} ${seatNo}`}
          title={passenger ? `${seatNo}: ${passenger.full_name}` : `${seatNo}: ${tLabels.empty}`}
        >
          {/* Atanmış indicator: sağ üst dot */}
          {passenger && (
            <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${isChild ? "bg-orange-500/80" : "bg-primary/80"}`} />
          )}
          <span
            className={`absolute top-0.5 left-1 text-[10px] font-mono tabular-nums ${
              passenger ? "opacity-60" : "font-semibold opacity-90"
            }`}
          >
            {seatNo}
          </span>
          {passenger ? (
            <span className="block mt-1 text-[11px] font-semibold leading-tight">
              {initials}
            </span>
          ) : (
            <span className="block mt-1 text-base leading-none select-none">+</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="center">
        {passenger ? (
          <div className="space-y-2">
            <div className="text-xs">
              <p className="font-semibold">{passenger.full_name}</p>
              <p className="text-muted-foreground">
                #{passenger.passenger_order}
                {isChild && ` · ${tLabels.child}`}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={onClear}
            >
              <X className="w-3.5 h-3.5 mr-1.5" />
              {tLabels.clear}
            </Button>
          </div>
        ) : unassignedPassengers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            {tLabels.noUnassigned}
          </p>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            <p className="text-xs font-semibold mb-1">
              {tLabels.assign}
            </p>
            {unassignedPassengers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onAssign(p.id)}
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent flex items-center justify-between gap-2"
              >
                <span className="truncate">{p.full_name}</span>
                <span className="font-mono text-muted-foreground shrink-0">
                  #{p.passenger_order}
                </span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
