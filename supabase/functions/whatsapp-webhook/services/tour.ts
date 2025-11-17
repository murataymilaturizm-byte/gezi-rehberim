// Tour search and formatting service

import type { Tour, UserProfile } from '../types.ts';
import { callAI } from './ai.ts';
import { getConversationHistory } from './conversation.ts';
import { getLanguageName } from './language.ts';

export async function searchToursWithAI(
  supabase: any,
  userMessage: string,
  phone: string,
  agencyId: string
): Promise<Tour[]> {
  try {
    // Get user profile
    const { data: userProfile } = await supabase
      .from('whatsapp_user_profiles')
      .select('*')
      .eq('phone', phone)
      .eq('agency_id', agencyId)
      .single();

    const language = userProfile?.language_preference || 'tr';
    const languageName = getLanguageName(language);

    // Get all tours with dates
    const { data: allTours, error } = await supabase
      .from('tours')
      .select(`
        *,
        dates:tour_dates(
          id,
          departure_date,
          return_date,
          price_adult,
          quota
        )
      `)
      .eq('agency_id', agencyId);

    if (error) throw error;

    // Format tours for AI
    const toursList = (allTours || []).map((tour: any) => ({
      id: tour.id,
      title: tour.title,
      destination: tour.destination,
      type: tour.type,
      description: tour.program_kisa || '',
      places: tour.gezilecek_yerler || ''
    }));

    // Get conversation history
    const history = await getConversationHistory(supabase, phone, agencyId, 10);

    // Build user context
    let userContext = '';
    if (userProfile) {
      if (userProfile.preferred_destinations?.length > 0) {
        userContext += `\nUser previously interested in: ${userProfile.preferred_destinations.join(', ')}`;
      }
      if (userProfile.budget_range) {
        userContext += `\nBudget range: ${userProfile.budget_range}`;
      }
      if (userProfile.preferred_tour_type) {
        userContext += `\nPreferred tour type: ${userProfile.preferred_tour_type}`;
      }
    }

    const messages = [
      {
        role: 'system',
        content: `You are a tour search assistant. Analyze user's message and conversation history to find matching tours.

LANGUAGE: User prefers ${languageName} - analyze their message in any language they use.

${userContext}

Available Tours: ${JSON.stringify(toursList, null, 2)}

From user's message extract:
- Destination (Cappadocia, Ephesus, Pamukkale, etc)
- Tour type (day trip, 2 nights, 3 nights)
- Date preference (if mentioned)
- Budget expectation (if mentioned)

Return matching tour IDs as JSON array. ONLY return JSON array, nothing else.
Example: ["id1", "id2"]
If no tours match, return empty array: []

IMPORTANT: 
- ONLY return JSON array, no markdown format!
- Consider user profile preferences
- Prioritize tours similar to previous searches`
      },
      ...history,
      {
        role: 'user',
        content: userMessage
      }
    ];

    const aiResponse = await callAI(messages, 0.3);
    let content = aiResponse.trim();

    console.log('🔍 AI search response:', content.substring(0, 200));

    // Clean up markdown wrapper if present
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (content.startsWith('```')) {
      content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Parse tour IDs
    let matchedIds: string[];
    try {
      matchedIds = JSON.parse(content);
      if (!Array.isArray(matchedIds)) {
        console.warn('AI returned non-array JSON, using all tours');
        matchedIds = (allTours || []).map((t: any) => t.id);
      }
    } catch (parseError) {
      console.warn('AI returned non-JSON response, using all tours:', parseError);
      matchedIds = (allTours || []).map((t: any) => t.id);
    }

    // Filter matched tours
    const matchedTours = (allTours || [])
      .filter((tour: any) => matchedIds.includes(tour.id))
      .map((tour: any) => ({
        ...tour,
        dates: (tour.dates || []).filter((d: any) => {
          const depDate = new Date(d.departure_date);
          return depDate >= new Date() && d.quota > 0;
        })
      }))
      .filter((tour: any) => tour.dates.length > 0);

    return matchedTours.slice(0, 5); // Max 5 tours
  } catch (error) {
    console.error('Error searching tours:', error);
    return [];
  }
}

export async function getAllActiveTours(
  supabase: any,
  agencyId: string
): Promise<Tour[]> {
  try {
    const { data: tours, error } = await supabase
      .from('tours')
      .select(`
        *,
        dates:tour_dates(
          id,
          departure_date,
          return_date,
          price_adult,
          quota
        )
      `)
      .eq('agency_id', agencyId);

    if (error) throw error;

    // Filter tours with available dates
    return (tours || [])
      .map((tour: any) => ({
        ...tour,
        dates: (tour.dates || [])
          .filter((d: any) => {
            const depDate = new Date(d.departure_date);
            return depDate >= new Date() && d.quota > 0;
          })
          .slice(0, 2) // Only first 2 dates
      }))
      .filter((tour: any) => tour.dates.length > 0);
  } catch (error) {
    console.error('Error getting tours:', error);
    return [];
  }
}
