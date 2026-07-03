// Response validator — AI'nın yetkisiz rezervasyon onayı iddiasını engeller.
//
// Aktif stage'ler (gerçek tehlike): COLLECTING_INFO, CONFIRMING
// Pasif stage'ler (false-positive riski yüksek): GREETING, BROWSING, TOUR_SELECTED, COMPLETED
//
// Mantık: Kullanıcı henüz tur seçmemişse veya bilgi toplamaya başlanmamışsa
// AI "yapıldı" diyemez zaten. Asıl tehlike bilgi toplama ve onay aşamasıdır.

import type { ConversationStage } from "./types.ts";
import { formatReservationSummary } from "./prompts/helpers.ts";
import { STEP_QUESTIONS } from "../constants/step-questions.ts";

// Stage'ler validator çalıştırılacak
// TOUR_SELECTED eklendi: AI'nın "rezervasyonunuz oluşturuldu" demesini bu aşamada da engelle
// FIX: COMPLETED eklendi — rezervasyon tamamlandıktan sonra müşteri "rezervasyonum onaylandı mı?"
// gibi soru sorduğunda AI'nın YENİDEN sahte onay üretmesini engellemek için. Meşru atıf
// vs yeni-onay ayrımı imkansıza yakın olduğundan (Türkçe agglutinative grammar), COMPLETED
// için redirect mesajı bağlama uygun seçilir (REDIRECT_MESSAGES_COMPLETED).
// COMPLETED akışı yan etki: O9 after-sales (process-message:953-985) zaten erken-return
// yapıyor → AI'a hiç gitmiyor → validator çalışmaz. Yeni rezervasyon intent COMPLETED→BROWSING
// transition'ı stage değiştirir → BROWSING ACTIVE_STAGES'te değil → validator çalışmaz.
// Yani COMPLETED'i kapsama dahil etmek mevcut yan davranışları bozmaz.
const ACTIVE_STAGES: ConversationStage[] = ["TOUR_SELECTED", "COLLECTING_INFO", "CONFIRMING", "COMPLETED"];

// ─── TR pattern'leri ──────────────────────────────────────────────────────────
const TR_PATTERNS: RegExp[] = [
  // "rezervasyon/talebiniz/bilgileriniz/kaydınız ... fiil" (geçmiş zaman tamamlanma iddiası)
  /\b(rezervasyon(unuz|u|lar)?|talebiniz(i)?|bilgileriniz(i)?|kayd[ıi]n[ıi]z(ı)?)\s+(ald[ıi]k|al[ıi]nd[ıi]|kaydedildi|olu[şs]turuldu|tamamland[ıi]|i[şs]lendi|haz[ıi]r|yap[ıi]ld[ıi]|onaylan\S*|i[şs]leme\s+al[ıi]nd[ıi])/i,
  // "ön kaydınızı aldık/tamamladık"
  /\b(ön\s*)?kayd[ıi](n[ıi]z[ıi]?)?\s*(ald[ıi]k|aldım|tamamland[ıi]|olu[şs]turuldu|i[şs]lendi)/i,
  // "başarıyla kaydedildi/oluşturuldu"
  /\bba[şs]ar[ıi]yla\s+(kaydedildi|olu[şs]turuldu|tamamland[ıi]|i[şs]lendi|al[ıi]nd[ıi]|yap[ıi]ld[ıi])/i,
  // "ekibimiz/takımımız size ulaşacak/arayacak/dönecek" — fiil zorunlu (sade "ekibimiz size" değil)
  /\b(ekibimiz|tak[ıi]m[ıi]m[ıi]z|m[üu][şs]teri\s+temsilcimiz)\s+(size|sizi|sizinle)\s+\S*(ulaş|aray|d[öo]n|temas)\S*/i,
  // "en kısa sürede/yakında sizi arayacak/ulaşacak" (zaman + eylem kombinasyonu)
  /\b(en\s+k[ıi]sa\s+s[üu]rede|yak[ıi]nda|k[ıi]sa\s+s[üu]re\s+i[çc]inde)\s+(sizi|size)\s+(aray\S*|ula[şs]\S*|d[öo]n\S*)/i,
  // "işleminiz tamamlandı/gerçekleşti"
  /\bi[şs]lem(iniz)?\s+(tamamland[ıi]|ger[çc]ekle[şs]ti|ba[şs]ar[ıi]l[ıi])/i,
  // "ödeme bilgileri/detayları gönderilecek"
  /\b[öo]deme\s+(bilgileri|detaylar[ıi])\s+(g[öo]nderilecek|payla[şs][ıi]lacak|iletilecek)/i,
  // "kaydınız sistemimize işlendi"
  /\bkayd[ıi]n[ıi]z\s+sistem\S*\s+(i[şs]lendi|al[ıi]nd[ıi])/i,
];

