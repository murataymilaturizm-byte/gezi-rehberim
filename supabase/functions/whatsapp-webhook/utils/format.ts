// Formatting utilities for WhatsApp messages

import type { Tour } from '../types.ts';
import { getLabel } from '../config/labels.ts';

// Modular currency system
interface CurrencyConfig {
  code: string;
  symbol: string;
  locale: string;
  decimals: number;
}

const CURRENCIES: Record<string, CurrencyConfig> = {
  TRY: { code: 'TRY', symbol: '₺', locale: 'tr-TR', decimals: 0 },
  USD: { code: 'USD', symbol: '$', locale: 'en-US', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE', decimals: 2 },
  SAR: { code: 'SAR', symbol: 'ر.س', locale: 'ar-SA', decimals: 2 },
  RUB: { code: 'RUB', symbol: '₽', locale: 'ru-RU', decimals: 0 },
};

const DEFAULT_LANGUAGE_CURRENCIES: Record<string, string> = {
  tr: 'TRY',
  en: 'USD',
  de: 'EUR',
  ru: 'RUB',
  ar: 'SAR',
  fr: 'EUR',
  es: 'EUR'
};

const getCurrency = (code: string): CurrencyConfig => {
  return CURRENCIES[code] || CURRENCIES.TRY;
};

function getCurrencyForLanguage(language: string, languageCurrencies?: any): string {
  if (languageCurrencies && languageCurrencies[language]) {
    return languageCurrencies[language];
  }
  return DEFAULT_LANGUAGE_CURRENCIES[language] || 'TRY';
}

async function getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
  if (fromCurrency === toCurrency) return 1;
  
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/get-exchange-rates`, {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      }
    });
    
    if (!response.ok) return 1;
    
    const data = await response.json();
    const rates = data.rates || {};
    
    // Convert from base to target currency
    const fromRate = rates[fromCurrency] || 1;
    const toRate = rates[toCurrency] || 1;
    
    return toRate / fromRate;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return 1;
  }
}

async function convertPrice(price: number, fromCurrency: string, toCurrency: string): Promise<number> {
  const rate = await getExchangeRate(fromCurrency, toCurrency);
  return price * rate;
}

export function formatPrice(price: number, currencyCode: string = 'TRY'): string {
  const currency = getCurrency(currencyCode);
  return new Intl.NumberFormat(currency.locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals
  }).format(price);
}

export function formatDate(dateString: string, language: string = 'tr'): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric' 
  };
  
  const locales: Record<string, string> = {
    tr: 'tr-TR',
    en: 'en-US',
    de: 'de-DE',
    ru: 'ru-RU',
    ar: 'ar-SA',
    fr: 'fr-FR',
    es: 'es-ES'
  };
  
  return date.toLocaleDateString(locales[language] || 'tr-TR', options);
}

export async function formatTourForWhatsApp(
  tour: Tour, 
  language: string = 'tr',
  languageCurrencies?: any
): Promise<string> {
  const dateInfo = tour.dates[0];
  if (!dateInfo) return '';

  const targetCurrency = getCurrencyForLanguage(language, languageCurrencies);
  const convertedPrice = await convertPrice(dateInfo.price_adult, tour.currency, targetCurrency);

  const labels = {
    tr: {
      departure: 'Çıkış Tarihi',
      return: 'Dönüş Tarihi',
      singleDate: 'Tarih',
      quota: 'kişilik kontenjan',
      soldOut: 'Kontenjan doldu'
    },
    en: {
      departure: 'Departure Date',
      return: 'Return Date',
      singleDate: 'Date',
      quota: 'spots available',
      soldOut: 'Sold out'
    },
    de: {
      departure: 'Abfahrtsdatum',
      return: 'Rückkehrdatum',
      singleDate: 'Datum',
      quota: 'verfügbare Plätze',
      soldOut: 'Ausverkauft'
    },
    ru: {
      departure: 'Дата отправления',
      return: 'Дата возвращения',
      singleDate: 'Дата',
      quota: 'мест доступно',
      soldOut: 'Мест нет'
    },
    ar: {
      departure: 'تاريخ المغادرة',
      return: 'تاريخ العودة',
      singleDate: 'التاريخ',
      quota: 'أماكن متاحة',
      soldOut: 'مكتمل'
    },
    fr: {
      departure: 'Date de départ',
      return: 'Date de retour',
      singleDate: 'Date',
      quota: 'places disponibles',
      soldOut: 'Complet'
    },
    es: {
      departure: 'Fecha de salida',
      return: 'Fecha de regreso',
      singleDate: 'Fecha',
      quota: 'plazas disponibles',
      soldOut: 'Completo'
    }
  };

  const lang = labels[language as keyof typeof labels] || labels.tr;

  const parts = [
    `🏖️ *${tour.title}*`,
    `📍 ${tour.destination}`
  ];

  // Format dates with departure/return labels
  if (dateInfo.return_date && dateInfo.return_date !== dateInfo.departure_date) {
    parts.push(`📅 ${lang.departure}: ${formatDate(dateInfo.departure_date, language)}`);
    parts.push(`   ${lang.return}: ${formatDate(dateInfo.return_date, language)}`);
  } else {
    parts.push(`📅 ${lang.singleDate}: ${formatDate(dateInfo.departure_date, language)}`);
  }

  parts.push(`💰 ${formatPrice(convertedPrice, targetCurrency)} ${targetCurrency}`);
  parts.push(`👥 ${dateInfo.quota > 0 ? dateInfo.quota + ' ' + lang.quota : lang.soldOut}`);

  if (tour.program_url) {
    parts.push(`📄 Program: ${tour.program_url}`);
  }

  return parts.join('\n');
}

// Format tours as simple list (summary only, with prices in target currency)
export async function formatToursSummary(
  tours: Tour[], 
  language: string = 'tr',
  languageCurrencies?: any
): Promise<string> {
  const labels = {
    tr: {
      foundTours: '🌟 *Mevcut Turlarımız*',
      moreInfo: '\n\n💬 Hangi tur hakkında detaylı bilgi almak istersiniz?'
    },
    en: {
      foundTours: '🌟 *Our Available Tours*',
      moreInfo: '\n\n💬 Which tour would you like to learn more about?'
    },
    de: {
      foundTours: '🌟 *Unsere verfügbaren Touren*',
      moreInfo: '\n\n💬 Über welche Tour möchten Sie mehr erfahren?'
    },
    ru: {
      foundTours: '🌟 *Наши доступные туры*',
      moreInfo: '\n\n💬 О каком туре вы хотите узнать больше?'
    },
    ar: {
      foundTours: '🌟 *جولاتنا المتاحة*',
      moreInfo: '\n\n💬 عن أي جولة تريد معرفة المزيد؟'
    },
    fr: {
      foundTours: '🌟 *Nos circuits disponibles*',
      moreInfo: '\n\n💬 Sur quel circuit souhaitez-vous en savoir plus?'
    },
    es: {
      foundTours: '🌟 *Nuestros tours disponibles*',
      moreInfo: '\n\n💬 ¿Sobre qué tour te gustaría saber más?'
    }
  };

  const lang = labels[language as keyof typeof labels] || labels.tr;
  const targetCurrency = getCurrencyForLanguage(language, languageCurrencies);

  const tourList = await Promise.all(tours.map(async (tour, index) => {
    const destination = tour.destination ? ` - ${tour.destination}` : '';
    const places = tour.gezilecek_yerler ? `\n   🗺️ ${tour.gezilecek_yerler}` : '';
    
    // Add price info if dates available
    let priceInfo = '';
    if (tour.dates && tour.dates.length > 0) {
      const firstDate = tour.dates[0];
      const convertedPrice = await convertPrice(firstDate.price_adult, tour.currency, targetCurrency);
      priceInfo = `\n   💰 ${formatPrice(convertedPrice, targetCurrency)} ${targetCurrency}`;
    }
    
    return `${index + 1}. 🎯 *${tour.title}*${destination}${places}${priceInfo}`;
  }));

  return `${lang.foundTours}\n\n${tourList.join('\n\n')}${lang.moreInfo}`;
}

// Format single tour as brief summary (not full details)
export async function formatTourBrief(
  tour: Tour, 
  language: string = 'tr',
  languageCurrencies?: any
): Promise<string> {
  const dateInfo = tour.dates[0];
  if (!dateInfo) return '';

  const targetCurrency = getCurrencyForLanguage(language, languageCurrencies);
  const convertedPrice = await convertPrice(dateInfo.price_adult, tour.currency, targetCurrency);

  const labels = {
    tr: {
      departure: 'Çıkış',
      return: 'Dönüş',
      price: 'Fiyat',
      quota: 'Kontenjan',
      spots: 'kişilik',
      soldOut: 'Kontenjan doldu',
      question: '\n\n❓ Bu tur hakkında öğrenmek istediğiniz başka bir şey var mı? (Fiyat, kalkış noktası, vb.)',
      detailOffer: '\n\n📄 İsterseniz detaylı tur programını paylaşabilirim.'
    },
    en: {
      departure: 'Departure',
      return: 'Return',
      price: 'Price',
      quota: 'Quota',
      spots: 'spots',
      soldOut: 'Sold out',
      question: '\n\n❓ Is there anything else you would like to know about this tour? (Price, departure point, etc.)',
      detailOffer: '\n\n📄 I can share the detailed tour program if you wish.'
    },
    de: {
      departure: 'Abfahrt',
      return: 'Rückkehr',
      price: 'Preis',
      quota: 'Kontingent',
      spots: 'Plätze',
      soldOut: 'Ausverkauft',
      question: '\n\n❓ Gibt es noch etwas, das Sie über diese Tour wissen möchten? (Preis, Abfahrtsort, usw.)',
      detailOffer: '\n\n📄 Ich kann Ihnen auf Wunsch das detaillierte Tourprogramm mitteilen.'
    },
    ru: {
      departure: 'Отправление',
      return: 'Возвращение',
      price: 'Цена',
      quota: 'Квота',
      spots: 'мест',
      soldOut: 'Мест нет',
      question: '\n\n❓ Есть ли что-то еще, что вы хотели бы узнать об этом туре? (Цена, место отправления и т.д.)',
      detailOffer: '\n\n📄 При желании могу поделиться подробной программой тура.'
    },
    ar: {
      departure: 'المغادرة',
      return: 'العودة',
      price: 'السعر',
      quota: 'الحصة',
      spots: 'أماكن',
      soldOut: 'مكتمل',
      question: '\n\n❓ هل هناك أي شيء آخر تريد معرفته عن هذه الجولة؟ (السعر، نقطة الانطلاق، إلخ)',
      detailOffer: '\n\n📄 يمكنني مشاركة برنامج الجولة التفصيلي إذا أردت.'
    },
    fr: {
      departure: 'Départ',
      return: 'Retour',
      price: 'Prix',
      quota: 'Quota',
      spots: 'places',
      soldOut: 'Complet',
      question: '\n\n❓ Y a-t-il autre chose que vous aimeriez savoir sur ce circuit? (Prix, point de départ, etc.)',
      detailOffer: '\n\n📄 Je peux partager le programme détaillé du circuit si vous le souhaitez.'
    },
    es: {
      departure: 'Salida',
      return: 'Regreso',
      price: 'Precio',
      quota: 'Cuota',
      spots: 'plazas',
      soldOut: 'Completo',
      question: '\n\n❓ ¿Hay algo más que te gustaría saber sobre este tour? (Precio, punto de salida, etc.)',
      detailOffer: '\n\n📄 Puedo compartir el programa detallado del tour si lo deseas.'
    }
  };

  const lang = labels[language as keyof typeof labels] || labels.tr;

  const parts = [
    `🏖️ *${tour.title}*`,
    `📍 ${tour.destination}`,
    `📅 ${lang.departure}: ${formatDate(dateInfo.departure_date, language)}`
  ];

  if (dateInfo.return_date && dateInfo.return_date !== dateInfo.departure_date) {
    parts.push(`📅 ${lang.return}: ${formatDate(dateInfo.return_date, language)}`);
  }

  parts.push(`💰 ${lang.price}: ${formatPrice(convertedPrice, targetCurrency)} ${targetCurrency}`);
  parts.push(`👥 ${lang.quota}: ${dateInfo.quota > 0 ? dateInfo.quota + ' ' + lang.spots : lang.soldOut}`);

  parts.push(lang.question);
  parts.push(lang.detailOffer);

  return parts.join('\n');
}

export async function formatToursResponse(
  tours: Tour[], 
  language: string = 'tr',
  languageCurrencies?: any
): Promise<string> {
  if (tours.length === 0) {
    const messages: Record<string, string> = {
      tr: 'Üzgünüm, aradığınız kriterlere uygun tur bulamadım. Farklı bir destinasyon veya tarih aralığı deneyelim mi?',
      en: 'Sorry, I couldn\'t find tours matching your criteria. Should we try a different destination or date range?',
      de: 'Entschuldigung, ich konnte keine Touren finden, die Ihren Kriterien entsprechen. Sollen wir ein anderes Ziel oder einen anderen Zeitraum versuchen?',
      ru: 'Извините, я не смог найти туры, соответствующие вашим критериям. Попробуем другое направление или диапазон дат?',
      ar: 'عذرًا، لم أتمكن من العثور على جولات تطابق معاييرك. هل نجرب وجهة أو نطاق تاريخ مختلف؟',
      fr: 'Désolé, je n\'ai pas pu trouver de circuits correspondant à vos critères. Essayons une autre destination ou une autre plage de dates?',
      es: 'Lo siento, no pude encontrar tours que coincidan con tus criterios. ¿Probamos con un destino o rango de fechas diferente?'
    };
    return messages[language] || messages['tr'];
  }

  const header = getLabel('found_tours', language);
  const tourStrings = await Promise.all(
    tours.map(tour => formatTourForWhatsApp(tour, language, languageCurrencies))
  );
  
  return `${header} ✨\n\n${tourStrings.join('\n\n---\n\n')}`;
}

export function truncateForWhatsApp(message: string, maxLength: number = 1600): string {
  if (message.length <= maxLength) {
    return message;
  }
  
  return message.substring(0, maxLength - 50) + '...';
}
