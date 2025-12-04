// Centralized Tour Matching Service

import { logger } from "../utils/logger.ts";
import type { Tour, TourMatchResult, NLUEntities } from "../types/index.ts";
import { matchTour as sharedMatchTour, findTourById } from "../../shared/fsm/tour-matcher.ts";

/**
 * Find matching tours using multiple strategies:
 * 1. NLU tour_name matching
 * 2. NLU destination matching  
 * 3. Direct keyword/number matching (fallback)
 */
export function findMatchingTours(
  message: string,
  nluEntities: NLUEntities,
  availableTours: Tour[],
  expectedInput: string,
  intent: string
): TourMatchResult {
  const tourRelatedIntents = [
    "browse_tours", 
    "tour_search", 
    "select_tour", 
    "hotel_details", 
    "transport_details", 
    "reservation_intent"
  ];
  
  // Check if we should try tour matching
  const shouldMatchTour = tourRelatedIntents.includes(intent) || 
                          nluEntities.tour_name || 
                          nluEntities.destination;

  if (!shouldMatchTour) {
    return { selectedTour: null, multipleMatches: [] };
  }

  let selectedTour: Tour | null = null;
  let multipleMatches: Tour[] = [];

  // Strategy 1: Match by NLU tour_name
  if (nluEntities.tour_name) {
    const matchingTours = availableTours.filter((t) =>
      t.title.toLowerCase().includes(nluEntities.tour_name!.toLowerCase())
    );
    
    if (matchingTours.length === 1) {
      selectedTour = createTourReference(matchingTours[0]);
      logger.tourMatch("NLU name (single)", selectedTour.title);
    } else if (matchingTours.length > 1) {
      multipleMatches = matchingTours;
      logger.multipleTours(matchingTours.map(t => t.title));
    }
  }

  // Strategy 2: Match by NLU destination (if no match from tour_name)
  if (!selectedTour && multipleMatches.length === 0 && nluEntities.destination) {
    const matchingTours = availableTours.filter((t) =>
      t.destination.toLowerCase().includes(nluEntities.destination!.toLowerCase()) ||
      t.title.toLowerCase().includes(nluEntities.destination!.toLowerCase())
    );
    
    if (matchingTours.length === 1) {
      selectedTour = createTourReference(matchingTours[0]);
      logger.tourMatch("NLU destination (single)", selectedTour.title);
    } else if (matchingTours.length > 1) {
      multipleMatches = matchingTours;
      logger.multipleTours(matchingTours.map(t => t.title));
    }
  }

  // Strategy 3: Fallback - direct keyword/number matching
  // CRITICAL: Skip if we already have multiple matches
  if (!selectedTour && multipleMatches.length === 0) {
    const matchedTour = sharedMatchTour(message, availableTours, expectedInput);
    
    if (matchedTour) {
      // Check if this keyword matches multiple tours
      const lowerMessage = message.toLowerCase().trim();
      const allMatches = availableTours.filter(tour => 
        tour.title.toLowerCase().includes(lowerMessage) ||
        tour.destination.toLowerCase().includes(lowerMessage)
      );
      
      if (allMatches.length > 1) {
        multipleMatches = allMatches;
        logger.info("Fallback found multiple matches", allMatches.map(t => t.title));
      } else {
        const fullTour = findTourById(matchedTour.id, availableTours);
        if (fullTour) {
          selectedTour = createTourReference(fullTour as Tour);
          logger.tourMatch("direct matching", selectedTour.title);
        }
      }
    } else {
      logger.debug("No tour match found via NLU or direct matching");
    }
  } else if (multipleMatches.length > 0) {
    logger.info("Skipping fallback - multiple tour matches found, need user to choose");
  }

  return { selectedTour, multipleMatches };
}

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

export { findTourById };
