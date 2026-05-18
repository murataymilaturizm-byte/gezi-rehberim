// Tour memory cache — 10 dakika TTL
// remaining_quota HER ZAMAN canlı DB'den yenilenir (cache'lenmez)

interface CachedEntry {
  tours: any[];
  fetchedAt: number;
}

const _cache = new Map<string, CachedEntry>();
const TTL_MS = 10 * 60 * 1000; // 10 dakika

/**
 * Tur listesini cache'den veya DB'den getirir.
 * Tour yapısı (başlık, tarihler, fiyatlar) cache'lenir.
 * remaining_quota her çağrıda registrations tablosundan taze hesaplanır.
 */
export async function getCachedTours(
  supabase: any,
  agencyId: string,
  forceFresh = false,
): Promise<any[]> {
  const entry = _cache.get(agencyId);
  const isValid = entry && Date.now() - entry.fetchedAt < TTL_MS;

  let rawTours: any[];

  if (!forceFresh && isValid) {
    console.log(`[tour-cache] HIT agency=${agencyId.slice(0, 8)} age=${Math.round((Date.now() - entry!.fetchedAt) / 1000)}s`);
    rawTours = entry!.tours;
  } else {
    console.log(`[tour-cache] MISS agency=${agencyId.slice(0, 8)}`);
    const { data, error } = await supabase
      .from("tours")
      .select(`*, dates:tour_dates(*)`)
      .eq("agency_id", agencyId);

    if (error) {
      console.error("[tour-cache] DB fetch error:", error.message);
      // stale-while-error: son cache varsa kullan, aksi halde boş dizi
      if (entry) {
        console.log("[tour-cache] Serving stale cache due to DB error");
        rawTours = entry.tours;
      } else {
        return [];
      }
    } else {
      rawTours = data || [];
      _cache.set(agencyId, { tours: rawTours, fetchedAt: Date.now() });
    }
  }

  return _refreshQuota(supabase, rawTours);
}

/**
 * Tour dates'in sold_pax ve remaining_quota'sını DB'den taze hesaplar.
 * Race condition koruması bozulmaz — sadece görüntü için kullanılır.
 * Gerçek rezervasyon, atomik create_reservation_with_quota_check RPC'si ile yapılır.
 */
async function _refreshQuota(supabase: any, tours: any[]): Promise<any[]> {
  if (tours.length === 0) return tours;

  const allDateIds = tours.flatMap((t: any) => (t.dates || []).map((d: any) => d.id));
  if (allDateIds.length === 0) return tours;

  const { data: regData } = await supabase
    .from("registrations")
    .select("tour_date_id, pax")
    .in("tour_date_id", allDateIds)
    .neq("status", "CANCELLED");

  const soldMap: Record<string, number> = {};
  for (const r of regData || []) {
    soldMap[r.tour_date_id] = (soldMap[r.tour_date_id] || 0) + r.pax;
  }

  return tours.map((tour: any) => ({
    ...tour,
    dates: (tour.dates || []).map((d: any) => ({
      ...d,
      sold_pax: soldMap[d.id] || 0,
      remaining_quota: d.quota - (soldMap[d.id] || 0),
    })),
  }));
}

/**
 * Admin tur ekler / günceller / silerse cache'i temizle.
 * invalidate-tour-cache edge function'ı çağırır.
 */
export function invalidateTourCache(agencyId: string): void {
  _cache.delete(agencyId);
  console.log(`[tour-cache] Invalidated agency=${agencyId.slice(0, 8)}`);
}

/** Tüm cache'i temizle (debug/test için) */
export function clearAllTourCache(): void {
  _cache.clear();
  console.log("[tour-cache] All entries cleared");
}

/** Cache durumu (monitoring) */
export function getTourCacheStats() {
  return {
    size: _cache.size,
    entries: Array.from(_cache.entries()).map(([id, v]) => ({
      agencyId: id.slice(0, 8),
      ageSeconds: Math.round((Date.now() - v.fetchedAt) / 1000),
      tourCount: v.tours.length,
    })),
  };
}
