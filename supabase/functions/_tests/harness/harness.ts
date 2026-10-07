// ═══════════════════════════════════════════════════════════════════════════
// KATMAN-2 HARNESS — processChatMessage'ı GERÇEK kodla, stub I/O ile koşturur.
//
// Neden var: suite (scripts/test_behavioral.ts) extractor/FSM/validator modüllerini
// gerçek kodla test eder ama HANDLER'ı (76 erken-return, sıra-bağımlılıkları,
// inline liste/özet mantığı) hiç import etmiyordu. Burada handler import edilir;
// yalnız I/O (adapter, supabase) ve dış-model çağrıları (NLU, LLM) stub'lanır.
//
// Çalıştırma (repo kökünden):
//   npm test                      → suite + harness (Deno yoksa SERT hata)
//   deno test -A --import-map=supabase/functions/_tests/harness/import_map.json \
//        supabase/functions/_tests/harness/
//
// Enjeksiyon: import_map.json nlu.ts / ai.ts / error-sink.ts'i stubs/ ile değiştirir
// (prod koduna dokunulmaz). setNluMode / setAiMode ile mod seçilir:
//   NLU: { kind:"fallback" } (gerçek buildFallbackNLU — arıza modu) | { kind:"fixed", fn }
//   LLM: { kind:"fail" } (AI_TIMEOUT → handler fallback'i)           | { kind:"fixed", reply }
// ═══════════════════════════════════════════════════════════════════════════
import { processChatMessage } from "../../shared/handlers/process-message.ts";
import type { ConversationContext } from "../../shared/fsm/types.ts";
export { setNluMode } from "../../shared/fsm/nlu.ts";
export { setAiMode, lastAiParams } from "../../shared/services/ai.ts";

// ─── Stub supabase ────────────────────────────────────────────────────────
export interface SupabaseStubOptions {
  /** rpc adı → dönecek { data, error } */
  rpc?: Record<string, (args: any) => { data: any; error: any } | Promise<{ data: any; error: any }>>;
}
export function mkSupabase(opts: SupabaseStubOptions = {}) {
  const calls: Array<{ kind: "rpc" | "from"; name: string; args?: any }> = [];
  const chain = (result: any) => {
    const p: any = {};
    for (const m of ["insert", "select", "update", "eq", "neq", "in", "gte", "lte", "like", "limit", "order", "upsert", "delete"]) p[m] = () => p;
    p.maybeSingle = async () => result;
    p.single = async () => result;
    p.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej);
    return p;
  };
  return {
    calls,
    from: (name: string) => { calls.push({ kind: "from", name }); return chain({ data: { id: "row-1" }, error: null }); },
    rpc: async (name: string, args: any) => {
      calls.push({ kind: "rpc", name, args });
      const h = opts.rpc?.[name];
      return h ? await h(args) : { data: null, error: null };
    },
  };
}

