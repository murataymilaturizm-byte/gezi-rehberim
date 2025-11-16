import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import turzzLogo from "@/assets/turzz-logo-orange.png";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
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
import { ArrowLeft, Plane, Plus, Pencil, Trash2, Calendar, LogOut, Download, AlertCircle, Menu } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TourFormDialog } from "@/components/TourFormDialog";
import { TourDateFormDialog } from "@/components/TourDateFormDialog";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AdvancedAnalytics } from "@/components/AdvancedAnalytics";
import { WhatsAppConversations } from "@/components/WhatsAppConversations";
import { WhatsAppUserProfiles } from "@/components/WhatsAppUserProfiles";
import { LanguageStats } from "@/components/LanguageStats";
import { AgencyManagement } from "@/components/AgencyManagement";
import { ContactFormsManagement } from "@/components/ContactFormsManagement";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { TwilioSettings } from "@/components/TwilioSettings";
import { SuperAdminTwilioSettings } from "@/components/SuperAdminTwilioSettings";
import { SubscriptionHistory } from "@/components/SubscriptionHistory";
import MessageTemplates from "@/components/MessageTemplates";
import { CustomerFeedback } from "@/components/CustomerFeedback";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { exportRegistrationsToExcel, exportToursToExcel } from "@/utils/excelExporter";
import { SupportChatWidget } from "@/components/SupportChatWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { LanguageManagement } from "@/components/LanguageManagement";
import { TicketManagement } from "@/components/TicketManagement";
import { SuperAdminTickets } from "@/components/SuperAdminTickets";
import { WhatsAppLogs } from "@/components/WhatsAppLogs";
import { getMaxTours, getPlanFeatures, canUseFeature, PlanFeatures } from "@/utils/planFeatures";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";

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
  tours: {
    title: string;
    destination: string;
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
  
  const statusLabels: Record<string, string> = {
    NEW: t("admin.status.new"),
    PENDING: t("admin.status.pending"),
    CONFIRMED: t("admin.status.confirmed"),
    CANCELLED: t("admin.status.cancelled")
  };

  const tourTypeLabels: Record<string, string> = {
    DAYTRIP: t("admin.tourTypes.daytrip"),
    N2: t("admin.tourTypes.n2"),
    N3: t("admin.tourTypes.n3")
  };
  const [session, setSession] = useState<Session | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userAgencyId, setUserAgencyId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "tours" | "registrations" | "whatsapp" | "whatsapp_profiles" | "settings" | "history" | "agencies" | "contact_forms" | "twilio_settings" | "templates" | "customer-feedback" | "languages" | "tickets" | "super_tickets" | "whatsapp_logs" | "analytics">("dashboard");
  const [tours, setTours] = useState<Tour[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
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
  const [planType, setPlanType] = useState<string>('starter');
  const [maxTours, setMaxTours] = useState<number>(10);
  const [planFeatures, setPlanFeatures] = useState<PlanFeatures | null>(null);
  const [enabledLanguages, setEnabledLanguages] = useState<string[]>([]);
  
  // Registration filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTour, setFilterTour] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>();
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>();
  const [filterPriceMin, setFilterPriceMin] = useState<string>("");
  const [filterPriceMax, setFilterPriceMax] = useState<string>("");

  useEffect(() => {
    // Check authentication
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        // Check user role
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

  // Check payment result from URL params
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const errorCode = searchParams.get("error");
    const errorMessage = searchParams.get("message");
    const orderId = searchParams.get("orderId");
    
    if (paymentStatus === "success") {
      toast({
        title: "Ödeme Başarılı! 🎉",
        description: orderId 
          ? `Aboneliğiniz aktifleştirildi. Sipariş No: ${orderId.substring(0, 20)}...`
          : "Aboneliğiniz aktifleştirildi. Faturanız hazırlanıyor.",
        duration: 5000,
      });
      setActiveTab("history");
      // Clear URL params
      setSearchParams({});
    } else if (paymentStatus === "failed") {
      let description = "Ödeme işlemi tamamlanamadı. ";
      
      // Add specific error messages based on error code
      if (errorCode) {
        switch (errorCode) {
          case "INSUFFICIENT_FUNDS":
            description += "Kartınızda yeterli bakiye bulunmuyor.";
            break;
          case "CARD_DECLINED":
            description += "Kartınız reddedildi. Lütfen bankanızla iletişime geçin.";
            break;
          case "EXPIRED_CARD":
            description += "Kartınızın süresi dolmuş.";
            break;
          case "INVALID_CVV":
            description += "CVV kodu hatalı.";
            break;
          default:
            description += errorMessage ? decodeURIComponent(errorMessage) : "Lütfen tekrar deneyin veya farklı bir kart kullanın.";
        }
      } else {
        description += "Lütfen tekrar deneyin veya farklı bir kart kullanın.";
      }
      
      toast({
        title: "Ödeme Başarısız ❌",
        description,
        variant: "destructive",
        duration: 7000,
      });
      setActiveTab("history");
      // Clear URL params
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, toast]);

  const checkUserRole = async (userId: string) => {
    try {
      // Get user profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();

      setUserName(profileData?.full_name || "");

      // Check if super admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "super_admin")
        .maybeSingle();

      setIsSuperAdmin(!!roleData);

      // Get user's agency ID, name and language preference if not super admin
      if (!roleData) {
        const { data: agencyData } = await supabase
          .from("agencies")
          .select("id, agency_name, language_preference, plan_type, enabled_languages")
          .eq("user_id", userId)
          .maybeSingle();

        setUserAgencyId(agencyData?.id || null);
        setAgencyName(agencyData?.agency_name || "");
        setEnabledLanguages(agencyData?.enabled_languages || []);
        
        // Load plan features
        const currentPlanType = (agencyData?.plan_type as string) || 'starter';
        setPlanType(currentPlanType);
        const maxToursLimit = await getMaxTours(currentPlanType);
        setMaxTours(maxToursLimit);
        
        // Set language preference based on agency's city/region
        if (agencyData?.language_preference) {
          i18n.changeLanguage(agencyData.language_preference);
          console.log('Admin language set to:', agencyData.language_preference);
        }
      } else {
        setAgencyName(t("admin.superAdmin"));
      }
    } catch (error) {
      console.error("Error checking user role:", error);
    }
  };

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [activeTab, session]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "tours") {
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
      } else {
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
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

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
      
      loadData();
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
      
      loadData();
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
              language: 'tr' // Şimdilik Türkçe, ileride kullanıcı tercihinden alınabilir
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
              title: "Başarılı! ✅",
              description: `Kayıt durumu güncellendi ve müşteriye WhatsApp mesajı gönderildi`,
            });
          }
        } catch (msgError) {
          console.error('Message send error:', msgError);
          toast({
            title: "Başarılı! ✅",
            description: "Kayıt durumu güncellendi (mesaj gönderilemedi)",
          });
        }
      } else {
        toast({
          title: "Başarılı! ✅",
          description: "Kayıt durumu güncellendi",
        });
      }
      
      loadData();
    } catch (error) {
      console.error("Update status error:", error);
      toast({
        title: "Hata",
        description: "Durum güncellenemedi",
        variant: "destructive"
      });
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Başarılı! ✅",
        description: "Çıkış yapıldı",
      });
      navigate("/auth");
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Hata",
        description: "Çıkış yapılamadı",
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
          onTabChange={(tab) => setActiveTab(tab as any)} 
        />
        
        <SidebarInset>
          {/* Header */}
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="flex flex-1 items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" asChild className="hover:scale-105 transition-transform duration-300">
                  <a href="/">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">{t("admin.home")}</span>
                  </a>
                </Button>
                <div className="flex items-center gap-2">
                  <img 
                    src={turzzLogo} 
                    alt="Turzz AI Logo" 
                    className="h-10 w-auto object-contain"
                  />
                  <div>
                    <h1 className="text-lg font-bold">{t("admin.title")}</h1>
                    {agencyName && (
                      <p className="text-xs text-muted-foreground">{agencyName}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <LanguageSelector />
                <ThemeToggle />
                <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                  <a href="/yardim" target="_blank">
                    {t("admin.help")}
                  </a>
                </Button>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t("admin.logout")}</span>
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6 space-y-6">
            {/* Subscription Banner */}
            {!isSuperAdmin && <SubscriptionBanner />}
            
            {/* Language Selection Warning */}
            {!isSuperAdmin && enabledLanguages.length === 0 && (
              <Alert 
                className="border-warning bg-warning/10 cursor-pointer hover:bg-warning/20 transition-colors"
                onClick={() => setActiveTab("languages")}
              >
                <AlertCircle className="h-5 w-5 text-warning" />
                <AlertDescription className="ml-2 text-warning-foreground">
                  <strong>{t("languageManagement.warning")}:</strong> {t("admin.languageWarning.message")}
                  <span className="underline ml-2">{t("admin.languageWarning.action")}</span>
                </AlertDescription>
              </Alert>
            )}
            
            
            {activeTab === "dashboard" ? (
          <AdminDashboard isSuperAdmin={isSuperAdmin} planFeatures={planFeatures} />
        ) : activeTab === "whatsapp" && (planFeatures?.has_user_profiles || isSuperAdmin) ? (
          <div className="space-y-6">
            {isSuperAdmin && <LanguageStats isSuperAdmin={isSuperAdmin} />}
            <WhatsAppUserProfiles isSuperAdmin={isSuperAdmin} />
            <WhatsAppConversations isSuperAdmin={isSuperAdmin} />
          </div>
        ) : activeTab === "settings" ? (
          <TwilioSettings />
        ) : activeTab === "languages" ? (
          <LanguageManagement />
        ) : activeTab === "templates" && planFeatures?.has_templates ? (
          <MessageTemplates />
        ) : activeTab === "history" ? (
          <SubscriptionHistory />
        ) : activeTab === "customer-feedback" && planFeatures?.has_feedback ? (
          <CustomerFeedback />
        ) : activeTab === "tickets" && !isSuperAdmin ? (
          <TicketManagement />
        ) : activeTab === "twilio_settings" && isSuperAdmin ? (
          <SuperAdminTwilioSettings />
        ) : activeTab === "agencies" && isSuperAdmin ? (
          <AgencyManagement />
        ) : activeTab === "contact_forms" && isSuperAdmin ? (
          <ContactFormsManagement />
        ) : activeTab === "tickets" && isSuperAdmin ? (
          <SuperAdminTickets />
        ) : activeTab === "whatsapp_logs" && isSuperAdmin ? (
          <WhatsAppLogs />
        ) : (
          <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {activeTab === "tours" ? t("admin.tours.title") : t("admin.registrations.title")}
              </CardTitle>
              <div className="flex gap-2">
                {activeTab === "tours" ? (
                  <>
                    <Button
                      onClick={() => exportToursToExcel(tours)}
                      variant="outline"
                      disabled={tours.length === 0}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {t("admin.tours.export")}
                    </Button>
                    <Button
                      onClick={() => {
                        if (!isSuperAdmin && tours.length >= maxTours) {
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
                      <Plus className="w-4 h-4 mr-2" />
                      {t("admin.tours.addNew")}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => exportRegistrationsToExcel(registrations)}
                    variant="outline"
                    disabled={registrations.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {t("admin.registrations.export")}
                  </Button>
                )}
              </div>
            </div>
            
            {/* Registration Filters */}
            {activeTab === "registrations" && (
              <div className="mt-4 p-3 bg-accent/30 rounded-lg border border-border/50">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                  {/* Status Filter */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground">{t("admin.filters.status")}</label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={t("admin.filters.allStatuses")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("admin.filters.all")}</SelectItem>
                        <SelectItem value="NEW">{t("admin.status.new")}</SelectItem>
                        <SelectItem value="PENDING">{t("admin.status.pending")}</SelectItem>
                        <SelectItem value="CONFIRMED">{t("admin.status.confirmed")}</SelectItem>
                        <SelectItem value="CANCELLED">{t("admin.status.cancelled")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tour Filter */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground">{t("admin.filters.tour")}</label>
                    <Select value={filterTour} onValueChange={setFilterTour}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={t("admin.filters.allTours")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("admin.filters.all")}</SelectItem>
                        {tours.map((tour) => (
                          <SelectItem key={tour.id} value={tour.id}>
                            {tour.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date Filter */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground">{t("admin.filters.dateRange")}</label>
                    <div className="flex gap-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "h-8 flex-1 justify-start text-left font-normal text-[10px] px-1.5",
                              !filterDateFrom && "text-muted-foreground"
                            )}
                          >
                            {filterDateFrom ? format(filterDateFrom, "d MMM", { locale: tr }) : t("admin.filters.from")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={filterDateFrom}
                            onSelect={setFilterDateFrom}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "h-8 flex-1 justify-start text-left font-normal text-[10px] px-1.5",
                              !filterDateTo && "text-muted-foreground"
                            )}
                          >
                            {filterDateTo ? format(filterDateTo, "d MMM", { locale: tr }) : t("admin.filters.to")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={filterDateTo}
                            onSelect={setFilterDateTo}
                            disabled={(date) => filterDateFrom ? date < filterDateFrom : false}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Price Range Filter */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground">{t("admin.filters.priceRange")}</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={filterPriceMin}
                        onChange={(e) => setFilterPriceMin(e.target.value)}
                        placeholder={t("admin.filters.min")}
                        className="flex h-8 w-full rounded-md border border-input bg-background px-1.5 py-1 text-[10px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <input
                        type="number"
                        value={filterPriceMax}
                        onChange={(e) => setFilterPriceMax(e.target.value)}
                        placeholder={t("admin.filters.max")}
                        className="flex h-8 w-full rounded-md border border-input bg-background px-1.5 py-1 text-[10px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                </div>

                {/* Clear Filters Button */}
                {(filterStatus !== "all" || filterTour !== "all" || filterDateFrom || filterDateTo || filterPriceMin || filterPriceMax) && (
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px]"
                      onClick={() => {
                        setFilterStatus("all");
                        setFilterTour("all");
                        setFilterDateFrom(undefined);
                        setFilterDateTo(undefined);
                        setFilterPriceMin("");
                        setFilterPriceMax("");
                      }}
                    >
                      {t("admin.filters.clear")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">{t("admin.loading")}</div>
            ) : activeTab === "tours" ? (
              <div className="space-y-4">
                {tours.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t("admin.tours.noTours")}
                  </div>
                ) : (
                  tours.map((tour) => (
                    <Card key={tour.id} className="border-border/50">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h3 className="font-semibold text-lg">{tour.title}</h3>
                            <div className="flex gap-2 text-sm text-muted-foreground">
                              <span>{tour.destination}</span>
                              <span>•</span>
                              <Badge variant="secondary" className="text-xs">
                                {tourTypeLabels[tour.type] || tour.type}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedTourForDate(tour.id);
                                setSelectedDate(undefined);
                                setDateFormOpen(true);
                              }}
                            >
                              <Calendar className="w-4 h-4 mr-2" />
                              {t("admin.tours.addDate")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedTour(tour);
                                setTourFormOpen(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteDialog({ open: true, id: tour.id, type: "tour" })}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      {tour.tour_dates && tour.tour_dates.length > 0 && (
                        <CardContent>
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">{t("admin.tours.dates")}:</h4>
                            <div className="space-y-2">
                              {tour.tour_dates.map((date) => (
                                <div
                                  key={date.id}
                                  className="flex items-center justify-between p-2 rounded-lg bg-accent/50 text-sm"
                                >
                                  <div className="flex gap-4">
                                    <span>
                                      {format(new Date(date.departure_date), "d MMM yyyy", { locale: tr })}
                                      {date.return_date && date.return_date !== date.departure_date && (
                                        <> - {format(new Date(date.return_date), "d MMM yyyy", { locale: tr })}</>
                                      )}
                                    </span>
                                    <span className="font-medium">{date.price_adult} {tour.currency}</span>
                                    <span className="text-muted-foreground">{t("admin.tours.quota")}: {date.quota}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedTourForDate(tour.id);
                                        setSelectedDate(date);
                                        setDateFormOpen(true);
                                      }}
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDeleteDialog({ open: true, id: date.id, type: "date" })}
                                    >
                                      <Trash2 className="w-3 h-3 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.registrations.name")}</TableHead>
                    <TableHead>{t("admin.registrations.phone")}</TableHead>
                    <TableHead>{t("admin.registrations.tour")}</TableHead>
                    <TableHead>{t("admin.registrations.date")}</TableHead>
                    <TableHead className="text-center">{t("admin.registrations.pax")}</TableHead>
                    <TableHead className="text-right">Birim Fiyat</TableHead>
                    <TableHead className="text-right font-semibold">Toplam</TableHead>
                    <TableHead>{t("admin.registrations.status")}</TableHead>
                    <TableHead className="text-center">Not</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    // Apply filters
                    let filteredRegistrations = registrations.filter((reg) => {
                      // Status filter
                      if (filterStatus !== "all" && reg.status !== filterStatus) {
                        return false;
                      }

                      // Tour filter
                      if (filterTour !== "all" && reg.tour_id !== filterTour) {
                        return false;
                      }

                      // Date range filter
                      if (filterDateFrom && reg.tour_dates?.departure_date) {
                        const regDate = new Date(reg.tour_dates.departure_date);
                        if (regDate < filterDateFrom) {
                          return false;
                        }
                      }

                      if (filterDateTo && reg.tour_dates?.departure_date) {
                        const regDate = new Date(reg.tour_dates.departure_date);
                        if (regDate > filterDateTo) {
                          return false;
                        }
                      }

                      // Price filter
                      const unitPrice = reg.tour_dates?.price_adult || 0;
                      const totalPrice = unitPrice * reg.pax;

                      if (filterPriceMin && totalPrice < Number(filterPriceMin)) {
                        return false;
                      }

                      if (filterPriceMax && totalPrice > Number(filterPriceMax)) {
                        return false;
                      }

                      return true;
                    });

                    if (filteredRegistrations.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                            {registrations.length === 0 
                              ? t("admin.registrations.noRegistrations")
                              : t("admin.registrations.noFilteredResults")}
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return filteredRegistrations.map((reg) => {
                      const unitPrice = reg.tour_dates?.price_adult || 0;
                      const totalPrice = unitPrice * reg.pax;
                      
                      return (
                        <TableRow key={reg.id} className="hover:bg-accent/50">
                          <TableCell className="font-medium">{reg.full_name}</TableCell>
                          <TableCell>
                            <a href={`tel:${reg.phone}`} className="text-primary hover:underline">
                              {reg.phone}
                            </a>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="font-medium">{reg.tours?.title}</span>
                              <span className="text-xs text-muted-foreground">{reg.tours?.destination}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {reg.tour_dates?.departure_date &&
                              format(new Date(reg.tour_dates.departure_date), "d MMM yyyy", { locale: tr })}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="font-semibold">
                              {reg.pax} kişi
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {unitPrice > 0 ? `${unitPrice.toLocaleString('tr-TR')}₺` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {totalPrice > 0 ? (
                              <span className="font-bold text-lg text-primary">
                                {totalPrice.toLocaleString('tr-TR')}₺
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={reg.status}
                              onValueChange={(value) => handleStatusChange(reg.id, value as "NEW" | "PENDING" | "CONFIRMED" | "CANCELLED")}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NEW">
                                  <Badge variant="secondary">{statusLabels.NEW}</Badge>
                                </SelectItem>
                                <SelectItem value="PENDING">
                                  <Badge variant="secondary">{statusLabels.PENDING}</Badge>
                                </SelectItem>
                                <SelectItem value="CONFIRMED">
                                  <Badge variant="default">{statusLabels.CONFIRMED}</Badge>
                                </SelectItem>
                                <SelectItem value="CANCELLED">
                                  <Badge variant="destructive">{statusLabels.CANCELLED}</Badge>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-center">
                            {reg.note && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  toast({
                                    title: "Rezervasyon Notu",
                                    description: reg.note,
                                    duration: 5000,
                                  });
                                }}
                              >
                                📝
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        )}
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
          setSelectedDate(undefined);
          setSelectedTourForDate("");
        }}
        onSuccess={loadData}
        tourId={selectedTourForDate}
        tourDate={selectedDate}
      />

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, id: "", type: "tour" })}>
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
      
      {/* Support Chat Widget */}
      <SupportChatWidget />
    </SidebarProvider>
  );
};

export default Admin;
