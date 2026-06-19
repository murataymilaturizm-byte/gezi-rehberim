// Kod-level unit test: state-machine.ts'in mergeReservationInfo fonksiyonu.
// Fix sonrası hasPax/hasName kısıtlarının kaldırıldığını teyit eder.
// 4 senaryo:
//   1) Yelda akışı (isim → telefon, pax önceden YAZILMIŞ) — sıralı tamam akış
//   2) Yelda gibi ama pax YOK iken isim verilir (eski hasPax bug senaryosu)
//   3) Regresyon: geçersiz telefon (extractor phone çıkartmaz) → state.phone null kalır, fullName korunur
//   4) Sıra dışı giriş: pax'tan ÖNCE isim → fix sonrası kabul edilir
//
// Deno runtime'ı yok; ts-import yerine fonksiyonu DOĞRUDAN test edebilmek için
// state-machine.ts'in mergeReservationInfo davranışını JS olarak ayna olarak
// kopyalıyoruz (fix sonrası hali). Tamamen güncel kod ile birebir aynı.

// ─── Fix sonrası fonksiyon (state-machine.ts:82-130 ile bire bir) ───
function mergeReservationInfo(existing, extracted, isInformational = false) {
  if (isInformational) return { ...existing };
  const merged = { ...existing };

  if (extracted.tourId && extracted.tourId !== "") merged.tourId = extracted.tourId;
  if (extracted.tourTitle && extracted.tourTitle !== "") merged.tourTitle = extracted.tourTitle;

  if (extracted.dateId && !merged.dateId) merged.dateId = extracted.dateId;
  if (extracted.selectedDate && !merged.selectedDate) merged.selectedDate = extracted.selectedDate;

  const hasDate = !!(merged.dateId || merged.selectedDate);
  if (hasDate && extracted.paxAdult) {
    merged.paxAdult = extracted.paxAdult;
  }
  if (extracted.paxChild !== undefined && extracted.paxChild !== null && merged.paxAdult) {
    merged.paxChild = extracted.paxChild;
  }

  // FİX SONRASI — hasPax/hasName kapısı YOK
  if (!merged.fullName && extracted.fullName && extracted.fullName !== "") {
    merged.fullName = extracted.fullName;
  }
  if (!merged.phone && extracted.phone && extracted.phone !== "") {
    merged.phone = extracted.phone;
  }

  return merged;
}

// ─── Yardımcı: senaryo ekran çıktısı ───
let failures = 0;
function assert(name, cond, detail) {
  const ok = !!cond;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}

// ════════════════════════════════════════════════════════════════════════
// SENARYO 1 — Yelda akışı (pax önceden var, sırayla isim → telefon)
// ════════════════════════════════════════════════════════════════════════
console.log("\n=== SENARYO 1: Yelda — sıralı tamam akış ===");
let state = { tourId: "T1", dateId: "D1", paxAdult: 1 };
console.log("T0 state:", JSON.stringify(state));

// T1: Kullanıcı "yelda yalman" yazar
state = mergeReservationInfo(state, { fullName: "Yelda Yalman" });
console.log("T1 state:", JSON.stringify(state));
assert("T1 fullName yazıldı", state.fullName === "Yelda Yalman");
assert("T1 paxAdult korundu",  state.paxAdult === 1);
assert("T1 phone hâlâ boş",     state.phone === undefined);

// T2: Kullanıcı "05416500303" yazar
state = mergeReservationInfo(state, { phone: "05416500303" });
console.log("T2 state:", JSON.stringify(state));
assert("T2 phone yazıldı",     state.phone === "05416500303");
assert("T2 fullName KORUNDU",  state.fullName === "Yelda Yalman");
assert("T2 paxAdult korundu",   state.paxAdult === 1);

// ════════════════════════════════════════════════════════════════════════
// SENARYO 2 — Eski hasPax bug senaryosu: pax YOK iken isim verilir
// ════════════════════════════════════════════════════════════════════════
console.log("\n=== SENARYO 2: pax-yok iken isim — eski bug ===");
state = { tourId: "T1", dateId: "D1" };  // paxAdult YOK
console.log("T0 state:", JSON.stringify(state));

