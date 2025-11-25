// Modular currency system - easily add new currencies

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  locale: string;
  decimals: number;
}

// Currency configuration - add new currencies here
export const CURRENCIES: Record<string, CurrencyConfig> = {
  TRY: {
    code: 'TRY',
    symbol: '₺',
    name: 'Turkish Lira',
    locale: 'tr-TR',
    decimals: 0,
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    locale: 'en-US',
    decimals: 2,
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    locale: 'de-DE',
    decimals: 2,
  },
  SAR: {
    code: 'SAR',
    symbol: 'ر.س',
    name: 'Saudi Riyal',
    locale: 'ar-SA',
    decimals: 2,
  },
};

// Get all available currencies
export const getAvailableCurrencies = () => {
  return Object.values(CURRENCIES);
};

// Get currency by code
export const getCurrency = (code: string): CurrencyConfig => {
  return CURRENCIES[code] || CURRENCIES.TRY;
};

// Format price with currency
export const formatPrice = (
  amount: number,
  currencyCode: string = 'TRY',
  options?: {
    showSymbol?: boolean;
    showCode?: boolean;
  }
): string => {
  const currency = getCurrency(currencyCode);
  const { showSymbol = true, showCode = true } = options || {};

  const formatted = new Intl.NumberFormat(currency.locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(amount);

  if (showSymbol && showCode) {
    return `${formatted} ${currency.code}`;
  } else if (showSymbol) {
    return `${currency.symbol}${formatted}`;
  } else if (showCode) {
    return `${formatted} ${currency.code}`;
  }
  
  return formatted;
};

// Format price for WhatsApp messages
export const formatPriceForWhatsApp = (
  amount: number,
  currencyCode: string = 'TRY',
  language: string = 'tr'
): string => {
  const currency = getCurrency(currencyCode);
  
  // For Turkish locale, use symbol at the end
  if (language === 'tr') {
    return formatPrice(amount, currencyCode, { showSymbol: true, showCode: true });
  }
  
  // For other locales, use standard format
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(amount);
};

// Get currency symbol
export const getCurrencySymbol = (currencyCode: string): string => {
  return getCurrency(currencyCode).symbol;
};

// Get currency name
export const getCurrencyName = (currencyCode: string): string => {
  return getCurrency(currencyCode).name;
};
