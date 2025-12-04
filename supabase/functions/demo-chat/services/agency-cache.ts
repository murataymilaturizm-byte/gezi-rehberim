// Agency Data Cache Service

import { CONFIG } from "../config/constants.ts";
import { logger } from "../utils/logger.ts";
import type { AgencyData } from "../types/index.ts";

// In-memory cache
let cachedAgencyData: AgencyData | null = null;
let cacheTime = 0;

/**
 * Get agency data with caching support
 */
export async function getAgencyData(
  supabase: any,
  agencyId: string = CONFIG.DEMO_AGENCY_ID
): Promise<AgencyData | null> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (cachedAgencyData && (now - cacheTime) < CONFIG.AGENCY_DATA_CACHE_TTL) {
    logger.debug("Using cached agency data");
    return cachedAgencyData;
  }
  
  logger.debug("Fetching fresh agency data");
  
  const { data, error } = await supabase
    .from("agencies")
    .select(`
      name, 
      city, 
      payment_instructions, 
      primary_currency, 
      language_currencies, 
      address, 
      phone_public, 
      website_url, 
      working_hours, 
      maps_url, 
      cancellation_policy
    `)
    .eq("id", agencyId)
    .single();
    
  if (error) {
    logger.warn("Agency data error", error.message);
    return null;
  }
  
  // Update cache
  cachedAgencyData = {
    name: data?.name ?? "Demo Travel Agency",
    city: data?.city ?? undefined,
    address: data?.address ?? undefined,
    phone_public: data?.phone_public ?? undefined,
    website_url: data?.website_url ?? undefined,
    working_hours: data?.working_hours ?? undefined,
    maps_url: data?.maps_url ?? undefined,
    cancellation_policy: data?.cancellation_policy ?? undefined,
    payment_instructions: data?.payment_instructions ?? null,
    language_currencies: data?.language_currencies ?? null,
    primary_currency: data?.primary_currency ?? "TRY",
  };
  cacheTime = now;
  
  return cachedAgencyData;
}

/**
 * Extract payment info text from payment instructions
 */
export function extractPaymentInfoText(paymentInstructions: unknown): string | undefined {
  if (typeof paymentInstructions === "string") {
    return paymentInstructions;
  }
  
  if (
    paymentInstructions &&
    typeof paymentInstructions === "object" &&
    typeof (paymentInstructions as any).text === "string"
  ) {
    return (paymentInstructions as any).text;
  }
  
  return undefined;
}

/**
 * Clear agency cache (for testing or force refresh)
 */
export function clearAgencyCache(): void {
  cachedAgencyData = null;
  cacheTime = 0;
}
