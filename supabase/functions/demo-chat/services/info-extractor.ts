// Extract reservation info from user messages for demo-chat

import { logger } from "../utils/logger.ts";
import type { NLUEntities, Tour, ExtractionParams, ExtractedInfo } from "../types/index.ts";
import type { ConversationContext, ReservationInfo } from "../../shared/fsm/types.ts";

/**
 * Main extraction function - extracts reservation info from user message
 */
export function extractReservationInfo(params: ExtractionParams): ExtractedInfo {
  const { message, nluEntities, nluUpdates, context, availableTours, expectedInput, detectedIntent } = params;
  
  const result: ExtractedInfo = {};
  const lower = message.toLowerCase().trim();

  // 1. Extract from NLU updates first (highest priority)
  if (nluUpdates) {
    if (typeof nluUpdates.paxAdult === "number") result.paxAdult = nluUpdates.paxAdult;
    if (typeof nluUpdates.paxChild === "number") result.paxChild = nluUpdates.paxChild;
    if (typeof nluUpdates.fullName === "string") result.fullName = nluUpdates.fullName;
    if (typeof nluUpdates.phone === "string") result.phone = nluUpdates.phone;
    if (typeof nluUpdates.selectedDate === "string") result.selectedDate = nluUpdates.selectedDate;
  }

  // 2. Extract from NLU entities
  if (nluEntities) {
    if (typeof nluEntities.pax === "number" && !result.paxAdult) {
      result.paxAdult = nluEntities.pax;
    }
    if (typeof nluEntities.full_name === "string" && !result.fullName) {
      result.fullName = formatName(nluEntities.full_name);
    }
    if (typeof nluEntities.phone === "string" && !result.phone) {
      result.phone = cleanPhone(nluEntities.phone);
    }
    if (typeof nluEntities.date === "string" && !result.selectedDate) {
      result.selectedDate = nluEntities.date;
    }
  }

  // 3. Context-aware extraction based on expectedInput
  if (expectedInput === "pax" || expectedInput === "pax_count") {
    const pax = extractPax(message);
    if (pax && !result.paxAdult) {
      result.paxAdult = pax;
    }
  }

  if (expectedInput === "name" || expectedInput === "full_name") {
    const name = extractFullName(message);
    if (name && !result.fullName) {
      result.fullName = name;
    }
  }

  if (expectedInput === "phone" || expectedInput === "phone_number") {
    const phone = extractPhone(message);
    if (phone && !result.phone) {
      result.phone = phone;
    }
  }

  if (expectedInput === "date" || expectedInput === "tour_date") {
    const dateInfo = extractDate(message, context, availableTours, detectedIntent);
    if (dateInfo.selectedDate && !result.selectedDate) {
      result.selectedDate = dateInfo.selectedDate;
    }
    if (dateInfo.dateId && !result.dateId) {
      result.dateId = dateInfo.dateId;
    }
    
    // If we couldn't extract a date but message is a plain number, try pax
    if (!result.dateId && !result.paxAdult) {
      const pax = extractPax(message);
      if (pax) {
        result.paxAdult = pax;
        logger.debug("Extracted pax from date context", { pax });
      }
    }
  }

  // 4. Try to extract everything if no specific expectation
  if (!expectedInput || expectedInput === "any") {
    const allInfo = extractAllInfo(message);
    Object.keys(allInfo).forEach((key) => {
      if (!result[key as keyof ExtractedInfo]) {
        (result as any)[key] = allInfo[key as keyof ExtractedInfo];
      }
    });
  }

  logger.debug("Extracted info", result);
  return result;
}

/**
 * Extract passenger count from message
 */
function extractPax(message: string): number | null {
  const lower = message.toLowerCase();

  // Patterns for adults
  const patterns = [
    /(\d+)\s*(yetişkin|adult|büyük)/i,
    /(\d+)\s*kişi/i,
    /^(\d+)$/  // Just a number
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const pax = parseInt(match[1]);
      if (pax >= 1 && pax <= 20) {
        return pax;
      }
    }
  }

  return null;
}

/**
 * Extract full name from message
 */
function extractFullName(message: string): string | null {
  // Clean the message first
  const cleaned = message.trim();
  
  // Match 2-3 word names with Turkish and Latin characters
  const nameMatch = cleaned.match(/\b([A-ZÇĞİÖŞÜa-zçğıöşü]{2,}\s+[A-ZÇĞİÖŞÜa-zçğıöşü]{2,}(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]{2,})?)\b/);

  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (isValidName(name)) {
      return formatName(name);
    }
  }

  // Try whole message as name if it looks like a name
  if (isValidName(cleaned)) {
    return formatName(cleaned);
  }

  return null;
}

