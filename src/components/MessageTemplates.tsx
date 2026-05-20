import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Trash2, Copy, Send, RefreshCw, CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SendTemplateDialog } from "./SendTemplateDialog";

interface MessageTemplate {
  id: string;
  template_key: string;
  language: string;
  subject: string;
  content: string;
  variables: any;
  is_active: boolean;
  meta_status?: string | null;
  meta_template_id?: string | null;
}

const LANGUAGES = [
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
];

// Bilinen sistem tipleri — i18n label'ı var
const KNOWN_TEMPLATE_TYPES: Record<string, string> = {
  reservation_confirmed: 'admin.templates.types.reservation_confirmed',
  reservation_cancelled: 'admin.templates.types.reservation_cancelled',
  tour_reminder: 'admin.templates.types.tour_reminder',
};

// DB'deki tüm unique template_key'leri döndür (bilinen + Meta'dan gelenler)
const getAllTemplateKeys = (templates: MessageTemplate[]): string[] => {
  const keys = new Set<string>(Object.keys(KNOWN_TEMPLATE_TYPES));
  templates.forEach(t => { if (t.template_key) keys.add(t.template_key); });
  return Array.from(keys);
};

// Label: bilinen tip → i18n, custom → okunabilir key
const getTemplateLabel = (key: string, t: any): string => {
  const i18nKey = KNOWN_TEMPLATE_TYPES[key];
  if (i18nKey) return t(i18nKey);
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge variant="outline" className="text-xs">{t_("admin.templates.status.notSynced")}</Badge>;
  const cfg: Record<string, { className: string; icon: any }> = {
    APPROVED: { className: "bg-green-500 hover:bg-green-600 text-white border-0", icon: CheckCircle2 },
    PENDING: { className: "bg-yellow-500 hover:bg-yellow-600 text-white border-0", icon: Clock },
    REJECTED: { className: "bg-red-500 hover:bg-red-600 text-white border-0", icon: XCircle },
    IN_APPEAL: { className: "bg-blue-500 hover:bg-blue-600 text-white border-0", icon: AlertCircle },
  };
  const { className, icon: Icon } = cfg[status] || { className: "", icon: AlertCircle };
  return (
    <Badge className={`text-xs gap-1 ${className}`}>
      <Icon className="h-2.5 w-2.5" />
      {status}
    </Badge>
  );
}

// Module-level translation helper (used in StatusBadge before component mounts)
let t_: (key: string) => string = (k) => k;

