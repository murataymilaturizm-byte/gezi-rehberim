// Yelda case için prompt çıktısının kesinliğini test eder.
// State machine waiting_for_phone diyorsa, prompt'ta:
//   - "TELEFON" + "SADECE telefon iste" geçmeli
//   - "TEKRAR SORMA" listesinde tarih/kişi sayısı/isim olmalı (eski bug: pax tekrar soruluyor!)

// Ayna fonksiyonlar (stages/index.ts ile birebir)
function getCollectedFields(info) {
  return {
    hasDate: !!(info?.selectedDate || info?.dateId),
    hasPax: !!info?.paxAdult,
    hasName: !!info?.fullName,
    hasPhone: !!info?.phone,
  };
}

function buildForbiddenAskList(collectionStep, collected, language) {
  const labels = {
    tr: { date: "tarih", pax: "kişi sayısı", name: "isim", phone: "telefon" },
    en: { date: "date", pax: "number of people", name: "name", phone: "phone" },
  };
  const lang = labels[language] ? language : "en";
  const L = labels[lang];
  const forbidden = [];
  if (collected.hasDate && collectionStep !== "waiting_for_date") forbidden.push(L.date);
  if (collected.hasPax && collectionStep !== "waiting_for_pax") forbidden.push(L.pax);
  if (collected.hasName && collectionStep !== "waiting_for_name") forbidden.push(L.name);
  if (collected.hasPhone && collectionStep !== "waiting_for_phone") forbidden.push(L.phone);
  if (forbidden.length === 0) return "";
  return lang === "tr"
    ? `\n❌ TEKRAR SORMA (zaten alındı): ${forbidden.join(", ")}. Bu alanları doğrulama amaçlı bile sorma.`
    : `\n❌ DO NOT ASK AGAIN (already collected): ${forbidden.join(", ")}. Never re-ask, not even for verification.`;
}

let failures = 0;
function assert(name, cond, detail) {
  const ok = !!cond;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}

// ════════════════════════════════════════════════════════════════════
// YELDA CASE — waiting_for_phone, pax+isim zaten alındı
// ════════════════════════════════════════════════════════════════════
console.log("\n=== Yelda case: waiting_for_phone + state dolu ===");

const yeldaState = {
  selectedDate: "12 Aralık",
  paxAdult: 1,
  fullName: "Yelda Selda",
  // phone: yok
};
const collectedY = getCollectedFields(yeldaState);
const forbiddenY = buildForbiddenAskList("waiting_for_phone", collectedY, "tr");

console.log("Forbidden list TR:", JSON.stringify(forbiddenY));

assert("Yelda: 'tarih' YASAK listesinde",        forbiddenY.includes("tarih"));
assert("Yelda: 'kişi sayısı' YASAK listesinde",  forbiddenY.includes("kişi sayısı"));
assert("Yelda: 'isim' YASAK listesinde",         forbiddenY.includes("isim"));
assert("Yelda: 'telefon' YASAK listesinde DEĞİL (sıradaki adım)",
  !forbiddenY.includes("telefon"));
assert("Yelda: 'TEKRAR SORMA' direktifi var",    forbiddenY.includes("TEKRAR SORMA"));
assert("Yelda: 'doğrulama amaçlı bile sorma' direktifi var",
  forbiddenY.includes("doğrulama amaçlı bile"));

// ════════════════════════════════════════════════════════════════════
// EN versiyonu
// ════════════════════════════════════════════════════════════════════
console.log("\n=== EN: waiting_for_phone + state dolu ===");
const forbiddenE = buildForbiddenAskList("waiting_for_phone", collectedY, "en");
console.log("Forbidden list EN:", JSON.stringify(forbiddenE));
assert("EN: 'date' YASAK",       forbiddenE.includes("date"));
assert("EN: 'number of people' YASAK", forbiddenE.includes("number of people"));
assert("EN: 'name' YASAK",        forbiddenE.includes("name"));
assert("EN: 'phone' YASAK DEĞİL", !forbiddenE.includes("phone"));
assert("EN: 'DO NOT ASK AGAIN' direktifi var", forbiddenE.includes("DO NOT ASK AGAIN"));

// ════════════════════════════════════════════════════════════════════
// waiting_for_name iken: tarih+pax YASAK, isim ve telefon DEĞİL
// ════════════════════════════════════════════════════════════════════
console.log("\n=== waiting_for_name ===");
const stateN = { selectedDate: "12 Ara", paxAdult: 2 };
const forbiddenN = buildForbiddenAskList("waiting_for_name", getCollectedFields(stateN), "tr");
console.log("Forbidden TR:", JSON.stringify(forbiddenN));
assert("waiting_for_name: tarih YASAK",       forbiddenN.includes("tarih"));
assert("waiting_for_name: kişi sayısı YASAK", forbiddenN.includes("kişi sayısı"));
assert("waiting_for_name: isim YASAK DEĞİL",  !forbiddenN.includes("isim"));

// ════════════════════════════════════════════════════════════════════
// İlk adım: hiçbir alan dolu değil → YASAK listesi BOŞ
// ════════════════════════════════════════════════════════════════════
console.log("\n=== İlk adım (waiting_for_date, hiçbir alan dolu değil) ===");
const forbiddenInit = buildForbiddenAskList("waiting_for_date", getCollectedFields({}), "tr");
console.log("Forbidden (boş state):", JSON.stringify(forbiddenInit));
assert("Boş state'te YASAK listesi BOŞ string", forbiddenInit === "");

// ════════════════════════════════════════════════════════════════════
// "SISTEMIN BELIRLEDIGI ADIM" header'ı içeren prompt mantığı
// ════════════════════════════════════════════════════════════════════
console.log("\n=== Step prompt header KESİN komut ===");

const phonePromptTR = `📝 SİSTEMİN BELİRLEDİĞİ ADIM: TELEFON

GÖREVİN: SADECE telefon numarası iste. Başka HİÇBİR şey sorma.`;
assert("TR phone prompt 'SİSTEMİN BELİRLEDİĞİ ADIM' içeriyor",
  phonePromptTR.includes("SİSTEMİN BELİRLEDİĞİ ADIM"));
assert("TR phone prompt 'SADECE telefon' içeriyor",
  phonePromptTR.includes("SADECE telefon"));
assert("TR phone prompt 'Başka HİÇBİR şey' içeriyor",
  phonePromptTR.includes("Başka HİÇBİR şey"));

console.log(`\n=== SONUÇ: ${failures === 0 ? "TÜM TESTLER GEÇTİ ✓" : `${failures} FAİL ✗`} ===`);
process.exit(failures === 0 ? 0 : 1);
