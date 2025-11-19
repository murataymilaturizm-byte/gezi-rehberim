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

// Multi-language month names
const MONTH_NAMES: Record<string, string[]> = {
  tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
};

// Multi-language labels for UI elements
const UI_LABELS: Record<string, any> = {
  tr: {
    destination: 'Destinasyon',
    price: 'Fiyat',
    adult: 'Yetişkin',
    child: 'Çocuk',
    duration: 'Süre',
    askPrice: 'Fiyat Sorabilirsiniz',
    quota: 'Kota',
    person: 'kişi'
  },
  en: {
    destination: 'Destination',
    price: 'Price',
    adult: 'Adult',
    child: 'Child',
    duration: 'Duration',
    askPrice: 'Ask for Price',
    quota: 'Quota',
    person: 'people'
  },
  de: {
    destination: 'Ziel',
    price: 'Preis',
    adult: 'Erwachsene',
    child: 'Kind',
    duration: 'Dauer',
    askPrice: 'Nach Preis fragen',
    quota: 'Kontingent',
    person: 'Personen'
  },
  ru: {
    destination: 'Направление',
    price: 'Цена',
    adult: 'Взрослый',
    child: 'Ребенок',
    duration: 'Продолжительность',
    askPrice: 'Уточнить цену',
    quota: 'Квота',
    person: 'человек'
  },
  ar: {
    destination: 'الوجهة',
    price: 'السعر',
    adult: 'بالغ',
    child: 'طفل',
    duration: 'المدة',
    askPrice: 'اسأل عن السعر',
    quota: 'الحصة',
    person: 'شخص'
  },
  fr: {
    destination: 'Destination',
    price: 'Prix',
    adult: 'Adulte',
    child: 'Enfant',
    duration: 'Durée',
    askPrice: 'Demander le prix',
    quota: 'Quota',
    person: 'personnes'
  },
  es: {
    destination: 'Destino',
    price: 'Precio',
    adult: 'Adulto',
    child: 'Niño',
    duration: 'Duración',
    askPrice: 'Preguntar precio',
    quota: 'Cuota',
    person: 'personas'
  }
};

// Format date according to language
function formatDate(dateString: string, language: string): string {
  const months = MONTH_NAMES[language] || MONTH_NAMES.tr;
  const date = new Date(dateString);
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  // Different formats for different languages
  if (language === 'de') {
    return `${day}. ${month} ${year}`;
  } else if (language === 'en') {
    return `${month} ${day}, ${year}`;
  } else if (language === 'ru') {
    return `${day} ${month} ${year}`;
  } else if (language === 'ar') {
    return `${day} ${month} ${year}`;
  } else if (language === 'fr') {
    return `${day} ${month} ${year}`;
  } else if (language === 'es') {
    return `${day} de ${month} de ${year}`;
  }
  
  return `${day} ${month} ${year}`; // Turkish default
}

