// Shared tour matching service — 3 katmanlı eşleştirme:
// 1. Exact (normalize edilmiş)  2. Translation map  3. Fuzzy (Levenshtein-2)

export { findTourById } from "../fsm/tour-matcher.ts";
import { matchTour } from "../fsm/tour-matcher.ts";

function normalizeNluField(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string" && v.trim().length > 0);
  if (typeof value === "string" && value.trim().length > 0) return [value];
  return [];
}

// ─── Normalize yardımcıları ───────────────────────────────────────────────────

/**
 * Türkçe özel karakterleri karşılaştırma için ASCII'ye çevirir.
 * "İstanbul" → "istanbul", "Kapadokya" → "kapadokya"
 */
function normalizeTurkishChars(text: string): string {
  return text
    .replace(/İ/g, "i").replace(/ı/g, "i")
    .replace(/Ş/g, "s").replace(/ş/g, "s")
    .replace(/Ğ/g, "g").replace(/ğ/g, "g")
    .replace(/Ü/g, "u").replace(/ü/g, "u")
    .replace(/Ö/g, "o").replace(/ö/g, "o")
    .replace(/Ç/g, "c").replace(/ç/g, "c");
}

/** Karşılaştırma için lowercase + Türkçe karakter normalize */
function normalizeForMatch(text: string): string {
  if (!text) return "";
  return normalizeTurkishChars(text.toLowerCase().trim());
}

// ─── Çeviri haritası ─────────────────────────────────────────────────────────

/**
 * Türkçe tur/destinasyon anahtar kelimesi → diğer dillerdeki eşdeğerleri.
 * EN/DE/FR/ES/RU/AR kullanıcıların Türkçe tur isimlerine match etmesi için.
 */
const TOUR_NAME_TRANSLATIONS: Record<string, string[]> = {
  kapadokya: [
    "cappadocia", "cappadoce", "kappadokien", "capadocia",
    "каппадокия", "كابادوكيا", "kappadokia", "kapadokia",
    "cappodocia", "cappadokia",
  ],
  efes: ["ephesus", "ephese", "efeso", "эфес", "أفسس", "ephesos"],
  troya: ["troy", "troie", "troja", "троя", "طروادة"],
  pamukkale: ["pamukkale", "памуккале", "بامو كالي", "cotton castle"],
  antalya: ["antalya", "антальи", "أنطاليا", "antalia"],
  bodrum: ["bodrum", "halicarnassus", "галикарнас"],
  fethiye: ["fethiye", "telmessos"],
  nemrut: ["nemrut", "nemrud", "немрут"],
  istanbul: ["istanbul", "istambul", "стамбул", "إسطنبول", "konstantinopel", "estambul"],
  ankara: ["ankara", "анкара", "أنقرة"],
  izmir: ["izmir", "smyrna", "smyrne", "измир", "إزمير"],
  alanya: ["alanya", "алания", "ألانيا"],
  antalya_belek: ["belek"],
  kapadokya_balon: ["cappadocia balloon", "kappadokien ballon", "hot air balloon cappadocia"],
};

/**
 * Girilen kelimenin Türkçe karşılığını bulur.
 * "cappadocia" → "kapadokya", "ephesus" → "efes"
 */
function findTurkishEquivalent(input: string): string | null {
  const normalized = normalizeForMatch(input);
  if (TOUR_NAME_TRANSLATIONS[normalized]) return normalized;
  for (const [trName, aliases] of Object.entries(TOUR_NAME_TRANSLATIONS)) {
    if (aliases.some((a) => normalizeForMatch(a) === normalized)) return trName;
  }
  return null;
}

// ─── Levenshtein fuzzy match ─────────────────────────────────────────────────

/** İki string arasındaki edit mesafesi — yazım hatası toleransı için. */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (Math.abs(a.length - b.length) > 3) return 99; // hızlı red

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev.splice(0, prev.length, ...curr);
  }
  return prev[b.length];
}

/**
 * BUG #2 FIX: Bir turun tüm dil varyantlarını matching için topla.
 * Hem aktif lokalize alanlar (title, destination), hem de DB'de tutulan
 * tüm title_xx (title_tr/en/de/ru/ar/fr/es) ve destination_tr alanlarına bakar.
 * Yabancı müşteri kendi dilinde tur adı yazınca eşleştirme yapılabilsin.
 */
function getTourSearchableTexts(t: any): string[] {
  const fields = [
    t.title,
    t.destination,
    t.title_tr, t.title_en, t.title_de, t.title_ru, t.title_ar, t.title_fr, t.title_es,
    t.destination_tr,
  ];
  return fields.filter((s) => typeof s === "string" && s.trim().length > 0);
}

/**
 * Sorgu ile tur listesini fuzzy eşleştir (Levenshtein ≤ maxDist).
 * Her tur başlığındaki ve destinasyonundaki kelimelerle karşılaştırır.
 * BUG #2: tüm dil varyantları da fuzzy havuzunda.
 */
function fuzzyMatchTours(query: string, tours: any[], maxDist = 2): any[] {
  const nq = normalizeForMatch(query);
  if (nq.length < 4) return []; // çok kısa kelimeler için bypass
  return tours.filter((t) => {
    const allTexts = getTourSearchableTexts(t);
    const words: string[] = [];
    for (const text of allTexts) {
      words.push(...normalizeForMatch(text).split(/\s+/));
    }
    return words.some((w) => w.length >= 4 && levenshteinDistance(nq, w) <= maxDist);
  });
}

