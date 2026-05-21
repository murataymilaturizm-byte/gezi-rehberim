// Centralized validation logic
import type { ReservationInfo, ValidationResult } from './types.ts';

export function validateReservationInfo(info: ReservationInfo): ValidationResult {
  const missingFields: string[] = [];
  const errors: string[] = [];
  
  // Check tour
  if (!info.tourId) missingFields.push('tour');
  
  // Check date
  if (!info.dateId && !info.selectedDate) {
    missingFields.push('date');
  }
  
  // Check pax
  if (!info.paxAdult && !info.paxChild) {
    missingFields.push('pax');
  } else {
    const totalPax = (info.paxAdult || 0) + (info.paxChild || 0);
    if (totalPax < 1) {
      errors.push('At least one person required');
    }
    if (totalPax > 20) {
      errors.push('Maximum 20 people allowed');
    }
  }
  
  // Check name
  if (!info.fullName) {
    missingFields.push('fullName');
  } else {
    const trimmed = info.fullName.trim();
    if (trimmed.length < 3) {
      errors.push('Name too short (min 3 characters)');
    }
    if (trimmed.length > 50) {
      errors.push('Name too long (max 50 characters)');
    }
    if (trimmed.split(/\s+/).length < 2) {
      errors.push('Full name required (first and last name)');
    }
  }
  
  // Check phone — E.164 / uluslararası format: 7-15 hane (Türkiye ve yabancı numaralar)
  if (!info.phone) {
    missingFields.push('phone');
  } else {
    const digitsOnly = info.phone.replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      errors.push('Invalid phone number length');
    }
  }
  
  return {
    isValid: missingFields.length === 0 && errors.length === 0,
    missingFields,
    errors
  };
}

const MAX_INPUT_LENGTH = 2000;

export function isInputTooLong(input: string): boolean {
  return typeof input === "string" && input.length > MAX_INPUT_LENGTH;
}

export function sanitizeInput(input: string): string {
  if (!input || typeof input !== "string") return "";
  // Hard length cap — token şişmesini ve prompt injection saldırılarını önle
  let sanitized = input.slice(0, MAX_INPUT_LENGTH);
  sanitized = sanitized
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/[<>]/g, "")
    .trim();
  return sanitized;
}

/**
 * K4: Prompt injection tespiti — kullanıcı mesajında injection girişimi var mı?
 * Tespit edilirse mesaj ENGELLENMEz, sadece flag döner.
 * AI cevabı post-validate edilirken bu flag kullanılır.
 */
export function detectInjection(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  const msg = input.toLowerCase();

  // EN — temel injection kalıpları
  const enPatterns = [
    /\b(ignore|forget|disregard|skip|override)\s+(all\s+)?(previous|above|prior|earlier|your|any)\s+(instructions?|rules?|directives?|guidelines?|prompt|system|context)/i,
    /\byou\s+are\s+now\s+(a\s+|an\s+)?\w/i,
    /\bact\s+as\b.{0,40}(bot|ai|assistant|gpt|model|new\s+system)/i,
    /\b(reveal|show|print|display|output)\s+(your\s+)?(system\s+prompt|instructions?|rules?|hidden\s+prompt)/i,
    /\bpretend\s+(you\s+are|to\s+be|that)\b/i,
    /\b(developer|admin|system|root|god|jailbreak|dan)\s+mode\b/i,
    /\bnew\s+(instructions?|role|task|persona)\b/i,
    /\byour\s+new\s+(instructions?|role|task)\b/i,
    /\bgive\s+(me\s+)?(a\s+)?\d+\s*%\s*(discount|off)\b/i,
    /\bmake\s+(it|this|everything)\s+free\b/i,
  ];
  if (enPatterns.some((p) => p.test(msg))) return true;

  // TR — talimat değiştirme + indirim zorlaması
  const trPatterns = [
    /\b(önceki|tüm|mevcut|yukarıdaki|bütün)\s+(talimatlar?\w*|kurallar?\w*|direktifler?\w*)\s+(unut|yoksay|görmezden|iptal|sil)/i,
    /\btalimatlar?\w*\s+(unut|yoksay|değiştir|sil)\b/i,
    /\bsen\s+artık\s+\w/i,
    /\brol\s+(değiştir|oyna|al)\b/i,
    /\b(sistem\s+prompt\w*|talimatlar?\w*)\s+(göster|yaz|söyle|aç|oku)\b/i,
    /\b%\s*\d+\s*indirim\s+(ver|yap|uygula)\b/i,
    /\bbedavaya?\s+(ver|yap|sun)\b/i,
    /\byeni\s+talimatlar?\b/i,
    /\b(özel|gizli)\s+(mod|mode|komut)\b/i,
  ];
  if (trPatterns.some((p) => p.test(msg))) return true;

  // DE / FR / ES / RU / AR — kısa özlü kalıplar
  const multilangPatterns = [
    /\b(ignoriere|vergiss)\s+(alle?\s+)?(anweisungen?|regeln?|system)\b/i,
    /\bdu\s+bist\s+jetzt\b/i,
    /\b(ignores?|oublies?)\s+(toutes?\s+les?\s+)?(instructions?|règles?)\b/i,
    /\btu\s+es\s+maintenant\b/i,
    /\b(ignora|olvida)\s+(todas?\s+las?\s+)?(instrucciones?|reglas?)\b/i,
    /\bahora\s+eres?\b/i,
    /\b(игнорируй|забудь)\s+(все\s+)?(инструкции|правила)\b/i,
    /\bты\s+теперь\b/i,
    /\b(تجاهل|انسَ)\s+(جميع\s+)?(التعليمات|القواعد)\b/i,
    /\bأنت\s+الآن\b/i,
  ];
  if (multilangPatterns.some((p) => p.test(msg))) return true;

  return false;
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-]/g, '');
  return /^\+?[0-9]{10,15}$/.test(cleaned);
}
