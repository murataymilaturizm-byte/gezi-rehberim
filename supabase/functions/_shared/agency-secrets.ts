// Acente secret'ları — TEK okuma yolu (2026-07-22 token güvenlik ayrıştırması).
//
// Secret kolonlar agencies'ten agency_secrets tablosuna taşındı (RLS service-role-only).
// Edge-function'lar (service-role) buradan okur; panel-client HİÇ okuyamaz.
//
// uses_central_token=true → meta_access_token DB'de tutulmaz; gönderimde env
// WHATSAPP_ACCESS_TOKEN kullanılır (merkezi token tek yerde: env).

export interface AgencySecrets {
  meta_access_token: string | null;   // resolved (central ise env)
  meta_verify_token: string | null;
  whatsapp_api_key: string | null;
  twilio_auth_token: string | null;
  uses_central_token: boolean;
}

const _EMPTY: AgencySecrets = {
  meta_access_token: null, meta_verify_token: null, whatsapp_api_key: null,
  twilio_auth_token: null, uses_central_token: false,
};

/** agency_secrets'tan oku + merkezi-token'ı env'den çöz. */
export async function getAgencySecrets(supabase: any, agencyId: string): Promise<AgencySecrets> {
  if (!agencyId) return { ..._EMPTY };
  const { data } = await supabase
    .from("agency_secrets")
    .select("meta_access_token, meta_verify_token, whatsapp_api_key, twilio_auth_token, uses_central_token")
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!data) return { ..._EMPTY };
  const usesCentral = data.uses_central_token === true;
  return {
    meta_access_token: usesCentral
      ? (Deno.env.get("WHATSAPP_ACCESS_TOKEN") || null)
      : (data.meta_access_token || null),
    meta_verify_token: data.meta_verify_token || null,
    whatsapp_api_key: data.whatsapp_api_key || null,
    twilio_auth_token: data.twilio_auth_token || null,
    uses_central_token: usesCentral,
  };
}

/** agency_secrets'a yaz (upsert). Yalnız verilen alanlar güncellenir.
 *  uses_central_token=true verilirse meta_access_token DB'ye YAZILMAZ (null'lanır). */
export async function upsertAgencySecret(
  supabase: any,
  agencyId: string,
  patch: Partial<{ meta_access_token: string | null; meta_verify_token: string | null; whatsapp_api_key: string | null; twilio_auth_token: string | null; uses_central_token: boolean }>,
): Promise<void> {
  if (!agencyId) return;
  const row: Record<string, any> = { agency_id: agencyId, updated_at: new Date().toISOString() };
  for (const k of ["meta_access_token", "meta_verify_token", "whatsapp_api_key", "twilio_auth_token", "uses_central_token"] as const) {
    if (k in patch) row[k] = (patch as any)[k];
  }
  // Merkezi token bayrağı → token'ın KENDİSİ tutulmaz.
  if (row.uses_central_token === true) row.meta_access_token = null;
  await supabase.from("agency_secrets").upsert(row, { onConflict: "agency_id" });
}

/** agency nesnesine secret alanlarını ekle → mevcut `agency.meta_access_token`
 *  referansları değişmeden çalışır (getMetaCredentials, signature-validation). */
export async function hydrateAgencySecrets(supabase: any, agency: any): Promise<any> {
  if (!agency?.id) return agency;
  const s = await getAgencySecrets(supabase, agency.id);
  agency.meta_access_token = s.meta_access_token;
  agency.meta_verify_token = s.meta_verify_token;
  agency.whatsapp_api_key = s.whatsapp_api_key;
  agency.twilio_auth_token = s.twilio_auth_token;
  return agency;
}
