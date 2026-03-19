import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { faqId, sourceLanguage, targetLanguages } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get source FAQ
    const { data: sourceFaq, error: fetchError } = await supabase
      .from("faq_templates")
      .select("*")
      .eq("id", faqId)
      .single();

    if (fetchError || !sourceFaq) {
      throw new Error("FAQ not found");
    }

    const translations = [];

    // Translate to each target language
    for (const targetLang of targetLanguages) {
      if (targetLang === sourceLanguage) continue;

      const languageNames: Record<string, string> = {
        tr: "Turkish",
        en: "English",
        de: "German",
        ru: "Russian",
        ar: "Arabic",
        fr: "French",
        es: "Spanish",
      };

      const prompt = `Translate the following FAQ from ${languageNames[sourceLanguage]} to ${languageNames[targetLang]}.

Question: ${sourceFaq.question}
Answer: ${sourceFaq.answer}
Keywords: ${sourceFaq.keywords?.join(", ") || ""}

Return ONLY a JSON object with this exact structure (no markdown, no code blocks):
{
  "question": "translated question",
  "answer": "translated answer",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: "You are a professional translator. Always respond with valid JSON only, no markdown formatting.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!aiResponse.ok) {
        console.error(`Translation failed for ${targetLang}:`, await aiResponse.text());
        continue;
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices[0].message.content.trim();
      
      // Remove markdown code blocks if present
      let jsonContent = content;
      if (content.startsWith("```")) {
        jsonContent = content.replace(/```json?\n?/g, "").replace(/```\n?$/g, "").trim();
      }

      const translated = JSON.parse(jsonContent);

      // Insert translated FAQ
      const { error: insertError } = await supabase.from("faq_templates").insert({
        agency_id: sourceFaq.agency_id,
        question: translated.question,
        answer: translated.answer,
        keywords: translated.keywords || [],
        language: targetLang,
        category: sourceFaq.category,
        is_active: sourceFaq.is_active,
      });

      if (insertError) {
        console.error(`Insert failed for ${targetLang}:`, insertError);
        continue;
      }

      translations.push({ language: targetLang, ...translated });
    }

    return new Response(
      JSON.stringify({ success: true, translations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Translation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
