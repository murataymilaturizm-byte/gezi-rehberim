// Extract reservation info from user messages for demo-chat

import { logger } from "../utils/logger.ts";
import type { NLUEntities, Tour, ExtractionParams, ExtractedInfo } from "../types/index.ts";
import type { ConversationContext, ReservationInfo } from "../../shared/fsm/types.ts";

/**
 * Telefon numarasını normalize et - uluslararası destek
 */
function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-\(\)\.]/g, "");

  // + ile başlıyorsa uluslararası format
  if (cleaned.startsWith("+")) {
    const digits = cleaned.replace("+", "");
    if (digits.length >= 7 && digits.length <= 15 && /^\d+$/.test(digits)) {
      return cleaned;
    }
    return null;
  }

  if (!/^\d+$/.test(cleaned)) return null;
  if (cleaned.length < 7 || cleaned.length > 15) return null;

  return cleaned;
}

/**
 * Main extraction function
 */
export function extractReservationInfo(params: ExtractionParams): ExtractedInfo {
  const { message, nluEntities, nluUpdates, context, availableTours, expectedInput, detectedIntent } = params;

  const result: ExtractedInfo = {};

  let tourDates: any[] = [];
  if (context.currentTour?.id) {
    const tour = availableTours.find((t) => t.id === context.currentTour?.id);
    tourDates = tour?.dates || context.currentTour?.dates || [];
  }

  // 1. NLU updates (en yüksek öncelik)
  if (nluUpdates) {
    if (typeof nluUpdates.paxAdult === "number") result.paxAdult = nluUpdates.paxAdult;
    if (typeof nluUpdates.paxChild === "number") result.paxChild = nluUpdates.paxChild;
    if (typeof nluUpdates.fullName === "string") result.fullName = nluUpdates.fullName;
    if (typeof nluUpdates.phone === "string") {
      const phone = normalizePhone(nluUpdates.phone);
      if (phone) result.phone = phone;
    }
    if (typeof nluUpdates.selectedDate === "string") {
      result.selectedDate = nluUpdates.selectedDate;
      const matchedDate = matchDateWithTourDates(nluUpdates.selectedDate, tourDates);
      if (matchedDate) {
        result.dateId = matchedDate.id;
        result.selectedDate = matchedDate.departure_date;
      }
    }
  }

  // 2. NLU entities
  if (nluEntities) {
    if (typeof nluEntities.pax === "number" && !result.paxAdult) {
      result.paxAdult = nluEntities.pax;
    }
    if (typeof nluEntities.full_name === "string" && !result.fullName) {
      result.fullName = formatName(nluEntities.full_name);
    }
    if (typeof nluEntities.phone === "string" && !result.phone) {
      const phone = normalizePhone(nluEntities.phone);
      if (phone) result.phone = phone;
    }
    // NLU tool schema "dates" (plural array) döndürüyor; eski "date" (singular) da kontrol et.
    const candidateDate =
      (Array.isArray(nluEntities.dates) && typeof nluEntities.dates[0] === "string" && nluEntities.dates[0]
        ? nluEntities.dates[0]
        : null) ||
      (typeof (nluEntities as any).date === "string" && (nluEntities as any).date
        ? (nluEntities as any).date
        : null);

    if (candidateDate && !result.selectedDate) {
      result.selectedDate = candidateDate;
      const matchedDate = matchDateWithTourDates(candidateDate, tourDates);
      if (matchedDate) {
        result.dateId = matchedDate.id;
        result.selectedDate = matchedDate.departure_date;
      }
    }
  }

  // 3. Context-aware extraction
  if (expectedInput === "pax" || expectedInput === "pax_count") {
    const pax = extractPax(message);
    if (pax && !result.paxAdult) result.paxAdult = pax;
  }

  // waiting_for_name: esnek mod - chatbot isim sordu
  if (expectedInput === "name" || expectedInput === "full_name") {
    const name = extractFullNameLoose(message);
    if (name && !result.fullName) result.fullName = name;
  }

  if (expectedInput === "phone" || expectedInput === "phone_number") {
    const phone = extractPhone(message);
    if (phone && !result.phone) result.phone = phone;
  }

  if (expectedInput === "date" || expectedInput === "tour_date" || expectedInput === "date_selection") {
    const dateInfo = extractDate(message, context, availableTours, detectedIntent);
    if (dateInfo.selectedDate && !result.selectedDate) result.selectedDate = dateInfo.selectedDate;
    if (dateInfo.dateId && !result.dateId) result.dateId = dateInfo.dateId;

    if (!result.dateId && !result.paxAdult) {
      const pax = extractPax(message);
      if (pax) {
        result.paxAdult = pax;
        logger.debug("Extracted pax from date context", { pax });
      }
    }
  }

  // 4. Genel extraction
  if (!expectedInput || expectedInput === "any") {
    const allInfo = extractAllInfo(message);
    Object.keys(allInfo).forEach((key) => {
      if (!result[key as keyof ExtractedInfo]) {
        (result as any)[key] = allInfo[key as keyof ExtractedInfo];
      }
    });
  }

  // 5. dateId eşleştirme
  if (result.selectedDate && !result.dateId && tourDates.length > 0) {
    const matchedDate = matchDateWithTourDates(result.selectedDate, tourDates);
    if (matchedDate) {
      result.dateId = matchedDate.id;
      result.selectedDate = matchedDate.departure_date;
    }
  }

  // 6. Tek tarih varsa otomatik seç
  if (!result.dateId && !result.selectedDate && tourDates.length === 1) {
    result.dateId = tourDates[0].id;
    result.selectedDate = tourDates[0].departure_date;
  }

  logger.debug("Extracted info", result);
  return result;
}

