// Simple payment message generator for WhatsApp (multi-currency + multi-language)

/**
 * K5: deposit_percentage güvenli okuma
 * payment_instructions JSON içindeki değer 0-100 aralığında ve sonlu sayı olmalı.
 * Geçersizse 30 (makul varsayılan) döndür — bot ASLA negatif/saçma kapora hesaplamasın.
 */
export function safeDepositPercentage(input: any): number {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    if (input != null && input !== "") {
      console.warn(`[safeDepositPercentage] Invalid deposit_percentage=${input} — falling back to 30`);
    }
    return 30;
  }
  return Math.round(n);
}

/**
 * 2026-07-03 FAZ1-KAPANIŞ İş 1 (Açık Soru #18): LLM prompt'una giden KISA
 * ödeme özeti. Canlı vaka: isim adımında "ödemeyi nasıl yapıyoruz" cevapsız
 * kalıyordu — veri sistemde VARDI (payment_instructions) ama prompt'a hiç
 * bağlanmamıştı (paymentInfo alanı PromptContext'te tanımlıydı, hiçbir shared
 * prompt bileşeni basmıyordu — G14 sınıfı).
 *
 * GÜVENLİK: IBAN / hesap sahibi / banka adı / ofis adresi bu özete GİRMEZ —
 * toplama sırasında IBAN vermek erken/riskli. Sadece kapora oranı + yöntem
 * ADLARI + "detaylar onay sonrası" kuralı. Tam blok (IBAN dahil) onay-sonrası
 * generatePaymentMessage'da AYNEN kalır.
 * Veri boşsa boş string döner — agency.ts guard'ı "listede yoksa yönlendir"
 * kuralıyla acenteye yönlendirir (FIX 2 deseni).
 */
export function buildPaymentPromptSummary(paymentInstructions: any, language: string): string {
  if (
    !paymentInstructions ||
    typeof paymentInstructions !== "object" ||
    !Array.isArray(paymentInstructions.payment_methods) ||
    paymentInstructions.payment_methods.length === 0
  ) {
    return "";
  }
  const isTR = language === "tr";
  const methodNames: Record<string, { tr: string; en: string }> = {
    bank_transfer: { tr: "Havale/EFT", en: "Bank transfer" },
    cash_office: { tr: "Ofiste nakit", en: "Cash at office" },
    cash_on_tour: { tr: "Tur günü araçta nakit", en: "Cash on tour day" },
    credit_card: { tr: "Kredi kartı", en: "Credit card" },
    phone_payment: { tr: "Telefonla ödeme", en: "Payment by phone" },
  };
  const names = paymentInstructions.payment_methods
    .map((m: any) => {
      const key = typeof m === "string" ? m : m?.type;
      const entry = methodNames[key];
      return entry ? (isTR ? entry.tr : entry.en) : null;
    })
    .filter(Boolean);
  if (names.length === 0) return "";
  const paymentType = paymentInstructions.payment_type || "deposit";
  const pct = safeDepositPercentage(paymentInstructions.deposit_percentage);
  const depositLine =
    paymentType === "deposit"
      ? (isTR ? `Kapora: %${pct} (kalan tutar tur günü)` : `Deposit: ${pct}% (remainder on tour day)`)
      : (isTR ? "Tam ödeme" : "Full payment");
  return isTR
    ? `${depositLine}. Ödeme yöntemleri: ${names.join(", ")}. IBAN/hesap gibi detaylar rezervasyon ONAYINDAN SONRA iletilir — bu aşamada IBAN/hesap numarası VERME, "detaylar onay sonrasında iletilecek" de.`
    : `${depositLine}. Payment methods: ${names.join(", ")}. IBAN/account details are shared AFTER reservation confirmation — do NOT give IBAN/account numbers at this stage; say "details will be shared after confirmation".`;
}

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
  // 1. Dil bazlı override
  if (options?.languageCurrencies && options.languageCurrencies[language]) {
    return options.languageCurrencies[language];
  }
  // 2. Ajans primary currency
  if (options?.primaryCurrency) {
    return options.primaryCurrency;
  }
  // 3. Default mapping
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

