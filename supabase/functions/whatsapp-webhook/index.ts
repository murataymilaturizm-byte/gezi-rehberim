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
    
    // Bu Twilio numarasına sahip acente'yi bul
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('*')
      .eq('twilio_phone_number', twilioPhone)
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
      
      const expiredMessage = '⚠️ Bu hizmet şu anda aktif değil.\n\n📞 Detaylı bilgi için lütfen acente yöneticinizle iletişime geçin.';
      
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
    
    // Kullanıcı profilini oluştur/güncelle
    await upsertUserProfile(supabase, userPhone, agency.id);
    
    // Kullanıcı mesajını kaydet (agency_id ile)
    await saveMessage(supabase, userPhone, 'user', userMessage, agency.id);

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
      
      // Wizard state'i oluştur
      const wizardState: WizardState = {
        step: 'tour_selection',
        created_at: new Date().toISOString()
      };
      
      await saveWizardState(supabase, userPhone, agency.id, wizardState);
      
      let message = '🎯 *Harika! Rezervasyon yapalım!*\n\n';
      message += 'Son arama sonuçlarınızdan bir tur seçin:\n\n';
      
      tours.slice(0, 5).forEach((tour: any, idx: number) => {
        message += `${idx + 1}. *${tour.title}*\n`;
        if (tour.dates && tour.dates.length > 0) {
          message += `   💰 ${formatPrice(tour.dates[0].price_adult)} ${tour.currency}/kişi\n`;
        }
        message += '\n';
      });
      
      message += '\n💡 *Tur seçmek için numara yazın* (örn: 1)\n';
      message += '_İptal etmek için "iptal" yazın_';
      
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
      
      // WhatsApp formatında cevap oluştur
      const message = formatWhatsAppResponse(tours, {});
      
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
      const chatResponse = await handleGeneralChat(userMessage, userPhone, supabase, agency.id);
      
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

async function handleGeneralChat(userMessage: string, userPhone: string, supabase: any, agency_id: string) {
  // Kullanıcı profilini al
  const userProfile = await getUserProfile(supabase, userPhone, agency_id);
  
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
      content: `Sen bir tur acentesinin samimi ve enerjik WhatsApp asistanısın. 🌟

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

${contextInfo}

🔑 ÖNEMLİ KURALLAR:
• Kullanıcıyı tanıyorsan ismini kullan, daha kişisel ol
• Daha önce ilgilendiği turlara benzer şeyler öner
• Konuşma geçmişi varsa tekrar selamlaşma, direkt devam et
• Kullanıcı tercihlerini hatırla, ona özel önerilerde bulun
• Bütçe bilgisi varsa buna uygun turlar sun
• Fiyatları *kalın* yazarak vurgula
• Önemli bilgileri WhatsApp formatıyla vurgula

📝 MESAJ ÖRNEKLERİ:
"Selam! 👋 Kapadokya turlarımıza baktığını görüyorum. Sana *özel fiyatlar* var!"
"Harika seçim! ✨ Bu tarihte *3 kişilik yerimiz* var, hemen ayırtabilirsin."
"Anlıyorum 🤔 Bütçe önemli. Sana daha _uygun fiyatlı_ alternatiflere bakalım mı?"`
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
      temperature: 0.7
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
      content: `Sen bir tur arama asistanısın. Kullanıcının mesajını ve önceki konuşma geçmişini analiz edip hangi turları aradığını belirle.

${userContext}

Turlar: ${JSON.stringify(toursList, null, 2)}

Kullanıcının mesajından:
- Hangi destinasyonu aradığını (Kapadokya, Efes, Pamukkale, vb)
- Hangi tür turu aradığını (günübirlik, 2 gece, 3 gece)
- Hangi tarihi aradığını (varsa)
- Bütçe beklentisi (varsa)

Eşleşen turların ID'lerini JSON array olarak döndür. SADECE JSON array döndür, başka hiçbir şey yazma.
Örnek: ["id1", "id2"]
Eğer hiçbir tur eşleşmezse boş array döndür: []

ÖNEMLİ: 
- Sadece JSON array döndür, markdown formatı kullanma!
- Kullanıcı profilindeki tercihleri dikkate al
- Önceki aramalara benzer turları da öncelikli olarak ekle`
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

    // Kullanıcı profilini güncelle - isim ve tur tercihlerini kaydet
    const userPhone = from.replace('whatsapp:', '');
    await updateUserPreferences(supabase, userPhone, agency_id, {
      full_name: entities.full_name,
      preferred_destinations: [tourDate.tours.destination]
    });

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
    
    // Agency bilgisini al
    const { data: agency } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', agency_id)
      .single();
    
    if (agency) {
      sendWhatsAppMessage(userPhone, message, agency).catch(err => {
        console.error('WhatsApp mesajı gönderilemedi:', err);
      });
    }

    return { message };
  } catch (error) {
    console.error('Create registration error:', error);
    return { error: 'Beklenmeyen bir hata oluştu.' };
  }
}