// ─── Tek sorgu için tüm stratejiler ─────────────────────────────────────────

/**
 * Bir sorgu kelimesi için 3 katmanlı tur arama:
 * 1. Exact match (normalize edilmiş)
 * 2. Translation map (Cappadocia → Kapadokya)
 * 3. Fuzzy match (Levenshtein-2)
 */
function matchByQuery(query: string, tours: any[], checkDest = false): any[] {
  const normalized = normalizeForMatch(query);

  // 1. Exact (normalize) — BUG #2 FIX: tüm dil varyantlarına bak
  let hits = tours.filter((t) => {
    const allTexts = getTourSearchableTexts(t);
    return allTexts.some((text) => {
      const nText = normalizeForMatch(text);
      // checkDest=false ise sadece title alanları sayılır, destination'lara TR-eşdeğer üzerinden bakılır
      return nText.includes(normalized);
    });
  });
  if (hits.length > 0) return hits;

  // 2. Translation map (TR-eşdeğeri)
  const trName = findTurkishEquivalent(query);
  if (trName) {
    hits = tours.filter((t) => {
      const allTexts = getTourSearchableTexts(t);
      return allTexts.some((text) => normalizeForMatch(text).includes(trName));
    });
    if (hits.length > 0) return hits;
  }

  // 3. Fuzzy match (tüm dil varyantları havuzda)
  hits = fuzzyMatchTours(query, tours, 2);
  return hits;
}

// ─── Ana interface ────────────────────────────────────────────────────────────

export interface TourMatchResult {
  selectedTour: any | null;
  multipleMatches: any[];
}

function createTourRef(tour: any): any {
  return {
    id: tour.id,
    title: tour.title,
    destination: tour.destination,
    type: tour.type,
    currency: tour.currency,
    dates: tour.dates,
    program_kisa: tour.program_kisa,
    gezilecek_yerler: tour.gezilecek_yerler,
  };
}

/**
 * 3-strateji tur eşleştirme (her biri exact + translation + fuzzy):
 * Strateji 1: NLU tour_name
 * Strateji 2: NLU destination
 * Strateji 3: Direkt mesaj metni (fallback)
 */
export function findMatchingTours(
  message: string,
  nluEntities: any,
  availableTours: any[],
  expectedInput: string,
  intent: string,
): TourMatchResult {
  const tourIntents = [
    "browse_tours",
    "tour_search",
    "select_tour",
    "hotel_details",
    "transport_details",
    "reservation_intent",
  ];

  const tourNames = normalizeNluField(nluEntities?.tour_name);
  const destinations = normalizeNluField(nluEntities?.destination);

  const shouldMatch = tourIntents.includes(intent) || tourNames.length > 0 || destinations.length > 0;
  if (!shouldMatch) return { selectedTour: null, multipleMatches: [] };

  let selectedTour: any = null;
  let multipleMatches: any[] = [];

  // Strateji 1: NLU tour_name — 3 katmanlı
  for (const name of tourNames) {
    if (selectedTour || multipleMatches.length > 0) break;
    const matches = matchByQuery(name, availableTours, false);
    if (matches.length === 1) {
      selectedTour = createTourRef(matches[0]);
    } else if (matches.length > 1) {
      multipleMatches = matches;
    }
  }

  // Strateji 2: NLU destination — 3 katmanlı
  for (const dest of destinations) {
    if (selectedTour || multipleMatches.length > 0) break;
    const matches = matchByQuery(dest, availableTours, true);
    if (matches.length === 1) {
      selectedTour = createTourRef(matches[0]);
    } else if (matches.length > 1) {
      multipleMatches = matches;
    }
  }

  // Strateji 3: Direkt mesaj metni
  if (!selectedTour && multipleMatches.length === 0) {
    // 3a. tour-matcher.ts'in mevcut implementasyonu (keyword tabanlı)
    const matchedRef = matchTour(message, availableTours, expectedInput);
    if (matchedRef) {
      const normMsg = normalizeForMatch(message);
      // BUG #2 FIX: tüm dil varyantlarına bak
      const allMatches = availableTours.filter((t) => {
        const allTexts = getTourSearchableTexts(t);
        return allTexts.some((text) => normalizeForMatch(text).includes(normMsg));
      });
      if (allMatches.length > 1) {
        multipleMatches = allMatches;
      } else {
        const full = availableTours.find((t) => t.id === matchedRef.id);
        if (full) selectedTour = createTourRef(full);
      }
    }

    // 3b. Mesajdaki her kelime için translation + fuzzy (matchTour başarısız olduysa)
    if (!selectedTour && multipleMatches.length === 0) {
      const msgWords = message.split(/\s+/).filter((w) => w.length >= 4);
      for (const word of msgWords) {
        if (selectedTour || multipleMatches.length > 0) break;
        const matches = matchByQuery(word, availableTours, true);
        if (matches.length === 1) {
          selectedTour = createTourRef(matches[0]);
        } else if (matches.length > 1) {
          multipleMatches = matches;
        }
      }
    }
  }

  return { selectedTour, multipleMatches };
}
