// Conversation state machine for tracking conversation flow

const CANCELLATION_KEYWORDS = [
  'vazgeçtim', 'vazgeç', 'iptal', 'istemiyorum', 'farklı', 'başka', 
  'değil', 'olmaz', 'hayır', 'yok', 'cancel', 'no', 'different', 'another',
  'change', 'değiştir'
];

const TOUR_SWITCH_INDICATORS = [
  'yerine', 'onun yerine', 'bunun yerine', 'instead', 'rather', 
  'peki', 'ne dersiniz', 'what about', 'how about'
];

interface ConversationState {
  currentStage: 'initial' | 'exploring' | 'interested' | 'deciding' | 'booking' | 'completed';
  lastIntent: string;
  lastDiscussedTour: string | null;
  discussedTours: string[];
  userInterests: string[];
  conversationFlow: string[];
  needsFollowUp: boolean;
  lastQuestionAsked: string | null;
  currentTour: {
    id: string;
    title: string;
    destination: string;
    dateId?: string;
    departureDate?: string;
    returnDate?: string;
    priceAdult?: number;
    currency?: string;
  } | null;
  previousTour: {
    id: string;
    title: string;
  } | null;
  wizardStep: 'none' | 'tour_selected' | 'action_choice' | 'detail_shown' | 'price_shown' | 'booking_started';
  shownTourIds: string[];
  lastUserMessage?: string;
  userMemory?: {
    preferredDestinations: string[];
    budgetRange?: 'düşük' | 'orta' | 'yüksek';
    travelStyle?: string;
    interests: string[];
    lastMentionedPax?: {
      adults: number;
      children?: number;
    };
    lastUpdated: string;
  };
}

export async function getConversationState(
  supabase: any,
  phone: string,
  agencyId: string
): Promise<ConversationState> {
  const { data: profile } = await supabase
    .from('whatsapp_user_profiles')
    .select('preferences')
    .eq('phone', phone)
    .eq('agency_id', agencyId)
    .single();

  const conversationState = (profile?.preferences as any)?.conversation_state || {
    currentStage: 'initial',
    lastIntent: '',
    lastDiscussedTour: null,
    discussedTours: [],
    userInterests: [],
    conversationFlow: [],
    needsFollowUp: false,
    lastQuestionAsked: null,
    currentTour: null,
    previousTour: null,
    wizardStep: 'none',
    shownTourIds: [],
    lastUserMessage: '',
    userMemory: {
      preferredDestinations: [],
      interests: [],
      lastUpdated: new Date().toISOString()
    }
  };

  return conversationState;
}

export async function updateConversationState(
  supabase: any,
  phone: string,
  agencyId: string,
  updates: Partial<ConversationState>
): Promise<{ state: ConversationState; switchType: string }> {
  const currentState = await getConversationState(supabase, phone, agencyId);
  const newState = { ...currentState, ...updates };
  
  // Import tour switch detector
  const { detectTourSwitch } = await import('./tour-switch-detector.ts');
  
  // Detect tour switch if we have the necessary info
  let switchType = 'no_switch';
  if (updates.lastUserMessage && updates.currentTour) {
    switchType = detectTourSwitch(
      updates.lastUserMessage,
      updates.lastIntent || '',
      currentState.currentTour,
      updates.currentTour,
      currentState.currentStage,
      currentState.lastIntent
    );
    
    console.log('🔄 Tour switch detected:', switchType);
  }
  
  // Handle different switch scenarios
  switch (switchType) {
    case 'explicit_cancel':
      console.log('❌ User explicitly cancelled current tour');
      if (currentState.currentTour) {
        newState.previousTour = {
          id: currentState.currentTour.id,
          title: currentState.currentTour.title
        };
      }
      newState.currentTour = null;
      newState.currentStage = 'exploring';
      break;
      
    case 'new_tour_inquiry':
      console.log('🔄 User switched to new tour without confirmation needed');
      if (currentState.currentTour) {
        newState.previousTour = {
          id: currentState.currentTour.id,
          title: currentState.currentTour.title
        };
      }
      // currentTour is already set from updates
      newState.currentStage = 'exploring';
      break;
      
    case 'confirmation_needed':
      console.log('⚠️ Tour switch needs user confirmation');
      // Keep current tour, save it to previousTour for AI context
      newState.previousTour = currentState.currentTour;
      // Don't update currentTour yet - wait for user confirmation
      break;
  }

  // Auto-advance stage based on flow (only if not waiting for confirmation)
  if (switchType !== 'confirmation_needed') {
    if (updates.lastIntent === 'tour.search' && newState.currentStage === 'initial') {
      newState.currentStage = 'exploring';
    } else if (updates.lastIntent === 'tour.detail' && newState.currentStage === 'exploring') {
      newState.currentStage = 'interested';
    } else if (updates.lastIntent === 'reservation.wizard') {
      newState.currentStage = 'booking';
    }
  }

  // Update flow history
  if (updates.lastIntent) {
    newState.conversationFlow = [...newState.conversationFlow, updates.lastIntent].slice(-10);
  }

  await supabase
    .from('whatsapp_user_profiles')
    .update({
      preferences: { conversation_state: newState },
      updated_at: new Date().toISOString()
    })
    .eq('phone', phone)
    .eq('agency_id', agencyId);

  console.log('Conversation state updated:', {
    stage: newState.currentStage,
    currentTour: newState.currentTour?.title || 'none',
    previousTour: newState.previousTour?.title || 'none',
    switchType
  });
  
  return { state: newState, switchType };
}

export function analyzeConversationPattern(state: ConversationState): {
  isProgressingToBooking: boolean;
  needsNudge: boolean;
  suggestedNextAction: string;
} {
  const flow = state.conversationFlow;
  
  // Check if progressing toward booking
  const hasSearched = flow.includes('tour.search') || flow.includes('tour.list');
  const hasDetail = flow.includes('tour.detail');
  const isProgressingToBooking = hasSearched && hasDetail && !flow.includes('reservation.wizard');

  // Check if user needs a nudge
  const needsNudge = state.currentStage === 'interested' && 
                     state.discussedTours.length > 0 && 
                     !flow.slice(-3).includes('reservation.wizard');

  // Suggest next action
  let suggestedNextAction = '';
  if (state.currentStage === 'initial') {
    suggestedNextAction = 'show_tour_options';
  } else if (state.currentStage === 'exploring') {
    suggestedNextAction = 'provide_tour_details';
  } else if (state.currentStage === 'interested' || needsNudge) {
    suggestedNextAction = 'suggest_booking';
  }

  return { isProgressingToBooking, needsNudge, suggestedNextAction };
}
