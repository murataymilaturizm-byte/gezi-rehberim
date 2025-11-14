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

    // Rezervasyon bilgilerini al
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
          agency_name
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

    // Kullanıcı profilinden dil tercihini al
    let language = 'tr'; // Varsayılan dil
    
    const { data: userProfile } = await supabase
      .from('whatsapp_user_profiles')
      .select('language_preference')
      .eq('phone', registration.phone.replace('+', ''))
      .eq('agency_id', registration.agency_id)
      .maybeSingle();
    
    if (userProfile?.language_preference) {
      language = userProfile.language_preference;
      console.log('User language preference found:', language);
    } else {
      console.log('No user profile found, using default language:', language);
    }

    // Şablonu al
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

    console.log('Template found:', template.subject);

    // Değişkenleri doldur
    const variables: Record<string, string> = {
      full_name: registration.full_name,
      tour_name: registration.tours?.title || '',
      date: registration.tour_dates?.departure_date 
        ? new Date(registration.tour_dates.departure_date).toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : '',
      pax: registration.pax.toString(),
      total_amount: (registration.tour_dates?.price_adult * registration.pax).toLocaleString('tr-TR'),
      currency: 'TRY',
      meeting_time: registration.tours?.toplanma_saati || '09:00',
      meeting_point: registration.tours?.hareket_noktasi || 'Belirlenen toplanma noktası'
    };

    let message = template.content;
    
    // Tüm değişkenleri değiştir
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      message = message.replace(regex, variables[key]);
    });

    console.log('Message prepared:', message.substring(0, 100));

    // WhatsApp mesajı gönder (Twilio üzerinden)
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error('Twilio credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Twilio not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Telefon numarasını düzenle (başında + yoksa ekle)
    let phoneNumber = registration.phone;
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = '+' + phoneNumber;
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('From', `whatsapp:${twilioPhoneNumber}`);
    formData.append('To', `whatsapp:${phoneNumber}`);
    formData.append('Body', message);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error('Twilio error:', errorText);
      throw new Error(`Twilio error: ${twilioResponse.status}`);
    }

    const twilioData = await twilioResponse.json();
    console.log('Message sent via Twilio:', twilioData.sid);

    // Mesajı veritabanına kaydet
    await supabase
      .from('whatsapp_conversations')
      .insert({
        phone: phoneNumber.replace('whatsapp:', '').replace('+', ''),
        role: 'assistant',
        content: message,
        agency_id: registration.agency_id
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: twilioData.sid,
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
