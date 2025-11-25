// Reservation wizard handler

import type { WizardState } from '../types.ts';
import { getUserProfile } from '../services/profile.ts';
import { getSystemMessage } from '../config/labels.ts';
import { formatDate, formatPrice } from '../utils/format.ts';
import { generatePaymentMessage } from '../services/payment-message.ts';

// Get wizard state from user preferences
export async function getWizardState(
  supabase: any,
  phone: string,
  agencyId: string
): Promise<WizardState | null> {
  try {
    const userProfile = await getUserProfile(supabase, phone, agencyId);
    if (!userProfile || !userProfile.preferences?.wizard_state) {
      return null;
    }

    const state = userProfile.preferences.wizard_state;

    // Wizard states older than 15 minutes are invalid
    const stateAge = Date.now() - new Date(state.created_at).getTime();
    if (stateAge > 15 * 60 * 1000) {
      await clearWizardState(supabase, phone, agencyId);
      return null;
    }

    return state;
  } catch (error) {
    console.error('Error getting wizard state:', error);
    return null;
  }
}

// Save wizard state to user preferences
export async function saveWizardState(
  supabase: any,
  phone: string,
  agencyId: string,
  state: WizardState
) {
  try {
    const { data: profile } = await supabase
      .from('whatsapp_user_profiles')
      .select('preferences')
      .eq('phone', phone)
      .eq('agency_id', agencyId)
      .single();

    const preferences = profile?.preferences || {};
    preferences.wizard_state = state;

    await supabase
      .from('whatsapp_user_profiles')
      .update({ preferences })
      .eq('phone', phone)
      .eq('agency_id', agencyId);
  } catch (error) {
    console.error('Error saving wizard state:', error);
  }
}

// Clear wizard state
export async function clearWizardState(
  supabase: any,
  phone: string,
  agencyId: string
) {
  try {
    const { data: profile } = await supabase
      .from('whatsapp_user_profiles')
      .select('preferences')
      .eq('phone', phone)
      .eq('agency_id', agencyId)
      .single();

    const preferences = profile?.preferences || {};
    delete preferences.wizard_state;

    await supabase
      .from('whatsapp_user_profiles')
      .update({ preferences })
      .eq('phone', phone)
      .eq('agency_id', agencyId);
  } catch (error) {
    console.error('Error clearing wizard state:', error);
  }
}

// Handle wizard step
export async function handleWizardStep(
  supabase: any,
  phone: string,
  agencyId: string,
  userMessage: string,
  state: WizardState
): Promise<string> {
  const lowerMessage = userMessage.toLowerCase().trim();

  // Get user profile for language
  const userProfile = await getUserProfile(supabase, phone, agencyId);
  const userLanguage = userProfile?.language_preference || 'tr';

  // Cancel check
  const cancelKeywords = ['iptal', 'vazgeç', 'cancel', 'abort', 'stop'];
  if (cancelKeywords.some(k => lowerMessage === k)) {
    await clearWizardState(supabase, phone, agencyId);
    return getSystemMessage('wizard_cancel', userLanguage);
  }

  switch (state.step) {
    case 'tour_selection':
      return await handleTourSelection(supabase, phone, agencyId, userMessage, state, userLanguage);

    case 'date_selection':
      return await handleDateSelection(supabase, phone, agencyId, userMessage, state, userLanguage);

    case 'pax_selection':
      return await handlePaxSelection(supabase, phone, agencyId, userMessage, state, userLanguage);

    case 'full_name_request':
      return await handleFullNameRequest(supabase, phone, agencyId, userMessage, state, userLanguage);

    case 'special_requests':
      return await handleSpecialRequests(supabase, phone, agencyId, userMessage, state, userLanguage);

    case 'confirmation':
      return await handleConfirmation(supabase, phone, agencyId, userMessage, state, userLanguage);

    default:
      await clearWizardState(supabase, phone, agencyId);
      return 'Bir hata oluştu. Lütfen tekrar deneyin.';
  }
}

