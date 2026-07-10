// AutomatedNotificationsTab — Acente otomatik müşteri bildirimleri yönetim arayüzü.
//
// İki bölüm:
//   1) Tur Hatırlatma (tour_reminder) — turdan önce (negatif offset_hours)
//   2) Memnuniyet Anketi (feedback_survey) — tur sonrası (pozitif offset_hours)
//
// Her bölüm: aç/kapa toggle + zaman seçimi (dropdown) + dil başına şablon eşleştirme.
//
// VERİ KAYNAĞI: agency_event_templates tablosu (RLS ile acente kendi satırları).
//   - agency_id ASLA body'den GÖNDERILMEZ — RLS get_user_agency_id() ile zorlanır.
//     Server-side: insert sırasında agency_id verilir ama RLS WITH CHECK ile doğrulanır.
//   - UNIQUE(agency_id, event_type, language) — basit upsert pattern: önce DELETE
//     o (agency, event_type) için, sonra yeni satırları INSERT.
//
// PLAN GATING: plan_features.has_reminders / has_feedback → bölüm kilitli/disabled.
//
// ŞABLON KAYNAĞI: message_templates (meta_status='APPROVED' AND is_active=true).
//   - Acentenin Meta hesabından sync ettiği onaylı şablonlar.
//   - Hiç APPROVED şablon yoksa alert göster + Şablonlar sekmesine yönlendir.
//   - Her dil için ayrı dropdown (acentenin o dilde APPROVED şablonu yoksa o dil satırı çıkmaz).

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  MessageSquare,
  Lock,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Save,
} from "lucide-react";
import { getPlanFeatures, type PlanFeatures } from "@/utils/planFeatures";

// Faz 2 dil listesi — diğer admin component'leriyle aynı.
const LANGUAGES = [
  { code: "tr", name: "Türkçe", flag: "🇹🇷" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
];

// Zaman seçenekleri — tour_reminder: NEGATİF (önce), feedback_survey: POZİTİF (sonra)
const REMINDER_OFFSETS = [-24, -48, -72]; // 1/2/3 gün önce
const SURVEY_OFFSETS = [24, 48]; // 1/2 gün sonra

type EventType = "tour_reminder" | "feedback_survey";

interface ApprovedTemplate {
  id: string;
  template_key: string;
  language: string;
  subject: string | null;
  meta_status: string | null;
  is_active: boolean;
}

interface EventMatching {
  event_type: EventType;
  template_key: string;
  language: string;
  offset_hours: number;
  enabled: boolean;
}

// registration_passengers ve agency_event_templates types.ts'te yok — cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface AutomatedNotificationsTabProps {
  /** Üst-seviye Şablonlar sekmesine geçiş için (acentenin templates'i yoksa yönlendirme) */
  onGoToTemplates?: () => void;
  /** Meta sync sonrası artan sinyal — onaylı-şablon listesini tazeler. */
  reloadSignal?: number;
}