// ─── EN pattern'leri ──────────────────────────────────────────────────────────
const EN_PATTERNS: RegExp[] = [
  // "your reservation/booking has been saved/confirmed/..."
  /\b(your\s+)?(reservation|booking|registration|request)\s+(is|was|has\s+been|have\s+been)\s+(saved|created|made|booked|recorded|completed|confirmed|registered|received|processed|taken|noted|logged)/i,
  // "we have received/noted/recorded your ..."
  /\bwe\s+(have\s+)?(received|got|noted|recorded|saved|registered|accepted|processed)\s+(your)/i,
  // "team/staff will contact/call/reach" — verb zorunlu
  /\b(our\s+)?(team|staff|representative|agent)\s+will\s+(contact|reach|call|get\s+in\s+touch|follow\s+up)/i,
  // "successfully saved/created/processed"
  /\bsuccessfully\s+(saved|created|registered|booked|processed|completed|confirmed|recorded)/i,
  // "booking/reservation is confirmed/done"
  /\b(booking|reservation|registration)\s+(is|are)\s+(confirmed|complete|done|processed|finalized|ready)/i,
  // "payment details will be sent"
  /\b(payment|account)\s+(details|information)\s+(will\s+be|are\s+being|has\s+been)\s+(sent|shared|forwarded)/i,
];

// ─── DE/FR/ES/RU/AR tam coverage ─────────────────────────────────────────────
const EXTRA_PATTERNS: RegExp[] = [
  // DE — 6 pattern
  /\b(ihre\s+)?(buchung|reservierung)\s+(wurde|ist|war)\s+(best[äa]tigt|gespeichert|abgeschlossen|erstellt|durchgef[üu]hrt)/i,
  /\b(buchung|reservierung)\s+(erfolgreich|abgeschlossen|gespeichert|erstellt|best[äa]tigt)/i,
  /\bwir\s+haben\s+ihre?\s+(buchung|reservierung|anfrage)\s+(erhalten|best[äa]tigt|bearbeitet)/i,
  /\berfolgreich\s+(gebucht|reserviert|best[äa]tigt|abgeschlossen)/i,
  /\bihre?\s+(reise|tour)\s+(wurde|ist)\s+(best[äa]tigt|gebucht|arrangiert)/i,
  /\bunser\s+team\s+wird\s+sich\s+(bei\s+ihnen\s+)?(melden|kontaktieren)/i,

  // FR — 6 pattern
  /\b(votre\s+)?(r[ée]servation|demande)\s+(a\s+[ée]t[ée]|est)\s+(confirm[ée]e?|enregistr[ée]e?|cr[ée][ée]e?|trait[ée]e?|effectu[ée]e?)/i,
  /\bnous\s+avons\s+(re[cç]u|confirm[ée]|trait[ée])\s+votre\s+(r[ée]servation|demande)/i,
  /\b(avec\s+succ[eè]s|r[ée]ussie?)\s+(r[ée]serv[ée]e?|confirm[ée]e?|trait[ée]e?)/i,
  /\bvotre\s+(voyage|circuit|tour)\s+(a\s+[ée]t[ée]|est)\s+(confirm[ée]e?|r[ée]serv[ée]e?)/i,
  /\bnotre\s+[ée]quipe\s+(va|vous)\s+contacter/i,
  /\bfélicitations.{0,40}(r[ée]servation|voyage|circuit)/i,

  // ES — 6 pattern
  /\b(su\s+)?(reserva|solicitud)\s+(ha\s+sido|fue)\s+(confirmada|registrada|completada|creada|realizada)/i,
  /\bhemos\s+(recibido|confirmado|procesado)\s+su\s+(reserva|solicitud)/i,
  /\b(exitosamente|con\s+[ée]xito)\s+(reservado|confirmado|procesado|completado)/i,
  /\bsu\s+(viaje|tour)\s+(ha\s+sido|fue)\s+(confirmado|reservado|organizado)/i,
  /\bnuestro\s+equipo\s+(se\s+pondr[aá]|le\s+contactar[aá])/i,
  /\bfelicitaciones.{0,40}(reserva|viaje|tour)/i,

  // RU — 6 pattern
  /\b(ваше?\s+)?бронирование?\s+(подтверждено|сохранено|создано|завершено|оформлено)/i,
  /\bмы\s+(получили|подтвердили|обработали)\s+ваш[еу]?\s*(бронирование|заявку|запрос)/i,
  /\b(успешно)\s+(забронировано|подтверждено|обработано|оформлено)/i,
  /\bваш[аея]?\s+(поездка|тур)\s+(подтвержден[оа]?|забронирован[оа]?)/i,
  /\bнаш[аи]?\s+сотрудники?\s+(свяжутся|позвонят|напишут)/i,
  /\bпоздравляем.{0,40}(бронирование|тур|поездка)/i,

  // AR — 6 pattern
  /\b(تم\s+)?(تأكيد|حجز|تسجيل)\s+(طلبك|حجزك|رحلتك)/i,
  /\b(تلقينا|أكدنا|عالجنا)\s+(حجزك|طلبك)/i,
  /\b(بنجاح)\s+(محجوز|مؤكد|معالج|مسجل)/i,
  /\bحجزك\s+(مؤكد|مكتمل|تم|أنجز)/i,
  /\bفريقنا\s+سيتواصل\s+(معك|بك)/i,
  /\bتهانينا.{0,40}(الحجز|الرحلة|الجولة)/i,
];

