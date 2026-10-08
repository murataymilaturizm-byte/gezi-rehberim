// Dilim-7 (denetim TURZZ-FABLE-DENETIM.md D1 + E2 + E3).
//  D1 — bütçe girdisinin para birimi: çözülür, karşılaştırma tek para biriminde, etiket o birimde.
//  E2 — \b + non-ASCII ölü regex dalları: RU/AR/ES onaylar, DE/RU/AR e-posta atlama.
//  E3 — karakter dil tespiti (ES ≠ FR), akış ortası 2-ardışık kuralı, dil adı geçen sorular.
import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { runTurn, mkTour, mkDate, mkContext, dumpTurn, setNluMode, setAiMode } from "./harness.ts";
import { setRates } from "./stubs/exchange-rates.ts";
import { analyzeUserMessage } from "../../shared/fsm/nlu.ts";
import { isEmailSkipRequest } from "../../shared/fsm/simple-extractor.ts";
import { detectLanguage } from "../../shared/fsm/language.ts";
import { getLocalizedTourTitle } from "../../shared/services/info-extractor.ts";

setAiMode({ kind: "fixed", reply: "LLM_CEVABI" });
// USD bazlı kur (exchangerate-api biçimi): 1 USD = 0.92 EUR = 34.5 TRY = 90 RUB
const RATES = { USD: 1, EUR: 0.92, TRY: 34.5, RUB: 90 };
const AG = (dual: boolean): any => ({ id: "ag-1", name: "Test", phone_public: null, show_multi_currency: dual, enabled_languages: null, collect_email: false, working_hours: null });

const T_EUR = () => mkTour({ id: "t-eur", title: "Kapadokya Balon Turu", currency: "EUR", dates: [mkDate("e1", "2027-03-10", 20, 120)] });
const T_TRY1 = () => mkTour({ id: "t-try1", title: "Pamukkale Turu", currency: "TRY", dates: [mkDate("p1", "2027-03-11", 20, 1000)] });
const T_TRY2 = () => mkTour({ id: "t-try2", title: "Efes Antik Kent Turu", currency: "TRY", dates: [mkDate("x1", "2027-03-12", 20, 30000)] });
const TOURS = () => [T_EUR(), T_TRY1(), T_TRY2()];
const greet = (lang: string) => ({ ...mkContext(T_EUR(), {}), stage: "GREETING", collectionStep: undefined, currentTour: null, reservationInfo: {}, language: lang, messageCount: 1 } as any);
// Liste başlıkları getLocalizedTourTitle ile yerelleşir (de: "Kappadokien Ballonfahrt").
const has = (reply: string, title: string, lang: string) => reply.includes(getLocalizedTourTitle(title, lang));

// ── D1 ────────────────────────────────────────────────────────────────────────
Deno.test(`D1 [de] "Touren unter 500 €" + kur → 120 EUR ✓, 1000 TRY (≈27€) ✓, 30000 TRY (≈800€) ✗; etiket "unter 500€"`, async () => {
  setRates(RATES);
  setNluMode({ kind: "fixed", fn: () => ({ intent: "tour_search", language: "de" }) });
  const t = await runTurn({ ctx: greet("de"), message: "Touren unter 500 €", tours: TOURS(), agency: AG(true) });
  dumpTurn("D1 [de] kur var", t);
  setRates({});
  assert(t.reply.includes("unter 500€"), `etiket bütçe para biriminde → ${t.reply.slice(0, 80)}`);
  assert(!/TRY\)/.test(t.reply.split("\n")[0]), "etikette TRY yok");
  assert(has(t.reply, "Kapadokya Balon Turu", "de"), "120 EUR listede");
  assert(has(t.reply, "Pamukkale Turu", "de"), "1000 TRY ≈ 27€ listede");
  assert(!has(t.reply, "Efes Antik Kent Turu", "de"), "30000 TRY ≈ 800€ listede OLMAMALI");
});

