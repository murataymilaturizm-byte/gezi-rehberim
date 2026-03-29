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

// Helper: mesaj bilgi sorusu mu?
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
    /ne zaman|kaç|nedir|nereden|nasıl|hangi|var mı|kaçta|ne kadar|müsait mi|uygun mu|mevcut mu|fiyat|ücret|tarih|program|detay|kaç gün|nerede|hangi otel|nasıl gidilir|\?/i;
  return questionWords.test(userMessage);
}

/**
 * Sıralı bilgi birleştirme (Sequential Merge)
 * 
 * KRİTİK: Bilgiler sıralı olarak kabul edilir:
 *   tarih → kişi sayısı → isim → telefon
 * 
 * Önceki adım dolmadan sonraki adımın bilgisi kabul edilmez.
 * Bu sayede konuşma geçmişinden sızan eski veriler (isim/telefon)
 * yeni bir rezervasyonda yanlışlıkla kabul edilmez.
 * 
 * Aynı mesajda birden fazla bilgi verilirse cascade çalışır:
 *   Ör: "15 Temmuz, 2 kişi, Ali Yılmaz" → date set → pax accepted → name accepted
 */
function mergeReservationInfo(existing: ReservationInfo, extracted: Partial<ReservationInfo>): ReservationInfo {
  const merged = { ...existing };

  // Tour info: her zaman kabul et
  if (extracted.tourId && extracted.tourId !== '') merged.tourId = extracted.tourId;
  if (extracted.tourTitle && extracted.tourTitle !== '') merged.tourTitle = extracted.tourTitle;

  // 1. Tarih: her zaman kabul et (ilk toplanan bilgi)
  if (extracted.dateId && !merged.dateId) merged.dateId = extracted.dateId;
  if (extracted.selectedDate && !merged.selectedDate) merged.selectedDate = extracted.selectedDate;

  // 2. Kişi sayısı: sadece tarih varsa kabul et
  const hasDate = !!(merged.dateId || merged.selectedDate);
  if (hasDate) {
    if (extracted.paxAdult && !merged.paxAdult) merged.paxAdult = extracted.paxAdult;
    if (extracted.paxChild !== undefined && extracted.paxChild !== null) merged.paxChild = extracted.paxChild;
  }

  // 3. İsim: sadece kişi sayısı varsa kabul et
  const hasPax = !!merged.paxAdult;
  if (hasPax && extracted.fullName && extracted.fullName !== '' && !merged.fullName) {
    merged.fullName = extracted.fullName;
  }

  // 4. Telefon: sadece isim varsa kabul et
  const hasName = !!merged.fullName;
  if (hasName && extracted.phone && extracted.phone !== '' && !merged.phone) {
    merged.phone = extracted.phone;
  }

  return merged;
}

/**
 * Bir sonraki toplanması gereken adımı belirle
 */
function determineCollectionStep(info: ReservationInfo): InfoCollectionStep {
  const hasDate = !!(info.selectedDate || info.dateId);
  if (!hasDate) return "waiting_for_date";
  if (!info.paxAdult) return "waiting_for_pax";
  if (!info.fullName) return "waiting_for_name";
  if (!info.phone) return "waiting_for_phone";
  return "ready_for_confirmation";
}

function isAllInfoCollected(info: ReservationInfo): boolean {
  return !!(info.tourId && info.dateId && info.selectedDate && info.paxAdult && info.fullName && info.phone);
}

