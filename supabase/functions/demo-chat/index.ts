// Demo chat endpoint with FSM-based architecture
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Core FSM
import { createInitialContext, processTransition, getNextExpectedInput } from './core/state-machine.ts';
import { validateReservationInfo, sanitizeInput } from './core/validator.ts';

// Services
import { callAI } from './services/ai.ts';
import { matchTour, findTourById } from './services/tour-matcher.ts';
import { extractReservationInfo } from './services/info-extractor.ts';
import { buildSystemPrompt } from './services/prompt-builder.ts';
import { generatePaymentMessage } from '../whatsapp-webhook/services/payment-message.ts';

// Config
import { DEMO_TOURS, DEMO_PAYMENT_INSTRUCTIONS } from './config/demo-tours.ts';

// Types
import type { ConversationContext, ProcessingInput } from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message: rawMessage, sessionId, conversationState: clientState } = await req.json();
    const language = 'tr'; // LOCKED for now
    const conversationStyle = 'friendly'; // LOCKED for now

    // Sanitize input
    const message = sanitizeInput(rawMessage);

    if (!sessionId) {
      throw new Error('Session ID required');
    }

    console.log('📨 Demo chat request:', { message, sessionId, language, conversationStyle });
    console.log('📦 Incoming clientState:', clientState ? 'EXISTS' : 'NULL');

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load or initialize context
    let context: ConversationContext;
    
    if (clientState && isValidContext(clientState)) {
      console.log('✅ Using client state');
      context = clientState;
    } else {
      console.log('🆕 Initializing fresh context');
      context = createInitialContext();
    }

    // Detect intent using simple rules (could use AI here too)
    const detectedIntent = detectSimpleIntent(message, context);
    console.log('🎯 Detected intent:', detectedIntent);

    // Get expected input based on current state
    const expectedInput = getNextExpectedInput(context);
    console.log('⏭️ Expected input:', expectedInput);

    // Match tour if mentioned
    const selectedTour = matchTour(message, DEMO_TOURS, expectedInput);
    if (selectedTour) {
      console.log('🎫 Tour matched:', selectedTour.title);
    }

    // Extract reservation info
    const extractedInfo = extractReservationInfo(message, context.reservationInfo, expectedInput);
    console.log('📝 Extracted info:', extractedInfo);

    // Create processing input
    const processingInput: ProcessingInput = {
      userMessage: message,
      detectedIntent,
      extractedInfo,
      selectedTour,
      language
    };

    // Process state transition
    const newContext = processTransition(context, processingInput);
    
    console.log('📊 State transition:', {
      from: context.stage,
      to: newContext.stage,
      collectionStep: newContext.collectionStep
    });

    // Build AI prompt
    const systemPrompt = buildSystemPrompt({
      stage: newContext.stage,
      collectionStep: newContext.collectionStep,
      currentTour: newContext.currentTour,
      reservationInfo: newContext.reservationInfo,
      availableTours: DEMO_TOURS,
      language
    });

    // Get conversation history
    const { data: history } = await supabase
      .from('whatsapp_conversations')
      .select('role, content')
      .eq('phone', sessionId)
      .order('created_at', { ascending: true })
      .limit(20);

    const formattedHistory = (history || []).map(h => ({
      role: h.role as 'user' | 'assistant',
      content: h.content
    }));

    // Add current message to history
    formattedHistory.push({ role: 'user', content: message });

    // Generate AI response
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...formattedHistory
    ];
    
    let response = await callAI(messages);

    // Add payment info if completed
    if (newContext.stage === 'COMPLETED' && newContext.reservationConfirmed && !newContext.paymentInfoSent) {
      const tour = findTourById(newContext.reservationInfo.tourId!, DEMO_TOURS);
      if (tour) {
        const tourDate = tour.dates?.[0];
        if (tourDate && tourDate.price_adult) {
          const paxAdult = newContext.reservationInfo.paxAdult || 1;
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
            newContext.paymentInfoSent = true;
            console.log('💳 Payment information added');
          }
        }
      }
    }

    // Save messages
    await supabase.from('whatsapp_conversations').insert([
      { phone: sessionId, role: 'user', content: message, agency_id: '00000000-0000-0000-0000-000000000000' },
      { phone: sessionId, role: 'assistant', content: response, agency_id: '00000000-0000-0000-0000-000000000000' }
    ]);

    return new Response(
      JSON.stringify({
        response,
        conversationState: newContext
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Demo chat error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Simple intent detection based on keywords and context
function detectSimpleIntent(message: string, context: ConversationContext): string {
  const lower = message.toLowerCase().trim();
  
  // Greeting
  if (context.stage === 'GREETING' && /^(merhaba|selam|hello|hi)/.test(lower)) {
    return 'greeting';
  }
  
  // Confirmation
  if (/^(evet|tamam|olur|onaylıyorum|doğru|yes|ok|okay|confirm)$/.test(lower)) {
    return 'confirmation';
  }
  
  // Reservation keywords
  if (/rezervasyon|ayır|katıl|kayıt|book|reserve|join/.test(lower)) {
    return 'reservation.wizard';
  }
  
  // Tour list
  if (/turlar|seçenek|neler var|tours|options|list/.test(lower)) {
    return 'tour.list';
  }
  
  // Price inquiry
  if (/fiyat|kaç para|ne kadar|price|cost|how much/.test(lower)) {
    return 'price.inquiry';
  }
  
  // Tour search/detail (default for most cases)
  return 'tour.search';
}

function isValidContext(ctx: any): ctx is ConversationContext {
  return ctx && typeof ctx.stage === 'string' && ctx.reservationInfo !== undefined;
}
