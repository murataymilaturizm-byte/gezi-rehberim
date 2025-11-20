// WhatsApp webhook - Clean FSM with shared core
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Shared FSM
import { createInitialContext, processTransition, getNextExpectedInput } from "../shared/fsm/state-machine.ts";
import { sanitizeInput } from "../shared/fsm/validator.ts";
import { buildSystemPrompt } from "../shared/fsm/prompt-builder.ts";
import { detectLanguage } from "../shared/fsm/language.ts";
import { analyzeUserMessage, mapNLUIntentToFSMIntent } from "../shared/fsm/nlu.ts";
import { extractNameAndPhone } from "../shared/fsm/simple-extractor.ts";
import type { ConversationContext, ProcessingInput, ConversationTone } from "../shared/fsm/types.ts";

// WhatsApp-specific utilities
import { createTwiMLResponse, createTwiMLHeaders } from './utils/twilio.ts';
import { truncateForWhatsApp } from './utils/format.ts';

// Legacy services (backward compatibility)
import { checkFAQ } from './services/faq.ts';
import { detectCannedResponseTrigger, getCannedResponse } from './services/canned-responses.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const userPhone = formData.get('From')?.toString() || '';
    const rawMessage = formData.get('Body')?.toString() || '';
    const twilioAccountSid = formData.get('AccountSid')?.toString() || '';

    if (!userPhone || !rawMessage) {
      return new Response('Missing required fields', { status: 400 });
    }

    const message = sanitizeInput(rawMessage);
    console.log("📱 WhatsApp FSM:", userPhone.slice(-4));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get agency
    const { data: agency } = await supabase
      .from('agencies')
      .select('*')
      .eq('twilio_account_sid', twilioAccountSid)
      .single();

    if (!agency) {
      return new Response('Agency not found', { status: 404 });
    }

    console.log(`🏢 Agency: ${agency.name}`);

    // Get plan features
    const { data: planFeatures } = await supabase
      .from('plan_features')
      .select('*')
      .eq('plan_type', agency.plan_type)
      .single();

    // Save incoming message
    await supabase.from('whatsapp_conversations').insert({
      phone: userPhone,
      role: 'user',
      content: message,
      agency_id: agency.id
    });

    // Load tours
    const { data: dbTours } = await supabase
      .from('tours')
      .select(`
        *,
        dates:tour_dates(
          id,
          departure_date,
          return_date,
          price_adult,
          price_child,
          quota
        )
      `)
      .eq('agency_id', agency.id);

    const tours = (dbTours || []).map((tour: any) => ({
      id: tour.id,
      title: tour.title,
      destination: tour.destination,
      type: tour.type,
      currency: tour.currency,
      program_kisa: tour.program_kisa,
      gezilecek_yerler: tour.gezilecek_yerler,
      dates: tour.dates || []
    }));

    console.log(`📦 Tours: ${tours.length}`);

    // === Legacy features (canned responses, FAQ) ===
    if (planFeatures?.has_templates) {
      const cannedTrigger = detectCannedResponseTrigger(message, 'tr');
      if (cannedTrigger) {
        const response = getCannedResponse(cannedTrigger, 'tr');
        if (response) {
          await supabase.from('whatsapp_conversations').insert({
            phone: userPhone,
            role: 'assistant',
            content: response,
            agency_id: agency.id
          });
          return new Response(
            createTwiMLResponse(truncateForWhatsApp(response)), 
            { status: 200, headers: createTwiMLHeaders() }
          );
        }
      }

      const faqResponse = await checkFAQ(supabase, message, agency.id, 'tr');
      if (faqResponse) {
        await supabase.from('whatsapp_conversations').insert({
          phone: userPhone,
          role: 'assistant',
          content: faqResponse,
          agency_id: agency.id
        });
        return new Response(
          createTwiMLResponse(truncateForWhatsApp(faqResponse)), 
          { status: 200, headers: createTwiMLHeaders() }
        );
      }
    }

    // === FSM-based conversation ===

    // Load context (sessionId = phone)
    const { data: existingState } = await supabase
      .from('whatsapp_conversations')
      .select('content')
      .eq('phone', userPhone)
      .eq('agency_id', agency.id)
      .eq('role', 'system')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let context: ConversationContext;

    if (existingState?.content) {
      try {
        const parsed = JSON.parse(existingState.content);
        if (isValidContext(parsed)) {
          context = parsed;
          console.log(`✅ Loaded context - Stage: ${context.stage}`);
        } else {
          throw new Error('Invalid context');
        }
      } catch (e) {
        console.log("⚠️ Creating fresh context");
        const detectedLang = await detectLanguage(message);
        const tone = (agency.conversation_style || 'standart') as ConversationTone;
        context = createInitialContext(detectedLang || 'tr', tone);
      }
    } else {
      console.log("🆕 Fresh context");
      const detectedLang = await detectLanguage(message);
      const tone = (agency.conversation_style || 'standart') as ConversationTone;
      context = createInitialContext(detectedLang || 'tr', tone);
    }

    // Get conversation history
    const { data: recentMessages } = await supabase
      .from('whatsapp_conversations')
      .select('role, content')
      .eq('phone', userPhone)
      .eq('agency_id', agency.id)
      .neq('role', 'system')
      .order('created_at', { ascending: false })
      .limit(10);

    const conversationSummary = (recentMessages || [])
      .reverse()
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    // Analyze with NLU
    const nluResult = await analyzeUserMessage(
      message,
      conversationSummary,
      context.stage,
      context.currentTour,
      tours
    );

    console.log("🧠 Intent:", nluResult.intent);

    const fsmIntent = mapNLUIntentToFSMIntent(nluResult.intent);

    // Match tours
    let selectedTour = null;
    if (nluResult.entities.tour_name) {
      const found = tours.find(t => 
        t.title.toLowerCase().includes(nluResult.entities.tour_name!.toLowerCase())
      );
      if (found) {
        selectedTour = {
          id: found.id,
          title: found.title,
          destination: found.destination,
          dates: found.dates,
          program_kisa: found.program_kisa,
          gezilecek_yerler: found.gezilecek_yerler
        };
        console.log("🎫 Tour:", selectedTour.title);
      }
    } else if (nluResult.entities.destination) {
      const found = tours.find(t => 
        t.destination.toLowerCase().includes(nluResult.entities.destination!.toLowerCase())
      );
      if (found) {
        selectedTour = {
          id: found.id,
          title: found.title,
          destination: found.destination,
          dates: found.dates,
          program_kisa: found.program_kisa,
          gezilecek_yerler: found.gezilecek_yerler
        };
        console.log("🎫 Tour by destination:", selectedTour.title);
      }
    }

    // Extract info
    const extractedInfo: any = { ...nluResult.updates };
    if (nluResult.entities.dates && nluResult.entities.dates.length > 0) {
      extractedInfo.selectedDate = nluResult.entities.dates[0];
    }

    const simpleExtraction = extractNameAndPhone(message);
    if (simpleExtraction.fullName && !extractedInfo.fullName) {
      extractedInfo.fullName = simpleExtraction.fullName;
    }
    if (simpleExtraction.phone && !extractedInfo.phone) {
      extractedInfo.phone = simpleExtraction.phone;
    }

    // Process transition
    const input: ProcessingInput = {
      userMessage: message,
      detectedIntent: fsmIntent,
      extractedInfo,
      selectedTour,
      language: context.language
    };

    const newContext = processTransition(context, input);
    console.log(`🔄 ${context.stage} → ${newContext.stage}`);

    // Build prompt
    const promptContext = {
      stage: newContext.stage,
      collectionStep: newContext.collectionStep,
      currentTour: newContext.currentTour,
      reservationInfo: newContext.reservationInfo,
      availableTours: tours,
      language: newContext.language,
      tone: newContext.tone,
      agencyName: agency.name,
      agencyCity: agency.city,
      paymentInfo: agency.payment_instructions ? 
        JSON.stringify(agency.payment_instructions) : undefined
    };

    const systemPrompt = buildSystemPrompt(promptContext);

    // Call AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices[0].message.content;

    console.log("🤖 Reply:", reply.substring(0, 80));

    // Save response
    await supabase.from('whatsapp_conversations').insert({
      phone: userPhone,
      role: 'assistant',
      content: reply,
      agency_id: agency.id
    });

    // Save reservation if completed
    if (newContext.stage === 'COMPLETED' && newContext.reservationConfirmed) {
      console.log("💾 Saving reservation...");
      
      const { error: regError } = await supabase.from('registrations').insert({
        tour_id: newContext.reservationInfo.tourId,
        tour_date_id: newContext.reservationInfo.dateId,
        full_name: newContext.reservationInfo.fullName,
        phone: newContext.reservationInfo.phone || userPhone,
        pax: (newContext.reservationInfo.paxAdult || 0) + (newContext.reservationInfo.paxChild || 0),
        agency_id: agency.id,
        status: 'NEW'
      });

      if (regError) {
        console.error("❌ Save error:", regError);
      } else {
        console.log("✅ Reservation saved");
      }

      // Update profile
      await supabase.from('whatsapp_user_profiles').upsert({
        phone: userPhone,
        agency_id: agency.id,
        full_name: newContext.reservationInfo.fullName,
        total_bookings: 1,
        last_interaction_at: new Date().toISOString()
      }, {
        onConflict: 'phone,agency_id'
      });
    }

    // Save context
    await supabase.from('whatsapp_conversations').insert({
      phone: userPhone,
      role: 'system',
      content: JSON.stringify(newContext),
      agency_id: agency.id
    });

    return new Response(
      createTwiMLResponse(truncateForWhatsApp(reply)), 
      { status: 200, headers: createTwiMLHeaders() }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      createTwiMLResponse("Üzgünüm, bir hata oluştu."),
      { status: 200, headers: createTwiMLHeaders() }
    );
  }
});

function isValidContext(obj: any): obj is ConversationContext {
  return obj && 
    typeof obj === 'object' &&
    typeof obj.stage === 'string' &&
    typeof obj.language === 'string' &&
    typeof obj.tone === 'string';
}
