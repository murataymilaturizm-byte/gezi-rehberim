// City to language mapping utility
// Determines the preferred language based on the city/region

const cityLanguageMap: Record<string, string> = {
  // Turkish cities
  'istanbul': 'tr',
  'ankara': 'tr',
  'izmir': 'tr',
  'antalya': 'tr',
  'bursa': 'tr',
  'adana': 'tr',
  'gaziantep': 'tr',
  'konya': 'tr',
  'mersin': 'tr',
  'kayseri': 'tr',
  'eskişehir': 'tr',
  'diyarbakır': 'tr',
  'samsun': 'tr',
  'denizli': 'tr',
  'şanlıurfa': 'tr',
  'adapazarı': 'tr',
  'malatya': 'tr',
  'kahramanmaraş': 'tr',
  'erzurum': 'tr',
  'van': 'tr',
  
  // German cities
  'berlin': 'de',
  'hamburg': 'de',
  'munich': 'de',
  'münchen': 'de',
  'cologne': 'de',
  'köln': 'de',
  'frankfurt': 'de',
  'stuttgart': 'de',
  'düsseldorf': 'de',
  'dortmund': 'de',
  'essen': 'de',
  'leipzig': 'de',
  'bremen': 'de',
  'dresden': 'de',
  'hannover': 'de',
  'nuremberg': 'de',
  'nürnberg': 'de',
  'duisburg': 'de',
  'bochum': 'de',
  'wuppertal': 'de',
  
  // Russian cities
  'moscow': 'ru',
  'moskova': 'ru',
  'st. petersburg': 'ru',
  'saint petersburg': 'ru',
  'petersburg': 'ru',
  'novosibirsk': 'ru',
  'yekaterinburg': 'ru',
  'kazan': 'ru',
  'nizhny novgorod': 'ru',
  'chelyabinsk': 'ru',
  'samara': 'ru',
  'omsk': 'ru',
  'rostov-on-don': 'ru',
  'ufa': 'ru',
  'krasnoyarsk': 'ru',
  'voronezh': 'ru',
  'perm': 'ru',
  'volgograd': 'ru',
  
  // Arabic speaking cities
  'dubai': 'ar',
  'abu dhabi': 'ar',
  'sharjah': 'ar',
  'doha': 'ar',
  'riyadh': 'ar',
  'jeddah': 'ar',
  'mecca': 'ar',
  'medina': 'ar',
  'dammam': 'ar',
  'kuwait': 'ar',
  'muscat': 'ar',
  'manama': 'ar',
  'cairo': 'ar',
  'alexandria': 'ar',
  'casablanca': 'ar',
  'amman': 'ar',
  'beirut': 'ar',
  'baghdad': 'ar',
  'damascus': 'ar',
  
  // French cities
  'paris': 'fr',
  'marseille': 'fr',
  'lyon': 'fr',
  'toulouse': 'fr',
  'nice': 'fr',
  'nantes': 'fr',
  'strasbourg': 'fr',
  'montpellier': 'fr',
  'bordeaux': 'fr',
  'lille': 'fr',
  'rennes': 'fr',
  'reims': 'fr',
  'le havre': 'fr',
  'saint-étienne': 'fr',
  'toulon': 'fr',
  'grenoble': 'fr',
  
  // Spanish cities
  'madrid': 'es',
  'barcelona': 'es',
  'valencia': 'es',
  'seville': 'es',
  'sevilla': 'es',
  'zaragoza': 'es',
  'málaga': 'es',
  'murcia': 'es',
  'palma': 'es',
  'las palmas': 'es',
  'bilbao': 'es',
  'alicante': 'es',
  'córdoba': 'es',
  'valladolid': 'es',
  'vigo': 'es',
  'gijón': 'es',
  
  // English speaking cities
  'london': 'en',
  'manchester': 'en',
  'birmingham': 'en',
  'liverpool': 'en',
  'leeds': 'en',
  'glasgow': 'en',
  'edinburgh': 'en',
  'new york': 'en',
  'los angeles': 'en',
  'chicago': 'en',
  'houston': 'en',
  'toronto': 'en',
  'vancouver': 'en',
  'sydney': 'en',
  'melbourne': 'en',
  'auckland': 'en',
};

/**
 * Determines the language preference based on the city name
 * @param city - The city name (case-insensitive)
 * @returns The language code (tr, en, de, ru, ar, fr, es) or 'tr' as default
 */
export const getCityLanguage = (city: string): string => {
  if (!city) return 'tr';
  
  const normalizedCity = city.toLowerCase().trim();
  
  // Direct match
  if (cityLanguageMap[normalizedCity]) {
    return cityLanguageMap[normalizedCity];
  }
  
  // Partial match (for cities with multiple words or variations)
  for (const [mapCity, language] of Object.entries(cityLanguageMap)) {
    if (normalizedCity.includes(mapCity) || mapCity.includes(normalizedCity)) {
      return language;
    }
  }
  
  // Default to Turkish
  return 'tr';
};

/**
 * Determines the language preference based on both city and region
 * Region takes precedence if it's a known country
 * @param city - The city name
 * @param region - The region/country name
 * @returns The language code (tr, en, de, ru, ar, fr, es) or 'tr' as default
 */
export const getCityRegionLanguage = (city: string, region?: string): string => {
  if (region) {
    const normalizedRegion = region.toLowerCase().trim();
    
    // Country/region based detection
    if (normalizedRegion.includes('turkey') || normalizedRegion.includes('türkiye')) return 'tr';
    if (normalizedRegion.includes('germany') || normalizedRegion.includes('deutschland') || normalizedRegion.includes('almanya')) return 'de';
    if (normalizedRegion.includes('russia') || normalizedRegion.includes('rusya')) return 'ru';
    if (normalizedRegion.includes('uae') || normalizedRegion.includes('saudi') || normalizedRegion.includes('kuwait') || normalizedRegion.includes('qatar') || normalizedRegion.includes('emirates')) return 'ar';
    if (normalizedRegion.includes('france') || normalizedRegion.includes('fransa')) return 'fr';
    if (normalizedRegion.includes('spain') || normalizedRegion.includes('españa') || normalizedRegion.includes('ispanya')) return 'es';
    if (normalizedRegion.includes('uk') || normalizedRegion.includes('united kingdom') || normalizedRegion.includes('usa') || normalizedRegion.includes('america') || normalizedRegion.includes('canada') || normalizedRegion.includes('australia')) return 'en';
  }
  
  // Fall back to city-based detection
  return getCityLanguage(city);
};