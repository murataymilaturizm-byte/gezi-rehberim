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
  
  // Extract phone FIRST - be MORE aggressive but smart
  let extractedPhone: string | null = null;
  if (!info.phone) {
    const phonePatterns = [
      /(?:telefon|phone|numara|number|tel)[\s:]+(\d[\s\-\d]{8,14})/i,
      /\b(05\d{9})\b/,  // Turkish mobile: 05xxxxxxxxx
      /\b(0\d{10})\b/,  // 0 + 10 digits
      /\b(\+90[\s\-]?5\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})\b/,  // International
      /\b(\d{10,11})\b/  // 10-11 digits
    ];
    
    for (const pattern of phonePatterns) {
      const match = message.match(pattern);
      if (match) {
        let phone = match[1].replace(/[\s\-]/g, '');
        // Accept if 10-11 digits
        if (phone.length >= 10 && phone.length <= 11 && /^\d+$/.test(phone)) {
          info.phone = phone;
          extractedPhone = phone;
          break;
        }
      }
    }
  }
  
  // Extract full name - SMART extraction including names next to phone numbers
  if (!info.fullName) {
    // Blacklist words that should NEVER be considered as names
    const nameBlacklist = /evet|onay|tamam|olur|hayır|yes|no|okay|sure|confirm|tur|tour|kayıt|rezerv|book|kişi|kisi|people|lütfen|please/i;
    
    // If we found a phone, look for name BEFORE the phone
    if (extractedPhone) {
      // Remove the phone from message and look for name in remaining text
      const beforePhone = message.split(extractedPhone)[0].trim();
      const nameMatch = beforePhone.match(/([A-ZÇĞİÖŞÜa-zçğıöşü]+\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+)$/i);
      if (nameMatch && nameMatch[1]) {
        const name = nameMatch[1].trim();
        // Check against blacklist
        if (!nameBlacklist.test(name)) {
          const words = name.split(/\s+/);
          if (words.length >= 2 && words.length <= 4 && name.length >= 5 && name.length <= 50) {
            info.fullName = words.map(w => 
              w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
            ).join(' ');
          }
        }
      }
    }
    
    // If still no name, try explicit patterns
    if (!info.fullName) {
      const explicitNamePatterns = [
        /(?:ismim|adım|adim|name is|i am|i'm|ben)\s+([A-ZÇĞİÖŞÜa-zçğıöşü]+\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+)/i,
        /^([A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)\s*\d/i,  // Name followed by number
        /^([A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)$/i  // Just name
      ];
      
      for (const pattern of explicitNamePatterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
          const name = match[1].trim();
          // Check against blacklist
          if (!nameBlacklist.test(name)) {
            const words = name.split(/\s+/);
            if (words.length >= 2 && words.length <= 4 && name.length >= 5 && name.length <= 50) {
              info.fullName = words.map(w => 
                w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
              ).join(' ');
              break;
            }
          }
        }
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
      // Normal flow - update current tour if provided
      // For tour.detail or tour.search, always update the current tour
      if (selectedTour) {
        if (newIntent === 'tour.detail' || newIntent === 'tour.search' || !currentState.currentTour) {
          updatedState.currentTour = {
            id: selectedTour.id,
            title: selectedTour.title,
            destination: selectedTour.destination,
            dateId: selectedTour.dateId
          };
        }
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

// Multi-language context labels
const CONTEXT_LABELS: Record<string, any> = {
  tr: {
    userMayWantSwitch: '🔔 ÖNEMLİ - KULLANICI TUR DEĞİŞTİRMEK İSTEYEBİLİR:',
    previousTour: '• Önceki ilgilendiği tur:',
    nowAsking: '• Şimdi sorduğu tur:',
    newTour: 'yeni bir tur',
    whatToDo: '📋 YAPMAN GEREKEN:',
    askPolitely: 'Kullanıcıya nazikçe sor:',
    orNew: 'turu ile devam mı etmek istersiniz, yoksa',
    aboutInfo: 'hakkında bilgi mi almak istersiniz?',
    presentBoth: 'Her iki seçeneği de olumlu bir şekilde sun',
    followChoice: 'Kullanıcının tercihine göre ilerle',
    ifSwitchClear: '⚠️ Kullanıcı açıkça yeni tura geçmek isterse veya eski turdan vazgeçtiğini söylerse, yeni turla devam et.',
    activeTour: '🎯 ŞU AN AKTİF TUR:',
    userInterested: '- Kullanıcı bu turla ilgileniyor',
    useThisTour: '- Eğer rezervasyon başlatılıyorsa, BU TURU kullan',
    collectedInfo: '📋 TOPLANAN BİLGİLER:',
    tour: '✅ Tur:',
    date: '✅ Tarih:',
    numberOfPeople: '✅ Kişi sayısı:',
    adults: 'yetişkin',
    children: 'çocuk',
    name: '✅ İsim:',
    phone: '✅ Telefon:',
    missingInfo: '⚠️ EKSIK BİLGİ:',
    fullName: 'tam ad-soyad',
    phoneNumber: 'telefon',
    dontContinue: '- Bu bilgileri toplamadan devam etme!',
    allInfoCollected: '✅ Tüm bilgiler toplandı!',
    showOrganized: '- Bilgileri ALT ALTA düzenli bir şekilde göster',
    eachLine: '- Her bilgiyi yeni satırda göster',
    askConfirm: '- Onay iste: "Bu bilgiler doğruysa, rezervasyonunuzu onaylayabilirim. Onaylıyor musunuz?"',
    confirmed: '✅ REZERVASYON ONAYLANDI!',
    thankYou: '- Kısa bir teşekkür mesajı ver',
    backendPayment: '- Backend ödeme bilgilerini otomatik ekleyecek, sen ekleme!',
    canceledPrevious: '⚠️ Kullanıcı önceki turdan vazgeçti:',
    suggestNew: '- Yeni tur önerileri sun',
    warningNoTour: '⛔ UYARI: Rezervasyon başlatılamaz - aktif tur yok',
    askWhichTour: '- Önce kullanıcıya hangi tur için rezervasyon yapmak istediğini sor',
    userViewed: '📝 Kullanıcı',
    differentTours: 'farklı tur inceledi'
  },
  en: {
    userMayWantSwitch: '🔔 IMPORTANT - USER MAY WANT TO SWITCH TOURS:',
    previousTour: '• Previously interested in:',
    nowAsking: '• Now asking about:',
    newTour: 'a new tour',
    whatToDo: '📋 WHAT YOU SHOULD DO:',
    askPolitely: 'Ask the user politely:',
    orNew: 'Do you want to continue with the tour, or',
    aboutInfo: 'would you like information about',
    presentBoth: 'Present both options positively',
    followChoice: 'Follow the user\'s choice',
    ifSwitchClear: '⚠️ If user clearly wants to switch to new tour or cancel the old one, continue with the new tour.',
    activeTour: '🎯 CURRENTLY ACTIVE TOUR:',
    userInterested: '- User is interested in this tour',
    useThisTour: '- If starting a reservation, USE THIS TOUR',
    collectedInfo: '📋 COLLECTED INFORMATION:',
    tour: '✅ Tour:',
    date: '✅ Date:',
    numberOfPeople: '✅ Number of people:',
    adults: 'adults',
    children: 'children',
    name: '✅ Name:',
    phone: '✅ Phone:',
    missingInfo: '⚠️ MISSING INFO:',
    fullName: 'full name',
    phoneNumber: 'phone',
    dontContinue: '- Do not continue without collecting this information!',
    allInfoCollected: '✅ All information collected!',
    showOrganized: '- Show information ORGANIZED LINE BY LINE',
    eachLine: '- Show each piece of information on a new line',
    askConfirm: '- Ask for confirmation: "If this information is correct, I can confirm your reservation. Do you confirm?"',
    confirmed: '✅ RESERVATION CONFIRMED!',
    thankYou: '- Give a brief thank you message',
    backendPayment: '- Backend will add payment info automatically, don\'t add it yourself!',
    canceledPrevious: '⚠️ User canceled previous tour:',
    suggestNew: '- Suggest new tours',
    warningNoTour: '⛔ WARNING: Cannot start reservation - no active tour',
    askWhichTour: '- First ask user which tour they want to book',
    userViewed: '📝 User viewed',
    differentTours: 'different tours'
  },
  de: {
    userMayWantSwitch: '🔔 WICHTIG - BENUTZER MÖCHTE MÖGLICHERWEISE TOUREN WECHSELN:',
    previousTour: '• Zuvor interessiert an:',
    nowAsking: '• Fragt jetzt nach:',
    newTour: 'einer neuen Tour',
    whatToDo: '📋 WAS SIE TUN SOLLTEN:',
    askPolitely: 'Fragen Sie den Benutzer höflich:',
    orNew: 'Möchten Sie mit der Tour fortfahren oder',
    aboutInfo: 'möchten Sie Informationen über',
    presentBoth: 'Präsentieren Sie beide Optionen positiv',
    followChoice: 'Folgen Sie der Wahl des Benutzers',
    ifSwitchClear: '⚠️ Wenn der Benutzer eindeutig zur neuen Tour wechseln oder die alte stornieren möchte, fahren Sie mit der neuen Tour fort.',
    activeTour: '🎯 AKTUELL AKTIVE TOUR:',
    userInterested: '- Benutzer ist an dieser Tour interessiert',
    useThisTour: '- Wenn eine Reservierung beginnt, VERWENDEN SIE DIESE TOUR',
    collectedInfo: '📋 GESAMMELTE INFORMATIONEN:',
    tour: '✅ Tour:',
    date: '✅ Datum:',
    numberOfPeople: '✅ Anzahl der Personen:',
    adults: 'Erwachsene',
    children: 'Kinder',
    name: '✅ Name:',
    phone: '✅ Telefon:',
    missingInfo: '⚠️ FEHLENDE INFO:',
    fullName: 'vollständiger Name',
    phoneNumber: 'Telefon',
    dontContinue: '- Fahren Sie nicht fort, ohne diese Informationen zu sammeln!',
    allInfoCollected: '✅ Alle Informationen gesammelt!',
    showOrganized: '- Zeigen Sie Informationen ORGANISIERT ZEILE FÜR ZEILE',
    eachLine: '- Zeigen Sie jede Information in einer neuen Zeile',
    askConfirm: '- Fragen Sie nach Bestätigung: "Wenn diese Informationen korrekt sind, kann ich Ihre Reservierung bestätigen. Bestätigen Sie?"',
    confirmed: '✅ RESERVIERUNG BESTÄTIGT!',
    thankYou: '- Geben Sie eine kurze Dankesnachricht',
    backendPayment: '- Backend fügt Zahlungsinformationen automatisch hinzu, fügen Sie sie nicht selbst hinzu!',
    canceledPrevious: '⚠️ Benutzer hat vorherige Tour storniert:',
    suggestNew: '- Schlagen Sie neue Touren vor',
    warningNoTour: '⛔ WARNUNG: Kann keine Reservierung starten - keine aktive Tour',
    askWhichTour: '- Fragen Sie zuerst den Benutzer, welche Tour er buchen möchte',
    userViewed: '📝 Benutzer hat',
    differentTours: 'verschiedene Touren angesehen'
  },
  ru: {
    userMayWantSwitch: '🔔 ВАЖНО - ПОЛЬЗОВАТЕЛЬ МОЖЕТ ЗАХОТЕТЬ СМЕНИТЬ ТУР:',
    previousTour: '• Ранее интересовался:',
    nowAsking: '• Сейчас спрашивает о:',
    newTour: 'новом туре',
    whatToDo: '📋 ЧТО ВАМ СЛЕДУЕТ СДЕЛАТЬ:',
    askPolitely: 'Вежливо спросите пользователя:',
    orNew: 'Вы хотите продолжить с туром, или',
    aboutInfo: 'вы хотите получить информацию о',
    presentBoth: 'Представьте оба варианта положительно',
    followChoice: 'Следуйте выбору пользователя',
    ifSwitchClear: '⚠️ Если пользователь явно хочет переключиться на новый тур или отменить старый, продолжайте с новым туром.',
    activeTour: '🎯 ТЕКУЩИЙ АКТИВНЫЙ ТУР:',
    userInterested: '- Пользователь заинтересован в этом туре',
    useThisTour: '- Если начинается бронирование, ИСПОЛЬЗУЙТЕ ЭТОТ ТУР',
    collectedInfo: '📋 СОБРАННАЯ ИНФОРМАЦИЯ:',
    tour: '✅ Тур:',
    date: '✅ Дата:',
    numberOfPeople: '✅ Количество людей:',
    adults: 'взрослых',
    children: 'детей',
    name: '✅ Имя:',
    phone: '✅ Телефон:',
    missingInfo: '⚠️ ОТСУТСТВУЮЩАЯ ИНФОРМАЦИЯ:',
    fullName: 'полное имя',
    phoneNumber: 'телефон',
    dontContinue: '- Не продолжайте без сбора этой информации!',
    allInfoCollected: '✅ Вся информация собрана!',
    showOrganized: '- Показывайте информацию ОРГАНИЗОВАННО СТРОКА ЗА СТРОКОЙ',
    eachLine: '- Показывайте каждую информацию на новой строке',
    askConfirm: '- Попросите подтверждение: "Если эта информация верна, я могу подтвердить ваше бронирование. Вы подтверждаете?"',
    confirmed: '✅ БРОНИРОВАНИЕ ПОДТВЕРЖДЕНО!',
    thankYou: '- Дайте краткое благодарственное сообщение',
    backendPayment: '- Backend добавит информацию об оплате автоматически, не добавляйте её сами!',
    canceledPrevious: '⚠️ Пользователь отменил предыдущий тур:',
    suggestNew: '- Предложите новые туры',
    warningNoTour: '⛔ ПРЕДУПРЕЖДЕНИЕ: Невозможно начать бронирование - нет активного тура',
    askWhichTour: '- Сначала спросите пользователя, какой тур он хочет забронировать',
    userViewed: '📝 Пользователь просмотрел',
    differentTours: 'различных туров'
  },
  ar: {
    userMayWantSwitch: '🔔 مهم - قد يرغب المستخدم في تغيير الجولة:',
    previousTour: '• كان مهتمًا سابقًا بـ:',
    nowAsking: '• يسأل الآن عن:',
    newTour: 'جولة جديدة',
    whatToDo: '📋 ما يجب عليك فعله:',
    askPolitely: 'اسأل المستخدم بأدب:',
    orNew: 'هل تريد المتابعة مع الجولة، أم',
    aboutInfo: 'هل تريد معلومات عن',
    presentBoth: 'قدم كلا الخيارين بشكل إيجابي',
    followChoice: 'اتبع اختيار المستخدم',
    ifSwitchClear: '⚠️ إذا أراد المستخدم بوضوح التبديل إلى جولة جديدة أو إلغاء القديمة، تابع مع الجولة الجديدة.',
    activeTour: '🎯 الجولة النشطة حاليًا:',
    userInterested: '- المستخدم مهتم بهذه الجولة',
    useThisTour: '- إذا بدأ الحجز، استخدم هذه الجولة',
    collectedInfo: '📋 المعلومات المجمعة:',
    tour: '✅ الجولة:',
    date: '✅ التاريخ:',
    numberOfPeople: '✅ عدد الأشخاص:',
    adults: 'بالغين',
    children: 'أطفال',
    name: '✅ الاسم:',
    phone: '✅ الهاتف:',
    missingInfo: '⚠️ معلومات مفقودة:',
    fullName: 'الاسم الكامل',
    phoneNumber: 'الهاتف',
    dontContinue: '- لا تتابع دون جمع هذه المعلومات!',
    allInfoCollected: '✅ تم جمع جميع المعلومات!',
    showOrganized: '- اعرض المعلومات منظمة سطر بسطر',
    eachLine: '- اعرض كل معلومة على سطر جديد',
    askConfirm: '- اطلب التأكيد: "إذا كانت هذه المعلومات صحيحة، يمكنني تأكيد حجزك. هل تؤكد؟"',
    confirmed: '✅ تم تأكيد الحجز!',
    thankYou: '- أعط رسالة شكر موجزة',
    backendPayment: '- سيضيف النظام الخلفي معلومات الدفع تلقائيًا، لا تضفها بنفسك!',
    canceledPrevious: '⚠️ ألغى المستخدم الجولة السابقة:',
    suggestNew: '- اقترح جولات جديدة',
    warningNoTour: '⛔ تحذير: لا يمكن بدء الحجز - لا توجد جولة نشطة',
    askWhichTour: '- اسأل المستخدم أولاً عن الجولة التي يريد حجزها',
    userViewed: '📝 شاهد المستخدم',
    differentTours: 'جولات مختلفة'
  },
  fr: {
    userMayWantSwitch: '🔔 IMPORTANT - L\'UTILISATEUR PEUT VOULOIR CHANGER DE CIRCUIT:',
    previousTour: '• Précédemment intéressé par:',
    nowAsking: '• Demande maintenant à propos de:',
    newTour: 'un nouveau circuit',
    whatToDo: '📋 CE QUE VOUS DEVEZ FAIRE:',
    askPolitely: 'Demandez poliment à l\'utilisateur:',
    orNew: 'Voulez-vous continuer avec le circuit, ou',
    aboutInfo: 'voulez-vous des informations sur',
    presentBoth: 'Présentez les deux options positivement',
    followChoice: 'Suivez le choix de l\'utilisateur',
    ifSwitchClear: '⚠️ Si l\'utilisateur veut clairement passer au nouveau circuit ou annuler l\'ancien, continuez avec le nouveau circuit.',
    activeTour: '🎯 CIRCUIT ACTUELLEMENT ACTIF:',
    userInterested: '- L\'utilisateur est intéressé par ce circuit',
    useThisTour: '- Si une réservation commence, UTILISEZ CE CIRCUIT',
    collectedInfo: '📋 INFORMATIONS COLLECTÉES:',
    tour: '✅ Circuit:',
    date: '✅ Date:',
    numberOfPeople: '✅ Nombre de personnes:',
    adults: 'adultes',
    children: 'enfants',
    name: '✅ Nom:',
    phone: '✅ Téléphone:',
    missingInfo: '⚠️ INFORMATIONS MANQUANTES:',
    fullName: 'nom complet',
    phoneNumber: 'téléphone',
    dontContinue: '- Ne continuez pas sans collecter ces informations!',
    allInfoCollected: '✅ Toutes les informations collectées!',
    showOrganized: '- Montrez les informations ORGANISÉES LIGNE PAR LIGNE',
    eachLine: '- Montrez chaque information sur une nouvelle ligne',
    askConfirm: '- Demandez confirmation: "Si ces informations sont correctes, je peux confirmer votre réservation. Confirmez-vous?"',
    confirmed: '✅ RÉSERVATION CONFIRMÉE!',
    thankYou: '- Donnez un bref message de remerciement',
    backendPayment: '- Le backend ajoutera automatiquement les informations de paiement, ne les ajoutez pas vous-même!',
    canceledPrevious: '⚠️ L\'utilisateur a annulé le circuit précédent:',
    suggestNew: '- Suggérez de nouveaux circuits',
    warningNoTour: '⛔ AVERTISSEMENT: Impossible de commencer la réservation - aucun circuit actif',
    askWhichTour: '- Demandez d\'abord à l\'utilisateur quel circuit il souhaite réserver',
    userViewed: '📝 L\'utilisateur a vu',
    differentTours: 'circuits différents'
  },
  es: {
    userMayWantSwitch: '🔔 IMPORTANTE - EL USUARIO PUEDE QUERER CAMBIAR DE TOUR:',
    previousTour: '• Anteriormente interesado en:',
    nowAsking: '• Ahora pregunta sobre:',
    newTour: 'un nuevo tour',
    whatToDo: '📋 LO QUE DEBES HACER:',
    askPolitely: 'Pregunta cortésmente al usuario:',
    orNew: '¿Quieres continuar con el tour, o',
    aboutInfo: 'quieres información sobre',
    presentBoth: 'Presenta ambas opciones positivamente',
    followChoice: 'Sigue la elección del usuario',
    ifSwitchClear: '⚠️ Si el usuario claramente quiere cambiar al nuevo tour o cancelar el antiguo, continúa con el nuevo tour.',
    activeTour: '🎯 TOUR ACTUALMENTE ACTIVO:',
    userInterested: '- El usuario está interesado en este tour',
    useThisTour: '- Si comienza una reserva, USA ESTE TOUR',
    collectedInfo: '📋 INFORMACIÓN RECOPILADA:',
    tour: '✅ Tour:',
    date: '✅ Fecha:',
    numberOfPeople: '✅ Número de personas:',
    adults: 'adultos',
    children: 'niños',
    name: '✅ Nombre:',
    phone: '✅ Teléfono:',
    missingInfo: '⚠️ INFORMACIÓN FALTANTE:',
    fullName: 'nombre completo',
    phoneNumber: 'teléfono',
    dontContinue: '- ¡No continúes sin recopilar esta información!',
    allInfoCollected: '✅ ¡Toda la información recopilada!',
    showOrganized: '- Muestra la información ORGANIZADA LÍNEA POR LÍNEA',
    eachLine: '- Muestra cada información en una nueva línea',
    askConfirm: '- Pide confirmación: "Si esta información es correcta, puedo confirmar tu reserva. ¿Confirmas?"',
    confirmed: '✅ ¡RESERVA CONFIRMADA!',
    thankYou: '- Da un breve mensaje de agradecimiento',
    backendPayment: '- ¡El backend agregará información de pago automáticamente, no la agregues tú mismo!',
    canceledPrevious: '⚠️ El usuario canceló el tour anterior:',
    suggestNew: '- Sugiere nuevos tours',
    warningNoTour: '⛔ ADVERTENCIA: No se puede comenzar la reserva - sin tour activo',
    askWhichTour: '- Primero pregunta al usuario qué tour quiere reservar',
    userViewed: '📝 El usuario vio',
    differentTours: 'tours diferentes'
  }
};

export async function getContextForAI(state: DemoConversationState, switchType: string, newTourName?: string, language: string = 'tr'): Promise<string> {
  const labels = CONTEXT_LABELS[language] || CONTEXT_LABELS.tr;
  let context = '';
  
  // Handle tour switch confirmation scenarios
  if (switchType === 'confirmation_needed' && state.currentTour && state.previousTour) {
    context += `\n\n${labels.userMayWantSwitch}`;
    context += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    context += `\n${labels.previousTour} "${state.previousTour.title}"`;
    context += `\n${labels.nowAsking} "${newTourName || labels.newTour}"`;
    context += `\n\n${labels.whatToDo}`;
    context += `\n1. ${labels.askPolitely} "${state.previousTour.title} ${labels.orNew} ${newTourName || labels.newTour} ${labels.aboutInfo}?"`;
    context += `\n2. ${labels.presentBoth}`;
    context += `\n3. ${labels.followChoice}`;
    context += `\n\n${labels.ifSwitchClear}`;
    return context;
  }
  
  if (state.currentTour) {
    context += `\n${labels.activeTour} ${state.currentTour.title} (${state.currentTour.destination})`;
    context += `\n${labels.userInterested}`;
    context += `\n${labels.useThisTour}`;
  }
  
  // Add collected reservation info
  if (state.collectedInfo && Object.keys(state.collectedInfo).length > 0) {
    context += `\n\n${labels.collectedInfo}`;
    if (state.collectedInfo.tourTitle) {
      context += `\n${labels.tour} ${state.collectedInfo.tourTitle}`;
    }
    if (state.collectedInfo.selectedDate) {
      context += `\n${labels.date} ${state.collectedInfo.selectedDate}`;
    }
    if (state.collectedInfo.paxAdult) {
      context += `\n${labels.numberOfPeople} ${state.collectedInfo.paxAdult} ${labels.adults}${state.collectedInfo.paxChild ? ` + ${state.collectedInfo.paxChild} ${labels.children}` : ''}`;
    }
    if (state.collectedInfo.fullName) {
      context += `\n${labels.name} ${state.collectedInfo.fullName}`;
    }
    if (state.collectedInfo.phone) {
      context += `\n${labels.phone} ${state.collectedInfo.phone}`;
    }
    
    // Check what's missing
    const missing = [];
    if (!state.collectedInfo.fullName) missing.push(labels.fullName);
    if (!state.collectedInfo.phone) missing.push(labels.phoneNumber);
    
    if (missing.length > 0) {
      context += `\n\n${labels.missingInfo} ${missing.join(', ')}`;
      context += `\n${labels.dontContinue}`;
    } else if (!state.reservationConfirmed) {
      context += `\n\n${labels.allInfoCollected}`;
      context += `\n${labels.showOrganized}`;
      context += `\n${labels.eachLine}`;
      context += `\n${labels.askConfirm}`;
    } else if (state.reservationConfirmed) {
      context += `\n\n${labels.confirmed}`;
      context += `\n${labels.thankYou}`;
      context += `\n${labels.backendPayment}`;
    }
  }
  
  if (state.previousTour && !state.currentTour && switchType === 'explicit_cancel') {
    context += `\n${labels.canceledPrevious} ${state.previousTour.title}`;
    context += `\n${labels.suggestNew}`;
  }
  
  if (state.currentStage === 'booking' && !state.currentTour) {
    context += `\n${labels.warningNoTour}`;
    context += `\n${labels.askWhichTour}`;
  }
  
  if (state.discussedTours.length > 1) {
    context += `\n${labels.userViewed} ${state.discussedTours.length} ${labels.differentTours}`;
  }
  
  return context;
}
