// Shared tour matching service — used by both whatsapp-webhook and (future) demo-chat
// Based on demo-chat/services/tour-matching.ts, logger dependency removed.

export { findTourById } from "../fsm/tour-matcher.ts";
import { matchTour } from "../fsm/tour-matcher.ts";

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
 * 3-strateji tur eşleştirme:
 * 1. NLU tour_name  (tekil → seç, çoklu → listele)
 * 2. NLU destination (tekil → seç, çoklu → listele)
 * 3. Direkt metin eşleştirme (fallback)
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

  const shouldMatch = tourIntents.includes(intent) || nluEntities?.tour_name || nluEntities?.destination;
  if (!shouldMatch) return { selectedTour: null, multipleMatches: [] };

  let selectedTour: any = null;
  let multipleMatches: any[] = [];

  // Strateji 1: NLU tour_name
  if (nluEntities?.tour_name) {
    const matches = availableTours.filter((t) =>
      t.title.toLowerCase().includes(nluEntities.tour_name.toLowerCase()),
    );
    if (matches.length === 1) {
      selectedTour = createTourRef(matches[0]);
    } else if (matches.length > 1) {
      multipleMatches = matches;
    }
  }

  // Strateji 2: NLU destination
  if (!selectedTour && multipleMatches.length === 0 && nluEntities?.destination) {
    const matches = availableTours.filter(
      (t) =>
        t.destination.toLowerCase().includes(nluEntities.destination.toLowerCase()) ||
        t.title.toLowerCase().includes(nluEntities.destination.toLowerCase()),
    );
    if (matches.length === 1) {
      selectedTour = createTourRef(matches[0]);
    } else if (matches.length > 1) {
      multipleMatches = matches;
    }
  }

  // Strateji 3: Direkt metin (fallback)
  if (!selectedTour && multipleMatches.length === 0) {
    const matchedRef = matchTour(message, availableTours, expectedInput);
    if (matchedRef) {
      const lowerMsg = message.toLowerCase().trim();
      const allMatches = availableTours.filter(
        (t) =>
          t.title.toLowerCase().includes(lowerMsg) ||
          t.destination.toLowerCase().includes(lowerMsg),
      );
      if (allMatches.length > 1) {
        multipleMatches = allMatches;
      } else {
        const full = availableTours.find((t) => t.id === matchedRef.id);
        if (full) selectedTour = createTourRef(full);
      }
    }
  }

  return { selectedTour, multipleMatches };
}