// ─── K4 Post-validation: injection şüphesi sonrası fiyat manipülasyon tespiti ──
const PRICE_MANIP_PATTERNS: RegExp[] = [
  // TR — indirim/bedava/ücretsiz
  /\b%\s*\d+\s*indirim\b/i,
  /\bindirimli\s+(fiyat|ücret)\b/i,
  /\b(size\s+özel|sadece\s+siz|özel\s+teklif)\s+.{0,20}%(indirim|daha\s+ucuz)/i,
  // 2026-06-21 Yan #8 GÜVENLİK fix: "ücretsiz" başlangıçtaki ü non-ASCII, eski
  // \b boundary çalışmıyordu → LLM "ücretsiz yapabilirim" çıktısı K4 guard'a
  // takılmıyordu. \p{L}\p{N} lookaround ile yakalanır.
  /(?<![\p{L}\p{N}])ücretsiz\s+(yapabilirim|sunabilirim|yapıyorum|veriyorum|yaptım)(?![\p{L}\p{N}])/iu,
  /\bbedavaya?\s+(alabilirim|sunabilirim|yapabilirim|veriyorum)\b/i,
  // EN — discount/free
  /\bgive\s+(you\s+)?(a\s+)?\d+\s*%\s*(off|discount)\b/i,
  /\b(i\s+can|i'll)\s+(make|give|offer)\s+(it|you)\s+(free|at\s+no\s+cost)\b/i,
  /\bspecial\s+(price|discount|offer)\s+of\s+\d+\s*%\b/i,
  /\b\d+\s*%\s*off\s+(for\s+you|today)\b/i,
  // DE
  /\b(gebe\s+ihnen|biete\s+ihnen)\s+\d+\s*%\s*(rabatt|vergünstigung)\b/i,
  /\bkostenlos\s+(für\s+sie|machen)\b/i,
  // FR
  /\bvous\s+offre\s+\d+\s*%\s*de\s+(réduction|remise)\b/i,
  /\bgratuitement\s+pour\s+vous\b/i,
  // ES
  /\ble\s+doy\s+\d+\s*%\s*de\s+descuento\b/i,
  /\bgratis\s+para\s+(usted|ti)\b/i,
  // RU
  /\bдам\s+вам\s+скидку\s+\d+\s*%\b/i,
  /\bбесплатно\s+для\s+вас\b/i,
  // AR
  /\bأعطيك\s+خصم\s+\d+\s*%\b/i,
];

const PRICE_MANIP_SAFE: Record<string, string> = {
  tr: "Fiyatlarımız sistemde tanımlıdır. Güncel fiyat ve kampanyalar için lütfen acentemizle iletişime geçin.",
  en: "Our prices are defined in the system. Please contact our agency for current prices and offers.",
  de: "Unsere Preise sind im System festgelegt. Für aktuelle Preise wenden Sie sich bitte an unsere Agentur.",
  fr: "Nos prix sont définis dans le système. Pour les prix actuels, contactez notre agence.",
  es: "Nuestros precios están definidos en el sistema. Para precios actuales, contacte nuestra agencia.",
  ru: "Наши цены определены системой. Для актуальных цен свяжитесь с нашим агентством.",
  ar: "أسعارنا محددة في النظام. للأسعار الحالية يرجى التواصل مع وكالتنا.",
};

/**
 * K4: Injection şüphesi olan mesajlara karşı AI cevabında fiyat manipülasyonu var mı?
 * Sadece isSuspectedInjection=true olduğunda çağrılır (false-positive riskini azaltır).
 * Tespit edilirse güvenli fallback döner, null dönerse cevap geçerlid.
 */
export function validateInjectionResponse(text: string, language: string): string | null {
  const hasManip = PRICE_MANIP_PATTERNS.some((p) => p.test(text));
  if (!hasManip) return null;
  console.error("K4_PRICE_MANIP_IN_AI_RESPONSE", { language, textSnippet: text.slice(0, 120) });
  return PRICE_MANIP_SAFE[language] || PRICE_MANIP_SAFE.en;
}

// ─── Redirect cümleleri ───────────────────────────────────────────────────────
// Aktif aşamalar (TOUR_SELECTED, COLLECTING_INFO, CONFIRMING) için: "onayla" yönlendirmesi
const REDIRECT_MESSAGES: Record<string, string> = {
  tr: "Lütfen bilgilerinizi kontrol edip onaylar mısınız?",
  en: "Please review your information and confirm to proceed.",
  de: "Bitte überprüfen Sie Ihre Angaben und bestätigen Sie.",
  fr: "Veuillez vérifier vos informations et confirmer.",
  es: "Por favor revise su información y confirme.",
  ru: "Пожалуйста, проверьте ваши данные и подтвердите.",
  ar: "يرجى مراجعة بياناتك والتأكيد.",
};

// COMPLETED için ayrı: mevcut rezervasyonu netleştir + yeni-onay sızıntısı engelle.
// "Onayla" demek yerine "zaten tamamlandı" diyerek müşteriyi rahatlatır ve AI'nın
// uydurma yeni onay metnini güvenli bir bağlam mesajıyla değiştirir.
const REDIRECT_MESSAGES_COMPLETED: Record<string, string> = {
  tr: "Rezervasyonunuz zaten tamamlandı ✅ Başka bir konuda yardımcı olabilir miyim?",
  en: "Your reservation is already complete ✅ Is there anything else I can help with?",
  de: "Ihre Reservierung ist bereits abgeschlossen ✅ Kann ich Ihnen mit etwas anderem helfen?",
  fr: "Votre réservation est déjà complète ✅ Puis-je vous aider avec autre chose ?",
  es: "Su reserva ya está completa ✅ ¿Puedo ayudarle con algo más?",
  ru: "Ваше бронирование уже подтверждено ✅ Могу ли я помочь с чем-то ещё?",
  ar: "حجزك مكتمل بالفعل ✅ هل يمكنني مساعدتك في شيء آخر؟",
};

function getAllPatterns(language: string): RegExp[] {
  if (language === "tr") return [...TR_PATTERNS, ...EXTRA_PATTERNS];
  return [...EN_PATTERNS, ...EXTRA_PATTERNS];
}

function matchesAnyPattern(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    if (p.test(text)) return p.source;
  }
  return null;
}

