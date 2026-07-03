// Localization utilities for multilingual tour content

/**
 * Picks the localized value from a tour object based on language
 * Falls back to base field (Turkish) if translation is not available
 * 
 * @param tour - Tour object with potential multilingual fields
 * @param baseField - Base field name (e.g., "title", "destination")
 * @param lang - Language code (en, de, ru, ar, fr, es)
 * @returns Localized value or fallback to Turkish
 */
export function pickLocalized(tour: any, baseField: string, lang: string): string {
  // If language is Turkish or not specified, return base field
  if (!lang || lang === 'tr') {
    return tour[baseField] || '';
  }

  // Construct the localized field name (e.g., "title_en", "destination_de")
  const localizedField = `${baseField}_${lang}`;
  
  // Return localized field if it exists and is not empty, otherwise fallback to base
  const localizedValue = tour[localizedField];
  if (localizedValue && localizedValue.trim() !== '') {
    return localizedValue;
  }
  
  // Fallback to Turkish (base field)
  return tour[baseField] || '';
}

/**
 * Detects explicit language change requests in user messages
 * Looks for patterns like "let's continue in English", "Deutsche Sprache bitte", etc.
 * 
 * @param message - User's message
 * @returns Language code if change is detected, null otherwise
 */
export function detectLanguageChangeIntent(message: string): string | null {
  const lowerMessage = message.toLowerCase().trim();

  // English patterns
  if (
    lowerMessage.includes('english please') ||
    lowerMessage.includes('in english') ||
    lowerMessage.includes('speak english') ||
    lowerMessage.includes('continue in english') ||
    lowerMessage.includes('switch to english') ||
    lowerMessage.includes('ingilizce') ||
    lowerMessage.includes('inglés') ||
    lowerMessage.includes('inglese') ||
    /let'?s.*english/.test(lowerMessage)
  ) {
    return 'en';
  }

  // German patterns
  if (
    lowerMessage.includes('deutsch bitte') ||
    lowerMessage.includes('auf deutsch') ||
    lowerMessage.includes('in german') ||
    lowerMessage.includes('deutsche sprache') ||
    lowerMessage.includes('speak german') ||
    lowerMessage.includes('almanca') ||
    lowerMessage.includes('alemán')
  ) {
    return 'de';
  }

  // Turkish patterns
  if (
    lowerMessage.includes('türkçe') ||
    lowerMessage.includes('turkce') ||
    lowerMessage.includes('in turkish') ||
    lowerMessage.includes('speak turkish') ||
    lowerMessage.includes('turco') ||
    /türk[cç]e.*devam/.test(lowerMessage) ||
    /türk[cç]e.*konu[şs]/.test(lowerMessage)
  ) {
    return 'tr';
  }

  // Russian patterns
  if (
    lowerMessage.includes('по-русски') ||
    lowerMessage.includes('на русском') ||
    lowerMessage.includes('in russian') ||
    lowerMessage.includes('speak russian') ||
    lowerMessage.includes('русский язык') ||
    lowerMessage.includes('rusça')
  ) {
    return 'ru';
  }

  // Arabic patterns
  if (
    lowerMessage.includes('بالعربي') ||
    lowerMessage.includes('العربية') ||
    lowerMessage.includes('in arabic') ||
    lowerMessage.includes('speak arabic') ||
    lowerMessage.includes('arapça')
  ) {
    return 'ar';
  }

  // French patterns
  if (
    lowerMessage.includes('en français') ||
    lowerMessage.includes('in french') ||
    lowerMessage.includes('speak french') ||
    lowerMessage.includes('langue française') ||
    lowerMessage.includes('fransızca')
  ) {
    return 'fr';
  }

  // Spanish patterns
  if (
    lowerMessage.includes('en español') ||
    lowerMessage.includes('in spanish') ||
    lowerMessage.includes('speak spanish') ||
    lowerMessage.includes('idioma español') ||
    lowerMessage.includes('ispanyolca')
  ) {
    return 'es';
  }

  return null;
}

/**
 * Gets a sensible default tone based on language
 * 
 * @param language - Language code
 * @returns Default tone for that language
 */
export function getDefaultToneForLanguage(language: string): string {
  const defaults: Record<string, string> = {
    tr: 'standart',
    en: 'standart',
    de: 'kurumsal', // Germans tend to prefer more formal communication
    ru: 'standart',
    ar: 'standart',
    fr: 'standart',
    es: 'standart'
  };

  return defaults[language] || 'standart';
}

/**
 * Formats a date string according to language preferences
 * 
 * @param dateString - ISO date string or date in format YYYY-MM-DD
 * @param language - Language code
 * @returns Formatted date string
 */
export function formatDateForLanguage(dateString: string, language: string): string {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString; // Return original if invalid
    }

    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    const monthNames: Record<string, string[]> = {
      tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
           'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
      en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 
           'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
      ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 
           'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
      ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
           'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
      fr: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin',
           'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
      es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
           'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    };

    const months = monthNames[language] || monthNames.en;
    const monthName = months[month];

    // Format based on language preferences
    switch (language) {
      case 'en':
        return `${monthName} ${day}, ${year}`;
      case 'tr':
      case 'de':
        return `${day}.${(month + 1).toString().padStart(2, '0')}.${year}`;
      case 'ru':
        return `${day} ${monthName} ${year}`;
      case 'ar':
        return `${day} ${monthName} ${year}`;
      case 'fr':
        return `${day} ${monthName} ${year}`;
      case 'es':
        return `${day} ${monthName} ${year}`;
      default:
        return `${day}.${(month + 1).toString().padStart(2, '0')}.${year}`;
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString; // Return original if formatting fails
  }
}

/**
 * 2026-07-03 P4: Gün adı KODDAN hesaplanır — LLM'e bırakılmaz.
 * Canlı bug: LLM 12.12.2026'ya "Cuma" dedi (gerçek: Cumartesi).
 * Intl.DateTimeFormat locale'leri 7 dili hazır verir (elle liste yok).
 * timeZone Europe/Istanbul SABİT — UTC kayması günü kaydırmasın
 * (DB DATE "2026-12-12" → new Date UTC-midnight; TZ'siz format sunucu
 * TZ'sine göre farklı gün basabilirdi).
 * Hata/geçersiz tarih → boş string (çağıran taraf parantezi hiç basmaz).
 */
const WEEKDAY_LOCALES: Record<string, string> = {
  tr: 'tr-TR', en: 'en-US', de: 'de-DE', ru: 'ru-RU',
  ar: 'ar-EG', fr: 'fr-FR', es: 'es-ES',
};
export function getWeekdayName(dateString: string, language: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(WEEKDAY_LOCALES[language] || WEEKDAY_LOCALES.en, {
      weekday: 'long',
      timeZone: 'Europe/Istanbul',
    }).format(date);
  } catch (_e) {
    return '';
  }
}
