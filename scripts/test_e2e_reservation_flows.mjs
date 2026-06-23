// ═══════════════════════════════════════════════════════════════════════
// UÇTAN UCA REZERVASYON AKIŞI TEST PAKETİ
//
// Bu harness state-machine.ts'in mantığını birebir mirror eder + her
// senaryoyu mesaj-mesaj koştuturup state'i + bot davranışını doğrular.
//
// NLU mock'lu (gerçek Claude API çağrısı yok) — her mesaj için intent +
// extractedInfo manuel verilir. Bu, state akışını + transition mantığını
// + delete guard'larını + prompt-state senkronunu eksiksiz test eder.
//
// Eklenmesi gereken bir senaryo: yeni adım dizilerini bu pakete koy.
// Bot deploy edilmeden önce node scripts/test_e2e_reservation_flows.mjs
// koştur — başarısızsa deploy etme.
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { homedir, platform } from "node:os";

// ═══════════════════════════════════════════════════════════════════════
// FAZ 0 — STATİK TİP/REFERANS KONTROLÜ (deno check)
//
// 2026-06-19 production hatasının (ReferenceError: forbiddenList is not
// defined) tekrarını engelleyen kalıcı koruma. Mock testleri tanımsız
// değişken/kopuk import yakalamıyor; deno check edge runtime'ın gerçek
// derleyicisidir. Test runner'dan ÖNCE çalışır, fail olursa Katman 1
// hiç başlamadan exit eder — hata commit'e değil, terminal çıktısına gider.
// ═══════════════════════════════════════════════════════════════════════
function runDenoCheck() {
  const projectRoot = dirname(fileURLToPath(import.meta.url)) + "/..";
  const targets = [
    "supabase/functions/shared/fsm/prompts/stages/index.ts",
    "supabase/functions/shared/handlers/process-message.ts",
    "supabase/functions/shared/fsm/state-machine.ts",
    "supabase/functions/shared/fsm/nlu.ts",
    "supabase/functions/shared/services/info-extractor.ts",
    "supabase/functions/shared/constants/date-detection.ts",
    "supabase/functions/shared/fsm/prompts/helpers.ts",
    "supabase/functions/shared/services/tour-change.ts",
    "supabase/functions/shared/constants/tour-matching.ts",
    "supabase/functions/shared/services/tour-matching.ts",
    "supabase/functions/shared/services/nlu-validation.ts",
    "supabase/functions/shared/services/bypass-gates.ts",
    "supabase/functions/shared/services/quota-check.ts",
  ];

  const candidates = [
    "deno",
    join(homedir(), ".deno", "bin", platform() === "win32" ? "deno.exe" : "deno"),
  ];
  let denoBin = null;
  for (const c of candidates) {
    const probe = spawnSync(c, ["--version"], { stdio: "ignore" });
    if (probe.status === 0) { denoBin = c; break; }
  }

  if (!denoBin) {
    console.log("⚠️  Deno bulunamadı — statik tip kontrolü ATLANDI.");
    console.log("   Kurmak için (user-level, admin gerekmez):");
    console.log("     PowerShell: irm https://deno.land/install.ps1 | iex");
    console.log("     Shell:      curl -fsSL https://deno.land/install.sh | sh");
    console.log("   Mock testler yine de koşacak, ama referans/tip hataları yakalanmayacak.\n");
    return;
  }

  console.log(`🔍 deno check (${targets.length} dosya) — referans/tip hataları yakalanıyor...`);
  const t0 = Number(process.hrtime.bigint() / 1000000n);
  const result = spawnSync(denoBin, ["check", ...targets], {
    cwd: projectRoot,
    encoding: "utf-8",
  });
  const dt = Number(process.hrtime.bigint() / 1000000n) - t0;

  if (result.status !== 0) {
    console.error("\n✗ STATIK TIP/REFERANS HATASI — Katman 1 testi BAŞLAMADI:\n");
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
    console.error("\nÇöz, sonra tekrar koştur.");
    process.exit(2);
  }
  console.log(`✓ deno check OK (${dt}ms)\n`);
}

runDenoCheck();

// ═══════════════════════════════════════════════════════════════════════
// FAZ 0.5 — DAVRANIŞSAL TESTLER (deno run scripts/test_behavioral.ts)
//
// 2026-06-19: forbiddenList canlıda runtime'da patladı; substring testleri
// "fonksiyon çağrılıyor" iddiası yapmıyordu. Bu faz info-extractor + regex'leri
// GERÇEK input'la çalıştırır — pax sızıntı tuzağı, DATE_QUERY_RE 7 dil match/
// no-match. deno check'in tip-doğrulamasını runtime-davranış doğrulaması ile
// tamamlar. Substring testleri (Faz 2'deki PROMPT/BYPASS) "kod var mı" der;
// FAZ 0.5 "kod çalışıyor mu" der.
// ═══════════════════════════════════════════════════════════════════════
function runBehavioralTests() {
  const projectRoot = dirname(fileURLToPath(import.meta.url)) + "/..";
  const candidates = [
    "deno",
    join(homedir(), ".deno", "bin", platform() === "win32" ? "deno.exe" : "deno"),
  ];
  let denoBin = null;
  for (const c of candidates) {
    const probe = spawnSync(c, ["--version"], { stdio: "ignore" });
    if (probe.status === 0) { denoBin = c; break; }
  }
  if (!denoBin) {
    console.log("⚠️  Deno yok — davranışsal testler ATLANDI.\n");
    return;
  }

  console.log("🧪 deno run scripts/test_behavioral.ts — davranışsal testler...");
  const result = spawnSync(denoBin, ["run", "--allow-read", "--allow-env", "scripts/test_behavioral.ts"], {
    cwd: projectRoot,
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    console.error("\n✗ DAVRANIŞSAL TEST BAŞARISIZ — Katman 1 mock testleri başlamadı:\n");
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
    process.exit(3);
  }
  // Davranışsal testlerin kendi çıktısı varsa son birkaç satırı göster
  const lines = (result.stdout || "").trim().split("\n");
  console.log(lines.slice(-3).join("\n") + "\n");
}

runBehavioralTests();

// ─── State machine mirror (state-machine.ts ile birebir) ─────────────
function isInformationalMessage(userMessage, detectedIntent) {
  const informationalIntents = [
    "general", "general_question", "faq_general", "tour_search",
    "greeting", "agency_info", "working_hours", "payment_methods",
    "cancellation_policy", "visa_support", "hotel_details", "transport_details",
  ];
  if (informationalIntents.includes(detectedIntent)) return true;
  const questionWords =
    /ne zaman|kaç|nedir|nereden|nasıl|hangi|var mı|kaçta|ne kadar|müsait mi|uygun mu|mevcut mu|fiyat|ücret|tarih|program|detay|kaç gün|nerede|hangi otel|nasıl gidilir|saat|adres|iletişim|telefon kaç|nerede buluyor|\?/i;
  return questionWords.test(userMessage);
}

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
  // Yelda fix: kapısız merge
  if (!merged.fullName && extracted.fullName && extracted.fullName !== "") merged.fullName = extracted.fullName;
  if (!merged.phone && extracted.phone && extracted.phone !== "") merged.phone = extracted.phone;
  return merged;
}

function determineCollectionStep(info, collectEmail) {
  if (!info.dateId) return "waiting_for_date";
  if (!info.paxAdult) return "waiting_for_pax";
  if (!info.fullName) return "waiting_for_name";
  if (!info.phone) return "waiting_for_phone";
  if (collectEmail && !info.email && !info.emailSkipped) return "waiting_for_email";
  return "ready_for_confirmation";
}

function isAllInfoCollected(info, collectEmail) {
  const basicDone = !!(info.tourId && info.dateId && info.paxAdult && info.fullName && info.phone);
  if (!basicDone) return false;
  if (collectEmail) return !!(info.email || info.emailSkipped);
  return true;
}

function detectConfirmation(message, language) {
  const msg = message.toLowerCase().trim();
  const negativePatterns = {
    tr: /\b(ama|fakat|ancak|lakin|değil|yok|hayır|istemiyorum|vazgeçtim|olmaz|bekle|dur|aslında|sanki|acaba|mı\?|mi\?|değil mi|yanlış|hata|hatalı)\b/i,
    en: /\b(but|however|except|not|no|don't|wait|hold|change|actually|wrong|mistake|rather|instead|unless)\b/i,
    de: /\b(aber|jedoch|nicht|nein|warte|ändern|eigentlich|falsch|stattdessen)\b/i,
    fr: /\b(mais|cependant|non|pas|attends|changer|plutôt|en fait|faux)\b/i,
    es: /\b(pero|sin embargo|no|espera|cambiar|en realidad|incorrecto|equivocado)\b/i,
    ru: /\b(но|однако|нет|не|подожди|изменить|вообще-то|неправильно|ошибка)\b/i,
    ar: /\b(لكن|لا|ليس|انتظر|تغيير|في الواقع|خطأ)\b/i,
  };
  const positivePatterns = {
    tr: /\b(evet|onayl[ıi]yorum|tamam|ok|olur|kabul|do[ğg]ru|onayla|tasdik|kesinlikle|tamamdır|onaylıorum|peki|tabii)\b/i,
    en: /\b(yes|confirm|approve|ok|okay|sure|right|correct|definitely|agreed|deal|absolutely)\b/i,
    de: /\b(ja|best[äa]tigen|ok|richtig|genau|stimmt|einverstanden|natürlich)\b/i,
    fr: /\b(oui|confirme|d'accord|ok|exact|parfait|absolument)\b/i,
    es: /\b(si|s[íi]|confirmo|vale|ok|correcto|claro|exacto)\b/i,
    ru: /\b(да|подтверждаю|ок|верно|правильно|согласен|конечно)\b/i,
    ar: /\b(نعم|أكد|موافق|تمام|صحيح|بالتأكيد)\b/i,
  };
  const langKey = language;
  const hasPositive =
    (positivePatterns[langKey]?.test(msg) ?? false) ||
    positivePatterns.tr.test(msg) ||
    positivePatterns.en.test(msg);
  if (!hasPositive) return false;
  const hasNegative =
    (negativePatterns[langKey]?.test(msg) ?? false) ||
    negativePatterns.en.test(msg);
  return !hasNegative;
}

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
  const hasCancel = (patterns[language]?.test(text) ?? false) || patterns.en.test(text);
  if (!hasCancel) return false;
  const continuationGuard =
    /\b(ama|fakat|ancak|yine de|gene de|but|however|though|although|aber|jedoch|trotzdem|cependant|néanmoins|toutefois|pero|sin embargo|no obstante|однако|но|тем не менее|لكن|مع ذلك|ولكن)\b/i;
  if (continuationGuard.test(text)) return false;
  return true;
}

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
  return (patterns[language]?.test(text) ?? false) || patterns.en.test(text);
}

function createInitialContext(language = "tr") {
  return {
    stage: "GREETING",
    currentTour: null,
    viewedTours: [],
    reservationInfo: {},
    reservationConfirmed: false,
    paymentInfoSent: false,
    language,
    tone: "standart",
    messageCount: 0,
    lastUserMessage: "",
    sessionStarted: new Date(0).toISOString(),
    lastUpdated: new Date(0).toISOString(),
    isNewReservation: false,
  };
}

