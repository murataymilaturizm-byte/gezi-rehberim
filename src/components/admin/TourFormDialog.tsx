import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { tourSchema } from "@/utils/validation";
import { getAvailableCurrencies } from "@/utils/currency";
import { TOUR_CATEGORIES, isInternationalCategory } from "./tour-form/TourCategories";
import { TagInput } from "./tour-form/TagInput";
import { PdfUploader } from "./tour-form/PdfUploader";
import { cn } from "@/lib/utils";

interface TourFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tour?: {
    id: string;
    title: string;
    destination: string;
    type: string;
    currency: string;
    min_pax: number;
    visa_required: boolean;
    program_url?: string;
    program_kisa?: string;
    hareket_noktasi?: string;
    toplanma_saati?: string;
    tur_sure?: string;
    konaklama?: string;
    ulasim?: string;
    tur_kategorisi?: string;
    gezilecek_yerler?: string;
    visa_notes?: string;
    hotel_name?: string;
    hotel_stars?: number;
  };
}

const STEPS = [
  { key: "basic", label: "Temel Bilgiler" },
  { key: "details", label: "Detaylar" },
  { key: "accommodation", label: "Konaklama & Ekstra" },
];

const INITIAL_FORM = {
  title: "",
  destination: "",
  type: "DAYTRIP" as "DAYTRIP" | "N2" | "N3",
  currency: "TRY",
  min_pax: 1,
  visa_required: false,
  program_url: "",
  program_kisa: "",
  hareket_noktasi: "",
  toplanma_saati: "",
  tur_sure: "",
  konaklama: "",
  ulasim: "",
  tur_kategorisi: "",
  gezilecek_yerler: "",
  visa_notes: "",
  hotel_name: "",
  hotel_stars: 0,
};

const TOUR_DURATIONS: Record<string, { value: string; label: string }[]> = {
  DAYTRIP: [
    { value: "Tam gün", label: "Tam gün" },
    { value: "Yarım gün", label: "Yarım gün" },
  ],
  N2: [
    { value: "2 Gece 3 Gün", label: "2 Gece 3 Gün" },
  ],
  N3: [
    { value: "3 Gece 4 Gün", label: "3 Gece 4 Gün" },
    { value: "4 Gece 5 Gün", label: "4 Gece 5 Gün" },
    { value: "5 Gece 6 Gün", label: "5 Gece 6 Gün" },
    { value: "6 Gece 7 Gün", label: "6 Gece 7 Gün" },
  ],
};