export interface ValidationResult {
  text: string;
  wasModified: boolean;
  matchedPattern: string | null;
}

// ─── 2026-06-23 BUG D — field-reask post-validation (M1 ailesi) ────────────
//
// CANLI BUG (4 exec kanıtı: 4afff98b, 5f003988, ceee9f4d, bade7c70):
//   Tüm alanlar ZATEN DOLU iken Haiku "telefon numaranızı alabilir miyim?"
//   diye dolu alanı tekrar soruyor. Prompt 3 katman yasak içeriyor (CONFIRMING
//   stage prompt YASAK listesi + filledFieldsGuard "phone: 05551234567 —
//   TEKRAR SORMA" anchor + midFlowReturnPrompt "onaya dön" ipucu) ama Haiku
//   ihlal ediyor. Klasik M1 LLM compliance kırılganlığı — prompt doygunluğa ulaştı.
//
// FIX: deterministik post-LLM düzeltme. LLM cevabında 4 alan-bazlı "tekrar
// iste" pattern'i yakalanırsa + alan DOLU + meşru bekleme adımında DEĞİL
// → CONFIRMING/COLLECTING_INFO'da TAM ÖZET + onay sorusuyla değiştir,
// COMPLETED'de kapanış mesajıyla değiştir.
//
// YANLIŞ-POZİTİF ÖNLEME (REVİZE-2 exec bade7c70 sonrası — stage→collectionStep):
//   - Alan-bazlı guard: field DOLU iken yakala, EKSİK iken pas geç.
//   - collectionStep guard: o alanın meşru bekleme adımındaysa pas geç
//     (örn. waiting_for_phone'da telefon iste meşru — alan boş olur zaten,
//     çift emniyet).
//   - Stage filtresi KALDIRILDI (eski sürümde SADECE CONFIRMING+COMPLETED idi):
//     "aslında adım Osman" gibi change_info sonrası transition stage'i
//     COLLECTING_INFO'ya düşürse bile validator devreye girer. Stage'in
//     anlamı yutkunma için belirleyici değil; ALAN + ADIM yeterli.
//
// CHANGE_INFO SONRASI EDGE: kullanıcı CONFIRMING'de "aslında ismi değiştir"
// derse state-machine COLLECTING_INFO/ready_for_confirmation'a düşer (tüm
// alanlar dolu, mevcut Bug B fix override yaptı). LLM yine "telefon iste"
// derse → stage COLLECTING_INFO + collectionStep ready_for_confirmation
// + phone dolu → YAKALA. Eski stage filtresinde bu kenar kaçıyordu.
//
// ÇOK-DİL: TR + EN tam pattern; diğer 5 dil (DE/FR/ES/RU/AR) ŞİMDİLİK
// EN fallback (çok-dil eşitleme açık liste — post-launch genişletme).

const FIELD_REASK_PATTERNS: Record<string, { tr: RegExp; en: RegExp }> = {
  phone: {
    // TR: "telefon/numara/cep" + (kısa boşluk) + (alabilir miyim/verir misiniz/...)
    // \p{L}\p{N} lookaround Yan #8 pattern'i (ı/ş bitişli kelimeler için ASCII \b yetersiz)
    tr: /(?<![\p{L}\p{N}])(telefon|telefonunuz|telefonunuzu|telefonu|numara|numaranızı|numaranız|cep|gsm)\s+\S{0,40}?(alabilir miyim|verir misiniz|paylaşır mısınız|söyler misiniz|alayım|öğrenebilir miyim|gönderir misiniz|yazar mısınız|verin|verebilir misiniz)/iu,
    en: /\b(phone|telephone|mobile|number)\b\s+\S{0,40}?\b(please|can\s+(?:you|i)|may\s+i|could\s+you|share|provide|give|tell|send)/i,
  },
  name: {
    tr: /(?<![\p{L}\p{N}])(isim|isminizi|isminiz|ad|adınızı|adınız|soyad|soyadınızı|soyadınız|adsoyad|ad\s*soyad)\s+\S{0,40}?(alabilir miyim|verir misiniz|söyler misiniz|paylaşır mısınız|öğrenebilir miyim|yazar mısınız|alayım)(?![\p{L}\p{N}])/iu,
    en: /\b(name|full\s+name|surname|first\s+name|last\s+name)\b\s+\S{0,40}?\b(please|can\s+(?:you|i)|may\s+i|could\s+you|share|provide|give|tell|know)/i,
  },
  date: {
    tr: /(?<![\p{L}\p{N}])(hangi\s+tarih|hangi\s+güne?|tarihte|tarihinizi|tarih.{0,20}?(?:tercih|seçer|uygun|belirleyin|belirtir))(?![\p{L}\p{N}])/iu,
    en: /\b(which|what)\s+date\b|\b(prefer|select|choose)\s+(?:a\s+)?date\b|\bdate\s+(?:please|works)/i,
  },
  pax: {
    tr: /(?<![\p{L}\p{N}])(kaç\s+kişi|kişi\s+sayısı|kaç\s+kişilik|kaç\s+yetişkin|kaç\s+çocuk|katılacak|kişi\s+olacak)(?![\p{L}\p{N}])/iu,
    en: /\b(how\s+many|number\s+of)\s+(?:people|persons?|adults?|guests?|attendees|kids?|children)/i,
  },
};

