// Anket puan-deseni — TEK KAYNAK (2026-07-10, B3 cevap-yakalama, 7-dil).
//
// parseRating(message): 1-5 arası puanı çıkarır (yoksa null) + opsiyonel yorum.
// Kabul: tek rakam 1-5 (AR-rakam GİRİŞ-NOKTASINDA normalize edilmiş varsayılır) /
//        1-5 adet ⭐ / yazıyla 1-5 (7 dil) — opsiyonel kısa yorum eki.
// RED (null): 6+ rakam, tarih-deseni, tur-adı sinyali → normal akışa bırak.
// Pattern disiplini: \p{L}\p{N} lookaround + /iu (Yan #8).

// Yazıyla 1-5 (7 dil). Değer = puan. ASCII varyantlar dahil (üç/uc, beş/bes).
const WORD_RATINGS: Record<string, number> = {
  // TR
  "bir": 1, "iki": 2, "üç": 3, "uc": 3, "dört": 4, "dort": 4, "beş": 5, "bes": 5,
  // EN
  "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
  // DE
  "eins": 1, "zwei": 2, "drei": 3, "vier": 4, "fünf": 5, "funf": 5,
  // FR
  "un": 1, "une": 1, "deux": 2, "trois": 3, "quatre": 4, "cinq": 5,
  // ES
  "uno": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5,
  // RU
  "один": 1, "два": 2, "три": 3, "четыре": 4, "пять": 5,
  // AR
  "واحد": 1, "اثنان": 2, "اثنين": 2, "ثلاثة": 3, "أربعة": 4, "اربعة": 4, "خمسة": 5,
};

// "yıldız/star/étoile/estrella/звезда/نجوم/Stern" — puan-bağlamı güçlendirici (opsiyonel).
const STAR_WORD_RE =
  /(?<![\p{L}\p{N}])(y[ıi]ld[ıi]z\p{L}*|stars?|sterne?|[ée]toiles?|estrellas?|звёзд\p{L}*|звезд\p{L}*|نجوم|نجمة|نجمات)(?![\p{L}\p{N}])/iu;

// Tarih/tur sinyali → puan DEĞİL (çakışma koruması).
const NON_RATING_RE =
  /(?<![\p{L}\p{N}])(ocak|şubat|mart|nisan|may[ıi]s|haziran|temmuz|a[ğg]ustos|eyl[üu]l|ekim|kas[ıi]m|aral[ıi]k|january|february|march|april|june|july|august|september|october|november|december|turu?|tour|gece|g[üu]n|ki[şs]i|pax|person|\d{1,2}[.\/]\d{1,2})(?![\p{L}\p{N}])/iu;

export interface RatingParse {
  rating: number;        // 1-5
  comment: string | null;
}

/**
 * Mesajdan 1-5 puanı + opsiyonel yorumu çıkarır. Yoksa null.
 * NOT: AR/Farsça rakamlar GİRİŞ-NOKTASINDA ASCII'ye normalize edilmiş olmalı
 *      (webhook feedback-capture bunu garanti eder — ٥→5).
 */
export function parseRating(message: string): RatingParse | null {
  const msg = (message || "").trim();
  if (!msg || msg.length > 200) return null;

  // Tarih/tur sinyali içeriyorsa puan sayma (yeni talep / tarih olabilir).
  if (NON_RATING_RE.test(msg)) return null;

  let rating: number | null = null;

  // 1) Yıldız emoji sayısı (1-5 ⭐/★)
  const starCount = (msg.match(/[⭐★]/gu) || []).length;
  if (starCount >= 1 && starCount <= 5) rating = starCount;

  // 2) Tek rakam 1-5 (mesajda TEK sayı olmalı; "10"/"2026" gibi 2+ haneli reddedilir)
  if (rating === null) {
    const nums = msg.match(/\d+/g) || [];
    if (nums.length === 1 && /^[1-5]$/.test(nums[0])) rating = parseInt(nums[0]);
    else if (nums.some((n) => n.length >= 2)) return null; // 6+/çok haneli → puan değil
  }

  // 3) Yazıyla 1-5 (7 dil) — kelime sınırlı eşleşme
  if (rating === null) {
    const lower = msg.toLocaleLowerCase("tr-TR");
    for (const [word, val] of Object.entries(WORD_RATINGS)) {
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu");
      if (re.test(lower)) { rating = val; break; }
    }
  }

  if (rating === null || rating < 1 || rating > 5) {
    // Yıldız kelimesi var ama sayı yoksa: belirsiz → yakalama (null).
    return null;
  }

  // Yorum: puanı/yıldızı çıkardıktan sonra kalan anlamlı metin.
  let comment = msg
    .replace(/[⭐★]/gu, " ")
    .replace(/(?<![\p{L}\p{N}])[1-5](?![\p{L}\p{N}])/g, " ")
    .replace(STAR_WORD_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Tek başına puan kelimesi kaldıysa (bir/five/...) yorum sayma
  if (comment && WORD_RATINGS[comment.toLocaleLowerCase("tr-TR")] !== undefined) comment = "";
  if (comment.length < 2) comment = "";

  return { rating, comment: comment || null };
}
