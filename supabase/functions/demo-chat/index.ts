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

    // Categorize message
    const intent = await categorizeMessage(message, [], userLanguage);
    let responseMessage = '';
    let responseType = intent.type;

    switch (intent.type) {
      case 'greeting':
        responseMessage = await handleGreeting(
          supabase, 
          `demo_${sessionId}`, 
          DEMO_AGENCY_ID, 
          message, 
          activeConversationStyle
        );
        break;
      
      case 'reservation.wizard':
        // Start reservation wizard
        console.log('Demo: Starting reservation wizard');
        const initialState: WizardState = {
          step: 'tour_selection',
          created_at: new Date().toISOString()
        };
        
        await saveWizardState(supabase, `demo_${sessionId}`, DEMO_AGENCY_ID, initialState);
        
        const wizardGreetings = {
          tr: '🎯 Harika! Rezervasyon işleminize başlayalım.\n\n📋 Lütfen rezervasyon yapmak istediğiniz turun numarasını yazın veya tur adını belirtin.\n\nİptal etmek için "iptal" yazabilirsiniz.',
          en: '🎯 Great! Let\'s start your reservation.\n\n📋 Please write the tour number or name you want to book.\n\nYou can write "cancel" to abort.',
          de: '🎯 Großartig! Beginnen wir mit Ihrer Reservierung.\n\n📋 Bitte geben Sie die Tournummer oder den Namen ein.\n\nSie können "cancel" schreiben, um abzubrechen.',
          es: '🎯 ¡Genial! Comencemos con su reserva.\n\n📋 Por favor escriba el número o nombre del tour.\n\nPuede escribir "cancel" para cancelar.',
          fr: '🎯 Super! Commençons votre réservation.\n\n📋 Veuillez écrire le numéro ou le nom du tour.\n\nVous pouvez écrire "cancel" pour annuler.',
          ru: '🎯 Отлично! Начнем бронирование.\n\n📋 Пожалуйста, напишите номер или название тура.\n\nНапишите "cancel" для отмены.',
          ar: '🎯 رائع! لنبدأ حجزك.\n\n📋 يرجى كتابة رقم أو اسم الجولة.\n\nيمكنك كتابة "cancel" للإلغاء.'
        };
        
        responseMessage = wizardGreetings[userLanguage as keyof typeof wizardGreetings] || wizardGreetings.tr;
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
  const styleEmoji = style === 'friendly' ? '😊' : style === 'energetic' ? '🚀' : '✨';
  
  const greetings: Record<string, string> = {
    tr: `Merhaba! ${styleEmoji} İşte sizin için hazırladığım turlar:\n\n`,
    en: `Hello! ${styleEmoji} Here are our available tours:\n\n`,
    de: `Hallo! ${styleEmoji} Hier sind unsere verfügbaren Touren:\n\n`,
    ru: `Здравствуйте! ${styleEmoji} Вот наши доступные туры:\n\n`,
    ar: `مرحبا! ${styleEmoji} إليك جولاتنا المتاحة:\n\n`,
    fr: `Bonjour! ${styleEmoji} Voici nos circuits disponibles:\n\n`,
    es: `¡Hola! ${styleEmoji} Aquí están nuestros tours disponibles:\n\n`
  };

  let response = greetings[language] || greetings['tr'];

  DEMO_TOURS.forEach((tour, index) => {
    const minPrice = Math.min(...tour.dates.map(d => d.price_adult));
    response += `${index + 1}. 🎯 *${tour.title}*\n`;
    response += `   📍 ${tour.destination}\n`;
    response += `   💰 ${minPrice} ${tour.currency} ${language === 'en' ? 'from' : language === 'tr' ? 'başlayan fiyatlarla' : 'ab'}\n`;
    response += `   📅 ${tour.dates.length} ${language === 'tr' ? 'tarih mevcut' : language === 'en' ? 'dates available' : 'Termine verfügbar'}\n\n`;
  });

  const footers: Record<string, string> = {
    tr: '🔍 Detaylı bilgi için tur adını yazabilirsiniz!',
    en: '🔍 Type tour name for more details!',
    de: '🔍 Geben Sie den Tour-Namen ein für Details!',
    ru: '🔍 Введите название тура для подробностей!',
    ar: '🔍 اكتب اسم الجولة للحصول على التفاصيل!',
    fr: '🔍 Tapez le nom du circuit pour plus de détails!',
    es: '🔍 Escribe el nombre del tour para más detalles!'
  };

  response += footers[language] || footers['tr'];
  return response;
}

async function handleDemoTourSearch(
  supabase: any,
  phone: string,
  agencyId: string,
  message: string,
  conversationStyle: string
): Promise<string> {
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

  let response = '🎯 Aradığınız turlara benzer sonuçlar buldum:\n\n';

  matchedTours.forEach((tour) => {
    const minPrice = Math.min(...tour.dates.map(d => d.price_adult));
    response += `📍 *${tour.title}* - ${tour.destination}\n`;
    response += `💰 ${minPrice} ${tour.currency} başlayan fiyatlarla\n`;
    response += `📝 ${tour.program_kisa}\n`;
    response += `🗓️ Müsait tarihler: ${tour.dates.length} adet\n\n`;
  });

  response += '✨ Detaylı bilgi için tur adını yazabilir veya sorularınızı sorabilirsiniz!';

  return response;
}
