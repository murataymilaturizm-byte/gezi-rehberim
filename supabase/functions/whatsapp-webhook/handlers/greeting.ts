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
  const history = await getConversationHistory(supabase, phone, agencyId, 5);

  // Build context
  let additionalContext = '';
  if (userProfile?.last_search_query) {
    const greetingTemplate = getLabel('greeting_context', language);
    additionalContext = '\n\n' + greetingTemplate.replace('{search}', userProfile.last_search_query);
  }

  const messages = [
    {
      role: 'system',
      content: getSystemPrompt(conversationStyle, language) + additionalContext
    },
    ...history,
    {
      role: 'user',
      content: userMessage
    }
  ];

  return await callAI(messages);
}
