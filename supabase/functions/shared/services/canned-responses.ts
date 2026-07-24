// Canned (hızlı) cevaplar — ACENTE VERİSİNDEN beslenir (2026-07-24).
// ESKİ: hardcoded genel metin (contact_info'da "+90 XXX", "[Adres buraya]" sahte).
// YENİ: her anahtar bir agencies alanıyla eşlenir; çerçeve-metin 7-dil lokalize,
// acente-verisi olduğu gibi gömülür. Alan BOŞ → uydurma YASAK, 7-dil yönlendirme.
// Verisi olmayan anahtarlar (what_to_bring/group_discount) trigger'dan çıkarıldı →
// normal NLU/LLM akışı cevaplar (bağlamsal, uydurma değil).
import { normalizePhone, formatPhoneDisplay } from "../../_shared/phone.ts";

export interface CannedAgency {
  name?: string | null;
  phone_public?: string | null;
  address?: string | null;
  working_hours?: string | null;
  cancellation_policy?: string | null;
  payment_instructions?: any;
  payment_methods_text?: string | null;
}

type L7 = Record<string, string>;
const pick = (m: L7, lang: string): string => m[lang] || m.tr;

// ── 7-DİL ÇERÇEVE ETİKETLERİ (tek-kaynak) ───────────────────────────────────
const F = {
  contactTitle: { tr: "📞 İletişim Bilgileri", en: "📞 Contact Information", de: "📞 Kontaktinformationen", fr: "📞 Coordonnées", es: "📞 Información de contacto", ru: "📞 Контактная информация", ar: "📞 معلومات الاتصال" } as L7,
  phoneLabel:   { tr: "📱 Telefon:", en: "📱 Phone:", de: "📱 Telefon:", fr: "📱 Téléphone:", es: "📱 Teléfono:", ru: "📱 Телефон:", ar: "📱 الهاتف:" } as L7,
  addressLabel: { tr: "📍 Adres:", en: "📍 Address:", de: "📍 Adresse:", fr: "📍 Adresse:", es: "📍 Dirección:", ru: "📍 Адрес:", ar: "📍 العنوان:" } as L7,
  cancelTitle:  { tr: "🔄 İptal Politikası", en: "🔄 Cancellation Policy", de: "🔄 Stornierungsbedingungen", fr: "🔄 Politique d'annulation", es: "🔄 Política de cancelación", ru: "🔄 Условия отмены", ar: "🔄 سياسة الإلغاء" } as L7,
  hoursTitle:   { tr: "⏰ Çalışma Saatleri", en: "⏰ Working Hours", de: "⏰ Öffnungszeiten", fr: "⏰ Heures d'ouverture", es: "⏰ Horario", ru: "⏰ Часы работы", ar: "⏰ ساعات العمل" } as L7,
  // Yönlendirme (alan boş): acenteye yönlendir + (varsa) telefon
  redirect:     { tr: "Bu konuda acentemiz size yardımcı olacaktır.", en: "Our agency will be happy to assist you with this.", de: "Unsere Agentur hilft Ihnen dabei gerne weiter.", fr: "Notre agence se fera un plaisir de vous aider.", es: "Nuestra agencia estará encantada de ayudarle con esto.", ru: "Наше агентство с радостью поможет вам с этим.", ar: "ستساعدك وكالتنا بكل سرور في هذا الأمر." } as L7,
} as const;

// welcome: hardcoded "Turzz" yerine acente adı (yoksa nötr)
const WELCOME: Record<string, (name: string) => string> = {
  tr: (n) => `Merhaba! 👋 ${n} size nasıl yardımcı olabilir?`,
  en: (n) => `Hello! 👋 How can ${n} help you?`,
  de: (n) => `Hallo! 👋 Wie kann ${n} Ihnen helfen?`,
  fr: (n) => `Bonjour ! 👋 Comment ${n} peut-il vous aider ?`,
  es: (n) => `¡Hola! 👋 ¿Cómo puede ${n} ayudarle?`,
  ru: (n) => `Здравствуйте! 👋 Чем ${n} может вам помочь?`,
  ar: (n) => `مرحباً! 👋 كيف يمكن لـ ${n} مساعدتك؟`,
};

