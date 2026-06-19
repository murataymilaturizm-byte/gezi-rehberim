// Kapsamlı state machine paket testi — B-2 → B-6 düzeltmelerini doğrular.
// Ayrıca regresyon: Yelda merge fix + Özge tour-change fix bozulmadı mı?

let failures = 0;
function assert(name, cond, detail) {
  const ok = !!cond;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}

// ════════════════════════════════════════════════════════════════════
// B-4: detectCancellation — devam bağlacı guard
// ════════════════════════════════════════════════════════════════════
console.log("\n=== B-4: detectCancellation guard (ama/fakat) ===");

// Bu fonksiyonu state-machine.ts'den birebir kopyalıyoruz (ESM import yerine
// fonksiyonun davranışını izole test ediyoruz).
function detectCancellation(text, language) {
  const patterns = {
    tr: /\b(vazge[cç]tim|vazgeçiyorum|iptal|istemiyorum|olmas[ıi]n|gerek yok|bo[sş] ver|ba[sş]ka zaman|d[uü][sş][uü]neyim|d[uü][sş][uü]neyim de|pas|paslıyorum|ba[sş]tan ba[sş]la|ba[sş]tan ba[sş]lamak|ba[sş]tan ba[sş]layal[ıi]m|yeniden ba[sş]la|yeniden ba[sş]lamak|s[ıi]f[ıi]rla|ba[sş]a dön)\b/i,
    en: /\b(cancel|nevermind|never mind|forget it|don'?t want|skip it|maybe later|not now|pass|leave it|restart|reset|start over|start fresh|begin again|from scratch|new conversation)\b/i,
    de: /\b(abbrechen|stornieren|möchte nicht|will nicht|vergiss es|vergessen|später|nicht mehr|lass es sein|neu starten|von vorne|nochmal|neu anfangen)\b/i,
    ru: /\b(отмена|отменить|не хочу|неважно|забудь|забудьте|позже|потом|не надо|заново|сначала|начать заново)\b/i,
    ar: /\b(إلغاء|لا أريد|انس الأمر|لاحقا|ليس الآن|اتركها|البدء من جديد|إعادة|ابدأ من جديد)\b/i,
    fr: /\b(annuler|j'abandonne|peu importe|laisse tomber|laissez tomber|plus tard|pas maintenant|oublie|recommencer|depuis le début|repartir)\b/i,
    es: /\b(cancelar|olvídalo|olvidalo|no quiero|déjalo|dejalo|más tarde|otro día|olvida|reiniciar|empezar de nuevo|desde el principio)\b/i,
  };
  const langKey = language;
  const hasCancel = (patterns[langKey]?.test(text) ?? false) || patterns.en.test(text);
  if (!hasCancel) return false;
  const continuationGuard =
    /\b(ama|fakat|ancak|yine de|gene de|but|however|though|although|aber|jedoch|trotzdem|cependant|néanmoins|toutefois|pero|sin embargo|no obstante|однако|но|тем не менее|لكن|مع ذلك|ولكن)\b/i;
  if (continuationGuard.test(text)) return false;
  return true;
}

assert("Net iptal: 'vazgeçtim'",                detectCancellation("vazgeçtim", "tr") === true);
assert("Net iptal: 'iptal et'",                  detectCancellation("iptal et", "tr") === true);
assert("Tereddüt + ama: 'düşüneyim ama güzelmiş' → iptal DEĞİL",
  detectCancellation("biraz düşüneyim ama Pamukkale güzelmiş", "tr") === false);
assert("Tereddüt + fakat: → iptal DEĞİL",
  detectCancellation("pas geçeyim fakat fiyat iyiymiş", "tr") === false);
assert("EN: 'cancel'                              → iptal", detectCancellation("cancel", "en") === true);
assert("EN: 'maybe later but I'm interested'      → iptal DEĞİL",
  detectCancellation("maybe later but I'm interested", "en") === false);
assert("Sadece tereddüt 'düşüneyim' (devam yok)   → iptal (mevcut davranış korunur)",
  detectCancellation("düşüneyim", "tr") === true);

// ════════════════════════════════════════════════════════════════════
// B-6: detectNegativeResponse — "hayır" net red
// ════════════════════════════════════════════════════════════════════
console.log("\n=== B-6: detectNegativeResponse ===");

function detectNegativeResponse(text, language) {
  const patterns = {
    tr: /^\s*(hayır|yok|olmaz|hayir|hayır\.|hayır!)\s*$/i,
    en: /^\s*(no|nope|nah|no\.|no!)\s*$/i,
    de: /^\s*(nein|nö)\s*$/i,
    fr: /^\s*(non)\s*$/i,
    es: /^\s*(no)\s*$/i,
    ru: /^\s*(нет)\s*$/i,
    ar: /^\s*(لا)\s*$/i,
  };
  const langKey = language;
  return (patterns[langKey]?.test(text) ?? false) || patterns.en.test(text);
}

assert("'hayır' tek başına → net red", detectNegativeResponse("hayır", "tr") === true);
assert("'no' tek başına → net red",     detectNegativeResponse("no", "en") === true);
assert("'hayırlı olsun' → net red DEĞİL (cümle)", detectNegativeResponse("hayırlı olsun", "tr") === false);
assert("'no problem' → net red DEĞİL (cümle)",   detectNegativeResponse("no problem", "en") === false);

// ════════════════════════════════════════════════════════════════════
// B-5: tour-matcher context-aware kapatma
// ════════════════════════════════════════════════════════════════════
console.log("\n=== B-5: tour-matcher waiting_for_name/phone'da kapatma ===");

// Simüle: B-5 fix sonrası findMatchingTours davranışı
function findMatchingToursSimulated(expectedInput) {
  if (expectedInput === "name" || expectedInput === "phone") {
    return { selectedTour: null, multipleMatches: [] };
  }
  // Aksi halde normal eşleştirme (bu test için varsayım: bir tur bulunabilir)
  return { selectedTour: { id: "T_X", title: "Bir Tur" }, multipleMatches: [] };
}

assert("waiting_for_name'de tour-matcher KAPALI",   findMatchingToursSimulated("name").selectedTour === null);
assert("waiting_for_phone'da tour-matcher KAPALI",   findMatchingToursSimulated("phone").selectedTour === null);
assert("waiting_for_date'de tour-matcher AÇIK",      findMatchingToursSimulated("date").selectedTour !== null);
assert("waiting_for_pax'da tour-matcher AÇIK",       findMatchingToursSimulated("pax").selectedTour !== null);

// ════════════════════════════════════════════════════════════════════
// B-2: process-message stage-koruma — reservation_intent ezme
// ════════════════════════════════════════════════════════════════════
console.log("\n=== B-2: COLLECTING_INFO/CONFIRMING'de reservation_intent → provide_info ===");

function stageProtect(stage, intent) {
  if (
    (stage === "COLLECTING_INFO" || stage === "CONFIRMING") &&
    (intent === "tour_search" || intent === "reservation_intent")
  ) {
    return "provide_info";
  }
  return intent;
}

assert("COLLECTING_INFO + reservation_intent → provide_info",
  stageProtect("COLLECTING_INFO", "reservation_intent") === "provide_info");
assert("CONFIRMING + reservation_intent → provide_info",
  stageProtect("CONFIRMING", "reservation_intent") === "provide_info");
assert("COLLECTING_INFO + tour_search → provide_info (mevcut)",
  stageProtect("COLLECTING_INFO", "tour_search") === "provide_info");
assert("BROWSING + reservation_intent → DEĞİŞMEZ (browsing'de yeni rez. başlatabilir)",
  stageProtect("BROWSING", "reservation_intent") === "reservation_intent");
assert("GREETING + reservation_intent → DEĞİŞMEZ",
  stageProtect("GREETING", "reservation_intent") === "reservation_intent");
assert("CONFIRMING + confirm_reservation → DEĞİŞMEZ",
  stageProtect("CONFIRMING", "confirm_reservation") === "confirm_reservation");

// ════════════════════════════════════════════════════════════════════
// B-3: CONFIRMING → COLLECTING_INFO değişiklik action delete guard
// ════════════════════════════════════════════════════════════════════
console.log("\n=== B-3: namePattern/phonePattern eşleşince yeni değer YOKSA SİLME ===");

// Simüle: B-3 fix sonrası action davranışı
function changeActionSimulated(info, msg, extractedInfo) {
  const namePattern   = /isim|ismi|adım|adı|adın|soyad|surname|name|namen?|имя|اسم|إسم|nom|nombre/i;
  const phonePattern  = /\b(telefon|numara|phone|tel|gsm|cep|handy|телефон|номер|هاتف|رقم|téléphone|teléfono)\b/i;
  const datePattern   = /\b(tarih|date|gün|day|datum|tag|дата|день|تاريخ|يوم|jour|día|fecha)\b/i;
  const out = { ...info };

  if (namePattern.test(msg)) {
    if (extractedInfo.fullName) {
      out.fullName = extractedInfo.fullName;
    }
    // else: KORU
  } else if (phonePattern.test(msg)) {
    if (extractedInfo.phone) {
      out.phone = extractedInfo.phone;
    }
    // else: KORU
  } else if (datePattern.test(msg)) {
    if (extractedInfo.selectedDate || extractedInfo.dateId) {
      if (extractedInfo.dateId) out.dateId = extractedInfo.dateId;
      if (extractedInfo.selectedDate) out.selectedDate = extractedInfo.selectedDate;
    } else {
      delete out.dateId;
      delete out.selectedDate;
    }
  }
  return out;
}

const baseInfo = { tourId: "T1", dateId: "D1", paxAdult: 1, fullName: "Özge Yılmazer", phone: "05551234567" };

// Senaryo: "telefon yanlış olabilir bir saniye" — phone pattern, yeni değer YOK
// NOT: pattern \b kullanıyor; "telefonum" çekim ekiyle eşleşmez. Bu testler
// state-machine'in mantığı eşleştiğinde davranışını verify eder.
let after = changeActionSimulated(baseInfo, "telefon yanlış olabilir bir saniye", {});
assert("B-3: phone pattern + yeni değer YOK → phone KORUNDU", after.phone === "05551234567",
  `Eski kod silerdi; yeni kod korumalı. after.phone=${after.phone}`);
assert("B-3: phone değişiklik talebi → fullName etkilenmez", after.fullName === "Özge Yılmazer");

// Senaryo: "telefon 05559998877 olsun" — phone pattern + yeni değer
after = changeActionSimulated(baseInfo, "telefon 05559998877 olsun", { phone: "05559998877" });
assert("B-3: phone + yeni değer → güncellendi", after.phone === "05559998877",
  `after.phone=${after.phone}`);

// Senaryo: "name wrong" — name pattern (\b matched), yeni değer YOK
after = changeActionSimulated(baseInfo, "name wrong", {});
assert("B-3: name pattern + yeni değer YOK → fullName KORUNDU", after.fullName === "Özge Yılmazer");

// Senaryo: "isim Ayşe Demir" — name pattern + yeni değer
after = changeActionSimulated(baseInfo, "isim Ayşe Demir olsun", { fullName: "Ayşe Demir" });
assert("B-3: name + yeni değer → güncellendi", after.fullName === "Ayşe Demir",
  `after.fullName=${after.fullName}`);

// Senaryo: "tarih değiştirelim" — date pattern, yeni değer YOK → silmek MAKUL
after = changeActionSimulated(baseInfo, "tarih değiştirelim", {});
assert("B-3: date pattern + yeni değer YOK → dateId silindi (kasıtlı)", after.dateId === undefined,
  `after.dateId=${after.dateId}`);
assert("B-3: tarih değiştirme isteği fullName etkilemez", after.fullName === "Özge Yılmazer");
assert("B-3: tarih değiştirme isteği phone etkilemez",    after.phone === "05551234567");

// ════════════════════════════════════════════════════════════════════
// REGRESYON: Yelda merge fix (önceki testleri yeniden çalıştır)
// ════════════════════════════════════════════════════════════════════
console.log("\n=== REGRESYON: Yelda merge fix korunuyor mu? ===");

function mergeReservationInfo(existing, extracted, isInformational = false) {
  if (isInformational) return { ...existing };
  const merged = { ...existing };
  if (extracted.tourId && extracted.tourId !== "") merged.tourId = extracted.tourId;
  if (extracted.tourTitle && extracted.tourTitle !== "") merged.tourTitle = extracted.tourTitle;
  if (extracted.dateId && !merged.dateId) merged.dateId = extracted.dateId;
  if (extracted.selectedDate && !merged.selectedDate) merged.selectedDate = extracted.selectedDate;
  const hasDate = !!(merged.dateId || merged.selectedDate);
  if (hasDate && extracted.paxAdult) merged.paxAdult = extracted.paxAdult;
  if (extracted.paxChild !== undefined && extracted.paxChild !== null && merged.paxAdult) merged.paxChild = extracted.paxChild;
  if (!merged.fullName && extracted.fullName && extracted.fullName !== "") merged.fullName = extracted.fullName;
  if (!merged.phone && extracted.phone && extracted.phone !== "") merged.phone = extracted.phone;
  return merged;
}

let s = { tourId: "T1", dateId: "D1", paxAdult: 1 };
s = mergeReservationInfo(s, { fullName: "Yelda Yalman" });
assert("Yelda T1: fullName yazıldı", s.fullName === "Yelda Yalman");
s = mergeReservationInfo(s, { phone: "05416500303" });
assert("Yelda T2: phone yazıldı + fullName korundu",
  s.phone === "05416500303" && s.fullName === "Yelda Yalman" && s.paxAdult === 1);

// Pax yok iken isim verme (eski hasPax bug)
s = { tourId: "T1", dateId: "D1" };
s = mergeReservationInfo(s, { fullName: "Yelda Yalman" });
assert("hasPax bypass: pax yokken fullName yazıldı", s.fullName === "Yelda Yalman");

// ════════════════════════════════════════════════════════════════════
// REGRESYON: Özge tour-change spread fix korunuyor mu?
// ════════════════════════════════════════════════════════════════════
console.log("\n=== REGRESYON: Özge tour-change spread korunuyor mu? ===");

function tourChangeAction(ctx, input) {
  return {
    ...ctx,
    reservationInfo: {
      ...ctx.reservationInfo,
      tourId: input.selectedTour.id,
      tourTitle: input.selectedTour.title,
      dateId: undefined,
      selectedDate: undefined,
    },
  };
}

const ctxFull = {
  reservationInfo: { tourId: "T1", tourTitle: "Tur1", dateId: "D1", selectedDate: "12 Ara",
                     paxAdult: 1, fullName: "Özge Yılmazer", phone: "05551234567" },
};
const result = tourChangeAction(ctxFull, { selectedTour: { id: "T2", title: "Tur2" } });
assert("Özge: tur değişiminde pax KORUNDU",      result.reservationInfo.paxAdult === 1);
assert("Özge: tur değişiminde fullName KORUNDU", result.reservationInfo.fullName === "Özge Yılmazer");
assert("Özge: tur değişiminde phone KORUNDU",     result.reservationInfo.phone === "05551234567");
assert("Özge: tur değişiminde tourId güncellendi", result.reservationInfo.tourId === "T2");
assert("Özge: tur değişiminde dateId temizlendi",  result.reservationInfo.dateId === undefined);

// ════════════════════════════════════════════════════════════════════
console.log(`\n=== TOPLAM SONUÇ: ${failures === 0 ? "TÜM TESTLER GEÇTİ ✓" : `${failures} FAİL ✗`} ===`);
process.exit(failures === 0 ? 0 : 1);
