// Message categorization service

import type { MessageIntent } from '../types.ts';

const greetingKeywords: Record<string, string[]> = {
  tr: ['merhaba', 'selam', 'günaydın', 'iyi günler', 'hey', 'slm'],
  en: ['hello', 'hi', 'hey', 'good morning', 'good day', 'greetings'],
  de: ['hallo', 'guten tag', 'guten morgen', 'hi', 'hey'],
  ru: ['привет', 'здравствуйте', 'добрый день', 'доброе утро'],
  ar: ['مرحبا', 'السلام عليكم', 'صباح الخير', 'أهلا'],
  fr: ['bonjour', 'salut', 'bonsoir', 'coucou'],
  es: ['hola', 'buenos días', 'buenas tardes', 'hey']
};

const tourListKeywords: Record<string, string[]> = {
  tr: ['turlar', 'turlarınız', 'hangi turlar', 'tur listesi', 'neler var', 'turlarınızı göster'],
  en: ['tours', 'your tours', 'which tours', 'tour list', 'what tours', 'show tours'],
  de: ['touren', 'ihre touren', 'welche touren', 'tourliste', 'was für touren'],
  ru: ['туры', 'ваши туры', 'какие туры', 'список туров', 'покажите туры'],
  ar: ['جولات', 'جولاتكم', 'ما هي الجولات', 'قائمة الجولات', 'أظهر الجولات'],
  fr: ['circuits', 'vos circuits', 'quels circuits', 'liste des circuits', 'montrez circuits'],
  es: ['tours', 'sus tours', 'qué tours', 'lista de tours', 'mostrar tours']
};

const tourSearchKeywords: Record<string, string[]> = {
  tr: ['kapadokya', 'efes', 'pamukkale', 'ayvalık', 'antalya', 'tur', 'gezi', 'tatil', 'seyahat'],
  en: ['cappadocia', 'ephesus', 'pamukkale', 'tour', 'trip', 'vacation', 'travel'],
  de: ['kappadokien', 'ephesos', 'pamukkale', 'tour', 'reise', 'urlaub'],
  ru: ['каппадокия', 'эфес', 'памуккале', 'тур', 'поездка', 'отпуск'],
  ar: ['كابادوكيا', 'أفسس', 'باموكالي', 'جولة', 'رحلة', 'عطلة'],
  fr: ['cappadoce', 'éphèse', 'pamukkale', 'circuit', 'voyage', 'vacances'],
  es: ['capadocia', 'éfeso', 'pamukkale', 'tour', 'viaje', 'vacaciones']
};

export async function categorizeMessage(
  userMessage: string,
  conversationHistory: any[],
  userLanguage: string = 'tr'
): Promise<MessageIntent> {
  const lowerMessage = userMessage.toLowerCase().trim();
  const hasHistory = conversationHistory && conversationHistory.length > 0;
  
  // PRIORITY 1: Check for reservation/booking intent (highest priority)
  // This catches various ways users express booking intent
  const reservationPatterns = [
    // Direct booking words
    /\b(rezervasyon|kayıt|booking|reserve|ayır|ayırtmak)\b/,
    // Participation intent
    /\b(katıl|katılmak|katılım|gelmek istiyorum|gideceğim)\b/,
    // Action verbs with tour context
    /\b(almak istiyorum|yapmak istiyorum|düşünüyorum|istiyorum)\b/,
  ];
  
  // Check if message matches reservation patterns
  const matchesReservation = reservationPatterns.some(pattern => pattern.test(lowerMessage));
  
  // Extra boost if they mentioned "istiyorum" (I want to) - strong intent signal
  const hasStrongIntent = lowerMessage.includes('istiyorum') || 
                          lowerMessage.includes('isterim') ||
                          lowerMessage.includes('istiyoruz');
  
  if (matchesReservation || (hasStrongIntent && hasHistory)) {
    return { type: 'reservation.wizard', confidence: 0.95 };
  }
  
  // PRIORITY 2: Check for tour list request
  const listKeywords = tourListKeywords[userLanguage] || tourListKeywords['tr'];
  if (listKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return { type: 'tour.list', confidence: 0.9 };
  }
  
  // PRIORITY 3: Check for tour search
  const searchKeywords = tourSearchKeywords[userLanguage] || tourSearchKeywords['tr'];
  if (searchKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return { type: 'tour.search', confidence: 0.8 };
  }
  
  // PRIORITY 4: Check for short greeting ONLY if this is the first message or user explicitly greets
  if (lowerMessage.length < 20) {
    const allGreetings = Object.values(greetingKeywords).flat();
    const isExplicitGreeting = allGreetings.some(g => lowerMessage === g || lowerMessage === g + '!');
    
    // Only categorize as greeting if:
    // 1. This is the first message (no history), OR
    // 2. User sends ONLY a greeting word (exact match)
    if (!hasHistory || isExplicitGreeting) {
      if (allGreetings.some(g => lowerMessage.includes(g))) {
        return { type: 'greeting', confidence: 0.9 };
      }
    }
  }
  
  // Default to general chat (this includes price questions, follow-ups, etc.)
  return { type: 'general', confidence: 0.6 };
}
