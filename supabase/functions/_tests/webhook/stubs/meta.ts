// WEBHOOK HARNESS STUB — _shared/metaWhatsapp.ts: payload ayrıştırma + imza GERÇEK kod,
// ağ çağıran fonksiyonlar (gönderim, acente çözümü, WABA abonelik) stub.
import * as real from "../../../_shared/metaWhatsapp.ts?real";
export const extractMetaWebhookData = real.extractMetaWebhookData;
export const verifyMetaSignatureDetailed = real.verifyMetaSignatureDetailed;
export const verifyMetaSignature = real.verifyMetaSignature;
export const getMetaCredentials = real.getMetaCredentials;

export const sent: Array<{ to: string; text: string }> = [];
export const meta: { agency: any } = { agency: null };
export async function sendWhatsAppMessage(_pid: string, _tok: string, to: string, text: string) {
  sent.push({ to, text });
  return { success: true, messageId: "wamid.out" };
}
export async function sendWhatsAppTemplate() { return { success: true }; }
export async function resolveAgencyByPhoneNumberId(_sb: any, _pid: string) {
  return meta.agency ? { agency: meta.agency, error: null } : { agency: null, error: "not found" };
}
export async function subscribeAppToWaba() { return true; }
export async function verifyWabaSubscription() { return true; }
export async function subscribeAppToWabaWithRetry() { return true; }
