// Simple payment message generator for demo chat
// IMPROVED VERSION with better formatting

// Modular currency formatting
interface CurrencyConfig {
  code: string;
  symbol: string;
  locale: string;
  decimals: number;
}

const CURRENCIES: Record<string, CurrencyConfig> = {
  TRY: { code: "TRY", symbol: "₺", locale: "tr-TR", decimals: 0 },
  USD: { code: "USD", symbol: "$", locale: "en-US", decimals: 2 },
  EUR: { code: "EUR", symbol: "€", locale: "de-DE", decimals: 2 },
  SAR: { code: "SAR", symbol: "ر.س", locale: "ar-SA", decimals: 2 },
  RUB: { code: "RUB", symbol: "₽", locale: "ru-RU", decimals: 0 },
};

const DEFAULT_LANGUAGE_CURRENCIES: Record<string, string> = {
  tr: "TRY",
  en: "USD",
  de: "EUR",
  ru: "RUB",
  ar: "SAR",
  fr: "EUR",
  es: "EUR",
};

const getCurrency = (code: string): CurrencyConfig => {
  return CURRENCIES[code] || CURRENCIES.TRY;
};

function getCurrencyForLanguage(
  language: string,
  options?: {
    languageCurrencies?: any;
    primaryCurrency?: string;
  },
): string {
  // 1. Önce dil bazlı override
  if (options?.languageCurrencies && options.languageCurrencies[language]) {
    return options.languageCurrencies[language];
  }
  // 2. Primary currency
  if (options?.primaryCurrency) {
    return options.primaryCurrency;
  }
  // 3. Default
  return DEFAULT_LANGUAGE_CURRENCIES[language] || "TRY";
}

