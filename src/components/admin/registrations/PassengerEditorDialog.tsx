import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Loader2, UserPlus, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// NOT: registration_passengers tablosu Faz 2-A migration'ı ile DB'ye eklenince
// `supabase gen types typescript` ile types.ts regenerate edilmeli. O zamana kadar
// `(supabase as any)` cast'leri kompiler hatalarını susturur; runtime'da sorun yok.
// Types regenerate edildikten sonra `as any` cast'leri kaldırılabilir.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/**
 * Faz 2-A: Yolcu Listesi düzenleme dialog'u.
 *
 * Akış:
 *   - Mount: registration_id ile yolcuları çek (passenger_order ASC).
 *   - Inline edit: full_name, identity_no, passport_no, birth_date, is_child.
 *   - Yolcu Ekle: yeni placeholder + registrations.pax +1 UPDATE (tutarlı).
 *   - Yolcu Sil: satır sil + registrations.pax -1 UPDATE. Dolu (placeholder olmayan)
 *     satır silinirken onay sorulur. Pax integrity guard'ı DB'de de korur.
 *   - Kaydet: passenger satırlarını topluca UPDATE.
 *
 * GÜVENLİK: agency_id frontend'den geçirilmez — RLS get_user_agency_id() ile filtreler.
 * INSERT'te agency_id parent registration'dan alınır (tek bir SELECT ile).
 */

export interface PassengerRow {
  id: string;
  registration_id: string;
  agency_id: string;
  passenger_order: number;
  full_name: string;
  identity_no?: string | null;
  passport_no?: string | null;
  birth_date?: string | null;
  is_child?: boolean;
  notes?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: string | null;
  registrationFullName?: string;
  initialPax: number;
  /** Pax değişince parent listeyi yenilesin */
  onPaxChange?: (newPax: number) => void;
}

const PLACEHOLDER_PREFIX = "Yolcu "; // "Yolcu 2", "Yolcu 3"... — silmeden önce uyarı için

