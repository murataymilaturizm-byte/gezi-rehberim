// Shared FSM state machine logic
import type {
  ConversationContext,
  ConversationStage,
  ConversationTone,
  StateTransition,
  ProcessingInput,
  InfoCollectionStep,
  ReservationInfo,
} from "./types.ts";

export function createInitialContext(
  language: string = "tr",
  tone: ConversationTone = "standart",
): ConversationContext {
  return {
    stage: "GREETING",
    currentTour: null,
    viewedTours: [],
    reservationInfo: {},
    reservationConfirmed: false,
    paymentInfoSent: false,
    language,
    tone,
    messageCount: 0,
    lastUserMessage: "",
    sessionStarted: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    isNewReservation: false,
  };
}

function isInformationalMessage(userMessage: string, detectedIntent: string): boolean {
  const informationalIntents = [
    "general",
    "general_question",
    "faq_general",
    "tour_search",
    "greeting",
    "agency_info",
    "working_hours",
    "payment_methods",
    "cancellation_policy",
    "visa_support",
    "hotel_details",
    "transport_details",
  ];
  if (informationalIntents.includes(detectedIntent)) return true;

  const questionWords =
    /ne zaman|kaç|nedir|nereden|nasıl|hangi|var mı|kaçta|ne kadar|müsait mi|uygun mu|mevcut mu|fiyat|ücret|tarih|program|detay|kaç gün|nerede|hangi otel|nasıl gidilir|saat|adres|iletişim|telefon kaç|nerede buluyor|\?/i;
  return questionWords.test(userMessage);
}

/**
 * Yeni rezervasyon niyeti var mı? NLU'ya bağımlı olmadan pattern matching
 */
function hasNewReservationIntent(userMessage: string, detectedIntent: string): boolean {
  const newReservationPatterns =
    /başka tur|farklı tur|diğer tur|other tour|another tour|different tour|yeni tur|new tour|yeni rezervasyon|new reservation|ikinci rez|başka bir rez|bir daha|tekrar rez|başka bir tura|farklı bir tura|diğer bir tur|bir (kayıt|tur|rezervasyon)? daha|daha (bir|tane) (tur|kayıt|rezervasyon)|(başka|farklı|yeni) (kayıt|rezervasyon)|(başka|farklı|diğer)\s+(bir\s+)?(tur|seyahat|destinasyon|kayıt|rezervasyon)|(başka|farklı|diğer)\s+nere|(arkadaşım|eşim|ailem|annem|babam|kardeşim|çocuğum)\s+için|(ekleyelim|ekleyeyim)\b|one more (booking|reservation|tour)|another (reservation|booking|trip)|add (another|one more)|for my (friend|wife|husband|family|mother|father|sibling)|rezervasyon\s+yap|kayıt\s+yap|rezervasyon\s+oluştur|rezervasyon\s+almak|rezervasyon\s+istiyorum|tur\s+rezervasyonu|make\s+a\s+(reservation|booking)|book\s+(a\s+)?(tour|trip|this)|tur\s+(ara|bak|göster|ist)|neue\s+(reservierung|buchung|tour)|(andere|weitere)\s+(reservierung|buchung|tour)|nouvelle\s+(réservation|reservation|voyage)|(autre|différente?)\s+(réservation|tour|voyage)|nueva\s+(reserva|reservación|viaje)|(otra|diferente)\s+(reserva|tour|viaje)|новая\s+(резервация|бронирование|поездка|тур)|друг(ая|ой)\s+(тур|резервация|поездка)/i;
  if (newReservationPatterns.test(userMessage)) return true;
  if (detectedIntent === "reservation_intent") return true;
  return false;
}

/**
 * KRİTİK: Sıralı bilgi birleştirme
 *
 * Kurallar:
 * 1. Mevcut bilgiler ASLA silinmez — sadece eksik olanlar eklenir
 * 2. Sıra: tarih → kişi → isim → telefon
 * 3. Önceki adım dolmadan sonraki kabul edilmez
 * 4. Bilgi sorusu gelince (extracted boş) mevcut bilgiler korunur
 */
function mergeReservationInfo(
  existing: ReservationInfo,
  extracted: Partial<ReservationInfo>,
  isInformational: boolean = false,
): ReservationInfo {
  // Bilgi sorusu gelirse mevcut bilgileri değiştirme
  if (isInformational) return { ...existing };

  const merged = { ...existing };

  // Tour info: her zaman kabul et
  if (extracted.tourId && extracted.tourId !== "") merged.tourId = extracted.tourId;
  if (extracted.tourTitle && extracted.tourTitle !== "") merged.tourTitle = extracted.tourTitle;

  // 1. Tarih: henüz yoksa ekle
  if (extracted.dateId && !merged.dateId) merged.dateId = extracted.dateId;
  if (extracted.selectedDate && !merged.selectedDate) merged.selectedDate = extracted.selectedDate;

  // 2. Kişi sayısı: tarih varsa ekle veya GÜNCELLE (K1: son verilen değer geçerli)
  const hasDate = !!(merged.dateId || merged.selectedDate);
  if (hasDate && extracted.paxAdult) {
    merged.paxAdult = extracted.paxAdult;
  }
  if (extracted.paxChild !== undefined && extracted.paxChild !== null && merged.paxAdult) {
    merged.paxChild = extracted.paxChild;
  }

  // 3. İsim: kişi sayısı varsa ve henüz yoksa ekle
  const hasPax = !!merged.paxAdult;
  if (hasPax && !merged.fullName) {
    if (extracted.fullName && extracted.fullName !== "") {
      merged.fullName = extracted.fullName;
    }
  }

  // 4. Telefon: isim varsa ve henüz yoksa ekle
  const hasName = !!merged.fullName;
  if (hasName && !merged.phone) {
    if (extracted.phone && extracted.phone !== "") {
      merged.phone = extracted.phone;
    }
  }

  return merged;
}

