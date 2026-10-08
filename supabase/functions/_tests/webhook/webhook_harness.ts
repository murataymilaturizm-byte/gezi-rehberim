// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK GİRİŞ-KATMANI HARNESS'İ (PAKET-0 Dilim-3)
// GERÇEK `whatsapp-webhook/index.ts` import edilir; `serve` stub'ı handler'ı yakalar.
// Stub: supabase-js (tembel, catch'siz builder — aslına uygun), Meta gönderim/acente
// çözümü (ağ), okundu-göstergesi, error-sink (logCritical kaydı), process-message
// (yalnız çağrı kaydı). Gerçek kalan: imza/ayrıştırma, dedup/rate-limit/limit/abonelik/
// bot-pause/canned dalları, tur önbelleği + toBotTours, adapter kurulumu.
//   Meta payload → postWebhook() → db.inserts / sent / processCalls / criticalLog
// ═══════════════════════════════════════════════════════════════════════════
import { capturedHandler } from "./stubs/std-server.ts";
import { db, resetDb } from "./stubs/supabase-js.ts";
import { sent, meta } from "./stubs/meta.ts";
import { processCalls } from "./stubs/process-message.ts";
import { criticalLog } from "../harness/stubs/error-sink.ts";

if (!Deno.env.get("HARNESS_VERBOSE")) {
  console.log = () => {}; console.info = () => {}; console.warn = () => {}; console.error = () => {};
}
Deno.env.delete("META_APP_SECRET"); Deno.env.delete("WHATSAPP_APP_SECRET");
// getMetaCredentials env fallback'u kapalı → "bağlantı bilgisi eksik acente" senaryosu gerçekçi.
Deno.env.delete("WHATSAPP_ACCESS_TOKEN"); Deno.env.delete("WHATSAPP_PHONE_NUMBER_ID");
await import("../../whatsapp-webhook/index.ts");
if (!capturedHandler) throw new Error("webhook handler yakalanamadı (serve stub)");

export { db, sent, processCalls, criticalLog };

export const CUSTOMER = "905551112233";

export function mkAgency(over: Record<string, any> = {}) {
  return {
    id: "ag-1", name: "Test Acente", plan_type: "starter",
    meta_phone_number_id: "pnid-1", meta_access_token: "tok-1", meta_waba_id: null, webhook_subscribed: true,
    subscription_status: "active", monthly_message_count: 0, last_message_reset_date: new Date().toISOString(),
    enabled_languages: ["tr"], phone_public: null, payment_instructions: null, language_currencies: null, primary_currency: "TRY",
    ...over,
  };
}

export interface Scenario {
  agency?: Record<string, any>;
  planLimit?: number;               // plan_features.message_limit (-1 = sınırsız)
  rateLimit?: { data: any; error: any };
  unavailableInsertFails?: boolean; // [unavailable] system satırı insert'i hata versin
  botPaused?: boolean;
  agencyNotFound?: boolean;         // resolveAgencyByPhoneNumberId acente bulamaz
  toursDown?: boolean;              // tours SELECT hata → getCachedTours TOUR_DATA_UNAVAILABLE (yalnız önbelleksiz acente id'sinde)
}

/** Yeni senaryo: tüm kayıtları sıfırla, DB davranışını kur. Dönen db aynı senaryodaki ardışık mesajlarda KORUNUR. */
export function setupScenario(s: Scenario = {}) {
  resetDb({
    rpc: {
      process_whatsapp_message_atomic: () => ({ data: { success: true, context: null, history: [] }, error: null }),
      check_rate_limit: () => s.rateLimit ?? { data: { allowed: true }, error: null },
      increment_agency_message_count: () => ({ data: null, error: null }),
    },
    select: (table, f) => {
      if (table === "plan_features") return { data: { message_limit: s.planLimit ?? -1, has_user_profiles: false, has_templates: false }, error: null };
      if (table === "whatsapp_conversations" && f.role === "system") {
        // 24h soğuma sorgusu: daha önce GERÇEKTEN yazılmış [unavailable] satırı var mı?
        const row = db.inserts.find((i) => i.table === "whatsapp_conversations" && [i.payload].flat().some((p: any) => p?.role === "system" && String(p?.content).startsWith("[unavailable]")));
        return { data: row ? { id: "sys-1" } : null, error: null };
      }
      if (table === "whatsapp_user_profiles") return { data: s.botPaused ? { bot_paused: true, bot_paused_until: null } : null, error: null };
      if (table === "tours" && s.toursDown) return { data: null, error: { message: "simulated tours outage" } };
      if (table === "tours" || table === "registrations") return { data: [], error: null };
      return undefined;
    },
    insertResult: (table, payload) =>
      s.unavailableInsertFails && table === "whatsapp_conversations" && [payload].flat().some((p: any) => p?.role === "system")
        ? { data: null, error: { message: "simulated insert failure" } }
        : undefined,
  });
  sent.length = 0; processCalls.length = 0; criticalLog.length = 0;
  meta.agency = s.agencyNotFound ? null : mkAgency(s.agency);
}

let _mid = 0;
/** Meta `messages` webhook'u — tek metin mesajı. */
export async function postWebhook(text: string, from = CUSTOMER): Promise<{ status: number; body: any }> {
  const payload = {
    object: "whatsapp_business_account",
    entry: [{ id: "waba-1", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "908500000000", phone_number_id: "pnid-1" },
      contacts: [{ profile: { name: "Müşteri" }, wa_id: from }],
      messages: [{ from, id: `wamid.in.${++_mid}`, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: text } }],
    } }] }],
  };
  const res = await capturedHandler!(new Request("http://localhost/whatsapp-webhook", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }));
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** Ham Meta `messages[0]` nesnesiyle gönderim (medya/konum vb. — gerçek payload şekli). */
export async function postRawMessage(msg: Record<string, unknown>, from = CUSTOMER): Promise<{ status: number; body: any }> {
  const payload = {
    object: "whatsapp_business_account",
    entry: [{ id: "waba-1", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "908500000000", phone_number_id: "pnid-1" },
      contacts: [{ profile: { name: "Müşteri" }, wa_id: from }],
      messages: [{ from, id: `wamid.in.${++_mid}`, timestamp: String(Math.floor(Date.now() / 1000)), ...msg }],
    } }] }],
  };
  const res = await capturedHandler!(new Request("http://localhost/whatsapp-webhook", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }));
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** whatsapp_conversations'a GERÇEKTEN yazılmış role=user satırları. */
export const userRows = () => db.inserts
  .filter((i) => i.table === "whatsapp_conversations")
  .flatMap((i) => [i.payload].flat())
  .filter((p: any) => p?.role === "user");

/** whatsapp_conversations'a GERÇEKTEN yazılmış role=system satırları ([unavailable] soğuma kaydı). */
export const sysRows = () => db.inserts
  .filter((i) => i.table === "whatsapp_conversations")
  .flatMap((i) => [i.payload].flat())
  .filter((p: any) => p?.role === "system");
