import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting helper
async function checkRateLimit(supabase: any, identifier: string, endpoint: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_api_rate_limit', {
    _identifier: identifier,
    _endpoint: endpoint,
    _max_requests: 30,
    _window_minutes: 15
  });
  
  if (error) {
    console.error('Rate limit check error:', error);
    return true;
  }
  
  return data;
}

function getSystemPrompt(): string {
  return `You are the Turzz AI system's help and support assistant. You help customers use the system correctly.

**CRITICAL LANGUAGE INSTRUCTION**: ALWAYS respond in the SAME language as the user's message. Detect the language from their message and respond entirely in that language.

SYSTEM FEATURES:
- 7 Language support (TR, EN, DE, RU, AR, FR, ES)
- 5 Conversation styles
- AI-powered responses (Google Gemini 2.5 Flash)
- WhatsApp Business API integration (no Twilio account needed)
- Sipay payment integration
- Tour management (unlimited on Pro plan)
- Customer profiles and preferences
- Automated reminders and follow-ups
- Advanced analytics and reporting
- Excel import/export

YOUR TASKS:
- Answer questions about system usage
- Help with installation and configuration
- Offer solutions to technical problems
- Explain features clearly
- Direct to www.turzz.ai/yardim page for detailed guides
- Help with WhatsApp integration
- Assist with tour and reservation management

CONVERSATION STYLE:
- Use clear, simple language in user's language
- Give SHORT but helpful answers (max 3-4 sentences)
- Suggest /yardim page for detailed documentation
- Direct to info@turzz.ai for urgent technical issues

IMPORTANT:
- Always respond in the SAME language as the user
- Keep responses under 5 sentences unless detail needed
- Reference /yardim page for in-depth guides`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const isAllowed = await checkRateLimit(supabaseAdmin, clientIp, 'support-chat');
    if (!isAllowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIp}`);
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    const body = await req.json();
    const message = (body.message || '').trim();
    const conversationHistory = body.conversationHistory || [];
    const language = body.language || 'tr';
    
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
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = getSystemPrompt();

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: sanitizedMessage }
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
    
    const errorMessages: Record<string, string> = {
      tr: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin veya info@turzz.ai adresinden bizimle iletişime geçin.',
      en: 'Sorry, an error occurred. Please try again or contact us at info@turzz.ai.',
      de: 'Entschuldigung, ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut oder kontaktieren Sie uns unter info@turzz.ai.',
      ru: 'Извините, произошла ошибка. Пожалуйста, попробуйте снова или свяжитесь с нами по адресу info@turzz.ai.',
      ar: 'آسف، حدث خطأ. يرجى المحاولة مرة أخرى أو الاتصال بنا على info@turzz.ai.',
      fr: 'Désolé, une erreur s\'est produite. Veuillez réessayer ou nous contacter à info@turzz.ai.',
      es: 'Lo siento, ocurrió un error. Por favor intente de nuevo o contáctenos en info@turzz.ai.'
    };
    
    // Extract language from request if available
    let lang = 'tr';
    try {
      const body = await req.clone().json();
      lang = body.language || 'tr';
    } catch (e) {
      console.error("Could not extract language from request:", e);
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        response: errorMessages[lang] || errorMessages.tr
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