// 2026-07-09 Faz 5 A1 (KRİTİK-PARA): eski convertPrice KALDIRILDI.
// Kök: kendi fetch'i (GET, base'siz, zayıf validasyon) sessizce başarısız
// oluyor → `rates[x] || 1` → ÇEVRİLMEMİŞ TL-sayı + yabancı-etiket
// ("Anzahlungsbetrag: 3.150,00 EUR"). Completion özeti (196€) ise
// getExchangeRatesOnce+convertSync (cache'li util) kullandığı için doğruydu —
// İKİ AYRI kur zinciri tutarsızdı. Şimdi TEK ZİNCİR: aynı util. Çevrim yine
// mümkün değilse (rates boş/eksik) → hedef para birimi TRY'ye (tourCurrency'e)
// DÜŞER: TL-sayı + TL-etiket. ASLA çapraz sayı/etiket basılmaz.
import { getExchangeRatesOnce, convertSync } from "../utils/exchange-rates.ts";

/** Çevrim güvenli mi? from===to her zaman güvenli; değilse iki kur da mevcut olmalı. */
function canConvert(from: string, to: string, rates: Record<string, number>): boolean {
  if (from === to) return true;
  return Number.isFinite(rates?.[from]) && Number.isFinite(rates?.[to]) && rates[from] > 0 && rates[to] > 0;
}

