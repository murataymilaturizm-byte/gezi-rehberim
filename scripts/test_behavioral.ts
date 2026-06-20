// ═══════════════════════════════════════════════════════════════════════
// DAVRANIŞSAL TESTLER — fonksiyonu/regex'i GERÇEK çalıştırır
//
// Bugün canlı production'da forbiddenList runtime'da patladı çünkü mock
// testler fonksiyonu çağırmıyordu, sadece substring kontrol ediyordu.
// Bu dosya: import ederek, gerçek input'la, gerçek output ile doğrular.
//
// Kapsam:
//   1. info-extractor extractAllInfo — pax sızıntı fix (Blok 6 strict regex)
//   2. constants/date-detection — DATE_QUERY_RE 7 dil match / no-match
//
// Çalıştırma: deno run --allow-read scripts/test_behavioral.ts
// CI/Katman 1 entegrasyonu: test_e2e_reservation_flows.mjs faz 0.5'te
// runDenoBehavioral() ile spawn edilir.
// ═══════════════════════════════════════════════════════════════════════

import { extractAllInfo } from "../supabase/functions/shared/services/info-extractor.ts";
import { DATE_QUERY_RE, DATE_INTENTS } from "../supabase/functions/shared/constants/date-detection.ts";

let pass = 0;
let fail = 0;

function assert(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`✓ ${name}`);
  } else {
    fail++;
    console.log(`✗ ${name}${detail ? `  — ${detail}` : ""}`);
  }
}

// ─── Helper: minimal context + nluResult ──────────────────────────────
function mkContext(overrides: Record<string, unknown> = {}) {
  return {
    stage: "COLLECTING_INFO",
    collectionStep: "waiting_for_pax",
    language: "tr",
    reservationInfo: {
      tourId: "T1",
      tourTitle: "Test Tour",
      dateId: "D1",
      selectedDate: "2026-12-12",
    },
    currentTour: {
      id: "T1",
      title: "Test Tour",
      dates: [{ id: "D1", departure_date: "2026-12-12" }],
    },
    collectEmail: false,
    messageCount: 0,
    viewedTours: [],
    lastUpdated: "2026-06-19T00:00:00.000Z",
    ...overrides,
  };
}

function mkNlu(overrides: Record<string, unknown> = {}) {
  return {
    intent: "provide_info",
    language: "tr",
    entities: {},
    updates: {},
    ...overrides,
  };
}

// ─── 1) PAX SIZINTI FIX (Yan #1) ──────────────────────────────────────
console.log("\n── PAX SIZINTI (info-extractor Blok 6 strict regex) ──");

// "5 temmuz" — tarih kelimesi, pax DEĞİL → reddedilmeli
{
  // deno-lint-ignore no-explicit-any
  const out = extractAllInfo({
    message: "5 temmuz",
    nluResult: mkNlu({ entities: { dates: ["5 temmuz"] } }) as any,
    fsmIntent: "provide_info",
    context: mkContext() as any,
    tours: [],
  });
  assert(
    `"5 temmuz" + waiting_for_pax → paxAdult undefined (canlı bug regresyonu)`,
    out.paxAdult === undefined || out.paxAdult === null,
    `got=${JSON.stringify(out.paxAdult)}`,
  );
}

// "11 aralık" — aynı tuzak
{
  // deno-lint-ignore no-explicit-any
  const out = extractAllInfo({
    message: "11 aralık",
    nluResult: mkNlu({ entities: { dates: ["11 aralık"] } }) as any,
    fsmIntent: "provide_info",
    context: mkContext() as any,
    tours: [],
  });
  assert(
    `"11 aralık" + waiting_for_pax → paxAdult undefined`,
    out.paxAdult === undefined || out.paxAdult === null,
    `got=${JSON.stringify(out.paxAdult)}`,
  );
}

// Düz "3" — pax=3 olmalı (regresyon yok)
{
  // deno-lint-ignore no-explicit-any
  const out = extractAllInfo({
    message: "3",
    nluResult: mkNlu() as any,
    fsmIntent: "provide_info",
    context: mkContext() as any,
    tours: [],
  });
  assert(`"3" + waiting_for_pax → paxAdult=3`, out.paxAdult === 3, `got=${JSON.stringify(out.paxAdult)}`);
}

