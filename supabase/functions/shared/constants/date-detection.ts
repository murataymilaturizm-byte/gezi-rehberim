// 2026-06-19: Kullanıcının "tarih sorusu" sorduğunu tespit eden tek-kaynak modül.
// process-message.ts :11 (TARİH LİSTESİ deterministik bloğu) ve scripts/test_behavioral.ts
// her ikisi de buradan import eder — pattern duplication / senkron sapma riski sıfır.

/**
 * 7 dilli regex: tarih kelime/sorgu pattern'i.
 * Match: "ne zaman", "tarih", "müsait", "date", "when", "wann", "когда", "متى", "fecha", "quand", vb.
 * No-match: "merhaba", "rezervasyon", "3 kişi", isim/telefon mesajları.
 */
export const DATE_QUERY_RE =
  /(?:tarih|ne zaman|hangi g[üu]n|m[üu]sait|date|when|available|schedule|datum|wann|verf[üu]gbar|termin|дата|когда|доступн|تاريخ|متى|متاح|fecha|cu[áa]ndo|disponible|quand)/i;

/**
 * Tarih sorusu olarak yorumlanabilecek FSM intent'leri.
 * provide_info INTENT'İ DAHİL DEĞİL — kullanıcı veri verirken yanlışlıkla tarih
 * sorusu olarak yorumlanmamalı.
 */
export const DATE_INTENTS = ["faq_general", "tour_search", "browse_tours", "general", "general_question"];

// Dilim-5 (2026-10-08, canlı olay TURZZ-CANLI-ESKI-VERI-TESHIS.md): müşteri belirli bir
// turu İSTEDİĞİNDE/GÖRMEK İSTEDİĞİNDE ("kapadokya turlarını görmek istiyorum", "Kapadokya
// turu istiyorum") tarih listesi LLM'e bırakılmaz — :11 (buildDateList) dalının (e) koşulu.
// Kök sınıf: "talep fiili" (istemek/görmek/göstermek) — 7 dil. Kelime-başı sınırı
// (?<![\p{L}\p{N}]) ile; gövde (stem) eşleşmesi çekim eklerini kapsar.
const _B = "(?<![\\p{L}\\p{N}])";
export const TOUR_REQUEST_RE = new RegExp(
  _B + "(?:" + [
    // tr
    "isti?yor", "isterim", "istiyoruz", "görmek", "göster", "bakmak", "bakabilir", "ilgileniyor",
    // en
    "want", "would like", "i'?d like", "show", "see(?!\\p{L})", "look at", "interested",
    // de
    "möchte", "zeig", "sehen", "interessiere",
    // fr
    "veux", "voudrais", "voir", "montre", "intéresse",
    // es
    "quiero", "quisiera", "ver(?!\\p{L})", "muestr", "interesa",
    // ru
    "хочу", "хотел", "покаж", "посмотр", "интересу",
    // ar
    "أريد", "اريد", "أود", "أرى", "اعرض", "أرني", "مهتم",
  ].join("|") + ")",
  "iu",
);

/**
 * Talep cümlesi aslında tur hakkında BİLGİ isteği mi? ("Kapadokya turu hakkında bilgi
 * almak istiyorum", "tur programını görmek istiyorum") → (e) koşulu tetiklenmez, LLM
 * tur bilgisini anlatır. 7 dil.
 */
export const TOUR_INFO_REQUEST_RE = new RegExp(
  _B + "(?:" + [
    "bilgi", "hakkında", "detay", "program", "anlat",
    "info", "about", "detail", "tell me",
    "über", "einzelheit",
    "détail", "renseignement",
    "información", "detalle", "sobre",
    "информац", "подробн", "расскаж", "программ",
    "معلومات", "تفاصيل", "أخبرني", "برنامج",
  ].join("|") + ")",
  "iu",
);
