// Dilim-5 — canlı olay (TURZZ-CANLI-ESKI-VERI-TESHIS.md) yeniden üretimi + kök düzeltme kanıtı.
//  A) "kapadokya turlarını görmek istiyorum" / "Kapadokya ne zaman?" → tarih listesi HER ZAMAN
//     buildDateList'ten (LLM'e bırakılmaz).
//  B) LLM'e giden geçmiş: kesim (historyCutoffAt) + 10 mesaj sınırı GERÇEK adapter'larda
//     (WhatsAppAdapter önyüklü geçmiş, DemoChatAdapter DB sorgusu); stale-reset kesim yazar.
import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { runTurn, mkContext, dumpTurn, setNluMode, setAiMode, lastAiParams } from "./harness.ts";
import { toBotTours } from "../../shared/services/bot-tour.ts";
import { WhatsAppAdapter } from "../../whatsapp-webhook/adapter.ts";
import { DemoChatAdapter } from "../../demo-chat/adapter.ts";

const LANGS = ["tr", "en", "ru", "ar"] as const;
const TODAY = "2026-10-08";
const AGENCY: any = { id: "ag-aymila", name: "Aymila Turizm", phone_public: null, show_multi_currency: true, enabled_languages: null, collect_email: false, working_hours: null };

// Canlı olaydaki GÜNCEL DB verisi (2027 tarihleri; 12.07 dolu) — ham getCachedTours şekli.
const D = (id: string, date: string, price: number, quota: number, rem: number) =>
  ({ id, departure_date: date, price_adult: price, price_child: null, quota, remaining_quota: rem });
const RAW_TOURS = [
  { id: "t-kap", title: "Kapadokya Balon Turu", destination: "Kapadokya", type: "DAYTRIP", currency: "TRY",
    dates: [D("k1", "2027-07-10", 1000, 1000, 999), D("k2", "2027-07-11", 1000, 100, 99), D("k3", "2027-07-12", 1000, 1, 0),
            D("k4", "2027-07-29", 1000, 1000, 999), D("k5", "2027-09-15", 1500, 13, 1), D("k6", "2027-12-22", 1500, 100, 96)] },
  { id: "t-pam", title: "Pamukkale Turu", destination: "Pamukkale", type: "N2", currency: "TRY",
    dates: [D("p1", "2027-02-20", 3500, 100, 43), D("p2", "2027-12-10", 3500, 100, 89)] },
];
const tours = (lang: string) => toBotTours(RAW_TOURS, lang, TODAY);

// Canlı olayda LLM'e giden geçmişteki eski mesajlar (08.08.2026) — "kaynak" metinler.
const OLD_PRICE_LIST = "Müsait turlarımız: 🌟\n\n• *Kapadokya Balon Turu* (Kapadokya) — 1.500₺\n• *Pamukkale Turu* (Pamukkale) — 3.500₺";
const OLD_DATE_LIST = "*Antalya Rafting* için müsait tarihler:\n1) 12.12.2026 (Cumartesi) - 800₺ (91 kişilik yer)\n2) 5.12.2026 (Cumartesi) - 800₺ (93 kişilik yer)";
const OLD_MARKERS = ["1.500₺", "12.12.2026"];

// whatsapp_conversations satırları (created_at'li) + bunlar üzerinde çalışan stub supabase.
type Row = { role: string; content: string; created_at: string };
function convRows(): Row[] {
  const rows: Row[] = [];
  const t = (h: number, m: number) => new Date(Date.UTC(2026, 7, 8, h, m)).toISOString();
  rows.push({ role: "user", content: "turlarınız neler", created_at: t(8, 28) });
  rows.push({ role: "assistant", content: OLD_PRICE_LIST, created_at: t(8, 28) });
  rows.push({ role: "user", content: "antalya", created_at: t(8, 28) });
  rows.push({ role: "assistant", content: OLD_DATE_LIST, created_at: t(8, 29) });
  for (let i = 0; i < 20; i++) rows.push({ role: i % 2 ? "assistant" : "user", content: `ara mesaj ${i}`, created_at: t(9, i) });
  return rows; // ASC
}
function convSupabase(rows: Row[]) {
  return {
    from: (_t: string) => {
      const f: any = { since: null as string | null, asc: true, limit: 1e9 };
      const b: any = {
        select: () => b, eq: () => b, neq: () => b,
        gt: (_k: string, v: string) => { f.since = v; return b; },
        order: (_k: string, o: any) => { f.asc = !!o?.ascending; return b; },
        limit: (n: number) => { f.limit = n; return b; },
        then: (res: any, rej: any) => Promise.resolve().then(() => {
          let r = rows.filter((x) => x.role !== "system" && (!f.since || x.created_at > f.since));
          r = [...r].sort((a, b2) => a.created_at.localeCompare(b2.created_at));
          if (!f.asc) r.reverse();
          return { data: r.slice(0, f.limit).map(({ role, content, created_at }) => ({ role, content, created_at })), error: null };
        }).then(res, rej),
      };
      return b;
    },
    rpc: async () => ({ data: null, error: null }),
  };
}
/** Gerçek WhatsAppAdapter — RPC önyüklemesi gibi son 50 non-system mesaj, DESC, created_at YOK. */
function waAdapter(rows: Row[]) {
  const preloaded = [...rows].reverse().slice(0, 50).map(({ role, content }) => ({ role, content }));
  return new WhatsAppAdapter(convSupabase(rows), AGENCY, "905550000303", "pnid", "tok", null, preloaded);
}
const hasOld = (h: Array<{ content: string }>) => h.some((m) => OLD_MARKERS.some((k) => m.content.includes(k)));

