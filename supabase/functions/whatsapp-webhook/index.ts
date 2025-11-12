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

    // Twilio sends data as application/x-www-form-urlencoded
    const contentType = req.headers.get('content-type') || '';
    let body: any = {};
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    } else {
      body = await req.json();
    }
    
    console.log('WhatsApp webhook received:', body);

    // Twilio WhatsApp formatı desteği
    const userMessage = body.Body || body.message || '';
    const from = body.From || body.from || '';

    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'No message provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Telefon numarasından whatsapp: prefix'ini temizle
    const userPhone = from.replace('whatsapp:', '');
    
    // Kullanıcı mesajını kaydet
    await saveMessage(supabase, userPhone, 'user', userMessage);

    // Önce AI ile mesajı kategorize et
    const intent = await categorizeMessage(userMessage);
    console.log('Categorized intent:', intent);

    if (intent.type === 'registration.create') {
      // Kayıt oluştur
      const registration = await createRegistration(supabase, intent.data, from);
      
      const message = registration.error 
        ? `❌ Kayıt oluşturulamadı: ${registration.error}`
        : (registration.message || 'Kayıt oluşturuldu');
      
      // Bot cevabını kaydet
      await saveMessage(supabase, userPhone, 'assistant', message);
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`;
      
      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    } else if (intent.type === 'registration.request') {
      const message = '💚 *Kayıt Olmak İstiyorsunuz - Harika!*\n\n📝 Aşağıdaki bilgileri bana gönderirseniz hemen işleme alalım:\n\n📋 *Format:*\n`Kayıt: [Tur Adı] [Tarih] [Ad Soyad] [Telefon] [Kişi Sayısı] kişi`\n\n💡 *Örnek:*\n`Kayıt: Kapadokya Turu 15.05.2026 Ahmet Yılmaz 05551234567 2 kişi`\n\n✨ Tur adı ve tarihini yukarıdaki tur listesinden görebilirsiniz!\n\n🤝 Yardıma ihtiyacınız olursa çekinmeyin!';
      
      // Bot cevabını kaydet
      await saveMessage(supabase, userPhone, 'assistant', message);
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`;
      
      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    } else if (intent.type === 'tour.search') {
      // AI ile akıllı arama
      const tours = await searchToursWithAI(supabase, userMessage, userPhone);
      
      // WhatsApp formatında cevap oluştur
      const message = formatWhatsAppResponse(tours, {});
      
      // Bot cevabını kaydet
      await saveMessage(supabase, userPhone, 'assistant', message);
      
      // Twilio TwiML response
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`;
      
      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    } else {
      // Genel sohbet - AI ile cevap ver
      const chatResponse = await handleGeneralChat(userMessage, userPhone, supabase);
      
      // Bot cevabını kaydet
      await saveMessage(supabase, userPhone, 'assistant', chatResponse);
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${chatResponse.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`;
      
      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function categorizeMessage(userMessage: string) {
  const lowerText = userMessage.toLowerCase();
  
  // Kayıt formatı kontrolü - "kayıt" kelimesi opsiyonel, tur adı ve tarih ile
  // Pattern: [kayıt:] [tur adı] [tarih DD.MM.YYYY] [ad soyad] [telefon] [sayı] kişi
  const registrationMatch = userMessage.match(/(?:kayıt[:\s]+)?(.+?)\s+(\d{2}[.\/-]\d{2}[.\/-]\d{4})\s+(.+?)\s+((?:\+90|0)[\d\s]+)\s+(\d+)\s*kişi/i);
  if (registrationMatch) {
    // Tur adından "günübirlik", "tur" gibi kelimeleri temizle
    let tourName = registrationMatch[1].trim();
    tourName = tourName.replace(/\s+(günübirlik|tur|turu|turları)\s*$/gi, '').trim();
    
    return {
      type: 'registration.create',
      data: {
        tour_name: tourName,
        tour_date: registrationMatch[2].trim(),
        full_name: registrationMatch[3].trim(),
        phone: registrationMatch[4].replace(/\s+/g, ''),
        pax: parseInt(registrationMatch[5])
      }
    };
  }
  
  // Kayıt isteği kontrolü
  if (lowerText.includes('kayıt') || lowerText.includes('rezervasyon')) {
    return { type: 'registration.request', data: {} };
  }
  
  // AI ile mesajı kategorize et
  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `Sen bir mesaj kategorize asistanısın. Kullanıcının mesajına bakıp hangi kategoriye ait olduğunu belirle:

1. "tour.search" - Kullanıcı tur/gezi/tatil arıyorsa (Kapadokya, Efes, Pamukkale, vb. destinasyonlar söz konusuysa)
2. "general.chat" - Normal sohbet, selamlaşma, teşekkür, genel sorular

Sadece "tour.search" veya "general.chat" şeklinde cevap ver, başka bir şey yazma.`
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      temperature: 0.1
    })
  });

  const result = await aiResponse.json();
  const category = result.choices[0].message.content.trim();
  
  return { 
    type: category === 'tour.search' ? 'tour.search' : 'general.chat',
    data: {}
  };
}

