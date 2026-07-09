// Kontenjan etiketi — TEK KAYNAK (2026-07-09 FAZ4-P3, kalem 1).
// "N kişilik yer / spots / Plätze..." + "DOLU / FULL..." 7-dil. Üç tüketici
// (process-message :11 liste, :10e müsaitlik-cevabı, quota-full liste) kopya
// tutuyordu; :10e TR+EN kalmıştı → 7-dile taşındı + DRY birleştirildi.
export function quotaLabel(remaining: number, isFull: boolean, language: string): string {
  if (isFull) {
    const full: Record<string, string> = {
      tr: " (DOLU)", en: " (FULL)", de: " (VOLL)", ru: " (ПОЛНО)",
      ar: " (ممتلئ)", fr: " (COMPLET)", es: " (COMPLETO)",
    };
    return full[language] || full.en;
  }
  const avail: Record<string, string> = {
    tr: ` (${remaining} kişilik yer)`, en: ` (${remaining} spots)`,
    de: ` (${remaining} Plätze)`, ru: ` (${remaining} мест)`,
    ar: ` (${remaining} مقاعد)`, fr: ` (${remaining} places)`,
    es: ` (${remaining} plazas)`,
  };
  return avail[language] || avail.en;
}
