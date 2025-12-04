// Centralized Tour Matching Service - FIXED VERSION

import { logger } from "../utils/logger.ts";
import type { Tour, TourMatchResult, NLUEntities } from "../types/index.ts";

/**
 * Find tour by ID from available tours list
 */
export function findTourById(tourId: string, availableTours: Tour[]): Tour | null {
  return availableTours.find((t) => t.id === tourId) || null;
}

/**
 * Direct matching by keywords or number (fallback strategy)
 */
function directMatchTour(userMessage: string, availableTours: Tour[], expectedInput: string): Tour | null {
  const lowerMessage = userMessage.toLowerCase().trim();

  // 1. Try to match by tour number (only if not expecting pax/name/phone)
  if (!["pax_count", "pax", "phone_number", "phone", "full_name", "name"].includes(expectedInput)) {
    const tourNumber = parseInt(lowerMessage);
    if (!isNaN(tourNumber) && tourNumber >= 1 && tourNumber <= availableTours.length) {
      logger.debug(`Tour matched by number: ${tourNumber}`);
      return availableTours[tourNumber - 1];
    }
  }

  // 2. Try exact title match
  let matchedTour = availableTours.find((tour) => tour.title.toLowerCase() === lowerMessage);

  if (matchedTour) {
    logger.debug(`Tour matched by exact title: ${matchedTour.title}`);
    return matchedTour;
  }

  // 3. Try destination match
  matchedTour = availableTours.find((tour) => tour.destination.toLowerCase() === lowerMessage);

  if (matchedTour) {
    logger.debug(`Tour matched by destination: ${matchedTour.title}`);
    return matchedTour;
  }

  // 4. Try keyword matching (partial match)
  matchedTour = availableTours.find((tour) => {
    const tourWords = [...tour.title.toLowerCase().split(/\s+/), ...tour.destination.toLowerCase().split(/\s+/)];

    // Check if any significant word (>3 chars) from tour matches message
    return tourWords.some((word) => word.length > 3 && lowerMessage.includes(word));
  });

  if (matchedTour) {
    logger.debug(`Tour matched by keyword: ${matchedTour.title}`);
    return matchedTour;
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
