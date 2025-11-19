// Generate payment instructions message based on agency settings

export function generatePaymentMessage(
  paymentInstructions: any,
  language: string,
  totalPrice: number,
  depositAmount: number
): string {
  if (!paymentInstructions || !paymentInstructions.payment_methods || paymentInstructions.payment_methods.length === 0) {
    return '';
  }

  const methods = paymentInstructions.payment_methods;
  const paymentType = paymentInstructions.payment_type || 'deposit';
  const depositPercentage = paymentInstructions.deposit_percentage || 30;
  
  const labels: any = {
    tr: {
      title: '💳 ÖDEME BİLGİLERİ',
      paymentType: paymentType === 'deposit' ? `Kapora (%${depositPercentage})` : 'Tam Ödeme',
      depositAmount: `Kapora Tutarı: ${depositAmount}₺`,
      remainingAmount: `Kalan Tutar: ${totalPrice - depositAmount}₺ (Tur gününde)`,
      fullAmount: `Ödeme Tutarı: ${totalPrice}₺`,
      methods: 'Ödeme Yöntemleriniz:',
      bankTransfer: '🏦 Havale/EFT:',
      cashOffice: '💵 Ofiste Nakit:',
      cashOnTour: '💵 Araçta/Tur Günü Nakit:',
      creditCard: '💳 Kredi Kartı:',
      bankName: 'Banka:',
      iban: 'IBAN:',
      accountHolder: 'Hesap Sahibi:',
      officeAddress: 'Adres:',
      workingHours: 'Çalışma Saatleri:',
      phone: 'Telefon:',
      tourDay: 'Tur günü araçta rehberimize ödeme yapabilirsiniz',
      phonePayment: 'Telefon ile güvenli ödeme yapabilirsiniz',
      note: '📌 Not:'
    },
    en: {
      title: '💳 PAYMENT INFORMATION',
      paymentType: paymentType === 'deposit' ? `Deposit (${depositPercentage}%)` : 'Full Payment',
      depositAmount: `Deposit Amount: ${depositAmount}₺`,
      remainingAmount: `Remaining Amount: ${totalPrice - depositAmount}₺ (On tour day)`,
      fullAmount: `Payment Amount: ${totalPrice}₺`,
      methods: 'Payment Methods:',
      bankTransfer: '🏦 Bank Transfer:',
      cashOffice: '💵 Cash at Office:',
      cashOnTour: '💵 Cash on Tour / In Vehicle:',
      creditCard: '💳 Credit Card:',
      bankName: 'Bank:',
      iban: 'IBAN:',
      accountHolder: 'Account Holder:',
      officeAddress: 'Address:',
      workingHours: 'Working Hours:',
      phone: 'Phone:',
      tourDay: 'You can pay to our guide in the vehicle on tour day',
      phonePayment: 'You can make a secure payment by phone',
      note: '📌 Note:'
    },
    de: {
      title: '💳 ZAHLUNGSINFORMATIONEN',
      paymentType: paymentType === 'deposit' ? `Anzahlung (${depositPercentage}%)` : 'Vollzahlung',
      depositAmount: `Anzahlungsbetrag: ${depositAmount}₺`,
      remainingAmount: `Restbetrag: ${totalPrice - depositAmount}₺ (Am Tourtag)`,
      fullAmount: `Zahlungsbetrag: ${totalPrice}₺`,
      methods: 'Zahlungsmethoden:',
      bankTransfer: '🏦 Banküberweisung:',
      cashOffice: '💵 Bargeld im Büro:',
      cashOnTour: '💵 Bargeld im Fahrzeug/Tourtag:',
      creditCard: '💳 Kreditkarte:',
      bankName: 'Bank:',
      iban: 'IBAN:',
      accountHolder: 'Kontoinhaber:',
      officeAddress: 'Adresse:',
      workingHours: 'Öffnungszeiten:',
      phone: 'Telefon:',
      tourDay: 'Sie können am Tourtag im Fahrzeug an unseren Reiseführer zahlen',
      phonePayment: 'Sie können telefonisch sicher bezahlen',
      note: '📌 Hinweis:'
    },
    ru: {
      title: '💳 ИНФОРМАЦИЯ ОБ ОПЛАТЕ',
      paymentType: paymentType === 'deposit' ? `Депозит (${depositPercentage}%)` : 'Полная оплата',
      depositAmount: `Сумма депозита: ${depositAmount}₺`,
      remainingAmount: `Остаток: ${totalPrice - depositAmount}₺ (В день тура)`,
      fullAmount: `Сумма оплаты: ${totalPrice}₺`,
      methods: 'Способы оплаты:',
      bankTransfer: '🏦 Банковский перевод:',
      cashOffice: '💵 Наличные в офисе:',
      cashOnTour: '💵 Наличные в автобусе/День тура:',
      creditCard: '💳 Кредитная карта:',
      bankName: 'Банк:',
      iban: 'IBAN:',
      accountHolder: 'Владелец счета:',
      officeAddress: 'Адрес:',
      workingHours: 'Часы работы:',
      phone: 'Телефон:',
      tourDay: 'Вы можете заплатить нашему гиду в автобусе в день тура',
      phonePayment: 'Вы можете совершить безопасный платеж по телефону',
      note: '📌 Примечание:'
    },
    fr: {
      title: '💳 INFORMATIONS DE PAIEMENT',
      paymentType: paymentType === 'deposit' ? `Acompte (${depositPercentage}%)` : 'Paiement complet',
      depositAmount: `Montant de l'acompte: ${depositAmount}₺`,
      remainingAmount: `Montant restant: ${totalPrice - depositAmount}₺ (Le jour de la visite)`,
      fullAmount: `Montant du paiement: ${totalPrice}₺`,
      methods: 'Méthodes de paiement:',
      bankTransfer: '🏦 Virement bancaire:',
      cashOffice: '💵 Espèces au bureau:',
      cashOnTour: '💵 Espèces dans le véhicule/Jour de visite:',
      creditCard: '💳 Carte de crédit:',
      bankName: 'Banque:',
      iban: 'IBAN:',
      accountHolder: 'Titulaire du compte:',
      officeAddress: 'Adresse:',
      workingHours: 'Horaires d\'ouverture:',
      phone: 'Téléphone:',
      tourDay: 'Vous pouvez payer notre guide dans le véhicule le jour de la visite',
      phonePayment: 'Vous pouvez effectuer un paiement sécurisé par téléphone',
      note: '📌 Remarque:'
    },
    es: {
      title: '💳 INFORMACIÓN DE PAGO',
      paymentType: paymentType === 'deposit' ? `Depósito (${depositPercentage}%)` : 'Pago completo',
      depositAmount: `Monto del depósito: ${depositAmount}₺`,
      remainingAmount: `Monto restante: ${totalPrice - depositAmount}₺ (El día del tour)`,
      fullAmount: `Monto del pago: ${totalPrice}₺`,
      methods: 'Métodos de pago:',
      bankTransfer: '🏦 Transferencia bancaria:',
      cashOffice: '💵 Efectivo en oficina:',
      cashOnTour: '💵 Efectivo en vehículo/Día del tour:',
      creditCard: '💳 Tarjeta de crédito:',
      bankName: 'Banco:',
      iban: 'IBAN:',
      accountHolder: 'Titular de la cuenta:',
      officeAddress: 'Dirección:',
      workingHours: 'Horario:',
      phone: 'Teléfono:',
      tourDay: 'Puede pagar a nuestro guía en el vehículo el día del tour',
      phonePayment: 'Puede realizar un pago seguro por teléfono',
      note: '📌 Nota:'
    },
    ar: {
      title: '💳 معلومات الدفع',
      paymentType: paymentType === 'deposit' ? `عربون (${depositPercentage}%)` : 'الدفع الكامل',
      depositAmount: `مبلغ العربون: ${depositAmount}₺`,
      remainingAmount: `المبلغ المتبقي: ${totalPrice - depositAmount}₺ (يوم الجولة)`,
      fullAmount: `مبلغ الدفع: ${totalPrice}₺`,
      methods: 'طرق الدفع:',
      bankTransfer: '🏦 تحويل بنكي:',
      cashOffice: '💵 نقداً في المكتب:',
      cashOnTour: '💵 نقداً في الحافلة/يوم الجولة:',
      creditCard: '💳 بطاقة ائتمان:',
      bankName: 'البنك:',
      iban: 'رقم الحساب:',
      accountHolder: 'صاحب الحساب:',
      officeAddress: 'العنوان:',
      workingHours: 'ساعات العمل:',
      phone: 'الهاتف:',
      tourDay: 'يمكنك الدفع لمرشدنا في الحافلة يوم الجولة',
      phonePayment: 'يمكنك إجراء دفع آمن عبر الهاتف',
      note: '📌 ملاحظة:'
    }
  };

  const lang = labels[language] || labels.tr;
  const bankInfo = paymentInstructions.bank_info?.[language] || paymentInstructions.bank_info?.tr || {};

  let message = `\n\n${lang.title}\n\n`;
  
  // Payment amount section
  if (paymentType === 'deposit') {
    message += `${lang.paymentType}\n${lang.depositAmount}\n${lang.remainingAmount}\n\n`;
  } else {
    message += `${lang.paymentType}\n${lang.fullAmount}\n\n`;
  }

  // Payment methods
  message += `${lang.methods}\n\n`;

  // Bank Transfer
  if (methods.includes('bank_transfer')) {
    message += `${lang.bankTransfer}\n`;
    if (bankInfo.bank_name) message += `${lang.bankName} ${bankInfo.bank_name}\n`;
    if (bankInfo.iban) message += `${lang.iban} ${bankInfo.iban}\n`;
    if (bankInfo.account_holder) message += `${lang.accountHolder} ${bankInfo.account_holder}\n`;
    message += '\n';
  }

  // Cash at Office
  if (methods.includes('cash_office')) {
    message += `${lang.cashOffice}\n`;
    if (paymentInstructions.office_address) message += `${lang.officeAddress} ${paymentInstructions.office_address}\n`;
    if (paymentInstructions.working_hours) message += `${lang.workingHours} ${paymentInstructions.working_hours}\n`;
    message += '\n';
  }

  // Cash on Tour
  if (methods.includes('cash_on_tour')) {
    message += `${lang.cashOnTour}\n`;
    message += `${lang.tourDay}\n\n`;
  }

  // Credit Card
  if (methods.includes('credit_card')) {
    message += `${lang.creditCard}\n`;
    if (paymentInstructions.phone_number) message += `${lang.phone} ${paymentInstructions.phone_number}\n`;
    message += `${lang.phonePayment}\n`;
  }

  return message;
}
