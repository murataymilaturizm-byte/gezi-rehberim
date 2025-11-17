import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Services
import { checkFAQ } from './services/faq.ts';
import { detectIntent } from './services/intent-detector.ts';
import { getUserProfile, upsertUserProfile, enrichConversationInsights } from './services/profile.ts';
import { saveMessage, getConversationHistory } from './services/conversation.ts';
import { updateConversationState } from './services/conversation-state.ts';
import { detectCannedResponseTrigger, getCannedResponse } from './services/canned-responses.ts';
import { handleIntelligently } from './services/intelligent-handler.ts';
import { getWizardState, handleWizardStep } from './handlers/wizard.ts';
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

    await updateConversationState(supabase, userPhone, agency.id, {
      lastIntent: intent.type
    });

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