// ─── Transitions (state-machine.ts ile birebir, fix'ler dahil) ───────
function processTransition(context, input) {
  const ctx = context;
  const msg = input.userMessage;
  const intent = input.detectedIntent;
  const lang = input.language || ctx.language || "tr";

  // İptal transitions (TOUR_SELECTED/COLLECTING_INFO/CONFIRMING → BROWSING)
  if (["TOUR_SELECTED", "COLLECTING_INFO", "CONFIRMING"].includes(ctx.stage) && detectCancellation(msg, lang)) {
    return {
      ...ctx, stage: "BROWSING", currentTour: null, reservationInfo: {},
      reservationConfirmed: false, collectionStep: undefined, justCancelled: true,
      lastUpdated: new Date(0).toISOString(), messageCount: ctx.messageCount + 1,
    };
  }

  // GREETING → TOUR_SELECTED
  if (ctx.stage === "GREETING" && input.selectedTour !== null) {
    return {
      ...ctx, stage: "TOUR_SELECTED", currentTour: input.selectedTour,
      viewedTours: [...ctx.viewedTours, input.selectedTour.id],
      reservationInfo: { tourId: input.selectedTour.id, tourTitle: input.selectedTour.title },
      lastUpdated: new Date(0).toISOString(), messageCount: ctx.messageCount + 1,
    };
  }
  // GREETING → BROWSING
  if (ctx.stage === "GREETING" && input.selectedTour === null &&
      ["browse_tours","tour_search","greeting","general"].includes(intent)) {
    return { ...ctx, stage: "BROWSING", lastUpdated: new Date(0).toISOString(), messageCount: ctx.messageCount + 1 };
  }

  // BROWSING → COLLECTING_INFO (rezervasyon intent + tur)
  if (ctx.stage === "BROWSING") {
    const hasTour = input.selectedTour !== null || ctx.currentTour !== null;
    const isRes = ["reservation_intent","tour_selected","provide_info","confirm"].includes(intent);
    if (hasTour && isRes) {
      const tour = input.selectedTour || ctx.currentTour;
      const merged = mergeReservationInfo({ tourId: tour.id, tourTitle: tour.title }, input.extractedInfo, false);
      return {
        ...ctx, stage: "COLLECTING_INFO", currentTour: tour,
        viewedTours: input.selectedTour ? [...ctx.viewedTours, input.selectedTour.id] : ctx.viewedTours,
        reservationInfo: merged, collectionStep: determineCollectionStep(merged, ctx.collectEmail),
        lastUpdated: new Date(0).toISOString(), messageCount: ctx.messageCount + 1,
      };
    }
    // BROWSING → TOUR_SELECTED
    if (input.selectedTour !== null && !["reservation_intent","tour_selected","provide_info","confirm"].includes(intent)) {
      return {
        ...ctx, stage: "TOUR_SELECTED", currentTour: input.selectedTour,
        viewedTours: [...ctx.viewedTours, input.selectedTour.id],
        reservationInfo: { tourId: input.selectedTour.id, tourTitle: input.selectedTour.title },
        lastUpdated: new Date(0).toISOString(), messageCount: ctx.messageCount + 1,
      };
    }
  }

  // TOUR_SELECTED → COLLECTING_INFO
  if (ctx.stage === "TOUR_SELECTED") {
    // 2026-06-19: Açık rezervasyon/olumlu pattern her zaman geç — NLU "general" döndürse
    // bile (isInformational true) bu pattern'ler net niyet ifadesidir. Mirror — state-machine.ts ile senkron.
    const reservationPattern = /\b(rezervasyon|reservation|booking|book|reservar|réserver|buchen|бронирование|حجز)\b/i;
    const positivePattern = /^\s*(evet|tamam|olur|peki|tabii|yes|ok(?:ay)?|sure|ja|oui|s[íi]|да|نعم)\b/i;
    const matchesPattern = reservationPattern.test(msg) || positivePattern.test(msg);
    const isInfo = isInformationalMessage(msg, intent);
    if (matchesPattern || !isInfo) {
      const reservationIntents = ["reservation_intent","provide_info","confirm","tour_selected"];
      const hasExtracted = Object.keys(input.extractedInfo).length > 0;
      const hasPaxPattern = /\d+\s*(kişi|person|people|yetişkin|adult|çocuk|child)/i.test(msg);
      const hasPhonePattern = /\b05\d{9}\b|\b\+\d{7,}/i.test(msg);
      const hasDateInfo = !!input.extractedInfo.selectedDate || !!input.extractedInfo.dateId;
      const shouldGo = matchesPattern || reservationIntents.includes(intent) || (hasExtracted && (hasPaxPattern || hasPhonePattern || hasDateInfo));
      if (shouldGo) {
        const merged = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo, false);
        return {
          ...ctx, stage: "COLLECTING_INFO", reservationInfo: merged,
          collectionStep: determineCollectionStep(merged, ctx.collectEmail), isNewReservation: false,
          lastUpdated: new Date(0).toISOString(), messageCount: ctx.messageCount + 1,
        };
      }
    }
    // TOUR_SELECTED → TOUR_SELECTED (tur değişimi, Özge fix)
    if (input.selectedTour !== null && input.selectedTour.id !== ctx.currentTour?.id &&
        Object.keys(ctx.reservationInfo).length <= 2) {
      return {
        ...ctx, stage: "TOUR_SELECTED", currentTour: input.selectedTour,
        viewedTours: [...ctx.viewedTours, input.selectedTour.id],
        reservationInfo: {
          ...ctx.reservationInfo, tourId: input.selectedTour.id, tourTitle: input.selectedTour.title,
          dateId: undefined, selectedDate: undefined,
        },
        collectionStep: "waiting_for_date",
        lastUpdated: new Date(0).toISOString(), messageCount: ctx.messageCount + 1,
      };
    }
  }

  // COLLECTING_INFO → TOUR_SELECTED (tur değişimi, Özge fix)
  if (ctx.stage === "COLLECTING_INFO" && input.selectedTour !== null &&
      input.selectedTour.id !== ctx.currentTour?.id) {
    const tcRegex = /yeni tur|başka tur|tur değiştir|switch tour|change tour|different tour|farklı tur|diğer tur|tur\s*değişt|aslında\s+.{0,20}?tur|bunun\s+yerine\s+.{0,20}?tur/i;
    if (tcRegex.test(msg) || intent === "reservation_intent") {
      return {
        ...ctx, stage: "TOUR_SELECTED", currentTour: input.selectedTour,
        viewedTours: [...ctx.viewedTours, input.selectedTour.id],
        reservationInfo: {
          ...ctx.reservationInfo, tourId: input.selectedTour.id, tourTitle: input.selectedTour.title,
          dateId: undefined, selectedDate: undefined,
        },
        collectionStep: "waiting_for_date",
        lastUpdated: new Date(0).toISOString(), messageCount: ctx.messageCount + 1,
      };
    }
  }

  // COLLECTING_INFO → CONFIRMING (Hayriye fix: "general" yok)
  if (ctx.stage === "COLLECTING_INFO" && !isInformationalMessage(msg, intent)) {
    const validIntents = ["provide_info", "confirm", "confirm_reservation"]; // "general" SİLİNDİ
    if (validIntents.includes(intent)) {
      const merged = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo, false);
      if (isAllInfoCollected(merged, ctx.collectEmail)) {
        return {
          ...ctx, stage: "CONFIRMING", reservationInfo: merged,
          collectionStep: "ready_for_confirmation",
          lastUpdated: new Date(0).toISOString(), messageCount: ctx.messageCount + 1,
        };
      }
    }
  }

  // CONFIRMING → COMPLETED (Tulay fix 2026-06-19: NLU confirm_reservation
  // tek başına yetmez; mesaj kısa + rakamsız + net positive kelime şart)
  if (ctx.stage === "CONFIRMING") {
    let shouldComplete = false;
    if (detectConfirmation(msg, lang)) shouldComplete = true;
    else if (!isInformationalMessage(msg, intent) && intent === "confirm_reservation") {
      const trimmed = msg.trim();
      if (trimmed.length <= 20 && !/\d/.test(trimmed)) {
        const clearPositive = /\b(evet|tamam|onayl[ıi]yorum|onaylıyorum|onayla|onayladım|tasdik|kabul|do[ğg]ru|olur|peki|tabii|yes|confirm|approve|okay|ok|sure|right|correct|agreed|ja|oui|si|s[íi]|да|подтверждаю|نعم|أكد|d'accord)\b/i;
        if (clearPositive.test(trimmed)) shouldComplete = true;
      }
    }
    if (shouldComplete) {
      return {
        ...ctx, stage: "COMPLETED", reservationConfirmed: true, collectionStep: undefined,
        lastUpdated: new Date(0).toISOString(), messageCount: ctx.messageCount + 1,
      };
    }
  }

  // COLLECTING_INFO → COLLECTING_INFO (default merge — allInfoCollected false ise)
  if (ctx.stage === "COLLECTING_INFO") {
    const isInfo = isInformationalMessage(msg, intent);
    const merged = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo, isInfo);
    if (!isAllInfoCollected(merged, ctx.collectEmail)) {
      return {
        ...ctx, reservationInfo: merged,
        collectionStep: determineCollectionStep(merged, ctx.collectEmail),
        lastUpdated: new Date(0).toISOString(), messageCount: ctx.messageCount + 1,
      };
    }
    // Fallback (state-machine.ts:820-832) — allInfoCollected true ama
    // CONFIRMING'e geçecek transition tetiklenmedi (örn. intent="general"):
    // state'i merge ile güncelle ama stage COLLECTING_INFO'da kalsın.
    if (Object.keys(input.extractedInfo).length > 0) {
      return {
        ...ctx, reservationInfo: merged,
        collectionStep: determineCollectionStep(merged, ctx.collectEmail),
        lastUpdated: new Date(0).toISOString(), messageCount: ctx.messageCount + 1,
      };
    }
  }

  // No transition — keep state
  return { ...ctx, lastUpdated: new Date(0).toISOString(), messageCount: ctx.messageCount + 1 };
}

// ─── Process-message orchestration mirror (stage-koruma + B-6) ────────
function processMessage(state, msgInput) {
  const ctx = state;
  let intent = msgInput.detectedIntent;

  // B-2 stage-koruma
  if ((ctx.stage === "COLLECTING_INFO" || ctx.stage === "CONFIRMING") &&
      (intent === "tour_search" || intent === "reservation_intent")) {
    intent = "provide_info";
  }

  // B-6 CONFIRMING'de "hayır" → state korunur, deterministik netleştirme
  if (ctx.stage === "CONFIRMING" && detectNegativeResponse(msgInput.userMessage, ctx.language)) {
    return {
      ...ctx, lastUpdated: new Date(0).toISOString(), messageCount: ctx.messageCount + 1,
      __botSaid: "negative_clarification",
    };
  }

  // Negative pax kontrolü (process-message gerçek logic)
  if (ctx.collectionStep === "waiting_for_pax" && /^\s*(0|sıfır|zero)\s*(kişi|person)?\s*$/i.test(msgInput.userMessage)) {
    return { ...ctx, __botSaid: "invalid_pax_negative", lastUpdated: new Date(0).toISOString(), messageCount: ctx.messageCount + 1 };
  }
  if (msgInput.extractedInfo?.paxAdult && msgInput.extractedInfo.paxAdult > 50) {
    return { ...ctx, __botSaid: "pax_too_large", lastUpdated: new Date(0).toISOString(), messageCount: ctx.messageCount + 1 };
  }

  const input = { ...msgInput, detectedIntent: intent };
  const newCtx = processTransition(ctx, input);

  // Bot davranışı simülasyonu (deterministic — stage'e göre):
  let botSaid;
  if (newCtx.stage === "COMPLETED" && newCtx.reservationConfirmed) botSaid = "completed";
  else if (newCtx.stage === "CONFIRMING") botSaid = "ask_confirm";
  else if (newCtx.stage === "COLLECTING_INFO") botSaid = "ask_" + (newCtx.collectionStep || "info");
  else if (newCtx.stage === "TOUR_SELECTED") botSaid = "tour_info";
  else if (newCtx.stage === "BROWSING") botSaid = newCtx.justCancelled ? "cancelled" : "browse";
  else botSaid = "greet";

  return { ...newCtx, __botSaid: botSaid };
}

// ─── Test runner ─────────────────────────────────────────────────────
let totalTests = 0, passedTests = 0, scenarioPasses = 0, scenarioFails = 0;
const failures = [];

function runScenario(name, language, steps) {
  totalTests++;
  let state = createInitialContext(language);
  // Tüm senaryolar BROWSING durumundan başlar (gerçek hayatta kullanıcı
  // konuşmaya bir karşılama mesajıyla giriyor olabilir veya direkt tur
  // adı yazabiliyor; FSM tasarımı GREETING → BROWSING'i greeting/general
  // intent ile geçiyor). Her senaryo başına explicit greeting eklemek
  // yerine harness GREETING'i otomatik geçer — testler tur seçim
  // adımından başlasın diye.
  if (steps.length > 0 && steps[0].msg !== "merhaba" && steps[0].msg !== "hello" && steps[0].msg !== "hallo") {
    state = processMessage(state, {
      userMessage: "merhaba", detectedIntent: "greeting",
      extractedInfo: {}, selectedTour: null, language,
    });
  }
  let stepIdx = 0;
  for (const step of steps) {
    stepIdx++;
    const result = processMessage(state, {
      userMessage: step.msg, detectedIntent: step.intent,
      extractedInfo: step.extracted || {}, selectedTour: step.selectedTour || null,
      language,
    });
    // Expect checks
    for (const [key, expected] of Object.entries(step.expect || {})) {
      const actual = key.split(".").reduce((o, k) => o?.[k], result);
      if (actual !== expected) {
        failures.push({ scenario: name, step: stepIdx, msg: step.msg, key, expected, actual });
        scenarioFails++;
        console.log(`✗ [${name}] step${stepIdx} "${step.msg}": ${key}=${JSON.stringify(actual)}, expected=${JSON.stringify(expected)}`);
        return false;
      }
    }
    state = result;
  }
  passedTests++;
  scenarioPasses++;
  console.log(`✓ [${name}] tamamlandı (${stepIdx} step)`);
  return true;
}

