// Simple fallback extractor for name, phone, pax, and date (when NLU misses them)
import type { ReservationInfo } from "./types.ts";

export function extractNameAndPhone(
  message: string,
  collectionStep?: string,
): { fullName?: string; phone?: string; paxAdult?: number; selectedDate?: string } {
  const result: { fullName?: string; phone?: string; paxAdult?: number; selectedDate?: string } = {};

  // Extract phone
  const phonePatterns = [
    /\b(05\d{9})\b/,
    /\b(\+90[\s\-]?5\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})\b/,
    /\b(\d{10,11})\b/,
  ];

  for (const pattern of phonePatterns) {
    const match = message.match(pattern);
    if (match) {
      let phone = match[1].replace(/[\s\-]/g, "");
      if (phone.length >= 10 && phone.length <= 11 && /^\d+$/.test(phone)) {
        result.phone = phone;
        break;
      }
    }
  }

  // Extract pax
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

  // Extract date
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

  const monthPatternMatch = message
    .toLowerCase()
    .match(
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

  const numericDateMatch = message.match(/(\d{1,2})[\.\/-](\d{1,2})(?:[\.\/-](\d{2,4}))?/);
  if (!result.selectedDate && numericDateMatch) {
    const day = parseInt(numericDateMatch[1]);
    const month = parseInt(numericDateMatch[2]);
    let year = numericDateMatch[3] ? parseInt(numericDateMatch[3]) : new Date().getFullYear();
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      result.selectedDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // === İSİM ÇIKARMA ===
  // waiting_for_name aşamasında: esnek mod - chatbot isim sordu, kullanıcı cevapladı
  if (collectionStep === "waiting_for_name") {
    const words = message.trim().split(/\s+/);
    // 2-4 kelime, sayı yok, soru işareti yok, her kelime en az 2 karakter
    if (
      words.length >= 2 &&
      words.length <= 4 &&
      !message.includes("?") &&
      !/\d/.test(message) &&
      words.every((w) => w.length >= 2)
    ) {
      // Sadece temel blacklist kontrolü - çok sıkı değil
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
      const hasBlacklisted = basicBlacklist.some((w) => lowerMsg.includes(w));

      if (!hasBlacklisted) {
        result.fullName = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        return result; // İsim alındı, diğer kontrollere gerek yok
      }
    }
  }

  // Diğer aşamalarda: sıkı isim doğrulama
  const nameMatch = message.match(
    /\b([A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,}\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,}(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,})?)\b/,
  );
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (isValidName(name, message)) {
      result.fullName = formatName(name);
    }
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
    "hareket",
    "ediyor",
    "yapıyor",
    "gidiyor",
    "kalkıyor",
    "varıyor",
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
    "could",
    "should",
    "about",
    "which",
    "there",
    "their",
    "what",
    "when",
    "where",
    "want",
    "like",
    "just",
    "also",
    "your",
    "more",
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

  // Açık isim bağlamı veya kısa mesaj kontrolü
  const nameContextPatterns = /adım|ismim|benim adım|my name is|isim:/i;
  const messageIsShort = fullMessage.trim().split(/\s+/).length <= 4;
  if (!nameContextPatterns.test(fullMessage) && !messageIsShort) return false;

  return true;
}

function formatName(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
