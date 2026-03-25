// Tour Loading Service

import { CONFIG } from "../config/constants.ts";
import { logger } from "../utils/logger.ts";
import { pickLocalized } from "../../shared/fsm/localization.ts";
import type { Tour } from "../types/index.ts";

/**
 * Load tours from database for demo agency
 */
export async function loadToursFromDatabase(supabase: any): Promise<Tour[]> {
  const { data: dbTours, error } = await supabase
    .from("tours")
    .select(`
      *,
      dates:tour_dates(*)
    `)
    .eq("agency_id", CONFIG.DEMO_AGENCY_ID)
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("Error loading tours", error);
    throw new Error("Failed to load tours");
  }

  return dbTours || [];
}

/**
 * Enrich tour dates with sold pax from registrations
 */
export async function enrichToursWithSoldPax(supabase: any, tours: any[]): Promise<any[]> {
  const allDateIds = tours.flatMap(t => (t.dates || []).map((d: any) => d.id));
  if (allDateIds.length === 0) return tours;

  const { data: regData } = await supabase
    .from('registrations')
    .select('tour_date_id, pax')
    .in('tour_date_id', allDateIds)
    .neq('status', 'CANCELLED');

  const soldMap: Record<string, number> = {};
  if (regData) {
    for (const reg of regData) {
      soldMap[reg.tour_date_id] = (soldMap[reg.tour_date_id] || 0) + reg.pax;
    }
  }

  return tours.map(tour => ({
    ...tour,
    dates: (tour.dates || []).map((d: any) => ({
      ...d,
      sold_pax: soldMap[d.id] || 0,
      remaining_quota: d.quota - (soldMap[d.id] || 0)
    }))
  }));
}

/**
 * Create localized tour object from raw tour data
 */
export function createLocalizedTour(tour: any, lang: string): Tour {
  return {
    id: tour.id,
    title: pickLocalized(tour, "title", lang),
    destination: pickLocalized(tour, "destination", lang),
    type: tour.type,
    currency: tour.currency,
    program_kisa: pickLocalized(tour, "program_kisa", lang),
    gezilecek_yerler: tour.gezilecek_yerler,
    toplanma_saati: tour.toplanma_saati,
    hareket_noktasi: tour.hareket_noktasi,
    tur_sure: tour.tur_sure,
    ulasim: tour.ulasim,
    konaklama: tour.konaklama,
    dates: tour.dates || [],
    _raw: tour,
  };
}

/**
 * Filter out past dates and dates with no remaining quota
 */
export function filterFutureTours(tours: any[]): any[] {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  return tours
    .map((tour) => ({
      ...tour,
      dates: (tour.dates || []).filter((d: any) => {
        const isFuture = d.departure_date >= today;
        const hasQuota = (d.remaining_quota !== undefined) ? d.remaining_quota > 0 : d.quota > 0;
        return isFuture && hasQuota;
      }),
    }))
    .filter((tour) => tour.dates.length > 0);
}

/**
 * Get localized tours for a specific language (only future-dated tours with available quota)
 */
export function getLocalizedTours(rawTours: any[], language: string): Tour[] {
  const futureTours = filterFutureTours(rawTours);
  return futureTours.map((tour) => createLocalizedTour(tour, language));
}