/**
 * Esnek isim çıkarma - chatbot isim sorduğunda kullan
 * waiting_for_name aşamasında çok daha geniş kabul eder
 */
function extractFullNameLoose(message: string): string | null {
  const words = message.trim().split(/\s+/);

  if (
    words.length >= 2 &&
    words.length <= 4 &&
    !message.includes("?") &&
    !/\d/.test(message) &&
    words.every((w) => w.length >= 2)
  ) {
    const basicBlacklist = [
      "evet",
      "hayır",
      "tamam",
      "olur",
      "haydi",
      "hadi",
      "rezervasyon",
      "booking",
      "onaylıyorum",
      "iptal",
      "cancel",
      "yes",
      "no",
      "okay",
      "sure",
    ];
    const lowerMsg = message.toLowerCase();
    if (!basicBlacklist.some((w) => lowerMsg.includes(w))) {
      return formatName(message.trim());
    }
  }

  return extractFullName(message);
}

function matchDateWithTourDates(dateStr: string, tourDates: any[]): any | null {
  if (!dateStr || tourDates.length === 0) return null;

  const exactMatch = tourDates.find((d) => d.departure_date === dateStr);
  if (exactMatch) return exactMatch;

  const parsedDate = parseFlexibleDate(dateStr);
  if (parsedDate) {
    const isoDate = parsedDate.toISOString().split("T")[0];
    const match = tourDates.find((d) => d.departure_date === isoDate);
    if (match) return match;

    const parsedParts = isoDate.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (parsedParts) {
      const month = parsedParts[2];
      const day = parsedParts[3];
      const partialMatch = tourDates.find((d) => {
        const parts = d.departure_date?.match(/(\d{4})-(\d{2})-(\d{2})/);
        return parts && parts[2] === month && parts[3] === day;
      });
      if (partialMatch) return partialMatch;
    }
  }

  const dateParts = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateParts) {
    const month = dateParts[2];
    const day = dateParts[3];
    const partialMatch = tourDates.find((d) => {
      const parts = d.departure_date?.match(/(\d{4})-(\d{2})-(\d{2})/);
      return parts && parts[2] === month && parts[3] === day;
    });
    if (partialMatch) return partialMatch;
  }

  return null;
}

