import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { detectIntent } from './services/intent-detector.ts';
import { handleDemoIntelligently } from './handlers/demo-intelligent.ts';
import { extractMemory } from './services/memory-extractor.ts';
import { DEMO_AGENCY_ID, DEMO_TOURS, DEMO_PAYMENT_INSTRUCTIONS } from './config/demo-tours.ts';
import { 
  initializeState, 
  updateStateWithIntent, 
  getContextForAI,
  extractCustomerInfo
} from './services/demo-state-manager.ts';
import { DemoConversationState } from './types.ts';
import { generatePaymentMessage } from './services/payment-message.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function saveMessage(
  supabase: any,
  sessionId: string,
  role: string,
  content: string
) {
  try {
    const { error } = await supabase
      .from('whatsapp_conversations')
      .insert({
        phone: sessionId,
        role,
        content,
        agency_id: DEMO_AGENCY_ID
      });

    if (error) {
      console.error('Error saving message:', error);
    }
  } catch (error) {
    console.error('Failed to save message:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      message, 
      sessionId, 
      language = 'tr', 
      conversationStyle = 'professional',
      conversationState: clientState 
    } = await req.json();

    if (!message || !sessionId) {
      return new Response(
        JSON.stringify({ error: 'Message and sessionId are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('📨 Demo chat request:', { message, sessionId, language, conversationStyle });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Save user message
    await saveMessage(supabase, sessionId, 'user', message);

    // Fetch conversation history
    const { data: history, error: historyError } = await supabase
      .from('whatsapp_conversations')
      .select('role, content')
      .eq('phone', sessionId)
      .eq('agency_id', DEMO_AGENCY_ID)
      .order('created_at', { ascending: true })
      .limit(20);

    if (historyError) {
      console.error('Error fetching history:', historyError);
    }

    const conversationHistory = history || [];
    const formattedHistory = conversationHistory.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));

    // Fetch user profile for memory
    const { data: profile } = await supabase
      .from('whatsapp_user_profiles')
      .select('*')
      .eq('phone', sessionId)
      .eq('agency_id', DEMO_AGENCY_ID)
      .single();

    // Initialize or restore conversation state - CHECK IF STATE IS STALE
    let conversationState: DemoConversationState;
    
    if (clientState) {
      // Check if state is from a previous session (older than 30 minutes)
      const now = new Date();
      let lastMessageTime: Date | null = null;
      
      if (history && history.length > 0) {
        const lastMsg = history[history.length - 1] as any;
        if (lastMsg.created_at) {
          lastMessageTime = new Date(lastMsg.created_at);
        }
      }
      
      const isStaleState = lastMessageTime && 
        (now.getTime() - lastMessageTime.getTime()) > 30 * 60 * 1000; // 30 minutes
      
      if (isStaleState) {
        console.log('⚠️ State is stale (>30 min old), starting fresh');
        conversationState = initializeState();
      } else {
        // Use client state but ensure all required fields
        conversationState = {
          ...clientState,
          collectedInfo: clientState.collectedInfo || {},
          reservationConfirmed: clientState.reservationConfirmed || false
        };
      }
    } else {
      conversationState = initializeState();
    }
    
    // Add user memory to state
    const stateWithMemory = {
      ...conversationState,
      userMemory: profile?.preferences || {}
    };

    // Detect intent
    const detectedIntent = await detectIntent(message, formattedHistory, language);
    console.log('🎯 Detected intent:', detectedIntent);

    // Find matching tour if user mentions specific destination
    let selectedTour = null;
    const tourNumber = parseInt(message.trim());
    
    if (!isNaN(tourNumber) && tourNumber >= 1 && tourNumber <= DEMO_TOURS.length) {
      selectedTour = DEMO_TOURS[tourNumber - 1];
      console.log('🎫 Tour selected by number:', selectedTour.title);
    } else {
      // Try to match tour by title or destination
      const lowerMessage = message.toLowerCase();
      selectedTour = DEMO_TOURS.find(tour =>
        lowerMessage.includes(tour.title.toLowerCase()) ||
        lowerMessage.includes(tour.destination.toLowerCase())
      );
      if (selectedTour) {
        console.log('🎫 Tour selected by name:', selectedTour.title);
      }
    }
    
    // Update conversation state ONLY if not a confirmation
    let switchType = 'no_switch';
    if (detectedIntent.type !== 'confirmation') {
      const result = updateStateWithIntent(
        stateWithMemory,
        detectedIntent.type,
        message,
        selectedTour ? {
          id: selectedTour.id,
          title: selectedTour.title,
          destination: selectedTour.destination,
          dateId: selectedTour.dates[0]?.id
        } : undefined
      );
      
      // CRITICAL: Preserve collectedInfo and reservationConfirmed from previous state
      conversationState = {
        ...result.state,
        collectedInfo: stateWithMemory.collectedInfo || result.state.collectedInfo || {},
        reservationConfirmed: stateWithMemory.reservationConfirmed || result.state.reservationConfirmed || false
      };
      switchType = result.switchType;
      
      // Update tour info in collectedInfo if a tour is selected
      if (selectedTour && detectedIntent.type === 'reservation.wizard') {
        conversationState.collectedInfo = {
          ...conversationState.collectedInfo,
          tourId: selectedTour.id,
          tourTitle: selectedTour.title
        };
      }
    } else {
      // For confirmations, preserve existing state
      conversationState = {
        ...stateWithMemory,
        lastUserMessage: message
      };
    }
    
    // ALWAYS extract customer info during booking flow
    if (conversationState.currentStage === 'booking' || 
        conversationState.currentStage === 'deciding' ||
        detectedIntent.type === 'reservation.wizard' || 
        detectedIntent.type === 'confirmation') {
      const currentInfo = conversationState.collectedInfo || {};
      const extractedInfo = extractCustomerInfo(message, currentInfo);
      
      // Merge extracted info with existing
      conversationState.collectedInfo = { ...currentInfo, ...extractedInfo };
      console.log('📝 Updated collected info:', conversationState.collectedInfo);
    }
    
    // Check if we have all required info
    const hasFullName = !!(conversationState.collectedInfo?.fullName && 
                          conversationState.collectedInfo.fullName.trim().length >= 3);
    const hasPhone = !!(conversationState.collectedInfo?.phone && 
                       conversationState.collectedInfo.phone.trim().length >= 10);
    const hasPax = !!(conversationState.collectedInfo?.paxAdult || 
                     conversationState.collectedInfo?.paxChild);
    const hasTour = !!conversationState.currentTour;
    
    const hasAllRequiredInfo = hasFullName && hasPhone && hasPax && hasTour;
    
    console.log('📋 Info checklist:', {
      hasFullName,
      hasPhone,
      hasPax,
      hasTour,
      allReady: hasAllRequiredInfo
    });
    
    // Set reservation confirmed if all info is collected AND user is confirming
    if (detectedIntent.type === 'confirmation' && hasAllRequiredInfo && !conversationState.reservationConfirmed) {
      conversationState.reservationConfirmed = true;
      console.log('✅✅✅ RESERVATION CONFIRMED - Payment info will be added! ✅✅✅');
    }
    
    console.log('📊 Current state:', {
      stage: conversationState.currentStage,
      currentTour: conversationState.currentTour?.title,
      collectedInfo: conversationState.collectedInfo,
      reservationConfirmed: conversationState.reservationConfirmed
    });
    
    // Get contextual information for AI with switch type and language
    const stateContext = await getContextForAI(
      conversationState, 
      switchType,
      selectedTour?.title,
      language
    );

    // Generate intelligent response
    let response = await handleDemoIntelligently(
      message,
      formattedHistory,
      detectedIntent.type,
      language,
      DEMO_TOURS,
      conversationStyle,
      { ...conversationState, stateContext }
    );

    // Add payment info AFTER AI response if reservation is confirmed
    // BUT ONLY if:
    // 1. Reservation is confirmed
    // 2. Payment info NOT already sent
    // 3. Current intent is NOT confirmation (wait for next message)
    const shouldAddPayment = conversationState.reservationConfirmed === true && 
                             !conversationState.paymentInfoSent &&
                             detectedIntent.type !== 'confirmation' &&
                             conversationState.currentTour &&
                             conversationState.collectedInfo?.fullName &&
                             conversationState.collectedInfo?.phone &&
                             (conversationState.collectedInfo?.paxAdult || conversationState.collectedInfo?.paxChild);

    if (shouldAddPayment && conversationState.currentTour) {
      const tourData = DEMO_TOURS.find(t => t.id === conversationState.currentTour?.id || t.title === conversationState.currentTour?.title);
      
      if (tourData) {
        const tourDate = tourData.dates?.[0];
        if (tourDate && tourDate.price_adult) {
          const paxAdult = conversationState.collectedInfo?.paxAdult || 1;
          const totalPrice = tourDate.price_adult * paxAdult;
          const depositPercentage = DEMO_PAYMENT_INSTRUCTIONS.deposit_percentage || 30;
          const depositAmount = Math.round((totalPrice * depositPercentage) / 100);

          const paymentInfo = generatePaymentMessage(
            DEMO_PAYMENT_INSTRUCTIONS,
            language,
            totalPrice,
            depositAmount
          );

          if (paymentInfo) {
            response += '\n\n' + paymentInfo;
            conversationState.paymentInfoSent = true; // Mark as sent
            console.log('💳 Payment information added to demo response (ONCE)');
          }
        }
      }
    }

    // Extract and update user memory
    const updatedMemory = extractMemory(message, response, conversationState?.userMemory || DEMO_TOURS);
    
    // Update or create user profile
    const { error: profileError } = await supabase
      .from('whatsapp_user_profiles')
      .upsert({
        phone: sessionId,
        agency_id: DEMO_AGENCY_ID,
        language_preference: language,
        preferences: updatedMemory,
        last_interaction_at: new Date().toISOString(),
        total_messages: (profile?.total_messages || 0) + 1
      }, {
        onConflict: 'phone'
      });

    if (profileError) {
      console.error('Error updating profile:', profileError);
    }

    // Save assistant response
    await saveMessage(supabase, sessionId, 'assistant', response);

    return new Response(
      JSON.stringify({ 
        response,
        conversationState // Return state so client can persist it
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in demo-chat:', error);
    
    // Handle specific AI errors with user-friendly messages
    let errorMessage = 'Internal server error';
    let errorDetails = '';
    
    if (error instanceof Error) {
      switch(error.message) {
        case 'AI_SERVICE_UNAVAILABLE':
          errorMessage = 'AI servisi şu anda yanıt vermiyor';
          errorDetails = 'Lütfen birkaç saniye bekleyip tekrar deneyin.';
          break;
        case 'AI_RATE_LIMIT':
          errorMessage = 'Çok fazla istek gönderildi';
          errorDetails = 'Lütfen birkaç dakika bekleyip tekrar deneyin.';
          break;
        case 'AI_PAYMENT_REQUIRED':
          errorMessage = 'AI servisi kullanım kotası doldu';
          errorDetails = 'Lütfen site yöneticisi ile iletişime geçin.';
          break;
        default:
          if (error.message.includes('AI_ERROR_')) {
            errorMessage = 'AI servisi hatası';
            errorDetails = 'Lütfen tekrar deneyin veya site yöneticisi ile iletişime geçin.';
          }
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
