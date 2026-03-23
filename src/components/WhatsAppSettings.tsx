import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Settings, CheckCircle2, AlertCircle, MessageSquare, Lock, Phone, Wifi, Copy, ExternalLink } from "lucide-react";
import { WhatsAppEmbeddedSignup } from "./WhatsAppEmbeddedSignup";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPlanFeatures } from "@/utils/planFeatures";

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
  
  const [formData, setFormData] = useState({
    whatsapp_phone_number: "",
    meta_phone_number_id: "",
    conversation_style: "professional" as 'friendly' | 'professional' | 'energetic' | 'helpful'
  });

  const WEBHOOK_URL = `https://ncuswacwpqcxhmlhvfgq.supabase.co/functions/v1/whatsapp-webhook`;

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
        .select("id, whatsapp_phone_number, whatsapp_status, active, conversation_style, plan_type, whatsapp_connected_at, meta_phone_number_id")
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
        const metaPhoneId = agencyData.meta_phone_number_id || "";
        
        const configured = phoneNumber !== "" && connectedAt !== null;
        setIsConfigured(configured);
        setWhatsappStatus(status as 'pending' | 'active' | 'rejected');

        setFormData({
          whatsapp_phone_number: phoneNumber,
          meta_phone_number_id: metaPhoneId,
          conversation_style: (agencyData.conversation_style || 'professional') as 'friendly' | 'professional' | 'energetic' | 'helpful'
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

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.whatsapp_phone_number.trim()) {
      toast({
        title: "Hata",
        description: "Lütfen WhatsApp numaranızı girin",
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
      const { error } = await supabase
        .from("agencies")
        .update({
          whatsapp_phone_number: formData.whatsapp_phone_number,
          meta_phone_number_id: formData.meta_phone_number_id || null,
          whatsapp_status: 'active',
          whatsapp_connected_at: new Date().toISOString(),
        })
        .eq("id", agencyId);

      if (error) throw error;

      setIsConfigured(true);
      setWhatsappStatus('active');

      toast({
        title: "Başarılı",
        description: "WhatsApp Meta Cloud API bağlantısı kaydedildi",
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Kopyalandı", description: "Panoya kopyalandı" });
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
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Meta Cloud API Bağlantısı
          </CardTitle>
          <CardDescription>
            WhatsApp Business hesabınızı Meta Cloud API üzerinden bağlayın
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isConfigured && whatsappStatus === 'active' ? (
            <Alert className="mb-6 border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-600">
                ✅ Meta Cloud API bağlantısı aktif! Mesajlar otomatik olarak AI chatbot tarafından yanıtlanıyor.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                WhatsApp entegrasyonu henüz yapılandırılmamış. Aşağıdaki adımları takip ederek bağlantıyı kurun.
              </AlertDescription>
            </Alert>
          )}

          {/* Setup Steps */}
          <div className="space-y-4 mb-6">
            <h4 className="font-semibold text-sm">📋 Kurulum Adımları</h4>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3 items-start">
                <Badge variant="outline" className="shrink-0 mt-0.5">1</Badge>
                <div>
                  <p className="font-medium">Meta Developer Hesabı</p>
                  <p className="text-muted-foreground">
                    <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      Meta for Developers <ExternalLink className="h-3 w-3" />
                    </a> 
                    {" "}adresinden bir uygulama oluşturun ve WhatsApp ürünü ekleyin.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <Badge variant="outline" className="shrink-0 mt-0.5">2</Badge>
                <div>
                  <p className="font-medium">Webhook URL'ini Yapıştırın</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs bg-muted px-2 py-1 rounded break-all flex-1">{WEBHOOK_URL}</code>
                    <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={() => copyToClipboard(WEBHOOK_URL)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    Meta Developer Console → WhatsApp → Configuration → Webhook URL
                  </p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <Badge variant="outline" className="shrink-0 mt-0.5">3</Badge>
                <div>
                  <p className="font-medium">Verify Token</p>
                  <p className="text-muted-foreground">
                    Webhook doğrulama token'ı olarak süper admin tarafından belirlenen token'ı girin.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <Badge variant="outline" className="shrink-0 mt-0.5">4</Badge>
                <div>
                  <p className="font-medium">Aşağıdaki bilgileri doldurun</p>
                  <p className="text-muted-foreground">
                    WhatsApp Business numaranızı ve Phone Number ID'nizi girin.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Connection Form */}
          <form onSubmit={handleSaveConnection} className="space-y-4">
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
                Ülke kodu ile başlayan WhatsApp Business numaranız
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meta_phone_number_id">
                Meta Phone Number ID
              </Label>
              <Input
                id="meta_phone_number_id"
                placeholder="123456789012345"
                value={formData.meta_phone_number_id}
                onChange={(e) =>
                  setFormData({ ...formData, meta_phone_number_id: e.target.value })
                }
              />
              <p className="text-sm text-muted-foreground">
                Meta Developer Console → WhatsApp → Getting Started bölümünden bulabilirsiniz
              </p>
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? t("admin.whatsapp.settings.saving") : isConfigured ? "Bağlantıyı Güncelle" : "Meta Cloud API'ye Bağlan"}
            </Button>
          </form>

          {/* Status Info */}
          {isConfigured && whatsappStatus === 'active' && (
            <div className="mt-6 p-4 bg-muted rounded-lg space-y-2">
              <h4 className="font-semibold text-sm">📊 Bağlantı Bilgileri</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• <strong>Numara:</strong> {formData.whatsapp_phone_number}</p>
                {formData.meta_phone_number_id && (
                  <p>• <strong>Phone Number ID:</strong> {formData.meta_phone_number_id}</p>
                )}
                <p>• <strong>API:</strong> Meta Cloud API v18.0</p>
                <p>• <strong>Durum:</strong> <span className="text-green-600 font-medium">Aktif</span></p>
              </div>
            </div>
          )}

          {/* Important Notes */}
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold text-sm mb-2">⚠️ Önemli Notlar</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• 24 saat kuralı: Müşteriden son mesajın üzerinden 24 saat geçtiyse sadece şablon mesajı gönderilebilir</li>
              <li>• Access Token süresi dolabilir — periyodik olarak yenilenmesi gerekebilir</li>
              <li>• Webhook aboneliğinde <strong>messages</strong> alanını seçmeyi unutmayın</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Embedded Signup Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Tek Tıkla Bağlantı (Embedded Signup)
          </CardTitle>
          <CardDescription>
            İleride WhatsApp Business hesabınızı tek tıkla bağlayabileceksiniz
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button disabled className="w-full" variant="outline">
              <Phone className="h-4 w-4 mr-2" />
              WhatsApp Bağla (Embedded Signup)
              <Badge variant="outline" className="ml-2 text-xs">Yakında</Badge>
            </Button>
            
            <p className="text-xs text-muted-foreground text-center">
              Bu özellik yakında aktif olacak. Şu anda yukarıdaki manuel kurulum adımlarını kullanabilirsiniz.
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