export const TourFormDialog = ({ isOpen, onClose, onSuccess, tour }: TourFormDialogProps) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const availableCurrencies = getAvailableCurrencies();
  const [formData, setFormData] = useState({ ...INITIAL_FORM });

  const isOvernight = formData.type !== "DAYTRIP";
  const isInternational = isInternationalCategory(formData.tur_kategorisi);

  // Dynamic steps: hide accommodation step for daytrips
  const activeSteps = isOvernight
    ? STEPS
    : STEPS.filter((s) => s.key !== "accommodation");

  useEffect(() => {
    if (tour) {
      setFormData({
        title: tour.title,
        destination: tour.destination,
        type: tour.type as "DAYTRIP" | "N2" | "N3",
        currency: tour.currency,
        min_pax: tour.min_pax,
        visa_required: tour.visa_required,
        program_url: tour.program_url || "",
        program_kisa: tour.program_kisa || "",
        hareket_noktasi: tour.hareket_noktasi || "",
        toplanma_saati: tour.toplanma_saati || "",
        tur_sure: tour.tur_sure || "",
        konaklama: tour.konaklama || "",
        ulasim: tour.ulasim || "",
        tur_kategorisi: tour.tur_kategorisi || "",
        gezilecek_yerler: tour.gezilecek_yerler || "",
        visa_notes: tour.visa_notes || "",
        hotel_name: tour.hotel_name || "",
        hotel_stars: tour.hotel_stars || 0,
      });
    } else {
      setFormData({ ...INITIAL_FORM });
    }
    setStep(0);
  }, [tour, isOpen]);

  // When type changes, auto-set duration
  useEffect(() => {
    const durations = TOUR_DURATIONS[formData.type];
    if (durations && durations.length === 1) {
      setFormData((prev) => ({ ...prev, tur_sure: durations[0].value }));
    }
    // Reset overnight fields when switching to DAYTRIP
    if (formData.type === "DAYTRIP") {
      setFormData((prev) => ({
        ...prev,
        konaklama: "",
        hotel_name: "",
        hotel_stars: 0,
      }));
    }
  }, [formData.type]);

  // Reset visa when category changes to non-international
  useEffect(() => {
    if (!isInternational) {
      setFormData((prev) => ({ ...prev, visa_required: false, visa_notes: "" }));
    }
  }, [formData.tur_kategorisi]);

  const set = (field: string, value: any) => setFormData((prev) => ({ ...prev, [field]: value }));

  const gezilecekYerlerArr = formData.gezilecek_yerler
    ? formData.gezilecek_yerler.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const handleSubmit = async () => {
    const validation = tourSchema.safeParse({
      title: formData.title,
      destination: formData.destination,
      program_url: formData.program_url,
    });

    if (!validation.success) {
      toast({
        title: t("admin.tourForm.error"),
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        title: formData.title,
        destination: formData.destination,
        type: formData.type,
        currency: formData.currency,
        min_pax: formData.min_pax,
        visa_required: formData.visa_required,
        program_url: formData.program_url || null,
        program_kisa: formData.program_kisa || null,
        hareket_noktasi: formData.hareket_noktasi || null,
        toplanma_saati: formData.toplanma_saati || null,
        tur_sure: formData.tur_sure || null,
        konaklama: formData.konaklama || null,
        ulasim: formData.ulasim || null,
        tur_kategorisi: formData.tur_kategorisi || null,
        gezilecek_yerler: formData.gezilecek_yerler || null,
        visa_notes: formData.visa_notes || null,
        hotel_name: formData.hotel_name || null,
        hotel_stars: formData.hotel_stars || null,
      };

      if (tour) {
        const { error } = await supabase.from("tours").update(payload).eq("id", tour.id);
        if (error) throw error;
        toast({ title: t("admin.toast.success"), description: t("admin.tourForm.updateSuccess") });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Oturum bulunamadı");

        const { data: agencyData } = await supabase
          .from("agencies")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (!agencyData) throw new Error("Acente bulunamadı");

        const { error } = await supabase.from("tours").insert({ ...payload, agency_id: agencyData.id });
        if (error) throw error;
        toast({ title: t("admin.toast.success"), description: t("admin.tourForm.addSuccess") });
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Tour form error:", error);
      toast({ title: t("admin.tourForm.error"), description: t("admin.tourForm.error"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return formData.title.length >= 3 && formData.destination.length >= 2;
    return true;
  };

  const currentStepKey = activeSteps[step]?.key;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tour ? "Tur Düzenle" : "Yeni Tur Ekle"}</DialogTitle>
          <DialogDescription>
            {activeSteps[step]?.label} ({step + 1}/{activeSteps.length})
          </DialogDescription>
        </DialogHeader>

        {/* Stepper indicator */}
        <div className="flex items-center gap-1 mb-2">
          {activeSteps.map((s, i) => (
            <div key={s.key} className="flex items-center flex-1">
              <div
                className={cn(
                  "h-1.5 rounded-full flex-1 transition-colors",
                  i <= step ? "bg-primary" : "bg-muted"
                )}
              />
            </div>
          ))}
        </div>

        <div className="space-y-4 pt-2 min-h-[280px]">
          {/* STEP 1: Basic Info */}
          {currentStepKey === "basic" && (
            <>
              <div className="space-y-2">
                <Label>Tur Adı *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Örn: Kapadokya Günübirlik Tur"
                />
              </div>

              <div className="space-y-2">
                <Label>Destinasyon *</Label>
                <Input
                  value={formData.destination}
                  onChange={(e) => set("destination", e.target.value)}
                  placeholder="Örn: Kapadokya"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tur Tipi *</Label>
                  <Select value={formData.type} onValueChange={(v: "DAYTRIP" | "N2" | "N3") => set("type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAYTRIP">Günübirlik</SelectItem>
                      <SelectItem value="N2">2 Gece 3 Gün</SelectItem>
                      <SelectItem value="N3">3+ Gece</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tur Kategorisi</Label>
                  <Select value={formData.tur_kategorisi} onValueChange={(v) => set("tur_kategorisi", v)}>
                    <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                    <SelectContent>
                      {TOUR_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.icon} {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Para Birimi *</Label>
                  <Select value={formData.currency} onValueChange={(v) => set("currency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableCurrencies.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.symbol} {c.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Min. Kişi *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.min_pax}
                    onChange={(e) => set("min_pax", parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
            </>
          )}

          {/* STEP 2: Details */}
          {currentStepKey === "details" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("admin.tourForm.departurePoint")}</Label>
                  <Input
                    value={formData.hareket_noktasi}
                    onChange={(e) => set("hareket_noktasi", e.target.value)}
                    placeholder={t("admin.tourForm.departurePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("admin.tourForm.meetingTime")}</Label>
                  <Input
                    type="time"
                    value={formData.toplanma_saati}
                    onChange={(e) => set("toplanma_saati", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("admin.tourForm.duration")}</Label>
                  <Select value={formData.tur_sure} onValueChange={(v) => set("tur_sure", v)}>
                    <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                    <SelectContent>
                      {(TOUR_DURATIONS[formData.type] || []).map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("admin.tourForm.transportation")}</Label>
                  <Input
                    value={formData.ulasim}
                    onChange={(e) => set("ulasim", e.target.value)}
                    placeholder={t("admin.tourForm.transportationPlaceholder")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Gezilecek Yerler</Label>
                <TagInput
                  value={gezilecekYerlerArr}
                  onChange={(tags) => set("gezilecek_yerler", tags.join(", "))}
                  placeholder="Yer yazıp Enter'a basın..."
                />
              </div>

              <div className="space-y-2">
                <Label>Program Açıklaması</Label>
                <Input
                  value={formData.program_kisa}
                  onChange={(e) => set("program_kisa", e.target.value)}
                  placeholder="Kısa program açıklaması"
                />
              </div>

              <div className="space-y-2">
                <Label>Program PDF</Label>
                <PdfUploader value={formData.program_url} onChange={(v) => set("program_url", v)} />
              </div>

              {/* Visa - only for international categories */}
              {isInternational && (
                <div className="space-y-3 p-3 rounded-lg border border-border bg-accent/30">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="visa_required"
                      checked={formData.visa_required}
                      onChange={(e) => set("visa_required", e.target.checked)}
                      className="rounded border-border"
                    />
                    <Label htmlFor="visa_required" className="cursor-pointer">
                      {t("admin.tourForm.visaRequired")}
                    </Label>
                  </div>
                  {formData.visa_required && (
                    <Input
                      value={formData.visa_notes}
                      onChange={(e) => set("visa_notes", e.target.value)}
                      placeholder="Vize desteği, gerekli belgeler vb."
                    />
                  )}
                </div>
              )}
            </>
          )}

          {/* STEP 3: Accommodation (only for overnight tours) */}
          {currentStepKey === "accommodation" && (
            <>
              <div className="space-y-2">
                <Label>Otel Adı</Label>
                <Input
                  value={formData.hotel_name}
                  onChange={(e) => set("hotel_name", e.target.value)}
                  placeholder="Konaklama yapılacak otel adı"
                />
              </div>

              <div className="space-y-2">
                <Label>Otel Yıldız Sayısı</Label>
                <Select
                  value={formData.hotel_stars.toString()}
                  onValueChange={(v) => set("hotel_stars", parseInt(v))}
                >
                  <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Belirtilmemiş</SelectItem>
                    <SelectItem value="3">⭐⭐⭐ 3 Yıldız</SelectItem>
                    <SelectItem value="4">⭐⭐⭐⭐ 4 Yıldız</SelectItem>
                    <SelectItem value="5">⭐⭐⭐⭐⭐ 5 Yıldız</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Konaklama Detayları</Label>
                <Input
                  value={formData.konaklama}
                  onChange={(e) => set("konaklama", e.target.value)}
                  placeholder="Oda tipi, pansiyon türü vb."
                />
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
          >
            {step === 0 ? (
              t("admin.tourForm.cancel")
            ) : (
              <><ChevronLeft className="w-4 h-4 mr-1" /> Geri</>
            )}
          </Button>

          {step < activeSteps.length - 1 ? (
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
              disabled={isLoading || !canProceed()}
              className="bg-gradient-ocean hover:opacity-90"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("admin.tourForm.saving")}</>
              ) : (
                <><Check className="w-4 h-4 mr-1" /> {t("admin.tourForm.save")}</>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