/**
 * COMPLETED'dan çıkış için context'i tamamen sıfırla
 */
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
      const merged = mergeReservationInfo(
        {
          tourId: tour!.id,
          tourTitle: tour!.title,
        },
        input.extractedInfo,
      );

      if (!merged.dateId && !merged.selectedDate && tour?.dates?.length === 1) {
        const singleDate = tour.dates[0];
        merged.dateId = singleDate.id;
        merged.selectedDate = singleDate.departure_date;
      }

      return {
        ...ctx,
        currentTour: tour,
        viewedTours: input.selectedTour ? [...ctx.viewedTours, input.selectedTour.id] : ctx.viewedTours,
        reservationInfo: merged,
        collectionStep: determineCollectionStep(merged),
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
        return hasExtractedInfo && (hasPaxPattern || hasPhonePattern);
      }
      return true;
    },
    action: (ctx, input) => {
      const merged = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo);
      if (!merged.dateId && !merged.selectedDate && ctx.currentTour?.dates?.length === 1) {
        const singleDate = ctx.currentTour.dates[0];
        merged.dateId = singleDate.id;
        merged.selectedDate = singleDate.departure_date;
      }
      return {
        ...ctx,
        reservationInfo: merged,
        collectionStep: determineCollectionStep(merged),
        isNewReservation: false, // İlk COLLECTING_INFO geçişinde flag'i kaldır
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

  // COLLECTING_INFO → TOUR_SELECTED (tur değişimi onaylı)
  {
    from: "COLLECTING_INFO",
    to: "TOUR_SELECTED",
    condition: (ctx, input) =>
      input.selectedTour !== null &&
      input.selectedTour.id !== ctx.currentTour?.id &&
      /yeni tur|başka tur|tur değiştir|cancel|iptal|switch tour|change tour|different tour/i.test(input.userMessage),
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
  {
    from: "COLLECTING_INFO",
    to: "COLLECTING_INFO",
    condition: (ctx, input) => {
      const merged = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo);
      return !isAllInfoCollected(merged);
    },
    action: (ctx, input) => {
      const merged = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo);
      return {
        ...ctx,
        reservationInfo: merged,
        collectionStep: determineCollectionStep(merged),
      };
    },
  },

  // COLLECTING_INFO → CONFIRMING
  {
    from: "COLLECTING_INFO",
    to: "CONFIRMING",
    condition: (ctx, input) => {
      const merged = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo);
      return isAllInfoCollected(merged);
    },
    action: (ctx, input) => ({
      ...ctx,
      reservationInfo: mergeReservationInfo(ctx.reservationInfo, input.extractedInfo),
      collectionStep: "ready_for_confirmation" as InfoCollectionStep,
    }),
  },

  // CONFIRMING → COMPLETED
  {
    from: "CONFIRMING",
    to: "COMPLETED",
    condition: (ctx, input) =>
      input.detectedIntent === "confirm_reservation" ||
      /^(evet|yes|da|oui|si|sim|はい)/i.test(input.userMessage.toLowerCase().trim()),
    action: (ctx) => ({
      ...ctx,
      reservationConfirmed: true,
      collectionStep: undefined,
    }),
  },

  // CONFIRMING → COLLECTING_INFO (değişiklik)
  {
    from: "CONFIRMING",
    to: "COLLECTING_INFO",
    condition: (ctx, input) =>
      input.detectedIntent === "change_info" || /değiştir|change|modify|edit|düzelt|yanlış|wrong|incorrect|hatalı/i.test(input.userMessage.toLowerCase()),
    action: (ctx, input) => {
      const msg = input.userMessage.toLowerCase();
      const info = { ...ctx.reservationInfo };

      // Kullanıcının hangi alanı değiştirmek istediğini tespit et ve o alanı temizle
      if (/isim|ad|name|soyad|surname/i.test(msg)) {
        delete info.fullName;
      } else if (/telefon|numara|phone|gsm|cep/i.test(msg)) {
        delete info.phone;
      } else if (/kişi|pax|person|people|yetişkin|adult|çocuk|child/i.test(msg)) {
        delete info.paxAdult;
        delete info.paxChild;
      } else if (/tarih|date|gün|day/i.test(msg)) {
        delete info.dateId;
        delete info.selectedDate;
      } else {
        // Hangi alan olduğu anlaşılamadıysa, tüm kişisel bilgileri temizle (tarih ve tur hariç)
        delete info.fullName;
        delete info.phone;
      }

      return {
        ...ctx,
        reservationInfo: info,
        collectionStep: determineCollectionStep(info),
      };
    },
  },

  // ========== COMPLETED STATE TRANSITIONS ==========
  // COMPLETED → TOUR_SELECTED (aynı veya farklı tur için yeni rezervasyon niyeti)
  {
    from: "COMPLETED",
    to: "TOUR_SELECTED",
    condition: (ctx, input) => {
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

  // COMPLETED → BROWSING (açık yeni tur niyeti)
  {
    from: "COMPLETED",
    to: "BROWSING",
    condition: (ctx, input) => {
      const wantsNewReservation =
        /başka tur|farklı tur|diğer tur|other tour|another tour|different tour|yeni tur|new tour|yeni rezervasyon|new reservation|ikinci rez|başka bir rez|bir daha|tekrar rez/i.test(
          input.userMessage,
        );
      const isReservationIntentWithoutTour =
        input.detectedIntent === "reservation_intent" && input.selectedTour === null;
      return wantsNewReservation || isReservationIntentWithoutTour;
    },
    action: (ctx) => ({
      ...ctx,
      ...resetForNewReservation(ctx),
      stage: "BROWSING" as ConversationStage,
    }),
  },

  // COMPLETED → TOUR_SELECTED (farklı tur seçimi)
  {
    from: "COMPLETED",
    to: "TOUR_SELECTED",
    condition: (ctx, input) => {
      return input.selectedTour !== null && input.selectedTour.id !== ctx.currentTour?.id;
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
  const transition = transitions.find((t) => t.from === context.stage && t.condition(context, input));

  if (!transition) {
    // Geçiş yok ama COLLECTING_INFO'daysa mevcut bilgileri güncelle
    if (context.stage === "COLLECTING_INFO" && Object.keys(input.extractedInfo).length > 0) {
      const merged = mergeReservationInfo(context.reservationInfo, input.extractedInfo);
      return {
        ...context,
        reservationInfo: merged,
        collectionStep: determineCollectionStep(merged),
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
