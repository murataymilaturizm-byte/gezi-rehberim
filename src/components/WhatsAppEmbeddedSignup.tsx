import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, Loader2, MessageSquare, Smartphone, Unlink } from "lucide-react";

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

interface EmbeddedSignupProps {
  agencyId: string;
  currentStatus: string | null;
  currentPhone: string | null;
  onConnected: () => void;
}

export function WhatsAppEmbeddedSignup({
  agencyId,
  currentStatus,
  currentPhone,
  onConnected,
}: EmbeddedSignupProps) {
  const [loading, setLoading] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [appId, setAppId] = useState<string>("");
  const [configId, setConfigId] = useState<string>("");
  const [configError, setConfigError] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  const isConnected = currentStatus === "active" && currentPhone;

  // Load Meta config from edge function
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase.functions.invoke("meta-embedded-signup", {
          body: { action: "get-config" },
        });

        if (error || !data?.appId) {
          console.error("Failed to load Meta config:", error || "No appId returned");
          setConfigError(t("whatsapp.configError"));
          return;
        }

        setAppId(data.appId);
        setConfigId(data.configId || "");
        setConfigError(null);
      } catch (err) {
        console.error("Failed to load Meta config:", err);
        setConfigError(t("whatsapp.configError"));
      }
    };
    loadConfig();
  }, [t]);

  // Load Facebook SDK
  useEffect(() => {
    if (!appId || sdkLoaded) return;

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: "v18.0",
      });
      setSdkLoaded(true);
    };

    if (window.FB) {
      window.FB.init({
        appId: appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: "v18.0",
      });
      setSdkLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    document.body.appendChild(script);

    return () => {
      // Cleanup not needed - SDK persists
    };
  }, [appId, sdkLoaded]);

  const handleEmbeddedSignup = useCallback(() => {
    if (!window.FB || !sdkLoaded) {
      toast({
        title: "Hata",
        description: "Facebook SDK yüklenemedi. Lütfen sayfayı yenileyin.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    window.FB.login(
      (response: any) => {
        if (response.authResponse) {
          const code = response.authResponse.code;
          exchangeToken(code);
        } else {
          console.error("[EmbeddedSignup] User cancelled or no authResponse", response);
          setLoading(false);
          toast({
            title: "İptal Edildi",
            description: "WhatsApp bağlantısı iptal edildi.",
          });
        }
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: 2,
        },
      }
    );
  }, [sdkLoaded, configId, agencyId]);

  const exchangeToken = async (code: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("meta-embedded-signup", {
        body: {
          action: "exchange-token",
          code,
          agencyId,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Başarılı! ✅",
          description: `WhatsApp numaranız başarıyla bağlandı${data.phoneNumber ? `: ${data.phoneNumber}` : ""}`,
        });
        onConnected();
      } else {
        throw new Error(data?.error || "Bağlantı başarısız");
      }
    } catch (err: any) {
      console.error("Token exchange error:", err);
      toast({
        title: "Hata",
        description: "WhatsApp bağlantısı sırasında bir hata oluştu. Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from("agencies")
        .update({
          meta_access_token: null,
          meta_phone_number_id: null,
          meta_waba_id: null,
          whatsapp_phone_number: null,
          whatsapp_status: "pending",
          whatsapp_connected_at: null,
        })
        .eq("id", agencyId);

      if (error) throw error;

      toast({
        title: "Bağlantı Kaldırıldı",
        description: "WhatsApp bağlantınız kaldırıldı.",
      });
      onConnected();
    } catch (err) {
      toast({
        title: "Hata",
        description: "Bağlantı kaldırılırken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          WhatsApp Numaranızı Bağlayın
        </CardTitle>
        <CardDescription>
          Meta Embedded Signup ile WhatsApp Business numaranızı birkaç adımda bağlayın.
          Teknik bilgi gerektirmez.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-600">
                <span className="font-medium">WhatsApp bağlantısı aktif!</span>
                <br />
                <span className="text-sm">Numara: {currentPhone}</span>
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Bağlı
              </Badge>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={loading}
              className="text-destructive hover:text-destructive"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4 mr-1" />
              )}
              Bağlantıyı Kaldır
            </Button>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-dashed p-6 text-center space-y-4">
              <Smartphone className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h4 className="font-semibold">WhatsApp Business Numaranızı Bağlayın</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Aşağıdaki butona tıklayın, Meta hesabınızla giriş yapın ve
                  WhatsApp Business numaranızı seçin. İşlem birkaç dakika sürer.
                </p>
              </div>

              {configError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{configError}</AlertDescription>
                </Alert>
              ) : (
                <Button
                  size="lg"
                  onClick={handleEmbeddedSignup}
                  disabled={loading || !sdkLoaded}
                  className="bg-[#25D366] hover:bg-[#128C7E] text-white"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <MessageSquare className="h-5 w-5 mr-2" />
                  )}
                  {loading
                    ? "Bağlanıyor..."
                    : !sdkLoaded
                      ? t("whatsapp.sdkLoading")
                      : t("whatsapp.connectButton")}
                </Button>
              )}
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                📌 <strong>Not:</strong> Bu işlem için bir Meta Business hesabınızın olması gerekir.
                Hesabınız yoksa, işlem sırasında otomatik oluşturulur.
              </p>
              <p>
                🔒 Bilgileriniz güvenli şekilde saklanır ve yalnızca WhatsApp mesajlaşma için kullanılır.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
