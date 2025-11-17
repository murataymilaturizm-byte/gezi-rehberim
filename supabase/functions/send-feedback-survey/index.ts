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

    console.log('Starting feedback survey task...');

    // Dün biten turları bul
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: completedTourDates, error: tourError } = await supabase
      .from('tour_dates')
      .select(`
        id,
        tour_id,
        departure_date,
        tours!inner (
          title,
          agency_id
        )
      `)
      .gte('departure_date', yesterday.toISOString())
      .lt('departure_date', today.toISOString());

    if (tourError) {
      console.error('Error fetching completed tours:', tourError);
      throw tourError;
    }

    console.log(`Found ${completedTourDates?.length || 0} completed tours`);

    let sentCount = 0;

    // Her tamamlanan tur için
    for (const tourDate of completedTourDates || []) {
      // Bu tura katılan onaylanmış rezervasyonları bul
      const { data: registrations, error: regError } = await supabase
        .from('registrations')
        .select('phone, full_name')
        .eq('tour_date_id', tourDate.id)
        .eq('status', 'CONFIRMED');

      if (regError) {
        console.error('Error fetching registrations:', regError);
        continue;
      }

      const tour = Array.isArray(tourDate.tours) ? tourDate.tours[0] : tourDate.tours;
      console.log(`Tour ${tour.title}: ${registrations?.length || 0} participants`);

      // Check if feedback surveys are enabled for this agency's plan
      const { data: agency } = await supabase
        .from('agencies')
        .select('plan_type')
        .eq('id', tour.agency_id)
        .single();

      if (agency) {
        const { data: planFeatures } = await supabase
          .from('plan_features')
          .select('has_feedback')
          .eq('plan_type', agency.plan_type)
          .single();

        if (!planFeatures?.has_feedback) {
          console.log(`Skipping tour ${tour.title} - feedback not enabled for ${agency.plan_type} plan`);
          continue;
        }
      }

      // Her katılımcıya anket gönder
      for (const registration of registrations || []) {
        // Kullanıcı profilini kontrol et
        const { data: userProfile } = await supabase
          .from('whatsapp_user_profiles')
          .select('id, phone, language_preference, last_feedback_sent_at')
          .eq('phone', registration.phone.replace('+', ''))
          .eq('agency_id', tour.agency_id)
          .single();

        if (!userProfile) continue;

        // Son 7 gün içinde anket gönderdiyse atla
        if (userProfile.last_feedback_sent_at) {
          const lastSent = new Date(userProfile.last_feedback_sent_at);
          const daysSince = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince < 7) {
            console.log(`Skipping ${registration.phone} - survey sent ${daysSince.toFixed(1)} days ago`);
            continue;
          }
        }

        // Anket mesajını hazırla
        const surveyMessage = await formatSurveyMessage(
          registration.full_name,
          tour.title,
          userProfile.language_preference || 'tr'
        );

        // WhatsApp mesajı gönder
        const sent = await sendWhatsAppMessage(
          tour.agency_id,
          registration.phone,
          surveyMessage
        );

        if (sent) {
          // Gönderim kaydını güncelle
          await supabase
            .from('whatsapp_user_profiles')
            .update({ last_feedback_sent_at: new Date().toISOString() })
            .eq('id', userProfile.id);

          sentCount++;
          console.log(`✓ Survey sent to ${registration.phone}`);
        }

        // Rate limiting - 1 saniye bekle
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`✓ Feedback survey task completed. Sent ${sentCount} surveys.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        toursProcessed: completedTourDates?.length || 0,
        surveysSent: sentCount 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in send-feedback-survey function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

async function formatSurveyMessage(
  customerName: string,
  tourTitle: string,
  language: string
): Promise<string> {
  const messages: Record<string, string> = {
    tr: `Merhaba ${customerName}! 👋

${tourTitle} turumuza katıldığınız için teşekkür ederiz! ✨

Deneyiminizi bizimle paylaşır mısınız?

*1-5 arası puan verin:*
1️⃣ Çok Kötü
2️⃣ Kötü  
3️⃣ Orta
4️⃣ İyi
5️⃣ Mükemmel

Sadece numarayı yazmanız yeterli. İsterseniz detaylı görüşlerinizi de ekleyebilirsiniz! 😊`,

    en: `Hello ${customerName}! 👋

Thank you for joining our ${tourTitle} tour! ✨

Would you share your experience with us?

*Rate from 1-5:*
1️⃣ Very Bad
2️⃣ Bad
3️⃣ Average
4️⃣ Good
5️⃣ Excellent

Just write the number. You can also add detailed feedback if you wish! 😊`,

    de: `Hallo ${customerName}! 👋

Vielen Dank für Ihre Teilnahme an unserer ${tourTitle} Tour! ✨

Würden Sie Ihre Erfahrung mit uns teilen?

*Bewerten Sie von 1-5:*
1️⃣ Sehr schlecht
2️⃣ Schlecht
3️⃣ Durchschnittlich
4️⃣ Gut
5️⃣ Ausgezeichnet

Schreiben Sie einfach die Nummer. Sie können auch detailliertes Feedback hinzufügen! 😊`,

    ru: `Здравствуйте, ${customerName}! 👋

Спасибо за участие в нашем туре ${tourTitle}! ✨

Не могли бы вы поделиться своим опытом?

*Оцените от 1 до 5:*
1️⃣ Очень плохо
2️⃣ Плохо
3️⃣ Средне
4️⃣ Хорошо
5️⃣ Отлично

Просто напишите номер. При желании можете добавить подробный отзыв! 😊`,

    ar: `مرحبا ${customerName}! 👋

شكراً لانضمامك إلى جولتنا ${tourTitle}! ✨

هل يمكنك مشاركة تجربتك معنا؟

*قيّم من 1-5:*
1️⃣ سيء جداً
2️⃣ سيء
3️⃣ متوسط
4️⃣ جيد
5️⃣ ممتاز

فقط اكتب الرقم. يمكنك أيضاً إضافة تعليقات مفصلة! 😊`,

    fr: `Bonjour ${customerName}! 👋

Merci d'avoir participé à notre tour ${tourTitle}! ✨

Pourriez-vous partager votre expérience avec nous?

*Notez de 1 à 5:*
1️⃣ Très mauvais
2️⃣ Mauvais
3️⃣ Moyen
4️⃣ Bon
5️⃣ Excellent

Il suffit d'écrire le numéro. Vous pouvez également ajouter des commentaires détaillés! 😊`,

    es: `¡Hola ${customerName}! 👋

¡Gracias por unirte a nuestro tour ${tourTitle}! ✨

¿Podrías compartir tu experiencia con nosotros?

*Califica del 1 al 5:*
1️⃣ Muy malo
2️⃣ Malo
3️⃣ Regular
4️⃣ Bueno
5️⃣ Excelente

Solo escribe el número. ¡También puedes agregar comentarios detallados! 😊`
  };

  return messages[language] || messages.tr;
}

async function sendWhatsAppMessage(
  agencyId: string,
  phoneNumber: string,
  message: string
): Promise<boolean> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get agency Twilio credentials
    const { data: agency } = await supabase
      .from('agencies')
      .select('twilio_account_sid, twilio_auth_token, whatsapp_phone_number')
      .eq('id', agencyId)
      .single();

    if (!agency) return false;

    // Send via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${agency.twilio_account_sid}/Messages.json`;
    const auth = btoa(`${agency.twilio_account_sid}:${agency.twilio_auth_token}`);

    const formData = new URLSearchParams();
    formData.append('From', `whatsapp:${agency.whatsapp_phone_number}`);
    formData.append('To', `whatsapp:${phoneNumber}`);
    formData.append('Body', message);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}