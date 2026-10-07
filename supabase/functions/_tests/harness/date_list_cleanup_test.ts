// "Son kapı" (PAKET-0 Dilim-1 ek): listedDateIds / pendingPax TEMİZLİK noktaları.
//  (a) liste → tur değişimi → "2"  : eski turun listesi yeni turda seçim yapmamalı;
//      TOUR_SELECTED T10 yolunda liste yeniden basılmaz → bayat id'ler "2"yi YUTUYORDU.
//  (b) H-pax → iptal → yeni rezervasyon : pendingPax yeni rezervasyona SIZMAMALI.
// 4 dil. Önce kırmızı → temizlik eklenince yeşil.
import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { runTurn, mkTour, mkDate, mkContext, dumpTurn, setNluMode, setAiMode } from "./harness.ts";
import { formatDateForLanguage } from "../../shared/fsm/localization.ts";

setAiMode({ kind: "fail" });

const LANGS: Array<{ lang: string; pax5: string; cancel: string; switchKap: string; pickPam: string }> = [
  { lang: "tr", pax5: "5 kişi",    cancel: "vazgeçtim",   switchKap: "Kapadokya",  pickPam: "Pamukkale 20 aralık" },
  { lang: "en", pax5: "5 people",  cancel: "cancel",      switchKap: "Cappadocia", pickPam: "Pamukkale 20 december" },
  { lang: "ru", pax5: "5 человек", cancel: "отмена",      switchKap: "Каппадокия", pickPam: "Памуккале 20 декабря" },
  { lang: "ar", pax5: "5 أشخاص",   cancel: "إلغاء",       switchKap: "كابادوكيا",  pickPam: "باموكالي 20 ديسمبر" },
];

const PAM = () => mkTour({ dates: [mkDate("d1", "2026-12-10", 1), mkDate("d2", "2026-12-20", 10), mkDate("d3", "2026-12-25", 2), mkDate("d4", "2027-01-05", 10)] });
const KAP = () => mkTour({ id: "t-kap", title: "Kapadokya Balon Turu", destination: "Nevşehir", type: "N2", currency: "TRY",
  dates: [mkDate("k1", "2026-12-15", 10, 1500), mkDate("k2", "2026-12-22", 10, 1500), mkDate("k3", "2027-01-10", 10, 1500)] });

function nlu(lang: string) {
  setNluMode({
    kind: "fixed",
    fn: (msg) => {
      const m = msg.trim();
      if (/^\d+$/.test(m)) return { intent: "provide_info", language: lang };
      if (/^(vazgeçtim|cancel|отмена|إلغاء)$/i.test(m)) return { intent: "general", language: lang };
      if (/kapadokya|cappadocia|каппадокия|كابادوكيا/i.test(m)) return { intent: "tour_search", language: lang, entities: { tour_name: "Kapadokya Balon Turu", destination: "Kapadokya" } };
      if (/pamukkale|памуккале|باموكالي/i.test(m)) return { intent: "reservation_intent", language: lang, entities: { tour_name: "Pamukkale Turu", destination: "Pamukkale", dates: ["20 Aralık"] } };
      if (/5/.test(m)) return { intent: "provide_info", language: lang, entities: { people_count: { adults: 5 } }, updates: { paxAdult: 5 } };
      return { intent: "general", language: lang };
    },
  });
}

// ── (a) liste → tur değişimi → "2"
for (const L of LANGS) {
  Deno.test(`SK-a [${L.lang}] liste → tur değişimi (TOUR_SELECTED/T10) → "2" eski listeye DEĞİL yeni turun 2. tarihine`, async () => {
    nlu(L.lang);
    const pam = PAM(), kap = KAP();
    // Turn 1: Pamukkale için gerçek :11 listesi (waiting_for_date) → listedDateIds=[d1..d4]
    const c0 = mkContext(pam, { language: L.lang, collectionStep: "waiting_for_date" });
    const t1 = await runTurn({ ctx: c0, message: "?", tours: [pam, kap] });
    dumpTurn(`SK-a1 [${L.lang}] liste`, t1);
    assertEquals(JSON.stringify(t1.stateOut.listedDateIds), '["d1","d2","d3","d4"]', "Pamukkale listesi yazılmalı");
    // Turn 2: TOUR_SELECTED'a dön (keşif) — listedDateIds bayat kalır; "Kapadokya" → T10 tur değişimi (liste basılmaz)
    const c1 = { ...t1.stateOut, stage: "TOUR_SELECTED" as any, collectionStep: undefined, reservationInfo: { tourId: pam.id, tourTitle: pam.title } };
    const t2 = await runTurn({ ctx: c1, message: L.switchKap, tours: [pam, kap] });
    dumpTurn(`SK-a2 [${L.lang}] "${L.switchKap}"`, t2);
    assertEquals(t2.stateOut.currentTour?.id, "t-kap", "tur Kapadokya'ya geçmeli");
    assertEquals(t2.stateOut.listedDateIds, undefined, "tur değişiminde bayat liste TEMİZLENMELİ");
    // Turn 3: "2" → Kapadokya'nın kronolojik 2. tarihi (k2)
    const t3 = await runTurn({ ctx: t2.stateOut, message: "2", tours: [pam, kap] });
    dumpTurn(`SK-a3 [${L.lang}] "2"`, t3);
    assertEquals(t3.stateOut.reservationInfo.dateId, "k2", "yeni turun 2. tarihi seçilmeli (bayat Pamukkale id'si değil)");
    assert(t3.reply.includes(formatDateForLanguage("2026-12-22", L.lang)), "ack Kapadokya 22.12'yi göstermeli");
  });
}

// ── (b) H-pax → iptal → yeni rezervasyonda pax sızmıyor
for (const L of LANGS) {
  Deno.test(`SK-b [${L.lang}] H-pax(pendingPax=5) → iptal → yeni rezervasyon: pax SIZMAZ`, async () => {
    nlu(L.lang);
    const pam = PAM();
    const c0 = mkContext(pam, { language: L.lang, collectionStep: "waiting_for_pax", reservationInfo: { tourId: pam.id, tourTitle: pam.title, dateId: "d1", selectedDate: "2026-12-10" } });
    const t1 = await runTurn({ ctx: c0, message: L.pax5, tours: [pam] });
    dumpTurn(`SK-b1 [${L.lang}] "${L.pax5}"`, t1);
    assertEquals(t1.stateOut.pendingPax, 5);
    const t2 = await runTurn({ ctx: t1.stateOut, message: L.cancel, tours: [pam] });
    dumpTurn(`SK-b2 [${L.lang}] "${L.cancel}"`, t2);
    assertEquals(t2.stateOut.stage, "BROWSING", "iptal → BROWSING");
    assertEquals(t2.stateOut.pendingPax, undefined, "iptalde pendingPax TEMİZLENMELİ");
    assertEquals(t2.stateOut.listedDateIds, undefined, "iptalde listedDateIds TEMİZLENMELİ");
    // Yeni rezervasyon: tur + tarih tek mesajda → pax SORULMALI (5 sızmamalı)
    const t3 = await runTurn({ ctx: t2.stateOut, message: L.pickPam, tours: [pam] });
    dumpTurn(`SK-b3 [${L.lang}] "${L.pickPam}"`, t3);
    assertEquals(t3.stateOut.reservationInfo.dateId, "d2", "20.12 seçilmeli");
    assertEquals(t3.stateOut.reservationInfo.paxAdult, undefined, "pax yeni rezervasyona SIZMAMALI");
    assertEquals(t3.stateOut.collectionStep, "waiting_for_pax", "pax sorulmalı");
  });
}
