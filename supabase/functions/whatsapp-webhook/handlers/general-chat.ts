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

  // Get tours for context
  const tours = await getAllActiveTours(supabase, agencyId);
  const toursContext = tours.length > 0 
    ? `\n\nAvailable tours: ${tours.map(t => `${t.title} (${t.destination})`).join(', ')}`
    : '';

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

  const messages = [
    {
      role: 'system',
      content: getSystemPrompt(conversationStyle, language) + toursContext + userContext
    },
    ...history,
    {
      role: 'user',
      content: userMessage
    }
  ];

  return await callAI(messages);
}