export const PassengerEditorDialog = ({
  open,
  onOpenChange,
  registrationId,
  initialPax,
  onPaxChange,
}: Props) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [passengers, setPassengers] = useState<PassengerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<PassengerRow | null>(null);

  useEffect(() => {
    if (!open || !registrationId) return;
    let aborted = false;
    (async () => {
      setLoading(true);
      const { data, error } = await db
        .from("registration_passengers")
        .select("*")
        .eq("registration_id", registrationId)
        .order("passenger_order", { ascending: true });
      if (aborted) return;
      if (error) {
        console.error("Passengers load error:", error);
        toast({
          title: t("admin.passengers.error", { defaultValue: "Yolcu kaydı başarısız" }),
          description: error.message,
          variant: "destructive",
        });
        setPassengers([]);
      } else {
        setPassengers((data as unknown as PassengerRow[]) || []);
      }
      setLoading(false);
    })();
    return () => {
      aborted = true;
    };
  }, [open, registrationId, t, toast]);

  const isPlaceholder = (p: PassengerRow) =>
    !!p.full_name && p.full_name.startsWith(PLACEHOLDER_PREFIX);

  const updateField = <K extends keyof PassengerRow>(
    id: string,
    field: K,
    value: PassengerRow[K]
  ) => {
    setPassengers((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleAddPassenger = async () => {
    if (!registrationId) return;
    setMutating(true);
    try {
      // 1) Parent registration'dan agency_id al — RLS bypass değil, sadece doğru değeri yaz
      const { data: regRow, error: regErr } = await db
        .from("registrations")
        .select("agency_id, pax")
        .eq("id", registrationId)
        .single();
      if (regErr || !regRow) throw regErr || new Error("Registration not found");

      const nextOrder = (passengers.reduce((m, p) => Math.max(m, p.passenger_order), 0) || 0) + 1;
      const newPax = (regRow.pax || passengers.length) + 1;

      // 2) Yolcu satırı ekle
      const { data: newPassenger, error: insErr } = await db
        .from("registration_passengers")
        .insert({
          registration_id: registrationId,
          agency_id: regRow.agency_id,
          passenger_order: nextOrder,
          full_name: `${PLACEHOLDER_PREFIX}${nextOrder}`,
        })
        .select("*")
        .single();
      if (insErr) throw insErr;

      // 3) Registration.pax artır (DB guard zaten yolcu sayısı > pax engelliyor — bu artırıyor, sorunsuz)
      const { error: paxErr } = await db
        .from("registrations")
        .update({ pax: newPax })
        .eq("id", registrationId);
      if (paxErr) throw paxErr;

      setPassengers((prev) => [...prev, newPassenger as unknown as PassengerRow]);
      onPaxChange?.(newPax);
      toast({
        title: t("admin.passengers.added", { defaultValue: "Yolcu eklendi" }),
      });
    } catch (err: any) {
      console.error("Add passenger error:", err);
      toast({
        title: t("admin.passengers.error", { defaultValue: "Yolcu kaydı başarısız" }),
        description: err?.message ?? "",
        variant: "destructive",
      });
    } finally {
      setMutating(false);
    }
  };

  const performRemove = async (passenger: PassengerRow) => {
    if (!registrationId) return;
    setMutating(true);
    try {
      // 1) Önce pax düş — DB guard yolcu_count <= pax kuralını korur.
      //    DELETE'ten ÖNCE pax düşürürsek count hala eski → guard reddeder.
      //    O yüzden ÖNCE DELETE, SONRA pax düş.
      const { error: delErr } = await db
        .from("registration_passengers")
        .delete()
        .eq("id", passenger.id);
      if (delErr) throw delErr;

      const newPax = Math.max(1, passengers.length - 1);
      const { error: paxErr } = await db
        .from("registrations")
        .update({ pax: newPax })
        .eq("id", registrationId);
      if (paxErr) {
        // Pax güncellenemese bile yolcu silindi — log + uyarı
        console.error("Pax sync after passenger delete failed:", paxErr);
      }

      setPassengers((prev) => prev.filter((p) => p.id !== passenger.id));
      onPaxChange?.(newPax);
      setConfirmRemove(null);
      toast({
        title: t("admin.passengers.removed", { defaultValue: "Yolcu silindi" }),
      });
    } catch (err: any) {
      console.error("Remove passenger error:", err);
      toast({
        title: t("admin.passengers.error", { defaultValue: "Yolcu kaydı başarısız" }),
        description: err?.message ?? "",
        variant: "destructive",
      });
    } finally {
      setMutating(false);
    }
  };

  const handleRemoveClick = (passenger: PassengerRow) => {
    // En az 1 yolcu kalmalı
    if (passengers.length <= 1) {
      toast({
        title: t("admin.passengers.minOneRequired", {
          defaultValue: "En az 1 yolcu gerekli",
        }),
        variant: "destructive",
      });
      return;
    }
    if (isPlaceholder(passenger)) {
      // Placeholder ise direkt sil — onay yok
      performRemove(passenger);
    } else {
      // Dolu yolcu — onay sor
      setConfirmRemove(passenger);
    }
  };

  const handleSave = async () => {
    if (!registrationId) return;
    setSaving(true);
    try {
      // Topluca UPDATE — her satır için ayrı UPDATE (Supabase upsert batch kullanılabilir
      // ama on-conflict UNIQUE constraint var; ayrı UPDATE daha güvenli)
      for (const p of passengers) {
        const { error } = await db
          .from("registration_passengers")
          .update({
            full_name: p.full_name,
            identity_no: p.identity_no || null,
            passport_no: p.passport_no || null,
            birth_date: p.birth_date || null,
            is_child: !!p.is_child,
            notes: p.notes || null,
          })
          .eq("id", p.id);
        if (error) throw error;
      }
      toast({
        title: t("admin.passengers.saved", { defaultValue: "Yolcular kaydedildi" }),
      });
      onOpenChange(false);
    } catch (err: any) {
      console.error("Save passengers error:", err);
      toast({
        title: t("admin.passengers.error", { defaultValue: "Yolcu kaydı başarısız" }),
        description: err?.message ?? "",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* FIX: flex chain'de min-h-0 + native scroll div — ScrollArea Radix primitive
            parent flex chain'inde min-h-0 olmadan max-h tetiklemiyordu (modern flex tuzağı:
            flex item'ın min-height default'u "auto" → content boyu kadar büyür, max-h yenilmez).
            Header + footer flex-shrink-0 ile kayboldukça küçülmez; sadece liste alanı kayar. */}
        <DialogContent className="max-w-3xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="flex-shrink-0 px-6 py-5 border-b border-border/60">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">
              {t("admin.passengers.eyebrow", { defaultValue: "Yolcu Listesi" })}
            </p>
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {t("admin.passengers.title", { defaultValue: "Yolcu Listesi" })}
            </DialogTitle>
            <DialogDescription>
              {t("admin.passengers.description", {
                defaultValue:
                  "Her yolcunun bilgilerini girin. Boş bırakılırsa placeholder olarak kalır.",
              })}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex-1 min-h-0 flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : passengers.length === 0 ? (
            <div className="flex-1 min-h-0 py-8 text-center text-sm text-muted-foreground">
              {t("admin.passengers.empty", { defaultValue: "Yolcu bulunamadı" })}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
              <div className="space-y-3">
                {passengers.map((p) => (
                  <div
                    key={p.id}
                    className="border border-border/60 rounded-lg p-4 space-y-3 bg-card"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <span className="text-[11px] font-mono tabular-nums uppercase tracking-wider text-muted-foreground/70 font-medium">
                        #{p.passenger_order}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveClick(p)}
                        disabled={mutating || passengers.length <= 1}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        {t("admin.passengers.removePassenger", { defaultValue: "Yolcu Sil" })}
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor={`name-${p.id}`} className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                          {t("admin.passengers.fullName", { defaultValue: "Ad Soyad" })}
                        </Label>
                        <Input
                          id={`name-${p.id}`}
                          value={p.full_name}
                          onChange={(e) => updateField(p.id, "full_name", e.target.value)}
                          placeholder={`${PLACEHOLDER_PREFIX}${p.passenger_order}`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`id-${p.id}`} className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                          {t("admin.passengers.identityNo", { defaultValue: "Kimlik No" })}
                        </Label>
                        <Input
                          id={`id-${p.id}`}
                          value={p.identity_no ?? ""}
                          onChange={(e) => updateField(p.id, "identity_no", e.target.value)}
                          placeholder="11111111111"
                          inputMode="numeric"
                          className="font-mono tabular-nums"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`passport-${p.id}`} className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                          {t("admin.passengers.passportNo", { defaultValue: "Pasaport No" })}
                        </Label>
                        <Input
                          id={`passport-${p.id}`}
                          value={p.passport_no ?? ""}
                          onChange={(e) => updateField(p.id, "passport_no", e.target.value)}
                          placeholder="U12345678"
                          className="font-mono tabular-nums"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`birth-${p.id}`} className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                          {t("admin.passengers.birthDate", { defaultValue: "Doğum Tarihi" })}
                        </Label>
                        <Input
                          id={`birth-${p.id}`}
                          type="date"
                          value={p.birth_date ?? ""}
                          onChange={(e) => updateField(p.id, "birth_date", e.target.value)}
                          className="font-mono tabular-nums"
                        />
                      </div>
                      <div className="flex items-end gap-2 pb-1">
                        <Checkbox
                          id={`child-${p.id}`}
                          checked={!!p.is_child}
                          onCheckedChange={(checked) =>
                            updateField(p.id, "is_child", checked === true)
                          }
                        />
                        <Label htmlFor={`child-${p.id}`} className="text-sm font-normal cursor-pointer">
                          {t("admin.passengers.isChild", { defaultValue: "Çocuk" })}
                        </Label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="flex-shrink-0 flex-col sm:flex-row gap-2 sm:gap-2 px-6 py-4 border-t bg-background">
            <Button
              variant="outline"
              onClick={handleAddPassenger}
              disabled={mutating || saving}
              className="w-full sm:w-auto"
            >
              {mutating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              {t("admin.passengers.addPassenger", { defaultValue: "Yolcu Ekle" })}
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {t("common.cancel", { defaultValue: "İptal" })}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || loading || passengers.length === 0}
              className="w-full sm:w-auto"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {t("admin.passengers.save", { defaultValue: "Kaydet" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dolu yolcu silme onayı */}
      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.passengers.confirmRemoveTitle", {
                defaultValue: "Yolcu silinsin mi?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.passengers.confirmRemoveDesc", {
                defaultValue:
                  "Bu yolcunun bilgileri silinecek. Bu işlem geri alınamaz.",
              })}
              {confirmRemove && (
                <span className="block mt-2 font-medium text-foreground">
                  #{confirmRemove.passenger_order} — {confirmRemove.full_name}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", { defaultValue: "İptal" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRemove && performRemove(confirmRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("admin.passengers.removePassenger", { defaultValue: "Yolcu Sil" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
