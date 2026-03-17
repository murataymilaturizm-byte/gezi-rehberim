import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Circle, Clock, Loader2, MessageSquare, Phone, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type IntegrationStatus = "pending_review" | "waiting_info" | "in_progress" | "testing" | "active";

interface Integration {
  id: string;
  status: IntegrationStatus;
  whatsapp_phone: string | null;
  company_name: string | null;
  has_business_manager: boolean | null;
  business_manager_id: string | null;
  contact_email: string | null;
  notes: string | null;
  requested_at: string;
  activated_at: string | null;
}

const STEPS: { key: IntegrationStatus; label: string; description: string }[] = [
  {
    key: "pending_review",
    label: "Talep Alındı",
    description: "Talebiniz alındı, en kısa sürede sizinle iletişime geçeceğiz.",
  },
  {
    key: "waiting_info",
    label: "Bilgiler Bekleniyor",
    description: "Kurulum için aşağıdaki bilgileri doldurun.",
  },
  {
    key: "in_progress",
    label: "Kurulum Yapılıyor",
    description: "Ekibimiz WhatsApp entegrasyonunuzu yapılandırıyor. Bu işlem 1-3 iş günü sürebilir.",
  },
  {
    key: "testing",
    label: "Test Ediliyor",
    description: "Entegrasyon test aşamasında, biraz daha bekleyin.",
  },
  {
    key: "active",
    label: "Aktif",
    description: "WhatsApp entegrasyonunuz aktif!",
  },
];

export const WhatsAppIntegrationPanel = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    whatsapp_phone: "",
    company_name: "",
    has_business_manager: false,
    business_manager_id: "",
    contact_email: "",
    notes: "",
  });

  useEffect(() => {
    loadIntegration();
  }, []);

  const loadIntegration = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agency } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!agency) return;
      setAgencyId(agency.id);

      const { data, error } = await supabase
        .from("whatsapp_integrations")
        .select("*")
        .eq("agency_id", agency.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setIntegration(data as unknown as Integration);
        setFormData({
          whatsapp_phone: data.whatsapp_phone || "",
          company_name: data.company_name || "",
          has_business_manager: data.has_business_manager || false,
          business_manager_id: data.business_manager_id || "",
          contact_email: data.contact_email || "",
          notes: data.notes || "",
        });
      }
    } catch (error) {
      console.error("Error loading integration:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitInfo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.whatsapp_phone.trim() || !formData.company_name.trim() || !formData.contact_email.trim()) {
      toast({ title: "Hata", description: "Zorunlu alanları doldurun.", variant: "destructive" });
      return;
    }

    if (!agencyId) return;
    setSaving(true);
    try {
      if (integration) {
        // Update existing
        const { error } = await supabase
          .from("whatsapp_integrations")
          .update({
            whatsapp_phone: formData.whatsapp_phone,
            company_name: formData.company_name,
            has_business_manager: formData.has_business_manager,
            business_manager_id: formData.business_manager_id || null,
            contact_email: formData.contact_email,
            notes: formData.notes || null,
          } as any)
          .eq("id", integration.id);
        if (error) throw error;
      } else {
        // Create new with pending_review
        const { error } = await supabase
          .from("whatsapp_integrations")
          .insert({
            agency_id: agencyId,
            status: "pending_review" as any,
            whatsapp_phone: formData.whatsapp_phone,
            company_name: formData.company_name,
            has_business_manager: formData.has_business_manager,
            business_manager_id: formData.business_manager_id || null,
            contact_email: formData.contact_email,
            notes: formData.notes || null,
          } as any);
        if (error) throw error;
      }

      toast({ title: "Başarılı", description: "Bilgileriniz alındı, ekibimiz sizinle iletişime geçecek." });
      await loadIntegration();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({ title: "Hata", description: "Bilgiler kaydedilemedi.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const currentStepIndex = integration
    ? STEPS.findIndex((s) => s.key === integration.status)
    : -1;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Yükleniyor...
        </CardContent>
      </Card>
    );
  }

  const showForm = !integration || integration.status === "waiting_info";

  return (
    <div className="space-y-6">
      {/* Progress Tracker */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            WhatsApp Entegrasyon Durumu
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Steps */}
          <div className="relative">
            {STEPS.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const isPending = index > currentStepIndex;

              return (
                <div key={step.key} className="flex gap-4 pb-8 last:pb-0">
                  {/* Line + Icon */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors",
                        isCompleted && "bg-green-500 border-green-500 text-white",
                        isCurrent && "bg-primary border-primary text-primary-foreground",
                        isPending && "bg-muted border-muted-foreground/30 text-muted-foreground"
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isCurrent ? (
                        <Clock className="h-4 w-4" />
                      ) : (
                        <Circle className="h-3 w-3" />
                      )}
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={cn(
                          "w-0.5 flex-1 mt-1",
                          isCompleted ? "bg-green-500" : "bg-muted-foreground/20"
                        )}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="pt-0.5 pb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-medium text-sm",
                          isCompleted && "text-green-600",
                          isCurrent && "text-primary",
                          isPending && "text-muted-foreground"
                        )}
                      >
                        {step.label}
                      </span>
                      {isCurrent && (
                        <Badge variant="secondary" className="text-xs">
                          Şu an
                        </Badge>
                      )}
                    </div>
                    {isCurrent && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {step.key === "active" && integration.whatsapp_phone
                          ? `${step.description} Numaranız: ${integration.whatsapp_phone}`
                          : step.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Info Form - Only show when waiting_info */}
      {integration.status === "waiting_info" && (
        <Card>
          <CardHeader>
            <CardTitle>Kurulum Bilgileri</CardTitle>
            <CardDescription>
              WhatsApp entegrasyonunuz için gerekli bilgileri doldurun.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitInfo} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="whatsapp_phone">
                  WhatsApp Business Telefon Numarası <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="whatsapp_phone"
                  placeholder="+905551234567"
                  value={formData.whatsapp_phone}
                  onChange={(e) => setFormData({ ...formData, whatsapp_phone: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_name">
                  Şirket Adı <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="company_name"
                  placeholder="Şirket adınız"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  required
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Facebook Business Manager hesabınız var mı?</Label>
                  <p className="text-sm text-muted-foreground">
                    Varsa ID'sini girmeniz kurulumu hızlandırır.
                  </p>
                </div>
                <Switch
                  checked={formData.has_business_manager}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, has_business_manager: checked })
                  }
                />
              </div>

              {formData.has_business_manager && (
                <div className="space-y-2">
                  <Label htmlFor="business_manager_id">Facebook Business Manager ID</Label>
                  <Input
                    id="business_manager_id"
                    placeholder="123456789012345"
                    value={formData.business_manager_id}
                    onChange={(e) =>
                      setFormData({ ...formData, business_manager_id: e.target.value })
                    }
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="contact_email">
                  İletişim E-posta Adresi <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="contact_email"
                  type="email"
                  placeholder="info@sirketiniz.com"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notlar / Özel İstekler</Label>
                <Textarea
                  id="notes"
                  placeholder="Eklemek istediğiniz bilgiler..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Bilgileri Gönder
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Success state */}
      {integration.status === "active" && (
        <Alert className="border-green-500/50 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-600">
            WhatsApp entegrasyonunuz aktif! Mesajlar otomatik olarak AI chatbot tarafından yanıtlanıyor.
            {integration.whatsapp_phone && (
              <span className="block mt-1 font-medium">Numara: {integration.whatsapp_phone}</span>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
