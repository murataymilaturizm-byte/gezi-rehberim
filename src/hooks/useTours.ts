import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface TourDate {
  id: string;
  departure_date: string;
  return_date?: string;
  price_adult: number;
  quota: number;
  sold_pax?: number;
}

interface Tour {
  id: string;
  title: string;
  destination: string;
  type: string;
  currency: string;
  min_pax: number;
  visa_required: boolean;
  program_url?: string;
  created_at: string;
  tour_dates?: TourDate[];
}

export const useTours = (activeTab: string, session: any) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [tourFormOpen, setTourFormOpen] = useState(false);
  const [dateFormOpen, setDateFormOpen] = useState(false);
  const [selectedTour, setSelectedTour] = useState<Tour | undefined>();
  const [selectedTourForDate, setSelectedTourForDate] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<any>();
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string; type: "tour" | "date" }>({
    open: false,
    id: "",
    type: "tour"
  });

  const loadTours = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tours")
        .select(`
          *,
          tour_dates (
            id,
            departure_date,
            return_date,
            price_adult,
            quota
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setTours(data || []);
    } catch (error) {
      console.error("Error loading tours:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session && activeTab === "tours") {
      loadTours();
    }
  }, [activeTab, session]);

  const handleDeleteTour = async () => {
    try {
      const { error } = await supabase
        .from("tours")
        .delete()
        .eq("id", deleteDialog.id);
      
      if (error) throw error;

      toast({
        title: t("admin.toast.success"),
        description: t("admin.tours.deleteSuccess"),
      });
      
      loadTours();
      setDeleteDialog({ open: false, id: "", type: "tour" });
    } catch (error) {
      console.error("Delete tour error:", error);
      toast({
        title: t("admin.toast.error"),
        description: t("admin.tours.deleteError"),
        variant: "destructive"
      });
    }
  };

  const handleDeleteDate = async () => {
    try {
      const { error } = await supabase
        .from("tour_dates")
        .delete()
        .eq("id", deleteDialog.id);
      
      if (error) throw error;

      toast({
        title: t("admin.toast.success"),
        description: t("admin.date.deleteSuccess"),
      });
      
      loadTours();
      setDeleteDialog({ open: false, id: "", type: "date" });
    } catch (error) {
      console.error("Delete date error:", error);
      toast({
        title: t("admin.toast.error"),
        description: t("admin.date.deleteError"),
        variant: "destructive"
      });
    }
  };

  return {
    tours,
    loading,
    tourFormOpen,
    setTourFormOpen,
    dateFormOpen,
    setDateFormOpen,
    selectedTour,
    setSelectedTour,
    selectedTourForDate,
    setSelectedTourForDate,
    selectedDate,
    setSelectedDate,
    deleteDialog,
    setDeleteDialog,
    handleDeleteTour,
    handleDeleteDate,
    loadTours
  };
};
