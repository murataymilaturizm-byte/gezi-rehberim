// "Bot cevaplamadı" (düşürülen mesaj) sebep adları — TEK KAYNAK (PAKET-0 Dilim-3 karar 2).
// Tüketiciler: whatsapp-webhook müşteri satırı (role=user, metadata.dropped_reason) VE
// [unavailable] bildirim/soğuma satırı (role=system) — ikisi AYNI adı yazar.
//
// OKUYUCU SÖZLEŞMESİ (değiştirmeden önce bak):
//   src/components/WhatsAppLogs.tsx:221 → `dropped_reason.startsWith("subscription_")`,
//   öneki atıp durumu rozetle gösterir → abonelik adı ESKİ biçimde korunur
//   (`subscription_<status>`: expired / cancelled / suspended).
//   Limit için eski ad `message_limit_reached` hiçbir yerde okunmuyordu (panel, SQL,
//   pg_cron, edge, script: grep 0) → yeni ad `monthly_limit`.
//   Panelin `"quota_exceeded"` okuyucusunun yazanı YOK (rapor Dilim-3 §10, karar bekliyor).
export const DROP_REASON = {
  MONTHLY_LIMIT: "monthly_limit",
  SUBSCRIPTION_PREFIX: "subscription_",
} as const;

/** `subscription_<status>` — WhatsAppLogs önek sözleşmesi. */
export function subscriptionDropReason(status: string): string {
  return `${DROP_REASON.SUBSCRIPTION_PREFIX}${status}`;
}
