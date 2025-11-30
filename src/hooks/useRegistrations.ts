import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface Registration {
  id: string;
  full_name: string;
  phone: string;
  pax: number;
  status: string;
  note?: string;
  created_at: string;
  tour_id: string;
  source_channel?: string;
  payment_status?: string;
  tours: {
    title: string;
    destination: string;
  };
  tour_dates: {
    departure_date: string;
    price_adult: number;
  };
}

export const useRegistrations = (activeTab: string, session: any) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Registration filters
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterTour, setFilterTour] = useState<string>("ALL");
  const [filterSourceChannel, setFilterSourceChannel] = useState<string>("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>();
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>();
  const [filterPriceMin, setFilterPriceMin] = useState<string>("");
  const [filterPriceMax, setFilterPriceMax] = useState<string>("");

  const loadRegistrations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("registrations")
        .select(`
          *,
          tours (title, destination),
          tour_dates (departure_date, price_adult)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setRegistrations(data || []);
    } catch (error) {
      console.error("Error loading registrations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session && activeTab === "registrations") {
      loadRegistrations();
    }
  }, [activeTab, session]);

  const handleStatusChange = async (registrationId: string, newStatus: "NEW" | "PENDING" | "CONFIRMED" | "CANCELLED") => {
    try {
      const { error } = await supabase
        .from("registrations")
        .update({ status: newStatus })
        .eq("id", registrationId);
      
      if (error) throw error;

      // Durum CONFIRMED veya CANCELLED ise otomatik mesaj gönder
      if (newStatus === 'CONFIRMED' || newStatus === 'CANCELLED') {
        const templateKey = newStatus === 'CONFIRMED' ? 'reservation_confirmed' : 'reservation_cancelled';
        
        try {
          const { error: messageError } = await supabase.functions.invoke('send-template-message', {
            body: {
              registrationId,
              templateKey,
              language: 'tr'
            }
          });

          if (messageError) {
            console.error('Template message error:', messageError);
            toast({
              title: "Uyarı",
              description: "Durum güncellendi ama WhatsApp mesajı gönderilemedi",
              variant: "default",
            });
          } else {
            toast({
              title: t("admin.toast.success"),
              description: "Durum güncellendi ve WhatsApp mesajı gönderildi",
            });
          }
        } catch (messageError) {
          console.error('Template message error:', messageError);
          toast({
            title: "Uyarı",
            description: "Durum güncellendi ama WhatsApp mesajı gönderilemedi",
            variant: "default",
          });
        }
      } else {
        toast({
          title: t("admin.toast.success"),
          description: t("admin.registrations.statusUpdated"),
        });
      }
      
      loadRegistrations();
    } catch (error) {
      console.error("Status update error:", error);
      toast({
        title: t("admin.toast.error"),
        description: t("admin.registrations.statusUpdateError"),
        variant: "destructive"
      });
    }
  };

  const clearFilters = () => {
    setFilterStatus("ALL");
    setFilterTour("ALL");
    setFilterSourceChannel("ALL");
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
    setFilterPriceMin("");
    setFilterPriceMax("");
  };

  const getFilteredRegistrations = () => {
    return registrations.filter((reg) => {
      if (filterStatus !== "ALL" && reg.status !== filterStatus) return false;
      if (filterTour !== "ALL" && reg.tour_id !== filterTour) return false;
      if (filterSourceChannel !== "ALL" && reg.source_channel !== filterSourceChannel) return false;

      if (filterDateFrom && reg.tour_dates?.departure_date) {
        const regDate = new Date(reg.tour_dates.departure_date);
        if (regDate < filterDateFrom) return false;
      }

      if (filterDateTo && reg.tour_dates?.departure_date) {
        const regDate = new Date(reg.tour_dates.departure_date);
        if (regDate > filterDateTo) return false;
      }

      const unitPrice = reg.tour_dates?.price_adult || 0;
      const totalPrice = unitPrice * reg.pax;

      if (filterPriceMin && totalPrice < Number(filterPriceMin)) return false;
      if (filterPriceMax && totalPrice > Number(filterPriceMax)) return false;

      return true;
    });
  };

  return {
    registrations,
    loading,
    filterStatus,
    setFilterStatus,
    filterTour,
    setFilterTour,
    filterSourceChannel,
    setFilterSourceChannel,
    filterDateFrom,
    setFilterDateFrom,
    filterDateTo,
    setFilterDateTo,
    filterPriceMin,
    setFilterPriceMin,
    filterPriceMax,
    setFilterPriceMax,
    handleStatusChange,
    clearFilters,
    getFilteredRegistrations,
    loadRegistrations
  };
};
