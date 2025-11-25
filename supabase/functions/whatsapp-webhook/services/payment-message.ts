// Generate payment instructions message based on agency settings

// Modular currency formatting
interface CurrencyConfig {
  code: string;
  symbol: string;
  locale: string;
  decimals: number;
}

const CURRENCIES: Record<string, CurrencyConfig> = {
  TRY: { code: 'TRY', symbol: '₺', locale: 'tr-TR', decimals: 0 },
  USD: { code: 'USD', symbol: '$', locale: 'en-US', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE', decimals: 2 },
  SAR: { code: 'SAR', symbol: 'ر.س', locale: 'ar-SA', decimals: 2 },
};

const getCurrency = (code: string): CurrencyConfig => {
  return CURRENCIES[code] || CURRENCIES.TRY;
};

function formatPrice(amount: number, currencyCode: string = 'TRY'): string {
  const currency = getCurrency(currencyCode);
  const formatted = new Intl.NumberFormat(currency.locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals
  }).format(amount);
  return `${formatted} ${currency.code}`;
}

export function generatePaymentMessage(
  paymentInstructions: any,
  language: string,
  totalPrice: number,
  depositAmount: number,
  currencyCode: string = 'TRY'
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
      depositAmount: `Kapora Tutarı: ${formatPrice(depositAmount, currencyCode)}`,
      remainingAmount: `Kalan Tutar: ${formatPrice(totalPrice - depositAmount, currencyCode)} (Tur gününde)`,
      fullAmount: `Ödeme Tutarı: ${formatPrice(totalPrice, currencyCode)}`,
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
      depositAmount: `Deposit Amount: ${formatPrice(depositAmount, currencyCode)}`,
      remainingAmount: `Remaining Amount: ${formatPrice(totalPrice - depositAmount, currencyCode)} (On tour day)`,
      fullAmount: `Payment Amount: ${formatPrice(totalPrice, currencyCode)}`,
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
      depositAmount: `Anzahlungsbetrag: ${formatPrice(depositAmount, currencyCode)}`,
      remainingAmount: `Restbetrag: ${formatPrice(totalPrice - depositAmount, currencyCode)} (Am Tourtag)`,
      fullAmount: `Zahlungsbetrag: ${formatPrice(totalPrice, currencyCode)}`,
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
      depositAmount: `Сумма депозита: ${formatPrice(depositAmount, currencyCode)}`,
      remainingAmount: `Остаток: ${formatPrice(totalPrice - depositAmount, currencyCode)} (В день тура)`,
      fullAmount: `Сумма оплаты: ${formatPrice(totalPrice, currencyCode)}`,
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
      depositAmount: `Montant de l'acompte: ${formatPrice(depositAmount, currencyCode)}`,
      remainingAmount: `Montant restant: ${formatPrice(totalPrice - depositAmount, currencyCode)} (Le jour de la visite)`,
      fullAmount: `Montant du paiement: ${formatPrice(totalPrice, currencyCode)}`,
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
      depositAmount: `Monto del depósito: ${formatPrice(depositAmount, currencyCode)}`,
      remainingAmount: `Monto restante: ${formatPrice(totalPrice - depositAmount, currencyCode)} (El día del tour)`,
      fullAmount: `Monto del pago: ${formatPrice(totalPrice, currencyCode)}`,
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
      depositAmount: `مبلغ العربون: ${formatPrice(depositAmount, currencyCode)}`,
      remainingAmount: `المبلغ المتبقي: ${formatPrice(totalPrice - depositAmount, currencyCode)} (يوم الجولة)`,
      fullAmount: `مبلغ الدفع: ${formatPrice(totalPrice, currencyCode)}`,
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
  const languageData = paymentInstructions[language] || paymentInstructions.tr || {};

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

  // Additional Info (from panel's "Ek Bilgiler" / "Additional Information" field)
  if (languageData.additional_info && languageData.additional_info.trim()) {
    message += `\n${lang.note}\n${languageData.additional_info}\n`;
  }

  return message;
}
