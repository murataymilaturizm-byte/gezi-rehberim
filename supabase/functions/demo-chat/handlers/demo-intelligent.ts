// Demo-specific intelligent handler with context awareness

import { callAI } from '../../whatsapp-webhook/services/ai.ts';
import { validateResponse } from '../services/response-validator.ts';

export async function handleDemoIntelligently(
  message: string,
  conversationHistory: any[],
  intent: string,
  language: string,
  availableTours: any[],
  conversationStyle: string = 'professional',
  conversationState?: any
): Promise<string> {
  // Build context-aware system prompt
  const systemPrompt = buildDemoPrompt(intent, language, availableTours, conversationHistory, conversationStyle, conversationState);
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: message }
  ];

  // Lower temperature for more consistent short responses
  let response = await callAI(messages, 0.2);
  
  // Validate and fix response if needed
  const validation = validateResponse(response, conversationStyle);
  
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

  const basePrompt = `Sen bir seyahat asistanısın. ${stylePersonality}

🚨 ZORUNLU WIZARD KURALLARI 🚨
🔴 ADIM ADIM İLERLE - Kullanıcıdan onay almadan ileri atlama
🔴 TEK SEFERDE HER ŞEYİ VERME - Program + fiyat + kayıt aynı mesajda olmasın
🔴 MERHABA TEKRARI YASAK - Sadece ilk karşılama ve "merhaba/selam" mesajına bir kere cevap ver
🔴 MAKSIMUM 3 CÜMLE - İstisnasız!

HAFIZA KURALLARI:
- Konuşma başladıktan sonra her cevabın başına "Merhaba" yazma
- currentTour dolu mu? Evet ise "hangi tur" diye SORMA
- Kullanıcı fiyat sorarsa ve currentTour varsa, o tur için cevap ver
- Daha önce gösterilen turları tekrar gösterme (shownTourIds: ${JSON.stringify(shownTourIds)})

WIZARD AKIŞI:
${currentTour ? `
✅ SEÇİLİ TUR: ${currentTour.title} (${currentTour.destination})
📍 Wizard Adımı: ${wizardStep}

Kullanıcı şu işlemleri yapabilir:
1️⃣ Detaylı programı görmek
2️⃣ Fiyat öğrenmek (kişi sayısına göre)
3️⃣ Kayıt/rezervasyon başlatmak

🔴 KULLANICI İSTEMEDEN PROGRAM GÖNDERME!
🔴 FIYAT SORARSA "hangi tur" diye SORMA - currentTour var!
` : `
❌ SEÇİLİ TUR YOK
Kullanıcı tur seçmeli → Sonra 3 seçenek sun (detay/fiyat/kayıt)
`}

TEMEL KURALLAR:
- DİL: ${language === 'tr' ? 'Türkçe' : language === 'en' ? 'English' : language === 'de' ? 'Deutsch' : language === 'ru' ? 'Русский' : language === 'ar' ? 'العربية' : language === 'fr' ? 'Français' : 'Español'}
- TARİH: Her zaman konuşma dilinle göster (15 Aralık 2025)
- DOĞRULUK: Sadece verilen tur bilgilerini kullan
- DETAY YASAK: Gün gün program detaylarını asla yazma

${lastDiscussedTour ? `Son tartışılan tur: ${lastDiscussedTour}` : ''}

Mevcut Turlar:
${toursContext}

Intent: ${intent}`;

  let intentInstructions = '';
  
  if (intent === 'greeting') {
    const hasHistory = history.length > 0 && history.some((h: any) => h.role === 'assistant');
    if (!hasHistory) {
      intentInstructions = '🔴 İLK SELAMLAMA: Kısa karşılama + "Gitmek istediğin bölgeyi veya tur türünü yazarsan sana uygun turları listeleyebilirim." (max 2 cümle)';
    } else {
      intentInstructions = '🔴 TEKRAR SELAMLAMA YASAK - Kullanıcı sadece "merhaba/selam" yazmışsa kısa cevap ver, yoksa normal devam et.';
    }
  } else if (intent === 'tour.list' || intent === 'tour.search') {
    intentInstructions = `🔴 TUR LİSTESİ ADIMI:
- SADECE liste göster, başka hiçbir şey ekleme
- Her tur için: numara, ad, bölge, tarih(ler)
- Program/fiyat/detay YASAK
- Son satır: "Hangi turla ilgileniyorsunuz? Numara veya tur adını yazabilirsiniz. 🙂"
- MAX 5 satır tur listesi`;
  } else if (intent === 'tour.detail') {
    if (wizardStep === 'none' || wizardStep === 'tour_selected') {
      intentInstructions = `🔴 TUR SEÇİLDİ - 3 SEÇENEK SUN:
1️⃣ Detaylı tur programını gör
2️⃣ Fiyat öğren (kişi sayısına göre)
3️⃣ Kayıt / ön rezervasyon başlat

"Bu turla ilgili ne yapmak istersiniz?" diye sor.
🔴 PROGRAM OTOMATIK GÖNDERME!`;
    } else if (wizardStep === 'action_choice') {
      intentInstructions = `🔴 KULLANICI SEÇİM YAPTI:
- "detay/program" → Detaylı programı göster
- "fiyat" → Fiyat hesapla
- "kayıt/rezervasyon" → Kayıt başlat
Sadece seçilen işlemi yap!`;
    } else {
      intentInstructions = '🔴 TUR DETAYI: Kısa özet (max 3 cümle), gün gün program YASAK.';
    }
  } else if (intent === 'price.inquiry') {
    if (currentTour) {
      intentInstructions = `🔴 FİYAT HESAPLAMA:
- currentTour VAR: ${currentTour.title}
- "Hangi tur?" diye ASLA SORMA
- Kullanıcının verdiği kişi sayısına göre hesapla
- Format: "Yetişkin: X x FIYAT, Çocuk: Y x FIYAT, Toplam: Z"
- Son satır: "Dilersen detaylı programı paylaşabilirim veya kayıt başlatabilirim. (Program / Kayıt)"`;
    } else {
      intentInstructions = '🔴 FİYAT SORU: currentTour YOK, "Hangi turumuz için fiyat öğrenmek istiyorsunuz?" sor.';
    }
  } else if (intent === 'reservation.wizard') {
    intentInstructions = '🔴 REZERVASYON: Kısa onay + tarih seçimi başlat (max 2 cümle).';
  } else if (intent === 'faq' || intent === 'question') {
    intentInstructions = '🔴 SSS: Direkt cevap ver (max 2 cümle).';
  } else {
    intentInstructions = '🔴 GENEL: Kısa ve net cevap (max 3 cümle).';
  }

  return basePrompt + '\n\n' + intentInstructions;
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
