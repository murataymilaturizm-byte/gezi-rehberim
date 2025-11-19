// Build AI prompts based on conversation context
import type { AIPromptContext, ConversationStage } from '../types.ts';
import { formatTourList } from './tour-matcher.ts';
import { STYLE_PERSONALITIES } from '../config/prompts.ts';

export function buildSystemPrompt(context: AIPromptContext): string {
  const { stage, collectionStep, currentTour, reservationInfo, availableTours, language, conversationStyle } = context;
  
  const basePrompt = getBasePrompt(language);
  const stylePrompt = getStylePrompt(language, conversationStyle);
  const stagePrompt = getStagePrompt(stage, collectionStep, currentTour, reservationInfo, language);
  const toursInfo = `\n\n📋 Mevcut Turlar:\n${formatTourList(availableTours, language)}`;
  
  return basePrompt + '\n\n' + stylePrompt + '\n\n' + stagePrompt + toursInfo;
}

function getBasePrompt(language: string): string {
  const prompts: Record<string, string> = {
    tr: `Sen bir seyahat acentesi rezervasyon asistanısın. Görevin müşterilere tur rezervasyonu yaptırmak.

🎯 TEMEL KURALLAR:
1. Kısa ve net cevaplar ver (max 3 cümle)
2. Asla bilgi uydurma - sadece verilen turları kullan
3. Müşteriden bir seferde tek bilgi iste
4. Her mesajda bir sonraki adımı açıkça belirt`,
    
    en: `You are a travel agency reservation assistant. Your job is to help customers make tour reservations.

🎯 CORE RULES:
1. Keep responses short and clear (max 3 sentences)
2. Never make up information - only use provided tours
3. Ask for one piece of information at a time
4. Clearly indicate the next step in each message`,

    de: `Sie sind ein Reservierungsassistent eines Reisebüros. Ihre Aufgabe ist es, Kunden bei Tourbuchungen zu helfen.

🎯 GRUNDREGELN:
1. Halten Sie Antworten kurz und klar (max. 3 Sätze)
2. Erfinden Sie keine Informationen - verwenden Sie nur angegebene Touren
3. Fragen Sie jeweils nach einer Information
4. Geben Sie in jeder Nachricht den nächsten Schritt klar an`,

    ru: `Вы ассистент по бронированию в туристическом агентстве. Ваша задача помогать клиентам бронировать туры.

🎯 ОСНОВНЫЕ ПРАВИЛА:
1. Давайте короткие и четкие ответы (макс 3 предложения)
2. Не выдумывайте информацию - используйте только предоставленные туры
3. Спрашивайте по одной информации за раз
4. Четко указывайте следующий шаг в каждом сообщении`,

    ar: `أنت مساعد حجز في وكالة سفريات. مهمتك مساعدة العملاء في حجز الجولات.

🎯 القواعد الأساسية:
1. قدم إجابات قصيرة وواضحة (3 جمل كحد أقصى)
2. لا تختلق المعلومات - استخدم فقط الجولات المقدمة
3. اطلب معلومة واحدة في كل مرة
4. حدد الخطوة التالية بوضوح في كل رسالة`,

    fr: `Vous êtes un assistant de réservation d'agence de voyage. Votre rôle est d'aider les clients à réserver des circuits.

🎯 RÈGLES DE BASE:
1. Donnez des réponses courtes et claires (max 3 phrases)
2. N'inventez pas d'informations - utilisez uniquement les circuits fournis
3. Demandez une information à la fois
4. Indiquez clairement la prochaine étape dans chaque message`,

    es: `Eres un asistente de reservas de agencia de viajes. Tu trabajo es ayudar a los clientes a reservar tours.

🎯 REGLAS BÁSICAS:
1. Da respuestas cortas y claras (máx 3 frases)
2. Nunca inventes información - solo usa los tours proporcionados
3. Pide una información a la vez
4. Indica claramente el siguiente paso en cada mensaje`
  };

  return prompts[language] || prompts.tr;
}

