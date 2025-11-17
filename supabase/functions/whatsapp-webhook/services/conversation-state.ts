// Conversation state machine for tracking conversation flow

interface ConversationState {
  currentStage: 'initial' | 'exploring' | 'interested' | 'deciding' | 'booking' | 'completed';
  lastIntent: string;
  lastDiscussedTour: string | null;
  discussedTours: string[];
  userInterests: string[];
  conversationFlow: string[];
  needsFollowUp: boolean;
  lastQuestionAsked: string | null;
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
    lastQuestionAsked: null
  };

  return conversationState;
}

export async function updateConversationState(
  supabase: any,
  phone: string,
  agencyId: string,
  updates: Partial<ConversationState>
): Promise<void> {
  const currentState = await getConversationState(supabase, phone, agencyId);
  const newState = { ...currentState, ...updates };

  // Auto-advance stage based on flow
  if (updates.lastIntent === 'tour.search' && newState.currentStage === 'initial') {
    newState.currentStage = 'exploring';
  } else if (updates.lastIntent === 'tour.detail' && newState.currentStage === 'exploring') {
    newState.currentStage = 'interested';
  } else if (updates.lastIntent === 'reservation.wizard') {
    newState.currentStage = 'booking';
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

  console.log('Conversation state updated:', newState);
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
