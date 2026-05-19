// Tour metadata cache — AŞAMA 2: Event-driven invalidation (Realtime)
//
// MİMARİ (2 Tier):
// - Tier 1 (cache): tour başlık, tarih listesi, fiyatlar — 5 dk TTL
//   (Realtime aktifken event-driven invalidate; TTL sadece fallback)
// - Tier 2 (no-cache): remaining_quota — _refreshQuota ile HER SORGU canlı DB
//
// REALTIME:
// - tours / tour_dates tablolarında INSERT/UPDATE/DELETE → anında cache invalidate
// - Cold start'ta yeniden subscribe, exponential backoff reconnect
// - Realtime down → TTL fallback (5 dk)
//
// TODO (AŞAMA 3): Redis distributed cache — 50+ acente / yüksek trafik için.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CachedEntry {
  tours: any[];
  fetchedAt: number;
}

type InvalidationSource = "realtime" | "manual" | "forced";
type RealtimeStatus = "connecting" | "connected" | "disconnected" | "unknown";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Fresh window — Realtime sağlam çalışıyorsa bu süre uzadı (2dk → 5dk). */
const FRESH_TTL_MS = 5 * 60 * 1000;   // 5 dakika

/** Hard fail sınırı — Realtime down + stale çok eski → TOUR_DATA_UNAVAILABLE. */
const STALE_TTL_MS = 10 * 60 * 1000;  // 10 dakika

/** Reconnect için maksimum deneme sayısı. */
const MAX_RECONNECT_ATTEMPTS = 5;

// ─── State ────────────────────────────────────────────────────────────────────

const _cache = new Map<string, CachedEntry>();

const _stats = {
  hits: 0,
  misses: 0,
  stales: 0,
  errors: 0,
  realtimeInvalidations: 0,
  manualInvalidations: 0,
};

let _realtimeStatus: RealtimeStatus = "unknown";
let _realtimeSubscribed = false;
let _realtimeClient: ReturnType<typeof createClient> | null = null;
let _reconnectAttempts = 0;

// ─── Core Cache ──────────────────────────────────────────────────────────────

/**
 * Tur listesini cache'den veya DB'den getirir.
 * Tour yapısı 5 dk cache'lenir; remaining_quota her sorguda canlı çekilir.
 */
export async function getCachedTours(
  supabase: any,
  agencyId: string,
  forceFresh = false,
): Promise<any[]> {
  const entry = _cache.get(agencyId);
  const now = Date.now();
  const age = entry ? now - entry.fetchedAt : Infinity;
  const isFresh = !forceFresh && entry && age < FRESH_TTL_MS;

  let rawTours: any[];

  if (isFresh) {
    _stats.hits++;
    console.log(`[tour-cache] HIT agency=${agencyId.slice(0, 8)} age=${Math.round(age / 1000)}s`);
    rawTours = entry!.tours;
  } else {
    console.log(`[tour-cache] MISS agency=${agencyId.slice(0, 8)}`);
    const { data, error } = await supabase
      .from("tours")
      .select(`*, dates:tour_dates(*)`)
      .eq("agency_id", agencyId);

    if (error) {
      console.error("[tour-cache] DB fetch error:", error.message);

      if (entry && age < STALE_TTL_MS) {
        _stats.stales++;
        console.warn(`[tour-cache] Serving stale data age=${Math.round(age / 1000)}s (max ${STALE_TTL_MS / 1000}s)`);
        rawTours = entry.tours;
      } else {
        _stats.errors++;
        const reason = entry ? "stale too old" : "no cache";
        console.error(`[tour-cache] Hard fail — ${reason}. Refusing to serve.`);
        throw new Error("TOUR_DATA_UNAVAILABLE");
      }
    } else {
      _stats.misses++;
      rawTours = data || [];
      _cache.set(agencyId, { tours: rawTours, fetchedAt: now });
    }
  }

  return _refreshQuota(supabase, rawTours);
}

/**
 * remaining_quota her sorguda registrations tablosundan taze hesaplanır.
 * CACHE KULLANMAZ.
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

// ─── Invalidation ─────────────────────────────────────────────────────────────

/**
 * Agency'nin cache'ini temizler.
 * source: "realtime" = Realtime event tetikledi; "manual" = HTTP çağrısı.
 */
export function invalidateTourCache(
  agencyId: string,
  source: InvalidationSource = "manual",
): void {
  _cache.delete(agencyId);
  if (source === "realtime") {
    _stats.realtimeInvalidations++;
  } else {
    _stats.manualInvalidations++;
  }
  console.log(`[tour-cache] Invalidated agency=${agencyId.slice(0, 8)} source=${source}`);
}

/** Tüm cache'i temizle (debug/test için) */
export function clearAllTourCache(): void {
  _cache.clear();
  console.log("[tour-cache] All entries cleared");
}

// ─── Realtime Listener ────────────────────────────────────────────────────────

