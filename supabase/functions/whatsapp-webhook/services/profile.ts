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
    email?: string;
    last_search_query?: string;
    preferred_destinations?: string[];
    budget_range?: string;
    preferred_tour_type?: string;
  }
) {
  try {
    // CRM bot-ezme koruması: acente manuel girdiyse (full_name/email mevcut)
    // bot yeni rezervasyon esnasında ÜZERİNE YAZMASIN. "Sadece boşsa yaz"
    // mantığı — bot ilk ismi/e-postayı atar, sonradan acente düzenler.
    const writeable = { ...updates };
    if (writeable.full_name || writeable.email) {
      const existing = await getUserProfile(supabase, phone, agencyId);
      if (existing?.full_name && writeable.full_name) {
        delete writeable.full_name;
      }
      if ((existing as any)?.email && writeable.email) {
        delete writeable.email;
      }
    }
    if (Object.keys(writeable).length === 0) return;

    await supabase
      .from('whatsapp_user_profiles')
      .update(writeable)
      .eq('phone', phone)
      .eq('agency_id', agencyId);
  } catch (error) {
    console.error('Error updating user preferences:', error);
  }
}

export async function enrichConversationInsights(
  supabase: any,
  phone: string,
  agencyId: string,
  userMessage: string,
  assistantResponse: string,
  intent: string
) {
  const profile = await getUserProfile(supabase, phone, agencyId);
  const currentPrefs = (profile?.preferences as any) || {};
  const currentInsights = currentPrefs.conversation_insights || {
    topics_discussed: [],
    questions_asked: [],
    concerns_raised: [],
    positive_signals: [],
    negative_signals: []
  };

  // Extract topics from message
  const tourKeywords = ['kapadokya', 'pamukkale', 'efes', 'antalya', 'ege', 'likya'];
  const mentionedTopics = tourKeywords.filter(keyword => 
    userMessage.toLowerCase().includes(keyword)
  );

  // Detect question patterns
  if (userMessage.includes('?') || 
      userMessage.toLowerCase().match(/ne|nasıl|kaç|hangi|nerede|neden/)) {
    currentInsights.questions_asked.push(userMessage.slice(0, 100));
    currentInsights.questions_asked = currentInsights.questions_asked.slice(-5);
  }

  // Detect positive signals
  const positiveWords = ['teşekkür', 'harika', 'güzel', 'süper', 'mükemmel', 'istiyorum'];
  if (positiveWords.some(word => userMessage.toLowerCase().includes(word))) {
    currentInsights.positive_signals.push(intent);
    currentInsights.positive_signals = [...new Set(currentInsights.positive_signals)].slice(-5);
  }

  // Detect negative signals
  const negativeWords = ['pahalı', 'olmaz', 'istemiyorum', 'hayır', 'iptal'];
  if (negativeWords.some(word => userMessage.toLowerCase().includes(word))) {
    currentInsights.negative_signals.push(intent);
    currentInsights.negative_signals = [...new Set(currentInsights.negative_signals)].slice(-5);
  }

  // Update topics
  if (mentionedTopics.length > 0) {
    currentInsights.topics_discussed = [
      ...new Set([...currentInsights.topics_discussed, ...mentionedTopics])
    ].slice(-10);
  }

  // Save insights
  currentPrefs.conversation_insights = currentInsights;

  await supabase
    .from('whatsapp_user_profiles')
    .update({ 
      preferences: currentPrefs,
      updated_at: new Date().toISOString()
    })
    .eq('phone', phone)
    .eq('agency_id', agencyId);

  console.log('Conversation insights enriched:', currentInsights);
}
