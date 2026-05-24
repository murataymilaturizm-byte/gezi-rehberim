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
import { Loader2, ChevronRight, ChevronLeft, Check, ChevronDown, Globe, Sparkles } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
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

const LANGS = ["en", "de", "fr", "es", "ru", "ar"] as const;
const LANG_FLAGS: Record<string, string> = { en: "🇬🇧", de: "🇩🇪", fr: "🇫🇷", es: "🇪🇸", ru: "🇷🇺", ar: "🇸🇦" };

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
  // Multilingual fields
  title_en: "", title_de: "", title_fr: "", title_es: "", title_ru: "", title_ar: "",
  destination_en: "", destination_de: "", destination_fr: "", destination_es: "", destination_ru: "", destination_ar: "",
  program_kisa_en: "", program_kisa_de: "", program_kisa_fr: "", program_kisa_es: "", program_kisa_ru: "", program_kisa_ar: "",
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
  // AI çeviri state — translate-tour edge function ile
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationsExpanded, setTranslationsExpanded] = useState(false);

  const isOvernight = formData.type !== "DAYTRIP";
  const isInternational = isInternationalCategory(formData.tur_kategorisi);

  const isMobile = useIsMobile();

  // Dynamic steps: hide accommodation step for daytrips
  const activeSteps = isOvernight
    ? STEPS
    : STEPS.filter((s) => s.key !== "accommodation");

  useEffect(() => {
    if (tour) {
      const t = tour as any;
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
        title_en: t.title_en || "", title_de: t.title_de || "", title_fr: t.title_fr || "",
        title_es: t.title_es || "", title_ru: t.title_ru || "", title_ar: t.title_ar || "",
        destination_en: t.destination_en || "", destination_de: t.destination_de || "", destination_fr: t.destination_fr || "",
        destination_es: t.destination_es || "", destination_ru: t.destination_ru || "", destination_ar: t.destination_ar || "",
        program_kisa_en: t.program_kisa_en || "", program_kisa_de: t.program_kisa_de || "", program_kisa_fr: t.program_kisa_fr || "",
        program_kisa_es: t.program_kisa_es || "", program_kisa_ru: t.program_kisa_ru || "", program_kisa_ar: t.program_kisa_ar || "",
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

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const set = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (fieldErrors[field]) setFieldErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  // AI ile Çevir — translate-tour edge function'ı çağır, 6 dile çevir
  const handleAITranslate = async () => {
    if (!formData.title.trim() && !formData.destination.trim() && !formData.program_kisa.trim()) {
      toast({
        title: t("common.error"),
        description: t("tours.translateNoSource"),
        variant: "destructive",
      });
      return;
    }
    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke("translate-tour", {
        body: {
          title: formData.title.trim(),
          destination: formData.destination.trim(),
          program_kisa: formData.program_kisa.trim(),
          sourceLanguage: "tr",
          targetLanguages: ["en", "de", "fr", "es", "ru", "ar"],
        },
      });
      if (error) throw error;
      const translations = (data?.translations || []) as Array<{
        language: string;
        title?: string;
        destination?: string;
        program_kisa?: string;
      }>;
      if (translations.length === 0) throw new Error("No translations returned");

      // Form alanlarına yaz — acente düzenleyebilir, kayıt MANUEL
      setFormData((prev) => {
        const next: any = { ...prev };
        for (const tr of translations) {
          if (tr.title) next[`title_${tr.language}`] = tr.title;
          if (tr.destination) next[`destination_${tr.language}`] = tr.destination;
          if (tr.program_kisa) next[`program_kisa_${tr.language}`] = tr.program_kisa;
        }
        return next;
      });
      // Collapsible'ı otomatik aç — acente sonucu görsün
      setTranslationsExpanded(true);
      toast({
        title: t("common.success"),
        description: t("tours.translateSuccess"),
      });
    } catch (err: any) {
      console.error("[translate-tour] error:", err);
      toast({
        title: t("common.error"),
        description: err?.message || t("tours.translateError"),
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const validateStep0 = () => {
    const errs: Record<string, string> = {};
    if (formData.title.trim().length < 3) errs.title = t("admin.tourForm.titleMinLength");
    if (formData.destination.trim().length < 2) errs.destination = t("admin.tourForm.destinationMinLength");
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

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
      const payload: Record<string, any> = {
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
      // Multilingual fields — only include non-empty values
      for (const lang of LANGS) {
        const fd = formData as any;
        if (fd[`title_${lang}`]) payload[`title_${lang}`] = fd[`title_${lang}`];
        if (fd[`destination_${lang}`]) payload[`destination_${lang}`] = fd[`destination_${lang}`];
        if (fd[`program_kisa_${lang}`]) payload[`program_kisa_${lang}`] = fd[`program_kisa_${lang}`];
      }

      let _agencyIdForCache: string | undefined;

      if (tour) {
        const { error } = await supabase.from("tours").update(payload).eq("id", tour.id);
        if (error) throw error;
        _agencyIdForCache = (tour as any).agency_id;
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
        _agencyIdForCache = agencyData.id;
        toast({ title: t("admin.toast.success"), description: t("admin.tourForm.addSuccess") });
      }

      // Tour cache'ini temizle — chatbot hemen yeni turu görsün
      if (_agencyIdForCache) {
        supabase.functions.invoke("invalidate-tour-cache", { body: { agencyId: _agencyIdForCache } }).catch(() => {});
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
    if (step === 0) return formData.title.trim().length >= 3 && formData.destination.trim().length >= 2;
    return true;
  };

  const handleNext = () => {
    if (step === 0 && !validateStep0()) return;
    setStep(step + 1);
  };

  const currentStepKey = activeSteps[step]?.key;

  const dialogTitle = tour ? t("admin.tourForm.editTour") : t("admin.tourForm.addTour");
  const dialogSubtitle = `${activeSteps[step]?.label} (${step + 1}/${activeSteps.length})`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/*
        Madde 5: Mobile responsive fix.
        - Default DialogContent: `left-[50%] translate-x-[-50%]` + `w-full max-w-lg` + `p-6`.
        - Mobilde 24px p-6 padding küçük ekranda boşluğu daraltıyordu; ayrıca form içindeki
          uzun başlık/destinasyon değerleri yer yer overflow yapabiliyordu.
        - Çözüm: mobilde `max-w-[100vw]` (transform sonrası taşmayı önler), `p-4` (24px → 16px),
          `overflow-x-hidden` (yatay scrollbar/taşma yok), `inset-x-0` (left:50% override).
        - Masaüstü görünümü dokunulmamış (`sm:max-w-[540px]` korundu).
      */}
      <DialogContent
        className={
          isMobile
            ? "inset-x-0 left-0 right-0 translate-x-0 bottom-0 top-auto mt-auto translate-y-0 " +
              "w-full max-w-[100vw] h-[95dvh] max-h-[95dvh] " +
              "rounded-t-xl rounded-b-none p-4 overflow-y-auto overflow-x-hidden"
            : "sm:max-w-[540px] max-h-[95dvh] overflow-y-auto"
        }
      >
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {dialogSubtitle}
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
              <div className="space-y-1.5">
                <Label>Tur Adı *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Örn: Kapadokya Günübirlik Tur"
                  className={fieldErrors.title ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {fieldErrors.title && (
                  <p className="text-xs text-destructive">{fieldErrors.title}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Destinasyon *</Label>
                <Input
                  value={formData.destination}
                  onChange={(e) => set("destination", e.target.value)}
                  placeholder="Örn: Kapadokya"
                  className={fieldErrors.destination ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {fieldErrors.destination && (
                  <p className="text-xs text-destructive">{fieldErrors.destination}</p>
                )}
              </div>

              {/* Yurtdışı pazara hazırlık: title_en her zaman görünür (collapsible dışında) */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  🇬🇧 {t("tours.titleEnLabel")}
                </Label>
                <Input
                  value={(formData as any).title_en || ""}
                  onChange={(e) => set("title_en", e.target.value)}
                  placeholder="e.g. Cappadocia Day Tour"
                />
                <p className="text-xs text-muted-foreground">{t("tours.titleEnHint")}</p>
              </div>

              {/* AI ile Çevir butonu — collapsible header'ın hemen üstünde */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAITranslate}
                disabled={isTranslating}
                className="w-full motion-safe:transition-all border-primary/30 text-primary hover:bg-primary/5"
              >
                {isTranslating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("tours.translating")}</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" />{t("tours.translateAI")}</>
                )}
              </Button>

              {/* Multilingual fields */}
              <Collapsible open={translationsExpanded} onOpenChange={setTranslationsExpanded}>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group w-full">
                  <Globe className="h-4 w-4" />
                  <span>Çeviriler (EN / DE / FR / ES / RU / AR)</span>
                  <ChevronDown className="h-3 w-3 ml-auto group-data-[state=open]:rotate-180 transition-transform" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-4">
                  {LANGS.map((lang) => {
                    const fd = formData as any;
                    return (
                      <div key={lang} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          {LANG_FLAGS[lang]} {lang.toUpperCase()}
                        </p>
                        <div className="space-y-1">
                          <Label className="text-xs">Tur Adı</Label>
                          <Input
                            value={fd[`title_${lang}`] || ""}
                            onChange={(e) => set(`title_${lang}`, e.target.value)}
                            placeholder={`Tur adı (${lang.toUpperCase()})`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Destinasyon</Label>
                          <Input
                            value={fd[`destination_${lang}`] || ""}
                            onChange={(e) => set(`destination_${lang}`, e.target.value)}
                            placeholder={`Destinasyon (${lang.toUpperCase()})`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Kısa Program</Label>
                          <Textarea
                            value={fd[`program_kisa_${lang}`] || ""}
                            onChange={(e) => set(`program_kisa_${lang}`, e.target.value)}
                            placeholder={`Kısa program (${lang.toUpperCase()})`}
                            rows={2}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>

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
              onClick={handleNext}
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
