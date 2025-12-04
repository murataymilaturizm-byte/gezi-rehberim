// Export all tone prompts
import { TR_TONES } from "./tr.ts";
import { EN_TONES } from "./en.ts";

// Use English tones as fallback for other languages
const DEFAULT_TONES = EN_TONES;

export const TONE_PROMPTS: Record<string, Record<string, string>> = {
  tr: TR_TONES,
  en: EN_TONES,
  de: DEFAULT_TONES,
  ru: DEFAULT_TONES,
  ar: DEFAULT_TONES,
  fr: DEFAULT_TONES,
  es: DEFAULT_TONES,
};

export function getTonePrompt(language: string, tone: string): string {
  const languageTones = TONE_PROMPTS[language] || TONE_PROMPTS.tr;
  return languageTones[tone] || languageTones.standart;
}