setAiMode({ kind: "fixed", reply: "LLM_CEVABI" });

// ── A1: 11:41 yeniden üretimi (stale-reset sonrası GREETING) ─────────────────────────
// Canlı kayıt (08:40:56 UTC = 11:40 TR): "Kapadokya turu istiyorum" (tour_search).
// RU: hâl eki ("в Каппадокию") tur eşleştirmede tutmuyor — ayrı gözlem (rapor §Gözlem);
// burada yalın hâl kullanılır ki test tarih dalını ölçsün.
const WANT_MSG: Record<string, string> = {
  tr: "Kapadokya turu istiyorum", en: "I want the Cappadocia tour",
  ru: "хочу тур Каппадокия", ar: "أريد جولة كابادوكيا",
};
// Canlı kayıt (08:48:58 UTC = 11:48 TR): "kapadokya turlarını görmek istiyorum".
const SEE_MSG: Record<string, string> = {
  tr: "kapadokya turlarını görmek istiyorum", en: "I want to see the Cappadocia tours",
  ru: "хочу посмотреть тур Каппадокия", ar: "أريد أن أرى جولات كابادوكيا",
};
const DOLU: Record<string, string> = { tr: "(DOLU)", en: "(FULL)", ru: "(ПОЛНО)", ar: "(ممتلئ)" };
for (const lang of LANGS) for (const [kind, MSG, intent] of [["istiyorum", WANT_MSG, "tour_search"], ["görmek", SEE_MSG, "browse_tours"]] as const) {
  Deno.test(`A1 [${lang}/${kind}] 11:41 olayı — GREETING + eski geçmiş + "${MSG[lang]}" (${intent}) → buildDateList (2027, DOLU), LLM YOK`, async () => {
    setNluMode({ kind: "fixed", fn: () => ({ intent, language: lang, entities: { tour_name: "Kapadokya Balon Turu", destination: "Kapadokya" } }) });
    lastAiParams.value = null;
    const ad = waAdapter(convRows());
    const ctx = { ...mkContext(tours(lang)[0], {}), stage: "GREETING", collectionStep: undefined, currentTour: null, reservationInfo: {}, language: lang, messageCount: 1 } as any;
    const t = await runTurn({ ctx, message: MSG[lang], tours: tours(lang), agency: AGENCY, loadHistory: (l, s) => ad.loadHistory(l, s) });
    dumpTurn(`A1 [${lang}/${kind}]`, t);
    assertEquals(lastAiParams.value, null, "LLM çağrılmamalı — liste deterministik");
    assert(!t.reply.includes("1.500₺ (79"), "uydurma liste yok");
    assert(t.reply.includes("2027"), "DB tarihleri (2027)");
    assert(t.reply.includes(DOLU[lang]), "dolu tarih etiketi (buildDateList imzası)");
    assert(Array.isArray(t.stateOut.listedDateIds) && t.stateOut.listedDateIds.length === 5, "listedDateIds yazıldı (5 müsait)");
  });
}

