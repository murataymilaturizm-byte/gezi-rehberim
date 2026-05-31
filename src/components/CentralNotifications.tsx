// CentralNotifications.tsx — Turzz merkezi WhatsApp bildirim ayarları
// İki alt sekme: (a) Olay ↔ Şablon eşleştirme  (b) Ekip alıcıları
// SADECE super_admin görür (Admin.tsx render switch'inde guard).

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  TURZZ_CENTRAL_AGENCY_ID,
  CENTRAL_EVENT_TYPES,
  type CentralEventType,
} from "@/lib/centralAgency";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Edit, Trash2, Send, AlertCircle, Bell } from "lucide-react";

import { SendTemplateDialog } from "./SendTemplateDialog";

// ─── Tipler ──────────────────────────────────────────────────────────────────
interface CentralEventTemplate {
  id: string;
  event_type: CentralEventType;
  template_key: string;
  language: string;
  active: boolean;
  created_at: string;
}

interface TeamRecipient {
  id: string;
  phone: string;
  name: string | null;
  active: boolean;
  notification_types: CentralEventType[];
  created_at: string;
}

interface CentralTemplate {
  id: string;
  template_key: string;
  language: string;
  subject: string;
  content: string;
  variables: any;
  is_active: boolean;
  meta_status: string | null;
  meta_template_id: string | null;
}

// ─── Yardımcı ──────────────────────────────────────────────────────────────
function eventLabel(et: string, t: any): string {
  return t(`admin.central.events.${et}`, { defaultValue: et });
}

