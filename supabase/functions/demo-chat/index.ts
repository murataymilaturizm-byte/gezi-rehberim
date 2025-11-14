import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_AGENCY_ID = "00000000-0000-0000-0000-000000000000";

// Örnek Tur Verileri (Demo için hard-coded)
const DEMO_TOURS = [
  {
    id: 'demo-kapadokya-1',
    title: 'Kapadokya Balon Turu',
    destination: 'Kapadokya',
    type: 'Günübirlik',
    min_pax: 2,
    dates: [
      { date: '2025-12-15', price: 1500, quota: 20 },
      { date: '2025-12-22', price: 1500, quota: 15 },
      { date: '2025-12-29', price: 1650, quota: 10 }
    ],
    description: 'Kapadokya\'da unutulmaz bir balon deneyimi. Gün doğumunda balonla havalanıp peribacalarını kuş bakışı görün.',
    included: 'Balon turu, Ulaşım, Kahvaltı, Sertifika'
  },
  {
    id: 'demo-pamukkale-1',
    title: 'Pamukkale Turu',
    destination: 'Pamukkale',
    type: '2 Gece 3 Gün',
    min_pax: 4,
    dates: [
      { date: '2025-12-10', price: 3500, quota: 15 },
      { date: '2025-12-20', price: 3500, quota: 12 },
      { date: '2026-01-05', price: 3200, quota: 20 }
    ],
    description: 'Beyaz cennet Pamukkale ve Hierapolis antik kentini keşfedin. 4 yıldızlı otelde konaklama.',
    included: 'Otel, Ulaşım, Rehber, Kahvaltı ve Akşam yemekleri, Müze giriş ücretleri'
  },
  {
    id: 'demo-antalya-1',
    title: 'Antalya Rafting',
    destination: 'Antalya',
    type: 'Günübirlik',
    min_pax: 6,
    dates: [
      { date: '2025-12-05', price: 800, quota: 30 },
      { date: '2025-12-12', price: 800, quota: 25 },
      { date: '2025-12-19', price: 850, quota: 20 }
    ],
    description: 'Köprülü Kanyon\'da heyecan dolu rafting macerası. Deneyimli eğitmenler eşliğinde güvenli ve eğlenceli.',
    included: 'Rafting ekipmanı, Ulaşım, Öğle yemeği, Sigorta'
  },
  {
    id: 'demo-ege-1',
    title: 'Ege Turu',
    destination: 'İzmir-Çeşme-Alaçatı',
    type: '7 Gün 6 Gece',
    min_pax: 2,
    dates: [
      { date: '2025-12-08', price: 8999, quota: 12 },
      { date: '2025-12-15', price: 8999, quota: 10 },
      { date: '2025-12-22', price: 9500, quota: 8 }
    ],
    description: 'Ege\'nin incisi Çeşme, Alaçatı ve Efes Antik Kenti\'ni keşfedin. Butik otel konaklaması.',
    included: '4* Butik Otel, Ulaşım, Rehber, Kahvaltı ve Akşam yemekleri, Efes giriş ücreti'
  },
  {
    id: 'demo-istanbul-1',
    title: 'İstanbul Turu',
    destination: 'İstanbul',
    type: '2 Gün 1 Gece',
    min_pax: 1,
    dates: [
      { date: '2025-12-07', price: 2999, quota: 25 },
      { date: '2025-12-14', price: 2999, quota: 20 },
      { date: '2025-12-21', price: 3200, quota: 15 }
    ],
    description: 'İstanbul\'un tarihi ve kültürel zenginliklerini keşfedin. Ayasofya, Topkapı Sarayı ve Boğaz turu.',
    included: 'Otel, Rehber, Müze girişleri, Öğle yemeği, Boğaz turu'
  }
];

// Demo user profiles (session-based)
const demoUserProfiles: Map<string, any> = new Map();

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

function getUserProfile(sessionId: string) {
  if (!demoUserProfiles.has(sessionId)) {
    demoUserProfiles.set(sessionId, {
      name: null,
      phone: null,
      preferences: [],
      searchHistory: [],
      interactionCount: 0
    });
  }
  return demoUserProfiles.get(sessionId);
}

