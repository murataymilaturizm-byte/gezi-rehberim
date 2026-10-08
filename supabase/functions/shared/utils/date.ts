// Dilim-8 (denetim F5): "bugün" — TEK KAYNAK, acente saat dilimi (Europe/Istanbul).
// Eskiden webhook/demo-chat/process-message'ın bir kısmı `new Date().toISOString().slice(0,10)`
// (UTC) kullanıyordu, bir kısmı Europe/Istanbul. İstanbul 00:00–03:00 arasında UTC hâlâ
// önceki gündür → DÜN kalkmış tur listelenip rezerve edilebiliyordu.
export const AGENCY_TIME_ZONE = "Europe/Istanbul";

/** Europe/Istanbul takvim günü, "YYYY-MM-DD" (en-CA biçimi ISO tarihle aynı). */
export function todayIST(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: AGENCY_TIME_ZONE });
}
