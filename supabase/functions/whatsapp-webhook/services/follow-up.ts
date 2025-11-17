// Follow-up messages service

import { getUserProfile } from './profile.ts';

export async function checkAndSendFollowUp(
  supabase: any,
  phone: string,
  agencyId: string
): Promise<boolean> {
  try {
    const userProfile = await getUserProfile(supabase, phone, agencyId);
    if (!userProfile) return false;

    // Check if follow-up is needed (no interaction in 7+ days)
    if (userProfile.last_interaction_at) {
      const daysSinceInteraction = Math.floor(
        (Date.now() - new Date(userProfile.last_interaction_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      // If 7+ days since last interaction and has previous searches
      if (daysSinceInteraction >= 7 && userProfile.last_search_query) {
        // Check if follow-up already sent recently
        if (userProfile.last_follow_up_sent_at) {
          const daysSinceFollowUp = Math.floor(
            (Date.now() - new Date(userProfile.last_follow_up_sent_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceFollowUp < 14) {
            return false; // Don't send if sent less than 14 days ago
          }
        }

        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking follow-up:', error);
    return false;
  }
}

export function generateFollowUpMessage(
  userProfile: any,
  language: string = 'tr'
): string {
  const messages: Record<string, string> = {
    tr: `Merhaba! 👋

Daha önce "${userProfile.last_search_query}" ile ilgili arama yapmıştınız. 

🎯 Bu destinasyon için yeni turlarımız var! Bilgi almak ister misiniz?

Size nasıl yardımcı olabilirim?`,
    en: `Hello! 👋

You previously searched for "${userProfile.last_search_query}".

🎯 We have new tours for this destination! Would you like information?

How can I help you?`,
    de: `Hallo! 👋

Sie haben zuvor nach "${userProfile.last_search_query}" gesucht.

🎯 Wir haben neue Touren für dieses Ziel! Möchten Sie Informationen?

Wie kann ich Ihnen helfen?`,
    ru: `Здравствуйте! 👋

Вы ранее искали "${userProfile.last_search_query}".

🎯 У нас есть новые туры по этому направлению! Хотите информацию?

Как я могу вам помочь?`,
    ar: `مرحبا! 👋

بحثت سابقًا عن "${userProfile.last_search_query}".

🎯 لدينا جولات جديدة لهذه الوجهة! هل تريد معلومات؟

كيف يمكنني مساعدتك؟`,
    fr: `Bonjour! 👋

Vous avez précédemment recherché "${userProfile.last_search_query}".

🎯 Nous avons de nouveaux circuits pour cette destination! Voulez-vous des informations?

Comment puis-je vous aider?`,
    es: `¡Hola! 👋

Anteriormente buscaste "${userProfile.last_search_query}".

🎯 ¡Tenemos nuevos tours para este destino! ¿Quieres información?

¿Cómo puedo ayudarte?`
  };

  return messages[language] || messages['tr'];
}

export async function markFollowUpSent(
  supabase: any,
  phone: string,
  agencyId: string
) {
  try {
    await supabase
      .from('whatsapp_user_profiles')
      .update({ last_follow_up_sent_at: new Date().toISOString() })
      .eq('phone', phone)
      .eq('agency_id', agencyId);
  } catch (error) {
    console.error('Error marking follow-up sent:', error);
  }
}
