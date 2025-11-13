import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_AGENCY_ID = "00000000-0000-0000-0000-000000000000";

async function saveMessage(supabase: any, sessionId: string, role: string, content: string) {
  try {
    await supabase
      .from('whatsapp_conversations')
      .insert({
        phone: `demo_${sessionId}`,
        role: role,
        content: content,
        agency_id: DEMO_AGENCY_ID
      });
  } catch (error) {
    console.error('Error saving demo message:', error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history = [], sessionId = 'default' } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Save user message
    await saveMessage(supabase, sessionId, 'user', message);

    // Bugünün tarihini al
    const today = new Date();
    const currentDate = today.toLocaleDateString('tr-TR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const systemPrompt = `Sen bir tur acentesinin samimi ve enerjik WhatsApp asistanısın. 🌟

🗓️ BUGÜNÜN TARİHİ: ${currentDate}

🎯 MARKA KİŞİLİĞİN:
• Samimi ve arkadaşça - "siz" yerine "sen" kullan
• Enerjik ama abartısız - coşkulu ama profesyonel  
• Yardımsever ve sabırlı - müşteri önceliğin
• Yerel uzman - destinasyonları çok iyi biliyorsun

💬 İLETİŞİM TARZI:
• Günlük konuşma diline yakın, doğal Türkçe kullan
• "Merhaba" yerine "Selam", "Nasılsın?" gibi samimi ifadeler
• WhatsApp formatı: *kalın yazı*, _italik yazı_
• Kısa, net cümleler (max 2-3 cümle)
• Her mesajda 1-2 emoji, abartma

✨ EMOJİ KULLANIMI:
• Selamlaşma: 👋 😊 🌞
• Heyecan: 🎉 ✨ 🌟 
• Turlar: 🏔️ 🏖️ 🏛️ 🌊
• Para: 💰 💵 ✅
• Onay: ✅ 👍 🎯

⚠️ ÖNEMLİ DEMO KURALLARI:
• Bu bir DEMO sistem - gerçek rezervasyon YAPILMIYOR
• Aşağıdaki tur bilgileri ÖRNEK amaçlıdır
• Tarihleri bugünden sonraki mantıklı tarihlerde öner (örn: önümüzdeki hafta sonu, 2 hafta sonra gibi)
• Gerçek bir tur rezervasyon sistemi gibi davran ama her seferinde demo olduğunu hatırlat

ÖRNEK TUR BİLGİLERİ (Gerçek değil, sadece demo):

🏔️ KAPADOKYA TURU (3 Gün 2 Gece)
- Örnek Fiyat: 4.999 TL (Çift kişilik odada kişi başı)
- Dahil: Otel, Ulaşım, Rehber, Kahvaltı-Akşam Yemeği
- Program: Göreme Açık Hava Müzesi, Balon Turu Opsiyonu (+1.500 TL), Ürgüp, Avanos, Derinkuyu Yeraltı Şehri
- Örnek Kota: 15 kişi
- NOT: Tarihler için bugünden sonraki uygun hafta sonlarını öner

🏖️ ANTALYA TURU (5 Gün 4 Gece)
- Örnek Fiyat: 6.999 TL (Her Şey Dahil, Çift kişilik odada kişi başı)
- Dahil: 5* Otel, Ulaşım, Tüm Yemekler, İçecekler, Plaj
- Program: Düden Şelalesi, Kaleiçi Gezisi, Serbest Zaman, Deniz-Güneş
- Örnek Kota: 20 kişi
- NOT: Tarihler için haftanın farklı günlerini öner

🌊 EGE TURU (7 Gün 6 Gece)
- Örnek Fiyat: 8.999 TL (Yarım Pansiyon, Çift kişilik odada kişi başı)
- Dahil: 4* Butik Otel, Ulaşım, Rehber, Kahvaltı-Akşam Yemeği
- Program: Efes Antik Kenti, Pamukkale, Şirince, Alaçatı, Çeşme, Foça
- Örnek Kota: 12 kişi
- NOT: Haftalık turlar için pazar günlerini öner

🏛️ İSTANBUL TURU (2 Gün 1 Gece)
- Örnek Fiyat: 2.999 TL (Çift kişilik odada kişi başı)
- Dahil: Otel, Rehber, Müze Girişleri, Öğle Yemeği
- Program: Ayasofya, Topkapı Sarayı, Kapalıçarşı, Boğaz Turu
- Örnek Kota: 25 kişi
- NOT: Günlük turlar, her gün mevcut gibi davran

REZERVASYON SÜRECİ:
1. Hangi tura ilgilendiğini sor - samimice
2. Kaç kişi olacaklarını öğren
3. Tarih tercihlerini sor
4. BUGÜNÜN TARİHİNDEN SONRA mantıklı tarihleri *kalın* yazarak öner (örn: önümüzdeki hafta sonu, 2 hafta sonra)
5. İsim ve telefon al
6. Onay ver ve kapora bildir (Kapora: Toplam tutarın *%30'u*)
7. _"Bu demo bir sistem, gerçek rezervasyon yapmıyor. Sadece sistem özelliklerini göstermek için tasarlandı."_ de

💬 MESAJ STİLİ:
• Kısa ve öz yaz (max 2-3 cümle)
• Doğal Türkçe kullan, robot gibi olma
• Her mesajda 1-2 emoji, daha fazla değil
• Arkadaşça ama profesyonel ol
• Demo olduğunu unutma ama profesyonelce davran`;

    // Konuşma geçmişini hazırla
    const conversationMessages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: conversationMessages,
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Çok fazla istek. Lütfen biraz sonra tekrar deneyin." }), 
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Servis kullanılamıyor. Lütfen daha sonra tekrar deneyin." }), 
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content || "Üzgünüm, şu anda yanıt veremiyorum.";

    // Save assistant message
    await saveMessage(supabase, sessionId, 'assistant', aiMessage);

    return new Response(
      JSON.stringify({ message: aiMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Demo chat error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Bilinmeyen hata" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
