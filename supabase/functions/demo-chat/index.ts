// Demo chat endpoint - Clean FSM v3.0.0
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Core FSM
import { createInitialContext, processTransition, getNextExpectedInput } from './core/state-machine.ts';
import { sanitizeInput } from './core/validator.ts';

// Services
import { callAI } from './services/ai.ts';
import { matchTour, findTourById } from './services/tour-matcher.ts';
import { extractReservationInfo } from './services/info-extractor.ts';
import { buildSystemPrompt } from './services/prompt-builder.ts';
import { detectLanguage } from './services/language.ts';

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

    // Simple intent detection
    const detectedIntent = detectIntent(message, context);
    console.log('🎯 Intent:', detectedIntent);

    const expectedInput = getNextExpectedInput(context);
    console.log('⏭️ Expected:', expectedInput);

    // Match tour
    const selectedTour = matchTour(message, DEMO_TOURS, expectedInput);
    if (selectedTour) {
      console.log('🎫 Tour matched:', selectedTour.title);
      
      // Get full tour data
      const fullTour = findTourById(selectedTour.id, DEMO_TOURS);
      if (fullTour) {
        selectedTour.dates = fullTour.dates;
        selectedTour.program_kisa = fullTour.program_kisa;
        selectedTour.gezilecek_yerler = fullTour.gezilecek_yerler;
      }
    }

    // Extract reservation info
    const extractedInfo = extractReservationInfo(message, context.reservationInfo, expectedInput);
    
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
      agencyCity: undefined
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

function detectIntent(message: string, context: ConversationContext): string {
  const lower = message.toLowerCase().trim();
  
  // Greetings
  if (context.messageCount === 0 && /^(merhaba|selam|hello|hi|hola)/i.test(lower)) {
    return 'greeting';
  }
  
  // Confirmation
  if (/^(evet|tamam|olur|onay|yes|okay|ok|confirm)$/i.test(lower)) {
    return 'confirmation';
  }
  
  // Reservation start
  if (/(kayıt|rezerv|book|satın|almak istiyorum|yapmak istiyorum)/i.test(lower)) {
    return 'reservation.start';
  }
  
  // Date inquiry
  if (/(tarih|date|ne zaman|when|hangi gün)/i.test(lower)) {
    return 'date.inquiry';
  }
  
  // Tour list request
  if (/(turlar|liste|seçenek|tours|list|options|hangi turlar)/i.test(lower)) {
    return 'tour.list';
  }
  
  // General inquiry
  if (/(bilgi|detay|info|detail|hakkında|about)/i.test(lower)) {
    return 'general.inquiry';
  }
  
  // During collection, assume it's info provision
  if (context.stage === 'COLLECTING_INFO' || context.stage === 'DATE_SELECTION') {
    return 'info.provided';
  }
  
  return 'general';
}

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
