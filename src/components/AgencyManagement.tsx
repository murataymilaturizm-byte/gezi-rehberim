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
import { Plus, Pencil, Trash2, Building2, Clock, MessageSquare, Settings } from "lucide-react";
import { differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Agency {
  id: string;
  agency_name: string;
  city?: string;
  region?: string;
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_phone_number: string;
  whatsapp_phone_number?: string;
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
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [editingPlanAgency, setEditingPlanAgency] = useState<Agency | null>(null);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    agency_name: "",
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
        .select("id, agency_name, city, region, twilio_account_sid, twilio_auth_token, twilio_phone_number, active, created_at, plan_type, trial_ends_at, subscription_status, subscription_ends_at, message_limit, monthly_message_count, user_id")
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
            agency_name: formData.agency_name,
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
            agency_name: formData.agency_name,
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
      agency_name: agency.agency_name,
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
      agency_name: "",
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
                  {editingAgency ? "Acente Düzenle" : "Yeni Acente Ekle"}
                </DialogTitle>
                <DialogDescription>
                  {editingAgency 
                    ? "Acente bilgilerini güncelleyin" 
                    : "Yeni acente hesabı oluşturun"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingAgency && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="full_name">Ad Soyad</Label>
                        <Input
                          id="full_name"
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
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
                      <Label htmlFor="password">Şifre</Label>
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
                  <Label htmlFor="agency_name">Acente Adı</Label>
                  <Input
                    id="agency_name"
                    value={formData.agency_name}
                    onChange={(e) => setFormData({ ...formData, agency_name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">Şehir</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="İstanbul"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Bölge (İsteğe Bağlı)</Label>
                    <Input
                      id="region"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                      placeholder="Marmara"
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
      <CardContent>
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
                <TableHead>{t("admin.agency.tableHeaders.authorized")}</TableHead>
                <TableHead>{t("admin.agency.tableHeaders.whatsappNo")}</TableHead>
                <TableHead>{t("admin.agency.tableHeaders.plan")}</TableHead>
                <TableHead>{t("admin.agency.tableHeaders.messageQuota")}</TableHead>
                <TableHead>{t("admin.agency.tableHeaders.subscription")}</TableHead>
                <TableHead>{t("admin.agency.tableHeaders.remainingTime")}</TableHead>
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

                const statusLabels: Record<string, string> = {
                  trial: t("admin.agency.subscriptionStatus.trial"),
                  active: t("admin.agency.subscriptionStatus.active"),
                  expired: t("admin.agency.subscriptionStatus.expired"),
                  cancelled: t("admin.agency.subscriptionStatus.cancelled")
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

                const messageUsagePercentage = agency.message_limit === -1 
                  ? 0 
                  : ((agency.monthly_message_count || 0) / (agency.message_limit || 1)) * 100;

                return (
                  <TableRow key={agency.id}>
                    <TableCell className="font-medium">{agency.agency_name}</TableCell>
                    <TableCell>{agency.profiles?.full_name || "-"}</TableCell>
                    <TableCell>
                      <span className="text-sm font-mono">
                        {agency.twilio_phone_number && agency.twilio_phone_number !== "TEMP_PHONE" 
                          ? agency.twilio_phone_number 
                          : <span className="text-muted-foreground">{t("admin.agency.messages.notAdded")}</span>}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {planLabels[agency.plan_type] || agency.plan_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <MessageSquare className="w-3 h-3" />
                          <span>
                            {agency.monthly_message_count || 0} / {agency.message_limit === -1 ? "∞" : agency.message_limit}
                          </span>
                        </div>
                        {agency.message_limit !== -1 && messageUsagePercentage >= 80 && (
                          <Badge variant={messageUsagePercentage >= 100 ? "destructive" : "secondary"} className="text-xs">
                            {messageUsagePercentage >= 100 ? t("admin.agency.messages.quotaFull") : `%${Math.round(messageUsagePercentage)} ${t("admin.agency.messages.percentUsed")}`}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(agency.subscription_status)}>
                        {statusLabels[agency.subscription_status] || agency.subscription_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {remainingDays !== null && (
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="w-3 h-3" />
                          <span className={remainingDays <= 3 ? "text-destructive font-medium" : ""}>
                            {remainingDays > 0 ? `${remainingDays} ${t("admin.agency.messages.daysLeft")}` : t("admin.agency.messages.expired")}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={agency.active ? "default" : "secondary"}>
                        {agency.active ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePlanEdit(agency)}
                          title="Plan ve Kota Yönetimi"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(agency)}
                          title="Acente Bilgilerini Düzenle"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(agency.id)}
                          title="Acenteyi Sil"
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

      {/* Plan & Quota Management Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Plan ve Kota Yönetimi</DialogTitle>
            <DialogDescription>
              {editingPlanAgency?.agency_name} için plan ve mesaj kotasını yönetin
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
                  <Label htmlFor="message_limit">Aylık Mesaj Limiti</Label>
                  <Input
                    id="message_limit"
                    type="number"
                    min="0"
                    value={planFormData.message_limit}
                    onChange={(e) => setPlanFormData({ ...planFormData, message_limit: parseInt(e.target.value) || 0 })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Planın varsayılan limiti: {planFormData.plan_type === "starter" ? "500" : "2.000"} mesaj
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="extra_messages">Ekstra Mesaj Kotası Ekle</Label>
                  <Input
                    id="extra_messages"
                    type="number"
                    min="0"
                    value={planFormData.extra_messages}
                    onChange={(e) => setPlanFormData({ ...planFormData, extra_messages: parseInt(e.target.value) || 0 })}
                    placeholder="Örn: 500"
                  />
                  <p className="text-xs text-muted-foreground">
                    Mevcut limite ekstra mesaj kotası ekleyin
                  </p>
                </div>

                <div className="bg-accent/20 border border-border rounded-lg p-3">
                  <p className="text-sm font-medium">Yeni Toplam Limit</p>
                  <p className="text-2xl font-bold text-primary">
                    {(planFormData.message_limit + planFormData.extra_messages).toLocaleString('tr-TR')} mesaj/ay
                  </p>
                </div>
              </>
            )}

            {planFormData.plan_type === "enterprise" && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <p className="text-sm font-medium text-primary flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Sınırsız Mesaj
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Kurumsal plan ile mesaj limiti yoktur
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPlanDialogOpen(false)}
              >
                İptal
              </Button>
              <Button type="submit" className="bg-gradient-ocean hover:opacity-90">
                Kaydet
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
