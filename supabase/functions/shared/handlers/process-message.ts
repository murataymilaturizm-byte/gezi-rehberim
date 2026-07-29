// Unified message processing core — hem demo-chat hem whatsapp-webhook tarafından kullanılır.
// Tüm kanal-bağımsız rezervasyon akış mantığı burada toplanır.
// I/O (DB, WhatsApp API, HTTP response) ChannelAdapter üzerinden soyutlanmıştır.

import type { ConversationContext, ProcessingInput } from "../fsm/types.ts";
import {
  createInitialContext,
  processTransition,
  getNextExpectedInput,
  getCancellationMessage,
  detectConfirmation,
  detectNegativeResponse,
  determineCollectionStep,
} from "../fsm/state-machine.ts";
import { sanitizeInput, isInputTooLong, detectInjection } from "../fsm/validator.ts";
import { analyzeUserMessage, mapNLUIntentToFSMIntent } from "../fsm/nlu.ts";
import {
  detectLanguageChangeIntent,
  getDefaultToneForLanguage,
  formatDateForLanguage,
  getWeekdayName,
} from "../fsm/localization.ts";
import { STEP_QUESTIONS } from "../constants/step-questions.ts";
import { detectLanguage } from "../fsm/language.ts";
import { buildSystemPrompt, buildTransitionPrompt, getMultipleTourWarning, getStagePrompt } from "../fsm/prompt-builder.ts";
import { validateAIResponse, validateInjectionResponse, validateFieldReask, detectEmptyPromise, detectFakeChangeAck } from "../fsm/response-validator.ts";
import { formatReservationSummary } from "../fsm/prompts/helpers.ts";
import { isEchoSafe } from "../services/echo-sanitize.ts";
import { MONTH_ALTERNATION, MONTH_NAME_TO_NUMBER } from "../constants/month-names.ts";
import { NUMBER_WORDS } from "../fsm/simple-extractor.ts";
import { extractEmail, isNegativePaxMessage } from "../fsm/simple-extractor.ts";
import { detectOutOfScopeLead, isTourContextMessage, LEAD_ACK, LEAD_RESUME, LEAD_ASK_DETAIL, LEAD_ASK_DETAIL_PHONE, LEAD_SAVED, LEAD_FAILED } from "../constants/lead-detection.ts";
import { logCritical } from "../../_shared/error-sink.ts";
import { findTourById } from "../fsm/tour-matcher.ts";
import { findMatchingTours, TOUR_CHANGE_PHRASE_RE } from "../services/tour-matching.ts";
import { isNluFullNameTourLeak, isNluFullNameNegationLeak, isNluFullNameGiveUpLeak } from "../services/nlu-validation.ts";
import { shouldTriggerNameAskPersist, shouldFireUnknownTour, shouldTriggerAutoDateAck, shouldTriggerManualDateAck, shouldTriggerSummaryReask } from "../services/bypass-gates.ts";
import { hasQuotaForPax, getQuotaRemaining, hasAnyAvailableDate } from "../services/quota-check.ts";
import { extractAllInfo, getLocalizedTourTitle } from "../services/info-extractor.ts";
import { buildNLUContextBase } from "../services/context-manager.ts";
import { buildAIFallbackResponse } from "../services/fallback-response.ts";
import { DATE_QUERY_RE, DATE_INTENTS } from "../constants/date-detection.ts";
import { CHANGE_KEYWORDS_RE } from "../constants/change-detection.ts";
import { isSummaryRequest } from "../constants/summary-request.ts";
import { PRICE_QUESTION_RE } from "../constants/price-question.ts";
import { THANKS_FAREWELL_RE } from "../constants/thanks-words.ts";
import { QUESTION_SIGNAL_RE } from "../constants/question-detection.ts";
import { VISA_SIGNAL_RE, VISA_QUESTION_HINT_RE } from "../constants/visa-detection.ts";
import { produceTourChangeContext, shouldApplyEarlyTourChange, buildTourChangePrefix, hasReservationSignal } from "../services/tour-change.ts";
import { callAI } from "../services/ai.ts";
import { generatePaymentMessage, safeDepositPercentage, buildPaymentPromptSummary } from "../services/payment-message.ts";
import { getExchangeRatesOnce } from "../utils/exchange-rates.ts";
import { formatPriceSync } from "../utils/currency-display.ts";
import { isValidPax, isValidPhone, MAX_PAX_PER_RESERVATION } from "../utils/validation.ts";
import { quotaLabel } from "../constants/quota-labels.ts";
import { maskPhone } from "../utils/log-mask.ts";
// K4: TEK yuvarlama kuralı — tüm kapora/toplam hesapları buradan.
import { calculateTotal, calculateDeposit } from "../utils/finance.ts";
import { normalizePhone, formatPhoneDisplay } from "../../_shared/phone.ts";
import { CONFIRM_POSITIVE } from "../constants/confirmation-words.ts";
import type { ChannelAdapter, ProcessMessageInput, ProcessMessageResult } from "./types.ts";

// FIX2 (2026-07-24): acente-telefon eki — İş1 (canned) normalize deseniyle AYNI.
// phone_public boşsa "" (kırılma yok). Tek-kaynak: hem çıkmaz-mesajları hem stale.
function _agencyPhoneSuffix(phonePublic: string | null | undefined): string {
  if (!phonePublic || !phonePublic.trim()) return "";
  return ` 📞 ${formatPhoneDisplay(normalizePhone(phonePublic))}`;
}

// === DİL-YAZMA AUDIT RING (CİLA-3, 2026-07-26) ===
// context.language'a yazan HER nokta buradan geçer → context._langTrace ring'ine
// (son 12) kayıt düşer. Amaç: non-deterministik dil-flip'lerin turn+kaynak+harf-durumu
// kanıtı (demo conversationState'te dışarı sızar, WhatsApp'ta context ile persist).
// Format: "<messageCount>:<kaynak>:<eski>><yeni>:<L|0>" (L=mesajda harf var).
function _traceLang(ctx: any, src: string, to: string, msg: string): void {
  const from = ctx?.language ?? "?";
  const t: string[] = Array.isArray(ctx?._langTrace) ? ctx._langTrace : [];
  t.push(`${ctx?.messageCount ?? 0}:${src}:${from}>${to}:${/\p{L}/u.test(msg) ? "L" : "0"}`);
  ctx._langTrace = t.slice(-12);
  console.log(`[lang-write] src=${src} ${from}>${to} letters=${/\p{L}/u.test(msg)} mc=${ctx?.messageCount ?? 0}`);
}

// FIX1 (2026-07-24): rezervasyon TOPLAM tutarı — TEK-KAYNAK. CONFIRMING özeti +
// completion AYNI fonksiyondan geçer → tutar hiçbir senaryoda farklı olamaz.
// (Para birimi + Arapça-Hint rakam mevcut formatPriceSync zincirinden.)
async function _reservationTotalText(
  paxAdult: number, paxChild: number,
  priceAdult: number, priceChild: number | null | undefined,
  currencyCode: string, language: string,
  showDual: boolean, languageCurrencies: any,
): Promise<string> {
  const total = (paxAdult || 0) * (priceAdult || 0) +
    (paxChild || 0) * (priceChild || priceAdult || 0);
  if (total <= 0) return "";
  const ex = await getExchangeRatesOnce().catch(() => ({}));
  return formatPriceSync(total, currencyCode || "TRY", language, ex, showDual, languageCurrencies);
}
const _TOTAL_LABELS: Record<string, string> = {
  tr: "Toplam", en: "Total", de: "Gesamt", ru: "Итого", ar: "الإجمالي", fr: "Total", es: "Total",
};

// === İPTAL-NİYETİ TEK-KAYNAK (2026-07-24) — J-14 + pendingCancelConfirm ortak ===
// Sinyal: iptal fiil-çekimleri (stem'ler substring ile çekimleri yakalar:
// stornier→stornieren, annul→annuler, отмен→отменить, إلغاء/ألغ). ASCII \b YOK,
// \p{L}\p{N} lookbehind. RESCTX: rezervasyon-kelimesi (varsa J-14 teyitsiz direkt).
// CİLA-4-B (2026-07-26): AR harf-i tarifli isim-hâli — "أريد الإلغاء"da الإلغاء'nın
// إ'si ل'den sonra geldiği için lookbehind eşleşmeyi engelliyordu → (?:ال)? toleransı.
// (FR annulation→annul, ES cancelación→cancel zaten prefix'le eşleşiyor — trailing
// lookahead YOK bu regex'te, kasıtlı: çekimler serbest.)
const _CXL_SIGNAL_RE = /(?<![\p{L}\p{N}])(iptal|cancel|stornier|annul|cancelar|отмен|(?:ال)?إلغاء|ألغ)/iu;
const _CXL_RESCTX_RE = /(?<![\p{L}\p{N}])(rezervasyon|kayıt|kaydı|reservation|booking|buchung|réservation|reserva|бронь|бронирование|حجز)/iu;
const _CXL_FAQ_RE = /(şart|kosul|koşul|policy|politika|iade|refund|ücret|ucret|kesinti|nasıl|nasil|ne zaman|condition|terms|fee|how|when|bedingung|storno(?:gebühr)?|rückerstattung|ruckerstattung|geb[üu]hr|wie|wann|politique|remboursement|frais|comment|quand|condici[óo]n|pol[íi]tica|reembolso|tarifa|c[óo]mo|cu[áa]ndo|услови|возврат|плат[аеу]|штраф|как|когда|شرو?ط|سياسة|استرداد|رسوم|كيف|متى)/i;

// === RET-SİNYALİ TEK-KAYNAK (FIX4 / CİLA 2026-07-25) — B-6 CONFIRMING ret ===
// detectNegativeResponse ANCHORED (^hayır$) → "onaylamıyorum"/"reddediyorum" gibi
// ret-FİİLLERİNİ kaçırıyordu → ret yutulup tarih-listesi (yanlış bağlam) basılıyordu.
// Unanchored, 7-dil bare-negatif + ret-fiil aileleri (çekim-toleranslı \p{L}* stem).
// ASCII \b YOK — \p{L}\p{N} lookbehind. Fiil stem'leri (onaylam[ıi]yorum) POZİTİFİ
// ("onaylıyorum") ASLA yakalamaz — "onaylam" pozitifte yok. FP-DİSİPLİNİ: bu RE B-6'da
// DAL1'DEN SONRA çalışır → "hayır 3 kişiyiz" (ret+değer) önce DAL1'e (değer-uygula)
// düşer; B-6 yalnız SAF reddi (değersiz) yakalar → _l2HasNewValue önceliği korunur.
const _REJECT_SIGNAL_RE = /(?<![\p{L}\p{N}])(?:hay[ıi]r|yok|olmaz|istemiyorum|onaylam[ıi]yorum|redded\p{L}*|kabul\s*etmiyorum|vazge[çc]\p{L}*|no|nope|nah|reject\p{L}*|refus\p{L}*|disagree|don['’]?t\s*(?:confirm|approve|accept|agree)|nein|nö|ablehn\p{L}*|lehne|nicht\s*best[äa]tig\p{L}*|stimme\s*nicht|non|n['’e]\s*(?:confirme|accepte)|pas\s*d['’e]?\s*accord|rechaz\p{L}*|no\s*(?:acepto|confirmo)|нет|отказ\p{L}*|не\s*подтвержда\p{L}*|не\s*соглас\p{L}*|не\s*принима\p{L}*|أرفض|رفض|لا\s*أوافق|لا\s*أؤكد|لا)(?![\p{L}\p{N}])/iu;

// COMPLETED çıplak-iptal teyit sorusu (§35-6 pendingCancelConfirm SET)
const _CANCEL_CONFIRM_Q: Record<string, string> = {
  tr: "Rezervasyonunuzu iptal etmek mi istiyorsunuz?",
  en: "Would you like to cancel your reservation?",
  de: "Möchten Sie Ihre Reservierung stornieren?",
  fr: "Souhaitez-vous annuler votre réservation ?",
  es: "¿Desea cancelar su reserva?",
  ru: "Вы хотите отменить ваше бронирование?",
  ar: "هل ترغب في إلغاء حجزك؟",
};
// RET ack'i (rezervasyon geçerli)
const _CANCEL_REJECT_ACK: Record<string, string> = {
  tr: "Anladım, rezervasyonunuz geçerli 👍 Başka bir konuda yardımcı olabilir miyim?",
  en: "Understood, your reservation is still valid 👍 Is there anything else I can help with?",
  de: "Verstanden, Ihre Reservierung bleibt gültig 👍 Kann ich Ihnen sonst noch helfen?",
  fr: "Compris, votre réservation reste valable 👍 Puis-je vous aider pour autre chose ?",
  es: "Entendido, su reserva sigue vigente 👍 ¿Puedo ayudarle en algo más?",
  ru: "Понял, ваше бронирование остаётся в силе 👍 Могу ли я помочь чем-то ещё?",
  ar: "فهمت، حجزك ما زال ساري المفعول 👍 هل يمكنني مساعدتك في شيء آخر؟",
};

// İptal-talebini AÇ (complaints) + ack döndür — J-14 gövdesi buraya çıkarıldı,
// hem J-14 (rezervasyon-kelimeli) hem pendingCancelConfirm-onayı çağırır (TEK yol).
async function _fileCancellationRequest(
  context: any, agency: any, supabase: any, adapter: any, message: string,
): Promise<string> {
  const _ri = (context.reservationInfo || {}) as any;
  const _summary =
    `İPTAL TALEBİ — Tur: ${_ri.tourTitle || context.currentTour?.title || "?"} | ` +
    `Tarih: ${_ri.selectedDate || "?"} | Kişi: ${_ri.paxAdult ?? "?"} | ` +
    `İsim: ${_ri.fullName || "?"} | Tel: ${_ri.phone || "?"} | Müşteri mesajı: "${message.slice(0, 200)}"`;
  supabase.from("complaints").insert({
    agency_id: agency.id,
    phone: adapter.identifier,
    message: _summary,
    type: "cancellation_request",
    status: "new",
  }).then(() => {});
  // CİLA-2 İŞ4 (2026-07-26): telefon-eki 7-dil TEK-KAYNAK. Eski hâlde de/fr/es/ru/ar
  // hepsi İngilizce _agPhoneCxlEn kullanıyordu → RU/AR müşteri İngilizce "You can also
  // reach us at…" görüyordu (canlıda 2 kez). _agencyPhoneSuffix (tek-kaynak 📞 no) korunur.
  const _pn = agency.phone_public ? _agencyPhoneSuffix(agency.phone_public) : "";
  const _psByLang: Record<string, string> = agency.phone_public ? {
    tr: ` Dilerseniz${_pn} numarasından da ulaşabilirsiniz.`,
    en: ` You can also reach us at${_pn}.`,
    de: ` Sie können uns auch unter${_pn} erreichen.`,
    ru: ` Вы также можете связаться с нами по${_pn}.`,
    ar: ` يمكنك أيضاً التواصل معنا على${_pn}.`,
    fr: ` Vous pouvez aussi nous joindre au${_pn}.`,
    es: ` También puede contactarnos en${_pn}.`,
  } : { tr: "", en: "", de: "", ru: "", ar: "", fr: "", es: "" };
  const _ps = (l: string) => _psByLang[l] ?? _psByLang.en;
  const _cxlMsgs: Record<string, string> = {
    tr: `İptal talebinizi acentemize ilettim. En kısa sürede sizinle iletişime geçilecek.${_ps("tr")}`,
    en: `I've forwarded your cancellation request to our agency. They will contact you shortly.${_ps("en")}`,
    de: `Ich habe Ihre Stornierungsanfrage an unsere Agentur weitergeleitet. Sie werden in Kürze kontaktiert.${_ps("de")}`,
    ru: `Я передал ваш запрос на отмену в наше агентство. С вами свяжутся в ближайшее время.${_ps("ru")}`,
    ar: `لقد أحلت طلب الإلغاء إلى وكالتنا. سيتم التواصل معك قريباً.${_ps("ar")}`,
    fr: `J'ai transmis votre demande d'annulation à notre agence. Vous serez contacté sous peu.${_ps("fr")}`,
    es: `He enviado su solicitud de cancelación a nuestra agencia. Se pondrán en contacto con usted en breve.${_ps("es")}`,
  };
  return _cxlMsgs[context.language] || _cxlMsgs.en;
}

// === PAKET-B (2026-07-25): CONFIRMING hibrit-düzeltme TEK-KAYNAK ===
// Özet etiketleri (DAL1 + pendingFieldUpdateConfirm-apply ortak).
const _CONFIRM_LABELS: Record<string, { tour: string; date: string; pax: string; adult: string; child: string; name: string; phone: string; reask: string }> = {
  tr: { tour: "Tur",     date: "Tarih",   pax: "Kişi sayısı", adult: "yetişkin",    child: "çocuk",   name: "Ad-Soyad", phone: "Telefon",   reask: "Bilgileri güncelledim. Onaylıyor musunuz? ✅" },
  en: { tour: "Tour",    date: "Date",    pax: "People",      adult: "adult",       child: "child",   name: "Name",     phone: "Phone",     reask: "I've updated the details. Do you confirm? ✅" },
  de: { tour: "Tour",    date: "Datum",   pax: "Personen",    adult: "Erwachsener", child: "Kind",    name: "Name",     phone: "Telefon",   reask: "Ich habe die Angaben aktualisiert. Bestätigen Sie? ✅" },
  ru: { tour: "Тур",     date: "Дата",    pax: "Человек",     adult: "взрослый",    child: "ребёнок", name: "Имя",      phone: "Телефон",   reask: "Я обновил данные. Подтверждаете? ✅" },
  ar: { tour: "الجولة", date: "التاريخ", pax: "عدد الأشخاص", adult: "بالغ",        child: "طفل",     name: "الاسم",    phone: "الهاتف",    reask: "تم تحديث البيانات. هل تؤكد؟ ✅" },
  fr: { tour: "Circuit", date: "Date",    pax: "Personnes",   adult: "adulte",      child: "enfant",  name: "Nom",      phone: "Téléphone", reask: "J'ai mis à jour les informations. Confirmez-vous ? ✅" },
  es: { tour: "Tour",    date: "Fecha",   pax: "Personas",    adult: "adulto",      child: "niño",    name: "Nombre",   phone: "Teléfono",  reask: "He actualizado los datos. ¿Confirma? ✅" },
};

// Güncellenmiş reservationInfo → özet+💰 (reask hariç; çağıran ekler). Fiyat live tours'tan
// (completion/CONFIRMING ile AYNI _reservationTotalText → tutar tutarlı).
async function _buildUpdatedSummary(
  updated: any, currentTour: any, lang: string, tours: any[], agency: any, languageCurrencies: any,
): Promise<string> {
  const L = _CONFIRM_LABELS[lang] || _CONFIRM_LABELS.tr;
  const _tourTitle = currentTour ? getLocalizedTourTitle(currentTour.title || "", lang) : "";
  const _dateText = updated.selectedDate ? formatDateForLanguage(updated.selectedDate, lang) : "";
  const _paxAdult = updated.paxAdult ?? "";
  const _paxChild = updated.paxChild;
  const _paxText = _paxAdult !== ""
    ? (typeof _paxChild === "number" && _paxChild > 0 ? `${_paxAdult} ${L.adult}, ${_paxChild} ${L.child}` : `${_paxAdult}`)
    : "";
  const _confTour = tours.find((t: any) => t.id === (currentTour?.id || updated.tourId));
  const _confDate = _confTour?.dates?.find((d: any) => d.id === updated.dateId);
  const _total = await _reservationTotalText(
    Number(_paxAdult) || 0, typeof _paxChild === "number" ? _paxChild : 0,
    _confDate?.price_adult || 0, _confDate?.price_child,
    _confTour?.currency || "TRY", lang, agency.show_multi_currency !== false, languageCurrencies,
  );
  // B-C1 (2026-07-27): tarih YOKSA satır atlanmaz — "henüz seçilmedi" basılır.
  // KÖK: red-sonrası "özet"te tarih-satırı sessizce kaybolunca LLM history'den
  // silinmiş tarihi dolduruyordu; deterministik "seçilmedi" hem doğru bilgi verir
  // hem bayat-tarih görünümünü keser. Dolu-tarih davranışı BİREBİR aynı.
  const _dateNotSel: Record<string, string> = {
    tr: "henüz seçilmedi", en: "not selected yet", de: "noch nicht ausgewählt",
    fr: "pas encore choisie", es: "aún no seleccionada", ru: "ещё не выбрана", ar: "لم يُحدَّد بعد",
  };
  return [
    _tourTitle ? `📋 ${L.tour}: *${_tourTitle}*` : "",
    _dateText  ? `📅 ${L.date}: ${_dateText}`    : `📅 ${L.date}: ${_dateNotSel[lang] || _dateNotSel.tr}`,
    _paxText   ? `👥 ${L.pax}: ${_paxText}`      : "",
    updated.fullName ? `👤 ${L.name}: ${updated.fullName}` : "",
    updated.phone    ? `📱 ${L.phone}: ${updated.phone}`   : "",
    _total ? `💰 ${_TOTAL_LABELS[lang] || _TOTAL_LABELS.en}: *${_total}*` : "",
  ].filter(Boolean).join("\n");
}

// §35-7 değer-echo teyit soruları (BELİRSİZ düşük-güven değeri için).
const _FIELD_UPDATE_Q: Record<string, Record<string, (v: string) => string>> = {
  pax: {
    tr: (v) => `Kişi sayısını *${v}* yapayım mı? (evet/hayır)`, en: (v) => `Set the number of people to *${v}*? (yes/no)`,
    de: (v) => `Personenzahl auf *${v}* setzen? (ja/nein)`, fr: (v) => `Mettre le nombre de personnes à *${v}* ? (oui/non)`,
    es: (v) => `¿Cambiar el número de personas a *${v}*? (sí/no)`, ru: (v) => `Изменить количество человек на *${v}*? (да/нет)`,
    ar: (v) => `هل أجعل عدد الأشخاص *${v}*؟ (نعم/لا)`,
  },
  name: {
    tr: (v) => `Adı *${v}* olarak mı güncelleyeyim? (evet/hayır)`, en: (v) => `Update the name to *${v}*? (yes/no)`,
    de: (v) => `Name auf *${v}* aktualisieren? (ja/nein)`, fr: (v) => `Mettre le nom à *${v}* ? (oui/non)`,
    es: (v) => `¿Actualizar el nombre a *${v}*? (sí/no)`, ru: (v) => `Изменить имя на *${v}*? (да/нет)`,
    ar: (v) => `هل أحدّث الاسم إلى *${v}*؟ (نعم/لا)`,
  },
  date: {
    tr: (v) => `Tarihi *${v}* yapayım mı? (evet/hayır)`, en: (v) => `Change the date to *${v}*? (yes/no)`,
    de: (v) => `Datum auf *${v}* ändern? (ja/nein)`, fr: (v) => `Changer la date pour *${v}* ? (oui/non)`,
    es: (v) => `¿Cambiar la fecha a *${v}*? (sí/no)`, ru: (v) => `Изменить дату на *${v}*? (да/нет)`,
    ar: (v) => `هل أغيّر التاريخ إلى *${v}*؟ (نعم/لا)`,
  },
  phone: {
    tr: (v) => `Telefonu *${v}* olarak mı güncelleyeyim? (evet/hayır)`, en: (v) => `Update the phone to *${v}*? (yes/no)`,
    de: (v) => `Telefon auf *${v}* aktualisieren? (ja/nein)`, fr: (v) => `Mettre le téléphone à *${v}* ? (oui/non)`,
    es: (v) => `¿Actualizar el teléfono a *${v}*? (sí/no)`, ru: (v) => `Изменить телефон на *${v}*? (да/нет)`,
    ar: (v) => `هل أحدّث الهاتف إلى *${v}*؟ (نعم/لا)`,
  },
};

export async function processChatMessage(input: ProcessMessageInput): Promise<ProcessMessageResult> {
  const { message: rawMessage, adapter, agency, supabase, tours, paymentInstructions, languageCurrencies, primaryCurrency, returningUserName, seedLanguage } = input;

  // === 1. INPUT UZUNLUK KONTROLÜ ===
  if (isInputTooLong(rawMessage)) {
    const _tlLang = detectLanguageChangeIntent(rawMessage.slice(0, 200)) || "tr";
    const _tlMsgs: Record<string, string> = {
      tr: "Mesajınız çok uzun, lütfen daha kısa bir mesaj gönderin (maksimum 2000 karakter).",
      en: "Your message is too long. Please send a shorter message (max 2000 characters).",
      de: "Ihre Nachricht ist zu lang. Bitte senden Sie eine kürzere Nachricht (max. 2000 Zeichen).",
      ru: "Ваше сообщение слишком длинное. Отправьте более короткое сообщение (макс. 2000 символов).",
      ar: "رسالتك طويلة جداً، يرجى إرسال رسالة أقصر (الحد الأقصى 2000 حرف).",
      fr: "Votre message est trop long, veuillez envoyer un message plus court (max 2000 caractères).",
      es: "Su mensaje es demasiado largo, envíe un mensaje más corto (máx. 2000 caracteres).",
    };
    await adapter.sendErrorResponse(_tlMsgs[_tlLang] || _tlMsgs.tr);
    return { success: false, error: "input_too_long" };
  }

  // 2026-07-09 Faz 5 B (AR rakam sınıfı): Arapça-Hint (٠-٩ U+0660-0669) ve
  // Doğu-Arapça/Farsça (۰-۹ U+06F0-06F9) rakamlar GİRİŞ NOKTASINDA ASCII'ye
  // normalize edilir — TÜM downstream zincir (\d regex'leri: pax, tarih,
  // ordinal, telefon, NLU girdisi) tek noktadan kapsanır. Denetim kanıtı:
  // "١٠ ديسمبر" hiçbir tarih/pax zincirinde çözülmüyordu (tüm \d ASCII-only).
  const message = sanitizeInput(rawMessage).replace(/[٠-٩۰-۹]/g, (d) => {
    const c = d.charCodeAt(0);
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
  });

  // K4: Prompt injection şüphesi tespiti — mesaj engellenmez, sadece flag set edilir
  const _isSuspectedInjection = detectInjection(rawMessage);
  if (_isSuspectedInjection) {
    console.warn("[process-message] K4: Suspected prompt injection detected:", rawMessage.slice(0, 30) + "… (len=" + rawMessage.length + ")");
  }

  // _save: saveTransaction varsa atomik (user+assistant+ctx), yoksa sadece assistant+ctx
  const _save = (reply: string, ctx: ConversationContext): Promise<void> =>
    adapter.saveTransaction
      ? adapter.saveTransaction(message, reply, ctx)
      : adapter.saveResponse(reply, ctx);

  // === 2. CONTEXT YÜKLE ===
  // KATMAN 1: loadContext artık { context, stale? } döner. Stale varsa visible reset + early return.
  const _loadResult = await adapter.loadContext();
  const loadedContext = _loadResult.context;

  // === 3. DİL TESPİTİ ===
  // Öncelik: explicit "english please" intent > karakter tabanlı script > frontend seedLanguage (demo dropdown).
  // seedLanguage WhatsApp'ta yok; demo-chat'te kullanıcının i18n.language seçimi.
  // Bu hiyerarşi sayesinde ASCII metinli ilk mesajda da doğru dilde cevap üretilir.
  const languageChangeIntent = detectLanguageChangeIntent(message);
  const runtimeDetectedLang = detectLanguage(message);

  // === SORUN 4: enabled_languages yetkilendirme yardımcıları ===
  // Acente enabled_languages boşsa/tanımsızsa kısıtlama yok (null = tüm diller serbest)
  const _enabledLangs: string[] | null = (Array.isArray(agency.enabled_languages) && (agency.enabled_languages as string[]).length > 0)
    ? (agency.enabled_languages as string[])
    : null;
  const _isLangEnabled = (lang: string): boolean =>
    _enabledLangs === null || _enabledLangs.includes(lang);
  // Tespit edilen dil kapalıysa → acentenin ilk açık diline veya "tr"'ye düş
  const _bestLang = (detected: string): string =>
    _isLangEnabled(detected) ? detected : (_enabledLangs?.[0] ?? "tr");

  // === KATMAN 1: STALE STATE GÖRÜNÜR RESET ===
  // Eski davranış: loadContext null dönerse sessizce fresh context + AI çalışırdı.
  // AI history'i okuyup eski yarım rezervasyon bilgilerini sızdırırdı ("müsait değil" saçmalığı).
  // Yeni davranış: stale sentinel varsa kullanıcıya AÇIK mesaj + AI'ya hiç gitme (history sızıntısı kesilir).
  if (_loadResult.stale) {
    const _stale = _loadResult.stale;
    // FIX: Frontend explicit dil (demo dropdown) > açık dil değiştirme niyeti > script-based
    // tespit > stale'in son dili > "tr". Önceki sıralama lastLanguage'i ilk koyuyordu, bu da
    // kullanıcı bayatlamadan beri dili değiştirmişse stale reset'i eski dilde yapıyordu.
    const _seedHere = seedLanguage && (Array.isArray(agency.enabled_languages) && agency.enabled_languages.length > 0
      ? agency.enabled_languages.includes(seedLanguage)
      : true) ? seedLanguage : undefined;
    const _lang = _bestLang(languageChangeIntent || runtimeDetectedLang || _seedHere || _stale.lastLanguage || "tr");
    const _agPhone = _agencyPhoneSuffix(agency.phone_public);

    // Yarım rezervasyon vardıysa: "iptal edildi, baştan başlayalım" — kullanıcı tarihi/pax'ı yeniden seçmeli
    // Yarım rezervasyon yoksa: yumuşak "tekrar hoş geldiniz" — kullanıcı muhtemelen yeni iş için yazıyor
    const _hadReservation = _stale.hadReservationInProgress;
    const _resetMsgs: Record<string, string> = _hadReservation
      ? {
          // FIX3: "iptal edildi" YOK (DB'de kayıt hiç oluşmadı) → oturum-zaman-aşımı çerçevesi.
          tr: `Oturumunuz zaman aşımına uğradı (${_stale.ageMinutes} dakikadır yanıt alınmadı). Kaldığınız yerden yeniden başlayalım — hangi tur ilginizi çeker?${_agPhone}`,
          en: `Your session has timed out (no response for ${_stale.ageMinutes} minutes). Let's pick up again — which tour interests you?${_agPhone}`,
          de: `Ihre Sitzung ist abgelaufen (keine Antwort seit ${_stale.ageMinutes} Minuten). Machen wir weiter — welche Tour interessiert Sie?${_agPhone}`,
          ru: `Время сессии истекло (нет ответа ${_stale.ageMinutes} мин.). Продолжим — какой тур вас интересует?${_agPhone}`,
          ar: `انتهت مهلة جلستك (لا استجابة منذ ${_stale.ageMinutes} دقيقة). لنكمل من جديد — ما الجولة التي تهمك؟${_agPhone}`,
          fr: `Votre session a expiré (pas de réponse depuis ${_stale.ageMinutes} minutes). Reprenons — quel circuit vous intéresse ?${_agPhone}`,
          es: `Su sesión ha expirado (sin respuesta durante ${_stale.ageMinutes} minutos). Continuemos — ¿qué tour le interesa?${_agPhone}`,
        }
      : {
          tr: `Tekrar hoş geldiniz! 👋 Size nasıl yardımcı olabilirim?${_agPhone}`,
          en: `Welcome back! 👋 How can I help you?${_agPhone}`,
          de: `Willkommen zurück! 👋 Wie kann ich Ihnen helfen?${_agPhone}`,
          ru: `С возвращением! 👋 Чем могу помочь?${_agPhone}`,
          ar: `أهلاً بعودتك! 👋 كيف يمكنني مساعدتك؟${_agPhone}`,
          fr: `Bon retour ! 👋 Comment puis-je vous aider ?${_agPhone}`,
          es: `¡Bienvenido de nuevo! 👋 ¿Cómo puedo ayudarle?${_agPhone}`,
        };
    const _resetReply = _resetMsgs[_lang] || _resetMsgs.tr;
    // Fresh context — yeni stage GREETING/BROWSING'e dönmüş gibi
    const _freshCtx = createInitialContext(_lang, getDefaultToneForLanguage(_lang) as any);
    _freshCtx.collectEmail = agency.collect_email === true;
    console.log(`[process-message] L1 stale reset: lastStage=${_stale.lastStage} age=${_stale.ageMinutes}min hadReservation=${_hadReservation}`);
    await _save(_resetReply, _freshCtx);
    await adapter.sendResponse(_resetReply);
    return { success: true, response: _resetReply, newContext: _freshCtx };
  }

  // === 4. CONTEXT BAŞLAT / GÜNCELLE ===
  // FIX: seedLanguage (frontend explicit) — detection'ı yenmek için. Demo dropdown'unda
  // kullanıcı "EN" seçtiyse ve mesaj saf ASCII İngilizce ise detection null döner; eskiden
  // ilk mesajda TR'ye düşüyordu, ikinci mesajda NLU dili düzeltiyordu (one-message delay).
  const _effectiveSeed = seedLanguage && _isLangEnabled(seedLanguage) ? seedLanguage : undefined;

  let context: ConversationContext;
  if (loadedContext) {
    context = loadedContext;
    if (languageChangeIntent && languageChangeIntent !== context.language) {
      // Müşteri açıkça dil değiştirdi — sadece acentenin açtığı dillere izin ver
      if (_isLangEnabled(languageChangeIntent)) {
        _traceLang(context, "explicit", languageChangeIntent, message);
        context.language = languageChangeIntent;
        context.tone = getDefaultToneForLanguage(languageChangeIntent) as any;
      }
    } else if (runtimeDetectedLang && runtimeDetectedLang !== context.language) {
      const _hasNonAscii = /[^\x00-\x7F]/.test(message);
      const _isShortMsg = message.length < 200;
      // CİLA-3 A-guard (2026-07-26, trace-kanıtlı `1:char:de>tr`): TR-PAYLAŞILAN-AKSAN.
      // detectLanguage TR'yi İLK kontrol eder; ü/ö/ç DE(ü/ö)/FR(ç) ile paylaşılır →
      // DE akışında "Ich möchte" (ö) TR sanılıp yerleşik dili eziyordu. Mid-flow'da
      // yerleşik dil tr-DEĞİLKEN "tr" tespiti yalnız TR-UNIQUE harfle (ı/ş/ğ/İ/Ş/Ğ)
      // yazabilir. (P3 kalem-4'ün new-context kuralının loadedContext simetriği.)
      const _trSharedOnly = runtimeDetectedLang === "tr" && context.language !== "tr" && !/[ışğİŞĞ]/.test(message);
      if ((_hasNonAscii || _isShortMsg) && !_trSharedOnly) {
        if (_isLangEnabled(runtimeDetectedLang)) {
          _traceLang(context, "char", runtimeDetectedLang, message);
          context.language = runtimeDetectedLang;
        }
        // Aksi hâlde mevcut context.language'ı koru (acente bu dili açmamış)
      }
    }
    // CİLA-3 D-SİL (2026-07-26, trace-kanıtlı `5:seed-mid:ar>tr:0` — Murat demo AR/DE
    // vakalarının KÖKÜ): mid-flow seed-override dalı KALDIRILDI. Site UI'ı TR olan
    // kullanıcı (body.language="tr" her turn) AR/DE akışı koşarken tek harfsiz turn'de
    // (telefon no) yerleşik dil koşulsuz TR'ye eziliyordu → CONFIRMING özeti TR+₺-only.
    // İNVARYANT: seed YALNIZ context doğumunda kullanılır (aşağıdaki else dalı);
    // yerleşik konuşma dili UI-diliyle ASLA ezilmez. Dropdown'ı mid-flow değiştiren
    // kullanıcı yeni dilde yazınca char/NLU-pending mekanizması geçişi yapar.
  } else {
    // Yeni context: explicit change > script-based > frontend seed > tr.
    let _detectedLang = languageChangeIntent || runtimeDetectedLang || _effectiveSeed || "tr";
    // 2026-07-09 FAZ4-P3 (kalem 4): detectLanguage TR'yi İLK kontrol eder ve ü/ö/ç
    // TR ile DE(ü/ö)/FR(ç) PAYLAŞILIR → "günstigste" (ü) TR sanılıp explicit seed'i
    // (DE dropdown) eziyor → erken katman (X8) TR şablon basıyordu. FIX: "tr" tespiti
    // mesajda TR-UNIQUE harf (ı/ş/ğ/İ/Ş/Ğ) YOKKEN geldiyse (yani yalnız paylaşılan
    // ü/ö/ç'den) ve explicit+enabled seed farklıysa → seed otorite. Clear-TR (ışğ var)
    // ve clear-other tespiti bozulmaz; seed yoksa (WhatsApp) etkilenmez; enabled gate
    // _bestLang'de korunur.
    if (runtimeDetectedLang === "tr" && _effectiveSeed && _effectiveSeed !== "tr" && !/[ışğİŞĞ]/.test(message)) {
      _detectedLang = _effectiveSeed;
      console.log(`[process-message] P3-dil: belirsiz "tr" tespiti (TR-unique harf yok) → explicit seed=${_effectiveSeed} otorite`);
    }
    const lang = _bestLang(_detectedLang);
    context = createInitialContext(lang, getDefaultToneForLanguage(lang) as any);
    (context as any)._langTrace = [`0:init:>${lang}:${/\p{L}/u.test(message) ? "L" : "0"}`];
  }

  // Agency email toplama ayarını her mesajda sync et (admin toggle anlık etki etsin)
  context.collectEmail = agency.collect_email === true;

  // === KATMAN 3: ERKEN REVALIDATION ===
  // Stale değil ama reservationInfo.dateId set → seçilen tarih hâlâ geçerli mi?
  // Mevcut Check B (line ~570) sadece RPC öncesi çalışıyordu — kullanıcı yarım yolda
  // "müsait" gibi davranıp son adımda "müsait değil" şokuyla karşılaşıyordu.
  // Bunu BAŞA çekerek tarih dolduysa/silindiyse erken haber ver + alternatif tarihleri öner.
  //
  // FIX (A1): COMPLETED state'de ATLA. Bu blok YARIM rezervasyon içindir
  // (COLLECTING_INFO/CONFIRMING/TOUR_SELECTED). COMPLETED finalize edilmiş bir
  // rezervasyondur; tarihinin geçmiş olması çözülmesi gereken bir sorun değil,
  // "geçmiş bir gezi"dir. Eskiden blok COMPLETED'de tetikleniyor, dateId'yi temizleyip
  // tourId'yi (Antalya) koruyor, stage'i COLLECTING_INFO+waiting_for_date yapıyordu →
  // kullanıcı eski tura kilitleniyor, çıkamıyordu. "Önceki tura kilitlenme" bug'ının
  // PRIMARY kök sebebi buydu.
  if (context.stage !== "COMPLETED" && context.reservationInfo?.dateId && context.reservationInfo?.tourId) {
    const _resTour = tours.find((t: any) => t.id === context.reservationInfo!.tourId);
    const _resDate = _resTour?.dates?.find((d: any) => d.id === context.reservationInfo!.dateId);
    const _today = new Date().toISOString().slice(0, 10);
    const _isPast = _resDate && _resDate.departure_date < _today;
    const _quotaFull = _resDate && (_resDate.remaining_quota ?? _resDate.quota ?? 1) <= 0;
    const _stillValid = _resTour && _resDate && !_isPast && !_quotaFull;

    if (!_stillValid) {
      console.log("[process-message] L3 early revalidation FAIL:", {
        hasTour: !!_resTour, hasDate: !!_resDate, isPast: _isPast, quotaFull: _quotaFull,
        tourId: context.reservationInfo.tourId, dateId: context.reservationInfo.dateId,
      });

      // Alternatif tarihleri topla (sadece geçmemiş + kontenjanı olan)
      const _alts = (_resTour?.dates || [])
        .filter((d: any) => d.id !== context.reservationInfo!.dateId
          && d.departure_date >= _today
          && (d.remaining_quota ?? d.quota ?? 1) > 0)
        .slice(0, 5);
      const _altList = _alts.length > 0
        ? "\n\n" + _alts.map((d: any, i: number) => {
            const _dt = d.departure_date;
            const _pr = d.price_adult ? ` – ${d.price_adult.toLocaleString("tr-TR")} ${(_resTour as any).currency || "TRY"}` : "";
            return `${i + 1}) ${_dt}${_pr}`;
          }).join("\n")
        : "";

      // reservationInfo'daki tarihi temizle — kullanıcı yeni tarih seçecek
      // Tur kalsın (kullanıcı aynı tura ilgileniyor olabilir)
      context.reservationInfo = {
        ...context.reservationInfo,
        dateId: undefined,
        selectedDate: undefined,
      };
      context.stage = "COLLECTING_INFO";
      context.collectionStep = "waiting_for_date";
      context.reservationConfirmed = false;

      const _revLang = context.language || "tr";
      const _revalMsgs: Record<string, string> = {
        tr: `Seçtiğiniz tarih artık mevcut değil veya kontenjan dolmuş. ${_resTour ? `*${_resTour.title}* için` : ""} müsait tarihler:${_altList || "\n\nŞu anda başka müsait tarih bulunmuyor. Lütfen başka bir tur seçer misiniz?"}`,
        en: `The date you selected is no longer available or fully booked. Available dates ${_resTour ? `for *${_resTour.title}*` : ""}:${_altList || "\n\nNo other dates available right now. Could you pick another tour?"}`,
        de: `Das gewählte Datum ist nicht mehr verfügbar oder ausgebucht. Verfügbare Termine ${_resTour ? `für *${_resTour.title}*` : ""}:${_altList || "\n\nAktuell keine weiteren Termine verfügbar. Bitte wählen Sie eine andere Tour."}`,
        ru: `Выбранная дата больше недоступна или полностью забронирована. Доступные даты ${_resTour ? `для *${_resTour.title}*` : ""}:${_altList || "\n\nДругих доступных дат нет. Выберите другой тур, пожалуйста."}`,
        ar: `التاريخ المحدد لم يعد متاحاً أو محجوزاً بالكامل. التواريخ المتاحة ${_resTour ? `لـ *${_resTour.title}*` : ""}:${_altList || "\n\nلا توجد تواريخ متاحة أخرى حالياً. يرجى اختيار جولة أخرى."}`,
        fr: `La date sélectionnée n'est plus disponible ou complète. Dates disponibles ${_resTour ? `pour *${_resTour.title}*` : ""}:${_altList || "\n\nAucune autre date disponible. Veuillez choisir un autre circuit."}`,
        es: `La fecha seleccionada ya no está disponible o está completa. Fechas disponibles ${_resTour ? `para *${_resTour.title}*` : ""}:${_altList || "\n\nNo hay otras fechas disponibles. Por favor elija otro tour."}`,
      };
      const _revalReply = _revalMsgs[_revLang] || _revalMsgs.tr;
      await _save(_revalReply, context);
      await adapter.sendResponse(_revalReply);
      return { success: true, response: _revalReply, newContext: context };
    }
  }

  // === P4-3 (2026-07-28): TUR-DIŞI TALEP-YAKALAMA — FSM-ÖNCESİ, DETERMİNİSTİK ===
  // Çift-şart tespit (lead-detection tek-kaynak); NLU'ya güvenilmez. 3 giriş-noktası:
  // (A) pendingLeadCapture 2. adım (akış-dışı telefon-toplama devamı),
  // (B) akış-İÇİ/COMPLETED: 9b-A deseni — kısa-ack + lead-kaydı (isim/tel STATE'ten,
  //     yeniden sorulmaz), STATE'E DOKUNULMAZ (akış kaldığı adımdan sürer),
  // (C) akış-DIŞI: identifier gerçek-telefonsa (WhatsApp) direkt kaydet; değilse
  //     (demo session-id) pendingLeadCapture ile TEK-tekrar telefon iste.
  {
    const _leadLang = context.language || "tr";
    const _idIsPhone = /^\+?\d{8,15}$/.test(String(adapter.identifier || "").replace(/[\s.-]/g, ""));
    const _insertLead = async (req: string, phone: string | null, name: string | null) => {
      const { error: _le } = await supabase.from("agency_leads").insert({
        agency_id: agency.id, phone, full_name: name,
        request_text: req.slice(0, 1000), source_stage: context.stage, status: "new",
      });
      if (_le) {
        console.error("[P4-3 lead] insert failed:", _le.message);
        // W3-b: sessiz yutma YOK — panel "Sistem Hataları"na düşsün.
        await logCritical({
          event: "LEAD_INSERT_FAIL",
          error: _le.message,
          context: { stage: context.stage, channel: adapter.channel, hasPhone: !!phone },
          agencyId: agency.id,
          severity: "error",
        }).catch(() => {});
      } else {
        console.log(`[P4-3 lead] kaydedildi (stage=${context.stage}, phone=${phone ? "var" : "yok"})`);
      }
      return !_le;
    };

    const _leadCatalog = {
      currentTourTitle: context.currentTour?.title,
      tourTitles: (tours || []).map((t: any) => t?.title).filter(Boolean),
      destinations: (tours || []).map((t: any) => t?.destination).filter(Boolean),
    };

    // (A) W3-EK (2026-07-29): DETAY adımı — taslak kayıt ZATEN açık (kayıp yok).
    // Gelen mesaj: (a) TUR bağlamı/alakasız → taslak MEVCUT metinle kesinleşir,
    // pending temizlenir ve NORMAL AKIŞ SÜRER (return YOK); (b) aksi halde DETAY
    // sayılır → request_text güncellenir (+ telefon varsa doldurulur) → "ilettim".
    // ÇİFT-TASLAK KURALI: detay-penceresinde gelen İKİNCİ tur-dışı istek de DETAY
    // sayılır (TEK lead'e birleşir) — acenteye tek iş düşer; pencere kapandıktan
    // sonraki yeni istek AYRI lead açar.
    if (context.pendingLeadCapture) {
      const _pend = context.pendingLeadCapture;
      const _unrelated = isTourContextMessage(message, _leadCatalog);
      if (!_unrelated) {
        const _pm = message.match(/\+?\d[\d\s.\-()]{7,17}\d/);
        const _phone = _pm ? _pm[0].replace(/[^\d+]/g, "") : null;
        const _merged = `${_pend.request} — Detay: ${message}`.slice(0, 1000);
        let _okA = true;
        if (_pend.leadId) {
          const _upd: any = { request_text: _merged };
          if (_phone) _upd.phone = _phone;
          const { error: _ue } = await supabase.from("agency_leads").update(_upd).eq("id", _pend.leadId);
          if (_ue) {
            console.error("[W3-EK lead] detay güncelleme başarısız:", _ue.message);
            await logCritical({ event: "LEAD_DETAIL_UPDATE_FAIL", error: _ue.message, context: { leadId: _pend.leadId }, agencyId: agency.id, severity: "warning" }).catch(() => {});
            // Taslak kayıt DURUYOR → müşteriye yine "ilettim" demek DOĞRU (yalan değil).
          }
        } else {
          // Taslak açılamamıştı (eski akış/insert hatası) → şimdi yazmayı dene.
          _okA = await _insertLead(_merged, _phone, context.reservationInfo?.fullName || null);
        }
        const _ctxA = { ...context, pendingLeadCapture: undefined, lastUserMessage: message, messageCount: context.messageCount + 1 };
        const _replyA = _okA ? (LEAD_SAVED[_leadLang] || LEAD_SAVED.tr) : (LEAD_FAILED[_leadLang] || LEAD_FAILED.tr);
        await _save(_replyA, _ctxA);
        await adapter.sendResponse(_replyA);
        return { success: true, response: _replyA, newContext: _ctxA };
      }
      // (a) alakasız/tur-sorusu → taslak mevcut metinle kesinleşti; akış devam etsin.
      console.log("[W3-EK lead] detay yerine tur-bağlamı geldi → taslak kesinleşti, akış sürüyor");
      (context as any).pendingLeadCapture = undefined;
    }

    // (B)+(C) yeni tespit
    if (detectOutOfScopeLead(message, _leadCatalog)) {
      const _info: any = context.reservationInfo || {};
      const _inFlow = !!_info.tourId && ["COLLECTING_INFO", "CONFIRMING"].includes(context.stage);
      const _phoneFromState = _info.phone || (_idIsPhone ? String(adapter.identifier) : null);

      // (B) YALNIZ REZERVASYON-İÇİ: kısa ack + akışa dön, DETAY SORULMAZ (akış bölünmez).
      // W3-EK NOT: ayrım "telefon biliniyor mu" DEĞİL "akış içinde mi" — WhatsApp'ta
      // telefon her zaman bilinir; eski koşul yüzünden akış-dışı WhatsApp kullanıcısına
      // detay hiç sorulamazdı (canlı W3 vakası tam buydu: BROWSING + telefon var).
      if (_inFlow) {
        // W3-b: önce YAZ, sonra vaat et.
        const _okB = await _insertLead(message, _phoneFromState, _info.fullName || null);
        const _replyB = !_okB
          ? `${LEAD_FAILED[_leadLang] || LEAD_FAILED.tr}\n\n${LEAD_RESUME[_leadLang] || LEAD_RESUME.tr}`
          : `${LEAD_ACK[_leadLang] || LEAD_ACK.tr}\n\n${LEAD_RESUME[_leadLang] || LEAD_RESUME.tr}`;
        const _ctxB = { ...context, lastUserMessage: message, messageCount: context.messageCount + 1 };
        await _save(_replyB, _ctxB);
        await adapter.sendResponse(_replyB);
        return { success: true, response: _replyB, newContext: _ctxB };
      }

      // (C) W3-EK: akış-DIŞI → TASLAK kaydı HEMEN aç (müşteri hiç cevap vermese bile
      // talep kaybolmaz), sonra DETAY iste. Telefon bilinmiyorsa detay+telefon birlikte.
      const { data: _draft, error: _de } = await supabase
        .from("agency_leads")
        .insert({
          agency_id: agency.id, phone: _phoneFromState, full_name: _info.fullName || null,
          request_text: message.slice(0, 1000), source_stage: context.stage, status: "new",
        })
        .select("id")
        .single();
      if (_de) {
        console.error("[W3-EK lead] taslak açılamadı:", _de.message);
        await logCritical({ event: "LEAD_INSERT_FAIL", error: _de.message, context: { stage: context.stage, channel: adapter.channel, draft: true }, agencyId: agency.id, severity: "error" }).catch(() => {});
        const _replyF = LEAD_FAILED[_leadLang] || LEAD_FAILED.tr;
        const _ctxF = { ...context, lastUserMessage: message, messageCount: context.messageCount + 1 };
        await _save(_replyF, _ctxF);
        await adapter.sendResponse(_replyF);
        return { success: true, response: _replyF, newContext: _ctxF };
      }
      console.log(`[W3-EK lead] taslak açıldı id=${_draft?.id?.slice(0, 8)} → detay isteniyor`);
      const _ctxC = {
        ...context,
        pendingLeadCapture: { request: message, leadId: _draft?.id },
        lastUserMessage: message,
        messageCount: context.messageCount + 1,
      };
      const _replyC = _phoneFromState
        ? (LEAD_ASK_DETAIL[_leadLang] || LEAD_ASK_DETAIL.tr)
        : (LEAD_ASK_DETAIL_PHONE[_leadLang] || LEAD_ASK_DETAIL_PHONE.tr);
      await _save(_replyC, _ctxC);
      await adapter.sendResponse(_replyC);
      return { success: true, response: _replyC, newContext: _ctxC };
    }
  }

  // FIX 4: önceki stage'i AI prompt'una ver (demo-chat ile davranış paritesi)
  const previousContext = { ...context };

  // === 5. HISTORY YÜKLE (NLU + AI için) ===
  // B3 + token optimizasyonu: 10 mesajla sınırla. Daha önce 20'ydi; FSM zaten seçili tur/tarih/pax/
  // isim/telefon gibi YAPISAL state'i `context` üzerinden taşıyor, history sadece üslup ve son
  // 1-2 turluk bağlam için. Tipik rezervasyon 10-12 mesaj sürüyor; 10 mesaj son birkaç turluk
  // bağlamı her zaman kapsar. Çağrı başına ~300 token tasarruf (history hem Sonnet hem NLU input'una giriyor).
  // 2026-06-24 FIX A1: history cutoff (S1/S2/S3 conversation history kirlenmesi).
  // context.historyCutoffAt CONFIRMING→COMPLETED action'da set edilir → bu zamandan
  // SONRAKİ mesajlar döner. Eski rezervasyon history'si NLU/LLM'e GİTMEZ.
  // Geriye dönük güvenlik: historyCutoffAt undefined ise adapter filter atlar.
  const historyAsc = await adapter.loadHistory(10, context.historyCutoffAt);

  // === 6. NLU CONTEXT + ANALIZ ===
  const historySummary = historyAsc.map((m) => `${m.role}: ${m.content}`).join("\n");
  const nluContextStr = (historySummary ? historySummary + "\n\n" : "") + buildNLUContextBase(context);

  const nluResult = await analyzeUserMessage(message, nluContextStr, context.stage, context.currentTour, tours);
  console.log("[process-message] Intent:", nluResult.intent, "| Stage:", context.stage, "| Lang:", context.language);

  // === P3 (kalem 5): AKIŞ-ORTASI ASCII DİL GEÇİŞİ (MUHAFAZAKÂR) ===
  // Salt-ASCII uzun mesajda char-tespiti (detectLanguage) null döner → char-switch
  // (L172-178) çalışmaz. NLU language alanı otorite ama TEK mesajla geçme YOK
  // (yanlış-tetik: "Antalya Rafting olsun" gibi İngilizce tur adı). Şart: NLU-lang
  // farklı + enabled + salt-ASCII → 1. turn pending'e yaz, 2. ARDIŞIK aynı → sessiz
  // geç. Ara sinyal → pending temizlenir. Yalnız context.language/tone; state'e dokunmaz.
  {
    const _nluLang = (nluResult as any).language;
    const _msgAscii = !/[^\x00-\x7F]/.test(message);
    // CİLA-3 B-guard (2026-07-26, trace-kanıtlı `5:pending:tr>de:0`): HARFSİZ turn
    // (telefon no / rakam-pax) pending'i NE SET NE COMPLETE NE CLEAR eder — FREEZE.
    // Eski hâlde 2 ardışık harfsiz-ASCII turn (pax "2" + telefon) NLU'nun harfsiz
    // mesaja döndürdüğü rasgele dille sessiz-flip yapabiliyordu (WhatsApp EN vakası
    // sınıfı). Dil-sinyali yalnız HARFLİ mesajdan gelir (invariant).
    const _plsLetters = /\p{L}/u.test(message);
    if (!_plsLetters) {
      // harfsiz turn: pending dondurulur (dokunma)
    } else if (_nluLang && _nluLang !== context.language && _isLangEnabled(_nluLang) && _msgAscii) {
      if (context.pendingLangSwitch === _nluLang) {
        // 2. ardışık aynı-farklı-dil → SESSİZ GEÇİŞ (görünür onay cümlesi YOK).
        _traceLang(context, "pending", _nluLang, message);
        context.language = _nluLang;
        context.tone = getDefaultToneForLanguage(_nluLang) as any;
        context.pendingLangSwitch = undefined;
        console.log(`[process-message] P3 akış-ortası dil geçişi (2 ardışık ASCII ${_nluLang}) — sessiz`);
      } else {
        context.pendingLangSwitch = _nluLang; // 1. turn — ardışıklık bekleniyor
      }
    } else if (context.pendingLangSwitch) {
      context.pendingLangSwitch = undefined; // ardışıklık bozuldu (harfli farklı-sinyal)
    }
  }

  // === 6b. A GATE — NLU fullName tour-leak savunma (2026-06-20 Sorun 2) ====
  // Canlı bug (execution e9fc320d): kullanıcı waiting_for_name adımında
  // "efes turuna geçelim" yazdı → NLU CRITICAL RULE'u ihlal etti, fullName=
  // "Efes Turuna Geçelim" çıkardı → state'e isim olarak yazıldı → bot
  // "Teşekkürler Efes!" diye seslendi, isim adımını atladı.
  //
  // Bu gate LLM'den BAĞIMSIZ. NLU sistem prompt'u (CRITICAL RULE) birinci
  // savunma; bu gate ikinci ve deterministik savunma. DAR mantık: sadece
  // fullName kelimelerinde TOUR_KEYWORD_STOPWORDS (turu/turuna/tour/ausflug
  // /...) varsa REDDET. Verb listesine bakmaz, gerçek soyadları (Geçer/Alıcı)
  // etkilemez. Karışık mesaj korunur: "ben Murat Yılmaz, Antalya turuna
  // geçelim" → NLU doğru parse ederse fullName="Murat Yılmaz" → leak=false.
  if (nluResult.updates?.fullName) {
    const _leak = nluResult.updates.fullName;
    if (isNluFullNameTourLeak(_leak)) {
      console.log(
        `[process-message] BLOCKED NLU fullName tour-leak: "${String(_leak).charAt(0)}***" (len=${String(_leak).length})`,
      );
      delete nluResult.updates.fullName;
      if (nluResult.entities) {
        (nluResult.entities as any).full_name = "";
      }
    } else if (isNluFullNameGiveUpLeak(_leak)) {
      // M1 (2026-07-27): NLU give-up sızıntısı — canlı DE "Vergiss Es"/FR "Laisse
      // Tomber" (J-16'nın NLU-simetriği). Tam-kompozisyon vazgeçme-token'ı → REDDET;
      // isim yazılmaz, akış (detectCancellation/LLM) normal yoluna devam eder.
      console.log(
        `[process-message] BLOCKED NLU fullName giveup-leak: "${String(_leak).charAt(0)}***" (len=${String(_leak).length})`,
      );
      delete nluResult.updates.fullName;
      if (nluResult.entities) {
        (nluResult.entities as any).full_name = "";
      }
    } else if (isNluFullNameNegationLeak(_leak)) {
      // 2026-06-21 Sorun F (K3 katman): her durumda negation sigortası.
      // K2 (nlu.ts:432) 4+ word + negation reddi yaptı; K3 burada 2-word
      // edge'leri ("Ahmet Değil") + sanity. Murat onayı (2026-06-21):
      // "Değil" diye soyad yok → 2-word edge kasıtlı reddedilir.
      console.log(
        `[process-message] BLOCKED NLU fullName negation-leak: "${String(_leak).charAt(0)}***" (len=${String(_leak).length})`,
      );
      delete nluResult.updates.fullName;
      if (nluResult.entities) {
        (nluResult.entities as any).full_name = "";
      }
    }
  }

  // NLU dil tespitini uygula (ASCII guard + enabled_languages kontrolü)
  // FIX (ASCII-only ilk mesaj): WhatsApp'ta seedLanguage yok; yabancı turist ilk
  // mesajı saf ASCII (örn. "I want to book a tour") yazınca karakter-tabanlı
  // detection null dönüyor ve "tr" fallback'a düşülüyordu. NLU dili context.language
  // ile guard'lı eşitlemede, uzun ASCII mesaj (≥200 char) _hasNonAscii=false +
  // _isShortMsg=false yüzünden override edilemiyordu — bu da "1 mesaj gecikme"
  // davranışı yaratıyordu (ilk mesaj TR, ikinci mesajda dil düzeliyor).
  // Çözüm: ilk mesajda (messageCount===0, yeni context) NLU dilini her zaman kabul et
  // — bu noktada başka dil sinyali zaten yok, NLU dili otorite. Whitelist korunur.
  if (nluResult.language) {
    const SUPPORTED = ["tr", "en", "de", "ru", "ar", "fr", "es"];
    // CİLA-2 İŞ1 (2026-07-26): DİL-LESS mesaj (telefon no / saf rakam / emoji — HARF YOK)
    // yerleşik context.language'ı EZEMEZ. KÖK: WhatsApp'ta EN akışın telefon-turn'ünde
    // (CONFIRMING'e geçiş) NLU dilsiz "05329991307" için "tr" döndürüyor → context.language
    // EN→TR flip → CONFIRMING özeti TR + ₺-only (TR para=TRY, dual çöker); sonraki "yes"
    // turn'ünde NLU "en" → completion EN+$. İki kanal-tutarsızlığı (demo NLU bağlam-duyarlı
    // "en" döndüğünden flip etmiyordu). Guard: harfsiz mesaj dil-otoritesi taşımaz →
    // özet/kur akışın geri kalanıyla AYNI stabil context.language'dan gelir. FIX4 C1 korunur
    // (harfli yabancı mesaj — "I want to book" — flip eder). ASCII \b YOK, \p{L} lookaround-suz.
    const _msgHasLetter = /\p{L}/u.test(message);
    // CİLA-3 C-daralt (2026-07-26, trace-kanıtlı ping-pong `nlu:tr>de` her turn):
    // NLU tek-turn dil-yazması YALNIZ İLK MESAJDA (messageCount===0 — C1 davranışı:
    // ASCII yabancı ilk mesaj gecikmesiz doğru dile oturur; uzunluk-kapısız).
    // MID-FLOW NLU dil-farkı ARTIK BURADAN YAZILMAZ — o iş §35 pendingLangSwitch'in
    // (2 ardışık harfli-ASCII turn, yukarıda) + char-detect'in (unique-script) +
    // explicit-intent'in. Tek-turn NLU yanlış-tespiti ("John Smith"→"tr" sınıfı)
    // yerleşik dili artık süremez → CONFIRMING özeti stabil dil/kur kaynağından.
    const _isFirstMessage = context.messageCount === 0;
    if (SUPPORTED.includes(nluResult.language) && nluResult.language !== context.language && _msgHasLetter && _isFirstMessage) {
      if (_isLangEnabled(nluResult.language)) {
        _traceLang(context, "nlu-first", nluResult.language, message);
        context.language = nluResult.language;
        // İlk mesajda tone'u da NLU diline göre re-set et.
        context.tone = getDefaultToneForLanguage(nluResult.language) as any;
        // İlk-mesaj yazımı pending'i geçersiz kılar (aynı-turn çifte-işlem önlemi).
        context.pendingLangSwitch = undefined;
      } else {
        // Acente bu dili açmamış — mevcut dili koru
        console.log(`[process-message] S4: Detected lang ${nluResult.language} not in enabled_languages (${_enabledLangs}), keeping ${context.language}`);
      }
    }
  }

  let fsmIntent = mapNLUIntentToFSMIntent(nluResult.intent);

  // Şikayet kaydı (fire-and-forget)
  if (nluResult.intent === "complaint_feedback") {
    supabase.from("complaints").insert({ agency_id: agency.id, phone: adapter.identifier, message, type: "complaint", status: "new" }).then(() => {});
  }

  // 2026-06-23 Sorun D: orijinal tur ID'sini sakla — sonraki bypass'ların hangi
  // turdan değiştiğini bilmesi için. Erken-müdahale context.currentTour'u mutate
  // ediyor (line ~373), state-machine transition newContext.currentTour'u
  // değiştiriyor. Her iki yolda da bu orijinal ID karşılaştırma kaynağı.
  const _originalTourId = context.currentTour?.id;

  // ============================================================================
  // === NİTELİK ÖN-TESPİT KATMANI (X8 + B1 + B-TEMA) — 2026-06-26 R4 MİMARİ ====
  // ============================================================================
  // Konum: fsmIntent map SONRASI, findMatchingTours/extractAllInfo/FSM ÖNCESİ.
  //
  // Mimari kanıt (Bug 1/2/3 canlı kanıt):
  //   Bug 3 — "2 kişi için 3000 bütçem var" → eski konumda B1 (L1003) ÇOK GEÇTİ:
  //     L529 extractAllInfo pax=2 çıkarıyor
  //     L870 FSM geçişi stage=COLLECTING_INFO'ya alıyor
  //     B1 stage guard FALSE → atlanır → "ad soyad?" mesajı
  //   KÖK ÇÖZÜM: B1'i tüm state-değiştirici katmanların ÖNÜNE taşı (BU KATMAN).
  //   Bu sayede:
  //     - tour-matching ÇALIŞMAZ → unknownTourQuery üretilmez
  //     - extractAllInfo ÇALIŞMAZ → pax çıkmaz, rezervasyon akışına kaçmaz
  //     - FSM geçişi ÇALIŞMAZ → stage mutasyonu yok
  //
  // Stage-bağımsız: pattern eşleşmesi YETERLİ filtre (Murat ilke 3 mimari uygulaması).
  // Kullanıcı hangi stage'de olursa olsun fiyat/superlatif/tema sorabilir.
  // ----------------------------------------------------------------------------

  // --- STAGE GUARD: YENİ KATMAN SADECE KEŞİF AŞAMASINDA ÇALIŞIR ---
  // 2026-06-26 R5 telefon bug fix: rezervasyon adımında (COLLECTING_INFO) kullanıcı
  // telefon/pax/isim girer — fiyat sorgusu DEĞİL. Eski R4'te stage-bağımsız guard
  // "05445655656" telefonunu 54456-55656 fiyat aralığı sanıp rezervasyonu böldü.
  // Kök çözüm: nitelik ön-tespit katmanı SADECE keşif (GREETING/BROWSING/TOUR_SELECTED)
  // aşamasında çalışsın. Bu Bug 3'ü (taşıma sayesinde extractAllInfo'dan önce çalışıyor)
  // hâlâ çözer çünkü "2 kişi 3000 bütçem" GREETING/BROWSING'de gelir → B1 yakalar.
  const _isExploreStage = context.stage === "GREETING"
      || context.stage === "BROWSING"
      || context.stage === "TOUR_SELECTED";

  // === V5 ZENGİN-MESAJ GUARD'I (2026-07-09) — filtre dalları öncesi ortak ===
  // Canlı (N-31): "biz 4 kişilik bir aileyiz 10 aralıkta pamukkaleye gelmek
  // istiyoruz..." → "aile" B-TEMA'yı tetikledi, TÜM mesaj (tur+tarih+pax) yutuldu.
  // Filtre dalları (X8/B1/B-DUR/B-TEMA) LİSTE üretir; kullanıcı SPESİFİK tur/
  // rezervasyon istiyorsa liste YANLIŞ. Ucuz ön-kontrol:
  //   _richTourName (spesifik tur adı) → 4 dalı da atlat (en güçlü sinyal)
  //   _richDate → B-TEMA'yı ek atlat (tema en gevşek; tema+tarih ≈ rezervasyon)
  // Pax TEK BAŞINA gate DEĞİL — B1 "3000 bütçe 2 kişi" vakası korunur.
  const _msgLowerRich = (message || "").toLocaleLowerCase("tr-TR");
  const _richTourName = tours.some((t: any) => {
    const _dest = String(t.destination || "").toLocaleLowerCase("tr-TR").trim();
    if (_dest.length >= 4 && _msgLowerRich.includes(_dest)) return true;
    const _tw = String(t.title || "").toLocaleLowerCase("tr-TR").split(/\s+/).filter((w: string) => w.length >= 5);
    return _tw.some((w: string) => _msgLowerRich.includes(w));
  });
  const _richDate = new RegExp(`\\d{1,2}[.\\/-]\\d{1,2}|(?<![\\p{L}\\p{N}])(${MONTH_ALTERNATION})`, "iu").test(message || "");
  if (_richTourName) {
    console.log(`[filter-guard] Zengin mesaj — filtre dalı atlandı (sinyal: tur-adı)`);
  } else if (_richDate) {
    console.log(`[filter-guard] Zengin mesaj — B-TEMA atlandı (sinyal: tarih)`);
  }

  // --- X8: SUPERLATİF FİYAT (en ucuz / en pahalı) ---
  // LLM (Haiku) sayı karşılaştırmada güvenilmez. Pattern eşleşince tours array
  // price_adult'a göre sıralanır, deterministik mesaj döner.
  // 2026-07-09 FAZ4-P1: TR+EN → 7-dil. ASC (ucuz) / DESC (pahalı) yön eşlemesi
  // dil-başı doğru. RU superlatif "самый деш/дорог" + "дешевле/дороже всего";
  // "дорог" tek başına 'yol' ile karışır → "самый\s+дорог" ile anchor'lı.
  // CİLA-4-C (2026-07-26): FR kapsam genişletme — canlıda FR sorgusu X8'i ıskalayıp
  // LLM'e düşünce kur uyduruluyordu (25€). abordable/bon marché/meilleur marché eklendi.
  const _superlativeAsc = /(?<![\p{L}\p{N}])(en\s+(ucuz|uygun|hesaplı|hesapli|düşük|dusuk)|cheapest|lowest\s+price|least\s+expensive|günstigste|guenstigste|billigste|preiswerteste|(?:le\s+)?moins\s+cher|(?:le\s+)?plus\s+abordable|bon\s+march[ée]|meilleur\s+march[ée]|m[áa]s\s+barat[oa]|m[áa]s\s+econ[óo]mic[oa]|самый\s+деш[её]в[\p{L}]*|дешевле\s+всего|(?:ال)?أرخص|أرخص)(?![\p{L}\p{N}])/iu;
  const _superlativeDesc = /(?<![\p{L}\p{N}])(en\s+(pahalı|pahali|yüksek|yuksek)|most\s+expensive|highest\s+price|priciest|teuerste|(?:le\s+)?plus\s+cher|m[áa]s\s+car[oa]|самый\s+дорог[\p{L}]*|дороже\s+всего|(?:ال)?أغلى|أغلى)(?![\p{L}\p{N}])/iu;
  const _matchesAsc = _superlativeAsc.test(message);
  const _matchesDesc = _superlativeDesc.test(message);
  // KÖK-5 (2026-07-25): COMPLETED'da da X8 (en ucuz/pahalı) deterministik cevaplasın —
  // eskiden yalnız explore-stage'di, COMPLETED dışlaması R5-fix'inin kaza-eseri kalıntısıydı.
  // _isExploreStage'in KENDİSİ genişletilmez (B1 bütçe-parseri COMPLETED'a girip telefon/
  // dekont numaralarını fiyat-aralığı sanabilir — R5 bug). X8 return context'i MUTATE ETMEZ
  // (aşağıda newContext: context) → after-sales state (reservationConfirmed/reservationInfo) korunur.
  const _x8StageOk = _isExploreStage || context.stage === "COMPLETED";
  if (_x8StageOk && !_richTourName && (_matchesAsc || _matchesDesc) && tours.length > 0) {
    // CİLA-4-C: turun fiyatı dates[0] DEĞİL — yöne göre tarihler-arası MIN (en ucuz)
    // / MAX (en pahalı). dates[0] sıra-drift'inde (geçmiş tarih düşünce) yanlış fiyat
    // basıyordu (kur tutarsızlığı GÖRÜNÜMÜ: aynı tur farklı koşumda farklı ₺-taban).
    const _toursPriced = tours
      .map((t: any) => {
        const _ps = (t.dates || []).map((d: any) => d?.price_adult).filter((p: any) => typeof p === "number" && p > 0);
        return { tour: t, price: _ps.length ? (_matchesDesc ? Math.max(..._ps) : Math.min(..._ps)) : undefined };
      })
      .filter((x: any) => typeof x.price === "number" && x.price > 0);
    if (_toursPriced.length > 0) {
      _toursPriced.sort((a: any, b: any) =>
        _matchesDesc ? b.price - a.price : a.price - b.price
      );
      const _top = _toursPriced[0];
      const _lang = context.language || "tr";
      const _topTitle = getLocalizedTourTitle(_top.tour.title || "", _lang);
      const _exRatesX8 = await getExchangeRatesOnce().catch(() => ({}));
      const _showDualX8 = agency.show_multi_currency !== false;
      const _priceTextX8 = formatPriceSync(
        _top.price,
        _top.tour.currency || "TRY",
        _lang,
        _exRatesX8,
        _showDualX8,
        languageCurrencies,
      );
      const _superlativeMsgs: Record<string, { cheapest: string; expensive: string }> = {
        tr: {
          cheapest:  `En uygun fiyatlı turumuz *${_topTitle}* — ${_priceTextX8} (kişi başı). Hakkında bilgi almak ister misiniz? 😊`,
          expensive: `En pahalı turumuz *${_topTitle}* — ${_priceTextX8} (kişi başı). Hakkında bilgi almak ister misiniz? 😊`,
        },
        en: {
          cheapest:  `Our most affordable tour is *${_topTitle}* — ${_priceTextX8} (per person). Would you like more info? 😊`,
          expensive: `Our most expensive tour is *${_topTitle}* — ${_priceTextX8} (per person). Would you like more info? 😊`,
        },
        de: {
          cheapest:  `Unsere günstigste Tour ist *${_topTitle}* — ${_priceTextX8} (pro Person). Möchten Sie mehr Infos? 😊`,
          expensive: `Unsere teuerste Tour ist *${_topTitle}* — ${_priceTextX8} (pro Person). Möchten Sie mehr Infos? 😊`,
        },
        fr: {
          cheapest:  `Notre circuit le moins cher est *${_topTitle}* — ${_priceTextX8} (par personne). Plus d'informations ? 😊`,
          expensive: `Notre circuit le plus cher est *${_topTitle}* — ${_priceTextX8} (par personne). Plus d'informations ? 😊`,
        },
        es: {
          cheapest:  `Nuestro tour más económico es *${_topTitle}* — ${_priceTextX8} (por persona). ¿Más información? 😊`,
          expensive: `Nuestro tour más caro es *${_topTitle}* — ${_priceTextX8} (por persona). ¿Más información? 😊`,
        },
        ru: {
          cheapest:  `Самый доступный тур — *${_topTitle}* — ${_priceTextX8} (с человека). Хотите больше информации? 😊`,
          expensive: `Самый дорогой тур — *${_topTitle}* — ${_priceTextX8} (с человека). Хотите больше информации? 😊`,
        },
        ar: {
          cheapest:  `أوفر جولة لدينا *${_topTitle}* — ${_priceTextX8} (للشخص). هل تريد المزيد من المعلومات؟ 😊`,
          expensive: `أغلى جولة لدينا *${_topTitle}* — ${_priceTextX8} (للشخص). هل تريد المزيد من المعلومات؟ 😊`,
        },
      };
      const _msgSet = _superlativeMsgs[_lang] || _superlativeMsgs.tr;
      const _x8Reply = _matchesDesc ? _msgSet.expensive : _msgSet.cheapest;
      console.log(`[process-message] X8 superlatif fiyat: ${_matchesDesc ? "DESC (en pahalı)" : "ASC (en ucuz)"} → ${_top.tour.title} (${_top.price})`);
      await _save(_x8Reply, context);
      await adapter.sendResponse(_x8Reply);
      return { success: true, response: _x8Reply, newContext: context };
    }
  }

  // --- B1: FİYAT ARALIĞI / BÜTÇE ---
  // R1: pattern + 7 dil. R2: bütçe/budget genişletme. R3: agresif fallback.
  // R4 (BU): mimari taşıma — stage-bağımsız, extractAllInfo/FSM öncesi.
  const _priceRangePats: RegExp[] = [
    /(\d{2,6})\s*(?:tl|₺)?\s*(?:ile|ila|ve|-|–|—|to|and)\s*(\d{2,6})\s*(?:tl|₺)?\s*(?:aras[ıi])?/i,
    /between\s+(\d{2,6})\s+(?:and|to)\s+(\d{2,6})/i,
    /zwischen\s+(\d{2,6})\s+und\s+(\d{2,6})/i,
    /entre\s+(\d{2,6})\s+(?:et|y)\s+(\d{2,6})/i,
    /между\s+(\d{2,6})\s+и\s+(\d{2,6})/i,
    /بين\s+(\d{2,6})\s+و\s*(\d{2,6})/i,
  ];
  const _priceMaxPats: RegExp[] = [
    /(\d{2,6})\s*(?:tl|₺)?\s*alt[ıi](?:n(?:da?)?)?/i,
    /(\d{2,6})\s*(?:tl|₺)?\s*(?:aşağ[ıi]|aşağıs[ıi])/i,
    /(\d{2,6})['’]?\s*[eaıi]?\s+kadar/i,
    /(?:en\s+fazla|max(?:imum)?)\s+(\d{2,6})/i,
    /b[üu]t[çc]e[mn]?\s+(\d{2,6})/i,
    /(\d{2,6})\s*(?:tl|₺)?\s*b[üu]t[çc]e[mn]?/i,
    /budget(?:\s+(?:is|of|de|von))?\s+(\d{2,6})/i,
    /(\d{2,6})\s*(?:tl|₺)?\s*budget/i,
    /presupuesto\s+(?:de\s+)?(\d{2,6})/i,
    /бюджет\s+(?:в\s+)?(\d{2,6})/i,
    /ميزانية\s*(?:قدرها\s+)?(\d{2,6})/i,
    /(\d{2,6})\s*(?:and\s+)?(?:below|under|or\s+less)/i,
    /(?:up\s+to|less\s+than|max(?:imum)?)\s+(\d{2,6})/i,
    /bis\s+(?:zu\s+)?(\d{2,6})/i,
    /unter\s+(\d{2,6})/i,
    /jusqu['’]\s*à\s+(\d{2,6})/i,
    /moins\s+de\s+(\d{2,6})/i,
    /hasta\s+(\d{2,6})/i,
    /menos\s+de\s+(\d{2,6})/i,
    /до\s+(\d{2,6})/i,
    /менее\s+(\d{2,6})/i,
    /حتى\s+(\d{2,6})/i,
    /أقل\s+من\s+(\d{2,6})/i,
  ];
  const _priceMinPats: RegExp[] = [
    /(\d{2,6})\s*(?:tl|₺)?\s*(?:[üu]st[üu]|[üu]st[üu]nde?|[üu]zerinde?)/i,
    /(\d{2,6})['’]?\s*[dn]?[ae]n?\s+(?:fazla|y[üu]ksek)/i,
    /(?:over|above|more\s+than)\s+(\d{2,6})/i,
    /(\d{2,6})\s*(?:or\s+more|and\s+up)/i,
    /über\s+(\d{2,6})/i,
    /mehr\s+als\s+(\d{2,6})/i,
    /plus\s+de\s+(\d{2,6})/i,
    /más\s+de\s+(\d{2,6})/i,
    /более\s+(\d{2,6})/i,
    /أكثر\s+من\s+(\d{2,6})/i,
  ];

  let _priceLower: number | null = null;
  let _priceUpper: number | null = null;
  let _priceMatched = false;

  // R5: stage guard GERİ EKLENDİ (telefon bug fix). Pattern + fallback rezervasyon
  // adımında ÇALIŞMAMALI — keşif aşamasında (GREETING/BROWSING/TOUR_SELECTED) çalışır.
  // 2026-07-09 V5: spesifik tur adı varsa B1 liste değil rezervasyon → atla.
  if (_isExploreStage && !_richTourName && tours.length > 0) {
    for (const p of _priceRangePats) {
      const m = message.match(p);
      if (m && m[1] && m[2]) {
        const a = parseInt(m[1], 10);
        const b = parseInt(m[2], 10);
        if (a >= 100 && b >= 100) {
          _priceLower = Math.min(a, b);
          _priceUpper = Math.max(a, b);
          _priceMatched = true;
          break;
        }
      }
    }
    if (!_priceMatched) {
      for (const p of _priceMaxPats) {
        const m = message.match(p);
        if (m && m[1]) {
          const v = parseInt(m[1], 10);
          if (v >= 100) { _priceUpper = v; _priceMatched = true; break; }
        }
      }
    }
    if (!_priceMatched) {
      for (const p of _priceMinPats) {
        const m = message.match(p);
        if (m && m[1]) {
          const v = parseInt(m[1], 10);
          if (v >= 100) { _priceLower = v; _priceMatched = true; break; }
        }
      }
    }
    // KÖK FALLBACK (R3'ten aynı — 2+ sayı bağlam-bağımsız, 1 sayı + ctx şart)
    // 2026-06-26 R5 FIX: \b word boundary eklendi. "05445655656" gibi bitişik 11+
    // hane telefon numaralarını fiyat sanıp aralık üretmesin (canlı bug kanıtı).
    // Bitişik diziler word-boundary olmadığından match etmez; ayrı sayı token'ları
    // ("3000 ile 5000") match eder. Stage guard ile çift-katmanlı koruma.
    if (!_priceMatched) {
      const _nums = Array.from(message.matchAll(/\b\d{3,6}\b/g))
        .map((m) => parseInt(m[0], 10))
        .filter((n) => n >= 100 && n <= 100000);
      if (_nums.length >= 2) {
        _priceLower = Math.min(_nums[0], _nums[1]);
        _priceUpper = Math.max(_nums[0], _nums[1]);
        _priceMatched = true;
        console.log(`[process-message] B1 KÖK FALLBACK (range, contextless): nums=${_nums.slice(0, 2)}`);
      } else if (_nums.length === 1) {
        // D1-4 (CİLA-PARİTE-1): NET-fiyat edatları (tarih cümlesinde geçmez) — her zaman.
        // Yeni: de günstiger, ru дешевле|бюджет, ar ميزانية (mevcut de/ru/ar edatları zaten vardı).
        const _priceCtxRe = /b[üu]t[çc]e|tl|₺|lira|budget|under|over|less\s+than|more\s+than|cheaper|expensive|up\s+to|hasta|menos|m[áa]s|moins|plus\s+de|unter|über|günstiger|более|менее|дешевле|бюджет|أقل|أكثر|ميزانية/iu;
        // BELİRSİZ edatlar (hem fiyat hem TARİH/süre: до 5000=bütçe, до 15 aralık=tarih).
        // YALNIZ ay-adı YOKKEN fiyat-sinyali. (Eskiden bunlar guard'sızdı → "до 15 декабря
        // 2026"da yıl→sayı çakışması riski; ay-guard bunu kapatır.) B1 zaten \d{3,6} şartlı.
        const _priceCtxAmbig = /(?<![\p{L}\p{N}])(alt[ıi]|aşağ[ıi]|[üu]st[üu]|[üu]zeri|fazla|kadar|aras[ıi]|ila|between|entre|jusqu|bis|zwischen|до|от|между|حتى|بين)(?![\p{L}\p{N}])|ile\s+\d|ve\s+\d/iu;
        const _priceHasMonth = new RegExp(`(?<![\\p{L}\\p{N}])(?:${MONTH_ALTERNATION})(?![\\p{L}\\p{N}])`, "iu").test(message);
        if (_priceCtxRe.test(message) || (!_priceHasMonth && _priceCtxAmbig.test(message))) {
          _priceUpper = _nums[0];
          _priceMatched = true;
          console.log(`[process-message] B1 KÖK FALLBACK (upper, with ctx): num=${_nums[0]}`);
        }
      }
    }
  }

  if (_priceMatched) {
    const _priced = tours
      .map((t: any) => ({ tour: t, price: t.dates?.[0]?.price_adult }))
      .filter((x: any) => typeof x.price === "number" && x.price > 0);
    const _filtered = _priced.filter((x: any) => {
      if (_priceLower !== null && x.price < _priceLower) return false;
      if (_priceUpper !== null && x.price > _priceUpper) return false;
      return true;
    }).sort((a: any, b: any) => a.price - b.price);

    const _exRatesB1 = await getExchangeRatesOnce().catch(() => ({}));
    const _showDualB1 = agency.show_multi_currency !== false;
    const _langB1 = context.language || "tr";

    const _summary: Record<string, string> =
      _priceLower !== null && _priceUpper !== null
        ? { tr: `${_priceLower}-${_priceUpper}₺`, en: `${_priceLower}-${_priceUpper} TRY`, de: `${_priceLower}-${_priceUpper} TRY`, fr: `${_priceLower}-${_priceUpper} TRY`, es: `${_priceLower}-${_priceUpper} TRY`, ru: `${_priceLower}-${_priceUpper} TRY`, ar: `${_priceLower}-${_priceUpper} TRY` }
        : _priceUpper !== null
        ? { tr: `${_priceUpper}₺ altı`, en: `under ${_priceUpper} TRY`, de: `unter ${_priceUpper} TRY`, fr: `moins de ${_priceUpper} TRY`, es: `menos de ${_priceUpper} TRY`, ru: `до ${_priceUpper} TRY`, ar: `أقل من ${_priceUpper} TRY` }
        : { tr: `${_priceLower}₺ üstü`, en: `over ${_priceLower} TRY`, de: `über ${_priceLower} TRY`, fr: `plus de ${_priceLower} TRY`, es: `más de ${_priceLower} TRY`, ru: `более ${_priceLower} TRY`, ar: `أكثر من ${_priceLower} TRY` };

    if (_filtered.length === 0) {
      const _cheapest = _priced.sort((a: any, b: any) => a.price - b.price)[0];
      let _b1NoneReply: string;
      if (_cheapest) {
        const _priceText = formatPriceSync(_cheapest.price, _cheapest.tour.currency || "TRY", _langB1, _exRatesB1, _showDualB1, languageCurrencies);
        const _topTitle = getLocalizedTourTitle(_cheapest.tour.title || "", _langB1);
        const _noneMsgs: Record<string, string> = {
          tr: `${_summary.tr} bütçesine uygun turumuz yok. En uygun fiyatlı turumuz *${_topTitle}* — ${_priceText} (kişi başı). 😊`,
          en: `We don't have a tour in the ${_summary.en} range. Our most affordable tour is *${_topTitle}* — ${_priceText} (per person). 😊`,
          de: `Wir haben keine Tour im Bereich ${_summary.de}. Unsere günstigste Tour ist *${_topTitle}* — ${_priceText} (pro Person). 😊`,
          fr: `Nous n'avons pas de circuit dans la fourchette ${_summary.fr}. Notre circuit le moins cher est *${_topTitle}* — ${_priceText} (par personne). 😊`,
          es: `No tenemos un tour en el rango ${_summary.es}. Nuestro tour más económico es *${_topTitle}* — ${_priceText} (por persona). 😊`,
          ru: `У нас нет тура в диапазоне ${_summary.ru}. Самый доступный тур — *${_topTitle}* — ${_priceText} (с человека). 😊`,
          ar: `لا توجد جولة في نطاق ${_summary.ar}. أوفر جولة لدينا *${_topTitle}* — ${_priceText} (للشخص). 😊`,
        };
        _b1NoneReply = _noneMsgs[_langB1] || _noneMsgs.tr;
      } else {
        const _fallbacks: Record<string, string> = {
          tr: `Bu bütçeye uygun turumuz şu anda yok. Lütfen acentemizle iletişime geçin.`,
          en: `We don't have a tour matching that budget right now. Please contact our agency.`,
          de: `Derzeit keine Tour in diesem Budget. Bitte kontaktieren Sie unsere Agentur.`,
          fr: `Aucun circuit dans ce budget actuellement. Contactez notre agence.`,
          es: `No hay tours en ese presupuesto ahora. Contacte nuestra agencia.`,
          ru: `Сейчас нет туров в этом бюджете. Свяжитесь с агентством.`,
          ar: `لا توجد جولات في هذه الميزانية حالياً. يرجى التواصل مع وكالتنا.`,
        };
        _b1NoneReply = _fallbacks[_langB1] || _fallbacks.tr;
      }
      console.log(`[process-message] B1 fiyat aralığı: lower=${_priceLower} upper=${_priceUpper} → eşleşme YOK`);
      await _save(_b1NoneReply, context);
      await adapter.sendResponse(_b1NoneReply);
      return { success: true, response: _b1NoneReply, newContext: context };
    }

    const _listLinesB1 = _filtered.slice(0, 8).map((x: any, i: number) => {
      const _priceText = formatPriceSync(x.price, x.tour.currency || "TRY", _langB1, _exRatesB1, _showDualB1, languageCurrencies);
      return `${i + 1}) ${getLocalizedTourTitle(x.tour.title || "", _langB1)} — ${_priceText}`;
    }).join("\n");

    const _b1Msgs: Record<string, string> = {
      tr: `${_summary.tr} bütçenize uygun turlarımız:\n${_listLinesB1}\n\nHangisi ilginizi çeker? 😊`,
      en: `Tours within your ${_summary.en} budget:\n${_listLinesB1}\n\nWhich interests you? 😊`,
      de: `Touren in Ihrem Budget (${_summary.de}):\n${_listLinesB1}\n\nWelche interessiert Sie? 😊`,
      fr: `Circuits dans votre budget (${_summary.fr}) :\n${_listLinesB1}\n\nLequel vous intéresse ? 😊`,
      es: `Tours dentro de tu presupuesto (${_summary.es}):\n${_listLinesB1}\n\n¿Cuál te interesa? 😊`,
      ru: `Туры в вашем бюджете (${_summary.ru}):\n${_listLinesB1}\n\nКакой вас интересует? 😊`,
      ar: `جولات ضمن ميزانيتك (${_summary.ar}):\n${_listLinesB1}\n\nأيها يثير اهتمامك؟ 😊`,
    };
    const _b1Reply = _b1Msgs[_langB1] || _b1Msgs.tr;
    console.log(`[process-message] B1 fiyat aralığı: lower=${_priceLower} upper=${_priceUpper} matches=${_filtered.length}`);
    await _save(_b1Reply, context);
    await adapter.sendResponse(_b1Reply);
    return { success: true, response: _b1Reply, newContext: context };
  }

  // --- B-DUR: SÜRE FİLTRESİ (tours.type ENUM eşleştirmesi) ---
  // 2026-06-27 köşe 6 fix: "1 günlük tur" / "2 gecelik" UNKNOWN_TOUR'a düşüyordu.
  // tour-matching SADECE title/destination/aliases'a bakıyor; tours.type (DAYTRIP/N2/N3)
  // ENUM eşleştirmeye girmiyordu. Süre kelimesi → type map, tours.filter, deterministik
  // mesaj. "2/3 günlük" KASITLI olarak match edilmiyor (N1 yok, muğlak).
  // Sıra: B-DUR önce, B-TEMA sonra. "günübirlik doğa turu" → DAYTRIP filtreli liste.
  const _DURATION_PATTERNS: { regex: RegExp; type: "DAYTRIP" | "N2" | "N3" }[] = [
    // DAYTRIP — TR (günübirlik, 1 günlük, günlük tur, günlük gezi) + 6 dil
    // (?<!\d\s) "günlük tur" → "3 günlük tur" gibi sayı+boşluk öncülü match'i engeller
    // (muğlak: N1 yok, "3 günlük" = 2 gece N2 mi 3 gece N3 mi belirsiz → tour-matching'e bırak)
    {
      regex: /(?<![\p{L}\p{N}])(g[üu]n[üu]birlik|1\s*g[üu]nl[üu]k|(?<!\d\s)g[üu]nl[üu]k\s+(?:bir\s+)?(?:tur|gezi?)|day\s*[-\s]?trip|one[-\s]?day(?:\s+tour)?|tages(?:tour|ausflug)|eint[äa]gig|excursion\s+(?:d['’]une\s+)?journ[ée]e|excursi[óo]n\s+de\s+un\s+d[íi]a|paseo\s+diurno|однодневн|дневной\s+тур|رحلة\s*يومية|جولة\s*يومية)/iu,
      type: "DAYTRIP",
    },
    // N2 — "2 gece" / "2 gecelik" + 6 dil
    {
      regex: /(?<![\p{L}\p{N}])(2\s*gece(?:lik)?|2[-\s]?nights?|2\s*N[äa]chte|2\s*nuits?|2\s*noches?|2\s*ноч[иией]?|ليلتين|جولة\s*لليلتين)/iu,
      type: "N2",
    },
    // N3 — "3 gece" / "3 gecelik" + 6 dil
    {
      regex: /(?<![\p{L}\p{N}])(3\s*gece(?:lik)?|3[-\s]?nights?|3\s*N[äa]chte|3\s*nuits?|3\s*noches?|3\s*ноч[иией]?|3\s*ليالي)/iu,
      type: "N3",
    },
  ];

  let _matchedType: "DAYTRIP" | "N2" | "N3" | null = null;
  for (const dp of _DURATION_PATTERNS) {
    if (dp.regex.test(message)) {
      _matchedType = dp.type;
      break;
    }
  }

  if (
    _isExploreStage &&
    !_richTourName &&
    _matchedType &&
    tours.length > 0
  ) {
    const _filtered = tours.filter((t: any) => t.type === _matchedType);
    const _langDur = context.language || "tr";

    // Süre kategorisi → 7 dil yerelleştirilmiş etiket
    const _typeLabel: Record<string, Record<string, string>> = {
      DAYTRIP: { tr: "günübirlik", en: "day", de: "Tages", fr: "d'une journée", es: "de un día", ru: "однодневные", ar: "اليومية" },
      N2:      { tr: "2 gecelik",  en: "2-night", de: "2-Nächte", fr: "2 nuits", es: "2 noches", ru: "2-ночные", ar: "لليلتين" },
      N3:      { tr: "3 gecelik",  en: "3-night", de: "3-Nächte", fr: "3 nuits", es: "3 noches", ru: "3-ночные", ar: "3 ليالي" },
    };
    const _label = _typeLabel[_matchedType][_langDur] || _typeLabel[_matchedType].tr;

    const _exRatesDur = await getExchangeRatesOnce().catch(() => ({}));
    const _showDualDur = agency.show_multi_currency !== false;

    if (_filtered.length === 0) {
      // O type'ta tur yok → mevcut tüm turları öner (UNKNOWN_TOUR'a düşürme)
      const _allTours = tours.slice(0, 8).map((t: any, i: number) => {
        const _firstDate = t.dates?.[0];
        const _priceText = _firstDate?.price_adult
          ? ` — ${formatPriceSync(_firstDate.price_adult, t.currency || "TRY", _langDur, _exRatesDur, _showDualDur, languageCurrencies)}`
          : "";
        return `${i + 1}) ${getLocalizedTourTitle(t.title, _langDur)}${_priceText}`;
      }).join("\n");

      const _noneMsgs: Record<string, string> = {
        tr: `${_label} turumuz şu anda yok. Mevcut turlarımız:\n${_allTours}\n\nHangisi ilginizi çeker? 😊`,
        en: `We don't have ${_label} tours right now. Our available tours:\n${_allTours}\n\nWhich interests you? 😊`,
        de: `Wir haben derzeit keine ${_label}-Touren. Verfügbare Touren:\n${_allTours}\n\nWelche interessiert Sie? 😊`,
        fr: `Pas de circuit ${_label} pour le moment. Circuits disponibles :\n${_allTours}\n\nLequel vous intéresse ? 😊`,
        es: `No tenemos tours ${_label} ahora. Tours disponibles:\n${_allTours}\n\n¿Cuál te interesa? 😊`,
        ru: `Сейчас нет ${_label} туров. Доступные туры:\n${_allTours}\n\nКакой вас интересует? 😊`,
        ar: `لا توجد جولات ${_label} حالياً. الجولات المتاحة:\n${_allTours}\n\nأيها يثير اهتمامك؟ 😊`,
      };
      const _reply = _noneMsgs[_langDur] || _noneMsgs.tr;
      await _save(_reply, context);
      await adapter.sendResponse(_reply);
      return { success: true, response: _reply, newContext: context };
    }

    // Filtreli liste (type eşleşen turlar)
    const _filteredList = _filtered.slice(0, 8).map((t: any, i: number) => {
      const _firstDate = t.dates?.[0];
      const _priceText = _firstDate?.price_adult
        ? ` — ${formatPriceSync(_firstDate.price_adult, t.currency || "TRY", _langDur, _exRatesDur, _showDualDur, languageCurrencies)}`
        : "";
      return `${i + 1}) ${getLocalizedTourTitle(t.title, _langDur)}${_priceText}`;
    }).join("\n");

    const _msgs: Record<string, string> = {
      tr: `${_label} turlarımız:\n${_filteredList}\n\nHangisi ilginizi çeker? 😊`,
      en: `Our ${_label} tours:\n${_filteredList}\n\nWhich interests you? 😊`,
      de: `Unsere ${_label}-Touren:\n${_filteredList}\n\nWelche interessiert Sie? 😊`,
      fr: `Nos circuits ${_label} :\n${_filteredList}\n\nLequel vous intéresse ? 😊`,
      es: `Nuestros tours ${_label}:\n${_filteredList}\n\n¿Cuál te interesa? 😊`,
      ru: `Наши ${_label} туры:\n${_filteredList}\n\nКакой вас интересует? 😊`,
      ar: `جولاتنا ${_label}:\n${_filteredList}\n\nأيها يثير اهتمامك؟ 😊`,
    };
    const _reply = _msgs[_langDur] || _msgs.tr;
    await _save(_reply, context);
    await adapter.sendResponse(_reply);
    return { success: true, response: _reply, newContext: context };
  }

  // --- B-DUR2: GÜN-SAYISI SÜRE ARAMASI (V6, 2026-07-09) ---
  // Canlı: "3 günlük bir tur arıyorum" → NLU "günlük"ü tarih sandı → '"günlük"
  // müsait değil' saçmalığı. B-DUR type-enum (DAYTRIP/N2/N3) "3 günlük"ü KASITLI
  // atlıyordu (muğlak). Burada: mesajdan gün-sayısı çıkar, tur_sure serbest-
  // metninden gün çıkar, TAM eşleşme; eşleşen yoksa "X günlük yok + sürelerimiz".
  {
    // C-1 (Dalga-2, 2026-07-27): sorgu-regex'i 7-dil ("3 Tage Tour"/"туры на 2 дня"/
    // "tours de 3 días"…) + ASCII \b→lookaround. ⚠️ SÜRE-vs-GÖRELİ-TARİH AYRIMI:
    // "через 3 дня / in 3 Tagen / dans 3 jours / 3 gün sonra-içinde / بعد ٣ أيام"
    // SÜRE-sorgusu DEĞİL → _durRelGuard tetiklerse blok komple pas (yanlış
    // tetiklemektense eksik bırak). tur_sure eşleştirmesi (TR-acente-verisi) DOKUNULMADI.
    // Sınır (bilinçli-dar): AR tarafında Batı-rakam ("3 أيام"); Arapça-Hint rakam
    // normalize bu blokta yok (9b-A'daki gibi) — Dalga-3 adayı.
    const _durDayRe = /(?<![\p{L}\p{N}])(\d{1,2})\s*(?:g[üu]nl[üu]k|[-\s]?days?|tage|jours?|d[íi]as?|дн(?:я|ей|и)|أيام)(?![\p{L}\p{N}])/iu;
    const _durRelGuard = /(?:через|nach|in|dans|dentro\s+de|en|after|within|بعد|خلال)\s*\d{1,2}\s*(?:g[üu]n|day|tag|jour|d[íi]a|дн|يوم|أيام)|\d{1,2}\s*g[üu]n\s+(?:sonra|i[çc]inde)/iu;
    const _dayMatch = _isExploreStage && !_richTourName && !_durRelGuard.test(message || "")
      ? (message || "").match(_durDayRe)
      : null;
    if (_dayMatch && tours.length > 0) {
      const _wantDays = parseInt(_dayMatch[1]);
      const _langD2 = context.language || "tr";
      // tur_sure'dan gün sayısı çıkar ("2 gün 1 gece" → 2; "günübirlik/1 gün" → 1)
      const _tourDays = (t: any): number | null => {
        const s = String(t.tur_sure || "").toLocaleLowerCase("tr-TR");
        if (/g[üu]n[üu]birlik/.test(s)) return 1;
        const m = s.match(/(\d{1,2})\s*g[üu]n/);
        return m ? parseInt(m[1]) : null;
      };
      const _durMatches = tours.filter((t: any) => _tourDays(t) === _wantDays);
      const _exR2 = await getExchangeRatesOnce().catch(() => ({}));
      const _showD2 = agency.show_multi_currency !== false;
      const _fmtLine = (t: any, i: number) => {
        const _fd = t.dates?.[0];
        const _pt = _fd?.price_adult ? ` — ${formatPriceSync(_fd.price_adult, t.currency || "TRY", _langD2, _exR2, _showD2, languageCurrencies)}` : "";
        return `${i + 1}) ${getLocalizedTourTitle(t.title, _langD2)}${_pt}`;
      };
      if (_durMatches.length > 0) {
        const _list = _durMatches.slice(0, 8).map(_fmtLine).join("\n");
        const _m: Record<string, string> = {
          tr: `${_wantDays} günlük turlarımız:\n${_list}\n\nHangisi ilginizi çeker? 😊`,
          en: `Our ${_wantDays}-day tours:\n${_list}\n\nWhich interests you? 😊`,
          de: `Unsere ${_wantDays}-Tage-Touren:\n${_list}\n\nWelche interessiert Sie? 😊`,
          fr: `Nos circuits de ${_wantDays} jours :\n${_list}\n\nLequel vous intéresse ? 😊`,
          es: `Nuestros tours de ${_wantDays} días:\n${_list}\n\n¿Cuál le interesa? 😊`,
          ru: `Наши туры на ${_wantDays} дн.:\n${_list}\n\nКакой вас интересует? 😊`,
          ar: `جولاتنا لمدة ${_wantDays} أيام:\n${_list}\n\nأيها يثير اهتمامك؟ 😊`,
        };
        const _r = _m[_langD2] || _m.en;
        await _save(_r, context);
        await adapter.sendResponse(_r);
        return { success: true, response: _r, newContext: context };
      } else {
        // Eşleşme yok → mevcut süreleri göster (uydurma/şablon-yankı YOK)
        const _all = tours.slice(0, 8).map(_fmtLine).join("\n");
        const _m: Record<string, string> = {
          tr: `${_wantDays} günlük turumuz şu anda yok. Mevcut turlarımız:\n${_all}\n\nHangisi ilginizi çeker? 😊`,
          en: `We don't have ${_wantDays}-day tours right now. Our tours:\n${_all}\n\nWhich interests you? 😊`,
          de: `Wir haben derzeit keine ${_wantDays}-Tage-Touren. Unsere Touren:\n${_all}\n\nWelche interessiert Sie? 😊`,
          fr: `Nous n'avons pas de circuits de ${_wantDays} jours pour le moment. Nos circuits :\n${_all}\n\nLequel vous intéresse ? 😊`,
          es: `Ahora mismo no tenemos tours de ${_wantDays} días. Nuestros tours:\n${_all}\n\n¿Cuál le interesa? 😊`,
          ru: `Сейчас у нас нет туров на ${_wantDays} дн. Наши туры:\n${_all}\n\nКакой вас интересует? 😊`,
          ar: `لا تتوفر لدينا جولات لمدة ${_wantDays} أيام حالياً. جولاتنا المتاحة:\n${_all}\n\nأيها يثير اهتمامك؟ 😊`,
        };
        const _r = _m[_langD2] || _m.en;
        console.log(`[process-message] B-DUR2 V6: ${_wantDays} günlük eşleşme yok → mevcut liste`);
        await _save(_r, context);
        await adapter.sendResponse(_r);
        return { success: true, response: _r, newContext: context };
      }
    }
  }

  // --- B-TEMA: TEMA SÖZLÜĞÜ — yumuşatılmış mesaj ---
  // R4: selectedTour/multipleTourMatches kontrolü kaldırıldı (henüz hesaplanmadı).
  // currentTour kontrolü tutuldu — rezervasyon ortasında tema sorusu LLM'e bırakılsın.
  const _themeKeywordsRe = /(?<![\p{L}\p{N}])(do[ğg]a|macera|k[üu]lt[üu]r|tarihi|tarihsel|romantik|deniz|aile|nature|adventure|cultural|historical|historic|romantic|family|natur(?!al)|abenteuer|kultur|historisch|romantisch|familie|aventure|culturel|historique|romantique|famille|naturaleza|aventura|histórico|romántico|familia|природа|приключени|культурн|историческ|романтическ|семейн|طبيعة|مغامرة|ثقافة|تاريخي|رومانسي|عائلي)/iu;
  // 2026-07-09 V5 tema-daraltma: çift-anlamlı kelimeler (aile/tarihi/family/
  // historical) TEK BAŞINA tema SAYILMAZ — bağlam-kelimesi ister ("aile turu",
  // "tarihi yerler"). Canlı: "biz bir aileyiz pamukkale istiyoruz" → "aile"
  // tetikliyordu. Tek-anlamlı kelimeler (romantik/macera/doğa...) aynen kalır.
  const _unambiguousThemeRe = /(?<![\p{L}\p{N}])(do[ğg]a|macera|k[üu]lt[üu]r|romantik|deniz|nature|adventure|cultural|romantic|natur(?!al)|abenteuer|kultur|romantisch|aventure|culturel|romantique|naturaleza|aventura|romántico|природа|приключени|романтическ|طبيعة|مغامرة|رومانسي)/iu;
  // 2026-07-09 FAZ4-P1: RU/AR bağlam-kelimeleri eklendi (çift-anlamlı tema
  // kelimesi "aile/семейн/عائلي" bu bağlamla teyit gerektirir).
  const _themeContextRe = /(?<![\p{L}\p{N}])(tur|turu|tatil|gezi|holiday|vacation|trip|reise|voyage|viaje|yerler?|için\s+uygun|тур|поездк[\p{L}]*|отпуск|путешеств[\p{L}]*|отдых|جولة|رحلة|عطلة|سفر)/iu;
  const _themeMatched = _themeKeywordsRe.test(message);
  const _themeOnlyAmbiguous = _themeMatched && !_unambiguousThemeRe.test(message);
  const _themeFires = _themeMatched && (!_themeOnlyAmbiguous || _themeContextRe.test(message));

  if (
    _isExploreStage &&
    !_richTourName &&
    !_richDate &&
    tours.length > 0 &&
    !context.currentTour &&
    _themeFires
  ) {
    const _exRatesBT = await getExchangeRatesOnce().catch(() => ({}));
    const _showDualBT = agency.show_multi_currency !== false;
    const _langBT = context.language || "tr";
    const _tourListBT = tours.slice(0, 8).map((t: any, i: number) => {
      const _firstDate = t.dates?.[0];
      const _priceText = _firstDate?.price_adult
        ? ` — ${formatPriceSync(_firstDate.price_adult, t.currency || "TRY", _langBT, _exRatesBT, _showDualBT, languageCurrencies)}`
        : "";
      return `${i + 1}) ${getLocalizedTourTitle(t.title, _langBT)}${_priceText}`;
    }).join("\n");
    const _themeMsgs: Record<string, string> = {
      tr: `Tema bazlı özel filtremiz henüz yok, ama tüm turlarımız şunlar:\n${_tourListBT}\n\nHangisi ilginizi çeker? 😊`,
      en: `We don't have theme-based filtering yet, but here are all our tours:\n${_tourListBT}\n\nWhich interests you? 😊`,
      de: `Wir haben noch keine themenbasierte Filterung, hier sind alle unsere Touren:\n${_tourListBT}\n\nWelche interessiert Sie? 😊`,
      fr: `Nous n'avons pas encore de filtrage par thème, voici tous nos circuits :\n${_tourListBT}\n\nLequel vous intéresse ? 😊`,
      es: `Aún no tenemos filtrado por tema, pero estos son todos nuestros tours:\n${_tourListBT}\n\n¿Cuál te interesa? 😊`,
      ru: `У нас пока нет фильтрации по тематике, но вот все наши туры:\n${_tourListBT}\n\nКакой вас интересует? 😊`,
      ar: `لا تتوفر لدينا تصفية حسب الموضوع بعد، ولكن إليك جميع جولاتنا:\n${_tourListBT}\n\nما الذي يثير اهتمامك؟ 😊`,
    };
    const _btReply = _themeMsgs[_langBT] || _themeMsgs.tr;
    console.log(`[process-message] B-TEMA yumuşatma: tema sözlüğü match → liste`);
    await _save(_btReply, context);
    await adapter.sendResponse(_btReply);
    return { success: true, response: _btReply, newContext: context };
  }

  // === NİTELİK ÖN-TESPİT KATMANI SON ===========================================
  // ============================================================================

  // === 7. TUR EŞLEŞTİRME ===
  const { selectedTour, multipleMatches: multipleTourMatches, unknownTourQuery } = findMatchingTours(
    message,
    nluResult.entities,
    tours,
    getNextExpectedInput(context),
    nluResult.intent,
  );
  if (selectedTour) console.log("[process-message] Tour matched:", selectedTour.title);
  if (unknownTourQuery) console.log("[process-message] UNKNOWN_TOUR signal:", unknownTourQuery);

  // 2026-06-25 KÖK 5 devamı: erken-müdahale uygulandı mı bayrağı (extractAllInfo'ya
  // geçirilir → Blok 10 tek-tarih otomatik atama ATLAYACAK → yeni turun tarihi
  // kullanıcıya sorulur, sessiz atama olmaz).
  let _tourJustChangedThisTurn = false;

  // === §35-6. pendingCancelConfirm — COMPLETED çıplak-iptal TEYİT cevabı =====
  // Önceki turn "Rezervasyonunuzu iptal etmek mi istiyorsunuz?" soruldu (tek-turn-ömür,
  // proposedDateId deseni). Bu turn cevabı değerlendir. YALNIZ COMPLETED'da set edilebilir
  // → COLLECTING-durumlarıyla çakışamaz. Öncelik: iptal-teyidi > B3 (B3 puan-deseni
  // rakam/⭐; confirmation-words rakam İÇERMEZ → "evet/hayır" B3'e karışmaz).
  if (context.stage === "COMPLETED" && (context as any).pendingCancelConfirm) {
    const _pccLang = context.language || "tr";
    const _pccCtx = { ...context, pendingCancelConfirm: undefined } as any;
    if (detectConfirmation(message, _pccLang)) {
      // ONAY → mevcut iptal-talebi yolu (complaints + ack) — TEK yol (helper).
      const _r = await _fileCancellationRequest(_pccCtx, agency, supabase, adapter, message);
      console.log(`[process-message] §35-6 pendingCancelConfirm ONAY → complaints(cancellation_request)`);
      await _save(_r, _pccCtx);
      await adapter.sendResponse(_r);
      return { success: true, response: _r, newContext: _pccCtx };
    }
    if (detectNegativeResponse(message, _pccLang)) {
      // RET → rezervasyon geçerli ack, flag temiz.
      const _r = _CANCEL_REJECT_ACK[_pccLang] || _CANCEL_REJECT_ACK.tr;
      console.log(`[process-message] §35-6 pendingCancelConfirm RET → rezervasyon geçerli`);
      await _save(_r, _pccCtx);
      await adapter.sendResponse(_r);
      return { success: true, response: _r, newContext: _pccCtx };
    }
    // CİLA-4-F(ii) (2026-07-26): İPTAL-ISRARI = ONAY. Teyit beklerken kullanıcı AYNI
    // iptal-niyetini tekrar yazarsa ("ich möchte stornieren" × 2) soruyu TEKRARLAMAK
    // döngü yaratır; ısrar = iptal isteği net → onay yolu (complaints). Ret-sinyali
    // yukarıda zaten elendi ("iptal etmek istemiyorum" negatif-yola düşer).
    if (_CXL_SIGNAL_RE.test(message)) {
      const _r = await _fileCancellationRequest(_pccCtx, agency, supabase, adapter, message);
      console.log(`[process-message] §35-6 pendingCancelConfirm İPTAL-ISRARI → onay say → complaints`);
      await _save(_r, _pccCtx);
      await adapter.sendResponse(_r);
      return { success: true, response: _r, newContext: _pccCtx };
    }
    // ALAKASIZ → flag temizle, mesaj normal akışa DEVAM (return YOK).
    context = _pccCtx;
    console.log(`[process-message] §35-6 pendingCancelConfirm alakasız cevap → flag temizlendi, normal akış`);
  }

  // === §35-7. pendingFieldUpdateConfirm — CONFIRMING değer-echo TEYİT cevabı =====
  // Önceki turn "Kişi sayısını 3 yapayım mı?" soruldu (tek-turn-ömür). YALNIZ CONFIRMING'de
  // set edilebilir → pendingCancelConfirm (COMPLETED) ile stage-ayrımıyla MUTUALLY-EXCLUSIVE.
  if (context.stage === "CONFIRMING" && (context as any).pendingFieldUpdateConfirm) {
    const _pf = (context as any).pendingFieldUpdateConfirm as { field: string; value: any; selectedDate?: string };
    const _pfLang = context.language || "tr";
    if (detectConfirmation(message, _pfLang)) {
      // ONAY → değeri uygula + taze özet+💰 + yeniden onay sorusu (commit YOK).
      const _u = { ...(context.reservationInfo || {}) } as any;
      if (_pf.field === "pax") _u.paxAdult = _pf.value;
      else if (_pf.field === "name") _u.fullName = _pf.value;
      else if (_pf.field === "phone") _u.phone = _pf.value;
      else if (_pf.field === "date") { _u.dateId = _pf.value; if (_pf.selectedDate) _u.selectedDate = _pf.selectedDate; }
      const _uCtx = { ...context, reservationInfo: _u, collectionStep: "ready_for_confirmation", pendingFieldUpdateConfirm: undefined } as any;
      const _sum = await _buildUpdatedSummary(_u, context.currentTour, _pfLang, tours, agency, languageCurrencies);
      const _reply = `${_sum}\n\n${(_CONFIRM_LABELS[_pfLang] || _CONFIRM_LABELS.tr).reask}`;
      console.log(`[process-message] §35-7 pendingFieldUpdateConfirm ONAY → ${_pf.field} uygulandı`);
      await _save(_reply, _uCtx);
      await adapter.sendResponse(_reply);
      return { success: true, response: _reply, newContext: _uCtx };
    }
    if (detectNegativeResponse(message, _pfLang)) {
      // RET → değeri AT, onay-sorusuna dön (ne değişecek?).
      const _rejCtx = { ...context, pendingFieldUpdateConfirm: undefined } as any;
      const _rejMsgs: Record<string, string> = {
        tr: "Tamam, değişmedi. Rezervasyonu onaylıyor musunuz, yoksa neyi değiştirmek istersiniz? ✅",
        en: "Okay, unchanged. Do you confirm the reservation, or what would you like to change? ✅",
        de: "Okay, unverändert. Bestätigen Sie die Reservierung oder was möchten Sie ändern? ✅",
        fr: "D'accord, inchangé. Confirmez-vous la réservation ou que souhaitez-vous modifier ? ✅",
        es: "De acuerdo, sin cambios. ¿Confirma la reserva o qué desea cambiar? ✅",
        ru: "Хорошо, без изменений. Подтверждаете бронирование или что хотите изменить? ✅",
        ar: "حسناً، دون تغيير. هل تؤكد الحجز أم ماذا تريد أن تغيّر؟ ✅",
      };
      const _r = _rejMsgs[_pfLang] || _rejMsgs.tr;
      console.log(`[process-message] §35-7 pendingFieldUpdateConfirm RET → değer atıldı`);
      await _save(_r, _rejCtx);
      await adapter.sendResponse(_r);
      return { success: true, response: _r, newContext: _rejCtx };
    }
    // ALAKASIZ → flag temizle, normal akışa devam.
    context = { ...context, pendingFieldUpdateConfirm: undefined } as any;
    console.log(`[process-message] §35-7 pendingFieldUpdateConfirm alakasız → flag temizlendi`);
  }

  // === 7b-0. NETLEŞTİRME-SEÇİMİ (2026-07-10 A1) ============================
  // Önceki turn 7c belirsiz-tur listesi bastıysa (pendingTourClarification dolu)
  // bu mesaj ÖNCE liste-seçimi olarak denenir: numara ("1", "2)") VEYA kısmi ad
  // ("kültür turu" → adaylar içinde anlamlı-kelimeleri kapsayan TEK aday).
  // Eşleşirse → deterministik tur değişimi (7b deseni: produceTourChangeContext,
  // tarih yeni tura göre yeniden sorulur) + akış DEVAM (return yok — state-machine
  // kaldığı adımın sorusunu üretir). Eşleşmezse ("yarın ararım") → normal akış
  // (R6 dahil). HER DURUMDA tek-atış: bayrak temizlenir.
  if (context.pendingTourClarification?.length) {
    const _clarCands = context.pendingTourClarification;
    // TR-aware normalize (tour-matching normalizeForMatch private — yerel eşdeğer)
    const _clarNorm = (s: string) =>
      s.toLocaleLowerCase("tr-TR")
        .replace(/[ıİ]/g, "i").replace(/[şŞ]/g, "s").replace(/[ğĞ]/g, "g")
        .replace(/[üÜ]/g, "u").replace(/[öÖ]/g, "o").replace(/[çÇ]/g, "c").trim();
    let _clarChosen: { id: string; title: string } | null = null;
    // 1) Numara seçimi: "1", "2.", "3)" (tek başına)
    const _numSel = message.trim().match(/^(\d{1,2})\s*[).]?\s*$/);
    if (_numSel) {
      const _idx = parseInt(_numSel[1]) - 1;
      if (_idx >= 0 && _idx < _clarCands.length) _clarChosen = _clarCands[_idx];
    }
    // 2) Kısmi-ad seçimi: mesajın anlamlı kelimelerinin HEPSİNİ içeren TEK aday
    //    ("kültür turu" → "Kapadokya Kültür Turu" ✓, "Kapadokya Balon Turu" ✗).
    //    Stopword'ler ("turu/tur/tour") ayırt edici sayılmaz ama kapsama katılır.
    if (!_clarChosen) {
      const _msgWords = _clarNorm(message).split(/\s+/).filter((w) => w.length >= 2);
      if (_msgWords.length > 0 && _msgWords.length <= 6) {
        // 2026-07-10 7-dil paralellik şartı: 7c listesi müşteri diline LOKALİZE
        // basılıyor (getLocalizedTourTitle) → kullanıcı lokalize adı yazar
        // (AR "جولة الثقافة", RU "Культурный тур"). Eşleşme HEM TR-title HEM
        // lokalize-title'a karşı denenir.
        const _clarLang = context.language || "tr";
        const _matches = _clarCands.filter((c) => {
          // Title'ı SUNUCUDAKİ tours listesinden id ile TAZELE — client round-trip'i
          // title'ı bozabilir (ör. yanlış-charset'li istemci); id her zaman güvenli.
          const _freshTour = findTourById(c.id, tours);
          const _freshTitle = _freshTour?.title || c.title;
          const _locTitle = _freshTour ? getLocalizedTourTitle(_freshTour.title || "", _clarLang) : _freshTitle;
          const _t1 = _clarNorm(_freshTitle);
          const _t2 = _clarNorm(_locTitle);
          return _msgWords.every((w) => _t1.includes(w)) || _msgWords.every((w) => _t2.includes(w));
        });
        if (_matches.length === 1) _clarChosen = _matches[0];
      }
    }
    // Tek-atış temizlik (seçilse de seçilmese de)
    context = { ...context, pendingTourClarification: undefined };
    if (_clarChosen) {
      const _clarFull = findTourById(_clarChosen.id, tours);
      if (_clarFull) {
        const _prevT = context.currentTour?.title;
        context = {
          ...produceTourChangeContext(context, _clarFull),
          stage: "COLLECTING_INFO" as any,
          reservationConfirmed: false,
          pendingTourClarification: undefined,
        };
        _tourJustChangedThisTurn = true;
        console.log(`[process-message] A1 NETLEŞTİRME-SEÇİMİ: "${_prevT}" → "${_clarFull.title}" (${_numSel ? "numara" : "kısmi-ad"})`);
      }
    } else {
      console.log(`[process-message] A1 netleştirme-cevabı eşleşmedi → normal akış (tek-atış temizlendi)`);
    }
  }

  // === 7b. ERKEN TUR DEĞİŞİMİ (2026-06-20 Bug 1 v2) ========================
  // Tour-matching kanıtsal selectedTour mevcut currentTour'dan farklıysa VE stage
  // COLLECTING_INFO/CONFIRMING ise: stage koruma intent'i ezmeden (line ~326)
  // önce deterministik tur değişimini uygula. Aksi halde pattern-bazlı transition
  // tetiklenmez ve LLM yeni tur adıyla eski turun tarihini sunar (canlı bug
  // execution 801fed7d kanıtı: "Efes Antik Kent Turu için 15.12.2026 - 900₺"
  // ama state currentTour=Kapadokya, dateId=b...001 Kapadokya'nın).
  //
  // Çakışma güvenliği: erken müdahale context.currentTour'u günceller; sonraki
  // state-machine transition condition'ı (selectedTour.id !== ctx.currentTour.id)
  // artık equal görür → kendiliğinden atlar. Çifte değişim yok.
  if (shouldApplyEarlyTourChange(context, selectedTour, fsmIntent, message)) {
    const _prevStage = context.stage;
    const _prevTourTitle = context.currentTour?.title;
    context = {
      ...produceTourChangeContext(context, selectedTour),
      stage: "COLLECTING_INFO" as any,
      reservationConfirmed: false,                       // CONFIRMING'den geri dönüş temizliği
    };
    _tourJustChangedThisTurn = true;  // KÖK 5 devamı: Blok 10 (tek-tarih oto atama) ATLAYACAK
    console.log(
      `[process-message] DETERMINISTIC tour-change: ${_prevStage} → COLLECTING_INFO ` +
      `("${_prevTourTitle}" → "${selectedTour.title}")`,
    );
  }

  // === 7c. BELİRSİZ TUR DEĞİŞİMİ — destinasyon-specific "hangisi?" sorusu ===
  // 2026-06-25 KÖK 5 FIX 2 (canlı kanıt — "kapadokya turuna geçmek istiyorum"):
  // Tur değişim ifadesi var AMA selectedTour=null (Strateji 1+1.5 daraltma yetmedi,
  // multipleMatches hâlâ > 1). Bu durumda kullanıcıya SADECE eşleşen destinasyon
  // turlarını listele + "hangisi?" sor. Sonraki turn'de spesifik tur seçilince
  // FIX 1 daraltma çalışır.
  //
  // KRİTİK AYRIM: SADECE rezervasyon-esnası tur değişim bağlamında. Yeni rezervasyon
  // (GREETING/TOUR_SELECTED) çoklu-eşleşme davranışı (A3 mevcut B2 list) BOZULMAZ.
  const _hasExplicitTourChangeNoMatch =
    TOUR_CHANGE_PHRASE_RE.test(message) &&
    !selectedTour &&
    multipleTourMatches.length > 1 &&
    (context.stage === "COLLECTING_INFO" || context.stage === "CONFIRMING");
  if (_hasExplicitTourChangeNoMatch) {
    const _lang = context.language || "tr";
    const _tourListLines = multipleTourMatches.slice(0, 8).map((t: any, i: number) => {
      return `${i + 1}) ${getLocalizedTourTitle(t.title, _lang)}`;
    }).join("\n");
    // 2026-07-09 Faz 5 B: tr+en → 7-dil (KÖK5-FIX2 belirsiz tur-değişim listesi).
    const _ambiguousMsgs: Record<string, string> = {
      tr: `Birden fazla tur seçeneğimiz var:\n${_tourListLines}\n\nHangisini tercih edersiniz?`,
      en: `We have multiple tour options:\n${_tourListLines}\n\nWhich one would you prefer?`,
      de: `Wir haben mehrere Tour-Optionen:\n${_tourListLines}\n\nWelche bevorzugen Sie?`,
      fr: `Nous avons plusieurs options de circuits :\n${_tourListLines}\n\nLaquelle préférez-vous ?`,
      es: `Tenemos varias opciones de tours:\n${_tourListLines}\n\n¿Cuál prefiere?`,
      ru: `У нас несколько вариантов туров:\n${_tourListLines}\n\nКакой предпочитаете?`,
      ar: `لدينا عدة خيارات للجولات:\n${_tourListLines}\n\nأيها تفضل؟`,
    };
    const _ambReply = _ambiguousMsgs[_lang] || _ambiguousMsgs.tr;
    // 2026-07-10 A1: adayları state'e yaz — SONRAKİ mesaj önce liste-seçimi
    // olarak değerlendirilecek (7b-0). Canlı vaka: telefon adımında "kültür turu"
    // cevabı R6 "geçersiz telefon"a yutulup akış YANLIŞ turla özete gidiyordu.
    context = {
      ...context,
      pendingTourClarification: multipleTourMatches.slice(0, 8).map((t: any) => ({ id: t.id, title: t.title })),
    };
    console.log(`[process-message] KÖK 5 FIX2: belirsiz tur değişim (${multipleTourMatches.length} match) → destinasyon-specific liste (A1: adaylar state'e yazıldı)`);
    await _save(_ambReply, context);
    await adapter.sendResponse(_ambReply);
    return { success: true, response: _ambReply, newContext: context };
  }

  // B2: Orijinal intent'i stage korumadan ÖNCE kaydet
  const _prePromotionIntent = nluResult.intent;

  // Stage koruma: COLLECTING_INFO / CONFIRMING'de tour_search → provide_info
  // B-2 fix (2026-06-09): reservation_intent de aynı şekilde provide_info'ya ezilir.
  // Rezervasyon zaten devam ediyorken NLU "kullanıcı yeni rezervasyon başlatmak istiyor"
  // sanıp tur değişimi transition'ını tetikliyordu (Özge bug'ının kaynağı). İsim/telefon
  // verirken gelen mesaj asla yeni rezervasyon değildir; mevcut akışın devamıdır.
  //
  // 2026-06-25 KÖK 5 FIX (canlı G2 — tarih sonrası tur değiştirme):
  // İSTİSNA: GERÇEK tur değişimi sinyalinde stage koruma atla. 3 koşul birden:
  //   (1) Mesajda AÇIK tur değişim ifadesi (TOUR_CHANGE_PHRASE_RE)
  //   (2) NLU tour_name veya destination çıkardı
  //   (3) Çıkarılan tur adı/destinasyon mesajda gerçekten geçiyor (isNluOutputInMessage
  //       benzeri — NLU history'den uydurmasın). Mevcut findMatchingTours sonucu
  //       (selectedTour DOLU + currentTour'dan FARKLI) bu kontrolü ZATEN içeriyor.
  // Bu istisna fsmIntent'i korur → state-machine'e doğru intent ulaşır.
  // Özge bug korunur: "Özge Yılmazer" mesajında açık ifade YOK → istisna tetiklenmez.
  const _hasExplicitTourChange =
    TOUR_CHANGE_PHRASE_RE.test(message) &&
    selectedTour !== null &&
    selectedTour.id !== context.currentTour?.id;
  if (
    (context.stage === "COLLECTING_INFO" || context.stage === "CONFIRMING") &&
    (nluResult.intent === "tour_search" || nluResult.intent === "reservation_intent") &&
    !_hasExplicitTourChange
  ) {
    nluResult.intent = "provide_info";
    fsmIntent = mapNLUIntentToFSMIntent("provide_info");
  } else if (_hasExplicitTourChange) {
    console.log(`[process-message] KÖK 5: gerçek tur değişimi (${selectedTour?.title}) — stage koruma ATLANDI`);
  }

  // 2026-06-23 BUG B PROVIDE_INFO VARYANT (exec 94ee1378/d36d9550):
  // CONFIRMING'de "aslında adım Fırat Fırmaz" → NLU intent=provide_info (change_info DEĞİL)
  // + extracted.fullName="Fırat Fırmaz" + mevcut "Mustafa Eken". Mevcut Bug B fix
  // (isExplicitCorrection = intent==="change_info") devreye girmedi → !merged.fullName=false
  // → override atlandı → isim yutuldu.
  //
  // ÇÖZÜM: ORIGINAL stage CONFIRMING iken + intent provide_info + extracted.fullName/phone
  // mevcuttan FARKLI ise → intent'i "change_info"'ya PROMOTE et. Böylece state-machine'e
  // change_info ulaşır, mevcut Bug B fix override çalışır.
  //
  // GÜVENLİK:
  //   - context.stage === "COLLECTING_INFO" veya "CONFIRMING" (rezervasyon-öncesi).
  //     COMPLETED ayrı yol: 14a-3 acente yönlendirme bypass'ı (DB yalan vaadi yok).
  //   - GREETING/BROWSING/TOUR_SELECTED'da etkilenmez (mevcut isim/telefon YOK → ilk doldurma).
  //   - SADECE _confInfo.fullName/phone DOLU iken (`!!_confInfo?.fullName`) — ilk doldurma değil
  //     düzeltme niyeti şart. waiting_for_name'de mevcut isim boş → promote TETİKLENMEZ.
  //   - SADECE extracted.fullName/phone mevcuttan FARKLIYSA (aynı değer override yapmaz).
  //   - NLU prompt full_name ekstraksiyonu dar (2-3 kelime proper noun) → uydurma riski düşük.
  //   - F-savunması katmanları (NLU prompt + Blok 3 sigortası) extracted'a girene kadar
  //     temizler — bu seviyede leak yok.
  //
  // 2026-06-25 FIX KÖK 1 (canlı kanıt — Ege tuzağı):
  //   COLLECTING_INFO/waiting_for_phone'da isim="İsmail Koca" + "aslında adım Osman fırfır"
  //   → eski guard sadece CONFIRMING'di → COLLECTING_INFO'da promote olmadı →
  //   !merged.fullName=false → override yutuldu. Ekran "Teşekkürler Osman!" ama state "İsmail"
  //   (LLM history'ye bakıp sahte kabul mesajı).
  //   Çözüm: PROMOTE guard'ı COLLECTING_INFO'yu da kapsasın. `!!_confInfo.fullName` koşulu
  //   ilk doldurma akışını korur (waiting_for_name'de mevcut isim boş → promote yok).
  const _confInfo = context.reservationInfo;
  const _confExt = nluResult.updates as any;
  const _isConfirmingFullNameChange =
    !!_confExt?.fullName && !!_confInfo?.fullName &&
    _confExt.fullName !== _confInfo.fullName;
  const _isConfirmingPhoneChange =
    !!_confExt?.phone && !!_confInfo?.phone &&
    _confExt.phone !== _confInfo.phone;
  if (
    (context.stage === "COLLECTING_INFO" || context.stage === "CONFIRMING") &&
    nluResult.intent === "provide_info" &&
    (_isConfirmingFullNameChange || _isConfirmingPhoneChange)
  ) {
    console.log(`[process-message] BUG B PROMOTE: ${context.stage} + provide_info + ${_isConfirmingFullNameChange ? "fullName" : "phone"} farklı → intent → change_info`);
    nluResult.intent = "change_info";
    fsmIntent = mapNLUIntentToFSMIntent("change_info");
  }

  // === RESERVATION PROMOTE (İş 2a, 2026-07-03) — G13/X7 deseninin keşif kopyası ===
  // Canlı vakalar: "pamukkale rezervasyon" ve "efes turu için yer ayırtabilir
  // miyim" → NLU reservation_intent VERMEDİ (tour_search/general sapması) →
  // T4/T7 (GREETING/BROWSING→COLLECTING_INFO) intent-bazlı isReservationAction
  // koşulu FALSE → TOUR_SELECTED'a düşüş → :11 (c) dalı da intent'e bakıyor →
  // LLM'e düştü → "bir saniye, müsait tarihleri kontrol ediyorum" BOŞ VAADİ.
  // Oysa hasReservationSignal("rezervasyon"/"yer ayır") mesajı ZATEN yakalıyor.
  // Fix: keşif stage'lerinde + TUR EŞLEŞMESİ ŞARTIYLA (Özge/KÖK5 dersi: tur adı
  // eşleşmeden ASLA tetikleme) mesaj-sinyalini intent'e yükselt → T4/T7/:11(c)
  // mevcut halleriyle devralır → deterministik tarih listesi.
  // GUARD'lar: FAQ intent'leri korunur (NLU net general_question/support_request
  // dediyse dokunma — "rezervasyon iptal şartları?" sınıfı) + iptal/şart/iade
  // kelime guard'ı (çifte güvence). Mid-flow (COLLECTING/CONFIRMING) kapsam DIŞI
  // — B2 stage koruması ve Özge davranışı aynen.
  if (
    _isExploreStage &&
    selectedTour !== null &&
    hasReservationSignal(message) &&
    fsmIntent !== "reservation_intent" &&
    fsmIntent !== "tour_selected" &&
    fsmIntent !== "general_question" &&
    fsmIntent !== "support_request" &&
    !/(iptal|şart|koşul|kosul|iade|cancel|policy|refund)/i.test(message)
  ) {
    console.log(`[process-message] RESERVATION PROMOTE: ${context.stage} + hasReservationSignal + tur eşleşti (${selectedTour.title}) → intent → reservation_intent`);
    nluResult.intent = "reservation_intent";
    fsmIntent = mapNLUIntentToFSMIntent("reservation_intent");
  }

  // === İŞ A (J-14, 2026-07-03) — COMPLETED İPTAL TALEBİ → TALEP İLETME ===
  // Canlı: COMPLETED + "rezervasyonumu iptal etmek istiyorum" → T16
  // (detectCancellationGuarded) KONUŞMA reset'i sanıp "Tamam sorun değil!
  // Hangi tur ilginizi çeker?" dedi — hiçbir şey yapılmadı, yapılmış izlenimi.
  // ÜRÜN KARARI (b): iptal İŞLENMEZ (DB'ye dokunulmaz) — TALEP acenteye
  // İLETİLİR. Mekanizma: complaints tablosu (mevcut) — complaints_notify_trigger
  // (migration 20260526000002) insert'i otomatik acente bildirimine bağlıyor.
  // Deterministik sinyal esas (K1/X7/:10c deseni — NLU intent'ine güvenme).
  // FAQ AYRIMI: soru-formu VEYA şart/koşul/policy → dala GİRME ("iptal
  // şartları ne?" FAQ olarak akar). FSM'den ÖNCE RETURN — T16 reset'i olmaz.
  {
    const _cxlSignal = _CXL_SIGNAL_RE.test(message);
    const _cxlNotFaqQ = !QUESTION_SIGNAL_RE.test(message) && !_CXL_FAQ_RE.test(message);
    // J-14: COMPLETED + iptal + REZERVASYON-KELİMESİ → TEYİTSİZ direkt talep (mevcut yol).
    if (
      context.stage === "COMPLETED" &&
      _cxlSignal &&
      _CXL_RESCTX_RE.test(message) &&
      _cxlNotFaqQ
    ) {
      const _cxlReply = await _fileCancellationRequest(context, agency, supabase, adapter, message);
      console.log(`[process-message] J-14 COMPLETED iptal-talebi (rezervasyon-kelimeli) → complaints + deterministik mesaj`);
      await _save(_cxlReply, context);
      await adapter.sendResponse(_cxlReply);
      return { success: true, response: _cxlReply, newContext: context };
    }
    // §35-6 SET: COMPLETED + iptal AMA rezervasyon-kelimesi YOK → önce TEYİT sor.
    // (Olumsuzlama "iptal etmeyeceğim" yanlış-pozitifi = fazladan 1 teyit sorusu, kabul.)
    if (
      context.stage === "COMPLETED" &&
      _cxlSignal &&
      !_CXL_RESCTX_RE.test(message) &&
      _cxlNotFaqQ &&
      !(context as any).pendingCancelConfirm
    ) {
      const _confirmCtx = { ...context, pendingCancelConfirm: true } as any;
      const _q = _CANCEL_CONFIRM_Q[context.language] || _CANCEL_CONFIRM_Q.tr;
      console.log(`[process-message] §35-6 pendingCancelConfirm SET (COMPLETED çıplak-iptal) → teyit soruldu`);
      await _save(_q, _confirmCtx);
      await adapter.sendResponse(_q);
      return { success: true, response: _q, newContext: _confirmCtx };
    }
  }

  // B-6 (2026-06-09) — CONFIRMING net-ret → netleştirme. FIX4 (CİLA 2026-07-25):
  // blok F4-Katman-2 DAL1/DAL2 SONRASINA taşındı (aşağıda) + ret-tespiti unanchored
  // (_REJECT_SIGNAL_RE). Sebep: "hayır 3 kişiyiz" (ret+değer) ÖNCE DAL1'e (değer-uygula)
  // düşmeli — B-6 yalnız SAF reddi yakalamalı. Sıralama = _l2HasNewValue önceliği.

  // === 8. BİLGİ ÇIKARMA ===
  // 2026-06-29 O1 fix: selectedTour (bu turn'de tour-matching çıktısı) parametre olarak
  // geçirilir → birleşik mesajda (tur+tarih aynı turn) Blok 9 dateId resolution
  // context.currentTour henüz null olsa bile selectedTour'u fallback kullanır.
  const extractedInfo = extractAllInfo({ message, nluResult, fsmIntent, context, tours, tourJustChanged: _tourJustChangedThisTurn, selectedTour });

  // === 8-PP. PROVIDE PROMOTE — BUG B PROMOTE'un simetriği (2026-07-03) ===
  // Canlı vaka (exec 771f2a84, "Yılda Fufu"): waiting_for_name'de kullanıcı ismi
  // yazdı → Haiku intent=general sınıfladı → isInformationalMessage intent
  // listesi TRUE → T12 action mergeReservationInfo(isInformational=TRUE) →
  // Kural 4 erken-return → isim (ve o turn'deki HER extract) SESSİZCE DÜŞTÜ.
  // LLM history'den "aldım" uydurup telefon sordu (sahte kabul). SINIF bug:
  // intent-kilitli merge isim/telefon/pax/tarih İLK toplamalarının hepsini
  // etkiliyor — Haiku "çıplak veri → general" sapması sistematik veri kaybı.
  //
  // K1 dersiyle aynı ilke: NLU intent'i tutarsız, deterministik kanıt otorite.
  // Kanıt: BEKLENEN adımın TAM O alanı extract katmanından (K3/Sorun F
  // gate'lerinden geçerek) çıktı → kullanıcı "somut veri sundu" = provide_info
  // semantiğinin ta kendisi → intent'i yükselt.
  //
  // GÜVENLİK ŞARTLARI:
  //   - SADECE fsmIntent==="general" (general_question/support_request/greeting
  //     DOKUNULMAZ — FAQ akışı, R6 muafiyeti, after-sales etkilenmez)
  //   - SADECE COLLECTING_INFO + beklenen adımın alanı (çapraz alan yükseltmez:
  //     waiting_for_name'de telefon extract'i promote tetiklemez)
  //   - Mesaj SORU DEĞİL (QUESTION_SIGNAL_RE, 7 dil + ?/؟) — Kural 4'ün asıl
  //     koruduğu "3 gün mü sürüyor?" sınıfı informational kalır
  //   - Hayriye (BUG 2) korunur: içeriksiz "tamam" (extract yok) promote edilmez
  //     → T13 CONFIRMING'e general ile geçemez
  //   - Sorun F/K3 korunur: "Murat değil aslında Ahmet" Blok 5 blacklist'te
  //     düşer → extract yok → promote yok
  //   - SADECE fsmIntent değişir; nluResult ham çıktısı, extractedInfo ve diğer
  //     guard'lar dokunulmaz.
  if (fsmIntent === "general" && context.stage === "COLLECTING_INFO") {
    const _ppExpectedFieldByStep: Record<string, string[]> = {
      waiting_for_name: ["fullName"],
      waiting_for_phone: ["phone"],
      waiting_for_pax: ["paxAdult"],
      waiting_for_date: ["dateId", "selectedDate"],
    };
    const _ppFields = _ppExpectedFieldByStep[context.collectionStep || ""] || [];
    const _ppFilledField = _ppFields.find((f) => !!(extractedInfo as any)[f]);
    if (_ppFilledField && !QUESTION_SIGNAL_RE.test(message)) {
      console.log(`[process-message] PROVIDE PROMOTE: step=${context.collectionStep} + extractedInfo.${_ppFilledField} dolu + intent=general → provide_info`);
      fsmIntent = "provide_info";
    }
  }

  // === 8a. F4 KATMAN 2 — ÇELİŞKİ TESPİTİ + İKİ DALLI SON-ONAY ===
  // 2026-06-25 (Katman 1 = 619417f detectConfirmation negative pattern kelime listesi
  // KALIYOR). Katman 2 kelime-bağımsız alt-ağ — Katman 1 kaçırırsa (liste-dışı fiil) +
  // NLU yanlış sınıflandırırsa devreye girer.
  //
  // TEŞHİS — F4 Katman 1 sonrası "ismi Ahmet yap onaylıyorum" 3 yola gider:
  //   (a) NLU change_info → state-machine değiştirir + stage COLLECTING_INFO,
  //       özet+onay garantisi M1'e bağlı (kırılgan)
  //   (b) NLU confirm_reservation → CONFIRMING→COMPLETED reddeder (msg uzun) +
  //       change_info weak signal yok → no-op → :13-PERSIST eski özet
  //       (DEĞİŞİKLİK YUTULUR — en kötü)
  //   (c) NLU provide_info + farklı isim → BUG B PROMOTE → (a) yolu
  //
  // Katman 2 her 3 yolu da deterministik kapatır: extractedInfo'da mevcut alanı
  // FARKLI değerle değiştiren değer + CONFIRMING + onay sinyali → state-machine
  // ATLA, değişikliği uygula + state CONFIRMING + özet+onay deterministik.
  //
  // İki dal:
  //   DAL 1 (NLU NET): _hasNewValue → değişiklik UYGULA + özet+onay → RETURN
  //   DAL 2 (BELİRSİZ): sinyal var ama değer yok → netleştirme → RETURN
  //
  // REGRESYON GUARD'LARI (KRİTİK):
  //   - Saf "evet"/"onaylıyorum" → extractedInfo boş, mesajda alan/fiil yok → atla
  //   - "evet yapalım" → "yap" çekim eki (lookahead engelle) → DAL 2 tetiklenmez
  //   - Saf "ismi Ahmet yap" (onaysız) → _hasConfirmSignal FALSE → atla
  //   - context.stage CONFIRMING DEĞİL → atla
  //   - BUG B PROMOTE yukarıda fsmIntent change_info'ya çevirebilir; Katman 2
  //     yine ÇALIŞIR (yolun garantisizliğini tamamlar) — state-machine'i bypass
  //     edip değişiklik+özet+onay deterministik verir. Çift işlem YOK çünkü
  //     RETURN ile state-machine atlanır.
  const _l2ConfirmIntents = new Set(["confirm_reservation", "confirm"]);
  const _l2HasConfirmSignal =
    _l2ConfirmIntents.has(nluResult.intent as string) ||
    detectConfirmation(message, context.language);
  // PAKET-B (KÖK-1): DAL1 "hibrit-düzeltme" tespiti. positive-ONLY (negatif-guard'sız)
  // — "evet ama 3" / "Да, но…" pozitifi negatif-guard yüzünden kaçmasın. Ek: negatif
  // ("hayır 3 kişiyiz"/"X not Y") + change-kw ("aslında 20'si") de düzeltme-sinyali.
  // FIELD-pattern (isim/kişi) tek başına YETMEZ (hipotetik "3 kişi olursa fiyat?" DAL1'i
  // tetiklememeli — o BELİRSİZ değer-echo yoluna gider).
  const _l2PositiveOnly =
    _l2ConfirmIntents.has(nluResult.intent as string) ||
    (CONFIRM_POSITIVE[context.language] || CONFIRM_POSITIVE.tr).test(message);
  // Düzeltme-negasyonu (UNANCHORED — detectNegativeResponse "^no$" anchored'dır,
  // "X not Y"/"hayır 3" yakalamaz). Yalnız NEGASYON token'ları (soru-işareti/change-verb
  // DEĞİL) — _l2HasNewValue gate'i FP'yi sınırlar ("no, 3 people" = düzeltme, doğru).
  const _l2NegCorrection = /(?<![\p{L}\p{N}])(not|de[ğg]il|nicht|pas|no|нет|не|وليس|ليس|hay[ıi]r)(?![\p{L}\p{N}])/iu.test(message);
  const _l2CorrectionSignal =
    _l2PositiveOnly || _l2NegCorrection || detectNegativeResponse(message, context.language) || CHANGE_KEYWORDS_RE.test(message);
  const _l2Ext = extractedInfo as any;
  const _l2Cur = (context.reservationInfo || {}) as any;
  const _l2DiffFN = !!_l2Ext.fullName && !!_l2Cur.fullName && _l2Cur.fullName !== _l2Ext.fullName;
  const _l2DiffPh = !!_l2Ext.phone && !!_l2Cur.phone && _l2Cur.phone !== _l2Ext.phone;
  const _l2DiffPx = typeof _l2Ext.paxAdult === "number" && typeof _l2Cur.paxAdult === "number" && _l2Cur.paxAdult !== _l2Ext.paxAdult;
  const _l2DiffDid = !!_l2Ext.dateId && !!_l2Cur.dateId && _l2Cur.dateId !== _l2Ext.dateId;
  // 2026-07-27 OLGU-A (layer-2 tamamlama — canlı a/b kanıtı): selectedDate farkı
  // YALNIZ çözülmüş dateId ile geçerli değişim sayılır. Geçersiz tarihte (_l2Ext.dateId
  // yok, turda OLMAYAN tarih) selectedDate-only farkı DAL1'e GİRMEMELİ — girerse
  // _l2Updated.selectedDate=15 yazılıp _l2DiffDid=false olduğundan stale dateId=10
  // kalıyor (görünen≠kayıtlı; özet "15.12" gösterip rezervasyon 10.12'ye yazılıyor).
  // Fix: dateId şartı → dateId'siz fark DAL1'i tetiklemez → fall-through: state-machine
  // change-action (stale dateId siler) + pm _invalidDateForPreamble ("müsait değil"+
  // müsait liste + waiting_for_date). Geçerli değişimde (_l2Ext.dateId dolu) davranış
  // AYNEN korunur (_l2DiffDid zaten true, ikisi birlikte yazılır). state-machine ~899
  // OLGU-A fix'inin layer-2 simetriği (asıl canlı-yol burasıydı).
  const _l2DiffSd = !!_l2Ext.selectedDate && !!_l2Ext.dateId && !!_l2Cur.selectedDate && _l2Cur.selectedDate !== _l2Ext.selectedDate;
  const _l2HasNewValue = _l2DiffFN || _l2DiffPh || _l2DiffPx || _l2DiffDid || _l2DiffSd;

  // DAL 2 için "değişiklik sinyali": mesajda alan adı (sıkı kelime sınırı) veya
  // değiştirme fiili (sade emir kalıbı, çekim eki olmadan).
  const _l2FieldPattern = /(?<![\p{L}\p{N}])(isim|ismi|adı|adın|adım|soyad|surname|name|nom|nombre|имя|اسم|telefon|numara|phone|tel|gsm|téléphone|teléfono|телефон|هاتف|tarih|date|gün|day|datum|jour|día|дата|تاريخ|ki[şs]i|pax|person|people|kinder|personen|personnes|personas|человек)(?![\p{L}\p{N}])/iu;
  // "yap/olsun/ayarla" sıkı kelime — çekim eki ("yapalım") match etmez
  // "değiştir/düzelt/güncelle" çekim eki serbest (F4 ile aynı strateji)
  const _l2VerbPattern = /(?<![\p{L}\p{N}])(yap|olsun|ayarla|kur|set|make|adjust|aceptar)(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])(değiştir|düzelt|güncelle|değişiklik|change|modify|edit|update|correct|fix|ändern|korrigieren|modifier|corriger|cambiar|modificar|изменить|исправить|تعديل|تغيير|اجعل)/iu;
  const _l2HasChangeSignal = _l2FieldPattern.test(message) || _l2VerbPattern.test(message);

  // ── DAL 1 — somut yeni değer var + düzeltme-sinyali → UYGULA + özet+onay ──
  // PAKET-B: sarmalayıcı evet/hayır'dan BAĞIMSIZ değer uygulanır (matris-2); bu turda
  // ASLA commit yok, değer ASLA atılmaz.
  if (
    context.stage === "CONFIRMING" &&
    _l2HasNewValue &&
    _l2CorrectionSignal
  ) {
    const _l2Updated = { ..._l2Cur };
    if (_l2DiffFN) _l2Updated.fullName = _l2Ext.fullName;
    if (_l2DiffPh) _l2Updated.phone = _l2Ext.phone;
    if (_l2DiffPx) {
      _l2Updated.paxAdult = _l2Ext.paxAdult;
      if (typeof _l2Ext.paxChild === "number") _l2Updated.paxChild = _l2Ext.paxChild;
    }
    if (_l2DiffDid) _l2Updated.dateId = _l2Ext.dateId;
    if (_l2DiffSd) _l2Updated.selectedDate = _l2Ext.selectedDate;

    const _l2Context: ConversationContext = {
      ...context,
      reservationInfo: _l2Updated,
      collectionStep: "ready_for_confirmation" as any,
      lastUserMessage: message,
      messageCount: context.messageCount + 1,
      lastUpdated: new Date().toISOString(),
    };

    // PAKET-B: özet+💰 TEK-KAYNAK helper (completion/CONFIRMING ile aynı tutar).
    const _lang = _l2Context.language || "tr";
    const _l2Sum = await _buildUpdatedSummary(_l2Updated, _l2Context.currentTour, _lang, tours, agency, languageCurrencies);
    const _l2Reply = `${_l2Sum}\n\n${(_CONFIRM_LABELS[_lang] || _CONFIRM_LABELS.tr).reask}`;

    const _diffs = [_l2DiffFN && "name", _l2DiffPh && "phone", _l2DiffPx && "pax", _l2DiffDid && "date", _l2DiffSd && "selectedDate"].filter(Boolean).join(",");
    console.log(`[process-message] F4 Katman 2 DAL 1: çelişki yakalandı (diffs=${_diffs}) — değişiklik uygula + özet+onay`);
    await _save(_l2Reply, _l2Context);
    await adapter.sendResponse(_l2Reply);
    return { success: true, response: _l2Reply, newContext: _l2Context };
  }

  // ── DAL 2 — sinyal var ama somut değer yok → netleştirme ──
  if (
    context.stage === "CONFIRMING" &&
    _l2HasConfirmSignal &&
    !_l2HasNewValue &&
    _l2HasChangeSignal
  ) {
    const _l2DisambigMsgs: Record<string, string> = {
      tr: "Değiştirmek istediğiniz bir bilgi mi var, yoksa rezervasyonu onaylıyor musunuz? Lütfen değişikliği belirtin veya 'onaylıyorum' yazın.",
      en: "Do you want to change something, or do you confirm the reservation? Please specify the change or write 'confirm'.",
      de: "Möchten Sie etwas ändern oder bestätigen Sie die Reservierung? Bitte geben Sie die Änderung an oder schreiben Sie 'bestätigen'.",
      fr: "Voulez-vous changer quelque chose ou confirmez-vous la réservation ? Veuillez préciser le changement ou écrire 'confirmer'.",
      es: "¿Quiere cambiar algo o confirma la reserva? Por favor, especifique el cambio o escriba 'confirmo'.",
      ru: "Хотите что-то изменить или подтверждаете бронирование? Уточните изменение или напишите 'подтверждаю'.",
      ar: "هل تريد تغيير شيء أم تؤكد الحجز؟ يرجى تحديد التغيير أو كتابة 'تأكيد'.",
    };
    const _l2DisambigReply = _l2DisambigMsgs[context.language] || _l2DisambigMsgs.tr;
    console.log(`[process-message] F4 Katman 2 DAL 2: belirsiz (onay+sinyal ama değer yok) — netleştirme`);
    await _save(_l2DisambigReply, context);
    await adapter.sendResponse(_l2DisambigReply);
    return { success: true, response: _l2DisambigReply, newContext: context };
  }

  // ── B-6 (TAŞINDI, FIX4) — CONFIRMING SAF-RET → netleştirme (state KORUNUR) ──
  // DAL1 (ret+değer→uygula) ve DAL2 (onay+sinyal→belirsiz) SONRASINDA: buraya yalnız
  // SAF ret düşer (yeni-değer YOK, onay-sinyali YOK). _REJECT_SIGNAL_RE unanchored →
  // "onaylamıyorum"/"reddediyorum"/"je refuse"/"отказываюсь" gibi ret-fiilleri de yakalar
  // (eski anchored detectNegativeResponse yalnız bare "hayır"ı görüyordu → tarih-listesi kaçağı).
  // "hayır 3 kişiyiz" buraya GELMEZ — DAL1 zaten değeri uygulayıp return etti (FP-disiplini).
  // !detectConfirmation guard: "no problem, confirm it" gibi NET-ONAY içeren mesaj (unanchored
  // "no" yakalasa da) B-6'ya düşmesin → onay yoluna gitsin. "onaylamıyorum" POZİTİF değil
  // (POS_ALT lookaround'u "onaylam..."ı reddeder) → guard geçer, B-6 tetiklenir.
  if (
    context.stage === "CONFIRMING" &&
    _REJECT_SIGNAL_RE.test(message) &&
    !detectConfirmation(message, context.language)
  ) {
    const _negMsgs: Record<string, string> = {
      tr: "Anladım. Hangi bilgiyi değiştirmek istersiniz — tarih, kişi sayısı, isim veya telefon? Yoksa rezervasyonu tamamen iptal mi etmek istiyorsunuz?",
      en: "I understand. Which detail would you like to change — date, number of people, name, or phone? Or would you like to cancel the reservation entirely?",
      de: "Verstanden. Welche Angabe möchten Sie ändern — Datum, Personenzahl, Name oder Telefon? Oder möchten Sie die Reservierung ganz stornieren?",
      ru: "Понял. Какие данные вы хотите изменить — дату, количество человек, имя или телефон? Или вы хотите полностью отменить бронирование?",
      ar: "فهمت. ما المعلومة التي تريد تغييرها — التاريخ، عدد الأشخاص، الاسم أو الهاتف؟ أم تريد إلغاء الحجز بالكامل؟",
      fr: "Compris. Quelle information souhaitez-vous modifier — date, nombre de personnes, nom ou téléphone ? Ou souhaitez-vous annuler complètement la réservation ?",
      es: "Entendido. ¿Qué información desea cambiar — fecha, número de personas, nombre o teléfono? ¿O prefiere cancelar la reserva por completo?",
    };
    const _negReply = _negMsgs[context.language] || _negMsgs.tr;
    console.log(`[process-message] B-6 (taşındı): CONFIRMING saf-ret → netleştirme (lang=${context.language})`);
    await _save(_negReply, context);  // state KORUNUR (newContext yerine context)
    await adapter.sendResponse(_negReply);
    return { success: true, response: _negReply, newContext: context };
  }

  // Negatif pax kontrolü
  if (context.collectionStep === "waiting_for_pax" && isNegativePaxMessage(message)) {
    const _negMsgs: Record<string, string> = {
      tr: "Geçerli bir kişi sayısı belirtmelisiniz (en az 1 kişi).",
      en: "Please enter a valid number of people (at least 1).",
      de: "Bitte geben Sie eine gültige Personenzahl an (mindestens 1).",
      ru: "Укажите корректное количество человек (минимум 1).",
      ar: "يرجى إدخال عدد صحيح من الأشخاص (1 على الأقل).",
      fr: "Veuillez indiquer un nombre valide de personnes (au moins 1).",
      es: "Por favor indique un número válido de personas (mínimo 1).",
    };
    const negReply = _negMsgs[context.language] || _negMsgs.tr;
    await _save(negReply, context);
    await adapter.sendResponse(negReply);
    return { success: true, response: negReply, newContext: context };
  }

  // === PAX AŞIM (>9) — 2026-06-26 R6: deterministik acente yönlendirme ===
  // NLU/extractor pax >9 değerini sessizce reddediyor (isValidPax FALSE → set yok).
  // AMA kullanıcıya neden reddedildiği gösterilmeli: ham NLU pax değerine bak,
  // >9 ise grup rezervasyonu için acente yönlendirme mesajı 7 dil deterministik.
  // NOT: Aşım mesajı sadece NLU pax yakaladığında tetiklenir. simple-extractor
  // path'inden gelen büyük sayı bu mesajı görmeyebilir AMA isValidPax merge (state-
  // machine.ts:137) yine de rezervasyonu durdurur (CONFIRMING'e geçmez) — yanlış
  // rezervasyon oluşmaz, en kötü sessizce reddedilir.
  if (context.collectionStep === "waiting_for_pax") {
    const _rawPax = (nluResult.entities as { people_count?: { adults?: number } })?.people_count?.adults;
    if (typeof _rawPax === "number" && _rawPax > MAX_PAX_PER_RESERVATION) {
      const _agPhone = _agencyPhoneSuffix(agency.phone_public);
      const _excessMsgs: Record<string, string> = {
        tr: `${MAX_PAX_PER_RESERVATION} kişiden fazla grup rezervasyonu için lütfen acentemizle iletişime geçin.${_agPhone}`,
        en: `For group reservations of more than ${MAX_PAX_PER_RESERVATION} people, please contact our agency.${_agPhone}`,
        de: `Für Gruppenreservierungen mit mehr als ${MAX_PAX_PER_RESERVATION} Personen kontaktieren Sie bitte unsere Agentur.${_agPhone}`,
        fr: `Pour les réservations de groupe de plus de ${MAX_PAX_PER_RESERVATION} personnes, veuillez contacter notre agence.${_agPhone}`,
        es: `Para reservas grupales de más de ${MAX_PAX_PER_RESERVATION} personas, contacte con nuestra agencia.${_agPhone}`,
        ru: `Для групповых бронирований более ${MAX_PAX_PER_RESERVATION} человек, пожалуйста, свяжитесь с нашим агентством.${_agPhone}`,
        ar: `للحجوزات الجماعية لأكثر من ${MAX_PAX_PER_RESERVATION} أشخاص، يرجى التواصل مع وكالتنا.${_agPhone}`,
      };
      const _excessReply = _excessMsgs[context.language] || _excessMsgs.tr;
      console.log(`[process-message] PAX AŞIM: ${_rawPax} > ${MAX_PAX_PER_RESERVATION} → acente yönlendirme`);
      await _save(_excessReply, context);
      await adapter.sendResponse(_excessReply);
      return { success: true, response: _excessReply, newContext: context };
    }
  }

  // === MAX PAX KONTROLÜ (BUG 2) — 50+ kişi grubu için ofisle iletişim ===
  const _extractedPax = extractedInfo.paxAdult ?? extractedInfo.pax;
  if (_extractedPax && _extractedPax > 50) {
    const _agPhone = _agencyPhoneSuffix(agency.phone_public);
    const _maxPaxMsgs: Record<string, string> = {
      tr: `${_extractedPax} kişilik grup için lütfen ofisimizle iletişime geçin.${_agPhone}\n\nBireysel online rezervasyonlar için kaç kişi istiyorsunuz? (maksimum 50)`,
      en: `For a group of ${_extractedPax}, please contact our office for a special offer.${_agPhone}\n\nFor online booking, how many people? (max 50)`,
      de: `Für ${_extractedPax} Personen kontaktieren Sie uns bitte für ein Gruppenangebot.${_agPhone}\n\nFür Online-Buchung: Wie viele Personen? (max. 50)`,
      ru: `Для группы ${_extractedPax} человек свяжитесь с нами.${_agPhone}\n\nДля онлайн-бронирования: сколько человек? (макс. 50)`,
      ar: `لحجز ${_extractedPax} أشخاص يرجى التواصل مع مكتبنا.${_agPhone}\n\nكم شخص تريد حجز؟ (الحد الأقصى 50)`,
      fr: `Pour ${_extractedPax} personnes, contactez-nous pour une offre de groupe.${_agPhone}\n\nPour réservation en ligne : combien de personnes ? (max. 50)`,
      es: `Para ${_extractedPax} personas, contáctenos para una oferta grupal.${_agPhone}\n\n¿Cuántas personas para reserva online? (máx. 50)`,
    };
    const _maxReply = _maxPaxMsgs[context.language] || _maxPaxMsgs.tr;
    await _save(_maxReply, context);
    await adapter.sendResponse(_maxReply);
    return { success: true, response: _maxReply, newContext: context };
  }

  // === 8b. SORUN H — KONTENJAN ÖNDEN KONTROL (β + pax) ===
  // 2026-06-22: 3 katmanlı önden kontrol (α etiket :11'de, β tarih atama,
  // pax atama). γ RPC AYNEN korunur (race safety 4. kat).
  //
  // Helpers: hasQuotaForPax / getQuotaRemaining (services/quota-check.ts) — TEK
  // doğruluk kaynağı (alt-date filter de aynı helper'ı kullanır artık).
  //
  // remaining_quota tour-cache._refreshQuota tarafından her sorguda taze hazır,
  // ek DB çağrısı YOK.

  // Inline helper: müsait tarih listesi metni (TR + EN şimdi, diğer 5 dil
  // çok-dil eşitleme fazına). β + pax bypass'larda ortak — DRY.
  async function _buildAvailableDatesText(
    tour: any,
    neededPax: number,
    lang: string,
  ): Promise<string> {
    if (!tour?.dates?.length) return "";
    const _eR = await getExchangeRatesOnce().catch(() => ({}));
    const _sD = agency.show_multi_currency !== false;
    const lines = tour.dates
      .filter((d: any) => hasQuotaForPax(d, neededPax))
      .map((d: any, i: number) => {
        const dt = formatDateForLanguage(d.departure_date, lang);
        const pr = d.price_adult
          ? ` - ${formatPriceSync(d.price_adult, tour.currency || "TRY", lang, _eR, _sD, languageCurrencies)}`
          : "";
        const remaining = getQuotaRemaining(d);
        return `${i + 1}) ${dt}${pr}${quotaLabel(remaining, false, lang)}`;
      })
      .join("\n");
    return lines;
  }

  // β KATMANI — tarih dolu reddi (extractedInfo.dateRejectedFull flag set)
  if ((extractedInfo as any)?.dateRejectedFull) {
    const _lang = context.language || "tr";
    const _rej = (extractedInfo as any).dateRejectedFull;
    const _rejDateLabel = formatDateForLanguage(_rej.departureDate, _lang);
    const _curTour = context.currentTour ? findTourById(context.currentTour.id, tours) : null;
    const _altText = _curTour
      ? await _buildAvailableDatesText(_curTour, 1, _lang)
      : "";
    const _hasAlt = _altText.trim().length > 0;

    const _msgs: Record<string, string> = _hasAlt
      ? {
          tr: `Maalesef *${_rejDateLabel}* dolu. 😔\n\nMüsait tarihler:\n${_altText}\n\nHangi tarihi tercih edersiniz?`,
          en: `Sorry, *${_rejDateLabel}* is fully booked. 😔\n\nAvailable dates:\n${_altText}\n\nWhich date do you prefer?`,
          de: `Leider ist *${_rejDateLabel}* ausgebucht. 😔\n\nVerfügbare Termine:\n${_altText}\n\nWelches Datum bevorzugen Sie?`,
          ru: `К сожалению, *${_rejDateLabel}* уже занят. 😔\n\nДоступные даты:\n${_altText}\n\nКакую дату вы предпочитаете?`,
          ar: `للأسف، *${_rejDateLabel}* محجوز بالكامل. 😔\n\nالتواريخ المتاحة:\n${_altText}\n\nما التاريخ الذي تفضله؟`,
          fr: `Désolé, *${_rejDateLabel}* est complet. 😔\n\nDates disponibles:\n${_altText}\n\nQuelle date préférez-vous ?`,
          es: `Lo siento, *${_rejDateLabel}* está completo. 😔\n\nFechas disponibles:\n${_altText}\n\n¿Qué fecha prefieres?`,
        }
      : {
          tr: `Maalesef *${_rejDateLabel}* dolu ve şu anda başka müsait tarih bulunmuyor. 😔\n\nLütfen daha sonra tekrar deneyin veya acentemizle iletişime geçin.`,
          en: `Sorry, *${_rejDateLabel}* is fully booked and no other dates are available right now. 😔\n\nPlease try later or contact our agency.`,
          de: `Leider ist *${_rejDateLabel}* ausgebucht und derzeit keine anderen Termine verfügbar. 😔\n\nBitte versuchen Sie es später oder kontaktieren Sie uns.`,
          ru: `К сожалению, *${_rejDateLabel}* занят и других дат сейчас нет. 😔\n\nПопробуйте позже или свяжитесь с нами.`,
          ar: `للأسف، *${_rejDateLabel}* محجوز ولا توجد تواريخ أخرى متاحة. 😔\n\nيرجى المحاولة لاحقاً أو التواصل معنا.`,
          fr: `*${_rejDateLabel}* est complet et aucune autre date n'est disponible. 😔\n\nVeuillez réessayer plus tard ou nous contacter.`,
          es: `*${_rejDateLabel}* está completo y no hay otras fechas disponibles. 😔\n\nIntente más tarde o contáctenos.`,
        };
    // 2026-06-23 Sorun D: tur değişim prefix (erken-müdahale context'i mutate
    // etti → context.currentTour.id şu an YENİ tur; _originalTourId orijinal).
    const _tcPrefixBeta = buildTourChangePrefix(
      _originalTourId,
      context.currentTour?.id,
      context.currentTour ? getLocalizedTourTitle(context.currentTour.title || "", _lang) : "",
      _lang,
    );
    // FIX2: alternatif yoksa (çıkmaz) acente telefonu ekle — İş1 deseniyle.
    const _betaReply = _tcPrefixBeta + (_msgs[_lang] || _msgs.tr) + (!_hasAlt ? _agencyPhoneSuffix(agency.phone_public) : "");
    console.log(`[process-message] H-β tetiklendi (tarih dolu: ${_rej.departureDate}, remaining=${_rej.remaining}, altDates=${_hasAlt}, tourChanged=${!!_tcPrefixBeta})`);
    await _save(_betaReply, context);
    await adapter.sendResponse(_betaReply);
    return { success: true, response: _betaReply, newContext: context };
  }

  // pax KATMANI — pax atama yeterli kontenjan yok
  // Senaryo: tarihte 2 yer, kullanıcı "5 kişi" dedi. Tarih state'te dolu, pax
  // bu turn'de extract edildi → state-machine'den ÖNCE kontrol et.
  const _paxPending = (extractedInfo as any)?.paxAdult;
  const _activeTourFull = context.currentTour ? findTourById(context.currentTour.id, tours) : null;
  const _activeDateId = (extractedInfo as any)?.dateId ?? context.reservationInfo?.dateId;
  const _activeDate = _activeTourFull?.dates?.find((d: any) => d.id === _activeDateId);
  if (_paxPending && _activeDate && !hasQuotaForPax(_activeDate, _paxPending)) {
    const _lang = context.language || "tr";
    const _remaining = getQuotaRemaining(_activeDate);
    const _dateLabel = formatDateForLanguage(_activeDate.departure_date, _lang);
    // pax niyetini koru, dateId silinecek (state'e geri çekilecek waiting_for_date'e)
    // Burada SADECE mesaj atıyoruz — state-machine extractedInfo.dateId'yi state'e yazmadı,
    // dateRejectedFull flag de yok, state.reservationInfo aynen kalır. Bu turn sonrası
    // state.dateId hâlâ eski dolu olan; kullanıcı bir sonraki turn yeni tarih derse OK.
    // Bu fix β'nın doğal devamı, kullanıcı pax niyetini sonraki tarih seçiminde kullanır.
    const _altText = _activeTourFull
      ? await _buildAvailableDatesText(_activeTourFull, _paxPending, _lang)
      : "";
    const _hasAlt = _altText.trim().length > 0;
    const _msgs: Record<string, string> = _hasAlt
      ? {
          tr: `*${_paxPending} kişi* için *${_dateLabel}* tarihinde sadece *${_remaining} yer* var. 😔\n\nMüsait tarihler:\n${_altText}\n\nBaşka tarih seçer misiniz?`,
          en: `Only *${_remaining} seats* available for *${_paxPending} people* on *${_dateLabel}*. 😔\n\nAvailable dates:\n${_altText}\n\nCould you choose another date?`,
          de: `Nur *${_remaining} Plätze* für *${_paxPending} Personen* am *${_dateLabel}*. 😔\n\nVerfügbare Termine:\n${_altText}\n\nKönnten Sie ein anderes Datum wählen?`,
          ru: `Для *${_paxPending} человек* на *${_dateLabel}* осталось всего *${_remaining} мест*. 😔\n\nДоступные даты:\n${_altText}\n\nВыберете другую дату?`,
          ar: `لـ *${_paxPending} أشخاص* في *${_dateLabel}* يوجد فقط *${_remaining} مقاعد*. 😔\n\nالتواريخ المتاحة:\n${_altText}\n\nهل يمكنك اختيار تاريخ آخر؟`,
          fr: `Seulement *${_remaining} places* pour *${_paxPending} personnes* le *${_dateLabel}*. 😔\n\nDates disponibles:\n${_altText}\n\nPouvez-vous choisir une autre date ?`,
          es: `Solo *${_remaining} lugares* para *${_paxPending} personas* el *${_dateLabel}*. 😔\n\nFechas disponibles:\n${_altText}\n\n¿Puede elegir otra fecha?`,
        }
      : {
          tr: `*${_paxPending} kişi* için *${_dateLabel}* tarihinde sadece *${_remaining} yer* var ve uygun başka tarih yok. 😔\n\nDaha az kişi olarak deneyebilir veya acentemize danışabilirsiniz.`,
          en: `Only *${_remaining} seats* for *${_paxPending} people* on *${_dateLabel}* and no alternative dates available. 😔\n\nTry fewer people or contact our agency.`,
          de: `Nur *${_remaining} Plätze* für *${_paxPending} Personen* am *${_dateLabel}* — keine anderen Termine. 😔\n\nVersuchen Sie weniger Personen oder kontaktieren Sie uns.`,
          ru: `Только *${_remaining} мест* для *${_paxPending} человек* на *${_dateLabel}*, других дат нет. 😔\n\nПопробуйте меньше человек или свяжитесь с нами.`,
          ar: `فقط *${_remaining} مقاعد* لـ *${_paxPending} أشخاص* في *${_dateLabel}* ولا توجد تواريخ أخرى. 😔\n\nحاول بعدد أقل أو تواصل معنا.`,
          fr: `Seulement *${_remaining} places* pour *${_paxPending} personnes* le *${_dateLabel}* — pas d'autres dates. 😔\n\nEssayez avec moins de personnes ou contactez-nous.`,
          es: `Solo *${_remaining} lugares* para *${_paxPending} personas* el *${_dateLabel}* — no hay otras fechas. 😔\n\nIntente con menos personas o contáctenos.`,
        };
    // 2026-06-23 Sorun D: tur değişim prefix (β ile aynı kalıp).
    const _tcPrefixPax = buildTourChangePrefix(
      _originalTourId,
      context.currentTour?.id,
      context.currentTour ? getLocalizedTourTitle(context.currentTour.title || "", _lang) : "",
      _lang,
    );
    // FIX2: alternatif yoksa (çıkmaz) acente telefonu ekle.
    const _paxRejReply = _tcPrefixPax + (_msgs[_lang] || _msgs.tr) + (!_hasAlt ? _agencyPhoneSuffix(agency.phone_public) : "");
    console.log(`[process-message] H-pax tetiklendi (date=${_activeDate.departure_date}, remaining=${_remaining}, neededPax=${_paxPending}, tourChanged=${!!_tcPrefixPax})`);
    await _save(_paxRejReply, context);
    await adapter.sendResponse(_paxRejReply);
    return { success: true, response: _paxRejReply, newContext: context };
  }

  // === A1 (LOG-ONLY) — AKIŞ-İÇİ DEĞİŞTİRME TESPİT İSKELETİ (Yaklaşım A) ===
  // 2026-06-27: davranış değiştirmez, sadece [A-DETECT] log basar.
  // A2'de gerçek davranış (RETURN + deterministik mesaj) eklenecek — şimdilik
  // canlı veriden sınıflandırma doğruluğunu / yanlış-pozitif oranını gözlemle.
  //
  // 3 katman koşulu (spec madde 2):
  //   K1 (dolu)   : reservationInfo[field] DOLU mu?
  //   K2 (kelime) : mesajda net değişiklik kelimesi VAR mı? (7 dil pattern)
  //   K3 (farklı) : extractedInfo'dan çıkan yeni değer mevcut değerden FARKLI mı?
  //                 (tarih için dateId karşılaştırması — selectedDate STRING değil)
  //
  // Sınıflar:
  //   NORMAL                 : K1 fail (alan boş, ilk giriş) — A girmez
  //   AÇIK                   : K1+K2+K3 TRUE — değişiklik niyeti net
  //   BELİRSİZ               : K1+K3 TRUE, K2 FALSE, stage=CONFIRMING — teyit istenecek
  //   BELİRSİZ-AKIŞ-ORTASI   : K1+K3 TRUE, K2 FALSE, stage≠CONFIRMING — gözlem için
  {
    // 2026-07-03 X9-change fix: pattern shared/constants/change-detection.ts'e
    // taşındı (DRY) — info-extractor Blok 1 üçüncü kabul yolu da aynı kaynağı kullanır.
    const _hasChangeKeyword = CHANGE_KEYWORDS_RE.test(message);
    const _info = (context.reservationInfo || {}) as any;
    const _ext = extractedInfo as any;

    const _shortVal = (v: unknown): string => {
      if (v === null || v === undefined) return "null";
      const s = String(v);
      // dateId UUID gibi uzun değerleri kısalt
      return s.length > 16 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;
    };

    const _fieldsToCheck: Array<{ field: string; isFilled: boolean; extracted: unknown; current: unknown }> = [
      { field: "pax",   isFilled: !!_info.paxAdult, extracted: _ext.paxAdult, current: _info.paxAdult },
      // K3 tarih için dateId (spec tuzağı: selectedDate string "10 aralık 2026" vs "2026-12-10" farklı görünür)
      { field: "date",  isFilled: !!_info.dateId,    extracted: _ext.dateId,   current: _info.dateId },
      { field: "name",  isFilled: !!_info.fullName,  extracted: _ext.fullName, current: _info.fullName },
      { field: "phone", isFilled: !!_info.phone,     extracted: _ext.phone,    current: _info.phone },
    ];

    for (const fc of _fieldsToCheck) {
      // extractedInfo'da yeni değer YOKSA log gürültüsüne girme
      if (fc.extracted === undefined || fc.extracted === null || fc.extracted === "") continue;

      const _isDifferent = fc.extracted !== fc.current;

      let _class: string;
      if (!fc.isFilled) {
        _class = "NORMAL"; // ilk giriş, A girmez
      } else if (!_isDifferent) {
        continue; // aynı değer, gürültüsüz
      } else if (_hasChangeKeyword) {
        _class = "AÇIK";
      } else if (context.stage === "CONFIRMING") {
        _class = "BELİRSİZ";
      } else {
        _class = "BELİRSİZ-AKIŞ-ORTASI";
      }

      console.log(
        `[A-DETECT] field=${fc.field} | dolu=${fc.isFilled} | kelime=${_hasChangeKeyword} | farklı=${_isDifferent}(${_shortVal(fc.current)}→${_shortVal(fc.extracted)}) | stage=${context.stage} | step=${context.collectionStep} | sınıf=${_class}`,
      );
    }

    // === A2 — paxAdult AÇIK DAL (yalnızca pax; date/name/phone/BELİRSİZ → A3) ===
    // 2026-06-27: pax değişikliği için deterministik bildirim + özet/eksik-soru + RETURN.
    // Diğer alanlar (date/name/phone) ve BELİRSİZ sınıfı A3'te ele alınacak — A2'de
    // sadece pax + AÇIK için davranış. NORMAL/BELİRSİZ/farklı-field → A2 girmez, mevcut akış.
    // Tip normalize: extractedInfo.paxAdult string olabilir, Number(...) ile karşılaştır.
    const _paxFilled = !!_info.paxAdult;
    const _paxExtRaw = _ext.paxAdult;
    const _paxExt =
      typeof _paxExtRaw === "number"
        ? _paxExtRaw
        : _paxExtRaw === undefined || _paxExtRaw === null || _paxExtRaw === ""
          ? null
          : Number(_paxExtRaw);
    const _paxDifferent =
      _paxExt !== null && Number.isFinite(_paxExt) && _paxExt !== _info.paxAdult;

    if (_paxFilled && _hasChangeKeyword && _paxDifferent) {
      // 1. Yeni reservationInfo (paxChild varsa update; yoksa mevcut KORU)
      const _newInfo: any = { ..._info, paxAdult: _paxExt };
      if (_ext.paxChild !== undefined && _ext.paxChild !== null) {
        _newInfo.paxChild = _ext.paxChild;
      }

      // 2. Sonraki step (inline determineCollectionStep mantığı — pax dolu zaten)
      const _hasDate = !!_newInfo.dateId;
      const _hasName = !!_newInfo.fullName;
      const _hasPhone = !!_newInfo.phone;
      const _allFilled = _hasDate && _hasName && _hasPhone;

      const _nextStage = (_allFilled ? "CONFIRMING" : "COLLECTING_INFO") as any;
      const _nextStep = (_allFilled
        ? "ready_for_confirmation"
        : !_hasDate
          ? "waiting_for_date"
          : !_hasName
            ? "waiting_for_name"
            : "waiting_for_phone") as any;

      const _langA2 = context.language || "tr";
      const _oldPax = _info.paxAdult;

      // 3. Bildirim prefix (7 dil)
      const _prefixMsgs: Record<string, string> = {
        tr: `*Kişi sayısını* ${_oldPax} → ${_paxExt} olarak güncelledim. ✨`,
        en: `*Number of people* updated from ${_oldPax} → ${_paxExt}. ✨`,
        de: `*Personenzahl* von ${_oldPax} → ${_paxExt} aktualisiert. ✨`,
        fr: `*Nombre de personnes* mis à jour de ${_oldPax} → ${_paxExt}. ✨`,
        es: `*Número de personas* actualizado de ${_oldPax} → ${_paxExt}. ✨`,
        ru: `*Количество человек* обновлено с ${_oldPax} → ${_paxExt}. ✨`,
        ar: `تم تحديث *عدد الأشخاص* من ${_oldPax} إلى ${_paxExt}. ✨`,
      };
      const _prefix = _prefixMsgs[_langA2] || _prefixMsgs.tr;

      let _replyBody: string;
      if (_allFilled) {
        // Mevcut PHONE→CONFIRMING özet formatı kopyası (yeni template DEĞİL — tutarlılık)
        const _labelsA2: Record<string, { tour: string; date: string; pax: string; adult: string; child: string; name: string; phone: string; confirm: string }> = {
          tr: { tour: "Tur",     date: "Tarih",   pax: "Kişi sayısı", adult: "yetişkin",    child: "çocuk",   name: "Ad-Soyad", phone: "Telefon",   confirm: "Bilgiler doğru mu, onaylıyor musunuz? ✅" },
          en: { tour: "Tour",    date: "Date",    pax: "People",      adult: "adult",       child: "child",   name: "Name",     phone: "Phone",     confirm: "Are these details correct? Do you confirm? ✅" },
          de: { tour: "Tour",    date: "Datum",   pax: "Personen",    adult: "Erwachsener", child: "Kind",   name: "Name",     phone: "Telefon",   confirm: "Sind die Angaben korrekt? Bestätigen Sie? ✅" },
          ru: { tour: "Тур",     date: "Дата",    pax: "Человек",     adult: "взрослый",    child: "ребёнок", name: "Имя",      phone: "Телефон",   confirm: "Данные верны? Подтверждаете? ✅" },
          ar: { tour: "الجولة", date: "التاريخ", pax: "عدد الأشخاص", adult: "بالغ",         child: "طفل",    name: "الاسم",    phone: "الهاتف",    confirm: "هل المعلومات صحيحة؟ هل تؤكد؟ ✅" },
          fr: { tour: "Circuit", date: "Date",    pax: "Personnes",   adult: "adulte",      child: "enfant", name: "Nom",      phone: "Téléphone", confirm: "Les informations sont-elles correctes ? Confirmez-vous ? ✅" },
          es: { tour: "Tour",    date: "Fecha",   pax: "Personas",    adult: "adulto",      child: "niño",   name: "Nombre",   phone: "Teléfono",  confirm: "¿Los datos son correctos? ¿Confirma? ✅" },
        };
        const L = _labelsA2[_langA2] || _labelsA2.tr;
        const _tourTitle = context.currentTour
          ? getLocalizedTourTitle(context.currentTour.title || "", _langA2)
          : "";
        const _dateText = _newInfo.selectedDate ? formatDateForLanguage(_newInfo.selectedDate, _langA2) : "";
        const _paxText = typeof _newInfo.paxChild === "number" && _newInfo.paxChild > 0
          ? `${_paxExt} ${L.adult}, ${_newInfo.paxChild} ${L.child}`
          : `${_paxExt}`;
        const _summary = [
          _tourTitle ? `📋 ${L.tour}: *${_tourTitle}*` : "",
          _dateText  ? `📅 ${L.date}: ${_dateText}`    : "",
          _paxText   ? `👥 ${L.pax}: ${_paxText}`      : "",
          _newInfo.fullName ? `👤 ${L.name}: ${_newInfo.fullName}` : "",
          _newInfo.phone    ? `📱 ${L.phone}: ${_newInfo.phone}`   : "",
        ].filter(Boolean).join("\n");
        _replyBody = `${_summary}\n\n${L.confirm}`;
      } else {
        // Eksik alan sorusu (7 dil × 3 olası step)
        const _stepQuestions: Record<string, Record<string, string>> = {
          waiting_for_phone: {
            tr: "Telefon numaranızı alabilir miyim? 📱",
            en: "Could I have your phone number? 📱",
            de: "Könnte ich Ihre Telefonnummer haben? 📱",
            fr: "Puis-je avoir votre numéro de téléphone ? 📱",
            es: "¿Puedo tener su número de teléfono? 📱",
            ru: "Могу я узнать ваш номер телефона? 📱",
            ar: "هل يمكنني الحصول على رقم هاتفك؟ 📱",
          },
          waiting_for_name: {
            tr: "Ad-Soyadınızı söyler misiniz? 👤",
            en: "Could you tell me your full name? 👤",
            de: "Können Sie mir Ihren vollständigen Namen sagen? 👤",
            fr: "Pouvez-vous me dire votre nom complet ? 👤",
            es: "¿Puede decirme su nombre completo? 👤",
            ru: "Назовите ваше полное имя? 👤",
            ar: "هل يمكنك إخباري باسمك الكامل؟ 👤",
          },
          waiting_for_date: {
            tr: "Hangi tarihi tercih edersiniz? 📅",
            en: "Which date do you prefer? 📅",
            de: "Welches Datum bevorzugen Sie? 📅",
            fr: "Quelle date préférez-vous ? 📅",
            es: "¿Qué fecha prefiere? 📅",
            ru: "Какую дату вы предпочитаете? 📅",
            ar: "أي تاريخ تفضل؟ 📅",
          },
        };
        const _qSet = _stepQuestions[_nextStep] || _stepQuestions.waiting_for_phone;
        _replyBody = _qSet[_langA2] || _qSet.tr;
      }

      const _replyA2 = `${_prefix}\n\n${_replyBody}`;
      const _newCtx: any = { ...context, reservationInfo: _newInfo, stage: _nextStage, collectionStep: _nextStep };

      console.log(`[A] paxAdult açık değişiklik uygulandı: ${_oldPax}→${_paxExt}, stage=${_nextStage}, step=${_nextStep}`);

      await _save(_replyA2, _newCtx);
      await adapter.sendResponse(_replyA2);
      return { success: true, response: _replyA2, newContext: _newCtx };
    }

    // === A3 — date/name/phone AÇIK DAL + BELİRSİZ DAL (CONFIRMING, 4 alan) ===
    // 2026-06-27: A2-pax dışında kalan 3 alan için AÇIK dal + tüm alanlar için BELİRSİZ.
    // Sıra: date AÇIK → name AÇIK → phone AÇIK → BELİRSİZ (sadece CONFIRMING).
    // Çoklu-alan: tek-alan öncelikli (Karar A) — ilk eşleşen alan RETURN, diğeri sonraki tur.
    // phone AÇIK: yeni değer isValidPhone'dan GEÇMELİ (geçersizse değiştirme, soru sor).

    const _langA3 = context.language || "tr";

    // 7 dil özet labelleri (A2 ile aynı format, inline kopya — A4'te helper refactor)
    const _labelsA3: Record<string, { tour: string; date: string; pax: string; adult: string; child: string; name: string; phone: string; confirm: string }> = {
      tr: { tour: "Tur",     date: "Tarih",   pax: "Kişi sayısı", adult: "yetişkin",    child: "çocuk",   name: "Ad-Soyad", phone: "Telefon",   confirm: "Bilgiler doğru mu, onaylıyor musunuz? ✅" },
      en: { tour: "Tour",    date: "Date",    pax: "People",      adult: "adult",       child: "child",   name: "Name",     phone: "Phone",     confirm: "Are these details correct? Do you confirm? ✅" },
      de: { tour: "Tour",    date: "Datum",   pax: "Personen",    adult: "Erwachsener", child: "Kind",   name: "Name",     phone: "Telefon",   confirm: "Sind die Angaben korrekt? Bestätigen Sie? ✅" },
      ru: { tour: "Тур",     date: "Дата",    pax: "Человек",     adult: "взрослый",    child: "ребёнок", name: "Имя",      phone: "Телефон",   confirm: "Данные верны? Подтверждаете? ✅" },
      ar: { tour: "الجولة", date: "التاريخ", pax: "عدد الأشخاص", adult: "بالغ",         child: "طفل",    name: "الاسم",    phone: "الهاتف",    confirm: "هل المعلومات صحيحة؟ هل تؤكد؟ ✅" },
      fr: { tour: "Circuit", date: "Date",    pax: "Personnes",   adult: "adulte",      child: "enfant", name: "Nom",      phone: "Téléphone", confirm: "Les informations sont-elles correctes ? Confirmez-vous ? ✅" },
      es: { tour: "Tour",    date: "Fecha",   pax: "Personas",    adult: "adulto",      child: "niño",   name: "Nombre",   phone: "Teléfono",  confirm: "¿Los datos son correctos? ¿Confirma? ✅" },
    };

    const _stepQuestionsA3: Record<string, Record<string, string>> = {
      waiting_for_phone: {
        tr: "Telefon numaranızı alabilir miyim? 📱",
        en: "Could I have your phone number? 📱",
        de: "Könnte ich Ihre Telefonnummer haben? 📱",
        fr: "Puis-je avoir votre numéro de téléphone ? 📱",
        es: "¿Puedo tener su número de teléfono? 📱",
        ru: "Могу я узнать ваш номер телефона? 📱",
        ar: "هل يمكنني الحصول على رقم هاتفك؟ 📱",
      },
      waiting_for_name: {
        tr: "Ad-Soyadınızı söyler misiniz? 👤",
        en: "Could you tell me your full name? 👤",
        de: "Können Sie mir Ihren vollständigen Namen sagen? 👤",
        fr: "Pouvez-vous me dire votre nom complet ? 👤",
        es: "¿Puede decirme su nombre completo? 👤",
        ru: "Назовите ваше полное имя? 👤",
        ar: "هل يمكنك إخباري باسمك الكامل؟ 👤",
      },
      waiting_for_date: {
        tr: "Hangi tarihi tercih edersiniz? 📅",
        en: "Which date do you prefer? 📅",
        de: "Welches Datum bevorzugen Sie? 📅",
        fr: "Quelle date préférez-vous ? 📅",
        es: "¿Qué fecha prefiere? 📅",
        ru: "Какую дату вы предпочитаете? 📅",
        ar: "أي تاريخ تفضل؟ 📅",
      },
    };

    // Helper: değişikliği uygula → step + body inşa et + reply döndür
    const _buildA3Reply = (prefix: string, newInfo: any): { reply: string; newCtx: any; nextStage: string; nextStep: string } => {
      const _hasDate = !!newInfo.dateId;
      const _hasName = !!newInfo.fullName;
      const _hasPhone = !!newInfo.phone;
      const _hasPax = !!newInfo.paxAdult;
      const _allFilled = _hasDate && _hasPax && _hasName && _hasPhone;

      const _nextStage = _allFilled ? "CONFIRMING" : "COLLECTING_INFO";
      const _nextStep = _allFilled
        ? "ready_for_confirmation"
        : !_hasDate ? "waiting_for_date"
        : !_hasPax ? "waiting_for_pax"
        : !_hasName ? "waiting_for_name"
        : "waiting_for_phone";

      let _body: string;
      if (_allFilled) {
        const L = _labelsA3[_langA3] || _labelsA3.tr;
        const _tourTitle = context.currentTour
          ? getLocalizedTourTitle(context.currentTour.title || "", _langA3)
          : "";
        const _dateText = newInfo.selectedDate ? formatDateForLanguage(newInfo.selectedDate, _langA3) : "";
        const _paxText = typeof newInfo.paxChild === "number" && newInfo.paxChild > 0
          ? `${newInfo.paxAdult} ${L.adult}, ${newInfo.paxChild} ${L.child}`
          : `${newInfo.paxAdult}`;
        const _summary = [
          _tourTitle ? `📋 ${L.tour}: *${_tourTitle}*` : "",
          _dateText  ? `📅 ${L.date}: ${_dateText}`    : "",
          _paxText   ? `👥 ${L.pax}: ${_paxText}`      : "",
          newInfo.fullName ? `👤 ${L.name}: ${newInfo.fullName}` : "",
          newInfo.phone    ? `📱 ${L.phone}: ${newInfo.phone}`   : "",
        ].filter(Boolean).join("\n");
        _body = `${_summary}\n\n${L.confirm}`;
      } else {
        const _qSet = _stepQuestionsA3[_nextStep] || _stepQuestionsA3.waiting_for_phone;
        _body = _qSet[_langA3] || _qSet.tr;
      }

      const _reply = `${prefix}\n\n${_body}`;
      const _newCtx: any = { ...context, reservationInfo: newInfo, stage: _nextStage, collectionStep: _nextStep };
      return { reply: _reply, newCtx: _newCtx, nextStage: _nextStage, nextStep: _nextStep };
    };

    // --- date AÇIK ---
    const _dateFilled = !!_info.dateId;
    const _dateExt = _ext.dateId;
    const _dateDifferent = _dateExt !== undefined && _dateExt !== null && _dateExt !== "" && _dateExt !== _info.dateId;
    if (_dateFilled && _hasChangeKeyword && _dateDifferent) {
      const _newInfo: any = { ..._info, dateId: _dateExt };
      if (_ext.selectedDate) _newInfo.selectedDate = _ext.selectedDate;

      const _oldDateText = _info.selectedDate ? formatDateForLanguage(_info.selectedDate, _langA3) : String(_info.dateId);
      const _newDateText = _ext.selectedDate ? formatDateForLanguage(_ext.selectedDate, _langA3) : String(_dateExt);

      const _prefixMsgs: Record<string, string> = {
        tr: `*Tarihi* ${_oldDateText} → ${_newDateText} olarak güncelledim. ✨`,
        en: `*Date* updated from ${_oldDateText} → ${_newDateText}. ✨`,
        de: `*Datum* von ${_oldDateText} → ${_newDateText} aktualisiert. ✨`,
        fr: `*Date* mise à jour de ${_oldDateText} → ${_newDateText}. ✨`,
        es: `*Fecha* actualizada de ${_oldDateText} → ${_newDateText}. ✨`,
        ru: `*Дата* обновлена с ${_oldDateText} → ${_newDateText}. ✨`,
        ar: `تم تحديث *التاريخ* من ${_oldDateText} إلى ${_newDateText}. ✨`,
      };
      const _prefix = _prefixMsgs[_langA3] || _prefixMsgs.tr;
      const { reply, newCtx, nextStage, nextStep } = _buildA3Reply(_prefix, _newInfo);
      console.log(`[A] dateId açık değişiklik uygulandı: ${_info.dateId}→${_dateExt}, stage=${nextStage}, step=${nextStep}`);
      await _save(reply, newCtx);
      await adapter.sendResponse(reply);
      return { success: true, response: reply, newContext: newCtx };
    }

    // --- name AÇIK ---
    const _normalizeName = (s: unknown): string =>
      typeof s === "string" ? s.trim().toLowerCase().replace(/\s+/g, " ") : "";
    const _nameFilled = !!_info.fullName;
    const _nameExt = _ext.fullName;
    const _nameDifferent =
      typeof _nameExt === "string" &&
      _nameExt.trim() !== "" &&
      _normalizeName(_nameExt) !== _normalizeName(_info.fullName);
    if (_nameFilled && _hasChangeKeyword && _nameDifferent) {
      const _newInfo: any = { ..._info, fullName: _nameExt };
      const _oldName = _info.fullName || "";

      const _prefixMsgs: Record<string, string> = {
        tr: `*Ad-Soyadı* ${_oldName} → ${_nameExt} olarak güncelledim. ✨`,
        en: `*Name* updated from ${_oldName} → ${_nameExt}. ✨`,
        de: `*Name* von ${_oldName} → ${_nameExt} aktualisiert. ✨`,
        fr: `*Nom* mis à jour de ${_oldName} → ${_nameExt}. ✨`,
        es: `*Nombre* actualizado de ${_oldName} → ${_nameExt}. ✨`,
        ru: `*Имя* обновлено с ${_oldName} → ${_nameExt}. ✨`,
        ar: `تم تحديث *الاسم* من ${_oldName} إلى ${_nameExt}. ✨`,
      };
      const _prefix = _prefixMsgs[_langA3] || _prefixMsgs.tr;
      const { reply, newCtx, nextStage, nextStep } = _buildA3Reply(_prefix, _newInfo);
      console.log(`[A] fullName açık değişiklik uygulandı: ${String(_oldName || "").charAt(0)}***→${String(_nameExt || "").charAt(0)}***, stage=${nextStage}, step=${nextStep}`);
      await _save(reply, newCtx);
      await adapter.sendResponse(reply);
      return { success: true, response: reply, newContext: newCtx };
    }

    // --- phone AÇIK (yeni değer isValidPhone'dan GEÇMELİ) ---
    const _normalizePhoneDigits = (s: unknown): string =>
      typeof s === "string" ? s.replace(/[\s\-\(\)\.\+]/g, "") : "";
    const _phoneFilled = !!_info.phone;
    const _phoneExt = _ext.phone;
    const _phoneDifferent =
      typeof _phoneExt === "string" &&
      _phoneExt.trim() !== "" &&
      _normalizePhoneDigits(_phoneExt) !== _normalizePhoneDigits(_info.phone);

    // --- A4-mini: phone REDDET (niyet var, geçerli değer extract edilemedi) ---
    // 2026-06-27: kullanıcı "aslında telefonum abc def olsun" derse, info-extractor
    // normalizePhone null döner → extractedInfo.phone undefined → A3 phone AÇIK dalı
    // hiç girmez (LLM'e düşer, garip cevaplar). Hedef: değişiklik niyetini yakala,
    // nazik "tam telefon" mesajı dön. State KORUNUR.
    // Yanlış-pozitif daraltma: detectConfirmation ile "aslında telefonum doğru"
    // gibi onay ifadelerini eler (REDDET girmez, onay akışı devam eder).
    const _phoneMentionRe = /(?<![\p{L}\p{N}])(telefon|telefonu|telefonum|telefonumu|telefonunu|numara|numaramı|numaranız|numaranızı|cep|gsm|phone|telephone|number|mobile|téléphone|teléfono|телефон|номер|هاتف|رقم)/iu;
    const _phoneExtMissing = _phoneExt === undefined || _phoneExt === null || (typeof _phoneExt === "string" && _phoneExt.trim() === "");
    const _phoneMention = _phoneMentionRe.test(message);
    const _notConfirmation = !detectConfirmation(message, _langA3);
    if (_phoneFilled && _hasChangeKeyword && _phoneMention && _phoneExtMissing && _notConfirmation) {
      const _missingMsgs: Record<string, string> = {
        tr: `Telefon numaranızı tam olarak alabilir miyim? 📱\n\n(örn: 0532 123 45 67 veya +90 532 123 45 67)`,
        en: `Could I get your full phone number? 📱\n\n(e.g. +90 532 123 45 67)`,
        de: `Könnte ich Ihre vollständige Telefonnummer haben? 📱\n\n(z.B. +90 532 123 45 67)`,
        fr: `Pouvez-vous me donner votre numéro de téléphone complet ? 📱\n\n(ex: +90 532 123 45 67)`,
        es: `¿Puede darme su número de teléfono completo? 📱\n\n(ej: +90 532 123 45 67)`,
        ru: `Могу я получить ваш полный номер телефона? 📱\n\n(напр. +90 532 123 45 67)`,
        ar: `هل يمكنني الحصول على رقم هاتفك بالكامل؟ 📱\n\n(مثال: +90 532 123 45 67)`,
      };
      const _missReply = _missingMsgs[_langA3] || _missingMsgs.tr;
      console.log(`[A] phone değişiklik REDDEDİLDİ (niyet var, geçerli değer yok): len=${message.length}`);
      await _save(_missReply, context);
      await adapter.sendResponse(_missReply);
      return { success: true, response: _missReply, newContext: context };
    }

    if (_phoneFilled && _hasChangeKeyword && _phoneDifferent) {
      // Dikkat #2: yeni telefon geçerli mi? Geçersizse değiştirme, soru sor.
      if (!isValidPhone(String(_phoneExt))) {
        const _invalidMsgs: Record<string, string> = {
          tr: `"${_phoneExt}" geçerli bir telefon numarası değil. 📱\n\nLütfen tam numaranızı girin (örn: 0532 123 45 67 veya +90 532 123 45 67)`,
          en: `"${_phoneExt}" is not a valid phone number. 📱\n\nPlease enter your full number (e.g. +90 532 123 45 67)`,
          de: `"${_phoneExt}" ist keine gültige Telefonnummer. 📱\n\nBitte vollständige Nummer eingeben (z.B. +90 532 123 45 67)`,
          ru: `"${_phoneExt}" — неверный номер телефона. 📱\n\nВведите полный номер (напр. +90 532 123 45 67)`,
          ar: `"${_phoneExt}" ليس رقم هاتف صحيح. 📱\n\nيرجى إدخال رقمك الكامل (مثال: +90 532 123 45 67)`,
          fr: `"${_phoneExt}" n'est pas un numéro valide. 📱\n\nVeuillez entrer votre numéro complet (ex: +90 532 123 45 67)`,
          es: `"${_phoneExt}" no es un número válido. 📱\n\nIngrese su número completo (ej: +90 532 123 45 67)`,
        };
        const _invReply = _invalidMsgs[_langA3] || _invalidMsgs.tr;
        console.log(`[A] phone değişiklik REDDEDİLDİ (isValidPhone=false): ${maskPhone(String(_phoneExt))}`);
        await _save(_invReply, context);
        await adapter.sendResponse(_invReply);
        return { success: true, response: _invReply, newContext: context };
      }

      const _newInfo: any = { ..._info, phone: _phoneExt };
      const _oldPhone = _info.phone || "";

      const _prefixMsgs: Record<string, string> = {
        tr: `*Telefonu* ${_oldPhone} → ${_phoneExt} olarak güncelledim. ✨`,
        en: `*Phone* updated from ${_oldPhone} → ${_phoneExt}. ✨`,
        de: `*Telefon* von ${_oldPhone} → ${_phoneExt} aktualisiert. ✨`,
        fr: `*Téléphone* mis à jour de ${_oldPhone} → ${_phoneExt}. ✨`,
        es: `*Teléfono* actualizado de ${_oldPhone} → ${_phoneExt}. ✨`,
        ru: `*Телефон* обновлён с ${_oldPhone} → ${_phoneExt}. ✨`,
        ar: `تم تحديث *الهاتف* من ${_oldPhone} إلى ${_phoneExt}. ✨`,
      };
      const _prefix = _prefixMsgs[_langA3] || _prefixMsgs.tr;
      const { reply, newCtx, nextStage, nextStep } = _buildA3Reply(_prefix, _newInfo);
      console.log(`[A] phone açık değişiklik uygulandı: ${maskPhone(String(_oldPhone))}→${maskPhone(String(_phoneExt))}, stage=${nextStage}, step=${nextStep}`);
      await _save(reply, newCtx);
      await adapter.sendResponse(reply);
      return { success: true, response: reply, newContext: newCtx };
    }

    // --- PROMOSYON: phone kuru geçerli telefon → A3 phone AÇIK davranışı (kelime ŞART DEĞİL) ---
    // 2026-06-27: CONFIRMING'de geçerli kuru "05559876543" → BELİRSİZ'e düşmek temkinli ve UX
    // bozuyor. Telefon kazara yazılamaz (10-15 hane digit dizisi); geçerli + farklı + onay-değil
    // → kasıtlı değişiklik. Direkt güncelle, BELİRSİZ teyit sorma.
    // Sıra (KRİTİK):
    //   A3 phone AÇIK (kelime + değer) → A4-mini REDDET (kelime + değer yok) → PROMOSYON → BELİRSİZ
    // _notConfirmation: "evet onaylıyorum" gibi net onayda PROMOSYON girmesin (onay akışı aksın).
    if (
      _phoneFilled &&
      context.stage === "CONFIRMING" &&
      _phoneDifferent &&
      typeof _phoneExt === "string" &&
      isValidPhone(_phoneExt) &&
      _notConfirmation
    ) {
      const _newInfo: any = { ..._info, phone: _phoneExt };
      const _oldPhone = _info.phone || "";

      const _prefixMsgs: Record<string, string> = {
        tr: `*Telefonu* ${_oldPhone} → ${_phoneExt} olarak güncelledim. ✨`,
        en: `*Phone* updated from ${_oldPhone} → ${_phoneExt}. ✨`,
        de: `*Telefon* von ${_oldPhone} → ${_phoneExt} aktualisiert. ✨`,
        fr: `*Téléphone* mis à jour de ${_oldPhone} → ${_phoneExt}. ✨`,
        es: `*Teléfono* actualizado de ${_oldPhone} → ${_phoneExt}. ✨`,
        ru: `*Телефон* обновлён с ${_oldPhone} → ${_phoneExt}. ✨`,
        ar: `تم تحديث *الهاتف* من ${_oldPhone} إلى ${_phoneExt}. ✨`,
      };
      const _prefix = _prefixMsgs[_langA3] || _prefixMsgs.tr;
      const { reply, newCtx, nextStage, nextStep } = _buildA3Reply(_prefix, _newInfo);
      console.log(`[A] phone PROMOSYON (kuru geçerli telefon, kelime yok) uygulandı: ${maskPhone(String(_oldPhone))}→${maskPhone(String(_phoneExt))}, stage=${nextStage}, step=${nextStep}`);
      await _save(reply, newCtx);
      await adapter.sendResponse(reply);
      return { success: true, response: reply, newContext: newCtx };
    }

    // --- BELİRSİZ DAL → §35-7 DEĞER-ECHO TEYİT (sadece CONFIRMING) ---
    // PAKET-B (matris-3): değer çıkarıldı ama net düzeltme-sinyali yok (DAL1'e girmedi,
    // change-keyword yok). ARTIK değer ATILMAZ — echo'lu teyit: "Kişi sayısını 3 yapayım mı?"
    // pendingFieldUpdateConfirm (§35-7) set edilir; sonraki turn onay→uygula / ret→at.
    if (context.stage === "CONFIRMING" && !_hasChangeKeyword) {
      const _pfuc: { field: string; value: any; selectedDate?: string; display: string } | null =
        (_paxFilled && _paxDifferent) ? { field: "pax", value: _paxExt, display: String(_paxExt) }
        : (_dateFilled && _dateDifferent) ? { field: "date", value: _dateExt, selectedDate: _l2Ext.selectedDate, display: _l2Ext.selectedDate ? formatDateForLanguage(_l2Ext.selectedDate, _langA3) : String(_dateExt) }
        : (_nameFilled && _nameDifferent) ? { field: "name", value: _nameExt, display: String(_nameExt) }
        : (_phoneFilled && _phoneDifferent) ? { field: "phone", value: _phoneExt, display: String(_phoneExt) }
        : null;

      if (_pfuc) {
        const _echoCtx = { ...context, pendingFieldUpdateConfirm: { field: _pfuc.field, value: _pfuc.value, selectedDate: _pfuc.selectedDate } } as any;
        const _q = (_FIELD_UPDATE_Q[_pfuc.field]?.[_langA3] || _FIELD_UPDATE_Q[_pfuc.field]?.tr)(_pfuc.display);
        console.log(`[A] §35-7 pendingFieldUpdateConfirm SET: field=${_pfuc.field} → değer-echo teyit`);
        await _save(_q, _echoCtx);
        await adapter.sendResponse(_q);
        return { success: true, response: _q, newContext: _echoCtx };
      }
    }

    // A2/A3: hiçbir dal tetiklenmedi → RETURN yok, mevcut akışa devam.
  }

  // === 9-PHONE-YOK: telefon-yok politika dalı (V11-a, ürün kararı a, 2026-07-09) ===
  // waiting_for_phone'da "numaram yok / mail atsam" gibi telefon-YOK sinyali →
  // R6 "geçersiz telefon" YERİNE nazik POLİTİKA mesajı: telefon ŞART kalır (acente
  // telefonla teyit ediyor), gerekçe nazikçe açıklanır, e-posta EK bilgi olarak
  // alınabilir. Deterministik sinyal (NLU'ya güvenme — J-14/K1 deseni). AYRIM:
  //  - telefon-extract ÖNCE çalıştı → numara İÇEREN mesaj (!extractedInfo.phone
  //    false) bu dala GİRMEZ;
  //  - "yok" tek başına sinyal DEĞİL — numara/telefon/mail bağlam-kelimesi şart.
  // Gönüllü e-posta EK alan (şart DEĞİL, collectEmail mekanizması dokunulmaz):
  //  reservationInfo.email'e yazılır → :14 RPC p_email → registrations.email.
  // ISRAR (2.+ ret): aynı mesajı tekrarlama — J-14 deseni (contact_request +
  // acente bildirimi). FSM-ÖNCESI (J-14 gibi): "istemiyorum"u cancellation
  // transition'ı iptal sanıp dalı atlamasın diye processTransition'dan ÖNCE.
  if (
    context.stage === "COLLECTING_INFO" &&
    context.collectionStep === "waiting_for_phone" &&
    !extractedInfo.phone
  ) {
    const _pyLang = context.language || "tr";
    const _volEmail = extractEmail(message);
    const _agPhonePY = _agencyPhoneSuffix(agency.phone_public);

    // (0) ESKALASYON ONAYI: 2. ret sonrası "iletelim mi?" soruldu → "evet" →
    // contact_request kaydı (J-14 deseni) + bilgi mesajı. Müşteri çıkmazda kalmaz.
    if (context.phoneEscalationPending && !_volEmail && detectConfirmation(message, _pyLang)) {
      const _ri = (context.reservationInfo || {}) as any;
      const _crSummary =
        `İLETİŞİM TALEBİ (müşteri telefon paylaşmak istemiyor) — Tur: ${_ri.tourTitle || context.currentTour?.title || "?"} | ` +
        `Tarih: ${_ri.selectedDate || "?"} | Kişi: ${_ri.paxAdult ?? "?"} | ` +
        `İsim: ${_ri.fullName || "?"} | E-posta: ${_ri.email || "?"} | Müşteri mesajı: "${message.slice(0, 200)}"`;
      supabase.from("complaints").insert({
        agency_id: agency.id,
        phone: adapter.identifier,
        message: _crSummary,
        type: "contact_request",
        status: "new",
      }).then(() => {});
      const _crMsgs: Record<string, string> = {
        tr: `Talebinizi acentemize ilettim — en kısa sürede sizinle iletişime geçecekler.${_agPhonePY}`,
        en: `I've forwarded your request to our agency — they'll get in touch with you shortly.${_agPhonePY}`,
        de: `Ich habe Ihre Anfrage an unsere Agentur weitergeleitet — sie wird sich in Kürze bei Ihnen melden.${_agPhonePY}`,
        ru: `Я передал вашу заявку в наше агентство — с вами свяжутся в ближайшее время.${_agPhonePY}`,
        ar: `لقد أحلت طلبك إلى وكالتنا — سيتواصلون معك قريباً.${_agPhonePY}`,
        fr: `J'ai transmis votre demande à notre agence — elle vous contactera sous peu.${_agPhonePY}`,
        es: `He enviado su solicitud a nuestra agencia — se pondrán en contacto con usted en breve.${_agPhonePY}`,
      };
      const _crReply = _crMsgs[_pyLang] || _crMsgs.tr;
      const _crCtx = { ...context, phoneEscalationPending: false };
      console.log(`[process-message] V11-a contact_request kaydı (telefon-yok ısrar → J-14 deseni, DB rezervasyonu DOKUNULMADI)`);
      await _save(_crReply, _crCtx);
      await adapter.sendResponse(_crReply);
      return { success: true, response: _crReply, newContext: _crCtx };
    }

    // (1) GÖNÜLLÜ E-POSTA: kullanıcı geçerli e-posta yazdı → EK alan kaydet +
    // ack + telefonu TEKRAR iste. Rezervasyon ŞARTI DEĞİŞMEZ (telefon zorunlu).
    if (_volEmail) {
      const _emCtx = { ...context, reservationInfo: { ...context.reservationInfo, email: _volEmail } };
      const _emMsgs: Record<string, string> = {
        tr: `E-postanızı not ettim ✉️ Ancak rezervasyon onayı için telefon numarası hâlâ gerekli — numaranızı paylaşabilir misiniz? 📱`,
        en: `I've noted your email ✉️ But a phone number is still required to confirm the reservation — could you share your number? 📱`,
        de: `Ich habe Ihre E-Mail notiert ✉️ Für die Bestätigung wird jedoch weiterhin eine Telefonnummer benötigt — können Sie sie mitteilen? 📱`,
        ru: `Я записал ваш email ✉️ Но для подтверждения брони всё ещё нужен номер телефона — можете его указать? 📱`,
        ar: `لقد سجّلت بريدك الإلكتروني ✉️ لكن لا يزال رقم الهاتف مطلوباً لتأكيد الحجز — هل يمكنك مشاركته؟ 📱`,
        fr: `J'ai noté votre e-mail ✉️ Mais un numéro de téléphone reste nécessaire pour confirmer la réservation — pouvez-vous le partager ? 📱`,
        es: `He anotado su correo ✉️ Pero aún se necesita un número de teléfono para confirmar la reserva — ¿puede compartirlo? 📱`,
      };
      const _emReply = _emMsgs[_pyLang] || _emMsgs.tr;
      console.log(`[process-message] V11-a gönüllü e-posta kaydedildi → telefon tekrar isteniyor`);
      await _save(_emReply, _emCtx);
      await adapter.sendResponse(_emReply);
      return { success: true, response: _emReply, newContext: _emCtx };
    }

    // (2) TELEFON-YOK SİNYALİ: bağlam-kelime (telefon/mail) ŞART. \p{L}\p{N}
    // lookaround (K1). mail-kelime tek başına sinyal (telefon adımında "mail"
    // demek = telefonla ver yerine mail niyeti); telefon-kelime + ret ise sinyal.
    const _phoneCtxRe = /(?<![\p{L}\p{N}])(numara[\p{L}]*|telefon[\p{L}]*|phone|telefonnummer|t[ée]l[ée]phone|tel[ée]fono|телефон[\p{L}]*|رقم|هاتف)(?![\p{L}\p{N}])/iu;
    const _mailAltRe = /(?<![\p{L}\p{N}])(mail[\p{L}]*|e-?mail|e-?posta|posta|courriel|correo|почт[\p{L}]*|بريد)(?![\p{L}\p{N}])/iu;
    const _refusalRe = /(?<![\p{L}\p{N}])(yok|istemiyorum|vermeyece[\p{L}]*|veremem|olmaz|kein[\p{L}]*|nicht|ohne|pas\s+de|sans|no\s+tengo|no\s+quiero|нет|без|не\s+хочу|don'?t\s+have|do\s+not\s+have|won'?t|ليس\s+لدي|لا\s+أريد)(?![\p{L}\p{N}])/iu;
    const _isPhoneYok = _mailAltRe.test(message) || (_phoneCtxRe.test(message) && _refusalRe.test(message));

    if (_isPhoneYok) {
      const _count = (context.phoneRefusalCount || 0) + 1;
      if (_count >= 2) {
        // (2b) ISRAR → J-14 tarzı eskalasyon ÖNERİSİ (kayıt henüz yok, onay bekler).
        const _escMsgs: Record<string, string> = {
          tr: `Anlıyorum. İsterseniz talebinizi acentemize ileteyim, sizinle e-posta üzerinden iletişime geçsinler — iletmemi ister misiniz? ✅`,
          en: `I understand. If you'd like, I can forward your request to our agency so they reach out to you by email — shall I? ✅`,
          de: `Ich verstehe. Wenn Sie möchten, leite ich Ihre Anfrage an unsere Agentur weiter, damit sie Sie per E-Mail kontaktiert — soll ich? ✅`,
          ru: `Понимаю. Если хотите, я передам вашу заявку в агентство, чтобы с вами связались по email — передать? ✅`,
          ar: `أتفهّم ذلك. إن أردت، يمكنني إحالة طلبك إلى وكالتنا ليتواصلوا معك عبر البريد الإلكتروني — هل أفعل؟ ✅`,
          fr: `Je comprends. Si vous le souhaitez, je peux transmettre votre demande à notre agence pour qu'elle vous contacte par e-mail — dois-je le faire ? ✅`,
          es: `Lo entiendo. Si lo desea, puedo enviar su solicitud a nuestra agencia para que le contacten por correo — ¿lo hago? ✅`,
        };
        const _escReply = _escMsgs[_pyLang] || _escMsgs.tr;
        const _escCtx = { ...context, phoneRefusalCount: _count, phoneEscalationPending: true };
        console.log(`[process-message] V11-a telefon-yok ISRAR (${_count}. kez) → J-14 eskalasyon önerisi`);
        await _save(_escReply, _escCtx);
        await adapter.sendResponse(_escReply);
        return { success: true, response: _escReply, newContext: _escCtx };
      }
      // (2a) İLK RET → politika mesajı (telefon ŞART + nazik gerekçe + esneklik).
      const _polMsgs: Record<string, string> = {
        tr: `Rezervasyon onayı için telefon numarası gerekiyor — acentemiz rezervasyonunuzu telefonla teyit ediyor. 📱 Dilerseniz e-posta adresinizi de ekleyebilirim, ancak telefon olmadan rezervasyonu tamamlayamıyorum. Numaranızı paylaşabilir misiniz?`,
        en: `A phone number is required to confirm the reservation — our agency verifies bookings by phone. 📱 I can also add your email if you like, but I can't complete the reservation without a phone. Could you share your number?`,
        de: `Für die Bestätigung wird eine Telefonnummer benötigt — unsere Agentur bestätigt Buchungen telefonisch. 📱 Ich kann gerne auch Ihre E-Mail hinzufügen, aber ohne Telefon kann ich die Reservierung nicht abschließen. Können Sie Ihre Nummer mitteilen?`,
        ru: `Для подтверждения брони нужен номер телефона — наше агентство подтверждает бронирования по телефону. 📱 При желании могу добавить и ваш email, но без телефона завершить бронирование не могу. Можете указать номер?`,
        ar: `رقم الهاتف مطلوب لتأكيد الحجز — وكالتنا تؤكد الحجوزات هاتفياً. 📱 يمكنني أيضاً إضافة بريدك الإلكتروني إن رغبت، لكن لا يمكنني إتمام الحجز دون هاتف. هل يمكنك مشاركة رقمك؟`,
        fr: `Un numéro de téléphone est requis pour confirmer la réservation — notre agence vérifie les réservations par téléphone. 📱 Je peux aussi ajouter votre e-mail si vous le souhaitez, mais je ne peux pas finaliser la réservation sans téléphone. Pouvez-vous partager votre numéro ?`,
        es: `Se necesita un número de teléfono para confirmar la reserva — nuestra agencia verifica las reservas por teléfono. 📱 También puedo añadir su correo si lo desea, pero no puedo completar la reserva sin teléfono. ¿Puede compartir su número?`,
      };
      const _polReply = _polMsgs[_pyLang] || _polMsgs.tr;
      const _polCtx = { ...context, phoneRefusalCount: _count };
      console.log(`[process-message] V11-a telefon-yok politika mesajı (${_count}. kez)`);
      await _save(_polReply, _polCtx);
      await adapter.sendResponse(_polReply);
      return { success: true, response: _polReply, newContext: _polCtx };
    }
  }

  // === 9. FSM GEÇİŞİ ===
  const fsmInput: ProcessingInput = {
    userMessage: message,
    detectedIntent: fsmIntent,
    extractedInfo,
    selectedTour: selectedTour as any,
    language: context.language,
  };
  const newContext = processTransition(context, fsmInput);
  console.log(`[process-message] ${context.stage} → ${newContext.stage}`);

  // F-E1 canlı-tamamlama (2026-07-28): gönüllü-email HER AŞAMADA state'e uygulanır —
  // transition/bypass'lardan bağımsız TEK-NOKTA. KÖK (canlı kanıt): CONFIRMING'de
  // "mail adresim x@y.com" → hiçbir CONFIRMING-transition'ı tutmadı → genel-merge
  // (aşağıda, YALNIZ COLLECTING_INFO-şartlı) çalışmadı → 13-PERSIST özet-reask'i
  // email'i YAZMADAN return etti (state.email=undefined; birim-testler
  // COLLECTING-adımlarını ölçtüğü için yeşildi — §16.2 sınıfı). :14 RPC p_email
  // newContext'ten okur → buradaki yazım kayda kadar taşınır.
  if ((extractedInfo as any).email && !(newContext.reservationInfo as any)?.email) {
    newContext.reservationInfo = {
      ...newContext.reservationInfo,
      email: (extractedInfo as any).email,
    } as any;
    console.log(`[process-message] F-E1 gönüllü-email uygulandı (stage=${newContext.stage})`);
  }

  // FIX: Geçersiz tarih cleanup — dateId yoksa selectedDate her zaman invalid (BUG 1)
  // extractedInfo da kontrol edilir: TOUR_SELECTED'da FSM geçmeden gelen tarih de yakalanır
  const _invalidDateForPreamble =
    (newContext.reservationInfo?.selectedDate && !newContext.reservationInfo?.dateId)
      ? newContext.reservationInfo.selectedDate
      : (extractedInfo.selectedDate && !extractedInfo.dateId && newContext.currentTour)
        ? extractedInfo.selectedDate
        : undefined;
  if (_invalidDateForPreamble) {
    newContext.reservationInfo = { ...newContext.reservationInfo, selectedDate: undefined };
    // stage waiting_for_date'e çek ki date list deterministik olarak gösterilsin
    if (newContext.stage === "TOUR_SELECTED" || newContext.stage === "COLLECTING_INFO") {
      newContext.stage = "COLLECTING_INFO" as any;
      newContext.collectionStep = "waiting_for_date" as any;
    }
    console.log("[process-message] Invalid date cleaned up:", _invalidDateForPreamble);
  }

  // 2026-07-09 V3-anafora TEK-KAYNAK regex ("öbür/diğer/öteki tarih", 7 dil).
  // Hem telefon-guard muafiyetinde (bare anafora "geçersiz telefon" basmasın)
  // hem :10g öneri-sunumunda kullanılır — kopya-regex senkronsuzluğu (canlı bug
  // sınıfı) YOK. \p{L}\p{N} lookaround (K1 dersi).
  const _v3AnaforaRe = /(?<![\p{L}\p{N}])((?:[öo]b[üu]r|di[ğg]er|[öo]teki|[öo]b[üu]rk[üu])\s*(?:tarih|g[üu]n)|other\s*date|the\s*other\s*(?:one|date)|andere[sn]?\s*datum|autre\s*date|l['’]autre|otra\s*fecha|друг\S*\s*дат\S*|التاريخ\s*الآخر|اليوم\s*الآخر)(?![\p{L}\p{N}])/iu;

  // === 9b-A (CİLA-4, 2026-07-26): TELEFON-ADIMINDA TARİH-YAN-NİYETİ — D1 deseni ===
  // Canlı iki vaka: RU "перенести на двадцатое декабря" → invalid_phone + değişiklik
  // KAYIP (yazı-sayı tarih deterministik katmanda yoktu); AR "التغيير إلى ٢٠ ديسمبر" →
  // merge tarih uygulamış AMA R6 invalid_phone DA basmıştı. KURAL: yan-niyet (change-kw
  // + ay-adı) yakalanırsa invalid_phone ASLA basılmaz — tarih çözülürse UYGULA+ack,
  // çözülemezse anlaşıldı-ack + kısa liste; iki durumda da telefona dönüş. Yazı-sayı
  // köprüsü: NUMBER_WORDS stem-eşleştirme (двадцатое↔двадцать) — YALNIZ bu blokta (dar).
  if (
    newContext.collectionStep === "waiting_for_phone" &&
    context.collectionStep === "waiting_for_phone" &&
    !extractedInfo.phone &&
    !isValidPhone(message.trim())
  ) {
    const _pdMonthM = new RegExp(`(?<![\\p{L}\\p{N}])(${MONTH_ALTERNATION})`, "iu").exec(message);
    if (_pdMonthM && CHANGE_KEYWORDS_RE.test(message)) {
      const _pdLang = newContext.language || "tr";
      const _pdMonthNum = MONTH_NAME_TO_NUMBER[_pdMonthM[1].toLowerCase()] ?? MONTH_NAME_TO_NUMBER[_pdMonthM[1]];
      // Gün: Batı + Arapça-Hint rakam normalize → 1-2 haneli; yoksa yazı-sayı stemi.
      const _pdNorm = message.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
      let _pdDay: number | null = null;
      const _pdDayM = _pdNorm.replace(/\d{4}/g, "").match(/(?<!\d)(\d{1,2})(?!\d)/);
      if (_pdDayM) _pdDay = parseInt(_pdDayM[1], 10);
      if (_pdDay === null) {
        const _nw = NUMBER_WORDS[_pdLang] || NUMBER_WORDS.en || {};
        const _low = _pdNorm.toLocaleLowerCase();
        const _toks = _low.split(/[^\p{L}]+/u).filter(Boolean);
        // D1-1: EN-UZUN-ÖNCE — "девять"(9) stem'i "девятнадцатое"(19) prefix'i olduğundan
        // kısa-key önce eşleşip 19'u 9 yapıyordu. Uzun-key önce denenir.
        for (const [k, v] of Object.entries(_nw).sort((a, b) => b[0].length - a[0].length)) {
          if (typeof v !== "number" || v < 1 || v > 31) continue;
          const _hit = k.includes(" ")
            ? _low.includes(k)
            : k.length >= 4
              ? _toks.some((t) => t.startsWith(k.slice(0, k.length - 1)))
              : _toks.includes(k);
          if (_hit) { _pdDay = v; break; }
        }
      }
      const _pdTour = tours.find((t: any) => t.id === (newContext.currentTour?.id || (newContext.reservationInfo as any).tourId));
      const _pdDates: any[] = _pdTour?.dates || newContext.currentTour?.dates || [];
      const _pdHit = _pdDay !== null && _pdMonthNum
        ? _pdDates.find((d: any) => {
            const _p = String(d?.departure_date || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
            return _p && parseInt(_p[2], 10) === _pdMonthNum && parseInt(_p[3], 10) === _pdDay;
          })
        : null;
      if (_pdHit) {
        newContext.reservationInfo = { ...newContext.reservationInfo, dateId: _pdHit.id, selectedDate: _pdHit.departure_date };
        const _pdText = formatDateForLanguage(_pdHit.departure_date, _pdLang);
        const _pdAckMsgs: Record<string, string> = {
          tr: `*Tarihi* ${_pdText} olarak güncelledim ✨\n\n📱 Telefon numaranızı alabilir miyim?`,
          en: `*Date* updated to ${_pdText} ✨\n\n📱 May I have your phone number?`,
          de: `*Datum* auf ${_pdText} aktualisiert ✨\n\n📱 Könnten Sie mir Ihre Telefonnummer geben?`,
          ru: `*Дата* обновлена на ${_pdText} ✨\n\n📱 Назовите, пожалуйста, ваш номер телефона.`,
          ar: `تم تحديث *التاريخ* إلى ${_pdText} ✨\n\n📱 هل يمكنني الحصول على رقم هاتفك؟`,
          fr: `*Date* mise à jour au ${_pdText} ✨\n\n📱 Puis-je avoir votre numéro de téléphone ?`,
          es: `*Fecha* actualizada al ${_pdText} ✨\n\n📱 ¿Me podría dar su número de teléfono?`,
        };
        const _r = _pdAckMsgs[_pdLang] || _pdAckMsgs.tr;
        console.log(`[process-message] 9b-A tarih-yan-niyet ÇÖZÜLDÜ (${_pdHit.departure_date}) → ack + telefona dönüş (invalid_phone YOK)`);
        await _save(_r, newContext);
        await adapter.sendResponse(_r);
        return { success: true, response: _r, newContext };
      }
      // Çözülemedi → anlaşıldı-ack + kısa liste + telefona dönüş (invalid_phone YOK).
      const _pdList = _pdDates.slice(0, 4)
        .map((d: any, i: number) => `${i + 1}) ${formatDateForLanguage(d.departure_date, _pdLang)}`)
        .join("\n");
      const _pdSoftMsgs: Record<string, string> = {
        tr: `Tarih değişikliği talebinizi anladım 👍 Bu tarihle birebir eşleşme bulamadım. Müsait tarihler:\n${_pdList}\n\nHangi tarihi istersiniz? (Sonrasında telefon numaranızla devam edelim 📱)`,
        en: `I understood your date-change request 👍 I couldn't find an exact match. Available dates:\n${_pdList}\n\nWhich date would you like? (Then we'll continue with your phone number 📱)`,
        de: `Ich habe Ihren Terminänderungswunsch verstanden 👍 Keine genaue Übereinstimmung gefunden. Verfügbare Termine:\n${_pdList}\n\nWelches Datum möchten Sie? (Danach fahren wir mit Ihrer Telefonnummer fort 📱)`,
        ru: `Я понял вашу просьбу о переносе даты 👍 Точного совпадения не нашёл. Доступные даты:\n${_pdList}\n\nКакую дату вы хотите? (Затем продолжим с вашим номером телефона 📱)`,
        ar: `فهمت طلبك لتغيير التاريخ 👍 لم أجد تطابقاً دقيقاً. التواريخ المتاحة:\n${_pdList}\n\nما التاريخ الذي تريده؟ (ثم نكمل برقم هاتفك 📱)`,
        fr: `J'ai compris votre demande de changement de date 👍 Aucune correspondance exacte. Dates disponibles :\n${_pdList}\n\nQuelle date souhaitez-vous ? (Ensuite nous continuerons avec votre numéro 📱)`,
        es: `Entendí su solicitud de cambio de fecha 👍 No encontré coincidencia exacta. Fechas disponibles:\n${_pdList}\n\n¿Qué fecha desea? (Luego continuamos con su número de teléfono 📱)`,
      };
      const _r = _pdSoftMsgs[_pdLang] || _pdSoftMsgs.tr;
      console.log(`[process-message] 9b-A tarih-yan-niyet ANLAŞILDI (çözülemedi: ay=${_pdMonthNum}, gün=${_pdDay}) → soft-ack (invalid_phone YOK)`);
      await _save(_r, newContext);
      await adapter.sendResponse(_r);
      return { success: true, response: _r, newContext };
    }
  }

  // === 9b. GEÇERSİZ TELEFON KONTROLÜ (BUG 4 + 2026-06-26 R6) ===
  // waiting_for_phone'dayken kullanıcı geçersiz girdi yazdıysa erken dön.
  // R6: eski "sadece rakam + <10 hane" koşulu "abc def" / "telefonum yok" / boş
  // mesajları YAKALAMAYIP CONFIRMING özetine kaçırıyordu (canlı bug). Yeni:
  // isValidPhone tek-helper → format-bağımsız tüm geçersiz girdiler yakalanır.
  if (
    newContext.collectionStep === "waiting_for_phone" &&
    context.collectionStep === "waiting_for_phone" &&
    !extractedInfo.phone &&
    !isValidPhone(message.trim()) &&
    // 2026-06-29 D1 FIX: FAQ intent muafiyeti (canlı bug: waiting_for_phone'da
    // "iptal şartları?" → telefon çıkmaz + isValidPhone FALSE → R6 tetiklenir →
    // kullanıcı FAQ cevabı yerine "geçerli telefon değil" görüyordu. İsim/pax
    // adımlarında böyle guard yok, sadece telefon korumalı). FAQ → R6 skip,
    // LLM cevap üretir, KÖK 6 (L3393+) waiting_for_phone suffix'i alta ekler
    // (FAQ commit ebf0f17 doğal tamamlayıcısı). Geçersiz telefon ("abc def" =
    // intent general, FAQ DEĞİL) HÂLÂ guard'a takılır, asıl işi korunur.
    //
    // TODO (genişletme turu): bu FAQ intent listesi 3 yerde tekrar ediyor
    //   - burada (R6)
    //   - _isInfoQuestionFsmIntent (L1978)
    //   - _isInfoQuestionForFlowReturn (L3393)
    // Helper'a çıkarma ve SENKRON intent listesi tutma — post-launch refactor.
    fsmIntent !== "general_question" &&
    fsmIntent !== "support_request" &&
    // 2026-07-03 A-P2 (ii): TUR-SİNYALİ muafiyeti (canlı vaka P2). Mesajda
    // tour-matcher eşleşmesi varsa (tekil selectedTour VEYA çoklu/belirsiz
    // multipleTourMatches) kullanıcı TELEFON değil TUR konuşuyor — "geçerli
    // telefon değil" basma; akış tur-değişim katmanlarına (G5/7c) veya LLM'e
    // düşsün. Saf geçersiz girdi ("abc def") tur eşleşmesi üretmez → R6 korunur.
    selectedTour === null &&
    multipleTourMatches.length === 0 &&
    // 2026-07-09 V3-R6: TARİH-CHANGE muafiyeti (A-P2 tur-muafiyetiyle simetrik).
    // Telefon adımında "tarihi 20 aralık yapalım" → kullanıcı TELEFON değil TARİH
    // konuşuyor → "geçersiz telefon" basma; normal zincire (tarih çözülürse :10d
    // ack / :10e-f, çözülmezse :11 liste). CHANGE_KEYWORDS + tarih-bağlam şart —
    // saf "abc def" tetiklemez (R6 korunur).
    !(CHANGE_KEYWORDS_RE.test(message) &&
      new RegExp(`(?<![\\p{L}\\p{N}])(tarih|tarihi|date|g[üu]n|datum|дата|تاريخ|jour|fecha)(?![\\p{L}\\p{N}])|(?<![\\p{L}\\p{N}])(${MONTH_ALTERNATION})`, "iu").test(message)) &&
    // 2026-07-09 V3-anafora muafiyeti: telefon adımında bare "öbür tarih" →
    // kullanıcı TELEFON değil TARİH konuşuyor → :10g anafora önerisine bırak.
    // (change-keyword'lu "aslında öbür tarih olsun" zaten R6-date muafiyetiyle geçer.)
    !_v3AnaforaRe.test(message) &&
    // 2026-07-09 FABLE-denetim: TARİH-ÖNERİ-ONAYI muafiyeti. :10g telefon
    // adımında öneri yapmışsa (proposedDateId dolu) kullanıcının "evet"i
    // telefon DEĞİL öneri-cevabıdır → :10d-2 kapatsın; R6 yutmasın.
    // (R6 @2218, :10d-2 @~2528 — sıra nedeniyle muafiyet ŞART.)
    !((context as any).proposedDateId && detectConfirmation(message, newContext.language))
  ) {
    // 2026-07-03 İş D (K-19): cümle-yankı sanitize — '"numaram yok mail atsam"
    // geçerli bir telefon değil' saçmalığı. isEchoSafe FALSE ise tırnaklı form
    // yerine jenerik; kısa rakamsı yanlış girdiler ("0532 12") tırnaklı kalır.
    const _phEcho = isEchoSafe(message.trim()) ? message.trim() : null;
    const _phInvalidMsgs: Record<string, string> = _phEcho
      ? {
          tr: `"${_phEcho}" geçerli bir telefon numarası değil. 📱\n\nLütfen tam numaranızı girin (örn: 0532 123 45 67 veya +90 532 123 45 67)`,
          en: `"${_phEcho}" is not a valid phone number. 📱\n\nPlease enter your full number (e.g. +90 532 123 45 67)`,
          de: `"${_phEcho}" ist keine gültige Telefonnummer. 📱\n\nBitte vollständige Nummer eingeben (z.B. +90 532 123 45 67)`,
          ru: `"${_phEcho}" — неверный номер телефона. 📱\n\nВведите полный номер (напр. +90 532 123 45 67)`,
          ar: `"${_phEcho}" ليس رقم هاتف صحيح. 📱\n\nيرجى إدخال رقمك الكامل (مثال: +90 532 123 45 67)`,
          fr: `"${_phEcho}" n'est pas un numéro valide. 📱\n\nVeuillez entrer votre numéro complet (ex: +90 532 123 45 67)`,
          es: `"${_phEcho}" no es un número válido. 📱\n\nIngrese su número completo (ej: +90 532 123 45 67)`,
        }
      : {
          tr: `Bu geçerli bir telefon numarası görünmüyor. 📱\n\nLütfen tam numaranızı girin (örn: 0532 123 45 67 veya +90 532 123 45 67)`,
          en: `That doesn't look like a valid phone number. 📱\n\nPlease enter your full number (e.g. +90 532 123 45 67)`,
          de: `Das scheint keine gültige Telefonnummer zu sein. 📱\n\nBitte vollständige Nummer eingeben (z.B. +90 532 123 45 67)`,
          ru: `Это не похоже на действительный номер телефона. 📱\n\nВведите полный номер (напр. +90 532 123 45 67)`,
          ar: `هذا لا يبدو رقم هاتف صحيحاً. 📱\n\nيرجى إدخال رقمك الكامل (مثال: +90 532 123 45 67)`,
          fr: `Cela ne semble pas être un numéro valide. 📱\n\nVeuillez entrer votre numéro complet (ex: +90 532 123 45 67)`,
          es: `Eso no parece un número válido. 📱\n\nIngrese su número completo (ej: +90 532 123 45 67)`,
        };
    const _phReply = _phInvalidMsgs[newContext.language] || _phInvalidMsgs.tr;
    await _save(_phReply, newContext);
    await adapter.sendResponse(_phReply);
    return { success: true, response: _phReply, newContext };
  }

  // === FIX O6: Aktif tur yoksa deterministik mesaj — AI uydurmasın ===
  // COMPLETED stage hariç: after-sales mesajları tur listesine ihtiyaç duymaz.
  if (tours.length === 0 && newContext.stage !== "COMPLETED") {
    const _agPhone = _agencyPhoneSuffix(agency.phone_public);
    const _noTourMsgs: Record<string, string> = {
      tr: `Şu anda aktif turumuzu bulamıyoruz. Yeni tarihler ve bilgi için lütfen acentemizle iletişime geçin.${_agPhone}`,
      en: `We currently don't have any available tours. Please contact our agency for new dates and information.${_agPhone}`,
      de: `Wir haben derzeit keine verfügbaren Touren. Für neue Termine und Informationen wenden Sie sich bitte an unsere Agentur.${_agPhone}`,
      ru: `В настоящее время у нас нет доступных туров. Пожалуйста, свяжитесь с нашим агентством для получения информации.${_agPhone}`,
      ar: `لا تتوفر لدينا جولات متاحة حالياً. يرجى التواصل مع وكالتنا للحصول على معلومات.${_agPhone}`,
      fr: `Nous n'avons actuellement aucun circuit disponible. Contactez notre agence pour de nouvelles dates et informations.${_agPhone}`,
      es: `Actualmente no tenemos tours disponibles. Por favor contacte nuestra agencia para fechas y más información.${_agPhone}`,
    };
    const _noTourReply = _noTourMsgs[newContext.language] || _noTourMsgs.tr;
    console.warn("[process-message] O6: No available tours — returning deterministic message");
    await _save(_noTourReply, newContext);
    await adapter.sendResponse(_noTourReply);
    return { success: true, response: _noTourReply, newContext };
  }

  // === X8 + B1 + B-TEMA: 2026-06-26 R4 — ERKEN KATMANA TAŞINDI ===
  // (bkz. yukarıda fsmIntent map sonrası "NİTELİK ÖN-TESPİT KATMANI")

  // === B2: Akış ortası tur listesi (deterministik) ===
  // Müşteri COLLECTING_INFO/CONFIRMING'de genel "başka tur var mı?" sorusu sordu.
  // Belirli bir tur eşleşmedi; mevcut akış state'i korunarak tur listesi gösteriliyor.
  if (
    _prePromotionIntent === "tour_search" &&
    (context.stage === "COLLECTING_INFO" || context.stage === "CONFIRMING") &&
    newContext.stage === context.stage &&
    !selectedTour &&
    tours.length > 0
  ) {
    const _exRatesB2 = await getExchangeRatesOnce().catch(() => ({}));
    const _showDualB2 = agency.show_multi_currency !== false;
    const _tourListLines = tours.slice(0, 8).map((t: any, i: number) => {
      const _firstDate = t.dates?.[0];
      const _priceText = _firstDate?.price_adult
        ? ` — ${formatPriceSync(_firstDate.price_adult, t.currency || "TRY", newContext.language, _exRatesB2, _showDualB2, languageCurrencies)}`
        : "";
      return `${i + 1}) ${getLocalizedTourTitle(t.title, newContext.language)}${_priceText}`;
    }).join("\n");

    const _switchNotes: Record<string, string> = {
      tr: `Mevcut turumuz: *${getLocalizedTourTitle(newContext.currentTour?.title || "", newContext.language)}*. Değiştirmek için tur adını yazın — tarih ve kişi bilgileriniz korunur.`,
      en: `Current tour: *${getLocalizedTourTitle(newContext.currentTour?.title || "", newContext.language)}*. To switch, type the tour name — your date and pax info is preserved.`,
      de: `Aktuelle Tour: *${getLocalizedTourTitle(newContext.currentTour?.title || "", newContext.language)}*. Zum Wechseln Tourname eingeben — Datum und Personenzahl bleiben erhalten.`,
      ru: `Текущий тур: *${getLocalizedTourTitle(newContext.currentTour?.title || "", newContext.language)}*. Чтобы переключить, напишите название тура — дата и кол-во человек сохранятся.`,
      ar: `الجولة الحالية: *${getLocalizedTourTitle(newContext.currentTour?.title || "", newContext.language)}*. للتبديل، اكتب اسم الجولة — بياناتك محفوظة.`,
      fr: `Circuit actuel : *${getLocalizedTourTitle(newContext.currentTour?.title || "", newContext.language)}*. Pour changer, tapez le nom — vos date et participants sont conservés.`,
      es: `Tour actual: *${getLocalizedTourTitle(newContext.currentTour?.title || "", newContext.language)}*. Para cambiar, escribe el nombre del tour — tu fecha y personas se conservan.`,
    };
    const _listHeaders: Record<string, string> = {
      tr: "Müsait turlarımız:",
      en: "Our available tours:",
      de: "Unsere verfügbaren Touren:",
      ru: "Доступные туры:",
      ar: "جولاتنا المتاحة:",
      fr: "Nos circuits disponibles :",
      es: "Nuestros tours disponibles:",
    };
    const _b2Reply =
      `${_listHeaders[newContext.language] || _listHeaders.tr}\n${_tourListLines}\n\n` +
      (_switchNotes[newContext.language] || _switchNotes.en);
    await _save(_b2Reply, newContext);
    await adapter.sendResponse(_b2Reply);
    return { success: true, response: _b2Reply, newContext };
  }

  // === 10. İPTAL MESAJI (deterministik) ===
  if (newContext.justCancelled) {
    newContext.justCancelled = false;
    const cancelReply = getCancellationMessage(newContext.language);
    await _save(cancelReply, newContext);
    await adapter.sendResponse(cancelReply);
    return { success: true, response: cancelReply, newContext };
  }

  // === 10b. UNKNOWN_TOUR (deterministik B dalı) — 2026-06-20 Bug 2 kök çözümü ===
  // Kullanıcı bir tur arıyor (intent tour_search/reservation_intent + anlamlı kelime)
  // AMA findMatchingTours hiçbir tur'la eşleyemedi → DB'de yok. LLM'e bırakmak yerine
  // deterministik "X turu sistemimizde yok, müsait turlarımız: ..." mesajı.
  //
  // 2026-06-21 SORUN A FIX: shouldFireUnknownTour helper'ı kullanılıyor. State'te
  // tur seçiliyse (context.currentTour dolu) UNKNOWN_TOUR ATILMAZ — kullanıcı
  // mevcut rezervasyon akışında "rezervasyon yapmak istiyorum" gibi mesaj yazarsa
  // "yapmak turu yok" absürdü çıkmaz. KABUL EDİLEN SINIR: kullanıcı GERÇEKTEN yeni
  // tur arıyorsa ama NLU yakalayamadıysa, LLM cevaplar (yanlış-negatif kabul).
  if (shouldFireUnknownTour(context as any, selectedTour, multipleTourMatches.length, unknownTourQuery, tours.length)) {
    const _exRatesU = await getExchangeRatesOnce().catch(() => ({}));
    const _showDualU = agency.show_multi_currency !== false;
    const _tourListLinesU = tours.slice(0, 8).map((t: any, i: number) => {
      const _firstDate = t.dates?.[0];
      const _priceText = _firstDate?.price_adult
        ? ` — ${formatPriceSync(_firstDate.price_adult, t.currency || "TRY", context.language, _exRatesU, _showDualU, languageCurrencies)}`
        : "";
      return `${i + 1}) ${getLocalizedTourTitle(t.title, context.language)}${_priceText}`;
    }).join("\n");

    // 2026-06-26 B4 fix: "${query} turu" suffix çift-tur ekiyle absürd okunuyordu
    // ("kayak turu turu sistemimizde yok"). Suffix kaldırıldı — "kayak turu sistemimizde
    // bulunmuyor" + "kayak sistemimizde bulunmuyor" her ikisi de doğal okunur.
    const _unknownMsgs: Record<string, string> = {
      tr: `"${unknownTourQuery}" sistemimizde bulunmuyor. 😔\n\nMüsait turlarımız:\n${_tourListLinesU}\n\nHangisi ilginizi çeker?`,
      en: `"${unknownTourQuery}" is not in our system. 😔\n\nAvailable tours:\n${_tourListLinesU}\n\nWhich interests you?`,
      de: `"${unknownTourQuery}" ist nicht in unserem System. 😔\n\nVerfügbare Touren:\n${_tourListLinesU}\n\nWelche interessiert Sie?`,
      ru: `"${unknownTourQuery}" нет в нашей системе. 😔\n\nДоступные туры:\n${_tourListLinesU}\n\nКакой вас интересует?`,
      ar: `"${unknownTourQuery}" غير موجود في نظامنا. 😔\n\nالجولات المتاحة:\n${_tourListLinesU}\n\nما الذي يثير اهتمامك؟`,
      fr: `"${unknownTourQuery}" n'est pas dans notre système. 😔\n\nCircuits disponibles :\n${_tourListLinesU}\n\nLequel vous intéresse ?`,
      es: `"${unknownTourQuery}" no está en nuestro sistema. 😔\n\nTours disponibles:\n${_tourListLinesU}\n\n¿Cuál le interesa?`,
    };
    const _unknownReply = _unknownMsgs[context.language] || _unknownMsgs.tr;
    await _save(_unknownReply, context);
    await adapter.sendResponse(_unknownReply);
    return { success: true, response: _unknownReply, newContext: context };
  }

  // === 10c. VİZE DETERMİNİSTİK CEVAP (DATA-GAP FIX 3, 2026-07-03) ===
  // Vize = en yüksek tekil hasar alanı: yanlış "vize gerekmiyor" cevabı
  // müşterinin seyahatini iptal ettirebilir. LLM'e HİÇ düşmez.
  //
  // 2026-07-03 VISA-GATE REVİZE (canlı kanıt): tetik SADECE ham NLU intent'i
  // (visa_support) idi — Haiku "bu tur için vize ihtiyacı var mı" / "vize
  // lazım mı" sorularına faq_general dedi → :10c bypass → LLM "vize gerekmez"
  // dedi (bu bloğun yasakladığı cümle). K1/X7 deseni: NLU sınıflaması
  // güvenilmez, deterministik sinyal otorite. Yeni tetik:
  //   hamIntent === "visa_support"  (mevcut yol korunur)
  //   VEYA VISA_SIGNAL_RE (vize kelimesi, 7 dil) + SORU niteliği
  //        (QUESTION_SIGNAL_RE ∪ VISA_QUESTION_HINT_RE — "lazım mı/gerekli mi/
  //        required" kalıpları global regex'te YOK; ORAYA eklemek PROVIDE
  //        PROMOTE'u daraltırdı → lokal tamamlayıcı kalıp, visa-detection.ts).
  // Soru şartının amacı: "vizem hazır, sorun yok" gibi bildirimler
  // yönlendirmeye takılmasın, LLM doğal cevap versin.
  //
  // R6 etkileşimi: visa_support → general_question → R6 muafiyet listesinde ✅
  //   (telefon adımında vize sorusu R6'ya takılmaz; ayrıca bu blok R6'dan
  //   SONRA olduğundan R6 muafiyeti zaten mesajı buraya ulaştırır).
  //   NOT: NLU faq_general dediğinde de map general_question → R6 muaf ✅.
  // Tur bağlamı YOKKEN de deterministik yönlendirme (LLM'e bırakılmaz):
  //   vize turdan bağımsız da kişisel duruma bağlıdır; genel soruda LLM'in
  //   uydurma riskini açmanın gereği yok — karar: her durumda deterministik.
  // visa_required=false GÜVENİLMEZ (şema DEFAULT false — boş bırakılmış tur
  //   false görünür): "vize gerekmez" DEMEYİZ. Sadece visa_notes doluysa
  //   içerik verilir; visa_required=true + notes boşsa "gerekli + acenteye
  //   danışın"; diğer her durumda genel yönlendirme.
  const _visaAsksQuestion =
    QUESTION_SIGNAL_RE.test(message) || VISA_QUESTION_HINT_RE.test(message);
  const _visaGateFires =
    nluResult.intent === "visa_support" ||
    (VISA_SIGNAL_RE.test(message) && _visaAsksQuestion);
  if (_visaGateFires) {
    const _visaTour = newContext.currentTour ? findTourById(newContext.currentTour.id, tours) : null;
    const _agPhoneV = _agencyPhoneSuffix(agency.phone_public);
    let _visaReply: string;
    if (_visaTour?.visa_notes) {
      const _vn: Record<string, string> = {
        tr: `🛂 *${getLocalizedTourTitle(_visaTour.title, newContext.language)}* vize bilgisi:\n${_visaTour.visa_notes}\n\nKişisel durumunuza göre gereklilikler değişebilir — kesin bilgi için acentemize danışabilirsiniz.${_agPhoneV}`,
        en: `🛂 Visa info for *${getLocalizedTourTitle(_visaTour.title, newContext.language)}*:\n${_visaTour.visa_notes}\n\nRequirements may vary by personal situation — please confirm with our agency.${_agPhoneV}`,
        de: `🛂 Visa-Info für *${getLocalizedTourTitle(_visaTour.title, newContext.language)}*:\n${_visaTour.visa_notes}\n\nAnforderungen können je nach persönlicher Situation variieren — bitte bestätigen Sie mit unserer Agentur.${_agPhoneV}`,
        ru: `🛂 Визовая информация для *${getLocalizedTourTitle(_visaTour.title, newContext.language)}*:\n${_visaTour.visa_notes}\n\nТребования могут зависеть от личной ситуации — уточните в нашем агентстве.${_agPhoneV}`,
        ar: `🛂 معلومات التأشيرة لـ *${getLocalizedTourTitle(_visaTour.title, newContext.language)}*:\n${_visaTour.visa_notes}\n\nقد تختلف المتطلبات حسب حالتك الشخصية — يرجى التأكيد مع وكالتنا.${_agPhoneV}`,
        fr: `🛂 Infos visa pour *${getLocalizedTourTitle(_visaTour.title, newContext.language)}* :\n${_visaTour.visa_notes}\n\nLes exigences peuvent varier selon votre situation — veuillez confirmer avec notre agence.${_agPhoneV}`,
        es: `🛂 Información de visa para *${getLocalizedTourTitle(_visaTour.title, newContext.language)}*:\n${_visaTour.visa_notes}\n\nLos requisitos pueden variar según su situación — confirme con nuestra agencia.${_agPhoneV}`,
      };
      _visaReply = _vn[newContext.language] || _vn.en;
    } else if (_visaTour?.visa_required === true) {
      const _vr: Record<string, string> = {
        tr: `🛂 *${getLocalizedTourTitle(_visaTour.title, newContext.language)}* için vize gereklidir. Gereklilikler kişisel duruma göre değişebildiği için detaylı bilgiyi acentemizden almanızı rica ederiz.${_agPhoneV}`,
        en: `🛂 A visa is required for *${getLocalizedTourTitle(_visaTour.title, newContext.language)}*. As requirements vary by personal situation, please contact our agency for details.${_agPhoneV}`,
        de: `🛂 Für *${getLocalizedTourTitle(_visaTour.title, newContext.language)}* ist ein Visum erforderlich. Da die Anforderungen variieren, wenden Sie sich bitte an unsere Agentur.${_agPhoneV}`,
        ru: `🛂 Для *${getLocalizedTourTitle(_visaTour.title, newContext.language)}* требуется виза. Требования зависят от личной ситуации — обратитесь в наше агентство.${_agPhoneV}`,
        ar: `🛂 التأشيرة مطلوبة لـ *${getLocalizedTourTitle(_visaTour.title, newContext.language)}*. تختلف المتطلبات حسب الحالة الشخصية — يرجى التواصل مع وكالتنا.${_agPhoneV}`,
        fr: `🛂 Un visa est requis pour *${getLocalizedTourTitle(_visaTour.title, newContext.language)}*. Les exigences variant selon la situation, veuillez contacter notre agence.${_agPhoneV}`,
        es: `🛂 Se requiere visa para *${getLocalizedTourTitle(_visaTour.title, newContext.language)}*. Los requisitos varían según la situación — contacte con nuestra agencia.${_agPhoneV}`,
      };
      _visaReply = _vr[newContext.language] || _vr.en;
    } else {
      const _vg: Record<string, string> = {
        tr: `🛂 Vize gereklilikleri kişisel duruma (uyruk, pasaport türü vb.) göre değişebildiği için bu konuda net bilgiyi acentemizden almanızı rica ederiz.${_agPhoneV}`,
        en: `🛂 Visa requirements depend on your personal situation (nationality, passport type, etc.), so please contact our agency for accurate information.${_agPhoneV}`,
        de: `🛂 Visabestimmungen hängen von Ihrer persönlichen Situation ab (Nationalität, Passtyp usw.) — bitte wenden Sie sich für genaue Informationen an unsere Agentur.${_agPhoneV}`,
        ru: `🛂 Визовые требования зависят от вашей личной ситуации (гражданство, тип паспорта и т.д.) — за точной информацией обратитесь в наше агентство.${_agPhoneV}`,
        ar: `🛂 تعتمد متطلبات التأشيرة على حالتك الشخصية (الجنسية، نوع جواز السفر وغيرها) — يرجى التواصل مع وكالتنا للحصول على معلومات دقيقة.${_agPhoneV}`,
        fr: `🛂 Les exigences de visa dépendent de votre situation personnelle (nationalité, type de passeport, etc.) — veuillez contacter notre agence pour des informations précises.${_agPhoneV}`,
        es: `🛂 Los requisitos de visa dependen de su situación personal (nacionalidad, tipo de pasaporte, etc.) — contacte con nuestra agencia para información precisa.${_agPhoneV}`,
      };
      _visaReply = _vg[newContext.language] || _vg.en;
    }
    console.log(`[process-message] :10c VISA deterministik cevap (tetik=${nluResult.intent === "visa_support" ? "intent" : "signal+question"}, tour=${_visaTour?.id ?? "yok"}, notes=${!!_visaTour?.visa_notes}, required=${_visaTour?.visa_required === true})`);
    await _save(_visaReply, newContext);
    await adapter.sendResponse(_visaReply);
    return { success: true, response: _visaReply, newContext };
  }

  // === 10d. TARİH-DEĞİŞİM ACK (P5, 2026-07-03) ===
  // Canlı vaka (WhatsApp): waiting_for_name'de "hayır şubatın yirmisi" → tarih
  // state'te DOĞRU değişti (FSM merge + BUG-X4 override) ama "güncelledim" ack'i
  // gitmedi — sessiz değişiklik. Matristeki tarih ⚠ hücreleri (§3b).
  // A3-date'in _hasChangeKeyword şartını gevşetmek YERİNE FSM-SONRASI deterministik
  // kontrol: eski dateId DOLUYDU + yeni dateId FARKLI → ack + mevcut adımın sorusu.
  // İLK atama (null→değer) ack ÜRETMEZ (o :11a-AUTO/MANUAL-DATE-ACK'in işi).
  // ÇİFT-ACK riski YAPISAL SIFIR: A3-date tetiklenmişse kendi RETURN'ünü yapar,
  // FSM'e ve buraya hiç ulaşılmaz.
  {
    const _p5OldDateId = (context.reservationInfo as any)?.dateId;
    const _p5NewDateId = (newContext.reservationInfo as any)?.dateId;
    const _p5Step = String(newContext.collectionStep || "");
    if (
      _p5OldDateId &&
      _p5NewDateId &&
      _p5OldDateId !== _p5NewDateId &&
      newContext.stage === "COLLECTING_INFO" &&
      STEP_QUESTIONS[_p5Step]
    ) {
      const _lang5 = newContext.language || "tr";
      const _oldD = formatDateForLanguage((context.reservationInfo as any)?.selectedDate || "", _lang5);
      const _newRaw = (newContext.reservationInfo as any)?.selectedDate || "";
      const _newWd = getWeekdayName(_newRaw, _lang5);
      const _newD = formatDateForLanguage(_newRaw, _lang5) + (_newWd ? ` (${_newWd})` : "");
      const _ackMsgs: Record<string, string> = {
        tr: `*Tarihi* ${_oldD} → ${_newD} olarak güncelledim. ✨`,
        en: `*Date* updated from ${_oldD} → ${_newD}. ✨`,
        de: `*Datum* von ${_oldD} → ${_newD} aktualisiert. ✨`,
        ru: `*Дата* обновлена с ${_oldD} → ${_newD}. ✨`,
        ar: `تم تحديث *التاريخ* من ${_oldD} إلى ${_newD}. ✨`,
        fr: `*Date* mise à jour de ${_oldD} → ${_newD}. ✨`,
        es: `*Fecha* actualizada de ${_oldD} → ${_newD}. ✨`,
      };
      const _stepQ = STEP_QUESTIONS[_p5Step][_lang5] || STEP_QUESTIONS[_p5Step].en;
      const _p5Reply = `${_ackMsgs[_lang5] || _ackMsgs.tr}\n\n${_stepQ}`;
      console.log(`[process-message] :10d P5 tarih-değişim ack (${_p5OldDateId}→${_p5NewDateId}, step=${_p5Step})`);
      await _save(_p5Reply, newContext);
      await adapter.sendResponse(_p5Reply);
      return { success: true, response: _p5Reply, newContext };
    }
  }

  // === 10d-2. TARİH ÖNERİSİ ONAY TAMAMLAMA (V2-b + V3-anafora, 2026-07-09) ===
  // İş 1 ("farketmez"→en yakın öneri) ve İş 3 ("öbür tarih"→diğer tarih önerisi)
  // context.proposedDateId'yi doldurur + onay ister. Bir sonraki turn burada
  // kapanır: kullanıcı ONAYLARSA önerilen tarih SEÇİLİR (detectConfirmation —
  // DRY, yeni pending-state YOK). FARKLI tarih yazdıysa (Blok 8/9 çözdü) öneri
  // geçersiz → sadece temizle, P5/:11a normal devralır. Ne onay ne tarih →
  // öneriyi temizle (bayat "evet" ileride yanlış tarih seçmesin), normal akış.
  {
    const _propId = (context as any).proposedDateId as string | undefined;
    if (_propId && newContext.stage === "COLLECTING_INFO") {
      const _propNewDateId = (newContext.reservationInfo as any)?.dateId;
      if (_propNewDateId && _propNewDateId !== _propId) {
        // Kullanıcı bu turn'de FARKLI tarih verdi → öneri düşer, normal akış.
        newContext.proposedDateId = undefined;
        newContext.proposedDate = undefined;
      } else if (detectConfirmation(message, newContext.language)) {
        const _propTour = newContext.currentTour ? findTourById(newContext.currentTour.id, tours) : null;
        const _propDate = (_propTour?.dates || []).find((d: any) => d.id === _propId);
        if (_propDate) {
          newContext.reservationInfo.dateId = _propDate.id;
          newContext.reservationInfo.selectedDate = _propDate.departure_date;
          newContext.proposedDateId = undefined;
          newContext.proposedDate = undefined;
          newContext.collectionStep = determineCollectionStep(newContext.reservationInfo, newContext.collectEmail);
          const _lang = newContext.language || "tr";
          const _wd = getWeekdayName(_propDate.departure_date, _lang);
          const _dt = formatDateForLanguage(_propDate.departure_date, _lang) + (_wd ? ` (${_wd})` : "");
          const _stepKey = String(newContext.collectionStep || "");
          const _stepQ = STEP_QUESTIONS[_stepKey]?.[_lang] || STEP_QUESTIONS[_stepKey]?.en || "";
          const _okMsgs: Record<string, string> = {
            tr: `Harika, ${_dt} olarak aldım. ✅`,
            en: `Great, I've set it to ${_dt}. ✅`,
            de: `Super, ich habe ${_dt} eingetragen. ✅`,
            ru: `Отлично, записал на ${_dt}. ✅`,
            ar: `رائع، تم الحجز ليوم ${_dt}. ✅`,
            fr: `Parfait, j'ai noté le ${_dt}. ✅`,
            es: `Perfecto, lo he fijado para ${_dt}. ✅`,
          };
          const _core = _okMsgs[_lang] || _okMsgs.tr;
          const _propReply = _stepQ ? `${_core}\n\n${_stepQ}` : _core;
          console.log(`[process-message] :10d-2 tarih-öneri ONAYLANDI (${_propId}) → seçildi, step=${_stepKey}`);
          await _save(_propReply, newContext);
          await adapter.sendResponse(_propReply);
          return { success: true, response: _propReply, newContext };
        }
        // Önerilen tarih artık bulunamadı (edge) → temizle, normal akış.
        newContext.proposedDateId = undefined;
        newContext.proposedDate = undefined;
      } else {
        // Ne onay ne farklı tarih → öneriyi temizle, normal akışa bırak.
        newContext.proposedDateId = undefined;
        newContext.proposedDate = undefined;
      }
    }
  }

  // === 10e. V10 MÜSAİTLİK-SORUSU CEVABI (2026-07-09) ===
  // Canlı: pax adımında "20'si de müsait mi hala" → I-9 ordinal'ı tarih İŞLEMİ
  // yapıyordu + kullanıcıyı tarih listesine geri çekiyordu. Soru ≠ seçim.
  // info-extractor availabilityQueryDay flag'ini set etti (müsaitlik-kelime
  // + ordinal, tarih SEÇMEDİ). Burada: sorulan gün müsait mi cevapla +
  // MEVCUT ADIMIN sorusu (liste DEĞİL — geri çekme yok). :10d deseni.
  {
    const _avDay = (extractedInfo as any).availabilityQueryDay;
    if (_avDay && newContext.currentTour) {
      const _avTour = findTourById(newContext.currentTour.id, tours);
      const _avMatches = (_avTour?.dates || []).filter((d: any) => {
        const p = d.departure_date?.match(/\d{4}-\d{2}-(\d{2})/);
        return p && parseInt(p[1]) === _avDay;
      });
      const _avLang = newContext.language || "tr";
      const _avStepKey = String(newContext.collectionStep || "");
      const _avStepQ = STEP_QUESTIONS[_avStepKey]?.[_avLang] || STEP_QUESTIONS[_avStepKey]?.en || "";
      let _avCore: string;
      const _avAvail = _avMatches.filter((d: any) => getQuotaRemaining(d) > 0);
      if (_avAvail.length >= 1) {
        const _avList = _avAvail.map((d: any) => {
          const _w = getWeekdayName(d.departure_date, _avLang);
          const _rem = getQuotaRemaining(d);
          const _dt = formatDateForLanguage(d.departure_date, _avLang) + (_w ? ` (${_w})` : "");
          // 2026-07-09 FAZ4-P3: TR+EN → 7-dil tek-kaynak (quota-labels.ts).
          return `${_dt}${quotaLabel(_rem, false, _avLang)}`;
        }).join(", ");
        const _avYes: Record<string, string> = {
          tr: `Evet, ${_avList} müsait ✅`,
          en: `Yes, ${_avList} available ✅`,
          de: `Ja, ${_avList} verfügbar ✅`,
          ru: `Да, ${_avList} доступно ✅`,
          ar: `نعم، ${_avList} متاح ✅`,
          fr: `Oui, ${_avList} disponible ✅`,
          es: `Sí, ${_avList} disponible ✅`,
        };
        _avCore = _avYes[_avLang] || _avYes.en;
      } else {
        const _avNo: Record<string, string> = {
          tr: `Ayın ${_avDay}'i için şu an müsaitlik görünmüyor. 😔`,
          en: `No availability for the ${_avDay}th at the moment. 😔`,
          de: `Für den ${_avDay}. ist derzeit keine Verfügbarkeit. 😔`,
          ru: `На ${_avDay}-е сейчас нет мест. 😔`,
          ar: `لا يوجد توفر لليوم ${_avDay} حالياً. 😔`,
          fr: `Pas de disponibilité pour le ${_avDay} pour le moment. 😔`,
          es: `No hay disponibilidad para el ${_avDay} por ahora. 😔`,
        };
        _avCore = _avNo[_avLang] || _avNo.en;
      }
      const _avReply = _avStepQ ? `${_avCore}\n\n${_avStepQ}` : _avCore;
      console.log(`[process-message] :10e V10 müsaitlik-cevabı (gün=${_avDay}, müsait=${_avAvail.length}, step=${_avStepKey}) — tarih DEĞİŞMEDİ`);
      await _save(_avReply, newContext);
      await adapter.sendResponse(_avReply);
      return { success: true, response: _avReply, newContext };
    }
  }

  // === 10f. V9 ÇİFT-EŞLEŞME TARİH NETLEŞTİRME (2026-07-09) ===
  // Canlı: "ayın 20'si" (20 Aralık VE 20 Şubat varken) → sessizce ilki seçiliyordu.
  // info-extractor dateAmbiguousDay flag'ini set etti (seçim YAPMADI). Burada
  // deterministik netleştirme: eşleşen tarihleri GLOBAL indeksleriyle (:11
  // mekanizmasıyla aynı — Blok 8 rakam-seçimi doğal çalışsın, ek state YOK) bas +
  // collectionStep=waiting_for_date (sonraki "1"/"4" veya "20 aralık" çözülür).
  {
    const _ambDay = (extractedInfo as any).dateAmbiguousDay;
    if (_ambDay && newContext.currentTour) {
      const _ambTour = findTourById(newContext.currentTour.id, tours);
      const _ambLang = newContext.language || "tr";
      const _ambLines = (_ambTour?.dates || [])
        .map((d: any, i: number) => ({ d, i }))
        .filter(({ d }: any) => {
          const p = d.departure_date?.match(/\d{4}-\d{2}-(\d{2})/);
          return p && parseInt(p[1]) === _ambDay;
        })
        .map(({ d, i }: any) => {
          const _w = getWeekdayName(d.departure_date, _ambLang);
          // GLOBAL indeks (i+1) — Blok 8 tour.dates[n-1] ile birebir
          return `${i + 1}) ${formatDateForLanguage(d.departure_date, _ambLang)}${_w ? ` (${_w})` : ""}`;
        })
        .join("\n");
      const _ambMsgs: Record<string, string> = {
        tr: `Ayın ${_ambDay}'i birden fazla turumuzda var:\n${_ambLines}\n\nHangisini tercih edersiniz? (numara veya tarih yazın)`,
        en: `The ${_ambDay}th appears in more than one tour:\n${_ambLines}\n\nWhich one do you prefer? (type the number or date)`,
        de: `Der ${_ambDay}. kommt in mehreren Touren vor:\n${_ambLines}\n\nWelche bevorzugen Sie? (Nummer oder Datum)`,
        ru: `${_ambDay}-е есть в нескольких турах:\n${_ambLines}\n\nКакой предпочитаете? (номер или дата)`,
        ar: `اليوم ${_ambDay} موجود في أكثر من جولة:\n${_ambLines}\n\nأيهما تفضل؟ (الرقم أو التاريخ)`,
        fr: `Le ${_ambDay} figure dans plusieurs circuits :\n${_ambLines}\n\nLequel préférez-vous ? (numéro ou date)`,
        es: `El ${_ambDay} aparece en más de un tour:\n${_ambLines}\n\n¿Cuál prefiere? (número o fecha)`,
      };
      const _ambReply = _ambMsgs[_ambLang] || _ambMsgs.en;
      // Tarih seçimini bir sonraki turn'e taşı: waiting_for_date (Blok 8/9 devralır).
      newContext.collectionStep = "waiting_for_date" as any;
      console.log(`[process-message] :10f V9 çift-eşleşme netleştirme (gün=${_ambDay}) — sessiz ilk-seçim YOK`);
      await _save(_ambReply, newContext);
      await adapter.sendResponse(_ambReply);
      return { success: true, response: _ambReply, newContext };
    }
  }

  // === 10g. TARİH ÖNERİSİ SUNUMU (V2-b "farketmez" + V3-anafora, 2026-07-09) ===
  // İki ÜRÜN-KARARI-b senaryosu bot'un TEK tarih ÖNERİP onay istemesini gerektirir
  // (otomatik-seç DEĞİL — kullanıcı hangisi olduğunu görsün):
  //  İş 1: waiting_for_date + "farketmez/en yakın/ilk/en erken/siz seçin" (7 dil)
  //        → EN YAKIN müsait tarihi öner. "farketmez" YALNIZ bu adımda sinyaldir.
  //  İş 3: dateId DOLU + tam 2 tarihli tur + "öbür/diğer/öteki tarih" (7 dil)
  //        → seçili OLMAYAN diğer tarihi öner (telefon adımında da çalışır —
  //        V3-R6 tarih-change muafiyeti zaten var). 3+ tarih/boş dateId → :11 liste.
  // Öneri context.proposedDateId'ye yazılır → sonraki turn :10d-2 onayı kapatır.
  {
    const _pLang = newContext.language || "tr";
    const _pTour = newContext.currentTour ? findTourById(newContext.currentTour.id, tours) : null;
    const _pDates = (_pTour?.dates || []) as any[];
    const _curDateId = (newContext.reservationInfo as any)?.dateId;
    // Sinyal regex'leri (post-LLM deterministik, \p{L}\p{N} lookaround — K1 dersi)
    // FABLE-review2: çıplak "ilk" bağlam-şartlı daraltıldı ("ilk defa
    // geliyorum" FP'siydi) — yalnız tarih/gün/uygun/müsait/olan öncülü + "ilki".
    const _anyDateSignal = /(?<![\p{L}\p{N}])(en\s*yak[ıi]n|ilk(?=\s*(?:tarih|g[üu]n|uygun|müsait|musait|olan))|ilki|en\s*erken|farketmez|fark\s*etmez|siz\s*se[çc]in|sen\s*se[çc]|hangisi\s*olursa|nearest|earliest|soonest|first\s*available|any\s*(?:date|day)|whichever|you\s*(?:choose|pick|decide)|n[äa]chst\S*|fr[üu]hest\S*|egal|such\S*\s*(?:aus|sie)|ближайш\S*|[бb]лижайш\S*|л[юю]б\S*\s*дат\S*|выбер\S*\s*вы|le\s*plus\s*proche|au\s*plus\s*t[ôo]t|peu\s*importe|choisissez|m[áa]s\s*cercan\S*|lo\s*antes|cualquier\S*|elija\s*usted|أقرب|الأقرب|أي\s*تاريخ|اختر\s*أنت)(?![\p{L}\p{N}])/iu;

    // İş 3 anafora — dateId DOLU + tam 2 tarih + "öbür tarih" (tek-kaynak _v3AnaforaRe)
    if (
      _curDateId && _pDates.length === 2 && _v3AnaforaRe.test(message) &&
      !newContext.proposedDateId
    ) {
      const _other = _pDates.find((d: any) => d.id !== _curDateId && getQuotaRemaining(d) > 0);
      if (_other) {
        const _wd = getWeekdayName(_other.departure_date, _pLang);
        const _dt = formatDateForLanguage(_other.departure_date, _pLang) + (_wd ? ` (${_wd})` : "");
        const _msgs: Record<string, string> = {
          tr: `Diğer tarihimiz ${_dt} — bununla devam edelim mi? ✅`,
          en: `Our other date is ${_dt} — shall we go with this one? ✅`,
          de: `Unser anderes Datum ist ${_dt} — sollen wir damit fortfahren? ✅`,
          ru: `Другая наша дата — ${_dt} — продолжим с ней? ✅`,
          ar: `تاريخنا الآخر هو ${_dt} — هل نتابع به؟ ✅`,
          fr: `Notre autre date est ${_dt} — on continue avec celle-ci ? ✅`,
          es: `Nuestra otra fecha es ${_dt} — ¿continuamos con esta? ✅`,
        };
        const _reply = _msgs[_pLang] || _msgs.tr;
        newContext.proposedDateId = _other.id;
        newContext.proposedDate = _other.departure_date;
        console.log(`[process-message] :10g V3-anafora öneri (diğer tarih=${_other.id}) — onay bekleniyor`);
        await _save(_reply, newContext);
        await adapter.sendResponse(_reply);
        return { success: true, response: _reply, newContext };
      }
    }

    // İş 1 farketmez — waiting_for_date + sinyal + tarih henüz seçilmedi
    // 2026-07-09 FABLE-review2 (KÖK6 sınıfı): FAQ-intent guard'ı EKLENDİ —
    // "ilk önce iptal şartlarını sorayım" gibi mesajlarda "ilk" sinyali tarih
    // öneriyordu, soru yutuluyordu (:10g, :11-KÖK6 guard'ından ÖNCE koşar).
    // QUESTION_SIGNAL bilinçli DIŞLANMADI ("en yakın tarih ne zaman?" sorusuna
    // öneri+onay İYİ cevaptır — V10 zıt-yön dersi); yalnız FAQ-intent'leri.
    if (
      newContext.stage === "COLLECTING_INFO" &&
      newContext.collectionStep === "waiting_for_date" &&
      fsmIntent !== "general_question" && fsmIntent !== "support_request" &&
      !_curDateId && !newContext.proposedDateId &&
      _anyDateSignal.test(message) && _pDates.length > 0
    ) {
      const _istToday = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
      const _nearest = _pDates
        .filter((d: any) => getQuotaRemaining(d) > 0 && String(d.departure_date) >= _istToday)
        .sort((a: any, b: any) => String(a.departure_date).localeCompare(String(b.departure_date)))[0];
      if (_nearest) {
        const _wd = getWeekdayName(_nearest.departure_date, _pLang);
        const _dt = formatDateForLanguage(_nearest.departure_date, _pLang) + (_wd ? ` (${_wd})` : "");
        const _msgs: Record<string, string> = {
          tr: `En yakın tarihimiz ${_dt} — bununla devam edelim mi? ✅`,
          en: `Our nearest date is ${_dt} — shall we go with this one? ✅`,
          de: `Unser nächstes Datum ist ${_dt} — sollen wir damit fortfahren? ✅`,
          ru: `Наша ближайшая дата — ${_dt} — продолжим с ней? ✅`,
          ar: `أقرب تاريخ لدينا هو ${_dt} — هل نتابع به؟ ✅`,
          fr: `Notre date la plus proche est ${_dt} — on continue avec celle-ci ? ✅`,
          es: `Nuestra fecha más cercana es ${_dt} — ¿continuamos con esta? ✅`,
        };
        const _reply = _msgs[_pLang] || _msgs.tr;
        newContext.proposedDateId = _nearest.id;
        newContext.proposedDate = _nearest.departure_date;
        console.log(`[process-message] :10g V2-b farketmez öneri (en yakın=${_nearest.id}) — onay bekleniyor`);
        await _save(_reply, newContext);
        await adapter.sendResponse(_reply);
        return { success: true, response: _reply, newContext };
      }
    }
  }

  // === 11. TARİH LİSTESİ (deterministik) — D5: tarih sorusu HER stage'de yakalar ===
  // 2026-06-19 (Bug A3 kök çözümü): LLM artık tarih KONUŞMUYOR. Tarih listesi
  // YALNIZ deterministik gönderilir. Tetik koşulları:
  //   (a) COLLECTING_INFO+waiting_for_date → mevcut otomatik akış
  //   (b) TOUR_SELECTED veya COLLECTING_INFO HERHANGİ adımda kullanıcı tarih
  //       sorusu sorarsa (intent + tarih kelime) → A3 ve TOUR_SELECTED A3-kuzeni
  //       senaryoları DETERMINISTIK kapanır. "⛔ TARİH YASAK" diktası asla
  //       primary koruma değil, sadece defansif suffix.
  // ELSE dalı: tour.dates boş → deterministik "tarih yok, acenteye yönlendir" (D3).
  // DATE_QUERY_RE + DATE_INTENTS tek-kaynak: ../constants/date-detection.ts (test
  // davranışsal olarak orayı çağırır — substring değil, runtime regex doğrulaması).
  //
  // 2026-06-25 KÖK 6 FIX (canlı G1 — waiting_for_date'te "iptal şartları"):
  // (a) dalı (waiting_for_date otomatik) mesaj İÇERİĞİNE bakmıyordu → bilgi sorusu
  // intent'leri (general_question, support_request) de :11'e takılıyor, tarih
  // listesi tekrar gösteriliyordu → kullanıcı sorusu yutuluyordu.
  // Çözüm: (a) dalına intent guard. Bilgi sorusu intent'lerinde :11 ATLA → LLM
  // cevaplasın + midFlowReturnPrompt akışa döndürür ("...tarih seçimine devam...").
  // Bug C (detectCancellationGuarded) ile aynı niyet/akış ayrımı pattern'i.
  const _isInfoQuestionFsmIntent =
    fsmIntent === "general_question" || fsmIntent === "support_request";
  const _askingViaQuery = DATE_QUERY_RE.test(message) && DATE_INTENTS.includes(fsmIntent);
  // 2026-06-25 BUG-X1 FIX (c) dal: TOUR_SELECTED'da rezervasyon başlatma niyeti
  // → tarih listesi deterministik göster. Canlı kanıt (exec 8f65305e): "pamukkale
  // turuna kayıt olmak istiyorum" → TOUR_SELECTED'a geçti AMA (a) sağlanmadı
  // (COLLECTING_INFO değil) + (b) sağlanmadı (DATE_QUERY_RE eşleşmez) → :11 atlandı
  // → LLM "müsait tarihleri kontrol ediyorum" der ama liste atlar (M1 kırılganlık).
  // (c) dalı: TOUR_SELECTED + reservation_intent/tour_selected → deterministik liste.
  // SADECE bu 2 intent — tour_search/general_question (KÖK 6) etkilenmez.
  const _isNewReservationIntent =
    newContext.stage === "TOUR_SELECTED" &&
    (fsmIntent === "reservation_intent" || fsmIntent === "tour_selected");
  const _isUserAskingDates =
    !!newContext.currentTour &&
    !_isInfoQuestionFsmIntent &&   // KÖK 6: bilgi sorusu intent'leri :11'i atlatır
    (
      // (a) Veri-toplama akışında tarih adımı: otomatik
      (newContext.stage === "COLLECTING_INFO" && newContext.collectionStep === "waiting_for_date") ||
      // (b) Kullanıcı tarih sorusu sordu (TOUR_SELECTED veya COLLECTING_INFO herhangi adım)
      ((newContext.stage === "TOUR_SELECTED" || newContext.stage === "COLLECTING_INFO") && _askingViaQuery) ||
      // (c) BUG-X1 fix: TOUR_SELECTED'da rezervasyon başlatma niyeti
      _isNewReservationIntent
    );

  // 2026-07-01 PROBLEM 1 fix: (d) takılma güvenlik ağı _isUserAskingDates ÜST guard'ından
  // ÇIKARILDI (canlı kanıt de045d24: NLU faq_general → FSM general_question →
  // _isInfoQuestionFsmIntent TRUE → üst guard FALSE → (d) hiç ulaşılamıyordu, TAM DA
  // en çok gereken senaryoda devre dışıydı). Ayrı koşul olarak yeniden ifade edildi:
  // FAQ intent guard'ından BAĞIMSIZ — amacı zaten o intent'lerin takılma yarattığı
  // durumu kapatmak.
  // Yanlış-pozitif daraltma: mesajda sayı VAR koşulu. Gerçek FAQ ("iptal şartları?" —
  // sayı yok) tetiklenmez → LLM FAQ cevap verir. Rezervasyon sinyali içeren mesaj
  // ("pamukkale 3 kişi 20 aralık" — sayı var) tetiklenir → liste.
  // NOT: PROBLEM 2 (state-machine tour_search informational bypass) çözüldükten sonra
  // NLU doğru parse senaryosunda state COLLECTING_INFO'ya geçer, bu dal ULAŞILMAZ.
  // Bu dal SADECE NLU'nun rezervasyon niyetini faq_general/general_question sandığı
  // sigorta edge senaryoları için.
  const _isStuckOnTourSelected =
    newContext.stage === "TOUR_SELECTED" &&
    !!newContext.currentTour &&
    !extractedInfo.dateId &&
    /\d/.test(message);

  if (_isUserAskingDates || _isStuckOnTourSelected) {
    const tourForDates = findTourById(newContext.currentTour!.id, tours);
    const _displayTitleNoDates = getLocalizedTourTitle(
      tourForDates?.title || newContext.currentTour!.title || "",
      newContext.language,
    );
    if (tourForDates?.dates?.length) {
      const _exRates = await getExchangeRatesOnce().catch(() => ({}));
      const _tourCurrency = tourForDates.currency || "TRY";
      const _showDual = agency.show_multi_currency !== false;
      const dateLines = tourForDates.dates
        .map((d: any, idx: number) => {
          // 2026-07-03 P4: gün adı KODDAN (Intl, Europe/Istanbul) — LLM
          // 12.12.2026'ya "Cuma" diyordu (gerçek: Cumartesi). Liste history'de
          // göründüğü için LLM sorulduğunda buradaki doğru günü kopyalar.
          const _wd = getWeekdayName(d.departure_date, newContext.language);
          const dateText = formatDateForLanguage(d.departure_date, newContext.language) + (_wd ? ` (${_wd})` : "");
          const priceText = d.price_adult
            ? ` - ${formatPriceSync(d.price_adult, _tourCurrency, newContext.language, _exRates, _showDual, languageCurrencies)}`
            : "";
          // 2026-06-22 Sorun H α katmanı: dolu tarih ETİKETLE (gizleme değil).
          // Şeffaflık — kullanıcı tarihin var ama dolu olduğunu görür.
          // getQuotaRemaining tek-kaynak (quota-check.ts).
          const remaining = getQuotaRemaining(d);
          const isFull = remaining <= 0;
          // 2026-07-09 FAZ4-P3: tek-kaynak quota-labels.ts (kopya-liste DRY).
          const quotaText = quotaLabel(remaining, isFull, newContext.language);
          return `${idx + 1}) ${dateText}${priceText}${quotaText}`;
        })
        .join("\n");

      const _displayTitle = getLocalizedTourTitle(tourForDates.title, newContext.language);
      const dateSelMsgs: Record<string, string> = {
        tr: `*${_displayTitle}* için müsait tarihler:\n${dateLines}\n\nHangi tarihi tercih edersiniz?`,
        en: `Available dates for *${_displayTitle}*:\n${dateLines}\n\nWhich date do you prefer?`,
        de: `Verfügbare Termine für *${_displayTitle}*:\n${dateLines}\n\nWelches Datum bevorzugen Sie?`,
        ru: `Доступные даты для *${_displayTitle}*:\n${dateLines}\n\nКакую дату вы предпочитаете?`,
        ar: `التواريخ المتاحة لـ *${_displayTitle}*:\n${dateLines}\n\nما التاريخ الذي تفضله؟`,
        fr: `Dates disponibles pour *${_displayTitle}* :\n${dateLines}\n\nQuelle date préférez-vous ?`,
        es: `Fechas disponibles para *${_displayTitle}*:\n${dateLines}\n\n¿Qué fecha prefieres?`,
      };

      let dateReply = dateSelMsgs[newContext.language] || dateSelMsgs.tr;
      if (_invalidDateForPreamble) {
        // 2026-07-03 P6: <UNKNOWN> sızıntı guard'ı. Canlı bug: NLU dates'e
        // "<UNKNOWN>" placeholder döndürdü → Blok 1 placeholder guard'ı
        // STATE'i koruyor ama değer selectedDate üzerinden BU ŞABLONA sızdı →
        // kullanıcı '"<UNKNOWN>" tarihi ... müsait değil' gördü. Placeholder/
        // boş/anlamsız değerde tırnaklı formu BASMA — jenerik form kullan.
        // 2026-07-03 İş D: P6 lokal kontrolü isEchoSafe helper'ına terfi etti
        // (H-3/K-22: '"günlük"/"yarın" tarihi müsait değil' cümle-yankıları da
        // artık jenerik forma düşer — tek-kaynak echo-sanitize.ts).
        const _isPlaceholderDate = !isEchoSafe(_invalidDateForPreamble);
        // 2026-07-09 FAZ3-mikro FIX 1: değer ISO (YYYY-MM-DD) ise GÖRÜNTÜ formatına
        // çevir (DD.MM.YYYY + gün adı — getWeekdayName TEK KAYNAK). Ham ISO tırnaklı
        // sızıntısını (canlı: '"2026-12-21" tarihi ... müsait değil') engeller.
        // Sorumluluk ayrımı: sanitize KARAR verir (isEchoSafe), format GÖRÜNTÜLER.
        let _dispInvalid = _invalidDateForPreamble;
        if (/^\d{4}-\d{2}-\d{2}$/.test(_invalidDateForPreamble)) {
          const _wd = getWeekdayName(_invalidDateForPreamble, newContext.language);
          _dispInvalid = formatDateForLanguage(_invalidDateForPreamble, newContext.language) + (_wd ? ` (${_wd})` : "");
        }
        // CİLA-4-F(i) (2026-07-26): AY-ONLY sorgu ("December" — gün YOK) negatif
        // "müsait değil 😔" yerine POZİTİF çerçeve: "Aralık tarihlerimiz: 👇".
        // Tespit: kullanıcı mesajında ay-adı VAR + (yıl hariç) 1-2 haneli gün YOK.
        const _moMonthM = new RegExp(`(?<![\\p{L}\\p{N}])(${MONTH_ALTERNATION})`, "iu").exec(message);
        const _moHasDay = /(?<!\d)\d{1,2}(?!\d)/.test(message.replace(/\d{4}/g, ""));
        if (_moMonthM && !_moHasDay) {
          const _moName = _moMonthM[1];
          const _moFrames: Record<string, string> = {
            tr: `İşte *${_moName}* tarihlerimiz: 👇\n\n`,
            en: `Here are our *${_moName}* dates: 👇\n\n`,
            de: `Hier sind unsere Termine im *${_moName}*: 👇\n\n`,
            ru: `Вот наши даты на *${_moName}*: 👇\n\n`,
            ar: `إليك تواريخنا في *${_moName}*: 👇\n\n`,
            fr: `Voici nos dates en *${_moName}* : 👇\n\n`,
            es: `Aquí están nuestras fechas de *${_moName}*: 👇\n\n`,
          };
          dateReply = (_moFrames[newContext.language] || _moFrames.tr) + dateReply;
        } else {
        const _preambles: Record<string, string> = _isPlaceholderDate
          ? {
              tr: `Belirttiğiniz tarih için müsaitlik bulamadım. 😔\n\n`,
              en: `I couldn't find availability for that date. 😔\n\n`,
              de: `Für dieses Datum habe ich keine Verfügbarkeit gefunden. 😔\n\n`,
              ru: `Не удалось найти доступность на эту дату. 😔\n\n`,
              ar: `لم أجد توفراً لهذا التاريخ. 😔\n\n`,
              fr: `Je n'ai pas trouvé de disponibilité pour cette date. 😔\n\n`,
              es: `No encontré disponibilidad para esa fecha. 😔\n\n`,
            }
          : {
              tr: `"${_dispInvalid}" tarihi bu tur için müsait değil. 😔\n\n`,
              en: `Sorry, "${_dispInvalid}" is not available for this tour. 😔\n\n`,
              de: `Leider ist "${_dispInvalid}" für diese Tour nicht verfügbar. 😔\n\n`,
              ru: `К сожалению, "${_dispInvalid}" недоступно для этого тура. 😔\n\n`,
              ar: `للأسف، "${_dispInvalid}" غير متاح لهذه الجولة. 😔\n\n`,
              fr: `Désolé, "${_dispInvalid}" n'est pas disponible pour ce circuit. 😔\n\n`,
              es: `Lo siento, "${_dispInvalid}" no está disponible para este tour. 😔\n\n`,
            };
        dateReply = (_preambles[newContext.language] || _preambles.tr) + dateReply;
        }
      }

      // 2026-06-23 Sorun D: tur değişim prefix (FSM transition sonrası
      // newContext.currentTour kullan — state-machine yolu A/B veya erken-müdahale
      // sonrası newContext.currentTour orijinal _originalTourId'den farklıysa
      // prefix oluşur. _invalidDateForPreamble'dan ÖNCE eklenir — okuma sırası:
      // "Şimdi *Pamukkale* için devam ediyoruz. Müsait tarihler: ..."
      const _tcPrefixDates = buildTourChangePrefix(
        _originalTourId,
        newContext.currentTour?.id,
        getLocalizedTourTitle(tourForDates.title || "", newContext.language),
        newContext.language,
      );
      dateReply = _tcPrefixDates + dateReply;

      await _save(dateReply, newContext);
      await adapter.sendResponse(dateReply);
      return { success: true, response: dateReply, newContext };
    } else {
      // D3 (2026-06-19): ELSE dalı — tour.dates boş → deterministik yönlendirme.
      // Önceden bu dal yoktu; tourForDates.dates boşsa blok sessizce atlıyordu,
      // akış LLM'e geçiyordu, LLM tarih uyduruyordu. Artık deterministik mesaj.
      const _noDatesMsgs: Record<string, string> = {
        tr: `*${_displayTitleNoDates}* için şu anda aktif müsait tarih bulunmuyor. 😔\n\nEn güncel bilgi için acentemizle iletişime geçebilirsiniz.`,
        en: `No active dates available for *${_displayTitleNoDates}* at the moment. 😔\n\nPlease contact our agency for the latest information.`,
        de: `Derzeit keine verfügbaren Termine für *${_displayTitleNoDates}*. 😔\n\nBitte wenden Sie sich an unsere Agentur.`,
        ru: `В данный момент нет доступных дат для *${_displayTitleNoDates}*. 😔\n\nСвяжитесь с нашим агентством для актуальной информации.`,
        ar: `لا توجد تواريخ متاحة لـ *${_displayTitleNoDates}* حالياً. 😔\n\nيرجى التواصل مع وكالتنا.`,
        fr: `Pas de dates disponibles pour *${_displayTitleNoDates}* actuellement. 😔\n\nVeuillez contacter notre agence.`,
        es: `No hay fechas disponibles para *${_displayTitleNoDates}* en este momento. 😔\n\nPor favor contacte a nuestra agencia.`,
      };
      const noDateReply = _noDatesMsgs[newContext.language] || _noDatesMsgs.tr;
      await _save(noDateReply, newContext);
      await adapter.sendResponse(noDateReply);
      return { success: true, response: noDateReply, newContext };
    }
  }

  // === 11a-AUTO-DATE-ACK. TEK-TARİH OTOMATİK ATAMA ONAYI ===
  // 2026-06-21 Sorun C fix (exec 8d0d72ae). info-extractor Blok 10 tek-tarih
  // turunda dateAutoAssigned=true set ettiyse, kullanıcıya seçilen tarihi
  // GÖSTERİP onaylatarak pax sorar. Şeffaflık + LLM bağımsız.
  //
  // Flag-tabanlı dar gate (dateId varlığına BAKMAZ):
  //   - Kullanıcı kendi tarih verdiyse (Blok 2/3/8/9) flag YOK → bypass NO → çift
  //     mesaj riski sıfır (kullanıcı zaten "14 aralık" deyince mevcut akış doğru).
  //   - SADECE Blok 10 otomatik atama yaptığında flag VAR → bypass çalışır.
  //
  // FİYAT GRACEFUL FALLBACK: exchange rate / formatPriceSync başarısız olursa
  // (currency null, throw, vs.) bypass mesajı YİNE GİDER, sadece fiyat kısmı
  // atlanır. Tarih onayı asıl iş, fiyat bonus — akışı bloklamaz.
  if (shouldTriggerAutoDateAck(context, newContext, (extractedInfo as any)?.dateAutoAssigned === true)) {
    const _lang = newContext.language || "tr";
    const _selectedDate = (newContext.reservationInfo as any)?.selectedDate || "";
    const _displayDate = _selectedDate
      ? formatDateForLanguage(_selectedDate, _lang)
      : "";
    const _tourA = newContext.currentTour
      ? findTourById(newContext.currentTour.id, tours)
      : null;
    const _displayTitle = _tourA
      ? getLocalizedTourTitle(_tourA.title, _lang)
      : (newContext.currentTour?.title || "");

    // Fiyat hesaplama — try/catch içinde, başarısızsa _priceText="" kalır
    let _priceText = "";
    try {
      const _firstDateA = _tourA?.dates?.[0];
      if (_firstDateA?.price_adult) {
        const _exRatesAck = await getExchangeRatesOnce().catch(() => ({}));
        const _showDualAck = agency.show_multi_currency !== false;
        _priceText = formatPriceSync(
          _firstDateA.price_adult,
          _tourA?.currency || "TRY",
          _lang,
          _exRatesAck,
          _showDualAck,
          languageCurrencies,
        );
      }
    } catch (_priceErr) {
      console.warn("[process-message] :11a-AUTO-DATE-ACK price format failed, fiyatsız devam:", _priceErr);
      _priceText = "";
    }

    const _msgs: Record<string, string> = {
      tr: _priceText
        ? `*${_displayDate}* tarihinde *${_displayTitle}* için rezervasyon başlatıyorum. (Kişi başı ${_priceText}) ✨\n\nKaç kişi katılacaksınız? 😊`
        : `*${_displayDate}* tarihinde *${_displayTitle}* için rezervasyon başlatıyorum. ✨\n\nKaç kişi katılacaksınız? 😊`,
      en: _priceText
        ? `Starting reservation for *${_displayTitle}* on *${_displayDate}*. (Per person ${_priceText}) ✨\n\nHow many people? 😊`
        : `Starting reservation for *${_displayTitle}* on *${_displayDate}*. ✨\n\nHow many people? 😊`,
      de: _priceText
        ? `Buche *${_displayTitle}* am *${_displayDate}*. (Pro Person ${_priceText}) ✨\n\nWie viele Personen? 😊`
        : `Buche *${_displayTitle}* am *${_displayDate}*. ✨\n\nWie viele Personen? 😊`,
      ru: _priceText
        ? `Начинаю бронирование *${_displayTitle}* на *${_displayDate}*. (С человека ${_priceText}) ✨\n\nСколько человек? 😊`
        : `Начинаю бронирование *${_displayTitle}* на *${_displayDate}*. ✨\n\nСколько человек? 😊`,
      ar: _priceText
        ? `أبدأ حجز *${_displayTitle}* في *${_displayDate}*. (للشخص ${_priceText}) ✨\n\nكم شخصاً؟ 😊`
        : `أبدأ حجز *${_displayTitle}* في *${_displayDate}*. ✨\n\nكم شخصاً؟ 😊`,
      fr: _priceText
        ? `Je commence votre réservation pour *${_displayTitle}* le *${_displayDate}*. (Par personne ${_priceText}) ✨\n\nCombien de personnes ? 😊`
        : `Je commence votre réservation pour *${_displayTitle}* le *${_displayDate}*. ✨\n\nCombien de personnes ? 😊`,
      es: _priceText
        ? `Iniciando reserva para *${_displayTitle}* el *${_displayDate}*. (Por persona ${_priceText}) ✨\n\n¿Cuántas personas? 😊`
        : `Iniciando reserva para *${_displayTitle}* el *${_displayDate}*. ✨\n\n¿Cuántas personas? 😊`,
    };
    // 2026-06-23 Sorun D: tur değişim prefix (yeni tek-tarihli tura erken-müdahale
    // sonrası auto-date senaryosu — kullanıcı önce tur değiştirdi, yeni tur tek
    // tarihli, Blok 10 dateAutoAssigned set etti, transition waiting_for_pax'a
    // düştü. Bypass mesajının önüne tur değişim ack'i.).
    const _tcPrefixAck = buildTourChangePrefix(
      _originalTourId,
      newContext.currentTour?.id,
      _displayTitle,
      _lang,
    );
    const askReply = _tcPrefixAck + (_msgs[_lang] || _msgs.tr);
    console.log(`[process-message] :11a-AUTO-DATE-ACK tetiklendi (date=${_selectedDate}, transition→waiting_for_pax, tourChanged=${!!_tcPrefixAck})`);
    await _save(askReply, newContext);
    await adapter.sendResponse(askReply);
    return { success: true, response: askReply, newContext };
  }

  // === 11a-MANUAL-DATE-ACK. MANUEL TARİH SEÇİMİ → PAX (deterministik) ===
  // 2026-06-25 BUG-X5 FIX (canlı exec a62db908):
  // Pamukkale (çoklu-tarihli) tur seçildi → "10 aralık" → bot "*Antalya Rafting*
  // turumuz için 10 Aralık not ettim" (YANLIŞ TUR ADI, state Pamukkale doğru).
  // LLM (Haiku) history sızıntısı — keşif aşamasında konuşulan Antalya'yı pax-ack
  // mesajına yansıttı. M1 LLM compliance kırılganlığı.
  //
  // :11a-AUTO-DATE-ACK (yukarıda) SADECE dateAutoAssigned=true ile tetiklendiği
  // için çoklu-tarihli turda manuel tarih seçimi LLM'e bırakılıyordu → risk.
  //
  // FIX: Manuel tarih→pax geçişi için deterministik bypass. State'ten
  // currentTour.title + selectedDate okur. Tur adı GÜVENİLİR state kaynağı
  // (Murat C ilkesi — deterministik, M1'e güvenme).
  //
  // ÇAKIŞMA GUARD'I: :11a-AUTO-DATE-ACK YUKARIDA kontrol edilip return ediyor —
  // dateAutoAssigned=true durumu yakalanmış olur. Burası SADECE manuel seçimde
  // (dateAutoAssigned=false) tetiklenir.
  if (shouldTriggerManualDateAck(
    context,
    newContext,
    (extractedInfo as any)?.dateAutoAssigned === true,
    !!(newContext.reservationInfo as any)?.selectedDate,
  )) {
    const _lang = newContext.language || "tr";
    const _selectedDateM = (newContext.reservationInfo as any)?.selectedDate || "";
    const _displayDateM = _selectedDateM
      ? formatDateForLanguage(_selectedDateM, _lang)
      : "";
    const _tourM = newContext.currentTour
      ? findTourById(newContext.currentTour.id, tours)
      : null;
    const _displayTitleM = _tourM
      ? getLocalizedTourTitle(_tourM.title, _lang)
      : (newContext.currentTour?.title || "");

    // Fiyat hesaplama — try/catch içinde, başarısızsa _priceTextM="" kalır (:11a ile aynı pattern)
    let _priceTextM = "";
    try {
      const _selDateObj = _tourM?.dates?.find((d: any) => d.id === (newContext.reservationInfo as any)?.dateId)
        || _tourM?.dates?.[0];
      if (_selDateObj?.price_adult) {
        const _exRatesAckM = await getExchangeRatesOnce().catch(() => ({}));
        const _showDualAckM = agency.show_multi_currency !== false;
        _priceTextM = formatPriceSync(
          _selDateObj.price_adult,
          _tourM?.currency || "TRY",
          _lang,
          _exRatesAckM,
          _showDualAckM,
          languageCurrencies,
        );
      }
    } catch (_priceErrM) {
      console.warn("[process-message] :11a-MANUAL-DATE-ACK price format failed, fiyatsız devam:", _priceErrM);
      _priceTextM = "";
    }

    // 7 dil — :11a-AUTO-DATE-ACK ile aynı stil + template
    const _msgsM: Record<string, string> = {
      tr: _priceTextM
        ? `*${_displayDateM}* tarihinde *${_displayTitleM}* için rezervasyon başlatıyorum. (Kişi başı ${_priceTextM}) ✨\n\nKaç kişi katılacaksınız? 👥`
        : `*${_displayDateM}* tarihinde *${_displayTitleM}* için rezervasyon başlatıyorum. ✨\n\nKaç kişi katılacaksınız? 👥`,
      en: _priceTextM
        ? `Starting reservation for *${_displayTitleM}* on *${_displayDateM}*. (Per person ${_priceTextM}) ✨\n\nHow many people? 👥`
        : `Starting reservation for *${_displayTitleM}* on *${_displayDateM}*. ✨\n\nHow many people? 👥`,
      de: _priceTextM
        ? `Buche *${_displayTitleM}* am *${_displayDateM}*. (Pro Person ${_priceTextM}) ✨\n\nWie viele Personen? 👥`
        : `Buche *${_displayTitleM}* am *${_displayDateM}*. ✨\n\nWie viele Personen? 👥`,
      ru: _priceTextM
        ? `Начинаю бронирование *${_displayTitleM}* на *${_displayDateM}*. (С человека ${_priceTextM}) ✨\n\nСколько человек? 👥`
        : `Начинаю бронирование *${_displayTitleM}* на *${_displayDateM}*. ✨\n\nСколько человек? 👥`,
      ar: _priceTextM
        ? `أبدأ حجز *${_displayTitleM}* في *${_displayDateM}*. (للشخص ${_priceTextM}) ✨\n\nكم شخصاً؟ 👥`
        : `أبدأ حجز *${_displayTitleM}* في *${_displayDateM}*. ✨\n\nكم شخصاً؟ 👥`,
      fr: _priceTextM
        ? `Je commence votre réservation pour *${_displayTitleM}* le *${_displayDateM}*. (Par personne ${_priceTextM}) ✨\n\nCombien de personnes ? 👥`
        : `Je commence votre réservation pour *${_displayTitleM}* le *${_displayDateM}*. ✨\n\nCombien de personnes ? 👥`,
      es: _priceTextM
        ? `Iniciando reserva para *${_displayTitleM}* el *${_displayDateM}*. (Por persona ${_priceTextM}) ✨\n\n¿Cuántas personas? 👥`
        : `Iniciando reserva para *${_displayTitleM}* el *${_displayDateM}*. ✨\n\n¿Cuántas personas? 👥`,
    };

    // Tur değişim prefix (tarih seçiminden önce tur değiştirildiyse — KÖK 5 ile uyumlu)
    const _tcPrefixAckM = buildTourChangePrefix(
      _originalTourId,
      newContext.currentTour?.id,
      _displayTitleM,
      _lang,
    );
    const askReplyM = _tcPrefixAckM + (_msgsM[_lang] || _msgsM.tr);
    console.log(`[process-message] :11a-MANUAL-DATE-ACK tetiklendi (date=${_selectedDateM}, tour=${_displayTitleM}, tourChanged=${!!_tcPrefixAckM})`);
    await _save(askReplyM, newContext);
    await adapter.sendResponse(askReplyM);
    return { success: true, response: askReplyM, newContext };
  }

  // === 11b. PAX → NAME GEÇİŞİ (deterministik) — 2026-06-19 Murat bug kökü ===
  // pax dolduğunda waiting_for_name'e geçilen İLK turn'de LLM çağrılmaz; bot sabit
  // metni atar. LLM compliance hatası riski sıfır. Mevcut :519 tarih + :583 email
  // bloklarıyla aynı pattern.
  if (
    newContext.stage === "COLLECTING_INFO" &&
    newContext.collectionStep === "waiting_for_name" &&
    context.collectionStep !== "waiting_for_name"
  ) {
    const _lang = newContext.language || "tr";
    // 2026-07-10 A2: zengin ilk-mesajda kuyruk FİYAT sorusu ("...fiyat ne olur")
    // yanıtsız kalıyordu (veri işlendi, soru yutuldu). DAR FİX: bu geçiş turn'ünde
    // mesajda fiyat-soru sinyali (TEK KAYNAK constants/price-question.ts, 7-dil)
    // varsa toplam fiyatı (pax × price_adult, seçili tarihten) adım-sorusunun
    // ÖNÜNE prefix'le. Genel soru-sınıfı Approach-B'ye. paxChild'lı vakalarda
    // toplam yerine KİŞİ-BAŞI basılır (child-fiyat kuralı acente-değişken).
    let _pricePrefix = "";
    if (PRICE_QUESTION_RE.test(message)) {
      try {
        const _a2Tour = newContext.currentTour ? findTourById(newContext.currentTour.id, tours) : null;
        const _a2Date = _a2Tour?.dates?.find((d: any) => d.id === (newContext.reservationInfo as any)?.dateId)
          || _a2Tour?.dates?.[0];
        const _a2Pax = (newContext.reservationInfo as any)?.paxAdult;
        const _a2Child = (newContext.reservationInfo as any)?.paxChild;
        if (_a2Date?.price_adult && _a2Pax && _a2Pax >= 1) {
          const _a2Rates = await getExchangeRatesOnce().catch(() => ({}));
          const _a2Dual = agency.show_multi_currency !== false;
          if (!_a2Child) {
            const _a2Total = formatPriceSync(_a2Date.price_adult * _a2Pax, _a2Tour?.currency || "TRY", _lang, _a2Rates, _a2Dual, languageCurrencies);
            const _a2P: Record<string, string> = {
              tr: `*${_a2Pax} kişi* için toplam *${_a2Total}* ✨\n\n`,
              en: `Total for *${_a2Pax} ${_a2Pax === 1 ? "person" : "people"}*: *${_a2Total}* ✨\n\n`,
              de: `Gesamt für *${_a2Pax} ${_a2Pax === 1 ? "Person" : "Personen"}*: *${_a2Total}* ✨\n\n`,
              ru: `Итого за *${_a2Pax} чел.*: *${_a2Total}* ✨\n\n`,
              ar: `الإجمالي لـ *${_a2Pax}* أشخاص: *${_a2Total}* ✨\n\n`,
              fr: `Total pour *${_a2Pax} ${_a2Pax === 1 ? "personne" : "personnes"}* : *${_a2Total}* ✨\n\n`,
              es: `Total para *${_a2Pax} ${_a2Pax === 1 ? "persona" : "personas"}*: *${_a2Total}* ✨\n\n`,
            };
            _pricePrefix = _a2P[_lang] || _a2P.tr;
          } else {
            const _a2Per = formatPriceSync(_a2Date.price_adult, _a2Tour?.currency || "TRY", _lang, _a2Rates, _a2Dual, languageCurrencies);
            const _a2P2: Record<string, string> = {
              tr: `Yetişkin kişi başı *${_a2Per}* — çocuk fiyatı için acentemiz bilgi verecek ✨\n\n`,
              en: `Per adult: *${_a2Per}* — our agency will confirm child pricing ✨\n\n`,
              de: `Pro Erwachsener: *${_a2Per}* — Kinderpreise bestätigt unsere Agentur ✨\n\n`,
              ru: `За взрослого: *${_a2Per}* — детскую цену уточнит агентство ✨\n\n`,
              ar: `للبالغ: *${_a2Per}* — ستؤكد وكالتنا سعر الأطفال ✨\n\n`,
              fr: `Par adulte : *${_a2Per}* — notre agence confirmera le tarif enfant ✨\n\n`,
              es: `Por adulto: *${_a2Per}* — nuestra agencia confirmará el precio infantil ✨\n\n`,
            };
            _pricePrefix = _a2P2[_lang] || _a2P2.tr;
          }
          console.log(`[process-message] A2 fiyat-prefix: pax=${_a2Pax}, child=${_a2Child ?? 0}`);
        }
      } catch (_a2Err) {
        console.warn("[process-message] A2 fiyat-prefix hesaplanamadı, prefix'siz devam:", _a2Err);
        _pricePrefix = "";
      }
    }
    const _msgs: Record<string, string> = {
      tr: "Teşekkürler! 😊 Ad ve soyadınızı alabilir miyim?",
      en: "Thank you! 😊 May I have your full name?",
      de: "Vielen Dank! 😊 Darf ich Ihren vollständigen Namen erfahren?",
      ru: "Спасибо! 😊 Назовите, пожалуйста, ваше имя и фамилию.",
      ar: "شكراً لك! 😊 هل يمكنني الحصول على الاسم الكامل؟",
      fr: "Merci ! 😊 Puis-je avoir votre nom complet ?",
      es: "¡Gracias! 😊 ¿Puede darme su nombre completo?",
    };
    const askReply = _pricePrefix + (_msgs[_lang] || _msgs.tr);
    await _save(askReply, newContext);
    await adapter.sendResponse(askReply);
    return { success: true, response: askReply, newContext };
  }

  // === 11b-PERSIST. WAITING_FOR_NAME NO-OP — yanlış sinyal koruması ===
  // 2026-06-20 Yan #5 fix. Canlı bug (execution 109fef4c): waiting_for_name'de
  // kullanıcı "1 kişi" yazdı, state pax dolu, intent=provide_info, fullName=null.
  // Mevcut :11b transition gate'i tetiklenmedi (no-op). LLM context'e bakıp
  // "Teşekkürler! Kaç kişi katılacaksınız?" diye saçma cevap üretti.
  //
  // BİLİNEN SINIR: NLU bir off-topic soruyu (örn. "iki günlük müydü?") yanlışlıkla
  // provide_info+paxAdult olarak sınıflandırırsa bu bypass TETİKLENİR ve meşru
  // soruyu "Önce ismi alalım" ile keser. midFlowReturnPrompt bu yolda ÇALIŞMAZ
  // (bypass erken çıkış yapıyor, LLM hiç çağrılmıyor, prompt katmanı devreye
  // girmiyor). Bu kabul edilen bir sınır — eski "Kaç kişi?" saçma cevabı daha
  // büyük UX kaybı. Trade-off davranışsal testte "bilinen sınır" olarak belgeli.
  if (shouldTriggerNameAskPersist(context, newContext, nluResult)) {
    const _lang = newContext.language || "tr";

    // 2026-06-21 Sorun B fix: pax değişimi bildirim. Canlı bug (exec 184bb422):
    // bypass tetiklendiğinde mergeReservationInfo paxAdult'ı üzerine yazıyor
    // (state-machine.ts:110-112, waiting_for_name'de tarih dolu → hasDate=true
    // → yeni pax KOŞULSUZ yazılır), AMA mesaj sadece "ad-soyad alalım" diyor.
    // Kullanıcı 2→1 değişimini GÖRMÜYOR (sessiz update).
    //
    // Bildirim SADECE bu turn'de YENİ paxAdult değeri geldi VE öncekinden
    // farklıysa eklenir. Aksi halde sade "Önce ad-soyad" mesajı.
    //
    // BİLİNEN SINIR genişlemesi: :11b-PERSIST'in NLU yanlış sınıflandırma
    // sınırı pax-bildirimine yansır — NLU "iki günlük müydü?"yu paxAdult=2
    // diye yanlış parse ederse bildirim "2 kişi aldım" yanlış gider. DÜZELTME
    // İMKÂNI VAR: kullanıcı sonraki turn'de "hayır 1 kişi" derse merge yine
    // üzerine yazar → bildirim "1 kişi aldım" düzeltilir. Sistem kilitlenmez,
    // sessiz-yanlış → gürültülü-yanlış (görünür) trade-off kabul edildi.
    const _newPax = (nluResult.updates as any)?.paxAdult;
    const _oldPax = (context.reservationInfo as any)?.paxAdult;
    const _paxAcked = !!_newPax && _newPax !== _oldPax;

    const _ackPrefix: Record<string, string> = _paxAcked ? {
      tr: `*${_newPax} kişi* olarak güncelledim. `,
      en: `Updated to *${_newPax} ${_newPax === 1 ? "person" : "people"}*. `,
      de: `Aktualisiert auf *${_newPax} ${_newPax === 1 ? "Person" : "Personen"}*. `,
      ru: `Обновлено до *${_newPax}*. `,
      ar: `تم التحديث إلى *${_newPax}*. `,
      fr: `Mis à jour à *${_newPax} ${_newPax === 1 ? "personne" : "personnes"}*. `,
      es: `Actualizado a *${_newPax} ${_newPax === 1 ? "persona" : "personas"}*. `,
    } : { tr: "", en: "", de: "", ru: "", ar: "", fr: "", es: "" };

    // 2026-06-22 F-msg revize: Sorun F'in canlı doğrulamasında ortaya çıkan
    // kuyruk — kullanıcı "Murat değil aslında Ahmet" yazıp reddedilince bot
    // jenerik "Önce ad-soyad alalım" diyordu, kullanıcı ne yanlış yaptığını
    // anlamıyordu. Mesajları açıklayıcı tona çevir + ÖRNEK İSİM ekle.
    //
    // paxAck VAR ("Şimdi") + paxAck YOK ("Lütfen") iki varyant — örnek isim
    // her ikisinde de var (Ahmet Yılmaz / Max Mustermann / Jean Dupont / ...).
    const _baseMsgs: Record<string, string> = _paxAcked ? {
      tr: "Şimdi *tam ad ve soyadınızı* yazar mısınız? (örn. Ahmet Yılmaz) 😊",
      en: "Now could you write your *full name and surname*? (e.g. Ahmet Yılmaz) 😊",
      de: "Könnten Sie nun Ihren *Vor- und Nachnamen* schreiben? (z.B. Max Mustermann) 😊",
      ru: "Теперь напишите, пожалуйста, *имя и фамилию*. (например, Иван Иванов) 😊",
      ar: "هل يمكنك كتابة *الاسم الكامل واللقب* الآن؟ (مثال: أحمد يلماز) 😊",
      fr: "Pouvez-vous maintenant écrire votre *nom et prénom* ? (ex: Jean Dupont) 😊",
      es: "¿Puede ahora escribir su *nombre completo y apellido*? (ej: Juan García) 😊",
    } : {
      tr: "Lütfen *tam ad ve soyadınızı* yazar mısınız? (örn. Ahmet Yılmaz) 😊",
      en: "Could you write your *full name and surname*? (e.g. Ahmet Yılmaz) 😊",
      de: "Könnten Sie bitte Ihren *Vor- und Nachnamen* schreiben? (z.B. Max Mustermann) 😊",
      ru: "Напишите, пожалуйста, *имя и фамилию*. (например, Иван Иванов) 😊",
      ar: "يرجى كتابة *الاسم الكامل واللقب*. (مثال: أحمد يلماز) 😊",
      fr: "Pourriez-vous écrire votre *nom et prénom* ? (ex: Jean Dupont) 😊",
      es: "¿Podría escribir su *nombre completo y apellido*? (ej: Juan García) 😊",
    };

    const askReply = (_ackPrefix[_lang] || _ackPrefix.tr) + (_baseMsgs[_lang] || _baseMsgs.tr);
    console.log(`[process-message] :11b-PERSIST tetiklendi (no-op, intent=${nluResult.intent}, fullName yok, paxAck=${_paxAcked})`);
    await _save(askReply, newContext);
    await adapter.sendResponse(askReply);
    return { success: true, response: askReply, newContext };
  }

  // === 11c. NAME → PHONE GEÇİŞİ (deterministik) ===
  // İsim dolduğunda waiting_for_phone'a geçilen İLK turn'de LLM çağrılmaz.
  // Hitap için isim ilk kelimesi kullanılır (cinsiyet tahmini YOK, sade).
  if (
    newContext.stage === "COLLECTING_INFO" &&
    newContext.collectionStep === "waiting_for_phone" &&
    context.collectionStep !== "waiting_for_phone"
  ) {
    const _lang = newContext.language || "tr";
    const _fullName = (newContext.reservationInfo as any)?.fullName || "";
    const _firstName = String(_fullName).trim().split(/\s+/)[0] || "";
    const _msgs: Record<string, string> = {
      tr: _firstName
        ? `Teşekkürler ${_firstName}! 📱 Telefon numaranızı alabilir miyim?`
        : "Teşekkürler! 📱 Telefon numaranızı alabilir miyim?",
      en: _firstName
        ? `Thank you ${_firstName}! 📱 May I have your phone number?`
        : "Thank you! 📱 May I have your phone number?",
      de: _firstName
        ? `Vielen Dank, ${_firstName}! 📱 Darf ich Ihre Telefonnummer erfahren?`
        : "Vielen Dank! 📱 Darf ich Ihre Telefonnummer erfahren?",
      ru: _firstName
        ? `Спасибо, ${_firstName}! 📱 Скажите, пожалуйста, ваш номер телефона.`
        : "Спасибо! 📱 Скажите, пожалуйста, ваш номер телефона.",
      ar: _firstName
        ? `شكراً ${_firstName}! 📱 هل يمكنني الحصول على رقم هاتفك؟`
        : "شكراً لك! 📱 هل يمكنني الحصول على رقم هاتفك؟",
      fr: _firstName
        ? `Merci ${_firstName} ! 📱 Puis-je avoir votre numéro de téléphone ?`
        : "Merci ! 📱 Puis-je avoir votre numéro de téléphone ?",
      es: _firstName
        ? `¡Gracias, ${_firstName}! 📱 ¿Me puede dar su número de teléfono?`
        : "¡Gracias! 📱 ¿Me puede dar su número de teléfono?",
    };
    const askReply = _msgs[_lang] || _msgs.tr;
    await _save(askReply, newContext);
    await adapter.sendResponse(askReply);
    return { success: true, response: askReply, newContext };
  }

  // === 12. EMAİL ADIMI (deterministik) ===
  if (newContext.stage === "COLLECTING_INFO" && newContext.collectionStep === "waiting_for_email") {
    const _lang = newContext.language || "tr";
    if (context.collectionStep !== "waiting_for_email") {
      const _askMsgs: Record<string, string> = {
        tr: `Son olarak, email adresinizi paylaşmak ister misiniz? 📧 Özel fırsatları iletebiliriz.\n\n(Atlamak için "geç" yazabilirsiniz)`,
        en: `Finally, would you like to share your email? 📧 We can send you special offers.\n\n(Type "skip" to pass)`,
        de: `Möchten Sie zum Schluss Ihre E-Mail teilen? 📧 Wir senden Ihnen exklusive Angebote.\n\n("überspringen" zum Auslassen)`,
        ru: `Напоследок, хотите поделиться email? 📧 Будем отправлять специальные предложения.\n\n(Напишите "пропустить" для пропуска)`,
        ar: `أخيراً، هل ترغب في مشاركة بريدك الإلكتروني؟ 📧 سنرسل لك عروضاً خاصة.\n\n(اكتب "تخطي" للتجاوز)`,
        fr: `Enfin, souhaitez-vous partager votre email? 📧 Nous vous enverrons des offres spéciales.\n\n(Tapez "passer" pour ignorer)`,
        es: `Por último, ¿desea compartir su email? 📧 Le enviaremos ofertas especiales.\n\n(Escriba "saltar" para omitir)`,
      };
      const askReply = _askMsgs[_lang] || _askMsgs.tr;
      await _save(askReply, newContext);
      await adapter.sendResponse(askReply);
      return { success: true, response: askReply, newContext };
    }
    if (message.includes("@") && !extractEmail(message)) {
      const _invalidMsgs: Record<string, string> = {
        tr: "Bu email adresi geçersiz görünüyor. Doğru formatta tekrar girer misiniz? (örn: ad@domain.com)",
        en: "This email address looks invalid. Could you enter it in the correct format? (e.g., name@domain.com)",
        de: "Diese E-Mail-Adresse scheint ungültig. Bitte im richtigen Format eingeben. (z.B. name@domain.com)",
        ru: "Этот email выглядит неверным. Введите в правильном формате. (напр. name@domain.com)",
        ar: "هذا البريد الإلكتروني يبدو غير صحيح. (مثال: name@domain.com)",
        fr: "Cette adresse email semble invalide. (ex: nom@domain.com)",
        es: "Esta dirección de email parece inválida. (ej: nombre@domain.com)",
      };
      const invalidReply = _invalidMsgs[_lang] || _invalidMsgs.tr;
      await _save(invalidReply, newContext);
      await adapter.sendResponse(invalidReply);
      return { success: true, response: invalidReply, newContext };
    }
  }

  // === 13. PHONE → CONFIRMING GEÇİŞİ (deterministik) — 2026-06-19 Murat bug kökü ===
  // Tüm alanlar dolduğunda CONFIRMING'e geçilen İLK turn'de özet+onay deterministik
  // gönderilir, LLM çağrılmaz. Bu turn'de bot pax/isim/telefon TEKRAR SORAMAZ
  // (canlı bug kanıtı: LLM dolu state'te bile "Kaç kişi?" diyordu).
  if (newContext.stage === "CONFIRMING" && context.stage !== "CONFIRMING") {
    const _lang = newContext.language || "tr";
    const info = (newContext.reservationInfo as any) || {};
    const _tourTitle = newContext.currentTour
      ? getLocalizedTourTitle(newContext.currentTour.title || "", _lang)
      : "";
    const _dateText = info.selectedDate ? formatDateForLanguage(info.selectedDate, _lang) : "";
    // 2026-06-25 KÖK 2 ince ayar: paxChild gösterimi (canlı kanıt 058bb668 — ilk
    // özet "Kişi sayısı: 3" diyordu, ikinci özet (LLM) "3 yetişkin, 2 çocuk" doğru.
    // İlk bypass mevcut sadece paxAdult'a bakıyordu. Tutarlı için pax satırı
    // "X yetişkin, Y çocuk" formatına çevrildi (paxChild yoksa "X yetişkin").
    const _paxAdult = info.paxAdult ?? "";
    const _paxChild = info.paxChild;
    const _name = info.fullName || "";
    const _phone = info.phone || "";

    // 2026-07-02 K1 KATMAN 3: confirm satırına net anahtar-kelime yönlendirmesi.
    // detectConfirmation dar bir onay-kelime whitelist'i kullanır; kullanıcıyı doğru
    // kelimeye yönlendirmek Haiku'nun intent sınıflandırma tutarsızlığından bağımsız
    // olarak COMPLETED'a geçişi güvenilir kılar (canlı yanlış-negatif dersini kapatır).
    const _labels: Record<string, { tour: string; date: string; pax: string; adult: string; child: string; name: string; phone: string; confirm: string }> = {
      tr: { tour: "Tur",     date: "Tarih",   pax: "Kişi sayısı", adult: "yetişkin",  child: "çocuk",   name: "Ad-Soyad", phone: "Telefon",   confirm: "Bilgiler doğru mu? Onaylıyorsanız *evet* yazın ✅" },
      en: { tour: "Tour",    date: "Date",    pax: "People",      adult: "adult",     child: "child",   name: "Name",     phone: "Phone",     confirm: "Are these details correct? Reply *yes* to confirm ✅" },
      de: { tour: "Tour",    date: "Datum",   pax: "Personen",    adult: "Erwachsener", child: "Kind",  name: "Name",     phone: "Telefon",   confirm: "Sind die Angaben korrekt? Antworten Sie *ja* zur Bestätigung ✅" },
      ru: { tour: "Тур",     date: "Дата",    pax: "Человек",     adult: "взрослый",  child: "ребёнок", name: "Имя",      phone: "Телефон",   confirm: "Данные верны? Напишите *да* для подтверждения ✅" },
      ar: { tour: "الجولة", date: "التاريخ", pax: "عدد الأشخاص", adult: "بالغ",      child: "طفل",     name: "الاسم",    phone: "الهاتف",    confirm: "هل المعلومات صحيحة؟ اكتب *نعم* للتأكيد ✅" },
      fr: { tour: "Circuit", date: "Date",    pax: "Personnes",   adult: "adulte",    child: "enfant",  name: "Nom",      phone: "Téléphone", confirm: "Les informations sont-elles correctes ? Répondez *oui* pour confirmer ✅" },
      es: { tour: "Tour",    date: "Fecha",   pax: "Personas",    adult: "adulto",    child: "niño",    name: "Nombre",   phone: "Teléfono",  confirm: "¿Los datos son correctos? Responda *sí* para confirmar ✅" },
    };
    const L = _labels[_lang] || _labels.tr;

    // paxChild varsa "X yetişkin, Y çocuk"; yoksa sadece "X" (mevcut sade davranış)
    const _paxText = _paxAdult !== ""
      ? (typeof _paxChild === "number" && _paxChild > 0
          ? `${_paxAdult} ${L.adult}, ${_paxChild} ${L.child}`
          : `${_paxAdult}`)
      : "";

    // FIX1: 💰 Toplam — completion ile AYNI kaynak (live tours) ve AYNI helper →
    // özet-ile-completion tutarı hiçbir senaryoda farklı olamaz.
    const _confTour = tours.find((t: any) => t.id === (newContext.currentTour?.id || (info as any).tourId));
    const _confDate = _confTour?.dates?.find((d: any) => d.id === (info as any).dateId);
    const _confTotalText = await _reservationTotalText(
      Number(_paxAdult) || 0, typeof _paxChild === "number" ? _paxChild : 0,
      _confDate?.price_adult || 0, _confDate?.price_child,
      _confTour?.currency || "TRY", _lang,
      agency.show_multi_currency !== false, languageCurrencies,
    );

    const _summaryLines = [
      _tourTitle ? `📋 ${L.tour}: *${_tourTitle}*` : "",
      _dateText  ? `📅 ${L.date}: ${_dateText}`    : "",
      _paxText   ? `👥 ${L.pax}: ${_paxText}`      : "",
      _name      ? `👤 ${L.name}: ${_name}`        : "",
      _phone     ? `📱 ${L.phone}: ${_phone}`      : "",
      _confTotalText ? `💰 ${_TOTAL_LABELS[_lang] || _TOTAL_LABELS.en}: *${_confTotalText}*` : "",
    ].filter(Boolean).join("\n");

    const summaryReply = `${_summaryLines}\n\n${L.confirm}`;
    await _save(summaryReply, newContext);
    await adapter.sendResponse(summaryReply);
    return { success: true, response: summaryReply, newContext };
  }

  // === 13-SUM (B-C1, 2026-07-27): AÇIK "özet" isteği — STATE-FIRST deterministik ===
  // KÖK (denetim B-1): red-sonrası waiting_for_date'te "özet" LLM'e düşüyordu →
  // LLM history'deki ESKİ özetten silinmiş tarihi söylüyordu (state'te tarih YOK).
  // FIX: salt özet-isteği (isSummaryRequest: ≤4 kelime + 7-dil özet-kelimesi +
  // tur-içerik-dışlama) + rezervasyon bağlamı (tourId) → _buildUpdatedSummary
  // (tek-kaynak: :13/l2 ile aynı, 💰 dahil; tarih yoksa "henüz seçilmedi" satırı).
  // LLM'e HİÇ gitmez → history-kopyası imkânsız. STATE DEĞİŞMEZ (sadece cevap).
  if (
    isSummaryRequest(message) &&
    (newContext.reservationInfo as any)?.tourId &&
    ["TOUR_SELECTED", "COLLECTING_INFO", "CONFIRMING"].includes(newContext.stage)
  ) {
    const _sumLang = newContext.language || "tr";
    const _sumText = await _buildUpdatedSummary(
      newContext.reservationInfo, newContext.currentTour, _sumLang, tours, agency, languageCurrencies,
    );
    console.log(`[process-message] 13-SUM state-first özet bypass (stage=${newContext.stage}, step=${newContext.collectionStep ?? "-"}, hasDate=${!!(newContext.reservationInfo as any)?.dateId})`);
    await _save(_sumText, newContext);
    await adapter.sendResponse(_sumText);
    return { success: true, response: _sumText, newContext };
  }

  // === 13-PERSIST. CONFIRMING NO-OP — belirsiz cevap özet+onay tekrar ===
  // 2026-06-22 Sorun G fix (canlı bug exec 06ae0554, M1 ailesi):
  //   CONFIRMING'de "tabi olabilir" → NLU general (canlı kanıt), detectConfirmation
  //   FALSE, change_info FALSE → no-op. LLM çağrılır → "Telefon numaranızı?"
  //   (telefon dolu olmasına rağmen) M1 LLM compliance kırılganlığı.
  //
  // FIX: deterministik özet+onay tekrar. shouldTriggerSummaryReask intent
  //   allow-list ile DARALTILMIŞ — meşru sorular (hotel_details/faq_general/
  //   payment_methods/cancellation_policy/...) ve gerçek düzeltme (provide_info,
  //   "0555 123 45 67" gibi) LLM'e gider. SADECE belirsiz/içeriksiz intent'ler
  //   (confirm_reservation/general/greeting) bypass tetikler.
  if (shouldTriggerSummaryReask(context, newContext, nluResult.intent)) {
    const _lang = newContext.language || "tr";
    const info = (newContext.reservationInfo as any) || {};
    const _tourTitle = newContext.currentTour
      ? getLocalizedTourTitle(newContext.currentTour.title || "", _lang)
      : "";
    const _dateText = info.selectedDate ? formatDateForLanguage(info.selectedDate, _lang) : "";
    // 2026-06-25 KÖK 2 ince ayar: paxChild gösterimi (:13 ile tutarlı)
    const _paxAdult = info.paxAdult ?? "";
    const _paxChild = info.paxChild;
    const _name = info.fullName || "";
    const _phone = info.phone || "";

    // Mevcut :13 ile aynı label yapısı (tutarlı görünüm). FARK: confirm metni
    // daha sade — "Bilgileri tekrar görmenizi istedim" yok (kullanıcı o cümleyi
    // kurmadı, tuhaf). Özet zaten üstte, sade soru yeter.
    const _labels: Record<string, { tour: string; date: string; pax: string; adult: string; child: string; name: string; phone: string; reask: string }> = {
      tr: { tour: "Tur",     date: "Tarih",   pax: "Kişi sayısı", adult: "yetişkin",    child: "çocuk",   name: "Ad-Soyad", phone: "Telefon",   reask: "Onaylıyor musunuz, yoksa değiştirmek istediğiniz bir şey var mı? ✅" },
      en: { tour: "Tour",    date: "Date",    pax: "People",      adult: "adult",       child: "child",   name: "Name",     phone: "Phone",     reask: "Do you confirm, or is there something you'd like to change? ✅" },
      de: { tour: "Tour",    date: "Datum",   pax: "Personen",    adult: "Erwachsener", child: "Kind",    name: "Name",     phone: "Telefon",   reask: "Bestätigen Sie, oder möchten Sie etwas ändern? ✅" },
      ru: { tour: "Тур",     date: "Дата",    pax: "Человек",     adult: "взрослый",    child: "ребёнок", name: "Имя",      phone: "Телефон",   reask: "Подтверждаете или хотите что-то изменить? ✅" },
      ar: { tour: "الجولة", date: "التاريخ", pax: "عدد الأشخاص", adult: "بالغ",        child: "طفل",     name: "الاسم",    phone: "الهاتف",    reask: "هل تؤكد أم تريد تغيير شيء ما؟ ✅" },
      fr: { tour: "Circuit", date: "Date",    pax: "Personnes",   adult: "adulte",      child: "enfant",  name: "Nom",      phone: "Téléphone", reask: "Confirmez-vous, ou souhaitez-vous changer quelque chose ? ✅" },
      es: { tour: "Tour",    date: "Fecha",   pax: "Personas",    adult: "adulto",      child: "niño",    name: "Nombre",   phone: "Teléfono",  reask: "¿Confirma o desea cambiar algo? ✅" },
    };
    const L = _labels[_lang] || _labels.tr;

    const _paxText = _paxAdult !== ""
      ? (typeof _paxChild === "number" && _paxChild > 0
          ? `${_paxAdult} ${L.adult}, ${_paxChild} ${L.child}`
          : `${_paxAdult}`)
      : "";

    // CİLA-2 İŞ3 (2026-07-26): 💰 Toplam — re-ask özeti PHONE→CONFIRMING/completion ile
    // AYNI _reservationTotalText tek-kaynağından. Canlı bug: bu re-ask özeti 💰'siz basılıyordu
    // (ilk özet 💰'lu). Özet nereden basılırsa basılsın toplam dahil.
    const _p13Tour = tours.find((t: any) => t.id === (newContext.currentTour?.id || (info as any).tourId));
    const _p13Date = _p13Tour?.dates?.find((d: any) => d.id === (info as any).dateId);
    const _p13TotalText = await _reservationTotalText(
      Number(_paxAdult) || 0, typeof _paxChild === "number" ? _paxChild : 0,
      _p13Date?.price_adult || 0, _p13Date?.price_child,
      _p13Tour?.currency || "TRY", _lang,
      agency.show_multi_currency !== false, languageCurrencies,
    );

    const _summaryLines = [
      _tourTitle ? `📋 ${L.tour}: *${_tourTitle}*` : "",
      _dateText  ? `📅 ${L.date}: ${_dateText}`    : "",
      _paxText   ? `👥 ${L.pax}: ${_paxText}`      : "",
      _name      ? `👤 ${L.name}: ${_name}`        : "",
      _phone     ? `📱 ${L.phone}: ${_phone}`      : "",
      _p13TotalText ? `💰 ${_TOTAL_LABELS[_lang] || _TOTAL_LABELS.en}: *${_p13TotalText}*` : "",
    ].filter(Boolean).join("\n");

    const reaskReply = `${_summaryLines}\n\n${L.reask}`;
    console.log(`[process-message] :13-PERSIST tetiklendi (CONFIRMING no-op, intent=${nluResult.intent}, özet tekrar)`);
    await _save(reaskReply, newContext);
    await adapter.sendResponse(reaskReply);
    return { success: true, response: reaskReply, newContext };
  }

  // === 14. REZERVASYON KAYDET (COMPLETED) ===
  const justCompleted =
    newContext.stage === "COMPLETED" && newContext.reservationConfirmed && context.stage !== "COMPLETED";

  // K6: PII masking — isim/telefon log'a çıkmasın, sadece "var/yok" durumu
  console.log("[process-message] justCompleted check:", {
    justCompleted,
    newStage: newContext.stage,
    reservationConfirmed: newContext.reservationConfirmed,
    oldStage: context.stage,
    tourId: newContext.reservationInfo?.tourId,
    dateId: newContext.reservationInfo?.dateId,
    hasPax: !!newContext.reservationInfo?.paxAdult,
    hasName: !!newContext.reservationInfo?.fullName,
    hasPhone: !!newContext.reservationInfo?.phone,
  });

  if (justCompleted) {
    const { tourId, dateId, fullName, phone: regPhone, paxAdult } = newContext.reservationInfo;
    const reservationPhone = regPhone || adapter.identifier || "";

    // KRİTİK: Telefon format koruması — placeholder/bozuk değer DB'ye yazılmasın
    const _phoneDigits = reservationPhone.replace(/[\s\-\(\)\.]/g, "");
    const _phoneOk = /^\+?\d{7,15}$/.test(_phoneDigits);
    if (reservationPhone && !_phoneOk) {
      // K6: PII masking
      console.error("[process-message] Invalid phone format — requeuing for phone collection", {
        regPhone: maskPhone(regPhone),
        identifier: maskPhone(adapter.identifier),
        reservationPhone: maskPhone(reservationPhone),
      });
      newContext.stage = "COLLECTING_INFO";
      newContext.reservationConfirmed = false;
      newContext.collectionStep = "waiting_for_phone";
      if (newContext.reservationInfo) newContext.reservationInfo.phone = undefined;
      const _phMsgs: Record<string, string> = {
        tr: "Telefon numaranızı net olarak alamadım, lütfen tekrar yazar mısınız? 📱 (örn: 0555 123 45 67)",
        en: "I couldn't get your phone number clearly, please send it again. 📱 (e.g., +90 555 123 45 67)",
        de: "Ich konnte Ihre Telefonnummer nicht klar erfassen, bitte erneut senden. 📱",
        ru: "Не удалось получить номер телефона, отправьте ещё раз. 📱",
        ar: "لم أتمكن من الحصول على رقم هاتفك بوضوح، يرجى إعادة كتابته. 📱",
        fr: "Je n'ai pas pu obtenir votre numéro de téléphone, veuillez l'envoyer à nouveau. 📱",
        es: "No pude obtener su número de teléfono, por favor envíelo de nuevo. 📱",
      };
      const _phReply = _phMsgs[newContext.language] || _phMsgs.tr;
      await _save(_phReply, newContext);
      await adapter.sendResponse(_phReply);
      return { success: false, error: "invalid_phone", response: _phReply, newContext };
    }

    // BUG 1 FIX (Hayriye case, 2026-06-XX): missingStep hesaplanırken state'in
    // context.reservationInfo'sundan FALLBACK al. Eğer newContext.reservationInfo'da
    // bir alan eksik gözüküyor AMA önceki context.reservationInfo'da DOLU ise,
    // yeniden topla yerine eski değeri kullan. CONFIRMING→COMPLETED action'ı
    // reservationInfo'ya dokunmaz; ama bug 2 bypass'ları varsa fullName'in başka
    // bir transition'da kaybolma riski savunmacı olarak kapatılır.
    const oldInfo = (context.reservationInfo || {}) as any;
    const effFullName = fullName || oldInfo.fullName;
    const effPaxAdult = paxAdult || oldInfo.paxAdult;
    const effDateId   = dateId   || oldInfo.dateId;
    const effPhone    = reservationPhone || oldInfo.phone;
    if (effFullName && !fullName) {
      console.warn("[process-message] BUG1 SAFETY: fullName missing from newContext but present in old context — restoring");
      if (newContext.reservationInfo) newContext.reservationInfo.fullName = effFullName;
    }

    // R6: paxAdult/phone için tek-helper FORMAT validasyonu — kayıt-anı son sigorta.
    // Eğer invalid değer state'e sızdıysa (üçüncü path/edge bypass), buradan
    // re-collect'e yönlendir. RPC'ye geçersiz değer geçmez.
    const missingStep = !tourId ? "waiting_for_date"  // tourId yoksa tur seçimi eksik
      : !effDateId ? "waiting_for_date"
      : !isValidPax(effPaxAdult) ? "waiting_for_pax"
      : !effFullName ? "waiting_for_name"
      : !isValidPhone(effPhone) ? "waiting_for_phone"
      : null;
    console.log("[process-message] reservation missingStep:", missingStep, "| tourId:", tourId, "| dateId:", dateId);

    if (missingStep) {
      newContext.stage = "COLLECTING_INFO";
      newContext.reservationConfirmed = false;
      newContext.collectionStep = missingStep as any;
      const missMsgs: Record<string, string> = {
        tr: "Rezervasyonu tamamlayabilmem için eksik bilgileri adım adım tamamlayalım.",
        en: "Let's complete the missing details to finalize your reservation.",
        de: "Lassen Sie uns die fehlenden Angaben für Ihre Reservierung ergänzen.",
        ru: "Давайте заполним недостающие данные для завершения бронирования.",
        ar: "دعنا نكمل البيانات الناقصة لإتمام حجزك.",
        fr: "Complétez les informations manquantes pour finaliser votre réservation.",
        es: "Completemos los datos que faltan para finalizar su reserva.",
      };
      const missReply = missMsgs[newContext.language] || missMsgs.tr;
      await _save(missReply, newContext);
      await adapter.sendResponse(missReply);
      return { success: true, response: missReply, newContext };
    }

    // FIX 2: Tur ve tarih hâlâ yüklü listede var mı? Bayat state koruması.
    const _tourInList = tours.find((t: any) => t.id === tourId);
    const _dateInList = _tourInList?.dates?.find((d: any) => d.id === dateId);
    if (!_tourInList || !_dateInList) {
      console.warn("[process-message] Stale state: tour/date no longer in loaded list", { tourId, dateId });
      newContext.stage = "BROWSING";
      newContext.currentTour = null;
      newContext.reservationInfo = {};
      newContext.reservationConfirmed = false;
      newContext.collectionStep = undefined;
      const _staleMsgs: Record<string, string> = {
        tr: "Bilgileriniz güncellenmiş olabilir, baştan bakalım — hangi turlar ilginizi çeker?",
        en: "Your information may have been updated. Let's start fresh — which tours interest you?",
        de: "Ihre Informationen haben sich möglicherweise geändert. Fangen wir von vorne an — welche Touren interessieren Sie?",
        ru: "Ваши данные могли измениться. Начнём заново — какие туры вас интересуют?",
        ar: "قد تكون معلوماتك قد تغيرت. لنبدأ من جديد — ما الجولات التي تهمك؟",
        fr: "Vos informations ont peut-être changé. Recommençons — quels circuits vous intéressent ?",
        es: "Su información puede haber cambiado. Empecemos de nuevo — ¿qué tours le interesan?",
      };
      const _staleReply = _staleMsgs[newContext.language] || _staleMsgs.tr;
      await _save(_staleReply, newContext);
      await adapter.sendResponse(_staleReply);
      return { success: false, error: "stale_state", response: _staleReply, newContext };
    }

    const totalPax = (paxAdult || 0) + (newContext.reservationInfo.paxChild || 0);
    // K3: total_amount SNAPSHOT — rezervasyon kaydında "o anki fiyat" korunur.
    // tours.find ile child fiyatına da ulaşırız (calculateTotal pax dağılımını destekler).
    const _selDateForRpc = tours
      .find((tr: any) => tr.id === tourId)
      ?.dates?.find((d: any) => d.id === dateId);
    const _totalAmountForRpc = calculateTotal(
      paxAdult || 0,
      _selDateForRpc?.price_adult,
      newContext.reservationInfo.paxChild || 0,
      _selDateForRpc?.price_child,
    );
    // K6: fullName loga çıkmasın, sadece "var/yok" durumu
    console.log("[process-message] calling create_reservation RPC:", { tourId, dateId, hasName: !!fullName, totalPax, totalAmount: _totalAmountForRpc, agencyId: agency.id });
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "create_reservation_with_quota_check",
      {
        p_tour_id: tourId,
        p_tour_date_id: dateId,
        p_full_name: fullName,
        p_phone: reservationPhone,
        p_pax: totalPax,
        p_agency_id: agency.id,
        p_source_channel: "WHATSAPP",
        p_total_amount: _totalAmountForRpc > 0 ? _totalAmountForRpc : null,
        // 2026-07-09 V11-a: gönüllü e-posta (waiting_for_phone telefon-yok dalında
        // veya :12 email adımında alınmış olabilir) → registrations.email'e persist.
        // RPC p_email DEFAULT NULL (migration 20260518000002) — geriye uyumlu.
        p_email: (newContext.reservationInfo as any)?.email || null,
      }
    );

    console.log("[process-message] create_reservation RPC result:", { success: rpcResult?.success, error: rpcResult?.error, rpcError: rpcError?.message });
    if (rpcError || !rpcResult?.success) {
      const errCode = rpcResult?.error || "UNKNOWN";
      const lang = newContext.language || "tr";
      const agPhone = _agencyPhoneSuffix(agency.phone_public);
      let errorReply = "";

      if (errCode === "QUOTA_EXCEEDED") {
        newContext.reservationInfo.dateId = undefined;
        newContext.reservationInfo.selectedDate = undefined;
        newContext.stage = "COLLECTING_INFO";
        newContext.reservationConfirmed = false;
        newContext.collectionStep = "waiting_for_date";
        const _quotaTour = tours.find((t: any) => t.id === tourId);
        let _altDates = "";
        if (_quotaTour?.dates && _quotaTour.dates.length > 1) {
          const _qRates = await getExchangeRatesOnce().catch(() => ({}));
          const _qDual = agency.show_multi_currency !== false;
          // 2026-06-22 Sorun H DRY: inline filter → hasQuotaForPax helper (Murat A ilkesi)
          _altDates = "\n\n" + _quotaTour.dates
            .filter((d: any) => d.id !== dateId && hasQuotaForPax(d, 1))
            .map((d: any, i: number) => {
              const dt = formatDateForLanguage(d.departure_date, lang);
              const pr = d.price_adult
                ? ` - ${formatPriceSync(d.price_adult, _quotaTour.currency || "TRY", lang, _qRates, _qDual, languageCurrencies)}`
                : "";
              return `${i + 1}) ${dt}${pr}`;
            })
            .join("\n");
        }
        const _msgs: Record<string, string> = {
          tr: `Üzgünüm, seçtiğiniz tarih için kontenjan dolmuş. 😔 Başka bir tarih seçer misiniz?${_altDates}`,
          en: `Sorry, the date you selected is fully booked. 😔 Could you choose another date?${_altDates}`,
          de: `Es tut mir leid, das gewählte Datum ist ausgebucht. 😔 Bitte ein anderes Datum wählen.${_altDates}`,
          ru: `Извините, выбранная дата уже занята. 😔 Выберите другую дату.${_altDates}`,
          ar: `آسف، التاريخ محجوز بالكامل. 😔 اختر تاريخاً آخر.${_altDates}`,
          fr: `Désolé, la date est complète. 😔 Choisissez une autre date.${_altDates}`,
          es: `Lo siento, la fecha está completa. 😔 Elija otra fecha.${_altDates}`,
        };
        errorReply = _msgs[lang] || _msgs.tr;
      } else if (errCode === "DUPLICATE") {
        newContext.stage = "BROWSING";
        newContext.reservationConfirmed = false;
        newContext.reservationInfo = {};
        const _msgs: Record<string, string> = {
          tr: `Bu tur için zaten kayıtlı görünüyorsunuz. ℹ️ Detaylar için ${agency.name} ile iletişime geçin.${agPhone}`,
          en: `You appear to already be registered for this tour. ℹ️ Please contact ${agency.name}.${agPhone}`,
          de: `Sie scheinen bereits für diese Tour angemeldet zu sein. ℹ️ Bitte kontaktieren Sie ${agency.name}.${agPhone}`,
          ru: `Похоже, вы уже записаны на этот тур. ℹ️ Обратитесь в ${agency.name}.${agPhone}`,
          ar: `يبدو أنك مسجل بالفعل في هذه الجولة. ℹ️ يرجى التواصل مع ${agency.name}.${agPhone}`,
          fr: `Vous semblez déjà inscrit pour ce circuit. ℹ️ Contactez ${agency.name}.${agPhone}`,
          es: `Parece que ya está registrado para este tour. ℹ️ Contacte con ${agency.name}.${agPhone}`,
        };
        errorReply = _msgs[lang] || _msgs.tr;
      } else if (errCode === "TOUR_DATE_NOT_FOUND") {
        newContext.reservationInfo.dateId = undefined;
        newContext.reservationInfo.selectedDate = undefined;
        newContext.stage = "COLLECTING_INFO";
        newContext.reservationConfirmed = false;
        newContext.collectionStep = "waiting_for_date";
        const _msgs: Record<string, string> = {
          tr: "Seçtiğiniz tarih artık mevcut değil. 😔 Lütfen başka bir tarih seçin.",
          en: "The date you selected is no longer available. 😔 Please choose another date.",
          de: "Das gewählte Datum ist nicht mehr verfügbar. 😔 Bitte wählen Sie ein anderes Datum.",
          ru: "Выбранная дата больше недоступна. 😔 Выберите другую дату.",
          ar: "التاريخ المحدد لم يعد متاحاً. 😔 يرجى اختيار تاريخ آخر.",
          fr: "La date choisie n'est plus disponible. 😔 Veuillez choisir une autre date.",
          es: "La fecha seleccionada ya no está disponible. 😔 Elija otra fecha.",
        };
        errorReply = _msgs[lang] || _msgs.tr;
      } else if (errCode === "TOUR_NOT_FOUND") {
        newContext.stage = "BROWSING";
        newContext.currentTour = null;
        newContext.reservationInfo = {};
        newContext.reservationConfirmed = false;
        const _msgs: Record<string, string> = {
          tr: "Seçtiğiniz tur artık mevcut değil. 😔 Güncel turlarımıza bakabilirsiniz.",
          en: "The tour you selected is no longer available. 😔 Please check our current tours.",
          de: "Die gewählte Tour ist nicht mehr verfügbar. 😔 Schauen Sie sich unsere aktuellen Touren an.",
          ru: "Выбранный тур больше не доступен. 😔 Ознакомьтесь с нашими актуальными турами.",
          ar: "الجولة المحددة لم تعد متاحة. 😔 يرجى الاطلاع على جولاتنا الحالية.",
          fr: "Le circuit sélectionné n'est plus disponible. 😔 Consultez nos circuits actuels.",
          es: "El tour seleccionado ya no está disponible. 😔 Consulte nuestros tours actuales.",
        };
        errorReply = _msgs[lang] || _msgs.tr;
      } else {
        newContext.stage = context.stage;
        newContext.reservationConfirmed = false;
        const _msgs: Record<string, string> = {
          tr: `Rezervasyonunuz oluşturulurken bir sorun yaşandı. Lütfen ${agency.name} ile iletişime geçiniz.${agPhone}`,
          en: `There was an issue creating your reservation. Please contact ${agency.name}.${agPhone}`,
          de: `Bei Ihrer Reservierung ist ein Problem aufgetreten. Bitte kontaktieren Sie ${agency.name}.${agPhone}`,
          ru: `При создании бронирования возникла ошибка. Обратитесь в ${agency.name}.${agPhone}`,
          ar: `حدثت مشكلة أثناء إنشاء حجزك. يرجى التواصل مع ${agency.name}.${agPhone}`,
          fr: `Un problème est survenu lors de la réservation. Contactez ${agency.name}.${agPhone}`,
          es: `Hubo un problema al crear su reserva. Contacte con ${agency.name}.${agPhone}`,
        };
        errorReply = _msgs[lang] || _msgs.tr;
      }
      await _save(errorReply, newContext);
      await adapter.sendResponse(errorReply);
      return { success: false, error: errCode, response: errorReply, newContext };
    }

    // === P6-FIX ① (2026-07-28): CRM profiline İSİM yazımı (rezervasyon başarılı) ===
    // total_bookings/total_spent DB-trigger'ının (sync_user_booking_stats) işi — burada
    // DOKUNULMAZ. Eksik olan tek şey profildeki İSİMDİ: bot akışındaki isim profile hiç
    // taşınmıyordu → returningUserName (full_name && total_bookings>0) fiilen hiç
    // tetiklenmiyordu; profildeki isimler yalnız CRM panelinden elle giriliyordu.
    // KURALLAR: (a) YÜZEY-AYRIMI — yalnız whatsapp (upsertUserProfile'ın yüzey-ayrımı
    // ile aynı); demo/website akışı gerçek profilleri kirletmez. (b) UPDATE-only —
    // profil satırı YOKSA no-op: starter planında (has_user_profiles=false) profil hiç
    // oluşmadığından ücretli CRM özelliği sızmaz, plan-lookup coupling'i gerekmez.
    // (c) elle-girilmiş isim EZİLMEZ (yalnız NULL/boş doldurulur). (d) normalize_phone
    // eşleşmesi — kanonik profil ↔ ham kayıt (İş1 sonrası tam-string eşleşmiyor).
    // Best-effort: hata akışı BOZMAZ (rezervasyon zaten kayıtlı).
    // (e) EŞLEŞME DB'DE: TS normalizePhone ("05416500303") ile DB normalize_phone
    // ("905416500303") FARKLI kanonik üretir — edge'de eşleştirmek bu paketle
    // düzeltilen drift'i yeniden üretirdi. RPC fill_profile_name_if_empty tek-kaynak.
    if (adapter.channel === "whatsapp" && fullName && reservationPhone) {
      try {
        const { data: _filled, error: _profErr } = await supabase.rpc("fill_profile_name_if_empty", {
          p_agency_id: agency.id,
          p_phone: reservationPhone,
          p_full_name: fullName,
        });
        if (_profErr) console.error("[P6-FIX] profil isim yazımı başarısız:", _profErr.message);
        else console.log(`[P6-FIX] profil ismi dolduruldu (boşsa) — kanal=whatsapp, satır=${_filled ?? 0}`);
      } catch (_pe) {
        console.error("[P6-FIX] profil isim yazımı hata:", _pe instanceof Error ? _pe.message : _pe);
      }
    }

    // Rezervasyon başarılı → deterministik tamamlama mesajı
    const selectedTourFull = tours.find((t: any) => t.id === tourId);
    const selectedDateFull = selectedTourFull?.dates?.find((d: any) => d.id === dateId);
    const formattedDate = selectedDateFull?.departure_date
      ? formatDateForLanguage(selectedDateFull.departure_date, newContext.language)
      : newContext.reservationInfo.selectedDate || "-";

    const adultCount = newContext.reservationInfo.paxAdult || 0;
    const childCount = newContext.reservationInfo.paxChild || 0;
    const paxTextMap: Record<string, string> = {
      tr: `${adultCount} yetişkin${childCount ? `, ${childCount} çocuk` : ""}`,
      en: `${adultCount} adult${adultCount > 1 ? "s" : ""}${childCount ? `, ${childCount} child${childCount > 1 ? "ren" : ""}` : ""}`,
      de: `${adultCount} Erwachsene${childCount ? `, ${childCount} Kind${childCount > 1 ? "er" : ""}` : ""}`,
      ru: `${adultCount} взросл${adultCount === 1 ? "ый" : "ых"}${childCount ? `, ${childCount} ребёнок` : ""}`,
      ar: `${adultCount} بالغ${childCount ? `، ${childCount} طفل` : ""}`,
      fr: `${adultCount} adulte${adultCount > 1 ? "s" : ""}${childCount ? `, ${childCount} enfant${childCount > 1 ? "s" : ""}` : ""}`,
      es: `${adultCount} adulto${adultCount > 1 ? "s" : ""}${childCount ? `, ${childCount} niño${childCount > 1 ? "s" : ""}` : ""}`,
    };
    const paxText = paxTextMap[newContext.language] || paxTextMap.en;
    const tourTitle = getLocalizedTourTitle(
      selectedTourFull?.title || newContext.reservationInfo.tourTitle || "-",
      newContext.language,
    );
    const emailLine = newContext.reservationInfo.email ? `\n• *Email:* ${newContext.reservationInfo.email}` : "";

    // Toplam tutar — TEK-KAYNAK _reservationTotalText (CONFIRMING özeti ile AYNI).
    const _totalText = await _reservationTotalText(
      adultCount, childCount,
      selectedDateFull?.price_adult || 0, selectedDateFull?.price_child,
      selectedTourFull?.currency || "TRY", newContext.language,
      agency.show_multi_currency !== false, languageCurrencies,
    );
    const _totalLine = _totalText
      ? `\n• *${_TOTAL_LABELS[newContext.language] || _TOTAL_LABELS.en}:* ${_totalText}`
      : "";

    // Yeni kompakt format: tek başlık + özet + toplam (tekrar YOK)
    const completionMsgs: Record<string, string> = {
      tr: `✅ *Rezervasyonunuz onaylandı, ${fullName || ""}!* 🎉\n\n• *Tur:* ${tourTitle}\n• *Tarih:* ${formattedDate}\n• *Kişi:* ${paxText}\n• *Telefon:* ${reservationPhone || "-"}${emailLine}${_totalLine}`,
      en: `✅ *Reservation confirmed, ${fullName || ""}!* 🎉\n\n• *Tour:* ${tourTitle}\n• *Date:* ${formattedDate}\n• *People:* ${paxText}\n• *Phone:* ${reservationPhone || "-"}${emailLine}${_totalLine}`,
      de: `✅ *Reservierung bestätigt, ${fullName || ""}!* 🎉\n\n• *Tour:* ${tourTitle}\n• *Datum:* ${formattedDate}\n• *Personen:* ${paxText}\n• *Telefon:* ${reservationPhone || "-"}${emailLine}${_totalLine}`,
      ru: `✅ *Бронирование подтверждено, ${fullName || ""}!* 🎉\n\n• *Тур:* ${tourTitle}\n• *Дата:* ${formattedDate}\n• *Количество:* ${paxText}\n• *Телефон:* ${reservationPhone || "-"}${emailLine}${_totalLine}`,
      ar: `✅ *تم تأكيد حجزك، ${fullName || ""}!* 🎉\n\n• *الجولة:* ${tourTitle}\n• *التاريخ:* ${formattedDate}\n• *الأشخاص:* ${paxText}\n• *الهاتف:* ${reservationPhone || "-"}${emailLine}${_totalLine}`,
      fr: `✅ *Réservation confirmée, ${fullName || ""}!* 🎉\n\n• *Circuit:* ${tourTitle}\n• *Date:* ${formattedDate}\n• *Personnes:* ${paxText}\n• *Téléphone:* ${reservationPhone || "-"}${emailLine}${_totalLine}`,
      es: `✅ *Reserva confirmada, ${fullName || ""}!* 🎉\n\n• *Tour:* ${tourTitle}\n• *Fecha:* ${formattedDate}\n• *Personas:* ${paxText}\n• *Teléfono:* ${reservationPhone || "-"}${emailLine}${_totalLine}`,
    };

    let completionReply = completionMsgs[newContext.language] || completionMsgs.tr;

    // Ödeme bilgisi
    if (paymentInstructions && selectedDateFull) {
      // K5: deposit_percentage 0-100 dışındaysa güvenli varsayılan
      const depPct = safeDepositPercentage(
        typeof paymentInstructions === "object" ? paymentInstructions?.deposit_percentage : null
      );
      // K4: TEK kaynak — calculateTotal/Deposit (önceki Math.ceil tutarsızlığı giderildi)
      const totalPrice = calculateTotal(
        adultCount,
        selectedDateFull.price_adult,
        childCount,
        selectedDateFull.price_child,
      );
      const depositAmt = calculateDeposit(totalPrice, depPct);
      // O3: price NULL/0 ise totalPrice=0 → ödeme mesajı atlanır (rezervasyon halen kayıtlı
      // ama müşteri yanlış kapora görmez). Acente paneli "Birim Fiyat boş" uyarısı verir.
      if (totalPrice <= 0) {
        console.warn("[process-message] O3: skipping payment message — totalPrice=0", {
          adultCount, childCount,
          priceAdult: selectedDateFull.price_adult, priceChild: selectedDateFull.price_child,
          dateId: selectedDateFull.id,
        });
      }
      if (totalPrice > 0) {
        const payMsg = await generatePaymentMessage(
          paymentInstructions, newContext.language, totalPrice, depositAmt,
          selectedTourFull?.currency || "TRY",
          { languageCurrencies, primaryCurrency, agencyPhone: agency.phone_public,
            showMultiCurrency: agency.show_multi_currency !== false }
        );
        if (payMsg) {
          completionReply += payMsg;
          newContext.paymentInfoSent = true;
        }
      }
    }

    // 2026-07-03 İş E (M-25) — ÇİFT ONAY SÖNÜMLEME: reservation_confirmed
    // template addendum'u KALDIRILDI. Mimari doğrulama: template'in tek sohbet
    // tüketicisi buydu (whatsapp adapter.getCompletionTemplateAddendum) ve
    // completion cevabına EK olarak ikinci bir "rezervasyonunuz onaylandı...
    // detaylar tur tarihinden önce iletilecek" onayı basıyordu — sohbet cevabı
    // zaten TAM onay+özet+ödeme veriyor. Kanal ayrımı YAPISAL: bu kod yalnız
    // bot-sohbet completion'ı; panel/manuel rezervasyon bildirimleri
    // send-template-message'ı AYRI yoldan çağırır, ETKİLENMEZ. new_reservation/
    // agency_new_reservation DB trigger'ları (Turzz ekibi + acente bildirimi)
    // da AYNEN — onlar müşteriye gitmiyor.
    // (Addendum çağrısı kaldırıldı — 2026-07-24 ölü-kod temizliğinde
    // adapter.getCompletionTemplateAddendum metodu da SİLİNDİ. Geri almak
    // için: git log M-25 + bu commit.)

    // İletişim footer (agency.phone_public varsa)
    if (agency.phone_public) {
      const _contactLabels: Record<string, string> = {
        tr: "Sorularınız için",
        en: "For questions",
        de: "Bei Fragen",
        ru: "По вопросам",
        ar: "للأسئلة",
        fr: "Pour vos questions",
        es: "Para consultas",
      };
      const _contactLabel = _contactLabels[newContext.language] || _contactLabels.en;
      completionReply += `\n\n📞 ${_contactLabel}: ${agency.phone_public}`;
    }

    await _save(completionReply, newContext);
    await adapter.sendResponse(completionReply);
    return { success: true, response: completionReply, newContext };
  }

  // === 14a. O9 — AFTER-SALES İPTAL/DEĞİŞİKLİK DETERMİNİSTİK MESAJ ===
  // Müşteri COMPLETED stage'inde "iptal et", "değiştir" gibi mesaj attı.
  // BOT DB'DE STATUS DEĞİŞTİRMEZ (güvenlik). Talebi acenteye yönlendirir +
  // complaints tablosuna kayıt bırakır (panel'de görünür). Kontenjan/K4 trigger'ı
  // acente CANCELLED yaptığında zaten doğru çalışıyor.
  //
  // 2026-06-24 FIX 2b (SORUN 3 — exec ffb73402):
  //   "iptal şartları nedir?" → NLU cancellation_policy → FSM general_question.
  //   _bookingActionRe "iptal" kelimesini yakalıyordu → bilgi sorusunu "talep" sayıp
  //   "Talebinizi aldık ✅..." yanlış mesajı atıyordu. Bug C (detectCancellationGuarded)
  //   ile aynı niyet/bilgi ayrımı sorunu — tutarlı guard: FSM intent general_question
  //   ise bu bypass'ı atla, LLM after-sales prompt'uyla cevaplasın.
  if (
    context.stage === "COMPLETED" &&
    newContext.stage === "COMPLETED" &&
    fsmIntent !== "general_question"   // bilgi sorgulama (cancellation_policy/faq/...) — LLM cevaplasın
  ) {
    const _msgLower = message.toLowerCase();
    // 2026-07-09 FABLE-denetim: eski regex MALFORMED'dı — ")|değiştir|change|..."
    // alternatifleri SINIRSIZDI ("exchange" içindeki "change" FP!) + \b Kiril/
    // Arapça'da отмен/إلغاء ölüydü. Tek grup + lookbehind (gövde-stem'ler açık:
    // değiştir*/change*/отмен* çekimleri bilinçli serbest — lookahead YOK).
    const _bookingActionRe = /(?<![\p{L}\p{N}])(iptal|cancel|annul|annuler|cancelar|stornier|отмен|إلغاء|إلغ|değiştir|change|modif|cambiar|ändern|изменить|تعديل|تغيير)/iu;
    const _isCancelOrChange = _bookingActionRe.test(_msgLower);
    if (_isCancelOrChange) {
      const _agPhone = _agencyPhoneSuffix(agency.phone_public);
      // FIX5 (A3-b): ✅ → 📩 — bu bir TALEP-ALINDI mesajı; ✅ "iptal tamamlandı"
      // izlenimi veriyordu (DB'ye dokunulmuyor, yalnız complaints kaydı).
      const _ackMsgs: Record<string, string> = {
        tr: `Talebinizi aldık 📩 Acentemiz en kısa sürede sizinle iletişime geçecek. Acil durumlar için doğrudan arayabilirsiniz.${_agPhone}`,
        en: `We've received your request 📩 Our agency will contact you shortly. For urgent matters, please call us directly.${_agPhone}`,
        de: `Wir haben Ihre Anfrage erhalten 📩 Unsere Agentur wird sich in Kürze mit Ihnen in Verbindung setzen. Bei dringenden Anliegen rufen Sie uns bitte direkt an.${_agPhone}`,
        ru: `Мы получили ваш запрос 📩 Наше агентство свяжется с вами в ближайшее время. По срочным вопросам звоните напрямую.${_agPhone}`,
        ar: `لقد استلمنا طلبك 📩 ستتواصل وكالتنا معك في أقرب وقت. للأمور العاجلة يرجى الاتصال مباشرة.${_agPhone}`,
        fr: `Nous avons bien reçu votre demande 📩 Notre agence vous contactera prochainement. Pour les urgences, appelez-nous directement.${_agPhone}`,
        es: `Hemos recibido su solicitud 📩 Nuestra agencia se pondrá en contacto con usted en breve. Para asuntos urgentes, llámenos directamente.${_agPhone}`,
      };
      const _ackReply = _ackMsgs[newContext.language] || _ackMsgs.tr;

      // Complaint kaydı (panel'de "açık talep" olarak görünür)
      supabase.from("complaints").insert({
        agency_id: agency.id,
        phone: adapter.identifier,
        message,
        type: "after_sales_action",
        status: "new",
      }).then(() => {}, () => {});

      await _save(_ackReply, newContext);
      await adapter.sendResponse(_ackReply);
      return { success: true, response: _ackReply, newContext };
    }
  }

  // === 14a-3. COMPLETED'de DEĞİŞİKLİK TALEBİ → ACENTE YÖNLENDİRME ===
  // 2026-06-24 KARAR (Murat — exec ea455bf9 sonrası yön değişikliği):
  //   Rezervasyon ONAYLANDIKTAN SONRA isim/telefon/tarih/pax değişikliği DB'ye
  //   yazılmış kaydı etkilemez (bot DB güncellemiyor). State'te değiştirmek
  //   yalan vaat üretir. Bunun yerine acenteye yönlendir.
  //
  // YAKALAMA KOŞULLARI (intent-bazlı, regex'ten bağımsız):
  //   - intent === "change_info" → açık değişiklik niyeti
  //   - intent === "provide_info" + (extracted.fullName/phone/dateId/paxAdult mevcuttan FARKLI)
  //     → "aslında adım Osman" gibi örtük değişiklik
  //
  // INTENT AYRIMI (KRİTİK — yeni rezervasyon yutmasın):
  //   - tour_search / reservation_intent → YENİ REZERVASYON niyeti, ATLA
  //     (state-machine COMPLETED→TOUR_SELECTED/BROWSING zaten yeni akışı başlatır)
  //   - general / greeting → Bug A bypass (14a-2) yakalar, ATLA
  //   - general_question (cancellation_policy/payment_methods/faq bilgi sorgu) → ATLA
  //     (LLM after-sales prompt'uyla cevaplar — Fix 2 korunur)
  //   - support_request (after_sales eylem — ödedim/dekont) → 14a yakalamış olabilir
  //     veya LLM cevap; bu bypass ATLA (değişiklik talebi değil)
  if (
    context.stage === "COMPLETED" &&
    newContext.stage === "COMPLETED" &&
    newContext.reservationConfirmed === true
  ) {
    const _curInfo = newContext.reservationInfo || {};
    const _ext = (extractedInfo as any) || {};
    const _isFullNameChange =
      !!_ext.fullName && !!_curInfo.fullName && _ext.fullName !== _curInfo.fullName;
    const _isPhoneChange =
      !!_ext.phone && !!_curInfo.phone && _ext.phone !== _curInfo.phone;
    const _isPaxChange =
      !!_ext.paxAdult && !!_curInfo.paxAdult && _ext.paxAdult !== _curInfo.paxAdult;
    const _isDateChange =
      !!_ext.dateId && !!_curInfo.dateId && _ext.dateId !== _curInfo.dateId;
    const _anyFieldChange = _isFullNameChange || _isPhoneChange || _isPaxChange || _isDateChange;

    const _isChangeRequest =
      nluResult.intent === "change_info" ||
      (nluResult.intent === "provide_info" && _anyFieldChange);

    if (_isChangeRequest) {
      const _agPhone = _agencyPhoneSuffix(agency.phone_public);
      const _redirectMsgs: Record<string, string> = {
        tr: `Rezervasyonunuz onaylandı ✅ İsim, telefon veya diğer bilgilerde değişiklik için lütfen acentemizle iletişime geçin.${_agPhone}`,
        en: `Your reservation is confirmed ✅ For changes to name, phone or other details, please contact our agency directly.${_agPhone}`,
        de: `Ihre Reservierung ist bestätigt ✅ Für Änderungen an Name, Telefon oder anderen Angaben wenden Sie sich bitte direkt an unsere Agentur.${_agPhone}`,
        fr: `Votre réservation est confirmée ✅ Pour modifier le nom, le téléphone ou d'autres informations, veuillez contacter directement notre agence.${_agPhone}`,
        es: `Su reserva está confirmada ✅ Para cambios de nombre, teléfono u otros datos, contacte directamente con nuestra agencia.${_agPhone}`,
        ru: `Ваше бронирование подтверждено ✅ Для изменения имени, телефона или других данных, пожалуйста, свяжитесь с нашим агентством напрямую.${_agPhone}`,
        ar: `تم تأكيد حجزك ✅ لتغيير الاسم أو الهاتف أو التفاصيل الأخرى، يرجى التواصل مع وكالتنا مباشرة.${_agPhone}`,
      };
      const _redirectReply = _redirectMsgs[newContext.language] || _redirectMsgs.tr;
      const _changedFields = [
        _isFullNameChange ? "fullName" : null,
        _isPhoneChange ? "phone" : null,
        _isPaxChange ? "pax" : null,
        _isDateChange ? "date" : null,
      ].filter(Boolean).join(",") || "intent-only";
      console.log(`[process-message] 14a-3 COMPLETED değişiklik → acente yönlendirme (intent=${nluResult.intent}, fields=${_changedFields})`);

      // Complaint kaydı — acente panelde görsün
      supabase.from("complaints").insert({
        agency_id: agency.id,
        phone: adapter.identifier,
        message,
        type: "after_sales_action",
        status: "new",
      }).then(() => {}, () => {});

      await _save(_redirectReply, newContext);
      await adapter.sendResponse(_redirectReply);
      return { success: true, response: _redirectReply, newContext };
    }
  }

  // === 14a-2. BUG A FIX — COMPLETED after-sales ack (general/greeting) ===
  // 2026-06-23 (exec 4858c2f0 kanıtı): COMPLETED'de "teşekkürler" → NLU intent=general
  // → state-machine transition #4 (eskiden general/greeting allow-list'te) tetikleniyor,
  // resetForNewReservation reservationInfo={} → state UÇUYOR → LLM BROWSING prompt'unda
  // "telefon ver" diye saçma soru üretiyordu.
  //
  // İki katmanlı fix:
  //   1. state-machine.ts: transition #4 allow-list daraltıldı (greeting/general çıktı)
  //      → state-machine artık no-op kalır (COMPLETED → COMPLETED).
  //   2. Burada (process-message): no-op senaryosunda deterministik kapanış mesajı,
  //      LLM atlanır, state OLDUĞU GİBİ KORUNUR (reservationInfo değişmez).
  //
  // ALLOW-LIST: sadece general + greeting. Meşru after-sales niyetleri yutmaz:
  //   - tour_search/browse_tours → state-machine BROWSING'e geçirir (yeni tur akışı)
  //   - reservation_intent + tur → state-machine TOUR_SELECTED'a geçirir
  //   - change_info/cancellation → mevcut 14a after-sales bypass yakalar (yukarıda)
  //   - faq_general/payment_methods/... → LLM after-sales kuralları cevaplar
  //   - provide_info → riskli, LLM yorumlasın (yeni rezervasyon başlatıyor olabilir)
  //
  // STATE: SİLİNMEZ. reservationConfirmed=true + reservationInfo dolu kalır → kullanıcı
  // sonraki turn "iptal" derse 14a bypass çalışır, "başka tur" derse state-machine
  // yeni rezervasyon yoluna geçirir.
  // 2026-07-10 A3 (kozmetik): ack yalnız TEŞEKKÜR/VEDA sinyalinde (TEK KAYNAK
  // constants/thanks-words.ts, 7-dil). Sinyalsiz chitchat ("kapadokya güzelmiş")
  // "Rezervasyonunuz tamamlandı ✅" basıyordu — alakasız/robotik. Sinyalsiz
  // general/greeting artık :14a-sonrası LLM after-sales yoluna düşer.
  if (
    context.stage === "COMPLETED" &&
    newContext.stage === "COMPLETED" &&
    newContext.reservationConfirmed === true &&
    (nluResult.intent === "general" || nluResult.intent === "greeting") &&
    THANKS_FAREWELL_RE.test(message)
  ) {
    // 2026-07-09 Faz 5 A4 (V4): 7-dil tamamlandı (eski TR+EN → TR fallback'i
    // DE/FR/ES/RU/AR kullanıcıya TR kapanış basıyordu).
    const _ackBugAMsgs: Record<string, string> = {
      tr: "Rezervasyonunuz tamamlandı ✅ Başka bir konuda yardımcı olabilir miyim?",
      en: "Your reservation is complete ✅ Is there anything else I can help with?",
      de: "Ihre Reservierung ist abgeschlossen ✅ Kann ich Ihnen noch bei etwas anderem helfen?",
      fr: "Votre réservation est terminée ✅ Puis-je vous aider avec autre chose ?",
      es: "Su reserva está completa ✅ ¿Puedo ayudarle con algo más?",
      ru: "Ваше бронирование завершено ✅ Могу ли я помочь с чем-то ещё?",
      ar: "تم إتمام حجزك ✅ هل يمكنني مساعدتك في شيء آخر؟",
    };
    const _ackBugAReply = _ackBugAMsgs[newContext.language] || _ackBugAMsgs.tr;
    console.log(`[process-message] COMPLETED after-sales ack → deterministik kapanış (intent=${nluResult.intent})`);
    await _save(_ackBugAReply, newContext);
    await adapter.sendResponse(_ackBugAReply);
    return { success: true, response: _ackBugAReply, newContext };
  }

  // === 14b. FIX 3 — SAHTE ONAY GUARD (DEFANSİF, state-koruyan) ===
  // 2026-06-25 inceleme + yeniden yazım (Murat kararı: state-koruyan versiyon):
  //
  // ESKI DAVRANIŞ (64c51841, 2026-05-21): tetiklendiğinde BROWSING reset yapardı —
  // tour + reservationInfo (date/pax/name/phone) + reservationConfirmed HEPSI silinirdi.
  // Yanlış tetiklenirse KATASTROFİK veri kaybı. Tetikleme koşulu (detectConfirmation
  // TRUE + !justCompleted) state-machine ve buradaki çağrı tutarsızlığı gerektiriyor —
  // teoride imkânsız (aynı sync fonksiyon). Canlı log'da `FIX3` hiç görülmedi.
  //
  // YENİ DAVRANIŞ: state KORU + özet+onay tekrar (Bug C pattern :13-PERSIST gibi).
  // Edge case'de bile veri kaybı yok. Kullanıcıya alarmist hata mesajı yerine
  // normal "onaylıyor musunuz?" sorusu gider.
  //
  // Sonraki savunma katmanları zaten LLM uydurma riskini kapsıyor:
  //   - B-6 detectNegativeResponse (CONFIRMING + "hayır" → netleştirme)
  //   - :13-PERSIST (CONFIRMING + ambiguous intent → özet+onay tekrar)
  //   - K4 validateFieldReask (CONFIRMING/COMPLETED'de dolu-alan yutkunması)
  //   - Fix A1 historyCutoffAt (history kirlenmesi)
  // Bu guard ARTIK son katman değil, INSURANCE — gerçekten tetiklenmezse pasif kalır.
  if (
    context.stage === "CONFIRMING" &&
    !justCompleted &&
    detectConfirmation(message, context.language)
  ) {
    console.warn(
      `[process-message] FIX3: detectConfirmation TRUE but FSM didn't complete ` +
      `(newStage=${newContext.stage}). State KORUNUYOR, özet+onay tekrar.`,
    );
    // STATE KORU — yeni değişkenle context'e geri çek (transition farklı yere
    // götürdüyse de eski CONFIRMING bilgileri korunur; reservationInfo silinmez).
    const _preservedContext: ConversationContext = {
      ...context,
      lastUserMessage: message,
      messageCount: context.messageCount + 1,
      lastUpdated: new Date().toISOString(),
    };
    // Özet+onay tekrar — :13-PERSIST ile aynı format (tutarlı görünüm).
    const _lang = _preservedContext.language || "tr";
    const info = (_preservedContext.reservationInfo as any) || {};
    const _tourTitle = _preservedContext.currentTour
      ? getLocalizedTourTitle(_preservedContext.currentTour.title || "", _lang)
      : "";
    const _dateText = info.selectedDate ? formatDateForLanguage(info.selectedDate, _lang) : "";
    const _paxAdult = info.paxAdult ?? "";
    const _paxChild = info.paxChild;
    const _name = info.fullName || "";
    const _phone = info.phone || "";

    const _fix3Labels: Record<string, { tour: string; date: string; pax: string; adult: string; child: string; name: string; phone: string; reask: string }> = {
      tr: { tour: "Tur",     date: "Tarih",   pax: "Kişi sayısı", adult: "yetişkin",    child: "çocuk",   name: "Ad-Soyad", phone: "Telefon",   reask: "Onaylıyor musunuz, yoksa değiştirmek istediğiniz bir şey var mı? ✅" },
      en: { tour: "Tour",    date: "Date",    pax: "People",      adult: "adult",       child: "child",   name: "Name",     phone: "Phone",     reask: "Do you confirm, or is there something you'd like to change? ✅" },
      de: { tour: "Tour",    date: "Datum",   pax: "Personen",    adult: "Erwachsener", child: "Kind",    name: "Name",     phone: "Telefon",   reask: "Bestätigen Sie, oder möchten Sie etwas ändern? ✅" },
      ru: { tour: "Тур",     date: "Дата",    pax: "Человек",     adult: "взрослый",    child: "ребёнок", name: "Имя",      phone: "Телефон",   reask: "Подтверждаете или хотите что-то изменить? ✅" },
      ar: { tour: "الجولة", date: "التاريخ", pax: "عدد الأشخاص", adult: "بالغ",        child: "طفل",     name: "الاسم",    phone: "الهاتف",    reask: "هل تؤكد أم تريد تغيير شيء ما؟ ✅" },
      fr: { tour: "Circuit", date: "Date",    pax: "Personnes",   adult: "adulte",      child: "enfant",  name: "Nom",      phone: "Téléphone", reask: "Confirmez-vous, ou souhaitez-vous changer quelque chose ? ✅" },
      es: { tour: "Tour",    date: "Fecha",   pax: "Personas",    adult: "adulto",      child: "niño",    name: "Nombre",   phone: "Teléfono",  reask: "¿Confirma o desea cambiar algo? ✅" },
    };
    const L = _fix3Labels[_lang] || _fix3Labels.tr;
    const _paxText = _paxAdult !== ""
      ? (typeof _paxChild === "number" && _paxChild > 0
          ? `${_paxAdult} ${L.adult}, ${_paxChild} ${L.child}`
          : `${_paxAdult}`)
      : "";
    // CİLA-2 İŞ3 (2026-07-26): 💰 Toplam — bu re-ask özeti de tek-kaynak _reservationTotalText.
    const _f3Tour = tours.find((t: any) => t.id === (_preservedContext.currentTour?.id || (info as any).tourId));
    const _f3Date = _f3Tour?.dates?.find((d: any) => d.id === (info as any).dateId);
    const _f3TotalText = await _reservationTotalText(
      Number(_paxAdult) || 0, typeof _paxChild === "number" ? _paxChild : 0,
      _f3Date?.price_adult || 0, _f3Date?.price_child,
      _f3Tour?.currency || "TRY", _lang,
      agency.show_multi_currency !== false, languageCurrencies,
    );
    const _summaryLines = [
      _tourTitle ? `📋 ${L.tour}: *${_tourTitle}*` : "",
      _dateText  ? `📅 ${L.date}: ${_dateText}`    : "",
      _paxText   ? `👥 ${L.pax}: ${_paxText}`      : "",
      _name      ? `👤 ${L.name}: ${_name}`        : "",
      _phone     ? `📱 ${L.phone}: ${_phone}`      : "",
      _f3TotalText ? `💰 ${_TOTAL_LABELS[_lang] || _TOTAL_LABELS.en}: *${_f3TotalText}*` : "",
    ].filter(Boolean).join("\n");
    const fix3Reply = `${_summaryLines}\n\n${L.reask}`;
    await _save(fix3Reply, _preservedContext);
    await adapter.sendResponse(fix3Reply);
    return { success: true, response: fix3Reply, newContext: _preservedContext };
  }

  // === FIX1 (2026-07-25): COMPLETED'da TEKRAR-ONAY → completion bloğunu TEKRAR BASMA ===
  // Rezervasyon tamam sonrası müşteri 2. kez "onaylıyorum/onaylyrm" derse LLM tam
  // completion (🎉+ödeme) uydurup validator kaçırabiliyordu → deterministik kısa ack.
  // GATE: COMPLETED + saf-onay (soru/iptal/değişiklik DEĞİL). Teşekkür-reset (Bug-A)
  // detectConfirmation'la çakışmaz (teşekkür ≠ onay-token). justCompleted BU turda false
  // (context zaten COMPLETED) → gerçek tamamlama etkilenmez.
  if (
    context.stage === "COMPLETED" &&
    newContext.stage === "COMPLETED" &&
    !justCompleted &&
    detectConfirmation(message, context.language) &&
    !QUESTION_SIGNAL_RE.test(message) &&
    !_CXL_SIGNAL_RE.test(message) &&
    !CHANGE_KEYWORDS_RE.test(message)
  ) {
    const _reAckMsgs: Record<string, string> = {
      tr: "Rezervasyonunuz zaten onaylı ✅ Başka bir konuda yardımcı olabilir miyim?",
      en: "Your reservation is already confirmed ✅ Is there anything else I can help with?",
      de: "Ihre Reservierung ist bereits bestätigt ✅ Kann ich Ihnen mit etwas anderem helfen?",
      fr: "Votre réservation est déjà confirmée ✅ Puis-je vous aider avec autre chose ?",
      es: "Su reserva ya está confirmada ✅ ¿Puedo ayudarle con algo más?",
      ru: "Ваше бронирование уже подтверждено ✅ Могу ли я помочь с чем-то ещё?",
      ar: "حجزك مؤكد بالفعل ✅ هل يمكنني مساعدتك في شيء آخر؟",
    };
    const _r = _reAckMsgs[newContext.language] || _reAckMsgs.tr;
    console.log(`[process-message] FIX1 COMPLETED tekrar-onay → kısa ack (completion tekrar-basma engellendi)`);
    await _save(_r, newContext);
    await adapter.sendResponse(_r);
    return { success: true, response: _r, newContext };
  }

  // === 15. SYSTEM PROMPT ===
  const currentTourFull = newContext.currentTour ? findTourById(newContext.currentTour.id, tours) : null;
  // BUG 6: AI prompt'una giden reservationInfo'da tur adını hedef dile çevir
  // Bu olmadan CONFIRMING özeti her zaman TR tur adı gösteriyor
  const _promptReservationInfo = newContext.reservationInfo?.tourTitle
    ? {
        ...newContext.reservationInfo,
        tourTitle: getLocalizedTourTitle(newContext.reservationInfo.tourTitle, newContext.language),
      }
    : newContext.reservationInfo;

  const promptContext = {
    stage: newContext.stage,
    collectionStep: newContext.collectionStep,
    currentTour: currentTourFull || newContext.currentTour,
    reservationInfo: _promptReservationInfo,
    availableTours: tours,
    language: newContext.language,
    tone: newContext.tone,
    agencyName: agency.name,
    agencyCity: agency.city,
    agencyAddress: agency.address,
    agencyPhone: agency.phone_public,
    agencyWebsite: agency.website_url,
    agencyWorkingHours: agency.working_hours,
    agencyMapsUrl: agency.maps_url,
    agencyCancellationPolicy: agency.cancellation_policy,
    // 2026-07-03 İş 1 (#18): eski değer (string/text) hiçbir shared prompt
    // bileşeni tarafından BASILMIYORDU (legacy demo-chat helper kalıntısı).
    // Artık buildPaymentPromptSummary üretir (IBAN'sız kapora+yöntem özeti +
    // "detaylar onay sonrası" kuralı) ve agency.ts ACENTE BİLGİSİ bloğu basar.
    // Veri boşsa boş → satır basılmaz → agency guard'ı acenteye yönlendirir.
    paymentInfo: buildPaymentPromptSummary(paymentInstructions, newContext.language) || undefined,
    // F-D1 (2026-07-28): panel "Acente hakkında" → prompt (agency.ts ~300-kırp; boşsa satır yok).
    agencyDescription: (agency as any).description || undefined,
    // F-C1 (2026-07-28): tur-detay fiyat-satırı dual-currency (liste/özet-yollarıyla
    // aynı formatPriceSync zinciri; kur process-içi once-cache, hata → ₺-fallback O2).
    fx: {
      ex: await getExchangeRatesOnce().catch(() => ({})),
      showDual: (agency as any).show_multi_currency !== false,
      languageCurrencies,
    },
    multipleTourMatches: multipleTourMatches.length > 1 ? multipleTourMatches : undefined,
    previousContext,
  };

  let tourSwitchWarning = "";
  if (newContext.stage === "COLLECTING_INFO" && selectedTour && newContext.currentTour &&
      selectedTour.id !== newContext.currentTour.id) {
    tourSwitchWarning = newContext.language === "tr"
      ? `\n\n🚨 KRİTİK: Kullanıcı "${newContext.currentTour.title}" için rezervasyon yapıyor ama "${selectedTour.title}" hakkında bir şey söyledi. Tur değişikliği için onay iste!`
      : `\n\n🚨 CRITICAL: User is booking "${newContext.currentTour.title}" but mentioned "${selectedTour.title}". Ask for confirmation!`;
  }

  // Stage geçiş farkındalığı: yeni rezervasyon, after-sales, bilgi değişikliği
  const completedStagePrompt = buildTransitionPrompt(promptContext as any);

  let returningUserPrompt = "";
  if (returningUserName) {
    returningUserPrompt = newContext.language === "tr"
      ? `\n\n👤 DÖNEN MÜŞTERİ: Adı "${returningUserName}". Sadece selamlarken adıyla hitap et.`
      : `\n\n👤 RETURNING CUSTOMER: Name is "${returningUserName}". Only greet by name.`;
  }

  let antiContradictionPrompt = "";
  if (tours.length > 0 && newContext.stage !== "GREETING") {
    const _titles = tours.slice(0, 5).map((t: any) => t.title).join(", ");
    antiContradictionPrompt = newContext.language === "tr"
      ? `\n\n🔄 TUR TUTARLILIK: Sistemde aktif turlar var (${_titles}). "Tur yok" ya da "tarih bulunamadı" deme.`
      : `\n\n🔄 TOUR CONSISTENCY: Active tours exist (${_titles}). NEVER say "no tours" or "no dates found".`;
  }

  // B1: Akış ortası bilgi sorusu — AI'ya adıma dönüş ipucu
  // T10 FIX: collectionStep tutma şartı KALDIRILDI — sadece stage korunması yeterli.
  // NLU soruyu farklı intent'e maplerse (örn. provide_info→general_question) collectionStep
  // değişebilir; B1 yine de enjekte edilmeli ki AI soruyu cevaplayıp toplanan adıma dönsün.
  // Yeni-rezervasyon (B2) / iptal (justCancelled) / sahte-onay (FIX3) yolları yukarıdaki erken
  // return'lerle zaten yakalanır — buraya düşmez, B1 yanlışlıkla onları yakalamaz.
  let midFlowReturnPrompt = "";
  if (
    (context.stage === "COLLECTING_INFO" || context.stage === "CONFIRMING") &&
    newContext.stage === context.stage
  ) {
    const _stepHints: Record<string, Record<string, string>> = {
      waiting_for_date:  { tr: "tarih seçimini", en: "date selection", de: "Datum", ru: "выбор даты", ar: "اختيار التاريخ", fr: "choix de la date", es: "selección de fecha" },
      waiting_for_pax:   { tr: "kişi sayısını", en: "number of people", de: "Personenzahl", ru: "кол-во человек", ar: "عدد الأشخاص", fr: "nombre de personnes", es: "número de personas" },
      waiting_for_name:  { tr: "adı soyadı", en: "full name", de: "Namen", ru: "полное имя", ar: "الاسم الكامل", fr: "nom complet", es: "nombre completo" },
      waiting_for_phone: { tr: "telefon numarasını", en: "phone number", de: "Telefonnummer", ru: "номер телефона", ar: "رقم الهاتف", fr: "numéro de téléphone", es: "número de teléfono" },
      waiting_for_email: { tr: "email adresini", en: "email address", de: "E-Mail-Adresse", ru: "email", ar: "البريد الإلكتروني", fr: "adresse e-mail", es: "correo electrónico" },
      ready_for_confirmation: { tr: "bilgileri onaylamasını", en: "confirmation of details", de: "Bestätigung", ru: "подтверждение", ar: "التأكيد", fr: "confirmation", es: "confirmación" },
    };
    const _stepHint = newContext.collectionStep && _stepHints[newContext.collectionStep]
      ? (_stepHints[newContext.collectionStep][newContext.language] || _stepHints[newContext.collectionStep].en)
      : null;
    if (_stepHint) {
      midFlowReturnPrompt = newContext.language === "tr"
        ? `\n\n↩️ AKIŞ İPUCU: Soruyu kısa ve net yanıtladıktan sonra MUTLAKA şu adıma dön ve "${_stepHint}" talep et. Toplanan bilgileri UNUTMA.`
        : `\n\n↩️ FLOW HINT: After answering briefly and clearly, ALWAYS return to: request "${_stepHint}". Do NOT forget collected info.`;
    }
  }

  // B3: Off-topic sorularda kısa yanıt direktifi — token israfını önle
  let offTopicBrevityPrompt = "";
  if (
    ["general", "greeting"].includes(_prePromotionIntent) &&
    newContext.stage !== "COMPLETED" &&
    newContext.stage !== "CONFIRMING"
  ) {
    offTopicBrevityPrompt = newContext.language === "tr"
      ? `\n\n⚡ KISA YANIT: Bu mesaj tur/rezervasyon dışı. Maksimum 2 cümle yanıt ver, sonra turlarımıza davet et.`
      : `\n\n⚡ BRIEF REPLY: This message is off-topic. Respond in max 2 sentences, then invite to our tours.`;
  }

  // PROMPT CACHING: prompt'u iki bloğa ayır.
  // - CACHED (gerçek statik prefix): rol/üslup/format/agency/guards/translation directive.
  //   Aynı (agency, language, tone) için her çağrı arası BİT BİT aynı → cache hit.
  // - DYNAMIC (suffix, cache dışı): stage prompt + 6 conditional add-on + multi-tour warning.
  //   Stage prompt eskiden cached prefix'in İÇİNDEYDİ; tourDetails/collectedInfo/summary/
  //   canlı kontenjan her çağrıda değiştiği için cache prefix'i kirletip read=0 yapıyordu.
  //   Şimdi dynamic suffix'in BAŞINA alındı — toplam prompt string'i öncekiyle BİT BİT AYNI,
  //   sadece cached/dynamic blok sınırı kaydı.
  const systemPromptCached = buildSystemPrompt(promptContext as any);
  const _stagePrompt = getStagePrompt(promptContext as any);
  const _multiTourWarning = getMultipleTourWarning(promptContext as any, newContext.language);
  // Sıra ÖNEMLİ: getStagePrompt eskiden buildSystemPrompt'ta `getFormatPrompt` ile
  // `getAgencyInfo` arasında \n\n ile birleşiyordu. Aynı semantiği korumak için stage prompt'u
  // suffix'in en başına, `\n\n` separator ile koyuyoruz. Toplam string SIRASI değişmemiş olur:
  // cached(date+role+tone+format+agency+directives) + "\n\n" + stage + add-on'lar.
  const systemPromptDynamic =
    "\n\n" + _stagePrompt +
    tourSwitchWarning + completedStagePrompt + returningUserPrompt + antiContradictionPrompt +
    midFlowReturnPrompt + offTopicBrevityPrompt + _multiTourWarning;

  // === 16. AI ÇAĞRISI ===
  let reply: string;
  try {
    reply = await callAI({
      systemPromptCached,
      systemPromptDynamic,
      history: historyAsc,
      userMessage: message,
    });
    console.log("[process-message] AI reply:", reply.substring(0, 80));
  } catch (_aiErr) {
    console.error("[process-message] AI call failed:", _aiErr);
    reply = buildAIFallbackResponse(newContext, agency.phone_public || undefined);
    await _save(reply, newContext);
    await adapter.sendResponse(reply);
    return { success: true, response: reply, newContext };
  }

  // === 17. YANIT DOĞRULAMA ===
  const validation = validateAIResponse(reply, newContext.language, newContext.stage);
  if (validation.wasModified) {
    console.warn("[process-message] Response validator modified AI output");
    reply = validation.text;
  }

  // === 17-BV. BOŞ-VAAT GUARD'I (İş 2b, 2026-07-03) ===
  // Canlı: "pamukkale rezervasyon" → LLM "bir saniye, müsait tarihleri kontrol
  // ediyorum..." dedi ve HİÇBİR ŞEY gelmedi (tek-turn sistem — sonra dönemez;
  // iki kez üst üste yaşandı). hallucinationGuard'a kural kondu ama M1
  // kırılganlığına karşı bu deterministik ikinci geçit: cevap SALT VAATSE
  // (yanında tarih/fiyat/liste yoksa — detectEmptyPromise) elimizdeki bağlamla
  // replace et: tur+tarih verisi varsa MİNİ TARİH LİSTESİ, yoksa adım sorusu,
  // o da yoksa acente yönlendirmesi. Vaat+veri birlikte → detectEmptyPromise
  // FALSE → DOKUNULMAZ (meşru cümleler kırılmaz).
  // 2026-07-03 V1-ack: SAHTE-DEĞİŞİKLİK-ACK da aynı geçitte (canlı Vaka 1:
  // LLM "Tarihi 10.12 olarak güncelliyorum ✨" dedi, hiçbir şey güncellenmedi).
  // Gerçek ack'ler deterministik dallardan RETURN'lü — LLM'e ulaşan her
  // "güncelledim" tanım gereği sahtedir (detectFakeChangeAck gerekçesi).
  const _fakeAckMatch = !validation.wasModified ? detectFakeChangeAck(reply) : null;
  if (_fakeAckMatch) {
    console.warn(`[validator] SAHTE-ACK yakalandı: '${_fakeAckMatch}' — gerçek state değişikliği yok (stage=${newContext.stage}, step=${newContext.collectionStep ?? "yok"})`);
  }
  if (!validation.wasModified && (detectEmptyPromise(reply) || _fakeAckMatch)) {
    const _bvLang = newContext.language || "tr";
    const _bvTour = currentTourFull || (newContext.currentTour ? findTourById(newContext.currentTour.id, tours) : null);
    let _bvReplacement = "";
    // V1-ack stage-aware öncelik: CONFIRMING'de sahte-ack → ÖZET+ONAY
    // (tarih listesi değil — kullanıcı onay aşamasında, K1 Katman 3 tonu).
    if (_fakeAckMatch && newContext.stage === "CONFIRMING" && _bvTour) {
      const _sumr = formatReservationSummary(_bvTour, newContext.reservationInfo, _bvLang, newContext.tone as string);
      // 2026-07-09 Faz 5 B: tr+en → 7-dil.
      const _confirmQ: Record<string, string> = {
        tr: "\n\nBilgiler doğru mu? Onaylıyorsanız *evet* yazın ✅",
        en: "\n\nAre these details correct? Reply *yes* to confirm ✅",
        de: "\n\nSind diese Angaben korrekt? Antworten Sie mit *ja* zur Bestätigung ✅",
        fr: "\n\nCes informations sont-elles correctes ? Répondez *oui* pour confirmer ✅",
        es: "\n\n¿Son correctos estos datos? Responda *sí* para confirmar ✅",
        ru: "\n\nВсё верно? Напишите *да* для подтверждения ✅",
        ar: "\n\nهل هذه المعلومات صحيحة؟ اكتب *نعم* للتأكيد ✅",
      };
      _bvReplacement = _sumr + (_confirmQ[_bvLang] || _confirmQ.en);
    } else if (_bvTour?.dates?.length) {
      const _bvLines = _bvTour.dates
        .map((d: any, i: number) => {
          const _w = getWeekdayName(d.departure_date, _bvLang);
          const _dt = formatDateForLanguage(d.departure_date, _bvLang) + (_w ? ` (${_w})` : "");
          const _pr = d.price_adult ? ` - ${d.price_adult}₺` : "";
          return `${i + 1}) ${_dt}${_pr}`;
        })
        .join("\n");
      const _bvTitle = getLocalizedTourTitle(_bvTour.title || "", _bvLang);
      // 2026-07-09 Faz 5 B: tr+en → 7-dil.
      const _bvMsgs: Record<string, string> = {
        tr: `*${_bvTitle}* için müsait tarihler:\n${_bvLines}\n\nHangi tarihi tercih edersiniz?`,
        en: `Available dates for *${_bvTitle}*:\n${_bvLines}\n\nWhich date do you prefer?`,
        de: `Verfügbare Termine für *${_bvTitle}*:\n${_bvLines}\n\nWelches Datum bevorzugen Sie?`,
        fr: `Dates disponibles pour *${_bvTitle}* :\n${_bvLines}\n\nQuelle date préférez-vous ?`,
        es: `Fechas disponibles para *${_bvTitle}*:\n${_bvLines}\n\n¿Qué fecha prefiere?`,
        ru: `Доступные даты для *${_bvTitle}*:\n${_bvLines}\n\nКакую дату предпочитаете?`,
        ar: `التواريخ المتاحة لـ *${_bvTitle}*:\n${_bvLines}\n\nما التاريخ الذي تفضله؟`,
      };
      _bvReplacement = _bvMsgs[_bvLang] || _bvMsgs.en;
    } else if (newContext.collectionStep && STEP_QUESTIONS[String(newContext.collectionStep)]) {
      const _sq = STEP_QUESTIONS[String(newContext.collectionStep)];
      _bvReplacement = _sq[_bvLang] || _sq.en;
    } else {
      const _agP = _agencyPhoneSuffix(agency.phone_public);
      // 2026-07-09 Faz 5 B: tr+en → 7-dil.
      const _bvFall: Record<string, string> = {
        tr: `Bu konuda net bilgi için acentemizle iletişime geçebilirsiniz.${_agP}`,
        en: `Please contact our agency for details on this.${_agP}`,
        de: `Für genaue Informationen hierzu wenden Sie sich bitte an unsere Agentur.${_agP}`,
        fr: `Pour des informations précises à ce sujet, veuillez contacter notre agence.${_agP}`,
        es: `Para información precisa sobre esto, contacte con nuestra agencia.${_agP}`,
        ru: `За точной информацией по этому вопросу обратитесь в наше агентство.${_agP}`,
        ar: `لمعلومات دقيقة حول هذا الموضوع، يرجى التواصل مع وكالتنا.${_agP}`,
      };
      _bvReplacement = _bvFall[_bvLang] || _bvFall.en;
    }
    console.warn(`[process-message] 17-BV boş-vaat yakalandı → deterministik replacement (tour=${!!_bvTour?.dates?.length}, step=${newContext.collectionStep ?? "yok"})`);
    reply = _bvReplacement;
  }

  // === 17a. BUG D — Field-reask post-validation (M1 compliance ikinci geçit) ===
  // Canlı kanıt (exec 4afff98b, 5f003988, ceee9f4d): CONFIRMING/COMPLETED'de
  // telefon/isim/tarih/pax DOLU iken Haiku "telefon numaranızı alabilir miyim?"
  // diye dolu alanı tekrar soruyor. Prompt 3 katman yasak içeriyor (CONFIRMING
  // YASAK listesi + filledFieldsGuard + midFlowReturnPrompt) ama Haiku ihlal
  // ediyor. Deterministik post-LLM düzeltme: CONFIRMING'de TAM ÖZET+onay
  // sorusuyla replace, COMPLETED'de kapanış mesajıyla.
  //
  // ÇİFT-MODIFY GÜVENLİĞİ: validation.wasModified=true ise (sahte-onay yakalanmış)
  // reply zaten REDIRECT_MESSAGES'a değişti — içinde "telefon iste" kalıbı yok,
  // ikinci pattern eşleşmez. Yine de !wasModified guard ile açık şekilde atla.
  if (!validation.wasModified) {
    const reaskCheck = validateFieldReask(
      reply,
      newContext.language,
      newContext.stage,
      newContext.collectionStep,
      newContext.reservationInfo,
      currentTourFull || newContext.currentTour,
      newContext.tone,
      fsmIntent,  // BULGU 2 fix: change_info niyet-farkında skip
      message,
    );
    if (reaskCheck.wasModified) {
      console.warn(`[process-message] Field-reask blocked: ${reaskCheck.matchedPattern}`);
      reply = reaskCheck.text;
    }
  }

  // === 17a-2. KÖK 6 İNCE AYAR — Akış-içi bilgi sorusu → DOĞRU adıma yönlendir ===
  // Canlı (exec 6da00133, 50f02727): KÖK 6 ana fix bilgi sorusunu :11'den
  // atlatıyor → LLM cevap üretiyor ✓ AMA waiting_for_pax'ta (tarih SEÇİLİ iken)
  // LLM yine "Hangi tarihi seçmek istersiniz?" diye yönlendirdi. midFlowReturnPrompt
  // (LLM prompt'una hint) M1 compliance kırılgan — Haiku uymuyor.
  //
  // Deterministik post-LLM suffix: bilgi sorusu intent'i (general_question /
  // support_request) + COLLECTING_INFO + collectionStep ∈ {pax,name,phone,email}
  // → LLM cevabında doğru adım keyword'ü YOKSA bizim deterministik soruyu ekle.
  // Varsa (LLM zaten doğru sormuş) dokunma.
  //
  // İSTİSNALAR:
  //   - waiting_for_date: :11 zaten KÖK 6 ile atlandı; LLM kendi tarih cevabı
  //     verir + tarih listesi sunar (M1 prompt hint'ine bu noktada uyuyor).
  //     Burada dokunma → "tarih yok + bilgi sorusu → cevap + tarih listesi"
  //     mevcut davranışı regresyon olmasın.
  //   - CONFIRMING / ready_for_confirmation: K4 validateFieldReask zaten
  //     özet+onay suffix'i sağlıyor (BUG D fix).
  const _isInfoQuestionForFlowReturn =
    fsmIntent === "general_question" || fsmIntent === "support_request";
  if (
    _isInfoQuestionForFlowReturn &&
    newContext.stage === "COLLECTING_INFO" &&
    newContext.collectionStep &&
    newContext.collectionStep !== "waiting_for_date" &&
    newContext.collectionStep !== "ready_for_confirmation"
  ) {
    const _flowQs: Record<string, Record<string, string>> = {
      waiting_for_pax: {
        tr: "Kaç kişi katılacaksınız?",
        en: "How many people will join?",
        de: "Wie viele Personen nehmen teil?",
        fr: "Combien de personnes participeront?",
        es: "¿Cuántas personas participarán?",
        ru: "Сколько человек будет?",
        ar: "كم عدد الأشخاص الذين سيشاركون؟",
      },
      waiting_for_name: {
        tr: "Ad-soyadınızı alabilir miyim?",
        en: "Could you share your full name?",
        de: "Können Sie mir Ihren vollständigen Namen mitteilen?",
        fr: "Pourriez-vous me donner votre nom complet?",
        es: "¿Podría darme su nombre completo?",
        ru: "Назовите, пожалуйста, ваше полное имя.",
        ar: "هل يمكنني الحصول على اسمك الكامل؟",
      },
      waiting_for_phone: {
        tr: "Telefon numaranızı alabilir miyim?",
        en: "May I have your phone number?",
        de: "Könnten Sie mir Ihre Telefonnummer geben?",
        fr: "Puis-je avoir votre numéro de téléphone?",
        es: "¿Me podría dar su número de teléfono?",
        ru: "Назовите, пожалуйста, ваш номер телефона.",
        ar: "هل يمكنني الحصول على رقم هاتفك؟",
      },
      waiting_for_email: {
        tr: "Email adresinizi alabilir miyim?",
        en: "May I have your email address?",
        de: "Könnten Sie mir Ihre E-Mail-Adresse geben?",
        fr: "Puis-je avoir votre adresse e-mail?",
        es: "¿Me podría dar su correo electrónico?",
        ru: "Назовите, пожалуйста, ваш email.",
        ar: "هل يمكنني الحصول على بريدك الإلكتروني؟",
      },
    };
    // LLM cevabında bu adımın anahtar kelimesi var mı? Varsa zaten doğru sordu.
    const _flowKws: Record<string, RegExp> = {
      waiting_for_pax: /(kaç\s*kişi|kac\s*kisi|kişi\s*say|kisi\s*say|how\s*many|wie\s*viele|combien|cuántas|cuantas|сколько|كم)/i,
      // FIX6 (KÖK-7): çekim-toleranslı — DE "Ihren Namen"/RU "ваше полное имя"/"как вас
      // zovут" bitişiklik-bağımlı desende kaçıyordu → çift isim-sorusu. name[ns]?/имя/фамили/зовут.
      // FIX3 (CİLA 2026-07-25): FAQ-DÖNÜŞ kaçağı — LLM isim-adımında hint'i ("Namen")
      // yok sayıp FİİL-tabanlı sorunca ("Wie heißen Sie?" — "name" kelimesi YOK) regex
      // kaçırıyordu → guard ikinci soruyu ekliyor → çift. RU zaten "зовут" (fiil) kapalıydı;
      // DE hei[sß](en/t/e), FR appel(le/ez/er), ES llama(rse)/cómo se llama, EN "call you" eklendi.
      waiting_for_name: /(ad[\s-]?soyad|isminiz|ad[ıi]n[ıi]z|full\s*name|your\s*name|call\s*you|name[ns]?|nom|nombre|wie\s*hei[sß]|hei[sß]en|appel(le|ez|er)|c[oó]mo\s*se\s*llama|llama(rse|s)?|ваше\s*имя|имя|фамили|зовут|اسم)/iu,
      waiting_for_phone: /(telefon|phone|numaranız|numaraniz|téléphone|teléfono|телефон|هاتف)/i,
      // D1-2 (CİLA-PARİTE-1): fr courriel, es correo eklendi (KÖK-7 simetriği — eksikse
      // FR/ES çift e-posta sorusu). ASCII \b → \p{L}\p{N} lookaround (kural).
      waiting_for_email: /(?<![\p{L}\p{N}])(email|e-?mail|e-?posta|courriel|correo|почт\p{L}*|بريد)(?![\p{L}\p{N}])/iu,
    };
    const _step = newContext.collectionStep;
    const _qsTable = _flowQs[_step];
    const _kw = _flowKws[_step];
    if (_qsTable && _kw && !_kw.test(reply)) {
      const _suffix = _qsTable[newContext.language] || _qsTable.en;
      reply = reply.trimEnd() + "\n\n" + _suffix;
      console.log(`[process-message] KÖK6 ince ayar: ${_step} → akış-döndürme suffix eklendi (lang=${newContext.language})`);
    }
  }

  // === 17b. K4: Injection post-validation — şüpheli cevaplarda fiyat manipülasyonu bloğu ===
  if (_isSuspectedInjection) {
    const _injBlock = validateInjectionResponse(reply, newContext.language);
    if (_injBlock) {
      console.warn("[process-message] K4: Injection post-validation blocked suspicious price/discount claim in AI reply");
      reply = _injBlock;
    }
  }

  // === 18. ÖDEME MESAJI (AI cevabından sonra, daha önce gönderilmediyse) ===
  if (newContext.stage === "COMPLETED" && !newContext.paymentInfoSent && paymentInstructions) {
    const _selDate = newContext.currentTour?.dates?.find((d: any) => d.id === newContext.reservationInfo.dateId);
    const priceAdult = _selDate?.price_adult ?? null;
    const priceChild = _selDate?.price_child ?? null;
    const paxAdult = newContext.reservationInfo.paxAdult || 1;
    const paxChild = newContext.reservationInfo.paxChild || 0;
    // K4: tek kaynak (calculateTotal/Deposit)
    const totalPrice = calculateTotal(paxAdult, priceAdult, paxChild, priceChild);
    // K5: deposit_percentage 0-100 dışındaysa güvenli varsayılan
    const depPct = safeDepositPercentage(
      typeof paymentInstructions === "object" ? (paymentInstructions as any)?.deposit_percentage : null
    );
    const depositAmt = calculateDeposit(totalPrice, depPct);
    const tourCurr = (currentTourFull as any)?.currency || "TRY";
    // O3: NULL/0 fiyat ise ödeme mesajı atlanır
    if (totalPrice <= 0) {
      console.warn("[process-message] O3 (AI-path): skipping payment message — totalPrice=0", {
        paxAdult, paxChild, priceAdult, priceChild,
      });
    }
    if (totalPrice > 0) {
      const payMsg = await generatePaymentMessage(
        paymentInstructions, newContext.language, totalPrice, depositAmt,
        tourCurr, { languageCurrencies, primaryCurrency, agencyPhone: agency.phone_public,
          showMultiCurrency: agency.show_multi_currency !== false }
      );
      if (payMsg) {
        reply = reply + payMsg;
        newContext.paymentInfoSent = true;
      }
    }
  }

  // === 19. KAYDET VE GÖNDER ===
  await _save(reply, newContext);
  await adapter.sendResponse(reply);
  return { success: true, response: reply, newContext };
}
