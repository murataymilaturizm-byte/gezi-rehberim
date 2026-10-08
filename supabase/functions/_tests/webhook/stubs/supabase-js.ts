// WEBHOOK HARNESS STUB — `https://esm.sh/@supabase/supabase-js@2` yerine.
// Postgrest builder ASLINA UYGUN: TEMBEL (istek yalnız `then` çağrılınca "çalışır")
// ve `catch` METODU YOK (postgrest-js 2.117.2 runtime'ı: yalnız then — doğrulandı).
// Böylece `.insert(...).catch(...)` gibi gerçek hatalar harness'te de aynen patlar.
export interface StubDb {
  inserts: Array<{ table: string; payload: any }>;
  updates: Array<{ table: string; payload: any }>;
  rpcCalls: Array<{ name: string; args: any }>;
  /** Dilim-8: agencies.monthly_message_count'un DB'deki değeri (update yazar, RPC artırır). */
  agencyCount: number;
  conf: {
    rpc?: Record<string, (args: any) => { data: any; error: any }>;
    /** table → select sonucu (filters = eq/like çağrıları) */
    select?: (table: string, filters: Record<string, any>) => { data: any; error: any } | undefined;
    /** table → insert sonucu; verilmezse başarı */
    insertResult?: (table: string, payload: any) => { data: any; error: any } | undefined;
  };
}
export const db: StubDb = { inserts: [], updates: [], rpcCalls: [], agencyCount: 0, conf: {} };
export function resetDb(conf: StubDb["conf"] = {}) {
  db.inserts = []; db.updates = []; db.rpcCalls = []; db.agencyCount = 0; db.conf = conf;
}

function builder(table: string) {
  let op: "select" | "insert" | "update" | "delete" = "select";
  let payload: any = null;
  const filters: Record<string, any> = {};
  const exec = () => {
    if (op === "insert") {
      const r = db.conf.insertResult?.(table, payload);
      if (!r?.error) db.inserts.push({ table, payload });
      return r ?? { data: null, error: null };
    }
    if (op === "update") {
      db.updates.push({ table, payload });
      // Gerçek DB gibi: SET monthly_message_count = <istemcinin hesapladığı değer> (üzerine yazar)
      if (table === "agencies" && typeof payload?.monthly_message_count === "number") db.agencyCount = payload.monthly_message_count;
      return { data: null, error: null };
    }
    return db.conf.select?.(table, filters) ?? { data: null, error: null };
  };
  const b: any = {
    select: () => b,
    insert: (p: any) => { op = "insert"; payload = p; return b; },
    update: (p: any) => { op = "update"; payload = p; return b; },
    upsert: (p: any) => { op = "insert"; payload = p; return b; },
    delete: () => { op = "delete"; return b; },
    eq: (k: string, v: any) => { filters[k] = v; return b; },
    neq: () => b, in: () => b, gte: () => b, lte: () => b, order: () => b, limit: () => b,
    like: (k: string, v: any) => { filters[`like:${k}`] = v; return b; },
    maybeSingle: async () => exec(),
    single: async () => exec(),
    // YALNIZ then — catch YOK (aslına uygun)
    then: (res: any, rej: any) => Promise.resolve().then(exec).then(res, rej),
  };
  return b;
}

export function createClient(_url?: string, _key?: string) {
  return {
    from: (table: string) => builder(table),
    rpc: async (name: string, args: any) => {
      db.rpcCalls.push({ name, args });
      return db.conf.rpc?.[name]?.(args) ?? { data: null, error: null };
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  };
}
