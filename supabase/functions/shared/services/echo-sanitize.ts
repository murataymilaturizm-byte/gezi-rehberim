// Şablon-yankı sanitize — TEK KAYNAK (Açık Soru #17'nin terfisi, 2026-07-03).
//
// Kanıtlı vakalar (H-3/K-22/K-19): '"günlük" tarihi müsait değil',
// '"yarın" tarihi müsait değil', '"numaram yok mail atsam" geçerli bir
// telefon değil' — kullanıcı metni/extract değeri TIRNAK İÇİNDE geri
// basılınca saçma/teknik görünüyordu.
//
// isEchoSafe(value) = TRUE → değer tırnaklı basılabilir (kısa, makul:
// "15 ocak", "0532..."). FALSE → jenerik form kullan.
// Tüketiciler: :11 tarih-müsait-değil preamble'ı, R6 telefon mesajı,
// :10b UNKNOWN_TOUR. Yeni tırnaklı şablon eklerken BU helper'dan geç.
export function isEchoSafe(value: unknown): boolean {
  const s = String(value ?? "").trim();
  if (s.length < 2) return false;
  // P6 placeholder kriterleri (Blok 1 _isPlaceholder ile hizalı)
  if (/^<.*>$|^undefined$|^null$|^n\/?a$|^-+$|^\?+$|^bilinmiyor$|^belirtilmedi$|^unknown$/i.test(s)) return false;
  // Uzun metin — cümle yankısı riski
  if (s.length > 25) return false;
  const words = s.split(/\s+/).filter(Boolean);
  // 3+ kelime — cümle görünümü ("numaram yok mail atsam")
  if (words.length >= 3) return false;
  // Göreli/belirsiz zaman kelimeleri — tırnaklı "müsait değil" saçma olur
  if (/(?<![\p{L}\p{N}])(yarın|yarin|bugün|bugun|öbür|obur|günlük|gunluk|haftaya|sonra|tomorrow|today|daily|later)(?![\p{L}\p{N}])/iu.test(s)) return false;
  // Fiil/yüklem belirtisi — 2 kelimelik cümlecikler ("numaram yok", "mail atsam")
  if (words.length === 2 && /(?<![\p{L}\p{N}])(yok|değil|degil|olsun|atsam|yazsam|versem|olur|mı|mi|mu|mü)(?![\p{L}\p{N}])/iu.test(s)) return false;
  return true;
}
