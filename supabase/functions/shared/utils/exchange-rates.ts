/**
 * Edge function içi döviz kuru yardımcısı.
 * Mevcut get-exchange-rates edge function'ını çağırır,
 * instance başına 24 saatlik in-memory cache tutar.
 */

let _cache: { rates: Record<string, number>; fetchedAt: number } | null = null;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 saat

/**
 * Döviz kurlarını döndürür. Cache geçerliyse tekrar fetch yapmaz.
 * Her edge function instance için bağımsız cache.
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
    console.warn("[exchange-rates] Fetch failed, using empty rates:", err);
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
