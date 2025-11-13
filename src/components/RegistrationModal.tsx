import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tourId: string;
  tourDateId: string;
  tourTitle: string;
}

export const RegistrationModal = ({
  isOpen,
  onClose,
  tourId,
  tourDateId,
  tourTitle
}: RegistrationModalProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    pax: 1,
    note: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Get current user's agency_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Kullanıcı bulunamadı");

      const { data: agencyData } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agencyData) throw new Error("Acente bulunamadı");

      const { error } = await supabase.from("registrations").insert({
        tour_id: tourId,
        tour_date_id: tourDateId,
        full_name: formData.fullName,
        phone: formData.phone,
        pax: formData.pax,
        note: formData.note || null,
        status: "NEW",
        agency_id: agencyData.id
      });

      if (error) throw error;

      toast({
        title: "Ön Kayıt Başarılı! ✅",
        description: "Talebiniz alındı. En kısa sürede size dönüş yapacağız.",
      });

      setFormData({ fullName: "", phone: "", pax: 1, note: "" });
      onClose();
    } catch (error) {
      console.error("Registration error:", error);
      toast({
        title: "Hata",
        description: "Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Ön Kayıt Formu</DialogTitle>
          <DialogDescription className="text-sm">
            {tourTitle} için ön kayıt formunu doldurun.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Ad Soyad *</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="Adınız ve soyadınız"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefon *</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="0555 123 45 67"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pax">Kişi Sayısı *</Label>
            <Input
              id="pax"
              type="number"
              min="1"
              value={formData.pax}
              onChange={(e) => setFormData({ ...formData, pax: parseInt(e.target.value) || 1 })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Not (Opsiyonel)</Label>
            <Textarea
              id="note"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="Eklemek istediğiniz notlar..."
              rows={3}
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
              {isLoading ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
