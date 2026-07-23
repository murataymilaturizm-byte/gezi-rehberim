// Edge fonksiyon auth yardımcıları (2026-07-23 launch-öncesi güvenlik paketi).
//
// İki güven sınıfı:
//   - İÇ ÇAĞRI (cron / function-to-function): Authorization = service-role anahtarı
//     TAM eşleşme. Yalnız sunucu-tarafı çağıranlar bu anahtarı bilir.
//   - PANEL ÇAĞRISI: kullanıcı-JWT'si (getUser ile imza doğrulanır) + sahiplik.
// anon-key (public) hiçbir sınıfa girmez → anonim gönderim imkânsız.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getBearerToken(req: Request): string {
  return (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

/**
 * İç çağrı mı (cron / function-to-function). İki yol kabul edilir:
 *   1. X-Internal-Secret header == env INTERNAL_FUNCTION_SECRET (asıl mekanizma —
 *      pg_cron token'ı edge env service-role'den FARKLI olabildiği için deterministik).
 *   2. Authorization Bearer == env SUPABASE_SERVICE_ROLE_KEY (function-to-function
 *      env-to-env yolu için yedek).
 * anon-key (public) hiçbirine uymaz.
 */
export function isInternalCall(req: Request): boolean {
  const secret = Deno.env.get("INTERNAL_FUNCTION_SECRET") || "";
  const header = req.headers.get("X-Internal-Secret") || "";
  if (secret.length > 0 && header.length > 0 && header === secret) return true;
  const token = getBearerToken(req);
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return token.length > 0 && key.length > 0 && token === key;
}
// Geriye-uyum adı (aynı davranış).
export const isServiceRoleCall = isInternalCall;

/** Panel çağrısı: user-JWT doğrula → {id}. null = anon/geçersiz/service-role. */
export async function getRequestUser(req: Request): Promise<{ id: string } | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  // service-role anahtarı bir kullanıcı değildir — getUser onu reddeder.
  const client = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_ANON_KEY") || "",
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id };
}

/** Kullanıcı bu acentenin sahibi mi (agencies.user_id). service-role client ile. */
export async function userOwnsAgency(serviceClient: any, userId: string, agencyId: string): Promise<boolean> {
  if (!userId || !agencyId) return false;
  const { data } = await serviceClient
    .from("agencies").select("id").eq("id", agencyId).eq("user_id", userId).maybeSingle();
  return !!data;
}

/** Kullanıcı super_admin mi (user_roles). service-role client ile. */
export async function isSuperAdmin(serviceClient: any, userId: string): Promise<boolean> {
  if (!userId) return false;
  const { data } = await serviceClient
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  return !!data;
}

/** Standart 401 yanıtı (cors caller tarafında eklenir). */
export function unauthorized(corsHeaders: Record<string, string>, msg = "Unauthorized"): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