// ═══════════════════════════════════════════════════════════════════════
// SENARYOLAR
// ═══════════════════════════════════════════════════════════════════════

const TOUR = { id: "T_PAMUKKALE", title: "Pamukkale Turu" };
const TOUR_KAP = { id: "T_KAPADOKYA", title: "Kapadokya Turu" };

// === 1. Düz akış TR (happy path) ===
runScenario("S1: Düz akış TR", "tr", [
  { msg: "merhaba", intent: "greeting", expect: { stage: "BROWSING" } },
  { msg: "Pamukkale turunu istiyorum", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title },
    expect: { stage: "COLLECTING_INFO", collectionStep: "waiting_for_date" } },
  { msg: "12 Aralık", intent: "provide_info", extracted: { selectedDate: "2026-12-12", dateId: "D_12ARA" },
    expect: { collectionStep: "waiting_for_pax", "reservationInfo.dateId": "D_12ARA" } },
  { msg: "2 kişi", intent: "provide_info", extracted: { paxAdult: 2 },
    expect: { collectionStep: "waiting_for_name", "reservationInfo.paxAdult": 2 } },
  { msg: "Ayşe Yılmaz", intent: "provide_info", extracted: { fullName: "Ayşe Yılmaz" },
    expect: { collectionStep: "waiting_for_phone", "reservationInfo.fullName": "Ayşe Yılmaz" } },
  { msg: "05551234567", intent: "provide_info", extracted: { phone: "905551234567" },
    expect: { stage: "CONFIRMING", "reservationInfo.phone": "905551234567" } },
  { msg: "evet", intent: "confirm_reservation",
    expect: { stage: "COMPLETED", reservationConfirmed: true } },
]);

// === 2. Tarih onay ekiyle ("14 aralık olur" / "14 ARALIK" / "tamam") ===
// Bu seviyede normalizeDateString preprocessor'a güveniyoruz (önceki test bu işi yapıyor).
// E2E için extractedInfo'da "dateId" var sayıyoruz — parser doğru çalıştığı varsayımıyla.
runScenario("S2: Tarih 'olur' eki ile", "tr", [
  { msg: "Pamukkale", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title },
    expect: { stage: "COLLECTING_INFO" } },
  { msg: "14 aralık olur", intent: "provide_info", extracted: { selectedDate: "2026-12-14", dateId: "D_14ARA" },
    expect: { collectionStep: "waiting_for_pax", "reservationInfo.dateId": "D_14ARA" } },
  { msg: "1 kişi", intent: "provide_info", extracted: { paxAdult: 1 }, expect: { collectionStep: "waiting_for_name" } },
  { msg: "Ali Veli", intent: "provide_info", extracted: { fullName: "Ali Veli" }, expect: { collectionStep: "waiting_for_phone" } },
  { msg: "05551112233", intent: "provide_info", extracted: { phone: "905551112233" }, expect: { stage: "CONFIRMING" } },
  { msg: "evet", intent: "confirm_reservation", expect: { stage: "COMPLETED" } },
]);

// === 3. Sıra dışı: isim önce, sonra pax ===
runScenario("S3: İsim önce, pax sonra", "tr", [
  { msg: "Pamukkale", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title },
    expect: { stage: "COLLECTING_INFO" } },
  { msg: "15 Aralık", intent: "provide_info", extracted: { selectedDate: "2026-12-15", dateId: "D_15" },
    expect: { collectionStep: "waiting_for_pax" } },
  // Kullanıcı pax sorulduğunda hem pax hem isim verir (yelda merge fix sayesinde ikisi de yazılır)
  { msg: "3 kişi, ben Murat Tekin", intent: "provide_info", extracted: { paxAdult: 3, fullName: "Murat Tekin" },
    expect: { collectionStep: "waiting_for_phone", "reservationInfo.paxAdult": 3, "reservationInfo.fullName": "Murat Tekin" } },
  { msg: "05559998877", intent: "provide_info", extracted: { phone: "905559998877" }, expect: { stage: "CONFIRMING" } },
]);

// === 4. Tur ortada değişir (Özge fix) ===
runScenario("S4: Tur ortada değişir, pax/isim korunur", "tr", [
  { msg: "Pamukkale", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title },
    expect: { stage: "COLLECTING_INFO" } },
  { msg: "12 Aralık", intent: "provide_info", extracted: { selectedDate: "2026-12-12", dateId: "D1" }, expect: { collectionStep: "waiting_for_pax" } },
  { msg: "2 kişi", intent: "provide_info", extracted: { paxAdult: 2 }, expect: { collectionStep: "waiting_for_name" } },
  { msg: "Ahmet Kaya", intent: "provide_info", extracted: { fullName: "Ahmet Kaya" }, expect: { collectionStep: "waiting_for_phone" } },
  // Tur değişir — mesajda "tur" kelimesi GEREK (regex tetiklensin diye).
  // B-2 stage-koruma reservation_intent'i provide_info'ya çevirir, bu yüzden
  // sadece pattern match tur değişimini tetikler. Gerçek hayatta kullanıcı
  // genelde "tur"/"turuna" kelimesini kullanır. Bu, kasıt-belirsiz mesajların
  // (örn. "Kapadokya da güzelmiş") yanlışlıkla rezervasyonu sıfırlamasını da önler.
  { msg: "aslında Kapadokya turuna geçeyim", intent: "reservation_intent", selectedTour: TOUR_KAP, extracted: {},
    expect: { stage: "TOUR_SELECTED", "reservationInfo.tourId": TOUR_KAP.id,
              "reservationInfo.paxAdult": 2, "reservationInfo.fullName": "Ahmet Kaya",
              "reservationInfo.dateId": undefined } },
]);

// === 5. Tekrar bilgi verme — state'te dolu, korumalı ===
runScenario("S5: Telefon adımında isim tekrar verilir, korunur", "tr", [
  { msg: "Pamukkale", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title }, expect: { stage: "COLLECTING_INFO" } },
  { msg: "12 Aralık", intent: "provide_info", extracted: { dateId: "D1" }, expect: { collectionStep: "waiting_for_pax" } },
  { msg: "1 kişi", intent: "provide_info", extracted: { paxAdult: 1 }, expect: { collectionStep: "waiting_for_name" } },
  { msg: "Mehmet Demir", intent: "provide_info", extracted: { fullName: "Mehmet Demir" }, expect: { collectionStep: "waiting_for_phone" } },
  // Kullanıcı zaten verdiği ismi tekrar belirtir
  { msg: "ismim Mehmet Demir demiştim", intent: "provide_info", extracted: { fullName: "Mehmet Demir" },
    expect: { "reservationInfo.fullName": "Mehmet Demir" } },
]);

// === 6. Onayda "hayır" — state korunur, COMPLETED'a GEÇMEZ (B-6) ===
runScenario("S6: CONFIRMING'de 'hayır' → state korunur, completed DEĞİL", "tr", [
  { msg: "Pamukkale", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title }, expect: { stage: "COLLECTING_INFO" } },
  { msg: "12 Aralık", intent: "provide_info", extracted: { dateId: "D1" }, expect: { collectionStep: "waiting_for_pax" } },
  { msg: "1 kişi", intent: "provide_info", extracted: { paxAdult: 1 }, expect: { collectionStep: "waiting_for_name" } },
  { msg: "Zeynep Aksu", intent: "provide_info", extracted: { fullName: "Zeynep Aksu" }, expect: { collectionStep: "waiting_for_phone" } },
  { msg: "05552223344", intent: "provide_info", extracted: { phone: "905552223344" }, expect: { stage: "CONFIRMING" } },
  // CONFIRMING'de "hayır" — B-6 deterministik netleştirme, state KORUNUR
  { msg: "hayır", intent: "general",
    expect: { stage: "CONFIRMING", reservationConfirmed: false, __botSaid: "negative_clarification",
              "reservationInfo.fullName": "Zeynep Aksu", "reservationInfo.phone": "905552223344" } },
]);

// === 7. Onayda "vazgeçtim" — iptal, state temizlenir ===
runScenario("S7: CONFIRMING'de 'vazgeçtim' → BROWSING, iptal", "tr", [
  { msg: "Pamukkale", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title }, expect: { stage: "COLLECTING_INFO" } },
  { msg: "12 Aralık", intent: "provide_info", extracted: { dateId: "D1" }, expect: { collectionStep: "waiting_for_pax" } },
  { msg: "1 kişi", intent: "provide_info", extracted: { paxAdult: 1 }, expect: { collectionStep: "waiting_for_name" } },
  { msg: "Burak Yıldız", intent: "provide_info", extracted: { fullName: "Burak Yıldız" }, expect: { collectionStep: "waiting_for_phone" } },
  { msg: "05554443322", intent: "provide_info", extracted: { phone: "905554443322" }, expect: { stage: "CONFIRMING" } },
  { msg: "vazgeçtim", intent: "general",
    expect: { stage: "BROWSING", justCancelled: true, reservationConfirmed: false } },
]);

// === 8. Geçersiz pax: "0 kişi" reddedilmeli ===
runScenario("S8: '0 kişi' reddedilir, state ilerlemez", "tr", [
  { msg: "Pamukkale", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title }, expect: { stage: "COLLECTING_INFO" } },
  { msg: "12 Aralık", intent: "provide_info", extracted: { dateId: "D1" }, expect: { collectionStep: "waiting_for_pax" } },
  { msg: "0 kişi", intent: "provide_info", extracted: { paxAdult: 0 },
    expect: { collectionStep: "waiting_for_pax", __botSaid: "invalid_pax_negative" } },
]);

// === 9. Geçersiz pax: "100 kişi" reddedilmeli ===
runScenario("S9: '100 kişi' grup → reddedilir (50+ kişi)", "tr", [
  { msg: "Pamukkale", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title }, expect: { stage: "COLLECTING_INFO" } },
  { msg: "12 Aralık", intent: "provide_info", extracted: { dateId: "D1" }, expect: { collectionStep: "waiting_for_pax" } },
  { msg: "100 kişi", intent: "provide_info", extracted: { paxAdult: 100 },
    expect: { collectionStep: "waiting_for_pax", __botSaid: "pax_too_large" } },
]);

// === 10. Tereddüt ifadesi ile devam (B-4 guard) ===
runScenario("S10: 'düşüneyim ama Pamukkale güzel' → iptal DEĞİL", "tr", [
  { msg: "Pamukkale", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title }, expect: { stage: "COLLECTING_INFO" } },
  // "düşüneyim ama" — devam bağlacı varsa iptal DEĞİL
  { msg: "biraz düşüneyim ama Pamukkale güzel görünüyor", intent: "general", extracted: {},
    expect: { stage: "COLLECTING_INFO", justCancelled: undefined } },
]);

