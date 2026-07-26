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

// FIX2 (2026-07-25): CurrencyConfig/CURRENCIES/getCurrency KALDIRILDI — yalnız
// eski local formatPrice (Intl) için vardı. Para birimi sembolleri+formatı artık
// tek-kaynak formatPriceSync (currency-display.ts) üzerinden. Dil→para eşlemesi
// (aşağıda) getCurrencyForLanguage için korunur.
const DEFAULT_LANGUAGE_CURRENCIES: Record<string, string> = {
  tr: "TRY",
  en: "USD",
  de: "EUR",
  ru: "RUB",
  ar: "SAR",
  fr: "EUR",
  es: "EUR",
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

// FIX2 (2026-07-25 CİLA): yerel formatPrice (Intl.NumberFormat) KALDIRILDI —
// AR'da "٢٤٩٫٥٨ SAR" (Arapça-Hint rakam + SAR kodu) basıyordu, completion ise
// "832﷼" (formatPriceSync). Artık kapora/kalan/tam-tutar da formatPriceSync
// tek-zincirinden geçer → tüm dillerde completion ile aynı etiket/rakam-sistemi.

// 2026-07-09 Faz 5 A1 (KRİTİK-PARA): eski convertPrice KALDIRILDI.
// Kök: kendi fetch'i (GET, base'siz, zayıf validasyon) sessizce başarısız
// oluyor → `rates[x] || 1` → ÇEVRİLMEMİŞ TL-sayı + yabancı-etiket
// ("Anzahlungsbetrag: 3.150,00 EUR"). Completion özeti (196€) ise
// getExchangeRatesOnce+convertSync (cache'li util) kullandığı için doğruydu —
// İKİ AYRI kur zinciri tutarsızdı. Şimdi TEK ZİNCİR: aynı util. Çevrim yine
// mümkün değilse (rates boş/eksik) → hedef para birimi TRY'ye (tourCurrency'e)
// DÜŞER: TL-sayı + TL-etiket. ASLA çapraz sayı/etiket basılmaz.
import { getExchangeRatesOnce } from "../utils/exchange-rates.ts";
// FIX2 (2026-07-25 CİLA): kapora/kalan/tam-tutar completion-TOPLAMIYLA aynı tek-
// zincirden (formatPriceSync) geçsin. Eski local formatPrice (Intl.NumberFormat)
// AR'da "٢٤٩٫٥٨ SAR" (Arapça-Hint rakam + SAR kodu) basıyordu; completion ise
// "832﷼" (﷼ + Batı-rakam). formatPriceSync tek-kaynak → aynı etiket/rakam-sistemi.
import { formatPriceSync } from "../utils/currency-display.ts";
import { localizeWorkingHours } from "../utils/working-hours.ts";

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
    showMultiCurrency?: boolean;   // FIX2: completion ile aynı dual-display kararı
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

  // 2026-07-09 Faz 5 A1 + FIX2: TEK KUR ZİNCİRİ (getExchangeRatesOnce+formatPriceSync —
  // completion özetiyle AYNI kaynak). Çevrilemiyorsa hedef TRY'ye (tourCurrency)
  // düşer → sayı ve etiket HER ZAMAN aynı para biriminde.
  const _rates = await getExchangeRatesOnce().catch(() => ({} as Record<string, number>));
  const _convertible = canConvert(tourCurrency, desiredCurrency, _rates);
  if (!_convertible && desiredCurrency !== tourCurrency) {
    console.warn(`[payment-message] A1: kur ${tourCurrency}→${desiredCurrency} çevrilemiyor (rates eksik) — etiket ${tourCurrency}'ye düştü`);
  }
  // FIX2: kapora/kalan/tam-tutar ÜÇÜ de ORİJİNAL tutar (tourCurrency) + formatPriceSync
  // ile completion-toplamının BİREBİR aynı zincirinden geçer. formatPriceSync kendi
  // içinde çevrilemezse tourCurrency'ye düşer → çapraz sayı/etiket ASLA basılmaz.
  // AR: ﷼ + Arapça-Hint rakam; DE/FR/ES/RU: EUR/USD zinciri (completion ile aynı).
  const _showDual = options?.showMultiCurrency !== false;
  const _fmtDeposit = formatPriceSync(depositAmount, tourCurrency, language, _rates, _showDual, options?.languageCurrencies);
  const _fmtRemaining = formatPriceSync(totalPrice - depositAmount, tourCurrency, language, _rates, _showDual, options?.languageCurrencies);
  const _fmtFull = formatPriceSync(totalPrice, tourCurrency, language, _rates, _showDual, options?.languageCurrencies);

  const methods = paymentInstructions.payment_methods;
  const paymentType = paymentInstructions.payment_type || "deposit";
  // K5: deposit_percentage 0-100 dışındaysa güvenli varsayılan (30).
  // Negatif/saçma değer ASLA müşteriye yansımasın — sessiz fallback + warn.
  const depositPercentage = safeDepositPercentage(paymentInstructions.deposit_percentage);

  const labels: Record<string, any> = {
    tr: {
      title: "💳 ÖDEME BİLGİLERİ",
      paymentType: paymentType === "deposit" ? `Kapora (%${depositPercentage})` : "Tam Ödeme",
      depositAmount: `Kapora Tutarı: ${_fmtDeposit}`,
      remaining: `Kalan Tutar: ${_fmtRemaining} (Tur gününde)`,
      fullAmount: `Ödeme Tutarı: ${_fmtFull}`,
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
      depositAmount: `Deposit Amount: ${_fmtDeposit}`,
      remaining: `Remaining: ${_fmtRemaining} (On tour day)`,
      fullAmount: `Payment Amount: ${_fmtFull}`,
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
      depositAmount: `Anzahlungsbetrag: ${_fmtDeposit}`,
      remaining: `Restbetrag: ${_fmtRemaining} (Am Tourtag)`,
      fullAmount: `Zahlungsbetrag: ${_fmtFull}`,
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
      depositAmount: `Сумма депозита: ${_fmtDeposit}`,
      remaining: `Остаток: ${_fmtRemaining} (В день тура)`,
      fullAmount: `Сумма оплаты: ${_fmtFull}`,
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
      depositAmount: `مبلغ الوديعة: ${_fmtDeposit}`,
      remaining: `المتبقي: ${_fmtRemaining} (في يوم الجولة)`,
      fullAmount: `مبلغ الدفع: ${_fmtFull}`,
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
      depositAmount: `Montant de l'acompte: ${_fmtDeposit}`,
      remaining: `Reste: ${_fmtRemaining} (Le jour du circuit)`,
      fullAmount: `Montant du paiement: ${_fmtFull}`,
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
      depositAmount: `Monto del depósito: ${_fmtDeposit}`,
      remaining: `Restante: ${_fmtRemaining} (El día del tour)`,
      fullAmount: `Monto del pago: ${_fmtFull}`,
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
  // FIX (panel-denetim 4.2): PaymentSettings varsayılan olarak BOŞ bir `en` bloğu
  // kaydediyor ({bank_name:"",iban:"",...}) — boş obje truthy olduğu için tr
  // fallback'ini eziyor ve yabancı müşteri IBAN'sız blok alıyordu. Yapısal alanı
  // (banka/IBAN/hesap sahibi) olmayan dil bloğu YOK sayılır → tr fallback çalışır.
  const _langBlockRaw = paymentInstructions[language];
  const _hasStruct = (b: { bank_name?: string; iban?: string; account_holder?: string } | undefined | null) =>
    !!(b && (b.bank_name || b.iban || b.account_holder));
  const _bankInfoLang = _hasStruct(_langBlockRaw) ? _langBlockRaw : null;
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
    // CİLA-4-F(iii): C4 TR-sızıntı — çalışma saatleri tek-kaynak yerelleştirici
    // ("Hafta içi 09:00-18:00" → "Wochentags 09:00-18:00"; canned hours ile AYNI util).
    if (paymentInstructions.working_hours) message += `${lang.hours} ${localizeWorkingHours(paymentInstructions.working_hours, language)}\n`;
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
