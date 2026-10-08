// Dilim-7 (denetim D1): bütçe girdisinin PARA BİRİMİ — TEK KAYNAK.
// Eskiden "Touren unter 500 €" → etiket "unter 500 TRY" ve HAM price_adult karşılaştırması
// (120 EUR'luk tur "500'ün altında", 1000 TRY'lik tur elendi). Artık:
//   1) Girdideki para birimi belirteci çözülür (₺/tl/lira, €/eur/euro, $/usd/dolar,
//      £/gbp, ₽/rub/руб, ﷼/riyal, د.إ/dirham — 7 dil). Yoksa örtük para birimi.
//   2) Her turun fiyatı bütçe para birimine çevrilir (convertSync) — kur yoksa ve
//      para birimleri farklıysa karşılaştırılamaz (null).
//   3) Etiket bütçe para biriminde formatPriceSync ile basılır (process-message B1).
import { userCurrencyFor } from "../utils/currency-display.ts";
import { convertSync } from "../utils/exchange-rates.ts";

// Öndeki sınır yalnız HARF (rakam bitişik olabilir: "5000tl", "300usd").
const _B = "(?<!\\p{L})", _A = "(?![\\p{L}\\p{N}])";
const _word = (alts: string) => new RegExp(`${_B}(?:${alts})${_A}`, "iu");

/** Para birimi → belirteç desenleri. Sembol + kelime (7 dil). Sıra önemsiz (en erken konum kazanır). */
const _TOKENS: Array<[string, RegExp[]]> = [
  ["TRY", [/₺/u, _word("tl|lira|liras|лир\\p{L}*|ليرة"), /(?<![\p{L}\p{N}])TRY(?![\p{L}\p{N}])/u]], // "try" (EN fiil) değil, yalnız büyük TRY
  ["EUR", [/€/u, _word("eur|euro|euros|евро|يورو")]],
  ["USD", [/\$/u, _word("usd|dolar|dolár|dollar|dollars|d[óo]lar(?:es)?|доллар\\p{L}*|دولار")]],
  ["GBP", [/£/u, _word("gbp|pound|pounds|sterlin|sterling|фунт\\p{L}*|جنيه")]],
  ["RUB", [/₽/u, _word("rub|ruble|rubles|rouble|roubles|руб\\p{L}*")]],
  ["SAR", [/﷼/u, _word("riyal|riyals|ريال"), /(?<![\p{L}\p{N}])SAR(?![\p{L}\p{N}])/u]],
  ["AED", [/د\.إ/u, _word("aed|dirham|dirhams|درهم")]],
];

/** Mesajda AÇIK para birimi belirteci varsa kodunu (en erken konum), yoksa null. */
export function explicitBudgetCurrency(message: string): string | null {
  let best: { cur: string; at: number } | null = null;
  for (const [cur, res] of _TOKENS) {
    for (const re of res) {
      const m = re.exec(message);
      if (m && (best === null || m.index < best.at)) best = { cur, at: m.index };
    }
  }
  return best?.cur ?? null;
}

/** İki para birimi arasında güvenilir dönüşüm mümkün mü (convertSync eksik kurda 1 varsayar). */
export function canConvert(from: string, to: string, rates: Record<string, number> | null | undefined): boolean {
  if (from === to) return true;
  return !!rates && Number.isFinite(rates[from]) && rates[from] > 0 && Number.isFinite(rates[to]) && rates[to] > 0;
}

/**
 * Bütçe para birimi.
 *  - Açık belirteç → o.
 *  - Örtük (KARAR GEREKLİ, Dilim-7 raporu §1): müşterinin fiyatları GÖRDÜĞÜ para birimi.
 *    Çift gösterim açık VE kur varsa formatPriceSync müşteriye kendi para birimini
 *    gösterir → userCurrencyFor(lang) (LANG_TO_CURRENCY / acente override). Aksi hâlde
 *    müşteri yalnız acente para birimini görür → primaryCurrency.
 */
export function resolveBudgetCurrency(
  message: string, lang: string,
  opts: { rates: Record<string, number> | null; showDual: boolean; primaryCurrency: string; languageCurrencies?: Record<string, string> | null },
): { currency: string; explicit: boolean } {
  const ex = explicitBudgetCurrency(message);
  if (ex) return { currency: ex, explicit: true };
  const ratesOk = !!opts.rates && Object.keys(opts.rates).length > 0;
  const shown = opts.showDual && ratesOk ? userCurrencyFor(lang, opts.languageCurrencies) : opts.primaryCurrency;
  return { currency: shown || "TRY", explicit: false };
}

/** Tur fiyatı bütçe para biriminde; dönüştürülemiyorsa null (karşılaştırılamaz). */
export function priceInCurrency(price: number, from: string, to: string, rates: Record<string, number> | null | undefined): number | null {
  if (!canConvert(from, to, rates)) return null;
  return from === to ? price : convertSync(price, from, to, rates as Record<string, number>);
}
