// Simple language detection

export async function detectLanguage(text: string): Promise<string | null> {
  const lower = text.toLowerCase().trim();
  
  // Turkish patterns
  if (/merhaba|selam|nasılsın|turlar|nerede|ne zaman|kaç para/.test(lower)) {
    return 'tr';
  }
  
  // English patterns
  if (/hello|hi|tours|where|when|how much|price/.test(lower)) {
    return 'en';
  }
  
  // German patterns
  if (/hallo|guten tag|touren|wo|wann|wie viel/.test(lower)) {
    return 'de';
  }
  
  // Russian patterns
  if (/привет|здравствуйте|туры|где|когда|сколько/.test(lower)) {
    return 'ru';
  }
  
  // Arabic patterns
  if (/مرحبا|السلام عليكم|جولات|أين|متى|كم/.test(lower)) {
    return 'ar';
  }
  
  // French patterns
  if (/bonjour|salut|tours|où|quand|combien/.test(lower)) {
    return 'fr';
  }
  
  // Spanish patterns
  if (/hola|buenos días|tours|dónde|cuándo|cuánto/.test(lower)) {
    return 'es';
  }
  
  // Default to Turkish
  return 'tr';
}
