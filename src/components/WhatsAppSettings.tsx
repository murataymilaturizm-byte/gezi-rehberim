import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Settings, CheckCircle2, AlertCircle, MessageSquare, Lock, Phone, Wifi, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPlanFeatures } from "@/utils/planFeatures";

const whatsappSchema = z.object({
  whatsapp_phone_number: z.string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, { message: "Geçerli bir telefon numarası girin (örn: +905551234567)" })
});

export const WhatsAppSettings = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<'pending' | 'active' | 'rejected'>('pending');
  const [planType, setPlanType] = useState<string>('starter');
  const [availableStyles, setAvailableStyles] = useState<string[]>(['professional']);
  const [hasMetaCredentials, setHasMetaCredentials] = useState(false);
  
  const [formData, setFormData] = useState({
    whatsapp_phone_number: "",
    conversation_style: "professional" as 'friendly' | 'professional' | 'energetic' | 'helpful'
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
        .select("id, whatsapp_phone_number, whatsapp_status, active, conversation_style, plan_type, whatsapp_connected_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (agencyData) {
        setAgencyId(agencyData.id);
        const currentPlanType = agencyData.plan_type || 'starter';
        setPlanType(currentPlanType);
        
        const features = await getPlanFeatures(currentPlanType);
        if (features) {
          setAvailableStyles(features.available_styles);
        }
        
        const phoneNumber = agencyData.whatsapp_phone_number || "";
        const status = agencyData.whatsapp_status || "pending";
        const connectedAt = agencyData.whatsapp_connected_at;
        
        // Check if Meta credentials are configured (global or agency-level)
        const configured = phoneNumber !== "" && connectedAt !== null;
        setIsConfigured(configured);
        setWhatsappStatus(status as 'pending' | 'active' | 'rejected');
        setHasMetaCredentials(!!connectedAt);

        setFormData({
          whatsapp_phone_number: phoneNumber,
          conversation_style: agencyData.conversation_style || 'professional'
        });
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

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = whatsappSchema.safeParse(formData);
    if (!validation.success) {
      toast({
        title: t("common.error"),
        description: validation.error.errors[0].message,
        variant: "destructive"
      });
      return;
    }

    if (!agencyId) {
      toast({
        title: t("common.error"),
        description: t("admin.whatsapp.settings.agencyNotFound"),
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    
    try {
      const updateData: any = {
        whatsapp_phone_number: formData.whatsapp_phone_number,
        whatsapp_status: 'active',
        whatsapp_connected_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("agencies")
        .update(updateData)
        .eq("id", agencyId);

      if (error) throw error;

      setIsConfigured(true);
      setWhatsappStatus('active');
      setHasMetaCredentials(true);

      toast({
        title: t("common.success"),
        description: "WhatsApp ayarları kaydedildi",
      });

      await loadWhatsAppSettings();
    } catch (error: any) {
      console.error("WhatsApp Settings - Error:", error);
      toast({
        title: t("common.error"),
        description: t("admin.whatsapp.settings.phoneUpdateError"),
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStyleUpdate = async () => {
    if (!agencyId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("agencies")
        .update({ conversation_style: formData.conversation_style } as any)
        .eq("id", agencyId);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("admin.whatsapp.settings.styleUpdateSuccess"),
      });

      await loadWhatsAppSettings();
    } catch (error: any) {
      console.error("Style update error:", error);
      toast({
        title: t("common.error"),
        description: t("admin.whatsapp.settings.styleUpdateError"),
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
    <div className="space-y-6">
      {/* WhatsApp Business Number Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            WhatsApp Business Bağlantısı
          </CardTitle>
          <CardDescription>
            Meta Cloud API üzerinden WhatsApp Business numaranızı bağlayın
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isConfigured && (
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                WhatsApp entegrasyonu henüz yapılandırılmamış. WhatsApp Business numaranızı girerek başlayın.
              </AlertDescription>
            </Alert>
          )}

          {isConfigured && whatsappStatus === 'active' && (
            <Alert className="mb-6 border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-500">
                ✅ WhatsApp bağlantısı aktif! Mesajlar Meta Cloud API üzerinden gönderilecek.
              </AlertDescription>
            </Alert>
          )}

          {isConfigured && whatsappStatus === 'pending' && (
            <Alert className="mb-6 border-yellow-500/50 bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-600">
                {t("admin.whatsapp.status.requestReceived")}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp_phone_number">
                WhatsApp Business Numarası
              </Label>
              <Input
                id="whatsapp_phone_number"
                placeholder="+905551234567"
                value={formData.whatsapp_phone_number}
                onChange={(e) =>
                  setFormData({ ...formData, whatsapp_phone_number: e.target.value })
                }
                required
              />
              <p className="text-sm text-muted-foreground">
                Meta Cloud API'ye bağlı WhatsApp Business numaranız
              </p>
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? t("admin.whatsapp.settings.saving") : isConfigured ? "Güncelle" : "Kaydet ve Bağla"}
            </Button>
          </form>

          {isConfigured && whatsappStatus === 'active' && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">✅ Entegrasyon Tamamlandı</h4>
              <p className="text-sm text-muted-foreground">
                WhatsApp Business numaranız ({formData.whatsapp_phone_number}) Meta Cloud API üzerinden bağlı. 
                Gelen mesajlar otomatik olarak AI chatbot tarafından yanıtlanacak.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Embedded Signup Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            WhatsApp Hesabınızı Bağlayın
          </CardTitle>
          <CardDescription>
            WhatsApp Business hesabınızı bağlamak için aşağıdaki butona tıklayın. 
            Kendi numaranızla müşterilerinize mesaj gönderebilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={hasMetaCredentials ? "default" : "secondary"}>
                {hasMetaCredentials ? "✅ Bağlı" : "❌ Bağlı Değil"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {hasMetaCredentials 
                  ? "WhatsApp Business hesabınız başarıyla bağlandı" 
                  : "Henüz bir WhatsApp Business hesabı bağlanmadı"
                }
              </span>
            </div>

            <Button disabled className="w-full" variant="outline">
              <Phone className="h-4 w-4 mr-2" />
              WhatsApp Bağla
              <Badge variant="outline" className="ml-2 text-xs">Yakında</Badge>
            </Button>
            
            <p className="text-xs text-muted-foreground text-center">
              Embedded Signup özelliği yakında aktif olacak. Şu anda WhatsApp bağlantısı admin tarafından yapılmaktadır.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Conversation Style Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t("admin.whatsapp.settings.styleTitle")}
          </CardTitle>
          <CardDescription>
            {t("admin.whatsapp.settings.styleDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="conversation_style">
                {t("admin.whatsapp.settings.conversationStyle")}
              </Label>
              {planType === 'starter' && (
                <Badge variant="outline" className="text-xs">
                  <Lock className="w-3 h-3 mr-1" />
                  {t("admin.whatsapp.settings.upgradeForStyles")}
                </Badge>
              )}
            </div>
            <Select
              value={formData.conversation_style}
              onValueChange={(value: 'friendly' | 'professional' | 'energetic' | 'helpful') =>
                setFormData({ ...formData, conversation_style: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">
                  <div className="flex items-center gap-2">
                    <span>👔</span>
                    <span>{t("admin.whatsapp.settings.style.professional")}</span>
                  </div>
                </SelectItem>
                <SelectItem value="friendly" disabled={!availableStyles.includes('friendly')}>
                  <div className="flex items-center gap-2">
                    <span>🤝</span>
                    <span>{t("admin.whatsapp.settings.style.friendly")}</span>
                    {!availableStyles.includes('friendly') && <Lock className="w-3 h-3 ml-1" />}
                  </div>
                </SelectItem>
                <SelectItem value="energetic" disabled={!availableStyles.includes('energetic')}>
                  <div className="flex items-center gap-2">
                    <span>⚡</span>
                    <span>{t("admin.whatsapp.settings.style.energetic")}</span>
                    {!availableStyles.includes('energetic') && <Lock className="w-3 h-3 ml-1" />}
                  </div>
                </SelectItem>
                <SelectItem value="helpful" disabled={!availableStyles.includes('helpful')}>
                  <div className="flex items-center gap-2">
                    <span>😊</span>
                    <span>{t("admin.whatsapp.settings.style.helpful")}</span>
                    {!availableStyles.includes('helpful') && <Lock className="w-3 h-3 ml-1" />}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {t("admin.whatsapp.settings.conversationStyleHelp")}
            </p>
          </div>

          <Button 
            onClick={handleStyleUpdate} 
            disabled={saving} 
            className="w-full"
          >
            {saving ? t("admin.whatsapp.settings.saving") : t("admin.whatsapp.settings.updateStyle")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
