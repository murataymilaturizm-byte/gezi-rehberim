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

    const body = await req.json();
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
      const response = formatWhatsAppResponse(tours, parsed.entities);
      
      return new Response(JSON.stringify({
        success: true,
        message: response,
        tours: tours.map((t: any) => ({
          id: t.id,
          title: t.title,
          firstDate: t.dates[0]
        }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({
        success: true,
        message: 'Merhaba! 👋 Size nasıl yardımcı olabilirim?\n\nTur aramak için şöyle yazabilirsiniz:\n"Günübirlik Kapadokya 20 Temmuz"'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
  const result: any = {
    intent: "tour.search",
    entities: {
      destination: null,
      type: null,
      date_iso: null,
      pax: null
    }
  };

  // Destinasyon
  if (lowerText.includes("kapadokya")) result.entities.destination = "Kapadokya";
  if (lowerText.includes("ayvalık")) result.entities.destination = "Ayvalık";
  if (lowerText.includes("efes") || lowerText.includes("izmir") || lowerText.includes("İzmir")) result.entities.destination = "İzmir";
  if (lowerText.includes("pamukkale") || lowerText.includes("denizli")) result.entities.destination = "Pamukkale";
  if (lowerText.includes("antalya") || lowerText.includes("kemer")) result.entities.destination = "Antalya";

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

  if (entities.destination) {
    query = query.eq("destination", entities.destination);
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
  })).filter((tour: any) => tour.dates.length > 0);

  return tours;
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
    const firstDate = tour.dates[0];
    response += `${index + 1}️⃣ *${tour.title}*\n`;
    response += `📍 ${tour.destination}\n`;
    if (tour.program_kisa) {
      response += `✨ ${tour.program_kisa}\n`;
    }
    response += `📅 ${firstDate.departure_date}${firstDate.return_date && firstDate.return_date !== firstDate.departure_date ? ' → ' + firstDate.return_date : ''}\n`;
    if (tour.tur_sure) {
      response += `⏱️ ${tour.tur_sure}\n`;
    }
    response += `💰 ${formatPrice(firstDate.price_adult)} ${tour.currency} /kişi\n`;
    response += `👥 ${firstDate.quota > 0 ? firstDate.quota + ' kontenjan' : 'Kontenjan doldu'}\n`;
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

  response += '📝 Ön kayıt için lütfen acentemizle iletişime geçin.';

  return response;
}
