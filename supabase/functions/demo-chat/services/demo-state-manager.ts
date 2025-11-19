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

export function detectTourSwitch(
  userMessage: string, 
  newIntent: string, 
  currentState: DemoConversationState,
  newTour?: any
): 'explicit_cancel' | 'new_tour_inquiry' | 'confirmation_needed' | 'no_switch' {
  const lowerMessage = userMessage.toLowerCase();
  
  // Check for explicit cancellation
  const hasCancellation = CANCELLATION_KEYWORDS.some(keyword => 
    lowerMessage.includes(keyword)
  );
  
  if (hasCancellation) {
    return 'explicit_cancel';
  }
  
  // Check if user is asking about a new tour while having an active one
  if (currentState.currentTour && newTour && newTour.id !== currentState.currentTour.id) {
    // If user explicitly says "instead" or similar, it's a clear switch
    const hasExplicitSwitch = TOUR_SWITCH_INDICATORS.some(indicator => 
      lowerMessage.includes(indicator)
    );
    
    if (hasExplicitSwitch) {
      return 'new_tour_inquiry';
    }
    
    // If moving from interested/booking to new search, ask for confirmation
    if ((currentState.currentStage === 'interested' || currentState.currentStage === 'booking') &&
        newIntent === 'tour.search') {
      return 'confirmation_needed';
    }
    
    // If just exploring and asks about new tour, switch without asking
    if (currentState.currentStage === 'exploring') {
      return 'new_tour_inquiry';
    }
    
    return 'confirmation_needed';
  }
  
  return 'no_switch';
}

export function updateStateWithIntent(
  currentState: DemoConversationState,
  newIntent: string,
  userMessage: string,
  selectedTour?: any
): { state: DemoConversationState; switchType: string } {
  const updatedState = { ...currentState };
  
  // Detect tour switch scenario
  const switchType = detectTourSwitch(userMessage, newIntent, currentState, selectedTour);
  
  // Handle different switch scenarios
  switch (switchType) {
    case 'explicit_cancel':
      console.log('❌ User explicitly cancelled current tour');
      if (currentState.currentTour) {
        updatedState.previousTour = {
          id: currentState.currentTour.id,
          title: currentState.currentTour.title
        };
      }
      updatedState.currentTour = null;
      updatedState.currentStage = 'exploring';
      break;
      
    case 'new_tour_inquiry':
      console.log('🔄 User switched to new tour without confirmation needed');
      if (currentState.currentTour) {
        updatedState.previousTour = {
          id: currentState.currentTour.id,
          title: currentState.currentTour.title
        };
      }
      if (selectedTour) {
        updatedState.currentTour = {
          id: selectedTour.id,
          title: selectedTour.title,
          destination: selectedTour.destination,
          dateId: selectedTour.dateId
        };
      }
      updatedState.currentStage = 'exploring';
      break;
      
    case 'confirmation_needed':
      console.log('⚠️ Tour switch needs user confirmation');
      // Don't change current tour yet, but save the potential new tour in previousTour temporarily
      // AI will ask user if they want to switch
      if (selectedTour) {
        updatedState.previousTour = currentState.currentTour;
        // Temporarily store new tour inquiry without switching
      }
      break;
      
    case 'no_switch':
      // Normal flow - update current tour if provided and no conflict
      if (selectedTour && !currentState.currentTour) {
        updatedState.currentTour = {
          id: selectedTour.id,
          title: selectedTour.title,
          destination: selectedTour.destination,
          dateId: selectedTour.dateId
        };
      }
      break;
  }
  
  // Add to discussed tours if a tour was mentioned
  if (selectedTour && !updatedState.discussedTours.includes(selectedTour.id)) {
    updatedState.discussedTours.push(selectedTour.id);
  }
  
  // Update stage based on intent (only if not waiting for confirmation)
  if (switchType !== 'confirmation_needed') {
    switch (newIntent) {
      case 'greeting':
        updatedState.currentStage = 'initial';
        break;
      case 'tour.search':
      case 'tour.list':
        if (switchType !== 'no_switch' || !updatedState.currentTour) {
          updatedState.currentStage = 'exploring';
        }
        break;
      case 'tour.detail':
      case 'price.inquiry':
        updatedState.currentStage = 'interested';
        break;
      case 'reservation.wizard':
        updatedState.currentStage = 'booking';
        break;
    }
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
    lastIntent: newIntent,
    switchType
  });
  
  return { state: updatedState, switchType };
}

export function getContextForAI(state: DemoConversationState, switchType: string, newTourName?: string): string {
  let context = '';
  
  // Handle tour switch confirmation scenarios
  if (switchType === 'confirmation_needed' && state.currentTour && state.previousTour) {
    context += `\n\n🔔 ÖNEMLİ - KULLANICI TUR DEĞİŞTİRMEK İSTEYEBİLİR:`;
    context += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    context += `\n• Önceki ilgilendiği tur: "${state.previousTour.title}"`;
    context += `\n• Şimdi sorduğu tur: "${newTourName || 'yeni bir tur'}"`;
    context += `\n\n📋 YAPMAN GEREKEN:`;
    context += `\n1. Kullanıcıya nazikçe sor: "${state.previousTour.title} turu ile devam mı etmek istersiniz, yoksa ${newTourName || 'yeni tur'} hakkında bilgi mi almak istersiniz?"`;
    context += `\n2. Her iki seçeneği de olumlu bir şekilde sun`;
    context += `\n3. Kullanıcının tercihine göre ilerle`;
    context += `\n\n⚠️ Kullanıcı açıkça yeni tura geçmek isterse veya eski turdan vazgeçtiğini söylerse, yeni turla devam et.`;
    return context;
  }
  
  if (state.currentTour) {
    context += `\n🎯 ŞU AN AKTİF TUR: ${state.currentTour.title} (${state.currentTour.destination})`;
    context += `\n- Kullanıcı bu turla ilgileniyor`;
    context += `\n- Eğer rezervasyon başlatılıyorsa, BU TURU kullan`;
  }
  
  if (state.previousTour && !state.currentTour && switchType === 'explicit_cancel') {
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
