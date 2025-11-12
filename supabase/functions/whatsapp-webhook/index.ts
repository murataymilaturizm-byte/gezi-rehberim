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

    // Mesajı ayrıştır
    const parsed = parseMessage(userMessage);
    console.log('Parsed intent:', parsed);

    if (parsed.intent === 'tour.search') {
      // Turları ara
      const tours = await searchTours(supabase, parsed.entities);
      
      // WhatsApp formatında cevap oluştur
      const message = formatWhatsAppResponse(tours, parsed.entities);
      
      // Twilio TwiML response
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`;
      
      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    } else if (parsed.intent === 'registration.create') {
      // Kayıt oluştur
      const registration = await createRegistration(supabase, parsed.entities, from);
      
    const message = registration.error 
      ? `❌ Kayıt oluşturulamadı: ${registration.error}`
      : (registration.message || 'Kayıt oluşturuldu');
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`;
      
      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    } else if (parsed.intent === 'registration.request') {
      const message = '📝 *Kayıt Formu*\n\nÖn kayıt oluşturmak için aşağıdaki formatı kullanın:\n\n`Kayıt: [Tur Tarih ID] [Ad Soyad] [Telefon] [Kişi Sayısı] kişi`\n\n*Örnek:*\n`Kayıt: 5eda4e1e-b791-4365-a7ae-f36acbd186da Ahmet Yılmaz 05551234567 2 kişi`\n\n💡 Tur tarih ID\'sini yukarıdaki tur listesinden alabilirsiniz.';
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`;
      
      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    } else {
      const message = 'Merhaba! 👋 Size nasıl yardımcı olabilirim?\n\n🔍 Tur aramak için:\n"Günübirlik Kapadokya 20 Temmuz"\n\n📝 Kayıt olmak için:\n"Kayıt olmak istiyorum"';
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message}</Message>
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

function parseMessage(text: string) {
  const lowerText = text.toLowerCase();
  
  // Kayıt niyeti kontrolü
  if (lowerText.includes("kayıt") || lowerText.includes("rezervasyon") || lowerText.includes("ön kayıt")) {
    // Kayıt formatı: "Kayıt: [Tur ID] [Ad Soyad] [Telefon] [Kişi]"
    const registrationMatch = text.match(/kayıt[:\s]+([a-f0-9-]+)\s+(.+?)\s+(\+?[\d\s-]+)\s+(\d+)\s*kişi/i);
    if (registrationMatch) {
      return {
        intent: "registration.create",
        entities: {
          tour_date_id: registrationMatch[1],
          full_name: registrationMatch[2].trim(),
          phone: registrationMatch[3].replace(/\s+/g, ''),
          pax: parseInt(registrationMatch[4])
        }
      };
    }
    
    // Basit kayıt isteği
    return {
      intent: "registration.request",
      entities: {}
    };
  }

  // Gereksiz kelimeleri temizle
  const stopWords = ['tur', 'turu', 'turları', 'var', 'varmı', 'var mı', 'mi', 'mı', 'mu', 'mü', 'ne', 'zaman', 'için', 'ile', 'bir', 'bu', 'şu', 'o', 'da', 'de', 'ta', 'te', 'den', 'dan', 'ten', 'tan', 'ya', 'ye', 'olmak', 'istiyorum', 'ister', 'misiniz'];
  let cleanedText = lowerText;
  stopWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    cleanedText = cleanedText.replace(regex, ' ');
  });
  
  // Türkçe ekleri temizle (basit hali)
  cleanedText = cleanedText
    .replace(/([a-zşçğüöı]+)(e|a|i|ı|u|ü|ler|lar|de|da|den|dan|te|ta|ten|tan|ye|ya|nın|nin|nun|nün|nı|ni|nu|nü|sı|si|su|sü)(\s|$)/gi, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();

  const result: any = {
    intent: "tour.search",
    entities: {
      searchTerm: cleanedText, // Temizlenmiş kelimeler
      type: null,
      date_iso: null,
      pax: null
    }
  };

  // Tur tipi
  if (lowerText.includes("günübirlik") || lowerText.includes("günü birlik")) {
    result.entities.type = "DAYTRIP";
  } else if (lowerText.includes("2 gece") || lowerText.includes("iki gece")) {
    result.entities.type = "N2";
  } else if (lowerText.includes("3 gece") || lowerText.includes("üç gece")) {
    result.entities.type = "N3";
  }

  // Tarih
  const months: Record<string, string> = {
    "ocak": "01", "şubat": "02", "mart": "03", "nisan": "04",
    "mayıs": "05", "haziran": "06", "temmuz": "07", "ağustos": "08",
    "eylül": "09", "ekim": "10", "kasım": "11", "aralık": "12"
  };

  for (const [monthName, monthNum] of Object.entries(months)) {
    if (lowerText.includes(monthName)) {
      const dayMatch = lowerText.match(/(\d{1,2})\s+/);
      if (dayMatch) {
        const day = dayMatch[1].padStart(2, '0');
        result.entities.date_iso = `2026-${monthNum}-${day}`;
      }
    }
  }

  // Kişi sayısı
  const paxMatch = lowerText.match(/(\d+)\s*(kişi|kişilik)/);
  if (paxMatch) {
    result.entities.pax = parseInt(paxMatch[1]);
  }

  return result;
}

async function searchTours(supabase: any, entities: any) {
  let query = supabase
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

  // Kullanıcının yazdığı metinde title ve destination'da esnek arama
  if (entities.searchTerm) {
    query = query.or(`destination.ilike.%${entities.searchTerm}%,title.ilike.%${entities.searchTerm}%`);
  }

  if (entities.type) {
    query = query.eq("type", entities.type);
  }

  const { data, error } = await query;
  if (error) throw error;

  const tours = (data || []).map((tour: any) => ({
    ...tour,
    dates: (tour.tour_dates || [])
      .filter((date: any) => {
        if (entities.date_iso) {
          return date.departure_date === entities.date_iso;
        }
        return true;
      })
      .sort((a: any, b: any) => 
        new Date(a.departure_date).getTime() - new Date(b.departure_date).getTime()
      )
  })); // Tarihi olmayan turları da göster

  return tours;
}

async function createRegistration(supabase: any, entities: any, from: string) {
  try {
    // Tur tarihini kontrol et
    const { data: tourDate, error: tourDateError } = await supabase
      .from('tour_dates')
      .select('id, departure_date, tour_id, tours(title, destination)')
      .eq('id', entities.tour_date_id)
      .single();

    if (tourDateError || !tourDate) {
      return { error: 'Tur tarihi bulunamadı. Lütfen geçerli bir tur tarih ID\'si kullanın.' };
    }

    // Kayıt oluştur
    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .insert({
        tour_id: tourDate.tour_id,
        tour_date_id: entities.tour_date_id,
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
    return '😔 Üzgünüm, arama kriterlerinize uygun tur bulunamadı.\n\nLütfen farklı tarih veya destinasyon deneyin.';
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  let response = `🎯 *${tours.length} Tur Bulundu!*\n\n`;

  tours.slice(0, 3).forEach((tour, index) => {
    response += `${index + 1}️⃣ *${tour.title}*\n`;
    response += `📍 ${tour.destination}\n`;
    if (tour.program_kisa) {
      response += `✨ ${tour.program_kisa}\n`;
    }
    
    // Tarihi varsa göster
    if (tour.dates.length > 0) {
      const firstDate = tour.dates[0];
      response += `🆔 Tarih ID: \`${firstDate.id}\`\n`;
      response += `📅 ${firstDate.departure_date}${firstDate.return_date && firstDate.return_date !== firstDate.departure_date ? ' → ' + firstDate.return_date : ''}\n`;
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
    response += `_... ve ${tours.length - 3} tur daha_\n\n`;
  }

  response += '📝 *Kayıt olmak için:*\n"Kayıt olmak istiyorum" yazın veya direkt kayıt formatını kullanın.';

  return response;
}
