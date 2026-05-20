import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { Settings, CheckCircle2, MessageSquare, Lock, Wifi, FileDown, Phone, Mail } from "lucide-react";
import { WhatsAppEmbeddedSignup } from "./WhatsAppEmbeddedSignup";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPlanFeatures } from "@/utils/planFeatures";

export const WhatsAppSettings = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<'pending' | 'active' | 'rejected'>('pending');
  const [planType, setPlanType] = useState<string>('starter');
  const [availableStyles, setAvailableStyles] = useState<string[]>(['kurumsal']);

  const [formData, setFormData] = useState({
    conversation_style: "kurumsal" as 'standart' | 'kurumsal' | 'dinamik' | 'premium'
  });

  const [collectEmail, setCollectEmail] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    loadWhatsAppSettings();
  }, []);

  const loadWhatsAppSettings = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agencyData, error } = await supabase
        .from("agencies")
        .select("id, whatsapp_phone_number, whatsapp_status, active, conversation_style, plan_type, whatsapp_connected_at, meta_phone_number_id, collect_email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (agencyData) {
        setAgencyId(agencyData.id);
        const currentPlanType = agencyData.plan_type || 'starter';
        setPlanType(currentPlanType);
        
        const features = await getPlanFeatures(currentPlanType);
        if (features) {
          setAvailableStyles(features.available_styles);
        }
        
        const phoneNumber = agencyData.whatsapp_phone_number || "";
        const status = agencyData.whatsapp_status || "pending";
        const connectedAt = agencyData.whatsapp_connected_at;
        
        const configured = phoneNumber !== "" && connectedAt !== null;
        setIsConfigured(configured);
        setWhatsappStatus(status as 'pending' | 'active' | 'rejected');

        setFormData({
          conversation_style: (agencyData.conversation_style || 'kurumsal') as 'standart' | 'kurumsal' | 'dinamik' | 'premium'
        });
        setCollectEmail((agencyData as any).collect_email === true);
      }
    } catch (error) {
      console.error("Error loading WhatsApp settings:", error);
      toast({
        title: t("common.error"),
        description: t("admin.whatsapp.settings.loadError"),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailToggle = async (checked: boolean) => {
    if (!agencyId) return;
    setSavingEmail(true);
    try {
      const { error } = await supabase
        .from("agencies")
        .update({ collect_email: checked } as any)
        .eq("id", agencyId);
      if (error) throw error;
      setCollectEmail(checked);
      toast({ title: t("common.success"), description: t("admin.whatsapp.settings.emailCollectionSaved") });
    } catch (err: any) {
      console.error("Email toggle error:", err);
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setSavingEmail(false);
    }
  };

  const handleStyleUpdate = async () => {
    if (!agencyId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("agencies")
        .update({ conversation_style: formData.conversation_style } as any)
        .eq("id", agencyId);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("admin.whatsapp.settings.styleUpdateSuccess"),
      });

      await loadWhatsAppSettings();
    } catch (error: any) {
      console.error("Style update error:", error);
      toast({
        title: t("common.error"),
        description: t("admin.whatsapp.settings.styleUpdateError"),
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t("admin.whatsapp.settings.cardTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>{t("common.loading")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Embedded Signup - Primary Connection Method */}
      {agencyId && (
        <WhatsAppEmbeddedSignup
          agencyId={agencyId}
          currentStatus={whatsappStatus}
          currentPhone={null}
          onConnected={loadWhatsAppSettings}
        />
      )}

      {/* Connection Info - when active */}
      {isConfigured && whatsappStatus === 'active' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              {t("whatsapp.connectionInfo.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="border-primary/30 bg-primary/5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription>
                ✅ {t("whatsapp.connectionInfo.active")}
              </AlertDescription>
            </Alert>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-sm mb-2">{t("whatsapp.connectionInfo.importantNotes")}</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• {t("whatsapp.connectionInfo.rule24h")}</li>
                <li>• {t("whatsapp.connectionInfo.autoManaged")}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PDF Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            {t("whatsapp.guide.title")}
          </CardTitle>
          <CardDescription>
            {t("whatsapp.guide.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href="/docs/whatsapp_embedded_signup_rehberi.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="w-full">
              <FileDown className="mr-2 h-4 w-4" />
              {t("whatsapp.guide.downloadPdf")}
            </Button>
          </a>
        </CardContent>
      </Card>

      {/* Support Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            {t("whatsapp.support.title")}
          </CardTitle>
          <CardDescription>
            {t("whatsapp.support.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
            <Phone className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold">0541 650 03 03</p>
              <p className="text-sm text-muted-foreground">{t("whatsapp.support.contactNote")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversation Style Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t("admin.whatsapp.settings.styleTitle")}
          </CardTitle>
          <CardDescription>
            {t("admin.whatsapp.settings.styleDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="conversation_style">
                {t("admin.whatsapp.settings.conversationStyle")}
              </Label>
              {planType === 'starter' && (
                <Badge variant="outline" className="text-xs">
                  <Lock className="w-3 h-3 mr-1" />
                  {t("admin.whatsapp.settings.upgradeForStyles")}
                </Badge>
              )}
            </div>
            <Select
              value={formData.conversation_style}
              onValueChange={(value: 'standart' | 'kurumsal' | 'dinamik' | 'premium') =>
                setFormData({ ...formData, conversation_style: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kurumsal">
                  <div className="flex items-center gap-2">
                    <span>👔</span>
                    <span>{t("admin.whatsapp.settings.style.kurumsal")}</span>
                  </div>
                </SelectItem>
                <SelectItem value="standart" disabled={!availableStyles.includes('standart')}>
                  <div className="flex items-center gap-2">
                    <span>🤝</span>
                    <span>{t("admin.whatsapp.settings.style.standart")}</span>
                    {!availableStyles.includes('standart') && <Lock className="w-3 h-3 ml-1" />}
                  </div>
                </SelectItem>
                <SelectItem value="dinamik" disabled={!availableStyles.includes('dinamik')}>
                  <div className="flex items-center gap-2">
                    <span>⚡</span>
                    <span>{t("admin.whatsapp.settings.style.dinamik")}</span>
                    {!availableStyles.includes('dinamik') && <Lock className="w-3 h-3 ml-1" />}
                  </div>
                </SelectItem>
                <SelectItem value="premium" disabled={!availableStyles.includes('premium')}>
                  <div className="flex items-center gap-2">
                    <span>💎</span>
                    <span>{t("admin.whatsapp.settings.style.premium")}</span>
                    {!availableStyles.includes('premium') && <Lock className="w-3 h-3 ml-1" />}
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
            disabled={saving}
            className="w-full"
          >
            {saving ? t("admin.whatsapp.settings.saving") : t("admin.whatsapp.settings.updateStyle")}
          </Button>
        </CardContent>
      </Card>

      {/* Email Toplama */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t("admin.whatsapp.settings.emailCollectionTitle")}
          </CardTitle>
          <CardDescription>
            {t("admin.whatsapp.settings.emailCollectionDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label className="font-medium">
                {t("admin.whatsapp.settings.emailCollectionToggle")}
              </Label>
            </div>
            <Switch
              checked={collectEmail}
              onCheckedChange={handleEmailToggle}
              disabled={savingEmail || loading}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
