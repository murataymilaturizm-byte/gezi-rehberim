import { z } from "zod";

/**
 * Input Validation Schemas
 * Provides security against XSS, SQL injection, and data corruption
 */

// Email validation
export const emailSchema = z
  .string()
  .trim()
  .email({ message: "Geçerli bir email adresi giriniz" })
  .max(255, { message: "Email adresi çok uzun" })
  .toLowerCase();

// Phone validation (Turkish format)
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+]?[0-9]{10,15}$/, { message: "Geçerli bir telefon numarası giriniz" })
  .max(20, { message: "Telefon numarası çok uzun" });

// Name validation (prevents XSS)
export const nameSchema = z
  .string()
  .trim()
  .min(2, { message: "İsim en az 2 karakter olmalı" })
  .max(100, { message: "İsim en fazla 100 karakter olmalı" })
  .regex(/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s'-]+$/, { 
    message: "İsim sadece harf, boşluk, tire ve kesme işareti içerebilir" 
  });

// Message/Text validation (prevents XSS)
export const messageSchema = z
  .string()
  .trim()
  .min(10, { message: "Mesaj en az 10 karakter olmalı" })
  .max(2000, { message: "Mesaj en fazla 2000 karakter olmalı" })
  // Remove dangerous HTML tags and scripts
  .transform(val => val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''))
  .transform(val => val.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ''));

// Password validation
export const passwordSchema = z
  .string()
  .min(8, { message: "Şifre en az 8 karakter olmalı" })
  .max(128, { message: "Şifre çok uzun" })
  .regex(/[a-z]/, { message: "En az bir küçük harf içermeli" })
  .regex(/[A-Z]/, { message: "En az bir büyük harf içermeli" })
  .regex(/[0-9]/, { message: "En az bir rakam içermeli" });

// Contact form validation
export const contactFormSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  message: messageSchema,
});

// Agency settings validation
export const agencySettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Acente adı en az 2 karakter olmalı" })
    .max(200, { message: "Acente adı çok uzun" }),
  whatsapp_phone_number: phoneSchema.optional(),
  city: z.string().trim().max(100).optional(),
  region: z.string().trim().max(100).optional(),
});

// Tour validation
export const tourSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, { message: "Tur başlığı en az 3 karakter olmalı" })
    .max(200, { message: "Tur başlığı çok uzun" }),
  destination: z
    .string()
    .trim()
    .min(2, { message: "Destinasyon en az 2 karakter olmalı" })
    .max(100, { message: "Destinasyon çok uzun" }),
  program_url: z.string().url({ message: "Geçerli bir URL giriniz" }).optional().or(z.literal("")),
});

// Registration validation
export const registrationSchema = z.object({
  full_name: nameSchema,
  phone: phoneSchema,
  pax: z
    .number()
    .int({ message: "Kişi sayısı tam sayı olmalı" })
    .min(1, { message: "En az 1 kişi olmalı" })
    .max(100, { message: "Maksimum 100 kişi" }),
  note: z.string().trim().max(500, { message: "Not çok uzun" }).optional(),
});

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export const sanitizeHtml = (content: string): string => {
  return content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Validate and sanitize URL for safe redirect
 */
export const validateRedirectUrl = (url: string, allowedDomains: string[]): boolean => {
  try {
    const parsedUrl = new URL(url);
    return allowedDomains.some(domain => parsedUrl.hostname.endsWith(domain));
  } catch {
    return false;
  }
};

/**
 * Rate limiting helper (client-side)
 * Returns true if action is allowed, false if rate limited
 */
export const checkRateLimit = (key: string, maxAttempts: number, windowMs: number): boolean => {
  const now = Date.now();
  const attempts = JSON.parse(localStorage.getItem(`rateLimit_${key}`) || '[]') as number[];
  
  // Filter out old attempts outside the time window
  const recentAttempts = attempts.filter(timestamp => now - timestamp < windowMs);
  
  if (recentAttempts.length >= maxAttempts) {
    return false; // Rate limited
  }
  
  // Add current attempt
  recentAttempts.push(now);
  localStorage.setItem(`rateLimit_${key}`, JSON.stringify(recentAttempts));
  
  return true; // Allowed
};

/**
 * Clear rate limit for a specific key
 */
export const clearRateLimit = (key: string): void => {
  localStorage.removeItem(`rateLimit_${key}`);
};
