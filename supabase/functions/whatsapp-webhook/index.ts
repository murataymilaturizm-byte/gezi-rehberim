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
import { pickLocalized, detectLanguageChangeIntent, getDefaultToneForLanguage } from "../shared/fsm/localization.ts";
import type { ConversationContext, ProcessingInput, ConversationTone } from "../shared/fsm/types.ts";

// WhatsApp-specific utilities
import { createTwiMLResponse, createTwiMLHeaders } from './utils/twilio.ts';
import { truncateForWhatsApp } from './utils/format.ts';

// WhatsApp services
import { generatePaymentMessage } from './services/payment-message.ts';

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

    // Get agency with enabled languages
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

    // Note: We'll update tours with localized fields after we have context
    const toursRaw = dbTours || [];

    console.log(`📦 Tours: ${toursRaw.length}`);

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

    // Detect language change intent and runtime language
    const languageChangeIntent = detectLanguageChangeIntent(message);
    const runtimeDetectedLang = await detectLanguage(message);

    if (existingState?.content) {
      try {
        const parsed = JSON.parse(existingState.content);
        if (isValidContext(parsed)) {
          context = parsed;
          
          // Handle explicit language change request
          if (languageChangeIntent && languageChangeIntent !== context.language) {
            console.log(`🌐 Language change: ${context.language} → ${languageChangeIntent}`);
            context.language = languageChangeIntent;
            context.tone = getDefaultToneForLanguage(languageChangeIntent) as ConversationTone;
          } else if (runtimeDetectedLang && runtimeDetectedLang !== context.language) {
            // Update language if detected language is different (but less aggressively than intent)
            console.log(`🌐 Language detected: ${context.language} → ${runtimeDetectedLang}`);
            context.language = runtimeDetectedLang;
          }
          
          console.log(`✅ Loaded context - Stage: ${context.stage}, Lang: ${context.language}`);
        } else {
          throw new Error('Invalid context');
        }
      } catch (e) {
        console.log("⚠️ Creating fresh context");
        const initialLang = languageChangeIntent || runtimeDetectedLang || 'tr';
        const tone = getDefaultToneForLanguage(initialLang) as ConversationTone;
        context = createInitialContext(initialLang, tone);
      }
    } else {
      console.log("🆕 Fresh context");
      const initialLang = languageChangeIntent || runtimeDetectedLang || 'tr';
      const tone = getDefaultToneForLanguage(initialLang) as ConversationTone;
      context = createInitialContext(initialLang, tone);
    }

    // Check if detected language is enabled for this agency
    const enabledLanguages = (agency as any).enabled_languages || ['tr'];
    if (!enabledLanguages.includes(context.language)) {
      console.log(`⚠️ Language ${context.language} not enabled for agency. Falling back to first enabled: ${enabledLanguages[0]}`);
      context.language = enabledLanguages[0];
      context.tone = getDefaultToneForLanguage(context.language) as ConversationTone;
    }

    // Now create localized tours based on context language
    const tours = toursRaw.map((tour: any) => ({
      id: tour.id,
      title: pickLocalized(tour, "title", context.language),
      destination: pickLocalized(tour, "destination", context.language),
      type: tour.type,
      currency: tour.currency,
      program_kisa: pickLocalized(tour, "program_kisa", context.language),
      gezilecek_yerler: tour.gezilecek_yerler,
      dates: tour.dates || []
    }));

    // === Legacy features (canned responses, FAQ) - with dynamic language ===
    const currentLang = context.language || 'tr';
    
    if (planFeatures?.has_templates) {
      const cannedTrigger = detectCannedResponseTrigger(message, currentLang);
      if (cannedTrigger) {
        const response = getCannedResponse(cannedTrigger, currentLang);
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

      const faqResponse = await checkFAQ(supabase, message, agency.id, currentLang);
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
    let reply = aiData.choices[0].message.content;

    console.log("🤖 Reply:", reply.substring(0, 80));

    // === APPEND PAYMENT MESSAGE IF COMPLETED ===
    let finalReply = reply;
    
    if (newContext.stage === 'COMPLETED' && 
        newContext.reservationConfirmed && 
        !newContext.paymentInfoSent && 
        agency.payment_instructions) {
      
      console.log("💳 Appending payment info...");
      
      // Calculate payment amounts
      const paymentInstructions = agency.payment_instructions;
      const depositPercentage = paymentInstructions.deposit_percentage || 30;
      
      // Get selected tour date to calculate price
      const selectedTourDate = toursRaw
        .find((t: any) => t.id === newContext.reservationInfo.tourId)
        ?.dates?.find((d: any) => d.id === newContext.reservationInfo.dateId);
      
      if (selectedTourDate) {
        const paxAdult = newContext.reservationInfo.paxAdult || 0;
        const paxChild = newContext.reservationInfo.paxChild || 0;
        const priceAdult = selectedTourDate.price_adult || 0;
        const priceChild = selectedTourDate.price_child || priceAdult;
        
        const totalPrice = (paxAdult * priceAdult) + (paxChild * priceChild);
        const depositAmount = Math.ceil((totalPrice * depositPercentage) / 100);
        
        const paymentMessage = generatePaymentMessage(
          paymentInstructions,
          newContext.language,
          totalPrice,
          depositAmount
        );
        
        if (paymentMessage) {
          finalReply = reply + paymentMessage;
          newContext.paymentInfoSent = true;
          console.log("✅ Payment info appended");
        }
      }
    }

    // Save response
    await supabase.from('whatsapp_conversations').insert({
      phone: userPhone,
      role: 'assistant',
      content: finalReply,
      agency_id: agency.id
    });

    // Save reservation if completed
    if (newContext.stage === 'COMPLETED' && newContext.reservationConfirmed) {
      console.log("💾 Saving reservation...");
      
      const { data: newRegistration, error: regError } = await supabase.from('registrations').insert({
        tour_id: newContext.reservationInfo.tourId,
        tour_date_id: newContext.reservationInfo.dateId,
        full_name: newContext.reservationInfo.fullName,
        phone: newContext.reservationInfo.phone || userPhone,
        pax: (newContext.reservationInfo.paxAdult || 0) + (newContext.reservationInfo.paxChild || 0),
        agency_id: agency.id,
        status: 'NEW'
      }).select().single();

      if (regError) {
        console.error("❌ Save error:", regError);
      } else {
        console.log("✅ Reservation saved");

        // Send reservation confirmation template if available
        const { data: template } = await supabase
          .from('message_templates')
          .select('*')
          .eq('agency_id', agency.id)
          .eq('template_key', 'reservation_confirmed')
          .eq('language', newContext.language)
          .eq('is_active', true)
          .maybeSingle();

        if (template && newRegistration) {
          console.log("📧 Sending reservation confirmation template...");
          
          // Replace template variables
          const selectedTour = tours.find(t => t.id === newContext.reservationInfo.tourId);
          const selectedDate = selectedTour?.dates?.find((d: any) => d.id === newContext.reservationInfo.dateId);
          
          let templateContent = template.content;
          templateContent = templateContent.replace('{customer_name}', newContext.reservationInfo.fullName || '');
          templateContent = templateContent.replace('{tour_name}', selectedTour?.title || '');
          templateContent = templateContent.replace('{tour_date}', selectedDate?.departure_date || '');
          templateContent = templateContent.replace('{pax}', String((newContext.reservationInfo.paxAdult || 0) + (newContext.reservationInfo.paxChild || 0)));
          
          // Append template message to final reply
          finalReply = finalReply + '\n\n' + templateContent;
          console.log("✅ Template message appended");
        }
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
      createTwiMLResponse(truncateForWhatsApp(finalReply)), 
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
