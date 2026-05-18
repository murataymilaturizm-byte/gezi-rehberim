// Unified info extraction service — replaces webhook's 10 inline extraction blocks.
// Davranış whatsapp-webhook/index.ts'deki inline bloklar ile EŞDEĞERDİR (Faz 1).

import type { ConversationContext } from "../fsm/types.ts";
import { extractNameAndPhone, extractEmail, isEmailSkipRequest } from "../fsm/simple-extractor.ts";
import { findTourById } from "../fsm/tour-matcher.ts";
import { getNextExpectedInput } from "../fsm/state-machine.ts";

/**
 * NLU field'ını string listesine normalize eder.
 * NLU bazen string, bazen string[], bazen null/undefined döndürebilir.
 */
function normalizeNluField(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string" && v.trim().length > 0);
  if (typeof value === "string" && value.trim().length > 0) return [value];
  return [];
}

/** DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY → YYYY-MM-DD. Zaten ISO ise dokunma. */
export function normalizeDateString(dateStr: string): string {
  if (!dateStr) return dateStr;
  const m = dateStr.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return dateStr;
}

/**
 * 3-katmanlı tarih eşleştirme:
 * 1. Exact string match
 * 2. ISO normalize edilmiş exact match
 * 3. Year-agnostic (gün+ay) partial match — "20 Aralık" gibi yılsız tarihler için
 */
function matchDateWithTourDates(dateStr: string, tourDates: any[]): any | null {
  if (!dateStr || tourDates.length === 0) return null;

  // Özel prefix'ler (simple-extractor'dan gelebilir)
  if (dateStr.startsWith("index_")) {
    const idx = parseInt(dateStr.split("_")[1]);
    if (!isNaN(idx) && idx >= 0 && idx < tourDates.length) return tourDates[idx];
    return null;
  }
  if (dateStr.startsWith("day_")) {
    const day = parseInt(dateStr.split("_")[1]);
    const matches = tourDates.filter((d) => {
      const p = d.departure_date?.match(/\d{4}-\d{2}-(\d{2})/);
      return p && parseInt(p[1]) === day;
    });
    return matches.length === 1 ? matches[0] : null;
  }

  // 1. Exact match
  const exact = tourDates.find((d) => d.departure_date === dateStr);
  if (exact) return exact;

  // 2. Normalize (DD.MM.YYYY → YYYY-MM-DD) sonra exact match
  const normalized = normalizeDateString(dateStr);
  if (normalized !== dateStr) {
    const normMatch = tourDates.find((d) => d.departure_date === normalized);
    if (normMatch) return normMatch;
  }

  // 3. Year-agnostic: gün + ay eşleştir
  const isoSel = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoSel) {
    const partial = tourDates.find((d) => {
      const p = d.departure_date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return p && p[2] === isoSel[2] && p[3] === isoSel[3];
    });
    if (partial) return partial;
  }

  return null;
}

export interface ExtractAllInfoParams {
  message: string;
  nluResult: any;
  fsmIntent: string;   // mapNLUIntentToFSMIntent sonrası, override uygulanmış
  context: ConversationContext;
  tours: any[];        // getCachedTours çıktısı
}

/**
 * Webhook'taki 10 inline extraction bloğunu tek fonksiyona toplar.
 * Sıralama ve öncelik webhook ile aynıdır — Faz 1'de davranış değişmez.
 */