function formatToursContext(tours: any[], language: string = 'tr'): string {
  const labels = UI_LABELS[language] || UI_LABELS.tr;
  
  return tours.map((tour, index) => {
    const firstDate = tour.dates?.[0];
    const priceText = firstDate ? `${firstDate.price_adult} ${tour.currency}` : labels.askPrice;
    
    const parts = [
      `**${index + 1}. ${tour.title}**`,
      `• 📍 ${labels.destination}: ${tour.destination}`,
      `• 💰 ${labels.price}: ${priceText} (${labels.adult})`,
    ];
    
    if (tour.tur_sure) {
      parts.push(`• ⏱️ ${labels.duration}: ${tour.tur_sure}`);
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

// Section headers by language
const SECTION_HEADERS: Record<string, any> = {
  tr: {
    conversationStyle: '🎨 KONUŞMA STİLİ',
    availableTours: '📋 MEVCUT TURLAR',
    availableDates: '📅 MEVCUT TARİHLER VE FİYATLAR',
    contextInfo: '🎯 KONTEXT BİLGİSİ',
    currentIntent: 'Şu anki intent',
    wizardStep: 'Wizard adımı',
    selectedTour: 'Seçili tur',
    lastMentionedTour: 'Son bahsedilen tur',
    previouslyShownTours: 'Daha önce gösterilen turlar',
    none: 'Yok'
  },
  en: {
    conversationStyle: '🎨 CONVERSATION STYLE',
    availableTours: '📋 AVAILABLE TOURS',
    availableDates: '📅 AVAILABLE DATES AND PRICES',
    contextInfo: '🎯 CONTEXT INFO',
    currentIntent: 'Current intent',
    wizardStep: 'Wizard step',
    selectedTour: 'Selected tour',
    lastMentionedTour: 'Last mentioned tour',
    previouslyShownTours: 'Previously shown tours',
    none: 'None'
  },
  de: {
    conversationStyle: '🎨 GESPRÄCHSSTIL',
    availableTours: '📋 VERFÜGBARE TOUREN',
    availableDates: '📅 VERFÜGBARE TERMINE UND PREISE',
    contextInfo: '🎯 KONTEXTINFO',
    currentIntent: 'Aktuelle Absicht',
    wizardStep: 'Assistenten-Schritt',
    selectedTour: 'Ausgewählte Tour',
    lastMentionedTour: 'Zuletzt erwähnte Tour',
    previouslyShownTours: 'Zuvor angezeigte Touren',
    none: 'Keine'
  },
  ru: {
    conversationStyle: '🎨 СТИЛЬ РАЗГОВОРА',
    availableTours: '📋 ДОСТУПНЫЕ ТУРЫ',
    availableDates: '📅 ДОСТУПНЫЕ ДАТЫ И ЦЕНЫ',
    contextInfo: '🎯 ИНФОРМАЦИЯ О КОНТЕКСТЕ',
    currentIntent: 'Текущее намерение',
    wizardStep: 'Шаг мастера',
    selectedTour: 'Выбранный тур',
    lastMentionedTour: 'Последний упомянутый тур',
    previouslyShownTours: 'Ранее показанные туры',
    none: 'Нет'
  },
  ar: {
    conversationStyle: '🎨 أسلوب المحادثة',
    availableTours: '📋 الجولات المتاحة',
    availableDates: '📅 التواريخ والأسعار المتاحة',
    contextInfo: '🎯 معلومات السياق',
    currentIntent: 'النية الحالية',
    wizardStep: 'خطوة المعالج',
    selectedTour: 'الجولة المحددة',
    lastMentionedTour: 'آخر جولة مذكورة',
    previouslyShownTours: 'الجولات المعروضة سابقًا',
    none: 'لا يوجد'
  },
  fr: {
    conversationStyle: '🎨 STYLE DE CONVERSATION',
    availableTours: '📋 CIRCUITS DISPONIBLES',
    availableDates: '📅 DATES ET PRIX DISPONIBLES',
    contextInfo: '🎯 INFORMATIONS DE CONTEXTE',
    currentIntent: 'Intention actuelle',
    wizardStep: 'Étape de l\'assistant',
    selectedTour: 'Circuit sélectionné',
    lastMentionedTour: 'Dernier circuit mentionné',
    previouslyShownTours: 'Circuits précédemment affichés',
    none: 'Aucun'
  },
  es: {
    conversationStyle: '🎨 ESTILO DE CONVERSACIÓN',
    availableTours: '📋 TOURS DISPONIBLES',
    availableDates: '📅 FECHAS Y PRECIOS DISPONIBLES',
    contextInfo: '🎯 INFORMACIÓN DE CONTEXTO',
    currentIntent: 'Intención actual',
    wizardStep: 'Paso del asistente',
    selectedTour: 'Tour seleccionado',
    lastMentionedTour: 'Último tour mencionado',
    previouslyShownTours: 'Tours mostrados anteriormente',
    none: 'Ninguno'
  }
};

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
  const headers = SECTION_HEADERS[language] || SECTION_HEADERS.tr;
  const labels = UI_LABELS[language] || UI_LABELS.tr;
  
  const shownTourIds = conversationState?.shownTourIds || [];
  const userMemory = conversationState?.userMemory;
  const stateContextInfo = conversationState?.stateContext || '';
  
  // Extract last discussed tour from history
  const lastDiscussedTour = extractLastTourFromHistory(history);
  
  // Format tours context with language support
  const toursContext = formatToursContext(tours, language);
  
  // Build personalized context from user memory
  const personalizedContext = userMemory ? buildPersonalizedContext(userMemory, tours, language) : '';
  
  // Get style personality and intent prompt
  const stylePersonality = getStylePersonality(language, conversationStyle);
  const intentPrompt = getIntentPrompt(intent, language);

  // Base system prompt and guidelines
  const basePrompt = getBaseSystemPrompt(language);
  const guidelines = getResponseGuidelines(language);

  // Add tour dates context if a specific tour is selected
  let datesContext = '';
  if (currentTour) {
    const selectedTourData = tours.find(t => 
      t.title === currentTour.title || t.id === currentTour.id
    );
    
    if (selectedTourData?.dates && selectedTourData.dates.length > 0) {
      datesContext = `\n\n${headers.availableDates} (${selectedTourData.title}):\n`;
      selectedTourData.dates.forEach((date: any, index: number) => {
        const formattedDate = formatDate(date.departure_date, language);
        datesContext += `${index + 1}. **${formattedDate}**\n`;
        datesContext += `   💰 ${labels.adult}: ${date.price_adult} ${selectedTourData.currency}\n`;
        if (date.price_child) {
          datesContext += `   👶 ${labels.child}: ${date.price_child} ${selectedTourData.currency}\n`;
        }
        datesContext += `   📊 ${labels.quota}: ${date.quota} ${labels.person}\n\n`;
      });
    }
  }

  // Build the final prompt
  return `${basePrompt}

${guidelines}

${headers.conversationStyle}:
${stylePersonality}

${intentPrompt}

${headers.availableTours}:
${toursContext}

${datesContext}

${personalizedContext}

${headers.contextInfo}:
- ${headers.currentIntent}: ${intent}
- ${headers.wizardStep}: ${wizardStep}
- ${headers.selectedTour}: ${currentTour?.title || headers.none}
- ${headers.lastMentionedTour}: ${lastDiscussedTour || headers.none}
- ${headers.previouslyShownTours}: ${shownTourIds.length > 0 ? shownTourIds.join(', ') : headers.none}
${stateContextInfo}`;
}

// Helper to extract last tour from conversation
function extractLastTourFromHistory(history: any[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === 'assistant' && msg.content) {
      const tourMatch = msg.content.match(/\*\*\d+\.\s+([^*]+)\*\*/);
      if (tourMatch) {
        return tourMatch[1].trim();
      }
    }
  }
  return null;
}