function parseFlexibleDate(dateStr: string): Date | null {
  // DD.MM.YYYY veya DD/MM/YYYY veya DD-MM-YYYY
  const dmyFull = dateStr.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (dmyFull) {
    return new Date(parseInt(dmyFull[3]), parseInt(dmyFull[2]) - 1, parseInt(dmyFull[1]));
  }

  const monthNames: Record<string, number> = {
    ocak: 0,
    şubat: 1,
    mart: 2,
    nisan: 3,
    mayıs: 4,
    haziran: 5,
    temmuz: 6,
    ağustos: 7,
    eylül: 8,
    ekim: 9,
    kasım: 10,
    aralık: 11,
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };

  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  }

  const textMatch = dateStr
    .toLowerCase()
    .match(
      /(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık|january|february|march|april|may|june|july|august|september|october|november|december)/i,
    );
  if (textMatch) {
    const day = parseInt(textMatch[1]);
    const month = monthNames[textMatch[2].toLowerCase()];
    return new Date(new Date().getFullYear(), month, day);
  }

  return null;
}

function extractPax(message: string): number | null {
  const patterns = [/(\d+)\s*(yetişkin|adult|büyük)/i, /(\d+)\s*kişi/i, /^(\d+)$/];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const pax = parseInt(match[1]);
      if (pax >= 1 && pax <= 20) return pax;
    }
  }
  return null;
}

function extractFullName(message: string): string | null {
  const cleaned = message.trim();

  const nameMatch = cleaned.match(
    /\b([A-ZÇĞİÖŞÜa-zçğıöşü]{2,}\s+[A-ZÇĞİÖŞÜa-zçğıöşü]{2,}(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]{2,})?)\b/,
  );
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (isValidName(name)) return formatName(name);
  }

  if (isValidName(cleaned)) return formatName(cleaned);
  return null;
}

function extractPhone(message: string): string | null {
  // Önce uluslararası format
  const intlMatch = message.match(/\+\d[\d\s\-\.]{6,17}/);
  if (intlMatch) {
    const phone = normalizePhone(intlMatch[0]);
    if (phone) return phone;
  }

  // Yerel formatlar
  const phonePatterns = [
    /\b(05\d{9})\b/,
    /\b(\+90[\s\-]?5\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})\b/,
    /\b(0[1-9]\d{8,9})\b/,
    /\b(\d{10,11})\b/,
    /\b(\d{7,9})\b/,
  ];

  for (const pattern of phonePatterns) {
    const match = message.match(pattern);
    if (match) {
      const phone = normalizePhone(match[1]);
      if (phone) return phone;
    }
  }
  return null;
}

