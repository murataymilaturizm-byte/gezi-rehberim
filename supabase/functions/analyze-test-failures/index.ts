import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { failedTests } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build analysis prompt
    const systemPrompt = `Sen bir test analiz uzmanısın. Demo ve WhatsApp entegrasyonları arasındaki farklılıkları analiz edip düzeltme önerileri sunuyorsun.

Başarısız testler için:
1. Sorunun nedenini açıkla
2. Hangi kod dosyalarının güncellenmesi gerektiğini belirt
3. Somut düzeltme adımları sun
4. Öncelik seviyesi ver (critical, high, medium, low)`;

    const userPrompt = `Aşağıdaki testler başarısız oldu. Her biri için detaylı analiz ve düzeltme önerisi sun:

${failedTests.map((test: any, i: number) => `
Test ${i + 1}: ${test.name}
Kategori: ${test.category}
Demo Sonuç: ${test.demoResult}
WhatsApp Sonuç: ${test.whatsappResult}
Detaylar: ${test.details}
Demo Data: ${JSON.stringify(test.demoData, null, 2)}
WhatsApp Data: ${JSON.stringify(test.whatsappData, null, 2)}
`).join('\n---\n')}

Her test için şu yapıyı kullan:
{
  "testName": "test adı",
  "problem": "sorunun açıklaması",
  "affectedFiles": ["dosya1.ts", "dosya2.ts"],
  "fixSteps": ["adım 1", "adım 2"],
  "priority": "critical|high|medium|low",
  "codeExample": "örnek kod düzeltmesi"
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'analyze_failures',
            description: 'Başarısız testleri analiz et ve düzeltme önerileri sun',
            parameters: {
              type: 'object',
              properties: {
                analyses: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      testName: { type: 'string' },
                      problem: { type: 'string' },
                      affectedFiles: {
                        type: 'array',
                        items: { type: 'string' }
                      },
                      fixSteps: {
                        type: 'array',
                        items: { type: 'string' }
                      },
                      priority: {
                        type: 'string',
                        enum: ['critical', 'high', 'medium', 'low']
                      },
                      codeExample: { type: 'string' }
                    },
                    required: ['testName', 'problem', 'affectedFiles', 'fixSteps', 'priority']
                  }
                }
              },
              required: ['analyses']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'analyze_failures' } }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const analyses = JSON.parse(toolCall.function.arguments).analyses;

    return new Response(
      JSON.stringify({ analyses }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Analyze test failures error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});