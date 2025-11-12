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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface TourDateFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tourId: string;
  tourDate?: {
    id: string;
    departure_date: string;
    return_date?: string;
    price_adult: number;
    price_child?: number;
    price_single?: number;
    quota: number;
  };
}

export const TourDateFormDialog = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  tourId,
  tourDate 
}: TourDateFormDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    departure_date: "",
    return_date: "",
    price_adult: 0,
    price_child: 0,
    price_single: 0,
    quota: 0
  });

  useEffect(() => {
    if (tourDate) {
      setFormData({
        departure_date: tourDate.departure_date,
        return_date: tourDate.return_date || "",
        price_adult: tourDate.price_adult,
        price_child: tourDate.price_child || 0,
        price_single: tourDate.price_single || 0,
        quota: tourDate.quota
      });
    } else {
      setFormData({
        departure_date: "",
        return_date: "",
        price_adult: 0,
        price_child: 0,
        price_single: 0,
        quota: 0
      });
    }
  }, [tourDate, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.departure_date || formData.price_adult <= 0) {
      toast({
        title: "Hata",
        description: "Kalkış tarihi ve yetişkin fiyatı zorunludur",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const data = {
        tour_id: tourId,
        departure_date: formData.departure_date,
        return_date: formData.return_date || null,
        price_adult: formData.price_adult,
        price_child: formData.price_child || null,
        price_single: formData.price_single || null,
        quota: formData.quota
      };

      if (tourDate) {
        // Update
        const { error } = await supabase
          .from("tour_dates")
          .update(data)
          .eq("id", tourDate.id);

        if (error) throw error;

        toast({
          title: "Başarılı! ✅",
          description: "Tarih güncellendi",
        });
      } else {
        // Insert
        const { error } = await supabase.from("tour_dates").insert(data);

        if (error) throw error;

        toast({
          title: "Başarılı! ✅",
          description: "Yeni tarih eklendi",
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Tour date form error:", error);
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
          <DialogTitle>{tourDate ? "Tarih Düzenle" : "Yeni Tarih Ekle"}</DialogTitle>
          <DialogDescription>
            Tur tarihini ve fiyatlandırmasını girin.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="departure_date">Kalkış Tarihi *</Label>
              <Input
                id="departure_date"
                type="date"
                value={formData.departure_date}
                onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="return_date">Dönüş Tarihi</Label>
              <Input
                id="return_date"
                type="date"
                value={formData.return_date}
                onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price_adult">Yetişkin Fiyatı *</Label>
            <Input
              id="price_adult"
              type="number"
              min="0"
              step="0.01"
              value={formData.price_adult}
              onChange={(e) => setFormData({ ...formData, price_adult: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price_child">Çocuk Fiyatı</Label>
              <Input
                id="price_child"
                type="number"
                min="0"
                step="0.01"
                value={formData.price_child}
                onChange={(e) => setFormData({ ...formData, price_child: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_single">Tek Kişilik Fiyatı</Label>
              <Input
                id="price_single"
                type="number"
                min="0"
                step="0.01"
                value={formData.price_single}
                onChange={(e) => setFormData({ ...formData, price_single: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quota">Kontenjan *</Label>
            <Input
              id="quota"
              type="number"
              min="0"
              value={formData.quota}
              onChange={(e) => setFormData({ ...formData, quota: parseInt(e.target.value) || 0 })}
              required
            />
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
