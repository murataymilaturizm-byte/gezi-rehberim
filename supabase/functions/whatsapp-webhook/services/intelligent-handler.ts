// Unified intelligent handler with full context awareness

import { callAI } from './ai.ts';
import { getConversationHistory } from './conversation.ts';
import { getUserProfile } from './profile.ts';
import { getConversationState, analyzeConversationPattern } from './conversation-state.ts';
import { searchToursWithAI } from './tour.ts';
import { getLabel } from '../config/labels.ts';
import { validateResponse } from './response-validator.ts';
import { buildPersonalizedContext } from './memory-extractor.ts';

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

// Helper function to format tours with beautiful styling
function formatToursContext(tours: any[]): string {
  return tours.map(tour => {
    const dates = tour.dates?.map((d: any) => 
      `${formatTurkishDate(d.departure_date)} (Yetişkin: ${d.price_adult}₺, Çocuk: ${d.price_child || 'N/A'}₺)`
    ).join(', ');
    
    return `━━━━━━━━━━━━━━━━━━
📌 ${tour.title} (${tour.destination})
━━━━━━━━━━━━━━━━━━
📅 Tarihler: ${dates}
⏰ Toplanma: ${tour.toplanma_saati || 'Belirtilmemiş'}
📍 Hareket: ${tour.hareket_noktasi || 'Belirtilmemiş'}
🚌 Ulaşım: ${tour.ulasim || 'Belirtilmemiş'}
🏨 Konaklama: ${tour.konaklama || 'Belirtilmemiş'}
⏳ Süre: ${tour.tur_sure || 'Belirtilmemiş'}
🗺️ Gezilecek: ${tour.gezilecek_yerler || 'Belirtilmemiş'}`;
  }).join('\n\n');
}

