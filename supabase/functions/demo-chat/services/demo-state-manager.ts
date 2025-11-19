// Demo chat conversation state management
import { DemoConversationState } from '../types.ts';

const CANCELLATION_KEYWORDS = [
  'vazgeçtim', 'vazgeç', 'iptal', 'istemiyorum', 'farklı', 'başka', 
  'değil', 'olmaz', 'hayır', 'cancel', 'different', 'another'
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
    conversationFlow: [],
    collectedInfo: {},
    reservationConfirmed: false
  };
}

export function detectConfirmationResponse(
  userMessage: string,
  hasPendingConfirmation: boolean
): 'confirm_new_tour' | 'confirm_previous_tour' | 'no_confirmation' {
  if (!hasPendingConfirmation) {
    return 'no_confirmation';
  }
  
  const lowerMessage = userMessage.toLowerCase();
  
  // Keywords for confirming NEW tour
  const newTourKeywords = [
    'yeni tur', 'new tour', 'yeni', 'new', 'başka', 'different', 'another',
    'yeni turla', 'yeni tura', 'diğer', 'other', 'bu yeni', 'this new',
    'evet yeni', 'yes new', 'yeni olan', 'the new one'
  ];
  
  // Keywords for confirming PREVIOUS tour
  const previousTourKeywords = [
    'eski tur', 'previous tour', 'old tour', 'önceki', 'previous', 'eski',
    'ilk', 'first', 'eski turla', 'eski tura', 'önceki tur',
    'devam', 'continue', 'evet eski', 'yes previous', 'önceki ile',
    'o turla', 'that tour', 'ilk tur', 'first tour'
  ];
  
  // Check for new tour confirmation
  const hasNewTourKeyword = newTourKeywords.some(keyword => 
    lowerMessage.includes(keyword)
  );
  
  // Check for previous tour confirmation
  const hasPreviousTourKeyword = previousTourKeywords.some(keyword => 
    lowerMessage.includes(keyword)
  );
  
  // Simple "evet"/"yes" handling - assume they want the new tour
  const isSimpleYes = lowerMessage.trim() === 'evet' || 
                       lowerMessage.trim() === 'yes' ||
                       lowerMessage.trim() === 'evet yeni' ||
                       lowerMessage.trim() === 'yes new';
  
  if (hasNewTourKeyword || isSimpleYes) {
    return 'confirm_new_tour';
  }
  
  if (hasPreviousTourKeyword) {
    return 'confirm_previous_tour';
  }
  
  return 'no_confirmation';
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

export function extractCustomerInfo(message: string, currentInfo: any = {}) {
  const info = { ...currentInfo };
  const lowerMessage = message.toLowerCase();
  
  // Extract pax (number of people) - support various formats
  const paxMatches = [
    /(\d+)\s*(?:yetişkin|yetiskin|adult)/i,
    /(\d+)\s*(?:kişi|kisi|people|person)/i
  ];
  
  for (const pattern of paxMatches) {
    const match = message.match(pattern);
    if (match) {
      info.paxAdult = parseInt(match[1]);
      break;
    }
  }
  
  // Extract child count
  const childMatch = message.match(/(\d+)\s*(?:çocuk|cocuk|child|children)/i);
  if (childMatch) {
    info.paxChild = parseInt(childMatch[1]);
  }
  
  // Extract full name - ONLY from explicit name patterns
  if (!info.fullName) {
    // Pattern 1: "ismim/adım X Y" or "ben X Y"
    const explicitNamePatterns = [
      /(?:ismim|adım|adim|name is|i am|i'm|ben)\s+([A-ZÇĞİÖŞÜa-zçğıöşü]+\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+)/i,
      /^([A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)$/
    ];
    
    for (const pattern of explicitNamePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        // Exclude if contains tour-related words
        if (!name.toLowerCase().match(/tur|tour|kayıt|rezerv|book/)) {
          const words = name.split(/\s+/);
          if (words.length >= 2 && words.length <= 4 && name.length >= 5 && name.length <= 50) {
            // Capitalize properly
            info.fullName = words.map(w => 
              w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
            ).join(' ');
            break;
          }
        }
      }
    }
  }
  
  // Extract phone (Turkish format or international)
  const phonePatterns = [
    /(?:telefon|phone|numara|number)[\s:]+(\d[\s\-\d]{8,14})/i,
    /\b(05\d{9})\b/,  // Turkish mobile: 05xxxxxxxxx
    /\b(\+90[\s\-]?5\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})\b/,  // International Turkish
    /\b(\d{10,11})\b/  // Fallback: 10-11 digits
  ];
  
  for (const pattern of phonePatterns) {
    const match = message.match(pattern);
    if (match) {
      let phone = match[1].replace(/[\s\-]/g, '');
      // Only accept if it looks like a phone (starts with 0 or +, or is 10+ digits)
      if (phone.length >= 10 && (phone.startsWith('0') || phone.startsWith('+') || phone.length === 10 || phone.length === 11)) {
        info.phone = phone;
        break;
      }
    }
  }
  
  return info;
}

export function updateStateWithIntent(
  currentState: DemoConversationState,
  newIntent: string,
  userMessage: string,
  selectedTour?: any
): { state: DemoConversationState; switchType: string } {
  // Preserve ALL existing state including collectedInfo and reservationConfirmed
  const updatedState = { 
    ...currentState,
    collectedInfo: currentState.collectedInfo || {},
    reservationConfirmed: currentState.reservationConfirmed || false
  };
  
  // First check if user is responding to a pending confirmation
  const hasPendingConfirmation = !!(currentState.previousTour && currentState.currentTour);
  let confirmationResponse = 'no_confirmation';
  
  if (hasPendingConfirmation) {
    confirmationResponse = detectConfirmationResponse(userMessage, hasPendingConfirmation);
    console.log('✅ Confirmation response detected in demo:', confirmationResponse);
  }
  
  // Handle confirmation responses first
  if (confirmationResponse === 'confirm_new_tour') {
    console.log('✅ User confirmed NEW tour in demo chat');
    // User wants the new tour - clear previousTour, keep currentTour
    updatedState.previousTour = null;
    updatedState.currentStage = 'exploring';
    updatedState.lastIntent = newIntent;
    updatedState.lastUserMessage = userMessage;
    updatedState.conversationFlow = [...updatedState.conversationFlow, newIntent].slice(-10);
    
    console.log('📊 State after confirmation:', {
      stage: updatedState.currentStage,
      currentTour: updatedState.currentTour?.title || 'none',
      previousTour: 'cleared'
    });
    
    return { state: updatedState, switchType: 'confirmed_new_tour' };
  } else if (confirmationResponse === 'confirm_previous_tour') {
    console.log('✅ User confirmed PREVIOUS tour in demo chat');
    // User wants to continue with previous tour - swap them
    updatedState.currentTour = currentState.previousTour;
    updatedState.previousTour = null;
    updatedState.currentStage = 'exploring';
    updatedState.lastIntent = newIntent;
    updatedState.lastUserMessage = userMessage;
    updatedState.conversationFlow = [...updatedState.conversationFlow, newIntent].slice(-10);
    
    console.log('📊 State after confirmation:', {
      stage: updatedState.currentStage,
      currentTour: updatedState.currentTour?.title || 'none',
      previousTour: 'cleared'
    });
    
    return { state: updatedState, switchType: 'confirmed_previous_tour' };
  }
  
  // No confirmation response, proceed with normal tour switch detection
  const switchType = detectTourSwitch(userMessage, newIntent, currentState, selectedTour);
  
  // Handle different switch scenarios
  switch (switchType) {
    case 'explicit_cancel':
      console.log('❌ User explicitly cancelled current tour');
      if (currentState.currentTour) {
        updatedState.previousTour = currentState.currentTour;
      }
      updatedState.currentTour = null;
      updatedState.currentStage = 'exploring';
      break;
      
    case 'new_tour_inquiry':
      console.log('🔄 User switched to new tour without confirmation needed');
      if (currentState.currentTour) {
        updatedState.previousTour = currentState.currentTour;
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
  
  // Add collected reservation info
  if (state.collectedInfo && Object.keys(state.collectedInfo).length > 0) {
    context += `\n\n📋 TOPLANAN BİLGİLER:`;
    if (state.collectedInfo.tourTitle) {
      context += `\n✅ Tur: ${state.collectedInfo.tourTitle}`;
    }
    if (state.collectedInfo.selectedDate) {
      context += `\n✅ Tarih: ${state.collectedInfo.selectedDate}`;
    }
    if (state.collectedInfo.paxAdult) {
      context += `\n✅ Kişi sayısı: ${state.collectedInfo.paxAdult} yetişkin${state.collectedInfo.paxChild ? ` + ${state.collectedInfo.paxChild} çocuk` : ''}`;
    }
    if (state.collectedInfo.fullName) {
      context += `\n✅ İsim: ${state.collectedInfo.fullName}`;
    }
    if (state.collectedInfo.phone) {
      context += `\n✅ Telefon: ${state.collectedInfo.phone}`;
    }
    
    // Check what's missing
    const missing = [];
    if (!state.collectedInfo.fullName) missing.push('tam ad-soyad');
    if (!state.collectedInfo.phone) missing.push('telefon');
    
    if (missing.length > 0) {
      context += `\n\n⚠️ EKSIK BİLGİ: ${missing.join(', ')}`;
      context += `\n- Bu bilgileri toplamadan devam etme!`;
    } else if (!state.reservationConfirmed) {
      context += `\n\n✅ Tüm bilgiler toplandı!`;
      context += `\n- Özet göster ve onay iste`;
      context += `\n- Onay aldıktan SONRA "Rezervasyonunuz başarıyla onaylanmıştır" mesajı ver`;
    }
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
