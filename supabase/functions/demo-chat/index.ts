import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Import WhatsApp webhook modular services
import { detectIntent } from '../whatsapp-webhook/services/intent-detector.ts';
import { handleDemoIntelligently } from './handlers/demo-intelligent.ts';
import { 
  getWizardState, 
  saveWizardState, 
  handleWizardStep 
} from '../whatsapp-webhook/handlers/wizard.ts';
import type { WizardState } from '../whatsapp-webhook/types.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_AGENCY_ID = "00000000-0000-0000-0000-000000000000";

// Demo tours data
const DEMO_TOURS = [
  {
    id: 'demo-kapadokya-1',
    title: 'Kapadokya Balon Turu',
    destination: 'Kapadokya',
    type: 'DAYTRIP',
    currency: 'TRY',
    program_kisa: 'Kapadokya\'da unutulmaz bir balon deneyimi. Gün doğumunda balonla havalanıp peribacalarını kuş bakışı görün.',
    gezilecek_yerler: 'Göreme, Peribacaları, Uçhisar Kalesi',
    dates: [
      { id: 'demo-date-1', departure_date: '2025-12-15', price_adult: 1500, quota: 20, return_date: '2025-12-15' },
      { id: 'demo-date-2', departure_date: '2025-12-22', price_adult: 1500, quota: 15, return_date: '2025-12-22' },
      { id: 'demo-date-3', departure_date: '2025-12-29', price_adult: 1650, quota: 10, return_date: '2025-12-29' }
    ]
  },
  {
    id: 'demo-pamukkale-1',
    title: 'Pamukkale Turu',
    destination: 'Pamukkale',
    type: 'N2',
    currency: 'TRY',
    program_kisa: 'Beyaz cennet Pamukkale ve Hierapolis antik kentini keşfedin. 4 yıldızlı otelde konaklama.',
    gezilecek_yerler: 'Pamukkale Travertenleri, Hierapolis Antik Kenti, Kleopatra Havuzu',
    dates: [
      { id: 'demo-date-4', departure_date: '2025-12-10', price_adult: 3500, quota: 15, return_date: '2025-12-12' },
      { id: 'demo-date-5', departure_date: '2025-12-20', price_adult: 3500, quota: 12, return_date: '2025-12-22' }
    ]
  },
  {
    id: 'demo-antalya-1',
    title: 'Antalya Rafting',
    destination: 'Antalya',
    type: 'DAYTRIP',
    currency: 'TRY',
    program_kisa: 'Köprülü Kanyon\'da heyecan dolu rafting macerası. Deneyimli eğitmenler eşliğinde güvenli ve eğlenceli.',
    gezilecek_yerler: 'Köprülü Kanyon, Rafting Parkuru',
    dates: [
      { id: 'demo-date-6', departure_date: '2025-12-05', price_adult: 800, quota: 30, return_date: '2025-12-05' },
      { id: 'demo-date-7', departure_date: '2025-12-12', price_adult: 800, quota: 25, return_date: '2025-12-12' }
    ]
  },
  {
    id: 'demo-ege-1',
    title: 'Ege Turu',
    destination: 'İzmir-Çeşme-Alaçatı',
    type: 'N3',
    currency: 'TRY',
    program_kisa: 'Ege\'nin incisi Çeşme, Alaçatı ve Efes Antik Kenti\'ni keşfedin. Butik otel konaklaması.',
    gezilecek_yerler: 'Çeşme, Alaçatı, Efes Antik Kenti, İzmir',
    dates: [
      { id: 'demo-date-8', departure_date: '2025-12-08', price_adult: 8999, quota: 12, return_date: '2025-12-15' }
    ]
  },
  {
    id: 'demo-istanbul-1',
    title: 'İstanbul Turu',
    destination: 'İstanbul',
    type: 'N2',
    currency: 'TRY',
    program_kisa: 'İstanbul\'un tarihi ve kültürel zenginliklerini keşfedin. Ayasofya, Topkapı Sarayı ve Boğaz turu.',
    gezilecek_yerler: 'Ayasofya, Topkapı Sarayı, Sultanahmet, Boğaz',
    dates: [
      { id: 'demo-date-9', departure_date: '2025-12-07', price_adult: 2999, quota: 25, return_date: '2025-12-09' }
    ]
  }
];

