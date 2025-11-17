// User profile management service

import type { UserProfile } from '../types.ts';
import { detectLanguage } from './language.ts';

export async function getUserProfile(
  supabase: any,
  phone: string,
  agencyId: string
): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('whatsapp_user_profiles')
      .select('*')
      .eq('phone', phone)
      .eq('agency_id', agencyId)
      .single();

    if (error) {
      console.log('User profile not found, will be created');
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

export async function upsertUserProfile(
  supabase: any,
  phone: string,
  agencyId: string,
  userMessage: string,
  enabledLanguages: string[] = []
) {
  try {
    const existingProfile = await getUserProfile(supabase, phone, agencyId);

    if (existingProfile) {
      // Update existing profile
      const updates: any = {
        total_messages: (existingProfile.total_messages || 0) + 1,
        last_interaction_at: new Date().toISOString()
      };

      // Detect and update language if not set or changed
      if (!existingProfile.language_preference && userMessage) {
        const detectedLanguage = await detectLanguage(userMessage);
        if (detectedLanguage) {
          if (enabledLanguages.length > 0 && !enabledLanguages.includes(detectedLanguage)) {
            updates.language_preference = enabledLanguages[0];
          } else {
            updates.language_preference = detectedLanguage;
          }
        }
      }

      await supabase
        .from('whatsapp_user_profiles')
        .update(updates)
        .eq('phone', phone)
        .eq('agency_id', agencyId);
    } else {
      // Create new profile
      const newProfile: any = {
        phone,
        agency_id: agencyId,
        total_messages: 1,
        first_interaction_at: new Date().toISOString(),
        last_interaction_at: new Date().toISOString()
      };

      if (userMessage) {
        const detectedLanguage = await detectLanguage(userMessage);
        if (detectedLanguage) {
          if (enabledLanguages.length > 0 && !enabledLanguages.includes(detectedLanguage)) {
            newProfile.language_preference = enabledLanguages[0];
          } else {
            newProfile.language_preference = detectedLanguage;
          }
        }
      }

      await supabase
        .from('whatsapp_user_profiles')
        .insert(newProfile);
    }
  } catch (error) {
    console.error('Error upserting user profile:', error);
  }
}

export async function updateUserPreferences(
  supabase: any,
  phone: string,
  agencyId: string,
  updates: {
    full_name?: string;
    last_search_query?: string;
    preferred_destinations?: string[];
    budget_range?: string;
    preferred_tour_type?: string;
  }
) {
  try {
    await supabase
      .from('whatsapp_user_profiles')
      .update(updates)
      .eq('phone', phone)
      .eq('agency_id', agencyId);
  } catch (error) {
    console.error('Error updating user preferences:', error);
  }
}