function getStylePrompt(language: string, style: string): string {
  const personalities = STYLE_PERSONALITIES[language as keyof typeof STYLE_PERSONALITIES];
  if (!personalities) return '';
  
  return personalities[style as keyof typeof personalities] || personalities.friendly;
}

function getTourDatesPrompt(currentTour: any, language: string): string {
  if (!currentTour?.dates || currentTour.dates.length === 0) {
    return language === 'tr' 
      ? 'Bu tur için şu anda müsait tarih bulunmuyor.'
      : 'No available dates for this tour at the moment.';
  }

  const datesList = currentTour.dates
    .map((date: any, idx: number) => {
      const formattedDate = formatDateForDisplay(date.departure_date);
      return language === 'tr'
        ? `${idx + 1}. ${formattedDate} - ${date.price_adult}₺ (Kontenjan: ${date.quota} kişi)`
        : `${idx + 1}. ${formattedDate} - ${date.price_adult}₺ (Quota: ${date.quota} people)`;
    })
    .join('\n');

  return language === 'tr'
    ? `📅 MÜSAİT TARİHLER:\n${datesList}`
    : `📅 AVAILABLE DATES:\n${datesList}`;
}

function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr);
  const months = {
    tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };
  
  const day = date.getDate();
  const monthIndex = date.getMonth();
  const year = date.getFullYear();
  
  return `${day} ${months.tr[monthIndex]} ${year}`;
}

function getStagePrompt(
  stage: ConversationStage,
  collectionStep: string | undefined,
  currentTour: any,
  reservationInfo: any,
  language: string
): string {
  switch (stage) {
    case 'GREETING':
      return language === 'tr'
        ? `🌟 ŞU AN: İlk karşılama
        
YAPMAN GEREKEN:
- Kısa selamla
- Mevcut turları listele (1-5 numaralı)
- Seçim yapmasını iste`
        : `🌟 CURRENT STAGE: Initial greeting
        
WHAT TO DO:
- Greet briefly
- List available tours (numbered 1-5)
- Ask them to choose`;
    
    case 'EXPLORING':
      return language === 'tr'
        ? `🔍 ŞU AN: Tur araştırma
        
YAPMAN GEREKEN:
- Kullanıcının ilgilendiği turları göster
- Her turun kısa açıklamasını ve fiyatını ver
- Detay için tur seçmesini iste`
        : `🔍 CURRENT STAGE: Tour exploration
        
WHAT TO DO:
- Show tours they're interested in
- Give brief description and price for each
- Ask them to select for details`;
    
    case 'TOUR_SELECTED':
      const tourDetails = getTourDatesPrompt(currentTour, language);
      return language === 'tr'
        ? `✅ ŞU AN: Tur seçildi - ${currentTour?.title}
        
${tourDetails}

YAPMAN GEREKEN:
- Turun detaylarını ve müsait tarihleri göster
- Tarihleri numaralı liste olarak sun (1, 2, 3...)
- Hangi tarih için rezervasyon yapmak istediklerini sor`
        : `✅ CURRENT STAGE: Tour selected - ${currentTour?.title}
        
${tourDetails}

WHAT TO DO:
- Show tour details and available dates
- Present dates as numbered list (1, 2, 3...)
- Ask which date they want to book`;
    
    case 'COLLECTING_INFO':
      return getCollectionStagePrompt(collectionStep!, reservationInfo, language);
    
    case 'CONFIRMING':
      return language === 'tr'
        ? `✅ ŞU AN: Bilgileri onayla
        
TOPLANAN BİLGİLER:
- Tur: ${reservationInfo.tourTitle}
- Tarih: ${reservationInfo.selectedDate}
- Kişi: ${reservationInfo.paxAdult || 0} yetişkin${reservationInfo.paxChild ? `, ${reservationInfo.paxChild} çocuk` : ''}
- İsim: ${reservationInfo.fullName}
- Telefon: ${reservationInfo.phone}

YAPMAN GEREKEN:
- Bilgileri SATIR SATIR düzenli göster
- "Bilgiler doğru mu? Onaylarsanız rezervasyonunuzu tamamlayabilirim." diye sor`
        : `✅ CURRENT STAGE: Confirm information
        
COLLECTED INFO:
- Tour: ${reservationInfo.tourTitle}
- Date: ${reservationInfo.selectedDate}
- People: ${reservationInfo.paxAdult || 0} adult${reservationInfo.paxChild ? `, ${reservationInfo.paxChild} child` : ''}
- Name: ${reservationInfo.fullName}
- Phone: ${reservationInfo.phone}

WHAT TO DO:
- Show info LINE BY LINE organized
- Ask: "Is this information correct? I can complete your reservation if you confirm."`;
    
    case 'COMPLETED':
      return language === 'tr'
        ? `🎉 ŞU AN: Rezervasyon tamamlandı!
        
YAPMAN GEREKEN:
- Kısa teşekkür et
- "Ödeme bilgileri aşağıda" de
- Backend otomatik ödeme bilgisi ekleyecek, sen ekleme!`
        : `🎉 CURRENT STAGE: Reservation completed!
        
WHAT TO DO:
- Thank them briefly
- Say "Payment information below"
- Backend will add payment info automatically, don't add it!`;
    
    default:
      return '';
  }
}