// Tour selection step
async function handleTourSelection(
  supabase: any,
  phone: string,
  agencyId: string,
  userMessage: string,
  state: WizardState,
  language: string
): Promise<string> {
  // If tour already selected (from conversation state), skip to date selection
  if (state.selected_tour) {
    const selectedTour = state.selected_tour;
    
    // Get available dates for the already selected tour
    const { data: dates } = await supabase
      .from('tour_dates')
      .select('*')
      .eq('tour_id', selectedTour.id)
      .gte('departure_date', new Date().toISOString())
      .gt('quota', 0)
      .order('departure_date', { ascending: true });

    if (!dates || dates.length === 0) {
      return language === 'tr'
        ? 'Bu tur için müsait tarih bulunmuyor. Başka bir tur seçebilirsiniz.'
        : 'No available dates for this tour. You can choose another tour.';
    }

    // Update wizard state to date selection
    state.step = 'date_selection';
    await saveWizardState(supabase, phone, agencyId, state);

    // Format dates list
    let message = language === 'tr'
      ? `✅ *${selectedTour.title}* turu için kayıt başlatıyorum!\n\n📅 Müsait tarihler:\n\n`
      : `✅ Starting registration for *${selectedTour.title}* tour!\n\n📅 Available dates:\n\n`;

    dates.forEach((date: any, index: number) => {
      const depDate = new Date(date.departure_date).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
      message += `${index + 1}. **${depDate}**\n`;
      message += `   💰 Yetişkin: ${date.price_adult} ${selectedTour.currency}\n`;
      if (date.price_child) {
        message += `   👶 Çocuk: ${date.price_child} ${selectedTour.currency}\n`;
      }
      message += `   📊 Kota: ${date.quota} kişi\n\n`;
    });

    message += language === 'tr'
      ? 'Lütfen tarih numarasını yazın:'
      : 'Please enter the date number:';

    return message;
  }

  // Get all tours
  const { data: tours } = await supabase
    .from('tours')
    .select('*')
    .eq('agency_id', agencyId);

  // Find matching tour by name or number
  const tourNumber = parseInt(userMessage);
  let selectedTour = null;

  if (!isNaN(tourNumber) && tours && tourNumber > 0 && tourNumber <= tours.length) {
    selectedTour = tours[tourNumber - 1];
  } else {
    // Search by name
    selectedTour = tours?.find((t: any) =>
      t.title.toLowerCase().includes(userMessage.toLowerCase())
    );
  }

  if (!selectedTour) {
    return language === 'tr'
      ? 'Tur bulunamadı. Lütfen tur numarasını veya ismini tekrar yazın.'
      : 'Tour not found. Please enter the tour number or name again.';
  }

  // Get available dates for this tour
  const { data: dates } = await supabase
    .from('tour_dates')
    .select('*')
    .eq('tour_id', selectedTour.id)
    .gte('departure_date', new Date().toISOString())
    .gt('quota', 0)
    .order('departure_date', { ascending: true });

  if (!dates || dates.length === 0) {
    return language === 'tr'
      ? 'Bu tur için müsait tarih bulunmuyor. Başka bir tur seçebilirsiniz.'
      : 'No available dates for this tour. You can choose another tour.';
  }

  // Update wizard state
  state.step = 'date_selection';
  state.selected_tour = selectedTour;
  await saveWizardState(supabase, phone, agencyId, state);

  // Format dates list
  let message = language === 'tr'
    ? `✅ *${selectedTour.title}* turu seçildi!\n\n📅 Müsait tarihler:\n\n`
    : `✅ *${selectedTour.title}* tour selected!\n\n📅 Available dates:\n\n`;

  dates.forEach((date: any, index: number) => {
    const depDate = new Date(date.departure_date).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    message += `${index + 1}. **${depDate}**\n`;
    message += `   💰 Yetişkin: ${date.price_adult} ${selectedTour.currency}\n`;
    if (date.price_child) {
      message += `   👶 Çocuk: ${date.price_child} ${selectedTour.currency}\n`;
    }
    message += `   📊 Kota: ${date.quota} kişi\n\n`;
  });

  message += language === 'tr'
    ? 'Lütfen tarih numarasını yazın:'
    : 'Please enter the date number:';

  return message;
}

