// HARNESS STUB — import-map ile `shared/services/ai.ts` yerine yüklenir.
// Modlar (setAiMode):
//   { kind: "fail" }         → throw AI_TIMEOUT (arıza modu → handler fallback'i)
//   { kind: "fixed", reply } → sabit cevap (string ya da fn(params) → string)
export type AiMode =
  | { kind: "fail" }
  | { kind: "fixed"; reply: string | ((params: any) => string) };

let _mode: AiMode = { kind: "fail" };
export function setAiMode(m: AiMode): void { _mode = m; }

export const lastAiParams: { value: any } = { value: null };

export async function callAI(params: any): Promise<string> {
  lastAiParams.value = params;
  if (_mode.kind === "fail") throw new Error("AI_TIMEOUT");
  return typeof _mode.reply === "function" ? _mode.reply(params) : _mode.reply;
}