// === 11. Bug 2 verify: "general" intent CONFIRMING'e atlamaz ===
// Hayriye case'inde NLU bazen telefon mesajına "general" intent dönüyordu.
// Eski kod: CONFIRMING'e atlardı → bir sonraki turda COMPLETED'a sıçrardı (onay atlanırdı).
// Yeni kod: "general" valid intent listesinden çıkarıldı + isInformationalMessage true →
// CONFIRMING'e ATLAMAZ + extracted IGNORE (state korunur). Bot tekrar telefon ister, kullanıcı
// gerçek provide_info ile verir.
runScenario("S11: 'general' intent → CONFIRMING'e ATLAMAZ + state korunur", "tr", [
  { msg: "Pamukkale", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title }, expect: { stage: "COLLECTING_INFO" } },
  { msg: "12 Aralık", intent: "provide_info", extracted: { dateId: "D1" }, expect: { collectionStep: "waiting_for_pax" } },
  { msg: "1 kişi", intent: "provide_info", extracted: { paxAdult: 1 }, expect: { collectionStep: "waiting_for_name" } },
  { msg: "Hayriye Hayre", intent: "provide_info", extracted: { fullName: "Hayriye Hayre" }, expect: { collectionStep: "waiting_for_phone" } },
  // Bu mesaj NLU'dan "general" döner — eski kod CONFIRMING'e atlardı, yeni kod ATLAMAZ.
  // isInformationalMessage("general")=true → merge skip; bu kabul edilebilir çünkü bot
  // tekrar telefon ister, kullanıcı doğru intent ile (provide_info) yeniden verir.
  { msg: "05445652525", intent: "general", extracted: { phone: "905445652525" },
    expect: { stage: "COLLECTING_INFO", collectionStep: "waiting_for_phone",
              "reservationInfo.fullName": "Hayriye Hayre" } },
  // Şimdi doğru intent ile telefon verilir → CONFIRMING
  { msg: "05445652525", intent: "provide_info", extracted: { phone: "905445652525" },
    expect: { stage: "CONFIRMING", "reservationInfo.phone": "905445652525" } },
  { msg: "evet", intent: "confirm_reservation",
    expect: { stage: "COMPLETED", reservationConfirmed: true } },
]);

// === 12. EN dili happy path ===
runScenario("S12: EN happy path", "en", [
  { msg: "hello", intent: "greeting", expect: { stage: "BROWSING" } },
  { msg: "I want Pamukkale", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title }, expect: { stage: "COLLECTING_INFO" } },
  { msg: "December 12", intent: "provide_info", extracted: { dateId: "D1" }, expect: { collectionStep: "waiting_for_pax" } },
  { msg: "2 people", intent: "provide_info", extracted: { paxAdult: 2 }, expect: { collectionStep: "waiting_for_name" } },
  { msg: "John Smith", intent: "provide_info", extracted: { fullName: "John Smith" }, expect: { collectionStep: "waiting_for_phone" } },
  { msg: "+15551234567", intent: "provide_info", extracted: { phone: "15551234567" }, expect: { stage: "CONFIRMING" } },
  { msg: "yes", intent: "confirm_reservation", expect: { stage: "COMPLETED", reservationConfirmed: true } },
]);

// === 14. Tulay bug: NLU yanlışlıkla confirm_reservation döndürse bile
// mesaj clear positive değilse (isim/uzun) COMPLETED'a GEÇMEZ ===
runScenario("S14: 'tulay tabi' CONFIRMING'de COMPLETED'a ATLAMAZ", "tr", [
  { msg: "Pamukkale", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title }, expect: { stage: "COLLECTING_INFO" } },
  { msg: "10 aralık", intent: "provide_info", extracted: { dateId: "D1" }, expect: { collectionStep: "waiting_for_pax" } },
  { msg: "1 kişi", intent: "provide_info", extracted: { paxAdult: 1 }, expect: { collectionStep: "waiting_for_name" } },
  { msg: "Tulay Tubi", intent: "provide_info", extracted: { fullName: "Tulay Tubi" }, expect: { collectionStep: "waiting_for_phone" } },
  { msg: "05415897896", intent: "provide_info", extracted: { phone: "905415897896" }, expect: { stage: "CONFIRMING" } },
  // KRİTİK: NLU "tulay tabi"yi yanlış confirm_reservation olarak yorumlasa bile
  // mesaj "Tulay" içeriyor (5+ harf, clearPositive değil) → COMPLETED'a ATLAMAZ
  { msg: "tulay tabi", intent: "confirm_reservation",
    expect: { stage: "CONFIRMING", reservationConfirmed: false } },
  // Doğru "evet" → COMPLETED
  { msg: "evet", intent: "confirm_reservation",
    expect: { stage: "COMPLETED", reservationConfirmed: true } },
]);

// === 15. Regresyon: kısa "evet"/"tamam"/"onaylıyorum" mesajları hâlâ COMPLETED'a geçirir ===
runScenario("S15: Kısa onay mesajları (evet/tamam) COMPLETED'a geçirir", "tr", [
  { msg: "Pamukkale", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title }, expect: { stage: "COLLECTING_INFO" } },
  { msg: "10 aralık", intent: "provide_info", extracted: { dateId: "D1" }, expect: { collectionStep: "waiting_for_pax" } },
  { msg: "1 kişi", intent: "provide_info", extracted: { paxAdult: 1 }, expect: { collectionStep: "waiting_for_name" } },
  { msg: "Test Kullanıcı", intent: "provide_info", extracted: { fullName: "Test Kullanıcı" }, expect: { collectionStep: "waiting_for_phone" } },
  { msg: "05551112233", intent: "provide_info", extracted: { phone: "905551112233" }, expect: { stage: "CONFIRMING" } },
  { msg: "tamam", intent: "confirm_reservation",
    expect: { stage: "COMPLETED", reservationConfirmed: true } },
]);

// === 16. Tarih listesi tetikleyici fallback: NLU intent kaçırsa bile
// rezervasyon/olumlu pattern TOUR_SELECTED → COLLECTING_INFO+waiting_for_date geçişini garanti eder.
// Bu olmadan deterministik tarih listesi (process-message line 519) tetiklenmez,
// LLM "Hangi tarihte?" der ama listeyi göstermez. ===
runScenario("S16: 'rezervasyon' sözcüğü NLU general olsa bile transition tetikler", "tr", [
  // 1) Tur sorulur — BROWSING → TOUR_SELECTED (selectedTour var, reservation_intent değil)
  { msg: "Kapadokya turu nedir?", intent: "tour_search", selectedTour: TOUR_KAP,
    extracted: {},
    expect: { stage: "TOUR_SELECTED", "currentTour.id": TOUR_KAP.id } },
  // 2) Bot "Bilgi mi rezervasyon mu?" sorar. Kullanıcı "rezervasyon" der ama
  //    NLU bunu yanlışlıkla "general" olarak yorumlar (extractedInfo da boş).
  //    Pattern fallback olmadan transition GERÇEKLEŞMEZDİ, TOUR_SELECTED'da takılırdı.
  { msg: "rezervasyon yapmak istiyorum", intent: "general", extracted: {},
    expect: { stage: "COLLECTING_INFO", collectionStep: "waiting_for_date" } },
]);

// === 17. Aynı bug, sade "evet" cevabı ile (NLU general dönerse) ===
runScenario("S17: 'evet' olumlu cevabı pattern fallback ile transition tetikler", "tr", [
  { msg: "Kapadokya turu nedir?", intent: "tour_search", selectedTour: TOUR_KAP,
    extracted: {},
    expect: { stage: "TOUR_SELECTED", "currentTour.id": TOUR_KAP.id } },
  // NLU "evet"i confirm yerine general olarak yorumlasa bile pattern yakalar.
  { msg: "evet", intent: "general", extracted: {},
    expect: { stage: "COLLECTING_INFO", collectionStep: "waiting_for_date" } },
]);

// === 18. Regresyon: bilgi sorusu (informational) transition tetiklemez ===
runScenario("S18: bilgi sorusu TOUR_SELECTED'da bırakır (pattern false-positive yok)", "tr", [
  { msg: "Kapadokya turu nedir?", intent: "tour_search", selectedTour: TOUR_KAP,
    extracted: {},
    expect: { stage: "TOUR_SELECTED" } },
  // Bilgi sorusu — isInformationalMessage true → transition GERÇEKLEŞMEZ.
  { msg: "Tur kaç gün sürüyor?", intent: "tour_info", extracted: {},
    expect: { stage: "TOUR_SELECTED" } },
]);

// === 19. Tuğçe canlı bug (2026-06-19): isim adımında pax/tarih KAYBOLMAZ;
// state doğru waiting_for_phone'a geçer (LLM-state senkron bug'ı stages/index.ts'te
// kötü-örnek dikta ile çözüldü; bu senaryo state regresyonunu kapsar). ===
runScenario("S19: 'tuğçe görüşük' — isim mesajı pax'i SİLMEZ, telefon adımına geçer", "tr", [
  { msg: "Antalya turu", intent: "reservation_intent", selectedTour: TOUR_KAP,
    extracted: { tourId: TOUR_KAP.id, tourTitle: TOUR_KAP.title }, expect: { stage: "COLLECTING_INFO" } },
  { msg: "12 aralık", intent: "provide_info", extracted: { dateId: "D_12ARA", selectedDate: "2026-12-12" },
    expect: { collectionStep: "waiting_for_pax" } },
  { msg: "1 kişi", intent: "provide_info", extracted: { paxAdult: 1 },
    expect: { collectionStep: "waiting_for_name", "reservationInfo.paxAdult": 1 } },
  // KRİTİK: İsim mesajı işlenirken pax/tarih KORUNMALI, sıradaki adım TELEFON.
  // (Canlıda LLM "Kaç kişi?" dedi — state doğruydu, sadece LLM compliance hatası.)
  { msg: "tuğçe görüşük", intent: "provide_info", extracted: { fullName: "Tuğçe Görüşük" },
    expect: {
      collectionStep: "waiting_for_phone",
      "reservationInfo.paxAdult": 1,
      "reservationInfo.fullName": "Tuğçe Görüşük",
      "reservationInfo.dateId": "D_12ARA",
    } },
]);

// === 20. CONFIRMING tüm alanlar dolu — bilgi tekrar mesajı state'i bozmaz
// (Murat Bey canlı bug 2026-06-19): telefon adımından CONFIRMING'e geçiş sonrası
// kullanıcı tekrar telefon yazsa bile bot pax/isim/phone İSTEMEMELİ. State doğru,
// LLM-state senkron tek noktaya taşındı (buildFilledFieldsGuard). ===
runScenario("S20: CONFIRMING tam dolu — telefon yenilenmesi state'i bozmaz", "tr", [
  { msg: "Pamukkale", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title },
    expect: { stage: "COLLECTING_INFO" } },
  { msg: "12 aralık", intent: "provide_info", extracted: { dateId: "D1", selectedDate: "2026-12-12" },
    expect: { collectionStep: "waiting_for_pax" } },
  { msg: "2 kişi", intent: "provide_info", extracted: { paxAdult: 2 },
    expect: { collectionStep: "waiting_for_name" } },
  { msg: "Murat Aymilatur", intent: "provide_info", extracted: { fullName: "Murat Aymilatur" },
    expect: { collectionStep: "waiting_for_phone" } },
  { msg: "05551234545", intent: "provide_info", extracted: { phone: "905551234545" },
    expect: { stage: "CONFIRMING", "reservationInfo.phone": "905551234545" } },
  // KRİTİK: CONFIRMING'de kullanıcı telefon tekrar yazsa bile state hepsi dolu kalır,
  // CONFIRMING stage'inde pax/isim KORUNUR — Murat Bey bug regresyonu.
  { msg: "05551234545", intent: "provide_info", extracted: { phone: "905551234545" },
    expect: {
      stage: "CONFIRMING",
      "reservationInfo.phone": "905551234545",
      "reservationInfo.fullName": "Murat Aymilatur",
      "reservationInfo.paxAdult": 2,
      "reservationInfo.dateId": "D1",
    } },
]);

// === 21. Deterministik bypass: pax → name geçişi state regresyonu
// (Commit 3 — Murat bug kök düzeltmesi). Mirror'da state geçişi test edilir;
// bypass'ın metnini üreten process-message.ts bloğu prompt-content kontrolünde. ===
runScenario("S21: pax dolunca → waiting_for_name (deterministik bypass turn'ünün hazırlığı)", "tr", [
  { msg: "Pamukkale", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title },
    expect: { stage: "COLLECTING_INFO" } },
  { msg: "12 aralık", intent: "provide_info", extracted: { dateId: "D1", selectedDate: "2026-12-12" },
    expect: { collectionStep: "waiting_for_pax" } },
  { msg: "2 kişi", intent: "provide_info", extracted: { paxAdult: 2 },
    expect: { collectionStep: "waiting_for_name", "reservationInfo.paxAdult": 2 } },
]);

// === 22. Deterministik bypass: name → phone geçişi ===
runScenario("S22: isim dolunca → waiting_for_phone", "tr", [
  { msg: "Pamukkale", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title },
    expect: { stage: "COLLECTING_INFO" } },
  { msg: "12 aralık", intent: "provide_info", extracted: { dateId: "D1", selectedDate: "2026-12-12" },
    expect: { collectionStep: "waiting_for_pax" } },
  { msg: "2 kişi", intent: "provide_info", extracted: { paxAdult: 2 }, expect: { collectionStep: "waiting_for_name" } },
  { msg: "Ali Veli", intent: "provide_info", extracted: { fullName: "Ali Veli" },
    expect: { collectionStep: "waiting_for_phone", "reservationInfo.fullName": "Ali Veli" } },
]);

