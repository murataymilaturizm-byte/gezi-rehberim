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

export function getCurrencyForLanguage(
  language: string,
  languageCurrencies?: Record<string, string> | null
): string {
  if (languageCurrencies && languageCurrencies[language]) {
    return languageCurrencies[language];
  }
  
  return DEFAULT_LANGUAGE_CURRENCIES[language] || 'TRY';
}
