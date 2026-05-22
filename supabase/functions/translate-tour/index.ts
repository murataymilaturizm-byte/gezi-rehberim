// translate-tour — Tek tıkla çoklu dil tur çevirisi (turizm bağlamı)
// translate-faq pattern'i ama: DB'ye YAZMAZ — sadece çeviriyi response'ta döner.
// Acente UI'da görür, düzenler, sonra kaydeder (otomatik kayıt YOK).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LANG_NAMES: Record<string, string> = {
  tr: "Turkish", en: "English", de: "German",
  ru: "Russian", ar: "Arabic", fr: "French", es: "Spanish",
};

interface TranslationRequest {
  title?: string;
  destination?: string;
  program_kisa?: string;
  sourceLanguage?: string; // varsayılan tr
  targetLanguages?: string[]; // varsayılan ["en","de","fr","es","ru","ar"]
}

interface TranslationResult {
  language: string;
  title?: string;
  destination?: string;
  program_kisa?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: TranslationRequest = await req.json();
    const sourceLanguage = body.sourceLanguage || "tr";
    const targetLanguages = body.targetLanguages || ["en", "de", "fr", "es", "ru", "ar"];

    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    // En az bir alan dolu olmalı
    const hasAny = !!(body.title?.trim() || body.destination?.trim() || body.program_kisa?.trim());
    if (!hasAny) {
      return new Response(
        JSON.stringify({ error: "At least one field (title, destination, or program_kisa) is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const translations: TranslationResult[] = [];

    for (const targetLang of targetLanguages) {
      if (targetLang === sourceLanguage) continue;

      const sourceLangName = LANG_NAMES[sourceLanguage] || "Turkish";
      const targetLangName = LANG_NAMES[targetLang] || targetLang;

      // Turizm bağlamı + özel isim koruma
      const prompt = `You are a professional translator specialized in Turkish tourism content.
Translate the following tour information from ${sourceLangName} to ${targetLangName}.

Rules:
- Use natural tourism industry terminology (e.g., "Balon Turu" → "Hot Air Balloon Tour" in English, "Heißluftballonfahrt" in German).
- Keep proper place names accurately localized (e.g., "Likya Yolu" → "Lycian Way" / "Lykischer Weg" / "Ликийская тропа").
- For ${targetLangName}, use the conventional spelling of Turkish destinations (Cappadocia/Kappadokien/Каппадокия/كابادوكيا, Ephesus/Ephesos/Эфес/أفسس).
- Keep tone professional and customer-facing.
- Do NOT add explanations, footnotes or extra prose.

Source content (${sourceLangName}):
- Title: ${body.title?.trim() || "(empty — skip in output)"}
- Destination: ${body.destination?.trim() || "(empty — skip in output)"}
- Short Program: ${body.program_kisa?.trim() || "(empty — skip in output)"}

Return ONLY a JSON object with this exact structure (no markdown, no code blocks, no prose):
{
  "title": "translated title (or empty string if source was empty)",
  "destination": "translated destination (or empty string if source was empty)",
  "program_kisa": "translated short program (or empty string if source was empty)"
}`;

      try {
        const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": anthropicApiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-5",
            max_tokens: 1500,
            system:
              "You are a professional Turkish tourism translator. Your response MUST be valid JSON only — no markdown, no code fences, no explanations.",
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (!aiResponse.ok) {
          console.error(`[translate-tour] AI failed for ${targetLang}:`, await aiResponse.text());
          continue; // Bu dile çeviri başarısız — diğer dillere devam
        }

        const aiData = await aiResponse.json();
        const content = ((aiData.content || [])
          .filter((b: any) => b?.type === "text")
          .map((b: any) => b.text)
          .join("") || "").trim();

        let jsonContent = content;
        if (content.startsWith("```")) {
          jsonContent = content.replace(/```json?\n?/g, "").replace(/```\n?$/g, "").trim();
        }

        const parsed = JSON.parse(jsonContent);
        translations.push({
          language: targetLang,
          title: typeof parsed.title === "string" ? parsed.title : "",
          destination: typeof parsed.destination === "string" ? parsed.destination : "",
          program_kisa: typeof parsed.program_kisa === "string" ? parsed.program_kisa : "",
        });
      } catch (err) {
        console.error(`[translate-tour] parse/error for ${targetLang}:`, err);
        // Bu dile başarısız — diğerleri devam
      }
    }

    return new Response(
      JSON.stringify({ success: true, translations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[translate-tour] Critical error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
