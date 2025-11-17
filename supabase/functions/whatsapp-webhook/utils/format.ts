// Formatting utilities for WhatsApp messages

import type { Tour } from '../types.ts';
import { getLabel } from '../config/labels.ts';

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
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

export function formatTourForWhatsApp(tour: Tour, language: string = 'tr'): string {
  const dateInfo = tour.dates[0];
  if (!dateInfo) return '';

  const parts = [
    `🏖️ *${tour.title}*`,
    `📍 ${tour.destination}`,
    `📅 ${formatDate(dateInfo.departure_date, language)}${dateInfo.return_date && dateInfo.return_date !== dateInfo.departure_date ? ' - ' + formatDate(dateInfo.return_date, language) : ''}`,
    `💰 ${formatPrice(dateInfo.price_adult)} ${tour.currency}`,
    `👥 ${dateInfo.quota > 0 ? dateInfo.quota + ' ' + (language === 'tr' ? 'kişilik kontenjan' : 'spots available') : (language === 'tr' ? 'Kontenjan doldu' : 'Sold out')}`
  ];

  if (tour.program_url) {
    parts.push(`📄 ${language === 'tr' ? 'Program' : 'Program'}: ${tour.program_url}`);
  }

  return parts.join('\n');
}

export function formatToursResponse(tours: Tour[], language: string = 'tr'): string {
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
  const tourStrings = tours.map(tour => formatTourForWhatsApp(tour, language));
  
  return `${header} ✨\n\n${tourStrings.join('\n\n---\n\n')}`;
}

export function truncateForWhatsApp(message: string, maxLength: number = 1600): string {
  if (message.length <= maxLength) {
    return message;
  }
  
  return message.substring(0, maxLength - 50) + '...';
}
