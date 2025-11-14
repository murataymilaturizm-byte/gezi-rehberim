import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import turzzLogo from "@/assets/turzz-logo-orange.png";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ArrowLeft, Plane, Plus, Pencil, Trash2, Calendar, LogOut, Download } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
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
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { exportRegistrationsToExcel, exportToursToExcel } from "@/utils/excelExporter";
import { SupportChatWidget } from "@/components/SupportChatWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";

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
  const { t } = useTranslation();
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
  const [activeTab, setActiveTab] = useState<"dashboard" | "tours" | "registrations" | "whatsapp" | "settings" | "history" | "agencies" | "contact_forms" | "twilio_settings" | "templates">("dashboard");
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
    if (paymentStatus === "success") {
      toast({
        title: "Ödeme Başarılı! 🎉",
        description: "Aboneliğiniz aktifleştirildi. Faturanız email adresinize gönderilecek.",
      });
      setActiveTab("history");
      // Clear URL params
      setSearchParams({});
    } else if (paymentStatus === "failed") {
      toast({
        title: "Ödeme Başarısız",
        description: "Ödeme işlemi tamamlanamadı. Lütfen tekrar deneyin veya farklı bir kart kullanın.",
        variant: "destructive",
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

      // Get user's agency ID and name if not super admin
      if (!roleData) {
        const { data: agencyData } = await supabase
          .from("agencies")
          .select("id, agency_name")
          .eq("user_id", userId)
          .maybeSingle();

        setUserAgencyId(agencyData?.id || null);
        setAgencyName(agencyData?.agency_name || "");
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/95 backdrop-blur-lg sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="outline" size="sm" asChild className="hover:scale-105 transition-transform duration-300">
                <a href="/">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">{t("admin.home")}</span>
                  <span className="sm:hidden">{t("admin.back")}</span>
                </a>
              </Button>
              <div className="flex items-center gap-2 sm:gap-3">
                <img 
                  src={turzzLogo} 
                  alt="Turzz AI Logo" 
                  className="h-10 sm:h-14 w-auto object-contain transition-transform duration-300 hover:scale-105"
                />
                <h1 className="text-base sm:text-xl font-bold text-foreground">{t("admin.title")}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              {(agencyName || userName) && (
                <div className="hidden lg:flex items-center gap-2 text-foreground">
                  <span className="text-sm font-medium">{t("admin.welcome")}</span>
                  {agencyName && (
                    <span className="text-sm font-semibold">{agencyName}</span>
                  )}
                  {agencyName && userName && (
                    <span className="text-sm text-muted-foreground">•</span>
                  )}
                  {userName && (
                    <span className="text-sm text-muted-foreground">{userName}</span>
                  )}
                </div>
              )}
              <LanguageSelector />
              <ThemeToggle />
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex hover:scale-105 transition-transform duration-300">
                <a href="/yardim" target="_blank">
                  {t("admin.help")}
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout} className="transition-all duration-300 hover:scale-105">
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t("admin.logout")}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Subscription Banner */}
        {!isSuperAdmin && <SubscriptionBanner />}
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <Button
            variant={activeTab === "dashboard" ? "default" : "outline"}
            onClick={() => setActiveTab("dashboard")}
            className={`transition-all duration-300 ${activeTab === "dashboard" ? "bg-gradient-ocean scale-105" : "hover:scale-105"}`}
          >
            {t("admin.tabs.dashboard")}
          </Button>
          <Button
            variant={activeTab === "tours" ? "default" : "outline"}
            onClick={() => setActiveTab("tours")}
            className={`transition-all duration-300 ${activeTab === "tours" ? "bg-gradient-ocean scale-105" : "hover:scale-105"}`}
          >
            {t("admin.tabs.tours")}
          </Button>
          <Button
            variant={activeTab === "registrations" ? "default" : "outline"}
            onClick={() => setActiveTab("registrations")}
            className={`transition-all duration-300 ${activeTab === "registrations" ? "bg-gradient-ocean scale-105" : "hover:scale-105"}`}
          >
            {t("admin.tabs.registrations")}
          </Button>
          <Button
            variant={activeTab === "whatsapp" ? "default" : "outline"}
            onClick={() => setActiveTab("whatsapp")}
            className={`transition-all duration-300 ${activeTab === "whatsapp" ? "bg-gradient-ocean scale-105" : "hover:scale-105"}`}
          >
            {t("admin.tabs.whatsapp")}
          </Button>
          {!isSuperAdmin && (
            <>
              <Button
                variant={activeTab === "settings" ? "default" : "outline"}
                onClick={() => setActiveTab("settings")}
                className={`transition-all duration-300 ${activeTab === "settings" ? "bg-gradient-ocean scale-105" : "hover:scale-105"}`}
              >
                {t("admin.dashboard.whatsappSettings")}
              </Button>
              <Button
                variant={activeTab === "templates" ? "default" : "outline"}
                 onClick={() => setActiveTab("templates")}
                 className={`transition-all duration-300 ${activeTab === "templates" ? "bg-gradient-ocean scale-105" : "hover:scale-105"}`}
               >
                 {t("admin.tabs.templates")}
               </Button>
               <Button
                 variant={activeTab === "history" ? "default" : "outline"}
                 onClick={() => setActiveTab("history")}
                 className={`transition-all duration-300 ${activeTab === "history" ? "bg-gradient-ocean scale-105" : "hover:scale-105"}`}
               >
                 {t("admin.tabs.history")}
               </Button>
            </>
          )}
          {isSuperAdmin && (
            <>
            <Button
              variant={activeTab === "agencies" ? "default" : "outline"}
              onClick={() => setActiveTab("agencies")}
              className={`transition-all duration-300 ${activeTab === "agencies" ? "bg-gradient-ocean scale-105" : "hover:scale-105"}`}
            >
              {t("admin.tabs.agencies")}
            </Button>
            <Button
              variant={activeTab === "contact_forms" ? "default" : "outline"}
              onClick={() => setActiveTab("contact_forms")}
              className={`transition-all duration-300 ${activeTab === "contact_forms" ? "bg-gradient-ocean scale-105" : "hover:scale-105"}`}
            >
              {t("admin.tabs.contactForms")}
            </Button>
            <Button
              variant={activeTab === "twilio_settings" ? "default" : "outline"}
              onClick={() => setActiveTab("twilio_settings")}
              className={`transition-all duration-300 ${activeTab === "twilio_settings" ? "bg-gradient-ocean scale-105" : "hover:scale-105"}`}
            >
              {t("admin.tabs.twilioSettings")}
            </Button>
            </>
          )}
        </div>

        {/* Content */}
        {activeTab === "dashboard" ? (
          <AdminDashboard isSuperAdmin={isSuperAdmin} />
        ) : activeTab === "whatsapp" ? (
          <div className="space-y-6">
            {isSuperAdmin && <LanguageStats isSuperAdmin={isSuperAdmin} />}
            <WhatsAppUserProfiles isSuperAdmin={isSuperAdmin} />
            <WhatsAppConversations isSuperAdmin={isSuperAdmin} />
          </div>
        ) : activeTab === "settings" ? (
          <TwilioSettings />
        ) : activeTab === "templates" ? (
          <MessageTemplates />
        ) : activeTab === "history" ? (
          <SubscriptionHistory />
        ) : activeTab === "twilio_settings" && isSuperAdmin ? (
          <SuperAdminTwilioSettings />
        ) : activeTab === "agencies" && isSuperAdmin ? (
          <AgencyManagement />
        ) : activeTab === "contact_forms" && isSuperAdmin ? (
          <ContactFormsManagement />
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
                    <TableHead>{t("admin.registrations.pax")}</TableHead>
                    <TableHead>{t("admin.registrations.status")}</TableHead>
                    <TableHead>Kaynak</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {t("admin.registrations.noRegistrations")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    registrations.map((reg) => (
                      <TableRow key={reg.id}>
                        <TableCell className="font-medium">{reg.full_name}</TableCell>
                        <TableCell>{reg.phone}</TableCell>
                        <TableCell>{reg.tours?.title}</TableCell>
                        <TableCell>
                          {reg.tour_dates?.departure_date &&
                            format(new Date(reg.tour_dates.departure_date), "d MMM yyyy", { locale: tr })}
                        </TableCell>
                        <TableCell>{reg.pax}</TableCell>
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
                        <TableCell>
                          {reg.note?.includes("WhatsApp kayıt:") ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                              WhatsApp
                            </Badge>
                          ) : (
                            <Badge variant="outline">Web</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
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
      
      {/* Support Chat Widget */}
      <SupportChatWidget />
    </div>
  );
};

export default Admin;