// ── A2: 11:49 yeniden üretimi (Pamukkale rezervasyonu COMPLETED → Kapadokya) ─────────────
for (const lang of LANGS) {
  Deno.test(`A2 [${lang}] 11:49 olayı — COMPLETED sonrası "${SEE_MSG[lang]}" (browse_tours) → buildDateList, LLM YOK`, async () => {
    // browse_tours: canlı geçişi (COMPLETED→TOUR_SELECTED Kapadokya) birebir üreten tek niyet
    // (tour_search/faq_general COMPLETED'da kalır, reservation_intent BROWSING'e gider).
    setNluMode({ kind: "fixed", fn: () => ({ intent: "browse_tours", language: lang, entities: { tour_name: "Kapadokya Balon Turu", destination: "Kapadokya" } }) });
    lastAiParams.value = null;
    const ad = waAdapter(convRows());
    const tt = tours(lang);
    const ctx = mkContext(tt[1], { stage: "COMPLETED", collectionStep: undefined, language: lang, reservationConfirmed: true,
      paymentInfoSent: true, viewedTours: ["t-kap", "t-pam"], messageCount: 11, lastUserMessage: "Vize gerekiyormu",
      historyCutoffAt: new Date(Date.UTC(2026, 9, 8, 8, 47)).toISOString(),
      reservationInfo: { tourId: "t-pam", tourTitle: "Pamukkale Turu", dateId: "p2", selectedDate: "2027-12-10", paxAdult: 2, fullName: "Tuba Oğrak", phone: "05551112233" } } as any);
    const t = await runTurn({ ctx, message: SEE_MSG[lang], tours: tt, agency: AGENCY, loadHistory: (l, s) => ad.loadHistory(l, s) });
    dumpTurn(`A2 [${lang}]`, t);
    assertEquals(lastAiParams.value, null, "LLM çağrılmamalı");
    assert(t.reply.includes("2027") && t.reply.includes(DOLU[lang]), "buildDateList çıktısı");
    assertEquals(t.stateOut.currentTour?.id, "t-kap");
  });
}

// ── A3: tarih sorusu deliği — NLU faq_general/general_question dese de liste deterministik ──
const WHEN_MSG: Record<string, string> = { tr: "Kapadokya turu ne zaman?", en: "When is the Cappadocia tour?", ru: "Когда тур Каппадокия?", ar: "متى جولة كابادوكيا؟" };
for (const lang of LANGS) {
  Deno.test(`A3 [${lang}] "${WHEN_MSG[lang]}" (NLU faq_general) → buildDateList, LLM YOK`, async () => {
    setNluMode({ kind: "fixed", fn: () => ({ intent: "faq_general", language: lang, entities: { tour_name: "Kapadokya Balon Turu" } }) });
    lastAiParams.value = null;
    const tt = tours(lang);
    const ctx = mkContext(tt[0], { stage: "TOUR_SELECTED", collectionStep: undefined, language: lang, reservationInfo: { tourId: "t-kap", tourTitle: "Kapadokya Balon Turu" } });
    const t = await runTurn({ ctx, message: WHEN_MSG[lang], tours: tt, agency: AGENCY });
    dumpTurn(`A3 [${lang}]`, t);
    assertEquals(lastAiParams.value, null, "LLM çağrılmamalı");
    assert(t.reply.includes(DOLU[lang]), "buildDateList çıktısı");
  });
}

// ── A4 regresyon: tur hakkında BİLGİ isteği LLM'de kalır (tarih listesi basılmaz) ───────
const INFO_MSG: Record<string, string> = { tr: "Kapadokya turu hakkında bilgi almak istiyorum", en: "I would like information about the Cappadocia tour", ru: "хочу информацию о туре Каппадокия", ar: "أريد معلومات عن جولة كابادوكيا" };
for (const lang of LANGS) {
  Deno.test(`A4 [${lang}] bilgi isteği → LLM (liste yok)`, async () => {
    setNluMode({ kind: "fixed", fn: () => ({ intent: "tour_search", language: lang, entities: { tour_name: "Kapadokya Balon Turu" } }) });
    lastAiParams.value = null;
    const ctx = { ...mkContext(tours(lang)[0], {}), stage: "GREETING", collectionStep: undefined, currentTour: null, reservationInfo: {}, language: lang } as any;
    const t = await runTurn({ ctx, message: INFO_MSG[lang], tours: tours(lang), agency: AGENCY });
    assert(lastAiParams.value !== null, "LLM çağrılmalı");
    assertEquals(t.reply, "LLM_CEVABI");
  });
}

