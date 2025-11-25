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

  let language = 'tr';

  try {
    const body = await req.json();
    const message = (body.message || '').trim();
    const conversationHistory = body.conversationHistory || [];
    language = body.language || 'tr';
    
    if (!message || message.length < 1 || message.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Invalid message length' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    const sanitizedMessage = message
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are Turzz AI's sales assistant helping tourism agencies with WhatsApp automation.

**ALWAYS respond in the SAME language as the user's message.**

FEATURES:
- 7/24 WhatsApp automation with AI (Google Gemini 2.5 Flash)
- 7 language support
- Smart reservation wizard
- Payment integration (Sipay)
- Customer profiles and analytics
- Automated reminders

PRICING (14-day free trial, no credit card):
STARTER: 2,999 TL/month (500 messages, 5 tours, 2 languages)
PROFESSIONAL: 7,999 TL/month (2,000 messages, unlimited tours, 7 languages)

SETUP (5-10 minutes):
1. Register at www.turzz.ai/admin
2. Choose plan
3. Connect WhatsApp number (no Twilio needed!)
4. Add tours
5. Done!

TASKS:
- Explain features clearly
- Collect demo requests
- Emphasize free trial
- Keep answers SHORT (3-4 sentences max)
- Direct to www.turzz.ai/yardim for help`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      { role: "user", content: sanitizedMessage }
    ];

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
      console.error("AI API error:", response.status, errorText);
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error("Error in sales-chat function:", error);
    
    const errorMessages: Record<string, string> = {
      tr: "Üzgünüm, bir sorun yaşıyorum. Lütfen info@turzz.ai adresinden bizimle iletişime geçin.",
      en: "Sorry, I'm experiencing an issue. Please contact us at info@turzz.ai.",
    };
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        response: errorMessages[language] || errorMessages.tr
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  }
});
