// WEBHOOK HARNESS STUB — çekirdek işleyici: yalnız çağrıldığını kaydeder (webhook
// giriş katmanı test ediliyor; handler'ın kendisi Katman-2 harness'te).
export const processCalls: Array<{ message: string }> = [];
export async function processChatMessage(input: any) {
  processCalls.push({ message: input.message });
  return { success: true, response: "ok", newContext: {} };
}
