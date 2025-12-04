// Export all role prompts
import { TR_ROLE } from "./tr.ts";
import { EN_ROLE } from "./en.ts";

// Placeholder for other languages (add as needed)
const DE_ROLE = EN_ROLE; // Use English as fallback for now
const RU_ROLE = EN_ROLE;
const AR_ROLE = EN_ROLE;
const FR_ROLE = EN_ROLE;
const ES_ROLE = EN_ROLE;

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
  return ROLE_PROMPTS[language] || ROLE_PROMPTS.tr;
}