async function handleGeneralChat(userMessage: string, userPhone: string, supabase: any) {
  // Konuşma geçmişini al (son 10 mesaj)
  const history = await getConversationHistory(supabase, userPhone, 10);
  
  const messages = [
    {
      role: 'system',
      content: `Sen bir tur şirketinin samimi ve yardımsever WhatsApp asistanısın. 
Kullanıcıyla doğal Türkçe konuş, sıcak ve dostane davran.
Tur şirketimiz Kapadokya, Efes, Pamukkale, Antalya gibi destinasyonlara turlar düzenliyor.
Kısa ve öz cevaplar ver (max 2-3 cümle).

ÖNEMLİ: Eğer konuşma geçmişi varsa (kullanıcıyla daha önce konuşmuşsanız), tekrar "Merhaba" veya "Merhabalar" deme. Sadece soruyu direkt yanıtla. Selamlaşma sadece ilk mesajda olmalı.`
    },
    ...history,
    {
      role: 'user',
      content: userMessage
    }
  ];

  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: messages,
      temperature: 0.7
    })
  });

  const result = await aiResponse.json();
  return result.choices[0].message.content;
}


async function searchToursWithAI(supabase: any, userMessage: string, userPhone: string) {
  // Önce tüm turları al
  const { data: allTours, error } = await supabase
    .from("tours")
    .select(`
      id,
      title,
      destination,
      type,
      currency,
      program_url,
      program_kisa,
      hareket_noktasi,
      toplanma_saati,
      tur_sure,
      konaklama,
      ulasim,
      tur_kategorisi,
      gezilecek_yerler,
      tour_dates (
        id,
        departure_date,
        return_date,
        price_adult,
        quota
      )
    `);

  if (error) throw error;

  // Turları AI için formatlayalım
  const toursList = (allTours || []).map((tour: any) => ({
    id: tour.id,
    title: tour.title,
    destination: tour.destination,
    type: tour.type,
    description: tour.program_kisa || '',
    places: tour.gezilecek_yerler || ''
  }));

  // Konuşma geçmişini al (son 5 mesaj)
  const history = await getConversationHistory(supabase, userPhone, 5);

  const messages = [
    {
      role: 'system',
      content: `Sen bir tur arama asistanısın. Kullanıcının mesajını ve önceki konuşma geçmişini analiz edip hangi turları aradığını belirle.
Turlar: ${JSON.stringify(toursList, null, 2)}

Kullanıcının mesajından:
- Hangi destinasyonu aradığını (Kapadokya, Efes, Pamukkale, vb)
- Hangi tür turu aradığını (günübirlik, 2 gece, 3 gece)
- Hangi tarihi aradığını (varsa)

Eşleşen turların ID'lerini JSON array olarak döndür. SADECE JSON array döndür, başka hiçbir şey yazma.
Örnek: ["id1", "id2"]
Eğer hiçbir tur eşleşmezse boş array döndür: []

ÖNEMLİ: Sadece JSON array döndür, markdown formatı kullanma!`
    },
    ...history,
    {
      role: 'user',
      content: userMessage
    }
  ];

  // AI'dan yardım iste
  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: messages,
      temperature: 0.3
    })
  });

  const aiResult = await aiResponse.json();
  let content = aiResult.choices[0].message.content.trim();
  
  // AI bazen ```json wrapper'ı ile dönebilir, onu temizle
  if (content.startsWith('```json')) {
    content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (content.startsWith('```')) {
    content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  const matchedIds = JSON.parse(content);

  // Eşleşen turları filtrele ve tarihlerini düzenle
  const matchedTours = (allTours || [])
    .filter((tour: any) => matchedIds.includes(tour.id))
    .map((tour: any) => ({
      ...tour,
      dates: (tour.tour_dates || [])
        .sort((a: any, b: any) => 
          new Date(a.departure_date).getTime() - new Date(b.departure_date).getTime()
        )
    }));

  return matchedTours;
}

async function createRegistration(supabase: any, entities: any, from: string) {
  try {
    // Tur adı ve tarihe göre tur tarihini bul
    const tourDateStr = entities.tour_date.replace(/[.\/-]/g, '-');
    const dateParts = tourDateStr.split('-');
    const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`; // YYYY-MM-DD formatına çevir
    
    const { data: tourDate, error: tourDateError } = await supabase
      .from('tour_dates')
      .select('id, departure_date, tour_id, tours(title, destination)')
      .eq('departure_date', formattedDate)
      .ilike('tours.title', `%${entities.tour_name}%`)
      .single();

    if (tourDateError || !tourDate) {
      return { error: 'Tur bulunamadı. Lütfen tur adı ve tarihini kontrol edin.' };
    }

    // Kayıt oluştur
    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .insert({
        tour_id: tourDate.tour_id,
        tour_date_id: tourDate.id,
        full_name: entities.full_name,
        phone: entities.phone,
        pax: entities.pax,
        status: 'NEW',
        note: `WhatsApp kayıt: ${from}`
      })
      .select()
      .single();

    if (regError) {
      console.error('Registration error:', regError);
      return { error: 'Kayıt oluşturulamadı. Lütfen bilgilerinizi kontrol edip tekrar deneyin.' };
    }

    const message = `✅ *Kayıt Başarılı!*\n\n` +
      `📋 Kayıt No: ${registration.id.substring(0, 8)}\n` +
      `🎯 Tur: ${tourDate.tours.title}\n` +
      `📍 ${tourDate.tours.destination}\n` +
      `📅 ${tourDate.departure_date}\n` +
      `👤 ${entities.full_name}\n` +
      `📱 ${entities.phone}\n` +
      `👥 ${entities.pax} kişi\n\n` +
      `✨ Ön kaydınız başarıyla oluşturuldu!\n` +
      `📞 Kısa süre içinde sizinle iletişime geçeceğiz.`;

    // WhatsApp onay mesajı gönder (arka planda)
    const userPhone = from.replace('whatsapp:', '');
    sendWhatsAppMessage(userPhone, message).catch(err => {
      console.error('WhatsApp mesajı gönderilemedi:', err);
    });

    return { message };
  } catch (error) {
    console.error('Create registration error:', error);
    return { error: 'Beklenmeyen bir hata oluştu.' };
  }
}

async function sendWhatsAppMessage(to: string, message: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !twilioPhone) {
    console.error('Twilio credentials eksik');
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  
  const auth = btoa(`${accountSid}:${authToken}`);
  
  const body = new URLSearchParams({
    From: `whatsapp:${twilioPhone}`,
    To: `whatsapp:${to}`,
    Body: message
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Twilio API hatası:', error);
    } else {
      console.log('WhatsApp mesajı başarıyla gönderildi');
    }
  } catch (error) {
    console.error('WhatsApp mesajı gönderilirken hata:', error);
  }
}

function formatWhatsAppResponse(tours: any[], entities: any) {
  if (tours.length === 0) {
    return '😊 Aradığınız kriterlere uygun tur şu anda bulunmuyor.\n\n💡 Farklı bir tarih veya destinasyon deneyelim mi?\n\n📞 İsterseniz bize ulaşın, size özel tur planlaması yapabiliriz!';
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  let response = `🎉 *Harika! ${tours.length} Muhteşem Tur Buldum!*\n\n`;

  tours.slice(0, 3).forEach((tour, index) => {
    response += `${index + 1}️⃣ *${tour.title}*\n`;
    response += `📍 ${tour.destination}\n`;
    if (tour.program_kisa) {
      response += `✨ ${tour.program_kisa}\n`;
    }
    
    // Tarihi varsa göster
    if (tour.dates.length > 0) {
      const firstDate = tour.dates[0];
      const formattedDate = new Date(firstDate.departure_date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      response += `📅 ${formattedDate}${firstDate.return_date && firstDate.return_date !== firstDate.departure_date ? ' → ' + new Date(firstDate.return_date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}\n`;
      if (tour.tur_sure) {
        response += `⏱️ ${tour.tur_sure}\n`;
      }
      response += `💰 ${formatPrice(firstDate.price_adult)} ${tour.currency} /kişi\n`;
      response += `👥 ${firstDate.quota > 0 ? firstDate.quota + ' kontenjan' : 'Kontenjan doldu'}\n`;
    } else {
      response += `⚠️ Tarih henüz planlanmadı\n`;
      response += `📞 Detaylı bilgi için iletişime geçin\n`;
    }
    
    if (tour.gezilecek_yerler) {
      response += `🗺️ ${tour.gezilecek_yerler}\n`;
    }
    if (tour.program_url) {
      response += `📄 ${tour.program_url}\n`;
    }
    response += '\n';
  });

  if (tours.length > 3) {
    response += `✨ _... ve ${tours.length - 3} harika tur daha!_\n\n`;
  }

  response += '💚 *Kayıt olmak ister misiniz?*\n"Kayıt olmak istiyorum" yazın, hemen yardımcı olalım!';

  return response;
}

// Mesajı veritabanına kaydet
async function saveMessage(supabase: any, phone: string, role: string, content: string) {
  try {
    await supabase
      .from('whatsapp_conversations')
      .insert({
        phone,
        role,
        content
      });
  } catch (error) {
    console.error('Error saving message:', error);
  }
}

// Konuşma geçmişini al
async function getConversationHistory(supabase: any, phone: string, limit: number = 10) {
  try {
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('role, content')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching conversation history:', error);
      return [];
    }

    // Mesajları tersine çevir (en eskiden en yeniye)
    return (data || []).reverse().map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));
  } catch (error) {
    console.error('Error in getConversationHistory:', error);
    return [];
  }
}
