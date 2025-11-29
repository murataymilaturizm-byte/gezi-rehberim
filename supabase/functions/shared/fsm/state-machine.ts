// Shared FSM state machine logic
import type { 
  ConversationContext, 
  ConversationStage, 
  ConversationTone,
  StateTransition, 
  ProcessingInput,
  InfoCollectionStep,
  ReservationInfo 
} from './types.ts';

/**
 * Creates the initial conversation context
 */
export function createInitialContext(
  language: string = 'tr',
  tone: ConversationTone = 'standart'
): ConversationContext {
  return {
    stage: 'GREETING',
    currentTour: null,
    viewedTours: [],
    reservationInfo: {},
    reservationConfirmed: false,
    paymentInfoSent: false,
    language,
    tone,
    messageCount: 0,
    lastUserMessage: '',
    sessionStarted: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Defines all possible state transitions in the FSM
 */
const transitions: StateTransition[] = [
  // GREETING → BROWSING
  {
    from: 'GREETING',
    to: 'BROWSING',
    condition: (ctx, input) => 
      input.detectedIntent === 'browse_tours' || 
      input.detectedIntent === 'tour_search'
  },
  
  // GREETING → TOUR_SELECTED
  {
    from: 'GREETING',
    to: 'TOUR_SELECTED',
    condition: (ctx, input) => input.selectedTour !== null,
    action: (ctx, input) => ({
      ...ctx,
      currentTour: input.selectedTour,
      viewedTours: [...ctx.viewedTours, input.selectedTour!.id],
      reservationInfo: {
        ...ctx.reservationInfo,
        tourId: input.selectedTour!.id,
        tourTitle: input.selectedTour!.title
      }
    })
  },
  
  // BROWSING → TOUR_SELECTED
  {
    from: 'BROWSING',
    to: 'TOUR_SELECTED',
    condition: (ctx, input) => input.selectedTour !== null,
    action: (ctx, input) => ({
      ...ctx,
      currentTour: input.selectedTour,
      viewedTours: [...ctx.viewedTours, input.selectedTour!.id],
      reservationInfo: {
        ...ctx.reservationInfo,
        tourId: input.selectedTour!.id,
        tourTitle: input.selectedTour!.title
      }
    })
  },
  
  // TOUR_SELECTED → COLLECTING_INFO
  {
    from: 'TOUR_SELECTED',
    to: 'COLLECTING_INFO',
    condition: (ctx, input) => 
      input.detectedIntent === 'provide_info' ||
      input.detectedIntent === 'reservation_intent' ||
      input.detectedIntent === 'confirm' ||
      Object.keys(input.extractedInfo).length > 0,
    action: (ctx, input) => {
      const merged = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo);
      
      // If there's only one date available and no date selected yet, auto-select it
      if (!merged.dateId && !merged.selectedDate && ctx.currentTour?.dates?.length === 1) {
        const singleDate = ctx.currentTour.dates[0];
        merged.dateId = singleDate.id;
        merged.selectedDate = singleDate.departure_date;
      }
      
      return {
        ...ctx,
        reservationInfo: merged,
        collectionStep: determineCollectionStep(merged)
      };
    }
  },
  
  // TOUR_SELECTED → TOUR_SELECTED (switch tour - only if not collecting info yet)
  {
    from: 'TOUR_SELECTED',
    to: 'TOUR_SELECTED',
    condition: (ctx, input) => 
      input.selectedTour !== null && 
      input.selectedTour.id !== ctx.currentTour?.id &&
      // Only allow if no reservation info collected yet
      Object.keys(ctx.reservationInfo).length <= 2, // only tourId and tourTitle
    action: (ctx, input) => ({
      ...ctx,
      currentTour: input.selectedTour,
      viewedTours: [...ctx.viewedTours, input.selectedTour!.id],
      reservationInfo: {
        tourId: input.selectedTour!.id,
        tourTitle: input.selectedTour!.title
      },
      collectionStep: 'waiting_for_date' as InfoCollectionStep
    })
  },
  
  // COLLECTING_INFO → TOUR_SELECTED (explicit tour switch with confirmation needed)
  {
    from: 'COLLECTING_INFO',
    to: 'TOUR_SELECTED',
    condition: (ctx, input) => 
      input.selectedTour !== null && 
      input.selectedTour.id !== ctx.currentTour?.id &&
      // Require explicit confirmation keywords
      /yeni tur|başka tur|tur değiştir|cancel|iptal|switch tour|change tour|different tour/i.test(input.userMessage),
    action: (ctx, input) => ({
      ...ctx,
      currentTour: input.selectedTour,
      viewedTours: [...ctx.viewedTours, input.selectedTour!.id],
      reservationInfo: {
        tourId: input.selectedTour!.id,
        tourTitle: input.selectedTour!.title
      },
      collectionStep: 'waiting_for_date' as InfoCollectionStep
    })
  },
  
  // COLLECTING_INFO → COLLECTING_INFO (gathering info)
  {
    from: 'COLLECTING_INFO',
    to: 'COLLECTING_INFO',
    condition: (ctx, input) => {
      const merged = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo);
      return !isAllInfoCollected(merged);
    },
    action: (ctx, input) => {
      const merged = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo);
      return {
        ...ctx,
        reservationInfo: merged,
        collectionStep: determineCollectionStep(merged)
      };
    }
  },
  
  // COLLECTING_INFO → CONFIRMING
  {
    from: 'COLLECTING_INFO',
    to: 'CONFIRMING',
    condition: (ctx, input) => {
      const merged = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo);
      return isAllInfoCollected(merged);
    },
    action: (ctx, input) => ({
      ...ctx,
      reservationInfo: mergeReservationInfo(ctx.reservationInfo, input.extractedInfo),
      collectionStep: 'ready_for_confirmation' as InfoCollectionStep
    })
  },
  
  // CONFIRMING → COMPLETED
  {
    from: 'CONFIRMING',
    to: 'COMPLETED',
    condition: (ctx, input) => 
      input.detectedIntent === 'confirm_reservation' ||
      /^(evet|yes|da|oui|si|sim|はい)/i.test(input.userMessage.toLowerCase().trim()),
    action: (ctx) => ({
      ...ctx,
      reservationConfirmed: true
    })
  },
  
  // CONFIRMING → COLLECTING_INFO (user wants to change info)
  {
    from: 'CONFIRMING',
    to: 'COLLECTING_INFO',
    condition: (ctx, input) => 
      input.detectedIntent === 'change_info' ||
      /değiştir|change|modify|edit/i.test(input.userMessage.toLowerCase()),
    action: (ctx) => ({
      ...ctx,
      collectionStep: 'waiting_for_date' as InfoCollectionStep
    })
  }
];

