// B-C1 (2026-07-27): SALT "özet göster" isteği — 7-dil TEK-KAYNAK.
// KÖK: red-sonrası "özet" deterministik yakalanmıyordu → LLM history'den SİLİNMİŞ
// tarihi söylüyordu (denetim bulgusu B-1, 2 bağımsız repro). Bu regex yalnız
// AÇIK özet-isteğini yakalar; process-message bypass'ı özeti STATE'ten render eder
// (LLM'e hiç gitmez → history-kopyası imkânsız).
// \p{L}\p{N} lookaround (ASCII \b YASAK — Yan #8).
export const SUMMARY_REQUEST_RE =
  /(?<![\p{L}\p{N}])(özet\p{L}*|ozet\p{L}*|summar(?:y|ize)|zusammenfassung|übersicht|uebersicht|résumé|resume[rz]?|récap\p{L}*|recap\p{L}*|resumen|итог(?:и)?|сводк\p{L}*|резюме|ملخص|الملخص|لخص)(?![\p{L}\p{N}])/iu;

// FP-freni: tur-İÇERİĞİ özeti isteği ("tur programı özeti", "summary of the tour")
// rezervasyon-özeti DEĞİL → bypass'lanmaz, LLM cevaplar.
export const SUMMARY_EXCLUDE_RE =
  /(?<![\p{L}\p{N}])(program\p{L}*|itinerar\p{L}*|gezilecek|içerik|icerik|tur[au]?|tour|circuit|excursi\p{L}*|جولة|البرنامج|تتضمن|тур\p{L}*|программ\p{L}*|включ\p{L}*|incluy\p{L}*|inclu[st]\p{L}*|enthalt\p{L}*|beinhalte\p{L}*)(?![\p{L}\p{N}])/iu;

/**
 * Mesaj SALT rezervasyon-özeti isteği mi?
 * Dar-kapı: ≤4 kelime + özet-kelimesi VAR + tur-içerik kelimesi YOK.
 */
export function isSummaryRequest(message: string): boolean {
  if (!message || typeof message !== "string") return false;
  const m = message.trim();
  if (m.split(/\s+/).length > 4) return false;
  if (!SUMMARY_REQUEST_RE.test(m)) return false;
  if (SUMMARY_EXCLUDE_RE.test(m)) return false;
  return true;
}
