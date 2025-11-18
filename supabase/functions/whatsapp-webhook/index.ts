import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Services
import { checkFAQ } from './services/faq.ts';
import { detectIntent } from './services/intent-detector.ts';
import { getUserProfile, upsertUserProfile, enrichConversationInsights } from './services/profile.ts';
import { saveMessage, getConversationHistory } from './services/conversation.ts';
import { updateConversationState, getConversationState } from './services/conversation-state.ts';
import { detectCannedResponseTrigger, getCannedResponse } from './services/canned-responses.ts';
import { handleIntelligently } from './services/intelligent-handler.ts';
import { getWizardState, handleWizardStep } from './handlers/wizard.ts';
import { truncateForWhatsApp } from './utils/format.ts';
import { createTwiMLResponse, createTwiMLHeaders } from './utils/twilio.ts';
import { extractMemory } from './services/memory-extractor.ts';
import { getAllActiveTours } from './services/tour.ts';

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
    const userMessage = formData.get('Body')?.toString() || '';
    const twilioAccountSid = formData.get('AccountSid')?.toString() || '';

    if (!userPhone || !userMessage) {
      return new Response('Missing required fields', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: agency } = await supabase
      .from('agencies')
      .select('*')
      .eq('twilio_account_sid', twilioAccountSid)
      .single();

    if (!agency) return new Response('Agency not found', { status: 404 });

    const { data: planFeatures } = await supabase
      .from('plan_features')
      .select('*')
      .eq('plan_type', agency.plan_type)
      .single();

    await saveMessage(supabase, userPhone, 'user', userMessage, agency.id);
    await upsertUserProfile(supabase, userPhone, agency.id, userMessage, agency.enabled_languages || []);

    const userProfile = await getUserProfile(supabase, userPhone, agency.id);
    const userLanguage = userProfile?.language_preference || 'tr';

    const wizardState = await getWizardState(supabase, userPhone, agency.id);
    if (wizardState) {
      const response = await handleWizardStep(supabase, userPhone, agency.id, userMessage, wizardState);
      await saveMessage(supabase, userPhone, 'assistant', response, agency.id);
      return new Response(createTwiMLResponse(response), { status: 200, headers: createTwiMLHeaders() });
    }

    if (planFeatures?.has_templates) {
      const cannedTrigger = detectCannedResponseTrigger(userMessage, userLanguage);
      if (cannedTrigger) {
        const response = getCannedResponse(cannedTrigger, userLanguage);
        if (response) {
          await saveMessage(supabase, userPhone, 'assistant', response, agency.id);
          return new Response(createTwiMLResponse(response), { status: 200, headers: createTwiMLHeaders() });
        }
      }
    }

    if (planFeatures?.has_templates) {
      const faqResponse = await checkFAQ(supabase, userMessage, agency.id, userLanguage);
      if (faqResponse) {
        await saveMessage(supabase, userPhone, 'assistant', faqResponse, agency.id);
        return new Response(createTwiMLResponse(faqResponse), { status: 200, headers: createTwiMLHeaders() });
      }
    }

    const history = await getConversationHistory(supabase, userPhone, agency.id, 15);
    const intent = await detectIntent(userMessage, history, userLanguage);
    
    console.log('🤖 AI Intent Detection:', {
      phone: userPhone.slice(-4),
      message: userMessage.substring(0, 50),
      intent: intent.type,
      confidence: intent.confidence
    });

    // Handle tour selection - ONLY select if user is specific or there's only one match
    const numericSelection = userMessage.match(/^\d+$/);
    
    if ((intent.type as string).includes('tour.detail') || numericSelection) {
      const { data: tours } = await supabase
        .from('tours')
        .select(`
          *,
          dates:tour_dates(*)
        `)
        .eq('agency_id', agency.id)
        .order('created_at', { ascending: false });

      if (tours && tours.length > 0) {
        const lowerMessage = userMessage.toLowerCase();
        
        // Smart matching (case insensitive, partial match)
        const matchingTours = tours.filter((t: any) => {
          const lowerTitle = t.title.toLowerCase();
          const lowerDestination = t.destination.toLowerCase();
          
          return lowerMessage.includes(lowerTitle) || 
                 lowerTitle.includes(lowerMessage) ||
                 lowerMessage.includes(lowerDestination) ||
                 lowerDestination.includes(lowerMessage);
        });
        
        let selectedTour = null;
        
        // Handle numeric selection
        if (numericSelection) {
          const index = parseInt(userMessage) - 1;
          if (index >= 0 && index < tours.length) {
            selectedTour = tours[index];
          }
        } else if (matchingTours.length === 1) {
          // Only auto-select if there's exactly ONE matching tour
          selectedTour = matchingTours[0];
        }
        
        // Check if user is referring to a previously discussed tour
        if (!selectedTour && matchingTours.length === 0) {
          const referencePatterns = /\b(konuştuğumuz|bahsettiğimiz|söylediğiniz|bu|o|şu|kayıt|rezervasyon)\s*(tur|turu|tura|turun)?/i;
          const bookingIntents = /\b(kayıt|kayır|rezervasyon|ayır|ayırmak|katılmak|gelmek|gitmek|olmak|isterim|istiyorum)\b/i;
          
          if (referencePatterns.test(userMessage) || (bookingIntents.test(userMessage) && intent.type === 'reservation.wizard')) {
            console.log('🔍 User referring to previous tour, checking history...');
            
            // Get recent conversation history
            const recentHistory = await getConversationHistory(supabase, userPhone, agency.id, 10);
            
            for (const msg of recentHistory.reverse()) {
              for (const tour of tours) {
                const lowerContent = msg.content.toLowerCase();
                const lowerTitle = tour.title.toLowerCase();
                const lowerDest = tour.destination.toLowerCase();
                
                if (lowerContent.includes(lowerTitle) || lowerContent.includes(lowerDest)) {
                  console.log('✅ Found previously mentioned tour:', tour.title);
                  selectedTour = tour;
                  break;
                }
              }
              if (selectedTour) break;
            }
          }
        }
        
        if (selectedTour) {
          const { data: profile } = await supabase
            .from('whatsapp_user_profiles')
            .select('preferences')
            .eq('phone', userPhone)
            .eq('agency_id', agency.id)
            .single();

          const state = (profile?.preferences as any)?.conversation_state || {};
          
          if (!state.currentTour) {
            state.currentTour = {
              id: selectedTour.id,
              title: selectedTour.title,
              destination: selectedTour.destination,
              priceAdult: selectedTour.dates?.[0]?.price_adult,
              currency: selectedTour.currency
            };
            state.wizardStep = 'tour_selected';
            state.shownTourIds = state.shownTourIds || [];
            if (!state.shownTourIds.includes(selectedTour.id)) {
              state.shownTourIds.push(selectedTour.id);
            }
            
            await supabase
              .from('whatsapp_user_profiles')
              .update({
                preferences: { ...profile?.preferences, conversation_state: state }
              })
              .eq('phone', userPhone)
              .eq('agency_id', agency.id);
            
            console.log('✅ Tour selected:', selectedTour.title);
          }
        } else if (matchingTours.length > 1) {
          console.log(`📋 Multiple tours match (${matchingTours.length}), letting AI list them`);
        }
      }
    }

    await updateConversationState(supabase, userPhone, agency.id, {
      lastIntent: intent.type
    });

    // Handle reservation.wizard - start wizard with currentTour if available
    if (intent.type === 'reservation.wizard') {
      const conversationState = await getConversationState(supabase, userPhone, agency.id);
      
      if (conversationState.currentTour) {
        // Start wizard with pre-selected tour
        console.log('🎯 Starting wizard with pre-selected tour:', conversationState.currentTour.title);
        
        const { data: tours } = await supabase
          .from('tours')
          .select(`
            *,
            dates:tour_dates(*)
          `)
          .eq('id', conversationState.currentTour.id)
          .single();

        if (tours) {
          const wizardState = {
            step: conversationState.userMemory?.lastMentionedPax ? 'date_selection' : 'date_selection',
            selected_tour: tours,
            pax_adult: conversationState.userMemory?.lastMentionedPax?.adults || undefined,
            pax_child: conversationState.userMemory?.lastMentionedPax?.children || undefined,
            created_at: new Date().toISOString()
          };

          // Save wizard state
          const { data: profile } = await supabase
            .from('whatsapp_user_profiles')
            .select('preferences')
            .eq('phone', userPhone)
            .eq('agency_id', agency.id)
            .single();

          const preferences = profile?.preferences || {};
          preferences.wizard_state = wizardState;

          await supabase
            .from('whatsapp_user_profiles')
            .update({ preferences })
            .eq('phone', userPhone)
            .eq('agency_id', agency.id);

          console.log('✅ Wizard state saved with pre-selected tour and pax:', wizardState.pax_adult, 'adults,', wizardState.pax_child, 'children');
        }
      }
    }

    const responseMessage = await handleIntelligently(
      supabase,
      userPhone,
      agency.id,
      userMessage,
      intent.type,
      agency.conversation_style || 'professional'
    );

    const truncatedResponse = truncateForWhatsApp(responseMessage);
    await saveMessage(supabase, userPhone, 'assistant', truncatedResponse, agency.id);
    await enrichConversationInsights(supabase, userPhone, agency.id, userMessage, truncatedResponse, intent.type);

    // Extract and update user memory from conversation (only if plan supports it)
    if (planFeatures?.has_user_profiles) {
      console.log('🧠 Extracting user preferences...');
      const tours = await getAllActiveTours(supabase, agency.id);
      const conversationState = await getConversationState(supabase, userPhone, agency.id);
      
      const updatedMemory = extractMemory(
        userMessage,
        truncatedResponse,
        tours,
        conversationState.userMemory
      );
      
      if (JSON.stringify(updatedMemory) !== JSON.stringify(conversationState.userMemory)) {
        console.log('💾 Saving updated memory:', {
          destinations: updatedMemory.preferredDestinations,
          interests: updatedMemory.interests,
          budget: updatedMemory.budgetRange,
          style: updatedMemory.travelStyle
        });
        
        await updateConversationState(supabase, userPhone, agency.id, {
          userMemory: updatedMemory
        });
        
        console.log('✅ Memory saved successfully');
      }
    }

    console.log('✅ Response sent:', truncatedResponse.length, 'chars');

    return new Response(createTwiMLResponse(truncatedResponse), {
      status: 200,
      headers: createTwiMLHeaders()
    });
  } catch (error) {
    console.error('❌ WhatsApp Webhook Error:', error);
    return new Response('Internal server error', { status: 500 });
  }
});
