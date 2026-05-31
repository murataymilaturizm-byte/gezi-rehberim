import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import turzzLogo from "@/assets/turzz-logo-orange.png";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Download, AlertCircle, LogOut } from "lucide-react";
import { TourFormDialog } from "@/components/TourFormDialog";
import { TourDateFormDialog } from "@/components/TourDateFormDialog";
import { ToursList } from "@/components/admin/ToursList";
import { RegistrationsList } from "@/components/admin/RegistrationsList";
import { RegistrationFilters } from "@/components/admin/RegistrationFilters";
import { ManualRegistrationDialog } from "@/components/admin/ManualRegistrationDialog";
import { RegistrationDetailDialog } from "@/components/admin/RegistrationDetailDialog";
// Faz 1: Kayıtlar 3 görünüm
import { RegistrationsByTour } from "@/components/admin/registrations/RegistrationsByTour";
import { RegistrationsByDeparture } from "@/components/admin/registrations/RegistrationsByDeparture";
import { DepartureDetailDialog } from "@/components/admin/registrations/DepartureDetailDialog";
import type { DepartureGroup } from "@/components/admin/registrations/RegistrationsByDeparture";
import type { RegistrationsView } from "@/components/admin/registrations/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { List, Layers, CalendarDays } from "lucide-react";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AdvancedAnalytics } from "@/components/AdvancedAnalytics";
import { CustomerAnalytics } from "@/components/CustomerAnalytics";
import { DestinationAnalytics } from "@/components/DestinationAnalytics";
import { WhatsAppConversations } from "@/components/WhatsAppConversations";
import { WhatsAppUserProfiles } from "@/components/WhatsAppUserProfiles";
import { AgencyManagement } from "@/components/AgencyManagement";
import { ContactFormsManagement } from "@/components/ContactFormsManagement";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { WhatsAppSettings } from "@/components/WhatsAppSettings";
import { WhatsAppIntegrationPanel } from "@/components/WhatsAppIntegrationPanel";
import { SuperAdminWhatsAppSettings } from "@/components/SuperAdminWhatsAppSettings";
import { SuperAdminWhatsAppIntegrations } from "@/components/SuperAdminWhatsAppIntegrations";
import { WhatsAppTestPanel } from "@/components/WhatsAppTestPanel";
import { SubscriptionHistory } from "@/components/SubscriptionHistory";
import MessageTemplates from "@/components/MessageTemplates";
import FAQManagement from "@/components/FAQManagement";
import { CustomerFeedback } from "@/components/CustomerFeedback";
import { LanguageStats } from "@/components/LanguageStats";
import { WhatsAppLogs } from "@/components/WhatsAppLogs";
import { PaymentSettings } from "@/components/PaymentSettings";
import { LanguageCurrencySettings } from "@/components/LanguageCurrencySettings";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { exportRegistrationsToExcel, exportToursToExcel } from "@/utils/excelExporter";
import { SupportChatWidget } from "@/components/SupportChatWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { LanguageManagement } from "@/components/LanguageManagement";
import { TicketManagement } from "@/components/TicketManagement";
import { SuperAdminTickets } from "@/components/SuperAdminTickets";
import { AgencyInfoSettings } from "@/components/AgencyInfoSettings";
import { ComplaintsManagement } from "@/components/ComplaintsManagement";
import { getMaxTours, getPlanFeatures, PlanFeatures, isWithinTourLimit } from "@/utils/planFeatures";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AdminSidebar } from "@/components/AdminSidebar";
import { WhatsAppBusinessManagement } from "@/components/WhatsAppBusinessManagement";
import { QuotaWarningBanner } from "@/components/QuotaWarningBanner";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { BulkTourImport, downloadTourImportTemplate } from "@/components/admin/BulkTourImport";
import { NotificationCenter } from "@/components/admin/NotificationCenter";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { OnboardingTour, tourStorageKey } from "@/components/admin/OnboardingTour";
import { FileSpreadsheet, FileText } from "lucide-react";
import CentralNotifications from "@/components/CentralNotifications";
import CentralSendLog from "@/components/CentralSendLog";

const VALID_TABS = ["dashboard", "tours", "registrations", "whatsapp", "whatsapp_profiles", "agency_info", "complaints", "settings", "payment_settings", "history", "agencies", "contact_forms", "whatsapp_settings", "whatsapp_integrations", "whatsapp_management", "templates", "faq", "customer-feedback", "languages", "language_currencies", "tickets", "super_tickets", "analytics", "customer-analytics", "destination-analytics", "whatsapp_test", "language-stats", "whatsapp-logs", "central_notifications", "central_send_log"] as const;

interface Tour {
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
  created_at: string;
  tour_dates?: Array<{
    id: string;
    departure_date: string;
    return_date?: string;
    price_adult: number;
    quota: number;
  }>;
}

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
    currency?: string;
  };
  tour_dates: {
    departure_date: string;
    price_adult: number;
  };
}

