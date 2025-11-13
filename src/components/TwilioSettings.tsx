import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Settings, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const whatsappSchema = z.object({
  whatsapp_phone_number: z.string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, { message: "Geçerli bir telefon numarası girin (örn: +14155238886)" })
});

export const TwilioSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  
  const [formData, setFormData] = useState({
    whatsapp_phone_number: ""
  });

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
        
        // Check if WhatsApp is configured
        const isConfigured = 
          (agencyData as any).whatsapp_phone_number !== null &&
          (agencyData as any).whatsapp_phone_number !== "";
        
        setIsConfigured(isConfigured);

        if (isConfigured) {
          setFormData({
            whatsapp_phone_number: (agencyData as any).whatsapp_phone_number || ""
          });
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
    const validation = whatsappSchema.safeParse(formData);
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
    
    console.log("WhatsApp Settings - Updating agency:", agencyId);
    console.log("WhatsApp Settings - Form data:", formData);

    try {
      const { data, error } = await supabase
        .from("agencies")
        .update({
          whatsapp_phone_number: formData.whatsapp_phone_number
        } as any)
        .eq("id", agencyId)
        .select()
        .single();

      if (error) {
        console.error("WhatsApp Settings - Update error:", error);
        throw error;
      }

      console.log("WhatsApp Settings - Update successful:", data);

      setIsConfigured(true);

      toast({
        title: "Başarılı",
        description: "WhatsApp numarası başarıyla kaydedildi",
      });

      await loadWhatsAppSettings();
    } catch (error: any) {
      console.error("WhatsApp Settings - Error:", error);
      toast({
        title: "Hata",
        description: error.message || "WhatsApp numarası kaydedilemedi",
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
            WhatsApp Ayarları
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
          WhatsApp Ayarları
        </CardTitle>
        <CardDescription>
          WhatsApp Business numaranızı ayarlayın
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isConfigured && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              WhatsApp Business numranızı girerek WhatsApp entegrasyonunu aktif edebilirsiniz.
              Merkezi Twilio hesabı kullanıldığı için sadece WhatsApp numaranızı girmeniz yeterlidir.
            </AlertDescription>
          </Alert>
        )}

        {isConfigured && (
          <Alert className="mb-6 border-green-500/50 bg-green-500/10">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-500">
              WhatsApp entegrasyonu aktif! Müşterileriniz WhatsApp üzerinden sizinle iletişim kurabilir.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatsapp_phone_number">
              WhatsApp Business Numarası
            </Label>
            <Input
              id="whatsapp_phone_number"
              placeholder="+14155238886"
              value={formData.whatsapp_phone_number}
              onChange={(e) =>
                setFormData({ whatsapp_phone_number: e.target.value })
              }
              required
            />
            <p className="text-sm text-muted-foreground">
              Twilio'ya kayıtlı WhatsApp Business numaranızı girin (ör: +14155238886)
            </p>
          </div>

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Kaydediliyor..." : isConfigured ? "Güncelle" : "Kaydet"}
          </Button>
        </form>

        {isConfigured && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">✅ Entegrasyon Tamamlandı</h4>
            <p className="text-sm text-muted-foreground">
              WhatsApp hizmeti aktif. Müşterileriniz <strong>{formData.whatsapp_phone_number}</strong> numarasından sizinle iletişim kurabilir.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
