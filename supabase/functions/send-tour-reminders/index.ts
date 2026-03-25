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

        // Get customer language preference
        let customerLang = 'tr';
        const normalizedPhone = registration.phone.replace('+', '').replace(/\s/g, '');
        const { data: userProfile } = await supabase
          .from('whatsapp_user_profiles')
          .select('language_preference')
          .eq('phone', normalizedPhone)
          .eq('agency_id', registration.agency_id)
          .single();

        if (userProfile?.language_preference) {
          customerLang = userProfile.language_preference;
        }

        const message = formatReminderMessage(registration, tourDate, tour, customerLang);

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

function formatReminderMessage(registration: any, tourDate: any, tour: any, language: string): string {
  const localeMap: Record<string, string> = {
    tr: 'tr-TR', en: 'en-US', de: 'de-DE', ru: 'ru-RU', ar: 'ar-SA', fr: 'fr-FR', es: 'es-ES'
  };

  const departureDate = new Date(tourDate.departure_date).toLocaleDateString(
    localeMap[language] || 'tr-TR',
    { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' }
  );

  const reservationNo = registration.id.substring(0, 8);
  const name = registration.full_name;
  const pax = registration.pax;
  const departure = tour.hareket_noktasi;
  const meetingTime = tour.toplanma_saati;

  const templates: Record<string, () => string> = {
    tr: () => {
      let msg = `🔔 *TUR HATIRLATMASI*\n\nMerhaba ${name}! 👋\n\n📅 *${departureDate}* tarihinde başlayacak turunuza *3 gün* kaldı!\n\n🎯 *Tur:* ${tour.title}\n📍 *Destinasyon:* ${tour.destination}\n👥 *Kişi Sayısı:* ${pax}\n`;
      if (departure) msg += `\n🚌 *Hareket Noktası:* ${departure}`;
      if (meetingTime) msg += `\n🕐 *Toplanma Saati:* ${meetingTime}`;
      msg += `\n\n📋 *Rezervasyon No:* ${reservationNo}\n\n💼 *Hazırlıklar:*\n✅ Kimliğinizi yanınıza almayı unutmayın\n✅ Hava durumuna göre giyinin\n✅ Gerekli ilaçlarınızı yanınıza alın\n\n📞 Sorularınız için bizimle iletişime geçebilirsiniz.\n\n🙏 İyi yolculuklar dileriz!`;
      return msg;
    },
    en: () => {
      let msg = `🔔 *TOUR REMINDER*\n\nHello ${name}! 👋\n\n📅 Your tour starts on *${departureDate}* — only *3 days* left!\n\n🎯 *Tour:* ${tour.title_en || tour.title}\n📍 *Destination:* ${tour.destination_en || tour.destination}\n👥 *Guests:* ${pax}\n`;
      if (departure) msg += `\n🚌 *Departure Point:* ${departure}`;
      if (meetingTime) msg += `\n🕐 *Meeting Time:* ${meetingTime}`;
      msg += `\n\n📋 *Booking No:* ${reservationNo}\n\n💼 *Preparations:*\n✅ Don't forget your ID\n✅ Dress according to the weather\n✅ Bring any necessary medications\n\n📞 Contact us for any questions.\n\n🙏 Have a great trip!`;
      return msg;
    },
    de: () => {
      let msg = `🔔 *TOUR-ERINNERUNG*\n\nHallo ${name}! 👋\n\n📅 Ihre Tour beginnt am *${departureDate}* — nur noch *3 Tage*!\n\n🎯 *Tour:* ${tour.title_de || tour.title}\n📍 *Reiseziel:* ${tour.destination_de || tour.destination}\n👥 *Personen:* ${pax}\n`;
      if (departure) msg += `\n🚌 *Abfahrtsort:* ${departure}`;
      if (meetingTime) msg += `\n🕐 *Treffzeit:* ${meetingTime}`;
      msg += `\n\n📋 *Buchungs-Nr:* ${reservationNo}\n\n💼 *Vorbereitungen:*\n✅ Vergessen Sie Ihren Ausweis nicht\n✅ Kleiden Sie sich dem Wetter entsprechend\n✅ Nehmen Sie notwendige Medikamente mit\n\n📞 Kontaktieren Sie uns bei Fragen.\n\n🙏 Gute Reise!`;
      return msg;
    },
    ru: () => {
      let msg = `🔔 *НАПОМИНАНИЕ О ТУРЕ*\n\nЗдравствуйте, ${name}! 👋\n\n📅 Ваш тур начинается *${departureDate}* — осталось *3 дня*!\n\n🎯 *Тур:* ${tour.title_ru || tour.title}\n📍 *Направление:* ${tour.destination_ru || tour.destination}\n👥 *Гостей:* ${pax}\n`;
      if (departure) msg += `\n🚌 *Место отправления:* ${departure}`;
      if (meetingTime) msg += `\n🕐 *Время сбора:* ${meetingTime}`;
      msg += `\n\n📋 *Номер бронирования:* ${reservationNo}\n\n💼 *Подготовка:*\n✅ Не забудьте документы\n✅ Одевайтесь по погоде\n✅ Возьмите необходимые лекарства\n\n📞 Свяжитесь с нами при вопросах.\n\n🙏 Приятного путешествия!`;
      return msg;
    },
    ar: () => {
      let msg = `🔔 *تذكير بالجولة*\n\nمرحباً ${name}! 👋\n\n📅 جولتك تبدأ في *${departureDate}* — بقي *3 أيام* فقط!\n\n🎯 *الجولة:* ${tour.title_ar || tour.title}\n📍 *الوجهة:* ${tour.destination_ar || tour.destination}\n👥 *عدد الأشخاص:* ${pax}\n`;
      if (departure) msg += `\n🚌 *نقطة الانطلاق:* ${departure}`;
      if (meetingTime) msg += `\n🕐 *وقت التجمع:* ${meetingTime}`;
      msg += `\n\n📋 *رقم الحجز:* ${reservationNo}\n\n💼 *التحضيرات:*\n✅ لا تنسَ هويتك\n✅ ارتدِ ملابس مناسبة للطقس\n✅ أحضر أدويتك الضرورية\n\n📞 تواصل معنا لأي استفسار.\n\n🙏 رحلة سعيدة!`;
      return msg;
    },
    fr: () => {
      let msg = `🔔 *RAPPEL DE TOUR*\n\nBonjour ${name}! 👋\n\n📅 Votre tour commence le *${departureDate}* — plus que *3 jours*!\n\n🎯 *Tour:* ${tour.title_fr || tour.title}\n📍 *Destination:* ${tour.destination_fr || tour.destination}\n👥 *Personnes:* ${pax}\n`;
      if (departure) msg += `\n🚌 *Point de départ:* ${departure}`;
      if (meetingTime) msg += `\n🕐 *Heure de rendez-vous:* ${meetingTime}`;
      msg += `\n\n📋 *N° de réservation:* ${reservationNo}\n\n💼 *Préparatifs:*\n✅ N'oubliez pas votre pièce d'identité\n✅ Habillez-vous selon la météo\n✅ Apportez vos médicaments nécessaires\n\n📞 Contactez-nous pour toute question.\n\n🙏 Bon voyage!`;
      return msg;
    },
    es: () => {
      let msg = `🔔 *RECORDATORIO DE TOUR*\n\nHola ${name}! 👋\n\n📅 Tu tour comienza el *${departureDate}* — ¡solo quedan *3 días*!\n\n🎯 *Tour:* ${tour.title_es || tour.title}\n📍 *Destino:* ${tour.destination_es || tour.destination}\n👥 *Personas:* ${pax}\n`;
      if (departure) msg += `\n🚌 *Punto de salida:* ${departure}`;
      if (meetingTime) msg += `\n🕐 *Hora de encuentro:* ${meetingTime}`;
      msg += `\n\n📋 *N° de reserva:* ${reservationNo}\n\n💼 *Preparativos:*\n✅ No olvides tu identificación\n✅ Vístete según el clima\n✅ Lleva tus medicamentos necesarios\n\n📞 Contáctanos para cualquier pregunta.\n\n🙏 ¡Buen viaje!`;
      return msg;
    },
  };

  const formatter = templates[language] || templates.tr;
  return formatter();
}
