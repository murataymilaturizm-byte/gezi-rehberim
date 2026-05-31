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

  const STEPS = [
    { key: "tour", label: t("admin.manualReg.steps.tourDate") },
    { key: "customer", label: t("admin.manualReg.steps.customer") },
    { key: "payment", label: t("admin.manualReg.steps.payment") },
  ];

  const [formData, setFormData] = useState({
    tourId: "",
    tourDateId: "",
    fullName: "",
    phone: "",
    paxAdult: "1",
    sourceChannel: "PHONE",
    paymentStatus: "UNPAID",
    paymentMethod: "",
    depositAmount: "",
    notes: ""
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

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
        paymentMethod: "",
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
      toast({ title: t("common.error"), description: t("admin.manualReg.agencyNotFound"), variant: "destructive" });
      return;
    }

    if (formData.paymentStatus === "PAID" && !formData.paymentMethod) {
      toast({ title: t("common.error"), description: t("admin.manualReg.noPaymentMethod"), variant: "destructive" });
      return;
    }

    if (formData.paymentStatus === "DEPOSIT" && (!formData.depositAmount || parseFloat(formData.depositAmount) <= 0)) {
      toast({ title: t("common.error"), description: t("admin.registrations.enterDepositAmount"), variant: "destructive" });
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

      toast({ title: t("common.successTitle"), description: t("admin.manualReg.success") });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Manual registration error:", error);
      toast({ title: t("common.error"), description: t("admin.manualReg.error"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle>{t("admin.manualReg.title")}</DialogTitle>
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
          {/* STEP 1: Tour & Date */}
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label>{t("admin.registrations.tour")} *</Label>
                <Select value={formData.tourId} onValueChange={(v) => {
                  set("tourId", v);
                  set("tourDateId", "");
                }}>
                  <SelectTrigger><SelectValue placeholder={t("admin.manualReg.selectTour")} /></SelectTrigger>
                  <SelectContent>
                    {tours.map((tour) => (
                      <SelectItem key={tour.id} value={tour.id}>{tour.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("admin.registrations.date")} *</Label>
                <Select value={formData.tourDateId} onValueChange={(v) => set("tourDateId", v)} disabled={!formData.tourId}>
                  <SelectTrigger><SelectValue placeholder={t("admin.manualReg.selectDate")} /></SelectTrigger>
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
                  <div className="text-muted-foreground">{t("admin.manualReg.pricePerPerson")} {selectedDate.price_adult} {selectedTour?.currency || "TRY"}</div>
                </div>
              )}
            </>
          )}

          {/* STEP 2: Customer Info */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>{t("admin.manualReg.customerName")}</Label>
                <Input
                  value={formData.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  placeholder={t("admin.manualReg.namePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("admin.manualReg.phone")}</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder={t("admin.manualReg.phonePlaceholder")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("admin.manualReg.paxCount")}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.paxAdult}
                    onChange={(e) => set("paxAdult", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("admin.manualReg.channel")}</Label>
                  <Select value={formData.sourceChannel} onValueChange={(v) => set("sourceChannel", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PHONE">{t("admin.manualReg.channels.phone")}</SelectItem>
                      <SelectItem value="OFFICE">{t("admin.manualReg.channels.office")}</SelectItem>
                      <SelectItem value="INSTAGRAM">{t("admin.manualReg.channels.instagram")}</SelectItem>
                      <SelectItem value="WHATSAPP">{t("admin.manualReg.channels.whatsapp")}</SelectItem>
                      <SelectItem value="OTHER">{t("admin.manualReg.channels.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedDate && (
                <div className="p-3 rounded-lg bg-accent/50 text-sm">
                  <span className="font-medium">{t("admin.manualReg.total")} </span>
                  {totalAmount} {selectedTour?.currency || "TRY"} ({formData.paxAdult} {t("admin.manualReg.people")} {selectedDate.price_adult})
                </div>
              )}
            </>
          )}

          {/* STEP 3: Payment & Notes */}
          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>{t("admin.manualReg.paymentStatus")}</Label>
                <Select value={formData.paymentStatus} onValueChange={(v) => {
                  set("paymentStatus", v);
                  set("depositAmount", "");
                  if (v !== "PAID") set("paymentMethod", "");
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNPAID">{t("admin.paymentStatusLabels.UNPAID")}</SelectItem>
                    <SelectItem value="DEPOSIT">{t("admin.paymentStatusLabels.DEPOSIT")}</SelectItem>
                    <SelectItem value="PAID">{t("admin.paymentStatusLabels.PAID")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.paymentStatus === "PAID" && (
                <div className="space-y-2">
                  <Label>{t("admin.manualReg.paymentMethod")}</Label>
                  <Select value={formData.paymentMethod} onValueChange={(v) => set("paymentMethod", v)}>
                    <SelectTrigger><SelectValue placeholder={t("admin.manualReg.selectPayment")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CREDIT_CARD">{t("admin.manualReg.payments.creditCard")}</SelectItem>
                      <SelectItem value="CASH">{t("admin.manualReg.payments.cash")}</SelectItem>
                      <SelectItem value="BANK_TRANSFER">{t("admin.manualReg.payments.transfer")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                <Label>{t("admin.manualReg.notes")}</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder={t("admin.manualReg.notesPlaceholder")}
                  rows={3}
                />
              </div>

              {/* Summary */}
              <div className="p-3 rounded-lg border border-border bg-accent/30 space-y-1 text-sm">
                <div className="font-semibold mb-2">{t("admin.manualReg.summary")}</div>
                <div><span className="text-muted-foreground">{t("admin.manualReg.summaryTour")}</span> {selectedTour?.title}</div>
                <div><span className="text-muted-foreground">{t("admin.manualReg.summaryDate")}</span> {selectedDate && format(new Date(selectedDate.departure_date), "d MMMM yyyy", { locale: tr })}</div>
                <div><span className="text-muted-foreground">{t("admin.manualReg.summaryCustomer")}</span> {formData.fullName} — {formData.phone}</div>
                <div><span className="text-muted-foreground">{t("admin.manualReg.summaryPax")}</span> {formData.paxAdult}</div>
                <div><span className="text-muted-foreground">{t("admin.manualReg.summaryTotal")}</span> {totalAmount} {selectedTour?.currency || "TRY"}</div>
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
            {step === 0 ? t("common.cancel") : <><ChevronLeft className="w-4 h-4 mr-1" /> {t("common.prev")}</>}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="bg-gradient-ocean hover:opacity-90"
            >
              {t("common.next")} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !canProceed()}
              className="bg-gradient-ocean hover:opacity-90"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("common.saveLoading")}</>
              ) : (
                <><Check className="w-4 h-4 mr-1" /> {t("common.save")}</>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
