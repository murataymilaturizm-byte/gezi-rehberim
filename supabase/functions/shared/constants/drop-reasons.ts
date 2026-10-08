// "Bot cevaplamadı" (düşürülen mesaj) sebep adları — TEK KAYNAK (PAKET-0 Dilim-3 karar 2, Dilim-4).
// Tüketiciler: whatsapp-webhook müşteri satırı (role=user, metadata.dropped_reason) VE
// [unavailable] bildirim/soğuma satırı (role=system) — ikisi AYNI adı yazar.
//
// OKUYUCU SÖZLEŞMESİ (değiştirmeden önce bak — suite muhafızı iki yönü de kilitler):
//   src/components/WhatsAppLogs.tsx:221 → `dropped_reason.startsWith("subscription_")`,
//     öneki atıp durumu rozetle gösterir → abonelik adı `subscription_<status>`.
//   src/components/WhatsAppLogs.tsx:235 → `dropped_reason === "quota_exceeded"` → "quota"
//     rozeti → aylık mesaj limiti adı `quota_exceeded` (Dilim-3 §10.4 kararı; eski
//     `message_limit_reached` ve ara ad `monthly_limit` hiçbir yerde okunmuyordu).
//   Diğer adlar panelde bilinmiyor → ham içerik gösterilir (karar gerekmedi, grep 0).
export const DROP_REASON = {
  MONTHLY_LIMIT: "quota_exceeded",
  SUBSCRIPTION_PREFIX: "subscription_",
  UNSUPPORTED_MEDIA: "unsupported_media",
  AGENCY_NOT_CONFIGURED: "agency_not_configured",
  MESSAGE_TOO_LONG: "message_too_long",
  RATE_LIMITED: "rate_limited",
  TOURS_UNAVAILABLE: "tours_unavailable",
} as const;

/** `subscription_<status>` — WhatsAppLogs önek sözleşmesi. */
export function subscriptionDropReason(status: string): string {
  return `${DROP_REASON.SUBSCRIPTION_PREFIX}${status}`;
}

// Metin taşımayan Meta mesaj tipleri için konuşma kaydındaki yer tutucu (panel dili TR).
// Medya indirme/transkripsiyon YOK — yalnız "müşteri bir şey gönderdi" izi + metadata.
export const MEDIA_PLACEHOLDER: Record<string, string> = {
  audio: "[ses mesajı]",
  voice: "[ses mesajı]",
  image: "[görsel]",
  video: "[video]",
  document: "[belge]",
  location: "[konum]",
  sticker: "[çıkartma]",
  contacts: "[kişi kartı]",
};
