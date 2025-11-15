import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting helper
async function checkRateLimit(supabase: any, identifier: string, endpoint: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_api_rate_limit', {
    _identifier: identifier,
    _endpoint: endpoint,
    _max_requests: 100,
    _window_minutes: 15
  });
  
  if (error) {
    console.error('Rate limit check error:', error);
    return true; // Allow on error to prevent blocking legitimate requests
  }
  
  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Rate limit check
    const isAllowed = await checkRateLimit(supabase, clientIp, 'whatsapp-webhook');
    if (!isAllowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIp}`);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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
    let userMessage = body.Body || body.message || '';
    const from = body.From || body.from || '';
    const to = body.To || body.to || ''; // Twilio phone number

    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'No message provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Telefon numarasından whatsapp: prefix'ini temizle
    const userPhone = from.replace('whatsapp:', '');
    const twilioPhone = to.replace('whatsapp:', '');
    
    // Bu WhatsApp numarasına sahip acente'yi bul (merkezi Twilio yapısı)
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id, agency_name, active, subscription_status, trial_ends_at, subscription_ends_at, plan_type, monthly_message_count, message_limit, conversation_style, enabled_languages')
      .eq('whatsapp_phone_number', twilioPhone)
      .eq('active', true)
      .single();

    if (agencyError || !agency) {
      console.error('Agency not found for phone:', twilioPhone, agencyError);
      return new Response(JSON.stringify({ error: 'Agency not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Found agency:', agency.agency_name);
    
    // Subscription kontrolü
    const now = new Date();
    let subscriptionExpired = false;
    
    if (agency.subscription_status === 'expired' || agency.subscription_status === 'cancelled') {
      subscriptionExpired = true;
    } else if (agency.subscription_status === 'trial' && agency.trial_ends_at) {
      const trialEnd = new Date(agency.trial_ends_at);
      if (trialEnd < now) {
        subscriptionExpired = true;
        // Durumu güncelle
        await supabase
          .from('agencies')
          .update({ subscription_status: 'expired' })
          .eq('id', agency.id);
      }
    } else if (agency.subscription_status === 'active' && agency.subscription_ends_at) {
      const subscriptionEnd = new Date(agency.subscription_ends_at);
      if (subscriptionEnd < now) {
        subscriptionExpired = true;
        // Durumu güncelle
        await supabase
          .from('agencies')
          .update({ subscription_status: 'expired' })
          .eq('id', agency.id);
      }
    }
    
    // Eğer subscription süresi dolduysa, bilgilendirme mesajı gönder ve işleme devam etme
    if (subscriptionExpired) {
      console.log('Subscription expired for agency:', agency.agency_name);
      
      // Kullanıcı dil tercihini al
      const userProfile = await getUserProfile(supabase, userPhone, agency.id);
      const userLanguage = userProfile?.language_preference || 'tr';
      
      const expiredMessage = await formatSystemMessage('subscription_expired', {}, userLanguage);
      
      // Sadece mesajı kaydet, geri dönüş yapma
      await saveMessage(supabase, userPhone, 'assistant', expiredMessage, agency.id);
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${expiredMessage}</Message>
</Response>`;
      
      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }
    
    // Mesaj limiti kontrolü (paket bazlı)
    const messageLimitExceeded = await checkMessageLimit(supabase, agency);
    
    if (messageLimitExceeded) {
      console.log('Message limit exceeded for agency:', agency.agency_name);
      
      const limitMessage = agency.plan_type === 'starter' 
        ? '📊 *Aylık mesaj kotanız doldu!* 😔\n\nDaha fazla mesaj için paketinizi yükseltmeniz gerekiyor.\n\n💡 *Profesyonel* pakete geçerek 2.000 mesaj/ay hakkı kazanabilirsiniz!\n\n📞 Detaylı bilgi için acente yöneticinizle iletişime geçin.'
        : '📊 *Aylık mesaj kotanız doldu!* 😔\n\nDaha fazla mesaj için lütfen acente yöneticinizle iletişime geçin.\n\n📞 Paket yükseltme için destek alabilirsiniz.';
      
      await saveMessage(supabase, userPhone, 'assistant', limitMessage, agency.id);
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${limitMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`;
      
      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }
    
    // Mesaj sayacını artır
    await incrementMessageCount(supabase, agency.id);
    
    // Kullanıcı mesajını kaydet (agency_id ile)
    await saveMessage(supabase, userPhone, 'user', userMessage, agency.id);
    
    // Kullanıcı profilini oluştur/güncelle (dil algılama ile)
    await upsertUserProfile(supabase, userPhone.replace('+', ''), agency.id, userMessage, agency.enabled_languages || []);

    // Rezervasyon wizard durumunu kontrol et
    const wizardState = await getWizardState(supabase, userPhone, agency.id);
    
    if (wizardState) {
      // Wizard aktif - ilgili adımı işle
      const wizardResponse = await handleWizardStep(
        supabase, 
        userPhone, 
        agency.id, 
        userMessage, 
        wizardState
      );
      
      // Bot cevabını kaydet
      await saveMessage(supabase, userPhone, 'assistant', wizardResponse, agency.id);
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${wizardResponse.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`;
      
      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    // Hızlı cevap butonlarını kontrol et
    const quickReplyMatch = userMessage.match(/^[1-3]$/);
    if (quickReplyMatch) {
      const buttonNumber = parseInt(userMessage);
      
      // Son bot mesajını al, hangi context'te olduğumuzu anlamak için
      const { data: lastBotMessage } = await supabase
        .from('whatsapp_conversations')
        .select('content')
        .eq('phone', userPhone)
        .eq('agency_id', agency.id)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (lastBotMessage && lastBotMessage.content.includes('Hızlı Seçenekler')) {
        // Tur sonuçları context'i
        if (lastBotMessage.content.includes('Kayıt olmak istiyorum')) {
          if (buttonNumber === 1) {
            userMessage = 'Kayıt olmak istiyorum';
          } else if (buttonNumber === 2) {
            userMessage = 'Daha fazla bilgi';
          } else if (buttonNumber === 3) {
            userMessage = 'Başka turlar';
          }
        } 
        // Tur bulunamadı context'i
        else if (lastBotMessage.content.includes('Tüm turları göster')) {
          if (buttonNumber === 1) {
            userMessage = 'Tüm turları göster';
          } else if (buttonNumber === 2) {
            userMessage = 'Danışman ile görüşmek istiyorum';
          }
        }
      }
    }

    // Önce AI ile mesajı kategorize et
    const intent = await categorizeMessage(userMessage);
    console.log('Categorized intent:', intent);

    if (intent.type === 'registration.create') {
      // Kayıt oluştur
      const registration = await createRegistration(supabase, intent.data, from, agency.id);
      
      const message = registration.error 
        ? `❌ Kayıt oluşturulamadı: ${registration.error}`
        : (registration.message || 'Kayıt oluşturuldu');
      
      // Bot cevabını kaydet
      await saveMessage(supabase, userPhone, 'assistant', message, agency.id);
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`;
      
      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    } else if (intent.type === 'registration.request') {
      // Wizard'ı başlat
      const tours = await searchToursWithAI(supabase, userMessage, userPhone, agency.id);
      
      if (tours.length === 0) {
        const message = '😊 Önce bir tur aramanız gerekiyor.\n\nÖrnek: "Kapadokya turları"';
        await saveMessage(supabase, userPhone, 'assistant', message, agency.id);
        
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`;
        
        return new Response(twiml, {
          headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
        });
      }
      
      // Kullanıcı dil tercihini al
      const userProfile = await getUserProfile(supabase, userPhone, agency.id);
      const userLanguage = userProfile?.language_preference || 'tr';
      
      // Wizard state'i oluştur
      const wizardState: WizardState = {
        step: 'tour_selection',
        created_at: new Date().toISOString()
      };
      
      await saveWizardState(supabase, userPhone, agency.id, wizardState);
      
      const toursData = tours.slice(0, 5).map((tour: any, idx: number) => ({
        number: idx + 1,
        title: tour.title,
        price: tour.dates && tour.dates.length > 0 ? tour.dates[0].price_adult : 0,
        currency: tour.currency
      }));
      
      const message = await formatSystemMessage('wizard_tour_selection_start', {
        tourCount: Math.min(tours.length, 5),
        tours: toursData
      }, userLanguage);
      
      await saveMessage(supabase, userPhone, 'assistant', message, agency.id);
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`;
      
      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    } else if (intent.type === 'tour.search') {
      // AI ile akıllı arama
      const tours = await searchToursWithAI(supabase, userMessage, userPhone, agency.id);
      
      // Kullanıcı dil tercihini al
      const userProfile = await getUserProfile(supabase, userPhone, agency.id);
      const userLanguage = userProfile?.language_preference || 'tr';
      
      // WhatsApp formatında cevap oluştur
      const message = await formatWhatsAppResponse(tours, {}, userLanguage);
      
      // Bot cevabını kaydet
      await saveMessage(supabase, userPhone, 'assistant', message, agency.id);
      
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
      const chatResponse = await handleGeneralChat(userMessage, userPhone, supabase, agency.id, agency.conversation_style || 'professional');
      
      // Bot cevabını kaydet
      await saveMessage(supabase, userPhone, 'assistant', chatResponse, agency.id);
      
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

// Konuşma üslubuna göre sistem prompt'u al
function getSystemPrompt(style: string, languageName: string, currentDate: string, contextInfo: string): string {
  const baseInstructions = `
🗓️ TODAY'S DATE: ${currentDate}

🌍 CRITICAL LANGUAGE INSTRUCTION:
• User's preferred language: **${languageName}**
• You MUST respond ENTIRELY in ${languageName}
• Use natural, conversational ${languageName}
• Adapt greetings and expressions to ${languageName} culture
• Keep WhatsApp formatting (*bold*, _italic_, emojis)

${contextInfo}

🔑 IMPORTANT RULES:
• If you know user's name, use it - be personal
• Suggest tours similar to their previous interests
• If there's conversation history, continue directly
• Remember user preferences, make personalized suggestions
• If budget info available, suggest matching tours
• Highlight prices with *bold*
• Emphasize important info with WhatsApp formatting`;

  const stylePrompts: Record<string, string> = {
    friendly: `🤝 CONVERSATION STYLE: FRIENDLY & WARM

YOU MUST STRICTLY FOLLOW THIS STYLE IN EVERY MESSAGE:

✅ REQUIRED BEHAVIORS:
• Use 3-4 emojis per message (😊 🤗 ✨ 🌟 💕)
• Write like chatting with a close friend
• Use informal language: "arkadaşım", "dostum", "canım"
• Express excitement: "Harika!", "Süper!", "Çok güzel!"
• Ask personal questions: "Nasıl gidiyor?", "Ne dersin?"
• Short, casual sentences

❌ FORBIDDEN:
• Formal language
• Business terminology
• Long explanations
• Using only 1 emoji

${baseInstructions}`,

    professional: `👔 CONVERSATION STYLE: PROFESSIONAL & COURTEOUS

YOU MUST STRICTLY FOLLOW THIS STYLE IN EVERY MESSAGE:

✅ REQUIRED BEHAVIORS:
• Use ONLY 1-2 professional emojis maximum (📍 ℹ️ ✅)
• Formal but polite language
• Complete, well-structured sentences
• Focus on facts and details
• Respectful tone: "Sayın müşterimiz", "Tabii ki"
• Provide clear information

❌ FORBIDDEN:
• Excessive emojis (more than 2)
• Informal language
• Slang or casual expressions
• Exclamation marks

${baseInstructions}`,

    energetic: `⚡ CONVERSATION STYLE: ENERGETIC & ENTHUSIASTIC

YOU MUST STRICTLY FOLLOW THIS STYLE IN EVERY MESSAGE:

✅ REQUIRED BEHAVIORS:
• Use 4-5 expressive emojis per message! (⚡ 🚀 🔥 💫 🌟 🎉)
• LOTS of exclamation marks!!!
• High energy words: "Harika!", "Muhteşem!", "İnanılmaz!"
• Create excitement about everything
• Dynamic and uplifting tone
• Make tours sound AMAZING!

❌ FORBIDDEN:
• Calm, neutral language
• Few emojis (minimum 4)
• No exclamation marks
• Boring descriptions

${baseInstructions}`,

    helpful: `😊 CONVERSATION STYLE: KIND & HELPFUL

YOU MUST STRICTLY FOLLOW THIS STYLE IN EVERY MESSAGE:

✅ REQUIRED BEHAVIORS:
• Use 2-3 warm emojis (😊 📝 💡 ✅)
• Patient and detailed explanations
• Ask "Başka sorunuz var mı?"
• Offer additional help
• Break down complex information
• Empathetic language: "Anlıyorum", "Tabii ki"
• Ensure customer understands

❌ FORBIDDEN:
• Rush through information
• Short, incomplete answers
• Assume customer knows details
• Skip clarifications

${baseInstructions}`
  };

  return stylePrompts[style] || stylePrompts.professional;
}

async function handleGeneralChat(userMessage: string, userPhone: string, supabase: any, agency_id: string, conversationStyle: string = 'professional') {
  // Kullanıcı profilini al
  const userProfile = await getUserProfile(supabase, userPhone, agency_id);
  
  // Kullanıcının dil tercihini al
  const userLanguage = userProfile?.language_preference || 'tr';
  const languageNames: Record<string, string> = {
    'tr': 'Turkish', 'en': 'English', 'de': 'German',
    'ru': 'Russian', 'ar': 'Arabic', 'fr': 'French', 'es': 'Spanish'
  };
  const languageName = languageNames[userLanguage] || 'Turkish';
  
  // Konuşma geçmişini al (son 20 mesaj)
  const history = await getConversationHistory(supabase, userPhone, agency_id, 20);
  
  // Son konuşma özetlerini al
  const { data: summaries } = await supabase
    .from('whatsapp_conversation_summaries')
    .select('summary, topics, sentiment')
    .eq('phone', userPhone)
    .eq('agency_id', agency_id)
    .order('created_at', { ascending: false })
    .limit(3);

  // Kullanıcı bağlamını oluştur
  let contextInfo = '';
  
  if (userProfile) {
    contextInfo += `\n\nKullanıcı Profili:`;
    if (userProfile.full_name) contextInfo += `\n- İsim: ${userProfile.full_name}`;
    if (userProfile.total_messages) contextInfo += `\n- Toplam mesaj: ${userProfile.total_messages}`;
    if (userProfile.preferred_destinations && userProfile.preferred_destinations.length > 0) {
      contextInfo += `\n- Tercih ettiği destinasyonlar: ${userProfile.preferred_destinations.join(', ')}`;
    }
    if (userProfile.budget_range) contextInfo += `\n- Bütçe aralığı: ${userProfile.budget_range}`;
    if (userProfile.preferred_tour_type) contextInfo += `\n- Tercih ettiği tur tipi: ${userProfile.preferred_tour_type}`;
    if (userProfile.last_search_query) contextInfo += `\n- Son arama: ${userProfile.last_search_query}`;
  }

  if (summaries && summaries.length > 0) {
    contextInfo += `\n\nÖnceki Konuşma Özetleri:`;
    summaries.forEach((s: any, i: number) => {
      contextInfo += `\n${i + 1}. ${s.summary} (Konular: ${s.topics?.join(', ') || 'Yok'})`;
    });
  }

  // Bugünün tarihini al
  const today = new Date();
  const currentDate = today.toLocaleDateString('tr-TR', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const messages = [
    {
      role: 'system',
      content: getSystemPrompt(conversationStyle, languageName, currentDate, contextInfo)
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
      temperature: 0.9
    })
  });

  const result = await aiResponse.json();
  
  // Kullanıcı ismini öğrendiysek profili güncelle
  const nameMatch = userMessage.match(/(?:adım|benim adım|ismim|ben)\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)?)/i);
  if (nameMatch && userProfile && !userProfile.full_name) {
    await updateUserPreferences(supabase, userPhone, agency_id, {
      full_name: nameMatch[1]
    });
  }
  
  return result.choices[0].message.content;
}


async function searchToursWithAI(supabase: any, userMessage: string, userPhone: string, agency_id: string) {
  // Kullanıcı profilini al
  const userProfile = await getUserProfile(supabase, userPhone, agency_id);
  
  // Kullanıcının dil tercihini al
  const userLanguage = userProfile?.language_preference || 'tr';
  const languageNames: Record<string, string> = {
    'tr': 'Turkish', 'en': 'English', 'de': 'German',
    'ru': 'Russian', 'ar': 'Arabic', 'fr': 'French', 'es': 'Spanish'
  };
  const languageName = languageNames[userLanguage] || 'Turkish';
  
  // Önce acentenin turlarını al
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
    `)
    .eq('agency_id', agency_id);

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

  // Konuşma geçmişini al (son 10 mesaj)
  const history = await getConversationHistory(supabase, userPhone, agency_id, 10);

  // Kullanıcı profili context'i oluştur
  let userContext = '';
  if (userProfile) {
    if (userProfile.preferred_destinations && userProfile.preferred_destinations.length > 0) {
      userContext += `\nKullanıcının daha önce ilgilendiği destinasyonlar: ${userProfile.preferred_destinations.join(', ')}`;
    }
    if (userProfile.budget_range) {
      userContext += `\nKullanıcının bütçe aralığı: ${userProfile.budget_range}`;
    }
    if (userProfile.preferred_tour_type) {
      userContext += `\nKullanıcının tercih ettiği tur tipi: ${userProfile.preferred_tour_type}`;
    }
  }

  const messages = [
    {
      role: 'system',
      content: `You are a tour search assistant. Analyze user's message and conversation history to find matching tours.

LANGUAGE: User prefers ${languageName} - analyze their message in any language they use.

${userContext}

Available Tours: ${JSON.stringify(toursList, null, 2)}

From user's message extract:
- Destination (Cappadocia, Ephesus, Pamukkale, etc)
- Tour type (day trip, 2 nights, 3 nights)
- Date preference (if mentioned)
- Budget expectation (if mentioned)

Return matching tour IDs as JSON array. ONLY return JSON array, nothing else.
Example: ["id1", "id2"]
If no tours match, return empty array: []

IMPORTANT: 
- ONLY return JSON array, no markdown format!
- Consider user profile preferences
- Prioritize tours similar to previous searches`
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

  // Kullanıcı tercihlerini güncelle - destinasyonları ve arama sorgusunu kaydet
  if (matchedTours.length > 0 && userProfile) {
    const newDestinations = matchedTours.map((t: any) => t.destination);
    const existingDests = userProfile.preferred_destinations || [];
    const updatedDests = Array.from(new Set([...newDestinations, ...existingDests])).slice(0, 5);
    
    await updateUserPreferences(supabase, userPhone, agency_id, {
      last_search_query: userMessage,
      preferred_destinations: updatedDests
    });
  }

  return matchedTours;
}

async function createRegistration(supabase: any, entities: any, from: string, agency_id: string) {
  try {
    // Tur adı ve tarihe göre tur tarihini bul
    const tourDateStr = entities.tour_date.replace(/[.\/-]/g, '-');
    const dateParts = tourDateStr.split('-');
    const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`; // YYYY-MM-DD formatına çevir
    
    const { data: tourDate, error: tourDateError } = await supabase
      .from('tour_dates')
      .select('id, departure_date, tour_id, tours(title, destination)')
      .eq('departure_date', formattedDate)
      .eq('agency_id', agency_id)
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
        note: `WhatsApp kayıt: ${from}`,
        agency_id: agency_id
      })
      .select()
      .single();

    if (regError) {
      console.error('Registration error:', regError);
      return { error: 'Kayıt oluşturulamadı. Lütfen bilgilerinizi kontrol edip tekrar deneyin.' };
    }

    // Kontenjandan düş
    const { data: currentTourDate } = await supabase
      .from('tour_dates')
      .select('quota')
      .eq('id', tourDate.id)
      .single();

    if (currentTourDate) {
      await supabase
        .from('tour_dates')
        .update({ quota: currentTourDate.quota - entities.pax })
        .eq('id', tourDate.id);
    }

    // Kullanıcı profilini güncelle - isim ve tur tercihlerini kaydet
    const userPhone = from.replace('whatsapp:', '');
    
    // Kullanıcı dil tercihini al
    const userProfile = await getUserProfile(supabase, userPhone, agency_id);
    const userLanguage = userProfile?.language_preference || 'tr';
    
    await updateUserPreferences(supabase, userPhone, agency_id, {
      full_name: entities.full_name,
      preferred_destinations: [tourDate.tours.destination]
    });

    const message = await formatSystemMessage('registration_success', {
      registrationId: registration.id.substring(0, 8),
      tourTitle: tourDate.tours.title,
      destination: tourDate.tours.destination,
      date: tourDate.departure_date,
      fullName: entities.full_name,
      phone: entities.phone,
      pax: entities.pax
    }, userLanguage);

    // WhatsApp onay mesajı gönder (arka planda)
    
    // Agency bilgisini al
    const { data: agency } = await supabase
      .from('agencies')
      .select('whatsapp_phone_number')
      .eq('id', agency_id)
      .single();
    
    if (agency && agency.whatsapp_phone_number) {
      sendWhatsAppMessage(userPhone, agency.whatsapp_phone_number, message).catch(err => {
        console.error('WhatsApp mesajı gönderilemedi:', err);
      });
    }

    return { message };
  } catch (error) {
    console.error('Create registration error:', error);
    return { error: 'Beklenmeyen bir hata oluştu.' };
  }
}

// WhatsApp mesajı gönderme - merkezi Twilio ile zengin medya desteği
async function sendWhatsAppMessage(
  to: string,
  from: string, // WhatsApp Business phone number
  message: string,
  mediaUrls?: string[]
) {
  // Merkezi Twilio credentials kullan
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');

  if (!accountSid || !authToken || !from) {
    console.error('Merkezi Twilio credentials veya from numarası eksik');
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = btoa(`${accountSid}:${authToken}`);
  
  const bodyParams: Record<string, string> = {
    From: `whatsapp:${from}`,
    To: `whatsapp:${to}`,
    Body: message
  };

  // Medya URL'leri varsa ekle
  if (mediaUrls && mediaUrls.length > 0) {
    mediaUrls.forEach((url, index) => {
      bodyParams[`MediaUrl${index}`] = url;
    });
  }

  const body = new URLSearchParams(bodyParams);

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

// Buton mesajları için hızlı cevaplar
function createQuickReplyButtons(options: { text: string; emoji: string }[]) {
  let message = '\n\n💬 *Hızlı cevaplar:*\n';
  options.forEach((option, index) => {
    message += `${option.emoji} *${index + 1}* → ${option.text}\n`;
  });
  message += '\n_Numara yaz, hemen yardımcı olayım!_ 👆';
  return message;
}

// WhatsApp formatı ile zenginleştirilmiş tur yanıtları (AI'a formatlat)
async function formatWhatsAppResponse(tours: any[], entities: any, userLanguage: string = 'tr') {
  const languageNames: Record<string, string> = {
    'tr': 'Turkish', 'en': 'English', 'de': 'German',
    'ru': 'Russian', 'ar': 'Arabic', 'fr': 'French', 'es': 'Spanish'
  };
  const languageName = languageNames[userLanguage] || 'Turkish';
  
  if (tours.length === 0) {
    // AI'a format mesajı oluştur
    const prompt = `Create a friendly "no tours found" message in ${languageName}.
    
Include:
- Empathetic response with emoji
- Suggestions (try different date, destination, tour type)
- Call to action

Use WhatsApp format (*bold*, _italic_) and 1-2 emojis. Keep it short and friendly.`;

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
      console.error('Error formatting no results message:', error);
      return 'No tours found matching your criteria. 🤔';
    }
  }


  // Tours varsa AI'a formatlat
  const toursData = tours.slice(0, 3).map(tour => ({
    title: tour.title,
    destination: tour.destination,
    description: tour.program_kisa || '',
    dates: tour.dates?.slice(0, 1).map((d: any) => ({
      departure_date: d.departure_date,
      return_date: d.return_date,
      price_adult: d.price_adult,
      quota: d.quota
    })),
    currency: tour.currency,
    duration: tour.tur_sure,
    places: tour.gezilecek_yerler,
    program_url: tour.program_url
  }));

  const prompt = `Format these tours for WhatsApp in ${languageName}:

${JSON.stringify(toursData, null, 2)}

Create an engaging message with:
- Friendly intro (${tours.length} tour${tours.length > 1 ? 's' : ''} found)
- For each tour: title, destination, date, price, quota status, highlights
- Use WhatsApp format (*bold*, _italic_)
- Use emojis: 📍 for location, 📅 for dates, 💰 for price, ✅/⚠️/❌ for availability
- Keep it conversational and natural in ${languageName}
- End with call-to-action for booking

Be culturally appropriate for ${languageName} speakers.`;

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
    console.error('Error formatting tours:', error);
    return `Found ${tours.length} tours for you! 🎯`;
  }
}

// Zengin medya ile tur detayı gönderme (tur fotoğrafları ile)
async function sendTourWithMedia(
  to: string,
  tour: any,
  agency: any,
  supabase: any
) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  let message = `*${tour.title.toUpperCase()}*\n\n`;
  message += `📍 ${tour.destination}\n\n`;
  
  if (tour.program_kisa) {
    message += `${tour.program_kisa}\n\n`;
  }
  
  if (tour.dates && tour.dates.length > 0) {
    const firstDate = tour.dates[0];
    const depDate = new Date(firstDate.departure_date).toLocaleDateString('tr-TR');
    message += `📅 ${depDate}\n`;
    message += `💰 ${formatPrice(firstDate.price_adult)} ${tour.currency} /kişi\n`;
    message += `👥 ${firstDate.quota} kişilik yer mevcut\n\n`;
  }
  
  if (tour.gezilecek_yerler) {
    message += `🗺️ *Gezilecek Yerler:*\n${tour.gezilecek_yerler}\n\n`;
  }
  
  message += `Kayıt olmak için "Kayıt: ${tour.title}" yazın`;

  // Eğer tur'un fotoğrafı varsa medya ile gönder
  const mediaUrls = tour.image_url ? [tour.image_url] : undefined;
  
  // Merkezi Twilio için agency'nin WhatsApp numarasını kullan
  await sendWhatsAppMessage(to, agency.whatsapp_phone_number, message, mediaUrls);
}

// Mesajı veritabanına kaydet
async function saveMessage(supabase: any, phone: string, role: string, content: string, agency_id: string) {
  try {
    await supabase
      .from('whatsapp_conversations')
      .insert({
        phone,
        role,
        content,
        agency_id
      });
  } catch (error) {
    console.error('Error saving message:', error);
  }
}

// Rezervasyon wizard state yönetimi
interface WizardState {
  step: 'tour_selection' | 'date_selection' | 'pax_selection' | 'special_requests' | 'confirmation';
  selected_tour?: any;
  selected_date?: any;
  pax_adult?: number;
  pax_child?: number;
  special_requests?: string;
  created_at: string;
}

// Wizard state'i al
async function getWizardState(supabase: any, phone: string, agency_id: string): Promise<WizardState | null> {
  try {
    const userProfile = await getUserProfile(supabase, phone, agency_id);
    if (!userProfile || !userProfile.preferences?.wizard_state) {
      return null;
    }
    
    const state = userProfile.preferences.wizard_state;
    
    // 15 dakikadan eski wizard state'leri geçersiz
    const stateAge = Date.now() - new Date(state.created_at).getTime();
    if (stateAge > 15 * 60 * 1000) {
      await clearWizardState(supabase, phone, agency_id);
      return null;
    }
    
    return state;
  } catch (error) {
    console.error('Error getting wizard state:', error);
    return null;
  }
}

// Wizard state'i kaydet
async function saveWizardState(supabase: any, phone: string, agency_id: string, state: WizardState) {
  try {
    const { data: profile } = await supabase
      .from('whatsapp_user_profiles')
      .select('preferences')
      .eq('phone', phone)
      .eq('agency_id', agency_id)
      .single();
    
    const preferences = profile?.preferences || {};
    preferences.wizard_state = state;
    
    await supabase
      .from('whatsapp_user_profiles')
      .update({ preferences })
      .eq('phone', phone)
      .eq('agency_id', agency_id);
  } catch (error) {
    console.error('Error saving wizard state:', error);
  }
}

// Wizard state'i temizle
async function clearWizardState(supabase: any, phone: string, agency_id: string) {
  try {
    const { data: profile } = await supabase
      .from('whatsapp_user_profiles')
      .select('preferences')
      .eq('phone', phone)
      .eq('agency_id', agency_id)
      .single();
    
    const preferences = profile?.preferences || {};
    delete preferences.wizard_state;
    
    await supabase
      .from('whatsapp_user_profiles')
      .update({ preferences })
      .eq('phone', phone)
      .eq('agency_id', agency_id);
  } catch (error) {
    console.error('Error clearing wizard state:', error);
  }
}

// Wizard adımını işle
async function handleWizardStep(
  supabase: any,
  phone: string,
  agency_id: string,
  userMessage: string,
  state: WizardState
): Promise<string> {
  const lowerMessage = userMessage.toLowerCase().trim();
  
  // Kullanıcı dil tercihini al
  const userProfile = await getUserProfile(supabase, phone, agency_id);
  const userLanguage = userProfile?.language_preference || 'tr';
  
  // İptal kontrolü
  if (lowerMessage === 'iptal' || lowerMessage === 'vazgeç' || lowerMessage === 'cancel') {
    await clearWizardState(supabase, phone, agency_id);
    return await formatSystemMessage('wizard_cancel', {}, userLanguage);
  }
  
  switch (state.step) {
    case 'tour_selection':
      return await handleTourSelection(supabase, phone, agency_id, userMessage, state, userLanguage);
    
    case 'date_selection':
      return await handleDateSelection(supabase, phone, agency_id, userMessage, state, userLanguage);
    
    case 'pax_selection':
      return await handlePaxSelection(supabase, phone, agency_id, userMessage, state, userLanguage);
    
    case 'special_requests':
      return await handleSpecialRequests(supabase, phone, agency_id, userMessage, state, userLanguage);
    
    case 'confirmation':
      return await handleConfirmation(supabase, phone, agency_id, userMessage, state, userLanguage);
    
    default:
      await clearWizardState(supabase, phone, agency_id);
      return await formatSystemMessage('wizard_confirmation_error', {}, userLanguage);
  }
}

// Tur seçimi adımı
async function handleTourSelection(
  supabase: any,
  phone: string,
  agency_id: string,
  userMessage: string,
  state: WizardState,
  userLanguage: string = 'tr'
): Promise<string> {
  // Kullanıcı bir numara girdi mi?
  const tourNumber = parseInt(userMessage);
  
  if (isNaN(tourNumber) || tourNumber < 1) {
    return await formatSystemMessage('wizard_tour_selection_invalid', {}, userLanguage);
  }
  
  // Son tur aramayı al
  const history = await getConversationHistory(supabase, phone, agency_id, 5);
  const lastTourMessage = history.reverse().find((msg: any) => 
    msg.role === 'assistant' && msg.content.includes('Muhteşem Tur Buldum')
  );
  
  if (!lastTourMessage) {
    await clearWizardState(supabase, phone, agency_id);
    return await formatSystemMessage('wizard_tour_not_found', {}, userLanguage);
  }
  
  // Turun bilgilerini parse et
  const tours = await searchToursWithAI(supabase, 'son arama', phone, agency_id);
  
  if (tourNumber > tours.length) {
    return await formatSystemMessage('wizard_tour_selection_invalid', {}, userLanguage);
  }
  
  const selectedTour = tours[tourNumber - 1];
  
  // Tarihleri göster
  if (!selectedTour.dates || selectedTour.dates.length === 0) {
    await clearWizardState(supabase, phone, agency_id);
    return await formatSystemMessage('wizard_tour_not_found', {}, userLanguage);
  }
  
  // State'i güncelle
  state.selected_tour = selectedTour;
  state.step = 'date_selection';
  await saveWizardState(supabase, phone, agency_id, state);
  
  // Tarihleri listele
  const datesData = selectedTour.dates.map((date: any, idx: number) => ({
    number: idx + 1,
    date: new Date(date.departure_date).toLocaleDateString(userLanguage === 'tr' ? 'tr-TR' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }),
    price: date.price_adult,
    quota: date.quota
  }));
  
  return await formatSystemMessage('wizard_date_selection', {
    tourTitle: selectedTour.title,
    dateCount: selectedTour.dates.length,
    dates: datesData,
    currency: selectedTour.currency
  }, userLanguage);
}

// Tarih seçimi adımı
async function handleDateSelection(
  supabase: any,
  phone: string,
  agency_id: string,
  userMessage: string,
  state: WizardState,
  userLanguage: string = 'tr'
): Promise<string> {
  const dateNumber = parseInt(userMessage);
  
  if (isNaN(dateNumber) || dateNumber < 1 || dateNumber > state.selected_tour.dates.length) {
    return `❌ Lütfen 1-${state.selected_tour.dates.length} arası bir numara girin.\n\n_İptal etmek için "iptal" yazın_`;
  }
  
  const selectedDate = state.selected_tour.dates[dateNumber - 1];
  
  // State'i güncelle
  state.selected_date = selectedDate;
  state.step = 'pax_selection';
  await saveWizardState(supabase, phone, agency_id, state);
  
  const depDate = new Date(selectedDate.departure_date).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  
  let message = `✅ *Tarih seçildi:* ${depDate}\n\n`;
  message += `👥 *Kişi Sayısı*\n\n`;
  message += `Kaç kişi katılacaksınız?\n\n`;
  message += `📝 *Format:*\n`;
  message += `• Sadece yetişkin: "2 yetişkin" veya "2"\n`;
  message += `• Yetişkin + Çocuk: "2 yetişkin 1 çocuk"\n\n`;
  message += `💰 *Fiyatlar:*\n`;
  message += `• Yetişkin: ${formatPrice(selectedDate.price_adult)} ${state.selected_tour.currency}\n`;
  if (selectedDate.price_child) {
    message += `• Çocuk: ${formatPrice(selectedDate.price_child)} ${state.selected_tour.currency}\n`;
  }
  if (selectedDate.price_single) {
    message += `• Tek kişi ek: ${formatPrice(selectedDate.price_single)} ${state.selected_tour.currency}\n`;
  }
  
  message += `\n_İptal etmek için "iptal" yazın_`;
  
  return message;
}

// Kişi sayısı adımı
async function handlePaxSelection(
  supabase: any,
  phone: string,
  agency_id: string,
  userMessage: string,
  state: WizardState,
  userLanguage: string = 'tr'
): Promise<string> {
  // Kişi sayısını parse et
  const adultMatch = userMessage.match(/(\d+)\s*(?:yetişkin)?/i);
  const childMatch = userMessage.match(/(\d+)\s*çocuk/i);
  
  if (!adultMatch) {
    return '❌ Lütfen kişi sayısını belirtin.\n\nÖrnek: "2 yetişkin" veya "2 yetişkin 1 çocuk"\n\n_İptal etmek için "iptal" yazın_';
  }
  
  const paxAdult = parseInt(adultMatch[1]);
  const paxChild = childMatch ? parseInt(childMatch[1]) : 0;
  
  if (paxAdult < 1 || paxAdult > 20) {
    return '❌ Yetişkin sayısı 1-20 arası olmalıdır.';
  }
  
  if (paxChild < 0 || paxChild > 10) {
    return '❌ Çocuk sayısı 0-10 arası olmalıdır.';
  }
  
  const totalPax = paxAdult + paxChild;
  if (totalPax > state.selected_date.quota) {
    return `❌ Toplam kişi sayısı (${totalPax}) kontenjanı (${state.selected_date.quota}) aşıyor.\n\nLütfen daha az kişi sayısı belirtin.`;
  }
  
  // Fiyat hesapla
  let totalPrice = paxAdult * state.selected_date.price_adult;
  if (paxChild > 0 && state.selected_date.price_child) {
    totalPrice += paxChild * state.selected_date.price_child;
  }
  
  // Tek kişi ek ücreti
  if (paxAdult === 1 && paxChild === 0 && state.selected_date.price_single) {
    totalPrice += state.selected_date.price_single;
  }
  
  // State'i güncelle
  state.pax_adult = paxAdult;
  state.pax_child = paxChild;
  state.step = 'special_requests';
  await saveWizardState(supabase, phone, agency_id, state);
  
  let message = `✅ *Kişi Sayısı Kaydedildi*\n\n`;
  message += `👥 ${paxAdult} Yetişkin`;
  if (paxChild > 0) {
    message += ` + ${paxChild} Çocuk`;
  }
  message += `\n\n`;
  
  message += `💰 *Toplam Fiyat:* ${formatPrice(totalPrice)} ${state.selected_tour.currency}\n\n`;
  
  message += `📝 *Özel İstekler*\n\n`;
  message += `Özel bir isteğiniz var mı?\n`;
  message += `(Diyet, ulaşım, vb.)\n\n`;
  message += `• Varsa yazın\n`;
  message += `• Yoksa "yok" yazın\n\n`;
  message += `_İptal etmek için "iptal" yazın_`;
  
  return message;
}

// Özel istekler adımı
async function handleSpecialRequests(
  supabase: any,
  phone: string,
  agency_id: string,
  userMessage: string,
  state: WizardState,
  userLanguage: string = 'tr'
): Promise<string> {
  const lowerMessage = userMessage.toLowerCase().trim();
  
  // Özel istek kaydet
  if (lowerMessage !== 'yok' && lowerMessage !== 'hayır') {
    state.special_requests = userMessage;
  }
  
  state.step = 'confirmation';
  await saveWizardState(supabase, phone, agency_id, state);
  
  // Özet göster
  const depDate = new Date(state.selected_date.departure_date).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  
  let totalPrice = state.pax_adult! * state.selected_date.price_adult;
  if (state.pax_child && state.pax_child > 0 && state.selected_date.price_child) {
    totalPrice += state.pax_child * state.selected_date.price_child;
  }
  if (state.pax_adult === 1 && (!state.pax_child || state.pax_child === 0) && state.selected_date.price_single) {
    totalPrice += state.selected_date.price_single;
  }
  
  let message = `📋 *REZERVASYON ÖZETİ*\n`;
  message += `${'═'.repeat(30)}\n\n`;
  
  message += `🎯 *Tur:* ${state.selected_tour.title}\n`;
  message += `📍 *Destinasyon:* ${state.selected_tour.destination}\n`;
  message += `📅 *Tarih:* ${depDate}\n`;
  message += `👥 *Kişi:* ${state.pax_adult} Yetişkin`;
  if (state.pax_child && state.pax_child > 0) {
    message += ` + ${state.pax_child} Çocuk`;
  }
  message += `\n\n`;
  
  if (state.special_requests) {
    message += `📝 *Özel İstek:* ${state.special_requests}\n\n`;
  }
  
  message += `💰 *TOPLAM FİYAT:* \`${formatPrice(totalPrice)} ${state.selected_tour.currency}\`\n\n`;
  message += `${'═'.repeat(30)}\n\n`;
  
  message += `✅ *Onaylamak için "onayla" yazın*\n`;
  message += `❌ *İptal etmek için "iptal" yazın*`;
  
  return message;
}

  // Onay adımı
async function handleConfirmation(
  supabase: any,
  phone: string,
  agency_id: string,
  userMessage: string,
  state: WizardState,
  userLanguage: string = 'tr'
): Promise<string> {
  const lowerMessage = userMessage.toLowerCase().trim();
  
  if (lowerMessage !== 'onayla' && lowerMessage !== 'evet' && lowerMessage !== 'tamam') {
    return '❌ Lütfen "onayla" yazarak rezervasyonu onaylayın.\n\n_İptal etmek için "iptal" yazın_';
  }
  
  // Kontenjan kontrolü
  const { data: currentQuota, error: quotaCheckError } = await supabase
    .from('tour_dates')
    .select('quota')
    .eq('id', state.selected_date.id)
    .single();

  if (quotaCheckError) {
    console.error('Quota check error:', quotaCheckError);
    await clearWizardState(supabase, phone, agency_id);
    return '❌ Kontenjan kontrolü yapılamadı. Lütfen tekrar deneyin.';
  }

  const totalPax = state.pax_adult! + (state.pax_child || 0);
  if (currentQuota.quota < totalPax) {
    await clearWizardState(supabase, phone, agency_id);
    return `❌ *Kontenjan Yetersiz*\n\nMaalesef bu tarih için sadece ${currentQuota.quota} kişilik yer kalmıştır.\n\n🔍 Başka bir tarih seçmek ister misiniz?\n_"Rezervasyon yap" yazarak yeniden başlayabilirsiniz._`;
  }
  
  // Rezervasyon oluştur
  try {
    const userProfile = await getUserProfile(supabase, phone, agency_id);
    
    const { data: registration, error } = await supabase
      .from('registrations')
      .insert({
        tour_id: state.selected_tour.id,
        tour_date_id: state.selected_date.id,
        full_name: userProfile?.full_name || 'WhatsApp Kullanıcısı',
        phone: phone,
        pax: totalPax,
        status: 'NEW',
        note: `WhatsApp Wizard Rezervasyon\nYetişkin: ${state.pax_adult}\nÇocuk: ${state.pax_child || 0}\nÖzel İstek: ${state.special_requests || 'Yok'}`,
        agency_id: agency_id
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Kontenjandan düş
    await supabase
      .from('tour_dates')
      .update({ quota: currentQuota.quota - totalPax })
      .eq('id', state.selected_date.id);
    
    // Wizard state'i temizle
    await clearWizardState(supabase, phone, agency_id);
    
    const depDate = new Date(state.selected_date.departure_date).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    
    let totalPrice = state.pax_adult! * state.selected_date.price_adult;
    if (state.pax_child && state.pax_child > 0 && state.selected_date.price_child) {
      totalPrice += state.pax_child * state.selected_date.price_child;
    }
    if (state.pax_adult === 1 && (!state.pax_child || state.pax_child === 0) && state.selected_date.price_single) {
      totalPrice += state.selected_date.price_single;
    }
    
    let message = `🎉 *REZERVASYON TAMAMLANDI!*\n\n`;
    message += `✅ Rezervasyonunuz başarıyla oluşturuldu.\n\n`;
    message += `📋 *Rezervasyon No:* ${registration.id.substring(0, 8)}\n`;
    message += `🎯 *Tur:* ${state.selected_tour.title}\n`;
    message += `📅 *Tarih:* ${depDate}\n`;
    message += `👥 *Kişi Sayısı:* ${state.pax_adult! + (state.pax_child || 0)}\n`;
    message += `💰 *Toplam:* ${formatPrice(totalPrice)} ${state.selected_tour.currency}\n\n`;
    message += `📞 *Kısa süre içinde sizinle iletişime geçeceğiz.*\n\n`;
    message += `🙏 Bizi tercih ettiğiniz için teşekkür ederiz!`;
    
    return message;
    
  } catch (error) {
    console.error('Registration error:', error);
    await clearWizardState(supabase, phone, agency_id);
    return '❌ Rezervasyon oluşturulurken bir hata oluştu.\n\nLütfen tekrar deneyin veya bizimle iletişime geçin.';
  }
}

// Fiyat formatlama
function formatPrice(price: number): string {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
}

// Kullanıcı profili oluştur/güncelle
async function upsertUserProfile(supabase: any, phone: string, agency_id: string, userMessage?: string, enabledLanguages: string[] = []) {
  try {
    // Kullanıcı profilini kontrol et
    const { data: existingProfile } = await supabase
      .from('whatsapp_user_profiles')
      .select('*')
      .eq('phone', phone)
      .eq('agency_id', agency_id)
      .single();

    if (existingProfile) {
      // Profili güncelle - mesaj sayısını artır ve son etkileşim tarihini güncelle
      const updates: any = {
        total_messages: existingProfile.total_messages + 1,
        last_interaction_at: new Date().toISOString()
      };
      
      // İlk 3 mesajda dil algılama yap
      if (existingProfile.total_messages < 3 && !existingProfile.language_preference && userMessage) {
        const detectedLanguage = await detectLanguage(userMessage);
        if (detectedLanguage) {
          // Aktif dil kontrolü
          if (enabledLanguages.length > 0 && !enabledLanguages.includes(detectedLanguage)) {
            console.log(`Detected language ${detectedLanguage} is not enabled. Enabled languages:`, enabledLanguages);
            // Varsayılan olarak ilk aktif dili kullan
            updates.language_preference = enabledLanguages[0];
            console.log('Using first enabled language:', enabledLanguages[0]);
          } else {
            updates.language_preference = detectedLanguage;
            console.log('Language detected and saved:', detectedLanguage);
          }
        }
      }
      
      await supabase
        .from('whatsapp_user_profiles')
        .update(updates)
        .eq('phone', phone)
        .eq('agency_id', agency_id);
    } else {
      // Yeni profil oluştur
      const newProfile: any = {
        phone,
        agency_id,
        total_messages: 1
      };
      
      // İlk mesajdan dil algıla
      if (userMessage) {
        const detectedLanguage = await detectLanguage(userMessage);
        if (detectedLanguage) {
          // Aktif dil kontrolü
          if (enabledLanguages.length > 0 && !enabledLanguages.includes(detectedLanguage)) {
            console.log(`Detected language ${detectedLanguage} is not enabled. Enabled languages:`, enabledLanguages);
            // Varsayılan olarak ilk aktif dili kullan
            newProfile.language_preference = enabledLanguages[0];
            console.log('Using first enabled language for new user:', enabledLanguages[0]);
          } else {
            newProfile.language_preference = detectedLanguage;
            console.log('Language detected for new user:', detectedLanguage);
          }
        }
      }
      
      await supabase
        .from('whatsapp_user_profiles')
        .insert(newProfile);
    }
  } catch (error) {
    console.error('Error upserting user profile:', error);
  }
}

// Mesajdan dil algılama
async function detectLanguage(message: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_AI_API_KEY')}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('SUPABASE_URL') || '',
        'X-Title': 'Turzz WhatsApp Bot'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `Sen bir dil algılama asistanısın. Kullanıcının mesajından hangi dilde yazıldığını tespit et.
            
Desteklenen diller ve kodları:
- tr: Türkçe
- en: İngilizce
- de: Almanca
- ru: Rusça
- ar: Arapça
- fr: Fransızca
- es: İspanyolca

Sadece dil kodunu döndür (örn: "tr", "en", "de"). Başka açıklama ekleme.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      console.error('Language detection API error:', await response.text());
      return null;
    }

    const data = await response.json();
    const detectedLang = data.choices[0]?.message?.content?.trim().toLowerCase();
    
    // Geçerli bir dil kodu olup olmadığını kontrol et
    const validLanguages = ['tr', 'en', 'de', 'ru', 'ar', 'fr', 'es'];
    if (detectedLang && validLanguages.includes(detectedLang)) {
      return detectedLang;
    }
    
    return null;
  } catch (error) {
    console.error('Error detecting language:', error);
    return null;
  }
}

// Kullanıcı tercihlerini güncelle
async function updateUserPreferences(
  supabase: any,
  phone: string,
  agency_id: string,
  updates: {
    full_name?: string;
    last_search_query?: string;
    preferred_destinations?: string[];
    budget_range?: string;
    preferred_tour_type?: string;
  }
) {
  try {
    await supabase
      .from('whatsapp_user_profiles')
      .update(updates)
      .eq('phone', phone)
      .eq('agency_id', agency_id);
  } catch (error) {
    console.error('Error updating user preferences:', error);
  }
}

// Sistem mesajlarını çok dilli formatlama
async function formatSystemMessage(
  messageType: string,
  data: Record<string, any>,
  userLanguage: string = 'tr'
): Promise<string> {
  const languageNames: Record<string, string> = {
    'tr': 'Turkish', 'en': 'English', 'de': 'German',
    'ru': 'Russian', 'ar': 'Arabic', 'fr': 'French', 'es': 'Spanish'
  };
  const languageName = languageNames[userLanguage] || 'Turkish';
  
  const templates: Record<string, string> = {
    subscription_expired: `Create a message in ${languageName} saying the service is currently inactive and they should contact the agency admin for details. Use WhatsApp format and ⚠️ emoji.`,
    
    wizard_cancel: `Create a friendly cancellation message in ${languageName} saying the reservation was cancelled and asking how you can help. Use ❌ and 💬 emojis.`,
    
    wizard_tour_selection_start: `Create a message in ${languageName} for starting a reservation. Show ${data.tourCount} tours with numbers. Include title and price for each. End with instructions to select by number or cancel with "iptal". Use 🎯 emoji. Format:
Tours: ${JSON.stringify(data.tours, null, 2)}`,
    
    wizard_tour_selection_invalid: `Create an error message in ${languageName} asking for a valid tour number. Use ❌ emoji and mention "iptal" to cancel.`,
    
    wizard_tour_not_found: `Create an error message in ${languageName} saying no tour found and they should search first (example: "Cappadocia tours"). Use ❌ emoji.`,
    
    wizard_date_selection: `Create a message in ${languageName} showing available dates for ${data.tourTitle}. List ${data.dateCount} dates with numbers, prices, and quotas. Ask to select by number. Use ✅, 📅, 💰 emojis.
Dates: ${JSON.stringify(data.dates, null, 2)}
Currency: ${data.currency}`,
    
    wizard_date_invalid: `Create an error message in ${languageName} asking for a valid date number (1-${data.max}). Use ❌ emoji.`,
    
    wizard_pax_selection: `Create a message in ${languageName} asking for number of people. Show selected date: ${data.date}. Show pricing: Adult ${data.priceAdult} ${data.currency}, Child ${data.priceChild || 'N/A'} ${data.currency}, Single ${data.priceSingle || 'N/A'} ${data.currency}. Give examples of input formats. Use ✅, 👥, 💰 emojis.`,
    
    wizard_pax_invalid: `Create an error message in ${languageName} asking for valid number of people with example format. Use ❌ emoji.`,
    
    wizard_pax_exceeds: `Create an error message in ${languageName} saying total people (${data.total}) exceeds quota (${data.quota}). Use ❌ emoji.`,
    
    wizard_special_requests: `Create a message in ${languageName} confirming ${data.paxAdult} adults${data.paxChild > 0 ? ` + ${data.paxChild} children` : ''} with total price ${data.totalPrice} ${data.currency}. Ask for special requests or write "yok" if none. Use ✅, 💰, 📝 emojis.`,
    
    wizard_confirmation_summary: `Create a reservation summary in ${languageName}:
Tour: ${data.tourTitle}
Destination: ${data.destination}
Date: ${data.date}
People: ${data.paxAdult} adults${data.paxChild > 0 ? ` + ${data.paxChild} children` : ''}
Special requests: ${data.specialRequests || 'None'}
Total price: ${data.totalPrice} ${data.currency}

Ask to confirm with "onayla" or cancel with "iptal". Use 📋, 🎯, 📅, 👥, 💰, ✅, ❌ emojis.`,
    
    wizard_confirm_invalid: `Create an error message in ${languageName} asking to write "onayla" to confirm. Use ❌ emoji.`,
    
    wizard_quota_insufficient: `Create an error message in ${languageName} saying only ${data.remainingQuota} spots left for this date and suggesting to pick another date. Use ❌, 🔍 emojis.`,
    
    wizard_confirmation_success: `Create a success message in ${languageName}:
Reservation ID: ${data.reservationId}
Tour: ${data.tourTitle}
Date: ${data.date}
People: ${data.totalPax}
Total: ${data.totalPrice} ${data.currency}

Say they'll be contacted soon and thank them. Use 🎉, ✅, 📋, 🎯, 📅, 👥, 💰, 📞, 🙏 emojis.`,
    
    wizard_confirmation_error: `Create an error message in ${languageName} saying reservation creation failed and to try again or contact them. Use ❌ emoji.`,
    
    registration_success: `Create a success message in ${languageName}:
Registration ID: ${data.registrationId}
Tour: ${data.tourTitle}
Destination: ${data.destination}
Date: ${data.date}
Name: ${data.fullName}
Phone: ${data.phone}
People: ${data.pax}

Say pre-registration is successful and they'll be contacted soon. Use ✅, 📋, 🎯, 📍, 📅, 👤, 📱, 👥, ✨, 📞 emojis.`,
  };
  
  const prompt = templates[messageType];
  if (!prompt) {
    console.error('Unknown message type:', messageType);
    return 'Message format error';
  }
  
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ 
          role: 'user', 
          content: `${prompt}\n\nUse WhatsApp format (*bold*, _italic_). Keep it natural and conversational.` 
        }],
        temperature: 0.7
      })
    });
    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error) {
    console.error('Error formatting system message:', error);
    return 'Error creating message';
  }
}