export default function AutomatedNotificationsTab({
  onGoToTemplates,
  reloadSignal = 0,
}: AutomatedNotificationsTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [agencyId, setAgencyId] = useState<string>("");
  const [planFeatures, setPlanFeatures] = useState<PlanFeatures | null>(null);
  const [approvedTemplates, setApprovedTemplates] = useState<ApprovedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingReminder, setSavingReminder] = useState(false);
  const [savingSurvey, setSavingSurvey] = useState(false);

  // Reminder (tour_reminder) — tek state olarak grupla (en az 1 dil eşleştirme bekleniyor)
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderOffset, setReminderOffset] = useState<number>(-72);
  // Dil → template_key map. Boş string = "seçilmedi" (kaydedilirken filtrelenir).
  const [reminderTemplates, setReminderTemplates] = useState<Record<string, string>>({});

  // Survey (feedback_survey)
  const [surveyEnabled, setSurveyEnabled] = useState(false);
  const [surveyOffset, setSurveyOffset] = useState<number>(24);
  const [surveyTemplates, setSurveyTemplates] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAll();
    // reloadSignal artınca (Meta sync sonrası) onaylı-şablon listesi tazelenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadSignal]);

  async function loadAll() {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Acente + plan
      const { data: agency, error: agencyErr } = await supabase
        .from("agencies")
        .select("id, plan_type")
        .eq("user_id", user.id)
        .maybeSingle();
      if (agencyErr || !agency) return;
      setAgencyId(agency.id);

      const features = await getPlanFeatures(agency.plan_type || "starter");
      setPlanFeatures(features);

      // Approved templates (APPROVED + is_active)
      const { data: templates, error: tplErr } = await db
        .from("message_templates")
        .select("id, template_key, language, subject, meta_status, is_active")
        .eq("agency_id", agency.id)
        .eq("is_active", true)
        .eq("meta_status", "APPROVED");
      if (tplErr) {
        console.error("[automatedNotifications] templates load:", tplErr);
      }
      setApprovedTemplates((templates as ApprovedTemplate[]) || []);

      // Mevcut eşleştirmeler
      const { data: existing, error: matchErr } = await db
        .from("agency_event_templates")
        .select("event_type, template_key, language, offset_hours, enabled")
        .eq("agency_id", agency.id);
      if (matchErr) {
        console.error("[automatedNotifications] matchings load:", matchErr);
      }

      const matches = (existing as EventMatching[]) || [];

      // Tour reminders — enabled/offset tek (ilk satırdan al, hepsi aynı olmalı), template_key dile göre map
      const reminders = matches.filter((m) => m.event_type === "tour_reminder");
      if (reminders.length > 0) {
        setReminderEnabled(reminders[0].enabled);
        setReminderOffset(reminders[0].offset_hours);
        const tmplMap: Record<string, string> = {};
        for (const r of reminders) tmplMap[r.language] = r.template_key;
        setReminderTemplates(tmplMap);
      }

      const surveys = matches.filter((m) => m.event_type === "feedback_survey");
      if (surveys.length > 0) {
        setSurveyEnabled(surveys[0].enabled);
        setSurveyOffset(surveys[0].offset_hours);
        const tmplMap: Record<string, string> = {};
        for (const s of surveys) tmplMap[s.language] = s.template_key;
        setSurveyTemplates(tmplMap);
      }
    } catch (err) {
      console.error("[automatedNotifications] load error:", err);
    } finally {
      setLoading(false);
    }
  }

  // Kaydet — basit upsert: önce o (agency, event_type) için satırları sil, sonra yenileri INSERT.
  async function handleSave(eventType: EventType) {
    if (!agencyId) return;
    const isReminder = eventType === "tour_reminder";
    const enabled = isReminder ? reminderEnabled : surveyEnabled;
    const offset = isReminder ? reminderOffset : surveyOffset;
    const templatesMap = isReminder ? reminderTemplates : surveyTemplates;
    const setSaving = isReminder ? setSavingReminder : setSavingSurvey;

    // Toggle açık + hiçbir dile şablon eşleştirilmemiş → engel
    const selectedRows = Object.entries(templatesMap).filter(([, tk]) => !!tk);
    if (enabled && selectedRows.length === 0) {
      toast({
        title: t("common.error"),
        description: t("admin.automatedNotifications.enabledButNoMatch", {
          defaultValue:
            "Bildirim açık ancak hiçbir dile şablon eşleştirilmemiş — kaydetmeden önce en az bir dil için şablon seçin.",
        }),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Önce sil
      const { error: delErr } = await db
        .from("agency_event_templates")
        .delete()
        .eq("agency_id", agencyId)
        .eq("event_type", eventType);
      if (delErr) throw delErr;

      // Yeni satırları INSERT (her dil için ayrı satır)
      if (selectedRows.length > 0) {
        const rows = selectedRows.map(([lang, templateKey]) => ({
          agency_id: agencyId,
          event_type: eventType,
          template_key: templateKey,
          language: lang,
          offset_hours: offset,
          enabled,
        }));
        const { error: insErr } = await db.from("agency_event_templates").insert(rows);
        if (insErr) throw insErr;
      }

      toast({
        title: t("common.success"),
        description: t("admin.automatedNotifications.saved", {
          defaultValue: "Ayarlar kaydedildi",
        }),
      });
      await loadAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[automatedNotifications] save error:", msg);
      toast({
        title: t("common.error"),
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  // Her dil için: o dilde APPROVED template'i olan diller listesi (UI'da sadece bunlar görünür)
  const languagesWithTemplates = useMemo(() => {
    return LANGUAGES.filter((lang) =>
      approvedTemplates.some((tpl) => tpl.language === lang.code),
    );
  }, [approvedTemplates]);

  const noApprovedTemplates = approvedTemplates.length === 0;
  const hasReminders = planFeatures?.has_reminders === true;
  const hasFeedback = planFeatures?.has_feedback === true;

  // İş3 (2026-07-10): eşleştirme netliği — her olay kartında özet/uyarı rozeti.
  // "sessiz-kapalı" tuzağının PANELDE görünür hali.
  const offsetLabel = (off: number) =>
    off < 0 ? `${Math.abs(off) / 24} gün önce` : `${off / 24} gün sonra`;
  const renderMatchSummary = (isReminder: boolean) => {
    const enabled = isReminder ? reminderEnabled : surveyEnabled;
    const offset = isReminder ? reminderOffset : surveyOffset;
    const tmap = isReminder ? reminderTemplates : surveyTemplates;
    const label = isReminder ? "Tur Hatırlatma" : "Tur Değerlendirme (Anket)";
    const selected = Object.entries(tmap).filter(([, tk]) => !!tk);
    if (!enabled) {
      return (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Bu bildirim <span className="font-medium">kapalı</span> — müşterilere gönderilmez.
        </div>
      );
    }
    if (selected.length === 0) {
      return (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span><span className="font-semibold">Şablon seçilmedi — bu bildirim GÖNDERİLMEZ.</span> En az bir dil için şablon seçip kaydedin.</span>
        </div>
      );
    }
    const whenWho = isReminder
      ? `Tur gününden ${offsetLabel(offset)}, o tarihte turu olan müşterilere otomatik gönderilir.`
      : `Tur bitiminden ${offsetLabel(offset)}, tura katılan müşterilere otomatik gönderilir.`;
    return (
      <div className="rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2 text-xs space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-green-700 dark:text-green-400">{label} eşleşti:</span>
          {selected.map(([lang, tk]) => (
            <Badge key={lang} variant="outline" className="text-[10px] border-green-500/40 font-mono">
              {tk} ({lang}, {offset}s, etkin)
            </Badge>
          ))}
        </div>
        <p className="text-muted-foreground">{whenWho}</p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div>
        <h2 className="text-2xl font-bold">
          {t("admin.automatedNotifications.title", {
            defaultValue: "Otomatik Bildirimler",
          })}
        </h2>
        <p className="text-muted-foreground mt-1">
          {t("admin.automatedNotifications.description", {
            defaultValue:
              "Müşterilerinize otomatik olarak tur hatırlatması ve memnuniyet anketi gönderin.",
          })}
        </p>
      </div>

      {/* Şablon yok uyarısı */}
      {noApprovedTemplates && (
        <Alert className="border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="space-y-3">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              {t("admin.automatedNotifications.noApprovedTemplates", {
                defaultValue:
                  "Henüz Meta-onaylı şablon senkronize edilmemiş. Yukarıdaki 'Şablonları Eşleştir' ile çekin — sonra dil başına şablon seçebilirsiniz. (Zamanlama ve açık/kapalı ayarını şimdiden yapabilirsiniz.)",
              })}
            </p>
            {onGoToTemplates && (
              <Button
                variant="outline"
                size="sm"
                onClick={onGoToTemplates}
                className="border-amber-500/40"
              >
                {t("admin.automatedNotifications.goToTemplates", {
                  defaultValue: "Şablonlar Sekmesine Git",
                })}
                <ArrowRight className="ms-2 h-3.5 w-3.5 rtl:rotate-180" />
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* ── 1) TUR HATIRLATMA ──────────────────────────────────────────── */}
      <Card className={!hasReminders ? "opacity-70" : ""}>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                {t("admin.automatedNotifications.tourReminder.title", {
                  defaultValue: "Tur Hatırlatma",
                })}
                <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20" variant="outline">Otomatik Bildirim</Badge>
                {!hasReminders && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Lock className="h-3 w-3" />
                    {t("admin.automatedNotifications.upgradeRequired", {
                      defaultValue: "Profesyonel paket gerekli",
                    })}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                {t("admin.automatedNotifications.tourReminder.description", {
                  defaultValue:
                    "Tur başlangıcından önce müşterilerinize otomatik hatırlatma gönderin.",
                })}
              </CardDescription>
            </div>
            <Switch
              checked={reminderEnabled}
              onCheckedChange={setReminderEnabled}
              disabled={!hasReminders}
              aria-label={t("admin.automatedNotifications.enable", { defaultValue: "Aktif" })}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Zaman */}
          <div className="space-y-1.5">
            <Label htmlFor="reminder-offset" className="text-sm">
              {t("admin.automatedNotifications.timing", { defaultValue: "Zaman" })}
            </Label>
            <Select
              value={String(reminderOffset)}
              onValueChange={(v) => setReminderOffset(Number(v))}
              disabled={!hasReminders || !reminderEnabled}
            >
              <SelectTrigger id="reminder-offset" className="w-full sm:max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_OFFSETS.map((off) => (
                  <SelectItem key={off} value={String(off)}>
                    {t(`admin.automatedNotifications.beforeTour.h${Math.abs(off)}`, {
                      defaultValue:
                        off === -24 ? "1 gün önce"
                        : off === -48 ? "2 gün önce"
                        : "3 gün önce",
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dil başına şablon */}
          {languagesWithTemplates.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">
                {t("admin.automatedNotifications.templateSelection", {
                  defaultValue: "Şablon Eşleştirmesi",
                })}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("admin.automatedNotifications.templateSelectionHelp", {
                  defaultValue:
                    "Her dil için kullanılacak şablonu seçin. Müşterinin dil tercihine göre uygun şablon gönderilir.",
                })}
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {languagesWithTemplates.map((lang) => {
                  const langTemplates = approvedTemplates.filter((tpl) => tpl.language === lang.code);
                  return (
                    <div key={lang.code} className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </Label>
                      <Select
                        value={reminderTemplates[lang.code] || ""}
                        onValueChange={(v) =>
                          setReminderTemplates({ ...reminderTemplates, [lang.code]: v })
                        }
                        disabled={!hasReminders || !reminderEnabled}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("admin.automatedNotifications.selectTemplate", {
                              defaultValue: "Şablon seçin...",
                            })}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {langTemplates.map((tpl) => (
                            <SelectItem key={tpl.id} value={tpl.template_key}>
                              {tpl.subject || tpl.template_key}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* İş3: eşleştirme özet/uyarı rozeti (kapalı / eşleşti / şablon-yok) */}
          {hasReminders && renderMatchSummary(true)}

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => handleSave("tour_reminder")}
              disabled={!hasReminders || savingReminder}
            >
              {savingReminder ? (
                <Loader2 className="h-4 w-4 me-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 me-2" />
              )}
              {t("common.save", { defaultValue: "Kaydet" })}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── 2) MEMNUNIYET ANKETİ ────────────────────────────────────────── */}
      <Card className={!hasFeedback ? "opacity-70" : ""}>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                {t("admin.automatedNotifications.feedbackSurvey.title", {
                  defaultValue: "Memnuniyet Anketi",
                })}
                <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20" variant="outline">Otomatik Bildirim</Badge>
                {!hasFeedback && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Lock className="h-3 w-3" />
                    {t("admin.automatedNotifications.upgradeRequired", {
                      defaultValue: "Profesyonel paket gerekli",
                    })}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                {t("admin.automatedNotifications.feedbackSurvey.description", {
                  defaultValue:
                    "Tur bitiminden sonra müşterilerinizden geri bildirim toplayın.",
                })}
              </CardDescription>
            </div>
            <Switch
              checked={surveyEnabled}
              onCheckedChange={setSurveyEnabled}
              disabled={!hasFeedback}
              aria-label={t("admin.automatedNotifications.enable", { defaultValue: "Aktif" })}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="survey-offset" className="text-sm">
              {t("admin.automatedNotifications.timing", { defaultValue: "Zaman" })}
            </Label>
            <Select
              value={String(surveyOffset)}
              onValueChange={(v) => setSurveyOffset(Number(v))}
              disabled={!hasFeedback || !surveyEnabled}
            >
              <SelectTrigger id="survey-offset" className="w-full sm:max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SURVEY_OFFSETS.map((off) => (
                  <SelectItem key={off} value={String(off)}>
                    {t(`admin.automatedNotifications.afterTour.h${off}`, {
                      defaultValue:
                        off === 24 ? "1 gün sonra (ertesi gün)" : "2 gün sonra",
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {languagesWithTemplates.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">
                {t("admin.automatedNotifications.templateSelection", {
                  defaultValue: "Şablon Eşleştirmesi",
                })}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("admin.automatedNotifications.templateSelectionHelp", {
                  defaultValue:
                    "Her dil için kullanılacak şablonu seçin. Müşterinin dil tercihine göre uygun şablon gönderilir.",
                })}
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {languagesWithTemplates.map((lang) => {
                  const langTemplates = approvedTemplates.filter((tpl) => tpl.language === lang.code);
                  return (
                    <div key={lang.code} className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </Label>
                      <Select
                        value={surveyTemplates[lang.code] || ""}
                        onValueChange={(v) =>
                          setSurveyTemplates({ ...surveyTemplates, [lang.code]: v })
                        }
                        disabled={!hasFeedback || !surveyEnabled}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("admin.automatedNotifications.selectTemplate", {
                              defaultValue: "Şablon seçin...",
                            })}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {langTemplates.map((tpl) => (
                            <SelectItem key={tpl.id} value={tpl.template_key}>
                              {tpl.subject || tpl.template_key}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* İş3: eşleştirme özet/uyarı rozeti */}
          {hasFeedback && renderMatchSummary(false)}

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => handleSave("feedback_survey")}
              disabled={!hasFeedback || savingSurvey}
            >
              {savingSurvey ? (
                <Loader2 className="h-4 w-4 me-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 me-2" />
              )}
              {t("common.save", { defaultValue: "Kaydet" })}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