export function extractAllInfo(params: ExtractAllInfoParams): Record<string, any> {
  const { message, nluResult, fsmIntent, context, tours } = params;

  // === Blok 1: NLU updates (en yüksek öncelik) ===
  const extractedInfo: Record<string, any> = { ...(nluResult.updates || {}) };

  // === Blok 2: NLU entities.dates → normalize (string veya string[] olabilir) ===
  const nluDates = normalizeNluField(nluResult.entities?.dates);
  if (nluDates.length > 0) {
    extractedInfo.selectedDate = normalizeDateString(nluDates[0]);
  }

  // === Blok 3: simple-extractor (isim, telefon, paxAdult, tarih) ===
  const simple = extractNameAndPhone(message, context.collectionStep);
  if (simple.fullName && !extractedInfo.fullName) extractedInfo.fullName = simple.fullName;
  if (simple.phone && !extractedInfo.phone) extractedInfo.phone = simple.phone;
  if (simple.paxAdult && !extractedInfo.paxAdult) extractedInfo.paxAdult = simple.paxAdult;
  if (simple.selectedDate && !extractedInfo.selectedDate) extractedInfo.selectedDate = simple.selectedDate;

  // === Blok 4: Email adımı (waiting_for_email) ===
  if (context.collectionStep === "waiting_for_email") {
    const emailFound = extractEmail(message);
    const skipFound = isEmailSkipRequest(message, context.language);
    if (emailFound) extractedInfo.email = emailFound;
    else if (skipFound) extractedInfo.emailSkipped = true;
  }

  // === Blok 5: Context-aware — isim (esnek mod) ===
  const expectedInput = getNextExpectedInput(context);

  if (expectedInput === "name" && !extractedInfo.fullName) {
    const words = message.trim().split(/\s+/);
    if (
      words.length >= 2 &&
      words.length <= 4 &&
      !message.includes("?") &&
      !/\d/.test(message) &&
      words.every((w) => w.length >= 2)
    ) {
      const blacklist = ["evet", "hayır", "tamam", "olur", "haydi", "hadi", "rezervasyon", "onaylıyorum", "iptal", "cancel"];
      if (!blacklist.some((w) => message.toLowerCase().includes(w))) {
        extractedInfo.fullName = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
      }
    }
  }

  // === Blok 6: Context-aware — kişi sayısı (düz rakam) ===
  if (!extractedInfo.paxAdult && expectedInput === "pax") {
    const n = parseInt(message.trim());
    if (!isNaN(n) && n >= 1 && n <= 50) extractedInfo.paxAdult = n;
  }

  // === Blok 7: Tarih "date_N" prefix → indekse çevir ===
  if (extractedInfo.selectedDate?.startsWith("date_") && context.currentTour) {
    const tour = findTourById(context.currentTour.id, tours);
    if (tour?.dates) {
      const idx = parseInt(extractedInfo.selectedDate.split("_")[1]);
      if (idx >= 0 && idx < tour.dates.length) {
        extractedInfo.selectedDate = tour.dates[idx].departure_date;
        extractedInfo.dateId = tour.dates[idx].id;
      }
    }
  }

  // === Blok 8: Numeric tarih girişi ("1", "2", "3") ===
  if (!extractedInfo.dateId && context.currentTour && (expectedInput === "date" || expectedInput === "date_selection")) {
    const n = parseInt(message.trim());
    if (!isNaN(n) && n >= 1) {
      const tour = findTourById(context.currentTour.id, tours);
      if (tour?.dates && n <= tour.dates.length) {
        extractedInfo.selectedDate = tour.dates[n - 1].departure_date;
        extractedInfo.dateId = tour.dates[n - 1].id;
      }
    }
  }

  // === Blok 9: String tarih eşleştirme (DD.MM.YYYY, YYYY-MM-DD, gün+ay) ===
  if (extractedInfo.selectedDate && !extractedInfo.dateId && context.currentTour) {
    const tour = findTourById(context.currentTour.id, tours);
    if (tour?.dates?.length > 0) {
      const matched = matchDateWithTourDates(extractedInfo.selectedDate, tour.dates);
      if (matched) {
        extractedInfo.selectedDate = matched.departure_date;
        extractedInfo.dateId = matched.id;
      }
    }
  }

  // === Blok 10: Tek tarih otomatik seçim ===
  if (
    !extractedInfo.dateId &&
    !extractedInfo.selectedDate &&
    context.currentTour?.dates?.length === 1 &&
    (fsmIntent === "provide_info" || fsmIntent === "confirm" || fsmIntent === "reservation_intent")
  ) {
    const single = context.currentTour.dates[0];
    extractedInfo.selectedDate = single.departure_date;
    extractedInfo.dateId = single.id;
  }

  return extractedInfo;
}
