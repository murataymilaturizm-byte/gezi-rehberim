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
    const { message, conversationHistory, language = 'tr' } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const languageNames: Record<string, string> = {
      'tr': 'Türkçe',
      'en': 'English',
      'de': 'Deutsch',
      'ru': 'Русский',
      'ar': 'العربية',
      'fr': 'Français',
      'es': 'Español'
    };

    const systemPrompt = `You are Turzz AI system's help and support assistant. You help customers use the system correctly.

**CRITICAL LANGUAGE INSTRUCTION**: The user is communicating in ${languageNames[language] || 'Turkish'}. You MUST respond ENTIRELY in ${languageNames[language] || 'Turkish'}. This includes ALL system instructions, troubleshooting steps, feature explanations, and help resources. Translate everything to ${languageNames[language] || 'Turkish'} naturally and professionally.

GOREVLERIN:
- Sistem kullanimi hakkinda sorulari yanitla
- Kurulum ve konfigurasyonda yardim et
- Teknik sorunlara cozum oneriler sun
- Ozellikleri detayli anlat
- Adim adim rehberlik yap
- Gerektiginde /yardim sayfasina yonlendir

YARDIM KAYNAKLARI:
- Kapsamli Yardim Merkezi: www.turzz.ai/yardim - Tum konularda detayli rehber
- Baslangic Rehberi: www.turzz.ai/nasil-baslarim - Ilk kurulum adimlar
- Destek E-posta: info@turzz.ai - Teknik destek icin

ANA KONULAR:

1. KURULUM VE BASLANGIC
- WhatsApp Business numarasi baglama (Ayarlar sekmesinden)
- Ilk tur ekleme
- Test mesaji gonderme
- NOT: Twilio hesabi acmaya GEREK YOK, altyapiyi biz yonetiyoruz

2. TUR YONETIMI
- Yeni tur ekleme (Turlar sekmesi > Yeni Tur Ekle)
- Tur tarihlerini ekleme/duzenleme
- Kota ayarlama
- Fiyat guncelleme

3. REZERVASYON YONETIMI
- Rezervasyon durumlarini degistirme
- Excel'e aktarma
- Musteri bilgilerini goruntuleme

4. WHATSAPP ENTEGRASYONU
- Bot nasil calisir
- Mesaj sablonlari kullanimi
- Coklu dil destegi (7 dil)
- Otomatik dil algilama

5. RAPORLAMA VE ANALITIK
- Dashboard kullanimi
- Gelir analizleri
- Kullanim istatistikleri

6. MESAJ SABLONLARI
- Varsayilan sablonlar
- Sablon duzenleme
- Yeni dil ekleme
- Degisken kullanimi

7. TEKNIK SORUNLAR
- Bot yanit vermiyor → WhatsApp numarasini kontrol et
- Turlar listelenmıyor → Tur ve tarih eklendiginden emin ol
- Rezervasyon olusturulmuyor → Kota ve tarihleri kontrol et

KONUSMA STILI:
- Acik ve anlasilir Turkce kullan
- Adim adim acikla
- Gerekirse ekran goruntusu iste
- Sabırlı ve yardımsever ol
- Kisa ve oz cevaplar ver
- Detayli bilgi icin /yardim sayfasini oner
- Cozemezsen info@turzz.ai'ye yonlendir

ONEMLI:
- Her zaman dogru bilgi ver
- Emin degilsen info@turzz.ai adresine yonlendir
- Satıs yapma, yardim et
- Kullanici deneyimini iyilestirmeye odaklan`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: message }
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('SUPABASE_URL') || '',
        'X-Title': 'Turzz Support Chat'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      throw new Error('Failed to get AI response');
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || 'Uzgunum, bir hata olustu.';

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in support-chat function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        response: 'Uzgunum, bir hata olustu. Lutfen tekrar deneyin veya info@turzz.ai adresinden bizimle iletisime gecin.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
