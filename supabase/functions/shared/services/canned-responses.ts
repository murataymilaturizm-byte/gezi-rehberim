// Canned (hızlı) cevaplar — ACENTE VERİSİNDEN beslenir (2026-07-24).
// ESKİ: hardcoded genel metin (contact_info'da "+90 XXX", "[Adres buraya]" sahte).
// YENİ: her anahtar bir agencies alanıyla eşlenir; çerçeve-metin 7-dil lokalize,
// acente-verisi olduğu gibi gömülür. Alan BOŞ → uydurma YASAK, 7-dil yönlendirme.
// Verisi olmayan anahtarlar (what_to_bring/group_discount) trigger'dan çıkarıldı →
// normal NLU/LLM akışı cevaplar (bağlamsal, uydurma değil).
import { normalizePhone, formatPhoneDisplay } from "../../_shared/phone.ts";
import { localizeWorkingHours } from "../utils/working-hours.ts";

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

/**
 * Canned kısa-devresi YALNIZ boşta/gözden-geçirme bağlamında çalışmalı — aktif
 * toplama-akışı, CONFIRMING, COMPLETED veya §35 bekleme-durumlarında FSM/NLU'yu
 * GÖLGELEMEMELİ (ör. COMPLETED "iptal" → canned yerine 14a talep-akışı çalışsın).
 * true = boşta (canned OK) · false = aktif/bekleme (canned ATLA, FSM'e bırak).
 */
export function isIdleContext(ctx: any): boolean {
  if (!ctx || typeof ctx !== "object") return true; // yeni/boş bağlam = boşta
  const ACTIVE_STAGES = ["COMPLETED", "COLLECTING_INFO", "CONFIRMING", "TOUR_SELECTED"];
  if (ACTIVE_STAGES.includes(ctx.stage)) return false;
  if (ctx.collectionStep) return false;                 // waiting_for_*
  if (ctx.proposedDateId) return false;                 // §35 tarih-önerisi
  if (ctx.phoneEscalationPending) return false;         // §35 telefon-eskalasyon
  if (ctx.pendingLangSwitch) return false;              // §35 dil-geçiş
  if (Array.isArray(ctx.pendingTourClarification) && ctx.pendingTourClarification.length > 0) return false; // §35 tur-netleştirme
  return true; // GREETING / BROWSING / boşta → canned çalışır
}

// Köprü-cümle (güvenlik ağı): boşta-bağlamda iptal-POLİTİKASI cevabına eklenir —
// müşteri mevcut rezervasyonunu iptal/değiştirmek isterse akışa (14a talep) yönlendirir.
const BRIDGE_CANCEL: L7 = {
  tr: "Mevcut bir rezervasyonunuzu iptal etmek veya değiştirmek isterseniz yazmanız yeterli — talebinizi acentemize iletelim.",
  en: "If you'd like to cancel or change an existing reservation, just write to us — we'll forward your request to our agency.",
  de: "Wenn Sie eine bestehende Reservierung stornieren oder ändern möchten, schreiben Sie uns einfach — wir leiten Ihre Anfrage an unsere Agentur weiter.",
  fr: "Si vous souhaitez annuler ou modifier une réservation existante, écrivez-nous simplement — nous transmettrons votre demande à notre agence.",
  es: "Si desea cancelar o cambiar una reserva existente, solo escríbanos — trasladaremos su solicitud a nuestra agencia.",
  ru: "Если вы хотите отменить или изменить существующее бронирование, просто напишите нам — мы передадим ваш запрос в агентство.",
  ar: "إذا كنت ترغب في إلغاء أو تعديل حجز قائم، فقط اكتب لنا — وسنحيل طلبك إلى وكالتنا.",
};

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

// CİLA-4-F(iii) (2026-07-26): working_hours formatlayıcı TEK-KAYNAĞA taşındı —
// shared/utils/working-hours.ts (JSON gün-yapısı + serbest-TR-metin sözlüğü,
// "Hafta içi"→"Wochentags" C4 TR-sızıntı fix'i). payment-message ile AYNI kaynak.
// Yerel DAY_NAMES/CLOSED/formatHours gövdesi SİLİNDİ (net-negatif kod kuralı).
const formatHours = localizeWorkingHours;

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
      // Köprü-cümle daima eklenir (yalnız boşta-bağlamda çağrılır) → mevcut
      // rezervasyon iptal/değişikliğini 14a talep-akışına yönlendirir.
      if (a.cancellation_policy && a.cancellation_policy.trim()) {
        return `${pick(F.cancelTitle, lang)}\n${a.cancellation_policy.trim()}\n\n${pick(BRIDGE_CANCEL, lang)}`;
      }
      return `${redirect(a, lang)}\n\n${pick(BRIDGE_CANCEL, lang)}`;
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
  // D1-5 (CİLA-PARİTE-1): substring dizi → 7-dil \p{L}\p{N} lookaround-regex (tek-kaynak).
  // fr/es/ar bacakları eklendi (eskiden yalnız tr/en/de+kısmi-ru → o diller hız-yolunu
  // hiç alamıyordu). İDLE-GATE korunur: bu fonksiyon yalnız isIdleContext()=true iken
  // (GREETING/BROWSING/boşta) çağrılır → COMPLETED "annulation/إلغاء" pendingCancelConfirm'e
  // gider, canned'a DEĞİL (R-2 yapısal garanti — çağrı-yeri gate'li).
  const triggers: Record<string, RegExp> = {
    hours: /(?<![\p{L}\p{N}])(çalışma\s*saatleri|açık\s*mısınız|ne\s*zaman\s*açık|working\s*hours|opening\s*hours|öffnungszeiten|horaires|heures\s*d['’]ouverture|horario|часы\s*работы|ساعات\s*العمل)(?![\p{L}\p{N}])/iu,
    payment_methods: /(?<![\p{L}\p{N}])(ödeme|nasıl\s*öderim|kredi\s*kartı|payment|zahlung|оплата|paiement|pago|الدفع|طرق\s*الدفع)(?![\p{L}\p{N}])/iu,
    cancellation_policy: /(?<![\p{L}\p{N}])(iptal|iade|cancellation|refund|stornierung|отмена|annulation|cancelaci[óo]n|شروط\s*الإلغاء)(?![\p{L}\p{N}])/iu,
    contact_info: /(?<![\p{L}\p{N}])(iletişim|telefon|adres|contact|kontakt|контакт|coordonn[ée]es|contacto|اتصال|تواصل)(?![\p{L}\p{N}])/iu,
  };
  for (const [key, re] of Object.entries(triggers)) {
    if (re.test(lowerMessage)) return key;
  }
  return null;
}