// === 23. Deterministik bypass: phone dolunca → CONFIRMING ===
runScenario("S23: telefon dolunca → CONFIRMING (bypass özet+onay üretecek)", "tr", [
  { msg: "Pamukkale", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title },
    expect: { stage: "COLLECTING_INFO" } },
  { msg: "12 aralık", intent: "provide_info", extracted: { dateId: "D1", selectedDate: "2026-12-12" },
    expect: { collectionStep: "waiting_for_pax" } },
  { msg: "2 kişi", intent: "provide_info", extracted: { paxAdult: 2 }, expect: { collectionStep: "waiting_for_name" } },
  { msg: "Ali Veli", intent: "provide_info", extracted: { fullName: "Ali Veli" }, expect: { collectionStep: "waiting_for_phone" } },
  { msg: "05551234567", intent: "provide_info", extracted: { phone: "905551234567" },
    expect: { stage: "CONFIRMING", "reservationInfo.phone": "905551234567" } },
]);

// ═══════════════════════════════════════════════════════════════════════
// HARD TEST: MANTIK senaryoları (2026-06-21) — state-machine mirror
// H3 (3 art arda tur değişim), H4 (iptal + yeniden başlama),
// H9 (boş mesaj state korunur), H11 (COMPLETED→TOUR_SELECTED)
// ═══════════════════════════════════════════════════════════════════════

// === H3 — KALDIRILDI — Layer 1 yetersiz, NLU-kritik listesine taşındı ===
// HARD TEST KEŞFİ: state-machine TOUR_SELECTED→COLLECTING_INFO transition (line 463)
// reservation_intent intent'te selectedTour'u currentTour'a YAZMAZ — sadece
// reservationInfo merge eder. Tur değişimi canlıda erken müdahale (process-message:330)
// ile sağlanır, state-machine tek başına değil. Layer 1 harness erken müdahaleyi
// mirror'lamadığı için H3 burada test edilemez → canlı NLU-kritik listesine ekle.

// === H4: İptal sonrası yeniden başlama — state tertemiz mi? ===
runScenario("H4: İptal + yeniden başlama state temizliği", "tr", [
  { msg: "Pamukkale", intent: "reservation_intent", selectedTour: TOUR,
    extracted: { tourId: TOUR.id, tourTitle: TOUR.title },
    expect: { stage: "COLLECTING_INFO" } },
  { msg: "12 aralık", intent: "provide_info", extracted: { dateId: "D_12ARA", selectedDate: "2026-12-12" },
    expect: { collectionStep: "waiting_for_pax", "reservationInfo.dateId": "D_12ARA" } },
  { msg: "2 kişi", intent: "provide_info", extracted: { paxAdult: 2 },
    expect: { "reservationInfo.paxAdult": 2 } },
  { msg: "vazgeçtim", intent: "cancel",
    expect: { stage: "BROWSING", "reservationInfo.tourId": undefined,
              "reservationInfo.dateId": undefined, "reservationInfo.paxAdult": undefined,
              currentTour: null, justCancelled: true } },
  { msg: "Kapadokya rezervasyon", intent: "reservation_intent", selectedTour: TOUR_KAP,
    extracted: { tourId: TOUR_KAP.id, tourTitle: TOUR_KAP.title },
    // resetForNewReservation sonrası fresh — pax sızıntı OLMAMALI
    expect: { stage: "COLLECTING_INFO", "currentTour.id": TOUR_KAP.id,
              "reservationInfo.paxAdult": undefined, "reservationInfo.dateId": undefined } },
]);

// === H9: Boş/spam mesajda state korunur mu? ===
// NOT: Boş mesajda NLU genel olarak intent=general döner. State değişmemeli.
runScenario("H9: Spam/garip mesaj state korunur", "tr", [
  { msg: "Pamukkale", intent: "reservation_intent", selectedTour: TOUR,
    extracted: { tourId: TOUR.id, tourTitle: TOUR.title },
    expect: { stage: "COLLECTING_INFO", collectionStep: "waiting_for_date" } },
  { msg: "?", intent: "general", extracted: {},
    expect: { stage: "COLLECTING_INFO", collectionStep: "waiting_for_date",
              "currentTour.id": TOUR.id } },
  { msg: "🎈", intent: "general", extracted: {},
    expect: { stage: "COLLECTING_INFO", "currentTour.id": TOUR.id } },
  { msg: "aaaaaaaaaa", intent: "general", extracted: {},
    expect: { stage: "COLLECTING_INFO", "currentTour.id": TOUR.id } },
  // Sonra geçerli tarih
  { msg: "12 aralık", intent: "provide_info", extracted: { dateId: "D1", selectedDate: "2026-12-12" },
    expect: { collectionStep: "waiting_for_pax", "reservationInfo.dateId": "D1" } },
]);

// === H11 — KALDIRILDI — Layer 1 yetersiz, NLU-kritik listesine taşındı ===
// HARD TEST KEŞFİ: COMPLETED→TOUR_SELECTED transition harness'ta tetiklenmiyor —
// harness'ın processMessage mock'u COMPLETED stage için tam transition map'i
// emule etmiyor. Bu state reset davranışı sadece canlıda doğrulanabilir.

// === 13. DE dili happy path ===
runScenario("S13: DE happy path", "de", [
  { msg: "hallo", intent: "greeting", expect: { stage: "BROWSING" } },
  { msg: "Ich möchte Pamukkale", intent: "reservation_intent", selectedTour: TOUR, extracted: { tourId: TOUR.id, tourTitle: TOUR.title }, expect: { stage: "COLLECTING_INFO" } },
  { msg: "12. Dezember", intent: "provide_info", extracted: { dateId: "D1" }, expect: { collectionStep: "waiting_for_pax" } },
  { msg: "2 Personen", intent: "provide_info", extracted: { paxAdult: 2 }, expect: { collectionStep: "waiting_for_name" } },
  { msg: "Max Mustermann", intent: "provide_info", extracted: { fullName: "Max Mustermann" }, expect: { collectionStep: "waiting_for_phone" } },
  { msg: "+491701234567", intent: "provide_info", extracted: { phone: "491701234567" }, expect: { stage: "CONFIRMING" } },
  { msg: "ja", intent: "confirm_reservation", expect: { stage: "COMPLETED", reservationConfirmed: true } },
]);

// ═══════════════════════════════════════════════════════════════════════
// PROMPT/BYPASS PRESENCE KONTROLÜ — "kod VAR mı" diye doğrular
//
// ⚠️ KAPSAM SINIRI: Bu testler statik substring kontrolüdür. "Kod dosyada
//    yazılı mı?" sorusunu yanıtlar — "runtime'da çalışıyor mu?" sorusunu
//    YANITLAMAZ. Runtime davranış: Faz 0 (deno check, tip/referans) +
//    Faz 0.5 (deno run test_behavioral.ts, gerçek fonksiyon çağrısı) ile
//    doğrulanır. Canlı LLM compliance kanıtı: production manuel test.
//
// Tuğçe canlı bug'ında forbiddenList runtime'da patladı, bu PRESENCE testi
// "var" demişti — substring tek başına yetmez. Faz 0 + Faz 0.5 katmanları
// presence + davranış kombinasyonunu sağlıyor.
// ═══════════════════════════════════════════════════════════════════════
console.log(`\n--- Prompt/Bypass presence kontrolü (substring — "kod var mı") ---`);

const __dirname = dirname(fileURLToPath(import.meta.url));
const stagesPath = join(__dirname, "..", "supabase", "functions", "shared", "fsm", "prompts", "stages", "index.ts");
const stagesContent = readFileSync(stagesPath, "utf-8");

function assertPromptContains(name, needle) {
  if (stagesContent.includes(needle)) {
    scenarioPasses++;
    console.log(`✓ [PROMPT] ${name}`);
  } else {
    scenarioFails++;
    failures.push({ scenario: `PROMPT:${name}`, step: 0, msg: needle.slice(0, 60), key: "stages/index.ts", expected: needle, actual: "NOT FOUND" });
    console.log(`✗ [PROMPT] ${name} — kayıp: "${needle.slice(0, 80)}..."`);
  }
}

// TR — her adımda SİSTEMİN BELİRLEDİĞİ ADIM diktası
assertPromptContains("TR waiting_for_date: dikta var", "waiting_for_date: `📝 SİSTEMİN BELİRLEDİĞİ ADIM: TARİH SEÇİMİ");
assertPromptContains("TR waiting_for_pax: dikta var",  "waiting_for_pax: `📝 SİSTEMİN BELİRLEDİĞİ ADIM: KİŞİ SAYISI");
assertPromptContains("TR waiting_for_name: dikta var", "waiting_for_name: `📝 SİSTEMİN BELİRLEDİĞİ ADIM: İSİM");
assertPromptContains("TR waiting_for_phone: dikta var","waiting_for_phone: `📝 SİSTEMİN BELİRLEDİĞİ ADIM: TELEFON");

// TR — pax/name/phone adımlarında YASAK örnekleri var
assertPromptContains("TR waiting_for_pax: 'Hangi tarih' YASAK", '"Hangi tarihi tercih edersiniz?" (← tarih ZATEN seçildi)');
assertPromptContains("TR waiting_for_name: 'Kaç kişi' YASAK",  '"Kaç kişi katılacaksınız?" (← pax ZATEN alındı)');
assertPromptContains("TR waiting_for_phone: Tuğçe kanıtı 'Kaç kişi' YASAK",
  '"Kaç kişi katılacaksınız?" (← pax ZATEN alındı, bu mesajda silinmedi)');

// EN — Tuğçe spesifik dikta
assertPromptContains("EN waiting_for_phone: 'How many people' FORBIDDEN",
  '"How many people?" (← pax ALREADY collected, NOT dropped in this turn)');

// Forbidden list — değer bazlı yapı (sadece etiket değil "tarih: 2026-12-12" formatı)
assertPromptContains("forbiddenList: değer bazlı 'ZATEN ALINDI' kalıbı", "TEKRAR SORMA (ZATEN ALINDI):");
assertPromptContains("forbiddenList: değerli forbidden push (date)",   "forbidden.push(`${L.date}: ${val}`)");
assertPromptContains("forbiddenList: değerli forbidden push (pax)",    "forbidden.push(`${L.pax}: ${info.paxAdult}`)");

// === KÖK DÜZELTME (2026-06-19 Tuğçe CONFIRMING refactor) ===
// Korumayı tek noktaya taşıdık: buildFilledFieldsGuard. Stage-bağımsız ortak suffix.
assertPromptContains("buildFilledFieldsGuard tanımlı", "function buildFilledFieldsGuard(context: PromptContext)");
assertPromptContains("getStagePrompt'ta filledFieldsGuard hesaplanıyor", "const filledFieldsGuard = buildFilledFieldsGuard(context);");
// Suffix her stage'e BAĞIMSIZ uygulanır — minimum 7 return noktasında çağrılmalı.
// (GREETING + BROWSING + TR: TOUR_SELECTED/DATE_SELECTION/COLLECTING_INFO/CONFIRMING/COMPLETED/default
//  + EN aynı 6 = toplam ~14)
function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}
const guardCount = countOccurrences(stagesContent, "+ filledFieldsGuard + hallucinationGuard");
if (guardCount >= 12) {
  scenarioPasses++;
  console.log(`✓ [PROMPT] filledFieldsGuard ${guardCount}x return suffix'i (her stage'e uygulanmış)`);
} else {
  scenarioFails++;
  failures.push({ scenario: "PROMPT:guard count", step: 0, msg: `expected ≥12, got ${guardCount}`, key: "stages/index.ts", expected: "≥12", actual: guardCount });
  console.log(`✗ [PROMPT] filledFieldsGuard sadece ${guardCount}x — beklenen ≥12`);
}

