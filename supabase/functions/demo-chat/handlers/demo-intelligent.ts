// Demo-specific intelligent handler with context awareness

import { callAI } from '../services/ai.ts';
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
      `${d.departure_date} (Yetişkin: ${d.price_adult}₺, Çocuk: ${d.price_child || 'N/A'}₺)`
    ).join(', ');
    
    return `${tour.title} (${tour.destination})
  📅 Tarihler: ${dates}
  ⏰ Toplanma: ${tour.toplanma_saati || 'Belirtilmemiş'}
  📍 Hareket: ${tour.hareket_noktasi || 'Belirtilmemiş'}
  🚌 Ulaşım: ${tour.ulasim || 'Belirtilmemiş'}
  🏨 Konaklama: ${tour.konaklama || 'Belirtilmemiş'}
  ⏳ Süre: ${tour.tur_sure || 'Belirtilmemiş'}
  🗺️ Gezilecek: ${tour.gezilecek_yerler || 'Belirtilmemiş'}`;
  }).join('\n\n');

  const basePrompt = `Sen bir seyahat asistanısın.

🚨 ZORUNLU WIZARD KURALLARI 🚨
🔴 ADIM 1: Tur listele (sadece liste, detay yok)
🔴 ADIM 2: Kullanıcı seçsin (numara veya isim)
🔴 ADIM 3: "Bu turla ne yapmak istersiniz?" → 1️⃣Detay 2️⃣Fiyat 3️⃣Kayıt
🔴 ADIM 4: Kullanıcının seçimine göre (SADECE o bilgiyi ver)

🔴🔴🔴 MERHABA YASAK 🔴🔴🔴
- İLK MESAJ hariç HİÇBİR ZAMAN "Merhaba", "Hello", "Hi" ile BAŞLAMA
- Konuşma devam ederken ASLA selamlaşma yapma
- Direkt konuya gir

🔴 MAKSIMUM 3-4 CÜMLE (kayıt/liste hariç)

HAFIZA KURALLARI:
${currentTour ? `
✅ SEÇİLİ TUR: ${currentTour.title}
📍 Adım: ${wizardStep}

🔴🔴🔴 HAFIZA ÖNEMLİ 🔴🔴🔴
- currentTour VAR demek kullanıcı BU TURU SEÇMİŞ demek
- "Hangi tur?" diye ASLA SORMA
- Fiyat sorarsa → ${currentTour.title} için hesapla
- Kayıt/rezervasyon derse → ${currentTour.title} için kayıt başlat
- Program derse → ${currentTour.title} programını göster
- Detay isterse → ${currentTour.title} detaylarını ver

