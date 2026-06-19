// Unit test: tur değişimi transition'ında pax/isim/phone korunmalı.
// state-machine.ts TOUR_SELECTED→TOUR_SELECTED + COLLECTING_INFO→TOUR_SELECTED
// action'larının davranışını birebir ayna olarak test eder.

// Eski action (tüm reservationInfo sıfırlanır)
function actionOldTourChange(ctx, input) {
  return {
    ...ctx,
    currentTour: input.selectedTour,
    reservationInfo: {
      tourId: input.selectedTour.id,
      tourTitle: input.selectedTour.title,
    },
    collectionStep: "waiting_for_date",
  };
}

// Yeni action (spread ile pax/isim/phone korunur)
function actionNewTourChange(ctx, input) {
  return {
    ...ctx,
    currentTour: input.selectedTour,
    reservationInfo: {
      ...ctx.reservationInfo,
      tourId: input.selectedTour.id,
      tourTitle: input.selectedTour.title,
      dateId: undefined,
      selectedDate: undefined,
    },
    collectionStep: "waiting_for_date",
  };
}

let failures = 0;
function assert(name, cond, detail) {
  const ok = !!cond;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}

// ═══════════════════════════════════════════════════════════════════
// SENARYO — Özge bug: kullanıcı isim verdiğinde NLU yanlışlıkla tur
// değişimi sanıyor → eski kodda pax/isim siliniyordu.
// ═══════════════════════════════════════════════════════════════════
console.log("\n=== Özge senaryosu: tur değişimi action ===");

const ctxBefore = {
  stage: "COLLECTING_INFO",
  currentTour: { id: "T_RAFTING", title: "Antalya Rafting" },
  reservationInfo: {
    tourId: "T_RAFTING",
    tourTitle: "Antalya Rafting",
    dateId: "D_12ARA",
    selectedDate: "12 Aralık",
    paxAdult: 1,
    fullName: "Özge Yılmazer",        // ← Yeni alınmış, henüz state'te taze
  },
  viewedTours: ["T_RAFTING"],
};

// NLU yanlışlıkla farklı bir tur eşleştirdi (false-positive)
const input = {
  selectedTour: { id: "T_OTHER", title: "Başka Tur" },
  detectedIntent: "reservation_intent",
  userMessage: "özge yılmazer",
};

console.log("CTX before:", JSON.stringify(ctxBefore.reservationInfo));

const oldResult = actionOldTourChange(ctxBefore, input);
console.log("ESKİ kod sonucu:", JSON.stringify(oldResult.reservationInfo));
assert("ESKİ kod: paxAdult KAYBOLUR (bug)",  oldResult.reservationInfo.paxAdult === undefined);
assert("ESKİ kod: fullName KAYBOLUR (bug)",  oldResult.reservationInfo.fullName === undefined);

const newResult = actionNewTourChange(ctxBefore, input);
console.log("YENİ kod sonucu:", JSON.stringify(newResult.reservationInfo));
assert("YENİ kod: paxAdult KORUNDU",         newResult.reservationInfo.paxAdult === 1);
assert("YENİ kod: fullName KORUNDU",         newResult.reservationInfo.fullName === "Özge Yılmazer");
assert("YENİ kod: tourId güncellendi",       newResult.reservationInfo.tourId === "T_OTHER");
assert("YENİ kod: tourTitle güncellendi",    newResult.reservationInfo.tourTitle === "Başka Tur");
assert("YENİ kod: dateId temizlendi (yeni tur = yeni tarih)",  newResult.reservationInfo.dateId === undefined);
assert("YENİ kod: selectedDate temizlendi", newResult.reservationInfo.selectedDate === undefined);

// ═══════════════════════════════════════════════════════════════════
// SENARYO 2 — Tur GERÇEKTEN değişti (kullanıcı bilinçli): pax KORU
// ═══════════════════════════════════════════════════════════════════
console.log("\n=== Bilinçli tur değişimi: pax/isim aynı kişi için geçerli ===");

const ctxFull = {
  stage: "COLLECTING_INFO",
  currentTour: { id: "T_RAFTING", title: "Antalya Rafting" },
  reservationInfo: {
    tourId: "T_RAFTING",
    tourTitle: "Antalya Rafting",
    dateId: "D_12ARA",
    selectedDate: "12 Aralık",
    paxAdult: 1,
    fullName: "Özge Yılmazer",
    phone: "05416500303",
  },
};

// Kullanıcı bilinçli olarak başka tur istiyor
const tourSwitchInput = {
  selectedTour: { id: "T_KAPADOKYA", title: "Kapadokya Turu" },
  detectedIntent: "tour_selected",
  userMessage: "aslında Kapadokya turuna geçeyim",
};

const switchResult = actionNewTourChange(ctxFull, tourSwitchInput);
console.log("Bilinçli tur değişimi sonucu:", JSON.stringify(switchResult.reservationInfo));
assert("Bilinçli değişim: tour değişti",    switchResult.reservationInfo.tourId === "T_KAPADOKYA");
assert("Bilinçli değişim: tarih sıfırlandı", switchResult.reservationInfo.dateId === undefined);
assert("Bilinçli değişim: pax KORU (kişi sayısı tur değişse de aynı)", switchResult.reservationInfo.paxAdult === 1);
assert("Bilinçli değişim: isim KORU (kullanıcı aynı kişi)",            switchResult.reservationInfo.fullName === "Özge Yılmazer");
assert("Bilinçli değişim: telefon KORU",                                switchResult.reservationInfo.phone === "05416500303");

console.log(`\n=== SONUÇ: ${failures === 0 ? "TÜM TESTLER GEÇTİ ✓" : `${failures} FAİL ✗`} ===`);
process.exit(failures === 0 ? 0 : 1);