// ═══════════════════════════════════════════════════════════════════════════
// Ana component
// ═══════════════════════════════════════════════════════════════════════════
export default function CentralNotifications() {
  const { t } = useTranslation();
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Bell className="h-5 w-5 text-primary" />
          {t("admin.central.title", { defaultValue: "Merkezi Bildirimler" })}
        </CardTitle>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {t("admin.central.description", {
            defaultValue:
              "Turzz'a ait WhatsApp numarasından, sistem olaylarında ekip üyelerine otomatik bildirim gönderilir. Olay-şablon eşleştirmesi ve alıcı listesi burada yönetilir.",
          })}
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="mappings" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="mappings">
              {t("admin.central.tabs.mappings", { defaultValue: "Olay ↔ Şablon" })}
            </TabsTrigger>
            <TabsTrigger value="recipients">
              {t("admin.central.tabs.recipients", { defaultValue: "Ekip Alıcıları" })}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="mappings" className="mt-4">
            <MappingsPanel />
          </TabsContent>
          <TabsContent value="recipients" className="mt-4">
            <RecipientsPanel />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// (a) OLAY ↔ ŞABLON EŞLEŞTİRME
// ═══════════════════════════════════════════════════════════════════════════
function MappingsPanel() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [mappings, setMappings] = useState<CentralEventTemplate[]>([]);
  const [centralTemplates, setCentralTemplates] = useState<CentralTemplate[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CentralEventTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Test send
  const [testTemplate, setTestTemplate] = useState<CentralTemplate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // (supabase as any): central_event_templates ve turzz_team_recipients için
      // Supabase üretilen types.ts henüz regenerate edilmedi (PARÇA 1 migration'ları sonrası).
      // Mevcut projede aynı pattern: MessageTemplates.tsx l. 132 — message_templates as any.
      const [{ data: m, error: e1 }, { data: tpls, error: e2 }] = await Promise.all([
        (supabase as any)
          .from("central_event_templates")
          .select("*")
          .order("event_type", { ascending: true })
          .order("language", { ascending: true }),
        (supabase as any)
          .from("message_templates")
          .select("id, template_key, language, subject, content, variables, is_active, meta_status, meta_template_id")
          .eq("agency_id", TURZZ_CENTRAL_AGENCY_ID)
          .order("template_key", { ascending: true }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setMappings((m as CentralEventTemplate[]) || []);
      setCentralTemplates((tpls as CentralTemplate[]) || []);
    } catch (err: any) {
      toast({
        title: t("common.error"),
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { load(); }, [load]);

  const approvedTemplates = centralTemplates.filter(
    (tpl) => tpl.meta_status === "APPROVED" && tpl.is_active,
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await (supabase as any)
        .from("central_event_templates")
        .delete()
        .eq("id", deleteId);
      if (error) throw error;
      toast({ title: t("common.success") });
      setDeleteId(null);
      load();
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  };

  const toggleActive = async (row: CentralEventTemplate) => {
    try {
      const { error } = await (supabase as any)
        .from("central_event_templates")
        .update({ active: !row.active })
        .eq("id", row.id);
      if (error) throw error;
      load();
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  };

  const handleTestSend = (row: CentralEventTemplate) => {
    const tpl = centralTemplates.find(
      (t) => t.template_key === row.template_key && t.language === row.language,
    );
    if (!tpl) {
      toast({
        title: t("common.error"),
        description: t("admin.central.mappings.templateMissing", {
          defaultValue: "Eşleşen şablon kaydı bulunamadı.",
        }),
        variant: "destructive",
      });
      return;
    }
    setTestTemplate(tpl);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          {t("admin.central.mappings.hint", {
            defaultValue:
              "Her olay tipi (yeni rezervasyon / yeni acente / yeni iletişim) için kullanılacak APPROVED Meta şablonunu eşleştirin. Aynı (olay + dil) için tek eşleştirme.",
          })}
        </p>
        <Button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          disabled={approvedTemplates.length === 0}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          {t("admin.central.mappings.add", { defaultValue: "Eşleştirme Ekle" })}
        </Button>
      </div>

      {approvedTemplates.length === 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-medium">
                {t("admin.central.mappings.noTemplatesTitle", {
                  defaultValue: "Henüz onaylı merkezi şablon yok",
                })}
              </p>
              <p className="text-muted-foreground">
                {t("admin.central.mappings.noTemplatesDesc", {
                  defaultValue:
                    "Eşleştirme yapabilmek için önce Turzz hesabına ait Meta WhatsApp Business Manager'da şablonlar oluşturulmalı, onaylandıktan sonra message_templates tablosuna (agency_id = TURZZ_CENTRAL_AGENCY_ID ile) eklenmeli. Süreci raporda açıkladık.",
                })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {mappings.length > 0 ? (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.central.mappings.col.event", { defaultValue: "Olay" })}</TableHead>
                <TableHead>{t("admin.central.mappings.col.language", { defaultValue: "Dil" })}</TableHead>
                <TableHead>{t("admin.central.mappings.col.template", { defaultValue: "Şablon" })}</TableHead>
                <TableHead>{t("admin.central.mappings.col.active", { defaultValue: "Aktif" })}</TableHead>
                <TableHead className="text-right">
                  {t("admin.central.mappings.col.actions", { defaultValue: "İşlem" })}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((row) => {
                const tpl = centralTemplates.find(
                  (t) => t.template_key === row.template_key && t.language === row.language,
                );
                const tplApproved = tpl?.meta_status === "APPROVED" && tpl?.is_active;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{eventLabel(row.event_type, t)}</TableCell>
                    <TableCell className="uppercase text-xs">{row.language}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <code className="text-xs">{row.template_key}</code>
                        {tpl ? (
                          <Badge variant={tplApproved ? "default" : "secondary"} className="w-fit text-[10px]">
                            {tpl.meta_status || "—"}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="w-fit text-[10px]">MISSING</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch checked={row.active} onCheckedChange={() => toggleActive(row)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost" size="sm" onClick={() => handleTestSend(row)}
                          disabled={!tplApproved}
                          title={t("admin.central.mappings.testSend", { defaultValue: "Test Gönder" })}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => { setEditing(row); setDialogOpen(true); }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => setDeleteId(row.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {t("admin.central.mappings.empty", { defaultValue: "Henüz eşleştirme yok." })}
          </CardContent>
        </Card>
      )}

      <MappingDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        editing={editing}
        existingMappings={mappings}
        approvedTemplates={approvedTemplates}
        onSaved={load}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.central.mappings.deleteTitle", { defaultValue: "Eşleştirmeyi sil?" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.central.mappings.deleteDesc", {
                defaultValue: "Bu eşleştirme silinirse ilgili olay için bildirim gönderilmez.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {t("common.delete", { defaultValue: "Sil" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SendTemplateDialog
        template={testTemplate as any}
        agencyId={TURZZ_CENTRAL_AGENCY_ID}
        open={!!testTemplate}
        onClose={() => setTestTemplate(null)}
      />
    </div>
  );
}

function MappingDialog({
  open, onClose, editing, existingMappings, approvedTemplates, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: CentralEventTemplate | null;
  existingMappings: CentralEventTemplate[];
  approvedTemplates: CentralTemplate[];
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [eventType, setEventType] = useState<CentralEventType>("new_reservation");
  const [language, setLanguage] = useState("tr");
  const [templateKey, setTemplateKey] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setEventType(editing.event_type);
        setLanguage(editing.language);
        setTemplateKey(editing.template_key);
        setActive(editing.active);
      } else {
        setEventType("new_reservation");
        setLanguage("tr");
        setTemplateKey("");
        setActive(true);
      }
    }
  }, [open, editing]);

  // Seçilen dile göre uygun şablonları filtrele
  const availableTemplates = approvedTemplates.filter((tpl) => tpl.language === language);
  const availableLanguages = Array.from(new Set(approvedTemplates.map((tpl) => tpl.language)));

  const handleSave = async () => {
    // UNIQUE(event_type, language) — UI guard (DB de var ama önce kullanıcıya güzel mesaj)
    const conflict = existingMappings.find(
      (m) => m.event_type === eventType && m.language === language && m.id !== editing?.id,
    );
    if (conflict) {
      toast({
        title: t("common.error"),
        description: t("admin.central.mappings.duplicateError", {
          defaultValue: "Bu olay ve dil için zaten bir eşleştirme var.",
        }),
        variant: "destructive",
      });
      return;
    }
    if (!templateKey) {
      toast({
        title: t("common.error"),
        description: t("admin.central.mappings.templateRequired", {
          defaultValue: "Şablon seçin.",
        }),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await (supabase as any)
          .from("central_event_templates")
          .update({ event_type: eventType, template_key: templateKey, language, active })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("central_event_templates")
          .insert({ event_type: eventType, template_key: templateKey, language, active });
        if (error) throw error;
      }
      toast({ title: t("common.success") });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t("admin.central.mappings.editTitle", { defaultValue: "Eşleştirmeyi Düzenle" })
              : t("admin.central.mappings.addTitle", { defaultValue: "Yeni Eşleştirme" })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t("admin.central.mappings.col.event", { defaultValue: "Olay" })}</Label>
            <Select value={eventType} onValueChange={(v) => setEventType(v as CentralEventType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CENTRAL_EVENT_TYPES.map((et) => (
                  <SelectItem key={et} value={et}>{eventLabel(et, t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("admin.central.mappings.col.language", { defaultValue: "Dil" })}</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableLanguages.length === 0 ? (
                  <SelectItem value="tr">tr</SelectItem>
                ) : (
                  availableLanguages.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("admin.central.mappings.col.template", { defaultValue: "Şablon" })}</Label>
            <Select value={templateKey} onValueChange={setTemplateKey}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.central.mappings.selectTemplate", { defaultValue: "Şablon seçin" })} />
              </SelectTrigger>
              <SelectContent>
                {availableTemplates.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    {t("admin.central.mappings.noTemplatesForLang", {
                      defaultValue: "Bu dil için onaylı şablon yok.",
                    })}
                  </div>
                ) : (
                  availableTemplates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.template_key}>
                      {tpl.template_key} {tpl.subject ? `— ${tpl.subject}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} id="m-active" />
            <Label htmlFor="m-active" className="cursor-pointer">
              {t("admin.central.mappings.col.active", { defaultValue: "Aktif" })}
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t("common.save", { defaultValue: "Kaydet" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// (b) EKİP ALICILARI
// ═══════════════════════════════════════════════════════════════════════════
function RecipientsPanel() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [recipients, setRecipients] = useState<TeamRecipient[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TeamRecipient | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("turzz_team_recipients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRecipients((data as TeamRecipient[]) || []);
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (row: TeamRecipient) => {
    try {
      const { error } = await (supabase as any)
        .from("turzz_team_recipients")
        .update({ active: !row.active })
        .eq("id", row.id);
      if (error) throw error;
      load();
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await (supabase as any).from("turzz_team_recipients").delete().eq("id", deleteId);
      if (error) throw error;
      setDeleteId(null);
      load();
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          {t("admin.central.recipients.hint", {
            defaultValue:
              "Bildirim gidecek Turzz ekibi numaraları. Her kişi hangi olay tiplerini alacağını seçebilir. Telefon E.164 formatında (+90..., +49...).",
          })}
        </p>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t("admin.central.recipients.add", { defaultValue: "Alıcı Ekle" })}
        </Button>
      </div>

      {recipients.length > 0 ? (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.central.recipients.col.name", { defaultValue: "Ad" })}</TableHead>
                <TableHead>{t("admin.central.recipients.col.phone", { defaultValue: "Telefon" })}</TableHead>
                <TableHead>{t("admin.central.recipients.col.events", { defaultValue: "Olaylar" })}</TableHead>
                <TableHead>{t("admin.central.recipients.col.active", { defaultValue: "Aktif" })}</TableHead>
                <TableHead className="text-right">
                  {t("admin.central.recipients.col.actions", { defaultValue: "İşlem" })}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipients.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name || "—"}</TableCell>
                  <TableCell><code className="text-xs">{r.phone}</code></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(r.notification_types || []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        r.notification_types.map((et) => (
                          <Badge key={et} variant="secondary" className="text-[10px]">
                            {eventLabel(et, t)}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch checked={r.active} onCheckedChange={() => toggleActive(r)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => { setEditing(r); setDialogOpen(true); }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => setDeleteId(r.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {t("admin.central.recipients.empty", { defaultValue: "Henüz alıcı yok." })}
          </CardContent>
        </Card>
      )}

      <RecipientDialog
        open={dialogOpen}
        editing={editing}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSaved={load}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.central.recipients.deleteTitle", { defaultValue: "Alıcıyı sil?" })}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {t("common.delete", { defaultValue: "Sil" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RecipientDialog({
  open, editing, onClose, onSaved,
}: {
  open: boolean;
  editing: TeamRecipient | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [active, setActive] = useState(true);
  const [notificationTypes, setNotificationTypes] = useState<CentralEventType[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name || "");
        setPhone(editing.phone);
        setActive(editing.active);
        setNotificationTypes(editing.notification_types || []);
      } else {
        setName("");
        setPhone("");
        setActive(true);
        setNotificationTypes([]);
      }
    }
  }, [open, editing]);

  const toggleType = (et: CentralEventType) => {
    setNotificationTypes((prev) =>
      prev.includes(et) ? prev.filter((x) => x !== et) : [...prev, et],
    );
  };

  // Basit E.164 kontrolü (app katmanı, DB constraint yok)
  const phoneOk = /^\+[1-9]\d{6,14}$/.test(phone.trim());

  const handleSave = async () => {
    if (!phoneOk) {
      toast({
        title: t("common.error"),
        description: t("admin.central.recipients.invalidPhone", {
          defaultValue: "Telefon E.164 formatında olmalı (+ ülke kodu, sonra rakam — örn. +905XXXXXXXXX).",
        }),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        phone: phone.trim(),
        name: name.trim() || null,
        active,
        notification_types: notificationTypes,
      };
      if (editing) {
        const { error } = await (supabase as any)
          .from("turzz_team_recipients").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("turzz_team_recipients").insert(payload);
        if (error) throw error;
      }
      toast({ title: t("common.success") });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t("admin.central.recipients.editTitle", { defaultValue: "Alıcıyı Düzenle" })
              : t("admin.central.recipients.addTitle", { defaultValue: "Yeni Alıcı" })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="r-name">
              {t("admin.central.recipients.col.name", { defaultValue: "Ad" })}
            </Label>
            <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-phone">
              {t("admin.central.recipients.col.phone", { defaultValue: "Telefon" })}
            </Label>
            <Input
              id="r-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+905XXXXXXXXX"
            />
            {phone && !phoneOk && (
              <p className="text-xs text-amber-600">
                {t("admin.central.recipients.invalidPhone", {
                  defaultValue: "Telefon E.164 formatında olmalı (+ ülke kodu, sonra rakam).",
                })}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>
              {t("admin.central.recipients.col.events", { defaultValue: "Olaylar" })}
            </Label>
            <div className="space-y-2">
              {CENTRAL_EVENT_TYPES.map((et) => (
                <div key={et} className="flex items-center gap-2">
                  <Checkbox
                    id={`r-et-${et}`}
                    checked={notificationTypes.includes(et)}
                    onCheckedChange={() => toggleType(et)}
                  />
                  <Label htmlFor={`r-et-${et}`} className="cursor-pointer text-sm">
                    {eventLabel(et, t)}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} id="r-active" />
            <Label htmlFor="r-active" className="cursor-pointer">
              {t("admin.central.recipients.col.active", { defaultValue: "Aktif" })}
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving || !phoneOk}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t("common.save", { defaultValue: "Kaydet" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
