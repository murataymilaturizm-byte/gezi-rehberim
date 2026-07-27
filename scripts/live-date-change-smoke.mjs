// LIVE SMOKE — CONFIRMING tarih-değişimi (OLGU-A) GERÇEK entry-point testi.
// Guards §16.2: process-message handler unit-test edilemiyor (76 erken-return +
// adapter/DB/LLM bağımlılığı); date-desync koruması ancak CANLI process-message'dan
// geçen bu smoke ile "kalıcı" sayılır. Deploy sonrası çalıştır:
//   node scripts/live-date-change-smoke.mjs
// Çıkış kodu: 0 = tüm assert geçti, 1 = en az bir FAIL.
//
// KAPSAM (canlı a/b/c + EK-1 O1-FP gate):
//   CORE:  "15 Aralık yap" / "tarihi 15 Aralık yap" (turda OLMAYAN) → REDDEDİLİR,
//          selectedDate=15 YAZILMAZ, "müsait değil"+liste. İki ifade TEK yol.
//   FP-gate: geçerli tarih (init tek-mesaj, ayrı-mesaj, CONFIRMING/phone değişim)
//          → selectedDate + dateId İKİSİ birden (O1-sınıfı: geçerli tarih ASLA reddedilmez).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = readFileSync(join(__root, ".env"), "utf8");
const g = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const URL = g("VITE_SUPABASE_URL"), KEY = g("VITE_SUPABASE_PUBLISHABLE_KEY");
const EP = `${URL}/functions/v1/demo-chat`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function send(sessionId, message, state, language) {
  const body = { message, sessionId, conversationState: state ?? null };
  if (language) body.language = language;
  const r = await fetch(EP, { method: "POST", headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` }, body: JSON.stringify(body) });
  let j; try { j = await r.json(); } catch { j = { response: "(parse fail)" }; }
  return { response: j.response, state: j.conversationState };
}
const rp = () => "05" + Math.floor(1e8 + Math.random() * 8e8);
function S(l) {
  const id = l + "-smoke-" + Math.floor(Math.random() * 1e9); let st = null;
  return { async say(m) { // retry on transient parse-fail / missing state (stateless demo-chat)
    for (let i = 0; i < 3; i++) { const r = await send(id, m, st, l); if (r.response && r.response !== "(parse fail)" && r.state !== undefined) { st = r.state; await sleep(2200); return r; } await sleep(3500); }
    const r = await send(id, m, st, l); st = r.state ?? st; await sleep(2200); return r; }, get st() { return st; } };
}
const ri = (s) => s.st?.reservationInfo || {};
const both = (s) => !!ri(s).selectedDate && !!ri(s).dateId;
const rejected = (r) => /müsait değil|müsait tarih|not available|müsait tarihler/i.test(r.response || "");
async function conf(s) { await s.say("Pamukkale turu"); await s.say("rezervasyon"); await s.say("10 Aralık 2026"); await s.say("2 kişi"); await s.say("Ali Veli"); await s.say(rp()); return s; }

let fail = 0;
const check = (name, cond) => { console.log((cond ? "✓" : "✗ FAIL") + " " + name); if (!cond) fail++; };

console.log("=== LIVE SMOKE: OLGU-A tarih-değişimi (canlı process-message) ===");
// CORE — geçersiz tarih reddedilir, 15 sızmaz (iki ifade birleşir)
{ const s = await conf(S("tr")); const r = await s.say("15 Aralık yap");
  check("CORE-A '15 Aralık yap' reddedilir + liste", rejected(r));
  check("CORE-A selectedDate=15 YAZILMAZ", ri(s).selectedDate !== "2026-12-15"); }
{ const s = await conf(S("tr")); const r = await s.say("tarihi 15 Aralık yap");
  check("CORE-B 'tarihi 15 Aralık yap' reddedilir (birleşme)", rejected(r));
  check("CORE-B selectedDate=15 YAZILMAZ", ri(s).selectedDate !== "2026-12-15"); }
// FP-gate — geçerli tarih ASLA reddedilmez, İKİSİ birden
{ const s = await conf(S("tr")); await s.say("20 Aralık yap");
  check("FP-C CONFIRMING geçerli '20 Aralık yap' → İKİSİ", both(s) && ri(s).selectedDate === "2026-12-20"); }
{ const s = S("tr"); await s.say("Pamukkale turu 20 Aralık 2026 3 kişi");
  check("FP-D tek-mesaj tur+tarih+kişi → İKİSİ", both(s)); }
{ const s = S("tr"); await s.say("Pamukkale turu"); await s.say("rezervasyon"); await s.say("20 Aralık 2026");
  check("FP-E ayrı-mesaj geçerli tarih → İKİSİ", both(s)); }
{ const s = S("tr"); await s.say("Pamukkale turu"); await s.say("rezervasyon"); await s.say("10 Aralık 2026"); await s.say("2 kişi"); await s.say("Ali Veli"); await s.say("20 Aralık yap");
  check("FP-F waiting_for_phone geçerli değişim → İKİSİ+20", both(s) && ri(s).selectedDate === "2026-12-20"); }

console.log(`\n=== SONUÇ: ${fail === 0 ? "TÜM SMOKE GEÇTİ ✓" : fail + " FAIL ✗"} ===`);
process.exit(fail === 0 ? 0 : 1);
