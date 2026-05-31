// AgencySettings.tsx — Acente "Ayarlar" sekmesi (WhatsAppConversations alt-tab'ı).
//
// 3 bölüm Accordion (multiple, hepsi başta açık):
//   1) Bildirim Ayarları → AgencyNotificationSettings (DOKUNULMADI, olduğu gibi render)
//   2) Konuşma Üslubu     → eskiden WhatsAppSettings içindeki Card, BURAYA TAŞINDI
//   3) E-mail Toplama     → eskiden WhatsAppSettings içindeki Card, BURAYA TAŞINDI
//
// DB davranışı değişmedi — agencies.conversation_style + agencies.collect_email
// upsert mantığı WhatsAppSettings'tekiyle birebir aynı (sadece konum değişti).

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, MessageSquare, Mail, Lock, Loader2 } from "lucide-react";
import { getPlanFeatures } from "@/utils/planFeatures";
import AgencyNotificationSettings from "./AgencyNotificationSettings";

type ConversationStyle = "standart" | "kurumsal" | "dinamik" | "premium";

export default function AgencySettings() {
  const { t } = useTranslation();
  const { toast } = useToast();

  // ─── State (WhatsAppSettings.tsx'ten birebir taşındı) ──────────────────────
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [planType, setPlanType] = useState<string>("starter");
  const [availableStyles, setAvailableStyles] = useState<string[]>(["kurumsal"]);
  const [conversationStyle, setConversationStyle] =
    useState<ConversationStyle>("kurumsal");
  const [collectEmail, setCollectEmail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingStyle, setSavingStyle] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  // ─── Load (WhatsAppSettings.tsx pattern'i — agencies'ten oku) ──────────────
  useEffect(() => {
    let aborted = false;
    (async () => {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }
        const { data: agencyData, error } = await supabase
          .from("agencies")
          .select("id, conversation_style, plan_type, collect_email")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (aborted) return;
        if (agencyData) {
          setAgencyId(agencyData.id);
          const pt = agencyData.plan_type || "starter";
          setPlanType(pt);
          const features = await getPlanFeatures(pt);
          if (!aborted && features) setAvailableStyles(features.available_styles);
          if (!aborted) {
            setConversationStyle(
              (agencyData.conversation_style || "kurumsal") as ConversationStyle,
            );
            setCollectEmail((agencyData as { collect_email?: boolean }).collect_email === true);
          }
        }
      } catch (err) {
        console.error("[AgencySettings] load error:", err);
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  // ─── Konuşma Üslubu kaydet (WhatsAppSettings.handleStyleUpdate birebir) ────
  const handleStyleUpdate = async () => {
    if (!agencyId) return;
    setSavingStyle(true);
    try {
      const { error } = await supabase
        .from("agencies")
        .update({ conversation_style: conversationStyle } as never)
        .eq("id", agencyId);
      if (error) throw error;
      toast({
        title: t("common.success"),
        description: t("admin.whatsapp.settings.styleUpdateSuccess"),
      });
    } catch (err) {
      console.error("[AgencySettings] style update error:", err);
      toast({
        title: t("common.error"),
        description: t("admin.whatsapp.settings.styleUpdateError"),
        variant: "destructive",
      });
    } finally {
      setSavingStyle(false);
    }
  };

  // ─── E-mail Toplama toggle (WhatsAppSettings.handleEmailToggle birebir) ────
  const handleEmailToggle = async (checked: boolean) => {
    if (!agencyId) return;
    setSavingEmail(true);
    try {
      const { error } = await supabase
        .from("agencies")
        .update({ collect_email: checked } as never)
        .eq("id", agencyId);
      if (error) throw error;
      setCollectEmail(checked);
      toast({
        title: t("common.success"),
        description: t("admin.whatsapp.settings.emailCollectionSaved"),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[AgencySettings] email toggle error:", msg);
      toast({ title: t("common.error"), description: msg, variant: "destructive" });
    } finally {
      setSavingEmail(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  // Accordion type="multiple" + defaultValue=boş dizi → hepsi başta KAPALI.
  // Kullanıcı ilgilendiği bölümü kendisi açar; birden fazla bölüm aynı anda
  // açık kalabilir (multiple). Sayfa yenilenince yine hepsi kapalı.
  return (
    <Accordion
      type="multiple"
      defaultValue={[]}
      className="space-y-3"
    >
      {/* ── 1) Bildirim Ayarları ───────────────────────────────────────── */}
      <AccordionItem
        value="notifications"
        className="border rounded-lg bg-card overflow-hidden"
      >
        <AccordionTrigger className="px-4 hover:no-underline">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Bell className="h-4 w-4 text-primary" />
            {t("agency.notifications.title", { defaultValue: "Bildirim Ayarları" })}
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <AgencyNotificationSettings />
        </AccordionContent>
      </AccordionItem>

      {/* ── 2) Konuşma Üslubu (WhatsAppSettings'ten taşındı) ────────────── */}
      <AccordionItem
        value="style"
        className="border rounded-lg bg-card overflow-hidden"
      >
        <AccordionTrigger className="px-4 hover:no-underline">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="h-4 w-4 text-primary" />
            {t("admin.whatsapp.settings.styleTitle", { defaultValue: "Konuşma Üslubu" })}
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("admin.whatsapp.settings.styleDescription")}
          </p>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="agency-settings-conversation-style">
                    {t("admin.whatsapp.settings.conversationStyle")}
                  </Label>
                  {planType === "starter" && (
                    <Badge variant="outline" className="text-xs">
                      <Lock className="w-3 h-3 mr-1" />
                      {t("admin.whatsapp.settings.upgradeForStyles")}
                    </Badge>
                  )}
                </div>
                <Select
                  value={conversationStyle}
                  onValueChange={(v: ConversationStyle) => setConversationStyle(v)}
                >
                  <SelectTrigger id="agency-settings-conversation-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kurumsal">
                      <div className="flex items-center gap-2">
                        <span>👔</span>
                        <span>{t("admin.whatsapp.settings.style.kurumsal")}</span>
                      </div>
                    </SelectItem>
                    <SelectItem
                      value="standart"
                      disabled={!availableStyles.includes("standart")}
                    >
                      <div className="flex items-center gap-2">
                        <span>🤝</span>
                        <span>{t("admin.whatsapp.settings.style.standart")}</span>
                        {!availableStyles.includes("standart") && (
                          <Lock className="w-3 h-3 ml-1" />
                        )}
                      </div>
                    </SelectItem>
                    <SelectItem
                      value="dinamik"
                      disabled={!availableStyles.includes("dinamik")}
                    >
                      <div className="flex items-center gap-2">
                        <span>⚡</span>
                        <span>{t("admin.whatsapp.settings.style.dinamik")}</span>
                        {!availableStyles.includes("dinamik") && (
                          <Lock className="w-3 h-3 ml-1" />
                        )}
                      </div>
                    </SelectItem>
                    <SelectItem
                      value="premium"
                      disabled={!availableStyles.includes("premium")}
                    >
                      <div className="flex items-center gap-2">
                        <span>💎</span>
                        <span>{t("admin.whatsapp.settings.style.premium")}</span>
                        {!availableStyles.includes("premium") && (
                          <Lock className="w-3 h-3 ml-1" />
                        )}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {t("admin.whatsapp.settings.conversationStyleHelp")}
                </p>
              </div>
              <Button
                onClick={handleStyleUpdate}
                disabled={savingStyle || !agencyId}
                className="w-full"
              >
                {savingStyle
                  ? t("admin.whatsapp.settings.saving")
                  : t("admin.whatsapp.settings.updateStyle")}
              </Button>
            </>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* ── 3) E-mail Toplama (WhatsAppSettings'ten taşındı) ────────────── */}
      <AccordionItem
        value="email"
        className="border rounded-lg bg-card overflow-hidden"
      >
        <AccordionTrigger className="px-4 hover:no-underline">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Mail className="h-4 w-4 text-primary" />
            {t("admin.whatsapp.settings.emailCollectionTitle", {
              defaultValue: "E-mail Toplama",
            })}
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("admin.whatsapp.settings.emailCollectionDesc")}
          </p>
          <div className="flex items-center justify-between gap-4 rounded-md border p-3">
            <Label className="font-medium cursor-pointer">
              {t("admin.whatsapp.settings.emailCollectionToggle")}
            </Label>
            <Switch
              checked={collectEmail}
              onCheckedChange={handleEmailToggle}
              disabled={savingEmail || loading || !agencyId}
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
