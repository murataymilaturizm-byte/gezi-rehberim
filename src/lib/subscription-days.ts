// P4-1 (2026-07-28): Paket kalan-gün — TEK-KAYNAK, UTC-GÜN-GRANÜL.
// KÖK: SubscriptionBanner differenceInDays(new Date(ts), new Date()) saat/timezone
// hassastı ve yalnız trial-status'ta ≤7g gösteriyordu → active+6g acente HİÇ uyarı
// görmüyordu. Bu util iki tüketiciyi (SubscriptionBanner + UsageStats rozeti)
// aynı hesapla besler. "Bugün son gün" = 0 (negatif = geçmiş).
export function daysLeftUtc(endsAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!endsAt) return null;
  const end = new Date(endsAt);
  if (isNaN(end.getTime())) return null;
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((endUtc - nowUtc) / 86400000);
}

/** Status'a göre hedef-tarih: trial → trial_ends_at, diğerleri → subscription_ends_at. */
export function packageEndDate(info: {
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
}): string | null {
  return info.subscription_status === "trial"
    ? (info.trial_ends_at ?? null)
    : (info.subscription_ends_at ?? null);
}

/** Eşik-sınıfı: >14 nötr · 8-14 amber · 0-7 kırmızı · <0 geçmiş. */
export type ExpiryTier = "ok" | "warn" | "critical" | "past";
export function expiryTier(days: number | null): ExpiryTier | null {
  if (days === null) return null;
  if (days < 0) return "past";
  if (days <= 7) return "critical";
  if (days <= 14) return "warn";
  return "ok";
}
