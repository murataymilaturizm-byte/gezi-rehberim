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

  parts.push(`💰 ${formatPrice(dateInfo.price_adult)} ${tour.currency}`);
  parts.push(`👥 ${dateInfo.quota > 0 ? dateInfo.quota + ' ' + lang.quota : lang.soldOut}`);

  if (tour.program_url) {
    parts.push(`📄 Program: ${tour.program_url}`);
  }

  return parts.join('\n');
}

// Format tours as simple list (summary only)
export function formatToursSummary(tours: Tour[], language: string = 'tr'): string {
  const labels = {
    tr: {
      foundTours: '🎯 Bulduğum turlar',
      moreInfo: '\n\n💡 Herhangi bir tur hakkında daha fazla bilgi almak için tur numarasını yazabilir veya "detay göster" diyebilirsiniz.'
    },
    en: {
      foundTours: '🎯 Tours I found',
      moreInfo: '\n\n💡 For more information about any tour, you can write the tour number or say "show details".'
    },
    de: {
      foundTours: '🎯 Gefundene Touren',
      moreInfo: '\n\n💡 Für weitere Informationen zu einer Tour können Sie die Tournummer eingeben oder "Details zeigen" sagen.'
    },
    ru: {
      foundTours: '🎯 Найденные туры',
      moreInfo: '\n\n💡 Для получения дополнительной информации о туре введите номер тура или скажите "показать детали".'
    },
    ar: {
      foundTours: '🎯 الجولات التي وجدتها',
      moreInfo: '\n\n💡 لمزيد من المعلومات حول أي جولة، يمكنك كتابة رقم الجولة أو قول "إظهار التفاصيل".'
    },
    fr: {
      foundTours: '🎯 Circuits trouvés',
      moreInfo: '\n\n💡 Pour plus d\'informations sur un circuit, vous pouvez écrire le numéro du circuit ou dire "afficher les détails".'
    },
    es: {
      foundTours: '🎯 Tours encontrados',
      moreInfo: '\n\n💡 Para más información sobre cualquier tour, puede escribir el número del tour o decir "mostrar detalles".'
    }
  };

  const lang = labels[language as keyof typeof labels] || labels.tr;

  const tourList = tours.map((tour, index) => {
    const firstDate = tour.dates[0];
    const dateStr = firstDate ? formatDate(firstDate.departure_date, language) : '';
    return `${index + 1}. *${tour.title}*\n   📍 ${tour.destination} | 📅 ${dateStr}`;
  }).join('\n\n');

  return `${lang.foundTours}:\n\n${tourList}${lang.moreInfo}`;
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
