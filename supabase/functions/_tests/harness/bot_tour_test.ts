// PAKET-0 Dilim-2 — B1 (tur alanları giriş noktasında düşüyordu) + B2 (dolu tarih siliniyordu).
// Turlar HAM DB şeklinde (getCachedTours çıktısı: tüm kolonlar + dates[].remaining_quota)
// üretilir ve GERÇEK giriş-noktası dönüştürücüsünden (toBotTours) geçirilir — yani
// whatsapp-webhook / demo-chat zincirinin aynısı. 4 dil: tr/en/ru/ar.
import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { runTurn, mkSupabase, mkContext, dumpTurn, setNluMode, setAiMode } from "./harness.ts";
import { toBotTours } from "../../shared/services/bot-tour.ts";
import { formatDateForLanguage } from "../../shared/fsm/localization.ts";
import { quotaLabel } from "../../shared/constants/quota-labels.ts";

setAiMode({ kind: "fail" });
const TODAY = "2026-10-08";
const LANGS = ["tr", "en", "ru", "ar"] as const;

/** getCachedTours çıktısı şeklinde ham tur (DB kolonlarının tamamı). */
function rawTour(over: Record<string, any> = {}) {
  return {
    id: "t-pam", agency_id: "ag-1", is_active: true, created_at: "2026-01-01T00:00:00Z",
    title: "Pamukkale Turu", title_en: "Pamukkale Tour", title_de: null, title_ru: "Тур в Памуккале", title_ar: "جولة باموكالي", title_fr: null, title_es: null,
    destination: "Denizli", destination_en: "Denizli", destination_de: null, destination_ru: "Денизли", destination_ar: "دنيزلي", destination_fr: null, destination_es: null,
    program_kisa: "Travertenler ve Hierapolis.", program_kisa_en: "Travertines and Hierapolis.", program_kisa_de: null, program_kisa_ru: null, program_kisa_ar: null, program_kisa_fr: null, program_kisa_es: null,
    type: "DAYTRIP", currency: "TRY", min_pax: 1, visa_required: null, program_url: "https://example.test/pamukkale",
    hareket_noktasi: "Denizli", toplanma_saati: "07:30:00", tur_sure: "1 gün", konaklama: null, ulasim: "Otobüs",
    tur_kategorisi: "kultur", gezilecek_yerler: "Travertenler", visa_notes: null, hotel_name: null, hotel_stars: null,
    dates: [
      { id: "d1", tour_id: "t-pam", departure_date: "2026-12-10", return_date: null, price_adult: 1000, price_child: null, price_single: null, quota: 10, sold_pax: 0, remaining_quota: 10 },
      { id: "d2", tour_id: "t-pam", departure_date: "2026-12-20", return_date: null, price_adult: 1000, price_child: null, price_single: null, quota: 10, sold_pax: 10, remaining_quota: 0 },
      { id: "d3", tour_id: "t-pam", departure_date: "2026-12-25", return_date: null, price_adult: 1000, price_child: null, price_single: null, quota: 10, sold_pax: 2, remaining_quota: 8 },
    ],
    ...over,
  };
}
const botTours = (raws: any[], lang: string) => toBotTours(raws, lang, TODAY);

const ctxTourSelected = (tour: any, lang: string) =>
  mkContext(tour, { stage: "TOUR_SELECTED", collectionStep: undefined, language: lang, reservationInfo: { tourId: tour.id, tourTitle: tour.title } });

// ── S5 vize (B1): visa_notes dolu / visa_required=true / false+boş
const VISA_Q: Record<string, string> = {
  tr: "Bu tur için vize gerekiyor mu?", en: "Do I need a visa for this tour?",
  ru: "Нужна ли виза для этого тура?", ar: "هل أحتاج تأشيرة لهذه الجولة؟",
};
const VISA_REQUIRED_TXT: Record<string, string> = { tr: "vize gereklidir", en: "A visa is required", ru: "требуется виза", ar: "التأشيرة مطلوبة" };
const VISA_GENERIC_TXT: Record<string, string> = { tr: "kişisel duruma", en: "personal situation", ru: "личной ситуации", ar: "حالتك الشخصية" };

