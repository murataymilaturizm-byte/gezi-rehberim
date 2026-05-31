import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Settings, CheckCircle2, Wifi, FileDown, Phone } from "lucide-react";
import { WhatsAppEmbeddedSignup } from "./WhatsAppEmbeddedSignup";
import { useToast } from "@/hooks/use-toast";

// NOT: Konuşma Üslubu ve E-mail Toplama buradan KALDIRILDI; AgencySettings.tsx
// component'ine (Ayarlar alt-tab'ı, accordion bölümleri) taşındı. DB davranışı
// (agencies.conversation_style + agencies.collect_email) birebir aynı; sadece
// kullanıcı arayüzündeki render konumu değişti.

export const WhatsAppSettings = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<'pending' | 'active' | 'rejected'>('pending');
  const [whatsappPhone, setWhatsappPhone] = useState<string | null>(null);
  const [webhookSubscribed, setWebhookSubscribed] = useState<boolean>(false);

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
        .select("id, whatsapp_phone_number, whatsapp_status, active, whatsapp_connected_at, meta_phone_number_id, webhook_subscribed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (agencyData) {
        setAgencyId(agencyData.id);
        const phoneNumber = agencyData.whatsapp_phone_number || "";
        const status = agencyData.whatsapp_status || "pending";
        const connectedAt = agencyData.whatsapp_connected_at;

        const configured = phoneNumber !== "" && connectedAt !== null;
        setIsConfigured(configured);
        setWhatsappStatus(status as 'pending' | 'active' | 'rejected');
        setWhatsappPhone(phoneNumber || null);
        setWebhookSubscribed((agencyData as { webhook_subscribed?: boolean }).webhook_subscribed === true);
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
          currentPhone={whatsappPhone}
          webhookSubscribed={webhookSubscribed}
          onConnected={loadWhatsAppSettings}
        />
      )}

      {/* Dikkat çekici destek bloğu — Embedded Signup'ın hemen altında.
          Bağlantı sırasında sorun yaşayan acente direkt arayabilsin. */}
      <Card className="border-2 border-primary/40 bg-gradient-to-br from-primary/5 via-orange-50/50 to-primary/5 dark:from-primary/10 dark:via-orange-950/20 dark:to-primary/10 shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/15 shrink-0">
              <Phone className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="font-semibold text-base text-foreground">
                {t("whatsapp.supportBlock.title", { defaultValue: "Desteğe mi ihtiyacınız var?" })}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("whatsapp.supportBlock.subtitle", { defaultValue: "WhatsApp bağlantısı veya başka bir konuda hemen arayın." })}
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:opacity-90 text-white shadow-md"
            >
              <a href="tel:+908502427750" className="inline-flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span className="font-semibold tabular-nums">0850 242 77 50</span>
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

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

      {/* Eski Support Section (0541 numarası) Embedded Signup altındaki yeni
          destek bloğuyla değiştirildi. POS-yok döneminde tek destek hattı: 0850 242 77 50. */}

      {/* Konuşma Üslubu ve E-mail Toplama bölümleri buradan KALDIRILDI;
          AgencySettings.tsx → "Ayarlar" sekmesindeki accordion'lara taşındı. */}
    </div>
  );
};
