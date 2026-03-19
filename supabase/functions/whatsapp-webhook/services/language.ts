// Language detection service

export async function detectLanguage(message: string): Promise<string | null> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a language detection assistant. Detect the language of the user's message.

Supported languages and codes:
- tr: Turkish
- en: English
- de: German
- ru: Russian
- ar: Arabic
- fr: French
- es: Spanish

Return ONLY the language code (e.g., "tr", "en", "de"). No other explanation.`
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

export function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    tr: 'Turkish',
    en: 'English',
    de: 'German',
    ru: 'Russian',
    ar: 'Arabic',
    fr: 'French',
    es: 'Spanish'
  };
  return names[code] || 'Turkish';
}