for (const lang of LANGS) {
  Deno.test(`S5a [${lang}] visa_notes dolu → bot NOTU kullanır`, async () => {
    setNluMode({ kind: "fixed", fn: () => ({ intent: "visa_support", language: lang }) });
    const note = "e-Vize ile giriş; pasaport 6 ay geçerli olmalı.";
    const tours = botTours([rawTour({ visa_notes: note, visa_required: true })], lang);
    const t = await runTurn({ ctx: ctxTourSelected(tours[0], lang), message: VISA_Q[lang], tours });
    dumpTurn(`S5a [${lang}]`, t);
    assert(t.reply.includes(note), "visa_notes metni cevapta olmalı");
  });
  Deno.test(`S5b [${lang}] visa_required=true + not boş → "vize gerekli"`, async () => {
    setNluMode({ kind: "fixed", fn: () => ({ intent: "visa_support", language: lang }) });
    const tours = botTours([rawTour({ visa_notes: null, visa_required: true })], lang);
    const t = await runTurn({ ctx: ctxTourSelected(tours[0], lang), message: VISA_Q[lang], tours });
    dumpTurn(`S5b [${lang}]`, t);
    assert(t.reply.includes(VISA_REQUIRED_TXT[lang]), "tur-özel 'vize gerekli' cevabı");
  });
  Deno.test(`S5c [${lang}] visa_required=false + not boş → jenerik yönlendirme ("gerekmez" DENMEZ)`, async () => {
    setNluMode({ kind: "fixed", fn: () => ({ intent: "visa_support", language: lang }) });
    const tours = botTours([rawTour({ visa_notes: null, visa_required: false })], lang);
    const t = await runTurn({ ctx: ctxTourSelected(tours[0], lang), message: VISA_Q[lang], tours });
    dumpTurn(`S5c [${lang}]`, t);
    assert(t.reply.includes(VISA_GENERIC_TXT[lang]), "jenerik kişisel-durum yönlendirmesi");
    assert(!t.reply.includes(VISA_REQUIRED_TXT[lang]), "false iken 'gerekli' denmemeli");
  });
}

// ── B-ATTR min_pax (B1)
const MINPAX_Q: Record<string, string> = {
  tr: "en az kaç kişi gerekiyor?", en: "what is the minimum number of people?",
  ru: "какое минимальное количество человек?", ar: "ما هو الحد الأدنى من الأشخاص؟",
};
const MINPAX_TXT: Record<string, string> = { tr: "4 kişi", en: "4 people", ru: "4 чел.", ar: "4 أشخاص" };
for (const lang of LANGS) {
  Deno.test(`MINPAX [${lang}] min_pax=4 turda B-ATTR doğru cevap`, async () => {
    setNluMode({ kind: "fixed", fn: () => ({ intent: "faq_general", language: lang }) });
    const tours = botTours([rawTour({ min_pax: 4 })], lang);
    const ctx = mkContext(tours[0], { stage: "BROWSING", collectionStep: undefined, currentTour: null, reservationInfo: {}, language: lang });
    const t = await runTurn({ ctx, message: MINPAX_Q[lang], tours });
    dumpTurn(`MINPAX [${lang}]`, t);
    assert(t.reply.includes(MINPAX_TXT[lang]), "min_pax değeri listelenmeli");
  });
}

