// 2026-06-20 (Bug 1 + Bug 2 kök çözümü): Tour-matching stopword listesi.
// services/tour-matching.ts ve fsm/tour-matcher.ts her ikisi de bu modülden
// import eder — tek-kaynak, senkron sapma riski sıfır.
//
// Sorun: tour-matcher.ts:matchTour 4. dal (keyword match) `tourWords.some(w =>
// lowerMessage.includes(w))` — "turu" kelimesi TÜM Türkçe tur title'larında
// geçtiği için array sırasındaki ilk turu YANLIŞ POZİTİF olarak seçiyordu.
// Bu, "Ege Turu" gibi var olan turun bazen başka tura eşleştirilmesine yol
// açıyordu (BUG 2 tutarsızlığının doğrudan kökü).
//
// Çözüm: keyword match'te stopword'leri at. "turu" / "tour" / "ausflug" gibi
// kelimeler match sinyali değil, ortak gürültü.

/**
 * 7 dilde "tur" anlamındaki ortak kelimeler — keyword match'ten ELE.
 * Lowercase + normalize edilmiş halleri.
 */
export const TOUR_KEYWORD_STOPWORDS = new Set<string>([
  // TR
  "tur", "turu", "turun", "tura", "turlar", "turları", "turuna", "turdan",
  "gez", "gezi", "gezisi", "gezimiz",
  // EN
  "tour", "tours", "trip", "trips", "excursion", "excursions",
  // DE
  "ausflug", "ausflüge", "ausfluge", "reise", "reisen", "tour", "touren",
  // RU (normalize tur — кириллица küçük harfle)
  "тур", "туры", "экскурсия", "экскурсии", "поездка", "поездки",
  // AR
  "جولة", "جولات", "رحلة", "رحلات",
  // FR
  "tour", "tours", "circuit", "circuits", "voyage", "voyages", "excursion",
  // ES
  "tour", "tours", "excursion", "excursión", "excursiones", "viaje", "viajes",
]);

/**
 * Kelimenin anlamlı match adayı olup olmadığını kontrol et.
 * Stopword + minimum uzunluk (3 harf, "ege" gibi kısa tur adlarını kabul et).
 */
export function isMeaningfulTourKeyword(word: string): boolean {
  if (!word || word.length < 3) return false;
  return !TOUR_KEYWORD_STOPWORDS.has(word.toLowerCase());
}