function updateUserProfile(sessionId: string, updates: any) {
  const profile = getUserProfile(sessionId);
  demoUserProfiles.set(sessionId, { ...profile, ...updates });
}

function searchTours(query: string, filters?: any) {
  const lowerQuery = query.toLowerCase();
  let results = DEMO_TOURS;

  // Destinasyon filtresi
  if (lowerQuery) {
    results = results.filter(tour => 
      tour.title.toLowerCase().includes(lowerQuery) ||
      tour.destination.toLowerCase().includes(lowerQuery) ||
      tour.description.toLowerCase().includes(lowerQuery)
    );
  }

  // Fiyat filtresi
  if (filters?.maxPrice) {
    results = results.filter(tour => 
      Math.min(...tour.dates.map(d => d.price)) <= filters.maxPrice
    );
  }

  // Tur tipi filtresi
  if (filters?.tourType) {
    results = results.filter(tour => 
      tour.type.toLowerCase().includes(filters.tourType.toLowerCase())
    );
  }

  return results;
}

function formatTourForAI(tour: any, includeAllDates = false) {
  const nearestDate = tour.dates.sort((a: any, b: any) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )[0];

  let info = `🎯 *${tour.title}* (${tour.destination})
📅 Tur Tipi: ${tour.type}
💰 Fiyat: ${nearestDate.price.toLocaleString('tr-TR')} TL/kişi
👥 Min. Kişi: ${tour.min_pax}
📝 ${tour.description}
✅ Dahil: ${tour.included}`;

  if (includeAllDates) {
    info += `\n\n📆 Mevcut Tarihler:`;
    tour.dates.forEach((d: any) => {
      info += `\n• ${new Date(d.date).toLocaleDateString('tr-TR')} - ${d.price.toLocaleString('tr-TR')} TL (${d.quota} kişi kota)`;
    });
  } else {
    info += `\n📆 En Yakın Tarih: ${new Date(nearestDate.date).toLocaleDateString('tr-TR')} (${nearestDate.quota} kişi kota)`;
  }

  return info;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history = [], sessionId = 'default', language = 'tr' } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user profile
    const userProfile = getUserProfile(sessionId);
    userProfile.interactionCount += 1;
    updateUserProfile(sessionId, userProfile);

    // Save user message
    await saveMessage(supabase, sessionId, 'user', message);

    // Mesajı kategorize et
    const lowerMessage = message.toLowerCase();
    let tourSearchResults = '';
    let contextInfo = '';

    // Kullanıcı profili varsa context'e ekle
    if (userProfile.name) {
      contextInfo += `\n\n👤 Kullanıcı: ${userProfile.name}`;
    }
    if (userProfile.preferences.length > 0) {
      contextInfo += `\n💭 Tercihleri: ${userProfile.preferences.join(', ')}`;
    }
    if (userProfile.searchHistory.length > 0) {
      contextInfo += `\n🔍 Önceki aramalar: ${userProfile.searchHistory.slice(-3).join(', ')}`;
    }

    // Tur arama tespiti
    const destinations = ['kapadokya', 'pamukkale', 'antalya', 'ege', 'istanbul', 'çeşme', 'alaçatı'];
    const isTourSearch = destinations.some(dest => lowerMessage.includes(dest)) || 
                        lowerMessage.includes('tur') || 
                        lowerMessage.includes('tatil') ||
                        lowerMessage.includes('gezi');

    if (isTourSearch) {
      // Tur ara
      const results = searchTours(message);
      
      if (results.length > 0) {
        // Arama geçmişine ekle
        const searchTerm = destinations.find(d => lowerMessage.includes(d)) || 'genel arama';
        if (!userProfile.searchHistory.includes(searchTerm)) {
          userProfile.searchHistory.push(searchTerm);
          updateUserProfile(sessionId, userProfile);
        }

        tourSearchResults = '\n\n🎯 BULUNAN TURLAR:\n\n';
        results.forEach((tour, index) => {
          tourSearchResults += formatTourForAI(tour, false) + '\n\n';
          if (index < results.length - 1) tourSearchResults += '---\n\n';
        });
      }
    }

    // İsim tespit et
    const nameMatch = message.match(/(?:adım|ismim|ben)\s+([A-ZİĞÜŞÖÇ][a-zığüşöç]+(?:\s+[A-ZİĞÜŞÖÇ][a-zığüşöç]+)?)/i);
    if (nameMatch && !userProfile.name) {
      userProfile.name = nameMatch[1];
      updateUserProfile(sessionId, userProfile);
    }

    // Telefon tespit et
    const phoneMatch = message.match(/(\+?90|0)[\s]?(\d{3})[\s]?(\d{3})[\s]?(\d{2})[\s]?(\d{2})/);
    if (phoneMatch && !userProfile.phone) {
      userProfile.phone = phoneMatch[0].replace(/\s/g, '');
      updateUserProfile(sessionId, userProfile);
    }

    // Bugünün tarihini al
    const today = new Date();
    const currentDate = today.toLocaleDateString('tr-TR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Language mapping
    const languageNames: Record<string, string> = {
      'tr': 'Turkish',
      'en': 'English', 
      'de': 'German',
      'ru': 'Russian',
      'ar': 'Arabic',
      'fr': 'French',
      'es': 'Spanish'
    };
    
    const userLanguage = languageNames[language] || 'Turkish';
    
    const systemPrompt = `You are Turzz's intelligent WhatsApp assistant! 🌟

🗓️ TODAY'S DATE: ${currentDate}

🌍 CRITICAL LANGUAGE INSTRUCTION:
• The user's interface language is: **${userLanguage}**
• You MUST respond ENTIRELY in ${userLanguage}
• ALL tour information (prices, dates, descriptions) must be in ${userLanguage}
• Translate ALL Turkish tour data into ${userLanguage} naturally
• If user writes in a different language, respond in that language
• Use proper WhatsApp formatting in all languages (*bold*, _italic_, emojis)

🎯 MARKA KİŞİLİĞİN:
• Samimi ve arkadaşça - "siz" yerine "sen" kullan
• Enerjik ama profesyonel - coşkulu ama abartısız
• Akıllı ve yardımsever - kullanıcı tercihlerini hatırla
• Yerel uzman - destinasyonları çok iyi biliyorsun

💬 İLETİŞİM TARZI:
• Günlük konuşma diline yakın, doğal Türkçe
• WhatsApp formatı: *kalın yazı*, _italik yazı_
• Kısa, net cümleler (max 2-3 cümle)
• Her mesajda 1-2 emoji, abartma

✨ AKILLI ÖZELLİKLER:
• Kullanıcının ismini öğrenirsen kullan
• Önceki aramalarını hatırla, ona göre öner
• Tercihlerini kaydet (bütçe, destinasyon, tur tipi)
• Kişiselleştirilmiş önerilerde bulun

${contextInfo}${tourSearchResults}

⚠️ ÖNEMLİ DEMO KURALLARI:
• Bu bir DEMO sistem - gerçek rezervasyon YAPILMIYOR
• Yukarıdaki tur bilgileri ÖRNEK amaçlıdır
• Gerçek bir sistem gibi davran ama demo olduğunu belirt
• Kullanıcı deneyimini göstermek için tasarlandı

🎯 TUR ARAMA:
• Kullanıcı destinasyon sorarsa yukarıdaki turları öner
• Fiyatları *kalın* yazarak vurgula
• Tarihleri ve kotaları belirt
• Birden fazla seçenek sun

📝 REZERVASYON SÜRECİ (Demo):
1. Hangi tura ilgilendiğini sor
2. Kaç kişi olduklarını öğren
3. Tarih tercihini al
4. İsim ve telefon bilgisi iste
5. Onay ver ve "Bu demo sistem, gerçek rezervasyon oluşturmaz" de

💬 MESAJ ÖRNEKLERİ:
"Merhaba! 👋 Hangi destinasyona ilgi duyuyorsun?"
"Harika seçim! ✨ Sana *3 farklı tarih* seçeneği var."
"Anlıyorum 🤔 Bütçe önemli. Daha uygun alternatiflere bakalım mı?"`;

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
        temperature: 0.7,
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
