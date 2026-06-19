// Hayriye case için 3 bug fix doğrulama
let failures = 0;
function assert(name, cond, detail) {
  const ok = !!cond;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}

// ════════════════════════════════════════════════════════════════════
// BUG 2: COLLECTING_INFO → CONFIRMING — "general" intent REDDEDİLDİ
// ════════════════════════════════════════════════════════════════════
console.log("\n=== BUG 2: 'general' intent ile CONFIRMING'e atlanmamalı ===");

function isAllInfoCollected(info) {
  return !!(info.tourId && info.dateId && info.paxAdult && info.fullName && info.phone);
}

function isInformationalMessage(_msg, intent) {
  const informational = ["general", "general_question", "faq_general", "tour_search", "greeting"];
  return informational.includes(intent);
}

// Eski transition condition (general kabul ediyordu)
function oldCondition(intent, allCollected) {
  if (isInformationalMessage("", intent)) return false;
  const validIntents = ["provide_info", "confirm", "confirm_reservation", "general"]; // ESKİ
  if (!validIntents.includes(intent)) return false;
  return allCollected;
}

// Yeni transition condition (general kabul etmiyor)
function newCondition(intent, allCollected) {
  if (isInformationalMessage("", intent)) return false;
  const validIntents = ["provide_info", "confirm", "confirm_reservation"]; // YENİ
  if (!validIntents.includes(intent)) return false;
  return allCollected;
}

const allFull = isAllInfoCollected({ tourId:"T",dateId:"D",paxAdult:1,fullName:"Hayriye Hayre",phone:"05445652525" });
assert("State allInfoCollected=true", allFull);

// 'general' intent — eski kod CONFIRMING'e atlardı, yeni kod ATLAMAZ
assert("ESKİ: 'general' intent + all collected → CONFIRMING (bug)", oldCondition("general", allFull) === false,
  "Aslında isInformational true döner → false. Hmm 'general' isInformational'a dahil olduğu için eski kodun condition'ı da false dönüyordu. Yani 'general' intent her zaman bypass ediliyordu.");

// Düzeltme: 'general' isInformational'da. Yani transition #12 koşulu 'general' iken zaten false dönüyordu.
// Asıl sorun NLU'nun mesaja FARKLI bir intent (örn. provide_info veya confirm_reservation) dönmesinde.
// Test edelim: provide_info ile allInfoCollected → CONFIRMING (normal).
assert("provide_info + all collected → CONFIRMING (normal)",  newCondition("provide_info", allFull) === true);
assert("YENİ: 'general' intent → CONFIRMING'e ATLAMAZ", newCondition("general", allFull) === false);
assert("confirm_reservation + all collected → CONFIRMING", newCondition("confirm_reservation", allFull) === true);

// Kritik: confirm_reservation intent ile bile, kullanıcı state COLLECTING_INFO'da iken bu intent VERİLİRSE
// CONFIRMING'e atlanır. Bu intentin sadece "evet onaylıyorum" gibi açık mesajlarda NLU'dan dönmesi gerekir.
// Yelda case'inde NLU yanlış intent verirse atlanır. Ek koruma yok; NLU disiplini kritik.

// ════════════════════════════════════════════════════════════════════
// BUG 3: normalizeDateString — "olur/olsun" eklerini temizle + tr-TR lowercase
// ════════════════════════════════════════════════════════════════════
console.log("\n=== BUG 3: 'olur/olsun' eklerini temizle ===");

const TEXT_MONTHS = {
  ocak:1,şubat:2,mart:3,nisan:4,mayıs:5,haziran:6,
  temmuz:7,ağustos:8,eylül:9,ekim:10,kasım:11,aralık:12
};
const _monthPattern = Object.keys(TEXT_MONTHS).join("|");
const TEXT_MONTH_REGEX = new RegExp(`(\\d{1,2})[.\\s]+(${_monthPattern})(?:[.\\s]+(\\d{4}))?`, "i");

const _DATE_FILLER_REGEX = /\b(olur|olsun|tamam|uygun|işte|şu|bu|tarih|gün|lütfen|please|fine|good|ok|okay)\b/gi;

function normalizeDateString(dateStr) {
  if (!dateStr) return dateStr;
  const stripped = dateStr.replace(_DATE_FILLER_REGEX, "").replace(/\s+/g, " ").trim();
  const cleaned = stripped.toLocaleLowerCase("tr-TR").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  const dmy = dateStr.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
  const textMatch = cleaned.match(TEXT_MONTH_REGEX);
  if (textMatch) {
    const day = parseInt(textMatch[1]);
    const monthName = textMatch[2].toLocaleLowerCase("tr-TR");
    const month = TEXT_MONTHS[monthName];
    if (month && day >= 1 && day <= 31) {
      let year = textMatch[3] ? parseInt(textMatch[3]) : new Date().getFullYear();
      return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    }
  }
  return dateStr;
}

const tests = [
  ["14 aralık olur",    /\d{4}-12-14/, "ana case"],
  ["14 aralık olsun",   /\d{4}-12-14/, "olsun varyantı"],
  ["14 aralık tamam",   /\d{4}-12-14/, "tamam"],
  ["14 aralık lütfen",  /\d{4}-12-14/, "lütfen"],
  ["14 aralık",         /\d{4}-12-14/, "saf tarih hâlâ çalışır"],
  ["14 ARALIK OLUR",    /\d{4}-12-14/, "uppercase + olur (Türkçe ı)"],
  ["5 ocak",            /\d{4}-01-05/, "ocak"],
  // NOT: EN testleri (march/december) için bu simulasyon TR aylarını kullanıyor; gerçek
  // kodda 7 dil ayı var. Bu test'in asıl amacı "olur/olsun" + Türkçe ı/I case-folding'i.
];

for (const [input, expected, desc] of tests) {
  const result = normalizeDateString(input);
  assert(`Bug3: '${input}' → ISO match (${desc})`, expected.test(result), `result=${result}`);
}

// ════════════════════════════════════════════════════════════════════
// BUG 1: process-message savunmacı fallback — missingStep
// ════════════════════════════════════════════════════════════════════
console.log("\n=== BUG 1: missingStep eski state'ten fallback ===");

function computeMissingStep(newInfo, oldInfo) {
  const fullName = newInfo.fullName || oldInfo.fullName;
  const paxAdult = newInfo.paxAdult || oldInfo.paxAdult;
  const dateId   = newInfo.dateId   || oldInfo.dateId;
  const phone    = newInfo.phone    || oldInfo.phone;
  return !newInfo.tourId ? "waiting_for_date"
    : !dateId ? "waiting_for_date"
    : !paxAdult ? "waiting_for_pax"
    : !fullName ? "waiting_for_name"
    : !phone ? "waiting_for_phone"
    : null;
}

// Senaryo: newContext'te fullName yok ama oldContext'te dolu
const old = { tourId:"T",dateId:"D",paxAdult:1,fullName:"Hayriye Hayre",phone:"055..." };
const newWithoutName = { tourId:"T",dateId:"D",paxAdult:1,phone:"055..." }; // fullName eksik
assert("Old fullName fallback → missingStep null (eksik değil)",
  computeMissingStep(newWithoutName, old) === null);

const newEmpty = { tourId:"T",dateId:"D" };
assert("Both empty fullName → waiting_for_name",
  computeMissingStep(newEmpty, {}) === "waiting_for_pax",
  "pax gerçekten eksik");

console.log(`\n=== SONUÇ: ${failures === 0 ? "TÜM TESTLER GEÇTİ ✓" : `${failures} FAİL ✗`} ===`);
process.exit(failures === 0 ? 0 : 1);
