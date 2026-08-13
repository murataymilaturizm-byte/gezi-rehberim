// LIVE SMOKE — P9-C stale-reset dürüst-mesaj + tur-hatırlatma (canlı process-message).
// Demo-chat STATELESS: conversationState istemciden döner → lastUpdated'i geriye
// çekerek stale yolu deterministik tetiklenir. Deploy sonrası çalıştır:
//   node scripts/live-stale-reset-smoke.mjs
// Senaryolar:
//   A) DOLU state (tur+GELECEK tarih) → dürüst sıfırlama + tur+tarih hatırlatması;
//      "evet" → aynı turla waiting_for_date (tarih GÜNCEL müsaitlikten sorulur; restore YOK)
//   B) BOŞ state (BROWSING, rezervasyon yok) → "Tekrar hoş geldiniz" jenerik
//   C) BAYAT-TARİH (selectedDate geçmişte) → hatırlatma YALNIZ tur adıyla, tarih ANILMAZ
//   Ortak: "kaldığınız yerden" + dakika-sayısı hiçbir cevapta YOK; 📞 eki YOK (W8).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = readFileSync(join(__root, ".env"), "utf8");
const g = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const URL = g("VITE_SUPABASE_URL"), KEY = g("VITE_SUPABASE_PUBLISHABLE_KEY");
const EP = `${URL}/functions/v1/demo-chat`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function send(sessionId, message, state) {
  const body = { message, sessionId, conversationState: state ?? null };
  const r = await fetch(EP, { method: "POST", headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` }, body: JSON.stringify(body) });
  let j; try { j = await r.json(); } catch { j = { response: "(parse fail)" }; }
  return { response: j.response, state: j.conversationState };
}
function S() {
  const id = "stale-smoke-" + Math.floor(Math.random() * 1e9); let st = null;
  return { id, async say(m, overrideState) {
    for (let i = 0; i < 3; i++) {
      const r = await send(id, m, overrideState !== undefined ? overrideState : st);
      if (r.response && r.response !== "(parse fail)") { st = r.state ?? st; await sleep(2200); return r; }
      await sleep(3500);
    }
    const r = await send(id, m, overrideState !== undefined ? overrideState : st); st = r.state ?? st; return r;
  }, get st() { return st; }, set st(v) { st = v; } };
}
let fail = 0;
const check = (name, cond, extra) => { console.log((cond ? "✓" : "✗ FAIL") + " " + name + (cond ? "" : ` [${extra ?? ""}]`)); if (!cond) fail++; };
const STALE_AGO = 26 * 60 * 60 * 1000; // 26 saat — her stage-TTL'in üzerinde
const noLies = (r) => !/kaldığınız yerden|dakikadır|zaman aşımına uğradı/i.test(r.response || "");
const noPhone = (r) => !(r.response || "").includes("📞");

console.log("=== LIVE SMOKE: P9-C stale-reset (canlı process-message) ===");

// ── A) DOLU STATE + GELECEK TARİH ──
{
  const s = S();
  await s.say("Pamukkale turu");
  await s.say("rezervasyon");
  await s.say("10 Aralık 2026");            // gelecek tarih seçili → reservationInfo dolu
  check("A0 ön-koşul: state'te tur+tarih dolu", !!(s.st?.reservationInfo?.tourId && s.st?.reservationInfo?.selectedDate), JSON.stringify(s.st?.reservationInfo || {}));
  const staleSt = { ...s.st, lastUpdated: new Date(Date.now() - STALE_AGO).toISOString() };
  const r1 = await s.say("merhaba", staleSt); // stale yolu
  check("A1 dürüst sıfırlama metni", /baştan başlıyoruz/i.test(r1.response || ""), r1.response);
  check("A2 yalan/dakika/📞 yok", noLies(r1) && noPhone(r1), r1.response);
  check("A3 hatırlatma: tur adı VE tarih anılıyor", /Pamukkale/i.test(r1.response || "") && /(10[ .]?Aral|2026|10\.12)/i.test(r1.response || ""), r1.response);
  check("A4 fresh state'te tek-adaylı öneri", Array.isArray(s.st?.pendingTourClarification) && s.st.pendingTourClarification.length === 1, JSON.stringify(s.st?.pendingTourClarification));
  const r2 = await s.say("evet");            // olumlama → tek-aday seçilir
  check("A5 'evet' → aynı tur kilitlendi", s.st?.currentTour?.title?.toLowerCase?.().includes("pamukkale") === true, JSON.stringify(s.st?.currentTour));
  check("A6 tarih RESTORE EDİLMEDİ (waiting_for_date, güncelden sorulur)", s.st?.collectionStep === "waiting_for_date" && !s.st?.reservationInfo?.dateId && !s.st?.reservationInfo?.selectedDate, `step=${s.st?.collectionStep} ri=${JSON.stringify(s.st?.reservationInfo)}`);
  check("A7 cevap tarih soruyor/listeliyor", /tarih|Aralık|Ocak|Kasım|hangi gün/i.test(r2.response || ""), r2.response);
}

// ── B) BOŞ STATE (rezervasyonsuz gezinme) ──
{
  const s = S();
  await s.say("merhaba");
  const staleSt = { ...s.st, lastUpdated: new Date(Date.now() - STALE_AGO).toISOString() };
  const r = await s.say("merhaba", staleSt);
  check("B1 jenerik 'Tekrar hoş geldiniz'", /Tekrar hoş geldiniz/i.test(r.response || ""), r.response);
  check("B2 yalan/dakika/📞 yok", noLies(r) && noPhone(r), r.response);
  check("B3 hatırlatma YOK (tur önerisi yazılmadı)", !s.st?.pendingTourClarification, JSON.stringify(s.st?.pendingTourClarification));
}

// ── C) BAYAT-TARİH (geçmiş selectedDate) ──
{
  const s = S();
  await s.say("Pamukkale turu");
  await s.say("rezervasyon");
  await s.say("10 Aralık 2026");
  const staleSt = { ...s.st, lastUpdated: new Date(Date.now() - STALE_AGO).toISOString() };
  staleSt.reservationInfo = { ...staleSt.reservationInfo, selectedDate: "2024-06-01" }; // geçmiş
  const r = await s.say("selam", staleSt);
  check("C1 dürüst sıfırlama + tur hatırlatması", /baştan başlıyoruz/i.test(r.response || "") && /Pamukkale/i.test(r.response || ""), r.response);
  check("C2 GEÇMİŞ tarih ANILMADI", !/2024|1[ .]?Haziran|01\.06/i.test(r.response || ""), r.response);
  check("C3 yalan/dakika/📞 yok", noLies(r) && noPhone(r), r.response);
  const r2 = await s.say("evet");
  check("C4 'evet' → tur kilitli + tarih güncelden", s.st?.collectionStep === "waiting_for_date" && !s.st?.reservationInfo?.selectedDate, `step=${s.st?.collectionStep}`);
}

console.log(fail === 0 ? "\nSONUÇ: TÜM SENARYOLAR ✓" : `\nSONUÇ: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