// Date selection step
async function handleDateSelection(
  supabase: any,
  phone: string,
  agencyId: string,
  userMessage: string,
  state: WizardState,
  language: string
): Promise<string> {
  if (!state.selected_tour) {
    await clearWizardState(supabase, phone, agencyId);
    return 'Bir hata oluştu. Lütfen tekrar başlayın.';
  }

  const { data: dates } = await supabase
    .from('tour_dates')
    .select('*')
    .eq('tour_id', state.selected_tour.id)
    .gte('departure_date', new Date().toISOString())
    .gt('quota', 0)
    .order('departure_date', { ascending: true });

  const dateNumber = parseInt(userMessage);

  if (isNaN(dateNumber) || !dates || dateNumber < 1 || dateNumber > dates.length) {
    return language === 'tr'
      ? 'Geçersiz tarih numarası. Lütfen listeden bir numara seçin.'
      : 'Invalid date number. Please select a number from the list.';
  }

  const selectedDate = dates[dateNumber - 1];

  // Update wizard state - skip to date_selection if pax info from conversation exists
  if (state.pax_adult && state.pax_adult > 0) {
    // We already have pax info from conversation memory, skip to full name
    state.step = 'full_name_request';
    state.selected_date = selectedDate;
    await saveWizardState(supabase, phone, agencyId, state);
    
    const paxMessages = {
      tr: `✅ Tarih seçildi: ${new Date(selectedDate.departure_date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}\n👥 ${state.pax_adult} yetişkin${state.pax_child ? ` ve ${state.pax_child} çocuk` : ''}\n\nLütfen adınız ve soyadınızı yazın:`,
      en: `✅ Date selected: ${new Date(selectedDate.departure_date).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })}\n👥 ${state.pax_adult} adult${state.pax_adult > 1 ? 's' : ''}${state.pax_child ? ` and ${state.pax_child} child${state.pax_child > 1 ? 'ren' : ''}` : ''}\n\nPlease enter your full name:`,
      de: `✅ Datum ausgewählt: ${new Date(selectedDate.departure_date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}\n👥 ${state.pax_adult} Erwachsene${state.pax_child ? ` und ${state.pax_child} Kinder` : ''}\n\nBitte geben Sie Ihren vollständigen Namen ein:`,
      ru: `✅ Дата выбрана: ${new Date(selectedDate.departure_date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}\n👥 ${state.pax_adult} взрослых${state.pax_child ? ` и ${state.pax_child} детей` : ''}\n\nПожалуйста, введите свое полное имя:`,
      ar: `✅ تم اختيار التاريخ: ${new Date(selectedDate.departure_date).toLocaleDateString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' })}\n👥 ${state.pax_adult} بالغين${state.pax_child ? ` و ${state.pax_child} أطفال` : ''}\n\nالرجاء إدخال اسمك الكامل:`,
      fr: `✅ Date sélectionnée: ${new Date(selectedDate.departure_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}\n👥 ${state.pax_adult} adulte${state.pax_adult > 1 ? 's' : ''}${state.pax_child ? ` et ${state.pax_child} enfant${state.pax_child > 1 ? 's' : ''}` : ''}\n\nVeuillez entrer votre nom complet:`,
      es: `✅ Fecha seleccionada: ${new Date(selectedDate.departure_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}\n👥 ${state.pax_adult} adulto${state.pax_adult > 1 ? 's' : ''}${state.pax_child ? ` y ${state.pax_child} niño${state.pax_child > 1 ? 's' : ''}` : ''}\n\nPor favor, ingrese su nombre completo:`
    };
    
    return paxMessages[language as keyof typeof paxMessages] || paxMessages.tr;
  }
  
  // Ask for pax
  state.step = 'pax_selection';
  state.selected_date = selectedDate;
  await saveWizardState(supabase, phone, agencyId, state);
  
  const paxRequestMessages = {
    tr: `✅ Tarih seçildi: ${new Date(selectedDate.departure_date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}\n\n👥 Kaç yetişkin katılacak? Çocuk varsa belirtin (Örnek: 3 yetişkin 2 çocuk)`,
    en: `✅ Date selected: ${new Date(selectedDate.departure_date).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })}\n\n👥 How many adults? Specify children if any (Example: 3 adults 2 children)`,
    de: `✅ Datum ausgewählt: ${new Date(selectedDate.departure_date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}\n\n👥 Wie viele Erwachsene? Geben Sie Kinder an, falls vorhanden (Beispiel: 3 Erwachsene 2 Kinder)`,
    ru: `✅ Дата выбрана: ${new Date(selectedDate.departure_date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}\n\n👥 Сколько взрослых? Укажите детей, если есть (Пример: 3 взрослых 2 детей)`,
    ar: `✅ تم اختيار التاريخ: ${new Date(selectedDate.departure_date).toLocaleDateString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' })}\n\n👥 كم عدد البالغين؟ حدد الأطفال إن وجدوا (مثال: 3 بالغين 2 أطفال)`,
    fr: `✅ Date sélectionnée: ${new Date(selectedDate.departure_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}\n\n👥 Combien d'adultes? Précisez les enfants s'il y en a (Exemple: 3 adultes 2 enfants)`,
    es: `✅ Fecha seleccionada: ${new Date(selectedDate.departure_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}\n\n👥 ¿Cuántos adultos? Especifique niños si los hay (Ejemplo: 3 adultos 2 niños)`
  };
  
  return paxRequestMessages[language as keyof typeof paxRequestMessages] || paxRequestMessages.tr;
}

