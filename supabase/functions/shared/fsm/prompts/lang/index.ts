// Per-dil prompt bundle'ları — TEK KAYNAK (2026-07-09 FAZ4-P2).
// roles/ deseniyle simetrik. TR+EN inline (stages/index.ts, tones/tr.ts+en.ts,
// prompt-builder) KORUNDU (sıfır-regresyon); bu 5 dil EN-fallback'ten 7-dile
// yükseltir. Her bundle: stage fonksiyonları (interpolation'lı) + steps +
// hallucinationGuard + noFakeConfirmation + tones(4) + forbidden + paymentLabel.
//
// Tüketiciler: stages/index.ts (getStagePrompt/getCollectionStepPrompt/
// buildForbiddenAskList), tones/index.ts, prompt-builder (no-fake-confirm),
// prompts/agency.ts (ödeme etiketi).
import { DE_PROMPTS } from "./de.ts";
import { FR_PROMPTS } from "./fr.ts";
import { ES_PROMPTS } from "./es.ts";
import { RU_PROMPTS } from "./ru.ts";
import { AR_PROMPTS } from "./ar.ts";

export interface LangPromptBundle {
  greeting: (toursList: string) => string;
  browsing: (toursList: string) => string;
  tourSelected: (tourDetails: string) => string;
  collectingInfo: (stepPrompt: string, tourDetails: string) => string;
  confirming: (summary: string, tourDetails: string) => string;
  completed: (summary: string, tourDetails: string) => string;
  steps: Record<string, string>;
  hallucinationGuard: string;
  noFakeConfirmation: string;
  tones: Record<string, string>;
  forbidden: { date: string; pax: string; name: string; phone: string; header: string; footer: string };
  paymentLabel: string;
}

// SADECE 5 yeni dil. tr/en BİLİNÇLİ olarak burada YOK — mevcut inline yolları
// korunuyor (regresyon-güvenliği). Tüketiciler tr/en'i kendi mevcut kaynaklarından
// alır, diğer 5 dili buradan.
export const LANG_PROMPTS: Record<string, LangPromptBundle> = {
  de: DE_PROMPTS,
  fr: FR_PROMPTS,
  es: ES_PROMPTS,
  ru: RU_PROMPTS,
  ar: AR_PROMPTS,
};
