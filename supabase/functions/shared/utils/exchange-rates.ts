/**
 * Edge function içi döviz kuru yardımcısı.
 * Mevcut get-exchange-rates edge function'ını çağırır,
 * instance başına 24 saatlik in-memory cache tutar.
 */

let _cache: { rates: Record<string, number>; fetchedAt: number } | null = null;
const CACHE_TTL = 24 * 60 * 60 * 1000;        // 24 saat
const STALE_THRESHOLD = 6 * 60 * 60 * 1000;   // 6 saat — bunu aştıysa "stale" sayılır

/**
 * O2: Kurun "ne kadar bayat" olduğunu döner (ms). Cache yoksa null.
 * Caller "kur eskidir" rozeti göstermek için kullanabilir.
 */
export function getExchangeRatesAge(): number | null {
  if (!_cache) return null;
  return Date.now() - _cache.fetchedAt;
}

/**
 * O2: Kurun stale (≥6 saat) sayılıp sayılmadığını döner.
 */
export function isExchangeRatesStale(): boolean {
  const age = getExchangeRatesAge();
  return age !== null && age >= STALE_THRESHOLD;
}

/**
 * Döviz kurlarını döndürür. Cache geçerliyse tekrar fetch yapmaz.
 * Her edge function instance için bağımsız cache.
 *
 * O2: Fetch başarısız olduğunda ve cached rates varsa → eski kurla devam (silent fallback eski davranış).
 * Hiç cache yoksa → boş {} (caller fiyatı tek para biriminde gösterir).
 * Her başarısızlıkta `console.error` ile gözlemlenebilir log atılır (alert mekanizmasının habercisi).
 */
export async function getExchangeRatesOnce(): Promise<Record<string, number>> {
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL) {
    return _cache.rates;
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const response = await fetch(`${supabaseUrl}/functions/v1/get-exchange-rates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ base: "USD" }),
    });

    if (!response.ok) throw new Error(`Exchange rate HTTP ${response.status}`);

    const data = await response.json();
    if (!data.success || !data.rates) throw new Error("Invalid exchange rate response");

    _cache = { rates: data.rates, fetchedAt: Date.now() };
    return data.rates;
  } catch (err) {
    // O2: Sessiz fallback yerine GÖZLEMLENEBİLİR uyarı.
    // console.error → log retention / alarm kurulumu kolaylaşır.
    if (_cache) {
      const _ageMin = Math.round((Date.now() - _cache.fetchedAt) / 60000);
      console.error(
        `[exchange-rates] FETCH FAILED — falling back to STALE cache (age=${_ageMin}min)`,
        err instanceof Error ? err.message : String(err),
      );
      return _cache.rates;
    }
    console.error(
      "[exchange-rates] FETCH FAILED — no cache available, returning empty rates",
      err instanceof Error ? err.message : String(err),
    );
    return {};
  }
}

/**
 * Tek bir kur dönüşümü. rates = getExchangeRatesOnce() sonucu.
 * Tüm kurlar USD bazlıdır.
 */
export function convertSync(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number {
  if (from === to || !rates) return amount;
  const fromRate = rates[from] ?? 1;
  const toRate = rates[to] ?? 1;
  return (amount / fromRate) * toRate;
}
