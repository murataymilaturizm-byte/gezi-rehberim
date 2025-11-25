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
            <strong>Nasıl Çalışır:</strong> Ana para biriminiz <strong>{primaryCurrency}</strong> olarak varsayılan değerdir. 
            Her dil için istediğiniz para birimini seçebilirsiniz. Seçim yapmazsanız ana para birimi kullanılır.
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

        {/* Dil Bazlı Para Birimi Seçimi */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-semibold">Dil Bazlı Para Birimi Ayarları</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Her dilde WhatsApp mesajlarında hangi para biriminin kullanılacağını seçin
            </p>
          </div>

          <div className="space-y-3">
            {enabledLanguages.map((lang) => {
              const selectedCurrency = languageCurrencies[lang] || '__default__';
              const displayCurrency = selectedCurrency === '__default__' ? primaryCurrency : selectedCurrency;
              
              return (
                <div key={lang} className="p-4 border rounded-lg bg-muted/20">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">
                        {LANGUAGE_LABELS[lang] || lang} Dili
                      </Label>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Kullanılacak: </span>
                        <span className="font-bold text-lg text-primary">{displayCurrency}</span>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm text-muted-foreground mb-2">
                        Bu dilde gösterilecek para birimi:
                      </Label>
                      <Select
                        value={selectedCurrency}
                        onValueChange={(value) => {
                          if (value === '__default__') {
                            setLanguageOverrides(prev => ({ ...prev, [lang]: false }));
                            setLanguageCurrencies(prev => {
                              const newCurrencies = { ...prev };
                              delete newCurrencies[lang];
                              return newCurrencies;
                            });
                          } else {
                            setLanguageOverrides(prev => ({ ...prev, [lang]: true }));
                            setLanguageCurrencies(prev => ({ ...prev, [lang]: value }));
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default__">
                            Ana Para Birimi Kullan ({primaryCurrency})
                          </SelectItem>
                          {currencies.map((currency) => (
                            <SelectItem key={currency.code} value={currency.code}>
                              {currency.symbol} {currency.code} - {currency.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-2">
                        {selectedCurrency === '__default__' 
                          ? `Ana para birimi (${primaryCurrency}) kullanılacak`
                          : `${displayCurrency} para birimi kullanılacak`
                        }
                      </p>
                    </div>
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