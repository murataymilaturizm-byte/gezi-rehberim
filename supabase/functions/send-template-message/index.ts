import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppMessage, sendWhatsAppTemplate, getMetaCredentials } from "../_shared/metaWhatsapp.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();

    // === Direct Meta Template Mode (for testing / direct sends) ===
    if (body.phone && body.templateName) {
      const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '';
      const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN') || '';

      if (!phoneNumberId || !accessToken) {
        return new Response(
          JSON.stringify({ error: 'Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const phone = body.phone.replace('+', '').trim();
      const templateName = body.templateName;
      const languageCode = body.languageCode || 'en_US';
      const components = body.components || [];

      console.log(`📤 Direct template send: ${templateName} to ${phone} (${languageCode})`);

      const result = await sendWhatsAppTemplate(
        phoneNumberId, accessToken, phone, templateName, languageCode, components
      );

      return new Response(
        JSON.stringify({ success: result.success, messageId: result.messageId, error: result.error }),
        { status: result.success ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === Manual Agency Send Mode (agencyId + phone, no registration) ===
    if (body.agencyId && body.phone && body.templateKey && !body.registrationId) {
      const { agencyId, phone: rawPhone, templateKey: manualTemplateKey, language: manualLang, variableValues } = body;

      const { data: agency } = await supabase
        .from('agencies')
        .select('meta_phone_number_id, meta_access_token')
        .eq('id', agencyId)
        .single();

      if (!agency?.meta_access_token || !agency?.meta_phone_number_id) {
        return new Response(
          JSON.stringify({ error: 'WhatsApp credentials not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: manualTemplate } = await (supabase as any)
        .from('message_templates')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('template_key', manualTemplateKey)
        .eq('language', manualLang || 'tr')
        .eq('is_active', true)
        .maybeSingle();

      if (!manualTemplate) {
        return new Response(
          JSON.stringify({ error: 'Template not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let manualMessage = manualTemplate.content;
      Object.entries(variableValues || {}).forEach(([key, value]) => {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        manualMessage = manualMessage.replace(regex, String(value));
      });

      const normalizedPhone = rawPhone.replace('whatsapp:', '').replace('+', '').trim();
      const manualResult = await sendWhatsAppMessage(
        agency.meta_phone_number_id,
        agency.meta_access_token,
        normalizedPhone,
        manualMessage
      );

      if (!manualResult.success) {
        throw new Error(`WhatsApp error: ${manualResult.error}`);
      }

      await supabase.from('whatsapp_conversations').insert({
        phone: normalizedPhone,
        role: 'assistant',
        content: manualMessage,
        agency_id: agencyId,
      });

      return new Response(
        JSON.stringify({ success: true, messageId: manualResult.messageId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === Registration-based Template Mode (existing logic) ===
    const { registrationId, templateKey, language: bodyLanguage } = body;

    console.log('Send template message request:', { registrationId, templateKey });

    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select(`
        *,
        tours:tour_id (
          title,
          destination,
          hareket_noktasi,
          toplanma_saati
        ),
        tour_dates:tour_date_id (
          departure_date,
          price_adult
        ),
        agencies:agency_id (
          id,
          whatsapp_phone_number,
          name,
          meta_phone_number_id,
          meta_access_token
        )
      `)
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      console.error('Registration not found:', regError);
      return new Response(
        JSON.stringify({ error: 'Registration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Registration found:', registration);

    // Get user language preference — priority: whatsapp_user_profiles > body.language > 'tr'
    let language = bodyLanguage || 'tr';

    const { data: userProfile } = await supabase
      .from('whatsapp_user_profiles')
      .select('language_preference')
      .eq('phone', registration.phone.replace('+', ''))
      .eq('agency_id', registration.agency_id)
      .maybeSingle();

    if (userProfile?.language_preference) {
      language = userProfile.language_preference;
    }

    // Get template
    const { data: template, error: templateError } = await (supabase as any)
      .from('message_templates')
      .select('*')
      .eq('agency_id', registration.agency_id)
      .eq('template_key', templateKey)
      .eq('language', language)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      // Fall back to 'tr' template if language-specific one not found
      if (language !== 'tr') {
        const { data: fallbackTemplate } = await (supabase as any)
          .from('message_templates')
          .select('*')
          .eq('agency_id', registration.agency_id)
          .eq('template_key', templateKey)
          .eq('language', 'tr')
          .eq('is_active', true)
          .single();
        if (fallbackTemplate) {
          console.log(`Template not found for language '${language}', using 'tr' fallback`);
          (template as any) = fallbackTemplate;
        }
      }
      if (!template) {
        console.error('Template not found:', templateError);
        return new Response(
          JSON.stringify({ error: 'Template not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fill variables
    const variables: Record<string, string> = {
      full_name: registration.full_name,
      tour_name: registration.tours?.title || '',
      date: registration.tour_dates?.departure_date 
        ? new Date(registration.tour_dates.departure_date).toLocaleDateString('tr-TR', {
            year: 'numeric', month: 'long', day: 'numeric'
          })
        : '',
      pax: registration.pax.toString(),
      total_amount: (registration.tour_dates?.price_adult * registration.pax).toLocaleString('tr-TR'),
      currency: 'TRY',
      meeting_time: registration.tours?.toplanma_saati || '09:00',
      meeting_point: registration.tours?.hareket_noktasi || 'Belirlenen toplanma noktası'
    };

    let message = template.content;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      message = message.replace(regex, variables[key]);
    });

    console.log('Message prepared:', message.substring(0, 100));

    // Send via Meta Cloud API
    const agency = registration.agencies as any;
    const credentials = getMetaCredentials(agency);

    if (!credentials.accessToken || !credentials.phoneNumberId) {
      console.error('Meta WhatsApp credentials not configured for agency');
      return new Response(
        JSON.stringify({ error: 'WhatsApp credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone
    let phoneNumber = registration.phone;
    phoneNumber = phoneNumber.replace('whatsapp:', '').replace('+', '').trim();

    const result = await sendWhatsAppMessage(
      credentials.phoneNumberId,
      credentials.accessToken,
      phoneNumber,
      message
    );

    if (!result.success) {
      console.error('Meta WhatsApp error:', result.error);
      throw new Error(`WhatsApp error: ${result.error}`);
    }

    console.log('Message sent via Meta Cloud API:', result.messageId);

    // Save to database
    await supabase
      .from('whatsapp_conversations')
      .insert({
        phone: phoneNumber,
        role: 'assistant',
        content: message,
        agency_id: registration.agency_id
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: result.messageId,
        template: template.subject 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error sending template message:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});