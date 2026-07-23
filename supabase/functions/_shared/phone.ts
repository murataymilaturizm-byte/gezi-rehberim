// Telefon normalizasyonu — TEK KANONİK FORMAT (2026-07-23).
//
// KANONİK: E.164 rakam, +'sız, ülke-kodlu → "905419990011".
// Kural:
//   - +, boşluk, tire, parantez temizle.
//   - "00" uluslararası erişim öneki → at (kalan ülke-kodlu numara).
//   - Tek "0" (TR trunk) → "90" ile değiştir.
//   - 10 haneli "5.." (TR mobil, öneksiz) → başına "90".
//   - Diğer (zaten ülke-kodlu: 90/49/33/7/966...) → DOKUNMA.
// Görüntüleme ayrı (formatPhoneDisplay) — kanonik yalnız YAZMA/EŞLEŞTİRME içindir.
export function normalizePhone(raw: string | null | undefined): string {
  let s = String(raw ?? "").replace(/[^\d+]/g, ""); // rakam + '+' bırak
  s = s.replace(/^\+/, "");                          // baştaki '+' at
  s = s.replace(/\D/g, "");                          // yalnız rakam
  if (!s) return "";
  if (s.startsWith("00")) s = s.slice(2);            // uluslararası erişim öneki
  if (s.startsWith("0")) s = "90" + s.slice(1);      // TR trunk 0 → 90
  else if (s.length === 10 && s.startsWith("5")) s = "90" + s; // TR mobil öneksiz
  return s;
}

/**
 * Ham (normalize EDİLMEMİŞ) bir kolonla (ör. registrations.phone — DOKUNMA şartı)
 * `.in()` eşleştirmek için, verilen numaranın tüm eşdeğer biçimlerini döndürür.
 * Kanonik "905419990011" → ["905419990011","+905419990011","05419990011","5419990011"].
 */
export function phoneMatchVariants(raw: string | null | undefined): string[] {
  const c = normalizePhone(raw);
  if (!c) return [];
  const v = new Set<string>([c, "+" + c]);
  if (c.startsWith("90") && c.length === 12) {
    const local = c.slice(2);        // "5419990011"
    v.add("0" + local);              // "05419990011"
    v.add(local);                    // "5419990011"
    v.add("+90" + local);
  }
  return [...v];
}

/** Görüntü formatı (kanonik → "+90 541 999 00 11"); yalnız TR-90 için gruplar. */
export function formatPhoneDisplay(canonical: string): string {
  const s = normalizePhone(canonical);
  if (s.startsWith("90") && s.length === 12) {
    const n = s.slice(2);
    return `+90 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 8)} ${n.slice(8, 10)}`;
  }
  return s ? `+${s}` : "";
}
