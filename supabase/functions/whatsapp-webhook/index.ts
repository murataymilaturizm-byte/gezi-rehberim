import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Services
import { checkFAQ } from './services/faq.ts';
import { detectIntent } from './services/intent-detector.ts';
import { getUserProfile, upsertUserProfile, enrichConversationInsights } from './services/profile.ts';
import { saveMessage, getConversationHistory } from './services/conversation.ts';
import { updateConversationState } from './services/conversation-state.ts';
import { detectCannedResponseTrigger, getCannedResponse } from './services/canned-responses.ts';

// Handlers
import { handleIntelligently } from './services/intelligent-handler.ts';
import { getWizardState, handleWizardStep, saveWizardState } from './handlers/wizard.ts';

// Utils
import { truncateForWhatsApp } from './utils/format.ts';
import { createTwiMLResponse, createTwiMLHeaders } from './utils/twilio.ts';

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

    // Get plan features
    const { data: planFeatures } = await supabase
      .from('plan_features')
      .select('*')
      .eq('plan_type', agency.plan_type)
      .single();

    await saveMessage(supabase, userPhone, 'user', userMessage, agency.id);
    await upsertUserProfile(supabase, userPhone, agency.id, userMessage, agency.enabled_languages || []);

    const userProfile = await getUserProfile(supabase, userPhone, agency.id);
    const userLanguage = userProfile?.language_preference || 'tr';

    // Check wizard
    const wizardState = await getWizardState(supabase, userPhone, agency.id);
    if (wizardState) {
      const response = await handleWizardStep(supabase, userPhone, agency.id, userMessage, wizardState);
      await saveMessage(supabase, userPhone, 'assistant', response, agency.id);
      return new Response(createTwiMLResponse(response), { status: 200, headers: createTwiMLHeaders() });
    }

    // Check canned responses (if templates enabled)
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

    // Check FAQ (if templates enabled)
    if (planFeatures?.has_templates) {
      const faqResponse = await checkFAQ(supabase, userMessage, agency.id, userLanguage);
      if (faqResponse) {
        await saveMessage(supabase, userPhone, 'assistant', faqResponse, agency.id);
        return new Response(createTwiMLResponse(faqResponse), { status: 200, headers: createTwiMLHeaders() });
      }
    }

    // Get conversation history for better categorization
    const history = await getConversationHistory(supabase, userPhone, agency.id, 10);
    
    console.log('WhatsApp - Phone:', userPhone, 'Agency:', agency.id, 'History count:', history.length);
    console.log('WhatsApp - User message:', userMessage.substring(0, 100));
    
    const intent = await categorizeMessage(userMessage, history, userLanguage);
    let responseMessage = '';

    console.log('WhatsApp - Intent:', intent.type, 'Confidence:', intent.confidence);

    switch (intent.type) {
      case 'greeting':
        responseMessage = await handleGreeting(supabase, userPhone, agency.id, userMessage, agency.conversation_style || 'professional');
        break;
      case 'tour.list':
        responseMessage = await handleTourList(supabase, userPhone, agency.id, agency.conversation_style || 'professional');
        break;
      case 'tour.search':
        responseMessage = await handleTourSearch(supabase, userPhone, agency.id, userMessage);
        break;
      case 'reservation.wizard':
        // Extract last discussed tour from history - check both assistant and user messages
        // History comes ordered by created_at DESC (newest first), so iterate from start
        let lastDiscussedTour = null;
        const tourKeywords = [
          { keywords: ['pamukkale'], name: 'Pamukkale' },
          { keywords: ['kapadokya', 'balon', 'kappadocia'], name: 'Kapadokya' },
          { keywords: ['antalya', 'rafting'], name: 'Antalya' },
          { keywords: ['ege', 'çeşme', 'alaçatı', 'alacati'], name: 'Ege' },
          { keywords: ['istanbul', 'İstanbul'], name: 'İstanbul' }
        ];
        
        // First pass: Check assistant messages (more reliable)
        for (let i = 0; i < history.length && !lastDiscussedTour; i++) {
          if (history[i].role === 'assistant') {
            const content = history[i].content.toLowerCase();
            for (const tourGroup of tourKeywords) {
              if (tourGroup.keywords.some(keyword => content.includes(keyword.toLowerCase()))) {
                lastDiscussedTour = tourGroup.name;
                break;
              }
            }
          }
        }
        
        // Second pass: If not found, check user messages
        if (!lastDiscussedTour) {
          for (let i = 0; i < history.length; i++) {
            if (history[i].role === 'user') {
              const content = history[i].content.toLowerCase();
              for (const tourGroup of tourKeywords) {
                if (tourGroup.keywords.some(keyword => content.includes(keyword.toLowerCase()))) {
                  lastDiscussedTour = tourGroup.name;
                  break;
                }
              }
              if (lastDiscussedTour) break;
            }
          }
        }
        
        console.log('WhatsApp - Reservation wizard triggered');
        console.log('WhatsApp - Last discussed tour:', lastDiscussedTour);
        console.log('WhatsApp - History length:', history.length);
        
        await saveWizardState(supabase, userPhone, agency.id, { 
          step: lastDiscussedTour ? 'date_selection' : 'tour_selection', 
          created_at: new Date().toISOString() 
        });
        
        if (lastDiscussedTour) {
          const tourGreetings: Record<string, string> = {
            tr: `🎯 Harika! ${lastDiscussedTour} turu için rezervasyon işleminize başlayalım.\n\n📅 Hangi tarihi tercih edersiniz ve kaç kişi katılacaksınız?\n\nİptal etmek için "iptal" yazabilirsiniz.`,
            en: `🎯 Great! Let's start your reservation for ${lastDiscussedTour} tour.\n\n📅 Which date do you prefer and how many people will join?\n\nYou can write "cancel" to abort.`,
            de: `🎯 Großartig! Beginnen wir mit Ihrer Reservierung für ${lastDiscussedTour} Tour.\n\n📅 Welches Datum bevorzugen Sie und wie viele Personen nehmen teil?\n\nSie können "cancel" schreiben, um abzubrechen.`,
            ru: `🎯 Отлично! Начнем бронирование тура ${lastDiscussedTour}.\n\n📅 Какую дату вы предпочитаете и сколько человек будет участвовать?\n\nНапишите "cancel" для отмены.`,
            ar: `🎯 رائع! لنبدأ حجز جولة ${lastDiscussedTour}.\n\n📅 ما هو التاريخ المفضل وكم عدد الأشخاص؟\n\nيمكنك كتابة "cancel" للإلغاء.`,
            fr: `🎯 Super! Commençons votre réservation pour le circuit ${lastDiscussedTour}.\n\n📅 Quelle date préférez-vous et combien de personnes participeront?\n\nVous pouvez écrire "cancel" pour annuler.`,
            es: `🎯 ¡Genial! Comencemos con su reserva para el tour ${lastDiscussedTour}.\n\n📅 ¿Qué fecha prefiere y cuántas personas participarán?\n\nPuede escribir "cancel" para cancelar.`
          };
          responseMessage = tourGreetings[userLanguage] || tourGreetings['tr'];
        } else {
          responseMessage = userLanguage === 'tr' 
            ? 'Rezervasyon başlatıldı. Hangi turu seçmek istersiniz?' 
            : 'Reservation started. Which tour would you like to select?';
        }
        break;
      default:
        responseMessage = await handleGeneralChat(supabase, userPhone, agency.id, userMessage, agency.conversation_style || 'professional');
    }

    responseMessage = truncateForWhatsApp(responseMessage);
    await saveMessage(supabase, userPhone, 'assistant', responseMessage, agency.id);
    return new Response(createTwiMLResponse(responseMessage), { status: 200, headers: createTwiMLHeaders() });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
