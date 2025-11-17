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
    const tours = await searchToursWithAI(supabase, agencyId, userMessage, language);
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

  const response = await callAI(messages, 0.4);
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
  const baseRules = `Sen bir seyahat acentesi müşteri hizmetleri asistanısın.

KRİTİK KURALLAR:
1. DİL: Kullanıcıya ${language} dilinde cevap ver
2. SELAMLAMA: Sohbet devam ediyorsa ASLA "Merhaba" deme, direkt cevapla
3. HAFIZA: Önceki mesajları hatırla ve bağlamı koru
4. DOĞRULUK: Sadece mevcut turlardaki bilgileri ver
5. KISA VE ÖZ: WhatsApp için uygun kısa mesajlar (1-3 paragraf)
6. EMOJİ: Uygun yerlerde emoji kullan 😊✨📍

Konuşma Stili: ${conversationStyle}
Mevcut Aşama: ${state.currentStage}
Kullanıcının İlgileri: ${state.userInterests.join(', ') || 'Henüz tespit edilmedi'}
Son Tartışılan Tur: ${state.lastDiscussedTour || 'Yok'}

Intent: ${intent}`;

  // Intent-specific instructions
  const intentInstructions: Record<string, string> = {
    'greeting': `
İlk selamlaşma. Kısa ve sıcak karşıla, hemen yardımcı olmaya hazır olduğunu belirt.`,
    
    'tour.list': `
Tüm tur seçeneklerini LİSTE formatında göster:
📍 Tur Adı - Destinasyon
📅 Tarihler
💰 Fiyat

Kısa ve özlü liste formatı kullan.`,
    
    'tour.search': `
Kullanıcının aradığı tura uygun seçenekleri göster.
- Eğer tek tur varsa: Kısa özet ver ve detay sormayı öner
- Eğer birden fazla tur varsa: Liste halinde göster`,
    
    'tour.detail': `
Seçilen tur hakkında detaylı bilgi ver:
- Gezilecek yerler
- Süre, konaklama, ulaşım
- Fiyatlar ve tarihler
- Rezervasyon nasıl yapılır`,
    
    'reservation.wizard': `
Rezervasyon sürecini başlat. Nazikçe şunları sor:
1. Hangi tur?
2. Hangi tarih?
3. Kaç kişi?
4. İsim ve iletişim`,
    
    'question': `
Kullanıcının sorusuna doğrudan ve net cevap ver.
Mevcut tur bilgilerinden yararlan.`,
    
    'general': `
Genel konuşmaya devam et ama fırsatını bul ve turlara yönlendir.`
  };

  return baseRules + '\n\n' + (intentInstructions[intent] || intentInstructions['general']);
}
