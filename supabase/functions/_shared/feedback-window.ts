// A2/F-2+F-3 (2026-07-27): Anket seçim-penceresi — TEK-KAYNAK saf mantık.
//
// F-2 (Y-2): "tur bitimi" = coalesce(return_date, departure_date) — çok-günlük turda
//   anket turun ORTASINDA gitmez (eski kod yalnız departure_date'e bakıyordu).
// F-3 (A2-EK kökü): tek-günlük pencere KALDIRILDI → kaçan gün telafi edilebilir.
//   Eski: bitiş == (now−offset).gün (tek gün) → cooldown/kaçırma sonrası anket SONSUZA
//   DEK kaçıyordu (kanıt: 10 Tem kurulum-testi damgası → 12-13 Tem cooldown-skip →
//   pencere geçti, telafi yok). Yeni: bitiş ∈ [now−LOOKBACK, now−offset] aralığı +
//   registrations.feedback_sent_at IS NULL (kayıt-bazlı çift-gönderim kilidi).
// ALT-SINIR (Murat şartı): LOOKBACK=14 gün — deploy anında tarihi çok geçmiş eski/seed
//   kayıtlara toplu anket patlamasın. (agency_id=null seed'ler zaten tours!inner
//   .agency_id eşleme-filtresiyle elenir — ikinci emniyet.)
// Profil 7-gün cooldown SPAM-FRENİ olarak fonksiyonda KALIR (burada değil).
// REMINDER'A DOKUNULMAZ (−24h departure_date mantığı kalkış-öncesi için doğru).

export const FEEDBACK_LOOKBACK_DAYS = 14;

/** Gün-granül UTC pencere sınırları: bitiş-tarihi ∈ [floor, ceil) — ISO "YYYY-MM-DD". */
export function feedbackWindowBounds(
  nowMs: number,
  offsetHours: number,
  lookbackDays: number = FEEDBACK_LOOKBACK_DAYS,
): { floor: string; ceil: string } {
  const hoursAfter = Math.max(0, offsetHours);
  // ceil: bitiş ≤ (now − offset) günü  ⇔  bitiş < o günün ertesi (gün-granül).
  const ceilMs = nowMs - hoursAfter * 3600 * 1000 + 24 * 3600 * 1000;
  const floorMs = nowMs - lookbackDays * 24 * 3600 * 1000;
  return {
    floor: new Date(floorMs).toISOString().split("T")[0],
    ceil: new Date(ceilMs).toISOString().split("T")[0],
  };
}

/** PostgREST or-filtresi: coalesce(return_date, departure_date) ∈ [floor, ceil). */
export function buildFeedbackWindowOrFilter(floor: string, ceil: string): string {
  return `and(return_date.gte.${floor},return_date.lt.${ceil}),and(return_date.is.null,departure_date.gte.${floor},departure_date.lt.${ceil})`;
}

/** Aynı semantiğin saf-JS eşleniği — birim-test senaryoları için (tek-kaynak mantık). */
export function isTourDateInWindow(
  td: { departure_date: string; return_date?: string | null },
  floor: string,
  ceil: string,
): boolean {
  const basis = td.return_date ?? td.departure_date; // coalesce
  return basis >= floor && basis < ceil;             // ISO-string sırası = tarih sırası
}