Deno.test(`D1 [de] "Touren unter 500 €" kur YOK → EUR karşılaştırılır, TRY turları dışlanmaz ve "yaklaşık" işaretlenmez`, async () => {
  setRates({});
  setNluMode({ kind: "fixed", fn: () => ({ intent: "tour_search", language: "de" }) });
  const t = await runTurn({ ctx: greet("de"), message: "Touren unter 500 €", tours: TOURS(), agency: AG(true) });
  dumpTurn("D1 [de] kur yok", t);
  assert(t.reply.includes("unter 500€"));
  assert(has(t.reply, "Kapadokya Balon Turu", "de") && has(t.reply, "Pamukkale Turu", "de") && has(t.reply, "Efes Antik Kent Turu", "de"), "3 tur da listede");
  assert(!/≈|ca\.|ungefähr|yaklaşık/i.test(t.reply), "yaklaşık işareti yok");
  assert(t.reply.indexOf("Kapadokya") < t.reply.indexOf("Pamukkale"), "karşılaştırılabilen (EUR) önce");
});

Deno.test(`D1 [en] "tours under $300" + kur → 1000 TRY (≈29$) ✓, 120 EUR (≈130$) ✓, 30000 TRY (≈870$) ✗`, async () => {
  setRates(RATES);
  setNluMode({ kind: "fixed", fn: () => ({ intent: "tour_search", language: "en" }) });
  const t = await runTurn({ ctx: greet("en"), message: "tours under $300", tours: TOURS(), agency: AG(true) });
  dumpTurn("D1 [en]", t);
  setRates({});
  assert(t.reply.includes("under 300$"), `etiket → ${t.reply.slice(0, 80)}`);
  assert(has(t.reply, "Pamukkale Turu", "en") && has(t.reply, "Kapadokya Balon Turu", "en"));
  assert(!has(t.reply, "Efes Antik Kent Turu", "en"));
});

Deno.test(`D1 [ru] "туры до 5000 руб" + kur → 1000 TRY (≈2609₽) ✓, 120 EUR (≈11739₽) ✗`, async () => {
  setRates(RATES);
  setNluMode({ kind: "fixed", fn: () => ({ intent: "tour_search", language: "ru" }) });
  const t = await runTurn({ ctx: greet("ru"), message: "туры до 5000 руб", tours: TOURS(), agency: AG(true) });
  dumpTurn("D1 [ru]", t);
  setRates({});
  assert(t.reply.includes("до 5.000₽"), `etiket → ${t.reply.slice(0, 80)}`);
  assert(has(t.reply, "Pamukkale Turu", "ru"));
  assert(!has(t.reply, "Kapadokya Balon Turu", "ru") && !has(t.reply, "Efes Antik Kent Turu", "ru"));
});

Deno.test(`D1 [tr] "5000 TL altı turlar" (kur yok) — eski davranış: 1000 TRY ✓, 30000 TRY ✗, etiket ₺`, async () => {
  setRates({});
  setNluMode({ kind: "fixed", fn: () => ({ intent: "tour_search", language: "tr" }) });
  const t = await runTurn({ ctx: greet("tr"), message: "5000 TL altı turlar", tours: TOURS(), agency: AG(true) });
  dumpTurn("D1 [tr]", t);
  assert(/5\.?000₺ altı/.test(t.reply), `etiket → ${t.reply.slice(0, 60)}`);
  assert(has(t.reply, "Pamukkale Turu", "tr"));
  assert(!has(t.reply, "Efes Antik Kent Turu", "tr"));
});

// ── E2 ────────────────────────────────────────────────────────────────────────
for (const [lang, yes] of [["ru", "да"], ["ar", "نعم"], ["es", "sí"]] as const) {
  Deno.test(`E2 [${lang}] NLU yedek (fallback) "${yes}" → confirm_reservation`, async () => {
    setNluMode({ kind: "fallback" });
    const r = await analyzeUserMessage(yes, "", "CONFIRMING", null, []);
    assertEquals(r.intent, "confirm_reservation");
  });
  Deno.test(`E2 [${lang}] TOUR_SELECTED "${yes}" (NLU general) → COLLECTING_INFO (olumlu kalıp)`, async () => {
    setNluMode({ kind: "fixed", fn: () => ({ intent: "general", language: lang }) });
    const tour = T_TRY1();
    const ctx = mkContext(tour, { language: lang, stage: "TOUR_SELECTED", collectionStep: undefined });
    const t = await runTurn({ ctx, message: yes, tours: [tour], agency: AG(false) });
    dumpTurn(`E2-sm [${lang}] "${yes}"`, t);
    assertEquals(t.stateOut.stage, "COLLECTING_INFO");
  });
}
for (const [lang, msgs] of [["de", ["überspringen", "später bitte"]], ["ru", ["пропустить", "нет"]], ["ar", ["تخطي", "لا"]]] as const) {
  Deno.test(`E2 [${lang}] e-posta atlama ifadeleri eşleşiyor: ${msgs.join(" / ")}`, () => {
    for (const m of msgs) assert(isEmailSkipRequest(m, lang), `"${m}" atlama sayılmalı`);
    assert(!isEmailSkipRequest(lang === "ar" ? "test@example.com" : "max@example.com", lang), "e-posta adresi atlama değil");
  });
}

