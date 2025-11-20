// Simple payment message generator for demo chat

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

  const labels: Record<string, any> = {
    tr: {
      title: '💳 ÖDEME BİLGİLERİ',
      paymentType: paymentType === 'deposit' ? `Kapora (%${depositPercentage})` : 'Tam Ödeme',
      depositAmount: `Kapora Tutarı: ${depositAmount}₺`,
      remaining: `Kalan Tutar: ${totalPrice - depositAmount}₺ (Tur gününde)`,
      fullAmount: `Ödeme Tutarı: ${totalPrice}₺`,
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
      depositAmount: `Deposit Amount: ${depositAmount}₺`,
      remaining: `Remaining: ${totalPrice - depositAmount}₺ (On tour day)`,
      fullAmount: `Payment Amount: ${totalPrice}₺`,
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
