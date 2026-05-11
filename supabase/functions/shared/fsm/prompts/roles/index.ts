// Role prompts — her dil için kendi sistem prompt dosyası
import { TR_ROLE } from "./tr.ts";
import { EN_ROLE } from "./en.ts";
import { DE_ROLE } from "./de.ts";
import { RU_ROLE } from "./ru.ts";
import { AR_ROLE } from "./ar.ts";
import { FR_ROLE } from "./fr.ts";
import { ES_ROLE } from "./es.ts";

export const ROLE_PROMPTS: Record<string, string> = {
  tr: TR_ROLE,
  en: EN_ROLE,
  de: DE_ROLE,
  ru: RU_ROLE,
  ar: AR_ROLE,
  fr: FR_ROLE,
  es: ES_ROLE,
};

export function getRolePrompt(language: string): string {
  return ROLE_PROMPTS[language] ?? ROLE_PROMPTS.en;
}