// ─── Stub adapter ─────────────────────────────────────────────────────────
export function mkAdapter(ctx: ConversationContext | null, identifier = "905551112233", channel: "whatsapp" | "demo" = "whatsapp") {
  const sent: string[] = [];
  let saved: ConversationContext | null = null;
  const adapter = {
    identifier, channel,
    loadContext: async () => ({ context: ctx }),
    loadHistory: async () => [] as Array<{ role: string; content: string }>,
    saveResponse: async (_r: string, c: ConversationContext) => { saved = c; },
    saveTransaction: async (_u: string, _r: string, c: ConversationContext) => { saved = c; },
    sendResponse: async (r: string) => { sent.push(r); },
    sendErrorResponse: async (r: string) => { sent.push("ERR:" + r); },
  };
  return { adapter, sent, saved: () => saved };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────
export const mkDate = (id: string, departure_date: string, remaining_quota: number, price_adult = 1000, price_child: number | null = null, quota = 10) =>
  ({ id, departure_date, price_adult, price_child, quota, remaining_quota });

export const mkTour = (over: Partial<any> = {}) => ({
  id: "t-pam", title: "Pamukkale Turu", destination: "Denizli", type: "DAYTRIP", currency: "TRY",
  toplanma_saati: "07:30:00", hareket_noktasi: "Denizli", tur_sure: "1 gün",
  dates: [mkDate("d1", "2026-12-10", 10), mkDate("d2", "2026-12-20", 10)],
  ...over,
});

export const AGENCY: any = {
  id: "ag-1", name: "Test Acente", phone_public: "+90 212 000 00 00", show_multi_currency: true,
  enabled_languages: null, collect_email: false, working_hours: null,
};

/** COLLECTING_INFO tabanlı context üretici (tur seçili). */
export function mkContext(tour: any, over: Partial<ConversationContext> & Record<string, any> = {}): ConversationContext {
  return {
    stage: "COLLECTING_INFO", collectionStep: "waiting_for_date",
    currentTour: { id: tour.id, title: tour.title, dates: tour.dates } as any, viewedTours: [],
    reservationInfo: { tourId: tour.id, tourTitle: tour.title },
    reservationConfirmed: false, paymentInfoSent: false,
    language: "tr", tone: "standart" as any, messageCount: 3, lastUserMessage: "",
    sessionStarted: new Date().toISOString(), lastUpdated: new Date().toISOString(), isNewReservation: false,
    ...over,
  } as ConversationContext;
}

// ─── Tek turn ─────────────────────────────────────────────────────────────
export interface TurnResult {
  reply: string;
  stateIn: ConversationContext | null;
  stateOut: ConversationContext;
  rpcCalls: Array<{ name: string; args?: any }>;
}
export async function runTurn(params: {
  ctx: ConversationContext | null;
  message: string;
  tours: any[];
  supabase?: ReturnType<typeof mkSupabase>;
  agency?: any;
  seedLanguage?: string;
  identifier?: string;
  channel?: "whatsapp" | "demo";
}): Promise<TurnResult> {
  const sb = params.supabase ?? mkSupabase();
  // Handler context'i YERİNDE değiştirebilir (L3/H-pax) → giriş state'i kanıt için klonlanır.
  const stateIn = params.ctx ? structuredClone(params.ctx) : null;
  const { adapter, sent, saved } = mkAdapter(params.ctx, params.identifier, params.channel);
  const res = await processChatMessage({
    message: params.message, adapter: adapter as any, agency: params.agency ?? AGENCY, supabase: sb as any,
    tours: params.tours, paymentInstructions: null, languageCurrencies: null, primaryCurrency: "TRY",
    returningUserName: null, seedLanguage: params.seedLanguage,
  } as any);
  const stateOut = (saved() || res.newContext) as ConversationContext;
  return {
    reply: sent.join("\n"),
    stateIn,
    stateOut,
    rpcCalls: sb.calls.filter((c) => c.kind === "rpc").map((c) => ({ name: c.name, args: c.args })),
  };
}

/** Rapor/kanıt için kompakt STATE_IN/OUT dökümü. HARNESS_KANIT=<dosya> verilirse dosyaya da ekler. */
export function dumpTurn(label: string, t: TurnResult): string {
  const s = (c: any) => c ? `stage=${c.stage} step=${c.collectionStep} lang=${c.language} dateId=${c.reservationInfo?.dateId} selectedDate=${c.reservationInfo?.selectedDate} pax=${c.reservationInfo?.paxAdult} pendingPax=${c.pendingPax} listed=${JSON.stringify(c.listedDateIds)}` : "null";
  const text = [`### ${label}`, `STATE_IN : ${s(t.stateIn)}`, `BOT      : ${t.reply.replace(/\n/g, " ⏎ ")}`, `STATE_OUT: ${s(t.stateOut)}`].join("\n");
  const f = Deno.env.get("HARNESS_KANIT");
  if (f) { try { Deno.writeTextFileSync(f, text + "\n\n", { append: true }); } catch { /* kanıt dosyası yazılamadı — test etkilenmez */ } }
  return text;
}

// Sessiz log: handler çok konuşkan; test çıktısını okunur tutmak için
// console.log/info/warn susturulur (HARNESS_VERBOSE=1 ile açılır).
if (!Deno.env.get("HARNESS_VERBOSE")) {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};  // handler soft-hata logları (ör. exchange-rates fetch) — assertion'lar yeterli
}
