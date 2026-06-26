// 2026-06-26 R6 — Tek-helper validasyon katmanı.
// Tüm bypass yolları (NLU, extractor, state-machine, handler, kayıt) bu modülü çağırır.
// Bug pattern: tek katmanda yapılan validasyon → bypass yolları açık kalıyor.
// Çözüm: aynı kontrolün TÜM kayıt noktalarında çağrılması.

export const MAX_PAX_PER_RESERVATION = 9;

/**
 * Pax (kişi sayısı) geçerli mi?
 * 1 ≤ n ≤ 9 (tam sayı). 9 üstü → grup rezervasyonu (acente yönlendirme).
 */
export function isValidPax(n: unknown): n is number {
  return typeof n === "number"
    && Number.isInteger(n)
    && n >= 1
    && n <= MAX_PAX_PER_RESERVATION;
}

/**
 * Telefon numarası geçerli mi? Uluslararası gevşek format.
 * Boşluk, +, -, (), . toleransı; kalan digit ≥7 ve ≤15.
 * "abc def", "telefonum yok", "", "12345" reddedilir.
 * "0532 123 45 67", "+90 532 123 45 67", "05445655656" kabul.
 *
 * TODO (post-launch): Türk format için 10-11 hane sıkılaştırılabilir.
 * Bugün gevşek bırakıldı ki uluslararası gerçek numaralar reddedilmesin.
 */
export function isValidPhone(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const cleaned = s.replace(/[\s\-\(\)\.\+]/g, "");
  if (!/^\d+$/.test(cleaned)) return false;
  return cleaned.length >= 7 && cleaned.length <= 15;
}
