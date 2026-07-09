// Simple fallback extractor for name, phone, pax, and date
import type { ReservationInfo } from "./types.ts";
import { isValidPax } from "../utils/validation.ts";
import { MONTH_NAME_TO_NUMBER, MONTH_ALTERNATION } from "../constants/month-names.ts";
import { REL_TODAY, REL_TOMORROW, REL_DAY_AFTER, REL_NEXT_WEEK, REL_DAY_NAMES, relRegex } from "../constants/relative-date-words.ts";
import { PEOPLE_CONTEXT_RE, PAX_ADULT_RE, PAX_CHILD_RE } from "../constants/people-words.ts";

// ─── Göreceli tarih çıkarımı ─────────────────────────────────────────────────
function extractRelativeDate(text: string, language: string): Date | null {
  const lower = text.toLowerCase();

  // 2026-07-09 NLU-pilot-A İş0: göreli-kelime setleri TEK KAYNAK'tan türetilir
  // (constants/relative-date-words.ts). ASCII süperset (öbür/obür/öbur/obur,
  // yarın/yarin, bugün/bugun) + Yan #8 lookaround orada baked-in. Kopya YOK —
  // echo-sanitize aynı kaynağı tüketir (senkronsuzluk = canlı bug sınıfı).
  const langKey = language;
  const now = new Date();

  // Grup testi: langKey gövdesi + EN fallback. BOŞ/eksik gövdeyi ATLA — relRegex("")
  // boşluk sınırında eşleşir (kritik: ar'da REL_DAY_AFTER yok → tüm Arapça mesaj
  // yanlış +2 gün çözülürdü). Eski `?.test` optional-chaining güvenliğinin karşılığı.
  const _test = (group: Record<string, string>): boolean => {
    const b = group[langKey];
    return (!!b && relRegex(b).test(lower)) || (!!group.en && relRegex(group.en).test(lower));
  };

  // bugün/today → offset 0 (önceki setlerde YOKTU — İş0 ile eklendi).
  if (_test(REL_TODAY)) return new Date(now);
  if (_test(REL_TOMORROW)) { const d = new Date(now); d.setDate(d.getDate() + 1); return d; }
  if (_test(REL_DAY_AFTER)) { const d = new Date(now); d.setDate(d.getDate() + 2); return d; }
  if (_test(REL_NEXT_WEEK)) { const d = new Date(now); d.setDate(d.getDate() + 7); return d; }

  // Gün isimleri: DIŞ indeks = hafta günü (getDay ile hizalı) → "bir sonraki o gün".
  for (const weekdays of Object.values(REL_DAY_NAMES)) {
    for (let i = 0; i < weekdays.length; i++) {
      // i = hafta günü indeksi; iç dizi = varyantlar (salı/sali) — hepsi aynı gün.
      if (relRegex(weekdays[i].join("|")).test(lower)) {
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

// 2026-07-09 FAZ3-mikro (İş2 kalıntısı): mesajda göreli-tarih kelimesi VAR MI?
// extractRelativeDate'in 7-dil setini YENİDEN KULLANIR (kopya YOK — tek kaynak).
// Kullanım: info-extractor Blok 2 — göreli-kelime varken NLU dates[] güvenilmez
// (NLU yanlış çapadan ISO hesaplıyor: canlı vaka "yarın"→"2026-12-21" konuşma
// özetindeki seçili 20.12'yi çapa aldı) → NLU dates YOKSAY, extractRelativeDate/
// Blok 9d zinciri (bugün-çapa, Europe/Istanbul) otorite olsun.
export function hasRelativeDateWord(text: string): boolean {
  for (const lang of ["tr", "en", "de", "ru", "ar", "fr", "es"]) {
    if (extractRelativeDate(text, lang)) return true;
  }
  return false;
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

// 2026-06-24 C3 fix (Opsiyon 2 — exec d9210ba4): "yirmi aralık" mesajında
// "yirmi" tek-kelime sayı pax-context (kişi/insan/...) olmadan kabul ediliyordu
// (≤3 kelime fallback). "yirmi aralık" 2 kelime → pax=20 sızıyordu — tarih
// mesajı pax adımına yutulmuş gibi state'e yazılıyordu (totalPax: 20 canlı bug).
// Hedefli fix: ay ismi içeren mesajlarda sözcükle yazılan pax ÇIKARMA.
// Tarih çıkarımı etkilenmez (TARİH için ayrı pattern'ler kullanılır).
// 2026-07-09 FABLE-denetim: (1) KOPYA-LİSTE → MONTH_ALTERNATION tek-kaynak
// (C3 guard'ı artık 7-dil: "twenty december"/"zwanzig dezember" de pax sızdırmaz);
// (2) \b + "şubat" (ş-başlangıç) HİÇ eşleşmiyordu → "yirmi şubat" pax=20 sızıntısı
// AÇIKTI (Yan #8) → lookaround.
const TR_MONTHS_GUARD = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${MONTH_ALTERNATION})(?![\\p{L}\\p{N}])`, "iu");

function extractPaxFromWords(text: string, language: string, collectionStep?: string): number | null {
  const lower = text.toLowerCase();
  // C3 GUARD: mesajda ay ismi varsa pax çıkarımı pas — büyük olasılıkla tarih.
  // "yirmi kişi" gibi PAX context VARSA bu guard zaten aşağıda çalışmaz (ay yok).
  // "yirmi aralık" → ay var → null dön.
  if (TR_MONTHS_GUARD.test(lower)) return null;

  const words = NUMBER_WORDS[language] || NUMBER_WORDS.en;
  // 2026-07-09 Faz 5 (Vaka 2): TEK KAYNAK (people-words.ts) — 7-dil + lookaround.
  const peopleContext = PEOPLE_CONTEXT_RE;

  // 2026-06-26 BUG-X9 FIX: peopleContext ZORUNLU + waiting_for_pax istisnası.
  // Eski "≤3/≤4 kelime fallback" peopleContext olmadan pax çıkarıyordu →
  // "Ondördü olur" (waiting_for_date) → 14 pax SIZINTI → DB 14×900=12.600₺.
  // Yeni: peopleContext zorunlu — AMA bot zaten "kaç kişi?" sorduysa
  // (waiting_for_pax) kullanıcı tek-kelime "yedi"/"üç" diyebilir; o adımda
  // fallback KORUNUR (peopleContext olmadan da yazıyla sayı pax sayılır).
  const _allowFallback = collectionStep === "waiting_for_pax";

  // Çok kelimeli sayıları önce dene ("on iki")
  const multiWordEntries = Object.entries(words)
    .filter(([w]) => w.includes(" "))
    .sort((a, b) => b[0].length - a[0].length);

  for (const [word, value] of multiWordEntries) {
    if (lower.includes(word)) {
      if (peopleContext.test(lower) || (_allowFallback && lower.trim().split(/\s+/).length <= 4)) {
        return value;
      }
    }
  }

  // Tek kelimeli sayılar
  for (const [word, value] of Object.entries(words).filter(([w]) => !w.includes(" "))) {
    if (new RegExp(`\\b${word}\\b`, "i").test(lower)) {
      if (peopleContext.test(lower) || (_allowFallback && lower.trim().split(/\s+/).length <= 3)) {
        return value;
      }
    }
  }

  return null;
}

export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-\(\)\.]/g, "");
  if (cleaned.startsWith("+")) {
    const digits = cleaned.replace("+", "");
    // Uluslararası format: min 7 rakam (kısa alan kodları için)
    if (digits.length >= 7 && digits.length <= 15 && /^\d+$/.test(digits)) return cleaned;
    return null;
  }
  if (!/^\d+$/.test(cleaned)) return null;
  // Yerel format: min 10 rakam — "12345" gibi kısa sayılar reddedilir (BUG 4)
  if (cleaned.length < 10 || cleaned.length > 15) return null;
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
  paxChild?: number;
  selectedDate?: string;
  dateId?: string;
  needsMonthClarification?: boolean;
} {
  const result: {
    fullName?: string;
    phone?: string;
    paxAdult?: number;
    paxChild?: number;
    selectedDate?: string;
    dateId?: string;
    needsMonthClarification?: boolean;
  } = {};

  // Fonksiyon boyunca kullanılır — TDZ hatasını önlemek için en başta tanımla
  const lower = message.toLowerCase().trim();

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
  // Negative lookbehind (?<![-\d]) : "-3 kişi" gibi negatif sayıları engelle
  // 2026-06-25 FIX KÖK 2: paxChild pattern eklendi (canlı bug "3 yetişkin 2 çocuk" → state'e
  // SADECE adults=3 yazılıyordu, paxChild yutuluyordu → fiyat eksik). Önce çocuk pattern,
  // SONRA yetişkin pattern (mesajda her ikisi de varsa ikisi de çıkar).
  // 2026-07-09 Faz 5 (Vaka 2): TEK KAYNAK PAX_CHILD_RE (7-dil, "دفال" typo duzeltildi).
  const paxChildPatterns = [PAX_CHILD_RE];
  for (const pattern of paxChildPatterns) {
    const match = message.match(pattern);
    if (match) {
      const childN = parseInt(match[1]);
      if (childN >= 0 && childN <= 50) {
        result.paxChild = childN;
        break;
      }
    }
  }

  const paxPatterns = [
    PAX_ADULT_RE, // 2026-07-09 Faz 5 (Vaka 2): 7-dil tek-kaynak (ppl/personen/человек/أشخاص)
    /(?<![-\d])(\d+)\s*kişilik/i,
    /(?<![^\s])\b(\d+)\s*(?:yetişkin|adult)/i,
    /(?:evet|yes|ok|tamam)?\s*(?<![-])(\d+)\s*kişi/i,
  ];
  for (const pattern of paxPatterns) {
    const match = message.match(pattern);
    if (match) {
      const pax = parseInt(match[1]);
      // R6: tek-helper validasyon (1-9). Üst sınır aşımı → handler aşım mesajı.
      if (isValidPax(pax)) {
        result.paxAdult = pax;
        break;
      }
    }
  }
  // Fallback: yazıyla yazılmış sayılar ("üç kişi", "three people")
  // 2026-06-26 BUG-X9: collectionStep geçirildi — waiting_for_pax dışında
  // peopleContext zorunlu (tarih sayısı "ondördü olur" pax'e sızmasın).
  if (!result.paxAdult) {
    // TR + EN + DE + RU dene — dil bilinmediğinden sırayla kontrol
    for (const lang of ["tr", "en", "de", "ru", "ar", "fr", "es"]) {
      const wordPax = extractPaxFromWords(message, lang, collectionStep);
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

  // 2026-07-03 FAZ2-kapanış İş 1: lokal kopya liste kaldırıldı — TEK KAYNAK
  // constants/month-names.ts (kopya-liste senkronsuzluğu canlı bug üretmişti).
  const monthNames = MONTH_NAME_TO_NUMBER;

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
        }
        // 2026-07-09 FABLE-denetim: needsMonthClarification KALDIRILDI —
        // üretiliyordu ama repo genelinde TÜKETİCİSİ YOKTU (ölü API; işlevi
        // Blok 8.5 + dateAmbiguousDay/:10f devralmıştı). Çoklu-eşleşmede
        // hiçbir şey seçmeme davranışı AYNEN (V9 sessiz-ilk-seçim-yok).
        // matchedDates.length === 0 → tarih bulunamadı, result boş kalır
      } else {
        // tourDates yoksa: özel format döndür, webhook'ta eşleştirilecek
        result.selectedDate = `day_${day}`;
      }
    }
  }

  // BUG #1 FIX (T4): "15.12.2026" / "15/12/2026" / "15-12-2026" — DD.MM.YYYY sayısal format
  // NLU entities.dates döndermezse fallback. ISO format (2026-12-15) zaten NLU üzerinden çalışır.
  if (!result.selectedDate && !result.dateId && !result.needsMonthClarification) {
    const numericDateMatch = lower.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\b/);
    if (numericDateMatch) {
      const day = parseInt(numericDateMatch[1]);
      const month = parseInt(numericDateMatch[2]);
      const year = parseInt(numericDateMatch[3]);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
        const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (tourDates && tourDates.length > 0) {
          const matched = tourDates.find((d: any) => d.departure_date === iso);
          if (matched) {
            result.dateId = matched.id;
            result.selectedDate = matched.departure_date;
          } else {
            // tourDates'te eşleşme yoksa selectedDate'i ISO'ya çevirip set et — info-extractor da bunu kullanabilir
            result.selectedDate = iso;
          }
        } else {
          result.selectedDate = iso;
        }
      }
    }
  }

  // "22 aralık", "15 ocak", "15. März", "15 septembre" standart format (7 dil)
  if (!result.selectedDate && !result.dateId && !result.needsMonthClarification) {
    // 2026-07-03 V1-ASCII → FAZ2-kapanış: elle regex TEK KAYNAK alternation'a
    // bağlandı (MONTH_ALTERNATION — TR ASCII varyantları dahil, uzun-önce sıralı).
    const monthPatternMatch = lower.match(
      new RegExp(`(\\d{1,2})[\\s.]+(?:de\\s+|du\\s+|d[e']\\s+)?(${MONTH_ALTERNATION})`, "i"),
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
      new RegExp(`(${MONTH_ALTERNATION})\\s*(\\d{1,2})`, "i"),
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
    // 2026-07-03 J-16: VAZGEÇME+DOLGU token elemesi. Canlı: "boşver kalsın"
    // 2-kelime yolundan İSİM olarak yazıldı (NLU intent'inden bağımsız).
    // Eleme sonrası: "boşver kalsın" → 0 kelime → isim YOK (detectCancellation
    // iptal akışını devralır); "boşver, ahmet yılmaz olsun" → ["ahmet","yılmaz"]
    // → isim yazılır (DEĞER-ÖNCELİK — kullanıcı terk etmiyor, veriyor).
    const _giveUpDropRe = /^(boşver|bosver|kalsın|kalsin|neyse|vazgeç|vazgec|vazgeçtim|vazgectim|olsun|lütfen|lutfen|nevermind|forget|it)$/i;
    const words = message.trim().split(/\s+/)
      .map((w) => w.replace(/[.,!?;:"'()]/gu, ""))
      .filter((w) => w && !_giveUpDropRe.test(w));
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

export function formatName(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// ─── Email çıkarımı ───────────────────────────────────────────────────────────

const _EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/i;

/**
 * Mesajdan ilk geçerli email adresini çıkarır.
 * Bulunamazsa null döner.
 */
export function extractEmail(text: string): string | null {
  const m = text.match(_EMAIL_RE);
  return m ? m[0].toLowerCase() : null;
}

// 7 dilde "geçmek istiyorum" kalıpları
const _SKIP_EMAIL: Record<string, RegExp> = {
  // 2026-06-21 Yan #8 fix: \b → \p{L}\p{N} lookaround. "ge[çc]" — geç (ç bitişli)
  // eski \b ile kaçıyordu. Şimdi "geç" tek başına email skip için yakalanır.
  tr: /(?<![\p{L}\p{N}])(ge[çc]|atla|istemiyorum|yok|bo[şs]\s*ver|atlayım|geçelim|emailim\s*yok|mailim\s*yok|e-?posta\s*yok)(?![\p{L}\p{N}])/iu,
  en: /\b(skip|pass|no\s*email|don'?t\s*have|no\s*thanks|later|never\s*mind|without)\b/i,
  de: /\b(überspringen|nein|kein|später|habe\s*keine|egal|ohne)\b/i,
  ru: /\b(пропустить|нет|без|пропусти|не\s*надо|пропускаю)\b/i,
  ar: /\b(تخطي|لا|ليس\s*لدي|تجاوز|تخطى)\b/i,
  fr: /\b(passer|non|sans|plus\s*tard|pas\s*d'email|ignorer)\b/i,
  es: /\b(saltar|no|sin|más\s*tarde|no\s*tengo|omitir)\b/i,
};

/**
 * Kullanıcı email adımını atlamak istiyorsa true döner.
 * "geç", "skip", "pass", "no thanks" vb. kalıpları yakalar.
 */
export function isEmailSkipRequest(text: string, language: string): boolean {
  const pattern = _SKIP_EMAIL[language] || _SKIP_EMAIL.en;
  return pattern.test(text);
}

// ─── Negatif / geçersiz kişi sayısı tespiti ──────────────────────────────────

/**
 * Kullanıcı negatif veya sıfır kişi sayısı belirttiyse true döner.
 * "-3 kişi", "- 5 person", "0 kişi" gibi girdileri yakalar.
 */
export function isNegativePaxMessage(text: string): boolean {
  return /(?:^|\s)-\s*\d+|\b0\s*(?:kişi|person|people|yetişkin|adult|personas|personnes|человек)/i.test(text);
}
