// Demo chat endpoint - Clean FSM v3.0.0
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Core FSM
import { createInitialContext, processTransition, getNextExpectedInput } from './core/state-machine.ts';
import { sanitizeInput } from './core/validator.ts';

// Services
import { callAI } from './services/ai.ts';
import { findTourById } from './services/tour-matcher.ts';
import { buildSystemPrompt } from './services/prompt-builder.ts';
import { detectLanguage } from './services/language.ts';
import { analyzeUserMessage, mapNLUIntentToFSMIntent } from './services/nlu.ts';
import { extractNameAndPhone } from './services/simple-extractor.ts';

// Config
import { DEMO_TOURS } from './config/demo-tours.ts';

// Types
import type { ConversationContext, ProcessingInput } from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message: rawMessage, sessionId, conversationState: clientState } = await req.json();
    const message = sanitizeInput(rawMessage);

    if (!sessionId) {
      throw new Error('Session ID required');
    }

    console.log('🚀 DEMO CHAT FSM v3.0.0 - CLEAN START');
    
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
      const detectedLang = await detectLanguage(message);
      const language = detectedLang || 'tr';
      const tone = 'standart'; // Default tone
      
      context = createInitialContext(language, tone);
      context.detectedLanguage = detectedLang || undefined;
      
      console.log(`🌍 Language: ${language}, Tone: ${tone}`);
    }

    console.log('📨 Message:', { message, stage: context.stage, lang: context.language, tone: context.tone });

    // === NEW: Use AI-based NLU for understanding ===
    const nluResult = await analyzeUserMessage(
      message,
      `Current stage: ${context.stage}. ${context.currentTour ? `Selected tour: ${context.currentTour.title}` : ''}`,
      context.stage,
      context.currentTour,
      DEMO_TOURS
    );
    
    console.log('🧠 NLU Intent:', nluResult.intent);
    console.log('🧠 NLU Entities:', JSON.stringify(nluResult.entities));
    
    // Map NLU intent to FSM intent
    const detectedIntent = mapNLUIntentToFSMIntent(nluResult.intent);
    console.log('🎯 FSM Intent:', detectedIntent);

    const expectedInput = getNextExpectedInput(context);
    console.log('⏭️ Expected:', expectedInput);

    // Use NLU entities for tour matching
    let selectedTour = null;
    
    // Try NLU tour_id or destination/tour_name
    if (nluResult.entities.tour_id) {
      const foundTour = findTourById(nluResult.entities.tour_id, DEMO_TOURS);
      if (foundTour) {
        selectedTour = {
          id: foundTour.id,
          title: foundTour.title,
          destination: foundTour.destination,
          dates: foundTour.dates,
          program_kisa: foundTour.program_kisa,
          gezilecek_yerler: foundTour.gezilecek_yerler
        };
        console.log('🎫 Tour matched by NLU ID:', selectedTour.title);
      }
    } else if (nluResult.entities.tour_name) {
      // Match by tour name from NLU
      const foundTour = DEMO_TOURS.find(t => 
        t.title.toLowerCase().includes(nluResult.entities.tour_name!.toLowerCase())
      );
      if (foundTour) {
        selectedTour = {
          id: foundTour.id,
          title: foundTour.title,
          destination: foundTour.destination,
          dates: foundTour.dates,
          program_kisa: foundTour.program_kisa,
          gezilecek_yerler: foundTour.gezilecek_yerler
        };
        console.log('🎫 Tour matched by NLU name:', selectedTour.title);
      }
    } else if (nluResult.entities.destination) {
      // Match by destination from NLU
      const foundTour = DEMO_TOURS.find(t => 
        t.destination.toLowerCase().includes(nluResult.entities.destination!.toLowerCase())
      );
      if (foundTour) {
        selectedTour = {
          id: foundTour.id,
          title: foundTour.title,
          destination: foundTour.destination,
          dates: foundTour.dates,
          program_kisa: foundTour.program_kisa,
          gezilecek_yerler: foundTour.gezilecek_yerler
        };
        console.log('🎫 Tour matched by NLU destination:', selectedTour.title);
      }
    }

    // Extract reservation info from NLU entities
    const extractedInfo: any = {};
    
    if (nluResult.entities.date) {
      extractedInfo.selectedDate = nluResult.entities.date;
      console.log('📅 Date from NLU:', nluResult.entities.date);
    }
    
    if (nluResult.entities.adults !== null) {
      extractedInfo.paxAdult = nluResult.entities.adults;
      console.log('👥 Adults from NLU:', nluResult.entities.adults);
    }
    
    if (nluResult.entities.children !== null) {
      extractedInfo.paxChild = nluResult.entities.children;
      console.log('👶 Children from NLU:', nluResult.entities.children);
    }
    
    // Simple fallback for name and phone (NLU sometimes misses these)
    const simpleExtraction = extractNameAndPhone(message);
    if (simpleExtraction.fullName && !extractedInfo.fullName) {
      extractedInfo.fullName = simpleExtraction.fullName;
      console.log('👤 Name from regex:', simpleExtraction.fullName);
    }
    if (simpleExtraction.phone && !extractedInfo.phone) {
      extractedInfo.phone = simpleExtraction.phone;
      console.log('📞 Phone from regex:', simpleExtraction.phone);
    }
    
    // Resolve date if selected by number
    if (extractedInfo.selectedDate?.startsWith('date_') && context.currentTour) {
      const tour = findTourById(context.currentTour.id, DEMO_TOURS);
      if (tour?.dates) {
        const dateIndex = parseInt(extractedInfo.selectedDate.split('_')[1]);
        if (dateIndex >= 0 && dateIndex < tour.dates.length) {
          const selectedDate = tour.dates[dateIndex];
          extractedInfo.selectedDate = selectedDate.departure_date;
          extractedInfo.dateId = selectedDate.id;
          console.log('📅 Resolved date:', selectedDate.departure_date);
        }
      }
    }

    console.log('📝 Extracted info:', extractedInfo);

    // Process FSM transition
    const input: ProcessingInput = {
      userMessage: message,
      detectedIntent,
      extractedInfo,
      selectedTour,
      language: context.language
    };

    const newContext = processTransition(context, input);
    console.log(`🔄 Transition: ${context.stage} → ${newContext.stage}`);

    // Get payment instructions from database
    const { data: paymentData } = await supabase
      .from('agencies')
      .select('payment_instructions')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .single();

    const paymentInfo = paymentData?.payment_instructions;

    // Build system prompt
    const currentTourData = newContext.currentTour ? findTourById(newContext.currentTour.id, DEMO_TOURS) : null;
    
    const systemPrompt = buildSystemPrompt({
      stage: newContext.stage,
      collectionStep: newContext.collectionStep,
      currentTour: currentTourData,
      reservationInfo: newContext.reservationInfo,
      availableTours: DEMO_TOURS,
      language: newContext.language,
      tone: newContext.tone,
      agencyName: 'Demo Travel Agency',
      agencyCity: undefined,
      paymentInfo: paymentInfo
    });

    // Get conversation history
    const { data: history } = await supabase
      .from('whatsapp_conversations')
      .select('role, content, created_at')
      .eq('phone', sessionId)
      .order('created_at', { ascending: true })
      .limit(20);

    const conversationHistory = (history || []).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Call AI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    console.log('🤖 Calling AI...');
    const aiResponse = await callAI(messages, 0.7);

    // Save messages
    await supabase.from('whatsapp_conversations').insert([
      { phone: sessionId, role: 'user', content: message, agency_id: '00000000-0000-0000-0000-000000000000' },
      { phone: sessionId, role: 'assistant', content: aiResponse, agency_id: '00000000-0000-0000-0000-000000000000' }
    ]);

    return new Response(
      JSON.stringify({
        response: aiResponse,
        conversationState: newContext
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function isValidContext(ctx: any): ctx is ConversationContext {
  return (
    ctx &&
    typeof ctx === 'object' &&
    typeof ctx.stage === 'string' &&
    typeof ctx.language === 'string' &&
    typeof ctx.tone === 'string' &&
    typeof ctx.messageCount === 'number'
  );
}
