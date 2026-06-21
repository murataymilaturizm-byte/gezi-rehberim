// 2026-06-20 Yan #5: persistent bypass gate'leri — no-op transition'da
// kullanıcı yanlış sinyal verdiğinde LLM'in saçma cevap üretmesini engelle.
//
// CANLI BUG kanıtı (execution 109fef4c): waiting_for_name'de kullanıcı
// "1 kişi" yazdı (state'te pax zaten dolu). State no-op (waiting_for_name →
// waiting_for_name). NLU intent=provide_info, paxAdult=1, fullName=null.
// Bypass tetiklenmedi (mevcut :11b sadece TRANSITION'da çalışır). LLM
// context'e bakıp "Teşekkürler! Kaç kişi katılacaksınız?" diye saçma cevap
// üretti.
//
// ─── ROL AYRIMI ─────────────────────────────────────────────────────────
// Mevcut :11b — TRANSITION gate. waiting_for_pax → waiting_for_name geçiş
// anında bir kez "Ad ve soyadınızı alabilir miyim?" diyor.
// Yeni :11b-PERSIST — NO-OP gate. Zaten waiting_for_name'de iken kullanıcı
// isim DIŞINDA bir şey yazdığında "Önce ismi alalım" diyor.
//
// ─── DAR KOŞUL (4 kapı) ────────────────────────────────────────────────
// 1. newContext.stage === COLLECTING_INFO
// 2. newContext.collectionStep === waiting_for_name (hâlâ isim bekliyor)
// 3. context.collectionStep === waiting_for_name (önceki turn de aynı → NO-OP)
// 4. nluResult.intent === provide_info (kullanıcı veri verdiği sanılıyor)
// 5. nluResult.updates?.fullName YOK (ama verdiği veri isim DEĞİL)
//
// ─── MEŞRU AKIŞLAR KORUNUR (bypass çalışmaz) ───────────────────────────
// • Off-topic: intent=faq_general / hotel_details / transport_details /
//   agency_info / payment_methods / cancellation_policy / visa_support /
//   working_hours / general / greeting → bypass NO → LLM cevaplar
// • Meşru isim: intent=provide_info + fullName=VAR → bypass NO → extractInfo
//   state'e yazar, bir sonraki turn'de :11c (name→phone) tetiklenir
// • Tur değişimi: intent=change_info / tour_search → bypass NO (intent
//   provide_info değil). Erken müdahale ZATEN çalıştıysa state değişti
//   (waiting_for_date), no-op koşulu zaten kırılmış olur.
// • Transition (pax→name): context.step !== waiting_for_name → NO-OP gate
//   kırılır, eski :11b transition bypass çalışır
//
// ─── BİLİNEN SINIR (DÜRÜST ETİKET) ─────────────────────────────────────
// NLU intent'i YANLIŞ sınıflandırırsa (örn. kullanıcı "iki günlük müydü?"
// diye off-topic soru sordu ama NLU intent=provide_info + paxAdult=2 dedi),
// bu bypass TETİKLENİR ve meşru soru "Önce ismi alalım" ile kesilir.
// midFlowReturnPrompt BU YOLDA ÇALIŞMAZ — bypass erken çıkış (return)
// yapar, LLM hiç çağrılmaz, prompt katmanı devreye girmez.
//
// Bu kabul edilen bir sınır — eski "Kaç kişi katılacaksınız?" (state pax
// dolu iken) saçma cevabı daha büyük UX kaybı. Trade-off açıkça belgelenir,
// "bilinen sınır" testiyle davranış kaydedilir.

export type BypassContext = {
  stage: string;
  collectionStep?: string;
};

export type BypassNlu = {
  intent: string;
  updates?: {
    fullName?: string;
    [k: string]: any;
  };
};

/**
 * waiting_for_name NO-OP gate.
 * Kullanıcı isim adımındayken isim DIŞINDA veri verirse → bypass tetikle,
 * "Önce ismi alalım" tarzı deterministik mesaj.
 */
export function shouldTriggerNameAskPersist(
  context: BypassContext,
  newContext: BypassContext,
  nluResult: BypassNlu,
): boolean {
  return (
    newContext.stage === "COLLECTING_INFO" &&
    newContext.collectionStep === "waiting_for_name" &&
    context.collectionStep === "waiting_for_name" &&
    nluResult.intent === "provide_info" &&
    !nluResult.updates?.fullName
  );
}

// ─── 2026-06-21 SORUN A FIX: UNKNOWN_TOUR state-aware gate ─────────────
//
// CANLI BUG (exec bfccc327): Kullanıcı TOUR_SELECTED'de (currentTour=Kapadokya)
// "Kapadokya rezervasyonu yapmak istiyorum" yazdı. NLU bağlamdan tour_name=
// "Kapadokya Balon Turu" döndürdü (DOĞRU bağlam-aware NLU). AMA "Kapadokya"
// kelimesi mesajda yok → isNluOutputInMessage uydurma sayıp atladı. msgWords
// fallback "yapmak" → bot "yapmak turu sistemimizde bulunmuyor" dedi.
//
// KÖK: process-message.ts:582-588 :10b koşulu currentTour'u kontrol etmiyor.
// TOUR_SELECTED stage listede ama state'te zaten tur seçili — kullanıcı yeni
// tur aramıyor, mevcut rezervasyona devam ediyor.
//
// FIX: !context.currentTour gate ekle. State'te tur seçiliyse UNKNOWN_TOUR
// ATILMAZ — kullanıcı muhtemelen mevcut rezervasyon akışında.
//
// KABUL EDİLEN SINIR: Kullanıcı GERÇEKTEN yeni tur arıyorsa ama NLU bunu
// yakalayamadıysa (örn. "Bodrum turu nedir?" dediği halde mesajda "Bodrum"
// yazım hatalı), bypass tetiklenmez → LLM cevaplar. Yanlış-negatif yanlış-
// pozitiften (eski "yapmak turu yok" absürtlüğü) az zararlı.
export type UnknownTourGateContext = BypassContext & {
  currentTour?: any;
};

export function shouldFireUnknownTour(
  context: UnknownTourGateContext,
  selectedTour: any,
  multipleMatchesCount: number,
  unknownTourQuery: string | null,
  toursCount: number,
): boolean {
  if (!unknownTourQuery) return false;
  if (selectedTour) return false;
  if (multipleMatchesCount > 0) return false;
  if (toursCount === 0) return false;
  // YENİ — Sorun A fix: state'te tur seçiliyse UNKNOWN_TOUR atma.
  if (context.currentTour) return false;
  return (
    context.stage === "GREETING" ||
    context.stage === "BROWSING" ||
    context.stage === "TOUR_SELECTED" ||
    context.stage === "COMPLETED"
  );
}