function determineCollectionStep(info: ReservationInfo, collectEmail?: boolean): InfoCollectionStep {
  // dateId ZORUNLU: selectedDate parse edilmiş olabilir ama DB'de eşleşen tur tarihi yoksa
  // dateId null kalır ve bu "tarih hâlâ eksik" anlamına gelir.
  if (!info.dateId) return "waiting_for_date";
  if (!info.paxAdult) return "waiting_for_pax";
  if (!info.fullName) return "waiting_for_name";
  if (!info.phone) return "waiting_for_phone";
  // Email opsiyonel: acente collect_email=true ise, ya email alındı ya da skip edildi olmalı
  if (collectEmail && !info.email && !info.emailSkipped) return "waiting_for_email";
  return "ready_for_confirmation";
}

function isAllInfoCollected(info: ReservationInfo, collectEmail?: boolean): boolean {
  // dateId ZORUNLU: DB'de gerçekten mevcut bir tarih olduğunu garantiler.
  // selectedDate tek başına yeterli değil — DB'de eşleşmeyen tarih rezervasyon kaydında başarısız olur.
  const basicDone = !!(info.tourId && info.dateId && info.paxAdult && info.fullName && info.phone);
  if (!basicDone) return false;
  if (collectEmail) return !!(info.email || info.emailSkipped);
  return true;
}

/**
 * NLU'dan tamamen bağımsız deterministik onay tespiti.
 * SADECE CONFIRMING → COMPLETED geçişinde kullanılır.
 * NLU timeout/hata olsa bile "evet" gibi açık onay kelimeleri yakalar.
 *
 * Negative guard: "evet AMA", "yes BUT change", "tamam FAKAT başka tarih" gibi
 * ifadeler onay sayılmaz — müşteri aslında değiştirmek istiyor.
 */
