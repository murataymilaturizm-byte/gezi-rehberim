// Extract reservation info from natural language messages
import type { ReservationInfo } from './types.ts';

/**
 * Main extractor - routes to specific extractors based on expected input
 */
export function extractReservationInfo(
  message: string,
  currentInfo: ReservationInfo,
  expectedInput: string
): Partial<ReservationInfo> {
  const lower = message.toLowerCase().trim();
  
  // Route to specific extractors based on expected input
  if (expectedInput === 'date') {
    return extractDate(message, currentInfo);
  }
  
  if (expectedInput === 'pax') {
    const pax = extractPax(message);
    const result: Partial<ReservationInfo> = {};
    if (pax.adult !== undefined) result.paxAdult = pax.adult;
    if (pax.child !== undefined) result.paxChild = pax.child;
    return result;
  }
  
  if (expectedInput === 'name') {
    const name = extractFullName(message);
    return name ? { fullName: name } : {};
  }
  
  if (expectedInput === 'phone') {
    const phone = extractPhone(message);
    return phone ? { phone } : {};
  }
  
  // If no specific expectation, try to extract everything
  return extractAllInfo(message);
}

/**
 * Extract date from message
 */
function extractDate(message: string, currentInfo: ReservationInfo): { selectedDate?: string; dateId?: string } {
  const lower = message.toLowerCase().trim();
  const result: { selectedDate?: string; dateId?: string } = {};
  
  // Try to match date selection by number (e.g., "1", "2. seçenek")
  const optionMatch = lower.match(/^(\d+)\.?\s*(seçenek|option|tarih)?$/);
  if (optionMatch) {
    const index = parseInt(optionMatch[1]) - 1;
    if (currentInfo.tourId && index >= 0) {
      // We'll need to fetch tour dates to get the actual dateId
      // For now, just mark that a date was selected
      result.dateId = `date_${index}`;
    }
  }
  
  // Try to match specific date formats
  const datePatterns = [
    /(\d{1,2})\s*[-\/]\s*(\d{1,2})\s*[-\/]\s*(\d{4})/,  // DD-MM-YYYY or DD/MM/YYYY
    /(\d{4})\s*[-\/]\s*(\d{1,2})\s*[-\/]\s*(\d{1,2})/,  // YYYY-MM-DD
    /(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık|january|february|march|april|may|june|july|august|september|october|november|december)/i
  ];
  
  for (const pattern of datePatterns) {
    const match = message.match(pattern);
    if (match) {
      result.selectedDate = match[0];
      break;
    }
  }
  
  return result;
}

/**
 * Extract passenger counts from message
 */
function extractPax(message: string): { adult?: number; child?: number } {
  const result: { adult?: number; child?: number } = {};
  const lower = message.toLowerCase();
  
  // Patterns for adults
  const adultPatterns = [
    /(\d+)\s*(yetişkin|adult|büyük|kişi)/i,
    /(\d+)\s*kişi/i,
    /^(\d+)$/  // Just a number
  ];
  
  // Patterns for children
  const childPatterns = [
    /(\d+)\s*(çocuk|child|kid)/i
  ];
  
  // Extract adults
  for (const pattern of adultPatterns) {
    const match = message.match(pattern);
    if (match) {
      result.adult = parseInt(match[1]);
      break;
    }
  }
  
  // Extract children
  for (const pattern of childPatterns) {
    const match = message.match(pattern);
    if (match) {
      result.child = parseInt(match[1]);
      break;
    }
  }
  
  // If no specific keywords, try to parse "X yetişkin Y çocuk" or "X adult Y child"
  const combinedMatch = message.match(/(\d+).*?(\d+)/);
  if (combinedMatch && !result.adult && !result.child) {
    result.adult = parseInt(combinedMatch[1]);
    result.child = parseInt(combinedMatch[2]);
  }
  
  // Validate
  if (result.adult !== undefined && (result.adult < 0 || result.adult > 20)) {
    delete result.adult;
  }
  if (result.child !== undefined && (result.child < 0 || result.child > 20)) {
    delete result.child;
  }
  
  return result;
}

/**
 * Extract full name from message
 */
function extractFullName(message: string): string | null {
  // Match 2-3 word names with Turkish and Latin characters
  const nameMatch = message.match(/\b([A-ZÇĞİÖŞÜa-zçğıöşü]{2,}\s+[A-ZÇĞİÖŞÜa-zçğıöşü]{2,}(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]{2,})?)\b/);
  
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (isValidName(name)) {
      return formatName(name);
    }
  }
  
  return null;
}

/**
 * Extract phone number from message
 */
function extractPhone(message: string): string | null {
  const phonePatterns = [
    /\b(05\d{9})\b/,  // Turkish mobile: 05xxxxxxxxx
    /\b(\+90[\s\-]?5\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})\b/,  // International
    /\b(\d{10,11})\b/  // 10-11 digits
  ];
  
  for (const pattern of phonePatterns) {
    const match = message.match(pattern);
    if (match) {
      let phone = match[1].replace(/[\s\-]/g, '');
      if (phone.length >= 10 && phone.length <= 11 && /^\d+$/.test(phone)) {
        return phone;
      }
    }
  }
  
  return null;
}

/**
 * Try to extract all information from a single message
 */
function extractAllInfo(message: string): Partial<ReservationInfo> {
  const result: Partial<ReservationInfo> = {};
  
  // Try phone
  const phone = extractPhone(message);
  if (phone) result.phone = phone;
  
  // Try name
  const name = extractFullName(message);
  if (name) result.fullName = name;
  
  // Try pax
  const pax = extractPax(message);
  if (pax.adult) result.paxAdult = pax.adult;
  if (pax.child) result.paxChild = pax.child;
  
  return result;
}

/**
 * Validate name
 */
function isValidName(name: string): boolean {
  const words = name.split(/\s+/);
  
  // Must be 2-3 words
  if (words.length < 2 || words.length > 3) return false;
  
  // Each word must be at least 2 characters
  if (words.some(w => w.length < 2)) return false;
  
  // Length check
  if (name.length < 5 || name.length > 50) return false;
  
  // Must not contain numbers
  if (/\d/.test(name)) return false;
  
  // Blacklist common words
  const blacklist = [
    'evet', 'hayır', 'tamam', 'olur', 'kişi', 'tur', 'kayıt', 'tarih',
    'nereden', 'nereye', 'nasıl', 'kaçta', 'hangi', 'kim', 'neden'
  ];
  
  const lowerName = name.toLowerCase();
  if (blacklist.some(word => lowerName.includes(word))) return false;
  
  return true;
}

/**
 * Format name with proper capitalization
 */
function formatName(name: string): string {
  return name
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
