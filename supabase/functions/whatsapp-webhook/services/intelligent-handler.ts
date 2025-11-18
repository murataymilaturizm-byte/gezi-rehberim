// Unified intelligent handler with full context awareness

import { callAI } from './ai.ts';
import { getConversationHistory } from './conversation.ts';
import { getUserProfile } from './profile.ts';
import { getConversationState, analyzeConversationPattern } from './conversation-state.ts';
import { searchToursWithAI } from './tour.ts';
import { getLabel } from '../config/labels.ts';
import { validateResponse } from './response-validator.ts';
import { buildPersonalizedContext } from './memory-extractor.ts';

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
  let tours: any[] = [];
  if (['tour.list', 'tour.search', 'tour.detail'].includes(intent)) {
    tours = await searchToursWithAI(supabase, userMessage, phone, agencyId);
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

  // Build personalized context from user memory
  const personalizedContext = conversationState.userMemory 
    ? buildPersonalizedContext(conversationState.userMemory, tours, language)
    : '';

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
      content: systemPrompt + toursContext + personalizedContext + adaptiveInstructions
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
  
  // Style-based personality and emoji rules - multilingual
  const stylePersonality = {
    tr: conversationStyle === 'friendly' 
      ? 'Samimi, sıcak ve dostane bir üslup kullan. Emojiler ekle 😊'
      : conversationStyle === 'casual'
      ? 'Rahat, günlük dilde konuş. Uygun yerlerde emoji kullan.'
      : 'Profesyonel, kibar ve açık bir dil kullan. Emoji kullanma.',
    en: conversationStyle === 'friendly'
      ? 'Use a friendly, warm and welcoming style. Add emojis 😊'
      : conversationStyle === 'casual'
      ? 'Speak in casual, everyday language. Use emojis where appropriate.'
      : 'Use a professional, polite and clear language. No emojis.',
    de: conversationStyle === 'friendly'
      ? 'Verwenden Sie einen freundlichen, warmen und einladenden Stil. Fügen Sie Emojis hinzu 😊'
      : conversationStyle === 'casual'
      ? 'Sprechen Sie in lockerer, alltäglicher Sprache. Verwenden Sie Emojis, wo passend.'
      : 'Verwenden Sie eine professionelle, höfliche und klare Sprache. Keine Emojis.',
    ru: conversationStyle === 'friendly'
      ? 'Используйте дружелюбный, теплый и гостеприимный стиль. Добавляйте эмодзи 😊'
      : conversationStyle === 'casual'
      ? 'Говорите на повседневном, разговорном языке. Используйте эмодзи где уместно.'
      : 'Используйте профессиональный, вежливый и четкий язык. Без эмодзи.',
    ar: conversationStyle === 'friendly'
      ? 'استخدم أسلوبًا ودودًا ودافئًا ومرحبًا. أضف الرموز التعبيرية 😊'
      : conversationStyle === 'casual'
      ? 'تحدث بلغة عادية يومية. استخدم الرموز التعبيرية حيثما كان مناسبًا.'
      : 'استخدم لغة احترافية ومهذبة وواضحة. بدون رموز تعبيرية.',
    fr: conversationStyle === 'friendly'
      ? 'Utilisez un style amical, chaleureux et accueillant. Ajoutez des emojis 😊'
      : conversationStyle === 'casual'
      ? 'Parlez dans un langage décontracté et quotidien. Utilisez des emojis si approprié.'
      : 'Utilisez un langage professionnel, poli et clair. Pas d\'emojis.',
    es: conversationStyle === 'friendly'
      ? 'Use un estilo amigable, cálido y acogedor. Agregue emojis 😊'
      : conversationStyle === 'casual'
      ? 'Hable en un lenguaje casual y cotidiano. Use emojis donde sea apropiado.'
      : 'Use un lenguaje profesional, educado y claro. Sin emojis.'
  };

  const baseRulesText = {
    tr: `Sen bir seyahat asistanısın. ${stylePersonality.tr}

🚨 ZORUNLU WIZARD KURALLARI 🚨
🔴 ADIM 1: Tur listele (sadece liste, detay yok)
🔴 ADIM 2: Kullanıcı seçsin (numara veya isim)
🔴 ADIM 3: "Bu turla ne yapmak istersiniz?" → 1️⃣Detay 2️⃣Fiyat 3️⃣Kayıt
🔴 ADIM 4: Kullanıcının seçimine göre (SADECE o bilgiyi ver)
🔴 MERHABA YASAK - Konuşma başladıktan sonra her cevabın başına "Merhaba" yazma
🔴 MAKSIMUM 3 CÜMLE`,
    en: `You are a travel assistant. ${stylePersonality.en}

🚨 MANDATORY WIZARD RULES 🚨
🔴 STEP 1: List tours (only list, no details)
🔴 STEP 2: User selects (number or name)
🔴 STEP 3: "What would you like to do with this tour?" → 1️⃣Details 2️⃣Price 3️⃣Booking
🔴 STEP 4: According to user choice (ONLY that info)
🔴 NO "HELLO" - Don't start every answer with "Hello" after conversation started
🔴 MAXIMUM 3 SENTENCES`,
    de: `Sie sind ein Reiseassistent. ${stylePersonality.de}

🚨 PFLICHT-WIZARD-REGELN 🚨
🔴 SCHRITT 1: Touren auflisten (nur Liste, keine Details)
🔴 SCHRITT 2: Benutzer wählt (Nummer oder Name)
🔴 SCHRITT 3: "Was möchten Sie mit dieser Tour machen?" → 1️⃣Details 2️⃣Preis 3️⃣Buchung
🔴 SCHRITT 4: Nach Benutzerwahl (NUR diese Info)
🔴 KEIN "HALLO" - Beginnen Sie nicht jede Antwort mit "Hallo", nachdem das Gespräch begonnen hat
🔴 MAXIMUM 3 SÄTZE`,
    ru: `Вы туристический ассистент. ${stylePersonality.ru}

🚨 ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА МАСТЕРА 🚨
🔴 ШАГ 1: Перечислить туры (только список, без деталей)
🔴 ШАГ 2: Пользователь выбирает (номер или название)
🔴 ШАГ 3: "Что бы вы хотели сделать с этим туром?" → 1️⃣Детали 2️⃣Цена 3️⃣Бронирование
🔴 ШАГ 4: По выбору пользователя (ТОЛЬКО эта информация)
🔴 НЕ "ПРИВЕТ" - Не начинайте каждый ответ с "Привет" после начала разговора
🔴 МАКСИМУМ 3 ПРЕДЛОЖЕНИЯ`,
    ar: `أنت مساعد سفر. ${stylePersonality.ar}

🚨 قواعد المعالج الإلزامية 🚨
🔴 الخطوة 1: قائمة الجولات (القائمة فقط، بدون تفاصيل)
🔴 الخطوة 2: يختار المستخدم (رقم أو اسم)
🔴 الخطوة 3: "ماذا تريد أن تفعل مع هذه الجولة؟" → 1️⃣التفاصيل 2️⃣السعر 3️⃣الحجز
🔴 الخطوة 4: وفقًا لاختيار المستخدم (فقط تلك المعلومات)
🔴 بدون "مرحبا" - لا تبدأ كل إجابة بـ "مرحبا" بعد بدء المحادثة
🔴 3 جمل كحد أقصى`,
    fr: `Vous êtes un assistant de voyage. ${stylePersonality.fr}

🚨 RÈGLES D'ASSISTANT OBLIGATOIRES 🚨
🔴 ÉTAPE 1: Lister les circuits (liste uniquement, pas de détails)
🔴 ÉTAPE 2: L'utilisateur sélectionne (numéro ou nom)
🔴 ÉTAPE 3: "Que souhaitez-vous faire avec ce circuit?" → 1️⃣Détails 2️⃣Prix 3️⃣Réservation
🔴 ÉTAPE 4: Selon le choix de l'utilisateur (UNIQUEMENT cette info)
🔴 PAS DE "BONJOUR" - Ne commencez pas chaque réponse par "Bonjour" après le début de la conversation
🔴 MAXIMUM 3 PHRASES`,
    es: `Eres un asistente de viajes. ${stylePersonality.es}

🚨 REGLAS OBLIGATORIAS DEL ASISTENTE 🚨
🔴 PASO 1: Listar tours (solo lista, sin detalles)
🔴 PASO 2: El usuario selecciona (número o nombre)
🔴 PASO 3: "¿Qué te gustaría hacer con este tour?" → 1️⃣Detalles 2️⃣Precio 3️⃣Reserva
🔴 PASO 4: Según la elección del usuario (SOLO esa información)
🔴 SIN "HOLA" - No comiences cada respuesta con "Hola" después de que comience la conversación
🔴 MÁXIMO 3 ORACIONES`
  };

  const baseRules = baseRulesText[language as keyof typeof baseRulesText] || baseRulesText.tr;

  const fullPrompt = `${baseRules}

HAFIZA KURALLARI:
${currentTour ? `
✅ SEÇİLİ TUR: ${currentTour.title}
📍 Adım: ${wizardStep}

🔴 "Hangi tur?" diye SORMA - currentTour zaten var!
🔴 Fiyat sorarsa → Direkt ${currentTour.title} için hesapla
🔴 Kayıt/rezervasyon derse → Direkt ${currentTour.title} için kayıt başlat
🔴 Program derse → Sadece o zaman program detayını ver

${wizardStep === 'tour_selected' ? `
ŞİMDİ NE YAPMALI:
"Bu turla ilgili ne yapmak istersiniz?"
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

Konuşma Stili: ${conversationStyle}
Mevcut Aşama: ${state.currentStage}
Kullanıcının İlgileri: ${state.userInterests.join(', ') || 'Henüz tespit edilmedi'}
Son Tartışılan Tur: ${state.lastDiscussedTour || 'Yok'}

Intent: ${intent}`;

  // Intent-specific instructions
  let intentInstructions = '';
  
  if (intent === 'greeting') {
    const hasHistory = state.conversationFlow && state.conversationFlow.length > 0;
    const hasMemory = state.userMemory && (
      state.userMemory.preferredDestinations?.length > 0 ||
      state.userMemory.interests?.length > 0 ||
      state.userMemory.budgetRange
    );
    
    if (!hasHistory) {
      intentInstructions = '🔴 İLK SELAMLAMA: Kısa karşılama + "Gitmek istediğin bölgeyi veya tur türünü yazarsan sana uygun turları listeleyebilirim." (max 2 cümle)';
    } else if (hasMemory && state.lastDiscussedTour) {
      intentInstructions = `🔴 DEVAM SELAMLAMASI:
- "Tekrar merhaba! 😊" ile başla
- Hatırlat: "Daha önce ${state.lastDiscussedTour} ile ilgilenmiştiniz."
- Tercihlerine vurgu yap ama kısa tut
- Sor: "Bu turla ilgili mi bilgi almak istiyorsunuz yoksa farklı bir konuda mı?"
- Max 2-3 cümle`;
    } else {
      intentInstructions = '🔴 TEKRAR SELAMLAMA: Kısa "Tekrar merhaba! 😊 Size nasıl yardımcı olabilirim?" (max 1 cümle)';
    }
  } else if (intent === 'tour.list' || intent === 'tour.search') {
    const hasMemory = state.userMemory && (
      state.userMemory.preferredDestinations?.length > 0 ||
      state.userMemory.interests?.length > 0 ||
      state.userMemory.budgetRange
    );
    
    intentInstructions = `🔴 TUR LİSTESİ ADIMI:
${hasMemory ? `
🧠 KİŞİSELLEŞTİRME:
- Kullanıcı hafızası var! Kişiselleştirilmiş önerileri ön plana çıkar
- "Size özel önerilerim:" diye başlayabilirsin (opsiyonel)
- Önce tercihlerine uygun turları göster, sonra diğerlerini
` : ''}
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
    if (currentTour) {
      intentInstructions = `🔴 KAYIT TALEBİ:
- currentTour VAR: ${currentTour.title}
- "Hangi tur?" diye ASLA SORMA
- Direkt kayıt başlat: "Harika! ${currentTour.title} için kayıt oluşturalım."
- Soru sor: "Kaç kişi katılacaksınız?" (Yetişkin/Çocuk)
- wizardStep'i "booking_started" yap`;
    } else {
      intentInstructions = '🔴 REZERVASYON: currentTour YOK, "Hangi turumuz için kayıt oluşturmak istiyorsunuz?" sor.';
    }
  } else if (intent === 'faq' || intent === 'question') {
    intentInstructions = '🔴 SSS: Direkt cevap ver (max 2 cümle).';
  } else {
    intentInstructions = '🔴 GENEL: Kısa ve net cevap (max 3 cümle).';
  }

  return fullPrompt + '\n\n' + intentInstructions;
}