/**
 * Extract phone number from message
 */
function extractPhone(message: string): string | null {
  const phonePatterns = [
    /\b(05\d{9})\b/,  // Turkish mobile: 05xxxxxxxxx
    /\b(\+90[\s\-]?5\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})\b/,  // International
    /\b(\d{10,11})\b/  // 10-11 digits
  ];

  for (const pattern of phonePatterns) {
    const match = message.match(pattern);
    if (match) {
      const phone = cleanPhone(match[1]);
      if (phone && phone.length >= 10 && phone.length <= 11) {
        return phone;
      }
    }
  }

  return null;
}

/**
 * Extract date from message
 */
function extractDate(
  message: string,
  context: ConversationContext,
  availableTours: Tour[],
  detectedIntent?: string
): { selectedDate?: string; dateId?: string } {
  const result: { selectedDate?: string; dateId?: string } = {};
  const lower = message.toLowerCase().trim();

  // Get current tour dates if tour is selected
  let tourDates: any[] = [];
  if (context.currentTour?.id) {
    const tour = availableTours.find((t) => t.id === context.currentTour?.id);
    tourDates = tour?.dates || context.currentTour?.dates || [];
  }

  // Try to match date selection by number (e.g., "1", "2. seçenek")
  const optionMatch = lower.match(/^(\d+)\.?\s*(seçenek|option|tarih)?$/);
  if (optionMatch && tourDates.length > 0) {
    const index = parseInt(optionMatch[1]) - 1;
    if (index >= 0 && index < tourDates.length) {
      result.dateId = tourDates[index].id;
      result.selectedDate = tourDates[index].departure_date;
      return result;
    }
  }

  // Try to match specific date formats
  const monthNames: Record<string, number> = {
    ocak: 1, şubat: 2, mart: 3, nisan: 4, mayıs: 5, haziran: 6,
    temmuz: 7, ağustos: 8, eylül: 9, ekim: 10, kasım: 11, aralık: 12,
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
  };

  // Pattern: "18 aralık" or "18 december"
  const textDateMatch = lower.match(/(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık|january|february|march|april|may|june|july|august|september|october|november|december)/i);
  
  if (textDateMatch) {
    const day = parseInt(textDateMatch[1]);
    const month = monthNames[textDateMatch[2].toLowerCase()];
    const year = new Date().getFullYear();
    
    // Format as ISO date
    const isoDate = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    
    // Try to match with tour dates
    const matchingDate = tourDates.find((d) => d.departure_date === isoDate);
    if (matchingDate) {
      result.dateId = matchingDate.id;
      result.selectedDate = matchingDate.departure_date;
    } else {
      result.selectedDate = isoDate;
    }
  }

  // Auto-select ONLY if there's exactly one date available
  if (!result.dateId && tourDates.length === 1) {
    result.dateId = tourDates[0].id;
    result.selectedDate = tourDates[0].departure_date;
    logger.debug("Auto-selected single available date", { dateId: result.dateId, selectedDate: result.selectedDate });
  }

  return result;
}

/**
 * Try to extract all information from a single message
 */
function extractAllInfo(message: string): Partial<ExtractedInfo> {
  const result: Partial<ExtractedInfo> = {};

  const phone = extractPhone(message);
  if (phone) result.phone = phone;

  const name = extractFullName(message);
  if (name) result.fullName = name;

  const pax = extractPax(message);
  if (pax) result.paxAdult = pax;

  return result;
}

/**
 * Validate name
 */
function isValidName(name: string): boolean {
  const words = name.split(/\s+/);

  // Must be 2-3 words
  if (words.length < 2 || words.length > 3) return false;

  // Each word must be at least 2 characters
  if (words.some((w) => w.length < 2)) return false;

  // Length check
  if (name.length < 5 || name.length > 50) return false;

  // Must not contain numbers
  if (/\d/.test(name)) return false;

  // Blacklist common words
  const blacklist = [
    "evet", "hayır", "tamam", "olur", "kişi", "tur", "kayıt", "tarih",
    "nereden", "nereye", "nasıl", "kaçta", "hangi", "kim", "neden",
    "onaylıyorum", "kabul", "ediyorum", "istiyorum", "rezervasyon"
  ];

  const lowerName = name.toLowerCase();
  if (blacklist.some((word) => lowerName.includes(word))) return false;

  return true;
}

/**
 * Format name with proper capitalization
 */
function formatName(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Clean phone number
 */
function cleanPhone(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, "");
}
