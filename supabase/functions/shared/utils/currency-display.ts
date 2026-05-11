/**
 * Chatbot fiyat gösterim yardımcısı.
 * Acentenin kendi para birimini ve müşterinin dil para birimini birlikte gösterir.
 *
 * Kullanım örneği:
 *   const rates = await getExchangeRatesOnce();
 *   formatPriceSync(5000, 'TRY', 'de', rates)  → "142€ (5.000₺)"
 */

import { convertSync } from "./exchange-rates.ts";

// Dile göre varsayılan para birimi
export const LANG_TO_CURRENCY: Record<string, string> = {
  tr: "TRY",
  en: "USD",
  de: "EUR",
  fr: "EUR",
  es: "EUR",
  ru: "RUB",
  ar: "SAR",
};

// Para birimi sembolleri (edge function'da Intl kullanamıyoruz kolayca)
export const CURRENCY_SYMBOLS: Record<string, string> = {
  TRY: "₺",
  USD: "$",
  EUR: "€",
  GBP: "£",
  SAR: "﷼",
  AED: "د.إ",
  RUB: "₽",
  CHF: "CHF",
  JPY: "¥",
  CNY: "¥",
  KWD: "KD",
  QAR: "QR",
};

// Para birimine göre ondalık hane sayısı
const DECIMALS: Record<string, number> = {
  TRY: 0,
  USD: 0,
  EUR: 0,
  GBP: 0,
  SAR: 0,
  AED: 0,
  RUB: 0,
  JPY: 0,
  CNY: 0,
};

function round(amount: number, currency: string): number {
  const decimals = DECIMALS[currency] ?? 0;
  const factor = Math.pow(10, decimals);
  return Math.round(amount * factor) / factor;
}

function symbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

/**
 * Tek fiyat alanını formatlar.
 *
 * @param amount        - Acentenin para biriminde tutar
 * @param agencyCurrency - Acentenin para birimi kodu (ör. "TRY")
 * @param userLanguage   - Müşterinin dili (ör. "de")
 * @param rates          - getExchangeRatesOnce() çıktısı (null ise dönüşüm yapılmaz)
 * @param showDual       - Çift para birimi gösterimi açık mı (acente ayarı)
 * @returns Örn: "142€ (5.000₺)" veya "5.000₺"
 */
export function formatPriceSync(
  amount: number,
  agencyCurrency: string,
  userLanguage: string,
  rates: Record<string, number> | null,
  showDual = true,
): string {
  const userCurrency = LANG_TO_CURRENCY[userLanguage] ?? "USD";
  const agencySym = symbol(agencyCurrency);

  // Orijinal tutarı formatla
  const originalFormatted = `${amount.toLocaleString("tr-TR")}${agencySym}`;

  // Aynı para birimi, toggle kapalı veya kurlar yüklenememiş → tek format
  if (
    userCurrency === agencyCurrency ||
    !showDual ||
    !rates ||
    Object.keys(rates).length === 0
  ) {
    return originalFormatted;
  }

  try {
    const converted = round(convertSync(amount, agencyCurrency, userCurrency, rates), userCurrency);
    if (!isFinite(converted) || converted <= 0) return originalFormatted;

    const userSym = symbol(userCurrency);
    return `${converted.toLocaleString("en-US")}${userSym} (${originalFormatted})`;
  } catch {
    return originalFormatted;
  }
}

/**
 * Dönüşüm notu — çift para birimi gösteriminde kullanıcıya ek açıklama
 */
export const CONVERSION_NOTES: Record<string, string> = {
  tr: "\n_Not: Yaklaşık kur dönüşümü. Kesin fiyat acentenin para birimindedir._",
  en: "\n_Note: Approximate conversion. Final price is in agency currency._",
  de: "\n_Hinweis: Näherungswert. Endpreis in Agenturwährung._",
  ru: "\n_Примечание: Приблизительно. Окончательная цена в валюте агентства._",
  ar: "\n_ملاحظة: تقريبي. السعر النهائي بعملة الوكالة._",
  fr: "\n_Note: Valeur approximative. Prix final dans la devise de l'agence._",
  es: "\n_Nota: Aproximado. El precio final está en la moneda de la agencia._",
};
