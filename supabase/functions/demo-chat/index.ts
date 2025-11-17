import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Import WhatsApp webhook modular services
import { checkFAQ } from '../whatsapp-webhook/services/faq.ts';
import { categorizeMessage } from '../whatsapp-webhook/services/categorize.ts';
import { detectCannedResponseTrigger, getCannedResponse } from '../whatsapp-webhook/services/canned-responses.ts';

// Import handlers
import { handleGreeting } from '../whatsapp-webhook/handlers/greeting.ts';
import { handleTourList } from '../whatsapp-webhook/handlers/tour-list.ts';
import { handleTourSearch } from '../whatsapp-webhook/handlers/tour-search.ts';
import { handleGeneralChat } from '../whatsapp-webhook/handlers/general-chat.ts';
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
    
    const hasHistory = historyData && historyData.length > 0;
    console.log('Demo: Phone:', `demo_${sessionId}`, 'History count:', historyData?.length || 0, 'Has history:', hasHistory);

    // Categorize message - pass conversation history for better context
    const intent = await categorizeMessage(message, historyData || [], userLanguage);
    let responseMessage = '';
    let responseType = intent.type;

    console.log('Demo chat - Intent:', intent.type, 'Has history:', hasHistory, 'Message length:', message.length, 'History entries:', historyData?.length || 0);

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
        let lastTour = null;
        if (historyData && historyData.length > 0) {
          for (let i = historyData.length - 1; i >= 0; i--) {
            const content = historyData[i].content.toLowerCase();
            if (content.includes('pamukkale')) {
              lastTour = 'Pamukkale Turu';
              break;
            } else if (content.includes('kapadokya') || content.includes('balon')) {
              lastTour = 'Kapadokya Balon Turu';
              break;
            } else if (content.includes('antalya') || content.includes('rafting')) {
              lastTour = 'Antalya Rafting';
              break;
            } else if (content.includes('ege') || content.includes('çeşme') || content.includes('alaçatı')) {
              lastTour = 'Ege Turu';
              break;
            } else if (content.includes('istanbul')) {
              lastTour = 'İstanbul Turu';
              break;
            }
          }
        }
        
        console.log('Demo: Last discussed tour:', lastTour);
        
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
        responseMessage = formatDemoTourList(userLanguage, activeConversationStyle);
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

