// Centralized Tour Matching Service - FIXED VERSION

import { logger } from "../utils/logger.ts";
import type { Tour, TourMatchResult, NLUEntities } from "../types/index.ts";

/**
 * Find tour by ID from available tours list
 */
export function findTourById(tourId: string, availableTours: Tour[]): Tour | null {
  return availableTours.find((t) => t.id === tourId) || null;
}

// ─── Fuzzy match yardımcıları (shared/services/tour-matching.ts ile eşit) ──────

function normalizeTurkishChars(text: string): string {
  return text
    .replace(/İ/g, "i").replace(/ı/g, "i")
    .replace(/Ş/g, "s").replace(/ş/g, "s")
    .replace(/Ğ/g, "g").replace(/ğ/g, "g")
    .replace(/Ü/g, "u").replace(/ü/g, "u")
    .replace(/Ö/g, "o").replace(/ö/g, "o")
    .replace(/Ç/g, "c").replace(/ç/g, "c");
}

function normalizeForMatch(text: string): string {
  if (!text) return "";
  return normalizeTurkishChars(text.toLowerCase().trim());
}

const TOUR_NAME_TRANSLATIONS: Record<string, string[]> = {
  kapadokya: ["cappadocia", "cappadoce", "kappadokien", "capadocia", "каппадокия", "كابادوكيا", "kappadokia", "kapadokia"],
  efes: ["ephesus", "ephese", "efeso", "эфес", "أفسس"],
  troya: ["troy", "troie", "troja", "троя", "طروادة"],
  istanbul: ["istanbul", "istambul", "стамбул", "إسطنبول", "konstantinopel", "estambul"],
  izmir: ["izmir", "smyrna", "smyrne", "измир", "إزمير"],
  nemrut: ["nemrut", "nemrud", "немрут"],
};

