import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const twilioSchema = z.object({
  twilio_account_sid: z.string()
    .trim()
    .min(34, { message: "Account SID 34 karakter olmalıdır" })
    .max(34, { message: "Account SID 34 karakter olmalıdır" })
    .startsWith("AC", { message: "Account SID 'AC' ile başlamalıdır" }),
  twilio_auth_token: z.string()
    .trim()
    .min(32, { message: "Auth Token en az 32 karakter olmalıdır" })
    .max(64, { message: "Auth Token en fazla 64 karakter olabilir" }),
  twilio_phone_number: z.string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, { message: "Geçerli bir telefon numarası girin (örn: +14155238886)" })
});

export const TwilioSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  
  const [formData, setFormData] = useState({
    twilio_account_sid: "",
    twilio_auth_token: "",
    twilio_phone_number: ""
  });

  useEffect(() => {
    loadTwilioSettings();
  }, []);

  const loadTwilioSettings = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agencyData, error } = await supabase
        .from("agencies")
        .select("id, twilio_account_sid, twilio_auth_token, twilio_phone_number, active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (agencyData) {
        setAgencyId(agencyData.id);
        
        // Check if Twilio is configured (not temp values)
        const isConfigured = 
          agencyData.twilio_account_sid !== "TEMP_SID" &&
          agencyData.twilio_auth_token !== "TEMP_TOKEN" &&
          agencyData.twilio_phone_number !== "TEMP_PHONE";
        
        setIsConfigured(isConfigured);

        if (isConfigured) {
          setFormData({
            twilio_account_sid: agencyData.twilio_account_sid || "",
            twilio_auth_token: agencyData.twilio_auth_token || "",
            twilio_phone_number: agencyData.twilio_phone_number || ""
          });
        }
      }
    } catch (error) {
      console.error("Error loading Twilio settings:", error);
      toast({
        title: "Hata",
        description: "Twilio ayarları yüklenemedi",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    const validation = twilioSchema.safeParse(formData);
    if (!validation.success) {
      toast({
        title: "Hata",
        description: validation.error.errors[0].message,
        variant: "destructive"
      });
      return;
    }

    if (!agencyId) {
      toast({
        title: "Hata",
        description: "Acente bilgisi bulunamadı",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("agencies")
        .update({
          twilio_account_sid: formData.twilio_account_sid.trim(),
          twilio_auth_token: formData.twilio_auth_token.trim(),
          twilio_phone_number: formData.twilio_phone_number.trim(),
          active: true // Activate agency after Twilio is configured
        })
        .eq("id", agencyId);

      if (error) throw error;

      setIsConfigured(true);

      toast({
        title: "Başarılı! ✅",
        description: "Twilio ayarları güncellendi ve WhatsApp servisi aktif edildi",
      });
    } catch (error: any) {
      console.error("Error saving Twilio settings:", error);
      toast({
        title: "Hata",
        description: error.message || "Ayarlar kaydedilemedi",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const maskAuthToken = (token: string) => {
    if (token.length < 8) return token;
    return token.substring(0, 4) + "•".repeat(token.length - 8) + token.substring(token.length - 4);
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Twilio WhatsApp Ayarları</CardTitle>
            <CardDescription>
              WhatsApp Business API için Twilio bilgilerinizi yapılandırın
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!isConfigured && (
          <Alert className="mb-6 border-primary/50 bg-primary/5">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <strong>Önemli:</strong> WhatsApp servisinin çalışması için Twilio ayarlarınızı yapmanız gerekmektedir.
              Twilio hesabınız yoksa{" "}
              <a 
                href="https://www.twilio.com/try-twilio" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                buradan ücretsiz hesap oluşturabilirsiniz
              </a>.
            </AlertDescription>
          </Alert>
        )}

        {isConfigured && (
          <Alert className="mb-6 border-green-500/50 bg-green-500/5">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-sm text-green-900 dark:text-green-100">
              <strong>WhatsApp servisi aktif!</strong> Twilio ayarlarınız yapılandırılmış ve sistem çalışıyor.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="twilio_account_sid">
                Twilio Account SID
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input
                id="twilio_account_sid"
                value={formData.twilio_account_sid}
                onChange={(e) => setFormData({ ...formData, twilio_account_sid: e.target.value })}
                placeholder="AC... ile başlayan 34 karakterlik SID"
                required
                disabled={saving}
                maxLength={34}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Twilio Console → Account Info bölümünden bulabilirsiniz
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="twilio_auth_token">
                Twilio Auth Token
                <span className="text-destructive ml-1">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="twilio_auth_token"
                  type={showAuthToken ? "text" : "password"}
                  value={formData.twilio_auth_token}
                  onChange={(e) => setFormData({ ...formData, twilio_auth_token: e.target.value })}
                  placeholder="32 karakterlik auth token"
                  required
                  disabled={saving}
                  maxLength={64}
                  className="font-mono text-sm pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowAuthToken(!showAuthToken)}
                  disabled={saving}
                >
                  {showAuthToken ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Twilio Console → Account Info bölümünden bulabilirsiniz
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="twilio_phone_number">
                Twilio WhatsApp Phone Number
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input
                id="twilio_phone_number"
                value={formData.twilio_phone_number}
                onChange={(e) => setFormData({ ...formData, twilio_phone_number: e.target.value })}
                placeholder="+14155238886"
                required
                disabled={saving}
                maxLength={16}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Twilio Console → WhatsApp Senders bölümünden bulabilirsiniz. Mutlaka + ile başlamalıdır.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Kurulum Desteği
                </p>
                <p className="text-xs text-muted-foreground">
                  Detaylı kurulum rehberi için{" "}
                  <a 
                    href="/WHATSAPP_SETUP.md" 
                    target="_blank"
                    className="text-primary hover:underline"
                  >
                    tıklayın
                  </a>
                </p>
              </div>
              <Button
                type="submit"
                disabled={saving}
                className="bg-gradient-ocean hover:opacity-90"
              >
                {saving ? "Kaydediliyor..." : isConfigured ? "Ayarları Güncelle" : "Kaydet ve Aktifleştir"}
              </Button>
            </div>
          </div>
        </form>

        {isConfigured && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">WhatsApp Servisi Aktif</p>
                <p className="text-muted-foreground">
                  Müşterileriniz artık {formData.twilio_phone_number} numarasından WhatsApp üzerinden
                  size ulaşabilir ve otomatik yanıt alabilir.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
