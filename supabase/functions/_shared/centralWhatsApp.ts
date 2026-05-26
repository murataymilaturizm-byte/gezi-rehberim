// Turzz merkezi WhatsApp gönderim helper'ları.
//
// MERKEZ vs ACENTE ayrımı:
//   - Acente-bazlı gönderim için: _shared/metaWhatsapp.ts → getMetaCredentials(agency)
//     (acente kendi WABA credential'larıyla; env yalnızca fallback).
//   - Turzz'a ait merkezi WABA gönderimi için: bu dosya → getCentralWhatsAppCredentials().
//
// Birincil env: TURZZ_CENTRAL_PHONE_NUMBER_ID + TURZZ_CENTRAL_ACCESS_TOKEN (yeni, niyet net).
// Geri-uyumluluk: WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN (eski; metaWhatsapp.ts'in
// getMetaCredentials fallback'i hala bunları okur — Aymila vb. mevcut acentelerin botu için).
// Bu helper önce yeni env'leri arar, yoksa eski'ye düşer.
//
// İleride tabloya (örn. turzz_central_settings) taşınmak istenirse SADECE bu dosya değişir;
// çağıran tarafa yansımaz. Caller'lar env'i doğrudan okumamalı — bu helper'ı çağırmalı.

import { logCritical } from "./error-sink.ts";

/** Turzz merkezi sistem acentesi için rezerve UUID.
 *
 *  template_send_log.agency_id NOT NULL FK → public.agencies(id). Merkezi gönderimde bu
 *  UUID kullanılır; agencies tablosunda active=FALSE, user_id=NULL olarak placeholder satır
 *  vardır (migration 20260525000003).
 *
 *  Single source of truth — edge function tarafında SADECE buradan import edin.
 *  Frontend ihtiyacı için aynı sabit src/lib/centralAgency.ts'de tekrar tanımlanacak (PARÇA 2). */
export const TURZZ_CENTRAL_AGENCY_ID = "11111111-1111-1111-1111-111111111111";

export interface CentralWhatsAppCredentials {
  phoneNumberId: string;
  accessToken: string;
}

/**
 * Turzz merkezi WABA credential'larını döndür.
 *
 * Throw'lar (sessizce dönmez): caller bildirim göndermeye çalışıyorsa credential yoksa
 * fail-loud olmak doğru — sessiz kayıp = teslim edilmeyen sistem mesajı = farkına varılmaz hata.
 * Aynı anda system_errors'a kayıt düşer (super_admin görür).
 *
 * @throws {Error} env değişkenleri eksikse.
 */
export async function getCentralWhatsAppCredentials(): Promise<CentralWhatsAppCredentials> {
  // Önce yeni Turzz-merkezi env'ler; yoksa eski WHATSAPP_* env'lerine fallback (geri-uyumluluk).
  const phoneNumberId = (
    Deno.env.get("TURZZ_CENTRAL_PHONE_NUMBER_ID") ||
    Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ||
    ""
  ).trim();
  const accessToken = (
    Deno.env.get("TURZZ_CENTRAL_ACCESS_TOKEN") ||
    Deno.env.get("WHATSAPP_ACCESS_TOKEN") ||
    ""
  ).trim();

  if (!phoneNumberId || !accessToken) {
    // Hata mesajında YENİ env isimlerini raporla — Supabase Dashboard'da hangi secret eksik,
    // super_admin system_errors panelinden net anlayabilsin.
    const missing: string[] = [];
    if (!phoneNumberId) missing.push("TURZZ_CENTRAL_PHONE_NUMBER_ID");
    if (!accessToken)   missing.push("TURZZ_CENTRAL_ACCESS_TOKEN");
    const msg = `Central WhatsApp credentials missing: ${missing.join(", ")}`;

    // Görünür hata — super_admin system_errors panelinde görür.
    await logCritical({
      event:    "CENTRAL_WHATSAPP_CREDENTIALS_MISSING",
      error:    new Error(msg),
      context:  { missing },
      severity: "critical",
    });

    throw new Error(msg);
  }

  return { phoneNumberId, accessToken };
}
