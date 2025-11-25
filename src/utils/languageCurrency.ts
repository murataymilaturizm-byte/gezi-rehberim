// Utility to get currency for a given language based on agency settings

export const DEFAULT_LANGUAGE_CURRENCIES: Record<string, string> = {
  tr: 'TRY',
  en: 'USD',
  de: 'EUR',
  ru: 'EUR',
  ar: 'SAR',
  fr: 'EUR',
  es: 'EUR'
};

/**
 * Hibrit model: Önce dil bazlı override, sonra primary currency, son olarak default
 */
export function getCurrencyForLanguage(
  language: string,
  options?: {
    languageCurrencies?: Record<string, string> | null;
    primaryCurrency?: string | null;
  }
): string {
  // 1. Önce dil bazlı override'a bak
  if (options?.languageCurrencies && options.languageCurrencies[language]) {
    return options.languageCurrencies[language];
  }
  
  // 2. Primary currency kullan
  if (options?.primaryCurrency) {
    return options.primaryCurrency;
  }
  
  // 3. Default language currency kullan
  return DEFAULT_LANGUAGE_CURRENCIES[language] || 'TRY';
}
