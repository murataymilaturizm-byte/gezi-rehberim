// wa.me hızlı link yardımcıları
//
// Acente, müşterilere WhatsApp'tan kolayca mesaj atabilsin diye:
// telefon numarasını wa.me uyumlu formata getirir ve linki oluşturur.
// Boşluk, parantez, tire, +, "whatsapp:" prefix temizlenir.
// Türk numarası ise (10 haneli, ülke kodsuz: 0532... veya 532...) → 90 ülke kodu eklenir.

/** Telefonu wa.me'nin kabul ettiği "sadece rakam" formatına çevir. Geçersizse null. */
export function normalizePhoneForWaMe(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw)
    .replace(/^whatsapp:/i, "")
    .replace(/[+\s\-()._]/g, "")
    .trim();
  // Türkçe yerel format (0XXX...) → ülke kodu 90
  if (digits.startsWith("0") && digits.length === 11) {
    digits = "90" + digits.slice(1);
  }
  // Ülke kodsuz Türk numarası (10 hane, 5 ile başlar)
  if (digits.length === 10 && digits.startsWith("5")) {
    digits = "90" + digits;
  }
  // Genel kontrol: 8-15 hane (E.164 + ülke kodlu)
  if (!/^\d{8,15}$/.test(digits)) return null;
  return digits;
}

/** wa.me URL oluştur; geçersizse null. message opsiyonel (URL-encoded). */
export function buildWhatsAppUrl(phone: string | null | undefined, message?: string): string | null {
  const digits = normalizePhoneForWaMe(phone);
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
