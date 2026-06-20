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

// ═══════════════════════════════════════════════════════════════════════
// 4) STOPWORD GENİŞLETME (2026-06-20 rezervasyon ailesi)
// Canlı log execution 31026a6b'deki UNKNOWN_TOUR: rezervasyon false-positive fix.
// ═══════════════════════════════════════════════════════════════════════
console.log("\n── STOPWORD GENİŞLETME (rezervasyon + onay ailesi) ──");

assert(`Stopword 'rezervasyon' eklendi`, TOUR_KEYWORD_STOPWORDS.has("rezervasyon"));
assert(`Stopword 'reservation' eklendi (EN)`, TOUR_KEYWORD_STOPWORDS.has("reservation"));
assert(`Stopword 'booking' eklendi (EN)`, TOUR_KEYWORD_STOPWORDS.has("booking"));
assert(`Stopword 'buchung' eklendi (DE)`, TOUR_KEYWORD_STOPWORDS.has("buchung"));
assert(`Stopword 'réservation' eklendi (FR)`, TOUR_KEYWORD_STOPWORDS.has("réservation"));
assert(`Stopword 'reserva' eklendi (ES)`, TOUR_KEYWORD_STOPWORDS.has("reserva"));
assert(`Stopword 'бронирование' eklendi (RU)`, TOUR_KEYWORD_STOPWORDS.has("бронирование"));
assert(`Stopword 'حجز' eklendi (AR)`, TOUR_KEYWORD_STOPWORDS.has("حجز"));

// Onay kelimeleri
assert(`Stopword 'evet' eklendi`, TOUR_KEYWORD_STOPWORDS.has("evet"));
assert(`Stopword 'tamam' eklendi`, TOUR_KEYWORD_STOPWORDS.has("tamam"));
assert(`Stopword 'yes' eklendi (EN)`, TOUR_KEYWORD_STOPWORDS.has("yes"));
assert(`Stopword 'ja' eklendi (DE)`, TOUR_KEYWORD_STOPWORDS.has("ja"));
assert(`Stopword 'да' eklendi (RU)`, TOUR_KEYWORD_STOPWORDS.has("да"));

// isMeaningfulTourKeyword integration
assert(`isMeaningfulTourKeyword('rezervasyon') = false`, !isMeaningfulTourKeyword("rezervasyon"));
assert(`isMeaningfulTourKeyword('evet') = false`, !isMeaningfulTourKeyword("evet"));

// findMatchingTours integration — "rezervasyon" tek başına UNKNOWN_TOUR atmaz
{
  const r = findMatchingTours("rezervasyon",
    { tour_name: "", destination: "" }, tours, "tour_selection", "reservation_intent");
  assert(
    `'rezervasyon' tek başına → UNKNOWN_TOUR=null (canlı bug 31026a6b kapanışı)`,
    r.unknownTourQuery === null && r.selectedTour === null && r.multipleMatches.length === 0,
    `got=${JSON.stringify({ unk: r.unknownTourQuery, sel: r.selectedTour?.id, mult: r.multipleMatches.length })}`,
  );
}
{
  const r = findMatchingTours("evet",
    { tour_name: "", destination: "" }, tours, "tour_selection", "reservation_intent");
  assert(`'evet' tek başına → UNKNOWN_TOUR=null`,
    r.unknownTourQuery === null);
}

// ═══════════════════════════════════════════════════════════════════════
// 5) TOUR-CHANGE HELPER (2026-06-20 Bug 1 v2 — state geçişi tam çözümü)
//
// Tour-matching kanıtsal selectedTour'u state'e DETERMINISTIK uygular.
// Özge fix korunur: pax/isim/phone KORUNUR, sadece dateId/selectedDate temizlenir.
// stage burada DEĞİŞMEZ (caller ayarlar).
// ═══════════════════════════════════════════════════════════════════════
console.log("\n── TOUR-CHANGE HELPER (Bug 1 v2 — state geçişi) ──");

import { produceTourChangeContext, shouldApplyEarlyTourChange }
  from "../supabase/functions/shared/services/tour-change.ts";

