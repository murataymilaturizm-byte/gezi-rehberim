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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SendTemplateDialog } from "./SendTemplateDialog";
import AutomatedNotificationsTab from "./AutomatedNotificationsTab";

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
// İş1 (2026-07-10): 'tour_reminder' KNOWN'dan ÇIKARILDI — yerel taslak değil,
// Meta-onaylı tour_reminder_{lang} tarafından karşılanan bir olay. Eski yerel
// kayıtlar arşivlendi (is_active=false); artık zorla bot-kartı render edilmez.
const KNOWN_TEMPLATE_TYPES: Record<string, string> = {
  reservation_confirmed: 'admin.templates.types.reservation_confirmed',
  reservation_cancelled: 'admin.templates.types.reservation_cancelled',
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // İş1 (2026-07-10): "Şablonlar" içinde İKİ DÜNYA ayrımı — bot şablonları vs
  // Meta-onaylı (sync'le inen) template'ler karışmasın.
  // 2026-07-24 panel sadeleştirme: yalnız Meta görünümü. Bot alt-sekmesi kaldırıldı
  // (yerel/bot şablonları düzenleme UI'ı gizli). Statü-değişim gönderimleri
  // (Admin.tsx → reservation_confirmed/cancelled → send-template-message MODE3 →
  // message_templates) bu UI'dan BAĞIMSIZ, aynen çalışmaya devam eder.
  const [tplScope] = useState<"bot" | "meta">("meta");
  // Meta sync sonrası embed'li otomatik-bildirim kartlarını tazelemek için sinyal.
  const [syncNonce, setSyncNonce] = useState(0);
  const { toast } = useToast();

  const templateKeys = getAllTemplateKeys(templates);
  // Otomatik-bildirim standart adları (sabit iki satırda gösterilir → "Diğer
  // Meta Şablonları" listesinden DIŞLANIR, çift görünmesin).
  const AUTOMATION_TEMPLATE_RE = /^tour_(reminder|feedback)_(tr|en|de|fr|es|ru|ar)$/;
  // İş1: aktif alt-sekmeye göre görünen key'ler (bot = KNOWN_TEMPLATE_TYPES,
  // meta = geri kalan MA otomatik-bildirim template'leri hariç).
  const visibleTemplateKeys = templateKeys.filter((k) =>
    tplScope === "bot"
      ? k in KNOWN_TEMPLATE_TYPES
      : !(k in KNOWN_TEMPLATE_TYPES) && !AUTOMATION_TEMPLATE_RE.test(k),
  );

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
      if (!user) return;

      const { data: agency } = await supabase
        .from('agencies')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!agency) return;
      setAgencyId(agency.id);

      const { data, error } = await (supabase as any)
        .from('message_templates')
        .select('*')
        .eq('agency_id', agency.id)
        .order('template_key')
        .order('language');

      if (error) throw error;
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

  const handleDeleteTemplate = (id: string) => {
    setPendingDeleteId(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteTemplate = async () => {
    if (!pendingDeleteId) return;
    try {
      const { error } = await (supabase as any)
        .from('message_templates')
        .delete()
        .eq('id', pendingDeleteId);

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
    } finally {
      setPendingDeleteId(null);
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
      // 2026-07-10: supabase.functions.invoke non-2xx'te error.message GENERIC
      // ("non-2xx status code") döner — gerçek sebep response BODY'sinde. Gerçek
      // mesajı context'ten oku (token-scope / waba-eksik net görünsün).
      if (error) {
        let realMsg = error.message;
        try {
          const body = await (error as any)?.context?.json?.();
          if (body?.error) realMsg = body.error;
        } catch { /* body okunamazsa generic kalır */ }
        toast({ title: t("common.error"), description: realMsg || t("admin.templates.sync.error"), variant: "destructive" });
        return;
      }
      if (data?.error) {
        toast({ title: t("common.error"), description: data.error, variant: "destructive" });
        return;
      }
      const description = (data?.inserted ?? 0) > 0
        ? t("admin.templates.sync.successWithNew", { inserted: data.inserted, updated: data.updated ?? 0 })
        : t("admin.templates.sync.success", { count: data?.updated ?? 0 });
      toast({ title: t("common.success"), description });
      await fetchTemplates();
      setSyncNonce((n) => n + 1); // embed'li otomatik-bildirim kartlarını tazele
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
      {/* 2026-07-10 NİHAİ MODEL: "Otomatik Bildirimler" AYRI SEKMESİ KALDIRILDI.
          Tek ayrım: Bot Mesaj Şablonları | WhatsApp Onaylı Şablonlar (Meta).
          Meta sekmesinin ilk iki SABİT satırı = Tur Hatırlatma + Memnuniyet Anketi
          (Otomatik Bildirim kartları, aşağıda embed). */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">{t("admin.whatsapp.templates.title")}</h2>
          <p className="text-muted-foreground">
            {t("admin.whatsapp.templates.description")}
          </p>
        </div>
        {/* İş1: sync + hazır-şablon aksiyonları alt-sekmeye göre. */}
        <div className="flex gap-2 flex-wrap">
          {tplScope === "meta" ? (
            <Button onClick={handleSyncWithMeta} variant="outline" disabled={syncing || !agencyId}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {t("admin.templates.sync.button")}
            </Button>
          ) : (
            <Button onClick={copyDefaultTemplates} variant={templates.length === 0 ? "default" : "outline"}>
              <Copy className="mr-2 h-4 w-4" />
              {t("admin.whatsapp.templates.loadDefaults")}
            </Button>
          )}
        </div>
      </div>

      {/* 2026-07-24: Bot alt-sekmesi kaldırıldı — yalnız Meta-onaylı şablonlar. */}
      <p className="text-xs text-muted-foreground">
        Meta'dan senkronize edilen resmi şablonlar. Otomatik bildirim (hatırlatma/anket) yalnız APPROVED şablonlarla çalışır. Yeni çekmek için 'Şablonları Eşleştir'.
      </p>

      {/* NİHAİ MODEL: Meta sekmesinin İLK İKİ SABİT SATIRI = otomatik-bildirim
          kartları (Tur Hatırlatma + Memnuniyet Anketi). Backend sözleşmesi
          (event_type tour_reminder/feedback_survey + kayıt mantığı) AYNEN. */}
      {tplScope === "meta" && (
        <>
          {/* PANEL-DENETİM-2 S-fix: şablon-oluşturma yönergesi — yeni acente
              tour_reminder_tr'yi Meta'da NASIL oluşturacağını panelden öğrenir
              (Murat'ın yaşadığı kafa karışıklığı sınıfı). */}
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-sm space-y-1.5">
            <p className="font-semibold">📋 Yeni WhatsApp şablonu nasıl eklenir?</p>
            <ol className="list-decimal ms-5 space-y-0.5 text-muted-foreground">
              <li><a href="https://business.facebook.com/wa/manage/message-templates/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Meta WhatsApp Manager → Mesaj Şablonları</a>'nda şablon oluşturun (kategori: <span className="font-mono">Utility</span>).</li>
              <li>Önerilen adlar: <span className="font-mono">tour_reminder_tr</span> (hatırlatma), <span className="font-mono">tour_feedback_tr</span> (anket) — diğer diller için <span className="font-mono">_en, _de…</span> eki.</li>
              <li>Meta onayı (genelde dakikalar–saatler) sonrası aşağıdaki <span className="font-semibold">"Meta'dan Şablonları Çek"</span> ile içeri alın.</li>
              <li>Üstteki <span className="font-semibold">Tur Hatırlatma / Memnuniyet Anketi</span> kartlarında dile göre seçip kaydedin.</li>
            </ol>
          </div>

          <AutomatedNotificationsTab reloadSignal={syncNonce} />
          <div className="pt-4 mt-2 border-t border-border">
            <h3 className="text-lg font-semibold">Diğer Meta Şablonları</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Otomatik bildirim dışındaki Meta şablonları (onay durumu rozetli).
            </p>
          </div>
        </>
      )}

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

        {LANGUAGES.map((lang) => {
          const _langVisibleCount = visibleTemplateKeys.filter((key) => {
            const template = getTemplatesByLanguage(lang.code).find((tmpl) => tmpl.template_key === key);
            return (key in KNOWN_TEMPLATE_TYPES) || !!template;
          }).length;
          return (
          <TabsContent key={lang.code} value={lang.code} className="space-y-4">
            {_langVisibleCount === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {tplScope === "meta"
                  ? "Bu dilde Meta'dan senkronize şablon yok. 'Şablonları Eşleştir' ile çekin."
                  : "Bu dilde bot şablonu yok."}
              </div>
            )}
            <div className="grid gap-4">
              {visibleTemplateKeys.map((key) => {
                const template = getTemplatesByLanguage(lang.code).find(
                  tmpl => tmpl.template_key === key
                );
                const isKnownType = key in KNOWN_TEMPLATE_TYPES;

                // Custom/Meta template: sadece kendi dilinin tab'ında göster
                if (!isKnownType && !template) return null;
                // İş1: arşivlenen yerel orphan'ı gizle (meta_status yok + pasif);
                // Meta PENDING/REJECTED (meta_status var, is_active=false) GÖRÜNÜR kalır.
                if (template && !template.meta_status && template.is_active === false) return null;

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
                          {/* Gönder butonu: Meta'da APPROVED + template_id dolu → aktif */}
                          {template && template.meta_status === 'APPROVED' && template.meta_template_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setSendingTemplate(template); setSendDialogOpen(true); }}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              {t("admin.templates.sendButton")}
                            </Button>
                          )}
                          {/* Onaylanmadı tooltip: template var ama meta_status APPROVED değil */}
                          {template && template.meta_template_id && template.meta_status !== 'APPROVED' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button variant="outline" size="sm" disabled className="pointer-events-none">
                                    <Send className="h-4 w-4 mr-1" />
                                    {t("admin.templates.sendButton")}
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{t("admin.templates.notApprovedTooltip")}</TooltipContent>
                            </Tooltip>
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
          );
        })}
      </Tabs>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card">
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

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.templates.deleteTitle", "Şablonu silmek istediğinize emin misiniz?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.templates.deleteConfirm", "Bu şablon kalıcı olarak silinecek. Bu işlem geri alınamaz.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "İptal")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTemplate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete", "Sil")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
