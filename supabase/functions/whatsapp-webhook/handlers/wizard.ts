// Reservation wizard handler

import type { WizardState } from '../types.ts';
import { getUserProfile } from '../services/profile.ts';
import { getSystemMessage } from '../config/labels.ts';

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
    message += `${index + 1}. ${depDate} - ${date.price_adult} ${selectedTour.currency}\n`;
  });

  message += language === 'tr'
    ? '\n\nLütfen tarih numarasını yazın:'
    : '\n\nPlease enter the date number:';

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

  // Update wizard state
  state.step = 'pax_selection';
  state.selected_date = selectedDate;
  await saveWizardState(supabase, phone, agencyId, state);

  return language === 'tr'
    ? `✅ Tarih seçildi: ${new Date(selectedDate.departure_date).toLocaleDateString('tr-TR')}\n\n👥 Kaç yetişkin katılacak? (Sayı yazın)`
    : `✅ Date selected: ${new Date(selectedDate.departure_date).toLocaleDateString('en-US')}\n\n👥 How many adults? (Enter number)`;
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

  const paxAdult = parseInt(userMessage);

  if (isNaN(paxAdult) || paxAdult < 1) {
    return language === 'tr'
      ? 'Geçersiz sayı. Lütfen 1 veya daha fazla sayı girin.'
      : 'Invalid number. Please enter 1 or more.';
  }

  if (paxAdult > state.selected_date.quota) {
    return language === 'tr'
      ? `Üzgünüm, sadece ${state.selected_date.quota} kişilik kontenjan var.`
      : `Sorry, only ${state.selected_date.quota} spots available.`;
  }

  // Update wizard state
  state.pax_adult = paxAdult;
  state.step = 'special_requests';
  await saveWizardState(supabase, phone, agencyId, state);

  return language === 'tr'
    ? `✅ ${paxAdult} yetişkin kaydedildi.\n\n📝 Özel isteğiniz var mı? (Yoksa "yok" yazın)`
    : `✅ ${paxAdult} adults registered.\n\n📝 Any special requests? (Type "no" if none)`;
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

  if (lowerMessage !== 'yok' && lowerMessage !== 'no' && lowerMessage !== 'none') {
    state.special_requests = userMessage;
  }

  // Update wizard state
  state.step = 'confirmation';
  await saveWizardState(supabase, phone, agencyId, state);

  if (!state.selected_date || !state.selected_tour || !state.pax_adult) {
    await clearWizardState(supabase, phone, agencyId);
    return 'Bir hata oluştu. Lütfen tekrar başlayın.';
  }

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
  message += `👥 *${language === 'tr' ? 'Kişi' : 'People'}:* ${state.pax_adult}\n`;
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

  if (lowerMessage !== 'evet' && lowerMessage !== 'yes' && lowerMessage !== 'y') {
    await clearWizardState(supabase, phone, agencyId);
    return language === 'tr'
      ? 'Rezervasyon iptal edildi.'
      : 'Reservation cancelled.';
  }

  if (!state.selected_tour || !state.selected_date || !state.pax_adult) {
    await clearWizardState(supabase, phone, agencyId);
    return 'Bir hata oluştu. Lütfen tekrar başlayın.';
  }

  // Get user profile for name
  const userProfile = await getUserProfile(supabase, phone, agencyId);
  const fullName = userProfile?.full_name || 'WhatsApp Customer';

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

  return language === 'tr'
    ? `🎉 *REZERVASYON TAMAMLANDI!*\n\n✅ Rezervasyonunuz başarıyla alındı.\n📱 Rezervasyon No: ${registration.id.substring(0, 8)}\n\n📞 Acentemiz en kısa sürede sizinle iletişime geçecektir.\n\nTeşekkür ederiz! 🙏`
    : `🎉 *RESERVATION COMPLETED!*\n\n✅ Your reservation has been received.\n📱 Reservation No: ${registration.id.substring(0, 8)}\n\n📞 Our agency will contact you shortly.\n\nThank you! 🙏`;
}