// === SİLİNEN TEKRARLAR — geri gelmesin diye negatif assertion ===
function assertPromptMissing(name, needle) {
  if (!stagesContent.includes(needle)) {
    scenarioPasses++;
    console.log(`✓ [PROMPT-NEG] ${name}`);
  } else {
    scenarioFails++;
    failures.push({ scenario: `PROMPT-NEG:${name}`, step: 0, msg: needle.slice(0, 60), key: "stages/index.ts", expected: "missing", actual: "STILL PRESENT" });
    console.log(`✗ [PROMPT-NEG] ${name} — hâlâ var: "${needle.slice(0, 80)}..."`);
  }
}
// === PROCESS-MESSAGE DETERMİNİSTİK BYPASS BLOKLARI (Commit 3 — Murat bug kök düzeltmesi) ===
// LLM compliance hatasına karşı: pax→name, name→phone, phone→CONFIRMING geçişlerinde
// LLM çağrılmaz, deterministik metin gönderilir. Bu testler 3 bloğun + 7 dil
// coverage'ının korunduğunu garanti eder.
const procMsgPath = join(__dirname, "..", "supabase", "functions", "shared", "handlers", "process-message.ts");
const procMsgContent = readFileSync(procMsgPath, "utf-8");

function assertProcMsgContains(name, needle) {
  if (procMsgContent.includes(needle)) {
    scenarioPasses++;
    console.log(`✓ [BYPASS] ${name}`);
  } else {
    scenarioFails++;
    failures.push({ scenario: `BYPASS:${name}`, step: 0, msg: needle.slice(0, 60), key: "process-message.ts", expected: needle, actual: "NOT FOUND" });
    console.log(`✗ [BYPASS] ${name} — kayıp: "${needle.slice(0, 80)}..."`);
  }
}

// Blok başlıkları
assertProcMsgContains("Blok 11b başlığı (pax→name)",     "11b. PAX → NAME GEÇİŞİ (deterministik)");
assertProcMsgContains("Blok 11c başlığı (name→phone)",   "11c. NAME → PHONE GEÇİŞİ (deterministik)");
assertProcMsgContains("Blok 13 başlığı (phone→CONFIRMING)", "13. PHONE → CONFIRMING GEÇİŞİ (deterministik)");

// İlk-kez koşulu (context.collectionStep !== "...") — sonsuz tekrarı önler
assertProcMsgContains("pax→name ilk-kez koşulu",   'context.collectionStep !== "waiting_for_name"');
assertProcMsgContains("name→phone ilk-kez koşulu", 'context.collectionStep !== "waiting_for_phone"');
assertProcMsgContains("phone→CONFIRMING ilk-kez koşulu", 'context.stage !== "CONFIRMING"');

// 7 dil coverage — pax→name (TR + AR + RU örnek)
assertProcMsgContains("pax→name TR mesajı", "Ad ve soyadınızı alabilir miyim?");
assertProcMsgContains("pax→name AR mesajı", "هل يمكنني الحصول على الاسم الكامل؟");
assertProcMsgContains("pax→name RU mesajı", "Назовите, пожалуйста, ваше имя и фамилию.");

// 7 dil coverage — name→phone
assertProcMsgContains("name→phone TR mesajı", "Telefon numaranızı alabilir miyim?");
assertProcMsgContains("name→phone EN mesajı", "May I have your phone number?");

// 7 dil coverage — phone→CONFIRMING özet+onay
assertProcMsgContains("CONFIRMING TR onay sorusu", "Bilgiler doğru mu, onaylıyor musunuz?");
assertProcMsgContains("CONFIRMING EN onay sorusu", "Are these details correct?");
assertProcMsgContains("CONFIRMING AR onay sorusu", "هل المعلومات صحيحة؟");

// === ESKİ POZİTİF/NEGATİF ASSERTION'LAR ===
// CONFIRMING'in manuel "ZATEN ALINDI" cümlesi artık ortak guard'dan geliyor:
assertPromptMissing("TR CONFIRMING: manuel 'Tarih, kişi sayısı, isim ve telefon ZATEN ALINDI' cümlesi silindi",
  "Tarih, kişi sayısı, isim ve telefon ZATEN ALINDI");
assertPromptMissing("EN CONFIRMING: manuel 'Date, number of people, name and phone are ALREADY COLLECTED' cümlesi silindi",
  "Date, number of people, name and phone are ALREADY COLLECTED");
// COLLECTING_INFO'nun "✅ ZATEN TOPLANAN BİLGİLER" bloğu artık ortak guard'dan geliyor:
assertPromptMissing("TR COLLECTING_INFO: 'ZATEN TOPLANAN BİLGİLER' bloğu silindi",
  "ZATEN TOPLANAN BİLGİLER (bunları TEKRAR SORMA");
assertPromptMissing("EN COLLECTING_INFO: 'ALREADY COLLECTED (DO NOT ASK AGAIN' bloğu silindi",
  "ALREADY COLLECTED (DO NOT ASK AGAIN");

// === REGRESYON KAPANI (2026-06-19 production ReferenceError) ===
// getCollectionStepPrompt'tan forbiddenList lokal değişkeni kaldırıldı; ama template
// literal'larda kalan `${forbiddenList}` referansı runtime'da ReferenceError üretir
// (default branch'lerinde kalmıştı, mock state testleri yakalayamamıştı çünkü
// getCollectionStepPrompt mock'lu testte çağrılmıyor). Bu kapan substring kontrolüyle
// gelecekteki bir replace_all kaçışını yakalar.
assertPromptMissing("forbiddenList template literal referansı (production ReferenceError kapanı)",
  "${forbiddenList}");
assertPromptMissing("forbiddenList lokal değişken referansı (getCollectionStepPrompt scope)",
  "forbiddenList");

// === COMMIT 4 — Bug A3 kök çözümü (LLM tarih yetkisi SIFIR) ===
// Pre-delete kanıtları: silinen şeyler GERÇEKTEN silindi mi?
assertPromptMissing("TR TOUR_SELECTED: '🚨 KRİTİK KURAL - TARİH SEÇİMİ' bloğu silindi (D1)",
  "🚨 KRİTİK KURAL - TARİH SEÇİMİ");
assertPromptMissing("EN TOUR_SELECTED: '🚨 CRITICAL - DATE SELECTION' bloğu silindi (D1)",
  "🚨 CRITICAL - DATE SELECTION");
assertPromptMissing("TR TOUR_SELECTED: 'tarihleri listele' satırı silindi",
  "Açıkça rezervasyon istiyorsa → tarihleri listele.");
assertPromptMissing("EN TOUR_SELECTED: 'list dates' satırı silindi",
  "If clearly wants reservation → list dates.");
assertPromptMissing("dateReinforcement TR (B1)", "SEÇİLİ TURUN TARİHLERİ:");
assertPromptMissing("dateReinforcement EN (B1)", "TOUR DATES:\\n");
assertPromptMissing("DATE_SELECTION case TR (E1) silindi", 'case "DATE_SELECTION":');
// Yeni dikta defansif olarak eklendi
assertPromptContains("TR TOUR_SELECTED: '⛔ TARİH KONUSUNA GİRME' defansif dikta",
  "⛔ TARİH KONUSUNA GİRME — KESİN YASAK");
assertPromptContains("EN TOUR_SELECTED: '⛔ DO NOT DISCUSS DATES' defansif dikta",
  "⛔ DO NOT DISCUSS DATES — STRICT BAN");
assertPromptContains("TR COLLECTING_INFO: '⛔ TARİH KONUSUNA GİRME' defansif dikta",
  "Müsait tarihleri kontrol ediyorum 📅");

// === COMMIT 4 — process-message :11 BYPASS genişletmesi ===
assertProcMsgContains("DATE_QUERY_RE import (tek-kaynak: constants/date-detection)",
  'import { DATE_QUERY_RE, DATE_INTENTS } from "../constants/date-detection.ts"');
assertProcMsgContains(":11 koşulu TOUR_SELECTED'ı kapsıyor",
  'newContext.stage === "TOUR_SELECTED"');
assertProcMsgContains(":11 askingViaQuery DATE_QUERY_RE ile",
  "DATE_QUERY_RE.test(message)");
assertProcMsgContains(":11 ELSE dalı (D3) - dates boş → deterministik 'tarih yok'",
  "şu anda aktif müsait tarih bulunmuyor");

// === COMMIT 4 — helpers.ts datesSection silindi (C1+C2) ===
const helpersPath = join(__dirname, "..", "supabase", "functions", "shared", "fsm", "prompts", "helpers.ts");
const helpersContent = readFileSync(helpersPath, "utf-8");
// "let datesSection" KOD KULLANIMI silinmiş olmalı (yorumda "datesSection" geçebilir, normal)
if (!helpersContent.includes("let datesSection")) {
  scenarioPasses++;
  console.log(`✓ [PROMPT-NEG] helpers.ts: 'let datesSection' kod kullanımı silindi (LLM tarih konuşmaz)`);
} else {
  scenarioFails++;
  failures.push({ scenario: "PROMPT-NEG: datesSection code", step: 0, msg: "let datesSection still in helpers.ts", key: "helpers.ts", expected: "missing", actual: "PRESENT" });
  console.log(`✗ [PROMPT-NEG] helpers.ts 'let datesSection' KOD HÂLÂ VAR`);
}
if (!helpersContent.includes("Müsait Tarihler:")) {
  scenarioPasses++;
  console.log(`✓ [PROMPT-NEG] helpers.ts: 'Müsait Tarihler:' tarih başlığı silindi`);
} else {
  scenarioFails++;
  failures.push({ scenario: "PROMPT-NEG: tarih başlığı", step: 0, msg: "Müsait Tarihler still in helpers.ts", key: "helpers.ts", expected: "missing", actual: "PRESENT" });
  console.log(`✗ [PROMPT-NEG] helpers.ts 'Müsait Tarihler:' başlığı HÂLÂ VAR`);
}

// === COMMIT 4 — info-extractor pax sızıntı strict regex (Yan #1) ===
const infoExtractorPath = join(__dirname, "..", "supabase", "functions", "shared", "services", "info-extractor.ts");
const infoExtractorContent = readFileSync(infoExtractorPath, "utf-8");
if (infoExtractorContent.includes('/^\\d+$/.test(trimmed)')) {
  scenarioPasses++;
  console.log(`✓ [PRESENCE] info-extractor: Blok 6 strict regex /^\\d+$/ var (Yan #1 fix)`);
} else {
  scenarioFails++;
  failures.push({ scenario: "PRESENCE: pax strict regex", step: 0, msg: "Blok 6 strict regex eksik", key: "info-extractor.ts", expected: "/^\\d+$/", actual: "NOT FOUND" });
  console.log(`✗ [PRESENCE] info-extractor pax strict regex YOK`);
}

// === COMMIT A — BUG 1 v2 (state geçişi) + stopword genişletmesi ===
// Helper varlık kontrolü
const tourChangePath = join(__dirname, "..", "supabase", "functions", "shared", "services", "tour-change.ts");
if (existsSync(tourChangePath)) {
  scenarioPasses++;
  console.log(`✓ [PRESENCE] services/tour-change.ts helper dosyası var`);
} else {
  scenarioFails++;
  failures.push({ scenario: "PRESENCE: tour-change helper", step: 0, msg: "tour-change.ts dosyası YOK", key: "services/tour-change.ts", expected: "exists", actual: "MISSING" });
  console.log(`✗ [PRESENCE] tour-change.ts dosyası YOK`);
}

const tourChangeContent = existsSync(tourChangePath) ? readFileSync(tourChangePath, "utf-8") : "";
function assertTourChangeContains(name, needle) {
  if (tourChangeContent.includes(needle)) {
    scenarioPasses++;
    console.log(`✓ [BYPASS] tour-change: ${name}`);
  } else {
    scenarioFails++;
    failures.push({ scenario: `BYPASS:tour-change:${name}`, step: 0, msg: needle, key: "tour-change.ts", expected: needle, actual: "NOT FOUND" });
    console.log(`✗ [BYPASS] tour-change: ${name} kayıp`);
  }
}
assertTourChangeContains("produceTourChangeContext export", "export function produceTourChangeContext");
assertTourChangeContains("shouldApplyEarlyTourChange export", "export function shouldApplyEarlyTourChange");