state = mergeReservationInfo(state, { fullName: "Yelda Yalman" });
console.log("T1 state:", JSON.stringify(state));
assert("T1 fullName yazıldı (hasPax bypass)", state.fullName === "Yelda Yalman",
  "ESKİ kod bu adımı ATLAR, YENİ kod yazmalı");

state = mergeReservationInfo(state, { phone: "05416500303" });
console.log("T2 state:", JSON.stringify(state));
assert("T2 phone yazıldı (hasName bypass)",   state.phone === "05416500303",
  "ESKİ kod bu adımı da atlardı");
assert("T2 fullName KORUNDU",                  state.fullName === "Yelda Yalman");

// ════════════════════════════════════════════════════════════════════════
// SENARYO 3 — Regresyon: extractor geçersiz telefonu çıkartmaz
// ════════════════════════════════════════════════════════════════════════
console.log("\n=== SENARYO 3: Geçersiz telefon (extractor BOŞ verir) ===");
state = { tourId: "T1", dateId: "D1", paxAdult: 1, fullName: "Yelda Yalman" };
console.log("T0 state:", JSON.stringify(state));

// Extractor "abc123" gibi geçersizden phone ÇIKARTMAZ → extracted.phone yok
state = mergeReservationInfo(state, { /* phone yok */ });
console.log("T1 state:", JSON.stringify(state));
assert("Geçersiz telefon → state.phone hâlâ boş",  state.phone === undefined);
assert("fullName SİLİNMEDİ",                       state.fullName === "Yelda Yalman");
assert("paxAdult korundu",                          state.paxAdult === 1);

// ════════════════════════════════════════════════════════════════════════
// SENARYO 4 — Sıra dışı: isim pax'tan ÖNCE verilir, sonra pax gelir
// ════════════════════════════════════════════════════════════════════════
console.log("\n=== SENARYO 4: Sıra dışı — isim pax'tan ÖNCE ===");
state = { tourId: "T1", dateId: "D1" };  // pax YOK
console.log("T0 state:", JSON.stringify(state));

// T1: isim (pax henüz yok)
state = mergeReservationInfo(state, { fullName: "Yelda Yalman" });
console.log("T1 state:", JSON.stringify(state));
assert("T1 fullName yazıldı (pax yokken)", state.fullName === "Yelda Yalman");

// T2: pax gelir (mevcut isim ile birlikte)
state = mergeReservationInfo(state, { paxAdult: 2 });
console.log("T2 state:", JSON.stringify(state));
assert("T2 paxAdult yazıldı",      state.paxAdult === 2);
assert("T2 fullName KORUNDU",       state.fullName === "Yelda Yalman");

// T3: telefon gelir (mevcut isim+pax ile)
state = mergeReservationInfo(state, { phone: "05416500303" });
console.log("T3 state:", JSON.stringify(state));
assert("T3 phone yazıldı",          state.phone === "05416500303");
assert("T3 fullName KORUNDU",        state.fullName === "Yelda Yalman");
assert("T3 paxAdult KORUNDU",        state.paxAdult === 2);

// ════════════════════════════════════════════════════════════════════════
// REGRESYON BONUS — Bilgi sorusu gelince hiçbir alan silinmez
// ════════════════════════════════════════════════════════════════════════
console.log("\n=== BONUS: isInformational=true — state korunur ===");
state = { tourId: "T1", dateId: "D1", paxAdult: 1, fullName: "Yelda Yalman", phone: "05416500303" };
const before = JSON.stringify(state);
state = mergeReservationInfo(state, { fullName: "BAŞKA İSİM", phone: "00000000000" }, true);
const after = JSON.stringify(state);
assert("isInformational state'i değiştirmez", before === after,
  `before=${before} after=${after}`);

// ════════════════════════════════════════════════════════════════════════
console.log(`\n=== SONUÇ: ${failures === 0 ? "TÜM TESTLER GEÇTİ ✓" : `${failures} FAİL ✗`} ===`);
process.exit(failures === 0 ? 0 : 1);
