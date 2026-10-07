// Grup A (denetim raporu TURZZ-FABLE-DENETIM.md §8): "liste indeksi ≠ seçim indeksi".
// S1 = H-pax (A2), S6 = QUOTA_EXCEEDED (A1), S2 = L3 revalidasyon (A3). 4 dilde.
import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { runTurn, mkSupabase, mkTour, mkDate, mkContext, dumpTurn, setNluMode, setAiMode } from "./harness.ts";
import { formatDateForLanguage } from "../../shared/fsm/localization.ts";

setAiMode({ kind: "fail" });

const LANGS: Array<{ lang: string; pax5: string; two: string; yes: string }> = [
  { lang: "tr", pax5: "5 kişi",     two: "2", yes: "evet" },
  { lang: "en", pax5: "5 people",   two: "2", yes: "yes" },
  { lang: "ru", pax5: "5 человек",  two: "2", yes: "да" },
  { lang: "ar", pax5: "5 أشخاص",    two: "2", yes: "نعم" },
];

// NLU sabit-modu: senaryonun test ettiği şey liste/seçim semantiği — NLU'nun dil/pax
// tutarsızlığı izole edilir (pax entity'si açıkça verilir).
function fixedNlu(lang: string) {
  setNluMode({
    kind: "fixed",
    fn: (msg) => {
      if (/^\d+$/.test(msg.trim())) return { intent: "provide_info", language: lang };
      if (/^(evet|yes|да|نعم)$/i.test(msg.trim())) return { intent: "confirm_reservation", language: lang };
      if (/5/.test(msg)) return { intent: "provide_info", language: lang, entities: { people_count: { adults: 5 } }, updates: { paxAdult: 5 } };
      return { intent: "general", language: lang };
    },
  });
}

// Kanıt dökümü: HARNESS_KANIT=<dosya> verilirse dumpTurn dosyaya ekler (rapor için).
const KANIT = { push: (_s: string) => {} };

// ── S1 / A2 — H-pax: dolu tarih seçiliyken "5 kişi" → liste → "2" → listedeki 2. tarih + 5 kişi
for (const L of LANGS) {
  Deno.test(`S1 [${L.lang}] H-pax listesinden '2' → listedeki 2. tarih (d4) + pax=5`, async () => {
    fixedNlu(L.lang);
    // d1 (1 yer) seçili; 5 kişiyi yalnız d2 ve d4 taşır → liste [d2, d4] → "2" = d4
    const tour = mkTour({ dates: [mkDate("d1", "2026-12-10", 1), mkDate("d2", "2026-12-20", 10), mkDate("d3", "2026-12-25", 2), mkDate("d4", "2027-01-05", 10)] });
    const ctx = mkContext(tour, { language: L.lang, collectionStep: "waiting_for_pax", reservationInfo: { tourId: tour.id, tourTitle: tour.title, dateId: "d1", selectedDate: "2026-12-10" } });
    const t1 = await runTurn({ ctx, message: L.pax5, tours: [tour] });
    KANIT.push(dumpTurn(`S1a [${L.lang}] "${L.pax5}"`, t1));
    assert(t1.reply.includes(formatDateForLanguage("2026-12-20", L.lang)), "liste d2'yi lokalize göstermeli");
    assert(t1.reply.includes(formatDateForLanguage("2027-01-05", L.lang)), "liste d4'ü lokalize göstermeli");
    assert(!t1.reply.includes(formatDateForLanguage("2026-12-25", L.lang)), "d3 (2 yer) 5 kişi için listelenmemeli");

    const t2 = await runTurn({ ctx: t1.stateOut, message: L.two, tours: [tour] });
    KANIT.push(dumpTurn(`S1b [${L.lang}] "${L.two}"`, t2));
    assertEquals(t2.stateOut.reservationInfo.dateId, "d4", "listedeki 2. tarih d4 seçilmeli");
    assertEquals(t2.stateOut.reservationInfo.paxAdult, 5, "pax niyeti (5) tarih seçilince uygulanmalı");
    assert(t2.reply.includes(formatDateForLanguage("2027-01-05", L.lang)), "ack yeni tarihi göstermeli");
  });
}

