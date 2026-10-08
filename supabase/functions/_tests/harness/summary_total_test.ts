// Dilim-6 (denetim TURZZ-FABLE-DENETIM.md D3 + G1 + C2): tutar ve özet tutarlılığı.
//  T  — price_child=0 / null, 2 yetişkin + 1 çocuk: :13 özeti, completion, RPC snapshot
//       (p_total_amount) ve kapora (kapora + kalan) AYNI tutar.
//  G  — CONFIRMING'de A2 (pax açık değişiklik) ve A3 (isim/telefon açık değişiklik):
//       güncel özette doğru 💰 Toplam.
//  E  — EUR fiyatlı tur: listeler/özet ₺ değil €.
import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { runTurn, mkSupabase, mkTour, mkDate, mkContext, dumpTurn, setNluMode, setAiMode } from "./harness.ts";
import { formatToursList, formatTourDetails } from "../../shared/fsm/prompts/helpers.ts";

setAiMode({ kind: "fail" });

const LANGS = ["tr", "en", "ru", "ar"] as const;
const YES: Record<string, string> = { tr: "evet", en: "yes", ru: "да", ar: "نعم" };
const PHONE = "05321234567";
// Tek para birimi (kur yok) → tutar metni deterministik ("2.000₺").
const AGENCY: any = { id: "ag-1", name: "Test Acente", phone_public: null, show_multi_currency: false, enabled_languages: null, collect_email: false, working_hours: null };
const PAY = { payment_methods: ["bank_transfer"], payment_type: "deposit", deposit_percentage: 50, tr: { bank_name: "Test Bank", iban: "TR000000000000000000000000", account_holder: "Test Acente" } };
const DEP_LABEL: Record<string, string> = { tr: "Kapora Tutarı:", en: "Deposit Amount:", ru: "Сумма депозита:", ar: "مبلغ الوديعة:" };
const REM_LABEL: Record<string, string> = { tr: "Kalan Tutar:", en: "Remaining:", ru: "Остаток:", ar: "المتبقي:" };
const TOTAL_LABEL: Record<string, string> = { tr: "Toplam", en: "Total", ru: "Итого", ar: "الإجمالي" };

const num = (s: string) => Number(s.replace(/\./g, ""));
const firstLine = (s: string) => s.split("\n")[0];
/** "💰 Toplam: *2.000₺*" → 2000 */
const summaryTotal = (reply: string, lang: string, sym = "₺"): number | null => {
  const m = reply.match(new RegExp(`💰 ${TOTAL_LABEL[lang]}: \\*([\\d.]+)${sym}\\*`));
  return m ? num(m[1]) : null;
};
const amountAfter = (reply: string, label: string): number | null => {
  const i = reply.indexOf(label);
  if (i < 0) return null;
  const m = reply.slice(i + label.length).match(/([\d.]+)₺/);
  return m ? num(m[1]) : null;
};

const tourWith = (priceChild: number | null) =>
  mkTour({ dates: [{ ...mkDate("d1", "2027-03-10", 50, 1000, priceChild, 100) }] });
const fullInfo = (tour: any, over: any = {}) => ({
  tourId: tour.id, tourTitle: tour.title, dateId: "d1", selectedDate: "2027-03-10",
  paxAdult: 2, paxChild: 1, fullName: "Ali Veli", phone: PHONE, ...over,
});

