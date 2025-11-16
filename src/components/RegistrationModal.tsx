import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { registrationSchema } from "@/utils/validation";

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
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    pax: 1,
    note: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate with zod schema
    const validation = registrationSchema.safeParse({
      full_name: formData.fullName,
      phone: formData.phone,
      pax: formData.pax,
      note: formData.note
    });
    
    if (!validation.success) {
      toast({
        title: t("admin.registrationForm.error"),
        description: validation.error.errors[0].message,
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);

    try {
      // Get current user's agency_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("admin.registrationForm.userNotFound"));

      const { data: agencyData } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agencyData) throw new Error(t("admin.registrationForm.agencyNotFound"));

      // Kontenjan kontrolü
      const { data: tourDate, error: quotaError } = await supabase
        .from("tour_dates")
        .select("quota")
        .eq("id", tourDateId)
        .single();

      if (quotaError) throw quotaError;

      if (!tourDate || tourDate.quota < formData.pax) {
        toast({
          title: t("admin.registrationForm.quotaError"),
          description: t("admin.registrationForm.quotaErrorMessage", { quota: tourDate?.quota || 0 }),
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      // Kayıt oluştur ve kontenjandan düş
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

      // Kontenjandan düş
      await supabase
        .from("tour_dates")
        .update({ quota: tourDate.quota - formData.pax })
        .eq("id", tourDateId);

      toast({
        title: t("admin.registrationForm.success"),
        description: t("admin.registrationForm.successMessage"),
      });

      setFormData({ fullName: "", phone: "", pax: 1, note: "" });
      onClose();
    } catch (error) {
      console.error("Registration error:", error);
      toast({
        title: t("admin.registrationForm.error"),
        description: t("admin.registrationForm.errorMessage"),
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
          <DialogTitle className="text-xl">{t("admin.registrationForm.title")}</DialogTitle>
          <DialogDescription className="text-sm">
            {t("admin.registrationForm.description", { tourTitle })}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">{t("admin.registrationForm.fullName")} *</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder={t("admin.registrationForm.fullNamePlaceholder")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t("admin.registrationForm.phone")} *</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder={t("admin.registrationForm.phonePlaceholder")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pax">{t("admin.registrationForm.pax")} *</Label>
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
            <Label htmlFor="note">{t("admin.registrationForm.note")}</Label>
            <Textarea
              id="note"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder={t("admin.registrationForm.notePlaceholder")}
              rows={3}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("admin.registrationForm.cancel")}
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-gradient-ocean hover:opacity-90 transition-smooth"
            >
              {isLoading ? t("admin.registrationForm.saving") : t("admin.registrationForm.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
