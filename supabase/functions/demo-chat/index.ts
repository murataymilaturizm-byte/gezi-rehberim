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

    // Initialize or restore conversation state - PRESERVE CLIENT STATE
    let conversationState: DemoConversationState = clientState ? {
      ...clientState,
      // Ensure all required fields exist
      collectedInfo: clientState.collectedInfo || {},
      reservationConfirmed: clientState.reservationConfirmed || false
    } : initializeState();
    
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
    
    // Extract customer info if in booking/deciding stage and message contains potential info
    // DO THIS EVEN FOR CONFIRMATION MESSAGES - they might contain missing info!
    if (conversationState.currentStage === 'booking' || conversationState.currentStage === 'deciding') {
      const currentInfo = conversationState.collectedInfo || {};
      
      // Only extract if we're missing info and message looks informative
      const missingInfo = !currentInfo.fullName || !currentInfo.phone;
      const hasInfoPattern = /\d{10,}|[a-zA-ZğüşıöçĞÜŞİÖÇ]+\s+[a-zA-ZğüşıöçĞÜŞİÖÇ]+/.test(message);
      
      if (missingInfo && hasInfoPattern) {
        const extractedInfo = extractCustomerInfo(message, currentInfo);
        if (Object.keys(extractedInfo).length > 0 && Object.values(extractedInfo).some(v => v)) {
          conversationState.collectedInfo = { ...currentInfo, ...extractedInfo };
          console.log('📝 Updated collected info:', conversationState.collectedInfo);
        }
      }
    }
    
    // Check if user is confirming reservation
    const isConfirmationIntent = detectedIntent.type === 'confirmation';
    const confirmKeywords = ['evet', 'yes', 'onaylıyorum', 'onayla', 'onay', 'tamam', 'ok', 'doğru', 'isterim', 'kabul'];
    const isConfirmingKeyword = confirmKeywords.some(k => message.toLowerCase().trim().includes(k));
    
    // Set reservation confirmed if all info is collected and user is confirming
    if ((isConfirmationIntent || isConfirmingKeyword) && conversationState.collectedInfo) {
      const hasAllInfo = conversationState.collectedInfo.fullName && 
                         conversationState.collectedInfo.phone &&
                         (conversationState.collectedInfo.paxAdult || conversationState.collectedInfo.paxChild);
      if (hasAllInfo && !conversationState.reservationConfirmed) {
        conversationState.reservationConfirmed = true;
        console.log('✅ Reservation confirmed by user');
      }
    }
    
    console.log('📊 Current state:', {
      stage: conversationState.currentStage,
      currentTour: conversationState.currentTour?.title,
      collectedInfo: conversationState.collectedInfo,
      reservationConfirmed: conversationState.reservationConfirmed
    });
    
    // Get contextual information for AI with switch type
    const stateContext = getContextForAI(
      conversationState, 
      switchType,
      selectedTour?.title
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

    // Add payment info if reservation is confirmed and all info is collected
    const hasAllRequiredInfo = conversationState.collectedInfo?.fullName && 
                                conversationState.collectedInfo?.phone &&
                                (conversationState.collectedInfo?.paxAdult || conversationState.collectedInfo?.paxChild);
    
    const shouldAddPayment = conversationState.reservationConfirmed === true && 
                             hasAllRequiredInfo && 
                             conversationState.currentTour;

    // ONLY add payment info if reservation was COMPLETED
    if (shouldAddPayment && conversationState.currentTour) {
      // Get the selected tour data
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
            response += paymentInfo;
            console.log('💳 Payment information added to demo response');
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