// Pax selection step
async function handlePaxSelection(
  supabase: any,
  phone: string,
  agencyId: string,
  userMessage: string,
  state: WizardState,
  language: string
): Promise<string> {
  if (!state.selected_date) {
    await clearWizardState(supabase, phone, agencyId);
    return 'Bir hata oluştu. Lütfen tekrar başlayın.';
  }

  // Try to parse "X yetişkin Y çocuk" format
  const turkishMatch = userMessage.match(/(\d+)\s*(?:yetişkin|yetiskin|adult)/i);
  const childMatch = userMessage.match(/(\d+)\s*(?:çocuk|cocuk|child)/i);
  
  let paxAdult: number;
  let paxChild = 0;

  if (turkishMatch) {
    paxAdult = parseInt(turkishMatch[1]);
    if (childMatch) {
      paxChild = parseInt(childMatch[1]);
    }
  } else {
    // Simple number only
    paxAdult = parseInt(userMessage);
  }

  if (isNaN(paxAdult) || paxAdult < 1) {
    const messages = {
      tr: 'Geçersiz sayı. Örnek: "3 yetişkin 2 çocuk" veya sadece "3"',
      en: 'Invalid number. Example: "3 adults 2 children" or just "3"',
      de: 'Ungültige Zahl. Beispiel: "3 Erwachsene 2 Kinder" oder nur "3"',
      ru: 'Неверное число. Пример: "3 взрослых 2 ребёнка" или просто "3"',
      ar: 'رقم غير صالح. مثال: "3 بالغين 2 أطفال" أو فقط "3"',
      fr: 'Nombre invalide. Exemple: "3 adultes 2 enfants" ou juste "3"',
      es: 'Número inválido. Ejemplo: "3 adultos 2 niños" o solo "3"'
    };
    return messages[language as keyof typeof messages] || messages.tr;
  }

  const totalPax = paxAdult + paxChild;
  if (totalPax > state.selected_date.quota) {
    const messages = {
      tr: `Üzgünüm, sadece ${state.selected_date.quota} kişilik kontenjan var.`,
      en: `Sorry, only ${state.selected_date.quota} spots available.`,
      de: `Entschuldigung, nur ${state.selected_date.quota} Plätze verfügbar.`,
      ru: `Извините, доступно только ${state.selected_date.quota} мест.`,
      ar: `عذرًا، متاح فقط ${state.selected_date.quota} مكان.`,
      fr: `Désolé, seulement ${state.selected_date.quota} places disponibles.`,
      es: `Lo siento, solo ${state.selected_date.quota} plazas disponibles.`
    };
    return messages[language as keyof typeof messages] || messages.tr;
  }

  // Update wizard state
  state.pax_adult = paxAdult;
  state.pax_child = paxChild;
  state.step = 'full_name_request';
  await saveWizardState(supabase, phone, agencyId, state);

  const summaryMessages = {
    tr: paxChild > 0 
      ? `✅ ${paxAdult} yetişkin, ${paxChild} çocuk kaydedildi.\n\n👤 Adınız ve soyadınız nedir?`
      : `✅ ${paxAdult} yetişkin kaydedildi.\n\n👤 Adınız ve soyadınız nedir?`,
    en: paxChild > 0
      ? `✅ ${paxAdult} adults, ${paxChild} children registered.\n\n👤 What's your full name?`
      : `✅ ${paxAdult} adults registered.\n\n👤 What's your full name?`,
    de: paxChild > 0
      ? `✅ ${paxAdult} Erwachsene, ${paxChild} Kinder registriert.\n\n👤 Wie ist Ihr vollständiger Name?`
      : `✅ ${paxAdult} Erwachsene registriert.\n\n👤 Wie ist Ihr vollständiger Name?`,
    ru: paxChild > 0
      ? `✅ ${paxAdult} взрослых, ${paxChild} детей зарегистрировано.\n\n👤 Как ваше полное имя?`
      : `✅ ${paxAdult} взрослых зарегистрировано.\n\n👤 Как ваше полное имя?`,
    ar: paxChild > 0
      ? `✅ ${paxAdult} بالغين، ${paxChild} أطفال مسجلين.\n\n👤 ما هو اسمك الكامل؟`
      : `✅ ${paxAdult} بالغين مسجلين.\n\n👤 ما هو اسمك الكامل؟`,
    fr: paxChild > 0
      ? `✅ ${paxAdult} adultes, ${paxChild} enfants enregistrés.\n\n👤 Quel est votre nom complet?`
      : `✅ ${paxAdult} adultes enregistrés.\n\n👤 Quel est votre nom complet?`,
    es: paxChild > 0
      ? `✅ ${paxAdult} adultos, ${paxChild} niños registrados.\n\n👤 ¿Cuál es su nombre completo?`
      : `✅ ${paxAdult} adultos registrados.\n\n👤 ¿Cuál es su nombre completo?`
  };

  return summaryMessages[language as keyof typeof summaryMessages] || summaryMessages.tr;
}

