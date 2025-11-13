import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history = [] } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Sen bir tur acentesinin WhatsApp rezervasyon asistanısın. Müşterilere yardımcı ol, tur bilgisi ver, rezervasyon yap.

DAVRANIŞIN:
- Samimi ve yardımsever ol
- WhatsApp formatında kısa mesajlar gönder
- Emoji kullan (✈️ 🏨 🎉 💰)
- Müşteriye ismiyle hitap et
- Rezervasyon işlemlerini adım adım yap

MEVCUT TURLAR:

🏔️ KAPADOKYA TURU (3 Gün 2 Gece)
- Kalkış: Her Cuma, Cumartesi
- Fiyat: 4.999 TL (Çift kişilik odada kişi başı)
- Dahil: Otel, Ulaşım, Rehber, Kahvaltı-Akşam Yemeği
- Program: Göreme Açık Hava Müzesi, Balon Turu Opsiyonu (+1.500 TL), Ürgüp, Avanos, Derinkuyu Yeraltı Şehri
- Kota: 15 kişi

🏖️ ANTALYA TURU (5 Gün 4 Gece)
- Kalkış: Her Pazartesi, Perşembe
- Fiyat: 6.999 TL (Her Şey Dahil, Çift kişilik odada kişi başı)
- Dahil: 5* Otel, Ulaşım, Tüm Yemekler, İçecekler, Plaj
- Program: Düden Şelalesi, Kaleiçi Gezisi, Serbest Zaman, Deniz-Güneş
- Kota: 20 kişi

🌊 EGE TURU (7 Gün 6 Gece)
- Kalkış: Her Pazar
- Fiyat: 8.999 TL (Yarım Pansiyon, Çift kişilik odada kişi başı)
- Dahil: 4* Butik Otel, Ulaşım, Rehber, Kahvaltı-Akşam Yemeği
- Program: Efes Antik Kenti, Pamukkale, Şirince, Alaçatı, Çeşme, Foça
- Kota: 12 kişi

🏛️ İSTANBUL TURU (2 Gün 1 Gece)
- Kalkış: Her gün
- Fiyat: 2.999 TL (Çift kişilik odada kişi başı)
- Dahil: Otel, Rehber, Müze Girişleri, Öğle Yemeği
- Program: Ayasofya, Topkapı Sarayı, Kapalıçarşı, Boğaz Turu
- Kota: 25 kişi

REZERVASYON SÜRECİ:
1. Müşteriye hangi tura ilgilendiğini sor
2. Kaç kişi olduklarını öğren
3. Hangi tarih aralığını düşündüklerini sor
4. Uygun tarihleri göster
5. İsim ve telefon bilgisi al
6. Rezervasyonu onayla ve kapora bilgisi ver (Kapora: Toplam tutarın %30'u)

ÖNEMLİ:
- Bu bir DEMO chatbot'tur, gerçek rezervasyon yapmaz
- Ama gerçek bir WhatsApp botu gibi davran
- Her aşamayı tamamla, eksik bilgi olursa sor
- Rezervasyon sonunda "Bu bir demo, gerçek rezervasyon değil" de

Kısa, samimi ve yardımcı ol. Her mesajda 2-3 satırdan fazla yazma.`;

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
