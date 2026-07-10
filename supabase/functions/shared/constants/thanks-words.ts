// Teşekkür/veda sinyali — TEK KAYNAK (2026-07-10, 7-dil paralellik şartı).
//
// Tüketici: process-message A3 — COMPLETED kapanış-ack'i yalnız bu sinyalde
// basılır (sinyalsiz chitchat LLM after-sales'e düşer). Gelecek tüketiciler
// (ör. kapanış-tespiti, memnuniyet-sinyali) AYNI kaynaktan beslenmeli.
//
// Pattern disiplini: \p{L}\p{N} lookaround + /iu (Yan #8 — "teşekkürler"
// çekimleri \p{L}* ile).
export const THANKS_FAREWELL_RE =
  /(?<![\p{L}\p{N}])(te[şs]ekkür\p{L}*|sa[ğg]\s?ol\p{L}*|eyvallah|görü[şs]ürüz|iyi\s+günler|ho[şs][çc]a\s?kal\p{L}*|thanks|thank\s+you|thx|bye|goodbye|see\s+you|danke|tsch[üu]ss|merci|au\s+revoir|gracias|adi[óo]s|hasta\s+luego|спасибо|благодарю|до\s+свидания|пока|شكرا\p{L}*|مع\s+السلامة|وداعا)(?![\p{L}\p{N}])/iu;
