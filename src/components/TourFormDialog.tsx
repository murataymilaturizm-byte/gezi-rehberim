import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { tourSchema } from "@/utils/validation";
import { getAvailableCurrencies } from "@/utils/currency";

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

export const TourFormDialog = ({ isOpen, onClose, onSuccess, tour }: TourFormDialogProps) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const availableCurrencies = getAvailableCurrencies();
  const [formData, setFormData] = useState({
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
    hotel_stars: 0
  });

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
        hotel_stars: tour.hotel_stars || 0
      });
    } else {
      setFormData({
        title: "",
        destination: "",
        type: "DAYTRIP",
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
        hotel_stars: 0
      });
    }
  }, [tour, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate with zod schema
    const validation = tourSchema.safeParse({
      title: formData.title,
      destination: formData.destination,
      program_url: formData.program_url
    });
    
    if (!validation.success) {
      toast({
        title: t("admin.tourForm.error"),
        description: validation.error.errors[0].message,
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      if (tour) {
        // Update
        const { error } = await supabase
          .from("tours")
          .update({
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
            hotel_stars: formData.hotel_stars || null
          })
          .eq("id", tour.id);

        if (error) throw error;

        toast({
          title: t("admin.toast.success"),
          description: t("admin.tourForm.updateSuccess"),
        });
      } else {
        // Insert - Get user's agency_id first
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error(t("admin.tourForm.error"));

        const { data: agencyData } = await supabase
          .from("agencies")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!agencyData) throw new Error(t("admin.tourForm.error"));

        const { error } = await supabase.from("tours").insert({
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
          agency_id: agencyData.id
        });

        if (error) throw error;

        toast({
          title: t("admin.toast.success"),
          description: t("admin.tourForm.addSuccess"),
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Tour form error:", error);
      toast({
        title: t("admin.tourForm.error"),
        description: t("admin.tourForm.error"),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tour ? "Tur Düzenle" : "Yeni Tur Ekle"}</DialogTitle>
          <DialogDescription>
            Tur bilgilerini doldurun. Tarihler daha sonra eklenebilir.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Tur Adı *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Örn: Kapadokya Günübirlik Tur"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination">Destinasyon *</Label>
            <Input
              id="destination"
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              placeholder="Örn: Kapadokya"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tur Tipi *</Label>
            <Select
              value={formData.type}
              onValueChange={(value: "DAYTRIP" | "N2" | "N3") => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAYTRIP">Günübirlik</SelectItem>
                <SelectItem value="N2">2 Gece 3 Gün</SelectItem>
                <SelectItem value="N3">3 Gece 4 Gün</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Para Birimi *</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableCurrencies.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.code} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="min_pax">Min. Kişi *</Label>
              <Input
                id="min_pax"
                type="number"
                min="1"
                value={formData.min_pax}
                onChange={(e) => setFormData({ ...formData, min_pax: parseInt(e.target.value) || 1 })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="program_url">Program URL</Label>
            <Input
              id="program_url"
              type="url"
              value={formData.program_url}
              onChange={(e) => setFormData({ ...formData, program_url: e.target.value })}
              placeholder="https://example.com/program.pdf"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="program_kisa">Program Açıklaması</Label>
            <Input
              id="program_kisa"
              value={formData.program_kisa}
              onChange={(e) => setFormData({ ...formData, program_kisa: e.target.value })}
              placeholder="Kısa program açıklaması"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hareket_noktasi">{t("admin.tourForm.departurePoint")}</Label>
              <Input
                id="hareket_noktasi"
                value={formData.hareket_noktasi}
                onChange={(e) => setFormData({ ...formData, hareket_noktasi: e.target.value })}
                placeholder={t("admin.tourForm.departurePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="toplanma_saati">{t("admin.tourForm.meetingTime")}</Label>
              <Input
                id="toplanma_saati"
                type="time"
                value={formData.toplanma_saati}
                onChange={(e) => setFormData({ ...formData, toplanma_saati: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tur_sure">{t("admin.tourForm.duration")}</Label>
              <Input
                id="tur_sure"
                value={formData.tur_sure}
                onChange={(e) => setFormData({ ...formData, tur_sure: e.target.value })}
                placeholder={t("admin.tourForm.durationPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tur_kategorisi">{t("admin.tourForm.category")}</Label>
              <Input
                id="tur_kategorisi"
                value={formData.tur_kategorisi}
                onChange={(e) => setFormData({ ...formData, tur_kategorisi: e.target.value })}
                placeholder={t("admin.tourForm.categoryPlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="konaklama">{t("admin.tourForm.accommodation")}</Label>
            <Input
              id="konaklama"
              value={formData.konaklama}
              onChange={(e) => setFormData({ ...formData, konaklama: e.target.value })}
              placeholder={t("admin.tourForm.accommodationPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ulasim">{t("admin.tourForm.transportation")}</Label>
            <Input
              id="ulasim"
              value={formData.ulasim}
              onChange={(e) => setFormData({ ...formData, ulasim: e.target.value })}
              placeholder={t("admin.tourForm.transportationPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gezilecek_yerler">{t("admin.tourForm.places")}</Label>
            <Input
              id="gezilecek_yerler"
              value={formData.gezilecek_yerler}
              onChange={(e) => setFormData({ ...formData, gezilecek_yerler: e.target.value })}
              placeholder={t("admin.tourForm.placesPlaceholder")}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="visa_required"
              checked={formData.visa_required}
              onChange={(e) => setFormData({ ...formData, visa_required: e.target.checked })}
              className="rounded border-border"
            />
            <Label htmlFor="visa_required" className="cursor-pointer">{t("admin.tourForm.visaRequired")}</Label>
          </div>

          {formData.visa_required && (
            <div className="space-y-2">
              <Label htmlFor="visa_notes">Vize Notları</Label>
              <Input
                id="visa_notes"
                value={formData.visa_notes}
                onChange={(e) => setFormData({ ...formData, visa_notes: e.target.value })}
                placeholder="Vize desteği, gerekli belgeler vb."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="hotel_name">Otel Adı</Label>
            <Input
              id="hotel_name"
              value={formData.hotel_name}
              onChange={(e) => setFormData({ ...formData, hotel_name: e.target.value })}
              placeholder="Konaklama yapılacak otel adı"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hotel_stars">Otel Yıldız Sayısı</Label>
            <Select
              value={formData.hotel_stars.toString()}
              onValueChange={(value) => setFormData({ ...formData, hotel_stars: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seçiniz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Belirtilmemiş</SelectItem>
                <SelectItem value="3">3 Yıldız</SelectItem>
                <SelectItem value="4">4 Yıldız</SelectItem>
                <SelectItem value="5">5 Yıldız</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("admin.tourForm.cancel")}
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-gradient-ocean hover:opacity-90 transition-smooth"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("admin.tourForm.saving")}
                </>
              ) : (
                t("admin.tourForm.save")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