// Kullanıcı profilini al
async function getUserProfile(supabase: any, phone: string, agency_id: string) {
  try {
    const { data, error } = await supabase
      .from('whatsapp_user_profiles')
      .select('*')
      .eq('phone', phone)
      .eq('agency_id', agency_id)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return null;
  }
}

// Gelişmiş konuşma geçmişi - kullanıcı profili ile birlikte
async function getConversationHistory(supabase: any, phone: string, agency_id: string, limit: number = 20) {
  try {
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('role, content')
      .eq('phone', phone)
      .eq('agency_id', agency_id)
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

// Konuşma özeti oluştur (günün sonunda veya uzun konuşmalarda)
async function createConversationSummary(
  supabase: any,
  phone: string,
  agency_id: string
) {
  try {
    // Son 24 saatin mesajlarını al
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data: messages } = await supabase
      .from('whatsapp_conversations')
      .select('role, content, created_at')
      .eq('phone', phone)
      .eq('agency_id', agency_id)
      .gte('created_at', oneDayAgo.toISOString())
      .order('created_at', { ascending: true });

    if (!messages || messages.length === 0) return;

    // AI ile özet oluştur
    const conversationText = messages
      .map((m: any) => `${m.role}: ${m.content}`)
      .join('\n');

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
            content: `Aşağıdaki WhatsApp konuşmasını analiz et ve şunları belirle:
1. Konuşmanın kısa özeti (1-2 cümle)
2. Ana konular (array olarak)
3. Bahsedilen tur isimleri (array olarak)
4. Kullanıcının genel duygu durumu (positive/neutral/negative)

JSON formatında döndür:
{
  "summary": "string",
  "topics": ["string"],
  "mentioned_tours": ["string"],
  "sentiment": "string"
}`
          },
          {
            role: 'user',
            content: conversationText
          }
        ],
        temperature: 0.3
      })
    });

    const result = await aiResponse.json();
    let analysis = result.choices[0].message.content.trim();
    
    // JSON wrapper'ı temizle
    if (analysis.startsWith('```json')) {
      analysis = analysis.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    }
    
    const parsed = JSON.parse(analysis);

    // Özeti kaydet
    await supabase
      .from('whatsapp_conversation_summaries')
      .insert({
        phone,
        agency_id,
        summary: parsed.summary,
        topics: parsed.topics,
        mentioned_tours: parsed.mentioned_tours,
        sentiment: parsed.sentiment,
        message_count: messages.length
      });

  } catch (error) {
    console.error('Error creating conversation summary:', error);
  }
}

