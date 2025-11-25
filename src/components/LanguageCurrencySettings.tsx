import { useState, useEffect } from "react";
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [primaryCurrency, setPrimaryCurrency] = useState<string>('TRY');
  const [languageCurrencies, setLanguageCurrencies] = useState<LanguageCurrencyMapping>({});
  const [languageOverrides, setLanguageOverrides] = useState<Record<string, boolean>>({});
  const [enabledLanguages, setEnabledLanguages] = useState<string[]>([]);
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
        .single();

      if (error) throw error;

      if (agency) {
        setAgencyId(agency.id);
        setPrimaryCurrency(agency.primary_currency || 'TRY');
        setEnabledLanguages(agency.enabled_languages || ['tr']);
        const currencies = (agency.language_currencies as LanguageCurrencyMapping) || {};
        setLanguageCurrencies(currencies);
        
        // Hangi dillerin override'ı var, işaretle
        const overrides: Record<string, boolean> = {};
        (agency.enabled_languages || ['tr']).forEach(lang => {
          overrides[lang] = !!currencies[lang];
        });
        setLanguageOverrides(overrides);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Hata",
        description: "Ayarlar yüklenirken bir hata oluştu",
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
        title: "Başarılı",
        description: "Para birimi ayarları kaydedildi",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Hata",
        description: "Ayarlar kaydedilirken bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOverrideToggle = (language: string, enabled: boolean) => {
    setLanguageOverrides(prev => ({
      ...prev,
      [language]: enabled
    }));
    
    // Override kapatılırsa, o dil için currency'yi sil
    if (!enabled) {
      setLanguageCurrencies(prev => {
        const newCurrencies = { ...prev };
        delete newCurrencies[language];
        return newCurrencies;
      });
    } else {
      // Override açılırsa, primary currency'yi default olarak ayarla
      setLanguageCurrencies(prev => ({
        ...prev,
        [language]: primaryCurrency
      }));
    }
  };

  const handleCurrencyChange = (language: string, currency: string) => {
    setLanguageCurrencies(prev => ({
      ...prev,
      [language]: currency
    }));
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Para Birimi Yönetimi</CardTitle>
        <CardDescription>
          Önce ana para biriminizi seçin. İsterseniz bazı diller için farklı para birimleri kullanabilirsiniz.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Nasıl Çalışır:</strong> Ana para biriminiz <strong>{primaryCurrency}</strong> olarak ayarlanır. 
            Belirli dillerde farklı para birimi göstermek isterseniz, o dilin tikini açıp özel para birimi seçebilirsiniz. 
            Tik kapalıysa, o dil için ana para birimi kullanılır.
          </AlertDescription>
        </Alert>

        {/* Ana Para Birimi */}
        <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
          <Label className="text-base font-semibold">Ana Para Birimi</Label>
          <p className="text-sm text-muted-foreground mb-3">
            Tüm diller için varsayılan olarak kullanılacak para birimi
          </p>
          <Select
            value={primaryCurrency}
            onValueChange={setPrimaryCurrency}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Ana para birimi seçin" />
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

        {/* Dil Bazlı Override'lar */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-semibold">Dil Bazlı Para Birimi Ayarları</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Her dilin yanındaki tiki açarak o dil için farklı para birimi seçebilirsiniz
            </p>
          </div>

          {enabledLanguages.map((lang) => {
            const isOverridden = languageOverrides[lang] || false;
            const activeCurrency = isOverridden ? (languageCurrencies[lang] || primaryCurrency) : primaryCurrency;
            
            return (
              <div key={lang} className="p-4 border rounded-lg bg-muted/20">
                <div className="flex items-center gap-3 mb-3">
                  <Switch
                    id={`override-${lang}`}
                    checked={isOverridden}
                    onCheckedChange={(checked) => handleOverrideToggle(lang, checked)}
                  />
                  <Label 
                    htmlFor={`override-${lang}`}
                    className="text-base font-medium cursor-pointer"
                  >
                    {LANGUAGE_LABELS[lang] || lang}
                  </Label>
                  <div className="ml-auto text-sm">
                    <span className="text-muted-foreground">Kullanılacak para birimi: </span>
                    <span className="font-semibold text-foreground">{activeCurrency}</span>
                  </div>
                </div>
                
                {isOverridden && (
                  <div className="pl-11">
                    <Select
                      value={activeCurrency}
                      onValueChange={(value) => handleCurrencyChange(lang, value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Para birimi seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.symbol} {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-2">
                      Bu dilde turlar ve fiyatlar <strong>{activeCurrency}</strong> ile gösterilecek
                    </p>
                  </div>
                )}
                
                {!isOverridden && (
                  <div className="pl-11 text-sm text-muted-foreground">
                    Bu dil için ana para birimi (<strong>{primaryCurrency}</strong>) kullanılacak
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="w-full mt-6"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Kaydediliyor...
            </>
          ) : (
            'Kaydet'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}