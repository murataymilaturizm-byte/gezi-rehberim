import { useState, useEffect } from "react";
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
  };
}

export const TourFormDialog = ({ isOpen, onClose, onSuccess, tour }: TourFormDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    destination: "",
    type: "DAYTRIP" as "DAYTRIP" | "N2" | "N3",
    currency: "TRY",
    min_pax: 1,
    visa_required: false,
    program_url: ""
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
        program_url: tour.program_url || ""
      });
    } else {
      setFormData({
        title: "",
        destination: "",
        type: "DAYTRIP",
        currency: "TRY",
        min_pax: 1,
        visa_required: false,
        program_url: ""
      });
    }
  }, [tour, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.destination.trim()) {
      toast({
        title: "Hata",
        description: "Lütfen zorunlu alanları doldurun",
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
            program_url: formData.program_url || null
          })
          .eq("id", tour.id);

        if (error) throw error;

        toast({
          title: "Başarılı! ✅",
          description: "Tur güncellendi",
        });
      } else {
        // Insert
        const { error } = await supabase.from("tours").insert({
          title: formData.title,
          destination: formData.destination,
          type: formData.type,
          currency: formData.currency,
          min_pax: formData.min_pax,
          visa_required: formData.visa_required,
          program_url: formData.program_url || null
        });

        if (error) throw error;

        toast({
          title: "Başarılı! ✅",
          description: "Yeni tur eklendi",
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Tour form error:", error);
      toast({
        title: "Hata",
        description: "İşlem sırasında bir hata oluştu",
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
                  <SelectItem value="TRY">TRY</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
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

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="visa_required"
              checked={formData.visa_required}
              onChange={(e) => setFormData({ ...formData, visa_required: e.target.checked })}
              className="rounded border-border"
            />
            <Label htmlFor="visa_required" className="cursor-pointer">Vize Gerekli</Label>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-gradient-ocean hover:opacity-90 transition-smooth"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                "Kaydet"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
