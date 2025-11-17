// General chat handler

import { callAI } from '../services/ai.ts';
import { getConversationHistory } from '../services/conversation.ts';
import { getUserProfile } from '../services/profile.ts';
import { getAllActiveTours } from '../services/tour.ts';
import { getSystemPrompt } from '../utils/prompt.ts';
import { getLabel } from '../config/labels.ts';
import { formatTourForWhatsApp } from '../utils/format.ts';

export async function handleGeneralChat(
  supabase: any,
  phone: string,
  agencyId: string,
  userMessage: string,
  conversationStyle: string
): Promise<string> {
  const userProfile = await getUserProfile(supabase, phone, agencyId);
  const language = userProfile?.language_preference || 'tr';
  const history = await getConversationHistory(supabase, phone, agencyId, 10);

  const hasHistory = history.length > 0;

  // Check if user is requesting detailed tour program
  const detailKeywords = {
    tr: ['detaylı', 'program', 'tam program', 'tüm bilgi', 'detay', 'ayrıntı', 'programı paylaş', 'tüm detaylar'],
    en: ['detailed', 'program', 'full program', 'all info', 'detail', 'share program', 'all details'],
    de: ['detailliert', 'programm', 'vollständiges programm', 'alle infos', 'details'],
    ru: ['подробный', 'программа', 'полная программа', 'все сведения', 'детали'],
    ar: ['تفصيلي', 'برنامج', 'برنامج كامل', 'جميع المعلومات', 'تفاصيل'],
    fr: ['détaillé', 'programme', 'programme complet', 'toutes les infos', 'détails'],
    es: ['detallado', 'programa', 'programa completo', 'toda la info', 'detalles']
  };

  const keywords = detailKeywords[language as keyof typeof detailKeywords] || detailKeywords.tr;
  const isRequestingDetail = keywords.some(keyword => userMessage.toLowerCase().includes(keyword));

  // If requesting detailed program, check if we have a tour in context
  if (isRequestingDetail) {
    const lastDiscussedTour = extractLastTourFromHistory(history);
    if (lastDiscussedTour) {
      const tours = await getAllActiveTours(supabase, agencyId);
      const tour = tours.find(t => t.title === lastDiscussedTour);
      if (tour) {
        return formatTourForWhatsApp(tour, language);
      }
    }
  }

  // Get tours for context - only tour names, DO NOT include dates
  const tours = await getAllActiveTours(supabase, agencyId);
  const toursContext = tours.length > 0 
    ? `\n\nAvailable tours (names only, DO NOT mention specific dates): ${tours.map(t => t.title).join(', ')}`
    : '';

  // Extract last discussed tour from history
  const lastDiscussedTour = extractLastTourFromHistory(history);
  
  // Build user context
  let userContext = '';
  if (userProfile) {
    if (userProfile.preferred_destinations && userProfile.preferred_destinations.length > 0) {
      userContext += `\n${getLabel('user', language)} ${getLabel('preferences', language)}: ${userProfile.preferred_destinations.join(', ')}`;
    }
    if (userProfile.last_search_query) {
      userContext += `\n${getLabel('previous_searches', language)}: ${userProfile.last_search_query}`;
    }
  }

  if (lastDiscussedTour) {
    userContext += `\n\nLast discussed tour: ${lastDiscussedTour}`;
    userContext += `\nIf user asks about price/dates without mentioning a tour, use this tour.`;
  }

  const messages = [
    {
      role: 'system',
      content: getSystemPrompt(conversationStyle, language, hasHistory) + toursContext + userContext
    },
    ...history,
    {
      role: 'user',
      content: userMessage
    }
  ];

  return await callAI(messages);
}

// Helper function to extract last discussed tour from conversation history
function extractLastTourFromHistory(history: any[]): string | null {
  // Define tour patterns to search for
  const tourPatterns = [
    { patterns: ['pamukkale'], name: 'Pamukkale' },
    { patterns: ['kapadokya', 'balon', 'cappadocia'], name: 'Kapadokya' },
    { patterns: ['antalya', 'rafting'], name: 'Antalya Rafting' },
    { patterns: ['ege', 'çeşme', 'alaçatı', 'alacati'], name: 'Ege Turu' },
    { patterns: ['istanbul', 'İstanbul'], name: 'İstanbul' }
  ];
  
  // First pass: Check assistant messages (most reliable)
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant') {
      const content = history[i].content.toLowerCase();
      for (const pattern of tourPatterns) {
        if (pattern.patterns.some(p => content.includes(p.toLowerCase()))) {
          return pattern.name;
        }
      }
    }
  }
  
  // Second pass: Check user messages if not found
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'user') {
      const content = history[i].content.toLowerCase();
      for (const pattern of tourPatterns) {
        if (pattern.patterns.some(p => content.includes(p.toLowerCase()))) {
          return pattern.name;
        }
      }
    }
  }
  
  return null;
}