// state-machine.ts helper import + her iki action kullanıyor
const stateMachinePath = join(__dirname, "..", "supabase", "functions", "shared", "fsm", "state-machine.ts");
const stateMachineContent = readFileSync(stateMachinePath, "utf-8");
function assertStateMachineContains(name, needle) {
  if (stateMachineContent.includes(needle)) {
    scenarioPasses++;
    console.log(`✓ [BYPASS] state-machine: ${name}`);
  } else {
    scenarioFails++;
    failures.push({ scenario: `BYPASS:state-machine:${name}`, step: 0, msg: needle.slice(0, 60), key: "state-machine.ts", expected: needle, actual: "NOT FOUND" });
    console.log(`✗ [BYPASS] state-machine: ${name} kayıp`);
  }
}
assertStateMachineContains("produceTourChangeContext import (tek-kaynak)",
  'import { produceTourChangeContext } from "../services/tour-change.ts"');
// Her iki tour-change action helper kullanıyor (string count)
const helperCallCount = (stateMachineContent.match(/produceTourChangeContext\(ctx, input\.selectedTour!\)/g) || []).length;
if (helperCallCount >= 2) {
  scenarioPasses++;
  console.log(`✓ [BYPASS] state-machine: 2 action helper kullanıyor (count=${helperCallCount})`);
} else {
  scenarioFails++;
  failures.push({ scenario: "BYPASS: state-machine helper count", step: 0, msg: `expected ≥2, got ${helperCallCount}`, key: "state-machine.ts", expected: "≥2", actual: helperCallCount });
  console.log(`✗ [BYPASS] state-machine: sadece ${helperCallCount} helper çağrısı`);
}

// process-message.ts erken müdahale bloğu
// 2026-06-23 Sorun D: import satırı buildTourChangePrefix ile genişledi.
// Exact-match yerine path + iki sembolü ayrı kontrol et (PRESENCE import string
// kayması yan #8 aile).
assertProcMsgContains("process-message: tour-change helper path",
  'from "../services/tour-change.ts"');
assertProcMsgContains("process-message: produceTourChangeContext sembolü",
  "produceTourChangeContext");
assertProcMsgContains("process-message: shouldApplyEarlyTourChange sembolü",
  "shouldApplyEarlyTourChange");
assertProcMsgContains("process-message: erken müdahale shouldApply gate'i",
  "shouldApplyEarlyTourChange(context, selectedTour)");
assertProcMsgContains("process-message: DETERMINISTIC tour-change logu",
  "DETERMINISTIC tour-change:");
assertProcMsgContains("process-message: CONFIRMING'den geri dönüş reservationConfirmed:false",
  "reservationConfirmed: false");

// Stopword genişletme — rezervasyon ailesi
const stopwordsPath = join(__dirname, "..", "supabase", "functions", "shared", "constants", "tour-matching.ts");
const stopwordsContent = readFileSync(stopwordsPath, "utf-8");
function assertStopwordsContains(name, needle) {
  if (stopwordsContent.includes(needle)) {
    scenarioPasses++;
    console.log(`✓ [BYPASS] stopwords: ${name}`);
  } else {
    scenarioFails++;
    failures.push({ scenario: `BYPASS:stopwords:${name}`, step: 0, msg: needle, key: "constants/tour-matching.ts", expected: needle, actual: "NOT FOUND" });
    console.log(`✗ [BYPASS] stopwords: ${name} kayıp`);
  }
}
assertStopwordsContains("'rezervasyon' eklendi", '"rezervasyon"');
assertStopwordsContains("'booking' eklendi (EN)", '"booking"');
assertStopwordsContains("'buchung' eklendi (DE)", '"buchung"');
assertStopwordsContains("'evet' eklendi (TR onay)", '"evet"');
// 2026-06-20: TR accusative "turunu" stopword listesinde olmalı (A gate'in
// "Antalya Turunu Alalım" sızıntısını yakalaması için)
assertStopwordsContains("'turunu' eklendi (TR accusative, A gate için)", '"turunu"');

// ─── A GATE PRESENCE (2026-06-20 Sorun 2) ──────────────────────────────
// nlu-validation.ts dosyası YAR mı (Sorun 2 fix'in varlığı)
const nluValidationPath = join(__dirname, "..", "supabase", "functions", "shared", "services", "nlu-validation.ts");
let nluValidationContent = "";
try {
  nluValidationContent = readFileSync(nluValidationPath, "utf-8");
  scenarioPasses++;
  console.log(`✓ [PRESENCE] services/nlu-validation.ts dosyası var (A gate)`);
} catch {
  scenarioFails++;
  failures.push({ scenario: "PRESENCE: nlu-validation", step: 0, msg: "nlu-validation.ts dosyası YOK", key: "services/nlu-validation.ts", expected: "exists", actual: "MISSING" });
  console.log(`✗ [PRESENCE] nlu-validation.ts dosyası YOK`);
}
function assertNluValidationContains(name, needle) {
  if (nluValidationContent.includes(needle)) {
    scenarioPasses++;
    console.log(`✓ [PRESENCE] nlu-validation: ${name}`);
  } else {
    scenarioFails++;
    failures.push({ scenario: `PRESENCE:nlu-validation:${name}`, step: 0, msg: needle, key: "services/nlu-validation.ts", expected: needle, actual: "NOT FOUND" });
    console.log(`✗ [PRESENCE] nlu-validation: ${name} kayıp`);
  }
}
// Fonksiyon export edildi mi
assertNluValidationContains("isNluFullNameTourLeak export", "export function isNluFullNameTourLeak");
// TOUR_KEYWORD_STOPWORDS import edildi mi (asıl koruma kaynağı)
assertNluValidationContains("TOUR_KEYWORD_STOPWORDS import", "TOUR_KEYWORD_STOPWORDS");

// process-message.ts'de A gate ÇAĞRI YERİ (canlıda tetiklenmesi için kritik)
assertProcMsgContains("A gate import (nlu-validation path)",
  'from "../services/nlu-validation.ts"');
assertProcMsgContains("A gate import isNluFullNameTourLeak sembolü",
  "isNluFullNameTourLeak");
assertProcMsgContains("A gate çağrısı (isNluFullNameTourLeak)",
  "isNluFullNameTourLeak(");
assertProcMsgContains("A gate BLOCKED log (canlı doğrulama için)",
  "BLOCKED NLU fullName tour-leak");
assertProcMsgContains("A gate state temizleme (delete fullName)",
  "delete nluResult.updates.fullName");
assertProcMsgContains("A gate entities.full_name temizleme",
  "full_name");

// tour-matching.ts'de change_info eklenmiş mi (Sorun 1)
const tourMatchingPath = join(__dirname, "..", "supabase", "functions", "shared", "services", "tour-matching.ts");
const tourMatchingContent = readFileSync(tourMatchingPath, "utf-8");
if (tourMatchingContent.includes('intent === "change_info"')) {
  scenarioPasses++;
  console.log(`✓ [PRESENCE] tour-matching: change_info explicitTourIntent listesine eklendi (Sorun 1)`);
} else {
  scenarioFails++;
  failures.push({ scenario: "PRESENCE:tour-matching:change_info", step: 0, msg: 'intent === "change_info"', key: "services/tour-matching.ts", expected: 'intent === "change_info"', actual: "NOT FOUND" });
  console.log(`✗ [PRESENCE] tour-matching: change_info eksik (Sorun 1 fix yok)`);
}

// NLU prompt'unda tour-change phrases bloğu var mı (B destek)
const nluPath = join(__dirname, "..", "supabase", "functions", "shared", "fsm", "nlu.ts");
const nluContent = readFileSync(nluPath, "utf-8");
if (nluContent.includes("NEVER extract full_name from tour-change phrases")) {
  scenarioPasses++;
  console.log(`✓ [PRESENCE] nlu.ts: tour-change phrases CRITICAL RULE bloğu var (B destek)`);
} else {
  scenarioFails++;
  failures.push({ scenario: "PRESENCE:nlu:tour-change-phrases", step: 0, msg: "tour-change phrases bloğu", key: "fsm/nlu.ts", expected: "NEVER extract full_name from tour-change phrases", actual: "NOT FOUND" });
  console.log(`✗ [PRESENCE] nlu.ts: tour-change phrases bloğu eksik`);
}

// ─── YAN #5 PERSIST BYPASS PRESENCE (2026-06-20) ──────────────────────
// services/bypass-gates.ts var mı
const bypassGatesPath = join(__dirname, "..", "supabase", "functions", "shared", "services", "bypass-gates.ts");
let bypassGatesContent = "";
try {
  bypassGatesContent = readFileSync(bypassGatesPath, "utf-8");
  scenarioPasses++;
  console.log(`✓ [PRESENCE] services/bypass-gates.ts dosyası var (Yan #5)`);
} catch {
  scenarioFails++;
  failures.push({ scenario: "PRESENCE: bypass-gates", step: 0, msg: "bypass-gates.ts YOK", key: "services/bypass-gates.ts", expected: "exists", actual: "MISSING" });
  console.log(`✗ [PRESENCE] bypass-gates.ts dosyası YOK`);
}
function assertBypassGatesContains(name, needle) {
  if (bypassGatesContent.includes(needle)) {
    scenarioPasses++;
    console.log(`✓ [PRESENCE] bypass-gates: ${name}`);
  } else {
    scenarioFails++;
    failures.push({ scenario: `PRESENCE:bypass-gates:${name}`, step: 0, msg: needle, key: "services/bypass-gates.ts", expected: needle, actual: "NOT FOUND" });
    console.log(`✗ [PRESENCE] bypass-gates: ${name} kayıp`);
  }
}
assertBypassGatesContains("shouldTriggerNameAskPersist export", "export function shouldTriggerNameAskPersist");
assertBypassGatesContains("BİLİNEN SINIR yorumu (NLU yanlış sınıflandırma)", "BİLİNEN SINIR");
assertBypassGatesContains("DAR KOŞUL 4 kapı belgeli", "DAR KOŞUL");
// 2026-06-21 Sorun A
assertBypassGatesContains("shouldFireUnknownTour export (Sorun A)", "export function shouldFireUnknownTour");
assertBypassGatesContains("Sorun A currentTour gate yorumu", "if (context.currentTour) return false");
assertProcMsgContains("Sorun A: shouldFireUnknownTour çağrısı", "shouldFireUnknownTour(context as any, selectedTour, multipleTourMatches.length");

// 2026-06-21 Sorun C — :11a-AUTO-DATE-ACK
assertBypassGatesContains("shouldTriggerAutoDateAck export (Sorun C)", "export function shouldTriggerAutoDateAck");
assertBypassGatesContains("Sorun C 4 dar kapı belgeli", "4 dar kapı");
assertBypassGatesContains("Sorun C erken müdahale interaksiyon yorumu", "ERKEN MÜDAHALE İNTERAKSIYONU");
// info-extractor.ts Blok 10 flag set ediyor mu
const _infoExtractorPathC = join(__dirname, "..", "supabase", "functions", "shared", "services", "info-extractor.ts");
const _infoExtractorContentC = readFileSync(_infoExtractorPathC, "utf-8");
if (_infoExtractorContentC.includes("extractedInfo.dateAutoAssigned = true")) {
  scenarioPasses++;
  console.log(`✓ [PRESENCE] info-extractor Blok 10: dateAutoAssigned flag set ediyor`);
} else {
  scenarioFails++;
  failures.push({ scenario: "PRESENCE:info-extractor:dateAutoAssigned", step: 0, msg: "Blok 10 flag set yok", key: "info-extractor.ts", expected: "extractedInfo.dateAutoAssigned = true", actual: "NOT FOUND" });
  console.log(`✗ [PRESENCE] info-extractor Blok 10 flag YOK`);
}
// process-message.ts :11a-AUTO-DATE-ACK
assertProcMsgContains(":11a-AUTO-DATE-ACK başlığı", "11a-AUTO-DATE-ACK. TEK-TARİH OTOMATİK ATAMA ONAYI");
assertProcMsgContains(":11a-AUTO-DATE-ACK çağrı", "shouldTriggerAutoDateAck(context, newContext");
assertProcMsgContains(":11a-AUTO-DATE-ACK log", ":11a-AUTO-DATE-ACK tetiklendi");
assertProcMsgContains(":11a-AUTO-DATE-ACK graceful price catch", "AUTO-DATE-ACK price format failed");
// 7 dil mesaj
assertProcMsgContains(":11a-AUTO-DATE-ACK TR mesajı", "tarihinde *${_displayTitle}* için rezervasyon başlatıyorum");
assertProcMsgContains(":11a-AUTO-DATE-ACK EN mesajı", "Starting reservation for *${_displayTitle}* on");
assertProcMsgContains(":11a-AUTO-DATE-ACK DE mesajı", "Buche *${_displayTitle}* am");
assertProcMsgContains(":11a-AUTO-DATE-ACK RU mesajı", "Начинаю бронирование");
assertProcMsgContains(":11a-AUTO-DATE-ACK AR mesajı", "أبدأ حجز");
assertProcMsgContains(":11a-AUTO-DATE-ACK FR mesajı", "Je commence votre réservation");
assertProcMsgContains(":11a-AUTO-DATE-ACK ES mesajı", "Iniciando reserva para");

