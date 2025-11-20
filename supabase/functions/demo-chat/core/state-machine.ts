// Finite State Machine for demo chat conversation flow
import type { 
  ConversationContext, 
  ConversationStage, 
  StateTransition, 
  ProcessingInput,
  InfoCollectionStep,
  ReservationInfo
} from '../types.ts';

export function createInitialContext(language: string = 'tr', tone: 'standart' | 'kurumsal' | 'dinamik' | 'premium' = 'standart'): ConversationContext {
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

// Define all possible state transitions
const transitions: StateTransition[] = [
  // GREETING → BROWSING (user shows interest in tours)
  {
    from: 'GREETING',
    to: 'BROWSING',
    condition: (ctx, input) => 
      ['tour.search', 'tour.list', 'general.inquiry'].includes(input.detectedIntent)
  },
  
  // GREETING → TOUR_SELECTED (direct tour selection)
  {
    from: 'GREETING',
    to: 'TOUR_SELECTED',
    condition: (ctx, input) => 
      input.selectedTour !== null,
    action: (ctx, input) => ({
      ...ctx,
      currentTour: input.selectedTour,
      viewedTours: [...ctx.viewedTours, input.selectedTour!.id]
    })
  },
  
  // BROWSING → TOUR_SELECTED
  {
    from: 'BROWSING',
    to: 'TOUR_SELECTED',
    condition: (ctx, input) => 
      input.selectedTour !== null,
    action: (ctx, input) => ({
      ...ctx,
      currentTour: input.selectedTour,
      viewedTours: [...ctx.viewedTours, input.selectedTour!.id]
    })
  },
  
  // TOUR_SELECTED → DATE_SELECTION (when user shows reservation intent)
  {
    from: 'TOUR_SELECTED',
    to: 'DATE_SELECTION',
    condition: (ctx, input) => 
      input.detectedIntent === 'reservation.start' && ctx.currentTour !== null
  },
  
  // DATE_SELECTION → COLLECTING_INFO (when date is selected)
  {
    from: 'DATE_SELECTION',
    to: 'COLLECTING_INFO',
    condition: (ctx, input) => 
      (input.extractedInfo.dateId || input.extractedInfo.selectedDate) !== undefined,
    action: (ctx, input) => {
      const mergedInfo = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo);
      return {
        ...ctx,
        collectionStep: determineCollectionStep(mergedInfo),
        reservationInfo: {
          ...mergedInfo,
          tourId: ctx.currentTour?.id,
          tourTitle: ctx.currentTour?.title
        }
      };
    }
  },
  
  // COLLECTING_INFO → COLLECTING_INFO (stay but update step)
  {
    from: 'COLLECTING_INFO',
    to: 'COLLECTING_INFO',
    condition: (ctx, input) => 
      ctx.stage === 'COLLECTING_INFO' && 
      !isAllInfoCollected(mergeReservationInfo(ctx.reservationInfo, input.extractedInfo)),
    action: (ctx, input) => {
      const updatedInfo = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo);
      return {
        ...ctx,
        reservationInfo: updatedInfo,
        collectionStep: determineCollectionStep(updatedInfo)
      };
    }
  },
  
  // COLLECTING_INFO → CONFIRMING
  {
    from: 'COLLECTING_INFO',
    to: 'CONFIRMING',
    condition: (ctx, input) => {
      const updatedInfo = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo);
      return isAllInfoCollected(updatedInfo);
    },
    action: (ctx, input) => ({
      ...ctx,
      reservationInfo: mergeReservationInfo(ctx.reservationInfo, input.extractedInfo),
      collectionStep: 'ready_for_confirmation'
    })
  },
  
  // CONFIRMING → COMPLETED
  {
    from: 'CONFIRMING',
    to: 'COMPLETED',
    condition: (ctx, input) => 
      input.detectedIntent === 'confirmation',
    action: (ctx, input) => ({
      ...ctx,
      reservationConfirmed: true
    })
  }
];

export function processTransition(
  context: ConversationContext,
  input: ProcessingInput
): ConversationContext {
  // Find applicable transition
  const transition = transitions.find(t => 
    t.from === context.stage && t.condition(context, input)
  );
  
  if (!transition) {
    console.log(`⚠️ No transition found from ${context.stage} with intent ${input.detectedIntent}`);
    // Update context without stage change
    return {
      ...context,
      lastUserMessage: input.userMessage,
      lastUpdated: new Date().toISOString(),
      messageCount: context.messageCount + 1
    };
  }
  
  console.log(`✅ Transition: ${transition.from} → ${transition.to}`);
  
  // Apply action if exists
  let newContext = transition.action 
    ? transition.action(context, input)
    : { ...context };
  
  // Update stage and metadata
  newContext = {
    ...newContext,
    stage: transition.to,
    lastUserMessage: input.userMessage,
    lastUpdated: new Date().toISOString(),
    messageCount: context.messageCount + 1
  };
  
  return newContext;
}

// Helper functions
export function determineCollectionStep(info: ReservationInfo): InfoCollectionStep {
  if (!info.paxAdult) {
    return 'waiting_for_pax';
  }
  if (!info.fullName) {
    return 'waiting_for_name';
  }
  if (!info.phone) {
    return 'waiting_for_phone';
  }
  return 'ready_for_confirmation';
}

export function isAllInfoCollected(info: ReservationInfo): boolean {
  return !!(
    info.tourId &&
    (info.dateId || info.selectedDate) &&
    info.paxAdult &&
    info.paxAdult > 0 &&
    info.fullName &&
    info.fullName.trim().length >= 3 &&
    info.phone &&
    info.phone.length >= 10
  );
}

export function mergeReservationInfo(
  existing: ReservationInfo,
  extracted: Partial<ReservationInfo>
): ReservationInfo {
  const merged = { ...existing };
  
  // Only update fields that have new values
  if (extracted.tourId) merged.tourId = extracted.tourId;
  if (extracted.tourTitle) merged.tourTitle = extracted.tourTitle;
  if (extracted.dateId) merged.dateId = extracted.dateId;
  if (extracted.selectedDate) merged.selectedDate = extracted.selectedDate;
  if (extracted.paxAdult) merged.paxAdult = extracted.paxAdult;
  if (extracted.paxChild !== undefined) merged.paxChild = extracted.paxChild;
  if (extracted.fullName) merged.fullName = extracted.fullName.trim();
  if (extracted.phone) merged.phone = extracted.phone.replace(/[\s\-]/g, '');
  
  return merged;
}

export function getNextExpectedInput(context: ConversationContext): string {
  switch (context.stage) {
    case 'GREETING':
      return 'tour_interest';
    case 'BROWSING':
      return 'tour_selection';
    case 'TOUR_SELECTED':
      return 'reservation_intent';
    case 'DATE_SELECTION':
      return 'date';
    case 'COLLECTING_INFO':
      switch (context.collectionStep) {
        case 'waiting_for_pax': return 'pax_count';
        case 'waiting_for_name': return 'full_name';
        case 'waiting_for_phone': return 'phone_number';
        default: return 'confirmation';
      }
    case 'CONFIRMING':
      return 'final_confirmation';
    case 'COMPLETED':
      return 'post_booking';
    default:
      return 'unknown';
  }
}
