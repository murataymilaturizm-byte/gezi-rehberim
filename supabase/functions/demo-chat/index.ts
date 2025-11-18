import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { detectIntent } from './services/intent-detector.ts';
import { handleDemoIntelligently } from './handlers/demo-intelligent.ts';
import { extractMemory } from './services/memory-extractor.ts';
import { handleWizardStep } from './handlers/wizard.ts';
import { enrichConversationInsights } from './services/profile.ts';
import { getConversationState, updateConversationState } from './services/conversation-state.ts';
import type { WizardState } from './types.ts';

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
    program_kisa: 'Kapadokya\'da gün doğumunda unutulmaz bir sıcak hava balonu deneyimi.',
    gezilecek_yerler: 'Göreme Vadisi, Peribacaları, Uçhisar Kalesi (havadan)',
    toplanma_saati: '05:00',
    hareket_noktasi: 'Göreme Merkez',
    tur_sure: '3 saat (uçuş 1 saat)',
    ulasim: 'Otelden alım-bırakım dahil',
    konaklama: 'Günübirlik tur - konaklama yok',
    dates: [
      { id: 'demo-date-1', departure_date: '2025-12-15', price_adult: 1500, price_child: 1200, quota: 20 },
      { id: 'demo-date-2', departure_date: '2025-12-22', price_adult: 1500, price_child: 1200, quota: 15 }
    ]
  },
  {
    id: 'demo-kapadokya-2',
    title: 'Kapadokya Kültür Turu',
    destination: 'Kapadokya',
    type: 'N2',
    currency: 'TRY',
    program_kisa: 'Kapadokya\'nın tarihi ve kültürel zenginliklerini keşfedin.',
    gezilecek_yerler: 'Göreme Açık Hava Müzesi, Derinkuyu Yeraltı Şehri, Paşabağ Peribacaları, Avanos Çömlekçilik, Uçhisar Kalesi',
    toplanma_saati: '08:00',
    hareket_noktasi: 'Nevşehir Havalimanı veya Göreme Oteller',
    tur_sure: '2 gün 1 gece',
    ulasim: 'Klimalı otobüs',
    konaklama: 'Göreme\'de 4* otel, kahvaltı dahil',
    dates: [
      { id: 'demo-date-3', departure_date: '2025-12-18', price_adult: 2500, price_child: 2000, quota: 18 }
    ]
  },
  {
    id: 'demo-pamukkale-1',
    title: 'Pamukkale Turu',
    destination: 'Pamukkale',
    type: 'N2',
    currency: 'TRY',
    program_kisa: 'Beyaz cennet Pamukkale travertenleri ve antik Hierapolis kenti.',
    gezilecek_yerler: 'Pamukkale Travertenleri, Hierapolis Antik Kenti, Kleopatra Havuzu, Antik Tiyatro',
    toplanma_saati: '07:30',
    hareket_noktasi: 'Denizli',
    tur_sure: '2 gün 1 gece',
    ulasim: 'Klimalı otobüs',
    konaklama: 'Pamukkale\'de 4* termal otel, yarım pansiyon',
    dates: [
      { id: 'demo-date-4', departure_date: '2025-12-10', price_adult: 3500, price_child: 2800, quota: 15 },
      { id: 'demo-date-5', departure_date: '2025-12-20', price_adult: 3500, price_child: 2800, quota: 12 }
    ]
  },
  {
    id: 'demo-antalya-1',
    title: 'Antalya Rafting',
    destination: 'Antalya',
    type: 'DAYTRIP',
    currency: 'TRY',
    program_kisa: 'Köprülü Kanyon\'da adrenalin dolu rafting macerası.',
    gezilecek_yerler: 'Köprülü Kanyon Milli Parkı, Köprüçay Nehri (14 km rafting)',
    toplanma_saati: '08:30',
    hareket_noktasi: 'Antalya oteller bölgesi',
    tur_sure: 'Günübirlik (sabah 08:30 - akşam 17:00)',
    ulasim: 'Otelden alım-bırakım',
    konaklama: 'Günübirlik - konaklama yok',
    dates: [
      { id: 'demo-date-6', departure_date: '2025-12-05', price_adult: 800, price_child: 600, quota: 30 },
      { id: 'demo-date-7', departure_date: '2025-12-12', price_adult: 800, price_child: 600, quota: 25 }
    ]
  },
  {
    id: 'demo-ege-1',
    title: 'Ege Turu',
    destination: 'İzmir-Çeşme-Alaçatı',
    type: 'N3',
    currency: 'TRY',
    program_kisa: 'Ege\'nin incisi Çeşme, rüzgar başkenti Alaçatı ve antik Efes.',
    gezilecek_yerler: 'Çeşme Marina, Alaçatı Taş Sokaklar, Efes Antik Kenti, Artemis Tapınağı, Şirince Köyü',
    toplanma_saati: '09:00',
    hareket_noktasi: 'İzmir Adnan Menderes Havalimanı',
    tur_sure: '3 gün 2 gece',
    ulasim: 'Klimalı minibüs',
    konaklama: 'Alaçatı\'da butik otel, kahvaltı dahil',
    dates: [
      { id: 'demo-date-8', departure_date: '2025-12-08', price_adult: 8999, price_child: 7500, quota: 12 }
    ]
  },
  {
    id: 'demo-istanbul-1',
    title: 'İstanbul Turu',
    destination: 'İstanbul',
    type: 'N2',
    currency: 'TRY',
    program_kisa: 'İstanbul\'un tarihi ve kültürel zenginlikleri.',
    gezilecek_yerler: 'Ayasofya Camii, Topkapı Sarayı, Sultanahmet Meydanı, Kapalı Çarşı, Boğaz Turu',
    toplanma_saati: '09:30',
    hareket_noktasi: 'İstanbul Havalimanı veya Sultanahmet',
    tur_sure: '2 gün 1 gece',
    ulasim: 'Özel araç',
    konaklama: 'Sultanahmet\'te 4* butik otel, kahvaltı dahil',
    dates: [
      { id: 'demo-date-9', departure_date: '2025-12-07', price_adult: 2999, price_child: 2400, quota: 25 }
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

    // Get conversation history
    console.log('📜 Fetching conversation history...');
    const { data: historyData } = await supabase
      .from('whatsapp_conversations')
      .select('role, content')
      .eq('phone', `demo_${sessionId}`)
      .eq('agency_id', DEMO_AGENCY_ID)
      .order('created_at', { ascending: false })
      .limit(15);

    // Reverse to get chronological order for AI
    const conversationHistory = (historyData || []).reverse();
    console.log('📱 Demo Chat - History:', conversationHistory.length, 'messages');

    // Get user profile for conversation state
    console.log('👤 Fetching user profile...');
    const { data: profile, error: profileError } = await supabase
      .from('whatsapp_user_profiles')
      .select('preferences')
      .eq('phone', `demo_${sessionId}`)
      .eq('agency_id', DEMO_AGENCY_ID)
      .maybeSingle();

    console.log('📊 Profile fetch result:', {
      found: !!profile,
      error: profileError?.message,
      preferences: profile?.preferences
    });

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
      shownTourIds: [],
      userMemory: {
        preferredDestinations: [],
        interests: [],
        lastUpdated: new Date().toISOString()
      }
    };

    console.log('🧠 Conversation state:', {
      currentTour: conversationState.currentTour?.title || 'NONE',
      wizardStep: conversationState.wizardStep,
      shownTourIds: conversationState.shownTourIds.length
    });

    // AI intent detection
    console.log('🤖 Detecting intent...');
    const intent = await detectIntent(message, conversationHistory, userLanguage);
    console.log('🎯 AI Intent:', intent.type, 'confidence:', intent.confidence, 'currentTour:', conversationState.currentTour?.title);

    // Update conversation state with detected intent
    await updateConversationState(supabase, sessionId, DEMO_AGENCY_ID, {
      lastIntent: intent.type
    });

    // Handle tour selection - check ALL intents, not just tour.detail/tour.search
    const numericSelection = message.match(/^\d+$/);
    
    // CRITICAL: Check for tour selection on EVERY message type to preserve memory
    console.log('🔍 Checking for tour selection...');
    
    const lowerMessage = message.toLowerCase();
    
    // Find matching tours - smart matching (case insensitive, partial match)
    const matchingTours = DEMO_TOURS.filter(t => {
      const lowerTitle = t.title.toLowerCase();
      const lowerDestination = t.destination.toLowerCase();
      
      // Exact match or contains
      return lowerMessage.includes(lowerTitle) || 
             lowerTitle.includes(lowerMessage) ||
             lowerMessage.includes(lowerDestination) ||
             lowerDestination.includes(lowerMessage);
    });
    
    console.log(`🔎 Found ${matchingTours.length} matching tours for "${message}"`);
    
    // Check if user is referring to a previously discussed tour (e.g., "konuştuğumuz tura kayıt olmak istiyorum")
    if (matchingTours.length === 0 && !conversationState.currentTour) {
      const referencePatterns = /\b(konuştuğumuz|bahsettiğimiz|söylediğiniz|bu|o|şu|kayıt|rezervasyon)\s*(tur|turu|tura|turun)?/i;
      const bookingIntents = /\b(kayıt|kayır|rezervasyon|ayır|ayırmak|katılmak|gelmek|gitmek|olmak|isterim|istiyorum)\b/i;
      
      if (referencePatterns.test(message) || (bookingIntents.test(message) && intent.type === 'reservation.wizard')) {
        console.log('🔍 User is referring to a previous tour or wants to book, checking conversation history...');
        
        // Check last 10 messages (both user and assistant) for tour mentions
        const recentMessages = conversationHistory.slice(-10).reverse();
        
        for (const msg of recentMessages) {
          // Try to find any tour mentioned in this message
          for (const tour of DEMO_TOURS) {
            const lowerContent = msg.content.toLowerCase();
            const lowerTitle = tour.title.toLowerCase();
            const lowerDestination = tour.destination.toLowerCase();
            
            if (lowerContent.includes(lowerTitle) || lowerContent.includes(lowerDestination)) {
              console.log('✅ Found previously mentioned tour:', tour.title, 'in', msg.role, 'message');
              conversationState.currentTour = {
                id: tour.id,
                title: tour.title,
                destination: tour.destination,
                priceAdult: tour.dates[0]?.price_adult,
                currency: tour.currency
              };
              conversationState.wizardStep = 'tour_selected';
              if (!conversationState.shownTourIds.includes(tour.id)) {
                conversationState.shownTourIds.push(tour.id);
              }
              
              console.log('💾 Saving tour reference from history...');
              await supabase
                .from('whatsapp_user_profiles')
                .upsert({
                  phone: `demo_${sessionId}`,
                  agency_id: DEMO_AGENCY_ID,
                  preferences: { conversation_state: conversationState }
                }, { onConflict: 'phone,agency_id' });
              
              console.log('✅ Tour reference saved. currentTour:', conversationState.currentTour.title);
              break;
            }
          }
          
          if (conversationState.currentTour) break;
        }
        
        if (!conversationState.currentTour) {
          console.log('⚠️ No tour found in history despite reference pattern match');
        }
      }
    }
    
    // Handle numeric selection (user chose from list)
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
        
        console.log('💾 Saving tour selection to DB...');
        const { data: saveData, error: saveError } = await supabase
          .from('whatsapp_user_profiles')
          .upsert({
            phone: `demo_${sessionId}`,
            agency_id: DEMO_AGENCY_ID,
            preferences: { conversation_state: conversationState }
          }, { onConflict: 'phone,agency_id' });
        
        if (saveError) {
          console.error('❌ Failed to save state:', saveError);
        } else {
          console.log('✅ State saved successfully. currentTour:', conversationState.currentTour.title);
        }
      }
    } else if (matchingTours.length === 1 && !conversationState.currentTour) {
      // Only auto-select if there's exactly ONE matching tour and no current tour
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
      
      console.log('💾 Saving tour selection to DB (auto-select)...');
      const { data: saveData2, error: saveError2 } = await supabase
        .from('whatsapp_user_profiles')
        .upsert({
          phone: `demo_${sessionId}`,
          agency_id: DEMO_AGENCY_ID,
          preferences: { conversation_state: conversationState }
        }, { onConflict: 'phone,agency_id' });
      
      if (saveError2) {
        console.error('❌ Failed to save state (auto-select):', saveError2);
      } else {
        console.log('✅ State saved successfully (auto-select). currentTour:', conversationState.currentTour.title);
      }
    } else if (matchingTours.length > 1 && (intent.type === 'tour.search' || intent.type === 'tour.list')) {
      // Multiple tours match AND user is searching - force AI to list them
      console.log('⚠️ MULTIPLE TOURS MATCH - Will list them for user to choose');
      conversationState.currentTour = null;
      conversationState.wizardStep = 'none';
      conversationState.shownTourIds = matchingTours.map(t => t.id);
      
      console.log('💾 Saving multiple tours state...');
      const { error: saveError3 } = await supabase
        .from('whatsapp_user_profiles')
        .upsert({
          phone: `demo_${sessionId}`,
          agency_id: DEMO_AGENCY_ID,
          preferences: { conversation_state: conversationState }
        }, { onConflict: 'phone,agency_id' });
      
      if (saveError3) {
        console.error('❌ Failed to save multiple tours state:', saveError3);
      } else {
        console.log('✅ Multiple tours state saved');
      }
    }
    // ELSE: Keep existing currentTour - DON'T reset it even if no tours match!

    // Handle reservation.wizard - prepare wizard state with currentTour if available
    if (intent.type === 'reservation.wizard') {
      if (conversationState.currentTour) {
        console.log('🎯 reservation.wizard detected with currentTour:', conversationState.currentTour.title);
        
        // Find the full tour data
        const fullTour = DEMO_TOURS.find(t => t.id === conversationState.currentTour.id);
        
        if (fullTour) {
          // Initialize wizard state with context from conversation
          const wizardState: WizardState = {
            step: 'date_selection',
            selected_tour: fullTour,
            pax_adult: conversationState.userMemory?.lastMentionedPax?.adults || undefined,
            pax_child: conversationState.userMemory?.lastMentionedPax?.children || undefined,
            created_at: new Date().toISOString()
          };
          
          conversationState.wizardState = wizardState;
          conversationState.wizardStep = 'booking_started';
          
          console.log('💾 Saving wizard state with pax info:', wizardState.pax_adult, 'adults,', wizardState.pax_child, 'children');
          await supabase
            .from('whatsapp_user_profiles')
            .upsert({
              phone: `demo_${sessionId}`,
              agency_id: DEMO_AGENCY_ID,
              preferences: { conversation_state: conversationState }
            }, { onConflict: 'phone,agency_id' });
          
          console.log('✅ Wizard state initialized with tour and pax info');
        }
      }
    }
    
    // Check if we're in wizard mode
    const wizardState = conversationState.wizardState as WizardState | undefined;
    let responseMessage: string;
    
    if (wizardState) {
      // We're in active wizard - handle wizard step
      console.log('🎯 Wizard active - step:', wizardState.step);
      
      responseMessage = await handleWizardStep(message, wizardState, DEMO_TOURS, userLanguage);
      
      // Save updated wizard state (wizard handler modifies state directly)
      // If wizard completed, it will return to confirmation which user can continue from
      await supabase
        .from('whatsapp_user_profiles')
        .upsert({
          phone: `demo_${sessionId}`,
          agency_id: DEMO_AGENCY_ID,
          preferences: { conversation_state: conversationState }
        }, { onConflict: 'phone,agency_id' });
      
      console.log('✅ Wizard step completed, state saved');
    } else {
      // Normal intelligent handler
      console.log('🧠 Calling intelligent handler...');
      responseMessage = await handleDemoIntelligently(
        message,
        conversationHistory,
        intent.type,
        userLanguage,
        DEMO_TOURS,
        conversationStyle,
        conversationState
      );
    }

    console.log('✅ Response generated:', responseMessage.substring(0, 100));
    await saveMessage(supabase, sessionId, 'assistant', responseMessage);

    // Enrich conversation insights
    await enrichConversationInsights(supabase, sessionId, DEMO_AGENCY_ID, message, responseMessage, intent.type);

    // Extract and update user memory from conversation
    console.log('🧠 Extracting user preferences...');
    const updatedMemory = extractMemory(
      message,
      responseMessage,
      DEMO_TOURS,
      conversationState.userMemory
    );
    
    if (JSON.stringify(updatedMemory) !== JSON.stringify(conversationState.userMemory)) {
      conversationState.userMemory = updatedMemory;
      console.log('💾 Saving updated memory:', {
        destinations: updatedMemory.preferredDestinations,
        interests: updatedMemory.interests,
        budget: updatedMemory.budgetRange,
        style: updatedMemory.travelStyle
      });
      
      const { error: memoryError } = await supabase
        .from('whatsapp_user_profiles')
        .upsert({
          phone: `demo_${sessionId}`,
          agency_id: DEMO_AGENCY_ID,
          preferences: { conversation_state: conversationState }
        }, { onConflict: 'phone,agency_id' });
      
      if (memoryError) {
        console.error('❌ Failed to save memory:', memoryError);
      } else {
        console.log('✅ Memory saved successfully');
      }
    }

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
