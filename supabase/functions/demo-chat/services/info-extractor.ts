// Information Extraction Service

import { CONFIG } from "../config/constants.ts";
import { logger } from "../utils/logger.ts";
import { extractNameAndPhone } from "../../shared/fsm/simple-extractor.ts";
import { findTourById } from "./tour-matching.ts";
import type { ExtractedInfo, Tour, NLUEntities } from "../types/index.ts";
import type { ConversationContext } from "../../shared/fsm/types.ts";

interface ExtractionOptions {
  message: string;
  nluEntities: NLUEntities;
  nluUpdates: Record<string, unknown>;
  context: ConversationContext;
  availableTours: Tour[];
  expectedInput: string;
  detectedIntent: string;
}

/**
 * Extract reservation info from user message using multiple strategies
 */
export function extractReservationInfo(options: ExtractionOptions): ExtractedInfo {
  const { message, nluEntities, nluUpdates, context, availableTours, expectedInput, detectedIntent } = options;
  
  // Start with NLU updates
  const extractedInfo: ExtractedInfo = { ...nluUpdates } as ExtractedInfo;

  // Handle dates from NLU
  if (nluEntities.dates && nluEntities.dates.length > 0) {
    extractedInfo.selectedDate = nluEntities.dates[0];
    logger.debug("Date from NLU", nluEntities.dates[0]);
  }

  // Simple fallback for name, phone, pax, and date
  const simpleExtraction = extractNameAndPhone(message);
  
  if (simpleExtraction.fullName && !extractedInfo.fullName) {
    extractedInfo.fullName = simpleExtraction.fullName;
    logger.debug("Name from regex", simpleExtraction.fullName);
  }
  if (simpleExtraction.phone && !extractedInfo.phone) {
    extractedInfo.phone = simpleExtraction.phone;
    logger.debug("Phone from regex", simpleExtraction.phone);
  }
  if (simpleExtraction.paxAdult && !extractedInfo.paxAdult) {
    extractedInfo.paxAdult = simpleExtraction.paxAdult;
    logger.debug("Pax from regex", simpleExtraction.paxAdult);
  }
  if (simpleExtraction.selectedDate && !extractedInfo.selectedDate) {
    extractedInfo.selectedDate = simpleExtraction.selectedDate;
    logger.debug("Date from regex", simpleExtraction.selectedDate);
  }

  // Handle plain number input when expecting pax
  if (!extractedInfo.paxAdult && expectedInput === 'pax') {
    const plainNumber = parseInt(message.trim());
    if (!isNaN(plainNumber) && plainNumber >= CONFIG.MIN_PAX_COUNT && plainNumber <= CONFIG.MAX_PAX_COUNT) {
      extractedInfo.paxAdult = plainNumber;
      logger.debug("Pax from plain number", plainNumber);
    }
  }

  // Resolve date_X format
  if (extractedInfo.selectedDate?.startsWith("date_") && context.currentTour) {
    const tour = findTourById(context.currentTour.id, availableTours);
    if (tour?.dates) {
      const dateIndex = parseInt(extractedInfo.selectedDate.split("_")[1]);
      if (dateIndex >= 0 && dateIndex < tour.dates.length) {
        const selectedDate = tour.dates[dateIndex];
        extractedInfo.selectedDate = selectedDate.departure_date;
        extractedInfo.dateId = selectedDate.id;
        logger.debug("Resolved date from index", selectedDate.departure_date);
      }
    }
  }

  // Handle numeric date selection (1, 2, 3)
  if (!extractedInfo.dateId && context.currentTour && 
      (expectedInput === 'date' || expectedInput === 'date_selection')) {
    const dateNumber = parseInt(message.trim());
    if (!isNaN(dateNumber) && dateNumber >= 1) {
      const tour = findTourById(context.currentTour.id, availableTours);
      if (tour?.dates && dateNumber <= tour.dates.length) {
        const selectedDate = tour.dates[dateNumber - 1];
        extractedInfo.selectedDate = selectedDate.departure_date;
        extractedInfo.dateId = selectedDate.id;
        logger.debug("Date selected by number", selectedDate.departure_date);
      }
    }
  }

  // Match ISO date with available tour dates
  if (extractedInfo.selectedDate && !extractedInfo.dateId && context.currentTour) {
    const tour = findTourById(context.currentTour.id, availableTours);
    if (tour?.dates && tour.dates.length > 0) {
      const matchedDate = tour.dates.find((d: any) => {
        if (d.departure_date === extractedInfo.selectedDate) return true;
        const targetDate = new Date(extractedInfo.selectedDate!);
        const tourDate = new Date(d.departure_date);
        return targetDate.getDate() === tourDate.getDate() && 
               targetDate.getMonth() === tourDate.getMonth();
      });
      
      if (matchedDate) {
        extractedInfo.selectedDate = matchedDate.departure_date;
        extractedInfo.dateId = matchedDate.id;
        logger.debug("Matched date with tour date", matchedDate.departure_date);
      } else {
        logger.debug("Date not found in tour dates, will prompt user to select");
      }
    }
  }

  // Auto-select date if there's only one
  if (
    !extractedInfo.dateId &&
    !extractedInfo.selectedDate &&
    context.currentTour?.dates?.length === 1 &&
    (detectedIntent === "provide_info" || detectedIntent === "confirm" || detectedIntent === "reservation_intent")
  ) {
    const singleDate = context.currentTour.dates[0];
    extractedInfo.selectedDate = singleDate.departure_date;
    extractedInfo.dateId = singleDate.id;
    logger.debug("Auto-selected single available date", singleDate.departure_date);
  }

  return extractedInfo;
}
