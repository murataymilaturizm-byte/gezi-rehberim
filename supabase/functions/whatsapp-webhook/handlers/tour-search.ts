// Tour search handler

import { searchToursWithAI } from '../services/tour.ts';
import { getUserProfile, updateUserPreferences } from '../services/profile.ts';
import { formatToursResponse } from '../utils/format.ts';

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

  // Update user's last search
  await updateUserPreferences(supabase, phone, agencyId, {
    last_search_query: userMessage
  });

  // Format and return response
  return formatToursResponse(tours, language);
}
