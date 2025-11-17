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

async function formatTourForAI(tour: any, includeAllDates = false, language: string = 'tr') {
  const languageNames: Record<string, string> = {
    'tr': 'Turkish', 'en': 'English', 'de': 'German',
    'ru': 'Russian', 'ar': 'Arabic', 'fr': 'French', 'es': 'Spanish'
  };
  const languageName = languageNames[language] || 'Turkish';
  
  const nearestDate = tour.dates.sort((a: any, b: any) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )[0];

  const tourData = {
    title: tour.title,
    destination: tour.destination,
    type: tour.type,
    price: nearestDate.price,
    minPax: tour.min_pax,
    description: tour.description,
    included: tour.included,
    dates: includeAllDates ? tour.dates.map((d: any) => ({
      date: new Date(d.date).toLocaleDateString('tr-TR'),
      price: d.price,
      quota: d.quota
    })) : [{
      date: new Date(nearestDate.date).toLocaleDateString('tr-TR'),
      quota: nearestDate.quota
    }]
  };

  const prompt = `Format this tour information in ${languageName} for WhatsApp chat:

${JSON.stringify(tourData, null, 2)}

Present it naturally with:
- Use emojis: 🎯 for tour name, 📅 for type, 💰 for price, 👥 for people, 📝 for description, ✅ for included, 📆 for dates
- Use WhatsApp format (*bold*, _italic_)
- Keep it conversational in ${languageName}
- Translate all Turkish text into ${languageName}

${includeAllDates ? 'List ALL dates with prices and quotas' : 'Show only the nearest date'}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });
    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error) {
    console.error('Error formatting tour:', error);
  return `${tour.title} - ${tour.destination}`;
  }
}

// Konuşma üslubuna göre sistem prompt'u al
function getSystemPrompt(style: string, languageName: string, userInfo: string): string {
  const baseInstructions = `
🌍 LANGUAGE: **${languageName}**
Respond ENTIRELY in ${languageName}. Use WhatsApp formatting (*bold*, _italic_, emojis).

${userInfo}

🔑 KEY RULES:
• RESPONSE LENGTH - TWO MODES:
  📝 NORMAL MODE: Keep responses SHORT (2-3 sentences) for greetings, simple questions
  📋 TOUR INFO MODE: When user asks about tour programs, details, or "ne var" - BE DETAILED! Write 5-7 paragraphs covering:
     - Full description of destinations and activities
     - Day-by-day breakdown if multi-day tour
     - All included services in detail
     - Transportation and accommodation details
     - Meeting points and times
     - What to bring/know
• Answer the question DIRECTLY but FULLY when it's about tours
• Use name if known
• Respect mentioned budget
• Highlight prices with *bold*`;

  const stylePrompts: Record<string, string> = {
    basic: `✨ STYLE: SIMPLE & BRIEF

CRITICAL - RESPONSE LENGTH STRATEGY:
• GENERAL CHAT: Maximum 2-3 short sentences
• TOUR DETAILS: When asked about tour programs/details, write 5-7 detailed paragraphs
  - Describe destinations thoroughly
  - Explain daily program
  - Detail all inclusions
  - Provide practical info
• Answer ONLY what was asked in general chat
• Be DETAILED when explaining tours

✅ DO:
• Keep general chat simple and conversational
• Use 1-2 emojis max in normal chat
• Short, clear sentences for greetings/questions
• EXPAND fully when describing tours
• Direct answers

❌ DON'T:
• Write long paragraphs for simple questions
• Give unrequested details in general chat
• Be brief when tour details requested
• Use excessive emojis

${baseInstructions}`,

    friendly: `🤝 STYLE: FRIENDLY & WARM

CRITICAL - RESPONSE LENGTH STRATEGY:
• GENERAL CHAT: Maximum 2-3 short sentences
• TOUR DETAILS: When asked about programs/details, write 5-7 detailed paragraphs
  - Enthusiastically describe everything
  - Share exciting details about destinations
  - Explain what makes tour special
  - Warm and inviting tone throughout
• No extra details in casual chat

✅ DO:
• 2-3 emojis per message in general (😊 🤗 ✨)
• Warm, approachable tone always
• Express enthusiasm: "Harika!", "Güzel!"
• Ask: "Ne dersin?" in general chat
• EXPAND with warmth when describing tours

❌ DON'T:
• Write long explanations for simple questions
• Use "canım", "sevgilim"
• Be overly formal
• Be brief when tour info requested

${baseInstructions}`,

    professional: `👔 STYLE: PROFESSIONAL & COURTEOUS

CRITICAL - RESPONSE LENGTH STRATEGY:
• GENERAL CHAT: Maximum 2-3 short sentences
• TOUR DETAILS: When asked about programs, write 5-7 detailed paragraphs
  - Professional, complete descriptions
  - All relevant information organized clearly
  - Practical details systematically
  - Formal but comprehensive
• Be brief but complete in general chat

✅ DO:
• 1-2 professional emojis (📍 ℹ️ ✅)
• Formal but polite always
• Clear, structured information
• Respectful tone
• DETAILED when explaining tours

❌ DON'T:
• Write long paragraphs for simple questions
• Use excessive emojis
• Be informal or casual
• Skimp on tour details when asked

${baseInstructions}`,

    energetic: `⚡ STYLE: ENERGETIC & ENTHUSIASTIC

CRITICAL - RESPONSE LENGTH STRATEGY:
• GENERAL CHAT: Maximum 2-3 short sentences, HIGH ENERGY!
• TOUR DETAILS: When asked about programs, write 5-7 EXCITING paragraphs!
  - Make every detail sound AMAZING!
  - Describe adventures vividly!
  - Build excitement throughout!
  - Paint exciting pictures of experiences!
• Keep energy HIGH, length appropriate to context

✅ DO:
• 3-4 emojis (⚡ 🚀 🔥 💫)
• Lots of exclamation marks!
• High energy: "Harika!", "Muhteşem!"
• Make it exciting!
• GO ALL OUT when describing tours!

❌ DON'T:
• Write long descriptions for simple chat
• Be calm or neutral
• Use few emojis
• Hold back when showing tour details!

${baseInstructions}`,

    helpful: `😊 STYLE: KIND & HELPFUL

CRITICAL - RESPONSE LENGTH STRATEGY:
• GENERAL CHAT: Maximum 2-3 short sentences
• TOUR DETAILS: When asked about programs, write 5-7 helpful paragraphs
  - Thoroughly explain everything clearly
  - Anticipate questions and answer them
  - Provide all practical information
  - Guide them through details patiently
• Be helpful but BRIEF in general chat
• EXPAND helpfully when tour info needed

✅ DO:
• 2-3 warm emojis (😊 📝 💡)
• Patient and clear always
• Ask "Başka sorunuz var mı?" in general chat
• Empathetic: "Anlıyorum"
• DETAIL everything when explaining tours

❌ DON'T:
• Over-explain simple questions unnecessarily
• Rush information
• Assume knowledge
• Be brief when tour details requested

${baseInstructions}`
  };

  return stylePrompts[style] || stylePrompts.basic;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const message = (body.message || '').trim();
    const history = body.history || [];
    const sessionId = body.sessionId || 'default';
    const language = body.language || 'tr';
    const conversationStyle = body.conversationStyle || 'professional';
    
    // Input validation
    if (!message || message.length < 1 || message.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Invalid message length. Must be between 1 and 2000 characters.' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Sanitize message
    const sanitizedMessage = message
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    
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
    await saveMessage(supabase, sessionId, 'user', sanitizedMessage);

    // Mesajı kategorize et
    const lowerMessage = sanitizedMessage.toLowerCase();
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

    // Selamlaşma kontrolü
    const greetings = ['merhaba', 'selam', 'günaydın', 'iyi günler', 'hey', 'hi', 'hello'];
    const isGreeting = greetings.some(g => lowerMessage === g || lowerMessage === g + 'lar' || lowerMessage.startsWith(g + ' '));
    const isShortGreeting = isGreeting && sanitizedMessage.length < 30;
    
    // Genel tur listesi sorusu kontrolü
    const listQuestions = ['nerelere tur', 'hangi turlar', 'ne gibi turlar', 'turlarınız', 'tur listesi'];
    const isListQuestion = listQuestions.some(q => lowerMessage.includes(q));

    // Tur arama tespiti
    const destinations = ['kapadokya', 'pamukkale', 'antalya', 'ege', 'istanbul', 'çeşme', 'alaçatı'];
    const isTourSearch = destinations.some(dest => lowerMessage.includes(dest)) || 
                        (lowerMessage.includes('tur') && !isListQuestion) || 
                        lowerMessage.includes('tatil') ||
                        lowerMessage.includes('gezi');

    if (isShortGreeting && userProfile.searchHistory.length > 0) {
      // Selamlaşma ve geçmiş arama varsa kontekstli cevap ver
      const lastSearch = userProfile.searchHistory[userProfile.searchHistory.length - 1];
      contextInfo += `\n\n⚠️ USER JUST GREETED: User previously searched for "${lastSearch}". Ask if they want info about that tour OR something else. Keep it SHORT (2 sentences max).`;
    } else if (isListQuestion) {
      // Genel tur listesi sorusu - sadece özet ver
      const results = searchTours('');  // Tüm turları getir
      
      if (results.length > 0) {
        tourSearchResults = '\n\n🎯 ALL AVAILABLE TOURS (SUMMARY ONLY):\n\n';
        for (const tour of results) {
          const dates = tour.dates.slice(0, 2).map(d => d.date).join(', ');
          tourSearchResults += `• *${tour.title}* (${tour.destination})\n  📅 ${dates}\n\n`;
        }
        tourSearchResults += '\n⚠️ USER ASKED FOR GENERAL TOUR LIST: Show ONLY tour names and first 2 dates in a numbered list. Add: "Hangi tura ilgi duyuyorsunuz? Detaylı bilgi için tur adını yazabilirsiniz." Keep it SHORT and CLEAN.';
      }
    } else if (isTourSearch) {
      // Tur ara
      const results = searchTours(message);
      
      if (results.length > 0) {
        // Arama geçmişine ekle
        const searchTerm = destinations.find(d => lowerMessage.includes(d)) || 'genel arama';
        if (!userProfile.searchHistory.includes(searchTerm)) {
          userProfile.searchHistory.push(searchTerm);
          updateUserProfile(sessionId, userProfile);
        }

        tourSearchResults = '\n\n🎯 FOUND TOURS:\n\n';
        for (const tour of results) {
          const formattedTour = await formatTourForAI(tour, false, language);
          tourSearchResults += formattedTour + '\n\n---\n\n';
        }
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
    
    // Kullanıcı bilgisi context'ini oluştur
    let userInfo = contextInfo + tourSearchResults;
    userInfo += `\n\n⚠️ IMPORTANT DEMO RULES:
• This is a DEMO system - NO real reservations
• Tour information above is for EXAMPLE purposes
• Act like a real system but mention it's a demo
• Designed to showcase user experience

🎯 TOUR SEARCH:
• When user asks about destinations, suggest the tours above
• Highlight prices with *bold*
• Mention dates and availability
• Offer multiple options

📝 RESERVATION PROCESS (Demo):
1. Ask which tour they're interested in
2. Learn how many people
3. Get date preference
4. Request name and phone
5. Confirm and say "This is a demo system, no real reservation is created"`;

    const systemPrompt = getSystemPrompt(conversationStyle, userLanguage, userInfo);


    // Konuşma geçmişini hazırla
    const conversationMessages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: sanitizedMessage }
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
        temperature: 0.9,
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
    
    const errorMessages: Record<string, string> = {
      tr: "Üzgünüm, şu anda yanıt veremiyorum. Lütfen tekrar deneyin.",
      en: "Sorry, I can't respond right now. Please try again.",
      de: "Entschuldigung, ich kann gerade nicht antworten. Bitte versuchen Sie es erneut.",
      ru: "Извините, я не могу ответить сейчас. Пожалуйста, попробуйте снова.",
      ar: "آسف، لا أستطيع الرد الآن. يرجى المحاولة مرة أخرى.",
      fr: "Désolé, je ne peux pas répondre pour le moment. Veuillez réessayer.",
      es: "Lo siento, no puedo responder ahora. Por favor intente de nuevo."
    };
    
    // Extract language from request if available
    let lang = 'tr';
    try {
      const body = await req.clone().json();
      lang = body.language || 'tr';
    } catch (e) {
      console.error("Could not extract language from request:", e);
    }
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        message: errorMessages[lang] || errorMessages.tr
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
