import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Services
import { checkFAQ } from './services/faq.ts';
import { categorizeMessage } from './services/categorize.ts';
import { getUserProfile, upsertUserProfile } from './services/profile.ts';
import { saveMessage } from './services/conversation.ts';
import { detectCannedResponseTrigger, getCannedResponse } from './services/canned-responses.ts';

// Handlers
import { handleGreeting } from './handlers/greeting.ts';
import { handleTourList } from './handlers/tour-list.ts';
import { handleTourSearch } from './handlers/tour-search.ts';
import { handleGeneralChat } from './handlers/general-chat.ts';
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

    const intent = await categorizeMessage(userMessage, [], userLanguage);
    let responseMessage = '';

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
        await saveWizardState(supabase, userPhone, agency.id, { step: 'tour_selection', created_at: new Date().toISOString() });
        responseMessage = 'Rezervasyon başlatıldı. Hangi turu seçmek istersiniz?';
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
