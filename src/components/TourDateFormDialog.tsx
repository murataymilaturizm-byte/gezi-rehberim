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
  const { t } = useTranslation();
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
    
    // Validate input
    const tourDateSchema = z.object({
      departure_date: z.string().min(1, { message: t("admin.dateForm.fillRequired") }),
      price_adult: z.number().positive({ message: t("admin.dateForm.pricePositive") }),
      price_child: z.number().min(0).optional(),
      price_single: z.number().min(0).optional(),
      quota: z.number().int().min(0, { message: t("admin.dateForm.quotaPositive") })
    });
    
    const validation = tourDateSchema.safeParse({
      departure_date: formData.departure_date,
      price_adult: formData.price_adult,
      price_child: formData.price_child,
      price_single: formData.price_single,
      quota: formData.quota
    });
    
    if (!validation.success) {
      toast({
        title: t("admin.dateForm.error"),
        description: validation.error.errors[0].message,
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Get user's agency_id first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("admin.dateForm.userNotFound"));

      const { data: agencyData } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agencyData) throw new Error(t("admin.dateForm.agencyNotFound"));

      const data = {
        tour_id: tourId,
        departure_date: formData.departure_date,
        return_date: formData.return_date || null,
        price_adult: formData.price_adult,
        price_child: formData.price_child || null,
        price_single: formData.price_single || null,
        quota: formData.quota,
        agency_id: agencyData.id
      };

      if (tourDate) {
        // Update
        const { error } = await supabase
          .from("tour_dates")
          .update(data)
          .eq("id", tourDate.id);

        if (error) throw error;

        toast({
          title: t("admin.toast.success"),
          description: t("admin.dateForm.updateSuccess"),
        });
      } else {
        // Insert
        const { error } = await supabase.from("tour_dates").insert(data);

        if (error) throw error;

        toast({
          title: t("admin.toast.success"),
          description: t("admin.dateForm.addSuccess"),
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Tour date form error:", error);
      toast({
        title: t("admin.dateForm.error"),
        description: t("admin.dateForm.errorOccurred"),
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
          <DialogTitle>{tourDate ? t("admin.dateForm.editDate") : t("admin.dateForm.addDate")}</DialogTitle>
          <DialogDescription>
            {t("admin.dateForm.description")}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="departure_date">{t("admin.dateForm.departureDate")} *</Label>
              <Input
                id="departure_date"
                type="date"
                value={formData.departure_date}
                onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="return_date">{t("admin.dateForm.returnDate")}</Label>
              <Input
                id="return_date"
                type="date"
                value={formData.return_date}
                onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price_adult">{t("admin.dateForm.priceAdult")} *</Label>
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
              <Label htmlFor="price_child">{t("admin.dateForm.priceChild")}</Label>
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
              <Label htmlFor="price_single">{t("admin.dateForm.priceSingle")}</Label>
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
            <Label htmlFor="quota">{t("admin.dateForm.quota")} *</Label>
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
              {t("admin.dateForm.cancel")}
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-gradient-ocean hover:opacity-90 transition-smooth"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("admin.dateForm.saving")}
                </>
              ) : (
                t("admin.dateForm.save")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
