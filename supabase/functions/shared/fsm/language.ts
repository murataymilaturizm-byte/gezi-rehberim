// Karakter tabanlı dil tespiti — NLU response language ile override edilir.
// Eski async/keyword tabanlı detectLanguage'in yerine geçer.
// NLU sonucu PRIMARY; bu sadece NLU öncesi ilk bağlam için kullanılır.

/**
 * Unicode karakter setlerine bakarak dili tahmin eder.
 *
 * Dilim-7 (denetim E3): yalnız bir dile ÖZGÜ harfler karar verir; diller arası
 * PAYLAŞILAN harfler (é: fr+es) tek başına karar vermez. Eskiden FR seti ES'ten önce
 * ve "é" içeriyordu → "¿Qué incluye el tour?" fr sanılıyordu.
 * Sıra: TR-özgü → DE-özgü → ES-özgü → FR-özgü → Kiril → Arap → TR/DE paylaşılan (ü ö ç)
 *   - ü/ö/ç TR ile DE/FR arasında paylaşılır; eski davranış (tr) korunur — akış
 *     ortasında process-message'taki TR-paylaşılan-aksan kapısı (_trSharedOnly) var.
 *   - Saf ASCII veya yalnız paylaşılan "é" → null (belirsiz; NLU'ya bırak).
 */
export function detectLanguage(text: string): string | null {
  if (/[ğşıĞŞİ]/.test(text)) return "tr";
  if (/[äßÄ]/.test(text)) return "de";
  if (/[ñ¿¡áíóúÑÁÍÓÚ]/.test(text)) return "es";
  if (/[œæêëîïûùèàâôŒÆÊËÎÏÛÙÈÀÂÔ]/.test(text)) return "fr";
  if (/[Ѐ-ӿ]/.test(text)) return "ru"; // Kiril
  if (/[؀-ۿ]/.test(text)) return "ar"; // Arapça
  if (/[üöçÜÖÇ]/.test(text)) return "tr"; // TR/DE/FR paylaşılan — eski öncelik
  return null;
}

/** Yazı sistemi dile ÖZGÜ olan tespitler (Kiril/Arap): akış ortasında tek mesajda geçilir. */
export const SCRIPT_UNIQUE_LANGS = ["ru", "ar"] as const;
