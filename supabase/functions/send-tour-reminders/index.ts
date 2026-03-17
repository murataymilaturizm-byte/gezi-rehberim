import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppMessage, getMetaCredentials } from "../_shared/metaWhatsapp.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🕐 Tour reminder job started at:', new Date().toISOString());

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    threeDaysFromNow.setHours(0, 0, 0, 0);

    const nextDay = new Date(threeDaysFromNow);
    nextDay.setDate(nextDay.getDate() + 1);

    console.log('📅 Looking for tours between:', threeDaysFromNow.toISOString(), 'and', nextDay.toISOString());

    const { data: upcomingRegistrations, error: fetchError } = await supabase
      .from('registrations')
      .select(`
        id,
        full_name,
        phone,
        pax,
        note,
        agency_id,
        tour_dates!inner (
          id,
          departure_date,
          tours!inner (
            title,
            destination,
            hareket_noktasi,
            toplanma_saati
          )
        ),
        agencies!inner (
          id,
          whatsapp_phone_number,
          name,
          meta_phone_number_id,
          meta_access_token
        )
      `)
      .eq('reminder_sent', false)
      .gte('tour_dates.departure_date', threeDaysFromNow.toISOString().split('T')[0])
      .lt('tour_dates.departure_date', nextDay.toISOString().split('T')[0]);

    if (fetchError) {
      console.error('❌ Error fetching registrations:', fetchError);
      throw fetchError;
    }

    console.log(`📋 Found ${upcomingRegistrations?.length || 0} registrations to remind`);

    if (!upcomingRegistrations || upcomingRegistrations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No reminders to send', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sentCount = 0;
    let errorCount = 0;

    for (const registration of upcomingRegistrations) {
      try {
        const tourDate = registration.tour_dates as any;
        const tour = tourDate.tours;
        const agency = registration.agencies as any;

        // Check if reminders are enabled for this agency's plan
        const { data: agencyDetails } = await supabase
          .from('agencies')
          .select('plan_type')
          .eq('id', registration.agency_id)
          .single();

        if (agencyDetails) {
          const { data: planFeatures } = await supabase
            .from('plan_features')
            .select('has_reminders')
            .eq('plan_type', agencyDetails.plan_type)
            .single();

          if (!planFeatures?.has_reminders) {
            console.log(`⏭️ Skipping ${registration.full_name} - reminders not enabled for ${agencyDetails.plan_type} plan`);
            continue;
          }
        }

        const departureDate = new Date(tourDate.departure_date).toLocaleDateString('tr-TR', {
          day: '2-digit', month: 'long', year: 'numeric', weekday: 'long'
        });

        let message = `🔔 *TUR HATIRLATMASI*\n\n`;
        message += `Merhaba ${registration.full_name}! 👋\n\n`;
        message += `📅 *${departureDate}* tarihinde başlayacak turunuza *3 gün* kaldı!\n\n`;
        message += `🎯 *Tur:* ${tour.title}\n`;
        message += `📍 *Destinasyon:* ${tour.destination}\n`;
        message += `👥 *Kişi Sayısı:* ${registration.pax}\n\n`;

        if (tour.hareket_noktasi) {
          message += `🚌 *Hareket Noktası:* ${tour.hareket_noktasi}\n`;
        }
        if (tour.toplanma_saati) {
          message += `🕐 *Toplanma Saati:* ${tour.toplanma_saati}\n`;
        }

        message += `\n📋 *Rezervasyon No:* ${registration.id.substring(0, 8)}\n\n`;
        message += `💼 *Hazırlıklar:*\n`;
        message += `✅ Kimliğinizi yanınıza almayı unutmayın\n`;
        message += `✅ Hava durumuna göre giyinin\n`;
        message += `✅ Gerekli ilaçlarınızı yanınıza alın\n\n`;
        message += `📞 Sorularınız için bizimle iletişime geçebilirsiniz.\n\n`;
        message += `🙏 İyi yolculuklar dileriz!`;

        // Get Meta credentials
        const credentials = getMetaCredentials(agency);
        
        if (!credentials.accessToken || !credentials.phoneNumberId) {
          console.error(`❌ No Meta WhatsApp credentials for agency: ${agency.name}`);
          errorCount++;
          continue;
        }

        const result = await sendWhatsAppMessage(
          credentials.phoneNumberId,
          credentials.accessToken,
          registration.phone,
          message
        );

        if (result.success) {
          await supabase
            .from('registrations')
            .update({ reminder_sent: true, reminder_sent_at: new Date().toISOString() })
            .eq('id', registration.id);

          sentCount++;
          console.log(`✅ Reminder sent to ${registration.phone} for tour: ${tour.title}`);
        } else {
          errorCount++;
          console.error(`❌ Failed to send reminder to ${registration.phone}: ${result.error}`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing registration ${registration.id}:`, error);
      }
    }

    console.log(`✅ Reminder job completed. Sent: ${sentCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Reminders sent successfully', sent: sentCount, errors: errorCount, total: upcomingRegistrations.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Reminder job error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