function mkCtxWithFullData(stage: any): any {
  return {
    stage,
    collectionStep: stage === "CONFIRMING" ? "ready_for_confirmation" : "waiting_for_pax",
    currentTour: { id: "T_KAPADOKYA", title: "Kapadokya Balon Turu" },
    reservationInfo: {
      tourId: "T_KAPADOKYA",
      tourTitle: "Kapadokya Balon Turu",
      dateId: "D_KAP1",
      selectedDate: "2026-12-15",
      paxAdult: 2,
      fullName: "Murat Aymilatur",
      phone: "905551234545",
      email: "murat@example.com",
    },
    reservationConfirmed: stage === "CONFIRMING",
    paymentInfoSent: false,
    viewedTours: ["T_KAPADOKYA"],
    language: "tr",
    tone: "standart",
    messageCount: 5,
    lastUserMessage: "",
    sessionStarted: "2026-06-20T00:00:00.000Z",
    lastUpdated: "2026-06-20T00:00:00.000Z",
    isNewReservation: false,
  };
}

const efes = { id: "T_EFES", title: "Efes Antik Kent Turu" };

// ─── shouldApplyEarlyTourChange gate ───────────────────────────────────
{
  const ctx = mkCtxWithFullData("COLLECTING_INFO");
  assert(`gate: COLLECTING_INFO + farklı tur → APPLY`,
    shouldApplyEarlyTourChange(ctx, efes) === true);
}
{
  const ctx = mkCtxWithFullData("CONFIRMING");
  assert(`gate: CONFIRMING + farklı tur → APPLY (BUG 1 v2 CONFIRMING'i de kapsar)`,
    shouldApplyEarlyTourChange(ctx, efes) === true);
}
{
  const ctx = mkCtxWithFullData("COLLECTING_INFO");
  assert(`gate: aynı tur (id eşit) → NO-OP`,
    shouldApplyEarlyTourChange(ctx, { id: "T_KAPADOKYA", title: "Kapadokya" }) === false);
}
{
  const ctx = mkCtxWithFullData("COLLECTING_INFO");
  assert(`gate: selectedTour=null → NO-OP`,
    shouldApplyEarlyTourChange(ctx, null) === false);
}
{
  const ctx = mkCtxWithFullData("BROWSING");
  assert(`gate: BROWSING → NO-OP (mevcut transitions zaten çalışır)`,
    shouldApplyEarlyTourChange(ctx, efes) === false);
}
{
  const ctx = mkCtxWithFullData("TOUR_SELECTED");
  assert(`gate: TOUR_SELECTED → NO-OP`,
    shouldApplyEarlyTourChange(ctx, efes) === false);
}
{
  const ctx = mkCtxWithFullData("COMPLETED");
  assert(`gate: COMPLETED → NO-OP (after-sales bozulmasın)`,
    shouldApplyEarlyTourChange(ctx, efes) === false);
}

// ─── produceTourChangeContext transformasyonu (COLLECTING_INFO baseline) ─
{
  const ctx = mkCtxWithFullData("COLLECTING_INFO");
  const newCtx = produceTourChangeContext(ctx, efes);

  // Tur değişti
  assert(`currentTour Efes'e güncellendi`, newCtx.currentTour.id === "T_EFES");
  assert(`currentTour title Efes`, newCtx.currentTour.title === "Efes Antik Kent Turu");
  // reservationInfo'daki tur referansları güncellendi
  assert(`reservationInfo.tourId Efes`, newCtx.reservationInfo.tourId === "T_EFES");
  assert(`reservationInfo.tourTitle Efes`, newCtx.reservationInfo.tourTitle === "Efes Antik Kent Turu");

  // KRİTİK: eski tarih TEMİZLENDİ (yeni tur için geçersiz)
  assert(`dateId undefined (eski tur tarihi)`, newCtx.reservationInfo.dateId === undefined);
  assert(`selectedDate undefined`, newCtx.reservationInfo.selectedDate === undefined);

  // KRİTİK: kişi-bağımlı alanlar KORUNDU (Özge fix mantığı)
  assert(`paxAdult KORUNDU (Özge fix)`, newCtx.reservationInfo.paxAdult === 2);
  assert(`fullName KORUNDU`, newCtx.reservationInfo.fullName === "Murat Aymilatur");
  assert(`phone KORUNDU`, newCtx.reservationInfo.phone === "905551234545");
  assert(`email KORUNDU`, newCtx.reservationInfo.email === "murat@example.com");

  // collectionStep deterministik bypass tetikleyici
  assert(`collectionStep waiting_for_date`, newCtx.collectionStep === "waiting_for_date");

  // viewedTours genişledi (history)
  assert(`viewedTours Efes içeriyor`, newCtx.viewedTours.includes("T_EFES"));
  assert(`viewedTours Kapadokya hâlâ var (history)`, newCtx.viewedTours.includes("T_KAPADOKYA"));

  // stage değişmedi (helper'ın sorumluluğu DEĞİL — caller ayarlar)
  assert(`stage caller'a bırakılır (helper değiştirmez)`, newCtx.stage === "COLLECTING_INFO");
}