function formatDemoTourList(language: string = 'tr', style: string = 'friendly'): string {
  const headers: Record<string, string> = {
    tr: `✨ İşte sizin için hazırladığım turlar:\n\n`,
    en: `✨ Here are our available tours:\n\n`,
    de: `✨ Hier sind unsere verfügbaren Touren:\n\n`,
    ru: `✨ Вот наши доступные туры:\n\n`,
    ar: `✨ إليك جولاتنا المتاحة:\n\n`,
    fr: `✨ Voici nos circuits disponibles:\n\n`,
    es: `✨ Aquí están nuestros tours disponibles:\n\n`
  };

  const dateLabels: Record<string, any> = {
    tr: { departure: 'Çıkış', return: 'Dönüş', available: 'tarih mevcut' },
    en: { departure: 'Departure', return: 'Return', available: 'dates available' },
    de: { departure: 'Abfahrt', return: 'Rückkehr', available: 'Termine verfügbar' },
    ru: { departure: 'Отправление', return: 'Возвращение', available: 'даты доступны' },
    ar: { departure: 'المغادرة', return: 'العودة', available: 'التواريخ المتاحة' },
    fr: { departure: 'Départ', return: 'Retour', available: 'dates disponibles' },
    es: { departure: 'Salida', return: 'Regreso', available: 'fechas disponibles' }
  };

  const lang = dateLabels[language] || dateLabels.tr;
  let response = headers[language] || headers['tr'];

  DEMO_TOURS.forEach((tour, index) => {
    const minPrice = Math.min(...tour.dates.map(d => d.price_adult));
    const firstDate = tour.dates[0];
    
    response += `${index + 1}. *${tour.title}* (${tour.destination})\n`;
    
    // Format date with departure/return distinction
    if (firstDate.return_date && firstDate.return_date !== firstDate.departure_date) {
      response += `   ${lang.departure}: ${formatDate(firstDate.departure_date, language)}\n`;
      response += `   ${lang.return}: ${formatDate(firstDate.return_date, language)}\n`;
    } else {
      response += `   📅 ${formatDate(firstDate.departure_date, language)}\n`;
    }
    
    response += `   💰 ${minPrice} ${tour.currency}\n`;
    if (tour.dates.length > 1) {
      response += `   🗓️ +${tour.dates.length - 1} ${lang.available}\n`;
    }
    response += '\n';
  });

  const callToAction: Record<string, string> = {
    tr: '📍 Hangi tur için düşündüğünüz tarihi ve kişi sayısını yazarsanız, size net fiyat ve uygunluk bilgisini verebilirim. 😊',
    en: '📍 Tell me which tour you\'re interested in, along with your preferred dates and number of people, and I\'ll provide exact pricing and availability. 😊',
    de: '📍 Sagen Sie mir, welche Tour Sie interessiert, zusammen mit Ihren bevorzugten Daten und der Anzahl der Personen, und ich gebe Ihnen genaue Preise und Verfügbarkeit. 😊',
    ru: '📍 Скажите мне, какой тур вас интересует, вместе с предпочтительными датами и количеством людей, и я предоставлю точную цену и наличие. 😊',
    ar: '📍 أخبرني بالجولة التي تهمك، مع التواريخ المفضلة لديك وعدد الأشخاص، وسأقدم لك السعر الدقيق والتوفر. 😊',
    fr: '📍 Dites-moi quel circuit vous intéresse, avec vos dates préférées et le nombre de personnes, et je vous fournirai le prix exact et la disponibilité. 😊',
    es: '📍 Dime qué tour te interesa, junto con tus fechas preferidas y el número de personas, y te proporcionaré el precio exacto y la disponibilidad. 😊'
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

  const headers: Record<string, string> = {
    tr: '🎯 Size uygun turları buldum:\n\n',
    en: '🎯 I found tours that match your search:\n\n',
    de: '🎯 Ich habe passende Touren gefunden:\n\n',
    ru: '🎯 Я нашел подходящие туры:\n\n',
    ar: '🎯 وجدت جولات تناسبك:\n\n',
    fr: '🎯 J\'ai trouvé des circuits correspondants:\n\n',
    es: '🎯 Encontré tours que coinciden:\n\n'
  };

  const dateLabels: Record<string, any> = {
    tr: { departure: 'Çıkış', return: 'Dönüş' },
    en: { departure: 'Departure', return: 'Return' },
    de: { departure: 'Abfahrt', return: 'Rückkehr' },
    ru: { departure: 'Отправление', return: 'Возвращение' },
    ar: { departure: 'المغادرة', return: 'العودة' },
    fr: { departure: 'Départ', return: 'Retour' },
    es: { departure: 'Salida', return: 'Regreso' }
  };

  const callToActions: Record<string, string> = {
    tr: '\n\n📍 İlgilendiğiniz tur için düşündüğünüz tarihi ve kişi sayısını yazarsanız, size net fiyat ve uygunluk bilgisini verebilirim. 😊',
    en: '\n\n📍 Tell me your preferred dates and number of people for the tour you\'re interested in, and I\'ll provide exact pricing and availability. 😊',
    de: '\n\n📍 Sagen Sie mir Ihre bevorzugten Daten und die Anzahl der Personen für die Tour, die Sie interessiert, und ich gebe Ihnen genaue Preise und Verfügbarkeit. 😊',
    ru: '\n\n📍 Скажите мне предпочтительные даты и количество людей для интересующего вас тура, и я предоставлю точную цену и наличие. 😊',
    ar: '\n\n📍 أخبرني بالتواريخ المفضلة لديك وعدد الأشخاص للجولة التي تهمك، وسأقدم لك السعر الدقيق والتوفر. 😊',
    fr: '\n\n📍 Dites-moi vos dates préférées et le nombre de personnes pour le circuit qui vous intéresse, et je vous fournirai le prix exact et la disponibilité. 😊',
    es: '\n\n📍 Dime tus fechas preferidas y el número de personas para el tour que te interesa, y te proporcionaré el precio exacto y la disponibilidad. 😊'
  };

  const lang = dateLabels[language] || dateLabels.tr;
  let response = headers[language] || headers['tr'];

  matchedTours.forEach((tour) => {
    const minPrice = Math.min(...tour.dates.map(d => d.price_adult));
    const firstDate = tour.dates[0];
    
    response += `🏖️ *${tour.title}* - ${tour.destination}\n`;
    
    // Format date with departure/return
    if (firstDate.return_date && firstDate.return_date !== firstDate.departure_date) {
      response += `📅 ${lang.departure}: ${formatDate(firstDate.departure_date, language)}\n`;
      response += `   ${lang.return}: ${formatDate(firstDate.return_date, language)}\n`;
    } else {
      response += `📅 ${formatDate(firstDate.departure_date, language)}\n`;
    }
    
    response += `💰 ${minPrice} ${tour.currency}\n`;
    response += `📝 ${tour.program_kisa}\n\n`;
  });

  response += callToActions[language] || callToActions['tr'];

  return response;
}
