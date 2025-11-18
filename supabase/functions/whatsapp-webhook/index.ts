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
        }
        // If multiple matching tours, don't select - let AI list them
        
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
        // Start wizard with pre-selected tour and show dates immediately
        console.log('🎯 Starting wizard with pre-selected tour:', conversationState.currentTour.title);
        
        const { data: tours } = await supabase
          .from('tours')
          .select(`
            *,
            dates:tour_dates(*)
          `)
          .eq('id', conversationState.currentTour.id)
          .single();

        if (tours && tours.dates && tours.dates.length > 0) {
          // Create wizard state
          const wizardState = {
            step: 'date_selection',
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

          // Format and show available dates immediately
          const dateMessages = {
            tr: { 
              welcome: 'Harika! Aşağıdaki tur için kayıt işleminizi başlatalım:',
              availableDates: 'Mevcut tarihler',
              selectDate: 'Hangi tarih için kayıt olmak istersiniz? (Numara yazabilirsiniz)',
              quota: 'kişi'
            },
            en: {
              welcome: 'Great! Let\'s start your registration for the following tour:',
              availableDates: 'Available dates',
              selectDate: 'Which date would you like to register for? (You can write the number)',
              quota: 'people'
            }
          };

          const msg = dateMessages[userLanguage as keyof typeof dateMessages] || dateMessages.tr;
          
          const dateList = tours.dates
            .filter((d: any) => d.quota > 0 && new Date(d.departure_date) >= new Date())
            .sort((a: any, b: any) => new Date(a.departure_date).getTime() - new Date(b.departure_date).getTime())
            .map((d: any, i: number) => {
              const date = new Date(d.departure_date);
              const formattedDate = date.toLocaleDateString(userLanguage === 'tr' ? 'tr-TR' : 'en-US', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              });
              return `${i + 1}. ${formattedDate} - ${d.quota} ${msg.quota}`;
            })
            .join('\n');
          
          const wizardResponse = `${msg.welcome} *${tours.title}*! 🎉\n\n${msg.availableDates}:\n${dateList}\n\n${msg.selectDate}`;
          
          await saveMessage(supabase, userPhone, 'assistant', wizardResponse, agency.id);
          console.log('✅ Wizard started with dates shown to user');
          
          return new Response(createTwiMLResponse(wizardResponse), { 
            status: 200, 
            headers: createTwiMLHeaders() 
          });
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