function getCollectionStagePrompt(
  step: string,
  reservationInfo: any,
  language: string
): string {
  switch (step) {
    case 'waiting_for_date':
      return language === 'tr'
        ? `📅 ŞU AN: Tarih bekleniyor
        
YAPMAN GEREKEN:
- "Hangi tarihi tercih edersiniz?" diye sor
- Müsait tarihleri listele`
        : `📅 CURRENT STAGE: Waiting for date
        
WHAT TO DO:
- Ask: "Which date do you prefer?"
- List available dates`;
    
    case 'waiting_for_pax':
      return language === 'tr'
        ? `👥 ŞU AN: Kişi sayısı bekleniyor
        
TOPLANAN:
- Tarih: ${reservationInfo.selectedDate} ✅

YAPMAN GEREKEN:
- "Kaç kişi katılacaksınız?" diye sor`
        : `👥 CURRENT STAGE: Waiting for pax count
        
COLLECTED:
- Date: ${reservationInfo.selectedDate} ✅

WHAT TO DO:
- Ask: "How many people will join?"`;
    
    case 'waiting_for_name':
      return language === 'tr'
        ? `📝 ŞU AN: İsim bekleniyor
        
TOPLANAN:
- Tarih: ${reservationInfo.selectedDate} ✅
- Kişi: ${reservationInfo.paxAdult || 0} ✅

YAPMAN GEREKEN:
- "Tam isminizi alabilir miyim?" diye sor`
        : `📝 CURRENT STAGE: Waiting for name
        
COLLECTED:
- Date: ${reservationInfo.selectedDate} ✅
- People: ${reservationInfo.paxAdult || 0} ✅

WHAT TO DO:
- Ask: "May I have your full name?"`;
    
    case 'waiting_for_phone':
      return language === 'tr'
        ? `📱 ŞU AN: Telefon bekleniyor
        
TOPLANAN:
- Tarih: ${reservationInfo.selectedDate} ✅
- Kişi: ${reservationInfo.paxAdult || 0} ✅
- İsim: ${reservationInfo.fullName} ✅

YAPMAN GEREKEN:
- "Telefon numaranızı alabilir miyim?" diye sor`
        : `📱 CURRENT STAGE: Waiting for phone
        
COLLECTED:
- Date: ${reservationInfo.selectedDate} ✅
- People: ${reservationInfo.paxAdult || 0} ✅
- Name: ${reservationInfo.fullName} ✅

WHAT TO DO:
- Ask: "May I have your phone number?"`;
    
    default:
      return '';
  }
}