const FIELD_REASK_CONFIRM_SUFFIX: Record<string, string> = {
  tr: "\n\nBu bilgiler doğru mu, onaylıyor musunuz? ✅",
  en: "\n\nAre these details correct, do you confirm? ✅",
};

// 2026-06-25 BULGU 2 fix: change_info bağlamında userMessage'da hangi ALANIN
// değiştirilmek istendiğini saptamak için pattern'ler (7 dil). Bot "yeni X?"
// sorusunu meşru olarak üretirse o ÖZEL field için blok skip.
//
// SKIP koşulu (per-field): intent === "change_info"
//                          AND userMessage MENTION_PATTERNS[field] match
// Başka field için yutkunma (örn. change_info "ismi" + LLM "telefon iste") →
// SKIP YOK, BUG D guard'ı normal çalışır.
const FIELD_MENTION_PATTERNS: Record<string, RegExp> = {
  // İsim/ad — TR çekim ekleri serbest (ismi, isminizi, adımı, adınızı, soyadı)
  // EN+DE+FR+ES+RU+AR yaygın kelimeler
  name: /(?<![\p{L}\p{N}])(isim|ismi|isimle|isminiz|isminizi|ad|adı|adın|adım|adın|adınız|adınızı|soyad|soyadı|soyadın|soyadım|adsoyad|ad\s*soyad|name|namen|surname|nom|nombre|имя|اسم)/iu,
  phone: /(?<![\p{L}\p{N}])(telefon|telefonu|telefonum|telefonumu|telefonunu|numara|numaramı|numaranız|numaranızı|cep|gsm|phone|telephone|number|mobile|téléphone|teléfono|телефон|номер|هاتف|رقم)/iu,
  date: /(?<![\p{L}\p{N}])(tarih|tarihi|tarihimi|tarihinizi|gün|günü|date|day|datum|tag|jour|día|fecha|дата|день|تاريخ|يوم)/iu,
  pax: /(?<![\p{L}\p{N}])(ki[şs]i|ki[şs]i\s*say|ki[şs]i\s*adet|yeti[şs]kin|[çc]ocuk|pax|kaç\s*ki[şs]i|kaç\s*yeti[şs]kin|kaç\s*[çc]ocuk|people|person|adult|child|guests|attendees|kids|children|wie\s*viele|personen|kinder|combien|personnes|enfants|cuántas|personas|niños|сколько|человек|أشخاص|أطفال)/iu,
};

/**
 * BUG D fix: dolu-alan re-ask post-validation.
 *
 * @param text             LLM cevabı
 * @param language         Kullanıcı dili
 * @param stage            CONFIRMING/COMPLETED dışı stage'ler atlanır
 * @param _collectionStep  Sadece log için (guard zaten stage + filledFields)
 * @param reservationInfo  Dolu alan kontrolü için (phone/fullName/dateId/paxAdult)
 * @param currentTour      CONFIRMING özet regenerate için (yoksa REDIRECT_MESSAGES fallback)
 * @param tone             formatReservationSummary parametresi
 * @param intent           FSM intent — change_info iken niyet-aware skip (Bulgu 2 fix)
 * @param userMessage      Kullanıcının mesajı — hangi alanı değiştirmek istediğini saptamak için
 */
/**
 * 2026-07-03 İş 2b: BOŞ-VAAT tespiti. Canlı vaka: "pamukkale rezervasyon" →
 * LLM "bir saniye, müsait tarihleri kontrol ediyorum..." dedi ve HİÇBİR ŞEY
 * gelmedi (tek-turn sistem — sonra dönemez). İki katmanın ikincisi (birincisi
 * hallucinationGuard prompt kuralı; M1 kırılganlığına karşı bu post-LLM sigorta).
 *
 * TRUE koşulu: vaat kalıbı VAR + cevapta SOMUT VERİ YOK (rakamlı tarih, fiyat,
 * numaralı liste). Vaat + veri birlikteyse FALSE — meşru "şöyle görünüyor,
 * kontrol ettim" tarzı cümleler KIRILMAZ. Replacement'ı process-message üretir
 * (elinde tur/tarih verisi var — validator'da yok).
 */
const EMPTY_PROMISE_RE =
  /(kontrol\s+ediyorum|hemen\s+bak[ıi]yorum|bak[ıi]yorum|bir\s+saniye|bir\s+dakika|hemen\s+bakay[ıi]m|kontrol\s+edeyim|let\s+me\s+check|one\s+moment|just\s+a\s+(?:second|moment)|checking\s+(?:now|for\s+you)|i['']ll\s+(?:check|look))/i;
const CONCRETE_DATA_RE =
  /\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}|\d+\s*(?:₺|TL|EUR|USD|\$|€)|^\s*\d+\)\s/m;
