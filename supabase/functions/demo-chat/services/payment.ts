// Simple payment message generator for demo chat

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

  const labels: Record<string, any> = {
    tr: {
      title: '💳 ÖDEME BİLGİLERİ',
      paymentType: paymentType === 'deposit' ? `Kapora (%${depositPercentage})` : 'Tam Ödeme',
      depositAmount: `Kapora Tutarı: ${formatPrice(depositAmount, currencyCode)}`,
      remaining: `Kalan Tutar: ${formatPrice(totalPrice - depositAmount, currencyCode)} (Tur gününde)`,
      fullAmount: `Ödeme Tutarı: ${formatPrice(totalPrice, currencyCode)}`,
      methods: 'Ödeme Yöntemleriniz:',
      bankTransfer: '🏦 Havale/EFT:',
      bankName: 'Banka:',
      iban: 'IBAN:',
      accountHolder: 'Hesap Sahibi:',
      cashOffice: '💵 Ofiste Nakit:',
      address: 'Adres:',
      hours: 'Çalışma Saatleri:',
      cashOnTour: '💵 Araçta/Tur Günü Nakit:',
      tourDay: 'Tur günü araçta rehberimize ödeme yapabilirsiniz',
      creditCard: '💳 Kredi Kartı:',
      phone: 'Telefon:',
      phonePayment: 'Telefon ile güvenli ödeme yapabilirsiniz',
      note: '📌 Not:'
    },
    en: {
      title: '💳 PAYMENT INFORMATION',
      paymentType: paymentType === 'deposit' ? `Deposit (${depositPercentage}%)` : 'Full Payment',
      depositAmount: `Deposit Amount: ${formatPrice(depositAmount, currencyCode)}`,
      remaining: `Remaining: ${formatPrice(totalPrice - depositAmount, currencyCode)} (On tour day)`,
      fullAmount: `Payment Amount: ${formatPrice(totalPrice, currencyCode)}`,
      methods: 'Payment Methods:',
      bankTransfer: '🏦 Bank Transfer:',
      bankName: 'Bank:',
      iban: 'IBAN:',
      accountHolder: 'Account Holder:',
      cashOffice: '💵 Cash at Office:',
      address: 'Address:',
      hours: 'Working Hours:',
      cashOnTour: '💵 Cash on Tour:',
      tourDay: 'You can pay to our guide on tour day',
      creditCard: '💳 Credit Card:',
      phone: 'Phone:',
      phonePayment: 'Secure payment by phone',
      note: '📌 Note:'
    },
    de: {
      title: '💳 ZAHLUNGSINFORMATIONEN',
      paymentType: paymentType === 'deposit' ? `Anzahlung (${depositPercentage}%)` : 'Vollzahlung',
      depositAmount: `Anzahlungsbetrag: ${formatPrice(depositAmount, currencyCode)}`,
      remaining: `Restbetrag: ${formatPrice(totalPrice - depositAmount, currencyCode)} (Am Tourtag)`,
      fullAmount: `Zahlungsbetrag: ${formatPrice(totalPrice, currencyCode)}`,
      methods: 'Zahlungsmethoden:',
      bankTransfer: '🏦 Banküberweisung:',
      bankName: 'Bank:',
      iban: 'IBAN:',
      accountHolder: 'Kontoinhaber:',
      cashOffice: '💵 Bar im Büro:',
      address: 'Adresse:',
      hours: 'Öffnungszeiten:',
      cashOnTour: '💵 Bar am Tourtag:',
      tourDay: 'Sie können am Tourtag bei unserem Reiseleiter bezahlen',
      creditCard: '💳 Kreditkarte:',
      phone: 'Telefon:',
      phonePayment: 'Sichere Zahlung per Telefon',
      note: '📌 Hinweis:'
    },
    ru: {
      title: '💳 ПЛАТЕЖНАЯ ИНФОРМАЦИЯ',
      paymentType: paymentType === 'deposit' ? `Депозит (${depositPercentage}%)` : 'Полная оплата',
      depositAmount: `Сумма депозита: ${formatPrice(depositAmount, currencyCode)}`,
      remaining: `Остаток: ${formatPrice(totalPrice - depositAmount, currencyCode)} (В день тура)`,
      fullAmount: `Сумма оплаты: ${formatPrice(totalPrice, currencyCode)}`,
      methods: 'Способы оплаты:',
      bankTransfer: '🏦 Банковский перевод:',
      bankName: 'Банк:',
      iban: 'IBAN:',
      accountHolder: 'Владелец счета:',
      cashOffice: '💵 Наличными в офисе:',
      address: 'Адрес:',
      hours: 'Рабочие часы:',
      cashOnTour: '💵 Наличными в день тура:',
      tourDay: 'Вы можете оплатить нашему гиду в день тура',
      creditCard: '💳 Кредитная карта:',
      phone: 'Телефон:',
      phonePayment: 'Безопасная оплата по телефону',
      note: '📌 Примечание:'
    },
    ar: {
      title: '💳 معلومات الدفع',
      paymentType: paymentType === 'deposit' ? `وديعة (${depositPercentage}٪)` : 'الدفع الكامل',
      depositAmount: `مبلغ الوديعة: ${formatPrice(depositAmount, currencyCode)}`,
      remaining: `المتبقي: ${formatPrice(totalPrice - depositAmount, currencyCode)} (في يوم الجولة)`,
      fullAmount: `مبلغ الدفع: ${formatPrice(totalPrice, currencyCode)}`,
      methods: 'طرق الدفع:',
      bankTransfer: '🏦 تحويل بنكي:',
      bankName: 'البنك:',
      iban: 'IBAN:',
      accountHolder: 'صاحب الحساب:',
      cashOffice: '💵 نقداً في المكتب:',
      address: 'العنوان:',
      hours: 'ساعات العمل:',
      cashOnTour: '💵 نقداً في يوم الجولة:',
      tourDay: 'يمكنك الدفع لمرشدنا في يوم الجولة',
      creditCard: '💳 بطاقة ائتمان:',
      phone: 'الهاتف:',
      phonePayment: 'دفع آمن عبر الهاتف',
      note: '📌 ملاحظة:'
    },
    fr: {
      title: '💳 INFORMATIONS DE PAIEMENT',
      paymentType: paymentType === 'deposit' ? `Acompte (${depositPercentage}%)` : 'Paiement complet',
      depositAmount: `Montant de l'acompte: ${formatPrice(depositAmount, currencyCode)}`,
      remaining: `Reste: ${formatPrice(totalPrice - depositAmount, currencyCode)} (Le jour du circuit)`,
      fullAmount: `Montant du paiement: ${formatPrice(totalPrice, currencyCode)}`,
      methods: 'Méthodes de paiement:',
      bankTransfer: '🏦 Virement bancaire:',
      bankName: 'Banque:',
      iban: 'IBAN:',
      accountHolder: 'Titulaire du compte:',
      cashOffice: '💵 Espèces au bureau:',
      address: 'Adresse:',
      hours: 'Heures d\'ouverture:',
      cashOnTour: '💵 Espèces le jour du circuit:',
      tourDay: 'Vous pouvez payer à notre guide le jour du circuit',
      creditCard: '💳 Carte de crédit:',
      phone: 'Téléphone:',
      phonePayment: 'Paiement sécurisé par téléphone',
      note: '📌 Note:'
    },
    es: {
      title: '💳 INFORMACIÓN DE PAGO',
      paymentType: paymentType === 'deposit' ? `Depósito (${depositPercentage}%)` : 'Pago completo',
      depositAmount: `Monto del depósito: ${formatPrice(depositAmount, currencyCode)}`,
      remaining: `Restante: ${formatPrice(totalPrice - depositAmount, currencyCode)} (El día del tour)`,
      fullAmount: `Monto del pago: ${formatPrice(totalPrice, currencyCode)}`,
      methods: 'Métodos de pago:',
      bankTransfer: '🏦 Transferencia bancaria:',
      bankName: 'Banco:',
      iban: 'IBAN:',
      accountHolder: 'Titular de la cuenta:',
      cashOffice: '💵 Efectivo en la oficina:',
      address: 'Dirección:',
      hours: 'Horario de atención:',
      cashOnTour: '💵 Efectivo el día del tour:',
      tourDay: 'Puede pagar a nuestro guía el día del tour',
      creditCard: '💳 Tarjeta de crédito:',
      phone: 'Teléfono:',
      phonePayment: 'Pago seguro por teléfono',
      note: '📌 Nota:'
    }
  };

  const lang = labels[language] || labels.tr;
  const bankInfo = paymentInstructions[language] || paymentInstructions.tr || {};

  let message = `\n\n${lang.title}\n\n`;
  
  // Payment amount info
  if (paymentType === 'deposit') {
    message += `${lang.paymentType}\n${lang.depositAmount}\n${lang.remaining}\n\n`;
  } else {
    message += `${lang.paymentType}\n${lang.fullAmount}\n\n`;
  }
  
  message += `${lang.methods}\n\n`;

  // Bank transfer
  if (methods.includes('bank_transfer')) {
    message += `${lang.bankTransfer}\n`;
    if (bankInfo.bank_name) message += `${lang.bankName} ${bankInfo.bank_name}\n`;
    if (bankInfo.iban) message += `${lang.iban} ${bankInfo.iban}\n`;
    if (bankInfo.account_holder) message += `${lang.accountHolder} ${bankInfo.account_holder}\n`;
    if (bankInfo.additional_info) message += `${lang.note} ${bankInfo.additional_info}\n`;
    message += '\n';
  }

  // Cash at office
  if (methods.includes('cash_office')) {
    message += `${lang.cashOffice}\n`;
    if (paymentInstructions.office_address) message += `${lang.address} ${paymentInstructions.office_address}\n`;
    if (paymentInstructions.working_hours) message += `${lang.hours} ${paymentInstructions.working_hours}\n`;
    message += '\n';
  }

  // Cash on tour
  if (methods.includes('cash_on_tour')) {
    message += `${lang.cashOnTour}\n`;
    message += `${lang.tourDay}\n\n`;
  }

  // Credit card
  if (methods.includes('credit_card')) {
    message += `${lang.creditCard}\n`;
    if (paymentInstructions.phone_number) message += `${lang.phone} ${paymentInstructions.phone_number}\n`;
    message += `${lang.phonePayment}\n`;
  }

  return message;
}