// Full name request step
async function handleFullNameRequest(
  supabase: any,
  phone: string,
  agencyId: string,
  userMessage: string,
  state: WizardState,
  language: string
): Promise<string> {
  const trimmedName = userMessage.trim();

  if (trimmedName.length < 3) {
    const messages = {
      tr: 'Lütfen tam adınızı ve soyadınızı yazın.',
      en: 'Please enter your full name.',
      de: 'Bitte geben Sie Ihren vollständigen Namen ein.',
      ru: 'Пожалуйста, введите ваше полное имя.',
      ar: 'يرجى إدخال اسمك الكامل.',
      fr: 'Veuillez entrer votre nom complet.',
      es: 'Por favor ingrese su nombre completo.'
    };
    return messages[language as keyof typeof messages] || messages.tr;
  }

  // Update wizard state
  state.full_name = trimmedName;
  state.step = 'special_requests';
  await saveWizardState(supabase, phone, agencyId, state);

  const messages = {
    tr: `✅ Teşekkürler ${trimmedName}!\n\n📝 Özel isteğiniz var mı? (Yoksa "yok" yazın)`,
    en: `✅ Thank you ${trimmedName}!\n\n📝 Any special requests? (Type "no" if none)`,
    de: `✅ Danke ${trimmedName}!\n\n📝 Haben Sie besondere Wünsche? (Schreiben Sie "nein", wenn keine)`,
    ru: `✅ Спасибо ${trimmedName}!\n\n📝 Есть ли особые пожелания? (Напишите "нет", если нет)`,
    ar: `✅ شكراً ${trimmedName}!\n\n📝 هل لديك طلبات خاصة؟ (اكتب "لا" إذا لم يكن هناك)`,
    fr: `✅ Merci ${trimmedName}!\n\n📝 Des demandes spéciales? (Tapez "non" si aucune)`,
    es: `✅ Gracias ${trimmedName}!\n\n📝 ¿Alguna solicitud especial? (Escriba "no" si ninguna)`
  };

  return messages[language as keyof typeof messages] || messages.tr;
}

// Special requests step
async function handleSpecialRequests(
  supabase: any,
  phone: string,
  agencyId: string,
  userMessage: string,
  state: WizardState,
  language: string
): Promise<string> {
  const lowerMessage = userMessage.toLowerCase();

  // Check if required fields are present
  if (!state.selected_date || !state.selected_tour || !state.pax_adult) {
    await clearWizardState(supabase, phone, agencyId);
    const messages = {
      tr: 'Bir hata oluştu. Lütfen tekrar başlayın.',
      en: 'An error occurred. Please start again.',
      de: 'Ein Fehler ist aufgetreten. Bitte beginnen Sie erneut.',
      ru: 'Произошла ошибка. Пожалуйста, начните снова.',
      ar: 'حدث خطأ. يرجى البدء من جديد.',
      fr: 'Une erreur s\'est produite. Veuillez recommencer.',
      es: 'Ocurrió un error. Por favor comience de nuevo.'
    };
    return messages[language as keyof typeof messages] || messages.tr;
  }

  // CRITICAL: Check if full_name is present (should have been collected in previous step)
  if (!state.full_name || state.full_name.trim().length < 3) {
    // If full_name is missing, go back to full_name_request step
    state.step = 'full_name_request';
    await saveWizardState(supabase, phone, agencyId, state);
    
    const messages = {
      tr: 'Lütfen tam adınızı ve soyadınızı yazın:',
      en: 'Please enter your full name:',
      de: 'Bitte geben Sie Ihren vollständigen Namen ein:',
      ru: 'Пожалуйста, введите ваше полное имя:',
      ar: 'يرجى إدخال اسمك الكامل:',
      fr: 'Veuillez entrer votre nom complet:',
      es: 'Por favor ingrese su nombre completo:'
    };
    return messages[language as keyof typeof messages] || messages.tr;
  }

  if (lowerMessage !== 'yok' && lowerMessage !== 'no' && lowerMessage !== 'none') {
    state.special_requests = userMessage;
  }

  // Update wizard state
  state.step = 'confirmation';
  await saveWizardState(supabase, phone, agencyId, state);

  // Format confirmation message
  const depDate = new Date(state.selected_date.departure_date).toLocaleDateString(
    language === 'tr' ? 'tr-TR' : 'en-US',
    { day: '2-digit', month: 'long', year: 'numeric' }
  );

  const totalPrice = state.pax_adult * state.selected_date.price_adult;

  let message = language === 'tr'
    ? '📋 *REZERVASYON ÖZETİ*\n\n'
    : '📋 *RESERVATION SUMMARY*\n\n';

  message += `🏖️ *${language === 'tr' ? 'Tur' : 'Tour'}:* ${state.selected_tour.title}\n`;
  message += `📅 *${language === 'tr' ? 'Tarih' : 'Date'}:* ${depDate}\n`;
  
  const paxText = state.pax_child && state.pax_child > 0
    ? `${state.pax_adult} ${language === 'tr' ? 'Yetişkin' : 'Adults'}, ${state.pax_child} ${language === 'tr' ? 'Çocuk' : 'Children'}`
    : `${state.pax_adult} ${language === 'tr' ? 'Yetişkin' : 'Adults'}`;
  
  message += `👥 *${language === 'tr' ? 'Kişi' : 'People'}:* ${paxText}\n`;
  message += `👤 *${language === 'tr' ? 'İsim' : 'Name'}:* ${state.full_name || '-'}\n`;
  message += `💰 *${language === 'tr' ? 'Toplam' : 'Total'}:* ${totalPrice} ${state.selected_tour.currency}\n`;

  if (state.special_requests) {
    message += `📝 *${language === 'tr' ? 'Özel İstek' : 'Special Request'}:* ${state.special_requests}\n`;
  }

  message += language === 'tr'
    ? '\n\n✅ Onaylamak için "evet", iptal için "iptal" yazın.'
    : '\n\n✅ Type "yes" to confirm, "cancel" to abort.';

  return message;
}

