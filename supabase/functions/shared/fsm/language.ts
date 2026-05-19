// Karakter tabanlı dil tespiti — NLU response language ile override edilir.
// Eski async/keyword tabanlı detectLanguage'in yerine geçer.
// NLU sonucu PRIMARY; bu sadece NLU öncesi ilk bağlam için kullanılır.

/**
 * Unicode karakter setlerine bakarak dili tahmin eder.
 * TR özel karakterler (ğüşıöç) → tr
 * Kiril → ru, Arapça → ar, vb.
 * Saf ASCII → null (belirsiz; NLU'ya bırak)
 */
export function detectLanguage(text: string): string | null {
  if (/[ğüşıöçĞÜŞİÖÇ]/.test(text)) return "tr";
  if (/[äöüßÄÖÜ]/.test(text)) return "de";
  if (/[éèêëàâùûîïôœæçÉÈÊËÀÂÙÛÎÏÔŒÆ]/.test(text)) return "fr";
  if (/[ñáéíóúüÑÁÉÍÓÚÜ¿¡]/.test(text)) return "es";
  if (/[Ѐ-ӿ]/.test(text)) return "ru"; // Kiril
  if (/[؀-ۿ]/.test(text)) return "ar"; // Arapça
  // Saf ASCII → belirsiz; çağıran taraf NLU sonucunu kullanır
  return null;
}
