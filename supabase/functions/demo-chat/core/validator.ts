// Centralized validation logic
import type { ReservationInfo, ValidationResult } from '../types.ts';

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
  
  // Check phone
  if (!info.phone) {
    missingFields.push('phone');
  } else {
    const cleaned = info.phone.replace(/[\s\-]/g, '');
    if (cleaned.length < 10 || cleaned.length > 11) {
      errors.push('Invalid phone number length');
    }
    if (!/^\d+$/.test(cleaned)) {
      errors.push('Phone must contain only digits');
    }
  }
  
  return {
    isValid: missingFields.length === 0 && errors.length === 0,
    missingFields,
    errors
  };
}

export function sanitizeInput(input: string): string {
  // Remove potential script tags and dangerous characters
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim();
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-]/g, '');
  return /^\+?[0-9]{10,15}$/.test(cleaned);
}