// WhatsApp mesajı gönderme - zengin medya desteği ile
async function sendWhatsAppMessage(
  to: string, 
  message: string, 
  agency: any,
  mediaUrls?: string[]
) {
  const accountSid = agency.twilio_account_sid;
  const authToken = agency.twilio_auth_token;
  const twilioPhone = agency.twilio_phone_number;

  if (!accountSid || !authToken || !twilioPhone) {
    console.error('Twilio credentials eksik');
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = btoa(`${accountSid}:${authToken}`);
  
  const bodyParams: Record<string, string> = {
    From: `whatsapp:${twilioPhone}`,
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

// WhatsApp formatı ile zenginleştirilmiş tur yanıtları
function formatWhatsAppResponse(tours: any[], entities: any) {
  if (tours.length === 0) {
    const message = 'Hmm... 🤔 Bu kriterlere tam uygun bir tur bulamadım.\n\n' +
      '*Ama hemen pes etmeyelim!* 💪\n\n' +
      '✨ Belki başka bir tarih?\n' +
      '✨ Farklı bir destinasyon?\n' +
      '✨ Başka tur tipi? (günübirlik, 2-3 gün)\n\n' +
      '_Ara beni_ 📞 _sana özel bi tur planı yapalım!_';
    
    return message + createQuickReplyButtons([
      { text: 'Tüm turları göster', emoji: '🗺️' },
      { text: 'Danışman ile görüş', emoji: '👤' }
    ]);
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  let response = tours.length === 1 
    ? `Bak ne buldum! 🎯 *Tam sana göre bir tur!*\n\n`
    : `Harika haber! ✨ *${tours.length} süper tur* buldum sana!\n\n`;

  tours.slice(0, 3).forEach((tour, index) => {
    // Tur başlığı - bold
    response += `*${index + 1}. ${tour.title}*\n`;
    response += `📍 ${tour.destination}\n`;
    
    // Kısa açıklama - italik ve doğal
    if (tour.program_kisa) {
      response += `_${tour.program_kisa}_\n`;
    }
    response += '\n';
    
    // Tarih ve fiyat bilgileri
    if (tour.dates && tour.dates.length > 0) {
      const firstDate = tour.dates[0];
      const depDate = new Date(firstDate.departure_date).toLocaleDateString('tr-TR', { 
        day: 'numeric', 
        month: 'short'
      });
      
      // Tarih
      if (firstDate.return_date && firstDate.return_date !== firstDate.departure_date) {
        const retDate = new Date(firstDate.return_date).toLocaleDateString('tr-TR', { 
          day: 'numeric', 
          month: 'short' 
        });
        response += `📅 ${depDate} - ${retDate}`;
      } else {
        response += `📅 ${depDate}`;
      }
      
      if (tour.tur_sure) {
        response += ` • ${tour.tur_sure}`;
      }
      response += '\n';
      
      // Fiyat - vurgulu ve doğal
      response += `💰 *${formatPrice(firstDate.price_adult)} ${tour.currency}* kişi başı\n`;
      
      // Kontenjan - emoji ile durum
      if (firstDate.quota > 10) {
        response += `✅ Bol bol yer var (${firstDate.quota} kişi)\n`;
      } else if (firstDate.quota > 0) {
        response += `⚠️ Son ${firstDate.quota} kişilik yer!\n`;
      } else {
        response += `❌ Maalesef doldu 😔\n`;
      }
    } else {
      response += `⏳ _Tarihler yakında açıklanacak_\n`;
      response += `📞 Bize ulaş, seni haberdar edelim\n`;
    }
    
    // Gezilecek yerler - kısa ve öz
    if (tour.gezilecek_yerler) {
      const places = tour.gezilecek_yerler.split(',').slice(0, 3);
      response += `\n🗺️ *Neler göreceksin:*\n`;
      places.forEach((place: string) => {
        response += `  • ${place.trim()}\n`;
      });
      if (tour.gezilecek_yerler.split(',').length > 3) {
        response += `  _+ daha fazlası..._\n`;
      }
    }
    
    // Program linki
    if (tour.program_url) {
      response += `\n📋 Detaylı program → ${tour.program_url}\n`;
    }
    
    response += `\n${'─'.repeat(25)}\n\n`;
  });

  // Daha fazla tur varsa - doğal dil
  if (tours.length > 3) {
    response += `🎈 _Bunlar sadece ilk 3'ü! ${tours.length - 3} tur daha var._\n\n`;
  }

  // Call to action
  response += '✨ *Sonraki adım?*';
  response += createQuickReplyButtons([
    { text: 'Kayıt olmak istiyorum', emoji: '✅' },
    { text: 'Daha fazla bilgi', emoji: '📞' },
    { text: 'Başka turlar', emoji: '🔍' }
  ]);

  return response;
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
  
  await sendWhatsAppMessage(to, message, agency, mediaUrls);
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
  
  // İptal kontrolü
  if (lowerMessage === 'iptal' || lowerMessage === 'vazgeç') {
    await clearWizardState(supabase, phone, agency_id);
    return '❌ Rezervasyon iptal edildi.\n\n💬 Size başka nasıl yardımcı olabilirim?';
  }
  
  switch (state.step) {
    case 'tour_selection':
      return await handleTourSelection(supabase, phone, agency_id, userMessage, state);
    
    case 'date_selection':
      return await handleDateSelection(supabase, phone, agency_id, userMessage, state);
    
    case 'pax_selection':
      return await handlePaxSelection(supabase, phone, agency_id, userMessage, state);
    
    case 'special_requests':
      return await handleSpecialRequests(supabase, phone, agency_id, userMessage, state);
    
    case 'confirmation':
      return await handleConfirmation(supabase, phone, agency_id, userMessage, state);
    
    default:
      await clearWizardState(supabase, phone, agency_id);
      return 'Bir hata oluştu. Lütfen tekrar deneyin.';
  }
}

// Tur seçimi adımı
async function handleTourSelection(
  supabase: any,
  phone: string,
  agency_id: string,
  userMessage: string,
  state: WizardState
): Promise<string> {
  // Kullanıcı bir numara girdi mi?
  const tourNumber = parseInt(userMessage);
  
  if (isNaN(tourNumber) || tourNumber < 1) {
    return '❌ Lütfen geçerli bir tur numarası girin.\n\n_İptal etmek için "iptal" yazın_';
  }
  
  // Son tur aramayı al
  const history = await getConversationHistory(supabase, phone, agency_id, 5);
  const lastTourMessage = history.reverse().find((msg: any) => 
    msg.role === 'assistant' && msg.content.includes('Muhteşem Tur Buldum')
  );
  
  if (!lastTourMessage) {
    await clearWizardState(supabase, phone, agency_id);
    return '❌ Tur bulunamadı. Lütfen önce bir tur arayın.\n\nÖrnek: "Kapadokya turları"';
  }
  
  // Turun bilgilerini parse et (basitleştirilmiş - gerçekte daha iyi yapılmalı)
  const tours = await searchToursWithAI(supabase, 'son arama', phone, agency_id);
  
  if (tourNumber > tours.length) {
    return `❌ Geçersiz tur numarası. Lütfen 1-${tours.length} arası bir numara girin.`;
  }
  
  const selectedTour = tours[tourNumber - 1];
  
  // Tarihleri göster
  if (!selectedTour.dates || selectedTour.dates.length === 0) {
    await clearWizardState(supabase, phone, agency_id);
    return '❌ Bu tur için tarih bulunmuyor. Lütfen başka bir tur seçin.';
  }
  
  // State'i güncelle
  state.selected_tour = selectedTour;
  state.step = 'date_selection';
  await saveWizardState(supabase, phone, agency_id, state);
  
  // Tarihleri listele
  let message = `✅ *${selectedTour.title}* seçildi!\n\n`;
  message += `📅 *Müsait Tarihler:*\n\n`;
  
  selectedTour.dates.forEach((date: any, idx: number) => {
    const depDate = new Date(date.departure_date).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    message += `${idx + 1}. ${depDate} - ${formatPrice(date.price_adult)} ${selectedTour.currency}/kişi\n`;
    message += `   👥 ${date.quota} kişilik yer\n\n`;
  });
  
  message += `\n💡 *Tarih seçmek için numara yazın* (örn: 1)\n`;
  message += `_İptal etmek için "iptal" yazın_`;
  
  return message;
}

// Tarih seçimi adımı
async function handleDateSelection(
  supabase: any,
  phone: string,
  agency_id: string,
  userMessage: string,
  state: WizardState
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
  state: WizardState
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
  state: WizardState
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
  state: WizardState
): Promise<string> {
  const lowerMessage = userMessage.toLowerCase().trim();
  
  if (lowerMessage !== 'onayla' && lowerMessage !== 'evet' && lowerMessage !== 'tamam') {
    return '❌ Lütfen "onayla" yazarak rezervasyonu onaylayın.\n\n_İptal etmek için "iptal" yazın_';
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
        pax: state.pax_adult! + (state.pax_child || 0),
        status: 'NEW',
        note: `WhatsApp Wizard Rezervasyon\nYetişkin: ${state.pax_adult}\nÇocuk: ${state.pax_child || 0}\nÖzel İstek: ${state.special_requests || 'Yok'}`,
        agency_id: agency_id
      })
      .select()
      .single();
    
    if (error) throw error;
    
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
async function upsertUserProfile(supabase: any, phone: string, agency_id: string) {
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
      await supabase
        .from('whatsapp_user_profiles')
        .update({
          total_messages: existingProfile.total_messages + 1,
          last_interaction_at: new Date().toISOString()
        })
        .eq('phone', phone)
        .eq('agency_id', agency_id);
    } else {
      // Yeni profil oluştur
      await supabase
        .from('whatsapp_user_profiles')
        .insert({
          phone,
          agency_id,
          total_messages: 1
        });
    }
  } catch (error) {
    console.error('Error upserting user profile:', error);
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
    await supabase.rpc('increment', {
      table_name: 'agencies',
      column_name: 'monthly_message_count',
      row_id: agency_id
    }).catch(async () => {
      // RPC fonksiyonu yoksa manuel artır
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
    });
  } catch (error) {
    console.error('Error incrementing message count:', error);
  }
}
