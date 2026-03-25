// Tour search and formatting service

import type { Tour, UserProfile } from '../types.ts';
import { callAI } from './ai.ts';
import { getConversationHistory } from './conversation.ts';
import { getLanguageName } from './language.ts';

/**
 * Calculate remaining quota for a tour date by subtracting sold registrations
 */
async function enrichDatesWithSoldPax(supabase: any, dates: any[]): Promise<any[]> {
  if (!dates || dates.length === 0) return [];
  
  const dateIds = dates.map(d => d.id);
  const { data: regData } = await supabase
    .from('registrations')
    .select('tour_date_id, pax')
    .in('tour_date_id', dateIds)
    .neq('status', 'CANCELLED');
  
  const soldMap: Record<string, number> = {};
  if (regData) {
    for (const reg of regData) {
      soldMap[reg.tour_date_id] = (soldMap[reg.tour_date_id] || 0) + reg.pax;
    }
  }
  
  return dates.map(d => ({
    ...d,
    sold_pax: soldMap[d.id] || 0,
    remaining_quota: d.quota - (soldMap[d.id] || 0)
  }));
}

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

SEARCH RULES:
1. 🔴 DESTINATION MATCH: If user mentions a place (e.g. "Kapadokya", "Pamukkale"), return ALL tours where destination contains that place
2. BROAD MATCHING: "Kapadokya" should match "Kapadokya Balon Turu", "Kapadokya Turu", "Kapadokya Gezisi" etc.
3. TYPE MATCH: If user specifies tour type (day trip, 2N3D), filter by type field
4. DATE: If specific date mentioned, consider it but don't be too strict

From user's message extract:
- Destination (the most important - match destination field)
- Tour type (day trip=DAYTRIP, 2 nights=N2, 3 nights=N3)
- Date preference (if mentioned)

Return matching tour IDs as JSON array. ONLY return JSON array, nothing else.
Example: ["id1", "id2"]
If no tours match, return empty array: []

IMPORTANT: 
- ONLY return JSON array, no markdown format!
- Prioritize destination matching over everything
- Be inclusive - better to return multiple tours than miss one`
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

    // Filter matched tours and enrich with sold pax
    const matchedToursRaw = (allTours || []).filter((tour: any) => matchedIds.includes(tour.id));
    
    const matchedTours = [];
    for (const tour of matchedToursRaw) {
      const enrichedDates = await enrichDatesWithSoldPax(supabase, tour.dates || []);
      const availableDates = enrichedDates.filter((d: any) => {
        const depDate = new Date(d.departure_date);
        return depDate >= new Date() && d.remaining_quota > 0;
      });
      
      if (availableDates.length > 0) {
        matchedTours.push({
          ...tour,
          dates: availableDates
        });
      }
    }

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

    // Enrich with sold pax and filter available dates
    const result = [];
    for (const tour of (tours || [])) {
      const enrichedDates = await enrichDatesWithSoldPax(supabase, tour.dates || []);
      const availableDates = enrichedDates
        .filter((d: any) => {
          const depDate = new Date(d.departure_date);
          return depDate >= new Date() && d.remaining_quota > 0;
        })
        .slice(0, 2); // Only first 2 dates
      
      if (availableDates.length > 0) {
        result.push({ ...tour, dates: availableDates });
      }
    }

    return result;
  } catch (error) {
    console.error('Error getting tours:', error);
    return [];
  }
}