// "3 kişi" — Blok 5 yakalar, pax=3 (regresyon yok)
{
  // deno-lint-ignore no-explicit-any
  const out = extractAllInfo({
    message: "3 kişi",
    nluResult: mkNlu() as any,
    fsmIntent: "provide_info",
    context: mkContext() as any,
    tours: [],
  });
  assert(`"3 kişi" + waiting_for_pax → paxAdult=3 (Blok 5)`, out.paxAdult === 3, `got=${JSON.stringify(out.paxAdult)}`);
}

// "0" — geçersiz pax, kabul edilmemeli (mevcut davranış)
{
  // deno-lint-ignore no-explicit-any
  const out = extractAllInfo({
    message: "0",
    nluResult: mkNlu() as any,
    fsmIntent: "provide_info",
    context: mkContext() as any,
    tours: [],
  });
  assert(`"0" + waiting_for_pax → paxAdult NOT set`, !out.paxAdult, `got=${JSON.stringify(out.paxAdult)}`);
}

// "51" — üst sınır aşımı, kabul edilmemeli
{
  // deno-lint-ignore no-explicit-any
  const out = extractAllInfo({
    message: "51",
    nluResult: mkNlu() as any,
    fsmIntent: "provide_info",
    context: mkContext() as any,
    tours: [],
  });
  assert(`"51" + waiting_for_pax → paxAdult NOT set (>50)`, !out.paxAdult, `got=${JSON.stringify(out.paxAdult)}`);
}

// ─── 2) DATE_QUERY_RE (7 dil) ─────────────────────────────────────────
console.log("\n── DATE_QUERY_RE (process-message :11 A3 kapanı) ──");

const shouldMatch: Array<[string, string]> = [
  ["tr", "ne zaman var?"],
  ["tr", "tarihler nedir"],
  ["tr", "hangi gün müsait"],
  ["en", "when is it available"],
  ["en", "what dates"],
  ["de", "wann ist verfügbar"],
  ["de", "welches datum"],
  ["fr", "quand"],
  ["es", "fecha disponible"],
  ["ru", "когда"],
  ["ar", "متى"],
];
for (const [lang, msg] of shouldMatch) {
  assert(`DATE_QUERY ${lang} "${msg}" → MATCH`, DATE_QUERY_RE.test(msg), "false-negative");
}

const shouldNotMatch: string[] = [
  "merhaba",
  "rezervasyon yapmak istiyorum",
  "Ali Veli",
  "05551234567",
  "3 kişi",
  "evet",
  "tamam",
];
for (const msg of shouldNotMatch) {
  assert(`DATE_QUERY no-match "${msg}"`, !DATE_QUERY_RE.test(msg), "false-positive (overshadow)");
}

// DATE_INTENTS sanity
assert(`DATE_INTENTS contains faq_general`, DATE_INTENTS.includes("faq_general"));
assert(`DATE_INTENTS contains tour_search`, DATE_INTENTS.includes("tour_search"));
assert(`DATE_INTENTS NOT contains provide_info (kullanıcı veri verirken yanlış yakalama)`, !DATE_INTENTS.includes("provide_info"));

// ═══════════════════════════════════════════════════════════════════════
// 3) TOUR-MATCHING (BUG 1 + BUG 2 kök çözümü, 2026-06-20)
//
// findMatchingTours yeniden sıralandı: mesaj kelimeleri KANITSAL kaynak,
// NLU çıktıları VALIDATED kullanılır (uydurma engellendi). UNKNOWN_TOUR
// sinyali DB'de gerçekten yok turlar için B dalını tetikler.
// ═══════════════════════════════════════════════════════════════════════
console.log("\n── TOUR-MATCHING (Bug 1/2 kök çözümü) ──");

import { findMatchingTours } from "../supabase/functions/shared/services/tour-matching.ts";
import { isMeaningfulTourKeyword, TOUR_KEYWORD_STOPWORDS } from "../supabase/functions/shared/constants/tour-matching.ts";
import { formatTourDetails } from "../supabase/functions/shared/fsm/prompts/helpers.ts";

