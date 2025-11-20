// Simple fallback extractor for name and phone (when NLU misses them)
import type { ReservationInfo } from '../types.ts';

export function extractNameAndPhone(message: string): { fullName?: string; phone?: string } {
  const result: { fullName?: string; phone?: string } = {};
  
  // Extract phone
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
        result.phone = phone;
        break;
      }
    }
  }
  
  // Extract full name (basic - 2-3 words, capitalized)
  const nameMatch = message.match(/\b([A-ZÇĞİÖŞÜa-zçğıöşü]{2,}\s+[A-ZÇĞİÖŞÜa-zçğıöşü]{2,}(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]{2,})?)\b/);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (isValidName(name)) {
      result.fullName = formatName(name);
    }
  }
  
  return result;
}

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
  
  // Common blacklist
  if (/evet|hayır|tamam|olur|kişi|tur|kayıt|tarih/i.test(name)) return false;
  
  return true;
}

function formatName(name: string): string {
  return name
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
