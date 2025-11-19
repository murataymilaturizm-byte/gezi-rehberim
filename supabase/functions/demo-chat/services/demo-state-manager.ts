// Demo chat conversation state management
import { DemoConversationState } from '../types.ts';

const CANCELLATION_KEYWORDS = [
  'vazgeçtim', 'vazgeç', 'iptal', 'istemiyorum', 'farklı', 'başka', 
  'değil', 'olmaz', 'hayır', 'yok', 'cancel', 'no', 'different', 'another'
];

const TOUR_SWITCH_INDICATORS = [
  'yerine', 'onun yerine', 'bunun yerine', 'instead', 'rather', 
  'peki', 'ne dersiniz', 'what about', 'how about'
];

export function initializeState(): DemoConversationState {
  return {
    currentStage: 'initial',
    lastIntent: '',
    currentTour: null,
    previousTour: null,
    discussedTours: [],
    lastUserMessage: '',
    conversationFlow: []
  };
}

export function shouldResetTourContext(
  userMessage: string, 
  newIntent: string, 
  currentState: DemoConversationState
): boolean {
  const lowerMessage = userMessage.toLowerCase();
  
  // Check for cancellation keywords
  const hasCancellation = CANCELLATION_KEYWORDS.some(keyword => 
    lowerMessage.includes(keyword)
  );
  
  // Check for tour switching indicators
  const hasTourSwitch = TOUR_SWITCH_INDICATORS.some(indicator => 
    lowerMessage.includes(indicator)
  );
  
  // Reset if user explicitly cancels or switches tour
  if (hasCancellation || hasTourSwitch) {
    return true;
  }
  
  // Reset if moving from tour.detail/reservation back to tour.search
  if (newIntent === 'tour.search' && 
      (currentState.lastIntent === 'tour.detail' || 
       currentState.lastIntent === 'reservation.wizard')) {
    return true;
  }
  
  // Reset if user asks about a completely different destination while in booking
  if (newIntent === 'tour.search' && currentState.currentStage === 'booking') {
    return true;
  }
  
  return false;
}

export function updateStateWithIntent(
  currentState: DemoConversationState,
  newIntent: string,
  userMessage: string,
  selectedTour?: any
): DemoConversationState {
  const updatedState = { ...currentState };
  
  // Check if we should reset tour context
  if (shouldResetTourContext(userMessage, newIntent, currentState)) {
    console.log('🔄 Resetting tour context - user switched or cancelled');
    if (currentState.currentTour) {
      updatedState.previousTour = {
        id: currentState.currentTour.id,
        title: currentState.currentTour.title
      };
    }
    updatedState.currentTour = null;
    updatedState.currentStage = 'exploring';
  }
  
  // Update current tour if provided
  if (selectedTour) {
    updatedState.currentTour = {
      id: selectedTour.id,
      title: selectedTour.title,
      destination: selectedTour.destination,
      dateId: selectedTour.dateId
    };
    
    // Add to discussed tours if not already there
    if (!updatedState.discussedTours.includes(selectedTour.id)) {
      updatedState.discussedTours.push(selectedTour.id);
    }
  }
  
  // Update stage based on intent
  switch (newIntent) {
    case 'greeting':
      updatedState.currentStage = 'initial';
      break;
    case 'tour.search':
    case 'tour.list':
      updatedState.currentStage = 'exploring';
      break;
    case 'tour.detail':
    case 'price.inquiry':
      updatedState.currentStage = 'interested';
      break;
    case 'reservation.wizard':
      updatedState.currentStage = 'booking';
      break;
  }
  
  // Update conversation flow (keep last 10)
  updatedState.conversationFlow = [
    ...updatedState.conversationFlow,
    newIntent
  ].slice(-10);
  
  updatedState.lastIntent = newIntent;
  updatedState.lastUserMessage = userMessage;
  
  console.log('📊 State updated:', {
    stage: updatedState.currentStage,
    currentTour: updatedState.currentTour?.title || 'none',
    previousTour: updatedState.previousTour?.title || 'none',
    lastIntent: newIntent
  });
  
  return updatedState;
}

export function getContextForAI(state: DemoConversationState): string {
  let context = '';
  
  if (state.currentTour) {
    context += `\n🎯 ŞU AN AKTİF TUR: ${state.currentTour.title} (${state.currentTour.destination})`;
    context += `\n- Kullanıcı bu turla ilgileniyor`;
    context += `\n- Eğer rezervasyon başlatılıyorsa, BU TURU kullan`;
  }
  
  if (state.previousTour && !state.currentTour) {
    context += `\n⚠️ Kullanıcı önceki turdan vazgeçti: ${state.previousTour.title}`;
    context += `\n- Yeni tur önerileri sun`;
  }
  
  if (state.currentStage === 'booking' && !state.currentTour) {
    context += `\n⛔ UYARI: Rezervasyon başlatılamaz - aktif tur yok`;
    context += `\n- Önce kullanıcıya hangi tur için rezervasyon yapmak istediğini sor`;
  }
  
  if (state.discussedTours.length > 1) {
    context += `\n📝 Kullanıcı ${state.discussedTours.length} farklı tur inceledi`;
  }
  
  return context;
}
