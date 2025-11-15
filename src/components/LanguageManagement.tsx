import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Languages, Check, X, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getMaxLanguages } from "@/utils/planFeatures";
import { Checkbox } from "@/components/ui/checkbox";

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
];

export const LanguageManagement = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [planType, setPlanType] = useState<string>('starter');
  const [maxLanguages, setMaxLanguages] = useState<number>(1);
  const [enabledLanguages, setEnabledLanguages] = useState<string[]>([]);
  const [tempEnabledLanguages, setTempEnabledLanguages] = useState<string[]>([]);

  useEffect(() => {
    loadLanguageSettings();
  }, []);

  const loadLanguageSettings = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agencyData, error } = await supabase
        .from("agencies")
        .select("id, plan_type, enabled_languages")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (agencyData) {
        setAgencyId(agencyData.id);
        const currentPlanType = agencyData.plan_type || 'starter';
        setPlanType(currentPlanType);
        
        const maxLangs = await getMaxLanguages(currentPlanType);
        setMaxLanguages(maxLangs);
        
        const currentLanguages = (agencyData as any).enabled_languages || [];
        setEnabledLanguages(currentLanguages);
        setTempEnabledLanguages(currentLanguages);
      }
    } catch (error) {
      console.error("Error loading language settings:", error);
      toast({
        title: t("common.error"),
        description: "Dil ayarları yüklenemedi",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageToggle = (languageCode: string) => {
    const isEnabled = tempEnabledLanguages.includes(languageCode);

    if (isEnabled) {
      // Dili çıkar
      setTempEnabledLanguages(tempEnabledLanguages.filter(code => code !== languageCode));
    } else {
      // Limit kontrolü
      if (tempEnabledLanguages.length >= maxLanguages) {
        const planNames = {
          'starter': 'Başlangıç',
          'professional': 'Profesyonel',
          'enterprise': 'Kurumsal'
        };
        toast({
          title: "Dil Limiti Doldu",
          description: `${planNames[planType as keyof typeof planNames]} paketinizde maksimum ${maxLanguages} dil aktif edebilirsiniz. Daha fazla dil için paketinizi yükseltin.`,
          variant: "destructive"
        });
        return;
      }
      // Dili ekle
      setTempEnabledLanguages([...tempEnabledLanguages, languageCode]);
    }
  };

  const handleSave = async () => {
    if (!agencyId) return;
    
    // En az 1 dil seçilmiş olmalı
    if (tempEnabledLanguages.length === 0) {
      toast({
        title: "Uyarı",
        description: "En az 1 dil seçmelisiniz.",
        variant: "destructive"
      });
      return;
    }
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("agencies")
        .update({ enabled_languages: tempEnabledLanguages })
        .eq("id", agencyId);

      if (error) throw error;

      setEnabledLanguages(tempEnabledLanguages);
      
      toast({
        title: t("common.success"),
        description: "Dil ayarları kaydedildi",
      });
    } catch (error) {
      console.error("Error saving language settings:", error);
      toast({
        title: t("common.error"),
        description: "Dil ayarları kaydedilemedi",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(enabledLanguages.sort()) !== JSON.stringify(tempEnabledLanguages.sort());

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            {t("common.loading")}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Languages className="w-5 h-5" />
              Dil Yönetimi
            </CardTitle>
            <CardDescription>
              WhatsApp botunuzun kullanacağı dilleri seçin. Seçili dillerde müşterilerinizle otomatik iletişim kurulacaktır.
            </CardDescription>
          </div>
          <Badge variant="outline" className="ml-4">
            {tempEnabledLanguages.length}/{maxLanguages} Dil
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertDescription>
            <strong>Plan Limitiniz:</strong> {planType === 'starter' ? 'Başlangıç' : planType === 'professional' ? 'Profesyonel' : 'Kurumsal'} paketinizde maksimum {maxLanguages} dil aktif edebilirsiniz.
            {planType !== 'enterprise' && ' Daha fazla dil için paketinizi yükseltin.'}
            {tempEnabledLanguages.length === 0 && (
              <div className="mt-2 text-destructive font-medium">
                ⚠️ En az 1 dil seçmelisiniz.
              </div>
            )}
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          {AVAILABLE_LANGUAGES.map((language) => {
            const isEnabled = tempEnabledLanguages.includes(language.code);
            const isDisabled = !isEnabled && tempEnabledLanguages.length >= maxLanguages;
            
            return (
              <div
                key={language.code}
                className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                  isEnabled 
                    ? 'border-primary bg-primary/5' 
                    : isDisabled 
                    ? 'border-border/50 bg-muted/30 opacity-60' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{language.flag}</span>
                  <div className="flex flex-col">
                    <span className="font-medium">{language.nativeName}</span>
                    <span className="text-sm text-muted-foreground">{language.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isEnabled && (
                    <Badge variant="default" className="gap-1">
                      <Check className="w-3 h-3" />
                      Aktif
                    </Badge>
                  )}
                  {isDisabled && (
                    <Badge variant="outline" className="gap-1">
                      <Lock className="w-3 h-3" />
                      Limit Doldu
                    </Badge>
                  )}
                  <Checkbox
                    checked={isEnabled}
                    disabled={isDisabled}
                    onCheckedChange={() => handleLanguageToggle(language.code)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {hasChanges && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setTempEnabledLanguages(enabledLanguages)}
              disabled={saving}
            >
              <X className="w-4 h-4 mr-2" />
              İptal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Check className="w-4 h-4 mr-2" />
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
