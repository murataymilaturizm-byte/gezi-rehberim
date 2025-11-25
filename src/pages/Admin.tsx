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
import { AdminDashboard } from "@/components/AdminDashboard";
import { AdvancedAnalytics } from "@/components/AdvancedAnalytics";
import { CustomerAnalytics } from "@/components/CustomerAnalytics";
import { DestinationAnalytics } from "@/components/DestinationAnalytics";
import { WhatsAppConversations } from "@/components/WhatsAppConversations";
import { WhatsAppUserProfiles } from "@/components/WhatsAppUserProfiles";
import { AgencyManagement } from "@/components/AgencyManagement";
import { ContactFormsManagement } from "@/components/ContactFormsManagement";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { TwilioSettings } from "@/components/TwilioSettings";
import { SuperAdminTwilioSettings } from "@/components/SuperAdminTwilioSettings";
import { SubscriptionHistory } from "@/components/SubscriptionHistory";
import MessageTemplates from "@/components/MessageTemplates";
import FAQManagement from "@/components/FAQManagement";
import { CustomerFeedback } from "@/components/CustomerFeedback";
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
import { getMaxTours, getPlanFeatures, PlanFeatures } from "@/utils/planFeatures";
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
  
  // Active tab state
  const [activeTab, setActiveTab] = useState<"dashboard" | "tours" | "registrations" | "whatsapp" | "whatsapp_profiles" | "agency_info" | "complaints" | "settings" | "payment_settings" | "history" | "agencies" | "contact_forms" | "twilio_settings" | "templates" | "faq" | "customer-feedback" | "languages" | "language_currencies" | "tickets" | "super_tickets" | "analytics" | "customer-analytics" | "destination-analytics">("dashboard");
  
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
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterTour, setFilterTour] = useState<string>("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>();
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>();
  const [filterPriceMin, setFilterPriceMin] = useState<string>("");
  const [filterPriceMax, setFilterPriceMax] = useState<string>("");

  // Plan features state
  const [planType, setPlanType] = useState<string>('starter');
  const [maxTours, setMaxTours] = useState<number>(10);
  const [planFeatures, setPlanFeatures] = useState<PlanFeatures | null>(null);
  const [enabledLanguages, setEnabledLanguages] = useState<string[]>([]);
  
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
        .select("plan_type, enabled_languages")
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
      }
    } catch (error) {
      console.error("Error loading agency plan:", error);
    }
  };

  const clearFilters = () => {
    setFilterStatus("ALL");
    setFilterTour("ALL");
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
    setFilterPriceMin("");
    setFilterPriceMax("");
  };

  const getFilteredRegistrations = () => {
    return registrations.filter(reg => {
      if (filterStatus !== "ALL" && reg.status !== filterStatus) return false;
      if (filterTour !== "ALL" && reg.tour_id !== filterTour) return false;
      
      if (filterDateFrom || filterDateTo) {
        const regDate = new Date(reg.created_at);
        if (filterDateFrom && regDate < filterDateFrom) return false;
        if (filterDateTo && regDate > filterDateTo) return false;
      }
      
      if (filterPriceMin || filterPriceMax) {
        const totalPrice = reg.tour_dates.price_adult * reg.pax;
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

  useEffect(() => {
    if (session && (activeTab === "tours" || activeTab === "registrations")) {
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
      } else if (activeTab === "registrations") {
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
          planFeatures={planFeatures}
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
              <TwilioSettings />
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
              <CustomerFeedback />
            ) : activeTab === "tickets" && !isSuperAdmin ? (
              <TicketManagement />
            ) : activeTab === "super_tickets" && isSuperAdmin ? (
              <SuperAdminTickets />
            ) : activeTab === "twilio_settings" && isSuperAdmin ? (
              <SuperAdminTwilioSettings />
            ) : activeTab === "agencies" && isSuperAdmin ? (
              <AgencyManagement />
             ) : activeTab === "tours" || activeTab === "registrations" ? (
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
                    <div className="mt-4">
                      <RegistrationFilters
                        filterStatus={filterStatus}
                        setFilterStatus={setFilterStatus}
                        filterTour={filterTour}
                        setFilterTour={setFilterTour}
                        tours={tours}
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
                      onAddDate={(tourId) => {
                        setSelectedTourForDate(tourId);
                        setSelectedDate(null);
                        setDateFormOpen(true);
                      }}
                      onEditTour={(tour) => {
                        setSelectedTour(tour as any);
                        setTourFormOpen(true);
                      }}
                      onDeleteTour={(tourId) => setDeleteDialog({ open: true, id: tourId, type: "tour" })}
                      onEditDate={(tourId, date) => {
                        setSelectedTourForDate(tourId);
                        setSelectedDate(date);
                        setDateFormOpen(true);
                      }}
                      onDeleteDate={(dateId) => setDeleteDialog({ open: true, id: dateId, type: "date" })}
                    />
                  ) : (
                    <RegistrationsList
                      registrations={getFilteredRegistrations()}
                      loading={loading}
                      onStatusChange={handleStatusChange}
                    />
                  )}
                </CardContent>
              </Card>
            ) : null}
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
      
      {/* Support Chat Widget */}
      <SupportChatWidget />
    </SidebarProvider>
  );
};

export default Admin;