export default function MessageTemplates() {
  const { t } = useTranslation();
  t_ = t; // make t available to StatusBadge
  const [agencyId, setAgencyId] = useState<string>("");
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('tr');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState<MessageTemplate | null>(null);
  const [autoLoadAttempted, setAutoLoadAttempted] = useState(false);
  const { toast } = useToast();

  const templateKeys = getAllTemplateKeys(templates);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    // Varsayılan şablonları sadece bir kere otomatik yükle
    if (!loading && templates.length === 0 && !autoLoadAttempted) {
      setAutoLoadAttempted(true);
      copyDefaultTemplates();
    }
  }, [loading, templates.length, autoLoadAttempted]);

  const fetchTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log("[Templates] auth user:", user?.id, user?.email);
      if (!user) return;

      const { data: agency, error: agencyErr } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('user_id', user.id)
        .single();

      console.log("[Templates] agency lookup:", { agency, error: agencyErr });

      if (!agency) {
        console.warn("[Templates] No agency found for user — fetch aborted");
        return;
      }
      setAgencyId(agency.id);

      const { data, error } = await (supabase as any)
        .from('message_templates')
        .select('*')
        .eq('agency_id', agency.id)
        .order('template_key')
        .order('language');

      console.log("[Templates] fetched", data?.length, "templates for agency", agency.id);
      console.log("[Templates] templates list:", data?.map((t: any) => ({
        key: t.template_key, lang: t.language, status: t.meta_status, active: t.is_active
      })));

      if (error) {
        console.error("[Templates] fetch error:", error);
        throw error;
      }
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      toast({
        title: t("common.error"),
        description: t("admin.templates.errors.fetchError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agency } = await supabase
        .from('agencies')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!agency) return;

      const templateData = {
        agency_id: agency.id,
        template_key: editingTemplate.template_key,
        language: editingTemplate.language,
        subject: editingTemplate.subject,
        content: editingTemplate.content,
        variables: editingTemplate.variables,
        is_active: editingTemplate.is_active,
      };

      if (editingTemplate.id) {
        const { error } = await (supabase as any)
          .from('message_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('message_templates')
          .insert([templateData]);

        if (error) throw error;
      }

      toast({
        title: t("common.success"),
        description: t("admin.templates.success.saved"),
      });

      setEditDialogOpen(false);
      setEditingTemplate(null);
      fetchTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({
        title: t("common.error"),
        description: t("admin.templates.errors.saveError"),
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm(t('admin.templates.deleteConfirm'))) return;

    try {
      const { error } = await (supabase as any)
        .from('message_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("admin.templates.success.deleted"),
      });

      fetchTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({
        title: t("common.error"),
        description: t("admin.templates.errors.deleteError"),
        variant: "destructive",
      });
    }
  };

  const copyDefaultTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      const { data: agency } = await supabase
        .from('agencies')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!agency) {
        return;
      }

      // Mevcut şablonları al
      const { data: existingTemplates } = await (supabase as any)
        .from('message_templates')
        .select('template_key, language')
        .eq('agency_id', agency.id);

      // Varsayılan şablonları kopyala
      const { data: defaultTemplates, error: fetchError } = await (supabase as any)
        .from('message_templates')
        .select('*')
        .eq('agency_id', '00000000-0000-0000-0000-000000000000');

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        throw fetchError;
      }

      if (!defaultTemplates || defaultTemplates.length === 0) {
        toast({
          title: t("common.error"),
          description: t("admin.templates.errors.noDefaultTemplates"),
          variant: "destructive",
        });
        return;
      }

      // Sadece eksik şablonları filtrele
      const existingKeys = new Set(
        (existingTemplates || []).map((t: any) => `${t.template_key}_${t.language}`)
      );

      const newTemplates = (defaultTemplates as any[])
        .filter((t: any) => !existingKeys.has(`${t.template_key}_${t.language}`))
        .map((t: any) => ({
          agency_id: agency.id,
          template_key: t.template_key,
          language: t.language,
          subject: t.subject,
          content: t.content,
          variables: t.variables,
          is_active: t.is_active,
        }));

      if (newTemplates.length === 0) {
        toast({
          title: t("common.success"),
          description: t("admin.templates.success.copied"),
        });
        return;
      }


      const { error: insertError } = await (supabase as any)
        .from('message_templates')
        .insert(newTemplates);

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }

      toast({
        title: t("common.success"),
        description: t("admin.templates.success.copied"),
      });

      fetchTemplates();
    } catch (error: any) {
      console.error('Error copying templates:', error);
      toast({
        title: t("common.error"),
        description: error.message || t("admin.templates.errors.copyError"),
        variant: "destructive",
      });
    }
  };

  const handleSyncWithMeta = async () => {
    if (!agencyId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-meta-templates', {
        body: { agencyId },
      });
      if (error) throw error;
      const description = (data?.inserted ?? 0) > 0
        ? t("admin.templates.sync.successWithNew", { inserted: data.inserted, updated: data.updated ?? 0 })
        : t("admin.templates.sync.success", { count: data?.updated ?? 0 });
      toast({ title: t("common.success"), description });
      await fetchTemplates();
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message || t("admin.templates.sync.error"), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const getTemplatesByLanguage = (lang: string) => {
    return templates.filter(t => t.language === lang);
  };

  const getVariablesArray = (variables: any): string[] => {
    if (Array.isArray(variables)) return variables;
    if (typeof variables === 'string') return variables.split(',').map(v => v.trim());
    return [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">{t("admin.whatsapp.templates.title")}</h2>
          <p className="text-muted-foreground">
            {t("admin.whatsapp.templates.description")}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleSyncWithMeta} variant="outline" disabled={syncing || !agencyId}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {t("admin.templates.sync.button")}
          </Button>
          <Button onClick={copyDefaultTemplates} variant={templates.length === 0 ? "default" : "outline"}>
            <Copy className="mr-2 h-4 w-4" />
            {t("admin.whatsapp.templates.loadDefaults")}
          </Button>
        </div>
      </div>

      {/* DEBUG paneli — sorun teşhisi için (sonra kaldırılacak) */}
      <Card className="border-orange-500/40 bg-orange-500/5">
        <CardContent className="pt-4 text-xs font-mono space-y-1">
          <div><b>agencyId:</b> {agencyId || "(none)"}</div>
          <div><b>total templates:</b> {templates.length}</div>
          <div><b>selectedLanguage:</b> {selectedLanguage}</div>
          <div><b>templateKeys:</b> [{templateKeys.join(", ")}]</div>
          <div><b>EN tab templates:</b> {templates.filter(t => t.language === 'en').map(t => t.template_key).join(", ") || "(none)"}</div>
          <div className="pt-1 border-t border-orange-500/20">
            <b>Tüm satırlar:</b>
            {templates.map((t, i) => (
              <div key={i} className="ml-2">
                {i + 1}. key=<b>{t.template_key}</b> lang=<b>{t.language}</b> status={t.meta_status || "-"} active={String(t.is_active)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs value={selectedLanguage} onValueChange={setSelectedLanguage}>
        <TabsList className="grid grid-cols-7 w-full">
          {LANGUAGES.map((lang) => {
            const metaCount = templates.filter(
              tmpl => tmpl.language === lang.code && !(tmpl.template_key in KNOWN_TEMPLATE_TYPES)
            ).length;
            return (
              <TabsTrigger key={lang.code} value={lang.code} className="relative">
                {lang.flag} {lang.name}
                {metaCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold min-w-[16px] h-4 px-1">
                    {metaCount}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {LANGUAGES.map((lang) => (
          <TabsContent key={lang.code} value={lang.code} className="space-y-4">
            <div className="grid gap-4">
              {templateKeys.map((key) => {
                const template = getTemplatesByLanguage(lang.code).find(
                  tmpl => tmpl.template_key === key
                );
                const isKnownType = key in KNOWN_TEMPLATE_TYPES;

                // Custom/Meta template: sadece kendi dilinin tab'ında göster
                if (!isKnownType && !template) return null;

                const label = getTemplateLabel(key, t);

                return (
                  <Card key={key}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle>{label}</CardTitle>
                            {template && <StatusBadge status={template.meta_status} />}
                          </div>
                          <CardDescription>
                            {template ? template.subject : t('admin.templates.notCreated')}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {template && template.is_active && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setSendingTemplate(template); setSendDialogOpen(true); }}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              {t("admin.templates.sendButton")}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingTemplate(template || {
                                id: '',
                                template_key: key,
                                language: lang.code,
                                subject: '',
                                content: '',
                                variables: [],
                                is_active: true,
                              } as MessageTemplate);
                              setEditDialogOpen(true);
                            }}
                          >
                            {template ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          </Button>
                          {template && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteTemplate(template.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    {template && (
                      <CardContent>
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {template.content.substring(0, 200)}
                            {template.content.length > 200 && '...'}
                          </div>
                          {template.variables && getVariablesArray(template.variables).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {getVariablesArray(template.variables).map((variable) => (
                                <span
                                  key={variable}
                                  className="inline-flex items-center px-2 py-1 text-xs bg-primary/10 text-primary rounded"
                                >
                                  {`{${variable}}`}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('admin.templates.dialog.title')}</DialogTitle>
            <DialogDescription>
              {t('admin.templates.dialog.description')}
            </DialogDescription>
          </DialogHeader>

          {editingTemplate && (
            <div className="space-y-4">
              <div>
                <Label>{t('admin.templates.dialog.templateType')}</Label>
                <Select
                  value={editingTemplate.template_key}
                  onValueChange={(value) =>
                    setEditingTemplate({ ...editingTemplate, template_key: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templateKeys.map((key) => (
                      <SelectItem key={key} value={key}>
                        {getTemplateLabel(key, t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('admin.templates.dialog.language')}</Label>
                <Select
                  value={editingTemplate.language}
                  onValueChange={(value) =>
                    setEditingTemplate({ ...editingTemplate, language: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('admin.templates.dialog.subject')}</Label>
                <Input
                  value={editingTemplate.subject}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, subject: e.target.value })
                  }
                  placeholder={t('admin.templates.dialog.subjectPlaceholder')}
                />
              </div>

              <div>
                <Label>{t('admin.templates.dialog.content')}</Label>
                <Textarea
                  value={editingTemplate.content}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, content: e.target.value })
                  }
                  placeholder={t('admin.templates.dialog.contentPlaceholder')}
                  rows={10}
                />
              </div>

              <div>
                <Label>{t('admin.templates.dialog.variables')}</Label>
                <Input
                  value={getVariablesArray(editingTemplate.variables).join(', ')}
                  onChange={(e) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      variables: e.target.value.split(',').map(v => v.trim()).filter(v => v),
                    })
                  }
                  placeholder={t('admin.templates.dialog.variablesPlaceholder')}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('admin.templates.dialog.variablesExample')}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('admin.templates.dialog.cancel')}
            </Button>
            <Button onClick={handleSaveTemplate}>{t('admin.templates.dialog.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {agencyId && (
        <SendTemplateDialog
          template={sendingTemplate}
          agencyId={agencyId}
          open={sendDialogOpen}
          onClose={() => { setSendDialogOpen(false); setSendingTemplate(null); }}
        />
      )}
    </div>
  );
}
