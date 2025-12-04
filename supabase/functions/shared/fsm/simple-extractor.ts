// Simple fallback extractor for name, phone, pax, and date (when NLU misses them)
import type { ReservationInfo } from './types.ts';

export function extractNameAndPhone(message: string): { fullName?: string; phone?: string; paxAdult?: number; selectedDate?: string } {
  const result: { fullName?: string; phone?: string; paxAdult?: number; selectedDate?: string } = {};
  
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
  
  // Extract pax (person count)
  const paxPatterns = [
    /(\d+)\s*(?:kişi|kisi|person|people|yetişkin|adult)/i,
    /(\d+)\s*kişilik/i,
    /\b(\d+)\s*(?:yetişkin|adult)/i,
    /(?:evet|yes|ok|tamam)?\s*(\d+)\s*kişi/i,
  ];
  
  for (const pattern of paxPatterns) {
    const match = message.match(pattern);
    if (match) {
      const pax = parseInt(match[1]);
      if (pax >= 1 && pax <= 50) {
        result.paxAdult = pax;
        break;
      }
    }
  }
  
  // Extract date
  const monthNames: Record<string, number> = {
    'ocak': 1, 'şubat': 2, 'mart': 3, 'nisan': 4, 'mayıs': 5, 'haziran': 6,
    'temmuz': 7, 'ağustos': 8, 'eylül': 9, 'ekim': 10, 'kasım': 11, 'aralık': 12,
    'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
    'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12
  };
  
  // Pattern: "18 aralık", "15 december"
  const monthPatternMatch = message.toLowerCase().match(/(\d{1,2})\s*(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık|january|february|march|april|may|june|july|august|september|october|november|december)/i);
  if (monthPatternMatch) {
    const day = parseInt(monthPatternMatch[1]);
    const monthName = monthPatternMatch[2].toLowerCase();
    const month = monthNames[monthName];
    if (day >= 1 && day <= 31 && month) {
      const year = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const adjustedYear = month < currentMonth ? year + 1 : year;
      result.selectedDate = `${adjustedYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  
  // Pattern: "15.12", "18/12", "15-12"
  const numericDateMatch = message.match(/(\d{1,2})[\.\/-](\d{1,2})(?:[\.\/-](\d{2,4}))?/);
  if (!result.selectedDate && numericDateMatch) {
    const day = parseInt(numericDateMatch[1]);
    const month = parseInt(numericDateMatch[2]);
    let year = numericDateMatch[3] ? parseInt(numericDateMatch[3]) : new Date().getFullYear();
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      result.selectedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
  
  // Expanded blacklist - reject questions and common words
  const blacklist = [
    'evet', 'hayır', 'tamam', 'olur', 'kişi', 'tur', 'kayıt', 'tarih',
    'nereden', 'nereye', 'nasıl', 'kaçta', 'hangi', 'kim', 'neden',
    'hareket', 'ediyor', 'yapıyor', 'gidiyor', 'kalkıyor', 'varıyor',
    'istiyorum', 'istiyor', 'ister', 'sorun', 'soru', 'bilgi',
    'telefon', 'numara', 'vermiştim', 'verdim', 'söyledim', 'yazdım',
    'aralık', 'ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran',
    'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım',
    'onaylıyorum', 'onay', 'kabul', 'ediyorum', 'yes', 'confirm',
    'doğru', 'yanlış', 'iptal', 'cancel', 'değiştir', 'change'
  ];
  
  const lowerName = name.toLowerCase();
  if (blacklist.some(word => lowerName.includes(word))) return false;
  
  return true;
}

function formatName(name: string): string {
  return name
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
