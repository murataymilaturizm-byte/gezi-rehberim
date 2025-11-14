import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<'pending' | 'active' | 'rejected'>('pending');
  
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
        .select("id, twilio_phone_number, whatsapp_status, active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (agencyData) {
        setAgencyId(agencyData.id);
        
        // Check if WhatsApp is configured - using twilio_phone_number as temp storage
        const phoneNumber = (agencyData as any).twilio_phone_number || "";
        const status = (agencyData as any).whatsapp_status || "pending";
        const isConfigured = phoneNumber !== "" && phoneNumber !== "TEMP_PHONE";
        
        setIsConfigured(isConfigured);
        setWhatsappStatus(status);

        if (isConfigured) {
          setFormData({
            whatsapp_phone_number: phoneNumber
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
      // Using twilio_phone_number column temporarily until types are updated
      const { data, error } = await supabase
        .from("agencies")
        .update({
          twilio_phone_number: formData.whatsapp_phone_number,
          whatsapp_status: 'pending'
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
      setWhatsappStatus('pending');

      toast({
        title: "Başarılı",
        description: "WhatsApp entegrasyon talebiniz alındı. Yönetici onayı bekleniyor.",
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
          {t("admin.whatsapp.settings.title")}
        </CardTitle>
        <CardDescription>
          {t("admin.whatsapp.settings.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isConfigured && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t("admin.whatsapp.settings.notConfigured")}
            </AlertDescription>
          </Alert>
        )}

        {isConfigured && whatsappStatus === 'pending' && (
          <Alert className="mb-6 border-yellow-500/50 bg-yellow-500/10">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-600">
              WhatsApp entegrasyon başvurunuz alındı. Yönetici onayı bekleniyor.
            </AlertDescription>
          </Alert>
        )}

        {isConfigured && whatsappStatus === 'active' && (
          <Alert className="mb-6 border-green-500/50 bg-green-500/10">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-500">
              {t("admin.whatsapp.settings.configured")}
            </AlertDescription>
          </Alert>
        )}

        {isConfigured && whatsappStatus === 'rejected' && (
          <Alert className="mb-6 border-red-500/50 bg-red-500/10">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-500">
              WhatsApp entegrasyon başvurunuz reddedildi. Lütfen destek ile iletişime geçin.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatsapp_phone_number">
              {t("admin.whatsapp.settings.phoneNumber")}
            </Label>
            <Input
              id="whatsapp_phone_number"
              placeholder={t("admin.whatsapp.settings.phonePlaceholder")}
              value={formData.whatsapp_phone_number}
              onChange={(e) =>
                setFormData({ whatsapp_phone_number: e.target.value })
              }
              required
            />
            <p className="text-sm text-muted-foreground">
              {t("admin.whatsapp.settings.phoneHelp")}
            </p>
          </div>

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? t("admin.whatsapp.settings.saving") : isConfigured ? t("admin.whatsapp.settings.update") : t("admin.whatsapp.settings.save")}
          </Button>
        </form>

        {isConfigured && whatsappStatus === 'active' && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">✅ {t("admin.whatsapp.settings.integrationComplete")}</h4>
            <p className="text-sm text-muted-foreground">
              {t("admin.whatsapp.settings.integrationCompleteDesc", { phone: formData.whatsapp_phone_number })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
