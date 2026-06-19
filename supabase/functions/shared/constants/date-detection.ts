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
export const DATE_INTENTS = ["faq_general", "tour_search", "general", "general_question"];