// TR/EN gün-adlı working_hours formatlayıcı (mevcut prompt davranışıyla tutarlı).
const DAY_NAMES: Record<string, L7> = {
  monday:    { tr: "Pazartesi", en: "Monday", de: "Montag", fr: "Lundi", es: "Lunes", ru: "Понедельник", ar: "الاثنين" },
  tuesday:   { tr: "Salı", en: "Tuesday", de: "Dienstag", fr: "Mardi", es: "Martes", ru: "Вторник", ar: "الثلاثاء" },
  wednesday: { tr: "Çarşamba", en: "Wednesday", de: "Mittwoch", fr: "Mercredi", es: "Miércoles", ru: "Среда", ar: "الأربعاء" },
  thursday:  { tr: "Perşembe", en: "Thursday", de: "Donnerstag", fr: "Jeudi", es: "Jueves", ru: "Четверг", ar: "الخميس" },
  friday:    { tr: "Cuma", en: "Friday", de: "Freitag", fr: "Vendredi", es: "Viernes", ru: "Пятница", ar: "الجمعة" },
  saturday:  { tr: "Cumartesi", en: "Saturday", de: "Samstag", fr: "Samedi", es: "Sábado", ru: "Суббота", ar: "السبت" },
  sunday:    { tr: "Pazar", en: "Sunday", de: "Sonntag", fr: "Dimanche", es: "Domingo", ru: "Воскресенье", ar: "الأحد" },
};
const CLOSED: L7 = { tr: "Kapalı", en: "Closed", de: "Geschlossen", fr: "Fermé", es: "Cerrado", ru: "Закрыто", ar: "مغلق" };

function formatHours(raw: string | null | undefined, lang: string): string {
  if (!raw) return "";
  try {
    const data = JSON.parse(raw);
    if (data && typeof data === "object" && data.monday !== undefined) {
      const lines: string[] = [];
      for (const key of Object.keys(DAY_NAMES)) {
        const name = pick(DAY_NAMES[key], lang);
        const day = data[key];
        lines.push(day && day.enabled ? `${name}: ${day.open} - ${day.close}` : `${name}: ${pick(CLOSED, lang)}`);
      }
      return lines.join("\n");
    }
  } catch { /* ham metin */ }
  return String(raw);
}

// Müşteri-dostu ödeme-yöntemi render'ı (IBAN + LLM-direktifi YOK — buildPaymentPromptSummary
// prompt-içi talimat içeriyor, doğrudan-send için UYGUN DEĞİL).
const PAY_TITLE: L7 = { tr: "💳 Ödeme", en: "💳 Payment", de: "💳 Zahlung", fr: "💳 Paiement", es: "💳 Pago", ru: "💳 Оплата", ar: "💳 الدفع" };
const PAY_METHODS_LABEL: L7 = { tr: "Ödeme yöntemleri:", en: "Payment methods:", de: "Zahlungsmethoden:", fr: "Méthodes de paiement :", es: "Métodos de pago:", ru: "Способы оплаты:", ar: "طرق الدفع:" };
const PAY_METHOD_NAMES: Record<string, L7> = {
  bank_transfer: { tr: "Havale/EFT", en: "Bank transfer", de: "Banküberweisung", fr: "Virement bancaire", es: "Transferencia bancaria", ru: "Банковский перевод", ar: "تحويل بنكي" },
  cash_office:   { tr: "Ofiste nakit", en: "Cash at office", de: "Barzahlung im Büro", fr: "Espèces au bureau", es: "Efectivo en oficina", ru: "Наличные в офисе", ar: "نقداً في المكتب" },
  cash_on_tour:  { tr: "Turda nakit", en: "Cash on tour", de: "Barzahlung vor Ort", fr: "Espèces pendant le circuit", es: "Efectivo en el tour", ru: "Наличные на туре", ar: "نقداً في الجولة" },
  credit_card:   { tr: "Kredi kartı", en: "Credit card", de: "Kreditkarte", fr: "Carte de crédit", es: "Tarjeta de crédito", ru: "Кредитная карта", ar: "بطاقة ائتمان" },
};
const depositLine = (pct: number, lang: string): string => pick({
  tr: `Kapora: %${pct} (kalan tutar tur günü)`, en: `Deposit: ${pct}% (remainder on tour day)`,
  de: `Anzahlung: ${pct}% (Rest am Tourtag)`, fr: `Acompte : ${pct}% (solde le jour du circuit)`,
  es: `Depósito: ${pct}% (resto el día del tour)`, ru: `Задаток: ${pct}% (остаток в день тура)`,
  ar: `عربون: ${pct}% (الباقي يوم الجولة)`,
}, lang);
const fullPayLine: L7 = { tr: "Tam ödeme", en: "Full payment", de: "Vollständige Zahlung", fr: "Paiement intégral", es: "Pago completo", ru: "Полная оплата", ar: "الدفع الكامل" };