// ── T: dört yerde aynı tutar ────────────────────────────────────────────────
for (const [label, priceChild, expected] of [["price_child=0", 0, 2000], ["price_child=null", null, 3000]] as const) {
  for (const lang of LANGS) {
    Deno.test(`T [${lang}] ${label}, 2 yetişkin + 1 çocuk → özet = completion = RPC = kapora+kalan = ${expected}`, async () => {
      setNluMode({ kind: "fixed", fn: (m) => (m === YES[lang] ? { intent: "confirm_reservation", language: lang }
        : { intent: "provide_info", language: lang, entities: { phone: PHONE }, updates: { phone: PHONE } }) });
      const tour = tourWith(priceChild);
      // 1) telefon → CONFIRMING (:13 ilk özet)
      const ctx = mkContext(tour, { language: lang, collectionStep: "waiting_for_phone", reservationInfo: fullInfo(tour, { phone: undefined }) });
      const t1 = await runTurn({ ctx, message: PHONE, tours: [tour], agency: AGENCY });
      dumpTurn(`T1 [${lang}] ${label} telefon → özet`, t1);
      assertEquals(t1.stateOut.stage, "CONFIRMING", "özet aşaması");
      const sumTotal = summaryTotal(t1.reply, lang);
      assertEquals(sumTotal, expected, `özet 💰 = ${expected} (bulunan ${sumTotal})`);

      // 2) "evet" → COMPLETED (completion + RPC + kapora)
      const sb = mkSupabase({ rpc: { create_reservation_with_quota_check: () => ({ data: { success: true, registration_id: "r-1" }, error: null }) } });
      const t2 = await runTurn({ ctx: t1.stateOut, message: YES[lang], tours: [tour], agency: AGENCY, supabase: sb, paymentInstructions: PAY });
      dumpTurn(`T2 [${lang}] ${label} evet → completion`, t2);
      assertEquals(t2.stateOut.stage, "COMPLETED");
      const rpc = t2.rpcCalls.find((c) => c.name === "create_reservation_with_quota_check");
      assertEquals(rpc?.args?.p_total_amount, expected, "RPC snapshot p_total_amount");
      const compTotal = (t2.reply.match(new RegExp(`\\*${TOTAL_LABEL[lang]}:\\* ([\\d.]+)₺`)) || [])[1];
      assertEquals(compTotal ? num(compTotal) : null, expected, "completion • Toplam");
      const dep = amountAfter(t2.reply, DEP_LABEL[lang]);
      const rem = amountAfter(t2.reply, REM_LABEL[lang]);
      assertEquals(dep, expected / 2, "kapora %50");
      assertEquals((dep ?? 0) + (rem ?? 0), expected, "kapora + kalan = toplam");
    });
  }
}

// ── G: A2 / A3 sonrası güncel özette 💰 ────────────────────────────────────────
const PAX3: Record<string, string> = { tr: "aslında 3 kişiyiz", en: "actually we are 3 people", ru: "на самом деле нас 3 человека", ar: "في الواقع نحن 3 أشخاص" };
const NAME: Record<string, string> = { tr: "aslında adım Mehmet Kaya", en: "actually my name is Mehmet Kaya", ru: "на самом деле меня зовут Mehmet Kaya", ar: "في الواقع اسمي Mehmet Kaya" };
const PHONE2 = "05339876543";
const PHONEMSG: Record<string, string> = { tr: `aslında telefonum ${PHONE2}`, en: `actually my phone is ${PHONE2}`, ru: `на самом деле мой телефон ${PHONE2}`, ar: `في الواقع هاتفي ${PHONE2}` };
const PREFIX_A2: Record<string, string> = { tr: "*Kişi sayısını*", en: "*Number of people*", ru: "*Количество человек*", ar: "*عدد الأشخاص*" };
const PREFIX_NAME: Record<string, string> = { tr: "*Ad-Soyadı*", en: "*Name*", ru: "*Имя*", ar: "*الاسم*" };
const PREFIX_PHONE: Record<string, string> = { tr: "*Telefonu*", en: "*Phone*", ru: "*Телефон*", ar: "*الهاتف*" };

