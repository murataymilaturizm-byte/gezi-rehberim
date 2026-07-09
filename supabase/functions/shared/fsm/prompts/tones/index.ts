// Export all tone prompts. 2026-07-09 FAZ4-P2: DE/FR/ES/RU/AR artık EN-fallback
// DEĞİL — kendi 7-dil bundle'larından (prompts/lang/*.ts). TR/EN kaynak korundu.
import { TR_TONES } from "./tr.ts";
import { EN_TONES } from "./en.ts";
import { LANG_PROMPTS } from "../lang/index.ts";

export const TONE_PROMPTS: Record<string, Record<string, string>> = {
  tr: TR_TONES,
  en: EN_TONES,
  de: LANG_PROMPTS.de.tones,
  ru: LANG_PROMPTS.ru.tones,
  ar: LANG_PROMPTS.ar.tones,
  fr: LANG_PROMPTS.fr.tones,
  es: LANG_PROMPTS.es.tones,
};

export function getTonePrompt(language: string, tone: string): string {
  const languageTones = TONE_PROMPTS[language] || TONE_PROMPTS.tr;
  return languageTones[tone] || languageTones.standart;
}
