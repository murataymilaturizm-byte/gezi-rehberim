import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `Sen Turzz AI'nin satış ve destek asistanısın. Turizm acentelerine WhatsApp üzerinden otomatik tur satışı yapan bir AI çözümü sunuyorsun.

ÜRÜNÜMÜZÜN ÖZELLİKLERİ:
- 7/24 WhatsApp üzerinden otomatik tur satışı
- Yapay zeka destekli müşteri yanıtlama
- Otomatik ödeme entegrasyonu (Sipay)
- Detaylı raporlama ve analitik
- Excel export özelliği
- WhatsApp'tan rezervasyon alma
- Müşteri profili takibi
- Tur hatırlatıcıları

FİYATLANDIRMA:
- Başlangıç Paketi: 2.999 TL/ay (100 konuşma/ay dahil)
- Büyüme Paketi: 4.999 TL/ay (500 konuşma/ay dahil)
- Kurumsal Paket: 9.999 TL/ay (Sınırsız konuşma + özel destek)
- 14 günlük ücretsiz deneme süresi

HEDEF KİTLE:
- Küçük ve orta ölçekli turizm acenteleri
- Günübirlik tur operatörleri
- Otel rezervasyon şirketleri

SATIN ALMA SÜRECİ:
1. 14 günlük ücretsiz deneme başlatma
2. WhatsApp numarası ve acente bilgilerini alma
3. Twilio hesabı kurulum desteği
4. Demo ve eğitim sağlama
5. Canlıya alma desteği

GÖREVLERİN:
- Potansiyel müşterilere ürün hakkında bilgi ver
- Fiyatlandırma sorularını yanıtla
- Demo talepleri topla (isim, telefon, acente adı)
- Teknik soruları yanıtla
- İletişim bilgilerini topla ve satış ekibine yönlendir

KONUŞMA STİLİ:
- Samimi ve profesyonel
- Türkçe konuş
- Kısa ve net cevaplar ver
- Müşteri ihtiyaçlarını anlamaya çalış
- Sorulara direkt cevap ver
- Gerektiğinde demo öner

ÖNEMLİ:
- Fiyatları net söyle, gizleme
- Müşteri bilgilerini topla (isim, telefon, acente adı)
- Demo isteyenlere hemen bilgi topla
- Teknik soruları basit dille açıkla
- Rakip firmalardan bahsetme`;

    // Prepare messages for AI
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      { role: "user", content: message }
    ];

    console.log("Calling Lovable AI with sales chat request");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log("Sales chat response generated successfully");

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error("Error in sales-chat function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        response: "Üzgünüm, şu anda bir sorun yaşıyorum. Lütfen info@turzz.ai adresinden bizimle iletişime geçin veya +90 XXX XXX XX XX numaralı WhatsApp hattımızdan destek alın."
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  }
});