function formatPaymentMethods(pi: any, lang: string): string {
  if (!pi || typeof pi !== "object" || !Array.isArray(pi.payment_methods) || pi.payment_methods.length === 0) return "";
  const names = pi.payment_methods.map((m: string) => PAY_METHOD_NAMES[m] ? pick(PAY_METHOD_NAMES[m], lang) : null).filter(Boolean);
  const pct = Number(pi.deposit_percentage);
  const dep = pi.payment_type === "deposit" && pct > 0 && pct <= 100 ? depositLine(pct, lang) : pick(fullPayLine, lang);
  const methodsLine = names.length ? `${pick(PAY_METHODS_LABEL, lang)} ${names.join(", ")}` : "";
  return [pick(PAY_TITLE, lang), dep, methodsLine].filter(Boolean).join("\n");
}

function phoneLine(agency: CannedAgency, lang: string): string {
  const p = agency.phone_public ? formatPhoneDisplay(normalizePhone(agency.phone_public)) : "";
  return p ? `${pick(F.phoneLabel, lang)} ${p}` : "";
}

function redirect(agency: CannedAgency, lang: string): string {
  const pl = phoneLine(agency, lang);
  return pl ? `${pick(F.redirect, lang)}\n${pl}` : pick(F.redirect, lang);
}

/**
 * Anahtar + dil + ACENTE → cevap. Alan doluysa veriden kurulur, boşsa yönlendirme.
 * Eşleşen trigger için DAİMA string döner (redirect fallback) — canned kısa-devre kalır.
 */
export function buildCannedResponse(key: string, language: string, agency: CannedAgency | null): string {
  const lang = language || "tr";
  const a = agency || {};
  switch (key) {
    case "welcome": {
      const nm = (a.name && a.name.trim()) || pick({ tr: "acentemiz", en: "our agency", de: "unsere Agentur", fr: "notre agence", es: "nuestra agencia", ru: "наше агентство", ar: "وكالتنا" }, lang);
      return (WELCOME[lang] || WELCOME.tr)(nm);
    }
    case "contact_info": {
      const parts = [pick(F.contactTitle, lang)];
      const pl = phoneLine(a, lang);
      if (pl) parts.push(pl);
      if (a.address && a.address.trim()) parts.push(`${pick(F.addressLabel, lang)} ${a.address.trim()}`);
      // Ne telefon ne adres → yönlendirme
      return parts.length > 1 ? parts.join("\n") : redirect(a, lang);
    }
    case "payment_methods": {
      const summary = formatPaymentMethods(a.payment_instructions, lang);
      if (summary && summary.trim()) return summary;
      if (a.payment_methods_text && a.payment_methods_text.trim()) return a.payment_methods_text.trim();
      return redirect(a, lang);
    }
    case "cancellation_policy": {
      if (a.cancellation_policy && a.cancellation_policy.trim()) {
        return `${pick(F.cancelTitle, lang)}\n${a.cancellation_policy.trim()}`;
      }
      return redirect(a, lang);
    }
    case "hours": {
      const h = formatHours(a.working_hours, lang);
      if (h) return `${pick(F.hoursTitle, lang)}\n${h}`;
      return redirect(a, lang);
    }
    default:
      return redirect(a, lang);
  }
}

/**
 * Müşteri mesajından canned anahtar tespiti. what_to_bring/group_discount
 * KALDIRILDI (acente-alanı yok → LLM cevaplasın, uydurma canned yerine).
 */
export function detectCannedResponseTrigger(message: string, _language: string = "tr"): string | null {
  const lowerMessage = message.toLowerCase().trim();
  const triggers: Record<string, string[]> = {
    hours: ["çalışma saatleri", "açık mısınız", "ne zaman açık", "working hours", "opening hours", "öffnungszeiten"],
    payment_methods: ["ödeme", "nasıl öderim", "kredi kartı", "payment", "zahlung", "оплата"],
    cancellation_policy: ["iptal", "iade", "cancellation", "refund", "stornierung", "отмена"],
    contact_info: ["iletişim", "telefon", "adres", "contact", "kontakt", "контакт"],
  };
  for (const [key, keywords] of Object.entries(triggers)) {
    if (keywords.some((k) => lowerMessage.includes(k))) return key;
  }
  return null;
}
