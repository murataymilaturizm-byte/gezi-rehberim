// Extract customer information from messages
import type { ReservationInfo } from '../types.ts';

const BLACKLIST_WORDS = /evet|onay|tamam|olur|hayır|yes|no|okay|sure|confirm|tur|tour|kayıt|rezerv|book|kişi|kisi|people|lütfen|please|doğru|correct/i;

export function extractReservationInfo(
  message: string,
  currentInfo: ReservationInfo,
  expectedInput: string
): Partial<ReservationInfo> {
  const extracted: Partial<ReservationInfo> = {};
  
  // Extract based on what we're expecting
  switch (expectedInput) {
    case 'date':
      const dateResult = extractDate(message, currentInfo);
      if (dateResult.selectedDate) extracted.selectedDate = dateResult.selectedDate;
      if (dateResult.dateId) extracted.dateId = dateResult.dateId;
      break;
      
    case 'pax_count':
      const pax = extractPax(message);
      if (pax.adult) extracted.paxAdult = pax.adult;
      if (pax.child) extracted.paxChild = pax.child;
      break;
      
    case 'full_name':
      const name = extractFullName(message);
      if (name) extracted.fullName = name;
      break;
      
    case 'phone_number':
      const phone = extractPhone(message);
      if (phone) extracted.phone = phone;
      break;
      
    default:
      // Try to extract everything
      const allExtracted = extractAllInfo(message);
      Object.assign(extracted, allExtracted);
  }
  
  return extracted;
}

function extractDate(message: string, currentInfo: ReservationInfo): { selectedDate?: string; dateId?: string } {
  const result: { selectedDate?: string; dateId?: string } = {};
  
  // First, try to extract date selection by number (1, 2, 3...)
  const numberMatch = message.trim().match(/^(\d+)$/);
  if (numberMatch) {
    const dateIndex = parseInt(numberMatch[1]) - 1;
    // This will be validated against available dates in state machine
    result.selectedDate = `date_${dateIndex}`;
    return result;
  }
  
  // Match patterns like "15 aralık", "22 December", "2025-12-15"
  const patterns = [
    /(\d{1,2})\s*(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)/i,
    /(\d{1,2})\s*(january|february|march|april|may|june|july|august|september|october|november|december)/i,
    /(\d{4})-(\d{2})-(\d{2})/
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      result.selectedDate = match[0];
      return result;
    }
  }
  
  return result;
}

function extractPax(message: string): { adult?: number; child?: number } {
  const result: { adult?: number; child?: number } = {};
  
  // Extract adult count
  const adultPatterns = [
    /(\d+)\s*(?:yetişkin|yetiskin|adult)/i,
    /(\d+)\s*(?:kişi|kisi|people|person)/i
  ];
  
  for (const pattern of adultPatterns) {
    const match = message.match(pattern);
    if (match) {
      result.adult = parseInt(match[1]);
      break;
    }
  }
  
  // If no explicit pattern and message is just a number 1-20, use it
  if (!result.adult) {
    const justNumber = message.trim().match(/^(\d+)$/);
    if (justNumber) {
      const num = parseInt(justNumber[1]);
      if (num >= 1 && num <= 20) {
        result.adult = num;
      }
    }
  }
  
  // Extract child count
  const childMatch = message.match(/(\d+)\s*(?:çocuk|cocuk|child|children)/i);
  if (childMatch) {
    result.child = parseInt(childMatch[1]);
  }
  
  return result;
}

function extractFullName(message: string): string | null {
  // Don't extract from blacklisted words
  if (BLACKLIST_WORDS.test(message)) {
    return null;
  }
  
  // Remove extra spaces and trim
  const cleaned = message.trim().replace(/\s+/g, ' ');
  
  // Explicit patterns with keywords
  const explicitPatterns = [
    /(?:ismim|adım|adim|name is|i am|i'm|ben)\s+([A-ZÇĞİÖŞÜa-zçğıöşü]+\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+)/i,
    /(?:tam\s+(?:ismim|adım))\s+([A-ZÇĞİÖŞÜa-zçğıöşü]+\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+)?)/i
  ];
  
  for (const pattern of explicitPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (isValidName(name)) {
        return formatName(name);
      }
    }
  }
  
  // Try to extract name from message (2-4 words, may include lowercase)
  const nameMatch = cleaned.match(/\b([A-ZÇĞİÖŞÜa-zçğıöşü]{2,}\s+[A-ZÇĞİÖŞÜa-zçğıöşü]{2,}(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]{2,})?)\b/);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (isValidName(name)) {
      return formatName(name);
    }
  }
  
  return null;
}

function extractPhone(message: string): string | null {
  const phonePatterns = [
    /(?:telefon|phone|numara|number|tel)[\s:]+(\d[\s\-\d]{8,14})/i,
    /\b(05\d{9})\b/,  // Turkish mobile: 05xxxxxxxxx
    /\b(0\d{10})\b/,  // 0 + 10 digits
    /\b(\+90[\s\-]?5\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})\b/,  // International
    /\b(\d{10,11})\b/  // 10-11 digits
  ];
  
  for (const pattern of phonePatterns) {
    const match = message.match(pattern);
    if (match) {
      let phone = match[1].replace(/[\s\-]/g, '');
      // Accept if 10-11 digits
      if (phone.length >= 10 && phone.length <= 11 && /^\d+$/.test(phone)) {
        return phone;
      }
    }
  }
  
  return null;
}

function extractAllInfo(message: string): Partial<ReservationInfo> {
  const extracted: Partial<ReservationInfo> = {};
  
  const pax = extractPax(message);
  if (pax.adult) extracted.paxAdult = pax.adult;
  if (pax.child) extracted.paxChild = pax.child;
  
  const phone = extractPhone(message);
  if (phone) extracted.phone = phone;
  
  const name = extractFullName(message);
  if (name) extracted.fullName = name;
  
  const dateResult = extractDate(message, {} as ReservationInfo);
  if (dateResult.selectedDate) extracted.selectedDate = dateResult.selectedDate;
  if (dateResult.dateId) extracted.dateId = dateResult.dateId;
  
  return extracted;
}

function isValidName(name: string): boolean {
  // Check against blacklist
  if (BLACKLIST_WORDS.test(name)) return false;
  
  const words = name.split(/\s+/);
  
  // Must be 2-4 words
  if (words.length < 2 || words.length > 4) return false;
  
  // Length check
  if (name.length < 5 || name.length > 50) return false;
  
  // All words should be at least 2 chars
  if (words.some(w => w.length < 2)) return false;
  
  return true;
}

function formatName(name: string): string {
  return name
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