function findTurkishEquivalent(input: string): string | null {
  const normalized = normalizeForMatch(input);
  if (TOUR_NAME_TRANSLATIONS[normalized]) return normalized;
  for (const [trName, aliases] of Object.entries(TOUR_NAME_TRANSLATIONS)) {
    if (aliases.some((a) => normalizeForMatch(a) === normalized)) return trName;
  }
  return null;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (Math.abs(a.length - b.length) > 3) return 99;
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
 * Direct matching: numara → keyword → translation → fuzzy (fallback strategy)
 */
function directMatchTour(userMessage: string, availableTours: Tour[], expectedInput: string): Tour | null {
  const lowerMessage = userMessage.toLowerCase().trim();
  const normMsg = normalizeForMatch(userMessage);

  // 1. Numara ile eşleştirme (pax/isim/telefon adımında değilse)
  if (!["pax_count", "pax", "phone_number", "phone", "full_name", "name"].includes(expectedInput)) {
    const tourNumber = parseInt(lowerMessage);
    if (!isNaN(tourNumber) && tourNumber >= 1 && tourNumber <= availableTours.length) {
      logger.debug(`Tour matched by number: ${tourNumber}`);
      return availableTours[tourNumber - 1];
    }
  }

  // 2. Exact match (normalize edilmiş)
  let matchedTour = availableTours.find(
    (t) => normalizeForMatch(t.title) === normMsg || normalizeForMatch(t.destination) === normMsg,
  );
  if (matchedTour) { logger.debug(`Exact match: ${matchedTour.title}`); return matchedTour; }

  // 3. Partial match (normalize edilmiş)
  matchedTour = availableTours.find(
    (t) => normalizeForMatch(t.title).includes(normMsg) || normalizeForMatch(t.destination).includes(normMsg),
  );
  if (matchedTour) { logger.debug(`Partial match: ${matchedTour.title}`); return matchedTour; }

  // 4. Translation match (Cappadocia → Kapadokya)
  const trName = findTurkishEquivalent(userMessage.trim());
  if (trName) {
    matchedTour = availableTours.find(
      (t) => normalizeForMatch(t.title).includes(trName) || normalizeForMatch(t.destination).includes(trName),
    );
    if (matchedTour) { logger.debug(`Translation match: ${matchedTour.title}`); return matchedTour; }
  }

  // 5. Kelime bazlı keyword match (normalize)
  matchedTour = availableTours.find((t) => {
    const words = [...normalizeForMatch(t.title).split(/\s+/), ...normalizeForMatch(t.destination).split(/\s+/)];
    return words.some((w) => w.length > 3 && normMsg.includes(w));
  });
  if (matchedTour) { logger.debug(`Keyword match: ${matchedTour.title}`); return matchedTour; }

  // 6. Fuzzy match (Levenshtein-2) — yazım hatası toleransı
  const msgWords = userMessage.split(/\s+/).filter((w) => w.length >= 4);
  for (const word of msgWords) {
    const nw = normalizeForMatch(word);
    matchedTour = availableTours.find((t) => {
      const tWords = [...normalizeForMatch(t.title).split(/\s+/), ...normalizeForMatch(t.destination).split(/\s+/)];
      return tWords.some((tw) => tw.length >= 4 && levenshteinDistance(nw, tw) <= 2);
    });
    if (matchedTour) { logger.debug(`Fuzzy match: ${matchedTour.title}`); return matchedTour; }

    // Translation + fuzzy kombinasyonu
    const trEquiv = findTurkishEquivalent(word);
    if (trEquiv) {
      matchedTour = availableTours.find(
        (t) => normalizeForMatch(t.title).includes(trEquiv) || normalizeForMatch(t.destination).includes(trEquiv),
      );
      if (matchedTour) { logger.debug(`Trans+fuzzy match: ${matchedTour.title}`); return matchedTour; }
    }
  }

  return null;
}

/**
 * Create a tour reference with essential data
 */
function createTourReference(tour: Tour): Tour {
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
 * Find matching tours using multiple strategies:
 * 1. NLU tour_name matching
 * 2. NLU destination matching
 * 3. Direct keyword/number matching (fallback)
 *
 * Returns either a single tour OR multiple matches (user needs to choose)
 */
export function findMatchingTours(
  message: string,
  nluEntities: NLUEntities,
  availableTours: Tour[],
  expectedInput: string,
  intent: string,
): TourMatchResult {
  const tourRelatedIntents = [
    "browse_tours",
    "tour_search",
    "select_tour",
    "hotel_details",
    "transport_details",
    "reservation_intent",
  ];

  // Check if we should try tour matching
  const shouldMatchTour = tourRelatedIntents.includes(intent) || nluEntities.tour_name || nluEntities.destination;

  if (!shouldMatchTour) {
    logger.debug("No need to match tours for this intent");
    return { selectedTour: null, multipleMatches: [] };
  }

  let selectedTour: Tour | null = null;
  let multipleMatches: Tour[] = [];

  // ========================================
  // STRATEGY 1: Match by NLU tour_name
  // ========================================
  if (nluEntities.tour_name) {
    const matchingTours = availableTours.filter((t) =>
      t.title.toLowerCase().includes(nluEntities.tour_name!.toLowerCase()),
    );

    if (matchingTours.length === 1) {
      selectedTour = createTourReference(matchingTours[0]);
      logger.info(`Tour matched by NLU name (single): ${selectedTour.title}`);
    } else if (matchingTours.length > 1) {
      multipleMatches = matchingTours;
      logger.info(`Multiple tours matched by NLU name: ${matchingTours.map((t) => t.title).join(", ")}`);
    } else {
      logger.debug(`No tours matched NLU name: ${nluEntities.tour_name}`);
    }
  }

  // ========================================
  // STRATEGY 2: Match by NLU destination
  // ========================================
  if (!selectedTour && multipleMatches.length === 0 && nluEntities.destination) {
    const matchingTours = availableTours.filter(
      (t) =>
        t.destination.toLowerCase().includes(nluEntities.destination!.toLowerCase()) ||
        t.title.toLowerCase().includes(nluEntities.destination!.toLowerCase()),
    );

    if (matchingTours.length === 1) {
      selectedTour = createTourReference(matchingTours[0]);
      logger.info(`Tour matched by NLU destination (single): ${selectedTour.title}`);
    } else if (matchingTours.length > 1) {
      multipleMatches = matchingTours;
      logger.info(`Multiple tours matched by destination: ${matchingTours.map((t) => t.title).join(", ")}`);
    } else {
      logger.debug(`No tours matched NLU destination: ${nluEntities.destination}`);
    }
  }

  // ========================================
  // STRATEGY 3: Fallback - Direct matching
  // ========================================
  // CRITICAL: Only try fallback if no matches yet
  if (!selectedTour && multipleMatches.length === 0) {
    const matchedTour = directMatchTour(message, availableTours, expectedInput);

    if (matchedTour) {
      // Check if this keyword matches multiple tours
      const lowerMessage = message.toLowerCase().trim();
      const allMatches = availableTours.filter(
        (tour) =>
          tour.title.toLowerCase().includes(lowerMessage) || tour.destination.toLowerCase().includes(lowerMessage),
      );

      if (allMatches.length > 1) {
        multipleMatches = allMatches;
        logger.info(`Fallback found multiple matches: ${allMatches.map((t) => t.title).join(", ")}`);
      } else {
        selectedTour = createTourReference(matchedTour);
        logger.info(`Tour matched by direct matching: ${selectedTour.title}`);
      }
    } else {
      logger.debug("No tour match found via NLU or direct matching");
    }
  } else if (multipleMatches.length > 0) {
    logger.info("Skipping fallback - multiple matches found, user needs to choose");
  }

  return { selectedTour, multipleMatches };
}
