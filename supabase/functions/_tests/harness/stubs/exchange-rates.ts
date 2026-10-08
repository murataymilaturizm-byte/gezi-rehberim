// HARNESS STUB — import-map ile `shared/utils/exchange-rates.ts` yerine yüklenir (Dilim-7).
// Gerçek modül ağdan (SUPABASE_URL/get-exchange-rates) kur çeker; harness'te ağ yok →
// gerçek davranış "fetch başarısız → {}" idi. Varsayılan AYNI ({}); kanıt testleri
// setRates(...) ile USD-bazlı kur enjekte eder. convertSync vb. GERÇEK modülden.
import * as real from "../../../shared/utils/exchange-rates.ts?real";

export const convertSync = real.convertSync;
export const getExchangeRatesAge = real.getExchangeRatesAge;
export const isExchangeRatesStale = real.isExchangeRatesStale;

let _rates: Record<string, number> = {};
export function setRates(r: Record<string, number>): void { _rates = r; }
export async function getExchangeRatesOnce(): Promise<Record<string, number>> { return _rates; }
