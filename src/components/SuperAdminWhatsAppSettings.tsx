import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Settings, AlertCircle, CheckCircle2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SuperAdminWhatsAppSettingsProps {
  isSuperAdmin?: boolean;
}

export const SuperAdminWhatsAppSettings = ({ isSuperAdmin = false }: SuperAdminWhatsAppSettingsProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestMessage = async () => {
    if (!testPhone) {
      toast({
        title: t("common.error"),
        description: t("superAdmin.whatsapp.phoneRequired"),
        variant: "destructive",
      });
      return;
    }

    setTestSending(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-webhook", {
        body: {
          testMode: true,
          testPhone: testPhone.replace('+', '').trim(),
          testMessage: "🧪 Bu bir test mesajıdır. TURZZ AI WhatsApp entegrasyonu başarıyla çalışıyor! ✅"
        }
      });

      if (error) throw error;

      setTestResult({
        success: true,
        message: `✅ Test mesajı başarıyla gönderildi! (${testPhone})`
      });

      toast({
        title: t("common.success"),
        description: t("superAdmin.whatsapp.testSuccess"),
      });
    } catch (error: any) {
      console.error("Test message error:", error);
      setTestResult({
        success: false,
        message: `❌ Hata: ${error.message || 'Bilinmeyen hata'}`
      });

      toast({
        title: t("common.error"),
        description: t("superAdmin.whatsapp.testError"),
        variant: "destructive",
      });
    } finally {
      setTestSending(false);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t("superAdmin.whatsapp.title")}
          </CardTitle>
          <CardDescription>
            {t("superAdmin.whatsapp.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              WhatsApp entegrasyonu Meta Cloud API üzerinden çalışmaktadır. Global kimlik bilgileri
              Supabase Secrets'ta yapılandırılmıştır.
              <ul className="mt-2 space-y-1">
                <li>• <strong>WHATSAPP_PHONE_NUMBER_ID</strong> - Meta Phone Number ID</li>
                <li>• <strong>WHATSAPP_ACCESS_TOKEN</strong> - Meta Access Token</li>
                <li>• <strong>WHATSAPP_BUSINESS_ACCOUNT_ID</strong> - WABA ID</li>
                <li>• <strong>WHATSAPP_VERIFY_TOKEN</strong> - Webhook doğrulama token'ı</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">📋 Durum</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-500">Aktif</Badge>
                  <span className="text-sm">Meta Cloud API Bağlantısı</span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Webhook URL: <code className="text-xs bg-background px-1 rounded">https://ncuswacwpqcxhmlhvfgq.supabase.co/functions/v1/whatsapp-webhook</code></p>
                  <p>• API Versiyonu: v18.0</p>
                  <p>• Şu anda tüm acenteler global token kullanıyor</p>
                  <p>• İleride her acente kendi token'ına sahip olacak (Embedded Signup)</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">📝 Önemli Notlar</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Telefon numaraları "+" olmadan, ülke kodu ile başlar: 905xxxxxxxxx</li>
                <li>• 24 saat kuralı: Son mesajdan 24 saat geçtiyse template mesajı gönderin</li>
                <li>• Access Token'ın süresi dolabilir - yenilemek gerekebilir</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Message Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Test Mesajı Gönder
          </CardTitle>
          <CardDescription>
            Meta Cloud API bağlantısını test etmek için bir mesaj gönderin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test_phone">{t("superAdmin.whatsapp.testPhone")}</Label>
            <Input
              id="test_phone"
              placeholder="905551234567"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Ülke kodu ile başlayan numara (+ işareti olmadan)
            </p>
          </div>

          <Button
            onClick={handleTestMessage}
            disabled={testSending || !testPhone}
            className="w-full"
          >
            {testSending ? t("superAdmin.whatsapp.testSending") : t("superAdmin.whatsapp.testButton")}
          </Button>

          {testResult && (
            <Alert className={testResult.success ? "border-green-500/50 bg-green-500/10" : "border-destructive/50 bg-destructive/10"}>
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              <AlertDescription className={testResult.success ? "text-green-600" : "text-destructive"}>
                {testResult.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
