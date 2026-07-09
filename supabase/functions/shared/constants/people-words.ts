// İnsan-sayma kelimeleri — TEK KAYNAK (2026-07-09 Faz 5, Vaka 2 fix).
//
// TEŞHİS: 4 KOPYA (info-extractor _peopleContextRe [X9], simple-extractor
// peopleContext [word-fallback] + paxPatterns[0] [digit→paxAdult] + paxChild)
// + EN "ppl" / DE "Personen" / RU "человек" / AR "أشخاص" listede YOKTU +
// `\b` Kiril/Arapça/ç-başlangıç sınırında kırıktı (Yan #8) → birleşik ilk-mesajda
// (NLU people=2 dönse bile) X9 pax'ı reddediyor, simple-extractor da yakalamıyordu.
//
// KURAL: \p{L}\p{N} lookaround + /iu — `\b` YASAK. ADULT_ALT digit→paxAdult'a
// GÜVENLE çevrilebilir; CHILD_ALT yalnız CONTEXT + digit→paxChild (ADULT'a
// KARIŞMAZ — "2 çocuk" paxAdult=2 YAPMAZ).
//
// Tüketiciler: info-extractor Blok 1 (X9 _hasPeopleContext), simple-extractor
// (extractPaxFromWords context + paxPatterns paxAdult + paxChildPatterns).

// Yetişkin / genel "insan" (sayıya çevrilince paxAdult).
const ADULT_ALT =
  "ki[şs]i(?:yiz|yim)?|insan|yeti[şs]kin|person|persons|people|ppl|adult|adults|pax|guest|guests|personen|erwachsene[rn]?|personne|personnes|adulte|adultes|persona|personas|adulto|adultos|человек|человека|люди|взросл[\\p{L}]*|гост[\\p{L}]*|(?:[لب])?شخص|(?:[لب])?شخصين|(?:[لب])?أشخاص|بالغ|بالغين";

// Çocuk (yalnız CONTEXT + digit→paxChild; paxAdult'a çevrilmez).
const CHILD_ALT =
  "[çc]ocuk|kind|kinder|child|children|kid|kids|enfant|enfants|ni[ñn][oa]s?|дет[\\p{L}]*|ребен[\\p{L}]*|طفل|أطفال|رضيع";

// X9 + word-fallback: mesajda İNSAN-bağlamı VAR MI (adult ∪ child).
export const PEOPLE_CONTEXT_RE =
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${ADULT_ALT}|${CHILD_ALT})(?![\\p{L}\\p{N}])`, "iu");

// Digit → paxAdult ("2 ppl / 2 Personen / на 2 человека / 3 أشخاص"). Trailing
// sınır YOK (mevcut lenient davranış korunur; "personen" tam VE "person" prefix
// eşleşir). Leading (?<![-\d]) negatif/bileşik-rakam guard'ı (mevcut).
export const PAX_ADULT_RE =
  new RegExp(`(?<![-\\d])(\\d+)\\s*(?:${ADULT_ALT})`, "iu");

// Digit → paxChild ("2 çocuk / 2 kinder / 2 أطفال"). AR "دفال" typo'su düzeltildi.
export const PAX_CHILD_RE =
  new RegExp(`(?<![-\\d])(\\d+)\\s*(?:${CHILD_ALT})`, "iu");