// A2/A3 özet dalı: tüm alanlar DOLU ama stage COLLECTING_INFO (change_info geçişi sonrası —
// response-validator "BUG D REVİZE-2" durumu). CONFIRMING'de aynı mesajı PAKET-B DAL1 önce
// yakalar (_l2CorrectionSignal CHANGE_KEYWORDS_RE'yi içerir) — o dal zaten 💰'lıydı; G-CONF
// testleri iki stage'de de güncel özette doğru 💰'yu doğrular.
for (const lang of LANGS) for (const stage of ["COLLECTING_INFO", "CONFIRMING"] as const) {
  const tour = tourWith(null); // 1.000 kişi başı
  const confCtx = () => mkContext(tour, { language: lang, stage, collectionStep: "ready_for_confirmation", reservationInfo: fullInfo(tour, { paxChild: undefined }) });
  const viaA = stage === "COLLECTING_INFO"; // A2/A3 dalı yalnız burada (önek kontrolü)

  Deno.test(`G-A2 [${lang}/${stage}] "${PAX3[lang]}" → güncel özet + 💰 3.000`, async () => {
    setNluMode({ kind: "fixed", fn: () => ({ intent: "change_info", language: lang, entities: { people_count: { adults: 3 } }, updates: { paxAdult: 3 } }) });
    const t = await runTurn({ ctx: confCtx(), message: PAX3[lang], tours: [tour], agency: AGENCY });
    dumpTurn(`G-A2 [${lang}/${stage}]`, t);
    if (viaA) assert(firstLine(t.reply).includes(PREFIX_A2[lang]), `A2 dalı (önek ${PREFIX_A2[lang]})`);
    assertEquals(t.stateOut.reservationInfo.paxAdult, 3);
    assertEquals(summaryTotal(t.reply, lang), 3000, "güncel toplam 3 × 1.000");
  });

  Deno.test(`G-A3 [${lang}/${stage}] isim düzeltmesi → güncel özet + 💰 2.000`, async () => {
    setNluMode({ kind: "fixed", fn: () => ({ intent: "change_info", language: lang, entities: { full_name: "Mehmet Kaya" }, updates: { fullName: "Mehmet Kaya" } }) });
    const t = await runTurn({ ctx: confCtx(), message: NAME[lang], tours: [tour], agency: AGENCY });
    dumpTurn(`G-A3-name [${lang}/${stage}]`, t);
    if (viaA) assert(firstLine(t.reply).includes(PREFIX_NAME[lang]), `A3 isim dalı (önek ${PREFIX_NAME[lang]})`);
    assertEquals(t.stateOut.reservationInfo.fullName, "Mehmet Kaya");
    assertEquals(summaryTotal(t.reply, lang), 2000);
  });

  Deno.test(`G-A3 [${lang}/${stage}] telefon düzeltmesi → güncel özet + 💰 2.000`, async () => {
    setNluMode({ kind: "fixed", fn: () => ({ intent: "change_info", language: lang, entities: { phone: PHONE2 }, updates: { phone: PHONE2 } }) });
    const t = await runTurn({ ctx: confCtx(), message: PHONEMSG[lang], tours: [tour], agency: AGENCY });
    dumpTurn(`G-A3-phone [${lang}/${stage}]`, t);
    if (viaA) assert(firstLine(t.reply).includes(PREFIX_PHONE[lang]), `A3 telefon dalı (önek ${PREFIX_PHONE[lang]})`);
    assertEquals(summaryTotal(t.reply, lang), 2000);
  });
}

// ── E: EUR fiyatlı tur — ₺ değil € ─────────────────────────────────────────────
const eurTour = () => mkTour({ id: "t-eur", title: "Kapadokya Balon Turu", currency: "EUR", dates: [mkDate("e1", "2027-03-10", 50, 250, null, 100)] });
for (const lang of LANGS) {
  Deno.test(`E [${lang}] EUR turu: prompt tur listesi (4 ton) + tur detayı € ile, ₺/TRY yok`, () => {
    for (const tone of ["standart", "kurumsal", "dinamik", "premium"]) {
      const txt = formatToursList([eurTour()], lang, tone);
      assert(txt.includes("250€"), `${tone}: 250€ olmalı → ${txt}`);
      assert(!/₺|TRY/.test(txt), `${tone}: ₺/TRY olmamalı → ${txt}`);
    }
    const det = formatTourDetails(eurTour(), lang);
    assert(!/₺/.test(det), `tur detayı ₺ içermemeli → ${det.slice(0, 200)}`);
  });

  Deno.test(`E [${lang}] EUR turu: CONFIRMING özeti 💰 € ile`, async () => {
    setNluMode({ kind: "fixed", fn: () => ({ intent: "provide_info", language: lang, entities: { phone: PHONE }, updates: { phone: PHONE } }) });
    const tour = eurTour();
    const ctx = mkContext(tour, { language: lang, collectionStep: "waiting_for_phone",
      reservationInfo: { tourId: tour.id, tourTitle: tour.title, dateId: "e1", selectedDate: "2027-03-10", paxAdult: 2, fullName: "Ali Veli" } });
    const t = await runTurn({ ctx, message: PHONE, tours: [tour], agency: AGENCY });
    dumpTurn(`E-sum [${lang}]`, t);
    assertEquals(summaryTotal(t.reply, lang, "€"), 500, "2 × 250€");
    assert(!t.reply.includes("₺"), "özette ₺ olmamalı");
  });
}