const Admin = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  
  // Active tab state — URL-synced via ?tab=
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<typeof VALID_TABS[number]>(
    (VALID_TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as typeof VALID_TABS[number]) : "dashboard"
  );

  const handleTabChange = (tab: string) => {
    const validTab = (VALID_TABS as readonly string[]).includes(tab) ? tab : "dashboard";
    setActiveTab(validTab as typeof VALID_TABS[number]);
    setSearchParams({ tab: validTab }, { replace: true });
  };
  
  // Auth & User state
  const [session, setSession] = useState<Session | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userAgencyId, setUserAgencyId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Tours state
  const [tours, setTours] = useState<Tour[]>([]);
  const [tourFormOpen, setTourFormOpen] = useState(false);
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [dateFormOpen, setDateFormOpen] = useState(false);
  const [selectedTourForDate, setSelectedTourForDate] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: "tour" | "date" | null;
    id: string | null;
  }>({ open: false, type: null, id: null });

  // Registrations state
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [manualRegistrationDialogOpen, setManualRegistrationDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<any>(null);
  // Faz 2-C: Kayıtlar 3 görünüm — varsayılan "by-departure" (operasyonel en sık kullanım)
  const [registrationsView, setRegistrationsView] = useState<RegistrationsView>("by-departure");
  const [departureDetailOpen, setDepartureDetailOpen] = useState(false);
  const [selectedDepartureGroup, setSelectedDepartureGroup] = useState<DepartureGroup | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterTour, setFilterTour] = useState<string>("ALL");
  const [filterTourDate, setFilterTourDate] = useState<string>("ALL");
  const [filterSourceChannel, setFilterSourceChannel] = useState<string>("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>();
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>();
  const [filterPriceMin, setFilterPriceMin] = useState<string>("");
  const [filterPriceMax, setFilterPriceMax] = useState<string>("");

  // Bulk import state
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  // Onboarding tour state
  const [shouldRunTour, setShouldRunTour] = useState(false);

  // Complaints count (open/unresolved)
  const [openComplaintsCount, setOpenComplaintsCount] = useState(0);

  // Plan features state
  const [planType, setPlanType] = useState<string>('starter');
  const [maxTours, setMaxTours] = useState<number>(10);
  const [planFeatures, setPlanFeatures] = useState<PlanFeatures | null>(null);
  const [enabledLanguages, setEnabledLanguages] = useState<string[]>([]);
  const [whatsappStatus, setWhatsappStatus] = useState<string>('');
  
  // Check user role and load data
  const checkUserRole = async (userId: string) => {
    try {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      const isSuperAdmin = roleData?.role === "super_admin";
      setIsSuperAdmin(isSuperAdmin);

      if (isSuperAdmin) {
        setUserName("Super Admin");
        setLoading(false);
        return;
      }

      const { data: agencyData } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("user_id", userId)
        .single();

      if (agencyData) {
        setUserAgencyId(agencyData.id);
        setAgencyName(agencyData.name);
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();

      if (profileData?.full_name) {
        setUserName(profileData.full_name);
      }
    } catch (error) {
      console.error("Role check error:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAgencyPlan = async () => {
    if (!userAgencyId) return;

    try {
      const { data: agencyData, error } = await supabase
        .from("agencies")
        // BUG FIX (Madde 1): Bağlantı durumu için sadece whatsapp_status alanı yetmiyor.
        // Acente disconnect-reconnect yaptığında bu alan bazen "pending" kalıyor ama
        // gerçek bağlantı göstergeleri (meta_access_token + meta_phone_number_id) dolu.
        // Meta credentials varsa gerçekten bağlı → "active" göster.
        .select("plan_type, enabled_languages, whatsapp_status, meta_access_token, meta_phone_number_id, webhook_subscribed")
        .eq("id", userAgencyId)
        .single();

      if (error) throw error;

      if (agencyData) {
        const plan = agencyData.plan_type || 'starter';
        setPlanType(plan);
        const maxToursValue = await getMaxTours(plan);
        const features = await getPlanFeatures(plan);
        setMaxTours(maxToursValue);
        setPlanFeatures(features);
        setEnabledLanguages(agencyData.enabled_languages || []);
        // BUG FIX (Madde 1): Tek kaynaklı bağlantı durumu hesabı.
        // Meta'da hem token hem phone_number_id varsa = gerçekten bağlı, "active" göster
        // (whatsapp_status alanı "pending" kalmış olsa bile — disconnect-reconnect race condition).
        const _hasMetaCreds = !!(agencyData as any).meta_access_token && !!(agencyData as any).meta_phone_number_id;
        const _effectiveStatus = _hasMetaCreds ? "active" : (agencyData.whatsapp_status || "");
        setWhatsappStatus(_effectiveStatus);
      }
    } catch (error) {
      console.error("Error loading agency plan:", error);
    }
  };

  const clearFilters = () => {
    setFilterStatus("ALL");
    setFilterTour("ALL");
    setFilterTourDate("ALL");
    setFilterSourceChannel("ALL");
    setFilterCategory("ALL");
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
    setFilterPriceMin("");
    setFilterPriceMax("");
  };

  // Get available tour dates from tours (not registrations!) based on selected tour
  const availableTourDates = Array.from(
    new Set(
      tours
        .filter(tour => {
          if (filterTour !== "ALL" && tour.id !== filterTour) return false;
          if (filterCategory !== "ALL" && tour.tur_kategorisi !== filterCategory) return false;
          return true;
        })
        .flatMap(tour => tour.tour_dates?.map(td => td.departure_date) || [])
        .filter(date => date)
    )
  ).sort();

  // Filter tours list based on category
  const filteredToursForDropdown = filterCategory !== "ALL"
    ? tours.filter(t => t.tur_kategorisi === filterCategory)
    : tours;

  const getFilteredRegistrations = () => {
    return registrations.filter(reg => {
      if (filterStatus !== "ALL" && reg.status !== filterStatus) return false;
      if (filterTour !== "ALL" && reg.tour_id !== filterTour) return false;
      if (filterTourDate !== "ALL" && reg.tour_dates?.departure_date !== filterTourDate) return false;
      if (filterSourceChannel !== "ALL" && reg.source_channel !== filterSourceChannel) return false;
      
      // Category filter
      if (filterCategory !== "ALL") {
        const tour = tours.find(t => t.id === reg.tour_id);
        if (tour?.tur_kategorisi !== filterCategory) return false;
      }
      
      if (filterDateFrom || filterDateTo) {
        const regDate = new Date(reg.created_at);
        if (filterDateFrom && regDate < filterDateFrom) return false;
        if (filterDateTo && regDate > filterDateTo) return false;
      }
      
      if (filterPriceMin || filterPriceMax) {
        const totalPrice = (reg.tour_dates?.price_adult || 0) * reg.pax;
        if (filterPriceMin && totalPrice < parseFloat(filterPriceMin)) return false;
        if (filterPriceMax && totalPrice > parseFloat(filterPriceMax)) return false;
      }
      
      return true;
    });
  };

  // Auth check
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        setTimeout(() => {
          checkUserRole(session.user.id);
        }, 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        checkUserRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Load agency plan
  useEffect(() => {
    if (userAgencyId && !isSuperAdmin) {
      loadAgencyPlan();
    }
  }, [userAgencyId, isSuperAdmin]);

  // Load open complaints count for dashboard badge
  useEffect(() => {
    if (!userAgencyId || isSuperAdmin) return;
    supabase
      .from("complaints")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", userAgencyId)
      .in("status", ["new", "reviewed"])
      .then(({ count }) => setOpenComplaintsCount(count ?? 0));
  }, [userAgencyId, isSuperAdmin, activeTab]);

  // Realtime: watch whatsapp_status to force OnboardingChecklist remount on connect.
  // BUG FIX (Madde 1): Sadece whatsapp_status'a değil, Meta credentials değişimine de bak.
  // Embedded signup token yenilemesi whatsapp_status'u her zaman "active" yapmayabilir,
  // ama meta_access_token/meta_phone_number_id güncellenir → effective status hesabı.
  useEffect(() => {
    if (!userAgencyId || isSuperAdmin) return;
    const channel = supabase
      .channel(`agency-whatsapp-${userAgencyId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'agencies', filter: `id=eq.${userAgencyId}` },
        (payload) => {
          const _row = payload.new as {
            whatsapp_status?: string;
            meta_access_token?: string | null;
            meta_phone_number_id?: string | null;
          };
          // Aynı hesap mantığı: token + phone_id varsa "active", yoksa DB status'u kullan
          const _hasMetaCreds = !!_row.meta_access_token && !!_row.meta_phone_number_id;
          if (_hasMetaCreds) {
            setWhatsappStatus("active");
          } else if (_row.whatsapp_status !== undefined) {
            setWhatsappStatus(_row.whatsapp_status || "");
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userAgencyId, isSuperAdmin]);

  // Trigger onboarding tour for first-time users
  useEffect(() => {
    if (!userAgencyId || isSuperAdmin) return;
    const done = localStorage.getItem(tourStorageKey(userAgencyId));
    if (!done) {
      // Small delay so sidebar is rendered
      const t = setTimeout(() => setShouldRunTour(true), 600);
      return () => clearTimeout(t);
    }
  }, [userAgencyId, isSuperAdmin]);

  // Check payment result from URL params
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const errorCode = searchParams.get("error");
    const errorMessage = searchParams.get("message");
    const orderId = searchParams.get("orderId");
    
    if (paymentStatus === "success") {
      toast({
        title: t("admin.payment.success"),
        description: orderId
          ? t("admin.payment.successDescWithOrder", { orderId: orderId.substring(0, 20) })
          : t("admin.payment.successDesc"),
        duration: 5000,
      });
      handleTabChange("history");
    } else if (paymentStatus === "failed") {
      let description = t("admin.payment.failedBase") + " ";

      if (errorCode) {
        switch (errorCode) {
          case "INSUFFICIENT_FUNDS":  description += t("admin.payment.insufficientFunds"); break;
          case "CARD_DECLINED":       description += t("admin.payment.cardDeclined"); break;
          case "EXPIRED_CARD":        description += t("admin.payment.expiredCard"); break;
          case "INVALID_CVV":         description += t("admin.payment.invalidCvv"); break;
          default:                    description += errorMessage ? decodeURIComponent(errorMessage) : t("admin.payment.failedGeneric");
        }
      } else {
        description += t("admin.payment.failedGeneric");
      }

      toast({
        title: t("admin.payment.failed"),
        description,
        variant: "destructive",
        duration: 7000,
      });
      handleTabChange("history");
    }
  }, [searchParams, toast]);

  useEffect(() => {
    if (session && (activeTab === "tours" || activeTab === "registrations")) {
      loadData();
    }
  }, [activeTab, session]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Always load tours for the registration filters
      let toursQueryBuilder = supabase
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
      if (!isSuperAdmin && userAgencyId) {
        toursQueryBuilder = toursQueryBuilder.eq("agency_id", userAgencyId);
      }
      const { data: toursData, error: toursError } = await toursQueryBuilder;
      
      if (toursError) throw toursError;

      // Fetch sold pax per tour_date from registrations (exclude CANCELLED)
      const tourDateIds = (toursData || []).flatMap((t: any) => t.tour_dates?.map((d: any) => d.id) || []);
      let soldMap: Record<string, number> = {};
      
      if (tourDateIds.length > 0) {
        const { data: regSoldData } = await supabase
          .from("registrations")
          .select("tour_date_id, pax")
          .in("tour_date_id", tourDateIds)
          .neq("status", "CANCELLED");
        
        if (regSoldData) {
          for (const reg of regSoldData) {
            soldMap[reg.tour_date_id] = (soldMap[reg.tour_date_id] || 0) + reg.pax;
          }
        }
      }

      const toursWithSold = (toursData || []).map((tour: any) => ({
        ...tour,
        tour_dates: tour.tour_dates?.map((d: any) => ({
          ...d,
          sold_pax: soldMap[d.id] || 0
        }))
      }));

      setTours(toursWithSold);

      if (activeTab === "registrations") {
        let regsQueryBuilder = supabase
          .from("registrations")
          .select(`
            *,
            tours (title, destination, currency),
            tour_dates (departure_date, price_adult)
          `)
          .order("created_at", { ascending: false });
        if (!isSuperAdmin && userAgencyId) {
          regsQueryBuilder = regsQueryBuilder.eq("agency_id", userAgencyId);
        }
        const { data, error } = await regsQueryBuilder;
        if (error) throw error;
        setRegistrations(data || []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTour = async () => {
    try {
      const tourToDelete = tours.find(t => t.id === deleteDialog.id);
      const { error } = await supabase
        .from("tours")
        .delete()
        .eq("id", deleteDialog.id);

      if (error) throw error;

      // Tour cache'ini temizle — chatbot yeni listeyi görsün
      if (tourToDelete?.agency_id) {
        supabase.functions.invoke("invalidate-tour-cache", { body: { agencyId: tourToDelete.agency_id } }).catch(() => {});
      }

      toast({
        title: t("admin.toast.success"),
        description: t("admin.tours.deleteSuccess"),
      });

      loadData();
      setDeleteDialog({ open: false, id: null, type: null });
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
      const tourOfDate = tours.find(t => t.tour_dates?.some((d: any) => d.id === deleteDialog.id));
      const { error } = await supabase
        .from("tour_dates")
        .delete()
        .eq("id", deleteDialog.id);

      if (error) throw error;

      // Tour cache'ini temizle — chatbot güncel tarihleri görsün
      if (tourOfDate?.agency_id) {
        supabase.functions.invoke("invalidate-tour-cache", { body: { agencyId: tourOfDate.agency_id } }).catch(() => {});
      }

      toast({
        title: t("admin.toast.success"),
        description: t("admin.date.deleteSuccess"),
      });

      loadData();
      setDeleteDialog({ open: false, id: null, type: null });
    } catch (error) {
      console.error("Delete date error:", error);
      toast({
        title: t("admin.toast.error"),
        description: t("admin.date.deleteError"),
        variant: "destructive"
      });
    }
  };

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
              // language omitted — edge function reads from whatsapp_user_profiles automatically
            }
          });

          if (messageError) {
            console.error('Template message error:', messageError);
            toast({
              title: t("common.warning"),
              description: t("admin.registrations.statusUpdateWarning"),
              variant: "default",
            });
          } else {
            toast({
              title: t("common.successTitle"),
              description: t("admin.registrations.statusUpdatedWithMsg"),
            });
          }
        } catch (msgError) {
          console.error('Message send error:', msgError);
          toast({
            title: t("common.successTitle"),
            description: t("admin.registrations.statusUpdatedNoMsg"),
          });
        }
      } else {
        toast({
          title: t("common.successTitle"),
          description: t("admin.registrations.statusUpdated"),
        });
      }

      loadData();
    } catch (error) {
      console.error("Update status error:", error);
      toast({
        title: t("common.error"),
        description: t("admin.registrations.statusUpdateError"),
        variant: "destructive"
      });
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: t("common.successTitle"),
        description: t("auth.loggedOut"),
      });
      navigate("/auth");
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: t("common.error"),
        description: t("auth.logoutFailed"),
        variant: "destructive"
      });
    }
  };

  if (!session) {
    return null; // Show nothing while redirecting
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AdminSidebar 
          isSuperAdmin={isSuperAdmin} 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          agencyName={agencyName}
          planFeatures={planFeatures}
        />
        
        <SidebarInset className="flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b shadow-sm">
            <div className="flex h-12 sm:h-14 items-center gap-2 px-3 sm:px-4">
              <SidebarTrigger className="-ml-1 shrink-0" data-tour="mobile-menu-button" />
              
              <div className="flex flex-1 items-center justify-between min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Button variant="ghost" size="icon" asChild className="shrink-0 h-8 w-8 sm:hidden">
                    <a href="/">
                      <ArrowLeft className="w-4 h-4" />
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild className="hover:scale-105 transition-transform duration-300 shrink-0 hidden sm:inline-flex">
                    <a href="/">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      {t("admin.home")}
                    </a>
                  </Button>
                  <div className="flex items-center gap-2 min-w-0">
                    <img 
                      src={turzzLogo} 
                      alt="Turzz AI Logo" 
                      className="h-7 sm:h-9 w-auto object-contain shrink-0"
                    />
                    <div className="min-w-0 hidden sm:block">
                      <h1 className="text-sm sm:text-base font-bold truncate">{t("admin.title")}</h1>
                      {agencyName && (
                        <p className="text-xs text-muted-foreground truncate max-w-[160px]">{agencyName}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!isSuperAdmin && (
                    <CommandPalette
                      onTabChange={handleTabChange}
                      onNewTour={() => { setSelectedTour(undefined); setTourFormOpen(true); }}
                      onBulkImport={() => setBulkImportOpen(true)}
                      onManualReg={() => setManualRegistrationDialogOpen(true)}
                      onLogout={handleLogout}
                      agencyId={userAgencyId ?? undefined}
                      onRestartTour={() => {
                        if (userAgencyId) {
                          localStorage.removeItem(tourStorageKey(userAgencyId));
                          setShouldRunTour(true);
                        }
                      }}
                    />
                  )}
                  {!isSuperAdmin && userAgencyId && (
                    <NotificationCenter agencyId={userAgencyId} onTabChange={handleTabChange} />
                  )}
                  <LanguageSelector />
                  <ThemeToggle />
                  <Button variant="ghost" size="sm" asChild className="hidden lg:inline-flex">
                    <a href="/yardim" target="_blank">
                      {t("admin.help")}
                    </a>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 sm:hidden">
                    <LogOut className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleLogout} className="hidden sm:inline-flex">
                    <LogOut className="w-4 h-4 mr-2" />
                    {t("admin.logout")}
                  </Button>
                </div>
              </div>
            </div>
            {/* Mobile agency name bar */}
            {agencyName && (
              <div className="sm:hidden px-3 pb-2 -mt-1">
                <p className="text-xs text-muted-foreground truncate">{agencyName}</p>
              </div>
            )}
          </header>

          {/* Main Content */}
          <main className="flex-1 p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6 overflow-x-hidden">
          <ErrorBoundary key={activeTab} fallbackMessage={t("admin.errorBoundary.message")}>
          <div key={activeTab} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
            {!isSuperAdmin && <SubscriptionBanner onNavigateToPlan={() => handleTabChange("history")} />}
            {!isSuperAdmin && userAgencyId && (
              <QuotaWarningBanner agencyId={userAgencyId} onNavigateToPlan={() => handleTabChange("history")} />
            )}
            {!isSuperAdmin && userAgencyId && (
              <OnboardingChecklist key={`onboarding-${whatsappStatus}`} agencyId={userAgencyId} onNavigate={handleTabChange} />
            )}

            {/* Open complaints badge */}
            {!isSuperAdmin && openComplaintsCount > 0 && activeTab !== "complaints" && (
              <Alert
                className="border-orange-400/50 bg-orange-50 dark:bg-orange-950/20 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-950/30 transition-colors"
                onClick={() => handleTabChange("complaints")}
              >
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <AlertDescription className="ml-2 text-orange-800 dark:text-orange-300">
                  <strong>{t("dashboard.complaints.badge", { count: openComplaintsCount })}</strong>
                  {" "}{t("dashboard.complaints.hint")}
                  <span className="underline ml-2">{t("dashboard.complaints.goto")}</span>
                </AlertDescription>
              </Alert>
            )}

            {/* Language Selection Warning */}
            {!isSuperAdmin && enabledLanguages.length === 0 && (
              <Alert 
                className="border-warning bg-warning/10 cursor-pointer hover:bg-warning/20 transition-colors"
                onClick={() => handleTabChange("languages")}
              >
                <AlertCircle className="h-5 w-5 text-warning" />
                <AlertDescription className="ml-2 text-warning-foreground">
                  <strong>{t("languageManagement.warning")}:</strong> {t("admin.languageWarning.message")}
                  <span className="underline ml-2">{t("admin.languageWarning.action")}</span>
                </AlertDescription>
              </Alert>
            )}
            
            
            {activeTab === "dashboard" ? (
              <AdminDashboard
                isSuperAdmin={isSuperAdmin}
                planFeatures={planFeatures}
                onTabChange={handleTabChange}
                onNewTour={() => { setSelectedTour(undefined); setTourFormOpen(true); }}
                onBulkImport={() => setBulkImportOpen(true)}
                onManualReg={() => setManualRegistrationDialogOpen(true)}
                agencyId={userAgencyId}
                agencyName={agencyName}
                whatsappStatus={whatsappStatus}
              />
            ) : activeTab === "whatsapp" ? (
              <WhatsAppConversations isSuperAdmin={isSuperAdmin} />
            ) : activeTab === "whatsapp_profiles" && (planFeatures?.has_user_profiles || isSuperAdmin) ? (
              <WhatsAppUserProfiles isSuperAdmin={isSuperAdmin} />
            ) : activeTab === "analytics" && (planFeatures?.has_analytics || isSuperAdmin) ? (
              <AdvancedAnalytics />
            ) : activeTab === "customer-analytics" && (planFeatures?.has_analytics || isSuperAdmin) ? (
              <CustomerAnalytics />
            ) : activeTab === "destination-analytics" && (planFeatures?.has_analytics || isSuperAdmin) ? (
              <DestinationAnalytics />
            ) : activeTab === "agency_info" ? (
              <AgencyInfoSettings />
            ) : activeTab === "complaints" ? (
              <ComplaintsManagement />
            ) : activeTab === "settings" ? (
              <WhatsAppSettings />
            ) : activeTab === "payment_settings" ? (
              <PaymentSettings />
            ) : activeTab === "languages" ? (
              <LanguageManagement />
            ) : activeTab === "language_currencies" ? (
              <LanguageCurrencySettings />
            ) : activeTab === "templates" && (planFeatures?.has_templates || isSuperAdmin) ? (
              <MessageTemplates />
            ) : activeTab === "faq" ? (
              <FAQManagement />
            ) : activeTab === "history" ? (
              <SubscriptionHistory />
            ) : activeTab === "customer-feedback" && (planFeatures?.has_feedback || isSuperAdmin) ? (
              <CustomerFeedback isSuperAdmin={isSuperAdmin} />
            ) : activeTab === "language-stats" ? (
              <LanguageStats isSuperAdmin={isSuperAdmin} />
            ) : activeTab === "whatsapp-logs" ? (
              <WhatsAppLogs />
            ) : activeTab === "tickets" && !isSuperAdmin ? (
              <TicketManagement />
            ) : activeTab === "super_tickets" && isSuperAdmin ? (
              <SuperAdminTickets isSuperAdmin={isSuperAdmin} />
            ) : activeTab === "whatsapp_management" && isSuperAdmin ? (
              <WhatsAppBusinessManagement isSuperAdmin={isSuperAdmin} />
            ) : activeTab === "whatsapp_integrations" && isSuperAdmin ? (
              <SuperAdminWhatsAppIntegrations isSuperAdmin={isSuperAdmin} />
            ) : activeTab === "whatsapp_settings" && isSuperAdmin ? (
              <SuperAdminWhatsAppSettings isSuperAdmin={isSuperAdmin} />
            ) : activeTab === "whatsapp_test" && isSuperAdmin ? (
              <WhatsAppTestPanel />
            ) : activeTab === "agencies" && isSuperAdmin ? (
              <AgencyManagement isSuperAdmin={isSuperAdmin} />
            ) : activeTab === "contact_forms" && isSuperAdmin ? (
              <ContactFormsManagement isSuperAdmin={isSuperAdmin} />
            ) : activeTab === "central_notifications" && isSuperAdmin ? (
              <CentralNotifications />
            ) : activeTab === "central_send_log" && isSuperAdmin ? (
              <CentralSendLog />
            ) : activeTab === "tours" || activeTab === "registrations" ? (
              <Card className="shadow-card">
                <CardHeader className="p-3 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <CardTitle className="text-base sm:text-lg">
                      {activeTab === "tours" ? t("admin.tours.title") : t("admin.registrations.title")}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2">
                      {activeTab === "tours" ? (
                        <>
                          {/* 📥 Mevcut turları Excel olarak indir (her satır = 1 tur+tarih, sistem alanları dolu) */}
                          <Button
                            onClick={() => exportToursToExcel(tours)}
                            variant="outline"
                            size="sm"
                            disabled={tours.length === 0}
                            title={t("admin.tours.exportHint", { defaultValue: "Mevcut turlarınızı Excel'e indirir" })}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            <span className="hidden sm:inline">{t("admin.tours.export")}</span>
                            <span className="sm:hidden">Excel</span>
                          </Button>
                          {/* 📄 Boş şablon indir — yeni tur eklemek için. Dialog İÇİNDE değil, görünür yerde. */}
                          {!isSuperAdmin && userAgencyId && (
                            <Button
                              onClick={() => downloadTourImportTemplate()}
                              variant="outline"
                              size="sm"
                              title={t("admin.tours.downloadTemplateHint", { defaultValue: "Yeni tur eklemek için boş şablon (örnek satırlarla)" })}
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              <span className="hidden sm:inline">{t("admin.tours.downloadTemplate", { defaultValue: "Boş Şablon İndir" })}</span>
                              <span className="sm:hidden">{t("admin.tours.downloadTemplateShort", { defaultValue: "Şablon" })}</span>
                            </Button>
                          )}
                          {/* 📤 Excel'den toplu içe aktar (önizleme + AI çevirisi) */}
                          {!isSuperAdmin && userAgencyId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setBulkImportOpen(true)}
                              title={t("admin.tours.bulkImportHint", { defaultValue: "Doldurduğunuz Excel'i yükleyin" })}
                            >
                              <FileSpreadsheet className="w-4 h-4 mr-1" />
                              <span className="hidden sm:inline">{t("tours.bulkImport")}</span>
                              <span className="sm:hidden">{t("admin.tours.bulkImportShort", { defaultValue: "İçe Aktar" })}</span>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!isSuperAdmin && !isWithinTourLimit(tours.length, maxTours)) {
                                const planNames = {
                                  'starter': t("admin.planLimits.starterPlan"),
                                  'professional': t("admin.planLimits.professionalPlan"),
                                  'enterprise': t("admin.planLimits.enterprisePlan")
                                };
                                toast({
                                  title: t("admin.planLimits.tourLimitReached"),
                                  description: t("admin.planLimits.tourLimitMessage", { 
                                    planName: planNames[planType as keyof typeof planNames] || planType,
                                    maxTours: maxTours 
                                  }),
                                  variant: "destructive",
                                });
                                return;
                              }
                              setSelectedTour(undefined);
                              setTourFormOpen(true);
                            }}
                            className="bg-gradient-ocean hover:opacity-90"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            {t("admin.tours.addNew")}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            onClick={() => setManualRegistrationDialogOpen(true)}
                            className="bg-gradient-ocean hover:opacity-90"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            <span className="hidden sm:inline">{t("admin.registrations.addManual")}</span>
                            <span className="sm:hidden">Ekle</span>
                          </Button>
                          <Button
                            onClick={() => exportRegistrationsToExcel(registrations)}
                            variant="outline"
                            size="sm"
                            disabled={registrations.length === 0}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            <span className="hidden sm:inline">{t("admin.registrations.export")}</span>
                            <span className="sm:hidden">Excel</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Registration Filters */}
                  {activeTab === "registrations" && (
                    <div className="mt-4">
                      <RegistrationFilters
                        filterStatus={filterStatus}
                        setFilterStatus={setFilterStatus}
                        filterTour={filterTour}
                        setFilterTour={setFilterTour}
                        filterTourDate={filterTourDate}
                        setFilterTourDate={setFilterTourDate}
                        availableTourDates={availableTourDates}
                        filterSourceChannel={filterSourceChannel}
                        setFilterSourceChannel={setFilterSourceChannel}
                        filterCategory={filterCategory}
                        setFilterCategory={setFilterCategory}
                        tours={filteredToursForDropdown}
                        filterDateFrom={filterDateFrom}
                        setFilterDateFrom={setFilterDateFrom}
                        filterDateTo={filterDateTo}
                        setFilterDateTo={setFilterDateTo}
                        filterPriceMin={filterPriceMin}
                        setFilterPriceMin={setFilterPriceMin}
                        filterPriceMax={filterPriceMax}
                        setFilterPriceMax={setFilterPriceMax}
                        onClearFilters={clearFilters}
                      />
                    </div>
                  )}
                </CardHeader>

                <CardContent>
                  {activeTab === "tours" ? (
                    <ToursList
                      tours={tours}
                      loading={loading}
                      agencyId={userAgencyId ?? undefined}
                      onAddDate={(tourId) => {
                        setSelectedTourForDate(tourId);
                        setSelectedDate(null);
                        setDateFormOpen(true);
                      }}
                      onEditTour={(tour) => {
                        setSelectedTour(tour);
                        setTourFormOpen(true);
                      }}
                      onDeleteTour={(tourId) => setDeleteDialog({ open: true, id: tourId, type: "tour" })}
                      onEditDate={(tourId, date) => {
                        setSelectedTourForDate(tourId);
                        setSelectedDate(date);
                        setDateFormOpen(true);
                      }}
                      onDeleteDate={(dateId) => setDeleteDialog({ open: true, id: dateId, type: "date" })}
                      onRefresh={loadData}
                    />
                  ) : (
                    <div className="space-y-4">
                      {/* Faz 1: Kayıtlar 3 görünüm seçici. Varsayılan "Liste" — mevcut davranış.
                          Status update tüm görünümlerden TEK MERKEZ: useRegistrations.handleStatusChange
                          → send-template-message edge function. Filtrelenmiş veri (getFilteredRegistrations)
                          3 görünüme de aynı kaynaktan geçer. */}
                      <Tabs
                        value={registrationsView}
                        onValueChange={(v) => setRegistrationsView(v as RegistrationsView)}
                      >
                        {/* Faz 2-C: Sıra Sefer Bazlı → Tur Bazlı → Liste. Inline-flex, content-fit. */}
                        <TabsList className="inline-flex h-auto p-1 gap-1">
                          <TabsTrigger value="by-departure" className="gap-2 px-3 py-1.5">
                            <CalendarDays className="w-4 h-4" />
                            <span className="text-sm">
                              {t("admin.registrations.viewByDeparture", { defaultValue: "Sefer Bazlı" })}
                            </span>
                          </TabsTrigger>
                          <TabsTrigger value="by-tour" className="gap-2 px-3 py-1.5">
                            <Layers className="w-4 h-4" />
                            <span className="text-sm">
                              {t("admin.registrations.viewByTour", { defaultValue: "Tur Bazlı" })}
                            </span>
                          </TabsTrigger>
                          <TabsTrigger value="list" className="gap-2 px-3 py-1.5">
                            <List className="w-4 h-4" />
                            <span className="text-sm">
                              {t("admin.registrations.viewList", { defaultValue: "Liste" })}
                            </span>
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>

                      {registrationsView === "list" && (
                        <RegistrationsList
                          registrations={getFilteredRegistrations()}
                          loading={loading}
                          onStatusChange={handleStatusChange}
                          onViewDetail={(registration) => {
                            setSelectedRegistration(registration);
                            setDetailDialogOpen(true);
                          }}
                        />
                      )}

                      {registrationsView === "by-tour" && (
                        <RegistrationsByTour
                          registrations={getFilteredRegistrations()}
                          loading={loading}
                          onStatusChange={handleStatusChange}
                          onViewDetail={(registration) => {
                            setSelectedRegistration(registration);
                            setDetailDialogOpen(true);
                          }}
                        />
                      )}

                      {registrationsView === "by-departure" && (
                        <RegistrationsByDeparture
                          registrations={getFilteredRegistrations()}
                          loading={loading}
                          onSelectDeparture={(g) => {
                            setSelectedDepartureGroup(g);
                            setDepartureDetailOpen(true);
                          }}
                        />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>
          </ErrorBoundary>
          </main>

      {/* Dialogs */}
      <TourFormDialog
        isOpen={tourFormOpen}
        onClose={() => {
          setTourFormOpen(false);
          setSelectedTour(undefined);
        }}
        onSuccess={loadData}
        tour={selectedTour}
      />

      <TourDateFormDialog
        isOpen={dateFormOpen}
        onClose={() => {
          setDateFormOpen(false);
          setSelectedDate(null);
          setSelectedTourForDate(null);
        }}
        onSuccess={loadData}
        tourId={selectedTourForDate}
        tourDate={selectedDate}
      />

      {userAgencyId && (
        <BulkTourImport
          agencyId={userAgencyId}
          open={bulkImportOpen}
          onClose={() => setBulkImportOpen(false)}
          onSuccess={loadData}
        />
      )}

      {userAgencyId && (
        <OnboardingTour
          agencyId={userAgencyId}
          shouldRun={shouldRunTour}
          onComplete={() => setShouldRunTour(false)}
        />
      )}

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, id: null, type: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.tours.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.tours.deleteWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteDialog.type === "tour" ? handleDeleteTour : handleDeleteDate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
        </SidebarInset>
      </div>
      
      {/* Manual Registration Dialog */}
      <ManualRegistrationDialog
        open={manualRegistrationDialogOpen}
        onOpenChange={setManualRegistrationDialogOpen}
        tours={tours.map(t => ({
          id: t.id,
          title: t.title,
          tur_kategorisi: t.tur_kategorisi,
          currency: t.currency,
          tour_dates: t.tour_dates?.map(td => ({
            id: td.id,
            departure_date: td.departure_date,
            price_adult: td.price_adult
          })) || []
        }))}
        onSuccess={() => {
          if (session && activeTab === "registrations") {
            loadData();
          }
        }}
        agencyId={userAgencyId}
      />

      {/* Registration Detail Dialog */}
      <RegistrationDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        registration={selectedRegistration}
        onSuccess={() => {
          if (session && activeTab === "registrations") {
            loadData();
          }
        }}
      />

      {/* Faz 1 + Faz 2-A: Sefer detayı (yolcu listesi + doluluk + manifesto Excel/PDF + yolcu editörü) */}
      <DepartureDetailDialog
        open={departureDetailOpen}
        onOpenChange={setDepartureDetailOpen}
        group={selectedDepartureGroup}
        onViewDetail={(registration) => {
          setSelectedRegistration(registration);
          setDetailDialogOpen(true);
        }}
        onDataChange={() => {
          // Faz 2-A: Yolcu editöründe ekle/sil yapıldıysa pax değişti — listeyi yenile.
          if (session && activeTab === "registrations") {
            loadData();
          }
        }}
      />

      {/* Support Chat Widget */}
      <SupportChatWidget />
    </SidebarProvider>
  );
};

export default Admin;