const tours = [
  { id: "T_ANTALYA",   title: "Antalya Rafting",        destination: "Antalya",          dates: [{ id: "D1", departure_date: "2026-12-15", price_adult: 850 }] },
  { id: "T_EFES",       title: "Efes Antik Kent Turu",  destination: "İzmir/Selçuk",     dates: [{ id: "D1", departure_date: "2026-12-15", price_adult: 700 }] },
  { id: "T_EGE",        title: "Ege Turu",              destination: "İzmir-Çeşme-Alaçatı", dates: [{ id: "D1", departure_date: "2026-12-15", price_adult: 1200 }] },
  { id: "T_KAPADOKYA",  title: "Kapadokya Balon Turu",  destination: "Kapadokya",        dates: [{ id: "D1", departure_date: "2026-12-15", price_adult: 2500 }] },
  { id: "T_KAPKULTUR",  title: "Kapadokya Kültür Turu", destination: "Kapadokya",        dates: [{ id: "D1", departure_date: "2026-12-15", price_adult: 1800 }] },
  { id: "T_PAMUKKALE",  title: "Pamukkale Turu",        destination: "Pamukkale",        dates: [{ id: "D1", departure_date: "2026-12-15", price_adult: 1500 }] },
];

// Test 1 — BUG 1 ana kanıt: NLU "Kapadokya" uydurdu, mesaj "efes" kazanır
{
  const r = findMatchingTours("efes turu ne zaman",
    { tour_name: "", destination: "Kapadokya" }, tours, "date_selection", "tour_search");
  assert(`BUG 1: 'efes turu ne zaman' + NLU dest='Kapadokya' (UYDURMA) → Efes (mesaj kazandı)`,
    r.selectedTour?.id === "T_EFES",
    `got=${JSON.stringify({ id: r.selectedTour?.id, mult: r.multipleMatches.length, unk: r.unknownTourQuery })}`);
}

// Test 2 — BUG 2 ana kanıt: "ege turu" tutarsızlığı çözüldü (stopword filtre)
{
  const r = findMatchingTours("ege turu",
    { tour_name: "", destination: "" }, tours, "tour_selection", "tour_search");
  assert(`BUG 2: 'ege turu' → Ege (stopword 'turu' filtre)`,
    r.selectedTour?.id === "T_EGE",
    `got=${JSON.stringify({ id: r.selectedTour?.id })}`);
}

// Test 3 — BUG 2 varyant: uzun mesaj
{
  const r = findMatchingTours("ege turu nedir, ne zaman",
    { tour_name: "", destination: "" }, tours, "tour_selection", "tour_search");
  assert(`BUG 2: 'ege turu nedir, ne zaman' → Ege (uzun mesaj, stopword filtre)`,
    r.selectedTour?.id === "T_EGE",
    `got=${JSON.stringify({ id: r.selectedTour?.id })}`);
}

// Test 4 — BUG 2 tek kelime: "ege" 3 harf
{
  const r = findMatchingTours("ege",
    { tour_name: "", destination: "" }, tours, "tour_selection", "tour_search");
  assert(`'ege' tek kelime → Ege (3 harf kabul)`,
    r.selectedTour?.id === "T_EGE",
    `got=${JSON.stringify({ id: r.selectedTour?.id })}`);
}

// Test 5 — Yabancı dil: translation map validation
{
  const r = findMatchingTours("ephesus tour when",
    { tour_name: "Efes", destination: "" }, tours, "date_selection", "tour_search");
  assert(`'ephesus tour when' + NLU tour_name='Efes' → Efes (translation validated)`,
    r.selectedTour?.id === "T_EFES",
    `got=${JSON.stringify({ id: r.selectedTour?.id })}`);
}

// Test 6 — Regresyon: bilinen şehir Antalya
{
  const r = findMatchingTours("antalya ne zaman",
    { tour_name: "", destination: "Antalya" }, tours, "date_selection", "tour_search");
  assert(`REGRESYON: 'antalya ne zaman' + NLU dest='Antalya' → Antalya`,
    r.selectedTour?.id === "T_ANTALYA",
    `got=${JSON.stringify({ id: r.selectedTour?.id })}`);
}

// Test 7 — Çoklu Kapadokya: multipleMatches
{
  const r = findMatchingTours("kapadokya turu",
    { tour_name: "", destination: "Kapadokya" }, tours, "tour_selection", "tour_search");
  assert(`'kapadokya turu' → multipleMatches=2 (Balon + Kültür)`,
    r.multipleMatches.length === 2 && r.selectedTour === null,
    `got=${JSON.stringify({ id: r.selectedTour?.id, mult: r.multipleMatches.length })}`);
}

