// A4 (PAKET-0 Dilim-1, 2026-10-07): "ilk tarih / temsilî fiyat" TEK KAYNAK.
//
// Kök: tour_dates PostgREST embed'i SIRASIZ geliyordu (tour-cache `select("*, dates:
// tour_dates(*)")`, ORDER BY yok) ve handler'da 11 yer + prompt helper'ında 4 yer
// `dates[0]`'ı "ilk/temsilî tarih" sanıyordu → ekleme sırasına göre rastgele fiyat.
// X8 (CİLA-4-C) bunu yalnız kendi içinde MIN/MAX ile kapatmıştı.
//
// Sözleşme:
//   sortTourDates(tours)      → tour-cache çıkışında TEK yerde departure_date ASC (in-place değil)
//   representativeDate(tour)  → kronolojik ilk, kontenjanı olan ve fiyatı dolu tarih;
//                               yoksa kronolojik ilk; yoksa undefined

export interface TourDateLike {
  id?: string;
  departure_date?: string;
  price_adult?: number | null;
  price_child?: number | null;
  price_single?: number | null;
  remaining_quota?: number | null;
  quota?: number | null;
}

function _byDeparture(a: TourDateLike, b: TourDateLike): number {
  return String(a?.departure_date || "").localeCompare(String(b?.departure_date || ""));
}

/** Her turun dates[]'ini departure_date'e göre ASC sıralı yeni dizi olarak döner. */
export function sortTourDates<T extends { dates?: TourDateLike[] | null }>(tours: T[]): T[] {
  return tours.map((t) => ({ ...t, dates: [...(t.dates || [])].sort(_byDeparture) }));
}

/** Kronolojik ilk, kontenjanlı ve fiyatlı tarih; yoksa kronolojik ilk; yoksa undefined. */
export function representativeDate<D extends TourDateLike>(tour: { dates?: D[] | null } | null | undefined): D | undefined {
  const dates = [...(tour?.dates || [])].sort(_byDeparture);
  if (dates.length === 0) return undefined;
  const hasQuota = (d: D) => (d.remaining_quota ?? d.quota ?? 1) > 0;
  return dates.find((d) => hasQuota(d) && typeof d.price_adult === "number" && d.price_adult > 0)
    ?? dates.find((d) => typeof d.price_adult === "number" && d.price_adult > 0)
    ?? dates[0];
}
