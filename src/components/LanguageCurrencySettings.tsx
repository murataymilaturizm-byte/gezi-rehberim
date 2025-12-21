import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getAvailableCurrencies } from "@/utils/currency";
import { Loader2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface LanguageCurrencyMapping {
  [key: string]: string;
}

const LANGUAGE_LABELS: Record<string, string> = {
  tr: '🇹🇷 Türkçe',
  en: '🇬🇧 English',
  de: '🇩🇪 Deutsch',
  ru: '🇷🇺 Русский',
  ar: '🇸🇦 العربية',
  fr: '🇫🇷 Français',
  es: '🇪🇸 Español'
};

export function LanguageCurrencySettings() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [noAgency, setNoAgency] = useState(false);
  const [primaryCurrency, setPrimaryCurrency] = useState<string>('TRY');
  const [languageCurrencies, setLanguageCurrencies] = useState<LanguageCurrencyMapping>({});
  const [languageOverrides, setLanguageOverrides] = useState<Record<string, boolean>>({});
  // Tüm mevcut dilleri göster
  const availableLanguages = Object.keys(LANGUAGE_LABELS);
  const currencies = getAvailableCurrencies();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agency, error } = await supabase
        .from('agencies')
        .select('id, primary_currency, language_currencies, enabled_languages')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!agency) {
        // Super admin veya acentesi olmayan kullanıcı
        setNoAgency(true);
        setLoading(false);
        return;
      }

      setAgencyId(agency.id);
      setPrimaryCurrency(agency.primary_currency || 'TRY');
      const currenciesData = (agency.language_currencies as LanguageCurrencyMapping) || {};
      setLanguageCurrencies(currenciesData);
      
      // Hangi dillerin override'ı var, işaretle
      const overrides: Record<string, boolean> = {};
      Object.keys(LANGUAGE_LABELS).forEach(lang => {
        overrides[lang] = !!currenciesData[lang];
      });
      setLanguageOverrides(overrides);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: t('currency.saveError'),
        description: t('currency.loadError'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!agencyId) return;

    setSaving(true);
    try {
      // Sadece override edilmiş dilleri kaydet
      const finalCurrencies: LanguageCurrencyMapping = {};
      Object.entries(languageOverrides).forEach(([lang, override]) => {
        if (override && languageCurrencies[lang]) {
          finalCurrencies[lang] = languageCurrencies[lang];
        }
      });

      const { error } = await supabase
        .from('agencies')
        .update({ 
          primary_currency: primaryCurrency,
          language_currencies: finalCurrencies 
        })
        .eq('id', agencyId);

      if (error) throw error;

      toast({
        title: t('currency.saveSuccess'),
        description: t('currency.saveSuccessDesc'),
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: t('currency.saveError'),
        description: t('currency.saveErrorDesc'),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (noAgency) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('currency.management')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {t('currency.noAgencyError', { defaultValue: 'Bu ayarlar sadece acente hesapları için kullanılabilir. Super admin olarak giriş yaptığınız için bu bölümü görüntüleyemezsiniz.' })}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('currency.management')}</CardTitle>
        <CardDescription>
          {t('currency.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>{t('currency.howItWorks')}</strong> {t('currency.howItWorksDesc', { currency: primaryCurrency })}
          </AlertDescription>
        </Alert>

        {/* Ana Para Birimi */}
        <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
          <Label className="text-base font-semibold">{t('currency.primaryCurrency')}</Label>
          <p className="text-sm text-muted-foreground mb-3">
            {t('currency.primaryCurrencyDesc')}
          </p>
          <Select
            value={primaryCurrency}
            onValueChange={setPrimaryCurrency}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('currency.selectPrimaryCurrency')} />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((currency) => (
                <SelectItem key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.code} - {currency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dil Bazlı Para Birimi Seçimi */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-semibold">{t('currency.languageBasedSettings')}</Label>
            <p className="text-sm text-muted-foreground mt-1">
              {t('currency.languageBasedSettingsDesc')}
            </p>
          </div>

          <div className="space-y-3">
            {availableLanguages.map((lang) => {
              const isOverride = languageOverrides[lang] || false;
              const selectedCurrency = languageCurrencies[lang];
              const displayCurrency = isOverride && selectedCurrency ? selectedCurrency : primaryCurrency;
              
              return (
                <div key={lang} className="p-4 border rounded-lg bg-muted/20">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">
                          {LANGUAGE_LABELS[lang] || lang}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {isOverride 
                            ? t('currency.customCurrency', { currency: displayCurrency })
                            : t('currency.usingPrimary', { currency: primaryCurrency })
                          }
                        </p>
                      </div>
                      <Switch
                        checked={isOverride}
                        onCheckedChange={(checked) => {
                          setLanguageOverrides(prev => ({ ...prev, [lang]: checked }));
                          if (!checked) {
                            // Switch kapatılırsa override'ı temizle
                            setLanguageCurrencies(prev => {
                              const newCurrencies = { ...prev };
                              delete newCurrencies[lang];
                              return newCurrencies;
                            });
                          }
                        }}
                      />
                    </div>
                    
                    {isOverride && (
                      <div>
                        <Label className="text-sm text-muted-foreground mb-2">
                          {t('currency.selectCurrencyForLanguage')}
                        </Label>
                        <Select
                          value={selectedCurrency || primaryCurrency}
                          onValueChange={(value) => {
                            setLanguageCurrencies(prev => ({ ...prev, [lang]: value }));
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {currencies.map((currency) => (
                              <SelectItem key={currency.code} value={currency.code}>
                                {currency.symbol} {currency.code} - {currency.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="w-full mt-6"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('currency.saving')}
            </>
          ) : (
            t('currency.save')
          )}
        </Button>
      </CardContent>
    </Card>
  );
}