// Payment bilgisi YOKKEN müşteriye gösterilecek güvenli fallback (7 dil)
// Önceden boş string dönüyordu → müşteri ödeme talimatı alamıyor + sebebini bilemiyordu.
// Şimdi: "Ödeme bilgileri için acenteye iletişime geçin" + (varsa) acente telefonu.
function buildPaymentFallbackMessage(language: string, agencyPhone?: string | null): string {
  const _phone = (typeof agencyPhone === "string" && agencyPhone.trim()) ? ` 📞 ${agencyPhone}` : "";
  const _msgs: Record<string, string> = {
    tr: `\n\n💳 *Ödeme Bilgileri*\nÖdeme detayları için lütfen acentemizle iletişime geçin.${_phone}`,
    en: `\n\n💳 *Payment Information*\nPlease contact our agency for payment details.${_phone}`,
    de: `\n\n💳 *Zahlungsinformationen*\nBitte kontaktieren Sie unsere Agentur für Zahlungsdetails.${_phone}`,
    ru: `\n\n💳 *Информация об оплате*\nДля деталей оплаты, пожалуйста, свяжитесь с нашим агентством.${_phone}`,
    ar: `\n\n💳 *معلومات الدفع*\nيرجى التواصل مع وكالتنا للحصول على تفاصيل الدفع.${_phone}`,
    fr: `\n\n💳 *Informations de paiement*\nVeuillez contacter notre agence pour les détails de paiement.${_phone}`,
    es: `\n\n💳 *Información de pago*\nPor favor contacte con nuestra agencia para detalles de pago.${_phone}`,
  };
  return _msgs[language] || _msgs.tr;
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
    agencyPhone?: string | null;   // YENİ: fallback mesajında göstermek için
  },
): Promise<string> {
  // payment_instructions boşsa: sessiz boş yerine güvenli fallback mesaj döner.
  // Müşteri "Ödeme bilgileri için iletişime geçin" yazısını görür, kafa karışıklığı önlenir.
  if (
    !paymentInstructions ||
    !paymentInstructions.payment_methods ||
    paymentInstructions.payment_methods.length === 0
  ) {
    return buildPaymentFallbackMessage(language, options?.agencyPhone);
  }

  // Bu dili kullanan kullanıcı için hedef para birimini bul
  const desiredCurrency = getCurrencyForLanguage(language, options);

  // 2026-07-09 Faz 5 A1: TEK KUR ZİNCİRİ (getExchangeRatesOnce+convertSync —
  // completion özetiyle AYNI kaynak). Çevrilemiyorsa hedef TRY'ye (tourCurrency)
  // düşer → sayı ve etiket HER ZAMAN aynı para biriminde.
  const _rates = await getExchangeRatesOnce().catch(() => ({} as Record<string, number>));
  const _convertible = canConvert(tourCurrency, desiredCurrency, _rates);
  const targetCurrency = _convertible ? desiredCurrency : tourCurrency;
  if (!_convertible && desiredCurrency !== tourCurrency) {
    console.warn(`[payment-message] A1: kur ${tourCurrency}→${desiredCurrency} çevrilemiyor (rates eksik) — etiket ${tourCurrency}'ye düştü`);
  }
  const convertedTotal = convertSync(totalPrice, tourCurrency, targetCurrency, _rates);
  const convertedDeposit = convertSync(depositAmount, tourCurrency, targetCurrency, _rates);

  const methods = paymentInstructions.payment_methods;
  const paymentType = paymentInstructions.payment_type || "deposit";
  // K5: deposit_percentage 0-100 dışındaysa güvenli varsayılan (30).
  // Negatif/saçma değer ASLA müşteriye yansımasın — sessiz fallback + warn.
  const depositPercentage = safeDepositPercentage(paymentInstructions.deposit_percentage);

  const labels: Record<string, any> = {
    tr: {
      title: "💳 ÖDEME BİLGİLERİ",
      paymentType: paymentType === "deposit" ? `Kapora (%${depositPercentage})` : "Tam Ödeme",
      depositAmount: `Kapora Tutarı: ${formatPrice(convertedDeposit, targetCurrency)}`,
      remaining: `Kalan Tutar: ${formatPrice(convertedTotal - convertedDeposit, targetCurrency)} (Tur gününde)`,
      fullAmount: `Ödeme Tutarı: ${formatPrice(convertedTotal, targetCurrency)}`,
      methods: "Ödeme Yöntemleriniz:",
      bankTransfer: "🏦 Havale/EFT:",
      bankName: "Banka:",
      iban: "IBAN:",
      accountHolder: "Hesap Sahibi:",
      cashOffice: "💵 Ofiste Nakit:",
      address: "Adres:",
      hours: "Çalışma Saatleri:",
      cashOnTour: "💵 Araçta/Tur Günü Nakit:",
      tourDay: "Tur günü araçta rehberimize ödeme yapabilirsiniz",
      creditCard: "💳 Kredi Kartı:",
      phone: "Telefon:",
      phonePayment: "Telefon ile güvenli ödeme yapabilirsiniz",
      note: "📌 Not:",
    },
    en: {
      title: "💳 PAYMENT INFORMATION",
      paymentType: paymentType === "deposit" ? `Deposit (${depositPercentage}%)` : "Full Payment",
      depositAmount: `Deposit Amount: ${formatPrice(convertedDeposit, targetCurrency)}`,
      remaining: `Remaining: ${formatPrice(convertedTotal - convertedDeposit, targetCurrency)} (On tour day)`,
      fullAmount: `Payment Amount: ${formatPrice(convertedTotal, targetCurrency)}`,
      methods: "Payment Methods:",
      bankTransfer: "🏦 Bank Transfer:",
      bankName: "Bank:",
      iban: "IBAN:",
      accountHolder: "Account Holder:",
      cashOffice: "💵 Cash at Office:",
      address: "Address:",
      hours: "Working Hours:",
      cashOnTour: "💵 Cash on Tour:",
      tourDay: "You can pay to our guide on tour day",
      creditCard: "💳 Credit Card:",
      phone: "Phone:",
      phonePayment: "Secure payment by phone",
      note: "📌 Note:",
    },
    de: {
      title: "💳 ZAHLUNGSINFORMATIONEN",
      paymentType: paymentType === "deposit" ? `Anzahlung (${depositPercentage}%)` : "Vollzahlung",
      depositAmount: `Anzahlungsbetrag: ${formatPrice(convertedDeposit, targetCurrency)}`,
      remaining: `Restbetrag: ${formatPrice(convertedTotal - convertedDeposit, targetCurrency)} (Am Tourtag)`,
      fullAmount: `Zahlungsbetrag: ${formatPrice(convertedTotal, targetCurrency)}`,
      methods: "Zahlungsmethoden:",
      bankTransfer: "🏦 Banküberweisung:",
      bankName: "Bank:",
      iban: "IBAN:",
      accountHolder: "Kontoinhaber:",
      cashOffice: "💵 Bar im Büro:",
      address: "Adresse:",
      hours: "Öffnungszeiten:",
      cashOnTour: "💵 Bar am Tourtag:",
      tourDay: "Sie können am Tourtag bei unserem Reiseleiter bezahlen",
      creditCard: "💳 Kreditkarte:",
      phone: "Telefon:",
      phonePayment: "Sichere Zahlung per Telefon",
      note: "📌 Hinweis:",
    },
    ru: {
      title: "💳 ПЛАТЕЖНАЯ ИНФОРМАЦИЯ",
      paymentType: paymentType === "deposit" ? `Депозит (${depositPercentage}%)` : "Полная оплата",
      depositAmount: `Сумма депозита: ${formatPrice(convertedDeposit, targetCurrency)}`,
      remaining: `Остаток: ${formatPrice(convertedTotal - convertedDeposit, targetCurrency)} (В день тура)`,
      fullAmount: `Сумма оплаты: ${formatPrice(convertedTotal, targetCurrency)}`,
      methods: "Способы оплаты:",
      bankTransfer: "🏦 Банковский перевод:",
      bankName: "Банк:",
      iban: "IBAN:",
      accountHolder: "Владелец счета:",
      cashOffice: "💵 Наличными в офисе:",
      address: "Адрес:",
      hours: "Рабочие часы:",
      cashOnTour: "💵 Наличными в день тура:",
      tourDay: "Вы можете оплатить нашему гиду в день тура",
      creditCard: "💳 Кредитная карта:",
      phone: "Телефон:",
      phonePayment: "Безопасная оплата по телефону",
      note: "📌 Примечание:",
    },
    ar: {
      title: "💳 معلومات الدفع",
      paymentType: paymentType === "deposit" ? `وديعة (${depositPercentage}٪)` : "الدفع الكامل",
      depositAmount: `مبلغ الوديعة: ${formatPrice(convertedDeposit, targetCurrency)}`,
      remaining: `المتبقي: ${formatPrice(convertedTotal - convertedDeposit, targetCurrency)} (في يوم الجولة)`,
      fullAmount: `مبلغ الدفع: ${formatPrice(convertedTotal, targetCurrency)}`,
      methods: "طرق الدفع:",
      bankTransfer: "🏦 تحويل بنكي:",
      bankName: "البنك:",
      iban: "IBAN:",
      accountHolder: "صاحب الحساب:",
      cashOffice: "💵 نقداً في المكتب:",
      address: "العنوان:",
      hours: "ساعات العمل:",
      cashOnTour: "💵 نقداً في يوم الجولة:",
      tourDay: "يمكنك الدفع لمرشدنا في يوم الجولة",
      creditCard: "💳 بطاقة ائتمان:",
      phone: "الهاتف:",
      phonePayment: "دفع آمن عبر الهاتف",
      note: "📌 ملاحظة:",
    },
    fr: {
      title: "💳 INFORMATIONS DE PAIEMENT",
      paymentType: paymentType === "deposit" ? `Acompte (${depositPercentage}%)` : "Paiement complet",
      depositAmount: `Montant de l'acompte: ${formatPrice(convertedDeposit, targetCurrency)}`,
      remaining: `Reste: ${formatPrice(convertedTotal - convertedDeposit, targetCurrency)} (Le jour du circuit)`,
      fullAmount: `Montant du paiement: ${formatPrice(convertedTotal, targetCurrency)}`,
      methods: "Méthodes de paiement:",
      bankTransfer: "🏦 Virement bancaire:",
      bankName: "Banque:",
      iban: "IBAN:",
      accountHolder: "Titulaire du compte:",
      cashOffice: "💵 Espèces au bureau:",
      address: "Adresse:",
      hours: "Heures d'ouverture:",
      cashOnTour: "💵 Espèces le jour du circuit:",
      tourDay: "Vous pouvez payer à notre guide le jour du circuit",
      creditCard: "💳 Carte de crédit:",
      phone: "Téléphone:",
      phonePayment: "Paiement sécurisé par téléphone",
      note: "📌 Note:",
    },
    es: {
      title: "💳 INFORMACIÓN DE PAGO",
      paymentType: paymentType === "deposit" ? `Depósito (${depositPercentage}%)` : "Pago completo",
      depositAmount: `Monto del depósito: ${formatPrice(convertedDeposit, targetCurrency)}`,
      remaining: `Restante: ${formatPrice(convertedTotal - convertedDeposit, targetCurrency)} (El día del tour)`,
      fullAmount: `Monto del pago: ${formatPrice(convertedTotal, targetCurrency)}`,
      methods: "Métodos de pago:",
      bankTransfer: "🏦 Transferencia bancaria:",
      bankName: "Banco:",
      iban: "IBAN:",
      accountHolder: "Titular de la cuenta:",
      cashOffice: "💵 Efectivo en la oficina:",
      address: "Dirección:",
      hours: "Horario de atención:",
      cashOnTour: "💵 Efectivo el día del tour:",
      tourDay: "Puede pagar a nuestro guía el día del tour",
      creditCard: "💳 Tarjeta de crédito:",
      phone: "Teléfono:",
      phonePayment: "Pago seguro por teléfono",
      note: "📌 Nota:",
    },
  };

  const lang = labels[language] || labels.tr;
  // 2026-07-09 Faz 5 A1 (2. kök): bankInfo `.tr` fallback'i TR SERBEST-METNİ
  // ("Hinweis: Lütfen açıklama kısmına...") yabancı bloğa karıştırıyordu.
  // YAPISAL alanlar (banka adı/IBAN/hesap sahibi) dil-nötr → .tr fallback KALIR;
  // additional_info (serbest metin) yalnız O DİLİN bloğundan basılır (tr hariç).
  // Per-dil veri yoksa satır atlanır — acente panelde per-dil doldurmalı
  // (panel-backlog: "payment_instructions per-dil").
  const _bankInfoLang = paymentInstructions[language];
  const bankInfo = _bankInfoLang || paymentInstructions.tr || {};
  const _additionalInfo = (language === "tr" ? bankInfo.additional_info : _bankInfoLang?.additional_info) || null;

  // Ayraç + başlık — completion mesajından görsel ayrım
  let message = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n${lang.title}\n\n`;

  // Payment amount info
  if (paymentType === "deposit") {
    message += `${lang.paymentType}\n${lang.depositAmount}\n${lang.remaining}\n\n`;
  } else {
    message += `${lang.paymentType}\n${lang.fullAmount}\n\n`;
  }

  message += `${lang.methods}\n\n`;

  // Bank transfer
  if (methods.includes("bank_transfer")) {
    message += `${lang.bankTransfer}\n`;
    if (bankInfo.bank_name) message += `${lang.bankName} ${bankInfo.bank_name}\n`;
    if (bankInfo.iban) message += `${lang.iban} ${bankInfo.iban}\n`;
    if (bankInfo.account_holder) message += `${lang.accountHolder} ${bankInfo.account_holder}\n`;
    if (_additionalInfo) message += `${lang.note} ${_additionalInfo}\n`;
    message += "\n";
  }

  // Cash at office
  if (methods.includes("cash_office")) {
    message += `${lang.cashOffice}\n`;
    if (paymentInstructions.office_address) message += `${lang.address} ${paymentInstructions.office_address}\n`;
    if (paymentInstructions.working_hours) message += `${lang.hours} ${paymentInstructions.working_hours}\n`;
    message += "\n";
  }

  // Cash on tour
  if (methods.includes("cash_on_tour")) {
    message += `${lang.cashOnTour}\n`;
    message += `${lang.tourDay}\n\n`;
  }

  // Credit card
  if (methods.includes("credit_card")) {
    message += `${lang.creditCard}\n`;
    if (paymentInstructions.phone_number) message += `${lang.phone} ${paymentInstructions.phone_number}\n`;
    message += `${lang.phonePayment}\n`;
  }

  return message;
}