// ─── CONFIRMING'den tur değişimi — temizlik teyidi ──────────────────────
// Canlı log execution 801fed7d benzeri senaryo: CONFIRMING'de tur değişince
// stage/collectionStep/reservationConfirmed tutarlı olmalı.
{
  const ctx = mkCtxWithFullData("CONFIRMING");
  ctx.reservationConfirmed = false; // henüz onaylanmamış
  const newCtx = produceTourChangeContext(ctx, efes);

  assert(`CONFIRMING tur değişimi: collectionStep 'ready_for_confirmation' DEĞİL artık`,
    newCtx.collectionStep === "waiting_for_date");
  // produceTourChangeContext stage'i değiştirmez — bu caller sorumluluğu
  // process-message erken müdahale: stage→COLLECTING_INFO + reservationConfirmed→false ekler
}

// ─── findMatchingTours + helper akış kanıtı ─────────────────────────────
// BUG 1 v2 senaryo simulasyonu: kullanıcı "efes turu ne zaman" yazınca
// tour-matching Efes bulur → erken müdahale shouldApply true → context güncellenir.
{
  const ctxBefore = mkCtxWithFullData("COLLECTING_INFO");
  const matchResult = findMatchingTours("efes turu ne zaman",
    { tour_name: "", destination: "Kapadokya" }, tours, "date_selection", "tour_search");

  assert(`BUG 1 v2 akış: tour-matching Efes buldu`,
    matchResult.selectedTour?.id === "T_EFES");
  assert(`BUG 1 v2 akış: shouldApplyEarlyTourChange true`,
    shouldApplyEarlyTourChange(ctxBefore, matchResult.selectedTour) === true);

  const ctxAfter = produceTourChangeContext(ctxBefore, matchResult.selectedTour);
  assert(`BUG 1 v2 akış: currentTour Efes'e geçti`,
    ctxAfter.currentTour.id === "T_EFES");
  assert(`BUG 1 v2 akış: eski Kapadokya dateId temizlendi`,
    ctxAfter.reservationInfo.dateId === undefined);
  assert(`BUG 1 v2 akış: pax/isim/phone KORUNDU`,
    ctxAfter.reservationInfo.paxAdult === 2 &&
    ctxAfter.reservationInfo.fullName === "Murat Aymilatur");
}

// ═══════════════════════════════════════════════════════════════════════
// 6) B-5 FIX GEVŞETMESİ (2026-06-20 Bug 1 v2 waiting_for_name varyantı)
//
// Canlı bug execution 0a643c9d: waiting_for_name adımında "Efes Antik Turu
// nedir?" sorulunca tour-matching tamamen kapalıydı (B-5 fix Özge için).
// → erken müdahale tetiklenmedi → currentTour Kapadokya'da kaldı.
//
// Yeni mantık: İki katmanlı gate — NLU tur sinyali + tur intent.
// Özge bug korunur: NLU çift hata yapmadığı sürece B-5 fix kapalı kalır.
// ═══════════════════════════════════════════════════════════════════════
console.log("\n── B-5 FIX GEVŞETMESİ (Bug 1 v2 waiting_for_name varyantı) ──");

// ─── Özge bug korunur ───────────────────────────────────────────────────
{
  const r = findMatchingTours("Özge Yılmazer",
    { tour_name: "", destination: "" }, tours, "name", "provide_info");
  assert(`Özge bug korunur: isim adımı + provide_info + NLU sinyal yok → null`,
    r.selectedTour === null && r.unknownTourQuery === null);
}

