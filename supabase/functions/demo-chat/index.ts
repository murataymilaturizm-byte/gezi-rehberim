import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { detectIntent } from '../whatsapp-webhook/services/intent-detector.ts';
import { handleDemoIntelligently } from './handlers/demo-intelligent.ts';
import { getWizardState, handleWizardStep } from '../whatsapp-webhook/handlers/wizard.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_AGENCY_ID = "00000000-0000-0000-0000-000000000000";

const DEMO_TOURS = [
  {
    id: 'demo-kapadokya-1',
    title: 'Kapadokya Balon Turu',
    destination: 'Kapadokya',
    type: 'DAYTRIP',
    currency: 'TRY',
    program_kisa: 'Kapadokya\'da unutulmaz bir balon deneyimi.',
    gezilecek_yerler: 'Göreme, Peribacaları, Uçhisar Kalesi',
    dates: [
      { id: 'demo-date-1', departure_date: '2025-12-15', price_adult: 1500, quota: 20 },
      { id: 'demo-date-2', departure_date: '2025-12-22', price_adult: 1500, quota: 15 }
    ]
  },
  {
    id: 'demo-pamukkale-1',
    title: 'Pamukkale Turu',
    destination: 'Pamukkale',
    type: 'N2',
    currency: 'TRY',
    program_kisa: 'Beyaz cennet Pamukkale ve Hierapolis.',
    gezilecek_yerler: 'Pamukkale Travertenleri, Hierapolis, Kleopatra Havuzu',
    dates: [
      { id: 'demo-date-4', departure_date: '2025-12-10', price_adult: 3500, quota: 15 },
      { id: 'demo-date-5', departure_date: '2025-12-20', price_adult: 3500, quota: 12 }
    ]
  },
  {
    id: 'demo-antalya-1',
    title: 'Antalya Rafting',
    destination: 'Antalya',
    type: 'DAYTRIP',
    currency: 'TRY',
    program_kisa: 'Köprülü Kanyon\'da heyecan dolu rafting.',
    gezilecek_yerler: 'Köprülü Kanyon',
    dates: [
      { id: 'demo-date-6', departure_date: '2025-12-05', price_adult: 800, quota: 30 },
      { id: 'demo-date-7', departure_date: '2025-12-12', price_adult: 800, quota: 25 }
    ]
  },
  {
    id: 'demo-ege-1',
    title: 'Ege Turu',
    destination: 'İzmir-Çeşme-Alaçatı',
    type: 'N3',
    currency: 'TRY',
    program_kisa: 'Ege\'nin incisi Çeşme, Alaçatı ve Efes.',
    gezilecek_yerler: 'Çeşme, Alaçatı, Efes Antik Kenti',
    dates: [
      { id: 'demo-date-8', departure_date: '2025-12-08', price_adult: 8999, quota: 12 }
    ]
  },
  {
    id: 'demo-istanbul-1',
    title: 'İstanbul Turu',
    destination: 'İstanbul',
    type: 'N2',
    currency: 'TRY',
    program_kisa: 'İstanbul\'un tarihi zenginlikleri.',
    gezilecek_yerler: 'Ayasofya, Topkapı, Sultanahmet, Boğaz',
    dates: [
      { id: 'demo-date-9', departure_date: '2025-12-07', price_adult: 2999, quota: 25 }
    ]
  }
];

async function saveMessage(supabase: any, sessionId: string, role: string, content: string) {
  try {
    await supabase
      .from('whatsapp_conversations')
      .insert({
        phone: `demo_${sessionId}`,
        role,
        content,
        agency_id: DEMO_AGENCY_ID
      });
  } catch (error) {
    console.error('Error saving message:', error);
  }
}

