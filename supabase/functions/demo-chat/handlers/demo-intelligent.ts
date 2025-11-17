// Demo-specific intelligent handler with context awareness

import { callAI } from '../../whatsapp-webhook/services/ai.ts';

export async function handleDemoIntelligently(
  message: string,
  conversationHistory: any[],
  intent: string,
  language: string,
  availableTours: any[],
  conversationStyle: string = 'professional'
): Promise<string> {
  // Build context-aware system prompt
  const systemPrompt = buildDemoPrompt(intent, language, availableTours, conversationHistory, conversationStyle);
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: message }
  ];

  return await callAI(messages, 0.4);
}

function buildDemoPrompt(
  intent: string,
  language: string,
  tours: any[],
  history: any[],
  conversationStyle: string = 'professional'
): string {
  // Extract last discussed tour from history
  const lastDiscussedTour = extractLastTourFromHistory(history);
  
  const toursContext = tours.map(tour => {
    const dates = tour.dates?.map((d: any) => 
      `${d.departure_date} (${d.price_adult} ${tour.currency})`
    ).join(', ');
    return `- ${tour.title} (${tour.destination})\n  Tarihler: ${dates}`;
  }).join('\n\n');

  // Style-based personality and emoji rules
  const stylePersonality = conversationStyle === 'friendly' 
    ? 'Samimi, sıcak ve dostane bir üslup kullan. Emojiler ekle 😊'
    : conversationStyle === 'casual'
    ? 'Rahat, günlük dilde konuş. Uygun yerlerde emoji kullan.'
    : 'Profesyonel, kibar ve açık bir dil kullan. Emoji kullanma.';

  const basePrompt = `Sen bir seyahat acentesi müşteri hizmetleri asistanısın.
${stylePersonality}

KRİTİK KURALLAR:
1. DİL: ${language} dilinde cevap ver
2. HAFIZA: Önceki mesajları HATIRLA - kullanıcı hangi turdan bahsettiyse context'i koru
3. SELAMLAMA: Sohbet devam ediyorsa ASLA "Merhaba" tekrar etme
4. KISA VE ÖZ: Maksimum 3-4 cümle! Uzun açıklamalar yapma
5. DEMO AÇIKLAMASI YAPMA: "Demo sistemi", "gerçek değil" gibi ifadeler kullanma
6. FORMAT: Sadece önemli bilgileri ver, detaya girme

${lastDiscussedTour ? `Son tartışılan tur: ${lastDiscussedTour}` : ''}

Mevcut Turlar:
${toursContext}

Intent: ${intent}`;

  const intentInstructions: Record<string, string> = {
    'greeting': 'Kısa karşıla (1 cümle), turları sor.',
    'tour.list': 'Tüm turları basit liste formatında göster: "- Tur Adı (Tarih, Fiyat)". Maksimum 5 satır.',
    'tour.search': 'İlgili 2-3 turu göster, kısa açıklama yap.',
    'tour.detail': 'Sadece ÖNEMLİ bilgileri ver: Neler görülecek, fiyat, tarihler. Maksimum 4 cümle.',
    'reservation.wizard': 'Rezervasyon için bilgi topla: Hangi tur, kaç kişi, hangi tarih. Kısa sor.',
    'question': 'Doğrudan ve kısa cevap ver. 2 cümle yeterli.',
    'general': 'Kısa cevapla ve turlara yönlendir. 2-3 cümle.'
  };

  return basePrompt + '\n\n' + (intentInstructions[intent] || intentInstructions['general']);
}

function extractLastTourFromHistory(history: any[]): string | null {
  const tourPatterns = [
    { patterns: ['pamukkale'], name: 'Pamukkale' },
    { patterns: ['kapadokya', 'balon'], name: 'Kapadokya Balon Turu' },
    { patterns: ['antalya', 'rafting'], name: 'Antalya Rafting' },
    { patterns: ['ege', 'çeşme', 'alaçatı'], name: 'Ege Turu' },
    { patterns: ['istanbul'], name: 'İstanbul Turu' }
  ];
  
  // Check assistant messages first (most reliable)
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant') {
      const content = history[i].content.toLowerCase();
      for (const pattern of tourPatterns) {
        if (pattern.patterns.some(p => content.includes(p))) {
          return pattern.name;
        }
      }
    }
  }
  
  // Check user messages
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'user') {
      const content = history[i].content.toLowerCase();
      for (const pattern of tourPatterns) {
        if (pattern.patterns.some(p => content.includes(p))) {
          return pattern.name;
        }
      }
    }
  }
  
  return null;
}
