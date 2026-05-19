// Unified info extraction service — replaces webhook's 10 inline extraction blocks.
// Davranış whatsapp-webhook/index.ts'deki inline bloklar ile EŞDEĞERDİR (Faz 1).

import type { ConversationContext } from "../fsm/types.ts";
import { extractNameAndPhone, extractEmail, isEmailSkipRequest, formatName, normalizePhone } from "../fsm/simple-extractor.ts";
import { findTourById } from "../fsm/tour-matcher.ts";
import { getNextExpectedInput } from "../fsm/state-machine.ts";

// getLocalizedTourTitle ve _TOUR_TITLE_TRANSLATIONS tanımları aşağıda,
// normalizeDateString'den sonra yer almaktadır.

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

/** 7 dil ay ismi → ay numarası */
const TEXT_MONTHS: Record<string, number> = {
  // TR
  ocak: 1, şubat: 2, mart: 3, nisan: 4, mayıs: 5, haziran: 6,
  temmuz: 7, ağustos: 8, eylül: 9, ekim: 10, kasım: 11, aralık: 12,
  // EN — tam form
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  // EN — kısa form ("Dec 22", "Jan 5" vb.)
  jan: 1, feb: 2, mar: 3, apr: 4,
  jun: 6, jul: 7, aug: 8, sep: 9, sept: 9,
  oct: 10, nov: 11, dec: 12,
  // DE — tam form (april/august/september/november EN ile aynı, kapsanmış)
  januar: 1, februar: 2, märz: 3, mai: 5, juni: 6, juli: 7,
  oktober: 10, dezember: 12,
  // FR
  janvier: 1, "février": 2, mars: 3, avril: 4, juin: 6, juillet: 7,
  "août": 8, septembre: 9, octobre: 10, novembre: 11, "décembre": 12,
  // ES
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, noviembre: 11, diciembre: 12,
  // RU (nominative + genitive)
  "январь": 1, "января": 1, "февраль": 2, "февраля": 2,
  "март": 3, "марта": 3, "апрель": 4, "апреля": 4,
  "май": 5, "мая": 5, "июнь": 6, "июня": 6,
  "июль": 7, "июля": 7, "август": 8, "августа": 8,
  "сентябрь": 9, "сентября": 9, "октябрь": 10, "октября": 10,
  "ноябрь": 11, "ноября": 11, "декабрь": 12, "декабря": 12,
  // AR
  "يناير": 1, "فبراير": 2,
  "مارس": 3, "أبريل": 4,
  "مايو": 5, "يونيو": 6,
  "يوليو": 7, "أغسطس": 8,
  "سبتمبر": 9, "أكتوبر": 10,
  "نوفمبر": 11, "ديسمبر": 12,
};

const _monthPattern = Object.keys(TEXT_MONTHS).join("|");
// DAY MONTH [YEAR] — "20 aralık", "22. Dezember", "22.Dezember", "20 december 2026"
// [.\s]+ → nokta, boşluk veya ikisi (boşluksuz "22.Dezember" de kabul)
const TEXT_MONTH_REGEX = new RegExp(
  `(\\d{1,2})[.\\s]+(${_monthPattern})(?:[.\\s]+(\\d{4}))?`,
  "i",
);
// MONTH DAY [YEAR] — "december 22", "Dec 22" (EN gün-sonu format)
const TEXT_MONTH_DAY_REGEX = new RegExp(
  `(${_monthPattern})\\.?\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?`,
  "i",
);

/**
 * Tarih string'ini YYYY-MM-DD formatına normalize eder.
 * Desteklenen formatlar:
 * - YYYY-MM-DD (zaten ISO — dokunma)
 * - DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY
 * - "20 aralık", "20 december", "20 марта" vb. (7 dil metin ay)
 * - Tanınmayan format → olduğu gibi döner
 */