function formatPrice(amount: number, currencyCode: string = "TRY"): string {
  const currency = getCurrency(currencyCode);
  const formatted = new Intl.NumberFormat(currency.locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(amount);
  return `${formatted} ${currency.code}`;
}

async function convertPrice(price: number, fromCurrency: string, toCurrency: string): Promise<number> {
  if (fromCurrency === toCurrency) return price;

  try {
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/get-exchange-rates`, {
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
    });

    if (!response.ok) return price;

    const data = await response.json();
    const rates = data.rates || {};

    const fromRate = rates[fromCurrency] || 1;
    const toRate = rates[toCurrency] || 1;

    return price * (toRate / fromRate);
  } catch (error) {
    console.error("Error converting price:", error);
    return price;
  }
}

export async function generatePaymentMessage(
  paymentInstructions: any,
  language: string,
  totalPrice: number,
  depositAmount: number,
  tourCurrency: string = "TRY",
  options?: {
    languageCurrencies?: any;
    primaryCurrency?: string;
  },
): Promise<string> {
  if (
    !paymentInstructions ||
    !paymentInstructions.payment_methods ||
    paymentInstructions.payment_methods.length === 0
  ) {
    return "";
  }

  // Get target currency for the language
  const targetCurrency = getCurrencyForLanguage(language, options);

  // Convert prices if needed
  const convertedTotal = await convertPrice(totalPrice, tourCurrency, targetCurrency);
  const convertedDeposit = await convertPrice(depositAmount, tourCurrency, targetCurrency);

  const methods = paymentInstructions.payment_methods;
  const paymentType = paymentInstructions.payment_type || "deposit";
  const depositPercentage = paymentInstructions.deposit_percentage || 30;

  const labels: Record<string, any> = {
    tr: {
      title: "💳 ÖDEME BİLGİLERİ",
      separator: "─────────────────────",
      paymentType: paymentType === "deposit" ? `Kapora (%${depositPercentage})` : "Tam Ödeme",
      depositAmount: `Kapora Tutarı`,
      remaining: `Kalan Tutar`,
      remainingNote: "(Tur gününde)",
      fullAmount: `Ödeme Tutarı`,
      methods: "📋 Ödeme Yöntemleriniz:",
      bankTransfer: "🏦 HAVALE/EFT",
      bankName: "Banka:",
      iban: "IBAN:",
      accountHolder: "Hesap Sahibi:",
      cashOffice: "💵 OFİSTE NAKİT",
      address: "Adres:",
      hours: "Çalışma Saatleri:",
      cashOnTour: "💵 ARAÇTA/TUR GÜNÜ NAKİT",
      tourDay: "Tur günü araçta rehberimize ödeme yapabilirsiniz",
      creditCard: "💳 KREDİ KARTI",
      phone: "Telefon:",
      phonePayment: "Telefon ile güvenli ödeme yapabilirsiniz",
      note: "📌 Not:",
    },
    en: {
      title: "💳 PAYMENT INFORMATION",
      separator: "─────────────────────",
      paymentType: paymentType === "deposit" ? `Deposit (${depositPercentage}%)` : "Full Payment",
      depositAmount: `Deposit Amount`,
      remaining: `Remaining`,
      remainingNote: "(On tour day)",
      fullAmount: `Payment Amount`,
      methods: "📋 Payment Methods:",
      bankTransfer: "🏦 BANK TRANSFER",
      bankName: "Bank:",
      iban: "IBAN:",
      accountHolder: "Account Holder:",
      cashOffice: "💵 CASH AT OFFICE",
      address: "Address:",
      hours: "Working Hours:",
      cashOnTour: "💵 CASH ON TOUR",
      tourDay: "You can pay to our guide on tour day",
      creditCard: "💳 CREDIT CARD",
      phone: "Phone:",
      phonePayment: "Secure payment by phone",
      note: "📌 Note:",
    },
    de: {
      title: "💳 ZAHLUNGSINFORMATIONEN",
      separator: "─────────────────────",
      paymentType: paymentType === "deposit" ? `Anzahlung (${depositPercentage}%)` : "Vollzahlung",
      depositAmount: `Anzahlungsbetrag`,
      remaining: `Restbetrag`,
      remainingNote: "(Am Tourtag)",
      fullAmount: `Zahlungsbetrag`,
      methods: "📋 Zahlungsmethoden:",
      bankTransfer: "🏦 BANKÜBERWEISUNG",
      bankName: "Bank:",
      iban: "IBAN:",
      accountHolder: "Kontoinhaber:",
      cashOffice: "💵 BAR IM BÜRO",
      address: "Adresse:",
      hours: "Öffnungszeiten:",
      cashOnTour: "💵 BAR AM TOURTAG",
      tourDay: "Sie können am Tourtag bei unserem Reiseleiter bezahlen",
      creditCard: "💳 KREDITKARTE",
      phone: "Telefon:",
      phonePayment: "Sichere Zahlung per Telefon",
      note: "📌 Hinweis:",
    },
    ru: {
      title: "💳 ПЛАТЕЖНАЯ ИНФОРМАЦИЯ",
      separator: "─────────────────────",
      paymentType: paymentType === "deposit" ? `Депозит (${depositPercentage}%)` : "Полная оплата",
      depositAmount: `Сумма депозита`,
      remaining: `Остаток`,
      remainingNote: "(В день тура)",
      fullAmount: `Сумма оплаты`,
      methods: "📋 Способы оплаты:",
      bankTransfer: "🏦 БАНКОВСКИЙ ПЕРЕВОД",
      bankName: "Банк:",
      iban: "IBAN:",
      accountHolder: "Владелец счета:",
      cashOffice: "💵 НАЛИЧНЫМИ В ОФИСЕ",
      address: "Адрес:",
      hours: "Рабочие часы:",
      cashOnTour: "💵 НАЛИЧНЫМИ В ДЕНЬ ТУРА",
      tourDay: "Вы можете оплатить нашему гиду в день тура",
      creditCard: "💳 КРЕДИТНАЯ КАРТА",
      phone: "Телефон:",
      phonePayment: "Безопасная оплата по телефону",
      note: "📌 Примечание:",
    },
    ar: {
      title: "💳 معلومات الدفع",
      separator: "─────────────────────",
      paymentType: paymentType === "deposit" ? `وديعة (${depositPercentage}%)` : "الدفع الكامل",
      depositAmount: `مبلغ الوديعة`,
      remaining: `المتبقي`,
      remainingNote: "(في يوم الجولة)",
      fullAmount: `مبلغ الدفع`,
      methods: "📋 طرق الدفع:",
      bankTransfer: "🏦 تحويل بنكي",
      bankName: "البنك:",
      iban: "IBAN:",
      accountHolder: "صاحب الحساب:",
      cashOffice: "💵 نقداً في المكتب",
      address: "العنوان:",
      hours: "ساعات العمل:",
      cashOnTour: "💵 نقداً في يوم الجولة",
      tourDay: "يمكنك الدفع لمرشدنا في يوم الجولة",
      creditCard: "💳 بطاقة ائتمان",
      phone: "الهاتف:",
      phonePayment: "دفع آمن عبر الهاتف",
      note: "📌 ملاحظة:",
    },
    fr: {
      title: "💳 INFORMATIONS DE PAIEMENT",
      separator: "─────────────────────",
      paymentType: paymentType === "deposit" ? `Acompte (${depositPercentage}%)` : "Paiement complet",
      depositAmount: `Montant de l'acompte`,
      remaining: `Reste`,
      remainingNote: "(Le jour du circuit)",
      fullAmount: `Montant du paiement`,
      methods: "📋 Méthodes de paiement:",
      bankTransfer: "🏦 VIREMENT BANCAIRE",
      bankName: "Banque:",
      iban: "IBAN:",
      accountHolder: "Titulaire du compte:",
      cashOffice: "💵 ESPÈCES AU BUREAU",
      address: "Adresse:",
      hours: "Heures d'ouverture:",
      cashOnTour: "💵 ESPÈCES LE JOUR DU CIRCUIT",
      tourDay: "Vous pouvez payer à notre guide le jour du circuit",
      creditCard: "💳 CARTE DE CRÉDIT",
      phone: "Téléphone:",
      phonePayment: "Paiement sécurisé par téléphone",
      note: "📌 Note:",
    },
    es: {
      title: "💳 INFORMACIÓN DE PAGO",
      separator: "─────────────────────",
      paymentType: paymentType === "deposit" ? `Depósito (${depositPercentage}%)` : "Pago completo",
      depositAmount: `Monto del depósito`,
      remaining: `Restante`,
      remainingNote: "(El día del tour)",
      fullAmount: `Monto del pago`,
      methods: "📋 Métodos de pago:",
      bankTransfer: "🏦 TRANSFERENCIA BANCARIA",
      bankName: "Banco:",
      iban: "IBAN:",
      accountHolder: "Titular de la cuenta:",
      cashOffice: "💵 EFECTIVO EN LA OFICINA",
      address: "Dirección:",
      hours: "Horario de atención:",
      cashOnTour: "💵 EFECTIVO EL DÍA DEL TOUR",
      tourDay: "Puede pagar a nuestro guía el día del tour",
      creditCard: "💳 TARJETA DE CRÉDITO",
      phone: "Teléfono:",
      phonePayment: "Pago seguro por teléfono",
      note: "📌 Nota:",
    },
  };

  const lang = labels[language] || labels.tr;
  const bankInfo = paymentInstructions[language] || paymentInstructions.tr || {};

  // ========================================
  // HEADER - Daha belirgin
  // ========================================
  let message = `\n\n${lang.title}\n${lang.separator}\n\n`;

  // ========================================
  // PAYMENT AMOUNT - Daha okunaklı
  // ========================================
  if (paymentType === "deposit") {
    message += `💰 ${lang.paymentType}\n`;
    message += `   ${lang.depositAmount}: **${formatPrice(convertedDeposit, targetCurrency)}**\n`;
    message += `   ${lang.remaining}: ${formatPrice(convertedTotal - convertedDeposit, targetCurrency)} ${lang.remainingNote}\n\n`;
  } else {
    message += `💰 ${lang.paymentType}\n`;
    message += `   ${lang.fullAmount}: **${formatPrice(convertedTotal, targetCurrency)}**\n\n`;
  }

  message += `${lang.separator}\n${lang.methods}\n\n`;

  // ========================================
  // BANK TRANSFER - Kopyala-yapıştır kolay
  // ========================================
  if (methods.includes("bank_transfer")) {
    message += `${lang.bankTransfer}\n`;
    if (bankInfo.bank_name) {
      message += `  ${lang.bankName} ${bankInfo.bank_name}\n`;
    }
    if (bankInfo.iban) {
      message += `  ${lang.iban}\n  \`${bankInfo.iban}\`\n`; // Monospace font
    }
    if (bankInfo.account_holder) {
      message += `  ${lang.accountHolder} ${bankInfo.account_holder}\n`;
    }
    if (bankInfo.additional_info) {
      message += `  ${lang.note} ${bankInfo.additional_info}\n`;
    }
    message += "\n";
  }

  // ========================================
  // CASH AT OFFICE - Kompakt
  // ========================================
  if (methods.includes("cash_office")) {
    message += `${lang.cashOffice}\n`;
    if (paymentInstructions.office_address) {
      message += `  ${lang.address} ${paymentInstructions.office_address}\n`;
    }
    if (paymentInstructions.working_hours) {
      message += `  ${lang.hours} ${paymentInstructions.working_hours}\n`;
    }
    message += "\n";
  }

  // ========================================
  // CASH ON TOUR - Kısa ve net
  // ========================================
  if (methods.includes("cash_on_tour")) {
    message += `${lang.cashOnTour}\n`;
    message += `  ${lang.tourDay}\n\n`;
  }

  // ========================================
  // CREDIT CARD - Net
  // ========================================
  if (methods.includes("credit_card")) {
    message += `${lang.creditCard}\n`;
    if (paymentInstructions.phone_number) {
      message += `  ${lang.phone} ${paymentInstructions.phone_number}\n`;
    }
    message += `  ${lang.phonePayment}\n`;
  }

  return message;
}
