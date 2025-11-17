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

  // Lower temperature for more consistent short responses
  return await callAI(messages, 0.2);
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

🚨 ZORUNLU KURALLAR - KESINLIKLE UYULMALI:
1. DİL: ${language} dilinde cevap ver
2. HAFIZA: Önceki mesajları HATIRLA - context'i koru
3. SELAMLAMA: Sohbet devam ediyorsa ASLA "Merhaba" tekrar etme
4. 🔴 KISA VE ÖZ: MAKSIMUM 3 CÜMLE! Bu kurala KESINLIKLE uy! Daha uzun yazma!
5. 🔴 DEMO AÇIKLAMASI YASAK: "Demo", "demo sistemi", "gerçek değil" kelimelerini ASLA kullanma!
6. 🔴 FORMAT: Detaylı program, günlük plan YASAK! Sadece özet bilgi ver
7. 🔴 PARAGRAF YASAK: Uzun paragraflar yazma! Her satır kısa olmalı

${lastDiscussedTour ? `Son tartışılan tur: ${lastDiscussedTour}` : ''}

Mevcut Turlar:
${toursContext}

Intent: ${intent}`;

  const intentInstructions: Record<string, string> = {
    'greeting': '🔴 TEK CÜMLE: "Merhaba! Hangi tura ilgi duyuyorsunuz?" gibi kısa sor.',
    'tour.list': '🔴 5 SATIR MAX: "- Tur (Tarih, Fiyat)" formatında. Her satır 1 tur. DETAY YASAK!',
    'tour.search': '🔴 2-3 TUR: İsim, tarih, fiyat. DETAY YASAK!',
    'tour.detail': '🔴 3 CÜMLE MAX: Neler görülecek + Fiyat + Tarih. Program detayı YASAK!',
    'reservation.wizard': '🔴 KISA SOR: "Hangi tur ve tarih?" gibi tek soruda topla.',
    'question': '🔴 2 CÜMLE: Direkt cevap ver.',
    'general': '🔴 2 CÜMLE: Cevapla + tura yönlendir.'
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