// Test 8 — UNKNOWN_TOUR sinyali: gerçekten yok
{
  const r = findMatchingTours("xyzbatak turu ne zaman",
    { tour_name: "", destination: "" }, tours, "tour_selection", "tour_search");
  assert(`'xyzbatak turu' (DB'de yok) + tur_intent → UNKNOWN_TOUR='xyzbatak'`,
    r.selectedTour === null && r.multipleMatches.length === 0 && r.unknownTourQuery === "xyzbatak",
    `got=${JSON.stringify({ id: r.selectedTour?.id, unk: r.unknownTourQuery })}`);
}

// Test 9 — B-5 fix korunur: isim adımında match yok
{
  const r = findMatchingTours("Murat Aymilatur",
    { tour_name: "", destination: "" }, tours, "name", "provide_info");
  assert(`expectedInput='name' → null (B-5 fix korunur)`,
    r.selectedTour === null && r.unknownTourQuery === null);
}

// Test 10 — Stopword sadece: crash güvenli
{
  const r = findMatchingTours("turu",
    { tour_name: "", destination: "" }, tours, "tour_selection", "tour_search");
  assert(`'turu' tek başına (stopword) → null + UNKNOWN_TOUR=null (crash güvenli, false-positive yok)`,
    r.selectedTour === null && r.multipleMatches.length === 0 && r.unknownTourQuery === null,
    `got=${JSON.stringify({ unk: r.unknownTourQuery })}`);
}

// Test 10b — Sadece kısa kelime (3 harf altı)
{
  const r = findMatchingTours("?? ne",
    { tour_name: "", destination: "" }, tours, "tour_selection", "tour_search");
  assert(`'?? ne' (anlamlı kelime yok) → null + UNKNOWN_TOUR=null`,
    r.selectedTour === null && r.unknownTourQuery === null);
}

// Test 11 — NLU validation: bilinen şehir doğrulanır (mesajda var)
{
  const r = findMatchingTours("antalya nasıl bir tur",
    { tour_name: "", destination: "Antalya" }, tours, "tour_selection", "tour_search");
  assert(`'antalya nasıl bir tur' + NLU dest='Antalya' → Antalya (mesaj kanıtsal zaten bulur)`,
    r.selectedTour?.id === "T_ANTALYA");
}

// Test 12 — BUG 4: formatTourDetails saat+kalkış+süre içermeli
{
  const tour = {
    title: "Pamukkale Turu", destination: "Pamukkale",
    toplanma_saati: "07:30:00", hareket_noktasi: "Denizli",
    tur_sure: "2 gün 1 gece",
    dates: [{ price_adult: 1500, departure_date: "2026-12-15" }],
  };
  const r = formatTourDetails(tour, "tr", "standart");
  assert(`BUG 4: formatTourDetails saat '07:30' içermeli (uydurma kapısı kapatıldı)`,
    r.includes("07:30") && !r.includes("07:30:00"),
    `got=${r.slice(0, 200)}`);
  assert(`BUG 4: formatTourDetails 'Denizli' kalkış noktası içermeli`, r.includes("Denizli"));
  assert(`BUG 4: formatTourDetails '2 gün 1 gece' süresi içermeli`, r.includes("2 gün 1 gece"));
}

// Sanity: stopword listesi
assert(`Stopword 'turu' listede`, TOUR_KEYWORD_STOPWORDS.has("turu"));
assert(`Stopword 'tour' listede`, TOUR_KEYWORD_STOPWORDS.has("tour"));
assert(`Stopword 'ausflug' listede (DE)`, TOUR_KEYWORD_STOPWORDS.has("ausflug"));
assert(`isMeaningfulTourKeyword('ege') = true (3 harf, stopword değil)`, isMeaningfulTourKeyword("ege"));
assert(`isMeaningfulTourKeyword('turu') = false (stopword)`, !isMeaningfulTourKeyword("turu"));
assert(`isMeaningfulTourKeyword('ne') = false (2 harf)`, !isMeaningfulTourKeyword("ne"));

// ─── SONUÇ ──────────────────────────────────────────────────────────────
console.log(`\n═══════════════════════════════════════════════════════════════════════`);
console.log(`DAVRANIŞSAL TESTLER: ${pass}/${pass + fail} geçti`);
console.log(`═══════════════════════════════════════════════════════════════════════`);
Deno.exit(fail === 0 ? 0 : 1);