export function detectEmptyPromise(text: string): boolean {
  if (!text) return false;
  return EMPTY_PROMISE_RE.test(text) && !CONCRETE_DATA_RE.test(text);
}

export function validateFieldReask(
  text: string,
  language: string,
  stage: ConversationStage,
  collectionStep: string | undefined,
  reservationInfo: any,
  currentTour: any,
  tone: string = "standart",
  intent?: string,
  userMessage?: string,
): ValidationResult {
  // 2026-06-23 BUG D REVİZE-2 (exec bade7c70 kanıt): stage filtresi YANLIŞ
  // sınırdı. "aslında adım Osman" sonrası change_info → COLLECTING_INFO
  // transition tetiklendi (stage CONFIRMING'den COLLECTING_INFO'ya düştü) AMA
  // tüm alanlar dolu kaldı (collectionStep=ready_for_confirmation). LLM yine
  // de "telefon iste" yutkunmasını yaptı, stage guard COLLECTING_INFO'da
  // devreye girmediği için validator yakalamadı.
  //
  // YENİ GUARD: stage-bağımsız, ALAN-bazlı.
  //   yakala = field_DOLU AND collectionStep !== waiting_for_X AND pattern
  //
  // Meşru durum (alan BOŞ + waiting_for_X + LLM o alanı istiyor) field_DOLU=false
  // koşulu ile zaten atlanır. Yeni edge case (alan DOLU ama collectionStep
  // yine de o alanı bekliyor — state-machine çelişkisi) isWaitingStep guard'ı
  // ile saygıyla atlanır.
  //
  // GREETING/TOUR_SELECTED gibi erken stage'lerde alanlar boş, collectionStep
  // undefined → field_DOLU=false → yakalanmaz. Stage filtresine gerek yok.
  if (!reservationInfo) {
    return { text, wasModified: false, matchedPattern: null };
  }

  // Dil-bazlı pattern seçimi. TR + EN tam; diğer 5 dil EN fallback (çok-dil eşitleme açık liste).
  const lang = language === "tr" ? "tr" : "en";

  const checks: Array<{ field: string; pattern: RegExp; isFilled: boolean; isWaitingStep: boolean }> = [
    { field: "phone", pattern: FIELD_REASK_PATTERNS.phone[lang],
      isFilled: !!reservationInfo.phone,
      isWaitingStep: collectionStep === "waiting_for_phone" },
    { field: "name",  pattern: FIELD_REASK_PATTERNS.name[lang],
      isFilled: !!reservationInfo.fullName,
      isWaitingStep: collectionStep === "waiting_for_name" },
    { field: "date",  pattern: FIELD_REASK_PATTERNS.date[lang],
      isFilled: !!(reservationInfo.dateId || reservationInfo.selectedDate),
      isWaitingStep: collectionStep === "waiting_for_date" },
    { field: "pax",   pattern: FIELD_REASK_PATTERNS.pax[lang],
      isFilled: !!reservationInfo.paxAdult,
      isWaitingStep: collectionStep === "waiting_for_pax" },
  ];

  // 2026-06-25 BULGU 2 fix — niyet-farkında skip (Seçenek B).
  // Canlı (exec 41e48784): kullanıcı CONFIRMING'de "ismi değiştirmek istiyorum"
  // → intent=change_info → bot "yeni isminizi söyler misiniz?" üretti (DOĞRU!)
  // → AMA guard "name dolu + pattern eşleşti" diye SİLDİ. Kullanıcı niyeti
  // ihmal edilmişti.
  //
  // SKIP koşulu (per-field):
  //   intent === "change_info"
  //   AND userMessage'da o ALANIN adı geçiyor (FIELD_MENTION_PATTERNS[field])
  //
  // Başka field için yutkunma korunur: change_info "ismi" + LLM alakasız
  // "telefon iste" yutkunması → phone field için SKIP YOK (userMessage'da
  // "telefon" yok) → BUG D guard çalışır.
  const _isChangeInfo = intent === "change_info";
  const _msg = userMessage || "";

  // 2026-06-27 changeAck guard: bot cevabı "güncelledim/değiştirdim/updated/..." gibi
  // başarılı değişiklik bildirimi içeriyorsa (Murat canlı testleri D/B/A): pax/date
  // değişimi sonrası "Kişi sayını güncelledim + telefon iste" gibi MEŞRU mesajlar
  // validator tarafından SİLİNİYORDU (preservedContent at → tüm text deterministik
  // özet'le değiştirildi → kullanıcı "güncelledim" bildirimini kaybediyordu).
  // Çözüm: değişiklik bildirimi pattern eşleşirse 4 field check'i de skip.
  // change_info skip ile paralel mekanizma (bu BOT cevabına bakar, change_info
  // KULLANICI mesajına bakar). Kuru yutkunma (güncelledim YOK) için pattern
  // FALSE → blok devam (M1 koruması korunur).
  const _changeAckRe = /(?<![\p{L}\p{N}])(g[üu]ncel(?:ledim|liyorum|lendi|ledik|liyoruz)|de[ğg]i[şs](?:tirdim|ti|tiriyorum|tirildi|tirildim|tiriyoruz)|updated|changed|modified|aktualisiert|ge[äa]ndert|mis\s+à\s+jour|chang[ée]e?s?|modifi[ée]e?s?|actualiz(?:ado|amos|ada)|cambi(?:ado|amos|ada)|modific(?:ado|amos|ada)|обнов(?:ил|ила|или|лён|лен)|измен(?:ил|ила|или|ён)|تم\s*التحديث|تم\s*التغيير|غيّرت)(?![\p{L}\p{N}])/iu;
  const _hasChangeAck = _changeAckRe.test(text);

  for (const check of checks) {
    if (!check.isFilled) continue;
    if (check.isWaitingStep) continue;  // çelişkili durum — collectionStep meşru istem diyor, saygı duy
    // 2026-06-27 changeAck guard: bot mesajı değişiklik bildirimi içeriyorsa skip
    if (_hasChangeAck) {
      console.info("[validator] changeAck skip: field=" + check.field);
      continue;
    }
    // BULGU 2 fix: change_info + userMessage o alanı söylüyor → BLOK skip
    if (_isChangeInfo) {
      const _mention = FIELD_MENTION_PATTERNS[check.field];
      if (_mention && _mention.test(_msg)) {
        console.info("[response-validator] field-reask skipped (intent=change_info + userMessage mentions field)", {
          field: check.field,
          intent,
          msgSnippet: _msg.slice(0, 80),
        });
        continue;
      }
    }
    if (!check.pattern.test(text)) continue;

    // 2026-06-25 YENİ-2 FIX (canlı kanıt — telefon değişimi sonrası ÇİFT tarih):
    // Eski "SURGICAL replace" yaklaşımı (preservedContent + replacementSuffix
    // yan yana) Haiku'nun ESKİ-tarihli özet artığını "bilgi cevabı" sanıp
    // koruyordu → deterministik yeni özet ile yan yana çift özet (eski + yeni)
    // + çift "onaylıyor musunuz?" → kafa karıştırıcı görsel.
    //
    // YENİ DAVRANIŞ: field-reask tetiklendiğinde preservedContent'i AT, sadece
    // deterministik replacementSuffix (formatReservationSummary, state'ten doğru)
    // göster → tek temiz özet, tek onay sorusu.
    //
    // RİSK: LLM gerçek bilgi cevabı + yutkunma karışık üretmişse bilgi cevabı
    // kaybedilir. AMA field-reask doğası gereği "LLM dolu alanı sebepsiz sordu"
    // anı — LLM çoğunlukla kendi özet artığı + yutkunma üretir, gerçek bilgi
    // cevabı vermez. Pratik kayıp düşük; ESKİ tarih artığı kalmasındansa
    // muhtemel bilgi cevabı kaybı daha iyi.
    //
    // Çift güvenlik: kısa eşleşen cümle var mı? Eğer pattern SADECE uzun cümlede
    // (>120 char, muhtemelen bilgi+yutkunma karışık) eşleşmişse → BLOK YAPMA,
    // LLM cevabını olduğu gibi geç. Bu D.B.16 çift güvenliği (bilgi kaybı yutkunma
    // kaybından kötü).
    const _matchedCount = text.split(/(?<=[.!?])\s+|\n+/).filter((s) => check.pattern.test(s) && s.length <= 120).length;
    if (_matchedCount === 0) continue;  // pattern sadece uzun cümlede → çift güvenlik

    console.warn("[response-validator] field-reask blocked", {
      field: check.field,
      stage,
      language,
      collectionStep,
      removedSentenceCount: _matchedCount,
      textSnippet: text.slice(0, 120),
    });

    // Replacement seçimi (2026-06-23 REVİZE-2 + 2026-07-03 P7 STAGE-AWARE):
    //   COMPLETED → kapanış mesajı (rezervasyon tamamlandı).
    //   CONFIRMING → TAM ÖZET + onay (mevcut davranış AYNEN korunur).
    //   COLLECTING_INFO (ara adım) → P7 FIX: ÖZET+ONAY DİLİ YOK — canlı bug:
    //     waiting_for_name'de FAQ sorusu → replacement "kontrol edip onaylar
    //     mısınız? Ad-soyadınızı alabilir miyim?" basıyordu, ortada özet yokken
    //     ONAY istendi. Artık sadece mevcut adımın sorusu (STEP_QUESTIONS,
    //     process-message :11b/:11c ile aynı ton, tek-kaynak sabit).
    //   currentTour yoksa REDIRECT_MESSAGES fallback.
    let replacementSuffix: string;
    if (stage === "COMPLETED") {
      replacementSuffix = REDIRECT_MESSAGES_COMPLETED[language] || REDIRECT_MESSAGES_COMPLETED.en;
    } else if (
      stage === "COLLECTING_INFO" &&
      collectionStep &&
      STEP_QUESTIONS[collectionStep]
    ) {
      replacementSuffix =
        STEP_QUESTIONS[collectionStep][language] || STEP_QUESTIONS[collectionStep].en;
    } else {
      if (currentTour) {
        const summary = formatReservationSummary(currentTour, reservationInfo, language, tone);
        const suffix = FIELD_REASK_CONFIRM_SUFFIX[lang] || FIELD_REASK_CONFIRM_SUFFIX.en;
        replacementSuffix = summary + suffix;
      } else {
        replacementSuffix = REDIRECT_MESSAGES[language] || REDIRECT_MESSAGES.en;
      }
    }

    // 2026-06-28 FAQ FIX (Murat canlı kanıt): FAQ intent'inde (general_question /
    // support_request) Haiku FAQ cevabı + yanlış dolu-alan reask üretirse, mevcut
    // "tüm reply → özet+onay" davranışı FAQ cevabını SİLİYORDU. Bu fix:
    // FAQ intent'inde SADECE eşleşen reask cümlesini çıkar, FAQ cevabını KORU.
    // KÖK6 (process-message.ts L3393) doğru tek suffix'i alta ekleyecek → çift soru YOK.
    //
    // Soru-kalıbı guard (?, mısınız, alabilir mi, can you, may i, ...): reask pattern
    // FAQ cevabının masum BİLGİ cümlesine takılırsa silmesin — sadece gerçek
    // REASK sorusunu (soru-kalıbı içeren) sil. Örn:
    //   "5 kişiden fazla katılacak gruplar dahildir."  → pax pattern eşleşir AMA
    //     soru-kalıbı yok → KORUNUR (masum bilgi)
    //   "Kaç kişi katılacak?"                          → pax pattern eşleşir + ? →
    //     SİLİNİR (gerçek reask)
    //
    // Fallback: preserved boş kalırsa (FAQ yoktu, sadece reask vardı) eski
    // davranışa dön → boş mesaj kullanıcıya gitmez.
    //
    // YENİ-2 fix (FAQ DIŞI): preservedContent ATILDI. replacementSuffix tek başına
    // yeterli — tam state özet+onay'ı içerir. LLM özet artığı eski state yansıtabilir
    // (ÇİFT tarih sorunu kökü), atmak temiz özet sağlar.
    let finalText: string;
    const _isFaqIntent = intent === "general_question" || intent === "support_request";
    if (_isFaqIntent) {
      const _questionLikeRe = /[?？؟]|m[ıiuü]s[ıiuü]n[ıiuü]z\b|alabilir\s+mi|verir\s+mi|söyler\s+mi|paylaşır\s+m[ıi]|öğrenebilir\s+mi|söyleyebilir\s+mi|verebilir\s+mi|gönderir\s+mi|yazar\s+mı|can\s+(?:you|i)|may\s+i|could\s+(?:you|i)|would\s+you|please\s+(?:give|tell|share|provide)/iu;
      const _sentences = text.split(/(?<=[.!?])\s+|\n+/);
      const _preserved = _sentences
        .filter((s) => {
          const _trim = s.trim();
          if (!_trim) return false;
          // Cümleyi SİL: reask pattern + ≤120 char + soru-kalıbı (üç şart birden)
          const _isReask = check.pattern.test(s) && s.length <= 120 && _questionLikeRe.test(s);
          return !_isReask;
        })
        .join("\n")
        .trim();
      if (_preserved.length === 0) {
        // FAQ cevabı yoktu, sadece reask vardı → eski davranışa dön (boş mesaj atma)
        finalText = replacementSuffix;
      } else if (stage === "CONFIRMING") {
        // CONFIRMING'de onay sorusu KORUNMALI (KÖK6 burada tetiklenmez)
        const _confirm = FIELD_REASK_CONFIRM_SUFFIX[lang] || FIELD_REASK_CONFIRM_SUFFIX.en;
        finalText = _preserved + "\n\n" + _confirm.trim();
      } else {
        // COLLECTING_INFO'da KÖK6 doğru adımın suffix'ini alta ekleyecek
        finalText = _preserved;
      }
      console.info("[response-validator] field-reask FAQ cümle-çıkarma", {
        field: check.field,
        preservedLength: _preserved.length,
        fallback: _preserved.length === 0,
        stage,
      });
    } else {
      finalText = replacementSuffix;
    }

    return {
      text: finalText,
      wasModified: true,
      matchedPattern: `field-reask:${check.field}`,
    };
  }

  return { text, wasModified: false, matchedPattern: null };
}

