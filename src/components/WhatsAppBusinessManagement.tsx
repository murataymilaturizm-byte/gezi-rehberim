import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Settings, CheckCircle2, Circle, Loader2, Phone, Save, X, ArrowRight } from "lucide-react";
import { SuperAdminWhatsAppIntegrations } from "./SuperAdminWhatsAppIntegrations";

interface ConnectedAccount {
  id: string;
  name: string;
  whatsapp_phone_number: string | null;
  meta_phone_number_id: string | null;
  meta_waba_id: string | null;
  whatsapp_status: string | null;
}

interface WhatsAppBusinessManagementProps {
  isSuperAdmin?: boolean;
}

export function WhatsAppBusinessManagement({ isSuperAdmin = false }: WhatsAppBusinessManagementProps) {
  const { t } = useTranslation();
  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("superAdmin.business.title")}</h2>
        <p className="text-muted-foreground">
          {t("superAdmin.business.description")}
        </p>
      </div>

      <Tabs defaultValue="connected" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connected">{t("superAdmin.business.connectedTab")}</TabsTrigger>
          <TabsTrigger value="requests">{t("superAdmin.business.integrationsTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="connected">
          <ConnectedAccountsTab />
        </TabsContent>

        <TabsContent value="requests">
          <SuperAdminWhatsAppIntegrations isSuperAdmin={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConnectedAccountsTab() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<ConnectedAccount | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("agencies")
      .select("id, name, whatsapp_phone_number, meta_phone_number_id, meta_waba_id, whatsapp_status")
      .order("name");

    if (error) {
      toast({ title: t("common.error"), description: t("superAdmin.business.loadError"), variant: "destructive" });
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  const openManageDialog = (account: ConnectedAccount) => {
    setSelectedAccount(account);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("superAdmin.business.connectedTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Acente Adı</TableHead>
                <TableHead>Telefon Numarası</TableHead>
                <TableHead>Phone Number ID</TableHead>
                <TableHead>WABA ID</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {t("superAdmin.business.noAccounts")}
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell>{account.whatsapp_phone_number || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{account.meta_phone_number_id || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{account.meta_waba_id || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={account.whatsapp_status === "active" ? "default" : "secondary"}>
                        {account.whatsapp_status === "active" ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openManageDialog(account)}>
                        <Settings className="h-4 w-4 mr-1" /> {t("superAdmin.business.manageButton")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedAccount && (
        <ManageAccountDialog
          account={selectedAccount}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSaved={fetchAccounts}
        />
      )}
    </>
  );
}

interface ManageAccountDialogProps {
  account: ConnectedAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function ManageAccountDialog({ account, open, onOpenChange, onSaved }: ManageAccountDialogProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    whatsapp_phone_number: account.whatsapp_phone_number || "",
    meta_phone_number_id: account.meta_phone_number_id || "",
    meta_waba_id: account.meta_waba_id || "",
    new_meta_access_token: "",
    whatsapp_status: account.whatsapp_status || "pending",
  });
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regPhone, setRegPhone] = useState("");
  const [regStep, setRegStep] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    setForm({
      whatsapp_phone_number: account.whatsapp_phone_number || "",
      meta_phone_number_id: account.meta_phone_number_id || "",
      meta_waba_id: account.meta_waba_id || "",
      new_meta_access_token: "",
      whatsapp_status: account.whatsapp_status || "pending",
    });
    setShowToken(false);
    setRegStep(0);
    setRegPhone("");
  }, [account]);

  const handleSave = async () => {
    setSaving(true);
    const updateData: any = {
      whatsapp_phone_number: form.whatsapp_phone_number || null,
      meta_phone_number_id: form.meta_phone_number_id || null,
      meta_waba_id: form.meta_waba_id || null,
      whatsapp_status: form.whatsapp_status,
    };
    if (form.new_meta_access_token.trim()) {
      updateData.meta_access_token = form.new_meta_access_token.trim();
    }
    const { error } = await supabase
      .from("agencies")
      .update(updateData)
      .eq("id", account.id);

    if (error) {
      toast({ title: t("common.error"), description: t("superAdmin.business.updateError"), variant: "destructive" });
    } else {
      toast({ title: t("common.success"), description: t("superAdmin.business.updateSuccess") });
      onSaved();
      onOpenChange(false);
    }
    setSaving(false);
  };

  const regSteps = [
    { label: "Numara girildi", done: regStep >= 1 },
    { label: "Doğrulama kodu gönderildi", done: regStep >= 2 },
    { label: "Numara doğrulandı", done: regStep >= 3 },
    { label: "Sisteme eklendi", done: regStep >= 4 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("superAdmin.business.dialogTitle")}</DialogTitle>
          <DialogDescription>{account.name} — Hesap bilgilerini düzenleyin</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Account Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Hesap Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Acente Adı</Label>
                <Input value={account.name} disabled className="bg-muted" />
              </div>

              <div>
                <Label>WhatsApp Telefon Numarası</Label>
                <Input
                  value={form.whatsapp_phone_number}
                  onChange={(e) => setForm({ ...form, whatsapp_phone_number: e.target.value })}
                  placeholder="905xxxxxxxxx"
                />
              </div>

              <div>
                <Label>Meta Phone Number ID</Label>
                <Input
                  value={form.meta_phone_number_id}
                  onChange={(e) => setForm({ ...form, meta_phone_number_id: e.target.value })}
                  placeholder="Phone Number ID"
                />
              </div>

              <div>
                <Label>Meta WABA ID</Label>
                <Input
                  value={form.meta_waba_id}
                  onChange={(e) => setForm({ ...form, meta_waba_id: e.target.value })}
                  placeholder="WhatsApp Business Account ID"
                />
              </div>

              <div>
                <Label>Meta Access Token {account.meta_phone_number_id ? "(boş bırakırsanız mevcut korunur)" : ""}</Label>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    value={form.new_meta_access_token}
                    onChange={(e) => setForm({ ...form, new_meta_access_token: e.target.value })}
                    placeholder="Yeni token (boş = mevcut korunur)"
                    className="pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Durum</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {form.whatsapp_status === "active" ? "Aktif" : "Pasif"}
                  </span>
                  <Switch
                    checked={form.whatsapp_status === "active"}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, whatsapp_status: checked ? "active" : "pending" })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Number Registration Simulation */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Yeni Numara Ekle
              </CardTitle>
              <CardDescription>WhatsApp Business numarası kayıt simülasyonu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="905xxxxxxxxx"
                  disabled={regStep > 0}
                />
                <Button
                  variant="outline"
                  disabled={!regPhone || regStep > 0}
                  onClick={() => setRegStep(1)}
                >
                  Kayıt Başlat
                </Button>
              </div>

              {/* Steps */}
              <div className="space-y-3 pt-2">
                {regSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    {step.done ? (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                    )}
                    <span className={step.done ? "text-foreground font-medium" : "text-muted-foreground"}>
                      Adım {idx + 1}: {step.label}
                    </span>
                    {!step.done && idx === regStep && regStep > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => setRegStep(idx + 1)}>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {regStep >= 4 && (
                <div className="rounded-md bg-primary/10 p-3 text-sm text-primary">
                  ✅ Numara başarıyla kaydedildi ve sisteme eklendi.
                </div>
              )}

              {regStep > 0 && regStep < 4 && (
                <Button size="sm" variant="outline" onClick={() => setRegStep(regStep + 1)}>
                  Sonraki Adıma İlerle
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" /> İptal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