// ── S6 / A1 — QUOTA_EXCEEDED alternatif listesinden '2' → listedeki 2. tarih (d3), global 2. (d2) DEĞİL
for (const L of LANGS) {
  Deno.test(`S6 [${L.lang}] QUOTA_EXCEEDED listesinden '2' → listedeki 2. tarih (d3)`, async () => {
    fixedNlu(L.lang);
    const tour = mkTour({ dates: [mkDate("d1", "2026-12-10", 1), mkDate("d2", "2026-12-20", 10), mkDate("d3", "2026-12-25", 10), mkDate("d4", "2027-01-05", 10)] });
    const sb = mkSupabase({ rpc: { create_reservation_with_quota_check: () => ({ data: { success: false, error: "QUOTA_EXCEEDED" }, error: null }) } });
    const ctx = mkContext(tour, {
      language: L.lang, stage: "CONFIRMING", collectionStep: "ready_for_confirmation",
      reservationInfo: { tourId: tour.id, tourTitle: tour.title, dateId: "d1", selectedDate: "2026-12-10", paxAdult: 2, fullName: "Ali Veli", phone: "05551112233" },
    });
    const t1 = await runTurn({ ctx, message: L.yes, tours: [tour], supabase: sb });
    KANIT.push(dumpTurn(`S6a [${L.lang}] "${L.yes}" → RPC QUOTA_EXCEEDED`, t1));
    assertEquals(t1.rpcCalls.some((c) => c.name === "create_reservation_with_quota_check"), true, "RPC çağrılmalı");
    assertEquals(t1.stateOut.collectionStep, "waiting_for_date");
    assert(!t1.reply.includes(formatDateForLanguage("2026-12-10", L.lang)), "dolu d1 listede olmamalı");

    const t2 = await runTurn({ ctx: t1.stateOut, message: L.two, tours: [tour], supabase: sb });
    KANIT.push(dumpTurn(`S6b [${L.lang}] "${L.two}"`, t2));
    assertEquals(t2.stateOut.reservationInfo.dateId, "d3", "listedeki 2. tarih d3 (25.12) seçilmeli — global 2. olan d2 DEĞİL");
    assert(t2.reply.includes(formatDateForLanguage("2026-12-25", L.lang)), "özet 25.12'yi göstermeli");
  });
}

// ── S2 / A3 — L3 revalidasyon: lokalize tarih + formatPriceSync (ham ISO / " TRY" yok)
for (const L of LANGS) {
  Deno.test(`S2 [${L.lang}] L3 revalidasyon listesi lokalize tarih + para birimi`, async () => {
    fixedNlu(L.lang);
    const tour = mkTour({ dates: [mkDate("d1", "2026-12-10", 10), mkDate("d2", "2026-12-20", 10)] });
    const ctx = mkContext(tour, { language: L.lang, collectionStep: "waiting_for_name", reservationInfo: { tourId: tour.id, tourTitle: tour.title, dateId: "dx-gecmis", selectedDate: "2026-01-01", paxAdult: 2 } });
    const t = await runTurn({ ctx, message: "John Smith", tours: [tour] });
    KANIT.push(dumpTurn(`S2 [${L.lang}] L3`, t));
    assert(!/\d{4}-\d{2}-\d{2}/.test(t.reply), "ham ISO tarih basılmamalı");
    assert(!/ TRY\b/.test(t.reply), "para kodu 'TRY' yerine formatPriceSync (₺) kullanılmalı");
    assert(t.reply.includes(formatDateForLanguage("2026-12-20", L.lang)), "tarih dile göre formatlanmalı");
    assertEquals(t.stateOut.collectionStep, "waiting_for_date");
  });
}
