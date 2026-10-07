// ═══════════════════════════════════════════════════════════════════════════
// A1+A2+A3 (PAKET-0 Dilim-1, 2026-10-07): TARİH LİSTESİ TEK PRİMİTİF.
//
// Kök (denetim TURZZ-FABLE-DENETIM.md §8 Grup A): handler'da 7 yer kendi tarih
// listesini basıyordu — 3 farklı indeks semantiğiyle (global / filtrelenmiş-yerel /
// slice'lı-yerel). Seçim tarafı (info-extractor Blok 8) ise yalnız GLOBAL
// `tour.dates[n-1]` biliyordu → QUOTA_EXCEEDED/H-pax listesinden "2" yazan
// müşteriye YANLIŞ tarih seçiliyordu (harness S6: 25.12 istedi, 20.12 seçildi).
//
// Sözleşme:
//   - Liste HER ZAMAN buradan basılır (handler'da elle `${i+1}) …departure_date`
//     şablonu YASAK — suite'te statik muhafız var).
//   - Basılan sıra `ctx.listedDateIds`'e yazılır; Blok 8 numarayı ÖNCE buradan
//     çözer, liste yoksa kronolojik global sıraya (tour-cache sortTourDates) düşer.
//   - Tarih `formatDateForLanguage` + gün adı, fiyat `formatPriceSync` (tur para
//     birimi + dil para birimi dual), kontenjan `quotaLabel` — 7 dil tek yol.
// ═══════════════════════════════════════════════════════════════════════════
import type { ConversationContext } from "../fsm/types.ts";
import { formatDateForLanguage, getWeekdayName } from "../fsm/localization.ts";
import { formatPriceSync } from "../utils/currency-display.ts";
import { getQuotaRemaining } from "./quota-check.ts";
import { quotaLabel } from "../constants/quota-labels.ts";

/**
 * "Son kapı" temizliği — tarih-seçim bağlamı bir TUR/REZERVASYON'a aittir; tur
 * değişince, iptalde ve yeni-rezervasyon reset'inde spread edilir:
 *   tour-change.ts produceTourChangeContext · state-machine.ts iptal ×3 + resetForNewReservation.
 * (stale-reset createInitialContext ile zaten temiz; dateId yazılınca handler
 * listedDateIds'i, PENDING-PAX UYGULA pendingPax'ı temizler.)
 */
export const DATE_SELECTION_CLEAR = { listedDateIds: undefined, pendingPax: undefined } as const;

export interface DateListPriceCtx {
  ex: Record<string, number>;
  showDual: boolean;
  languageCurrencies: any;
}

export interface DateListOptions {
  lang: string;
  /** Verilirse her satıra " - <fiyat>" eklenir (formatPriceSync). */
  price?: DateListPriceCtx | null;
  /** quotaLabel eki (kalan/dolu). */
  quota?: boolean;
  /** Gün adı parantezi — varsayılan açık. */
  weekday?: boolean;
  /** Satır sayısı üst sınırı. */
  max?: number;
}

/**
 * Satırları basar VE `ctx.listedDateIds`'i (basılan sırayla) yazar.
 * Boş liste → "" döner ve listedDateIds temizlenir.
 */
export function buildDateList(
  tour: { currency?: string | null } | null | undefined,
  dates: any[],
  ctx: Pick<ConversationContext, "listedDateIds"> & Record<string, any>,
  opts: DateListOptions,
): string {
  const shown = typeof opts.max === "number" ? dates.slice(0, opts.max) : dates;
  ctx.listedDateIds = shown.length ? shown.map((d) => String(d.id)) : undefined;
  if (!shown.length) return "";
  const weekday = opts.weekday !== false;
  const cur = tour?.currency || "TRY";
  return shown
    .map((d, i) => {
      const wd = weekday ? getWeekdayName(d.departure_date, opts.lang) : "";
      const dateText = formatDateForLanguage(d.departure_date, opts.lang) + (wd ? ` (${wd})` : "");
      const priceText = opts.price && d.price_adult
        ? ` - ${formatPriceSync(d.price_adult, cur, opts.lang, opts.price.ex, opts.price.showDual, opts.price.languageCurrencies)}`
        : "";
      const remaining = getQuotaRemaining(d);
      const quotaText = opts.quota ? quotaLabel(remaining, remaining <= 0, opts.lang) : "";
      return `${i + 1}) ${dateText}${priceText}${quotaText}`;
    })
    .join("\n");
}

/**
 * Numara seçimini basılan listeye göre çözer. Liste yoksa kronolojik global
 * sıraya düşer (tour-cache sortTourDates garantisi). Liste varsa ve numara
 * liste dışıysa undefined — global'e DÜŞMEZ (A1'in kökü tam buydu).
 */
export function resolveListedDate<D extends { id: string }>(
  n: number,
  dates: D[],
  listedDateIds: string[] | undefined,
): D | undefined {
  if (!Number.isInteger(n) || n < 1) return undefined;
  if (listedDateIds?.length) {
    const id = listedDateIds[n - 1];
    return id ? dates.find((d) => String(d.id) === id) : undefined;
  }
  return n <= dates.length ? dates[n - 1] : undefined;
}
