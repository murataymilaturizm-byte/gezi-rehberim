// Tour search handler

import { searchToursWithAI } from '../services/tour.ts';
import { getUserProfile, updateUserPreferences } from '../services/profile.ts';
import { formatToursSummary, formatTourForWhatsApp } from '../utils/format.ts';
import { getConversationHistory } from '../services/conversation.ts';

export async function handleTourSearch(
  supabase: any,
  phone: string,
  agencyId: string,
  userMessage: string
): Promise<string> {
  const userProfile = await getUserProfile(supabase, phone, agencyId);
  const language = userProfile?.language_preference || 'tr';

  // Search tours with AI
  const tours = await searchToursWithAI(supabase, userMessage, phone, agencyId);

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

  // Check conversation history to see if user is asking for details
  const history = await getConversationHistory(supabase, phone, agencyId, 5);
  const lastAssistantMessage = history.reverse().find((msg: any) => msg.role === 'assistant')?.content || '';
  
  // Check if user is requesting details (keywords like "1", "birinci", "detay", "bilgi", etc.)
  const detailKeywords = {
    tr: ['detay', 'bilgi', 'program', 'daha fazla', 'birinci', 'ikinci', '1.', '2.', '1 ', '2 '],
    en: ['detail', 'info', 'information', 'more', 'first', 'second', '1.', '2.', '1 ', '2 '],
    de: ['detail', 'info', 'information', 'mehr', 'erste', 'zweite', '1.', '2.', '1 ', '2 '],
    ru: ['детали', 'информация', 'больше', 'первый', 'второй', '1.', '2.', '1 ', '2 '],
    ar: ['تفاصيل', 'معلومات', 'المزيد', 'الأول', 'الثاني', '1.', '2.', '1 ', '2 '],
    fr: ['détail', 'info', 'information', 'plus', 'premier', 'deuxième', '1.', '2.', '1 ', '2 '],
    es: ['detalle', 'info', 'información', 'más', 'primero', 'segundo', '1.', '2.', '1 ', '2 ']
  };

  const keywords = detailKeywords[language as keyof typeof detailKeywords] || detailKeywords.tr;
  const isRequestingDetail = keywords.some(keyword => userMessage.toLowerCase().includes(keyword));
  
  // If last message had tour list AND user is requesting details, show detailed info
  if (isRequestingDetail && lastAssistantMessage.includes('📍')) {
    // Extract tour number from message (1, 2, etc)
    const numberMatch = userMessage.match(/\d+/);
    if (numberMatch) {
      const tourIndex = parseInt(numberMatch[0]) - 1;
      if (tourIndex >= 0 && tourIndex < tours.length) {
        // Show detailed info for specific tour
        return formatTourForWhatsApp(tours[tourIndex], language);
      }
    }
    // If can't determine specific tour but asking for details, show first tour details
    return formatTourForWhatsApp(tours[0], language);
  }

  // Update user's last search
  await updateUserPreferences(supabase, phone, agencyId, {
    last_search_query: userMessage
  });

  // Default: Show simple summary list
  return formatToursSummary(tours, language);
}
