import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { registrationId, templateKey } = await req.json();

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
          whatsapp_api_key,
          name
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

    // Get user language preference
    let language = 'tr';
    
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
      console.error('Template not found:', templateError);
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    // Send via 360Dialog API
    const agency = registration.agencies as any;
    const apiKey = agency?.whatsapp_api_key;

    if (!apiKey) {
      console.error('360Dialog API key not configured for agency');
      return new Response(
        JSON.stringify({ error: 'WhatsApp API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone
    let phoneNumber = registration.phone;
    phoneNumber = phoneNumber.replace('whatsapp:', '').replace('+', '').trim();

    const d360Response = await fetch('https://waba-v2.360dialog.io/v1/messages', {
      method: 'POST',
      headers: {
        'D360-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: { body: message },
      }),
    });

    if (!d360Response.ok) {
      const errorText = await d360Response.text();
      console.error('360Dialog error:', errorText);
      throw new Error(`360Dialog error: ${d360Response.status}`);
    }

    const d360Data = await d360Response.json();
    const messageId = d360Data?.messages?.[0]?.id || 'unknown';
    console.log('Message sent via 360Dialog:', messageId);

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
        messageId: messageId,
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
