// Telefon normalize — webhook'un sakladığı formatla BİREBİR eşleşmeli.
// Meta WhatsApp Cloud API webhook'unda msg.from şu formatta gelir:
//   • Sadece rakam
//   • "+" yok
//   • Ülke kodu dahil
//   • Türkiye için "0" prefix YOK (0532 değil, 90532)
//   Örnek: "905321234567"
//
// Bu util CRM manuel ekleme formunda kullanıcının yazdığını
// AYNI formata çevirir — aksi halde aynı kişi 2 kez kayıt olur
// (manuel + webhook). Çift kayıt garantisi buna bağlı.
//
// Kapsam: TR varsayımı (acentenin pazarı). Diğer ülkeler için kullanıcı
// "+<ülkekodu> <numara>" yazmalı; "+" otomatik silinir. 10 hane saf rakam
// ise TR mobil varsayılır ve "90" prefix eklenir.

const DEFAULT_COUNTRY_PREFIX = "90"; // Turkey

/**
 * Webhook formatına uygun telefon döndürür.
 * Boş/geçersiz girdide null döner.
 */
export function normalizePhoneForMeta(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // 1. Sadece rakamları al — boşluk, "+", "-", "(", ")" hepsi silinir
  let digits = raw.replace(/[^\d]/g, "");

  // 2. Çok kısa → geçersiz
  if (digits.length < 10) return null;

  // 3. Türkçe "0" prefix → ülke kodu ile değiştir (0532 → 90532)
  if (digits.startsWith("0") && digits.length === 11) {
    digits = DEFAULT_COUNTRY_PREFIX + digits.substring(1);
  }
  // 4. Ülke kodu yoksa (10 hane → TR mobil 5XX...) → "90" ekle
  else if (digits.length === 10) {
    digits = DEFAULT_COUNTRY_PREFIX + digits;
  }
  // 5. 12+ hane → zaten ülke kodu içeriyor, dokunma

  // 6. Aşırı uzun (15+) → geçersiz (E.164 maksimum 15)
  if (digits.length > 15) return null;

  return digits;
}

/**
 * Görsel format — kullanıcıya gösterirken yardımcı (yalnızca UI).
 * DB'de saklanan ham format (normalizePhoneForMeta sonucu) değil.
 * Örnek: "905321234567" → "+90 532 123 45 67"
 */
export function formatPhoneDisplay(normalized: string | null | undefined): string {
  if (!normalized) return "";
  // TR formatı: "+90 5XX XXX XX XX"
  if (normalized.startsWith("90") && normalized.length === 12) {
    const cc = normalized.substring(0, 2);
    const area = normalized.substring(2, 5);
    const p1 = normalized.substring(5, 8);
    const p2 = normalized.substring(8, 10);
    const p3 = normalized.substring(10, 12);
    return `+${cc} ${area} ${p1} ${p2} ${p3}`;
  }
  // Diğer ülkeler için generic +<ülkekodu> <kalan>
  return `+${normalized}`;
}
