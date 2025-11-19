// Demo-specific intelligent handler with context awareness

import { callAI } from '../services/ai.ts';
import { validateResponse } from '../services/response-validator.ts';
import { buildPersonalizedContext } from '../services/memory-extractor.ts';
import { 
  STYLE_PERSONALITIES, 
  INTENT_PROMPTS, 
  getBaseSystemPrompt,
  getResponseGuidelines 
} from '../config/prompts.ts';

export async function handleDemoIntelligently(
  message: string,
  conversationHistory: any[],
  intent: string,
  language: string,
  availableTours: any[],
  conversationStyle: string = 'professional',
  conversationState?: any
): Promise<string> {
  // Get state context if available
  const stateContextInfo = conversationState?.stateContext || '';
  
  // Build context-aware system prompt with state info
  const systemPrompt = buildDemoPrompt(intent, language, availableTours, conversationHistory, conversationStyle, conversationState) + stateContextInfo;
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: message }
  ];

  // Lower temperature for more consistent short responses
  let response = await callAI(messages, 0.2);
  
  // Validate and fix response if needed
  const validation = validateResponse(response, conversationStyle, intent);
  
  if (!validation.isValid) {
    console.warn('⚠️ Demo response validation failed:', validation.violations);
    console.log('📝 Original response:', response.substring(0, 100));
    
    if (validation.fixedResponse) {
      response = validation.fixedResponse;
      console.log('✅ Fixed response:', response.substring(0, 100));
    }
  }
  
  return response;
}

// Helper function to format tour context
// Helper function to format date in Turkish format (e.g., "12 Aralık 2026")
function formatTurkishDate(dateString: string): string {
  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];
  
  const date = new Date(dateString);
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${day} ${month} ${year}`;
}

function formatToursContext(tours: any[]): string {
  return tours.map((tour, index) => {
    const parts = [
      `${index + 1}. 🎯 *${tour.title}*`,
      `   📍 ${tour.destination || 'Belirtilmemiş'}`
    ];
    
    if (tour.tur_sure) {
      parts.push(`   ⏱️ Süre: ${tour.tur_sure}`);
    }
    
    if (tour.tur_kategorisi) {
      parts.push(`   🏷️ Kategori: ${tour.tur_kategorisi}`);
    }
    
    if (tour.hareket_noktasi) {
      parts.push(`   🚩 Kalkış: ${tour.hareket_noktasi}`);
    }
    
    if (tour.ulasim) {
      parts.push(`   🚌 Ulaşım: ${tour.ulasim}`);
    }
    
    if (tour.konaklama) {
      parts.push(`   🏨 Konaklama: ${tour.konaklama}`);
    }
    
    if (tour.gezilecek_yerler) {
      parts.push(`   🗺️ Gezilecek Yerler: ${tour.gezilecek_yerler}`);
    }
    
    return parts.join('\n');
  }).join('\n\n');
}

// Helper function to get style personality text
function getStylePersonality(language: string, style: string): string {
  const langStyles = STYLE_PERSONALITIES[language as keyof typeof STYLE_PERSONALITIES];
  if (!langStyles) return STYLE_PERSONALITIES.tr.professional;
  
  return langStyles[style as keyof typeof langStyles] || langStyles.professional;
}

// Helper function to get intent-specific prompt
function getIntentPrompt(intent: string, language: string): string {
  const langPrompts = INTENT_PROMPTS[language as keyof typeof INTENT_PROMPTS];
  if (!langPrompts) return INTENT_PROMPTS.tr[intent as keyof typeof INTENT_PROMPTS.tr] || INTENT_PROMPTS.tr.general;
  
  return langPrompts[intent as keyof typeof langPrompts] || langPrompts.general;
}

function buildDemoPrompt(
  intent: string,
  language: string,
  tours: any[],
  history: any[],
  conversationStyle: string = 'professional',
  conversationState?: any
): string {
  const currentTour = conversationState?.currentTour;
  const wizardStep = conversationState?.wizardStep || 'none';
  const shownTourIds = conversationState?.shownTourIds || [];
  const userMemory = conversationState?.userMemory;
  
  // Extract last discussed tour from history
  const lastDiscussedTour = extractLastTourFromHistory(history);
  
  // Format tours context
  const toursContext = formatToursContext(tours);
  
  // Build personalized context from user memory
  const personalizedContext = userMemory ? buildPersonalizedContext(userMemory, tours, language) : '';
  
  // Get style personality and intent prompt
  const stylePersonality = getStylePersonality(language, conversationStyle);
  const intentPrompt = getIntentPrompt(intent, language);

  // Base system prompt and guidelines
  const basePrompt = getBaseSystemPrompt(language);
  const guidelines = getResponseGuidelines(language);

  // Build the prompt using helper functions and config
  return `${basePrompt}

${guidelines}

🎨 KONUŞMA STİLİ:
${stylePersonality}

${intentPrompt}

📋 MEVCUT TURLAR:
${toursContext}

${personalizedContext}

🎯 KONTEXT BİLGİSİ:
- Şu anki intent: ${intent}
- Wizard adımı: ${wizardStep}
- Seçili tur: ${currentTour || 'Yok'}
- Son bahsedilen tur: ${lastDiscussedTour || 'Yok'}
- Daha önce gösterilen turlar: ${shownTourIds.length > 0 ? shownTourIds.join(', ') : 'Yok'}

⚠️ ÖNEMLİ KURALLAR:
1. Yanıtları KISA ve ÖZ tut (maksimum 4-5 cümle)
2. Markdown formatı kullan (**kalın**, • liste)
3. Fiyatları netleştir (Yetişkin/Çocuk ayrı)
4. Rezervasyon için teşvik et
5. ASLA uzun paragraflar yazma
6. Her yanıtta maksimum 1-2 emoji kullan
7. SAYI ALGILAMA: Kullanıcı kişi sayısı söylediğinde AYNEN o sayıyı kullan! Örnek: "3 kişi" derse 3 kişi yaz!
8. KRİTİK: Rezervasyonda SADECE tam ad-soyad ve telefon iste!
9. REZERVASYON ADIMI: Tüm bilgileri topladıktan sonra özet göster, onay al, SONRA "Rezervasyon başarıyla alındı" mesajı ver
10. ÖDEME BİLGİSİ: Rezervasyon tamamlandıktan sonra otomatik eklenecek, sen bahsetme!`;

  return systemMessage;
}

function extractLastTourFromHistory(history: any[]): string | null {
  const tourPatterns = [
    /Kapadokya Balon Turu/i,
    /Kapadokya Kültür Turu/i,
    /Pamukkale Turu/i,
    /Antalya Rafting/i,
    /Ege Turu/i
  ];

  // Search from newest to oldest
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === 'assistant' || msg.role === 'user') {
      for (const pattern of tourPatterns) {
        const match = msg.content.match(pattern);
        if (match) {
          return match[0];
        }
      }
    }
  }

  return null;
}