/** tour_dates değişikliğinde tour_id → agency_id resolve (agency_id kolonu yoksa fallback) */
async function _resolveAndInvalidate(tourId: string): Promise<void> {
  if (!_realtimeClient) return;
  try {
    const { data } = await _realtimeClient
      .from("tours")
      .select("agency_id")
      .eq("id", tourId)
      .single();
    if (data?.agency_id) {
      invalidateTourCache(data.agency_id, "realtime");
    }
  } catch (err) {
    console.error("[tour-cache] Failed to resolve tour_id for invalidation:", err);
  }
}

/** Mevcut channel referansı (unsubscribe + reconnect için) */
let _realtimeChannel: any = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Channel hata / timeout / kapanma sonrası exponential backoff reconnect.
 * NOT: onClose/onOpen API yok (Supabase JS v2) — subscribe callback'teki
 * status string'i kullanılır: SUBSCRIBED | CHANNEL_ERROR | TIMED_OUT | CLOSED
 */
function _scheduleReconnect(): void {
  if (_reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error("[tour-cache] Max reconnect attempts reached — TTL-only mode active");
    _realtimeStatus = "disconnected";
    return;
  }

  _reconnectAttempts++;
  const backoffMs = Math.min(1000 * Math.pow(2, _reconnectAttempts), 30_000);
  console.warn(
    `[tour-cache] Reconnect attempt ${_reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${backoffMs}ms`,
  );

  if (_reconnectTimer) clearTimeout(_reconnectTimer);
  _reconnectTimer = setTimeout(() => {
    _reconnectTimer = null;
    try {
      _realtimeChannel?.unsubscribe();
    } catch (_) { /* ignore */ }
    _realtimeChannel = null;
    _realtimeSubscribed = false;
    initRealtimeListener();
  }, backoffMs);
}

/** Realtime PostgreSQL changes listener — module init'te otomatik çalışır. */
export function initRealtimeListener(): void {
  if (_realtimeSubscribed) return;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    console.warn("[tour-cache] Missing env vars — Realtime listener disabled");
    return;
  }

  _realtimeStatus = "connecting";
  _realtimeClient = createClient(supabaseUrl, serviceKey, {
    realtime: { params: { eventsPerSecond: 10 } },
  });

  _realtimeChannel = _realtimeClient
    .channel("tour-cache-invalidation")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tours" },
      (payload: any) => {
        const agencyId = payload.new?.agency_id || payload.old?.agency_id;
        if (agencyId) {
          console.log(
            `[tour-cache] Realtime: tours ${payload.eventType} → agency=${agencyId.slice(0, 8)}`,
          );
          invalidateTourCache(agencyId, "realtime");
        }
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tour_dates" },
      (payload: any) => {
        const row = payload.new || payload.old;
        if (!row) return;

        if (row.agency_id) {
          console.log(
            `[tour-cache] Realtime: tour_dates ${payload.eventType} → agency=${row.agency_id.slice(0, 8)}`,
          );
          invalidateTourCache(row.agency_id, "realtime");
        } else if (row.tour_id) {
          console.log(`[tour-cache] Realtime: tour_dates ${payload.eventType} → resolve tour_id`);
          _resolveAndInvalidate(row.tour_id);
        }
      },
    )
    .subscribe((status: string) => {
      console.log(`[tour-cache] Channel status: ${status}`);
      if (status === "SUBSCRIBED") {
        _realtimeStatus = "connected";
        _realtimeSubscribed = true;
        _reconnectAttempts = 0; // başarılı bağlantı → sayacı sıfırla
        console.log("[tour-cache] Realtime listener active");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        _realtimeStatus = "disconnected";
        _realtimeSubscribed = false;
        console.warn(`[tour-cache] Channel ${status} — scheduling reconnect`);
        _scheduleReconnect();
      }
    });
}

// ─── Stats & Debug ───────────────────────────────────────────────────────────

/** Cache ve Realtime durumu — /invalidate-tour-cache GET veya debug için */
export function getTourCacheStats() {
  const now = Date.now();
  const hitTotal = _stats.hits + _stats.misses;
  return {
    stats: {
      ..._stats,
      hitRate: hitTotal > 0 ? Math.round((_stats.hits / hitTotal) * 100) : 0,
    },
    realtime: {
      status: _realtimeStatus,
      subscribed: _realtimeSubscribed,
      reconnectAttempts: _reconnectAttempts,
    },
    ttl: {
      freshSeconds: FRESH_TTL_MS / 1000,
      staleSeconds: STALE_TTL_MS / 1000,
    },
    entries: Array.from(_cache.entries()).map(([id, v]) => ({
      agencyId: id.slice(0, 8),
      ageSeconds: Math.round((now - v.fetchedAt) / 1000),
      status:
        now - v.fetchedAt < FRESH_TTL_MS ? "fresh"
        : now - v.fetchedAt < STALE_TTL_MS ? "stale"
        : "expired",
      tourCount: v.tours.length,
    })),
  };
}

// ─── Auto-init ────────────────────────────────────────────────────────────────

// Edge function boot anında Realtime listener başlatılır.
// Cold start'larda yeniden kurulur (beklenen davranış).
// _realtimeSubscribed flag sayesinde aynı instance'ta çift subscribe olmaz.
try {
  initRealtimeListener();
} catch (err) {
  console.error("[tour-cache] Realtime init failed (TTL-only mode):", err);
}
