// Demo wizard handler for reservation flow

import type { WizardState } from '../types.ts';

const formatDate = (dateStr: string, language: string): string => {
  const date = new Date(dateStr);
  const locales: { [key: string]: string } = {
    tr: 'tr-TR',
    en: 'en-US',
    de: 'de-DE',
    ru: 'ru-RU',
    ar: 'ar-EG',
    fr: 'fr-FR',
    es: 'es-ES'
  };
  return date.toLocaleDateString(locales[language] || 'tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

const formatPrice = (amount: number, currency: string, language: string): string => {
  return `${amount.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US')} ${currency}`;
};

// Handle wizard step
export async function handleWizardStep(
  userMessage: string,
  state: WizardState,
  tours: any[],
  language: string
): Promise<string> {
  const lowerMessage = userMessage.toLowerCase().trim();

  // Cancel check
  const cancelKeywords = ['iptal', 'vazgeç', 'cancel', 'abort', 'stop'];
  if (cancelKeywords.some(k => lowerMessage === k)) {
    const cancelMessages = {
      tr: `❌ Rezervasyon iptal edildi.\n\nBaşka bir tur hakkında bilgi almak isterseniz yardımcı olabilirim. 🙂`,
      en: `❌ Reservation cancelled.\n\nIf you'd like information about another tour, I'm here to help. 🙂`,
      de: `❌ Reservierung storniert.\n\nWenn Sie Informationen zu einer anderen Tour wünschen, helfe ich Ihnen gerne. 🙂`,
      ru: `❌ Бронирование отменено.\n\nЕсли вы хотите получить информацию о другом туре, я готов помочь. 🙂`,
      ar: `❌ تم إلغاء الحجز.\n\nإذا كنت تريد معلومات عن جولة أخرى، يمكنني المساعدة. 🙂`,
      fr: `❌ Réservation annulée.\n\nSi vous souhaitez des informations sur un autre circuit, je suis là pour vous aider. 🙂`,
      es: `❌ Reserva cancelada.\n\nSi desea información sobre otro tour, estoy aquí para ayudar. 🙂`
    };
    return cancelMessages[language as keyof typeof cancelMessages] || cancelMessages.tr;
  }

  switch (state.step) {
    case 'tour_selection':
      return await handleTourSelection(userMessage, state, tours, language);
    case 'date_selection':
      return await handleDateSelection(userMessage, state, language);
    case 'pax_selection':
      return await handlePaxSelection(userMessage, state, language);
    case 'full_name_request':
      return await handleFullNameRequest(userMessage, state, language);
    case 'special_requests':
      return await handleSpecialRequests(userMessage, state, language);
    case 'confirmation':
      return await handleConfirmation(userMessage, state, language);
    default:
      return 'Bir hata oluştu. Lütfen tekrar deneyin.';
  }
}

async function handleTourSelection(
  userMessage: string,
  state: WizardState,
  tours: any[],
  language: string
): Promise<string> {
  // If tour already selected (from conversation context), proceed to date selection
  if (state.selected_tour) {
    const tourDates = state.selected_tour.dates || [];
    if (tourDates.length === 0) {
      const noDateMessages = {
        tr: 'Bu tur için müsait tarih bulunmuyor. Başka bir tur seçebilirsiniz.',
        en: 'No available dates for this tour. You can choose another tour.',
        de: 'Keine verfügbaren Termine für diese Tour. Sie können eine andere Tour wählen.',
        ru: 'Нет доступных дат для этого тура. Вы можете выбрать другой тур.',
        ar: 'لا توجد تواريخ متاحة لهذه الجولة. يمكنك اختيار جولة أخرى.',
        fr: 'Aucune date disponible pour ce circuit. Vous pouvez choisir un autre circuit.',
        es: 'No hay fechas disponibles para este tour. Puedes elegir otro tour.'
      };
      return noDateMessages[language as keyof typeof noDateMessages] || noDateMessages.tr;
    }

    state.step = 'date_selection';
    
    const dateList = tourDates.map((date: any, index: number) => 
      `${index + 1}. ${formatDate(date.departure_date, language)} - ${formatPrice(date.price_adult, state.selected_tour.currency, language)}`
    ).join('\n');
    
    const tourConfirmation = {
      tr: `✅ ${state.selected_tour.title} turunu seçtiniz.\n\n`,
      en: `✅ You selected ${state.selected_tour.title}.\n\n`,
      de: `✅ Sie haben ${state.selected_tour.title} ausgewählt.\n\n`,
      ru: `✅ Вы выбрали ${state.selected_tour.title}.\n\n`,
      ar: `✅ لقد اخترت ${state.selected_tour.title}.\n\n`,
      fr: `✅ Vous avez sélectionné ${state.selected_tour.title}.\n\n`,
      es: `✅ Has seleccionado ${state.selected_tour.title}.\n\n`
    }[language] || `✅ ${state.selected_tour.title} turunu seçtiniz.\n\n`;
    
    const dateRequestMessages = {
      tr: '📅 Müsait tarihler:\n\n{dates}\n\nLütfen tarih numarasını yazın:',
      en: '📅 Available dates:\n\n{dates}\n\nPlease enter the date number:',
      de: '📅 Verfügbare Termine:\n\n{dates}\n\nBitte geben Sie die Terminnnummer ein:',
      ru: '📅 Доступные даты:\n\n{dates}\n\nПожалуйста, введите номер даты:',
      ar: '📅 التواريخ المتاحة:\n\n{dates}\n\nالرجاء إدخال رقم التاريخ:',
      fr: '📅 Dates disponibles:\n\n{dates}\n\nVeuillez entrer le numéro de date:',
      es: '📅 Fechas disponibles:\n\n{dates}\n\nPor favor, ingrese el número de fecha:'
    };
    
    const message = tourConfirmation + (dateRequestMessages[language as keyof typeof dateRequestMessages] || dateRequestMessages.tr)
      .replace('{dates}', dateList);
    
    return message;
  }

  // Find matching tour by name or number
  const tourNumber = parseInt(userMessage);
  let selectedTour = null;

  if (!isNaN(tourNumber) && tourNumber > 0 && tourNumber <= tours.length) {
    selectedTour = tours[tourNumber - 1];
  } else {
    selectedTour = tours.find((t: any) =>
      t.title.toLowerCase().includes(userMessage.toLowerCase())
    );
  }

  if (!selectedTour) {
    const notFoundMessages = {
      tr: 'Tur bulunamadı. Lütfen tur numarasını veya ismini tekrar yazın.',
      en: 'Tour not found. Please enter the tour number or name again.',
      de: 'Tour nicht gefunden. Bitte geben Sie die Tournummer oder den Namen erneut ein.',
      ru: 'Тур не найден. Пожалуйста, введите номер тура или название еще раз.',
      ar: 'لم يتم العثور على الجولة. الرجاء إدخال رقم الجولة أو الاسم مرة أخرى.',
      fr: 'Circuit non trouvé. Veuillez entrer le numéro ou le nom du circuit à nouveau.',
      es: 'Tour no encontrado. Por favor, ingrese el número o nombre del tour nuevamente.'
    };
    return notFoundMessages[language as keyof typeof notFoundMessages] || notFoundMessages.tr;
  }

  const dates = selectedTour.dates || [];
  if (dates.length === 0) {
    const noDateMessages = {
      tr: 'Bu tur için müsait tarih bulunmuyor. Başka bir tur seçebilirsiniz.',
      en: 'No available dates for this tour. You can choose another tour.',
      de: 'Keine verfügbaren Termine für diese Tour. Sie können eine andere Tour wählen.',
      ru: 'Нет доступных дат для этого тура. Вы можете выбрать другой тур.',
      ar: 'لا توجد تواريخ متاحة لهذه الجولة. يمكنك اختيار جولة أخرى.',
      fr: 'Aucune date disponible pour ce circuit. Vous pouvez choisir un autre circuit.',
      es: 'No hay fechas disponibles para este tour. Puedes elegir otro tour.'
    };
    return noDateMessages[language as keyof typeof noDateMessages] || noDateMessages.tr;
  }

  state.step = 'date_selection';
  state.selected_tour = selectedTour;

  const dateList = dates.map((date: any, index: number) => 
    `${index + 1}. ${formatDate(date.departure_date, language)} - ${formatPrice(date.price_adult, selectedTour.currency, language)}`
  ).join('\n');

  const selectedMessages = {
    tr: `✅ *${selectedTour.title}* turu seçildi!\n\n📅 Müsait tarihler:\n\n${dateList}\n\nLütfen tarih numarasını yazın:`,
    en: `✅ *${selectedTour.title}* tour selected!\n\n📅 Available dates:\n\n${dateList}\n\nPlease enter the date number:`,
    de: `✅ *${selectedTour.title}* Tour ausgewählt!\n\n📅 Verfügbare Termine:\n\n${dateList}\n\nBitte geben Sie die Terminnnummer ein:`,
    ru: `✅ *${selectedTour.title}* тур выбран!\n\n📅 Доступные даты:\n\n${dateList}\n\nПожалуйста, введите номер даты:`,
    ar: `✅ *${selectedTour.title}* تم اختيار الجولة!\n\n📅 التواريخ المتاحة:\n\n${dateList}\n\nالرجاء إدخال رقم التاريخ:`,
    fr: `✅ *${selectedTour.title}* circuit sélectionné!\n\n📅 Dates disponibles:\n\n${dateList}\n\nVeuillez entrer le numéro de date:`,
    es: `✅ *${selectedTour.title}* tour seleccionado!\n\n📅 Fechas disponibles:\n\n${dateList}\n\nPor favor, ingrese el número de fecha:`
  };

  return selectedMessages[language as keyof typeof selectedMessages] || selectedMessages.tr;
}

async function handleDateSelection(
  userMessage: string,
  state: WizardState,
  language: string
): Promise<string> {
  if (!state.selected_tour) {
    return 'Bir hata oluştu. Lütfen tekrar başlayın.';
  }

  const dates = state.selected_tour.dates || [];
  const dateNumber = parseInt(userMessage);

  if (isNaN(dateNumber) || dateNumber < 1 || dateNumber > dates.length) {
    const invalidMessages = {
      tr: 'Geçersiz tarih numarası. Lütfen listeden bir numara seçin.',
      en: 'Invalid date number. Please select a number from the list.',
      de: 'Ungültige Terminnnummer. Bitte wählen Sie eine Nummer aus der Liste.',
      ru: 'Неверный номер даты. Пожалуйста, выберите номер из списка.',
      ar: 'رقم تاريخ غير صالح. الرجاء تحديد رقم من القائمة.',
      fr: 'Numéro de date invalide. Veuillez sélectionner un numéro dans la liste.',
      es: 'Número de fecha inválido. Por favor, seleccione un número de la lista.'
    };
    return invalidMessages[language as keyof typeof invalidMessages] || invalidMessages.tr;
  }

  const selectedDate = dates[dateNumber - 1];
  state.selected_date = selectedDate;

  // Check if pax info from conversation exists
  if (state.pax_adult && state.pax_adult > 0) {
    // We already have pax info, skip to full name
    state.step = 'full_name_request';
    
    const paxMessages = {
      tr: `✅ Tarih seçildi: ${formatDate(selectedDate.departure_date, language)}\n👥 ${state.pax_adult} yetişkin${state.pax_child ? ` ve ${state.pax_child} çocuk` : ''}\n\nLütfen adınız ve soyadınızı yazın:`,
      en: `✅ Date selected: ${formatDate(selectedDate.departure_date, language)}\n👥 ${state.pax_adult} adult${state.pax_adult > 1 ? 's' : ''}${state.pax_child ? ` and ${state.pax_child} child${state.pax_child > 1 ? 'ren' : ''}` : ''}\n\nPlease enter your full name:`,
      de: `✅ Datum ausgewählt: ${formatDate(selectedDate.departure_date, language)}\n👥 ${state.pax_adult} Erwachsene${state.pax_child ? ` und ${state.pax_child} Kinder` : ''}\n\nBitte geben Sie Ihren vollständigen Namen ein:`,
      ru: `✅ Дата выбрана: ${formatDate(selectedDate.departure_date, language)}\n👥 ${state.pax_adult} взрослых${state.pax_child ? ` и ${state.pax_child} детей` : ''}\n\nПожалуйста, введите свое полное имя:`,
      ar: `✅ تم اختيار التاريخ: ${formatDate(selectedDate.departure_date, language)}\n👥 ${state.pax_adult} بالغين${state.pax_child ? ` و ${state.pax_child} أطفال` : ''}\n\nالرجاء إدخال اسمك الكامل:`,
      fr: `✅ Date sélectionnée: ${formatDate(selectedDate.departure_date, language)}\n👥 ${state.pax_adult} adulte${state.pax_adult > 1 ? 's' : ''}${state.pax_child ? ` et ${state.pax_child} enfant${state.pax_child > 1 ? 's' : ''}` : ''}\n\nVeuillez entrer votre nom complet:`,
      es: `✅ Fecha seleccionada: ${formatDate(selectedDate.departure_date, language)}\n👥 ${state.pax_adult} adulto${state.pax_adult > 1 ? 's' : ''}${state.pax_child ? ` y ${state.pax_child} niño${state.pax_child > 1 ? 's' : ''}` : ''}\n\nPor favor, ingrese su nombre completo:`
    };
    
    return paxMessages[language as keyof typeof paxMessages] || paxMessages.tr;
  }

  state.step = 'pax_selection';
  
  const paxRequestMessages = {
    tr: `✅ Tarih seçildi: ${formatDate(selectedDate.departure_date, language)}\n\n👥 Kaç yetişkin katılacak? Çocuk varsa belirtin (Örnek: 3 yetişkin 2 çocuk)`,
    en: `✅ Date selected: ${formatDate(selectedDate.departure_date, language)}\n\n👥 How many adults? Specify children if any (Example: 3 adults 2 children)`,
    de: `✅ Datum ausgewählt: ${formatDate(selectedDate.departure_date, language)}\n\n👥 Wie viele Erwachsene? Geben Sie Kinder an, falls vorhanden (Beispiel: 3 Erwachsene 2 Kinder)`,
    ru: `✅ Дата выбрана: ${formatDate(selectedDate.departure_date, language)}\n\n👥 Сколько взрослых? Укажите детей, если есть (Пример: 3 взрослых 2 детей)`,
    ar: `✅ تم اختيار التاريخ: ${formatDate(selectedDate.departure_date, language)}\n\n👥 كم عدد البالغين؟ حدد الأطفال إن وجدوا (مثال: 3 بالغين 2 أطفال)`,
    fr: `✅ Date sélectionnée: ${formatDate(selectedDate.departure_date, language)}\n\n👥 Combien d'adultes? Précisez les enfants s'il y en a (Exemple: 3 adultes 2 enfants)`,
    es: `✅ Fecha seleccionada: ${formatDate(selectedDate.departure_date, language)}\n\n👥 ¿Cuántos adultos? Especifique niños si los hay (Ejemplo: 3 adultos 2 niños)`
  };
  
  return paxRequestMessages[language as keyof typeof paxRequestMessages] || paxRequestMessages.tr;
}

async function handlePaxSelection(
  userMessage: string,
  state: WizardState,
  language: string
): Promise<string> {
  if (!state.selected_date) {
    return 'Bir hata oluştu. Lütfen tekrar başlayın.';
  }

  // Parse adults and children from message
  const adultMatch = userMessage.match(/(\d+)\s*(yetişkin|büyük|adult|adults|erwachsene|взрослых|بالغين|adulte|adultes|adulto|adultos)/i);
  const childMatch = userMessage.match(/(\d+)\s*(çocuk|child|children|kinder|детей|أطفال|enfant|enfants|niño|niños)/i);
  const peopleMatch = userMessage.match(/(\d+)\s*(kişi|person|people|personen|человек|людей|شخص|personne|personnes|persona|personas)/i);

  let adults = 0;
  let children = 0;

  if (adultMatch) {
    adults = parseInt(adultMatch[1]);
  } else if (peopleMatch) {
    adults = parseInt(peopleMatch[1]);
  } else {
    // Try to parse just a number
    const numMatch = userMessage.match(/\d+/);
    if (numMatch) {
      adults = parseInt(numMatch[0]);
    }
  }

  if (childMatch) {
    children = parseInt(childMatch[1]);
  }

  if (adults < 1) {
    const invalidMessages = {
      tr: 'En az 1 yetişkin olmalı. Lütfen yeniden yazın (Örnek: 3 yetişkin 2 çocuk)',
      en: 'At least 1 adult required. Please try again (Example: 3 adults 2 children)',
      de: 'Mindestens 1 Erwachsener erforderlich. Bitte versuchen Sie es erneut (Beispiel: 3 Erwachsene 2 Kinder)',
      ru: 'Требуется минимум 1 взрослый. Пожалуйста, попробуйте еще раз (Пример: 3 взрослых 2 детей)',
      ar: 'مطلوب بالغ واحد على الأقل. الرجاء المحاولة مرة أخرى (مثال: 3 بالغين 2 أطفال)',
      fr: 'Au moins 1 adulte requis. Veuillez réessayer (Exemple: 3 adultes 2 enfants)',
      es: 'Se requiere al menos 1 adulto. Por favor, inténtelo de nuevo (Ejemplo: 3 adultos 2 niños)'
    };
    return invalidMessages[language as keyof typeof invalidMessages] || invalidMessages.tr;
  }

  state.pax_adult = adults;
  state.pax_child = children > 0 ? children : undefined;
  state.step = 'full_name_request';

  const totalPax = adults + children;
  const priceAdult = state.selected_date.price_adult * adults;
  const priceChild = children > 0 ? (state.selected_date.price_child || state.selected_date.price_adult * 0.8) * children : 0;
  const totalPrice = priceAdult + priceChild;

  const paxSummary = {
    tr: `✅ ${adults} yetişkin${children > 0 ? ` ve ${children} çocuk` : ''}\n💰 Toplam fiyat: ${formatPrice(totalPrice, state.selected_tour.currency, language)}\n\nLütfen adınız ve soyadınızı yazın:`,
    en: `✅ ${adults} adult${adults > 1 ? 's' : ''}${children > 0 ? ` and ${children} child${children > 1 ? 'ren' : ''}` : ''}\n💰 Total price: ${formatPrice(totalPrice, state.selected_tour.currency, language)}\n\nPlease enter your full name:`,
    de: `✅ ${adults} Erwachsene${children > 0 ? ` und ${children} Kinder` : ''}\n💰 Gesamtpreis: ${formatPrice(totalPrice, state.selected_tour.currency, language)}\n\nBitte geben Sie Ihren vollständigen Namen ein:`,
    ru: `✅ ${adults} взрослых${children > 0 ? ` и ${children} детей` : ''}\n💰 Общая стоимость: ${formatPrice(totalPrice, state.selected_tour.currency, language)}\n\nПожалуйста, введите свое полное имя:`,
    ar: `✅ ${adults} بالغين${children > 0 ? ` و ${children} أطفال` : ''}\n💰 السعر الإجمالي: ${formatPrice(totalPrice, state.selected_tour.currency, language)}\n\nالرجاء إدخال اسمك الكامل:`,
    fr: `✅ ${adults} adulte${adults > 1 ? 's' : ''}${children > 0 ? ` et ${children} enfant${children > 1 ? 's' : ''}` : ''}\n💰 Prix total: ${formatPrice(totalPrice, state.selected_tour.currency, language)}\n\nVeuillez entrer votre nom complet:`,
    es: `✅ ${adults} adulto${adults > 1 ? 's' : ''}${children > 0 ? ` y ${children} niño${children > 1 ? 's' : ''}` : ''}\n💰 Precio total: ${formatPrice(totalPrice, state.selected_tour.currency, language)}\n\nPor favor, ingrese su nombre completo:`
  };

  return paxSummary[language as keyof typeof paxSummary] || paxSummary.tr;
}

async function handleFullNameRequest(
  userMessage: string,
  state: WizardState,
  language: string
): Promise<string> {
  const name = userMessage.trim();
  
  if (name.length < 3) {
    const invalidMessages = {
      tr: 'Lütfen tam adınızı ve soyadınızı yazın.',
      en: 'Please enter your full name.',
      de: 'Bitte geben Sie Ihren vollständigen Namen ein.',
      ru: 'Пожалуйста, введите свое полное имя.',
      ar: 'الرجاء إدخال اسمك الكامل.',
      fr: 'Veuillez entrer votre nom complet.',
      es: 'Por favor, ingrese su nombre completo.'
    };
    return invalidMessages[language as keyof typeof invalidMessages] || invalidMessages.tr;
  }

  state.full_name = name;
  state.step = 'special_requests';

  const requestMessages = {
    tr: `✅ Teşekkürler ${name}!\n\n📝 Özel bir isteğiniz var mı? (Örn: Diyet, erişilebilirlik vb.)\n\n"Hayır" yazabilir veya isteğinizi belirtebilirsiniz.`,
    en: `✅ Thank you ${name}!\n\n📝 Any special requests? (E.g., dietary, accessibility, etc.)\n\nYou can write "No" or specify your request.`,
    de: `✅ Danke ${name}!\n\n📝 Besondere Wünsche? (Z.B. Ernährung, Barrierefreiheit usw.)\n\nSie können "Nein" schreiben oder Ihren Wunsch angeben.`,
    ru: `✅ Спасибо ${name}!\n\n📝 Есть особые пожелания? (Например, диета, доступность и т.д.)\n\nВы можете написать "Нет" или указать свой запрос.`,
    ar: `✅ شكراً لك ${name}!\n\n📝 هل لديك أي طلبات خاصة؟ (مثل: نظام غذائي، إمكانية الوصول، إلخ.)\n\nيمكنك كتابة "لا" أو تحديد طلبك.`,
    fr: `✅ Merci ${name}!\n\n📝 Des demandes particulières? (Par exemple : alimentation, accessibilité, etc.)\n\nVous pouvez écrire "Non" ou préciser votre demande.`,
    es: `✅ Gracias ${name}!\n\n📝 ¿Alguna solicitud especial? (Por ejemplo: dieta, accesibilidad, etc.)\n\nPuede escribir "No" o especificar su solicitud.`
  };

  return requestMessages[language as keyof typeof requestMessages] || requestMessages.tr;
}

async function handleSpecialRequests(
  userMessage: string,
  state: WizardState,
  language: string
): Promise<string> {
  const request = userMessage.trim();
  const noKeywords = ['hayır', 'yok', 'no', 'nein', 'нет', 'لا', 'non'];
  
  if (!noKeywords.some(k => request.toLowerCase() === k)) {
    state.special_requests = request;
  }

  state.step = 'confirmation';

  // Calculate total price
  const adults = state.pax_adult || 1;
  const children = state.pax_child || 0;
  const priceAdult = (state.selected_date?.price_adult || 0) * adults;
  const priceChild = children > 0 ? ((state.selected_date?.price_child || state.selected_date?.price_adult * 0.8) || 0) * children : 0;
  const totalPrice = priceAdult + priceChild;

  const summaryMessages = {
    tr: `🎉 *REZERVASYON DEMO*\n\n📋 *Özet*\n━━━━━━━━━━━━━━━━━━━━\n\n🎫 *Tur:* ${state.selected_tour?.title}\n📅 *Tarih:* ${formatDate(state.selected_date?.departure_date, language)}\n👥 *Katılımcı:* ${adults} yetişkin${children > 0 ? `, ${children} çocuk` : ''}\n👤 *Ad Soyad:* ${state.full_name}\n${state.special_requests ? `📝 *Özel İstek:* ${state.special_requests}\n` : ''}💰 *Toplam Fiyat:* ${formatPrice(totalPrice, state.selected_tour?.currency, language)}\n\n━━━━━━━━━━━━━━━━━━━━\n\n✅ Bu bir demo rezervasyondur - gerçek kayıt oluşturulmaz.\n\n💬 Gerçek WhatsApp entegrasyonunda, acente yetkilisi sizinle iletişime geçecektir.\n\n🔄 Başka bir tur için "turlar" yazabilirsiniz.`,
    en: `🎉 *DEMO RESERVATION*\n\n📋 *Summary*\n━━━━━━━━━━━━━━━━━━━━\n\n🎫 *Tour:* ${state.selected_tour?.title}\n📅 *Date:* ${formatDate(state.selected_date?.departure_date, language)}\n👥 *Participants:* ${adults} adult${adults > 1 ? 's' : ''}${children > 0 ? `, ${children} child${children > 1 ? 'ren' : ''}` : ''}\n👤 *Full Name:* ${state.full_name}\n${state.special_requests ? `📝 *Special Request:* ${state.special_requests}\n` : ''}💰 *Total Price:* ${formatPrice(totalPrice, state.selected_tour?.currency, language)}\n\n━━━━━━━━━━━━━━━━━━━━\n\n✅ This is a demo reservation - no actual booking is created.\n\n💬 In the real WhatsApp integration, an agency representative will contact you.\n\n🔄 You can type "tours" for another tour.`,
    de: `🎉 *DEMO-RESERVIERUNG*\n\n📋 *Zusammenfassung*\n━━━━━━━━━━━━━━━━━━━━\n\n🎫 *Tour:* ${state.selected_tour?.title}\n📅 *Datum:* ${formatDate(state.selected_date?.departure_date, language)}\n👥 *Teilnehmer:* ${adults} Erwachsene${children > 0 ? `, ${children} Kinder` : ''}\n👤 *Vollständiger Name:* ${state.full_name}\n${state.special_requests ? `📝 *Besondere Wünsche:* ${state.special_requests}\n` : ''}💰 *Gesamtpreis:* ${formatPrice(totalPrice, state.selected_tour?.currency, language)}\n\n━━━━━━━━━━━━━━━━━━━━\n\n✅ Dies ist eine Demo-Reservierung - es wird keine echte Buchung erstellt.\n\n💬 In der echten WhatsApp-Integration wird sich ein Agenturvertreter mit Ihnen in Verbindung setzen.\n\n🔄 Sie können "tours" für eine andere Tour eingeben.`,
    ru: `🎉 *ДЕМО-БРОНИРОВАНИЕ*\n\n📋 *Сводка*\n━━━━━━━━━━━━━━━━━━━━\n\n🎫 *Тур:* ${state.selected_tour?.title}\n📅 *Дата:* ${formatDate(state.selected_date?.departure_date, language)}\n👥 *Участники:* ${adults} взрослых${children > 0 ? `, ${children} детей` : ''}\n👤 *Полное имя:* ${state.full_name}\n${state.special_requests ? `📝 *Особые пожелания:* ${state.special_requests}\n` : ''}💰 *Общая стоимость:* ${formatPrice(totalPrice, state.selected_tour?.currency, language)}\n\n━━━━━━━━━━━━━━━━━━━━\n\n✅ Это демо-бронирование - реальное бронирование не создается.\n\n💬 В реальной интеграции WhatsApp представитель агентства свяжется с вами.\n\n🔄 Вы можете написать "tours" для другого тура.`,
    ar: `🎉 *حجز تجريبي*\n\n📋 *ملخص*\n━━━━━━━━━━━━━━━━━━━━\n\n🎫 *الجولة:* ${state.selected_tour?.title}\n📅 *التاريخ:* ${formatDate(state.selected_date?.departure_date, language)}\n👥 *المشاركون:* ${adults} بالغين${children > 0 ? `، ${children} أطفال` : ''}\n👤 *الاسم الكامل:* ${state.full_name}\n${state.special_requests ? `📝 *طلب خاص:* ${state.special_requests}\n` : ''}💰 *السعر الإجمالي:* ${formatPrice(totalPrice, state.selected_tour?.currency, language)}\n\n━━━━━━━━━━━━━━━━━━━━\n\n✅ هذا حجز تجريبي - لا يتم إنشاء حجز فعلي.\n\n💬 في تكامل WhatsApp الحقيقي، سيتصل بك ممثل الوكالة.\n\n🔄 يمكنك كتابة "tours" لجولة أخرى.`,
    fr: `🎉 *RÉSERVATION DÉMO*\n\n📋 *Résumé*\n━━━━━━━━━━━━━━━━━━━━\n\n🎫 *Circuit:* ${state.selected_tour?.title}\n📅 *Date:* ${formatDate(state.selected_date?.departure_date, language)}\n👥 *Participants:* ${adults} adulte${adults > 1 ? 's' : ''}${children > 0 ? `, ${children} enfant${children > 1 ? 's' : ''}` : ''}\n👤 *Nom complet:* ${state.full_name}\n${state.special_requests ? `📝 *Demande spéciale:* ${state.special_requests}\n` : ''}💰 *Prix total:* ${formatPrice(totalPrice, state.selected_tour?.currency, language)}\n\n━━━━━━━━━━━━━━━━━━━━\n\n✅ Ceci est une réservation de démonstration - aucune réservation réelle n'est créée.\n\n💬 Dans l'intégration WhatsApp réelle, un représentant de l'agence vous contactera.\n\n🔄 Vous pouvez taper "tours" pour un autre circuit.`,
    es: `🎉 *RESERVA DEMO*\n\n📋 *Resumen*\n━━━━━━━━━━━━━━━━━━━━\n\n🎫 *Tour:* ${state.selected_tour?.title}\n📅 *Fecha:* ${formatDate(state.selected_date?.departure_date, language)}\n👥 *Participantes:* ${adults} adulto${adults > 1 ? 's' : ''}${children > 0 ? `, ${children} niño${children > 1 ? 's' : ''}` : ''}\n👤 *Nombre completo:* ${state.full_name}\n${state.special_requests ? `📝 *Solicitud especial:* ${state.special_requests}\n` : ''}💰 *Precio total:* ${formatPrice(totalPrice, state.selected_tour?.currency, language)}\n\n━━━━━━━━━━━━━━━━━━━━\n\n✅ Esta es una reserva de demostración - no se crea una reserva real.\n\n💬 En la integración real de WhatsApp, un representante de la agencia se pondrá en contacto con usted.\n\n🔄 Puede escribir "tours" para otro tour.`
  };

  return summaryMessages[language as keyof typeof summaryMessages] || summaryMessages.tr;
}

async function handleConfirmation(
  userMessage: string,
  state: WizardState,
  language: string
): Promise<string> {
  // This step is just confirmation display, user can continue chatting normally
  const confirmMessages = {
    tr: 'Demo tamamlandı! Başka bir konuda yardımcı olabilir miyim?',
    en: 'Demo completed! Can I help you with anything else?',
    de: 'Demo abgeschlossen! Kann ich Ihnen bei etwas anderem helfen?',
    ru: 'Демо завершено! Могу ли я помочь вам с чем-то еще?',
    ar: 'اكتمل العرض التوضيحي! هل يمكنني مساعدتك في أي شيء آخر؟',
    fr: 'Démo terminée! Puis-je vous aider avec autre chose?',
    es: 'Demo completada! ¿Puedo ayudarte con algo más?'
  };
  return confirmMessages[language as keyof typeof confirmMessages] || confirmMessages.tr;
}