function extractDate(
  message: string,
  context: ConversationContext,
  availableTours: Tour[],
  detectedIntent?: string,
): { selectedDate?: string; dateId?: string } {
  const result: { selectedDate?: string; dateId?: string } = {};
  const lower = message.toLowerCase().trim();

  let tourDates: any[] = [];
  if (context.currentTour?.id) {
    const tour = availableTours.find((t) => t.id === context.currentTour?.id);
    tourDates = tour?.dates || context.currentTour?.dates || [];
  }

  const optionMatch = lower.match(/^(\d+)\.?\s*(seçenek|option|tarih)?$/);
  if (optionMatch && tourDates.length > 0) {
    const num = parseInt(optionMatch[1]);
    const hasKeyword = !!optionMatch[2]; // "seçenek", "option" veya "tarih" geçiyor mu?
    // 1-9 arası bare sayı ("3" gibi) pax count ile karışır.
    // Keyword varsa ("3. seçenek") veya waiting_for_date'deysek tarih seçimi kabul et.
    // Aksi hâlde (pax/isim/telefon aşamasında bare sayı) tarih seçimi OLARAK YORUMLAMA.
    const isAmbiguous = num >= 1 && num <= 9 && !hasKeyword;
    const isDateStep = context.collectionStep === "waiting_for_date" || !context.collectionStep;
    if (!isAmbiguous || isDateStep) {
      const index = num - 1;
      if (index >= 0 && index < tourDates.length) {
        result.dateId = tourDates[index].id;
        result.selectedDate = tourDates[index].departure_date;
        return result;
      }
    }
  }

  const monthNames: Record<string, number> = {
    // TR
    ocak: 1, şubat: 2, mart: 3, nisan: 4, mayıs: 5, haziran: 6,
    temmuz: 7, ağustos: 8, eylül: 9, ekim: 10, kasım: 11, aralık: 12,
    // EN
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    // DE
    januar: 1, februar: 2, märz: 3, maerz: 3, mai: 5, juni: 6,
    juli: 7, oktober: 10, dezember: 12,
    // FR
    janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, juin: 6,
    juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
    // ES
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
    // RU (nominative)
    январь: 1, февраль: 2, март: 3, апрель: 4, май: 5, июнь: 6,
    июль: 7, август: 8, сентябрь: 9, октябрь: 10, ноябрь: 11, декабрь: 12,
    // AR
    يناير: 1, فبراير: 2, مارس: 3, أبريل: 4, مايو: 5, يونيو: 6,
    يوليو: 7, أغسطس: 8, سبتمبر: 9, أكتوبر: 10, نوفمبر: 11, ديسمبر: 12,
  };

  const textDateMatch = lower.match(
    /(\d{1,2})[\s.]+(?:de\s+|du\s+|d[e']\s+)?(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık|january|february|march|april|may|june|july|august|september|october|november|december|januar|februar|märz|maerz|mai|juni|juli|oktober|dezember|janvier|f[ée]vrier|mars|avril|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|noviembre|diciembre|январь|февраль|апрель|август|сентябрь|октябрь|ноябрь|декабрь|يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)/i,
  );

  if (textDateMatch) {
    const day = parseInt(textDateMatch[1]);
    const month = monthNames[textDateMatch[2].toLowerCase()];
    const year = new Date().getFullYear();
    const isoDate = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

    const matchingDate = tourDates.find((d) => d.departure_date === isoDate);
    if (matchingDate) {
      result.dateId = matchingDate.id;
      result.selectedDate = matchingDate.departure_date;
    } else {
      const partialMatch = tourDates.find((d) => {
        const parts = d.departure_date?.match(/(\d{4})-(\d{2})-(\d{2})/);
        return parts && parseInt(parts[2]) === month && parseInt(parts[3]) === day;
      });
      if (partialMatch) {
        result.dateId = partialMatch.id;
        result.selectedDate = partialMatch.departure_date;
      }
      // Tarih parse edildi ama tur tarihlerinde mevcut değil:
      // selectedDate ve dateId set ETME. Sistem "waiting_for_date" döndürür
      // ve kullanıcıya mevcut tarihleri yeniden listeler.
    }
  }

  if (!result.dateId && tourDates.length === 1) {
    result.dateId = tourDates[0].id;
    result.selectedDate = tourDates[0].departure_date;
  }

  return result;
}

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

function isValidName(name: string): boolean {
  const words = name.split(/\s+/);
  if (words.length < 2 || words.length > 3) return false;
  if (words.some((w) => w.length < 2)) return false;
  if (name.length < 5 || name.length > 50) return false;
  if (/\d/.test(name)) return false;

  const blacklist = [
    "evet",
    "hayır",
    "tamam",
    "olur",
    "kişi",
    "tur",
    "kayıt",
    "tarih",
    "nereden",
    "nereye",
    "nasıl",
    "kaçta",
    "hangi",
    "kim",
    "neden",
    "onaylıyorum",
    "kabul",
    "ediyorum",
    "istiyorum",
    "rezervasyon",
    "yes",
    "no",
    "okay",
    "sure",
    "this",
    "that",
    "with",
    "from",
  ];

  const lowerName = name.toLowerCase();
  if (blacklist.some((word) => lowerName.includes(word))) return false;
  return true;
}

function formatName(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function cleanPhone(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, "");
}
