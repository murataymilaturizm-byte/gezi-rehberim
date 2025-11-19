import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { detectIntent } from './services/intent-detector.ts';
import { handleDemoIntelligently } from './handlers/demo-intelligent.ts';
import { extractMemory } from './services/memory-extractor.ts';
import { DEMO_AGENCY_ID, DEMO_TOURS } from './config/demo-tours.ts';
import { 
  initializeState, 
  updateStateWithIntent, 
  getContextForAI 
} from './services/demo-state-manager.ts';
import { DemoConversationState } from './types.ts';

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

    // Initialize or restore conversation state
    let conversationState: DemoConversationState = clientState || initializeState();
    
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
    
    // Update conversation state with new intent and selected tour
    const { state: newState, switchType } = updateStateWithIntent(
      conversationState,
      detectedIntent.type,
      message,
      selectedTour ? {
        id: selectedTour.id,
        title: selectedTour.title,
        destination: selectedTour.destination,
        dateId: selectedTour.dates[0]?.id
      } : undefined
    );
    
    conversationState = newState;
    
    // Get contextual information for AI with switch type
    const stateContext = getContextForAI(
      conversationState, 
      switchType,
      selectedTour?.title
    );

    // Generate intelligent response
    const response = await handleDemoIntelligently(
      message,
      formattedHistory,
      detectedIntent.type,
      language,
      DEMO_TOURS,
      conversationStyle,
      conversationState
    );

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
      JSON.stringify({ response }),
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