// ── B2 dolu tarih
const AVAIL_Q: Record<string, string> = { tr: "20'si müsait mi?", en: "is the 20 available?", ru: "20 свободно?", ar: "هل 20 متاح؟" };
for (const lang of LANGS) {
  Deno.test(`DOLU-a [${lang}] :11 listesi dolu tarihi etiketli+numarasız gösterir, "2" müsait 2. tarihi seçer`, async () => {
    setNluMode({ kind: "fixed", fn: (m) => (/^\d+$/.test(m.trim()) ? { intent: "provide_info", language: lang } : { intent: "general", language: lang }) });
    const tours = botTours([rawTour()], lang);
    const ctx = mkContext(tours[0], { language: lang, collectionStep: "waiting_for_date" });
    const t1 = await runTurn({ ctx, message: "?", tours });
    dumpTurn(`DOLU-a1 [${lang}] liste`, t1);
    const full = formatDateForLanguage("2026-12-20", lang);
    const fullLine = t1.reply.split("\n").find((l) => l.includes(full)) || "";
    assert(fullLine.length > 0, "dolu tarih listede GÖRÜNMELİ");
    assert(fullLine.includes(quotaLabel(0, true, lang).trim()), "dolu etiketi olmalı");
    assert(!/^\s*\d+\)/.test(fullLine), "dolu tarih NUMARASIZ olmalı");
    assertEquals(JSON.stringify(t1.stateOut.listedDateIds), '["d1","d3"]', "seçim numaralandırması yalnız müsait tarihler");
    const t2 = await runTurn({ ctx: t1.stateOut, message: "2", tours });
    dumpTurn(`DOLU-a2 [${lang}] "2"`, t2);
    assertEquals(t2.stateOut.reservationInfo.dateId, "d3", '"2" = müsait 2. tarih (25.12), dolu 20.12 DEĞİL');
  });
  Deno.test(`DOLU-b [${lang}] "20'si müsait mi?" → dolu olarak cevaplanır`, async () => {
    setNluMode({ kind: "fixed", fn: () => ({ intent: "general_question", language: lang, entities: { dates: ["20"] } }) });
    const tours = botTours([rawTour()], lang);
    const ctx = mkContext(tours[0], { language: lang, collectionStep: "waiting_for_date" });
    const t = await runTurn({ ctx, message: AVAIL_Q[lang], tours });
    dumpTurn(`DOLU-b [${lang}]`, t);
    assert(t.reply.includes(formatDateForLanguage("2026-12-20", lang)), "sorulan tarih cevapta adıyla geçmeli");
    assert(t.reply.includes(quotaLabel(0, true, lang).trim()), "dolu etiketi olmalı");
    assertEquals(t.stateOut.reservationInfo.dateId, undefined, "seçim YAPILMAMALI");
  });
  Deno.test(`DOLU-c [${lang}] dolu tarih yazıyla seçilmeye çalışılınca rezervasyon oluşmaz`, async () => {
    setNluMode({ kind: "fixed", fn: () => ({ intent: "provide_info", language: lang, entities: { dates: ["2026-12-20"] } }) });
    const tours = botTours([rawTour()], lang);
    const sb = mkSupabase();
    const ctx = mkContext(tours[0], { language: lang, collectionStep: "waiting_for_date" });
    const t = await runTurn({ ctx, message: formatDateForLanguage("2026-12-20", lang), tours, supabase: sb });
    dumpTurn(`DOLU-c [${lang}]`, t);
    assertEquals(t.stateOut.reservationInfo.dateId, undefined, "dolu tarih dateId'ye YAZILMAMALI");
    assert(t.reply.includes(formatDateForLanguage("2026-12-20", lang)), "net mesaj: hangi tarihin dolu olduğu");
    assert(!t.rpcCalls.some((c) => c.name === "create_reservation_with_quota_check"), "RPC çağrılmamalı");
  });
  Deno.test(`DOLU-d [${lang}] CONFIRMING'de seçili tarih dolmuşsa "evet" → RPC YOK, tarih yeniden sorulur`, async () => {
    setNluMode({ kind: "fixed", fn: () => ({ intent: "confirm_reservation", language: lang }) });
    const tours = botTours([rawTour()], lang);
    const sb = mkSupabase({ rpc: { create_reservation_with_quota_check: () => ({ data: { success: true }, error: null }) } });
    const ctx = mkContext(tours[0], { language: lang, stage: "CONFIRMING", collectionStep: "ready_for_confirmation",
      reservationInfo: { tourId: "t-pam", tourTitle: "Pamukkale Turu", dateId: "d2", selectedDate: "2026-12-20", paxAdult: 2, fullName: "Ali Veli", phone: "05551112233" } });
    const t = await runTurn({ ctx, message: { tr: "evet", en: "yes", ru: "да", ar: "نعم" }[lang], tours, supabase: sb });
    dumpTurn(`DOLU-d [${lang}]`, t);
    assert(!t.rpcCalls.some((c) => c.name === "create_reservation_with_quota_check"), "RPC çağrılmamalı");
    assertEquals(t.stateOut.collectionStep, "waiting_for_date");
  });
}
