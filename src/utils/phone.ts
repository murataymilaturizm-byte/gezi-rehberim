// Telefon normalizasyonu — panel (Vite) kopyası. Edge eşdeğeri: supabase/functions/_shared/phone.ts
// İkisi AYNI mantıkta kalmalı (phone-parity-test.mjs doğrular).
//
// KANONİK: E.164 rakam, +'sız, ülke-kodlu → "905419990011".
export function normalizePhone(raw: string | null | undefined): string {
  let s = String(raw ?? "").replace(/[^\d+]/g, "");
  s = s.replace(/^\+/, "");
  s = s.replace(/\D/g, "");
  if (!s) return "";
  if (s.startsWith("00")) s = s.slice(2);
  if (s.startsWith("0")) s = "90" + s.slice(1);
  else if (s.length === 10 && s.startsWith("5")) s = "90" + s;
  return s;
}

/** Görüntü formatı (kanonik → "+90 541 999 00 11"); yalnız TR-90 için gruplar. */
export function formatPhoneDisplay(canonical: string | null | undefined): string {
  const s = normalizePhone(canonical);
  if (s.startsWith("90") && s.length === 12) {
    const n = s.slice(2);
    return `+90 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 8)} ${n.slice(8, 10)}`;
  }
  return s ? `+${s}` : "";
}
