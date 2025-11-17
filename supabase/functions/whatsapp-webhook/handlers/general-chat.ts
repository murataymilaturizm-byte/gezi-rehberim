// General chat handler

import { callAI } from '../services/ai.ts';
import { getConversationHistory } from '../services/conversation.ts';
import { getUserProfile } from '../services/profile.ts';
import { getAllActiveTours } from '../services/tour.ts';
import { getSystemPrompt } from '../utils/prompt.ts';
import { getLabel } from '../config/labels.ts';

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

  // Get tours for context
  const tours = await getAllActiveTours(supabase, agencyId);
  const toursContext = tours.length > 0 
    ? `\n\nAvailable tours: ${tours.map(t => `${t.title} (${t.destination})`).join(', ')}`
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
  for (let i = history.length - 1; i >= 0; i--) {
    const content = history[i].content.toLowerCase();
    // Look for tour names in the last few messages
    if (content.includes('pamukkale')) return 'Pamukkale';
    if (content.includes('kapadokya')) return 'Kapadokya';
    if (content.includes('balon')) return 'Kapadokya Balon Turu';
    if (content.includes('antalya') || content.includes('rafting')) return 'Antalya Rafting';
    if (content.includes('ege') || content.includes('çeşme') || content.includes('alaçatı')) return 'Ege Turu';
    if (content.includes('istanbul')) return 'İstanbul';
  }
  return null;
}
