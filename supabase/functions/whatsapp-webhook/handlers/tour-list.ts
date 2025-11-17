// Tour list handler

import { callAI } from '../services/ai.ts';
import { getAllActiveTours } from '../services/tour.ts';
import { getUserProfile } from '../services/profile.ts';
import { getSystemPrompt } from '../utils/prompt.ts';
import { getLabel } from '../config/labels.ts';
import { formatDate } from '../utils/format.ts';

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

  // Format tours list with readable dates
  const toursInfo = tours.map((tour, index) => {
    const firstDates = tour.dates.slice(0, 2);
    const datesStr = firstDates.map(d => {
      const labels = {
        tr: { departure: 'Çıkış', return: 'Dönüş' },
        en: { departure: 'Departure', return: 'Return' },
        de: { departure: 'Abfahrt', return: 'Rückkehr' },
        ru: { departure: 'Отправление', return: 'Возвращение' },
        ar: { departure: 'المغادرة', return: 'العودة' },
        fr: { departure: 'Départ', return: 'Retour' },
        es: { departure: 'Salida', return: 'Regreso' }
      };
      const lang = labels[language as keyof typeof labels] || labels.tr;
      
      if (d.return_date && d.return_date !== d.departure_date) {
        return `${lang.departure}: ${formatDate(d.departure_date, language)} - ${lang.return}: ${formatDate(d.return_date, language)}`;
      }
      return formatDate(d.departure_date, language);
    }).join(' | ');
    
    return `${index + 1}. *${tour.title}* (${tour.destination})\n   ${datesStr}`;
  }).join('\n\n');

  const tourListPrompt = getLabel('tour_list_prompt', language);

  const messages = [
    {
      role: 'system',
      content: getSystemPrompt(conversationStyle, language, false) + '\n\n' + tourListPrompt + '\n\nAvailable tours:\n' + toursInfo
    },
    {
      role: 'user',
      content: language === 'tr' ? 'Turlarınızı gösterir misiniz?' : 'Can you show me your tours?'
    }
  ];

  return await callAI(messages);
}
