// Language detection service

export async function detectLanguage(message: string): Promise<string | null> {
  try {
    const systemPrompt = `You are a language detection assistant. Detect the language of the user's message.

Supported languages and codes:
- tr: Turkish
- en: English
- de: German
- ru: Russian
- ar: Arabic
- fr: French
- es: Spanish

Return ONLY the language code (e.g., "tr", "en", "de"). No other explanation.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') || '',
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 10,
        system: systemPrompt,
        messages: [
          { role: 'user', content: message }
        ],
      })
    });

    if (!response.ok) {
      console.error('Language detection API error:', await response.text());
      return null;
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text)
      .join('');
    const detectedLang = text?.trim().toLowerCase();

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