// Mesaj limiti kontrolü
async function checkMessageLimit(supabase: any, agency: any): Promise<boolean> {
  try {
    // Enterprise planı için sınırsız (-1)
    if (agency.message_limit === -1) {
      return false;
    }
    
    // Ay değişmişse sayacı sıfırla
    const lastReset = new Date(agency.last_message_reset_date);
    const now = new Date();
    
    if (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
      await supabase
        .from('agencies')
        .update({
          monthly_message_count: 0,
          last_message_reset_date: now.toISOString()
        })
        .eq('id', agency.id);
      
      return false; // Yeni ay, limit yok
    }
    
    // Mevcut mesaj sayısını kontrol et
    return agency.monthly_message_count >= agency.message_limit;
  } catch (error) {
    console.error('Error checking message limit:', error);
    return false; // Hata durumunda mesaja izin ver
  }
}

// Mesaj sayacını artır
async function incrementMessageCount(supabase: any, agency_id: string) {
  try {
    // Manuel increment kullan
    const { data: agency } = await supabase
      .from('agencies')
      .select('monthly_message_count')
      .eq('id', agency_id)
      .single();
    
    if (agency) {
      await supabase
        .from('agencies')
        .update({ monthly_message_count: (agency.monthly_message_count || 0) + 1 })
        .eq('id', agency_id);
    }
  } catch (error) {
    console.error('Error incrementing message count:', error);
  }
}
