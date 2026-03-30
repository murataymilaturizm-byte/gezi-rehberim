// Simple fallback extractor for name, phone, pax, and date
import type { ReservationInfo } from "./types.ts";

function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-\(\)\.]/g, "");
  if (cleaned.startsWith("+")) {
    const digits = cleaned.replace("+", "");
    if (digits.length >= 7 && digits.length <= 15 && /^\d+$/.test(digits)) return cleaned;
    return null;
  }
  if (!/^\d+$/.test(cleaned)) return null;
  if (cleaned.length < 7 || cleaned.length > 15) return null;
  return cleaned;
}

export function extractNameAndPhone(
  message: string,
  collectionStep?: string,
  tourDates?: any[], // tourDates opsiyonel olarak geçilir
): {
  fullName?: string;
  phone?: string;
  paxAdult?: number;
  selectedDate?: string;
  dateId?: string;
  needsMonthClarification?: boolean;
} {
  const result: {
    fullName?: string;
    phone?: string;
    paxAdult?: number;
    selectedDate?: string;
    dateId?: string;
    needsMonthClarification?: boolean;
  } = {};

  // === TELEFON ===
  const intlMatch = message.match(/\+\d[\d\s\-\.]{6,17}/);
  if (intlMatch) {
    const phone = normalizePhone(intlMatch[0]);
    if (phone) result.phone = phone;
  }

  if (!result.phone) {
    const localPatterns = [/\b(05\d{9})\b/, /\b(0[1-9]\d{8,9})\b/, /\b(\d{10,11})\b/];
    for (const pattern of localPatterns) {
      const match = message.match(pattern);
      if (match) {
        const phone = normalizePhone(match[1]);
        if (phone) {
          result.phone = phone;
          break;
        }
      }
    }
  }

  // === PAX ===
  const paxPatterns = [
    /(\d+)\s*(?:kişi|kisi|person|people|yetişkin|adult)/i,
    /(\d+)\s*kişilik/i,
    /\b(\d+)\s*(?:yetişkin|adult)/i,
    /(?:evet|yes|ok|tamam)?\s*(\d+)\s*kişi/i,
  ];
  for (const pattern of paxPatterns) {
    const match = message.match(pattern);
    if (match) {
      const pax = parseInt(match[1]);
      if (pax >= 1 && pax <= 50) {
        result.paxAdult = pax;
        break;
      }
    }
  }

  // === TARİH ===
  const monthNames: Record<string, number> = {
    ocak: 1,
    şubat: 2,
    mart: 3,
    nisan: 4,
    mayıs: 5,
    haziran: 6,
    temmuz: 7,
    ağustos: 8,
    eylül: 9,
    ekim: 10,
    kasım: 11,
    aralık: 12,
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  };

  const lower = message.toLowerCase().trim();

  // "ayın 22'si", "ayın 22si", "22'sinde", "ayın 22" gibi ifadeler
  const ayinMatch = lower.match(/ay[ıi]n?\s*(\d{1,2})(?:'?s[ıi](?:nde)?)?/);
  if (ayinMatch) {
    const day = parseInt(ayinMatch[1]);
    if (day >= 1 && day <= 31) {
      if (tourDates && tourDates.length > 0) {
        // tourDates varsa: aynı gün numarasına sahip tarihleri bul
        const matchedDates = tourDates.filter((d) => {
          const parts = d.departure_date?.match(/\d{4}-\d{2}-(\d{2})/);
          return parts && parseInt(parts[1]) === day;
        });

        if (matchedDates.length === 1) {
          // Tek eşleşme → direkt seç
          result.dateId = matchedDates[0].id;
          result.selectedDate = matchedDates[0].departure_date;
        } else if (matchedDates.length > 1) {
          // Birden fazla eşleşme → netleştirme gerekli, hiçbir şey seçme
          result.needsMonthClarification = true;
        }
        // matchedDates.length === 0 → tarih bulunamadı, result boş kalır
      } else {
        // tourDates yoksa: özel format döndür, webhook'ta eşleştirilecek
        result.selectedDate = `day_${day}`;
      }
    }
  }

  // "22 aralık", "15 ocak" standart format
  if (!result.selectedDate && !result.dateId && !result.needsMonthClarification) {
    const monthPatternMatch = lower.match(
      /(\d{1,2})\s*(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık|january|february|march|april|may|june|july|august|september|october|november|december)/i,
    );
    if (monthPatternMatch) {
      const day = parseInt(monthPatternMatch[1]);
      const monthName = monthPatternMatch[2].toLowerCase();
      const month = monthNames[monthName];
      if (day >= 1 && day <= 31 && month) {
        const year = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        const adjustedYear = month < currentMonth ? year + 1 : year;
        result.selectedDate = `${adjustedYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  // "aralık 22" ters format
  if (!result.selectedDate && !result.dateId && !result.needsMonthClarification) {
    const reverseMatch = lower.match(
      /(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık|january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{1,2})/i,
    );
    if (reverseMatch) {
      const monthName = reverseMatch[1].toLowerCase();
      const day = parseInt(reverseMatch[2]);
      const month = monthNames[monthName];
      if (day >= 1 && day <= 31 && month) {
        const year = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        const adjustedYear = month < currentMonth ? year + 1 : year;
        result.selectedDate = `${adjustedYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  // "ikinci tarih", "second option" sıralı ifadeler
  if (!result.selectedDate && !result.dateId && !result.needsMonthClarification) {
    const ordinalMap: Record<string, number> = {
      birinci: 0,
      ikinci: 1,
      üçüncü: 2,
      dördüncü: 3,
      beşinci: 4,
      first: 0,
      second: 1,
      third: 2,
      fourth: 3,
      fifth: 4,
    };
    for (const [word, idx] of Object.entries(ordinalMap)) {
      if (lower.includes(word)) {
        result.selectedDate = `index_${idx}`;
        break;
      }
    }
  }

  // Sayısal tarih: "22.12.2026", "22/12/2026"
  if (!result.selectedDate && !result.dateId && !result.needsMonthClarification) {
    const numericMatch = message.match(/(\d{1,2})[\.\/-](\d{1,2})(?:[\.\/-](\d{2,4}))?/);
    if (numericMatch) {
      const day = parseInt(numericMatch[1]);
      const month = parseInt(numericMatch[2]);
      let year = numericMatch[3] ? parseInt(numericMatch[3]) : new Date().getFullYear();
      if (year < 100) year += 2000;
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        result.selectedDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  // === İSİM ===
  if (collectionStep === "waiting_for_name") {
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
        "onay",
        "iptal",
        "cancel",
        "değiştir",
        "change",
      ];
      const lowerMsg = message.toLowerCase();
      if (!basicBlacklist.some((w) => lowerMsg.includes(w))) {
        result.fullName = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        return result;
      }
    }
  }

  // Diğer aşamalarda sıkı isim doğrulama
  const nameMatch = message.match(
    /\b([A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,}\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,}(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,})?)\b/,
  );
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (isValidName(name, message)) result.fullName = formatName(name);
  }

  return result;
}

function isValidName(name: string, fullMessage: string): boolean {
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
    "haydi",
    "hadi",
    "kabul",
    "kişi",
    "tur",
    "kayıt",
    "tarih",
    "rezervasyon",
    "booking",
    "nereden",
    "nereye",
    "nasıl",
    "kaçta",
    "hangi",
    "kim",
    "neden",
    "nerede",
    "istiyorum",
    "istiyor",
    "ister",
    "sorun",
    "soru",
    "bilgi",
    "telefon",
    "numara",
    "vermiştim",
    "verdim",
    "söyledim",
    "yazdım",
    "aralık",
    "ocak",
    "şubat",
    "mart",
    "nisan",
    "mayıs",
    "haziran",
    "temmuz",
    "ağustos",
    "eylül",
    "ekim",
    "kasım",
    "onaylıyorum",
    "onay",
    "kabul",
    "ediyorum",
    "confirm",
    "doğru",
    "yanlış",
    "iptal",
    "cancel",
    "değiştir",
    "change",
    "this",
    "that",
    "with",
    "from",
    "have",
    "will",
    "would",
    "kapadokya",
    "istanbul",
    "ankara",
    "antalya",
    "bodrum",
    "pamukkale",
    "teşekkür",
    "merhaba",
    "günaydın",
    "iyi",
    "akşamlar",
    "geceler",
  ];

  const lowerName = name.toLowerCase();
  if (blacklist.some((word) => lowerName.includes(word))) return false;
  if (fullMessage.includes("?")) return false;

  const nameContextPatterns = /adım|ismim|benim adım|my name is|isim:/i;
  const messageIsShort = fullMessage.trim().split(/\s+/).length <= 4;
  if (!nameContextPatterns.test(fullMessage) && !messageIsShort) return false;

  return true;
}

function formatName(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
