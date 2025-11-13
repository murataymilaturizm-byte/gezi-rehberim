import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const whatsappSchema = z.object({
  whatsapp_phone_number: z.string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, { 
      message: "Geçerli bir telefon numarası girin (E.164 formatı, örn: +905551234567)" 
    })
});

export const WhatsAppSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  
  const [phoneNumber, setPhoneNumber] = useState("");

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
        .select("id, whatsapp_phone_number, active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (agencyData) {
        setAgencyId(agencyData.id);
        
        const configured = !!agencyData.whatsapp_phone_number;
        setIsConfigured(configured);

        if (configured) {
          setPhoneNumber(agencyData.whatsapp_phone_number);
        }
      }
    } catch (error) {
      console.error("Error loading WhatsApp settings:", error);
      toast({
        title: "Hata",
        description: "WhatsApp ayarları yüklenemedi",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    const validation = whatsappSchema.safeParse({ whatsapp_phone_number: phoneNumber });
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
          whatsapp_phone_number: phoneNumber.trim()
        })
        .eq("id", agencyId);

      if (error) throw error;

      setIsConfigured(true);
      
      toast({
        title: "Başarılı!",
        description: "WhatsApp ayarları kaydedildi",
      });
    } catch (error: any) {
      console.error("Error saving WhatsApp settings:", error);
      
      let errorMessage = "WhatsApp ayarları kaydedilemedi";
      
      if (error.code === '23505') {
        errorMessage = "Bu telefon numarası zaten başka bir acente tarafından kullanılıyor";
      }
      
      toast({
        title: "Hata",
        description: errorMessage,
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
            <MessageSquare className="w-5 h-5" />
            WhatsApp Business Ayarları
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          WhatsApp Business Bağlantısı
        </CardTitle>
        <CardDescription>
          WhatsApp Business telefon numaranızı girerek sistemimizi aktifleştirin
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isConfigured ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              WhatsApp Business bağlantınız aktif!
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              WhatsApp Business numaranızı girerek başlayın
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-blue-900 flex items-center gap-2">
            📱 WhatsApp Business Kurulum Adımları
          </h4>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>
              <a 
                href="https://business.whatsapp.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline inline-flex items-center gap-1 hover:text-blue-600"
              >
                WhatsApp Business <ExternalLink className="w-3 h-3" />
              </a> hesabınızı oluşturun
            </li>
            <li>Telefon numaranızı onaylayın</li>
            <li>Aşağıdaki forma telefon numaranızı girin (E.164 formatında)</li>
            <li>Webhook URL'sini WhatsApp Business ayarlarınıza ekleyin</li>
          </ol>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">WhatsApp Business Telefon Numarası</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+905551234567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={saving}
              className="font-mono"
            />
            <p className="text-sm text-muted-foreground">
              E.164 formatında (örn: +905551234567)
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <Label className="text-sm font-medium">Webhook URL (WhatsApp'a eklenecek):</Label>
            <code className="block p-2 bg-background rounded text-xs break-all">
              {import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook
            </code>
            <p className="text-xs text-muted-foreground">
              Bu URL'yi WhatsApp Business Dashboard'unuzda "Webhooks" bölümüne ekleyin
            </p>
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={saving || !phoneNumber}
          >
            {saving ? "Kaydediliyor..." : isConfigured ? "Güncelle" : "Kaydet"}
          </Button>
        </form>

        <div className="border-t pt-4 space-y-2">
          <h4 className="font-semibold text-sm">💡 Önemli Notlar:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• WhatsApp Business API merkezi sistemimiz üzerinden yönetilir</li>
            <li>• Kendi Twilio hesabına ihtiyacınız yoktur</li>
            <li>• Tüm WhatsApp mesajları planınıza dahil mesaj kotasından düşülür</li>
            <li>• Telefon numarası değişikliği için destek ekibiyle iletişime geçin</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
