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
 * 7 dilde "tur" anlamındaki ortak kelimeler + niyet/onay sözcükleri — keyword
 * match'ten ELE. Lowercase + normalize edilmiş halleri.
 *
 * 2026-06-20 genişletme (Bug — UNKNOWN_TOUR false-positive):
 *   Canlı log execution 31026a6b: "UNKNOWN_TOUR signal: rezervasyon".
 *   Kullanıcı "rezervasyon" yazıp niyet bildirdiğinde tour-match anlamlı
 *   kelime sayıp UNKNOWN_TOUR tetikliyordu. Niyet/onay kelimeleri stopword.
 */
export const TOUR_KEYWORD_STOPWORDS = new Set<string>([
  // ─── "tur" kelimeleri (mevcut) ──────────────────────────────────────────
  // TR
  "tur", "turu", "turun", "tura", "turlar", "turları", "turuna", "turdan",
  "gez", "gezi", "gezisi", "gezimiz",
  // EN
  "tour", "tours", "trip", "trips", "excursion", "excursions",
  // DE
  "ausflug", "ausflüge", "ausfluge", "reise", "reisen", "touren",
  // RU
  "тур", "туры", "экскурсия", "экскурсии", "поездка", "поездки",
  // AR
  "جولة", "جولات", "رحلة", "رحلات",
  // FR
  "circuit", "circuits", "voyage", "voyages",
  // ES
  "excursión", "excursiones", "viaje", "viajes",

  // ─── 2026-06-20: rezervasyon niyeti (UNKNOWN_TOUR false-positive fix) ──
  "rezervasyon", "rezervasyonu", "rezervasyonum", "rezervasyonlar",
  "reservation", "reservations",
  "booking", "bookings",
  "buchung", "buchungen",
  "réservation", "réservations",
  "reserva", "reservas",
  "бронирование", "бронирования", "брони",
  "حجز", "حجوزات",

  // ─── 2026-06-20: tek başına onay/yanıt kelimeleri ───────────────────────
  // Bunlar "rezervasyon" sorusuna cevap olarak yalnız gelir — tur değil.
  "evet", "tamam", "olur", "peki", "tabii", "tabi",
  "yes", "okay", "sure",
  "ja", "nein",
  "oui", "non",
  "sí", "si",
  "да", "нет",
  "نعم", "لا",
]);

/**
 * Kelimenin anlamlı match adayı olup olmadığını kontrol et.
 * Stopword + minimum uzunluk (3 harf, "ege" gibi kısa tur adlarını kabul et).
 */
export function isMeaningfulTourKeyword(word: string): boolean {
  if (!word || word.length < 3) return false;
  return !TOUR_KEYWORD_STOPWORDS.has(word.toLowerCase());
}