// Edge: NLU hata ile tour_name="Yılmazer" üretirse — intent=provide_info kaldığı için kapalı
{
  const r = findMatchingTours("Özge Yılmazer",
    { tour_name: "Yılmazer", destination: "" }, tours, "name", "provide_info");
  assert(`Özge edge: NLU tour_name hatası AMA intent=provide_info → 2. katman KAPATIR`,
    r.selectedTour === null);
}

// Edge: telefon adımında provide_info ile gelse de kapalı
{
  const r = findMatchingTours("0555 123 45 67",
    { tour_name: "", destination: "" }, tours, "phone", "provide_info");
  assert(`Telefon adımı + provide_info + NLU sinyal yok → null (B-5 korunur)`,
    r.selectedTour === null);
}

// ─── BUG 1 v2 isim adımı varyantı: net tur sorusu → tour-matching AÇILIR ──
{
  const r = findMatchingTours("Efes Antik Turu nedir?",
    { tour_name: "Efes Antik Turu", destination: "Efes" },
    tours, "name", "faq_general");
  assert(`BUG 1 v2: waiting_for_name + 'Efes turu nedir' + faq_general → Efes (B-5 gevşedi)`,
    r.selectedTour?.id === "T_EFES",
    `got=${JSON.stringify({ id: r.selectedTour?.id })}`);
}

{
  const r = findMatchingTours("Pamukkale turu hakkında bilgi alabilir miyim?",
    { tour_name: "Pamukkale Turu", destination: "Pamukkale" },
    tours, "phone", "faq_general");
  assert(`BUG 1 v2: waiting_for_phone + 'Pamukkale turu' + faq_general → Pamukkale`,
    r.selectedTour?.id === "T_PAMUKKALE");
}

// tour_search intent ile de açılır
{
  const r = findMatchingTours("Antalya'ya nasıl gidilir?",
    { tour_name: "Antalya Rafting", destination: "Antalya" },
    tours, "name", "tour_search");
  assert(`BUG 1 v2: isim adımı + tour_search + NLU sinyali → Antalya (açıldı)`,
    r.selectedTour?.id === "T_ANTALYA");
}

// reservation_intent ile de açılır (mid-flow yeni rezervasyon niyeti) — tek tur senaryosu
{
  const r = findMatchingTours("Pamukkale yapalım",
    { tour_name: "Pamukkale Turu", destination: "Pamukkale" },
    tours, "phone", "reservation_intent");
  assert(`BUG 1 v2: telefon + reservation_intent + NLU sinyali → Pamukkale (B-5 gevşedi)`,
    r.selectedTour?.id === "T_PAMUKKALE",
    `got=${JSON.stringify({ id: r.selectedTour?.id, mult: r.multipleMatches.length })}`);
}

// ─── Karışık mesaj: isim + tur sorusu birlikte ──────────────────────────
// "Ben Murat Aymilatur, Efes turu ne zaman?" — NLU iki sinyal birden döndürür
{
  const r = findMatchingTours("Ben Murat Aymilatur, Efes turu ne zaman?",
    { tour_name: "Efes", destination: "Efes" },
    tours, "name", "faq_general");
  assert(`Karışık: NLU tur sinyali + faq_general → tour-matching AÇILIR, Efes (isim yan etki yok)`,
    r.selectedTour?.id === "T_EFES");
  // İsim state-machine'de extractedInfo.fullName üzerinden Yelda merge fix ile kaydedilir
  // (bu test scope'unun dışı — findMatchingTours sadece tur döndürür)
}

// ─── Sürpriz kapanı: tur intent var ama NLU sinyali yok ─────────────────
{
  const r = findMatchingTours("başka turunuz var mı?",
    { tour_name: "", destination: "" }, tours, "phone", "tour_search");
  assert(`'başka turunuz var mı?' + tour_search + NLU sinyal yok → null (sürpriz değişim yok)`,
    r.selectedTour === null);
}

// ─── SONUÇ ──────────────────────────────────────────────────────────────
console.log(`\n═══════════════════════════════════════════════════════════════════════`);
console.log(`DAVRANIŞSAL TESTLER: ${pass}/${pass + fail} geçti`);
console.log(`═══════════════════════════════════════════════════════════════════════`);
Deno.exit(fail === 0 ? 0 : 1);
