// Canned responses (quick replies) service

export const cannedResponses: Record<string, Record<string, string>> = {
  // Greeting responses
  welcome: {
    tr: 'Merhaba! 👋 Turzz\'e hoş geldiniz! Size nasıl yardımcı olabilirim?',
    en: 'Hello! 👋 Welcome to Turzz! How can I help you?',
    de: 'Hallo! 👋 Willkommen bei Turzz! Wie kann ich Ihnen helfen?',
    ru: 'Здравствуйте! 👋 Добро пожаловать в Turzz! Как я могу вам помочь?',
    ar: 'مرحبا! 👋 مرحبًا بك في Turzz! كيف يمكنني مساعدتك؟',
    fr: 'Bonjour! 👋 Bienvenue chez Turzz! Comment puis-je vous aider?',
    es: '¡Hola! 👋 ¡Bienvenido a Turzz! ¿Cómo puedo ayudarte?'
  },
  
  // Common questions
  hours: {
    tr: '⏰ Çalışma saatlerimiz:\nPazartesi-Cuma: 09:00-18:00\nCumartesi: 10:00-16:00\nPazar: Kapalı',
    en: '⏰ Working hours:\nMonday-Friday: 09:00-18:00\nSaturday: 10:00-16:00\nSunday: Closed',
    de: '⏰ Öffnungszeiten:\nMontag-Freitag: 09:00-18:00\nSamstag: 10:00-16:00\nSonntag: Geschlossen',
    ru: '⏰ Часы работы:\nПонедельник-Пятница: 09:00-18:00\nСуббота: 10:00-16:00\nВоскресенье: Закрыто',
    ar: '⏰ ساعات العمل:\nالاثنين-الجمعة: 09:00-18:00\nالسبت: 10:00-16:00\nالأحد: مغلق',
    fr: '⏰ Heures d\'ouverture:\nLundi-Vendredi: 09:00-18:00\nSamedi: 10:00-16:00\nDimanche: Fermé',
    es: '⏰ Horario:\nLunes-Viernes: 09:00-18:00\nSábado: 10:00-16:00\nDomingo: Cerrado'
  },
  
  payment_methods: {
    tr: '💳 Ödeme yöntemlerimiz:\n✅ Kredi/Banka Kartı\n✅ Havale/EFT\n✅ Kapıda Ödeme\n✅ Taksit İmkanı',
    en: '💳 Payment methods:\n✅ Credit/Debit Card\n✅ Bank Transfer\n✅ Cash on Tour\n✅ Installment Options',
    de: '💳 Zahlungsmethoden:\n✅ Kreditkarte\n✅ Banküberweisung\n✅ Barzahlung vor Ort\n✅ Ratenzahlung',
    ru: '💳 Способы оплаты:\n✅ Кредитная карта\n✅ Банковский перевод\n✅ Наличные\n✅ Рассрочка',
    ar: '💳 طرق الدفع:\n✅ بطاقة ائتمان\n✅ تحويل بنكي\n✅ الدفع نقدًا\n✅ خيارات التقسيط',
    fr: '💳 Méthodes de paiement:\n✅ Carte de crédit\n✅ Virement bancaire\n✅ Espèces\n✅ Options de paiement échelonné',
    es: '💳 Métodos de pago:\n✅ Tarjeta de crédito\n✅ Transferencia bancaria\n✅ Efectivo\n✅ Opciones de cuotas'
  },
  
  cancellation_policy: {
    tr: '🔄 İptal Politikası:\n• 7+ gün öncesi: %100 iade\n• 3-7 gün: %50 iade\n• 3 günden az: İade yok\n\nDetaylı bilgi için sözleşmeyi inceleyin.',
    en: '🔄 Cancellation Policy:\n• 7+ days before: 100% refund\n• 3-7 days: 50% refund\n• Less than 3 days: No refund\n\nCheck contract for details.',
    de: '🔄 Stornierungsbedingungen:\n• 7+ Tage vorher: 100% Rückerstattung\n• 3-7 Tage: 50% Rückerstattung\n• Weniger als 3 Tage: Keine Rückerstattung\n\nVertrag für Details prüfen.',
    ru: '🔄 Условия отмены:\n• 7+ дней: 100% возврат\n• 3-7 дней: 50% возврат\n• Менее 3 дней: Без возврата\n\nПодробности в договоре.',
    ar: '🔄 سياسة الإلغاء:\n• 7+ أيام قبل: استرداد 100٪\n• 3-7 أيام: استرداد 50٪\n• أقل من 3 أيام: لا استرداد\n\nتحقق من العقد للتفاصيل.',
    fr: '🔄 Politique d\'annulation:\n• 7+ jours avant: remboursement à 100%\n• 3-7 jours: remboursement à 50%\n• Moins de 3 jours: Pas de remboursement\n\nVérifiez le contrat pour plus de détails.',
    es: '🔄 Política de cancelación:\n• 7+ días antes: reembolso del 100%\n• 3-7 días: reembolso del 50%\n• Menos de 3 días: Sin reembolso\n\nConsulte el contrato para más detalles.'
  },
  
  what_to_bring: {
    tr: '🎒 Yanınıza alınması gerekenler:\n✅ Kimlik/Pasaport\n✅ Rahat ayakkabı\n✅ Güneş kremi\n✅ Su\n✅ Kamera\n✅ İlaçlar (kişisel)',
    en: '🎒 What to bring:\n✅ ID/Passport\n✅ Comfortable shoes\n✅ Sunscreen\n✅ Water\n✅ Camera\n✅ Medications (personal)',
    de: '🎒 Was mitzubringen ist:\n✅ Ausweis/Reisepass\n✅ Bequeme Schuhe\n✅ Sonnencreme\n✅ Wasser\n✅ Kamera\n✅ Medikamente (persönlich)',
    ru: '🎒 Что взять с собой:\n✅ Удостоверение/Паспорт\n✅ Удобная обувь\n✅ Солнцезащитный крем\n✅ Вода\n✅ Камера\n✅ Лекарства (личные)',
    ar: '🎒 ما يجب إحضاره:\n✅ الهوية/جواز السفر\n✅ أحذية مريحة\n✅ واقي الشمس\n✅ ماء\n✅ كاميرا\n✅ أدوية (شخصية)',
    fr: '🎒 Ce qu\'il faut apporter:\n✅ Carte d\'identité/Passeport\n✅ Chaussures confortables\n✅ Crème solaire\n✅ Eau\n✅ Appareil photo\n✅ Médicaments (personnels)',
    es: '🎒 Qué llevar:\n✅ Identificación/Pasaporte\n✅ Zapatos cómodos\n✅ Protector solar\n✅ Agua\n✅ Cámara\n✅ Medicamentos (personales)'
  },
  
  group_discount: {
    tr: '👥 Grup İndirimleri:\n• 10+ kişi: %10 indirim\n• 20+ kişi: %15 indirim\n• 30+ kişi: %20 indirim\n\nDetaylar için bizi arayın!',
    en: '👥 Group Discounts:\n• 10+ people: 10% off\n• 20+ people: 15% off\n• 30+ people: 20% off\n\nCall us for details!',
    de: '👥 Gruppenrabatte:\n• 10+ Personen: 10% Rabatt\n• 20+ Personen: 15% Rabatt\n• 30+ Personen: 20% Rabatt\n\nRufen Sie uns für Details an!',
    ru: '👥 Групповые скидки:\n• 10+ человек: скидка 10%\n• 20+ человек: скидка 15%\n• 30+ человек: скидка 20%\n\nЗвоните для подробностей!',
    ar: '👥 خصومات المجموعات:\n• 10+ أشخاص: خصم 10٪\n• 20+ أشخاص: خصم 15٪\n• 30+ أشخاص: خصم 20٪\n\nاتصل بنا للتفاصيل!',
    fr: '👥 Réductions de groupe:\n• 10+ personnes: 10% de réduction\n• 20+ personnes: 15% de réduction\n• 30+ personnes: 20% de réduction\n\nAppelez-nous pour plus de détails!',
    es: '👥 Descuentos grupales:\n• 10+ personas: 10% de descuento\n• 20+ personas: 15% de descuento\n• 30+ personas: 20% de descuento\n\n¡Llámenos para más detalles!'
  },
  
  contact_info: {
    tr: '📞 İletişim Bilgileri:\n📱 Telefon: +90 XXX XXX XX XX\n📧 Email: info@turzzai.com\n🌐 Web: turzzai.com\n📍 Adres: [Adres buraya]',
    en: '📞 Contact Information:\n📱 Phone: +90 XXX XXX XX XX\n📧 Email: info@turzzai.com\n🌐 Web: turzzai.com\n📍 Address: [Address here]',
    de: '📞 Kontaktinformationen:\n📱 Telefon: +90 XXX XXX XX XX\n📧 E-Mail: info@turzzai.com\n🌐 Web: turzzai.com\n📍 Adresse: [Adresse hier]',
    ru: '📞 Контактная информация:\n📱 Телефон: +90 XXX XXX XX XX\n📧 Email: info@turzzai.com\n🌐 Веб: turzzai.com\n📍 Адрес: [Адрес здесь]',
    ar: '📞 معلومات الاتصال:\n📱 الهاتف: +90 XXX XXX XX XX\n📧 البريد الإلكتروني: info@turzzai.com\n🌐 الموقع: turzzai.com\n📍 العنوان: [العنوان هنا]',
    fr: '📞 Coordonnées:\n📱 Téléphone: +90 XXX XXX XX XX\n📧 Email: info@turzzai.com\n🌐 Web: turzzai.com\n📍 Adresse: [Adresse ici]',
    es: '📞 Información de contacto:\n📱 Teléfono: +90 XXX XXX XX XX\n📧 Email: info@turzzai.com\n🌐 Web: turzzai.com\n📍 Dirección: [Dirección aquí]'
  }
};

export function getCannedResponse(key: string, language: string = 'tr'): string | null {
  return cannedResponses[key]?.[language] || cannedResponses[key]?.['tr'] || null;
}

export function detectCannedResponseTrigger(message: string, language: string = 'tr'): string | null {
  const lowerMessage = message.toLowerCase().trim();
  
  const triggers: Record<string, string[]> = {
    hours: ['çalışma saatleri', 'açık mısınız', 'ne zaman açık', 'working hours', 'opening hours', 'öffnungszeiten'],
    payment_methods: ['ödeme', 'nasıl öderim', 'kredi kartı', 'payment', 'zahlung', 'оплата'],
    cancellation_policy: ['iptal', 'iade', 'cancellation', 'refund', 'stornierung', 'отмена'],
    what_to_bring: ['ne götürmeli', 'yanımda ne olmalı', 'what to bring', 'was mitbringen', 'что взять'],
    group_discount: ['grup', 'toplu', 'indirim', 'group', 'discount', 'gruppenrabatt', 'скидка'],
    contact_info: ['iletişim', 'telefon', 'adres', 'contact', 'kontakt', 'контакт']
  };
  
  for (const [key, keywords] of Object.entries(triggers)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return key;
    }
  }
  
  return null;
}