// ── B1: rezervasyon tamamlandıktan sonra yeni soru — LLM geçmişinde kesim öncesi YOK ────
for (const lang of LANGS) {
  Deno.test(`B1 [${lang}] COMPLETED + yeni soru → LLM'e giden geçmişte kesim öncesi mesaj YOK, ≤10`, async () => {
    setNluMode({ kind: "fixed", fn: () => ({ intent: "faq_general", language: lang }) });
    lastAiParams.value = null;
    const rows = convRows();
    const cutoff = new Date(Date.UTC(2026, 7, 8, 9, 15)).toISOString();   // "ara mesaj 15"ten sonrası kalsın
    const ad = waAdapter(rows);
    const tt = tours(lang);
    const ctx = mkContext(tt[1], { stage: "COMPLETED", collectionStep: undefined, language: lang, reservationConfirmed: true, historyCutoffAt: cutoff,
      reservationInfo: { tourId: "t-pam", tourTitle: "Pamukkale Turu", dateId: "p2", selectedDate: "2027-12-10", paxAdult: 2, fullName: "Tuba Oğrak", phone: "05551112233" } } as any);
    await runTurn({ ctx, message: { tr: "Otel dahil mi?", en: "Is the hotel included?", ru: "Отель включён?", ar: "هل الفندق مشمول؟" }[lang], tours: tt, agency: AGENCY, loadHistory: (l, s) => ad.loadHistory(l, s) });
    const h = lastAiParams.value?.history as Array<{ role: string; content: string }>;
    assert(h, "LLM çağrıldı");
    const _kf = Deno.env.get("HARNESS_KANIT");
    if (_kf) Deno.writeTextFileSync(_kf, `### B1 [${lang}] lastAiParams.history (${h.length}): ${JSON.stringify(h.map((m) => `${m.role}:${m.content.slice(0, 24)}`))}\n\n`, { append: true });
    assert(!hasOld(h), `eski (kesim öncesi) mesaj LLM'e gitmemeli — giden: ${JSON.stringify(h.map((m) => m.content.slice(0, 20)))}`);
    assert(h.every((m) => /ara mesaj (1[6-9])/.test(m.content)), "yalnız kesim SONRASI mesajlar");
    assert(h.length <= 10, `≤10 mesaj (giden ${h.length})`);
  });
}

// ── B2: gerçek adapter'lar — sınır ve sıra (kesim yokken de) ─────────────────────────
Deno.test("B2 WhatsAppAdapter kesim yok → son 10 mesaj (ASC), 50 değil", async () => {
  const h = await waAdapter(convRows()).loadHistory(10);
  assertEquals(h.length, 10, `10 mesaj (giden ${h.length})`);
  assertEquals(h[h.length - 1].content, "ara mesaj 19", "en yeni sonda");
  assert(!hasOld(h));
});
Deno.test("B2 DemoChatAdapter kesim yok → SON 10 mesaj (en eski 10 değil)", async () => {
  const ad = new DemoChatAdapter(convSupabase(convRows()), AGENCY.id, "sess-1", null);
  const h = await ad.loadHistory(10);
  assertEquals(h.length, 10);
  assertEquals(h[h.length - 1].content, "ara mesaj 19", "en yeni sonda");
  assert(!hasOld(h), "en eski mesajlar (08.08 listeleri) gelmemeli");
});
Deno.test("B2 WhatsAppAdapter kesim + erken kaydedilmiş güncel mesaj → geçmişte TEKRAR etmez", async () => {
  const rows = convRows();
  rows.push({ role: "user", content: "Otel dahil mi?", created_at: new Date(Date.UTC(2026, 7, 8, 10, 0)).toISOString() });
  const ad = waAdapter(rows.slice(0, -1));   // önyükleme kayıttan ÖNCE alınır (webhook sırası)
  (ad as any).supabase = convSupabase(rows);  // DB'de güncel mesaj artık var
  ad.markUserSaved("Otel dahil mi?");
  const h = await ad.loadHistory(10, new Date(Date.UTC(2026, 7, 8, 9, 15)).toISOString());
  assert(!h.some((m) => m.content === "Otel dahil mi?"), "güncel mesaj geçmişte olmamalı (LLM'e userMessage olarak ayrıca gider)");
});

// ── B3: "Tekrar hoş geldiniz" (stale-reset) kesim zamanı yazar ─────────────────────
Deno.test("B3 stale-reset taze context'e historyCutoffAt yazar", async () => {
  setNluMode({ kind: "fixed", fn: () => ({ intent: "greeting", language: "tr" }) });
  const before = new Date().toISOString();
  const t = await runTurn({ ctx: null, message: "Merhaba", tours: tours("tr"), agency: AGENCY,
    stale: { lastStage: "GREETING", hadReservationInProgress: false, ageMinutes: 90000, lastLanguage: "tr" } });
  assert(t.reply.includes("Tekrar hoş geldiniz"));
  assert(typeof (t.stateOut as any).historyCutoffAt === "string" && (t.stateOut as any).historyCutoffAt >= before, `historyCutoffAt yazılmalı (değer: ${(t.stateOut as any).historyCutoffAt})`);
});