${wizardStep === 'tour_selected' ? `
ŞİMDİ NE YAPMALI:
"${currentTour.title} ile ilgili ne yapmak istersiniz?"
1️⃣ Detaylı program
2️⃣ Fiyat öğren
3️⃣ Kayıt/rezervasyon
` : wizardStep === 'booking_started' ? `
KAYIT AŞAMASINDA:
Kullanıcıdan bilgi topla (ad, kişi sayısı, telefon)
` : ''}
` : `
❌ SEÇİLİ TUR YOK
İlk önce tur listele ve kullanıcı seçsin
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
      // Continuing conversation - check if we have a last discussed tour
      if (lastDiscussedTour && lastDiscussedTour !== 'NONE') {
        intentInstructions = `🔴 DEVAM SELAMLAMASI:
- "Tekrar merhaba! 😊" ile başla
- Hatırlat: "Daha önce ${lastDiscussedTour} ile ilgilenmiştiniz."
- Sor: "Bu turla ilgili mi bilgi almak istiyorsunuz yoksa farklı bir konuda mı yardımcı olmamı istersiniz?"
- Max 2-3 cümle, samimi ve sıcak ol`;
      } else {
        intentInstructions = '🔴 TEKRAR SELAMLAMA: Kısa "Tekrar merhaba! 😊 Size nasıl yardımcı olabilirim?" (max 1 cümle)';
      }
    }
  } else if (intent === 'tour.list' || intent === 'tour.search') {
    intentInstructions = `🔴 TUR LİSTESİ/ARAMA ADIMI:
${currentTour ? '⚠️ UYARI: currentTour VAR ama birden fazla eşleşme olabilir!' : ''}

KONTROL ET:
- Kaç tane tur var bu destinasyon/arama için?
- Eğer 2+ tur varsa → MUTLAKA LİSTELE, seçim yaptırma!

FORMAT:
- Her tur için: numara, tam ad, kısa açıklama, tarih
- Örnek: "1. Kapadokya Balon Turu - Sıcak hava balonu deneyimi (15 Aralık, 22 Aralık)"
- Örnek: "2. Kapadokya Kültür Turu - Tarihi yerler (18 Aralık)"
- Son satır: "Hangi turla ilgileniyorsunuz? Numara veya tur adını yazabilirsiniz. 🙂"

🔴 YASAK: Program detayı, fiyat, otomatik seçim yapma!`;
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
    if (currentTour) {
      intentInstructions = `🔴 KAYIT TALEBİ:
- currentTour VAR: ${currentTour.title}
- 🔴 "Merhaba" YASAK!
- 🔴 "Hangi tur?" diye ASLA SORMA
- Direkt: "Harika! ${currentTour.title} için kayıt oluşturalım."
- Soru sor: "Kaç kişi katılacaksınız? (Yetişkin/Çocuk sayısını belirtin)"
- Sonra: "İsim ve iletişim bilgilerinizi alabilir miyim?"
- Tüm bilgiler toplandığında: Özet göster ve onay al
- wizardStep'i "booking_started" yap`;
    } else {
      intentInstructions = '🔴 REZERVASYON: currentTour YOK, "Hangi turumuz için kayıt oluşturmak istiyorsunuz?" sor.';
    }
  } else if (intent === 'faq' || intent === 'question') {
    intentInstructions = '🔴 SSS: 🔴 "Merhaba" YASAK! Direkt cevap ver (max 2 cümle).';
  } else {
    intentInstructions = '🔴 GENEL: 🔴 "Merhaba" YASAK! Kısa ve net cevap (max 3 cümle).';
  }

  // Style-specific instructions
  const styleInstructions = conversationStyle === 'friendly'
    ? `

USLUP: Samimi (Friendly)
- "Sen/senin" formunu kullan
- Samimi, sıcak ve yakın bir dil kullan
- Dostça, rahat, çok yakın bir ton
- Her mesajda 1-2 emoji kullan (ama fazla kaçırma) 😊 ✨ 🌟 💫
- "Harika", "muhteşem", "süper", "güzel" gibi coşkulu kelimeler kullan
- Cümleler kısa ama sıcak olsun
- Coşkulu ama profesyonel kalmayı unutma
- Kullanıcıyı heyecanlandır ama 3-4 cümleyi geçme`
    : conversationStyle === 'casual'
    ? `

USLUP: Rahat (Casual)
- Günlük konuşma dilini kullan
- "Sen/senin" formunu kullan
- Samimi ve rahat ol
- Yanıtları hafif ve kolay anlaşılır tut
- Uygun yerlerde emoji kullanabilirsin 🙂
- "Tamam", "evet", "güzel" gibi günlük kelimeler kullan`
    : conversationStyle === 'formal'
    ? `

USLUP: Resmi (Formal)
- "Siz/sizin" formunu kullan
- Kültüre uygun resmi dil kullan
- Profesyonel mesafe koru ama kısa ol
- Kibar ve özenli ifadeler seç
- Emoji kullanma
- "Sayın", "lütfen", "rica ederim" gibi resmi ifadeler kullan`
    : `

USLUP: Profesyonel (Professional)
- "Siz/sizin" veya "sen/senin" - duruma göre
- Kibar, işe uygun dil kullan
- Net ama kısa ol
- Saygılı bir ton koru
- Emoji kullanma
- Açık ve anlaşılır ifadeler kullan`;

  return basePrompt + '\n\n' + intentInstructions + styleInstructions;
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