serve(async (req) => {
  console.log('🚀 === DEMO CHAT REQUEST RECEIVED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  if (req.method === 'OPTIONS') {
    console.log('⚠️ OPTIONS request - returning CORS headers');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📥 Parsing request body...');
    const { message, sessionId, conversationStyle = 'professional' } = await req.json();
    console.log('✅ Request parsed:', { message: message?.substring(0, 50), sessionId, conversationStyle });

    if (!message || !sessionId) {
      console.error('❌ Missing message or sessionId');
      return new Response(
        JSON.stringify({ error: 'Missing message or sessionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔧 Creating Supabase client...');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('💾 Saving user message...');
    await saveMessage(supabase, sessionId, 'user', message);

    const userLanguage = 'tr';

    // Check wizard state
    console.log('🔍 Checking wizard state...');
    const wizardState = await getWizardState(supabase, `demo_${sessionId}`, DEMO_AGENCY_ID);
    console.log('✅ Wizard state:', wizardState ? 'EXISTS' : 'NULL');
    if (wizardState) {
      console.log('🎯 Handling wizard step:', wizardState.step);
      const wizardResponse = await handleWizardStep(
        supabase,
        `demo_${sessionId}`,
        DEMO_AGENCY_ID,
        message,
        wizardState
      );
      console.log('📤 Wizard response:', wizardResponse.substring(0, 100));
      await saveMessage(supabase, sessionId, 'assistant', wizardResponse);
      return new Response(
        JSON.stringify({ message: wizardResponse }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get conversation history
    console.log('📜 Fetching conversation history...');
    const { data: historyData } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('phone', `demo_${sessionId}`)
      .eq('agency_id', DEMO_AGENCY_ID)
      .order('created_at', { ascending: false })
      .limit(15);

    console.log('📱 Demo Chat - History:', historyData?.length || 0, 'messages');

    // Get user profile for conversation state
    console.log('👤 Fetching user profile...');
    const { data: profile } = await supabase
      .from('whatsapp_user_profiles')
      .select('preferences')
      .eq('phone', `demo_${sessionId}`)
      .eq('agency_id', DEMO_AGENCY_ID)
      .single();

    const conversationState = (profile?.preferences as any)?.conversation_state || {
      currentStage: 'initial',
      lastIntent: '',
      lastDiscussedTour: null,
      discussedTours: [],
      userInterests: [],
      conversationFlow: [],
      needsFollowUp: false,
      lastQuestionAsked: null,
      currentTour: null,
      wizardStep: 'none',
      shownTourIds: []
    };

    console.log('🧠 Conversation state:', {
      currentTour: conversationState.currentTour?.title || 'NONE',
      wizardStep: conversationState.wizardStep,
      shownTourIds: conversationState.shownTourIds.length
    });

    // AI intent detection
    console.log('🤖 Detecting intent...');
    const intent = await detectIntent(message, historyData || [], userLanguage);
    console.log('🎯 AI Intent:', intent.type, 'confidence:', intent.confidence, 'currentTour:', conversationState.currentTour?.title);

    // Handle tour selection - ONLY select if user is specific or there's only one match
    const numericSelection = message.match(/^\d+$/);
    
    if ((intent.type as string) === 'tour.detail' || numericSelection) {
      console.log('🔍 Checking for tour selection...');
      
      // Find matching tours
      const matchingTours = DEMO_TOURS.filter(t => 
        message.toLowerCase().includes(t.title.toLowerCase()) ||
        message.toLowerCase().includes(t.destination.toLowerCase())
      );
      
      // Or handle numeric selection
      if (numericSelection) {
        const index = parseInt(message) - 1;
        if (index >= 0 && index < DEMO_TOURS.length) {
          const selectedTour = DEMO_TOURS[index];
          console.log('✅ TOUR SELECTED BY NUMBER:', selectedTour.title);
          conversationState.currentTour = {
            id: selectedTour.id,
            title: selectedTour.title,
            destination: selectedTour.destination,
            priceAdult: selectedTour.dates[0]?.price_adult,
            currency: selectedTour.currency
          };
          conversationState.wizardStep = 'tour_selected';
          if (!conversationState.shownTourIds.includes(selectedTour.id)) {
            conversationState.shownTourIds.push(selectedTour.id);
          }
          
          await supabase
            .from('whatsapp_user_profiles')
            .upsert({
              phone: `demo_${sessionId}`,
              agency_id: DEMO_AGENCY_ID,
              preferences: { conversation_state: conversationState }
            }, { onConflict: 'phone,agency_id' });
          
          console.log('✅ State saved. currentTour:', conversationState.currentTour.title);
        }
      } else if (matchingTours.length === 1 && !conversationState.currentTour) {
        // Only auto-select if there's exactly ONE matching tour
        const selectedTour = matchingTours[0];
        console.log('✅ SINGLE TOUR AUTO-SELECTED:', selectedTour.title);
        conversationState.currentTour = {
          id: selectedTour.id,
          title: selectedTour.title,
          destination: selectedTour.destination,
          priceAdult: selectedTour.dates[0]?.price_adult,
          currency: selectedTour.currency
        };
        conversationState.wizardStep = 'tour_selected';
        if (!conversationState.shownTourIds.includes(selectedTour.id)) {
          conversationState.shownTourIds.push(selectedTour.id);
        }
        
        await supabase
          .from('whatsapp_user_profiles')
          .upsert({
            phone: `demo_${sessionId}`,
            agency_id: DEMO_AGENCY_ID,
            preferences: { conversation_state: conversationState }
          }, { onConflict: 'phone,agency_id' });
        
        console.log('✅ State saved. currentTour:', conversationState.currentTour.title);
      } else if (matchingTours.length > 1) {
        console.log(`📋 Multiple tours match (${matchingTours.length}), letting AI list them`);
        // Don't select - let AI list multiple matching tours
      }
    }

    // Use intelligent handler with conversation state
    console.log('🧠 Calling intelligent handler...');
    const responseMessage = await handleDemoIntelligently(
      message,
      historyData || [],
      intent.type,
      userLanguage,
      DEMO_TOURS,
      conversationStyle,
      conversationState
    );

    console.log('✅ Response generated:', responseMessage.substring(0, 100));
    await saveMessage(supabase, sessionId, 'assistant', responseMessage);

    console.log('📤 Sending response to client');
    return new Response(
      JSON.stringify({ message: responseMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Demo chat error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