export function validateAIResponse(
  text: string,
  language: string,
  stage: ConversationStage,
): ValidationResult {
  // Sadece COLLECTING_INFO ve CONFIRMING'de çalış.
  // Diğer stage'lerde false-positive riski yüksek, tehlike de düşük.
  if (!ACTIVE_STAGES.includes(stage)) {
    return { text, wasModified: false, matchedPattern: null };
  }

  const patterns = getAllPatterns(language);
  const matched = matchesAnyPattern(text, patterns);

  if (!matched) {
    return { text, wasModified: false, matchedPattern: null };
  }

  console.error("AI_FALSE_RESERVATION_CLAIM", {
    stage,
    language,
    matchedPattern: matched,
    originalLength: text.length,
  });

  // FIX: stage'e göre redirect mesajı. Aktif aşamalarda "onayla" yönlendirmesi,
  // COMPLETED'de "zaten tamamlandı, başka bir şey?" — meşru atıf gibi görünen
  // ama AI tarafından üretilmesi riskli olan yeni-onay sızıntısını yumuşatır.
  const redirect = stage === "COMPLETED"
    ? (REDIRECT_MESSAGES_COMPLETED[language] || REDIRECT_MESSAGES_COMPLETED.en)
    : (REDIRECT_MESSAGES[language] || REDIRECT_MESSAGES.en);
  return { text: redirect, wasModified: true, matchedPattern: matched };
}
