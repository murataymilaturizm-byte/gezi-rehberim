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
- 7/24 WhatsApp üzerinden otomatik tur satışı ve müşteri desteği
- Yapay zeka destekli akıllı müşteri yanıtlama
- Otomatik ödeme entegrasyonu (Sipay ile güvenli ödeme)
- Detaylı raporlama ve gelişmiş analitik
- Excel export özelliği
- WhatsApp'tan direkt rezervasyon alma
- Müşteri profili ve tercih takibi
- Otomatik tur hatırlatıcıları
- Çok dilli destek (Türkçe, İngilizce ve diğer diller)
- Kolay entegrasyon ve kurulum

FİYATLANDIRMA (Tüm paketlerde 14 günlük ücretsiz deneme dahil):

1. BAŞLANGIÇ PAKETİ - 2.999 TL/ay
   - 100 konuşma/ay dahil
   - Temel analitik raporları
   - E-posta desteği
   - Sipay ödeme entegrasyonu
   - Küçük acenteler için ideal

2. PROFESYONEL PAKET - 4.999 TL/ay (EN POPÜLER)
   - 500 konuşma/ay dahil
   - Gelişmiş analitik ve raporlama
   - Öncelikli destek
   - Özel raporlama özellikleri
   - WhatsApp entegrasyonu
   - Büyüyen işletmeler için ideal

3. KURUMSAL PAKET - Özel Fiyatlandırma
   - Sınırsız konuşma
   - Özel yazılım geliştirme desteği
   - 7/24 premium destek
   - API erişimi
   - Özel eğitim ve danışmanlık
   - Büyük organizasyonlar için özel çözümler
   - Fiyat için bizimle iletişime geçin

HEDEF KİTLE:
- Küçük ve orta ölçekli turizm acenteleri
- Günübirlik tur operatörleri
- Otel rezervasyon şirketleri
- Seyahat organizasyon firmaları

MÜŞTERİ GÖRÜŞLERİ:
- Yasin Çetin (Kampüs Travel, İşletme Sahibi): "Turzz AI sayesinde müşteri memnuniyetimiz %40 arttı. 7/24 hizmet verebilmek harika!"
- Sıtkı Murat OĞRAK (Aymila Turizm, İşletme Müdürü): "Rezervasyon sürecimiz çok hızlandı. Artık gece bile satış yapabiliyoruz."
- Mustafa Gülmez (4 Eylül Turizm, İşletme Sahibi): "Kurulum çok kolay oldu. İlk haftada 50'den fazla rezervasyon aldık!"

SATIN ALMA SÜRECİ:
1. 14 günlük ücretsiz deneme başlatma (kredi kartı gerekmez)
2. WhatsApp numarası ve acente bilgilerini alma
3. Twilio hesabı kurulum desteği (ücretsiz)
4. Canlı demo ve eğitim sağlama
5. Tur bilgilerini sisteme aktarma
6. Canlıya alma ve devam eden destek

İLETİŞİM:
- E-posta: info@turzz.ai
- WhatsApp Destek: (numarayı sor ve yönlendir)
- Web: www.turzz.ai

GÖREVLERİN:
- Potansiyel müşterilere ürün özelliklerini detaylı anlat
- Fiyatlandırma sorularını net ve doğru yanıtla
- Paket karşılaştırmaları yap, müşteriye en uygun paketi öner
- Demo talepleri topla (isim, telefon, acente adı, mevcut müşteri sayısı)
- Teknik soruları basit ve anlaşılır şekilde yanıtla
- İletişim bilgilerini topla ve satış ekibine yönlendir
- Kurumsal paket için özel görüşme ayarla

KONUŞMA STİLİ:
- Samimi ve profesyonel
- Türkçe konuş (müşteri isterse İngilizce geç)
- Kısa ve öz cevaplar ver
- Müşteri ihtiyaçlarını dinle ve anla
- Sorulara direkt ve dürüst cevap ver
- Başarı hikayelerini paylaş
- Ücretsiz denemeyi vurgula

ÖNEMLİ NOKTALAR:
- Fiyatları yukarıdaki gibi net ve doğru söyle
- Tüm paketlerde 14 günlük ücretsiz deneme olduğunu vurgula
- Profesyonel Paket'in en popüler paket olduğunu belirt
- Kurumsal paket için özel görüşme gerektiğini söyle
- Müşteri bilgilerini mutlaka topla
- Demo isteyenlere hemen bilgi al ve yönlendir
- ROI (yatırım getirisi) konusunda somut örnekler ver
- Rekabetten bahsetme, sadece kendi avantajlarını anlat`;

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
