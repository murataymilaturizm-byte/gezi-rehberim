import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface Tour {
  id: string;
  title: string;
  tur_kategorisi?: string;
  currency?: string;
  tour_dates: Array<{
    id: string;
    departure_date: string;
    price_adult: number;
  }>;
}

interface ManualRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tours: Tour[];
  onSuccess: () => void;
  agencyId: string | null;
}

const STEPS = [
  { key: "tour", label: "Tur & Tarih" },
  { key: "customer", label: "Müşteri Bilgileri" },
  { key: "payment", label: "Ödeme & Not" },
];

export const ManualRegistrationDialog = ({
  open,
  onOpenChange,
  tours,
  onSuccess,
  agencyId
}: ManualRegistrationDialogProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  
  const [formData, setFormData] = useState({
    tourId: "",
    tourDateId: "",
    fullName: "",
    phone: "",
    paxAdult: "1",
    sourceChannel: "PHONE",
    paymentStatus: "UNPAID",
    depositAmount: "",
    notes: ""
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(0);
      setFormData({
        tourId: "",
        tourDateId: "",
        fullName: "",
        phone: "",
        paxAdult: "1",
        sourceChannel: "PHONE",
        paymentStatus: "UNPAID",
        depositAmount: "",
        notes: ""
      });
    }
  }, [open]);

  const selectedTour = tours.find(t => t.id === formData.tourId);
  const availableDates = selectedTour?.tour_dates || [];
  const selectedDate = availableDates.find(d => d.id === formData.tourDateId);
  const totalAmount = selectedDate ? selectedDate.price_adult * parseInt(formData.paxAdult || "1") : 0;

  const set = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  const canProceed = () => {
    if (step === 0) return formData.tourId && formData.tourDateId;
    if (step === 1) return formData.fullName.length >= 2 && formData.phone.length >= 10;
    return true;
  };

  const handleSubmit = async () => {
    if (!agencyId) {
      toast({ title: "Hata", description: "Ajans bilgisi bulunamadı", variant: "destructive" });
      return;
    }

    if (formData.paymentStatus === "DEPOSIT" && (!formData.depositAmount || parseFloat(formData.depositAmount) <= 0)) {
      toast({ title: "Hata", description: t("admin.registrations.enterDepositAmount"), variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const pax = parseInt(formData.paxAdult);
      const depositAmount = formData.paymentStatus === "DEPOSIT" ? parseFloat(formData.depositAmount) : null;
      const paidAmount = formData.paymentStatus === "DEPOSIT" ? parseFloat(formData.depositAmount) : 
                        formData.paymentStatus === "PAID" ? totalAmount : 0;

      const { error } = await supabase.from("registrations").insert({
        agency_id: agencyId,
        tour_id: formData.tourId,
        tour_date_id: formData.tourDateId,
        full_name: formData.fullName,
        phone: formData.phone,
        pax,
        source_channel: formData.sourceChannel,
        payment_status: formData.paymentStatus,
        deposit_amount: depositAmount,
        paid_amount: paidAmount,
        total_amount: totalAmount,
        note: formData.notes || null,
        status: "NEW"
      });

      if (error) throw error;

      toast({ title: "Başarılı", description: "Kayıt başarıyla eklendi" });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Manual registration error:", error);
      toast({ title: "Hata", description: "Kayıt eklenirken bir hata oluştu", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manuel Kayıt Ekle</DialogTitle>
          <DialogDescription>
            {STEPS[step].label} ({step + 1}/{STEPS.length})
          </DialogDescription>
        </DialogHeader>

        {/* Stepper indicator */}
        <div className="flex items-center gap-1 mb-2">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex-1">
              <div className={cn("h-1.5 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-muted")} />
            </div>
          ))}
        </div>

        <div className="space-y-4 pt-2 min-h-[220px]">
          {/* STEP 1: Tour & Date Selection */}
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label>Tur Kategorisi</Label>
                <Select value={categoryFilter} onValueChange={(v) => {
                  setCategoryFilter(v);
                  set("tourId", "");
                  set("tourDateId", "");
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tüm Kategoriler</SelectItem>
                    {TOUR_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tur *</Label>
                <Select value={formData.tourId} onValueChange={(v) => {
                  set("tourId", v);
                  set("tourDateId", "");
                }}>
                  <SelectTrigger><SelectValue placeholder="Tur seçin" /></SelectTrigger>
                  <SelectContent>
                    {filteredTours.map((tour) => (
                      <SelectItem key={tour.id} value={tour.id}>{tour.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tur Tarihi *</Label>
                <Select value={formData.tourDateId} onValueChange={(v) => set("tourDateId", v)} disabled={!formData.tourId}>
                  <SelectTrigger><SelectValue placeholder="Tarih seçin" /></SelectTrigger>
                  <SelectContent>
                    {availableDates.map((date) => (
                      <SelectItem key={date.id} value={date.id}>
                        {format(new Date(date.departure_date), "d MMMM yyyy", { locale: tr })} — {date.price_adult} {selectedTour?.currency || "TRY"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedDate && (
                <div className="p-3 rounded-lg bg-accent/50 text-sm space-y-1">
                  <div className="font-medium">{selectedTour?.title}</div>
                  <div className="text-muted-foreground">
                    {format(new Date(selectedDate.departure_date), "d MMMM yyyy", { locale: tr })}
                  </div>
                  <div className="text-muted-foreground">Kişi başı: {selectedDate.price_adult} {selectedTour?.currency || "TRY"}</div>
                </div>
              )}
            </>
          )}

          {/* STEP 2: Customer Info */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Müşteri Adı *</Label>
                <Input
                  value={formData.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  placeholder="Ad Soyad"
                />
              </div>

              <div className="space-y-2">
                <Label>Telefon *</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+90 555 123 4567"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kişi Sayısı</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.paxAdult}
                    onChange={(e) => set("paxAdult", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Kaynak Kanal</Label>
                  <Select value={formData.sourceChannel} onValueChange={(v) => set("sourceChannel", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PHONE">📞 Telefon</SelectItem>
                      <SelectItem value="OFFICE">🏢 Ofis</SelectItem>
                      <SelectItem value="INSTAGRAM">📸 Instagram</SelectItem>
                      <SelectItem value="WHATSAPP">💬 WhatsApp</SelectItem>
                      <SelectItem value="OTHER">📋 Diğer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedDate && (
                <div className="p-3 rounded-lg bg-accent/50 text-sm">
                  <span className="font-medium">Toplam: </span>
                  {totalAmount} {selectedTour?.currency || "TRY"} ({formData.paxAdult} kişi × {selectedDate.price_adult})
                </div>
              )}
            </>
          )}

          {/* STEP 3: Payment & Notes */}
          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>Ödeme Durumu</Label>
                <Select value={formData.paymentStatus} onValueChange={(v) => {
                  set("paymentStatus", v);
                  set("depositAmount", "");
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNPAID">{t("admin.paymentStatusLabels.UNPAID")}</SelectItem>
                    <SelectItem value="DEPOSIT">{t("admin.paymentStatusLabels.DEPOSIT")}</SelectItem>
                    <SelectItem value="PAID">{t("admin.paymentStatusLabels.PAID")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.paymentStatus === "DEPOSIT" && (
                <div className="space-y-2">
                  <Label>{t("admin.registrations.depositAmount")} *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.depositAmount}
                    onChange={(e) => set("depositAmount", e.target.value)}
                    placeholder={t("admin.registrations.enterDepositAmount")}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Notlar</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="İsteğe bağlı notlar..."
                  rows={3}
                />
              </div>

              {/* Summary */}
              <div className="p-3 rounded-lg border border-border bg-accent/30 space-y-1 text-sm">
                <div className="font-semibold mb-2">Kayıt Özeti</div>
                <div><span className="text-muted-foreground">Tur:</span> {selectedTour?.title}</div>
                <div><span className="text-muted-foreground">Tarih:</span> {selectedDate && format(new Date(selectedDate.departure_date), "d MMMM yyyy", { locale: tr })}</div>
                <div><span className="text-muted-foreground">Müşteri:</span> {formData.fullName} — {formData.phone}</div>
                <div><span className="text-muted-foreground">Kişi:</span> {formData.paxAdult}</div>
                <div><span className="text-muted-foreground">Toplam:</span> {totalAmount} {selectedTour?.currency || "TRY"}</div>
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => (step === 0 ? onOpenChange(false) : setStep(step - 1))}
          >
            {step === 0 ? "İptal" : <><ChevronLeft className="w-4 h-4 mr-1" /> Geri</>}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="bg-gradient-ocean hover:opacity-90"
            >
              İleri <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !canProceed()}
              className="bg-gradient-ocean hover:opacity-90"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Kaydediliyor...</>
              ) : (
                <><Check className="w-4 h-4 mr-1" /> Kaydet</>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
