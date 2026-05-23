import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2, Loader2, MessageSquare, Smartphone, Unplug, Wrench } from "lucide-react";

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
  webhookSubscribed?: boolean;
  onConnected: () => void;
}

export function WhatsAppEmbeddedSignup({
  agencyId,
  currentStatus,
  currentPhone,
  webhookSubscribed = true,
  onConnected,
}: EmbeddedSignupProps) {
  const [loading, setLoading] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [appId, setAppId] = useState<string>("");
  const [configId, setConfigId] = useState<string>("");
  const [configError, setConfigError] = useState<string | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [needsPin, setNeedsPin] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Bağlı: status aktif VEYA telefon numarası var
  const isConnected = currentStatus === "active" || !!currentPhone;

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
        title: t("whatsapp.connect.errorTitle"),
        description: t("whatsapp.connect.sdkError"),
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
            title: t("whatsapp.connect.cancelled"),
            description: t("whatsapp.connect.cancelledDesc"),
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
  }, [sdkLoaded, configId, agencyId, t]);

  const exchangeToken = async (code: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("meta-embedded-signup", {
        body: { action: "exchange-token", code, agencyId },
      });

      if (error) throw error;

      // L2: Edge function 409 errorCode="DUPLICATE_PHONE_NUMBER" dönerse → i18n localized toast.
      // Çift güvenlik: hem invoke 'data' ile döner (success:false), hem network 'error' yoluyla
      // (Supabase functions invoke 2xx olmayan response'ları error olarak parse edebilir).
      if (data?.errorCode === "DUPLICATE_PHONE_NUMBER") {
        const _names = Array.isArray(data?.conflictAgencies)
          ? data.conflictAgencies.map((a: any) => a?.name).filter(Boolean).join(", ")
          : "";
        toast({
          title: t("whatsapp.connect.errorTitle"),
          description: _names
            ? t("whatsapp.connect.duplicatePhoneNumberWithName", { names: _names })
            : t("whatsapp.connect.duplicatePhoneNumber"),
          variant: "destructive",
          duration: 10000,  // Uzun süreli — kullanıcı diğer acente adını okuyabilsin
        });
        setLoading(false);
        return;
      }

      if (!data?.success) throw new Error(data?.error || "Connection failed");

      if (data.needsManualPin) {
        setNeedsPin(true);
        toast({
          title: t("whatsapp.pin.required"),
          description: t("whatsapp.pin.description"),
        });
      } else if (data.registerStatus === "success" || data.registerStatus === "already_registered") {
        toast({
          title: t("whatsapp.connect.success"),
          description: data.phoneNumber
            ? t("whatsapp.connect.successDescPhone", { phone: data.phoneNumber })
            : t("whatsapp.connect.successDesc"),
        });
        onConnected();
      } else {
        // register failed ama bağlantı kuruldu — uyarı göster
        toast({
          title: t("whatsapp.connect.success"),
          description: t("whatsapp.connect.partialSuccess"),
        });
        onConnected();
      }
    } catch (err: any) {
      console.error("Token exchange error:", err);
      toast({
        title: t("whatsapp.connect.errorTitle"),
        description: t("whatsapp.connect.exchangeError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async () => {
    if (!/^\d{6}$/.test(pinValue)) {
      toast({
        title: t("whatsapp.connect.errorTitle"),
        description: t("whatsapp.pin.invalidLength"),
        variant: "destructive",
      });
      return;
    }

    setPinSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-embedded-signup", {
        body: { action: "register-with-pin", agencyId, pin: pinValue },
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: t("whatsapp.pin.success") });
        setNeedsPin(false);
        setPinValue("");
        onConnected();
      } else {
        toast({
          title: t("whatsapp.connect.errorTitle"),
          description: data?.error || t("whatsapp.pin.failed"),
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: t("whatsapp.connect.errorTitle"),
        description: t("whatsapp.pin.failed"),
        variant: "destructive",
      });
    } finally {
      setPinSubmitting(false);
    }
  };

  const handleRepair = async () => {
    setRepairing(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-embedded-signup", {
        body: { action: "repair-subscription", agencyId },
      });
      if (error) throw error;

      if (data?.subscribed) {
        toast({ title: t("whatsapp.repair.success") });
        onConnected();
      } else {
        toast({
          title: t("whatsapp.connect.errorTitle"),
          description: t("whatsapp.repair.failed"),
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: t("whatsapp.connect.errorTitle"),
        description: t("whatsapp.repair.failed"),
        variant: "destructive",
      });
    } finally {
      setRepairing(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke("meta-embedded-signup", {
        body: { action: "disconnect", agencyId },
      });

      if (error) throw error;

      toast({
        title: t("common.successTitle"),
        description: t("whatsapp.disconnect.success"),
      });
      setDisconnectOpen(false);
      onConnected();
    } catch (err: any) {
      console.error("Disconnect error:", err);
      toast({
        title: t("common.error"),
        description: t("whatsapp.disconnect.error"),
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t("whatsapp.connect.cardTitle")}
          </CardTitle>
          <CardDescription>
            {t("whatsapp.connect.cardDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected ? (
            /* ── BAĞLI DURUM ── */
            <>
              <Alert className="border-green-500/50 bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-600">
                  <span className="font-medium">{t("whatsapp.connect.activeTitle")}</span>
                  <br />
                  <span className="text-sm">
                    {t("whatsapp.connect.activeNumber")}: {currentPhone || t("whatsapp.connect.numberConnected")}
                  </span>
                </AlertDescription>
              </Alert>

              {/* Webhook bağlantısı bozuksa onarım uyarısı */}
              {!webhookSubscribed && (
                <Alert className="border-amber-500/50 bg-amber-500/5">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-amber-700 dark:text-amber-400">
                    <span className="font-medium block mb-2">{t("whatsapp.repair.needed")}</span>
                    <Button
                      size="sm"
                      onClick={handleRepair}
                      disabled={repairing}
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      {repairing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Wrench className="h-4 w-4 mr-2" />
                      )}
                      {t("whatsapp.repair.button")}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between">
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {t("whatsapp.connect.connected")}
                </Badge>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisconnectOpen(true)}
                  disabled={loading}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Unplug className="h-4 w-4 mr-2" />
                  {t("whatsapp.connect.disconnect")}
                </Button>
              </div>
            </>
          ) : (
            /* ── BAĞLI DEĞİL DURUM ── */
            <>
              <div className="rounded-lg border border-dashed p-6 text-center space-y-4">
                <Smartphone className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h4 className="font-semibold">{t("whatsapp.connect.h4Title")}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("whatsapp.connect.h4Desc")}
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
                      ? t("whatsapp.connect.connecting")
                      : !sdkLoaded
                        ? t("whatsapp.sdkLoading")
                        : t("whatsapp.connectButton")}
                  </Button>
                )}
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>{t("whatsapp.connect.note")}</p>
                <p>{t("whatsapp.connect.security")}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* PIN doğrulama formu */}
      {needsPin && (
        <Card className="border-orange-500/40 bg-orange-500/5">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <h4 className="font-semibold">{t("whatsapp.pin.title")}</h4>
            </div>
            <p className="text-sm text-muted-foreground">{t("whatsapp.pin.description")}</p>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="font-mono text-center text-lg tracking-widest max-w-[140px]"
              />
              <Button
                onClick={handlePinSubmit}
                disabled={pinValue.length !== 6 || pinSubmitting}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {pinSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("whatsapp.pin.submit")
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disconnect onay dialog'u */}
      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("whatsapp.disconnect.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("whatsapp.disconnect.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {disconnecting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("whatsapp.disconnect.disconnecting")}</>
              ) : (
                t("whatsapp.disconnect.confirm")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
