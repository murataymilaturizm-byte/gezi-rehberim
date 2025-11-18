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
    
    // Get current conversation state
    const conversationState = await getConversationState(supabase, userPhone, agency.id);
    let tourSelected = false;
    
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
        // Find matching tours
        const matchingTours = tours.filter((t: any) => 
          userMessage.toLowerCase().includes(t.title.toLowerCase()) ||
          userMessage.toLowerCase().includes(t.destination.toLowerCase())
        );
        
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
        } else if (matchingTours.length > 1 && intent.type === 'tour.detail') {
          // Multiple tours match and user wants tour details - find best match
          console.log('🎯 MULTIPLE TOURS MATCH - Finding best match for tour.detail intent');
          
          // Score each tour based on how well it matches the message
          const scoredTours = matchingTours.map((tour: any) => {
            const messageLower = userMessage.toLowerCase();
            const titleWords = tour.title.toLowerCase().split(' ');
            
            // Count how many title words appear in the message
            const matchScore = titleWords.filter((word: string) => 
              word.length > 2 && messageLower.includes(word)
            ).length;
            
            // Bonus points for exact title match
            const exactMatch = messageLower.includes(tour.title.toLowerCase()) ? 10 : 0;
            
            return { tour, score: matchScore + exactMatch };
          });
          
          // Sort by score and pick the best match
          scoredTours.sort((a, b) => b.score - a.score);
          const bestMatch = scoredTours[0];
          
          if (bestMatch.score > 0) {
            // We have a clear best match
            selectedTour = bestMatch.tour;
            console.log('✅ BEST MATCH TOUR SELECTED:', selectedTour.title, 'score:', bestMatch.score);
          } else {
            console.log('⚠️ No clear best match - will let AI list all options');
          }
        }
        // If multiple matching tours and not tour.detail, don't select - let AI list them
        
        if (selectedTour && !conversationState.currentTour) {
          conversationState.currentTour = {
            id: selectedTour.id,
            title: selectedTour.title,
            destination: selectedTour.destination,
            priceAdult: selectedTour.dates?.[0]?.price_adult,
            currency: selectedTour.currency
          };
          conversationState.wizardStep = 'tour_selected';
          conversationState.shownTourIds = conversationState.shownTourIds || [];
          if (!conversationState.shownTourIds.includes(selectedTour.id)) {
            conversationState.shownTourIds.push(selectedTour.id);
          }
          tourSelected = true;
          console.log('✅ Tour selected:', selectedTour.title);
        } else if (matchingTours.length > 1) {
          console.log(`📋 Multiple tours match (${matchingTours.length}), letting AI list them`);
        }
      }
    }

    // Update conversation state with intent AND tour selection (if any)
    await updateConversationState(supabase, userPhone, agency.id, {
      lastIntent: intent.type,
      ...(tourSelected && {
        currentTour: conversationState.currentTour,
        wizardStep: conversationState.wizardStep,
        shownTourIds: conversationState.shownTourIds
      })
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
          // Filter out past dates and dates with no quota
          const availableDates = (tours.dates || [])
            .filter((d: any) => 
              new Date(d.departure_date) >= new Date() && 
              d.quota > 0
            )
            .sort((a: any, b: any) => 
              new Date(a.departure_date).getTime() - new Date(b.departure_date).getTime()
            );

          if (availableDates.length === 0) {
            const response = userLanguage === 'tr' 
              ? '❌ Üzgünüm, bu tur için uygun tarih bulunmamaktadır.'
              : '❌ Sorry, no available dates for this tour.';
            await saveMessage(supabase, userPhone, 'assistant', response, agency.id);
            return new Response(createTwiMLResponse(response), { status: 200, headers: createTwiMLHeaders() });
          }

          const wizardState = {
            step: 'date_selection' as const,
            selected_tour: { ...tours, dates: availableDates },
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

          // CRITICAL: Call wizard handler immediately to show date options
          // Don't call intelligent handler - directly show dates
          let wizardResponse = '';
          
          if (userLanguage === 'tr') {
            wizardResponse = `🎫 *${tours.title}*\n\n📅 *Müsait Tarihler:*\n\n`;
          } else {
            wizardResponse = `🎫 *${tours.title}*\n\n📅 *Available Dates:*\n\n`;
          }

          availableDates.forEach((date: any, index: number) => {
            const depDate = new Date(date.departure_date).toLocaleDateString(userLanguage === 'tr' ? 'tr-TR' : 'en-US', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            });
            wizardResponse += `${index + 1}. ${depDate} - ${date.price_adult} ${tours.currency}\n`;
          });

          wizardResponse += userLanguage === 'tr'
            ? '\n\nLütfen tarih numarasını yazın:'
            : '\n\nPlease enter the date number:';

          await saveMessage(supabase, userPhone, 'assistant', wizardResponse, agency.id);
          return new Response(createTwiMLResponse(wizardResponse), { status: 200, headers: createTwiMLHeaders() });
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
