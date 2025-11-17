// Tour search handler

import { searchToursWithAI } from '../services/tour.ts';
import { getUserProfile, updateUserPreferences } from '../services/profile.ts';
import { formatToursSummary, formatTourBrief, formatTourForWhatsApp } from '../utils/format.ts';
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

  // Check conversation history to see if user is asking for specific tour or details
  const history = await getConversationHistory(supabase, phone, agencyId, 5);
  const lastAssistantMessage = history.reverse().find((msg: any) => msg.role === 'assistant')?.content || '';
  
  // Keywords for selecting a tour from list
  const tourSelectKeywords = {
    tr: ['birinci', 'ikinci', 'üçüncü', 'dördüncü', 'beşinci', '1.', '2.', '3.', '4.', '5.', '1 ', '2 ', '3 ', '4 ', '5 '],
    en: ['first', 'second', 'third', 'fourth', 'fifth', '1.', '2.', '3.', '4.', '5.', '1 ', '2 ', '3 ', '4 ', '5 '],
    de: ['erste', 'zweite', 'dritte', 'vierte', 'fünfte', '1.', '2.', '3.', '4.', '5.', '1 ', '2 ', '3 ', '4 ', '5 '],
    ru: ['первый', 'второй', 'третий', 'четвертый', 'пятый', '1.', '2.', '3.', '4.', '5.', '1 ', '2 ', '3 ', '4 ', '5 '],
    ar: ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', '1.', '2.', '3.', '4.', '5.', '1 ', '2 ', '3 ', '4 ', '5 '],
    fr: ['premier', 'deuxième', 'troisième', 'quatrième', 'cinquième', '1.', '2.', '3.', '4.', '5.', '1 ', '2 ', '3 ', '4 ', '5 '],
    es: ['primero', 'segundo', 'tercero', 'cuarto', 'quinto', '1.', '2.', '3.', '4.', '5.', '1 ', '2 ', '3 ', '4 ', '5 ']
  };

  const selectKeywords = tourSelectKeywords[language as keyof typeof tourSelectKeywords] || tourSelectKeywords.tr;
  const isSelectingTour = selectKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));
  
  // If user is selecting a tour from the list, show brief summary
  if (isSelectingTour && lastAssistantMessage.includes('🎯')) {
    const numberMatch = userMessage.match(/\d+/);
    if (numberMatch) {
      const tourIndex = parseInt(numberMatch[0]) - 1;
      if (tourIndex >= 0 && tourIndex < tours.length) {
        // Show brief summary with questions
        return formatTourBrief(tours[tourIndex], language);
      }
    }
    // If can't determine specific tour number, show first tour brief
    if (tours.length === 1) {
      return formatTourBrief(tours[0], language);
    }
  }

  // Update user's last search
  await updateUserPreferences(supabase, phone, agencyId, {
    last_search_query: userMessage
  });

  // If multiple tours found, show list
  if (tours.length > 1) {
    return formatToursSummary(tours, language);
  }
  
  // If only one tour found, show brief summary directly
  if (tours.length === 1) {
    return formatTourBrief(tours[0], language);
  }

  return formatToursSummary(tours, language);
}