// 2026-06-21 Sorun B — paxAck önek mantığı :11b-PERSIST içinde
assertProcMsgContains("Sorun B paxAcked mantığı", "_paxAcked = !!_newPax && _newPax !== _oldPax");
assertProcMsgContains("Sorun B paxAck log",       "paxAck=${_paxAcked}");
assertProcMsgContains("Sorun B TR ack mesajı",    "*${_newPax} kişi* olarak güncelledim");
assertProcMsgContains("Sorun B EN ack mesajı",    "Updated to *${_newPax}");
// 2026-06-22 F-msg revize ile Şimdi varyantı güncellendi (örnek isim eklendi)
assertProcMsgContains("Sorun B 'Şimdi' varyantı (paxAcked sonrası, F-msg revize)",
  "Şimdi *tam ad ve soyadınızı* yazar mısınız?");

// 2026-06-21 Sorun F — negation gate PRESENCE (nlu-validation.ts)
assertNluValidationContains("Sorun F isNluFullNameNegationLeak export",
  "export function isNluFullNameNegationLeak");
assertNluValidationContains("Sorun F NEGATION_TOKENS TR (değil)",
  '"değil"');
assertNluValidationContains("Sorun F NEGATION_TOKENS EN (not)",
  '"not"');
assertNluValidationContains("Sorun F çok-dil belgesi (post-launch)",
  "ÇOK-DİL EŞİTLEME FAZINA ALINDI");
// process-message K3 çağrısı
assertProcMsgContains("Sorun F K3 negation gate çağrısı",
  "isNluFullNameNegationLeak(_leak)");
assertProcMsgContains("Sorun F K3 BLOCKED log",
  "BLOCKED NLU fullName negation-leak");
// 2026-06-22 Sorun G — :13-PERSIST CONFIRMING no-op PRESENCE
assertBypassGatesContains("Sorun G shouldTriggerSummaryReask export",
  "export function shouldTriggerSummaryReask");
assertBypassGatesContains("Sorun G BYPASS_ELIGIBLE_INTENTS 3'lü (confirm_reservation)",
  '"confirm_reservation"');
assertBypassGatesContains("Sorun G allow-list general (exec 06ae0554 kanıt)",
  '"general"');
assertBypassGatesContains("Sorun G allow-list greeting",
  '"greeting"');
assertBypassGatesContains("Sorun G provide_info ÇIKARILDI yorum belgesi",
  "PROVIDE_INFO ÇIKARILDI");
// process-message :13-PERSIST
assertProcMsgContains(":13-PERSIST başlığı",
  "13-PERSIST. CONFIRMING NO-OP");
assertProcMsgContains(":13-PERSIST çağrısı",
  "shouldTriggerSummaryReask(context, newContext, nluResult.intent)");
assertProcMsgContains(":13-PERSIST log",
  ":13-PERSIST tetiklendi");
assertProcMsgContains(":13-PERSIST TR sade reask metni",
  "Onaylıyor musunuz, yoksa değiştirmek istediğiniz bir şey var mı?");
assertProcMsgContains(":13-PERSIST EN reask",
  "Do you confirm, or is there something you'd like to change?");

// nlu.ts K2 word count + 4+ negation kontrol
const nluTsPath = join(__dirname, "..", "supabase", "functions", "shared", "fsm", "nlu.ts");
const nluTsContent = readFileSync(nluTsPath, "utf-8");
if (nluTsContent.includes("_fnWords.length <= 3 || !isNluFullNameNegationLeak")) {
  scenarioPasses++;
  console.log(`✓ [PRESENCE] nlu.ts K2: uzun-isim koruması (length<=3 || !negationLeak)`);
} else {
  scenarioFails++;
  failures.push({ scenario: "PRESENCE:nlu:K2-uzun-isim", step: 0, msg: "K2 mantığı eksik", key: "fsm/nlu.ts", expected: "length <= 3 || !isNluFullNameNegationLeak", actual: "NOT FOUND" });
  console.log(`✗ [PRESENCE] nlu.ts K2 uzun-isim mantığı eksik`);
}
// 2026-06-22 Sorun H — quota-check PRESENCE
const quotaCheckPath = join(__dirname, "..", "supabase", "functions", "shared", "services", "quota-check.ts");
let quotaCheckContent = "";
try {
  quotaCheckContent = readFileSync(quotaCheckPath, "utf-8");
  scenarioPasses++;
  console.log(`✓ [PRESENCE] services/quota-check.ts dosyası var (Sorun H)`);
} catch {
  scenarioFails++;
  failures.push({ scenario: "PRESENCE: quota-check", step: 0, msg: "YOK", key: "services/quota-check.ts", expected: "exists", actual: "MISSING" });
  console.log(`✗ [PRESENCE] quota-check.ts YOK`);
}
function assertQuotaCheckContains(name, needle) {
  if (quotaCheckContent.includes(needle)) {
    scenarioPasses++;
    console.log(`✓ [PRESENCE] quota-check: ${name}`);
  } else {
    scenarioFails++;
    failures.push({ scenario: `PRESENCE:quota-check:${name}`, step: 0, msg: needle, key: "services/quota-check.ts", expected: needle, actual: "NOT FOUND" });
    console.log(`✗ [PRESENCE] quota-check: ${name} kayıp`);
  }
}
assertQuotaCheckContains("getQuotaRemaining export", "export function getQuotaRemaining");
assertQuotaCheckContains("hasQuotaForPax export",     "export function hasQuotaForPax");
assertQuotaCheckContains("hasAnyAvailableDate export","export function hasAnyAvailableDate");
assertQuotaCheckContains("RPC-koruması gerekçe belgesi","RPC-koruması mantığı");

// process-message H katmanları
assertProcMsgContains("H-α DOLU etiket TR", '" (DOLU)"');
assertProcMsgContains("H-α DOLU etiket EN", '" (FULL)"');
assertProcMsgContains("H-β bypass log", "H-β tetiklendi");
assertProcMsgContains("H-pax bypass log", "H-pax tetiklendi");
assertProcMsgContains("H-β TR mesaj", "Maalesef *${_rejDateLabel}* dolu");
assertProcMsgContains("H-pax TR mesaj", "*${_paxPending} kişi* için *${_dateLabel}*");
assertProcMsgContains("H DRY: alt-date hasQuotaForPax", "hasQuotaForPax(d, 1)");
assertProcMsgContains("H _buildAvailableDatesText helper", "_buildAvailableDatesText");

// info-extractor: Blok 8/9/10 dateRejectedFull flag
const _infoExtH = readFileSync(_infoExtractorPathC, "utf-8");
if (_infoExtH.includes("dateRejectedFull")) {
  scenarioPasses++;
  console.log(`✓ [PRESENCE] info-extractor Blok 8/9/10: dateRejectedFull flag set`);
} else {
  scenarioFails++;
  failures.push({ scenario: "PRESENCE:info-extractor:dateRejectedFull", step: 0, msg: "flag eksik", key: "info-extractor.ts", expected: "dateRejectedFull", actual: "NOT FOUND" });
  console.log(`✗ [PRESENCE] info-extractor dateRejectedFull YOK`);
}

// ─── 2026-06-23 SORUN D — buildTourChangePrefix + 4 bypass prefix ─────────
// NOT: assertTourChangeContains + tourChangeContent yukarıda (line ~1122) tanımlı,
// tekrar tanımlamıyoruz — aynı helper'ı kullan.
assertTourChangeContains("D buildTourChangePrefix export", "export function buildTourChangePrefix");
assertTourChangeContains("D TR şablonu",                   "Şimdi *${newTourTitle}* için devam ediyoruz.");
assertTourChangeContains("D EN şablonu",                   "Now continuing with *${newTourTitle}*.");
assertTourChangeContains("D oldTourId guard",              "oldTourId === newTourId");
assertTourChangeContains("D EN fallback default",          "prefixes.en");

// process-message.ts'de _originalTourId saklama + 4 bypass prefix kullanımı
assertProcMsgContains("D _originalTourId saklama",      "const _originalTourId = context.currentTour?.id");
assertProcMsgContains("D buildTourChangePrefix import", "buildTourChangePrefix");
assertProcMsgContains("D β bypass'ta prefix",           "_tcPrefixBeta");
assertProcMsgContains("D pax bypass'ta prefix",         "_tcPrefixPax");
assertProcMsgContains("D :11 bypass'ta prefix",         "_tcPrefixDates");
assertProcMsgContains("D :11a bypass'ta prefix",        "_tcPrefixAck");
assertProcMsgContains("D β log tourChanged",            "tourChanged=${!!_tcPrefixBeta}");
assertProcMsgContains("D :11a log tourChanged",         "tourChanged=${!!_tcPrefixAck}");

if (nluTsContent.includes("NEVER extract full_name from NEGATION/CORRECTION")) {
  scenarioPasses++;
  console.log(`✓ [PRESENCE] nlu.ts K1 prompt: NEGATION/CORRECTION CRITICAL RULE`);
} else {
  scenarioFails++;
  failures.push({ scenario: "PRESENCE:nlu:K1-prompt", step: 0, msg: "K1 prompt eksik", key: "fsm/nlu.ts", expected: "NEVER extract full_name from NEGATION", actual: "NOT FOUND" });
  console.log(`✗ [PRESENCE] nlu.ts K1 negation prompt eksik`);
}

// process-message.ts'de :11b-PERSIST çağrı yeri
assertProcMsgContains(":11b-PERSIST import (bypass-gates path)",
  'from "../services/bypass-gates.ts"');
assertProcMsgContains(":11b-PERSIST import sembolü",
  "shouldTriggerNameAskPersist");
assertProcMsgContains(":11b-PERSIST çağrı (shouldTriggerNameAskPersist)",
  "shouldTriggerNameAskPersist(context, newContext, nluResult)");
assertProcMsgContains(":11b-PERSIST başlığı",
  "11b-PERSIST. WAITING_FOR_NAME NO-OP");
assertProcMsgContains(":11b-PERSIST log (canlı doğrulama için)",
  ":11b-PERSIST tetiklendi");
// 7 dil mesaj
// 2026-06-22 F-msg revize: açıklayıcı tone + örnek isim
assertProcMsgContains(":11b-PERSIST TR mesajı (revize)",
  "Lütfen *tam ad ve soyadınızı* yazar mısınız? (örn. Ahmet Yılmaz)");
assertProcMsgContains(":11b-PERSIST EN mesajı (revize)",
  "Could you write your *full name and surname*? (e.g. Ahmet Yılmaz)");
assertProcMsgContains(":11b-PERSIST DE örnek (revize)",
  "(z.B. Max Mustermann)");
assertProcMsgContains(":11b-PERSIST FR örnek (revize)",
  "(ex: Jean Dupont)");
assertProcMsgContains(":11b-PERSIST ES örnek (revize)",
  "(ej: Juan García)");
assertProcMsgContains(":11b-PERSIST RU örnek (revize)",
  "(например, Иван Иванов)");
assertProcMsgContains(":11b-PERSIST AR örnek (revize)",
  "(مثال: أحمد يلماز)");
// paxAck VAR varyantı (Şimdi)
assertProcMsgContains(":11b-PERSIST paxAck VAR TR (Şimdi + örnek)",
  "Şimdi *tam ad ve soyadınızı*");

// ═══════════════════════════════════════════════════════════════════════
console.log(`\n═══════════════════════════════════════════════════════════════════════`);
console.log(`SONUÇ: ${scenarioPasses}/${scenarioPasses + scenarioFails} senaryo+prompt kontrolü geçti`);
if (scenarioFails > 0) {
  console.log(`\nBaşarısız adımlar:`);
  for (const f of failures) {
    console.log(`  ✗ [${f.scenario}] step${f.step} msg="${f.msg}"`);
    console.log(`     key=${f.key} expected=${JSON.stringify(f.expected)} got=${JSON.stringify(f.actual)}`);
  }
}
console.log(`═══════════════════════════════════════════════════════════════════════`);
process.exit(scenarioFails === 0 ? 0 : 1);
