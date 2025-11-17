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

  // Check if user has meaningful conversation history (not just single greeting exchange)
  // Meaningful = at least 2 exchanges (4 messages: user->assistant->user->assistant)
  const hasHistory = history.length >= 4;

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
