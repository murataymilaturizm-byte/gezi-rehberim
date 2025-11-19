// Tour switching detection for WhatsApp conversations

const CANCELLATION_KEYWORDS = [
  'vazgeçtim', 'vazgeç', 'iptal', 'istemiyorum', 'farklı', 'başka', 
  'değil', 'olmaz', 'hayır', 'yok', 'cancel', 'no', 'different', 'another',
  'change', 'değiştir'
];

const TOUR_SWITCH_INDICATORS = [
  'yerine', 'onun yerine', 'bunun yerine', 'instead', 'rather', 
  'peki', 'ne dersiniz', 'what about', 'how about'
];

export function detectTourSwitch(
  userMessage: string,
  newIntent: string,
  currentTour: any,
  newTour: any,
  currentStage: string,
  lastIntent: string
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
  if (currentTour && newTour && newTour.id !== currentTour.id) {
    // If user explicitly says "instead" or similar, it's a clear switch
    const hasExplicitSwitch = TOUR_SWITCH_INDICATORS.some(indicator => 
      lowerMessage.includes(indicator)
    );
    
    if (hasExplicitSwitch) {
      return 'new_tour_inquiry';
    }
    
    // If moving from interested/booking to new search, ask for confirmation
    if ((currentStage === 'interested' || currentStage === 'booking') &&
        newIntent === 'tour.search') {
      return 'confirmation_needed';
    }
    
    // If just exploring and asks about new tour, switch without asking
    if (currentStage === 'exploring') {
      return 'new_tour_inquiry';
    }
    
    return 'confirmation_needed';
  }
  
  return 'no_switch';
}

export function buildTourSwitchContext(
  switchType: string,
  currentTour: any,
  previousTour: any,
  newTourName: string | null,
  language: string
): string {
  if (switchType !== 'confirmation_needed' || !currentTour) {
    return '';
  }
  
  const messages: Record<string, any> = {
    tr: {
      header: '🔔 ÖNEMLİ - KULLANICI TUR DEĞİŞTİRMEK İSTEYEBİLİR:',
      divider: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      previousTour: `• Daha önce ilgilendiği tur: "${previousTour?.title || currentTour.title}"`,
      newTour: `• Şimdi sorduğu tur: "${newTourName || 'yeni bir tur'}"`,
      instructions: '📋 YAPMAN GEREKEN:',
      step1: `1. Kullanıcıya nazikçe sor: "Daha önce ${previousTour?.title || currentTour.title} turu ile ilgileniyordunuz. Bu turla mı devam etmek istersiniz, yoksa ${newTourName || 'yeni tur'} hakkında bilgi mi almak istersiniz?"`,
      step2: '2. Her iki seçeneği de olumlu bir şekilde sun',
      step3: '3. Kullanıcının tercihine göre ilerle',
      warning: '⚠️ Kullanıcı açıkça yeni tura geçmek isterse veya eski turdan vazgeçtiğini söylerse, yeni turla devam et.'
    },
    en: {
      header: '🔔 IMPORTANT - USER MAY WANT TO SWITCH TOURS:',
      divider: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      previousTour: `• Previously interested in: "${previousTour?.title || currentTour.title}"`,
      newTour: `• Now asking about: "${newTourName || 'new tour'}"`,
      instructions: '📋 WHAT YOU NEED TO DO:',
      step1: `1. Politely ask: "You were previously interested in ${previousTour?.title || currentTour.title}. Would you like to continue with that tour, or get information about ${newTourName || 'the new tour'}?"`,
      step2: '2. Present both options positively',
      step3: '3. Proceed according to user preference',
      warning: '⚠️ If user explicitly wants to switch or says they gave up on the old tour, proceed with new tour.'
    }
  };
  
  const msg = messages[language] || messages.tr;
  
  return `\n\n${msg.header}\n${msg.divider}\n${msg.previousTour}\n${msg.newTour}\n\n${msg.instructions}\n${msg.step1}\n${msg.step2}\n${msg.step3}\n\n${msg.warning}`;
}
