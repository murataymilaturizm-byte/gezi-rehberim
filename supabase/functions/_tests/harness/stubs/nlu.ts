// HARNESS STUB — import-map ile `shared/fsm/nlu.ts` yerine yüklenir (prod koduna
// dokunmadan NLU enjeksiyonu). Gerçek modül `?real` sorgusuyla ayrı URL olarak
// içe alınır (import-map tam-URL eşleşir → döngü yok).
//
// Modlar (setNluMode):
//   { kind: "fallback" }      → gerçek analyzeUserMessage, ANTHROPIC_API_KEY YOK →
//                               gerçek buildFallbackNLU (arıza modu, prod ile birebir)
//   { kind: "fixed", fn }     → fn(message, stage, ctx) → NLUResult (sabit cevap modu)
import * as real from "../../../shared/fsm/nlu.ts?real";
import type { NLUResult } from "../../../shared/fsm/nlu.ts?real";

export type { NLUResult };
export const resolveNluModel = real.resolveNluModel;
export const nluModelUsesCache = real.nluModelUsesCache;
export const mapNLUIntentToFSMIntent = real.mapNLUIntentToFSMIntent;

export type NluMode =
  | { kind: "fallback" }
  | { kind: "fixed"; fn: (message: string, stage: string, currentTour: any) => Partial<NLUResult> };

let _mode: NluMode = { kind: "fallback" };
export function setNluMode(m: NluMode): void { _mode = m; }

export async function analyzeUserMessage(
  userMessage: string, contextStr: string, stage: string, currentTour: any, availableTours?: any[],
): Promise<NLUResult> {
  if (_mode.kind === "fixed") {
    const r = _mode.fn(userMessage, stage, currentTour);
    return { intent: "general", language: "tr", entities: {}, updates: {}, ...r } as NLUResult;
  }
  Deno.env.delete("ANTHROPIC_API_KEY");
  return await real.analyzeUserMessage(userMessage, contextStr, stage, currentTour, availableTours);
}
