import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

interface Tour {
  id: string;
  title: string;
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
  
  const [formData, setFormData] = useState({
    tourId: "",
    tourDateId: "",
    fullName: "",
    phone: "",
    paxAdult: "1",
    sourceChannel: "PHONE",
    paymentStatus: "UNPAID",
    notes: ""
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTour = tours.find(t => t.id === formData.tourId);
  const availableDates = selectedTour?.tour_dates || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.tourId || !formData.tourDateId || !formData.fullName || !formData.phone) {
      toast({
        title: "Hata",
        description: "Lütfen tüm zorunlu alanları doldurun",
        variant: "destructive"
      });
      return;
    }

    if (!agencyId) {
      toast({
        title: "Hata",
        description: "Ajans bilgisi bulunamadı",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("registrations")
        .insert({
          agency_id: agencyId,
          tour_id: formData.tourId,
          tour_date_id: formData.tourDateId,
          full_name: formData.fullName,
          phone: formData.phone,
          pax: parseInt(formData.paxAdult),
          source_channel: formData.sourceChannel,
          payment_status: formData.paymentStatus,
          note: formData.notes || null,
          status: "NEW"
        });

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Kayıt başarıyla eklendi"
      });

      // Reset form
      setFormData({
        tourId: "",
        tourDateId: "",
        fullName: "",
        phone: "",
        paxAdult: "1",
        sourceChannel: "PHONE",
        paymentStatus: "UNPAID",
        notes: ""
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Manual registration error:", error);
      toast({
        title: "Hata",
        description: "Kayıt eklenirken bir hata oluştu",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manuel Kayıt Ekle</DialogTitle>
          <DialogDescription>
            Telefon, ofis veya diğer kanallardan gelen kayıtları buradan ekleyebilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Tur Seçimi */}
            <div className="col-span-2">
              <Label htmlFor="tour">Tur *</Label>
              <Select 
                value={formData.tourId} 
                onValueChange={(value) => {
                  setFormData({ ...formData, tourId: value, tourDateId: "" });
                }}
              >
                <SelectTrigger id="tour">
                  <SelectValue placeholder="Tur seçin" />
                </SelectTrigger>
                <SelectContent>
                  {tours.map((tour) => (
                    <SelectItem key={tour.id} value={tour.id}>
                      {tour.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tarih Seçimi */}
            <div className="col-span-2">
              <Label htmlFor="date">Tur Tarihi *</Label>
              <Select 
                value={formData.tourDateId} 
                onValueChange={(value) => setFormData({ ...formData, tourDateId: value })}
                disabled={!formData.tourId}
              >
                <SelectTrigger id="date">
                  <SelectValue placeholder="Tarih seçin" />
                </SelectTrigger>
                <SelectContent>
                  {availableDates.map((date) => (
                    <SelectItem key={date.id} value={date.id}>
                      {new Date(date.departure_date).toLocaleDateString('tr-TR', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric' 
                      })} - {date.price_adult}₺
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Müşteri Adı */}
            <div className="col-span-2">
              <Label htmlFor="fullName">Müşteri Adı *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Ad Soyad"
              />
            </div>

            {/* Telefon */}
            <div className="col-span-2">
              <Label htmlFor="phone">Telefon *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+90 555 123 4567"
              />
            </div>

            {/* Yetişkin Sayısı */}
            <div>
              <Label htmlFor="paxAdult">Yetişkin Sayısı</Label>
              <Input
                id="paxAdult"
                type="number"
                min="1"
                value={formData.paxAdult}
                onChange={(e) => setFormData({ ...formData, paxAdult: e.target.value })}
              />
            </div>

            {/* Kaynak Kanal */}
            <div>
              <Label htmlFor="sourceChannel">Kaynak Kanal *</Label>
              <Select 
                value={formData.sourceChannel} 
                onValueChange={(value) => setFormData({ ...formData, sourceChannel: value })}
              >
                <SelectTrigger id="sourceChannel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PHONE">Telefon</SelectItem>
                  <SelectItem value="OFFICE">Ofis</SelectItem>
                  <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                  <SelectItem value="OTHER">Diğer</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ödeme Durumu */}
            <div>
              <Label htmlFor="paymentStatus">Ödeme Durumu</Label>
              <Select 
                value={formData.paymentStatus} 
                onValueChange={(value) => setFormData({ ...formData, paymentStatus: value })}
              >
                <SelectTrigger id="paymentStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNPAID">Ödenmedi</SelectItem>
                  <SelectItem value="DEPOSIT">Kapora</SelectItem>
                  <SelectItem value="PAID">Ödendi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notlar */}
            <div className="col-span-2">
              <Label htmlFor="notes">Notlar</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="İsteğe bağlı notlar..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              İptal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Ekleniyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