// Helper function to extract last discussed tour from history
function extractLastTourFromHistory(history: any[]): string | null {
  // Common tour patterns - can be extended
  const tourPatterns = [
    /Kapadokya/i,
    /Pamukkale/i,
    /Antalya/i,
    /Ege/i,
    /Akdeniz/i,
    /Balon/i,
    /Rafting/i,
    /Kültür/i
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

export async function handleIntelligently(
  supabase: any,
  phone: string,
  agencyId: string,
  userMessage: string,
  intent: string,
  conversationStyle: string,
  tourSwitchContext?: string
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

  // Extract last discussed tour from history
  const lastDiscussedTour = extractLastTourFromHistory(conversationHistory);

  // Build intelligent system prompt
  const systemPrompt = buildIntelligentPrompt(
    intent,
    language,
    conversationStyle,
    conversationState,
    pattern,
    userProfile,
    lastDiscussedTour
  );

  // Get tours data if needed
  let toursContext = '';
  let tours: any[] = [];
  if (['tour.list', 'tour.search', 'tour.detail'].includes(intent)) {
    tours = await searchToursWithAI(supabase, userMessage, phone, agencyId);
    if (tours && tours.length > 0) {
      toursContext = '\n\n📋 MEVCUT TURLAR:\n' + formatToursContext(tours);
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
      content: systemPrompt + toursContext + personalizedContext + adaptiveInstructions + (tourSwitchContext || '')
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
  profile: any,
  lastDiscussedTour?: string | null
): string {
  const currentTour = state?.currentTour;
  const wizardStep = state?.wizardStep || 'none';
  const shownTourIds = state?.shownTourIds || [];
  
  // Style-based personality and emoji rules - multilingual
  const stylePersonality = {
    tr: conversationStyle === 'friendly' 
      ? 'Samimi, sıcak ve dostane bir üslup kullan. Emojiler ekle 😊'
      : conversationStyle === 'energetic'
      ? 'Enerjik, heyecanlı ve motive edici bir üslup kullan. Bol emoji ve ünlem kullan! 🎉⚡'
      : conversationStyle === 'helpful'
      ? 'Yardımsever, destekleyici ve rehber bir üslup kullan. Anlaşılır emoji kullan 🤝📝'
      : 'Profesyonel, kibar ve açık bir dil kullan. Emoji kullanma.',
    en: conversationStyle === 'friendly'
      ? 'Use a friendly, warm and welcoming style. Add emojis 😊'
      : conversationStyle === 'energetic'
      ? 'Use an energetic, exciting and motivating style. Use plenty of emojis and exclamations! 🎉⚡'
      : conversationStyle === 'helpful'
      ? 'Use a helpful, supportive and guiding style. Use clear emojis 🤝📝'
      : 'Use a professional, polite and clear language. No emojis.',
    de: conversationStyle === 'friendly'
      ? 'Verwenden Sie einen freundlichen, warmen und einladenden Stil. Fügen Sie Emojis hinzu 😊'
      : conversationStyle === 'energetic'
      ? 'Verwenden Sie einen energischen, aufregenden und motivierenden Stil. Verwenden Sie viele Emojis und Ausrufe! 🎉⚡'
      : conversationStyle === 'helpful'
      ? 'Verwenden Sie einen hilfreichen, unterstützenden und anleitenden Stil. Verwenden Sie klare Emojis 🤝📝'
      : 'Verwenden Sie eine professionelle, höfliche und klare Sprache. Keine Emojis.',
    ru: conversationStyle === 'friendly'
      ? 'Используйте дружелюбный, теплый и гостеприимный стиль. Добавляйте эмодзи 😊'
      : conversationStyle === 'energetic'
      ? 'Используйте энергичный, захватывающий и мотивирующий стиль. Используйте много эмодзи и восклицаний! 🎉⚡'
      : conversationStyle === 'helpful'
      ? 'Используйте полезный, поддерживающий и направляющий стиль. Используйте понятные эмодзи 🤝📝'
      : 'Используйте профессиональный, вежливый и четкий язык. Без эмодзи.',
    ar: conversationStyle === 'friendly'
      ? 'استخدم أسلوبًا ودودًا ودافئًا ومرحبًا. أضف الرموز التعبيرية 😊'
      : conversationStyle === 'energetic'
      ? 'استخدم أسلوبًا نشطًا ومثيرًا ومحفزًا. استخدم الكثير من الرموز التعبيرية والتعجب! 🎉⚡'
      : conversationStyle === 'helpful'
      ? 'استخدم أسلوبًا مفيدًا وداعمًا وموجهًا. استخدم رموزًا تعبيرية واضحة 🤝📝'
      : 'استخدم لغة احترافية ومهذبة وواضحة. بدون رموز تعبيرية.',
    fr: conversationStyle === 'friendly'
      ? 'Utilisez un style amical, chaleureux et accueillant. Ajoutez des emojis 😊'
      : conversationStyle === 'energetic'
      ? 'Utilisez un style énergique, passionnant et motivant. Utilisez beaucoup d\'emojis et d\'exclamations! 🎉⚡'
      : conversationStyle === 'helpful'
      ? 'Utilisez un style utile, de soutien et de guide. Utilisez des emojis clairs 🤝📝'
      : 'Utilisez un langage professionnel, poli et clair. Pas d\'emojis.',
    es: conversationStyle === 'friendly'
      ? 'Use un estilo amigable, cálido y acogedor. Agregue emojis 😊'
      : conversationStyle === 'energetic'
      ? 'Use un estilo enérgico, emocionante y motivador. ¡Use muchos emojis y exclamaciones! 🎉⚡'
      : conversationStyle === 'helpful'
      ? 'Use un estilo útil, de apoyo y de guía. Use emojis claros 🤝📝'
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
7. SAYI ALGILAMA: Kullanıcı kişi sayısı söylediğinde AYNEN o sayıyı kullan! "1" diyorsa 1, "2" diyorsa 2. Asla farklı bir sayı anlama!
8. ❌❌❌ KRİTİK: Rezervasyonda ASLA E-MAİL İSTEME! SADECE TAM AD-SOYAD VE TELEFON YETER! ❌❌❌
9. TARİH FORMATI: Tarihleri MUTLAKA "12 Aralık 2026" formatında yaz (gün ay yıl, ay Türkçe yazıyla)

Konuşma Stili: ${conversationStyle}
Mevcut Aşama: ${state.currentStage}
Kullanıcının İlgileri: ${state.userInterests.join(', ') || 'Henüz tespit edilmedi'}

Intent: ${intent}`;

  // Intent-specific instructions - multilingual
  let intentInstructions = '';
  
  if (intent === 'greeting') {
    const hasHistory = state.conversationFlow && state.conversationFlow.length > 0;
    const hasMemory = state.userMemory && (
      state.userMemory.preferredDestinations?.length > 0 ||
      state.userMemory.interests?.length > 0 ||
      state.userMemory.budgetRange
    );
    
    if (!hasHistory) {
      const firstGreetingMessages = {
        tr: '🔴 İLK SELAMLAMA: Kullanıcının selamına karşılık ver (Merhaba!, Selam! vb.) + "Gitmek istediğin bölgeyi veya tur türünü yazarsan sana uygun turları listeleyebilirim." (max 2 cümle)',
        en: '🔴 FIRST GREETING: Respond to user greeting (Hello!, Hi! etc.) + "If you tell me the region or tour type you want to visit, I can list suitable tours for you." (max 2 sentences)',
        de: '🔴 ERSTE BEGRÜSSUNG: Auf Begrüßung antworten (Hallo!, Hi! usw.) + "Wenn Sie mir die Region oder Art der Tour mitteilen, die Sie besuchen möchten, kann ich passende Touren für Sie auflisten." (max 2 Sätze)',
        ru: '🔴 ПЕРВОЕ ПРИВЕТСТВИЕ: Краткое приветствие + "Если вы скажете мне регион или тип тура, который хотите посетить, я могу перечислить подходящие туры для вас." (макс 2 предложения)',
        ar: '🔴 التحية الأولى: ترحيب قصير + "إذا أخبرتني بالمنطقة أو نوع الجولة التي تريد زيارتها، يمكنني إدراج الجولات المناسبة لك." (جملتان كحد أقصى)',
        fr: '🔴 PREMIÈRE SALUTATION: Courte bienvenue + "Si vous me dites la région ou le type de circuit que vous souhaitez visiter, je peux lister les circuits adaptés pour vous." (max 2 phrases)',
        es: '🔴 PRIMER SALUDO: Breve bienvenida + "Si me dices la región o tipo de tour que quieres visitar, puedo listar tours adecuados para ti." (máx 2 oraciones)'
      };
      intentInstructions = firstGreetingMessages[language as keyof typeof firstGreetingMessages] || firstGreetingMessages.tr;
    } else if (hasMemory && state.lastDiscussedTour) {
      const continuingMessages = {
        tr: `🔴 DEVAM SELAMLAMASI:
- "Tekrar merhaba! 😊" ile başla
- Hatırlat: "Daha önce ${state.lastDiscussedTour} ile ilgilenmiştiniz."
- Tercihlerine vurgu yap ama kısa tut
- Sor: "Bu turla ilgili mi bilgi almak istiyorsunuz yoksa farklı bir konuda mı?"
- Max 2-3 cümle`,
        en: `🔴 CONTINUING GREETING:
- Start with "Welcome back! 😊"
- Remind: "You were previously interested in ${state.lastDiscussedTour}."
- Emphasize their preferences but keep it short
- Ask: "Would you like information about this tour or something else?"
- Max 2-3 sentences`,
        de: `🔴 FORTGESETZTE BEGRÜSSUNG:
- Beginnen Sie mit "Willkommen zurück! 😊"
- Erinnern: "Sie interessierten sich zuvor für ${state.lastDiscussedTour}."
- Betonen Sie ihre Präferenzen, aber halten Sie es kurz
- Fragen: "Möchten Sie Informationen über diese Tour oder etwas anderes?"
- Max 2-3 Sätze`,
        ru: `🔴 ПРОДОЛЖЕНИЕ ПРИВЕТСТВИЯ:
- Начните с "Добро пожаловать обратно! 😊"
- Напомните: "Вы ранее интересовались ${state.lastDiscussedTour}."
- Подчеркните их предпочтения, но будьте кратки
- Спросите: "Хотите информацию об этом туре или что-то другое?"
- Макс 2-3 предложения`,
        ar: `🔴 تحية استمرارية:
- ابدأ بـ "مرحبًا بعودتك! 😊"
- ذكّر: "كنت مهتمًا سابقًا بـ ${state.lastDiscussedTour}."
- أكد على تفضيلاتهم لكن اجعلها قصيرة
- اسأل: "هل تريد معلومات عن هذه الجولة أم شيء آخر؟"
- 2-3 جمل كحد أقصى`,
        fr: `🔴 ACCUEIL DE CONTINUATION:
- Commencez par "Ravi de vous revoir! 😊"
- Rappelez: "Vous étiez précédemment intéressé par ${state.lastDiscussedTour}."
- Mettez l'accent sur leurs préférences mais restez bref
- Demandez: "Souhaitez-vous des informations sur ce circuit ou autre chose?"
- Max 2-3 phrases`,
        es: `🔴 SALUDO DE CONTINUACIÓN:
- Comience con "¡Bienvenido de nuevo! 😊"
- Recuerde: "Anteriormente estaba interesado en ${state.lastDiscussedTour}."
- Enfatice sus preferencias pero manténgalo breve
- Pregunte: "¿Desea información sobre este tour u otra cosa?"
- Máx 2-3 oraciones`
      };
      intentInstructions = continuingMessages[language as keyof typeof continuingMessages] || continuingMessages.tr;
    } else {
      // Returning user - respond warmly to greeting
      const returningGreetingMessages = {
        tr: '🔴 DÖNEN KULLANICI SELAMLAŞMASI: Samimi karşılık ver (Merhaba! / Tekrar hoş geldin! vb.) + "Size nasıl yardımcı olabilirim?" (max 2 cümle, usluba uygun emoji kullan)',
        en: '🔴 RETURNING USER GREETING: Respond warmly (Hello! / Welcome back! etc.) + "How can I help you?" (max 2 sentences, use style-appropriate emoji)',
        de: '🔴 WIEDERKEHRENDER BENUTZER BEGRÜSSUNG: Antworten Sie herzlich (Hallo! / Willkommen zurück! usw.) + "Wie kann ich Ihnen helfen?" (max 2 Sätze, verwenden Sie stilgerechte Emojis)',
        ru: '🔴 ПРИВЕТСТВИЕ ВОЗВРАЩАЮЩЕГОСЯ ПОЛЬЗОВАТЕЛЯ: Ответьте тепло (Привет! / С возвращением! и т.д.) + "Чем могу помочь?" (макс 2 предложения, используйте эмодзи в соответствии со стилем)',
        ar: '🔴 تحية المستخدم العائد: رد بحرارة (مرحبا! / مرحبا بعودتك! إلخ.) + "كيف يمكنني مساعدتك?" (جملتان كحد أقصى، استخدم الرموز التعبيرية المناسبة للأسلوب)',
        fr: '🔴 SALUTATION DE L\'UTILISATEUR DE RETOUR: Répondez chaleureusement (Bonjour! / Bon retour! etc.) + "Comment puis-je vous aider?" (max 2 phrases, utilisez des emojis adaptés au style)',
        es: '🔴 SALUDO DE USUARIO QUE REGRESA: Responde calurosamente (¡Hola! / ¡Bienvenido de nuevo! etc.) + "¿Cómo puedo ayudarte?" (máx 2 oraciones, usa emojis apropiados al estilo)'
      };
      intentInstructions = returningGreetingMessages[language as keyof typeof returningGreetingMessages] || returningGreetingMessages.tr;
    }
  } else if (intent === 'tour.list' || intent === 'tour.search') {
    const hasMemory = state.userMemory && (
      state.userMemory.preferredDestinations?.length > 0 ||
      state.userMemory.interests?.length > 0 ||
      state.userMemory.budgetRange
    );
    
    const tourListMessages = {
      tr: `🔴 TUR LİSTESİ ADIMI:
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
- MAX 5 satır tur listesi`,
      en: `🔴 TOUR LIST STEP:
${hasMemory ? `
🧠 PERSONALIZATION:
- User memory exists! Highlight personalized recommendations
- You can start with "My recommendations for you:" (optional)
- Show tours matching their preferences first, then others
` : ''}
- ONLY show list, don't add anything else
- For each tour: number, name, region, date(s)
- Program/price/details FORBIDDEN
- Last line: "Which tour are you interested in? You can write the number or tour name. 🙂"
- MAX 5 tour lines`,
      de: `🔴 TOURLISTEN-SCHRITT:
${hasMemory ? `
🧠 PERSONALISIERUNG:
- Benutzerspeicher existiert! Heben Sie personalisierte Empfehlungen hervor
- Sie können mit "Meine Empfehlungen für Sie:" beginnen (optional)
- Zeigen Sie zuerst Touren, die ihren Präferenzen entsprechen, dann andere
` : ''}
- NUR Liste zeigen, nichts anderes hinzufügen
- Für jede Tour: Nummer, Name, Region, Datum/Daten
- Programm/Preis/Details VERBOTEN
- Letzte Zeile: "An welcher Tour sind Sie interessiert? Sie können die Nummer oder den Tournamen schreiben. 🙂"
- MAX 5 Tourzeilen`,
      ru: `🔴 ШАГ СПИСКА ТУРОВ:
${hasMemory ? `
🧠 ПЕРСОНАЛИЗАЦИЯ:
- Память пользователя существует! Выделите персонализированные рекомендации
- Вы можете начать с "Мои рекомендации для вас:" (опционально)
- Сначала покажите туры, соответствующие их предпочтениям, затем другие
` : ''}
- ТОЛЬКО показать список, ничего больше не добавлять
- Для каждого тура: номер, название, регион, дата/даты
- Программа/цена/детали ЗАПРЕЩЕНЫ
- Последняя строка: "Какой тур вас интересует? Вы можете написать номер или название тура. 🙂"
- МАКС 5 строк туров`,
      ar: `🔴 خطوة قائمة الجولات:
${hasMemory ? `
🧠 التخصيص:
- ذاكرة المستخدم موجودة! أبرز التوصيات المخصصة
- يمكنك البدء بـ "توصياتي لك:" (اختياري)
- اعرض الجولات المطابقة لتفضيلاتهم أولاً، ثم الأخرى
` : ''}
- اعرض القائمة فقط، لا تضف أي شيء آخر
- لكل جولة: رقم، اسم، منطقة، تاريخ/تواريخ
- البرنامج/السعر/التفاصيل ممنوع
- السطر الأخير: "أي جولة تهتم بها؟ يمكنك كتابة الرقم أو اسم الجولة. 🙂"
- بحد أقصى 5 أسطر جولة`,
      fr: `🔴 ÉTAPE LISTE DES CIRCUITS:
${hasMemory ? `
🧠 PERSONNALISATION:
- La mémoire utilisateur existe! Mettez en évidence les recommandations personnalisées
- Vous pouvez commencer par "Mes recommandations pour vous:" (optionnel)
- Affichez d'abord les circuits correspondant à leurs préférences, puis les autres
` : ''}
- Afficher UNIQUEMENT la liste, n'ajoutez rien d'autre
- Pour chaque circuit: numéro, nom, région, date(s)
- Programme/prix/détails INTERDITS
- Dernière ligne: "Quel circuit vous intéresse? Vous pouvez écrire le numéro ou le nom du circuit. 🙂"
- MAX 5 lignes de circuits`,
      es: `🔴 PASO LISTA DE TOURS:
${hasMemory ? `
🧠 PERSONALIZACIÓN:
- ¡La memoria del usuario existe! Destaque las recomendaciones personalizadas
- Puede comenzar con "Mis recomendaciones para ti:" (opcional)
- Muestre primero los tours que coincidan con sus preferencias, luego otros
` : ''}
- SOLO mostrar lista, no agregar nada más
- Para cada tour: número, nombre, región, fecha(s)
- Programa/precio/detalles PROHIBIDO
- Última línea: "¿Qué tour te interesa? Puedes escribir el número o nombre del tour. 🙂"
- MAX 5 líneas de tours`
    };
    intentInstructions = tourListMessages[language as keyof typeof tourListMessages] || tourListMessages.tr;
  } else if (intent === 'tour.detail') {
    if (wizardStep === 'none' || wizardStep === 'tour_selected') {
      const tourSelectedMessages = {
        tr: `🔴 TUR DETAY BİLGİSİ VER:
✅ Kısa özet bilgisi ver (gezilecek yerler, süre, konaklama, ulaşım)
✅ Tarih ve fiyat bilgilerini göster
✅ En son satırda şunu ekle: "Dilerseniz tüm tur programını detaylı olarak paylaşabilirim. 📋"

🔴 DETAYLI PROGRAM: Sadece kullanıcı "detaylı program", "tüm program", "tam program" isterse göster!
🔴 MAX 5-6 cümle özet bilgi`,
        en: `🔴 PROVIDE TOUR DETAIL INFO:
✅ Give brief summary (places to visit, duration, accommodation, transportation)
✅ Show date and price information
✅ Add this at the end: "If you wish, I can share the full tour program in detail. 📋"

🔴 DETAILED PROGRAM: Only show if user asks for "detailed program", "full program", "complete program"!
🔴 MAX 5-6 sentences summary`,
        de: `🔴 TOUR-DETAIL-INFORMATIONEN BEREITSTELLEN:
✅ Kurze Zusammenfassung geben (Sehenswürdigkeiten, Dauer, Unterkunft, Transport)
✅ Datum und Preisinformationen anzeigen
✅ Am Ende hinzufügen: "Auf Wunsch kann ich Ihnen das vollständige Tourprogramm im Detail mitteilen. 📋"

🔴 DETAILLIERTES PROGRAMM: Nur zeigen, wenn der Benutzer nach "detailliertem Programm", "vollständigem Programm" fragt!
🔴 MAX 5-6 Sätze Zusammenfassung`,
        ru: `🔴 ПРЕДОСТАВЬТЕ ДЕТАЛЬНУЮ ИНФОРМАЦИЮ О ТУРЕ:
✅ Дайте краткое описание (места для посещения, продолжительность, проживание, транспорт)
✅ Покажите информацию о датах и ценах
✅ Добавьте в конце: "При желании могу поделиться полной программой тура подробно. 📋"

🔴 ПОДРОБНАЯ ПРОГРАММА: Показывать только если пользователь спросит "подробную программу", "полную программу"!
🔴 МАКС 5-6 предложений резюме`,
        ar: `🔴 قدم معلومات تفصيلية عن الجولة:
✅ قدم ملخصًا موجزًا (الأماكن المراد زيارتها، المدة، الإقامة، النقل)
✅ أظهر معلومات التاريخ والسعر
✅ أضف في النهاية: "إذا أردت، يمكنني مشاركة برنامج الجولة الكامل بالتفصيل. 📋"

🔴 البرنامج التفصيلي: اعرضه فقط إذا طلب المستخدم "برنامج تفصيلي"، "برنامج كامل"!
🔴 أقصى حد 5-6 جمل ملخص`,
        fr: `🔴 FOURNIR DES INFORMATIONS DÉTAILLÉES SUR LE CIRCUIT:
✅ Donner un bref résumé (lieux à visiter, durée, hébergement, transport)
✅ Afficher les informations de date et de prix
✅ Ajouter à la fin: "Si vous le souhaitez, je peux partager le programme complet du circuit en détail. 📋"

🔴 PROGRAMME DÉTAILLÉ: Montrer uniquement si l'utilisateur demande "programme détaillé", "programme complet"!
🔴 MAX 5-6 phrases de résumé`,
        es: `🔴 PROPORCIONAR INFORMACIÓN DETALLADA DEL TOUR:
✅ Dar un breve resumen (lugares a visitar, duración, alojamiento, transporte)
✅ Mostrar información de fecha y precio
✅ Añadir al final: "Si lo desea, puedo compartir el programa completo del tour en detalle. 📋"

🔴 PROGRAMA DETALLADO: ¡Mostrar solo si el usuario solicita "programa detallado", "programa completo"!
🔴 MAX 5-6 frases de resumen`
      };
      intentInstructions = tourSelectedMessages[language as keyof typeof tourSelectedMessages] || tourSelectedMessages.tr;
    } else if (wizardStep === 'action_choice') {
      const actionChoiceMessages = {
        tr: `🔴 KULLANICI SEÇİM YAPTI:
- "detay/program" → Detaylı programı göster
- "fiyat" → Fiyat hesapla
- "kayıt/rezervasyon" → Kayıt başlat
Sadece seçilen işlemi yap!`,
        en: `🔴 USER MADE CHOICE:
- "detail/program" → Show detailed program
- "price" → Calculate price
- "registration/booking" → Start registration
Only do the selected action!`,
        de: `🔴 BENUTZER HAT GEWÄHLT:
- "detail/programm" → Detailliertes Programm zeigen
- "preis" → Preis berechnen
- "registrierung/buchung" → Registrierung starten
Nur die gewählte Aktion ausführen!`,
        ru: `🔴 ПОЛЬЗОВАТЕЛЬ СДЕЛАЛ ВЫБОР:
- "детали/программа" → Показать подробную программу
- "цена" → Рассчитать цену
- "регистрация/бронирование" → Начать регистрацию
Выполните только выбранное действие!`,
        ar: `🔴 قام المستخدم بالاختيار:
- "تفاصيل/برنامج" → أظهر البرنامج المفصل
- "سعر" → احسب السعر
- "تسجيل/حجز" → ابدأ التسجيل
قم فقط بالإجراء المحدد!`,
        fr: `🔴 L'UTILISATEUR A FAIT UN CHOIX:
- "détail/programme" → Afficher le programme détaillé
- "prix" → Calculer le prix
- "inscription/réservation" → Commencer l'inscription
Effectuez uniquement l'action sélectionnée!`,
        es: `🔴 EL USUARIO HIZO UNA ELECCIÓN:
- "detalle/programa" → Mostrar programa detallado
- "precio" → Calcular precio
- "registro/reserva" → Iniciar registro
¡Solo haga la acción seleccionada!`
      };
      intentInstructions = actionChoiceMessages[language as keyof typeof actionChoiceMessages] || actionChoiceMessages.tr;
    } else {
      const tourDetailMessages = {
        tr: '🔴 TUR DETAYI: Kısa özet (max 3 cümle), gün gün program YASAK.',
        en: '🔴 TOUR DETAIL: Short summary (max 3 sentences), day-by-day program FORBIDDEN.',
        de: '🔴 TOURDETAIL: Kurze Zusammenfassung (max 3 Sätze), Tag-für-Tag-Programm VERBOTEN.',
        ru: '🔴 ДЕТАЛИ ТУРА: Краткое резюме (макс 3 предложения), программа по дням ЗАПРЕЩЕНА.',
        ar: '🔴 تفاصيل الجولة: ملخص قصير (3 جمل كحد أقصى)، برنامج يومًا بيوم ممنوع.',
        fr: '🔴 DÉTAIL DU CIRCUIT: Résumé court (max 3 phrases), programme jour par jour INTERDIT.',
        es: '🔴 DETALLE DEL TOUR: Resumen breve (máx 3 oraciones), programa día a día PROHIBIDO.'
      };
      intentInstructions = tourDetailMessages[language as keyof typeof tourDetailMessages] || tourDetailMessages.tr;
    }
  } else if (intent === 'price.inquiry') {
    if (currentTour) {
      const priceWithTourMessages = {
        tr: `🔴 FİYAT HESAPLAMA:
- currentTour VAR: ${currentTour.title}
- "Hangi tur?" diye ASLA SORMA
- Kullanıcının verdiği kişi sayısına göre hesapla
- Format: "Yetişkin: X x FIYAT, Çocuk: Y x FIYAT, Toplam: Z"
- Son satır: "Dilersen detaylı programı paylaşabilirim veya kayıt başlatabilirim. (Program / Kayıt)"`,
        en: `🔴 PRICE CALCULATION:
- currentTour EXISTS: ${currentTour.title}
- NEVER ASK "Which tour?"
- Calculate based on number of people user provided
- Format: "Adult: X x PRICE, Child: Y x PRICE, Total: Z"
- Last line: "If you like, I can share the detailed program or start registration. (Program / Registration)"`,
        de: `🔴 PREISBERECHNUNG:
- currentTour EXISTIERT: ${currentTour.title}
- NIEMALS FRAGEN "Welche Tour?"
- Berechnen Sie basierend auf der Anzahl der Personen, die der Benutzer angegeben hat
- Format: "Erwachsene: X x PREIS, Kind: Y x PREIS, Gesamt: Z"
- Letzte Zeile: "Wenn Sie möchten, kann ich das detaillierte Programm teilen oder die Registrierung starten. (Programm / Registrierung)"`,
        ru: `🔴 РАСЧЕТ ЦЕНЫ:
- currentTour СУЩЕСТВУЕТ: ${currentTour.title}
- НИКОГДА НЕ СПРАШИВАЙТЕ "Какой тур?"
- Рассчитайте на основе количества людей, указанного пользователем
- Формат: "Взрослый: X x ЦЕНА, Ребенок: Y x ЦЕНА, Всего: Z"
- Последняя строка: "Если хотите, я могу поделиться подробной программой или начать регистрацию. (Программа / Регистрация)"`,
        ar: `🔴 حساب السعر:
- currentTour موجود: ${currentTour.title}
- لا تسأل أبدًا "أي جولة؟"
- احسب بناءً على عدد الأشخاص الذي قدمه المستخدم
- التنسيق: "بالغ: X x السعر، طفل: Y x السعر، الإجمالي: Z"
- السطر الأخير: "إذا أردت، يمكنني مشاركة البرنامج المفصل أو بدء التسجيل. (البرنامج / التسجيل)"`,
        fr: `🔴 CALCUL DU PRIX:
- currentTour EXISTE: ${currentTour.title}
- NE DEMANDEZ JAMAIS "Quel circuit?"
- Calculez en fonction du nombre de personnes fourni par l'utilisateur
- Format: "Adulte: X x PRIX, Enfant: Y x PRIX, Total: Z"
- Dernière ligne: "Si vous le souhaitez, je peux partager le programme détaillé ou commencer l'inscription. (Programme / Inscription)"`,
        es: `🔴 CÁLCULO DE PRECIO:
- currentTour EXISTE: ${currentTour.title}
- NUNCA PREGUNTE "¿Qué tour?"
- Calcule según el número de personas que proporcionó el usuario
- Formato: "Adulto: X x PRECIO, Niño: Y x PRECIO, Total: Z"
- Última línea: "Si lo desea, puedo compartir el programa detallado o comenzar el registro. (Programa / Registro)"`
      };
      intentInstructions = priceWithTourMessages[language as keyof typeof priceWithTourMessages] || priceWithTourMessages.tr;
    } else {
      const priceWithoutTourMessages = {
        tr: '🔴 FİYAT SORU: currentTour YOK, "Hangi turumuz için fiyat öğrenmek istiyorsunuz?" sor.',
        en: '🔴 PRICE QUESTION: currentTour NONE, ask "Which tour would you like to know the price for?"',
        de: '🔴 PREISFRAGE: currentTour KEINE, fragen Sie "Für welche Tour möchten Sie den Preis wissen?"',
        ru: '🔴 ВОПРОС О ЦЕНЕ: currentTour НЕТ, спросите "Для какого тура вы хотите узнать цену?"',
        ar: '🔴 سؤال السعر: currentTour لا يوجد، اسأل "لأي جولة تريد معرفة السعر؟"',
        fr: '🔴 QUESTION DE PRIX: currentTour AUCUN, demandez "Pour quel circuit souhaitez-vous connaître le prix?"',
        es: '🔴 PREGUNTA DE PRECIO: currentTour NINGUNO, pregunte "¿Para qué tour desea conocer el precio?"'
      };
      intentInstructions = priceWithoutTourMessages[language as keyof typeof priceWithoutTourMessages] || priceWithoutTourMessages.tr;
    }
  } else if (intent === 'reservation.wizard') {
    if (currentTour) {
      const reservationWithTourMessages = {
        tr: `🔴 KAYIT TALEBİ - TURLU:
- currentTour VAR: ${currentTour.title}
- "Hangi tur?" diye ASLA SORMA - TUR BELLİ!
- Direkt kayıt başlat: "Harika! ${currentTour.title} için kayıt oluşturalım."
- İlk soru: "Kaç kişi katılacaksınız?"
- wizardStep: "booking_started"
- SADECE bu tura odaklan, başka tur önerme`,
        en: `🔴 REGISTRATION REQUEST - WITH TOUR:
- currentTour EXISTS: ${currentTour.title}
- NEVER ASK "Which tour?" - TOUR IS KNOWN!
- Start registration directly: "Great! Let's create registration for ${currentTour.title}."
- First question: "How many people will attend?"
- wizardStep: "booking_started"
- FOCUS ONLY on this tour, don't suggest others`,
        de: `🔴 REGISTRIERUNGSANFRAGE - MIT TOUR:
- currentTour EXISTIERT: ${currentTour.title}
- NIEMALS FRAGEN "Welche Tour?" - TOUR IST BEKANNT!
- Registrierung direkt starten: "Großartig! Lassen Sie uns die Registrierung für ${currentTour.title} erstellen."
- Erste Frage: "Wie viele Personen werden teilnehmen?"
- wizardStep: "booking_started"
- NUR auf diese Tour konzentrieren, keine anderen vorschlagen`,
        ru: `🔴 ЗАПРОС РЕГИСТРАЦИИ - С ТУРОМ:
- currentTour СУЩЕСТВУЕТ: ${currentTour.title}
- НИКОГДА НЕ СПРАШИВАЙТЕ "Какой тур?" - ТУР ИЗВЕСТЕН!
- Начните регистрацию напрямую: "Отлично! Давайте создадим регистрацию для ${currentTour.title}."
- Первый вопрос: "Сколько человек будет участвовать?"
- wizardStep: "booking_started"
- ФОКУСИРУЙТЕСЬ ТОЛЬКО на этом туре, не предлагайте другие`,
        ar: `🔴 طلب تسجيل - مع جولة:
- currentTour موجود: ${currentTour.title}
- لا تسأل أبدًا "أي جولة؟" - الجولة معروفة!
- ابدأ التسجيل مباشرة: "رائع! دعنا ننشئ تسجيلًا لـ ${currentTour.title}."
- السؤال الأول: "كم عدد الأشخاص الذين سيحضرون؟"
- wizardStep: "booking_started"
- ركز فقط على هذه الجولة، لا تقترح أخرى`,
        fr: `🔴 DEMANDE D'INSCRIPTION - AVEC CIRCUIT:
- currentTour EXISTE: ${currentTour.title}
- NE DEMANDEZ JAMAIS "Quel circuit?" - LE CIRCUIT EST CONNU!
- Commencez l'inscription directement: "Génial! Créons l'inscription pour ${currentTour.title}."
- Première question: "Combien de personnes participeront?"
- wizardStep: "booking_started"
- CONCENTREZ-VOUS UNIQUEMENT sur ce circuit, n'en suggérez pas d'autres`,
        es: `🔴 SOLICITUD DE REGISTRO - CON TOUR:
- currentTour EXISTE: ${currentTour.title}
- NUNCA PREGUNTE "¿Qué tour?" - ¡EL TOUR ES CONOCIDO!
- Inicie el registro directamente: "¡Genial! Creemos el registro para ${currentTour.title}."
- Primera pregunta: "¿Cuántas personas asistirán?"
- wizardStep: "booking_started"
- CONCÉNTRESE SOLO en este tour, no sugiera otros`
      };
      intentInstructions = reservationWithTourMessages[language as keyof typeof reservationWithTourMessages] || reservationWithTourMessages.tr;
    } else {
      const reservationWithoutTourMessages = {
        tr: '🔴 REZERVASYON: currentTour YOK, "Hangi turumuz için kayıt oluşturmak istiyorsunuz?" sor.',
        en: '🔴 RESERVATION: currentTour NONE, ask "Which tour would you like to create registration for?"',
        de: '🔴 RESERVIERUNG: currentTour KEINE, fragen Sie "Für welche Tour möchten Sie eine Registrierung erstellen?"',
        ru: '🔴 РЕЗЕРВАЦИЯ: currentTour НЕТ, спросите "Для какого тура вы хотите создать регистрацию?"',
        ar: '🔴 حجز: currentTour لا يوجد، اسأل "لأي جولة تريد إنشاء تسجيل؟"',
        fr: '🔴 RÉSERVATION: currentTour AUCUN, demandez "Pour quel circuit souhaitez-vous créer une inscription?"',
        es: '🔴 RESERVA: currentTour NINGUNO, pregunte "¿Para qué tour desea crear un registro?"'
      };
      intentInstructions = reservationWithoutTourMessages[language as keyof typeof reservationWithoutTourMessages] || reservationWithoutTourMessages.tr;
    }
  } else if (intent === 'faq' || intent === 'question') {
    const faqMessages = {
      tr: '🔴 SSS: Direkt cevap ver (max 2 cümle).',
      en: '🔴 FAQ: Give direct answer (max 2 sentences).',
      de: '🔴 FAQ: Geben Sie eine direkte Antwort (max 2 Sätze).',
      ru: '🔴 FAQ: Дайте прямой ответ (макс 2 предложения).',
      ar: '🔴 الأسئلة الشائعة: أعط إجابة مباشرة (جملتان كحد أقصى).',
      fr: '🔴 FAQ: Donnez une réponse directe (max 2 phrases).',
      es: '🔴 FAQ: Dé una respuesta directa (máx 2 oraciones).'
    };
    intentInstructions = faqMessages[language as keyof typeof faqMessages] || faqMessages.tr;
  } else {
    const generalMessages = {
      tr: '🔴 GENEL: Kısa ve net cevap (max 3 cümle).',
      en: '🔴 GENERAL: Short and clear answer (max 3 sentences).',
      de: '🔴 ALLGEMEIN: Kurze und klare Antwort (max 3 Sätze).',
      ru: '🔴 ОБЩЕЕ: Краткий и четкий ответ (макс 3 предложения).',
      ar: '🔴 عام: إجابة قصيرة وواضحة (3 جمل كحد أقصى).',
      fr: '🔴 GÉNÉRAL: Réponse courte et claire (max 3 phrases).',
      es: '🔴 GENERAL: Respuesta breve y clara (máx 3 oraciones).'
    };
    intentInstructions = generalMessages[language as keyof typeof generalMessages] || generalMessages.tr;
  }

  return fullPrompt + '\n\n' + intentInstructions;
}
