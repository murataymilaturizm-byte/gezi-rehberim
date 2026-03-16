import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Building2, Clock, MessageSquare, Settings, Eye } from "lucide-react";
import { differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Agency {
  id: string;
  name: string;
  city?: string;
  region?: string;
  whatsapp_api_key?: string;
  threesixty_client_id?: string;
  whatsapp_phone_number?: string;
  whatsapp_status?: 'pending' | 'active' | 'rejected';
  conversation_style?: 'friendly' | 'professional' | 'energetic' | 'helpful';
  active: boolean;
  created_at: string;
  plan_type: string;
  trial_ends_at: string | null;
  subscription_status: string;
  subscription_ends_at: string | null;
  message_limit: number | null;
  monthly_message_count: number | null;
  profiles: {
    full_name: string | null;
  };
}

export const AgencyManagement = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [styleDialogOpen, setStyleDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [editingPlanAgency, setEditingPlanAgency] = useState<Agency | null>(null);
  const [editingStyleAgency, setEditingStyleAgency] = useState<Agency | null>(null);
  const [viewingAgency, setViewingAgency] = useState<Agency | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<'friendly' | 'professional' | 'energetic' | 'helpful'>('professional');
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    name: "",
    city: "",
    region: "",
    twilio_account_sid: "",
    twilio_auth_token: "",
    twilio_phone_number: "",
  });

  const [planFormData, setPlanFormData] = useState({
    plan_type: "starter" as "starter" | "professional" | "enterprise",
    message_limit: 500,
    extra_messages: 0,
  });

  // Get default message limit based on plan type
  const getDefaultMessageLimit = (planType: string) => {
    switch (planType) {
      case "starter": return 500;
      case "professional": return 3000;
      case "enterprise": return -1; // unlimited
      default: return 500;
    }
  };

  useEffect(() => {
    loadAgencies();
  }, []);

  const loadAgencies = async () => {
    setLoading(true);
    try {
      const { data: agenciesData, error } = await supabase
        .from("agencies")
        .select("id, name, city, region, twilio_account_sid, twilio_auth_token, twilio_phone_number, whatsapp_phone_number, whatsapp_status, conversation_style, active, created_at, plan_type, trial_ends_at, subscription_status, subscription_ends_at, message_limit, monthly_message_count, user_id")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get profiles separately
      const agenciesWithProfiles = await Promise.all(
        (agenciesData || []).map(async (agency) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", agency.user_id)
            .single();

          return {
            ...agency,
            whatsapp_status: (agency as any).whatsapp_status as 'pending' | 'active' | 'rejected' | undefined,
            conversation_style: (agency as any).conversation_style as 'friendly' | 'professional' | 'energetic' | 'helpful' | undefined,
            profiles: profile || { full_name: null },
          };
        })
      );

      setAgencies(agenciesWithProfiles);
    } catch (error) {
      console.error("Error loading agencies:", error);
      toast({
        title: "Hata",
        description: "Acenteler yüklenemedi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingAgency) {
        // Update existing agency
        const { error } = await supabase
          .from("agencies")
          .update({
            name: formData.name,
            city: formData.city,
            region: formData.region || null,
            twilio_account_sid: formData.twilio_account_sid,
            twilio_auth_token: formData.twilio_auth_token,
            twilio_phone_number: formData.twilio_phone_number,
          })
          .eq("id", editingAgency.id);

        if (error) throw error;

        toast({
          title: "Başarılı! ✅",
          description: "Acente güncellendi",
        });
      } else {
        // Create new user and agency
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.full_name,
            },
          },
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("Kullanıcı oluşturulamadı");

        // Create agency
        const { error: agencyError } = await supabase
          .from("agencies")
          .insert({
            user_id: authData.user.id,
            name: formData.name,
            city: formData.city,
            region: formData.region || null,
            twilio_account_sid: formData.twilio_account_sid,
            twilio_auth_token: formData.twilio_auth_token,
            twilio_phone_number: formData.twilio_phone_number,
          });

        if (agencyError) throw agencyError;

        // Assign agency role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: authData.user.id,
            role: "agency",
          });

        if (roleError) throw roleError;

        toast({
          title: "Başarılı! ✅",
          description: "Acente oluşturuldu",
        });
      }

      setDialogOpen(false);
      resetForm();
      loadAgencies();
    } catch (error: any) {
      console.error("Error saving agency:", error);
      toast({
        title: "Hata",
        description: error.message || "İşlem başarısız",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (agencyId: string) => {
    if (!confirm("Bu acenteyi silmek istediğinize emin misiniz?")) return;

    try {
      const { error } = await supabase
        .from("agencies")
        .delete()
        .eq("id", agencyId);

      if (error) throw error;

      toast({
        title: "Başarılı! ✅",
        description: "Acente silindi",
      });
      loadAgencies();
    } catch (error: any) {
      console.error("Error deleting agency:", error);
      toast({
        title: "Hata",
        description: error.message || "Silme işlemi başarısız",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (agency: Agency) => {
    setEditingAgency(agency);
    setFormData({
      email: "",
      password: "",
      full_name: "",
      name: agency.name,
      city: agency.city || "",
      region: agency.region || "",
      twilio_account_sid: agency.twilio_account_sid,
      twilio_auth_token: agency.twilio_auth_token,
      twilio_phone_number: agency.twilio_phone_number,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingAgency(null);
    setFormData({
      email: "",
      password: "",
      full_name: "",
      name: "",
      city: "",
      region: "",
      twilio_account_sid: "",
      twilio_auth_token: "",
      twilio_phone_number: "",
    });
  };

  const handlePlanEdit = (agency: Agency) => {
    setEditingPlanAgency(agency);
    const defaultLimits: Record<string, number> = {
      starter: 500,
      professional: 3000,
      enterprise: -1,
    };
    setPlanFormData({
      plan_type: agency.plan_type as "starter" | "professional" | "enterprise",
      message_limit: agency.message_limit || defaultLimits[agency.plan_type] || 500,
      extra_messages: 0,
    });
    setPlanDialogOpen(true);
  };

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlanAgency) return;

    try {
      const defaultLimits: Record<string, number> = {
        starter: 500,
        professional: 3000,
        enterprise: -1,
      };

      const newLimit = planFormData.plan_type === "enterprise" 
        ? -1 
        : (planFormData.message_limit + planFormData.extra_messages);

      const { error } = await supabase
        .from("agencies")
        .update({
          plan_type: planFormData.plan_type,
          message_limit: newLimit,
        })
        .eq("id", editingPlanAgency.id);

      if (error) throw error;

      toast({
        title: "Başarılı! ✅",
        description: `Plan güncellendi${planFormData.extra_messages > 0 ? ` (+${planFormData.extra_messages} mesaj eklendi)` : ""}`,
      });

      setPlanDialogOpen(false);
      setEditingPlanAgency(null);
      loadAgencies();
    } catch (error: any) {
      console.error("Error updating plan:", error);
      toast({
        title: "Hata",
        description: error.message || "Plan güncellenemedi",
        variant: "destructive",
      });
    }
  };

  const handleWhatsAppStatusUpdate = async (agencyId: string, status: 'active' | 'rejected') => {
    try {
      const { error } = await supabase
        .from("agencies")
        .update({ whatsapp_status: status } as any)
        .eq("id", agencyId);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: status === 'active' ? t("admin.whatsapp.messages.approved") : t("admin.whatsapp.messages.rejected"),
      });

      loadAgencies();
    } catch (error: any) {
      console.error("Error updating WhatsApp status:", error);
      toast({
        title: "Hata",
        description: error.message || t("admin.whatsapp.messages.updateError"),
        variant: "destructive",
      });
    }
  };

  const handleStyleEdit = (agency: Agency) => {
    setEditingStyleAgency(agency);
    setSelectedStyle(agency.conversation_style || 'professional');
    setStyleDialogOpen(true);
  };

  const handleStyleSubmit = async () => {
    if (!editingStyleAgency) return;

    try {
      const { error } = await supabase
        .from("agencies")
        .update({ conversation_style: selectedStyle } as any)
        .eq("id", editingStyleAgency.id);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Konuşma üslubu güncellendi",
      });

      setStyleDialogOpen(false);
      loadAgencies();
    } catch (error: any) {
      console.error("Error updating conversation style:", error);
      toast({
        title: "Hata",
        description: error.message || "Konuşma üslubu güncellenemedi",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t("admin.agency.title")}
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-ocean hover:opacity-90">
                <Plus className="w-4 h-4 mr-2" />
                {t("admin.agency.addNew")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingAgency ? t("admin.agency.editAgency") : t("admin.agency.addNew")}
                </DialogTitle>
                <DialogDescription>
                  {editingAgency 
                    ? t("admin.agency.updateInfo") 
                    : t("admin.agency.createAccount")}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingAgency && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="full_name">{t("admin.agency.form.fullName")}</Label>
                        <Input
                          id="full_name"
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">{t("admin.agency.form.email")}</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">{t("admin.agency.form.password")}</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        minLength={6}
                      />
                    </div>
                  </>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="agency_name">{t("admin.agency.form.agencyName")}</Label>
                  <Input
                    id="agency_name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">{t("admin.agency.form.city")}</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder={t("admin.agency.form.cityPlaceholder")}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">{t("admin.agency.form.region")}</Label>
                    <Input
                      id="region"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                      placeholder={t("admin.agency.form.regionPlaceholder")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="twilio_account_sid">Twilio Account SID</Label>
                    <Input
                      id="twilio_account_sid"
                      value={formData.twilio_account_sid}
                      onChange={(e) => setFormData({ ...formData, twilio_account_sid: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twilio_auth_token">Twilio Auth Token</Label>
                    <Input
                      id="twilio_auth_token"
                      type="password"
                      value={formData.twilio_auth_token}
                      onChange={(e) => setFormData({ ...formData, twilio_auth_token: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twilio_phone_number">Twilio Telefon Numarası</Label>
                  <Input
                    id="twilio_phone_number"
                    value={formData.twilio_phone_number}
                    onChange={(e) => setFormData({ ...formData, twilio_phone_number: e.target.value })}
                    placeholder="+14155238886"
                    required
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    İptal
                  </Button>
                  <Button type="submit" className="bg-gradient-ocean hover:opacity-90">
                    {editingAgency ? "Güncelle" : "Oluştur"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
        ) : agencies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Henüz acente eklenmemiş
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.agency.tableHeaders.agencyName")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("admin.agency.tableHeaders.plan")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("admin.agency.tableHeaders.messageQuota")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("admin.agency.tableHeaders.subscription")}</TableHead>
                <TableHead>{t("admin.agency.tableHeaders.status")}</TableHead>
                <TableHead className="text-right">{t("admin.agency.tableHeaders.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agencies.map((agency) => {
                const getRemainingDays = () => {
                  const targetDate = agency.subscription_status === 'trial' 
                    ? agency.trial_ends_at 
                    : agency.subscription_ends_at;
                  
                  if (!targetDate) return null;
                  return differenceInDays(new Date(targetDate), new Date());
                };

                const remainingDays = getRemainingDays();
                const planLabels: Record<string, string> = {
                  starter: t("admin.agency.plans.starter"),
                  professional: t("admin.agency.plans.professional"),
                  enterprise: t("admin.agency.plans.enterprise")
                };

                const getStatusVariant = (status: string) => {
                  switch (status) {
                    case 'trial': return 'secondary';
                    case 'active': return 'default';
                    case 'expired': return 'destructive';
                    case 'cancelled': return 'destructive';
                    default: return 'secondary';
                  }
                };

                const statusLabels: Record<string, string> = {
                  trial: t("admin.agency.subscriptionStatus.trial"),
                  active: t("admin.agency.subscriptionStatus.active"),
                  expired: t("admin.agency.subscriptionStatus.expired"),
                  cancelled: t("admin.agency.subscriptionStatus.cancelled")
                };

                return (
                  <TableRow key={agency.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{agency.name}</div>
                        <div className="text-xs text-muted-foreground sm:hidden">
                          {planLabels[agency.plan_type] || agency.plan_type}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {planLabels[agency.plan_type] || agency.plan_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1 text-sm">
                        <MessageSquare className="w-3 h-3" />
                        <span>
                          {agency.monthly_message_count || 0} / {agency.message_limit === -1 ? "∞" : agency.message_limit}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusVariant(agency.subscription_status)} className="text-xs">
                          {statusLabels[agency.subscription_status] || agency.subscription_status}
                        </Badge>
                        {remainingDays !== null && remainingDays <= 7 && (
                          <span className={`text-xs ${remainingDays <= 3 ? "text-destructive" : "text-muted-foreground"}`}>
                            ({remainingDays > 0 ? `${remainingDays}g` : "Bitti"})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={agency.active ? "default" : "secondary"} className="text-xs">
                        {agency.active ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setViewingAgency(agency);
                            setDetailDialogOpen(true);
                          }}
                          title="Detaylar"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePlanEdit(agency)}
                          title="Plan Yönetimi"
                          className="hidden sm:inline-flex"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(agency)}
                          title="Düzenle"
                          className="hidden sm:inline-flex"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(agency.id)}
                          title="Sil"
                          className="hidden sm:inline-flex"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Agency Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {viewingAgency?.name}
            </DialogTitle>
            <DialogDescription>
              Acente detayları ve yönetim seçenekleri
            </DialogDescription>
          </DialogHeader>
          
          {viewingAgency && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Yetkili:</span>
                  <p className="font-medium">{viewingAgency.profiles?.full_name || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Şehir:</span>
                  <p className="font-medium">{viewingAgency.city || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Bölge:</span>
                  <p className="font-medium">{viewingAgency.region || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Durum:</span>
                  <p>
                    <Badge variant={viewingAgency.active ? "default" : "secondary"}>
                      {viewingAgency.active ? "Aktif" : "Pasif"}
                    </Badge>
                  </p>
                </div>
              </div>

              {/* Plan & Subscription */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Plan Bilgileri</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Plan:</span>
                    <p>
                      <Badge variant="outline">
                        {t(`admin.agency.plans.${viewingAgency.plan_type}`)}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Abonelik:</span>
                    <p>
                      <Badge variant={viewingAgency.subscription_status === 'active' ? 'default' : 'secondary'}>
                        {t(`admin.agency.subscriptionStatus.${viewingAgency.subscription_status}`)}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mesaj Kullanımı:</span>
                    <p className="font-medium flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {viewingAgency.monthly_message_count || 0} / {viewingAgency.message_limit === -1 ? "∞" : viewingAgency.message_limit}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Kalan Süre:</span>
                    <p className="font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {(() => {
                        const targetDate = viewingAgency.subscription_status === 'trial' 
                          ? viewingAgency.trial_ends_at 
                          : viewingAgency.subscription_ends_at;
                        if (!targetDate) return "-";
                        const days = differenceInDays(new Date(targetDate), new Date());
                        return days > 0 ? `${days} gün` : "Süresi doldu";
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              {/* WhatsApp Info */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">WhatsApp Bilgileri</h4>
                <div className="text-sm space-y-2">
                  <div>
                    <span className="text-muted-foreground">Telefon:</span>
                    <p className="font-mono">
                      {viewingAgency.twilio_phone_number && viewingAgency.twilio_phone_number !== "TEMP_PHONE" 
                        ? viewingAgency.twilio_phone_number 
                        : <span className="text-muted-foreground">Eklenmedi</span>}
                    </p>
                  </div>
                  {viewingAgency.whatsapp_status && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">WhatsApp Durumu:</span>
                      <Badge 
                        variant={
                          viewingAgency.whatsapp_status === 'active' ? 'default' : 
                          viewingAgency.whatsapp_status === 'pending' ? 'secondary' : 
                          'destructive'
                        }
                      >
                        {viewingAgency.whatsapp_status === 'active' ? 'Aktif' : 
                         viewingAgency.whatsapp_status === 'pending' ? 'Bekliyor' : 
                         'Reddedildi'}
                      </Badge>
                      {viewingAgency.whatsapp_status === 'pending' && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs text-green-600"
                            onClick={() => {
                              handleWhatsAppStatusUpdate(viewingAgency.id, 'active');
                              setDetailDialogOpen(false);
                            }}
                          >
                            Onayla
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs text-destructive"
                            onClick={() => {
                              handleWhatsAppStatusUpdate(viewingAgency.id, 'rejected');
                              setDetailDialogOpen(false);
                            }}
                          >
                            Reddet
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Konuşma Üslubu:</span>
                    <p className="font-medium capitalize">{viewingAgency.conversation_style || "professional"}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="border-t pt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDetailDialogOpen(false);
                    handleStyleEdit(viewingAgency);
                  }}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Üslup Değiştir
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDetailDialogOpen(false);
                    handlePlanEdit(viewingAgency);
                  }}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Plan Yönetimi
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDetailDialogOpen(false);
                    handleEdit(viewingAgency);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Düzenle
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDetailDialogOpen(false);
                    handleDelete(viewingAgency.id);
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Sil
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Plan & Quota Management Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Plan ve Kota Yönetimi</DialogTitle>
            <DialogDescription>
              {editingPlanAgency?.name} için plan ve mesaj kotasını yönetin
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePlanSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plan_type">Plan Tipi</Label>
              <Select
                value={planFormData.plan_type}
                onValueChange={(value: "starter" | "professional" | "enterprise") => {
                  const defaultLimits: Record<string, number> = {
                    starter: 500,
                    professional: 2000,
                    enterprise: -1,
                  };
                  setPlanFormData({
                    ...planFormData,
                    plan_type: value,
                    message_limit: defaultLimits[value],
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">{t("admin.agency.plans.starterWithLimit")}</SelectItem>
                  <SelectItem value="professional">{t("admin.agency.plans.professionalWithLimit")}</SelectItem>
                  <SelectItem value="enterprise">{t("admin.agency.plans.enterpriseWithLimit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {planFormData.plan_type !== "enterprise" && (
              <>
            <div className="space-y-2">
              <Label htmlFor="message_limit">{t("admin.agency.plan.monthlyLimit")}</Label>
              <Input
                id="message_limit"
                type="number"
                min="0"
                value={planFormData.message_limit}
                onChange={(e) => setPlanFormData({ ...planFormData, message_limit: parseInt(e.target.value) || 0 })}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t("admin.agency.plan.defaultLimit", { limit: planFormData.plan_type === "starter" ? "500" : "2.000" })}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="extra_messages">{t("admin.agency.plan.extraMessages")}</Label>
              <Input
                id="extra_messages"
                type="number"
                min="0"
                value={planFormData.extra_messages}
                onChange={(e) => setPlanFormData({ ...planFormData, extra_messages: parseInt(e.target.value) || 0 })}
                placeholder={t("admin.agency.plan.extraPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {t("admin.agency.plan.extraHelp")}
              </p>
            </div>

            <div className="bg-accent/20 border border-border rounded-lg p-3">
              <p className="text-sm font-medium">{t("admin.agency.plan.newTotalLimit")}</p>
              <p className="text-2xl font-bold text-primary">
                {(planFormData.message_limit + planFormData.extra_messages).toLocaleString('tr-TR')} {t("admin.agency.plan.messagesPerMonth")}
              </p>
            </div>
              </>
            )}

            {planFormData.plan_type === "enterprise" && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <p className="text-sm font-medium text-primary flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  {t("admin.agency.plan.unlimitedMessages")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("admin.agency.plan.enterpriseNoLimit")}
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPlanDialogOpen(false)}
              >
                {t("admin.agency.plan.cancel")}
              </Button>
              <Button type="submit" className="bg-gradient-ocean hover:opacity-90">
                {t("admin.agency.plan.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Conversation Style Dialog */}
      <Dialog open={styleDialogOpen} onOpenChange={setStyleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Konuşma Üslubu</DialogTitle>
            <DialogDescription>
              {editingStyleAgency?.name} için bot konuşma üslubunu seçin
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              {[
                { value: 'friendly', icon: '🤝', label: 'Samimi/Dostane', desc: 'Arkadaşça, sıcak, emoji kullanımlı' },
                { value: 'professional', icon: '👔', label: 'Profesyonel/Kurumsal', desc: 'Resmi, saygılı, net iletişim' },
                { value: 'energetic', icon: '⚡', label: 'Enerjik/Dinamik', desc: 'Heyecanlı, motive edici, coşkulu' },
                { value: 'helpful', icon: '😊', label: 'Nazik/Yardımsever', desc: 'Sabırlı, detaylı, empatik' }
              ].map(style => (
                <button
                  key={style.value}
                  onClick={() => setSelectedStyle(style.value as any)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedStyle === style.value 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{style.icon}</span>
                    <div className="flex-1">
                      <p className="font-medium">{style.label}</p>
                      <p className="text-sm text-muted-foreground">{style.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setStyleDialogOpen(false)}>
                İptal
              </Button>
              <Button onClick={handleStyleSubmit}>
                Kaydet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
