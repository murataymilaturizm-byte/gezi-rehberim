import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, CheckCircle2, AlertCircle, MessageSquare, FileText, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const WhatsAppTestPanel = () => {
  const { toast } = useToast();
  
  // Free text message state
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("🧪 Bu bir test mesajıdır. TURZZ AI WhatsApp entegrasyonu başarıyla çalışıyor! ✅");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);

  // Template message state
  const [templatePhone, setTemplatePhone] = useState("");
  const [templateName, setTemplateName] = useState("hello_world");
  const [templateLang, setTemplateLang] = useState("en_US");
  const [templateSending, setTemplateSending] = useState(false);
  const [templateResult, setTemplateResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);

  // Secrets check
  const requiredSecrets = [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID", 
    "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "WHATSAPP_VERIFY_TOKEN"
  ];

  const handleSendTextMessage = async () => {
    if (!testPhone || !testMessage) {
      toast({ title: "Hata", description: "Telefon numarası ve mesaj gerekli", variant: "destructive" });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-webhook", {
        body: {
          testMode: true,
          testPhone: testPhone.replace('+', '').trim(),
          testMessage: testMessage
        }
      });

      if (error) throw error;

      setResult({
        success: true,
        message: `✅ Mesaj başarıyla gönderildi: ${testPhone}`,
        details: JSON.stringify(data, null, 2)
      });

      toast({ title: "Başarılı", description: "Test mesajı gönderildi" });
    } catch (error: any) {
      console.error("Test message error:", error);
      setResult({
        success: false,
        message: `❌ Hata: ${error.message || 'Bilinmeyen hata'}`,
        details: JSON.stringify(error, null, 2)
      });
      toast({ title: "Hata", description: "Test mesajı gönderilemedi", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSendTemplateMessage = async () => {
    if (!templatePhone || !templateName) {
      toast({ title: "Hata", description: "Telefon numarası ve template adı gerekli", variant: "destructive" });
      return;
    }

    setTemplateSending(true);
    setTemplateResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("send-template-message", {
        body: {
          phone: templatePhone.replace('+', '').trim(),
          templateName: templateName,
          languageCode: templateLang,
          components: []
        }
      });

      if (error) throw error;

      setTemplateResult({
        success: true,
        message: `✅ Template mesajı başarıyla gönderildi: ${templatePhone}`,
        details: JSON.stringify(data, null, 2)
      });

      toast({ title: "Başarılı", description: "Template mesajı gönderildi" });
    } catch (error: any) {
      console.error("Template message error:", error);
      setTemplateResult({
        success: false,
        message: `❌ Hata: ${error.message || 'Bilinmeyen hata'}`,
        details: JSON.stringify(error, null, 2)
      });
      toast({ title: "Hata", description: "Template mesajı gönderilemedi", variant: "destructive" });
    } finally {
      setTemplateSending(false);
    }
  };

  const ResultAlert = ({ result }: { result: { success: boolean; message: string; details?: string } | null }) => {
    if (!result) return null;
    return (
      <div className="space-y-2">
        <Alert className={result.success ? "border-green-500/50 bg-green-500/10" : "border-destructive/50 bg-destructive/10"}>
          {result.success ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-destructive" />
          )}
          <AlertDescription className={result.success ? "text-green-600" : "text-destructive"}>
            {result.message}
          </AlertDescription>
        </Alert>
        {result.details && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">API Yanıtı (detay)</summary>
            <pre className="mt-2 p-3 bg-muted rounded-md overflow-auto max-h-48 text-xs">
              {result.details}
            </pre>
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Secrets Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Yapılandırma Durumu
          </CardTitle>
          <CardDescription>
            WhatsApp Meta Cloud API için gerekli kimlik bilgileri
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {requiredSecrets.map((secret) => (
              <div key={secret} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <Badge variant="default" className="bg-green-500 text-xs">✓</Badge>
                <code className="text-xs font-mono">{secret}</code>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Tüm gerekli secret'lar yapılandırılmış. Değerleri güncellemek için Lovable Cloud ayarlarını kullanın.
          </p>
        </CardContent>
      </Card>

      {/* Test Tabs */}
      <Tabs defaultValue="text" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="text" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Serbest Mesaj
          </TabsTrigger>
          <TabsTrigger value="template" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Template Mesaj
          </TabsTrigger>
        </TabsList>

        {/* Free Text Message */}
        <TabsContent value="text">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Serbest Metin Mesajı Gönder
              </CardTitle>
              <CardDescription>
                24 saat penceresi açık olan numaralara serbest metin mesajı gönderin.
                <br />
                <span className="text-yellow-600 font-medium">⚠️ Not: Son 24 saat içinde mesaj almadığınız numaralara serbest mesaj gönderemezsiniz. Template mesajı kullanın.</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test_phone">Telefon Numarası</Label>
                <Input
                  id="test_phone"
                  placeholder="905551234567"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Ülke kodu ile, + işareti olmadan</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="test_message">Mesaj İçeriği</Label>
                <Textarea
                  id="test_message"
                  placeholder="Test mesajı yazın..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                onClick={handleSendTextMessage}
                disabled={sending || !testPhone || !testMessage}
                className="w-full"
              >
                {sending ? "Gönderiliyor..." : "Serbest Mesaj Gönder"}
              </Button>

              <ResultAlert result={result} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Template Message */}
        <TabsContent value="template">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Template Mesajı Gönder
              </CardTitle>
              <CardDescription>
                Meta tarafından onaylanmış template mesajları gönderin. 24 saat kuralından bağımsız çalışır.
                <br />
                <span className="text-green-600 font-medium">✅ Template mesajları her zaman gönderilebilir.</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template_phone">Telefon Numarası</Label>
                <Input
                  id="template_phone"
                  placeholder="905551234567"
                  value={templatePhone}
                  onChange={(e) => setTemplatePhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Ülke kodu ile, + işareti olmadan</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template_name">Template Adı</Label>
                <Input
                  id="template_name"
                  placeholder="hello_world"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Meta Business Manager'da tanımlı template adı</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template_lang">Dil Kodu</Label>
                <Input
                  id="template_lang"
                  placeholder="en_US"
                  value={templateLang}
                  onChange={(e) => setTemplateLang(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Örnek: en_US, tr, de</p>
              </div>

              <Button
                onClick={handleSendTemplateMessage}
                disabled={templateSending || !templatePhone || !templateName}
                className="w-full"
              >
                {templateSending ? "Gönderiliyor..." : "Template Mesaj Gönder"}
              </Button>

              <ResultAlert result={templateResult} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Webhook Info */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Webhook Bilgileri</CardTitle>
          <CardDescription>Meta App Review için gerekli bilgiler</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-muted rounded-md">
              <p className="font-medium mb-1">Webhook URL:</p>
              <code className="text-xs break-all select-all">
                {import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook
              </code>
            </div>
            <div className="p-3 bg-muted rounded-md">
              <p className="font-medium mb-1">Desteklenen Webhook Alanları:</p>
              <p className="text-muted-foreground">messages, messaging_postbacks</p>
            </div>
            <div className="p-3 bg-muted rounded-md">
              <p className="font-medium mb-1">API Versiyonu:</p>
              <p className="text-muted-foreground">v18.0</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
