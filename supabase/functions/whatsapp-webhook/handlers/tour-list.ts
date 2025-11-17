// Tour list handler

import { getAllActiveTours } from '../services/tour.ts';
import { getUserProfile } from '../services/profile.ts';
import { formatToursSummary } from '../utils/format.ts';

export async function handleTourList(
  supabase: any,
  phone: string,
  agencyId: string,
  conversationStyle: string
): Promise<string> {
  const userProfile = await getUserProfile(supabase, phone, agencyId);
  const language = userProfile?.language_preference || 'tr';

  // Get all active tours
  const tours = await getAllActiveTours(supabase, agencyId);

  if (tours.length === 0) {
    const messages: Record<string, string> = {
      tr: 'Şu anda aktif turumuz bulunmamaktadır. Yakında yeni turlar eklenecektir.',
      en: 'We currently have no active tours. New tours will be added soon.',
      de: 'Wir haben derzeit keine aktiven Touren. Neue Touren werden bald hinzugefügt.',
      ru: 'В настоящее время у нас нет активных туров. Скоро будут добавлены новые туры.',
      ar: 'ليس لدينا حاليًا جولات نشطة. سيتم إضافة جولات جديدة قريبًا.',
      fr: 'Nous n\'avons actuellement aucun circuit actif. De nouveaux circuits seront ajoutés prochainement.',
      es: 'Actualmente no tenemos tours activos. Pronto se agregarán nuevos tours.'
    };
    return messages[language] || messages['tr'];
  }

  // Use formatToursSummary for consistent list format
  return formatToursSummary(tours, language);
}