// Confirmation step
async function handleConfirmation(
  supabase: any,
  phone: string,
  agencyId: string,
  userMessage: string,
  state: WizardState,
  language: string
): Promise<string> {
  const lowerMessage = userMessage.toLowerCase();

  const cancelMessages = {
    tr: `❌ Rezervasyon iptal edildi.

Başka bir tur hakkında bilgi almak isterseniz yardımcı olabilirim. 🙂`,
    en: `❌ Reservation cancelled.

If you'd like information about another tour, I'm here to help. 🙂`,
    de: `❌ Reservierung storniert.

Wenn Sie Informationen zu einer anderen Tour wünschen, helfe ich Ihnen gerne. 🙂`,
    ru: `❌ Бронирование отменено.

Если вы хотите получить информацию о другом туре, я готов помочь. 🙂`,
    ar: `❌ تم إلغاء الحجز.

إذا كنت تريد معلومات عن جولة أخرى، يمكنني المساعدة. 🙂`,
    fr: `❌ Réservation annulée.

Si vous souhaitez des informations sur un autre circuit, je suis là pour vous aider. 🙂`,
    es: `❌ Reserva cancelada.

Si desea información sobre otro tour, estoy aquí para ayudarle. 🙂`
  };

  if (lowerMessage !== 'evet' && lowerMessage !== 'yes' && lowerMessage !== 'y' && lowerMessage !== 'ja' && lowerMessage !== 'да' && lowerMessage !== 'نعم' && lowerMessage !== 'oui' && lowerMessage !== 'sí') {
    await clearWizardState(supabase, phone, agencyId);
    return cancelMessages[language as keyof typeof cancelMessages] || cancelMessages.tr;
  }

  if (!state.selected_tour || !state.selected_date || !state.pax_adult) {
    await clearWizardState(supabase, phone, agencyId);
    const messages = {
      tr: 'Bir hata oluştu. Lütfen tekrar başlayın.',
      en: 'An error occurred. Please start again.',
      de: 'Ein Fehler ist aufgetreten. Bitte beginnen Sie erneut.',
      ru: 'Произошла ошибка. Пожалуйста, начните снова.',
      ar: 'حدث خطأ. يرجى البدء من جديد.',
      fr: 'Une erreur s\'est produite. Veuillez recommencer.',
      es: 'Ocurrió un error. Por favor comience de nuevo.'
    };
    return messages[language as keyof typeof messages] || messages.tr;
  }

  // CRITICAL: Ensure full_name is present before creating registration
  if (!state.full_name || state.full_name.trim().length < 3) {
    // If full_name is missing, go back to full_name_request step
    state.step = 'full_name_request';
    await saveWizardState(supabase, phone, agencyId, state);
    
    const messages = {
      tr: 'Kayıt için lütfen tam adınızı ve soyadınızı yazın:',
      en: 'Please enter your full name for registration:',
      de: 'Bitte geben Sie Ihren vollständigen Namen für die Anmeldung ein:',
      ru: 'Пожалуйста, введите ваше полное имя для регистрации:',
      ar: 'يرجى إدخال اسمك الكامل للتسجيل:',
      fr: 'Veuillez entrer votre nom complet pour l\'inscription:',
      es: 'Por favor ingrese su nombre completo para el registro:'
    };
    return messages[language as keyof typeof messages] || messages.tr;
  }

  // Use full name from wizard state (guaranteed to exist now)
  const fullName = state.full_name;

  // Create registration
  const { data: registration, error } = await supabase
    .from('registrations')
    .insert({
      agency_id: agencyId,
      tour_id: state.selected_tour.id,
      tour_date_id: state.selected_date.id,
      phone: phone,
      full_name: fullName,
      pax: state.pax_adult,
      status: 'NEW',
      note: state.special_requests ? `WhatsApp Wizard: ${state.special_requests}` : 'WhatsApp Wizard Rezervasyon'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating registration:', error);
    await clearWizardState(supabase, phone, agencyId);
    return language === 'tr'
      ? 'Rezervasyon sırasında bir hata oluştu. Lütfen tekrar deneyin.'
      : 'An error occurred during reservation. Please try again.';
  }

  // Update quota
  await supabase
    .from('tour_dates')
    .update({ quota: state.selected_date.quota - state.pax_adult })
    .eq('id', state.selected_date.id);

  // Clear wizard state
  await clearWizardState(supabase, phone, agencyId);

  // Fetch agency payment instructions, language currencies and primary currency
  const { data: agencyData } = await supabase
    .from('agencies')
    .select('payment_instructions, primary_currency, language_currencies')
    .eq('id', agencyId)
    .single();

  // Calculate total price
  const totalPrice = state.pax_adult * state.selected_date.price_adult;
  const depositPercentage = agencyData?.payment_instructions?.deposit_percentage || 30;
  const depositAmount = Math.round((totalPrice * depositPercentage) / 100);
  const formattedDate = formatDate(state.selected_date.departure_date, language);
  const formattedPrice = formatPrice(totalPrice);

  // Generate payment message with currency conversion
  const paymentMessage = agencyData?.payment_instructions 
    ? await generatePaymentMessage(
        agencyData.payment_instructions, 
        language, 
        totalPrice, 
        depositAmount, 
        state.selected_tour.currency,
        {
          languageCurrencies: agencyData.language_currencies,
          primaryCurrency: agencyData.primary_currency
        }
      )
    : '';

  // Build beautiful summary message - multilingual
  const confirmationMessages = {
    tr: `🎉 *REZERVASYON TAMAMLANDI!*

━━━━━━━━━━━━━━━━━━━━
📋 *REZERVASYON ÖZETİ*
━━━━━━━━━━━━━━━━━━━━

🎫 *Tur:* ${state.selected_tour.title}
📅 *Tarih:* ${formattedDate}
👥 *Kişi Sayısı:* ${state.pax_child && state.pax_child > 0 ? `${state.pax_adult} Yetişkin, ${state.pax_child} Çocuk` : `${state.pax_adult} Yetişkin`}
👤 *İsim:* ${state.full_name || fullName}
💰 *Toplam Fiyat:* ${formattedPrice}

📱 *Rezervasyon No:* ${registration.id.substring(0, 8).toUpperCase()}

━━━━━━━━━━━━━━━━━━━━

✅ Rezervasyonunuz başarıyla alındı!
📞 Acente yetkilimiz en kısa sürede sizinle iletişime geçecektir.

Teşekkür ederiz! 🙏`,
    en: `🎉 *RESERVATION COMPLETED!*

━━━━━━━━━━━━━━━━━━━━
📋 *RESERVATION SUMMARY*
━━━━━━━━━━━━━━━━━━━━

🎫 *Tour:* ${state.selected_tour.title}
📅 *Date:* ${formattedDate}
👥 *Participants:* ${state.pax_child && state.pax_child > 0 ? `${state.pax_adult} Adults, ${state.pax_child} Children` : `${state.pax_adult} Adults`}
👤 *Name:* ${state.full_name || fullName}
💰 *Total Price:* ${formattedPrice}

📱 *Reservation No:* ${registration.id.substring(0, 8).toUpperCase()}

━━━━━━━━━━━━━━━━━━━━

✅ Your reservation has been successfully received!
📞 Our agency representative will contact you shortly.

Thank you! 🙏`,
    de: `🎉 *RESERVIERUNG ABGESCHLOSSEN!*

━━━━━━━━━━━━━━━━━━━━
📋 *RESERVIERUNGSÜBERSICHT*
━━━━━━━━━━━━━━━━━━━━

🎫 *Tour:* ${state.selected_tour.title}
📅 *Datum:* ${formattedDate}
👥 *Teilnehmer:* ${state.pax_child && state.pax_child > 0 ? `${state.pax_adult} Erwachsene, ${state.pax_child} Kinder` : `${state.pax_adult} Erwachsene`}
👤 *Name:* ${state.full_name || fullName}
💰 *Gesamtpreis:* ${formattedPrice}

📱 *Reservierungs-Nr:* ${registration.id.substring(0, 8).toUpperCase()}

━━━━━━━━━━━━━━━━━━━━

✅ Ihre Reservierung wurde erfolgreich entgegengenommen!
📞 Unser Agenturvertreter wird sich in Kürze mit Ihnen in Verbindung setzen.

Vielen Dank! 🙏`,
    ru: `🎉 *БРОНИРОВАНИЕ ЗАВЕРШЕНО!*

━━━━━━━━━━━━━━━━━━━━
📋 *ИТОГИ БРОНИРОВАНИЯ*
━━━━━━━━━━━━━━━━━━━━

🎫 *Тур:* ${state.selected_tour.title}
📅 *Дата:* ${formattedDate}
👥 *Участники:* ${state.pax_child && state.pax_child > 0 ? `${state.pax_adult} Взрослых, ${state.pax_child} Детей` : `${state.pax_adult} Взрослых`}
👤 *Имя:* ${state.full_name || fullName}
💰 *Общая стоимость:* ${formattedPrice}

📱 *Номер брони:* ${registration.id.substring(0, 8).toUpperCase()}

━━━━━━━━━━━━━━━━━━━━

✅ Ваше бронирование успешно принято!
📞 Наш представитель свяжется с вами в ближайшее время.

Спасибо! 🙏`,
    ar: `🎉 *تم إكمال الحجز!*

━━━━━━━━━━━━━━━━━━━━
📋 *ملخص الحجز*
━━━━━━━━━━━━━━━━━━━━

🎫 *الجولة:* ${state.selected_tour.title}
📅 *التاريخ:* ${formattedDate}
👥 *المشاركون:* ${state.pax_child && state.pax_child > 0 ? `${state.pax_adult} بالغين، ${state.pax_child} أطفال` : `${state.pax_adult} بالغين`}
👤 *الاسم:* ${state.full_name || fullName}
💰 *السعر الإجمالي:* ${formattedPrice}

📱 *رقم الحجز:* ${registration.id.substring(0, 8).toUpperCase()}

━━━━━━━━━━━━━━━━━━━━

✅ تم استلام حجزك بنجاح!
📞 سيتصل بك ممثل وكالتنا قريبًا.

شكراً لك! 🙏`,
    fr: `🎉 *RÉSERVATION TERMINÉE!*

━━━━━━━━━━━━━━━━━━━━
📋 *RÉSUMÉ DE LA RÉSERVATION*
━━━━━━━━━━━━━━━━━━━━

🎫 *Circuit:* ${state.selected_tour.title}
📅 *Date:* ${formattedDate}
👥 *Participants:* ${state.pax_child && state.pax_child > 0 ? `${state.pax_adult} Adultes, ${state.pax_child} Enfants` : `${state.pax_adult} Adultes`}
👤 *Nom:* ${state.full_name || fullName}
💰 *Prix total:* ${formattedPrice}

📱 *N° de réservation:* ${registration.id.substring(0, 8).toUpperCase()}

━━━━━━━━━━━━━━━━━━━━

✅ Votre réservation a été reçue avec succès!
📞 Notre représentant vous contactera sous peu.

Merci! 🙏`,
    es: `🎉 *¡RESERVA COMPLETADA!*

━━━━━━━━━━━━━━━━━━━━
📋 *RESUMEN DE RESERVA*
━━━━━━━━━━━━━━━━━━━━

🎫 *Tour:* ${state.selected_tour.title}
📅 *Fecha:* ${formattedDate}
👥 *Participantes:* ${state.pax_child && state.pax_child > 0 ? `${state.pax_adult} Adultos, ${state.pax_child} Niños` : `${state.pax_adult} Adultos`}
👤 *Nombre:* ${state.full_name || fullName}
💰 *Precio total:* ${formattedPrice}

📱 *N° de reserva:* ${registration.id.substring(0, 8).toUpperCase()}

━━━━━━━━━━━━━━━━━━━━

✅ ¡Su reserva ha sido recibida exitosamente!
📞 Nuestro representante se pondrá en contacto con usted en breve.

¡Gracias! 🙏`
  };

  const confirmationMessage = confirmationMessages[language as keyof typeof confirmationMessages] || confirmationMessages.tr;
  return confirmationMessage + paymentMessage;
}
