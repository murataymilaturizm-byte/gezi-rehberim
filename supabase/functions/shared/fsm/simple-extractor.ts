// Simple fallback extractor for name, phone, pax, and date
import type { ReservationInfo } from "./types.ts";

// ─── Göreceli tarih çıkarımı ─────────────────────────────────────────────────
function extractRelativeDate(text: string, language: string): Date | null {
  const lower = text.toLowerCase();

  const tomorrowPatterns: Record<string, RegExp> = {
    tr: /\b(yarın|yarin)\b/,
    en: /\b(tomorrow)\b/,
    de: /\b(morgen)\b/,
    ru: /\b(завтра)\b/,
    ar: /\b(غدا|غداً)\b/,
    fr: /\b(demain)\b/,
    es: /\b(mañana|manana)\b/,
  };

  const dayAfterTomorrowPatterns: Record<string, RegExp> = {
    tr: /\b(öbür\s*gün|obur\s*gun|ertesi\s*gün)\b/,
    en: /\b(day\s*after\s*tomorrow)\b/,
    de: /\b(übermorgen|uebermorgen)\b/,
    ru: /\b(послезавтра)\b/,
    fr: /\b(après[\s-]?demain|apres[\s-]?demain)\b/,
    es: /\b(pasado\s*ma[nñ]ana)\b/,
  };

  const nextWeekPatterns: Record<string, RegExp> = {
    tr: /\b(haftaya|gelecek\s*hafta|önümüzdeki\s*hafta)\b/,
    en: /\b(next\s*week)\b/,
    de: /\b(nächste\s*woche|naechste\s*woche)\b/,
    ru: /\b(следующ\S+\s+недел\S+|на\s+следующ\S+\s+недел\S+)\b/,
    fr: /\b(la\s*semaine\s*prochaine|semaine\s*prochaine)\b/,
    es: /\b(la\s*pr[oó]xima\s*semana|pr[oó]xima\s*semana)\b/,
  };

  const langKey = language as keyof typeof tomorrowPatterns;
  const now = new Date();

  if (tomorrowPatterns[langKey]?.test(lower) || tomorrowPatterns.en.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }

  if (dayAfterTomorrowPatterns[langKey]?.test(lower) || dayAfterTomorrowPatterns.en.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return d;
  }

  if (nextWeekPatterns[langKey]?.test(lower) || nextWeekPatterns.en.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    return d;
  }

  // Gün isimleri: "pazartesi", "monday" → bir sonraki o gün
  const dayNames: Record<string, string[]> = {
    tr: ["pazar", "pazartesi", "salı", "çarşamba", "perşembe", "cuma", "cumartesi"],
    en: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
    de: ["sonntag", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag"],
    ru: ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"],
    fr: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
    es: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
  };
  for (const days of Object.values(dayNames)) {
    for (let i = 0; i < days.length; i++) {
      if (new RegExp(`\\b${days[i]}\\b`, "i").test(lower)) {
        const currentDay = now.getDay();
        let daysUntil = i - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        const d = new Date(now);
        d.setDate(d.getDate() + daysUntil);
        return d;
      }
    }
  }

  return null;
}

// ─── Yazıyla sayı çıkarımı (fallback) ────────────────────────────────────────
const NUMBER_WORDS: Record<string, Record<string, number>> = {
  tr: {
    bir: 1, iki: 2, üç: 3, uc: 3, dört: 4, dort: 4,
    beş: 5, bes: 5, altı: 6, alti: 6, yedi: 7, sekiz: 8,
    dokuz: 9, on: 10, "on bir": 11, "on iki": 12, "on üç": 13,
    "on dört": 14, "on beş": 15, yirmi: 20, otuz: 30,
  },
  en: {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30,
  },
  de: {
    eins: 1, ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4,
    fünf: 5, funf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9,
    zehn: 10, elf: 11, zwölf: 12, zwanzig: 20,
  },
  ru: {
    один: 1, одна: 1, два: 2, двое: 2, три: 3, трое: 3,
    четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8,
    девять: 9, десять: 10,
  },
  ar: {
    واحد: 1, اثنان: 2, اثنين: 2, ثلاثة: 3, أربعة: 4,
    خمسة: 5, ستة: 6, سبعة: 7, ثمانية: 8, تسعة: 9, عشرة: 10,
  },
  fr: {
    un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
    six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  },
  es: {
    uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
    seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  },
};

function extractPaxFromWords(text: string, language: string): number | null {
  const lower = text.toLowerCase();
  const words = NUMBER_WORDS[language] || NUMBER_WORDS.en;
  const peopleContext =
    /\b(ki[şs]i|insan|person|people|kinder|kind|adult|yetişkin|kişiyiz|kişiyim|اشخاص|personas|personnes|человек|гостей)\b/i;

  // Çok kelimeli sayıları önce dene ("on iki")
  const multiWordEntries = Object.entries(words)
    .filter(([w]) => w.includes(" "))
    .sort((a, b) => b[0].length - a[0].length);

  for (const [word, value] of multiWordEntries) {
    if (lower.includes(word)) {
      if (peopleContext.test(lower) || lower.trim().split(/\s+/).length <= 4) {
        return value;
      }
    }
  }

  // Tek kelimeli sayılar
  for (const [word, value] of Object.entries(words).filter(([w]) => !w.includes(" "))) {
    if (new RegExp(`\\b${word}\\b`, "i").test(lower)) {
      if (peopleContext.test(lower) || lower.trim().split(/\s+/).length <= 3) {
        return value;
      }
    }
  }

  return null;
}

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
  // Fallback: yazıyla yazılmış sayılar ("üç kişi", "three people")
  if (!result.paxAdult) {
    // TR + EN + DE + RU dene — dil bilinmediğinden sırayla kontrol
    for (const lang of ["tr", "en", "de", "ru", "ar", "fr", "es"]) {
      const wordPax = extractPaxFromWords(message, lang);
      if (wordPax !== null && wordPax >= 1 && wordPax <= 50) {
        result.paxAdult = wordPax;
        break;
      }
    }
  }

  // === TARİH ===

  // Göreceli tarihler: "yarın", "öbür gün", "haftaya pazartesi" vb.
  // language bilgisi burada yok; TR + EN dene, tourDates varsa eşleştir
  if (!result.selectedDate && !result.dateId) {
    const relDate =
      extractRelativeDate(lower, "tr") ||
      extractRelativeDate(lower, "en") ||
      extractRelativeDate(lower, "de") ||
      extractRelativeDate(lower, "ru") ||
      extractRelativeDate(lower, "ar") ||
      extractRelativeDate(lower, "fr") ||
      extractRelativeDate(lower, "es");
    if (relDate) {
      const relDateStr = relDate.toISOString().split("T")[0];
      if (tourDates && tourDates.length > 0) {
        const matched = tourDates.find((d: any) => d.departure_date === relDateStr);
        if (matched) {
          result.dateId = matched.id;
          result.selectedDate = matched.departure_date;
        } else {
          // Tarih yok ama relative niyeti var — "relative_YYYY-MM-DD" döndür ki handler mesaj üretsin
          result.selectedDate = `relative_${relDateStr}`;
        }
      } else {
        result.selectedDate = relDateStr;
      }
    }
  }

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