// ── E3 ────────────────────────────────────────────────────────────────────────
Deno.test(`E3 detectLanguage "¿Qué incluye el tour?" → es (fr değil)`, () => {
  assertEquals(detectLanguage("¿Qué incluye el tour?"), "es");
  assertEquals(detectLanguage("Je voudrais réserver à Paris"), "fr");
  assertEquals(detectLanguage("Danke schön, wie läuft das?"), "de");
});

Deno.test(`E3 [fr→es] akış ortası: 1. İspanyolca mesaj dili DEĞİŞTİRMEZ (pending=es), 2. ardışık değiştirir`, async () => {
  setNluMode({ kind: "fixed", fn: () => ({ intent: "general", language: "es" }) });
  const tour = T_TRY1();
  const ctx = mkContext(tour, { language: "fr", stage: "TOUR_SELECTED", collectionStep: undefined });
  const t1 = await runTurn({ ctx, message: "¿Qué incluye el tour?", tours: [tour], agency: AG(false) });
  assertEquals(t1.stateOut.language, "fr", "tek mesajda geçmez");
  assertEquals((t1.stateOut as any).pendingLangSwitch, "es", "sinyal es (fr değil)");
  const t2 = await runTurn({ ctx: t1.stateOut, message: "¿Y cuánto cuesta?", tours: [tour], agency: AG(false) });
  assertEquals(t2.stateOut.language, "es", "2. ardışık İspanyolca → es");
});

Deno.test(`E3 [tr] akış ortası tek İspanyolca (aksanlı) mesaj dili değiştirmez`, async () => {
  setNluMode({ kind: "fixed", fn: () => ({ intent: "general", language: "es" }) });
  const tour = T_TRY1();
  const ctx = mkContext(tour, { language: "tr", stage: "TOUR_SELECTED", collectionStep: undefined });
  const t = await runTurn({ ctx, message: "¡Hola! ¿Qué tal?", tours: [tour], agency: AG(false) });
  assertEquals(t.stateOut.language, "tr");
});

Deno.test(`E3 [tr] akış ortası tek İngilizce kelime değiştirmez; 2 ardışık İngilizce mesaj değiştirir`, async () => {
  setNluMode({ kind: "fixed", fn: () => ({ intent: "general", language: "en" }) });
  const tour = T_TRY1();
  const ctx = mkContext(tour, { language: "tr", stage: "TOUR_SELECTED", collectionStep: undefined });
  const t1 = await runTurn({ ctx, message: "thanks", tours: [tour], agency: AG(false) });
  assertEquals(t1.stateOut.language, "tr", "tek kelime");
  const t2 = await runTurn({ ctx: t1.stateOut, message: "what time does the tour start", tours: [tour], agency: AG(false) });
  assertEquals(t2.stateOut.language, "en", "2. ardışık");
});

for (const [msg, expect] of [["İngilizce rehber var mı?", "tr"], ["Almanca rehberiniz var mı?", "tr"], ["İngilizce devam edelim", "en"]] as const) {
  Deno.test(`E3 [tr] "${msg}" → dil ${expect}`, async () => {
    setNluMode({ kind: "fixed", fn: () => ({ intent: "faq_general", language: "tr" }) });
    const tour = T_TRY1();
    const ctx = mkContext(tour, { language: "tr", stage: "TOUR_SELECTED", collectionStep: undefined });
    const t = await runTurn({ ctx, message: msg, tours: [tour], agency: AG(false) });
    assertEquals(t.stateOut.language, expect);
  });
}
