import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const SuperAdminTwilioSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [showAccountSid, setShowAccountSid] = useState(false);
  
  const [formData, setFormData] = useState({
    account_sid: "",
    auth_token: "",
    phone_number: ""
  });

  useEffect(() => {
    loadTwilioSecrets();
  }, []);

  const loadTwilioSecrets = async () => {
    setLoading(true);
    try {
      // Get current values from environment (they're already set as secrets)
      const accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID || "";
      const authToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN || "";
      const phoneNumber = import.meta.env.VITE_TWILIO_PHONE_NUMBER || "";
      
      setFormData({
        account_sid: accountSid ? "AC" + "*".repeat(30) : "",
        auth_token: authToken ? "*".repeat(32) : "",
        phone_number: phoneNumber
      });
    } catch (error) {
      console.error("Error loading Twilio settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    toast({
      title: "Bilgi",
      description: "Twilio ayarları Supabase secrets olarak saklanır. Güncelleme için Secrets yönetim panelini kullanın.",
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Merkezi Twilio Ayarları
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Yükleniyor...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Merkezi Twilio Ayarları
        </CardTitle>
        <CardDescription>
          Tüm acenteler için kullanılan merkezi Twilio hesap bilgileri
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Bu ayarlar tüm sistem için geçerlidir. Değişiklikler Supabase Edge Functions secrets üzerinden yapılmalıdır:
            <ul className="mt-2 space-y-1">
              <li>• TWILIO_ACCOUNT_SID</li>
              <li>• TWILIO_AUTH_TOKEN</li>
              <li>• TWILIO_PHONE_NUMBER</li>
            </ul>
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account_sid">
              Account SID
            </Label>
            <div className="relative">
              <Input
                id="account_sid"
                type={showAccountSid ? "text" : "password"}
                value={formData.account_sid}
                readOnly
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowAccountSid(!showAccountSid)}
              >
                {showAccountSid ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth_token">
              Auth Token
            </Label>
            <div className="relative">
              <Input
                id="auth_token"
                type={showAuthToken ? "text" : "password"}
                value={formData.auth_token}
                readOnly
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowAuthToken(!showAuthToken)}
              >
                {showAuthToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone_number">
              Twilio Phone Number (opsiyonel)
            </Label>
            <Input
              id="phone_number"
              value={formData.phone_number}
              readOnly
              placeholder="Henüz ayarlanmadı"
            />
          </div>
        </form>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">📝 Not</h4>
          <p className="text-sm text-muted-foreground">
            Merkezi Twilio ayarları değiştirildiğinde, tüm acentelerin WhatsApp mesajları bu hesap üzerinden gönderilir.
            Her acente kendi WhatsApp Business numarasını ayarlar menüsünden ekler.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
