// Greeting handler

import { callAI } from '../services/ai.ts';
import { getConversationHistory } from '../services/conversation.ts';
import { getUserProfile } from '../services/profile.ts';
import { getSystemPrompt } from '../utils/prompt.ts';
import { getLabel } from '../config/labels.ts';

export async function handleGreeting(
  supabase: any,
  phone: string,
  agencyId: string,
  userMessage: string,
  conversationStyle: string
): Promise<string> {
  // Get user profile and history
  const userProfile = await getUserProfile(supabase, phone, agencyId);
  const language = userProfile?.language_preference || 'tr';
  const history = await getConversationHistory(supabase, phone, agencyId, 10);

  const hasHistory = history.length > 0;

  // Build context - include last search and last discussed tour
  let additionalContext = '';
  if (userProfile?.last_search_query) {
    const greetingTemplate = getLabel('greeting_context', language);
    additionalContext = '\n\n' + greetingTemplate.replace('{search}', userProfile.last_search_query);
  }

  // Extract last discussed tour from history
  const lastDiscussedTour = extractLastTourFromHistory(history);
  if (lastDiscussedTour) {
    additionalContext += `\n\nLast discussed tour: ${lastDiscussedTour}`;
  }

  const messages = [
    {
      role: 'system',
      content: getSystemPrompt(conversationStyle, language, hasHistory) + additionalContext
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
