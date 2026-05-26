// Turzz merkezi sistem acentesi için rezerve UUID — single source of truth (frontend).
// Backend karşılığı: supabase/functions/_shared/centralWhatsApp.ts → TURZZ_CENTRAL_AGENCY_ID.
// İki yerde olmasının sebebi: edge function ve frontend ayrı build hedefleri (Deno vs Vite).
// Değer DEĞİŞTİRİLİRSE iki tarafı birden güncelle.
export const TURZZ_CENTRAL_AGENCY_ID = "11111111-1111-1111-1111-111111111111";

/** Geçerli olay tipleri — central_event_templates.event_type ve turzz_team_recipients.notification_types ile aynı küme.
 *  Faz 1 (Turzz ekibi): new_* — turzz_team_recipients'e gider.
 *  Faz 2 (Acente):      agency_* — agency_notification_settings'ten çözer, acenteye gider. */
export const CENTRAL_EVENT_TYPES = [
  "new_agency_signup",
  "new_contact_form",
  "new_reservation",
  "agency_new_reservation",
  "agency_new_support",
] as const;

export type CentralEventType = (typeof CENTRAL_EVENT_TYPES)[number];