export function detectConfirmation(message: string, language: string): boolean {
  const msg = message.toLowerCase().trim();

  // Negative patterns — bunlar varsa onay değil
  const negativePatterns: Record<string, RegExp> = {
    tr: /\b(ama|fakat|ancak|lakin|değil|yok|hayır|istemiyorum|vazgeçtim|olmaz|bekle|dur|aslında|sanki|acaba|mı\?|mi\?|değil mi|yanlış|hata|hatalı)\b/i,
    en: /\b(but|however|except|not|no|don't|wait|hold|change|actually|wrong|mistake|rather|instead|unless)\b/i,
    de: /\b(aber|jedoch|nicht|nein|warte|ändern|eigentlich|falsch|stattdessen)\b/i,
    fr: /\b(mais|cependant|non|pas|attends|changer|plutôt|en fait|faux)\b/i,
    es: /\b(pero|sin embargo|no|espera|cambiar|en realidad|incorrecto|equivocado)\b/i,
    ru: /\b(но|однако|нет|не|подожди|изменить|вообще-то|неправильно|ошибка)\b/i,
    ar: /\b(لكن|لا|ليس|انتظر|تغيير|في الواقع|خطأ)\b/i,
  };

  // Positive patterns
  const positivePatterns: Record<string, RegExp> = {
    tr: /\b(evet|onayl[ıi]yorum|tamam|ok|olur|kabul|do[ğg]ru|onayla|tasdik|kesinlikle|tamamdır|onaylıorum|peki|tabii)\b/i,
    en: /\b(yes|confirm|approve|ok|okay|sure|right|correct|definitely|agreed|deal|absolutely)\b/i,
    de: /\b(ja|best[äa]tigen|ok|richtig|genau|stimmt|einverstanden|natürlich)\b/i,
    fr: /\b(oui|confirme|d'accord|ok|exact|parfait|absolument)\b/i,
    es: /\b(si|s[íi]|confirmo|vale|ok|correcto|claro|exacto)\b/i,
    ru: /\b(да|подтверждаю|ок|верно|правильно|согласен|конечно)\b/i,
    ar: /\b(نعم|أكد|موافق|تمام|صحيح|بالتأكيد)\b/i,
  };

  const langKey = language as keyof typeof positivePatterns;

  // Dile özgü + TR + EN fallback (karışık dil için)
  const hasPositive =
    (positivePatterns[langKey]?.test(msg) ?? false) ||
    positivePatterns.tr.test(msg) ||
    positivePatterns.en.test(msg);

  if (!hasPositive) return false;

  // Negative check — dile özgü + EN fallback
  const hasNegative =
    (negativePatterns[langKey]?.test(msg) ?? false) ||
    negativePatterns.en.test(msg);

  // "evet ama..." veya "yes but..." → onay değil
  return !hasNegative;
}

/**
 * Kullanıcı iptal mi ediyor? "vazgeçtim", "iptal", "istemiyorum" gibi ifadeler.
 * CONFIRMING → COLLECTING_INFO → TOUR_SELECTED gibi aktif state'lerde BROWSING'e dönüş için kullanılır.
 */
export function detectCancellation(text: string, language: string): boolean {
  const patterns: Record<string, RegExp> = {
    // TR: iptal + reset/baştan başla kalıpları
    tr: /\b(vazge[cç]tim|vazgeçiyorum|iptal|istemiyorum|olmas[ıi]n|gerek yok|bo[sş] ver|ba[sş]ka zaman|d[uü][sş][uü]neyim|d[uü][sş][uü]neyim de|pas|paslıyorum|ba[sş]tan ba[sş]la|ba[sş]tan ba[sş]lamak|ba[sş]tan ba[sş]layal[ıi]m|yeniden ba[sş]la|yeniden ba[sş]lamak|s[ıi]f[ıi]rla|ba[sş]a dön)\b/i,
    en: /\b(cancel|nevermind|never mind|forget it|don'?t want|skip it|maybe later|not now|pass|leave it|restart|reset|start over|start fresh|begin again|from scratch|new conversation)\b/i,
    de: /\b(abbrechen|stornieren|möchte nicht|will nicht|vergiss es|vergessen|später|nicht mehr|lass es sein|neu starten|von vorne|nochmal|neu anfangen)\b/i,
    ru: /\b(отмена|отменить|не хочу|неважно|забудь|забудьте|позже|потом|не надо|заново|сначала|начать заново)\b/i,
    ar: /\b(إلغاء|لا أريد|انس الأمر|لاحقا|ليس الآن|اتركها|البدء من جديد|إعادة|ابدأ من جديد)\b/i,
    fr: /\b(annuler|j'abandonne|peu importe|laisse tomber|laissez tomber|plus tard|pas maintenant|oublie|recommencer|depuis le début|repartir)\b/i,
    es: /\b(cancelar|olvídalo|olvidalo|no quiero|déjalo|dejalo|más tarde|otro día|olvida|reiniciar|empezar de nuevo|desde el principio)\b/i,
  };
  const langKey = language as keyof typeof patterns;
  return (patterns[langKey]?.test(text) ?? false) || patterns.en.test(text);
}

export function getCancellationMessage(language: string): string {
  const messages: Record<string, string> = {
    tr: "Tamam, sorun değil! 😊 Başka bir konuda yardımcı olabilirim. Hangi tur ilginizi çeker?",
    en: "No problem! 😊 I can help you with something else. Which tour interests you?",
    de: "Kein Problem! 😊 Ich kann Ihnen mit etwas anderem helfen. Welche Tour interessiert Sie?",
    ru: "Без проблем! 😊 Я могу помочь вам с чем-то другим. Какой тур вас интересует?",
    ar: "لا مشكلة! 😊 يمكنني مساعدتك في شيء آخر. ما الجولة التي تهمك؟",
    fr: "Pas de problème ! 😊 Je peux vous aider avec autre chose. Quel circuit vous intéresse ?",
    es: "¡No hay problema! 😊 Puedo ayudarte con otra cosa. ¿Qué tour te interesa?",
  };
  return messages[language] || messages.en;
}

/**
 * K6: After-sales mesajı mı? COMPLETED state'de mevcut rezervasyon context'ini korumak için.
 * detectCancellation ve hasNewReservationIntent'ten sonra çağrılır — onlar önce yakalanır.
 * Ödeme bildirimi, değişiklik/iptal isteği, durum sorma, buluşma/transfer soruları vs.
 */
/**
 * K6: After-sales mesajı mı? COMPLETED state'de mevcut rezervasyon context'ini korumak için.
 * detectCancellation ve hasNewReservationIntent'ten sonra çağrılır — onlar önce yakalanır.
 * Kapsam: ödeme bildirimi, rezervasyon değişiklik/iptal isteği, durum sorma,
 *          buluşma/transfer soruları, "ne zaman arayacaksınız" vb.
 */
function isAfterSalesMessage(userMessage: string, detectedIntent: string): boolean {
  // NLU'dan after-sales intent geldiyse direkt yakala
  const afterSalesIntents = [
    "after_sales", "cancellation_policy", "payment_methods",
    "agency_info", "working_hours", "change_info",
  ];
  if (afterSalesIntents.includes(detectedIntent)) return true;

  const msg = userMessage.toLowerCase();

  // ÖDEME BİLDİRİMİ — 7 dil
  const paymentPatterns =
    /\b(ödedim|ödeme\s+yaptım|havale\s+yaptım|para\s+gönderdim|eft\s+yaptım|banka\s+transfer|dekont|makbuz|paid\b|i\s+paid|payment\s+sent|transferred|receipt|bank\s+transfer|bezahlt|habe\s+bezahlt|überwiesen|beleg|оплатил|оплатила|перевёл|перевела|чек|квитанцию|دفعت|أرسلت\s+الدفع|payé|j['']ai\s+payé|reçu|pagué|hice\s+el\s+pago|recibo)\b/i;
  if (paymentPatterns.test(msg)) return true;

  // REZERVASYON SORGU / DEĞİŞİKLİK / İPTAL — Türkçe çekim ekleri dahil
  // "rezervasyonum/rezervasyonumu/rezervasyonumuz" + eylem
  const bookingActionPatterns =
    /rezervasyon\w{0,8}\s+.{0,25}?(iptal|değiştir|değişiklik|sorgu|durum|teyit|onay|haber|ne\s+zaman|nasıl|hakkında)|rezervasyonum(u|uz|a|da|dan)?\s+(iptal|değiştir|değişiklik|durum|teyit|onay)/i;
  if (bookingActionPatterns.test(msg)) return true;

  // ZAMANLAMA / ACENTE İLETİŞİM SORULARI
  const timingPatterns =
    /ne\s+zaman\s+(arayacak|ulaşacak|haberleşecek|teyit\s+edecek|onaylayacak|yazacak)|arayacak\s*mısınız|haber\s+verecek\s*misiniz|ne\s+zaman\s+haber|teyit\s+(geldi|bekliyorum|edecek|gelecek)|onay\s+(bekliyorum|geldi|gelecek)|when\s+(will\s+)?(you\s+)?(call|contact|reach|confirm)|wann\s+(rufen|kontaktieren|bestätigen)|когда\s+(позвоните|свяжетесь)|متى\s+ستتصل|quand\s+allez[\s-]vous\s+appeler|cuándo\s+van\s+a\s+llamar/i;
  if (timingPatterns.test(msg)) return true;

  // BULUŞMA / KALKIŞ / TRANSFER / HAZIRLIK
  const meetingPatterns =
    /buluşma\s*(yeri|noktası|saati)|toplanma\s*(yeri|noktası|saati)|kalkış\s*(yeri|saati|noktası)|karşılama\s*(yeri|saati|noktası|transfer)?|havalimanı\s*(transfer|karşılama)|transfer\b|ne\s+getireyim|ne\s+giyeyim|yanımda\s+ne|hazırlık\s*(yapayım|nasıl)|meeting\s+point|pickup\s+(point|location|time)|pick[\s-]up|Treffpunkt|abholen|место\s+встречи|что\s+взять|نقطة\s+الاجتماع|point\s+de\s+rencontre|punto\s+de\s+encuentro/i;
  if (meetingPatterns.test(msg)) return true;

  // İNGİLİZCE / DİĞER DİL BOOKING ACTIONS
  const intlBookingPatterns =
    /booking\s+(change|cancel|status|confirm|modify)|cancel\s+(my\s+)?booking|change\s+(my\s+)?booking|modify\s+(my\s+)?booking|confirmation\s+(email|message|received)|what\s+to\s+(bring|wear|pack)|Buchung\s+(ändern|stornieren|status)|изменить\s+бронирование|отменить\s+бронирование|статус\s+брони|تعديل\s+الحجز|إلغاء\s+الحجز|changer\s+(ma\s+)?réservation|annuler\s+(ma\s+)?réservation|cambiar\s+(mi\s+)?reserva|cancelar\s+(mi\s+)?reserva/i;
  if (intlBookingPatterns.test(msg)) return true;

  return false;
}

function resetForNewReservation(ctx: ConversationContext): Partial<ConversationContext> {
  return {
    currentTour: null,
    reservationInfo: {},
    reservationConfirmed: false,
    paymentInfoSent: false,
    collectionStep: undefined,
    viewedTours: [],
    isNewReservation: true,
  };
}

const transitions: StateTransition[] = [
  // ── İPTAL GEÇİŞLERİ (en üstte — önce kontrol edilir) ────────────────────
  // Kullanıcı aktif bir flow'dayken "vazgeçtim/iptal/istemiyorum" derse BROWSING'e dön.
  {
    from: "TOUR_SELECTED",
    to: "BROWSING",
    condition: (_ctx, input) => detectCancellation(input.userMessage, input.language),
    action: (ctx) => ({
      ...ctx,
      currentTour: null,
      reservationInfo: {},
      collectionStep: undefined,
      justCancelled: true,
    }),
  },
  {
    from: "COLLECTING_INFO",
    to: "BROWSING",
    condition: (_ctx, input) => detectCancellation(input.userMessage, input.language),
    action: (ctx) => ({
      ...ctx,
      currentTour: null,
      reservationInfo: {},
      reservationConfirmed: false,
      collectionStep: undefined,
      justCancelled: true,
    }),
  },
  {
    from: "CONFIRMING",
    to: "BROWSING",
    condition: (_ctx, input) => detectCancellation(input.userMessage, input.language),
    action: (ctx) => ({
      ...ctx,
      currentTour: null,
      reservationInfo: {},
      reservationConfirmed: false,
      collectionStep: undefined,
      justCancelled: true,
    }),
  },
  // ─────────────────────────────────────────────────────────────────────────

  // GREETING → TOUR_SELECTED
  {
    from: "GREETING",
    to: "TOUR_SELECTED",
    condition: (ctx, input) => input.selectedTour !== null,
    action: (ctx, input) => ({
      ...ctx,
      currentTour: input.selectedTour,
      viewedTours: [...ctx.viewedTours, input.selectedTour!.id],
      reservationInfo: {
        tourId: input.selectedTour!.id,
        tourTitle: input.selectedTour!.title,
      },
    }),
  },

  // GREETING → BROWSING
  {
    from: "GREETING",
    to: "BROWSING",
    condition: (ctx, input) =>
      input.selectedTour === null &&
      (input.detectedIntent === "browse_tours" ||
        input.detectedIntent === "tour_search" ||
        input.detectedIntent === "greeting" ||
        input.detectedIntent === "general"),
  },

  // BROWSING → COLLECTING_INFO
  {
    from: "BROWSING",
    to: "COLLECTING_INFO",
    condition: (ctx, input) => {
      const hasSelectedTour = input.selectedTour !== null;
      const hasCurrentTour = ctx.currentTour !== null;
      const isReservationAction =
        input.detectedIntent === "reservation_intent" ||
        input.detectedIntent === "tour_selected" ||
        input.detectedIntent === "provide_info" ||
        input.detectedIntent === "confirm";
      return (hasSelectedTour || hasCurrentTour) && isReservationAction;
    },
    action: (ctx, input) => {
      const tour = input.selectedTour || ctx.currentTour;
      const merged = mergeReservationInfo({ tourId: tour!.id, tourTitle: tour!.title }, input.extractedInfo, false);
      return {
        ...ctx,
        currentTour: tour,
        viewedTours: input.selectedTour ? [...ctx.viewedTours, input.selectedTour.id] : ctx.viewedTours,
        reservationInfo: merged,
        collectionStep: determineCollectionStep(merged, ctx.collectEmail),
      };
    },
  },

  // BROWSING → TOUR_SELECTED
  {
    from: "BROWSING",
    to: "TOUR_SELECTED",
    condition: (ctx, input) =>
      input.selectedTour !== null &&
      input.detectedIntent !== "reservation_intent" &&
      input.detectedIntent !== "tour_selected" &&
      input.detectedIntent !== "provide_info" &&
      input.detectedIntent !== "confirm",
    action: (ctx, input) => ({
      ...ctx,
      currentTour: input.selectedTour,
      viewedTours: [...ctx.viewedTours, input.selectedTour!.id],
      reservationInfo: {
        tourId: input.selectedTour!.id,
        tourTitle: input.selectedTour!.title,
      },
    }),
  },

  // TOUR_SELECTED → COLLECTING_INFO
  {
    from: "TOUR_SELECTED",
    to: "COLLECTING_INFO",
    condition: (ctx, input) => {
      if (isInformationalMessage(input.userMessage, input.detectedIntent)) return false;
      const reservationIntents = ["reservation_intent", "provide_info", "confirm", "tour_selected"];
      if (!reservationIntents.includes(input.detectedIntent)) {
        const hasExtractedInfo = Object.keys(input.extractedInfo).length > 0;
        const hasPaxPattern = /\d+\s*(kişi|person|people|yetişkin|adult|çocuk|child)/i.test(input.userMessage);
        const hasPhonePattern = /\b05\d{9}\b|\b\+\d{7,}/i.test(input.userMessage);
        // Tarih bilgisi gelince geçiş yap — "5 Mart 2027" gibi geçersiz tarihler de yakalanır (BUG 1)
        const hasDateInfo = !!(input.extractedInfo as any).selectedDate || !!(input.extractedInfo as any).dateId;
        return hasExtractedInfo && (hasPaxPattern || hasPhonePattern || hasDateInfo);
      }
      return true;
    },
    action: (ctx, input) => {
      const merged = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo, false);
      return {
        ...ctx,
        reservationInfo: merged,
        collectionStep: determineCollectionStep(merged, ctx.collectEmail),
        isNewReservation: false,
      };
    },
  },

  // TOUR_SELECTED → TOUR_SELECTED (tur değişimi)
  {
    from: "TOUR_SELECTED",
    to: "TOUR_SELECTED",
    condition: (ctx, input) =>
      input.selectedTour !== null &&
      input.selectedTour.id !== ctx.currentTour?.id &&
      Object.keys(ctx.reservationInfo).length <= 2,
    action: (ctx, input) => ({
      ...ctx,
      currentTour: input.selectedTour,
      viewedTours: [...ctx.viewedTours, input.selectedTour!.id],
      reservationInfo: {
        tourId: input.selectedTour!.id,
        tourTitle: input.selectedTour!.title,
      },
      collectionStep: "waiting_for_date" as InfoCollectionStep,
    }),
  },

  // COLLECTING_INFO → TOUR_SELECTED (tur değişimi — B2: genişletilmiş pattern)
  // "aslında başka tur" / "Kapadokya'ya geç" / "farklı tur" gibi geçişleri de yakalar.
  // NOT: selectedTour null ise geçiş olmaz; o durumda B2 deterministik listesi devreye girer (process-message).
  {
    from: "COLLECTING_INFO",
    to: "TOUR_SELECTED",
    condition: (ctx, input) =>
      input.selectedTour !== null &&
      input.selectedTour.id !== ctx.currentTour?.id &&
      (/yeni tur|başka tur|tur değiştir|switch tour|change tour|different tour|farklı tur|diğer tur|tur\s*değişt|aslında\s+.{0,20}?tur|bunun\s+yerine\s+.{0,20}?tur|andere tour|другой тур|tour différent|tour diferente|جولة أخرى/i.test(input.userMessage) ||
       input.detectedIntent === "reservation_intent"),
    action: (ctx, input) => ({
      ...ctx,
      currentTour: input.selectedTour,
      viewedTours: [...ctx.viewedTours, input.selectedTour!.id],
      reservationInfo: {
        tourId: input.selectedTour!.id,
        tourTitle: input.selectedTour!.title,
      },
      collectionStep: "waiting_for_date" as InfoCollectionStep,
    }),
  },

  // COLLECTING_INFO → COLLECTING_INFO
  // KRİTİK: Bilgi sorusu gelince mevcut bilgileri KORU.
  // K7: Tüm bilgi doluysa (allInfoCollected) intent ne olursa olsun CONFIRMING'e geç.
  {
    from: "COLLECTING_INFO",
    to: "COLLECTING_INFO",
    condition: (ctx, input) => {
      const isInfo = isInformationalMessage(input.userMessage, input.detectedIntent);
      // Bilgi sorusu gelirse ekstraksiyonu dışarıda bırak; sadece mevcut bilgilerle kontrol et
      const merged = isInfo
        ? { ...ctx.reservationInfo }
        : mergeReservationInfo(ctx.reservationInfo, input.extractedInfo, false);
      // K7: Tüm bilgi tamamsa bu transition'ı atla → COLLECTING_INFO→CONFIRMING devralır
      return !isAllInfoCollected(merged, ctx.collectEmail);
    },
    action: (ctx, input) => {
      const isInfo = isInformationalMessage(input.userMessage, input.detectedIntent);
      // Bilgi sorusu gelirse mevcut bilgileri değiştirme
      const merged = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo, isInfo);
      return {
        ...ctx,
        reservationInfo: merged,
        collectionStep: determineCollectionStep(merged, ctx.collectEmail),
      };
    },
  },

  // COLLECTING_INFO → CONFIRMING
  // KRİTİK: Bilgi sorusu gelince CONFIRMING'e GEÇMEİ
  // Kullanıcı açıkça onay vermedikçe bu geçiş tetiklenMEZ
  {
    from: "COLLECTING_INFO",
    to: "CONFIRMING",
    condition: (ctx, input) => {
      // Bilgi sorusu gelirse kesinlikle CONFIRMING'e geçme
      if (isInformationalMessage(input.userMessage, input.detectedIntent)) return false;
      // provide_info veya confirm intenti olmalı
      const validIntents = ["provide_info", "confirm", "confirm_reservation", "general"];
      if (!validIntents.includes(input.detectedIntent)) return false;
      const merged = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo, false);
      return isAllInfoCollected(merged, ctx.collectEmail);
    },
    action: (ctx, input) => ({
      ...ctx,
      reservationInfo: mergeReservationInfo(ctx.reservationInfo, input.extractedInfo, false),
      collectionStep: "ready_for_confirmation" as InfoCollectionStep,
    }),
  },

  // CONFIRMING → COMPLETED
  // KRİTİK: Sadece açık onay kelimesiyle tetiklenir.
  // detectConfirmation NLU'dan bağımsız çalışır — NLU timeout olsa bile "evet" yakalar.
  {
    from: "CONFIRMING",
    to: "COMPLETED",
    condition: (ctx, input) => {
      // 1. Deterministik onay tespiti — NLU'ya bakmadan ÖNCE kontrol et.
      //    Kullanıcı açıkça onay verdiyse NLU intent'ten bağımsız geç.
      if (detectConfirmation(input.userMessage, ctx.language)) return true;
      // 2. Bilgi sorusu gelirse kesinlikle CONFIRMING'de kal.
      if (isInformationalMessage(input.userMessage, input.detectedIntent)) return false;
      // 3. NLU açıkça confirm_reservation döndürdüyse geç.
      return input.detectedIntent === "confirm_reservation";
    },
    action: (ctx) => ({
      ...ctx,
      reservationConfirmed: true,
      collectionStep: undefined,
    }),
  },

  // CONFIRMING → COLLECTING_INFO (değişiklik) — BUG 5
  {
    from: "CONFIRMING",
    to: "COLLECTING_INFO",
    condition: (ctx, input) =>
      input.detectedIntent === "change_info" ||
      /değiştir|olsun|olarak\s+değiştir|change|modify|edit|düzelt|yanlış|wrong|incorrect|hatalı|değil|farklı|eksik|fazla|güncelle|update|fix|correct|корректировать|неправильно|ändern|falsch|corriger|corregir|تعديل|خطأ/i.test(input.userMessage.toLowerCase()),
    action: (ctx, input) => {
      const msg = input.userMessage.toLowerCase();
      const info = { ...ctx.reservationInfo };

      // Çok dilli alan pattern'leri — "ismi" "adı" gibi Türkçe çekimler eklendi
      const namePattern   = /isim|ismi|adım|adı|adın|soyad|surname|name|namen?|имя|اسم|إسم|nom|nombre/i;
      const phonePattern  = /\b(telefon|numara|phone|tel|gsm|cep|handy|телефон|номер|هاتف|رقم|téléphone|teléfono)\b/i;
      const paxPattern    = /\b(ki[şs]i|yeti[şs]kin|[çc]ocuk|pax|person|people|adult|child|kinder|personen|человек|людей|дети|أشخاص|أطفال|personnes|enfants|personas|niños)\b/i;
      const datePattern   = /\b(tarih|date|gün|day|datum|tag|дата|день|تاريخ|يوم|jour|día|fecha)\b/i;

      if (namePattern.test(msg)) {
        // Yeni isim mesajda varsa (NLU çıkardıysa) direkt güncelle, waiting_for_name'e gerek yok
        if ((input.extractedInfo as any).fullName) {
          info.fullName = (input.extractedInfo as any).fullName;
        } else {
          delete info.fullName;
        }
      } else if (phonePattern.test(msg)) {
        if ((input.extractedInfo as any).phone) {
          info.phone = (input.extractedInfo as any).phone;
        } else {
          delete info.phone;
        }
      } else if (paxPattern.test(msg)) {
        if ((input.extractedInfo as any).paxAdult) {
          info.paxAdult = (input.extractedInfo as any).paxAdult;
        } else {
          delete info.paxAdult;
          delete info.paxChild;
        }
      } else if (datePattern.test(msg)) {
        delete info.dateId;
        delete info.selectedDate;
      } else {
        // Belirsiz "değiştir" / "olsun" isteği — en yaygın: tarih değiştirme.
        // Phone ve isim korunur; müşteri yeni tarih seçer.
        delete info.dateId;
        delete info.selectedDate;
      }

      return {
        ...ctx,
        reservationInfo: info,
        collectionStep: determineCollectionStep(info, ctx.collectEmail),
      };
    },
  },

  // ===== COMPLETED STATE TRANSITIONS =====

  // COMPLETED → BROWSING (iptal / reset / baştan başla) — en yüksek öncelik
  // "vazgeçtim", "baştan başlayalım", "sıfırla", "restart" gibi kalıpları yakalar.
  // NOT: after-sales'den ÖNCE kontrol edilir — "iptal" tek başına conversation reset anlamına gelir.
  {
    from: "COMPLETED",
    to: "BROWSING",
    condition: (_ctx, input) => detectCancellation(input.userMessage, input.language),
    action: (ctx) => ({
      ...ctx,
      ...resetForNewReservation(ctx),
      stage: "BROWSING" as ConversationStage,
      justCancelled: true,
    }),
  },

  // COMPLETED → COMPLETED (after-sales — mevcut rezervasyon context'ini koru)
  // K6: "Rezervasyonumu değiştirmek istiyorum", "ödedim", "ne zaman arayacaksınız" vs.
  // detectCancellation ve hasNewReservationIntent'ten SONRA kontrol edilir.
  // Bu transition, COMPLETED → BROWSING (greeting/general) geçişinden ÖNCE çalışır.
  {
    from: "COMPLETED",
    to: "COMPLETED",
    condition: (_ctx, input) => isAfterSalesMessage(input.userMessage, input.detectedIntent),
    action: (ctx) => ({ ...ctx }), // Tüm context (reservationInfo, currentTour) aynen korunur
  },

  // COMPLETED → BROWSING (YENİ REZERVASYON KASTI — currentTour'u önemseme)
  // "başka rezervasyon", "yeni tur", "başka nereler var" gibi mesajlarda selectedTour
  // dolu olsa bile (örn. "pamukkale değil başka nereler"), FRESH START yap.
  // Bu transition COMPLETED → TOUR_SELECTED #17'den ÖNCE çalışır — kasıt baskın.
  {
    from: "COMPLETED",
    to: "BROWSING",
    condition: (_ctx, input) => hasNewReservationIntent(input.userMessage, input.detectedIntent),
    action: (ctx) => ({
      ...ctx,
      ...resetForNewReservation(ctx),
      stage: "BROWSING" as ConversationStage,
    }),
  },

  // COMPLETED → BROWSING (selamlama / tur araması / genel intent — tur seçilmemişse)
  // "Merhaba", "Turları görmek istiyorum", "Turlarınızı öğrenebilir miyim" gibi mesajlar
  {
    from: "COMPLETED",
    to: "BROWSING",
    condition: (_ctx, input) =>
      ["greeting", "browse_tours", "tour_search", "general"].includes(input.detectedIntent) &&
      input.selectedTour === null,
    action: (ctx) => ({
      ...ctx,
      ...resetForNewReservation(ctx),
      stage: "BROWSING" as ConversationStage,
    }),
  },

  // COMPLETED → BROWSING (yeni rezervasyon niyeti, tur belirtilmemiş)
  {
    from: "COMPLETED",
    to: "BROWSING",
    condition: (ctx, input) =>
      hasNewReservationIntent(input.userMessage, input.detectedIntent) && input.selectedTour === null,
    action: (ctx) => ({
      ...ctx,
      ...resetForNewReservation(ctx),
      stage: "BROWSING" as ConversationStage,
    }),
  },

  // COMPLETED → BROWSING (tour_search intent — kullanıcı yeni tur arıyor, tur seçilmedi)
  // "ege turu istiyorum" gibi mesajlarda NLU tour_search döndürür ama isInformationalMessage
  // bunu bilgi sorusu sayıp diğer transition'ları engeller. Bu geçiş generic kaçış kapısı.
  {
    from: "COMPLETED",
    to: "BROWSING",
    condition: (ctx, input) =>
      input.detectedIntent === "tour_search" && input.selectedTour === null,
    action: (ctx) => ({
      ...ctx,
      ...resetForNewReservation(ctx),
      stage: "BROWSING" as ConversationStage,
    }),
  },

  // COMPLETED → TOUR_SELECTED (rezervasyon niyetiyle — aynı veya farklı tur)
  {
    from: "COMPLETED",
    to: "TOUR_SELECTED",
    condition: (ctx, input) => {
      if (isInformationalMessage(input.userMessage, input.detectedIntent)) return false;
      const reservationIntents = ["reservation_intent", "tour_selected", "provide_info", "confirm"];
      return input.selectedTour !== null && reservationIntents.includes(input.detectedIntent);
    },
    action: (ctx, input) => ({
      ...ctx,
      ...resetForNewReservation(ctx),
      stage: "TOUR_SELECTED" as ConversationStage,
      currentTour: input.selectedTour,
      viewedTours: [input.selectedTour!.id],
      reservationInfo: {
        tourId: input.selectedTour!.id,
        tourTitle: input.selectedTour!.title,
      },
      collectionStep: "waiting_for_date" as InfoCollectionStep,
    }),
  },

  // COMPLETED → TOUR_SELECTED (herhangi tur seçildi, bilgi amaçlı değil, rezervasyon intent dışı)
  // id eşleşme kontrolü KALDIRILDI: aynı turu tekrar seçme de artık çalışır.
  {
    from: "COMPLETED",
    to: "TOUR_SELECTED",
    condition: (ctx, input) => {
      if (isInformationalMessage(input.userMessage, input.detectedIntent)) return false;
      return (
        input.selectedTour !== null &&
        !["reservation_intent", "tour_selected", "provide_info", "confirm"].includes(input.detectedIntent)
      );
    },
    action: (ctx, input) => ({
      ...ctx,
      ...resetForNewReservation(ctx),
      stage: "TOUR_SELECTED" as ConversationStage,
      currentTour: input.selectedTour,
      viewedTours: [input.selectedTour!.id],
      reservationInfo: {
        tourId: input.selectedTour!.id,
        tourTitle: input.selectedTour!.title,
      },
    }),
  },
];

export function processTransition(context: ConversationContext, input: ProcessingInput): ConversationContext {
  // STATE_INPUT — FSM geçişi öncesi tam input durumu (tarih debug için kritik)
  console.info("STATE_INPUT", {
    currentStage: context.stage,
    collectionStep: context.collectionStep,
    detectedIntent: input.detectedIntent,
    // Tarih bilgisi hangi kaynaktan geliyor?
    hasExtractedDate: !!(input.extractedInfo as any)?.selectedDate,
    hasExtractedDateId: !!(input.extractedInfo as any)?.dateId,
    extractedDate: (input.extractedInfo as any)?.selectedDate,
    // Context'te mevcut tarih
    hasContextDate: !!(context.reservationInfo as any)?.selectedDate,
    hasContextDateId: !!(context.reservationInfo as any)?.dateId,
    // Diğer reservation bilgileri
    hasName: !!(input.extractedInfo as any)?.fullName || !!context.reservationInfo?.fullName,
    hasPhone: !!(input.extractedInfo as any)?.phone || !!context.reservationInfo?.phone,
    hasPax: !!(input.extractedInfo as any)?.paxAdult || !!context.reservationInfo?.paxAdult,
    // Seçili tur
    currentTourId: context.currentTour?.id,
    inputTourId: (input as any).selectedTour?.id,
  });

  const transition = transitions.find((t) => t.from === context.stage && t.condition(context, input));

  if (!transition) {
    // COLLECTING_INFO'daysa ve bilgi sorusu değilse extracted info'yu güncelle
    if (context.stage === "COLLECTING_INFO" && Object.keys(input.extractedInfo).length > 0) {
      const isInfo = isInformationalMessage(input.userMessage, input.detectedIntent);
      const merged = mergeReservationInfo(context.reservationInfo, input.extractedInfo, isInfo);
      return {
        ...context,
        reservationInfo: merged,
        collectionStep: determineCollectionStep(merged, context.collectEmail),
        lastUserMessage: input.userMessage,
        messageCount: context.messageCount + 1,
        lastUpdated: new Date().toISOString(),
      };
    }

    return {
      ...context,
      lastUserMessage: input.userMessage,
      messageCount: context.messageCount + 1,
      lastUpdated: new Date().toISOString(),
    };
  }

  let newContext: ConversationContext = {
    ...context,
    stage: transition.to,
    lastUserMessage: input.userMessage,
    messageCount: context.messageCount + 1,
    lastUpdated: new Date().toISOString(),
  };

  if (transition.action) {
    newContext = transition.action(newContext, input);
  }

  // STATE_OUTPUT — geçiş sonrası yeni durum (tarih "kayboldu mu?" kontrolü)
  console.info("STATE_OUTPUT", {
    fromStage: context.stage,
    toStage: newContext.stage,
    newCollectionStep: newContext.collectionStep,
    reservationDateId: newContext.reservationInfo?.dateId,
    reservationDate: newContext.reservationInfo?.selectedDate,
    reservationPax: newContext.reservationInfo?.paxAdult,
    reservationName: newContext.reservationInfo?.fullName,
  });

  return newContext;
}

export function getNextExpectedInput(context: ConversationContext): string {
  if (context.stage === "GREETING") return "greeting_or_tour_selection";
  if (context.stage === "BROWSING") return "tour_selection";
  if (context.stage === "TOUR_SELECTED" && !context.reservationInfo.dateId) return "date_selection";
  if (context.stage === "COLLECTING_INFO") {
    if (context.collectionStep === "waiting_for_date") return "date";
    if (context.collectionStep === "waiting_for_pax") return "pax";
    if (context.collectionStep === "waiting_for_name") return "name";
    if (context.collectionStep === "waiting_for_phone") return "phone";
  }
  if (context.stage === "CONFIRMING") return "confirmation";
  return "general";
}
