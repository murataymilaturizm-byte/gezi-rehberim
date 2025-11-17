// Demo-specific intelligent handler with context awareness

import { callAI } from '../../whatsapp-webhook/services/ai.ts';

export async function handleDemoIntelligently(
  message: string,
  conversationHistory: any[],
  intent: string,
  language: string,
  availableTours: any[]
): Promise<string> {
  // Build context-aware system prompt
  const systemPrompt = buildDemoPrompt(intent, language, availableTours, conversationHistory);
  
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
  history: any[]
): string {
  // Extract last discussed tour from history
  const lastDiscussedTour = extractLastTourFromHistory(history);
  
  const toursContext = tours.map(tour => {
    const dates = tour.dates?.map((d: any) => 
      `${d.departure_date} (${d.price_adult} ${tour.currency})`
    ).join(', ');
    return `- ${tour.title} (${tour.destination})\n  Tarihler: ${dates}`;
  }).join('\n\n');

  const basePrompt = `Sen bir seyahat acentesi müşteri hizmetleri asistanısın.

KRİTİK KURALLAR:
1. DİL: ${language} dilinde cevap ver
2. HAFIZA: Önceki mesajları HATIRLA - kullanıcı hangi turdan bahsettiyse context'i koru
3. SELAMLAMA: Sohbet devam ediyorsa ASLA "Merhaba" tekrar etme
4. KISA ve ÖZ: 2-3 cümle yeterli
5. EMOJİ: Uygun yerlerde emoji kullan

${lastDiscussedTour ? `Son tartışılan tur: ${lastDiscussedTour}` : ''}

Mevcut Turlar:
${toursContext}

Intent: ${intent}`;

  const intentInstructions: Record<string, string> = {
    'greeting': 'Kısa karşıla, turları sor.',
    'tour.list': 'Tüm turları LİSTE formatında göster.',
    'tour.search': 'İlgili turları göster ve detay sormayı öner.',
    'tour.detail': 'Detaylı bilgi ver: gezilecek yerler, fiyatlar, tarihler.',
    'reservation.wizard': 'Rezervasyon için bilgi topla: tur, tarih, kişi sayısı.',
    'question': 'Doğrudan cevap ver.',
    'general': 'Cevapla ve turlara yönlendir.'
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
