// Unified intelligent handler with full context awareness

import { callAI } from './ai.ts';
import { getConversationHistory } from './conversation.ts';
import { getUserProfile } from './profile.ts';
import { getConversationState, analyzeConversationPattern } from './conversation-state.ts';
import { searchToursWithAI } from './tour.ts';
import { getLabel } from '../config/labels.ts';
import { validateResponse } from './response-validator.ts';

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
  let response = await callAI(messages, 0.2);
  
  // Validate and fix response if needed
  const validation = validateResponse(response, conversationStyle);
  
  if (!validation.isValid) {
    console.warn('⚠️ Response validation failed:', validation.violations);
    console.log('📝 Original response:', response.substring(0, 100));
    
    if (validation.fixedResponse) {
      response = validation.fixedResponse;
      console.log('✅ Fixed response:', response.substring(0, 100));
    }
  }
  
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
  const currentTour = state?.currentTour;
  const wizardStep = state?.wizardStep || 'none';
  const shownTourIds = state?.shownTourIds || [];
  
  // Style-based personality and emoji rules
  const stylePersonality = conversationStyle === 'friendly' 
    ? 'Samimi, sıcak ve dostane bir üslup kullan. Emojiler ekle 😊'
    : conversationStyle === 'casual'
    ? 'Rahat, günlük dilde konuş. Uygun yerlerde emoji kullan.'
    : 'Profesyonel, kibar ve açık bir dil kullan. Emoji kullanma.';

  const baseRules = `Sen bir seyahat asistanısın. ${stylePersonality}

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

Konuşma Stili: ${conversationStyle}
Mevcut Aşama: ${state.currentStage}
Kullanıcının İlgileri: ${state.userInterests.join(', ') || 'Henüz tespit edilmedi'}
Son Tartışılan Tur: ${state.lastDiscussedTour || 'Yok'}

Intent: ${intent}`;

  // Intent-specific instructions
  let intentInstructions = '';
  
  if (intent === 'greeting') {
    const hasHistory = state.conversationFlow && state.conversationFlow.length > 0;
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

  return baseRules + '\n\n' + intentInstructions;
}
