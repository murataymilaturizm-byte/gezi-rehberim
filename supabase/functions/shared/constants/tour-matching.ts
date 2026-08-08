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
  "tur", "turu", "turun", "tura", "turlar", "turları", "turuna", "turunu", "turdan",
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
// ─── W1 (2026-07-29): FİİL/MASTAR tur-adı-adayı OLAMAZ — YAPISAL kural ────────
// CANLI BUG: "Tur almak istiyorum" → tour-matching Öncelik-3 fallback msgWords[0]
// = "almak" seçti → bot '"almak" sistemimizde bulunmuyor 😔'. 2026-06-20'de aynı
// sınıf ("en uzun kelime" → "istiyorum") tek-nokta yamalanmıştı ("ilk kelime"),
// sınıf kapanmadı: mesajda gerçek tur adı YOKSA ilk kelime de fiildir.
// Ölçüm (9-satır korpus): almak/satın/ayırtmak/yaptırmak/yapmak/bakmak/want → 7 vaka.
// ÇÖZÜM: stopword listesine tek tek fiil eklemek YERİNE morfolojik/kök kuralı:
//   • TR mastar: -mak/-mek  •  TR çekim: -iyorum/-ıyorum/-uyorum/-üyorum, -acağım/
//     -eceğim, -alım/-elim, -ayım/-eyim, -arım/-erim, -dım/-dim/-dum/-düm, -mış/-miş
//   • TR parçacık: "satın" (tek başına anlam taşımaz, hep fiille gelir)
//   • 6 dil niyet-fiili kökleri (want/buy/book/look…, möchte/kaufen…, veux/acheter…,
//     quiero/comprar…, хочу/купить…, أريد/شراء…)
// POZİTİF-KORUMA: gerçek tur adları etkilenmez — "Balon turu almak istiyorum" → "balon"
// (fiil değil) hayatta kalır; "Ege turu yapmak istiyorum" → "ege". Fiil elenince aday
// KALMAZSA unknownTourQuery=null → UNKNOWN_TOUR atılmaz → normal tur-listesi dalı.
const _TR_VERB_SUFFIX_RE =
  /(mak|mek|[iıuü]yorum|[iıuü]yoruz|[iıuü]yor|acağım|eceğim|acağız|eceğiz|al[ıi]m|elim|ay[ıi]m|eyim|ar[ıi]m|erim|d[iıuü]m|m[iı][şs]|sin|siniz)$/iu;
const _INTENT_VERB_ROOTS = new Set<string>([
  // TR parçacık/kök
  "satın", "satin",
  // EN
  "want", "buy", "book", "booking", "purchase", "look", "looking", "need", "get", "make", "take", "have",
  // DE
  "möchte", "mochte", "möchten", "kaufen", "buchen", "brauche", "suche", "machen", "nehmen",
  // FR
  "veux", "voudrais", "acheter", "réserver", "reserver", "cherche", "besoin", "faire", "prendre",
  // ES
  "quiero", "comprar", "reservar", "busco", "necesito", "hacer", "tomar",
  // RU
  "хочу", "купить", "забронировать", "ищу", "нужно", "нужен", "сделать", "взять",
  // AR
  "أريد", "شراء", "حجز", "أبحث", "أحتاج",
]);

/** Kelime niyet-fiili / mastar mı? (tur adı adayı olamaz) */
export function isVerbLikeWord(word: string): boolean {
  const w = (word || "").toLowerCase();
  if (!w) return false;
  if (_INTENT_VERB_ROOTS.has(w)) return true;
  // TR morfolojisi: en az 5 harf + fiil-eki (kısa tur adları yanlışlıkla elenmesin,
  // örn. "demek" gibi 5-harf istisnalar zaten tur adı değil).
  return w.length >= 5 && _TR_VERB_SUFFIX_RE.test(w);
}

// ═══════════════════════════════════════════════════════════════════════════
// W6 (2026-08-02): ZAMİR/BAĞLAM-SÖZCÜĞÜ FRENİ — isVerbLikeWord'ün zamir eşdeğeri
//
// Canlı vaka (W5-FIX FP-probu): "bu turu bende istiyorum" → bot
// '"bende" sistemimizde bulunmuyor 😔' — zamiri TUR ADI sandı. W1'de "almak"
// fiili aynı şekilde tur adı sanılıyordu; bu, sınıfın zamir üyesi.
//
// Yalnız GERÇEKTEN DELİKTE olanlar listede: <3 harf zaten uzunluk şartına
// takılıyor ("it/me/us/о..." giremez) — bu yüzden EN it/me/us, DE mir/uns,
// RU мне/нам 3-harf sınırında olsalar da 3+ olanlar ve tümü açıkça eklendi
// (uzunluk kuralı değişirse fren yerinde kalsın).
// ═══════════════════════════════════════════════════════════════════════════
const _PRONOUN_CONTEXT_WORDS = new Set<string>([
  // TR
  "bende", "bana", "bunu", "bunun", "şunu", "sunu", "onu", "bizde", "sizde", "bize", "sana", "bende",
  // EN
  "this", "that", "these", "those",
  // DE
  "das", "dies", "mir", "uns",
  // FR / ES
  "ceci", "cela", "esto", "eso",
  // RU
  "это", "этот", "мне", "нам",
  // AR
  "هذا", "هذه", "ذلك",
]);

export function isMeaningfulTourKeyword(word: string): boolean {
  if (!word || word.length < 3) return false;
  if (isVerbLikeWord(word)) return false; // W1
  const w = word.toLowerCase();
  if (_PRONOUN_CONTEXT_WORDS.has(w)) return false; // W6
  return !TOUR_KEYWORD_STOPWORDS.has(w);
}