// Demo user profiles (in-memory)
const demoUserProfiles: Map<string, any> = new Map();

async function saveMessage(supabase: any, sessionId: string, role: string, content: string) {
  try {
    await supabase
      .from('whatsapp_conversations')
      .insert({
        phone: `demo_${sessionId}`,
        role: role,
        content: content,
        agency_id: DEMO_AGENCY_ID
      });
  } catch (error) {
    console.error('Error saving demo message:', error);
  }
}

function getUserProfile(sessionId: string) {
  if (!demoUserProfiles.has(sessionId)) {
    demoUserProfiles.set(sessionId, {
      phone: `demo_${sessionId}`,
      agency_id: DEMO_AGENCY_ID,
      language_preference: 'tr',
      total_messages: 0,
      last_interaction_at: new Date().toISOString()
    });
  }
  return demoUserProfiles.get(sessionId);
}

function upsertUserProfile(sessionId: string, message: string) {
  const profile = getUserProfile(sessionId);
  profile.total_messages += 1;
  profile.last_interaction_at = new Date().toISOString();
  profile.last_search_query = message;
  demoUserProfiles.set(sessionId, profile);
}

// Mock agency with conversation style
const DEMO_AGENCY = {
  id: DEMO_AGENCY_ID,
  conversation_style: 'friendly',
  enabled_languages: ['tr', 'en', 'de', 'ru', 'ar', 'fr', 'es'],
  plan_type: 'enterprise'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, sessionId, conversationStyle } = await req.json();

    if (!message || !sessionId) {
      return new Response(
        JSON.stringify({ error: 'Message and sessionId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Save user message
    await saveMessage(supabase, sessionId, 'user', message);
    upsertUserProfile(sessionId, message);

    const userProfile = getUserProfile(sessionId);
    const userLanguage = userProfile.language_preference || 'tr';
    
    // Use conversation style from request or default
    const activeConversationStyle = conversationStyle || DEMO_AGENCY.conversation_style;

    // Check if user is in wizard mode (using session ID as phone)
    const wizardState = await getWizardState(supabase, `demo_${sessionId}`, DEMO_AGENCY_ID);
    
    if (wizardState) {
      console.log('Demo: Continuing wizard flow at step:', wizardState.step);
      const wizardResponse = await handleWizardStep(
        supabase,
        `demo_${sessionId}`,
        DEMO_AGENCY_ID,
        message,
        wizardState
      );
      
      await saveMessage(supabase, sessionId, 'assistant', wizardResponse);
      
      return new Response(
        JSON.stringify({ response: wizardResponse, type: 'reservation.wizard' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check canned responses
    const cannedTrigger = detectCannedResponseTrigger(message, userLanguage);
    if (cannedTrigger) {
      const response = getCannedResponse(cannedTrigger, userLanguage);
      if (response) {
        await saveMessage(supabase, sessionId, 'assistant', response);
        return new Response(
          JSON.stringify({ response, type: 'canned' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check FAQ (mock - no FAQs in demo)
    // const faqResponse = await checkFAQ(supabase, message, DEMO_AGENCY_ID, userLanguage);

    // Get conversation history to check if this is a continuing conversation
    const { data: historyData, error: historyError } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('phone', `demo_${sessionId}`)
      .eq('agency_id', DEMO_AGENCY_ID)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (historyError) {
      console.error('Demo: Error fetching history:', historyError);
    }
    
    // Check if user has meaningful conversation history (at least 2 exchanges = 4 messages)
    const hasHistory = historyData && historyData.length >= 4;
    console.log('Demo: Phone:', `demo_${sessionId}`, 'History count:', historyData?.length || 0, 'Has history:', hasHistory);

    // Categorize message - pass conversation history for better context
    const intent = await categorizeMessage(message, historyData || [], userLanguage);
    let responseMessage = '';
    let responseType = intent.type;

    console.log('Demo chat - Intent:', intent.type, 'Has history:', hasHistory, 'Message length:', message.length, 'History entries:', historyData?.length || 0);
    console.log('Demo chat - Message:', message.substring(0, 100));
    console.log('Demo chat - Intent confidence:', intent.confidence);

    switch (intent.type) {
      case 'greeting':
        // If has history and user just says hello, give brief response
        if (hasHistory && (message.toLowerCase().includes('merhaba') || 
                          message.toLowerCase().includes('selam') ||
                          message.toLowerCase().includes('hello') ||
                          message.toLowerCase().includes('hi'))) {
          const greetingResponses = {
            tr: 'Merhaba, yardımcı olmam için bana gitmek istediğin yerleri ya da tur türünü yazabilirsin. 😊',
            en: 'Hello, you can tell me the places you want to visit or the type of tour you prefer. 😊',
            de: 'Hallo, Sie können mir die Orte mitteilen, die Sie besuchen möchten, oder die Art der Tour. 😊',
            ru: 'Привет, вы можете сказать мне места, которые хотите посетить, или тип тура. 😊',
            ar: 'مرحبا، يمكنك إخباري بالأماكن التي تريد زيارتها أو نوع الجولة. 😊',
            fr: 'Bonjour, vous pouvez me dire les endroits que vous souhaitez visiter ou le type de circuit. 😊',
            es: 'Hola, puedes decirme los lugares que quieres visitar o el tipo de tour. 😊'
          };
          responseMessage = greetingResponses[userLanguage as keyof typeof greetingResponses] || greetingResponses['tr'];
        } else {
          responseMessage = await handleGreeting(
            supabase, 
            `demo_${sessionId}`, 
            DEMO_AGENCY_ID, 
            message, 
            activeConversationStyle
          );
        }
        break;
      
      case 'reservation.wizard':
        // Start reservation wizard - extract last discussed tour from history
        console.log('Demo: Starting reservation wizard');
        
        // Extract last discussed tour from conversation history
        // History comes ordered by created_at DESC (newest first), so iterate from start
        let lastTour = null;
        const tourPatterns = [
          { patterns: ['pamukkale'], name: 'Pamukkale Turu' },
          { patterns: ['kapadokya', 'balon', 'kappadocia'], name: 'Kapadokya Balon Turu' },
          { patterns: ['antalya', 'rafting'], name: 'Antalya Rafting' },
          { patterns: ['ege', 'çeşme', 'alaçatı', 'alacati'], name: 'Ege Turu' },
          { patterns: ['istanbul', 'İstanbul'], name: 'İstanbul Turu' }
        ];
        
        if (historyData && historyData.length > 0) {
          // First pass: Check assistant messages (more reliable - they describe tours in detail)
          for (let i = 0; i < historyData.length && !lastTour; i++) {
            if (historyData[i].role === 'assistant') {
              const content = historyData[i].content.toLowerCase();
              for (const tourPattern of tourPatterns) {
                if (tourPattern.patterns.some(pattern => content.includes(pattern.toLowerCase()))) {
                  lastTour = tourPattern.name;
                  break;
                }
              }
            }
          }
          
          // Second pass: If not found in assistant, check user messages
          if (!lastTour) {
            for (let i = 0; i < historyData.length; i++) {
              if (historyData[i].role === 'user') {
                const content = historyData[i].content.toLowerCase();
                for (const tourPattern of tourPatterns) {
                  if (tourPattern.patterns.some(pattern => content.includes(pattern.toLowerCase()))) {
                    lastTour = tourPattern.name;
                    break;
                  }
                }
                if (lastTour) break;
              }
            }
          }
        }
        
        console.log('Demo: Last discussed tour from history:', lastTour);
        console.log('Demo: History data length:', historyData?.length);
        console.log('Demo: Recent history:', historyData?.slice(0, 3).map((h: any) => `${h.role}: ${h.content.substring(0, 50)}`));
        
        // If we detected a tour from context, skip tour selection and go to date selection
        const initialState: WizardState = {
          step: lastTour ? 'date_selection' : 'tour_selection',
          created_at: new Date().toISOString()
        };
        
        await saveWizardState(supabase, `demo_${sessionId}`, DEMO_AGENCY_ID, initialState);
        
        if (lastTour) {
          // User already discussed a tour, skip tour selection
          const contextGreetings = {
            tr: `🎯 Harika! ${lastTour} için rezervasyon işleminize başlayalım.\n\n📅 Hangi tarihi tercih edersiniz? Lütfen tarih ve kaç kişi olduğunuzu belirtin.\n\nİptal etmek için "iptal" yazabilirsiniz.`,
            en: `🎯 Great! Let's start your reservation for ${lastTour}.\n\n📅 Which date do you prefer? Please specify the date and number of people.\n\nYou can write "cancel" to abort.`,
            de: `🎯 Großartig! Beginnen wir mit Ihrer Reservierung für ${lastTour}.\n\n📅 Welches Datum bevorzugen Sie? Bitte geben Sie das Datum und die Anzahl der Personen an.\n\nSie können "cancel" schreiben, um abzubrechen.`,
            ru: `🎯 Отлично! Начнем бронирование ${lastTour}.\n\n📅 Какую дату вы предпочитаете? Укажите дату и количество человек.\n\nНапишите "cancel" для отмены.`,
            ar: `🎯 رائع! لنبدأ حجز ${lastTour}.\n\n📅 ما هو التاريخ المفضل لديك؟ حدد التاريخ وعدد الأشخاص.\n\nيمكنك كتابة "cancel" للإلغاء.`,
            fr: `🎯 Super! Commençons votre réservation pour ${lastTour}.\n\n📅 Quelle date préférez-vous? Veuillez préciser la date et le nombre de personnes.\n\nVous pouvez écrire "cancel" pour annuler.`,
            es: `🎯 ¡Genial! Comencemos con su reserva para ${lastTour}.\n\n📅 ¿Qué fecha prefiere? Especifique la fecha y el número de personas.\n\nPuede escribir "cancel" para cancelar.`
          };
          responseMessage = contextGreetings[userLanguage as keyof typeof contextGreetings] || contextGreetings['tr'];
        } else {
          // No tour discussed yet, ask for tour selection
          const wizardGreetings = {
            tr: '🎯 Harika! Rezervasyon işleminize başlayalım.\n\n📋 Lütfen rezervasyon yapmak istediğiniz turun numarasını yazın veya tur adını belirtin.\n\nİptal etmek için "iptal" yazabilirsiniz.',
            en: '🎯 Great! Let\'s start your reservation.\n\n📋 Please write the tour number or name you want to book.\n\nYou can write "cancel" to abort.',
            de: '🎯 Großartig! Beginnen wir mit Ihrer Reservierung.\n\n📋 Bitte geben Sie die Tournummer oder den Namen ein.\n\nSie können "cancel" schreiben, um abzubrechen.',
            es: '🎯 ¡Genial! Comencemos con su reserva.\n\n📋 Por favor escriba el número o nombre del tour.\n\nPuede escribir "cancel" para cancelar.',
            fr: '🎯 Super! Commençons votre réservation.\n\n📋 Veuillez écrire le numéro ou le nom du tour.\n\nVous pouvez écrire "cancel" pour annuler.',
            ru: '🎯 Отлично! Начнем бронирование.\n\n📋 Пожалуйста, напишите номер или название тура.\n\nНапишите "cancel" для отмены.',
            ar: '🎯 رائع! لنبدأ حجزك.\n\n📋 يرجى كتابة رقم أو اسم الجولة.\n\nيمكنك كتابة "cancel" للإلغاء.'
          };
          responseMessage = wizardGreetings[userLanguage as keyof typeof wizardGreetings] || wizardGreetings['tr'];
        }
        
        responseType = 'reservation.wizard';
        break;
      
      case 'tour.list':
        // Use demo tours instead of database
        responseMessage = formatAllDemoTours(userLanguage, activeConversationStyle);
        break;
      
      case 'tour.search':
        responseMessage = await handleDemoTourSearch(
          supabase, 
          `demo_${sessionId}`, 
          DEMO_AGENCY_ID, 
          message,
          activeConversationStyle
        );
        break;
      
      default:
        responseMessage = await handleGeneralChat(
          supabase, 
          `demo_${sessionId}`, 
          DEMO_AGENCY_ID, 
          message, 
          activeConversationStyle
        );
    }

    await saveMessage(supabase, sessionId, 'assistant', responseMessage);

    return new Response(
      JSON.stringify({ 
        response: responseMessage,
        type: responseType,
        conversationStyle: activeConversationStyle
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in demo-chat:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function formatAllDemoTours(language: string = 'tr', style: string = 'friendly'): string {
  const headers: Record<string, string> = {
    tr: `✨ İşte sizin için hazırladığım turlar:\n\n`,
    en: `✨ Here are our available tours:\n\n`,
    de: `✨ Hier sind unsere verfügbaren Touren:\n\n`,
    ru: `✨ Вот наши доступные туры:\n\n`,
    ar: `✨ إليك جولاتنا المتاحة:\n\n`,
    fr: `✨ Voici nos circuits disponibles:\n\n`,
    es: `✨ Aquí están nuestros tours disponibles:\n\n`
  };

  let response = headers[language] || headers['tr'];

  DEMO_TOURS.forEach((tour, index) => {
    const firstDate = tour.dates[0];
    response += `${index + 1}. *${tour.title}*\n   📍 ${tour.destination} | 📅 ${formatDate(firstDate.departure_date, language)}\n\n`;
  });

  const callToAction: Record<string, string> = {
    tr: '💡 Herhangi bir tur hakkında daha fazla bilgi almak için tur numarasını yazabilir veya "detay göster" diyebilirsiniz.',
    en: '💡 For more information about any tour, you can write the tour number or say "show details".',
    de: '💡 Für weitere Informationen zu einer Tour können Sie die Tournummer eingeben oder "Details zeigen" sagen.',
    ru: '💡 Для получения дополнительной информации о туре введите номер тура или скажите "показать детали".',
    ar: '💡 لمزيد من المعلومات حول أي جولة، يمكنك كتابة رقم الجولة أو قول "إظهار التفاصيل".',
    fr: '💡 Pour plus d\'informations sur un circuit, vous pouvez écrire le numéro du circuit ou dire "afficher les détails".',
    es: '💡 Para más información sobre cualquier tour, puede escribir el número del tour o decir "mostrar detalles".'
  };

  response += callToAction[language] || callToAction['tr'];
  return response;
}

// Helper function to format date for demo
function formatDate(dateString: string, language: string = 'tr'): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  };
  
  const locales: Record<string, string> = {
    tr: 'tr-TR',
    en: 'en-US',
    de: 'de-DE',
    ru: 'ru-RU',
    ar: 'ar-SA',
    fr: 'fr-FR',
    es: 'es-ES'
  };
  
  return date.toLocaleDateString(locales[language] || 'tr-TR', options);
}

async function handleDemoTourSearch(
  supabase: any,
  phone: string,
  agencyId: string,
  message: string,
  conversationStyle: string
): Promise<string> {
  // Get user language
  const userProfile = getUserProfile(phone.replace('demo_', ''));
  const language = userProfile?.language_preference || 'tr';

  // Search in demo tours
  const searchLower = message.toLowerCase();
  const matchedTours = DEMO_TOURS.filter(tour => 
    tour.title.toLowerCase().includes(searchLower) ||
    tour.destination.toLowerCase().includes(searchLower) ||
    (tour.gezilecek_yerler && tour.gezilecek_yerler.toLowerCase().includes(searchLower))
  );

  if (matchedTours.length === 0) {
    // Use AI to search
    return await handleGeneralChat(supabase, phone, agencyId, message, conversationStyle);
  }

  // Check conversation history to see if user is selecting or requesting details
  const { data: history } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('phone', phone)
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
    .limit(5);
  
  const lastAssistantMessage = history?.find((msg: any) => msg.role === 'assistant')?.content || '';
  
  // Keywords for selecting a tour from list
  const tourSelectKeywords = {
    tr: ['birinci', 'ikinci', 'üçüncü', 'dördüncü', 'beşinci', '1.', '2.', '3.', '4.', '5.', '1 ', '2 ', '3 ', '4 ', '5 '],
    en: ['first', 'second', 'third', 'fourth', 'fifth', '1.', '2.', '3.', '4.', '5.', '1 ', '2 ', '3 ', '4 ', '5 '],
    de: ['erste', 'zweite', 'dritte', 'vierte', 'fünfte', '1.', '2.', '3.', '4.', '5.', '1 ', '2 ', '3 ', '4 ', '5 '],
    ru: ['первый', 'второй', 'третий', 'четвертый', 'пятый', '1.', '2.', '3.', '4.', '5.', '1 ', '2 ', '3 ', '4 ', '5 '],
    ar: ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', '1.', '2.', '3.', '4.', '5.', '1 ', '2 ', '3 ', '4 ', '5 '],
    fr: ['premier', 'deuxième', 'troisième', 'quatrième', 'cinquième', '1.', '2.', '3.', '4.', '5.', '1 ', '2 ', '3 ', '4 ', '5 '],
    es: ['primero', 'segundo', 'tercero', 'cuarto', 'quinto', '1.', '2.', '3.', '4.', '5.', '1 ', '2 ', '3 ', '4 ', '5 ']
  };

  const selectKeywords = tourSelectKeywords[language as keyof typeof tourSelectKeywords] || tourSelectKeywords.tr;
  const isSelectingTour = selectKeywords.some(keyword => message.toLowerCase().includes(keyword));

  // Check if user is requesting detailed program
  const detailKeywords = {
    tr: ['detaylı', 'program', 'tam program', 'tüm bilgi', 'ayrıntı', 'programı paylaş', 'tüm detaylar'],
    en: ['detailed', 'program', 'full program', 'all info', 'detail', 'share program', 'all details'],
    de: ['detailliert', 'programm', 'vollständiges programm', 'alle infos'],
    ru: ['подробный', 'программа', 'полная программа', 'все сведения'],
    ar: ['تفصيلي', 'برنامج', 'برنامج كامل', 'جميع المعلومات'],
    fr: ['détaillé', 'programme', 'programme complet', 'toutes les infos'],
    es: ['detallado', 'programa', 'programa completo', 'toda la info']
  };

  const detailKw = detailKeywords[language as keyof typeof detailKeywords] || detailKeywords.tr;
  const isRequestingDetail = detailKw.some(keyword => message.toLowerCase().includes(keyword));

  // If requesting detailed program and we know the tour, show full details
  if (isRequestingDetail && lastAssistantMessage.includes('❓')) {
    const tour = matchedTours[0];
    return formatDemoTourDetail(tour, language);
  }

  // If user is selecting a tour from the list, show brief summary
  if (isSelectingTour && lastAssistantMessage.includes('🎯')) {
    const numberMatch = message.match(/\d+/);
    if (numberMatch) {
      const tourIndex = parseInt(numberMatch[0]) - 1;
      if (tourIndex >= 0 && tourIndex < matchedTours.length) {
        return formatDemoTourBrief(matchedTours[tourIndex], language);
      }
    }
    if (matchedTours.length === 1) {
      return formatDemoTourBrief(matchedTours[0], language);
    }
  }

  // If multiple tours found, show list
  if (matchedTours.length > 1) {
    return formatDemoTourList(matchedTours, language);
  }
  
  // If only one tour found, show brief summary directly
  if (matchedTours.length === 1) {
    return formatDemoTourBrief(matchedTours[0], language);
  }

  return formatDemoTourList(matchedTours, language);
}

// Format demo tour list (summary)
function formatDemoTourList(tours: any[], language: string): string {
  const labels = {
    tr: {
      foundTours: '🎯 Bulduğum turlar',
      moreInfo: '\n\n💡 Hangi tur ile ilgileniyorsunuz? Tur numarasını veya adını yazabilirsiniz.'
    },
    en: {
      foundTours: '🎯 Tours I found',
      moreInfo: '\n\n💡 Which tour are you interested in? You can write the tour number or name.'
    },
    de: {
      foundTours: '🎯 Gefundene Touren',
      moreInfo: '\n\n💡 Für welche Tour interessieren Sie sich? Sie können die Tournummer oder den Namen eingeben.'
    },
    ru: {
      foundTours: '🎯 Найденные туры',
      moreInfo: '\n\n💡 Какой тур вас интересует? Можете написать номер или название тура.'
    },
    ar: {
      foundTours: '🎯 الجولات التي وجدتها',
      moreInfo: '\n\n💡 أي جولة تهمك؟ يمكنك كتابة رقم الجولة أو الاسم.'
    },
    fr: {
      foundTours: '🎯 Circuits trouvés',
      moreInfo: '\n\n💡 Quel circuit vous intéresse? Vous pouvez écrire le numéro ou le nom du circuit.'
    },
    es: {
      foundTours: '🎯 Tours encontrados',
      moreInfo: '\n\n💡 ¿Qué tour te interesa? Puedes escribir el número o nombre del tour.'
    }
  };

  const lang = labels[language as keyof typeof labels] || labels.tr;

  const tourList = tours.map((tour, index) => {
    const firstDate = tour.dates[0];
    const dateStr = formatDate(firstDate.departure_date, language);
    return `${index + 1}. *${tour.title}*\n   📍 ${tour.destination} | 📅 ${dateStr}`;
  }).join('\n\n');

  return `${lang.foundTours}:\n\n${tourList}${lang.moreInfo}`;
}

// Format demo tour brief (not full details)
function formatDemoTourBrief(tour: any, language: string): string {
  const dateInfo = tour.dates[0];

  const labels = {
    tr: {
      departure: 'Çıkış',
      return: 'Dönüş',
      price: 'Fiyat',
      quota: 'Kontenjan',
      spots: 'kişilik',
      question: '\n\n❓ Bu tur hakkında öğrenmek istediğiniz başka bir şey var mı? (Fiyat, kalkış noktası, vb.)',
      detailOffer: '\n\n📄 İsterseniz detaylı tur programını paylaşabilirim.'
    },
    en: {
      departure: 'Departure',
      return: 'Return',
      price: 'Price',
      quota: 'Quota',
      spots: 'spots',
      question: '\n\n❓ Is there anything else you would like to know about this tour?',
      detailOffer: '\n\n📄 I can share the detailed tour program if you wish.'
    },
    de: {
      departure: 'Abfahrt',
      return: 'Rückkehr',
      price: 'Preis',
      quota: 'Kontingent',
      spots: 'Plätze',
      question: '\n\n❓ Gibt es noch etwas, das Sie über diese Tour wissen möchten?',
      detailOffer: '\n\n📄 Ich kann Ihnen auf Wunsch das detaillierte Tourprogramm mitteilen.'
    },
    ru: {
      departure: 'Отправление',
      return: 'Возвращение',
      price: 'Цена',
      quota: 'Квота',
      spots: 'мест',
      question: '\n\n❓ Есть ли что-то еще, что вы хотели бы узнать об этом туре?',
      detailOffer: '\n\n📄 При желании могу поделиться подробной программой тура.'
    },
    ar: {
      departure: 'المغادرة',
      return: 'العودة',
      price: 'السعر',
      quota: 'الحصة',
      spots: 'أماكن',
      question: '\n\n❓ هل هناك أي شيء آخر تريد معرفته عن هذه الجولة؟',
      detailOffer: '\n\n📄 يمكنني مشاركة برنامج الجولة التفصيلي إذا أردت.'
    },
    fr: {
      departure: 'Départ',
      return: 'Retour',
      price: 'Prix',
      quota: 'Quota',
      spots: 'places',
      question: '\n\n❓ Y a-t-il autre chose que vous aimeriez savoir sur ce circuit?',
      detailOffer: '\n\n📄 Je peux partager le programme détaillé du circuit si vous le souhaitez.'
    },
    es: {
      departure: 'Salida',
      return: 'Regreso',
      price: 'Precio',
      quota: 'Cuota',
      spots: 'plazas',
      question: '\n\n❓ ¿Hay algo más que te gustaría saber sobre este tour?',
      detailOffer: '\n\n📄 Puedo compartir el programa detallado del tour si lo deseas.'
    }
  };

  const lang = labels[language as keyof typeof labels] || labels.tr;

  let brief = `🏖️ *${tour.title}*\n📍 ${tour.destination}\n`;
  brief += `📅 ${lang.departure}: ${formatDate(dateInfo.departure_date, language)}\n`;
  
  if (dateInfo.return_date && dateInfo.return_date !== dateInfo.departure_date) {
    brief += `📅 ${lang.return}: ${formatDate(dateInfo.return_date, language)}\n`;
  }

  brief += `💰 ${lang.price}: ${dateInfo.price_adult} ${tour.currency}\n`;
  brief += `👥 ${lang.quota}: ${dateInfo.quota} ${lang.spots}`;
  brief += lang.question;
  brief += lang.detailOffer;

  return brief;
}

// Format demo tour detail (full information)
function formatDemoTourDetail(tour: any, language: string): string {
  const dateLabels: Record<string, any> = {
    tr: { departure: 'Çıkış Tarihi', return: 'Dönüş Tarihi' },
    en: { departure: 'Departure Date', return: 'Return Date' },
    de: { departure: 'Abfahrtsdatum', return: 'Rückkehrdatum' },
    ru: { departure: 'Дата отправления', return: 'Дата возвращения' },
    ar: { departure: 'تاريخ المغادرة', return: 'تاريخ العودة' },
    fr: { departure: 'Date de départ', return: 'Date de retour' },
    es: { departure: 'Fecha de salida', return: 'Fecha de regreso' }
  };
  const lang = dateLabels[language] || dateLabels.tr;
  
  let detail = `🏖️ *${tour.title}*\n📍 ${tour.destination}\n\n`;
  detail += `📝 ${tour.program_kisa}\n\n`;
  detail += `📍 Gezilecek Yerler: ${tour.gezilecek_yerler}\n\n`;
  
  tour.dates.forEach((date: any, idx: number) => {
    detail += `📅 Tarih ${idx + 1}:\n`;
    if (date.return_date && date.return_date !== date.departure_date) {
      detail += `   ${lang.departure}: ${formatDate(date.departure_date, language)}\n`;
      detail += `   ${lang.return}: ${formatDate(date.return_date, language)}\n`;
    } else {
      detail += `   ${formatDate(date.departure_date, language)}\n`;
    }
    detail += `   💰 ${date.price_adult} ${tour.currency}\n`;
    detail += `   👥 ${date.quota} kişilik kontenjan\n\n`;
  });
  
  return detail;
}
