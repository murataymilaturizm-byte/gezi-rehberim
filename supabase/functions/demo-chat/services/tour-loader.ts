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
 * Filter out past dates from tours and remove tours with no future dates
 */
export function filterFutureTours(tours: any[]): any[] {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  return tours
    .map((tour) => ({
      ...tour,
      dates: (tour.dates || []).filter((d: any) => d.departure_date >= today),
    }))
    .filter((tour) => tour.dates.length > 0);
}

/**
 * Get localized tours for a specific language (only future-dated tours)
 */
export function getLocalizedTours(rawTours: any[], language: string): Tour[] {
  const futureTours = filterFutureTours(rawTours);
  return futureTours.map((tour) => createLocalizedTour(tour, language));
}