export function normalizeDateString(dateStr: string): string {
  if (!dateStr) return dateStr;
  const cleaned = dateStr.toLowerCase().trim();

  // 1. Zaten ISO formatı
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // 2. DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY
  const dmy = dateStr.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;

  // 3a. "20 aralık" / "22. Dezember" / "20 december 2026" vb. — DAY MONTH
  const textMatch = cleaned.match(TEXT_MONTH_REGEX);
  if (textMatch) {
    const day = parseInt(textMatch[1]);
    const monthName = textMatch[2].toLowerCase();
    const month = TEXT_MONTHS[monthName];
    if (month && day >= 1 && day <= 31) {
      let year = textMatch[3] ? parseInt(textMatch[3]) : new Date().getFullYear();
      if (!textMatch[3]) {
        const candidate = new Date(year, month - 1, day);
        if (candidate < new Date()) year++;
      }
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // 3b. "december 22" / "Dec 22, 2026" vb. — MONTH DAY (EN formatı)
  const monthDayMatch = cleaned.match(TEXT_MONTH_DAY_REGEX);
  if (monthDayMatch) {
    const monthName = monthDayMatch[1].toLowerCase();
    const day = parseInt(monthDayMatch[2]);
    const month = TEXT_MONTHS[monthName];
    if (month && day >= 1 && day <= 31) {
      let year = monthDayMatch[3] ? parseInt(monthDayMatch[3]) : new Date().getFullYear();
      if (!monthDayMatch[3]) {
        const candidate = new Date(year, month - 1, day);
        if (candidate < new Date()) year++;
      }
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return dateStr; // Tanınmayan format — olduğu gibi bırak
}

/**
 * Tur başlığını hedef dile çevirir.
 * DB'de title_en/de/... boşsa translation map'ten otomatik çeviri yapar.
 * Bilinmeyen turlar için TR orijinali döner (fallback).
 */
export function getLocalizedTourTitle(title: string, language: string): string {
  if (!title || language === "tr") return title;
  // 1. zaten localized (pickLocalized != TR): döner
  // 2. TR ise map'e bak
  const lower = title.toLowerCase().trim();
  const map = _TOUR_TITLE_TRANSLATIONS[lower];
  if (map?.[language]) return map[language];
  // 3. Keyword-based replace (kısmi eşleşme için)
  for (const [trKey, translations] of Object.entries(_TOUR_TITLE_TRANSLATIONS)) {
    if (lower.includes(trKey) && translations[language]) {
      return title.replace(new RegExp(trKey, "gi"), translations[language]);
    }
  }
  return title;
}

/** Yaygın Türkçe tur başlıklarının çevirileri (DB'de title_en boşsa fallback) */
const _TOUR_TITLE_TRANSLATIONS: Record<string, Record<string, string>> = {
  "kapadokya balon turu": {
    en: "Cappadocia Balloon Tour",
    de: "Kappadokien Ballonfahrt",
    ru: "Полёт на воздушном шаре в Каппадокии",
    ar: "جولة بالون في كابادوكيا",
    fr: "Tour en Ballon de Cappadoce",
    es: "Tour en Globo de Capadocia",
  },
  "kapadokya turu": {
    en: "Cappadocia Tour", de: "Kappadokien Tour",
    ru: "Тур в Каппадокию", ar: "جولة كابادوكيا",
    fr: "Circuit de Cappadoce", es: "Tour de Capadocia",
  },
  "pamukkale turu": {
    en: "Pamukkale Tour", de: "Pamukkale Tour",
    ru: "Тур в Памуккале", ar: "جولة باموكالي",
    fr: "Circuit de Pamukkale", es: "Tour de Pamukkale",
  },
  "efes turu": {
    en: "Ephesus Tour", de: "Ephesus Tour",
    ru: "Тур в Эфес", ar: "جولة أفسس",
    fr: "Circuit d'Éphèse", es: "Tour de Éfeso",
  },
  "istanbul turu": {
    en: "Istanbul Tour", de: "Istanbul Tour",
    ru: "Тур по Стамбулу", ar: "جولة إسطنبول",
    fr: "Circuit d'Istanbul", es: "Tour de Estambul",
  },
  "antalya turu": {
    en: "Antalya Tour", de: "Antalya Tour",
    ru: "Тур в Анталию", ar: "جولة أنطاليا",
    fr: "Circuit d'Antalya", es: "Tour de Antalya",
  },
};

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

  // === Blok 1: NLU updates (en yüksek öncelik) — placeholder/hallucination koruması ===
  const _rawUpdates: Record<string, any> = nluResult.updates || {};
  const extractedInfo: Record<string, any> = {};
  // AI bazen "<UNKNOWN>", "N/A", "bilinmiyor" gibi dummy değerler döndürür — reservationInfo'ya sızmasın
  const _isPlaceholder = (s: string): boolean =>
    /^<.*>$|^undefined$|^null$|^n\/?a$|^-+$|^\?+$|^bilinmiyor$|^belirtilmedi$|^not\s+provided$|^unknown$/i.test(s.trim());
  for (const [k, v] of Object.entries(_rawUpdates)) {
    if (k === "fullName" && typeof v === "string" && v.trim()) {
      if (_isPlaceholder(v)) continue;
      // Tek kelimeli isim (soyad yok) kabul etme — BUG 3
      const _nameWords = v.trim().split(/\s+/);
      if (_nameWords.length < 2) continue;
      extractedInfo[k] = formatName(v.trim());
    } else if (k === "phone" && typeof v === "string" && v.trim()) {
      // KRİTİK: normalizePhone null dönerse FALLBACK YOK — placeholder DB'ye sızmasın
      const normalized = normalizePhone(v.trim());
      if (normalized) extractedInfo[k] = normalized;
    } else {
      extractedInfo[k] = v;
    }
  }

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