/**
 * Process a state transition based on current context and input
 */
export function processTransition(
  context: ConversationContext,
  input: ProcessingInput
): ConversationContext {
  // Find matching transition
  const transition = transitions.find(t => 
    t.from === context.stage && t.condition(context, input)
  );
  
  if (!transition) {
    // No transition found, stay in current state
    return {
      ...context,
      lastUserMessage: input.userMessage,
      messageCount: context.messageCount + 1,
      lastUpdated: new Date().toISOString()
    };
  }
  
  // Apply transition
  let newContext: ConversationContext = {
    ...context,
    stage: transition.to,
    lastUserMessage: input.userMessage,
    messageCount: context.messageCount + 1,
    lastUpdated: new Date().toISOString()
  };
  
  // Apply action if exists
  if (transition.action) {
    newContext = transition.action(newContext, input);
  }
  
  return newContext;
}

/**
 * Determine the next collection step based on reservation info
 */
function determineCollectionStep(info: ReservationInfo): InfoCollectionStep {
  // Date is collected if either dateId or selectedDate exists
  const hasDate = !!(info.selectedDate || info.dateId);
  
  if (!hasDate) return 'waiting_for_date';
  if (!info.paxAdult) return 'waiting_for_pax';
  if (!info.fullName) return 'waiting_for_name';
  if (!info.phone) return 'waiting_for_phone';
  return 'ready_for_confirmation';
}

/**
 * Check if all required info is collected
 */
function isAllInfoCollected(info: ReservationInfo): boolean {
  // Must have both date ID and date string, plus all other info
  return !!(
    info.tourId &&
    info.dateId &&
    info.selectedDate &&
    info.paxAdult &&
    info.fullName &&
    info.phone
  );
}


/**
 * Merge new reservation info with existing
 */
function mergeReservationInfo(
  existing: ReservationInfo,
  extracted: Partial<ReservationInfo>
): ReservationInfo {
  return {
    ...existing,
    ...Object.fromEntries(
      Object.entries(extracted).filter(([_, v]) => v !== undefined && v !== null)
    )
  };
}

/**
 * Get the next expected input type based on context
 */
export function getNextExpectedInput(context: ConversationContext): string {
  if (context.stage === 'GREETING') return 'greeting_or_tour_selection';
  if (context.stage === 'BROWSING') return 'tour_selection';
  if (context.stage === 'TOUR_SELECTED' && !context.reservationInfo.dateId) return 'date_selection';
  if (context.stage === 'COLLECTING_INFO') {
    if (context.collectionStep === 'waiting_for_date') return 'date';
    if (context.collectionStep === 'waiting_for_pax') return 'pax';
    if (context.collectionStep === 'waiting_for_name') return 'name';
    if (context.collectionStep === 'waiting_for_phone') return 'phone';
  }
  if (context.stage === 'CONFIRMING') return 'confirmation';
  return 'general';
}
