// 2026-06-22 Sorun H — kontenjan önden kontrol (α etiket + β tarih atama + pax atama).
//
// CANLI BUG (exec 15bf2668): QUOTA_EXCEEDED sadece RPC create_reservation
// anında kontrol ediliyordu → kullanıcı dolu tura tüm akışı (tur→tarih→pax→
// isim→telefon→onay) harcayıp ONAYDA patlama. UX bozukluğu.
//
// FIX — TEK DOĞRULUK KAYNAĞI (Murat ilkesi A, kök fix):
// 3 önden kontrol noktası (α/β/pax) BU helper'lardan beslenir + RPC γ AYNEN
// kalır (race safety 4. kat).
//
// Veri zaten tour-cache'te hazır: _refreshQuota her sorguda taze
// `remaining_quota = quota - sold_pax` hesaplıyor (ek DB çağrısı yok).
//
// ─── UNDEFINED → 0 GERÇEKİSİ (RPC-koruması mantığı) ──────────────────────
// getQuotaRemaining undefined tour_date için 0 döndürür. Bu DOLU VARSAY
// değil — RPC γ FOR UPDATE lock'lu nihai kontrol kullanıcıyı korur. α/β/pax'ın
// görevi ERKEN UYARI/UX, KESİN GÜVENLİK değil.
//
// Gerekçe sıralı:
//   (a) Normal akışta quota HER ZAMAN gelir (DB NOT NULL DEFAULT 0). undefined
//       gerçekten anormal — veri hatası, schema problemi, fetch hatası.
//   (b) Anormal durumda kullanıcı "dolu" görse de γ RPC gerçeği kontrol eder.
//       Veri düzelince geçer.
//   (c) Eğer 999 (sınırsız varsay) yapsaydık: veri hatası SESSIZ overbooking'e
//       yol açar (kullanıcı tüm akışı tamamlar, sadece RPC patlar — H'nin ASIL
//       şikayeti). γ RPC kazanır AMA UX YİNE BOZUK.
//   (d) 0 default: anormal durumda kullanıcı erken uyarılır, gerçek doluluk
//       değişse bile bir sonraki turn'de güncel veri ile yeniden dener.
//       Murat ilkesi "gerçek akışı bozan fix" ihlali YOK çünkü γ RPC nihai.

/**
 * Tour-date için kalan kontenjanı döndürür.
 * Öncelik: remaining_quota (tour-cache taze) > quota (raw DB) > 0 (default).
 */
export function getQuotaRemaining(tourDate: any): number {
  if (!tourDate) return 0;
  if (typeof tourDate.remaining_quota === "number") return tourDate.remaining_quota;
  if (typeof tourDate.quota === "number") return tourDate.quota;
  return 0;
}

/**
 * Yeterli kontenjan var mı? — α/β/pax 3 noktasında ortak gate.
 *
 * @param neededPax β için 1 (sadece "boş yer var mı"), pax için paxAdult.
 */
export function hasQuotaForPax(tourDate: any, neededPax: number = 1): boolean {
  return getQuotaRemaining(tourDate) >= neededPax;
}

/**
 * Tour'un herhangi bir tarihinde kontenjan kaldı mı?
 * α "tüm tarihler dolu → müsait tarih yok" mesaj branş için.
 */
export function hasAnyAvailableDate(tour: any, neededPax: number = 1): boolean {
  return Array.isArray(tour?.dates) && tour.dates.some((d: any) => hasQuotaForPax(d, neededPax));
}
