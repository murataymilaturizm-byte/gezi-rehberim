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

    console.log('Starting follow-up messages task...');

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: potentialCustomers, error: profileError } = await supabase
      .from('whatsapp_user_profiles')
      .select('*')
      .eq('total_bookings', 0)
      .gte('total_messages', 2)
      .gte('last_interaction_at', sevenDaysAgo.toISOString())
      .lte('last_interaction_at', threeDaysAgo.toISOString())
      .contains('tags', ['potential']);

    if (profileError) {
      console.error('Error fetching potential customers:', profileError);
      throw profileError;
    }

    console.log(`Found ${potentialCustomers?.length || 0} potential customers`);

    let sentCount = 0;

    for (const customer of potentialCustomers || []) {
      if (customer.last_follow_up_sent_at) {
        const lastSent = new Date(customer.last_follow_up_sent_at);
        const daysSince = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) {
          console.log(`Skipping ${customer.phone} - follow-up sent ${daysSince.toFixed(1)} days ago`);
          continue;
        }
      }

      const { data: agency } = await supabase
        .from('agencies')
        .select('id, name, plan_type, whatsapp_api_key')
        .eq('id', customer.agency_id)
        .single();

      if (!agency) continue;

      const { data: planFeatures } = await supabase
        .from('plan_features')
        .select('has_follow_ups')
        .eq('plan_type', agency.plan_type)
        .single();

      if (!planFeatures?.has_follow_ups) {
        console.log(`Skipping ${customer.phone} - follow-ups not enabled for ${agency.plan_type} plan`);
        continue;
      }

      const followUpMessage = await formatFollowUpMessage(
        customer.full_name,
        customer.preferred_destinations,
        customer.last_search_query,
        customer.language_preference || 'tr',
        agency.name
      );

      const sent = await sendWhatsAppMessage(
        customer.phone,
        followUpMessage,
        agency.whatsapp_api_key
      );

      if (sent) {
        await supabase
          .from('whatsapp_user_profiles')
          .update({ last_follow_up_sent_at: new Date().toISOString() })
          .eq('id', customer.id);

        sentCount++;
        console.log(`✓ Follow-up sent to ${customer.phone}`);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`✓ Follow-up messages task completed. Sent ${sentCount} messages.`);

    return new Response(
      JSON.stringify({ success: true, customersProcessed: potentialCustomers?.length || 0, messagesSent: sentCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in send-follow-up-messages function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function formatFollowUpMessage(
  customerName: string | null,
  preferredDestinations: string[] | null,
  lastSearchQuery: string | null,
  language: string,
  agencyName: string
): Promise<string> {
  const name = customerName || '';
  const destinations = preferredDestinations?.join(', ') || '';
  const lastSearch = lastSearchQuery || '';

  const messages: Record<string, () => string> = {
    tr: () => {
      let message = `Merhaba${name ? ' ' + name : ''}! 👋\n\n`;
      message += `${agencyName} olarak size yardımcı olmak için buradayız! `;
      if (destinations) {
        message += `${destinations} bölgesi için harika turlarımız var. `;
      } else if (lastSearch) {
        message += `Daha önce "${lastSearch}" konusunda bilgi almıştınız. `;
      }
      message += `\n\n✨ Size özel fırsatlarımız hakkında konuşmak ister misiniz?\n\n`;
      message += `📱 Herhangi bir sorunuz varsa çekinmeden yazabilirsiniz. Size yardımcı olmaktan mutluluk duyarız! 😊`;
      return message;
    },
    en: () => {
      let message = `Hello${name ? ' ' + name : ''}! 👋\n\n`;
      message += `We're here to help you at ${agencyName}! `;
      if (destinations) { message += `We have great tours to ${destinations}. `; }
      else if (lastSearch) { message += `You previously inquired about "${lastSearch}". `; }
      message += `\n\n✨ Would you like to discuss our special offers for you?\n\n`;
      message += `📱 Feel free to reach out if you have any questions. We'd be happy to help! 😊`;
      return message;
    },
    de: () => {
      let message = `Hallo${name ? ' ' + name : ''}! 👋\n\n`;
      message += `Wir sind bei ${agencyName} für Sie da! `;
      if (destinations) { message += `Wir haben tolle Touren nach ${destinations}. `; }
      else if (lastSearch) { message += `Sie haben sich zuvor nach "${lastSearch}" erkundigt. `; }
      message += `\n\n✨ Möchten Sie über unsere speziellen Angebote für Sie sprechen?\n\n`;
      message += `📱 Zögern Sie nicht, uns bei Fragen zu kontaktieren. Wir helfen Ihnen gerne! 😊`;
      return message;
    },
    ru: () => {
      let message = `Здравствуйте${name ? ', ' + name : ''}! 👋\n\n`;
      message += `Мы в ${agencyName} здесь, чтобы помочь вам! `;
      if (destinations) { message += `У нас есть отличные туры в ${destinations}. `; }
      else if (lastSearch) { message += `Вы ранее интересовались "${lastSearch}". `; }
      message += `\n\n✨ Хотите обсудить наши специальные предложения для вас?\n\n`;
      message += `📱 Не стесняйтесь обращаться, если у вас есть вопросы. Мы будем рады помочь! 😊`;
      return message;
    },
    ar: () => {
      let message = `مرحباً${name ? ' ' + name : ''}! 👋\n\n`;
      message += `نحن هنا لمساعدتك في ${agencyName}! `;
      if (destinations) { message += `لدينا جولات رائعة إلى ${destinations}. `; }
      else if (lastSearch) { message += `لقد استفسرت سابقاً عن "${lastSearch}". `; }
      message += `\n\n✨ هل ترغب في مناقشة عروضنا الخاصة لك؟\n\n`;
      message += `📱 لا تتردد في التواصل إذا كان لديك أي أسئلة. سنكون سعداء بالمساعدة! 😊`;
      return message;
    },
    fr: () => {
      let message = `Bonjour${name ? ' ' + name : ''}! 👋\n\n`;
      message += `Nous sommes là pour vous aider chez ${agencyName}! `;
      if (destinations) { message += `Nous avons de superbes circuits vers ${destinations}. `; }
      else if (lastSearch) { message += `Vous vous êtes renseigné sur "${lastSearch}" auparavant. `; }
      message += `\n\n✨ Souhaitez-vous discuter de nos offres spéciales pour vous?\n\n`;
      message += `📱 N'hésitez pas à nous contacter si vous avez des questions. Nous serons ravis de vous aider! 😊`;
      return message;
    },
    es: () => {
      let message = `¡Hola${name ? ' ' + name : ''}! 👋\n\n`;
      message += `¡Estamos aquí para ayudarte en ${agencyName}! `;
      if (destinations) { message += `Tenemos excelentes tours a ${destinations}. `; }
      else if (lastSearch) { message += `Anteriormente preguntaste sobre "${lastSearch}". `; }
      message += `\n\n✨ ¿Te gustaría hablar sobre nuestras ofertas especiales para ti?\n\n`;
      message += `📱 No dudes en contactarnos si tienes alguna pregunta. ¡Estaremos encantados de ayudarte! 😊`;
      return message;
    }
  };

  const messageFunc = messages[language] || messages.tr;
  return messageFunc();
}

async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string,
  apiKey: string | null
): Promise<boolean> {
  if (!apiKey) {
    console.error('❌ No WhatsApp API key provided');
    return false;
  }

  const normalizedTo = phoneNumber.replace('whatsapp:', '').replace('+', '').trim();

  try {
    const response = await fetch('https://waba-v2.360dialog.io/v1/messages', {
      method: 'POST',
      headers: {
        'D360-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizedTo,
        type: 'text',
        text: { body: message },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}
