import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Globe } from "lucide-react";
import { getAvailableCurrencies } from "@/utils/currency";

interface LanguageCurrencyMapping {
  [key: string]: string;
}

const LANGUAGE_LABELS: Record<string, string> = {
  tr: "🇹🇷 Türkçe",
  en: "🇬🇧 English",
  de: "🇩🇪 Deutsch",
  ru: "🇷🇺 Русский",
  ar: "🇸🇦 العربية",
  fr: "🇫🇷 Français",
  es: "🇪🇸 Español"
};

export function LanguageCurrencySettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [languageCurrencies, setLanguageCurrencies] = useState<LanguageCurrencyMapping>({
    tr: "TRY",
    en: "USD",
    de: "EUR",
    ru: "EUR",
    ar: "SAR",
    fr: "EUR",
    es: "EUR"
  });
  const [enabledLanguages, setEnabledLanguages] = useState<string[]>(['tr']);

  const currencies = getAvailableCurrencies();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      const { data: agency, error } = await supabase
        .from("agencies")
        .select("id, language_currencies, enabled_languages")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      if (agency) {
        setAgencyId(agency.id);
        setEnabledLanguages(agency.enabled_languages || ['tr']);
        
        if (agency.language_currencies) {
          setLanguageCurrencies(agency.language_currencies as LanguageCurrencyMapping);
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast({
        title: "Hata",
        description: "Ayarlar yüklenirken bir hata oluştu",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!agencyId) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from("agencies")
        .update({
          language_currencies: languageCurrencies
        })
        .eq("id", agencyId);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Dil para birimi ayarları kaydedildi"
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Hata",
        description: "Ayarlar kaydedilirken bir hata oluştu",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
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
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          <CardTitle>Dil Para Birimleri</CardTitle>
        </div>
        <CardDescription>
          Her dil için kullanılacak para birimini belirleyin. Müşteriler seçtikleri dilde bu para birimi ile fiyatları görecekler.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {enabledLanguages.map((lang) => (
            <div key={lang} className="space-y-2">
              <Label htmlFor={`currency-${lang}`}>
                {LANGUAGE_LABELS[lang] || lang}
              </Label>
              <Select
                value={languageCurrencies[lang] || "TRY"}
                onValueChange={(value) => handleCurrencyChange(lang, value)}
              >
                <SelectTrigger id={`currency-${lang}`}>
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
          ))}
        </div>

        <div className="pt-4 border-t border-border">
          <div className="bg-accent/50 p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">💡 Önerilen Para Birimleri:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>🇹🇷 Türkçe → TRY (Türk Lirası)</li>
              <li>🇬🇧 English → USD (US Dollar)</li>
              <li>🇩🇪 Deutsch → EUR (Euro)</li>
              <li>🇸🇦 العربية → SAR (Saudi Riyal)</li>
              <li>🇷🇺 Русский → EUR (Euro)</li>
              <li>🇫🇷 Français → EUR (Euro)</li>
              <li>🇪🇸 Español → EUR (Euro)</li>
            </ul>
          </div>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="w-full"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Kaydediliyor...
            </>
          ) : (
            "Kaydet"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
