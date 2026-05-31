import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { CheckCircle2, Clock, Edit, Loader2, MessageSquare, Phone, Settings, Wifi } from "lucide-react";

type IntegrationStatus = "pending_review" | "waiting_info" | "in_progress" | "testing" | "active";

interface Integration {
  id: string;
  agency_id: string;
  status: IntegrationStatus;
  whatsapp_phone: string | null;
  company_name: string | null;
  has_business_manager: boolean | null;
  business_manager_id: string | null;
  contact_email: string | null;
  notes: string | null;
  admin_notes: string | null;
  meta_phone_number_id: string | null;
  meta_waba_id: string | null;
  requested_at: string;
  activated_at: string | null;
  updated_at: string;
  agency_name?: string;
}

const STATUS_CONFIG: Record<IntegrationStatus, { labelKey: string; color: string }> = {
  pending_review: { labelKey: "superAdmin.integrations.statusLabels.pendingReview", color: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" },
  waiting_info: { labelKey: "superAdmin.integrations.statusLabels.waitingInfo", color: "bg-orange-500/10 text-orange-700 border-orange-500/30" },
  in_progress: { labelKey: "superAdmin.integrations.statusLabels.inProgress", color: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  testing: { labelKey: "superAdmin.integrations.statusLabels.testing", color: "bg-purple-500/10 text-purple-700 border-purple-500/30" },
  active: { labelKey: "superAdmin.integrations.statusLabels.active", color: "bg-green-500/10 text-green-700 border-green-500/30" },
};

interface SuperAdminWhatsAppIntegrationsProps {
  isSuperAdmin?: boolean;
}

export const SuperAdminWhatsAppIntegrations = ({ isSuperAdmin = false }: SuperAdminWhatsAppIntegrationsProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editModal, setEditModal] = useState<Integration | null>(null);

  const [editForm, setEditForm] = useState({
    status: "" as IntegrationStatus,
    meta_phone_number_id: "",
    meta_waba_id: "",
    new_meta_access_token: "",
    admin_notes: "",
  });

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_integrations")
        .select("id, agency_id, status, whatsapp_phone, company_name, has_business_manager, business_manager_id, contact_email, notes, admin_notes, meta_phone_number_id, meta_waba_id, requested_at, activated_at, updated_at")
        .order("requested_at", { ascending: false });

      if (error) throw error;

      // Load agency names
      const agencyIds = (data || []).map((d: any) => d.agency_id);
      const { data: agencies } = await supabase
        .from("agencies")
        .select("id, name")
        .in("id", agencyIds);

      const agencyMap = new Map((agencies || []).map((a) => [a.id, a.name]));

      setIntegrations(
        (data || []).map((d: any) => ({
          ...d,
          agency_name: agencyMap.get(d.agency_id) || "Bilinmeyen",
        })) as Integration[]
      );
    } catch (error) {
      console.error("Error loading integrations:", error);
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (integration: Integration) => {
    setEditForm({
      status: integration.status,
      meta_phone_number_id: integration.meta_phone_number_id || "",
      meta_waba_id: integration.meta_waba_id || "",
      new_meta_access_token: "",
      admin_notes: integration.admin_notes || "",
    });
    setEditModal(integration);
  };

  const handleSave = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      // L3: Manuel girişte TRIM — Meta Console'dan copy-paste'te trailing space riski.
      // Aymila case bu yoldan geldi. DB trigger (L1b) zaten yakalar ama UI'da temizlemek
      // kullanıcıya da doğru değeri gösterir, çift güvenlik.
      const _trimmedPhoneId = editForm.meta_phone_number_id?.trim() || null;
      const _trimmedWabaId = editForm.meta_waba_id?.trim() || null;
      const _trimmedAccessToken = editForm.new_meta_access_token.trim();

      const updateData: any = {
        status: editForm.status,
        meta_phone_number_id: _trimmedPhoneId,
        meta_waba_id: _trimmedWabaId,
        admin_notes: editForm.admin_notes || null,
      };
      if (_trimmedAccessToken) {
        updateData.meta_access_token = _trimmedAccessToken;
      }

      if (editForm.status === "active" && editModal.status !== "active") {
        updateData.activated_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("whatsapp_integrations")
        .update(updateData as any)
        .eq("id", editModal.id);

      if (error) throw error;

      // If activating, also update agency's whatsapp fields — TRIM'li değerlerle
      if (editForm.status === "active") {
        const agencyUpdate: any = {
          whatsapp_status: "active",
          whatsapp_connected_at: new Date().toISOString(),
        };
        if (_trimmedPhoneId) {
          agencyUpdate.meta_phone_number_id = _trimmedPhoneId;
        }
        if (_trimmedWabaId) {
          agencyUpdate.meta_waba_id = _trimmedWabaId;
        }
        if (_trimmedAccessToken) {
          agencyUpdate.meta_access_token = _trimmedAccessToken;
        }
        if (editModal.whatsapp_phone) {
          agencyUpdate.whatsapp_phone_number = editModal.whatsapp_phone.trim();
        }

        await supabase
          .from("agencies")
          .update(agencyUpdate)
          .eq("id", editModal.agency_id);
      }

      toast({ title: t("common.success"), description: t("superAdmin.integrations.saveSuccess") });
      setEditModal(null);
      await loadIntegrations();
    } catch (error: any) {
      console.error("Save error:", error);
      toast({ title: t("common.error"), description: t("superAdmin.integrations.saveError"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filtered = filterStatus === "all"
    ? integrations
    : integrations.filter((i) => i.status === filterStatus);

  const now = new Date();
  const thisMonth = integrations.filter((i) => {
    const d = new Date(i.activated_at || "");
    return i.status === "active" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const stats = {
    total: integrations.length,
    active: integrations.filter((i) => i.status === "active").length,
    pending: integrations.filter((i) => i.status !== "active").length,
    thisMonth,
  };

  if (!isSuperAdmin) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          {t("superAdmin.integrations.loading")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Toplam Talep</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Aktif Entegrasyon</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Bekleyen</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Wifi className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.thisMonth}</p>
                <p className="text-xs text-muted-foreground">Bu Ay Tamamlanan</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t("superAdmin.integrations.title")}
              </CardTitle>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t("superAdmin.integrations.filterPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("superAdmin.integrations.allFilter")} ({integrations.length})</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                  const count = integrations.filter((i) => i.status === key).length;
                  return (
                    <SelectItem key={key} value={key}>
                      {t(config.labelKey)} ({count})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("superAdmin.integrations.noData")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Acente</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Talep Tarihi</TableHead>
                  <TableHead>Son Güncelleme</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((integration) => (
                  <TableRow key={integration.id}>
                    <TableCell className="font-medium">{integration.agency_name}</TableCell>
                    <TableCell>{integration.whatsapp_phone || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_CONFIG[integration.status]?.color}
                      >
                        {t(STATUS_CONFIG[integration.status]?.labelKey)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(integration.requested_at), "dd MMM yyyy", { locale: tr })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(integration.updated_at), "dd MMM yyyy HH:mm", { locale: tr })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(integration)}>
                        <Edit className="h-4 w-4 mr-1" />
                        Düzenle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={!!editModal} onOpenChange={(open) => !open && setEditModal(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle>{t("superAdmin.integrations.editTitle")} — {editModal?.agency_name}</DialogTitle>
            <DialogDescription>
              {t("superAdmin.integrations.editDescription")}
            </DialogDescription>
          </DialogHeader>

          {editModal && (
            <div className="space-y-4">
              {/* Agency submitted info */}
              <div className="p-3 rounded-lg bg-muted space-y-1 text-sm">
                <p><strong>Şirket:</strong> {editModal.company_name || "-"}</p>
                <p><strong>Telefon:</strong> {editModal.whatsapp_phone || "-"}</p>
                <p><strong>E-posta:</strong> {editModal.contact_email || "-"}</p>
                <p><strong>Business Manager:</strong> {editModal.has_business_manager ? `Evet (${editModal.business_manager_id || "ID girilmemiş"})` : "Hayır"}</p>
                {editModal.notes && <p><strong>Notlar:</strong> {editModal.notes}</p>}
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Durum</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v as IntegrationStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {t(config.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Meta fields */}
              <div className="space-y-2">
                <Label>Meta Phone Number ID</Label>
                <Input
                  value={editForm.meta_phone_number_id}
                  onChange={(e) => setEditForm({ ...editForm, meta_phone_number_id: e.target.value })}
                  placeholder="123456789012345"
                />
              </div>
              <div className="space-y-2">
                <Label>Meta WABA ID</Label>
                <Input
                  value={editForm.meta_waba_id}
                  onChange={(e) => setEditForm({ ...editForm, meta_waba_id: e.target.value })}
                  placeholder="WABA ID"
                />
              </div>
              <div className="space-y-2">
                <Label>Meta Access Token {editModal?.meta_phone_number_id ? t("superAdmin.integrations.tokenLabel") : ""}</Label>
                <Input
                  type="password"
                  value={editForm.new_meta_access_token}
                  onChange={(e) => setEditForm({ ...editForm, new_meta_access_token: e.target.value })}
                  placeholder={t("superAdmin.integrations.tokenPlaceholder")}
                  autoComplete="new-password"
                />
              </div>

              {/* Admin notes */}
              <div className="space-y-2">
                <Label>{t("superAdmin.integrations.internalNoteLabel")}</Label>
                <Textarea
                  value={editForm.admin_notes}
                  onChange={(e) => setEditForm({ ...editForm, admin_notes: e.target.value })}
                  placeholder={t("superAdmin.integrations.internalNotePlaceholder")}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(null)}>
              İptal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
