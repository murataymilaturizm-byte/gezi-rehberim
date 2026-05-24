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
  sourceLanguage?: string;       // varsayılan tr
  targetLanguages?: string[];    // varsayılan ["en","de","fr","es","ru","ar"]
  // ETAP 1.5b: Toplu import için TEK call'da tüm hedef diller.
  // false (default) → mevcut sequential per-language akış (TourFormDialog dokunulmaz).
  // true → tek prompt'ta tüm targetLanguages için JSON çıktısı, ~6x daha hızlı + ucuz.
  batchMode?: boolean;
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
    const batchMode = body.batchMode === true;

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

    // ─── BATCH MODE: tek call, tüm hedef diller ───────────────────────────────
    if (batchMode) {
      const effectiveTargets = targetLanguages.filter((l) => l !== sourceLanguage);
      if (effectiveTargets.length === 0) {
        // Hedef dil yok → boş translations döndür (caller bunu best-effort tolere eder)
        return new Response(
          JSON.stringify({ success: true, translations: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const sourceLangName = LANG_NAMES[sourceLanguage] || "Turkish";
      const targetLangSpecs = effectiveTargets
        .map((l) => `  - "${l}" → ${LANG_NAMES[l] || l}`)
        .join("\n");

      const batchPrompt = `You are a professional translator specialized in Turkish tourism content.
Translate the following tour information from ${sourceLangName} into MULTIPLE target languages in one pass.

Target languages (use exactly these ISO codes as JSON keys):
${targetLangSpecs}

Rules:
- Use natural tourism industry terminology (e.g., "Balon Turu" → "Hot Air Balloon Tour" / "Heißluftballonfahrt" / "Полёт на воздушном шаре").
- Keep proper place names accurately localized (Cappadocia/Kappadokien/Каппадокия/كابادوكيا, Ephesus/Ephesos/Эфес/أفسس).
- Keep tone professional and customer-facing.
- Do NOT add explanations, footnotes or extra prose.
- If a source field is empty, output empty string ("") for that field in every language.

Source content (${sourceLangName}):
- Title: ${body.title?.trim() || "(empty)"}
- Destination: ${body.destination?.trim() || "(empty)"}
- Short Program: ${body.program_kisa?.trim() || "(empty)"}

Return ONLY a JSON object with this EXACT structure (no markdown, no code fences):
{
  "translations": {
${effectiveTargets.map((l) => `    "${l}": { "title": "...", "destination": "...", "program_kisa": "..." }`).join(",\n")}
  }
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
            max_tokens: 4000,  // Çoklu dil çıktısı için yeterli budget (6 dil × ~250 token)
            system:
              "You are a professional Turkish tourism translator. Your response MUST be valid JSON only — no markdown, no code fences, no explanations.",
            messages: [{ role: "user", content: batchPrompt }],
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text().catch(() => "");
          console.error(`[translate-tour] batch AI failed: ${aiResponse.status}`, errText.slice(0, 200));
          // Fail → boş translations dön (best-effort; caller tur kaydını yine de tutar)
          return new Response(
            JSON.stringify({ success: true, translations: [] }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
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

        try {
          const parsed = JSON.parse(jsonContent);
          const byLang = (parsed?.translations || {}) as Record<string, any>;
          for (const lang of effectiveTargets) {
            const entry = byLang[lang];
            if (entry && typeof entry === "object") {
              translations.push({
                language: lang,
                title: typeof entry.title === "string" ? entry.title : "",
                destination: typeof entry.destination === "string" ? entry.destination : "",
                program_kisa: typeof entry.program_kisa === "string" ? entry.program_kisa : "",
              });
            } else {
              // Bu dil için eksik çıktı — best-effort, boş satır (caller kısmi sonucu kabul eder)
              console.warn(`[translate-tour] batch: missing lang "${lang}" in AI output`);
            }
          }
        } catch (parseErr) {
          console.error("[translate-tour] batch JSON parse error:", parseErr, "content:", content.slice(0, 300));
          // Parse fail → boş translations (caller tur kaydını korur, çeviri eksik kalır)
        }
      } catch (err) {
        console.error("[translate-tour] batch network error:", err);
        // Network fail → boş translations
      }

      return new Response(
        JSON.stringify({ success: true, translations }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── SEQUENTIAL MODE: mevcut per-language akış (TourFormDialog kullanıyor) ──
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
