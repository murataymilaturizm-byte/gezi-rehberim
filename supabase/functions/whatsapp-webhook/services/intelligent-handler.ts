// Unified intelligent handler with full context awareness

import { callAI } from './ai.ts';
import { getConversationHistory } from './conversation.ts';
import { getUserProfile } from './profile.ts';
import { getConversationState, analyzeConversationPattern } from './conversation-state.ts';
import { searchToursWithAI } from './tour.ts';
import { getLabel } from '../config/labels.ts';

export async function handleIntelligently(
  supabase: any,
  phone: string,
  agencyId: string,
  userMessage: string,
  intent: string,
  conversationStyle: string
): Promise<string> {
  // Gather full context
  const userProfile = await getUserProfile(supabase, phone, agencyId);
  const language = userProfile?.language_preference || 'tr';
  const conversationHistory = await getConversationHistory(supabase, phone, agencyId, 15);
  const conversationState = await getConversationState(supabase, phone, agencyId);
  const pattern = analyzeConversationPattern(conversationState);

  console.log('Intelligent Handler Context:', {
    intent,
    stage: conversationState.currentStage,
    pattern,
    userMessage
  });

  // Build intelligent system prompt
  const systemPrompt = buildIntelligentPrompt(
    intent,
    language,
    conversationStyle,
    conversationState,
    pattern,
    userProfile
  );

  // Get tours data if needed
  let toursContext = '';
  if (['tour.list', 'tour.search', 'tour.detail'].includes(intent)) {
    const tours = await searchToursWithAI(supabase, userMessage, phone, agencyId);
    if (tours && tours.length > 0) {
      toursContext = '\n\nMevcut Turlar:\n' + tours.map(tour => {
        const dates = tour.dates?.map((d: any) => 
          `${d.departure_date} (${d.price_adult}${tour.currency})`
        ).join(', ') || '';
        const tourDuration = (tour as any).tur_sure || tour.type || '-';
        return `- ${tour.title} (${tour.destination})\n  Tarihler: ${dates}\n  Süre: ${tourDuration}`;
      }).join('\n\n');
    }
  }

  // Add adaptive instructions based on pattern
  let adaptiveInstructions = '';
  if (pattern.needsNudge) {
    adaptiveInstructions = `\n\nÖNEMLİ: Kullanıcı turlarla ilgileniyor ama rezervasyon yapmadı. Nazikçe rezervasyon öner ama zorlama.`;
  } else if (pattern.suggestedNextAction === 'show_tour_options') {
    adaptiveInstructions = `\n\nÖNEMLİ: Kullanıcıya tur seçeneklerini göster.`;
  } else if (pattern.suggestedNextAction === 'provide_tour_details') {
    adaptiveInstructions = `\n\nÖNEMLİ: Kullanıcının ilgilendiği tur hakkında detaylı bilgi ver.`;
  }

  const messages = [
    {
      role: 'system',
      content: systemPrompt + toursContext + adaptiveInstructions
    },
    ...conversationHistory,
    {
      role: 'user',
      content: userMessage
    }
  ];

  // Lower temperature for more consistent short responses
  const response = await callAI(messages, 0.2);
  return response;
}

function buildIntelligentPrompt(
  intent: string,
  language: string,
  conversationStyle: string,
  state: any,
  pattern: any,
  profile: any
): string {
  // Style-based personality and emoji rules
  const stylePersonality = conversationStyle === 'friendly' 
    ? 'Samimi, sıcak ve dostane bir üslup kullan. Emojiler ekle 😊'
    : conversationStyle === 'casual'
    ? 'Rahat, günlük dilde konuş. Uygun yerlerde emoji kullan.'
    : 'Profesyonel, kibar ve açık bir dil kullan. Emoji kullanma.';

  const baseRules = `Sen bir seyahat acentesi müşteri hizmetleri asistanısın.
${stylePersonality}

🚨 ZORUNLU KURALLAR - KESINLIKLE UYULMALI:
1. DİL: ${language} dilinde cevap ver
2. SELAMLAMA: Sohbet devam ediyorsa ASLA "Merhaba" deme
3. HAFIZA: Önceki mesajları hatırla ve bağlamı koru
4. 🔴 KISA VE ÖZ: MAKSIMUM 3 CÜMLE! WhatsApp için! Bu kurala KESINLIKLE uy!
5. 🔴 DETAY YASAK: Program detayı, günlük plan YASAK! Sadece özet
6. 🔴 PARAGRAF YASAK: Uzun paragraf yazma! Her satır kısa olmalı

Konuşma Stili: ${conversationStyle}
Mevcut Aşama: ${state.currentStage}
Kullanıcının İlgileri: ${state.userInterests.join(', ') || 'Henüz tespit edilmedi'}
Son Tartışılan Tur: ${state.lastDiscussedTour || 'Yok'}

Intent: ${intent}`;

  // Intent-specific instructions
  const intentInstructions: Record<string, string> = {
    'greeting': `
🔴 TEK CÜMLE: "Merhaba! Hangi tura ilgi duyuyorsunuz?" gibi kısa sor.`,
    
    'tour.list': `
🔴 5 SATIR MAX: "- Tur (Tarih, Fiyat)" formatında. Her satır 1 tur. DETAY YASAK!`,
    
    'tour.search': `
🔴 2-3 TUR: İsim, tarih, fiyat. DETAY YASAK!`,
    
    'tour.detail': `
🔴 3 CÜMLE MAX: Neler görülecek + Fiyat + Tarih. Program detayı YASAK!`,
    
    'reservation.wizard': `
🔴 KISA SOR: "Hangi tur ve tarih?" gibi tek soruda topla.`,
    
    'question': `
🔴 2 CÜMLE: Direkt cevap ver.`,
    
    'general': `
Kısa cevapla ve turlara yönlendir. 2-3 cümle.`
  };

  return baseRules + '\n\n' + (intentInstructions[intent] || intentInstructions['general']);
}
