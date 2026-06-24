// Response validator — AI'nın yetkisiz rezervasyon onayı iddiasını engeller.
//
// Aktif stage'ler (gerçek tehlike): COLLECTING_INFO, CONFIRMING
// Pasif stage'ler (false-positive riski yüksek): GREETING, BROWSING, TOUR_SELECTED, COMPLETED
//
// Mantık: Kullanıcı henüz tur seçmemişse veya bilgi toplamaya başlanmamışsa
// AI "yapıldı" diyemez zaten. Asıl tehlike bilgi toplama ve onay aşamasıdır.

import type { ConversationStage } from "./types.ts";
import { formatReservationSummary } from "./prompts/helpers.ts";

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

// 2026-06-24 BUG D REVİZE-3 (exec 1cb3e5fc, 02ba6dcf kanıt):
// Mevcut pattern "yazar mısınız" arıyordu ama LLM canlıda "yazabilir misiniz"
// üretti — eşleşmedi. Türkçe yardımcı fiil varyantları (yaz/al/ver/söy/payl/öğr/
// gönd/iste + abilir/ar + mı/mi/sın/sınız) çok geniş. Spesifik liste yerine
// kök-bazlı geniş pattern + ortak Türkçe soru eki (mısın/misin/musun/müsün)
// kombinasyonu. Yanlış-pozitif riski: "telefon numaramı yazdım" gibi olumlu
// cümleler → mısın/misin YOK → yakalanmaz.
const FIELD_REASK_PATTERNS: Record<string, { tr: RegExp; en: RegExp }> = {
  phone: {
    // TR: (telefon|numara|cep|gsm) + ≤50 char + (yaz/al/ver/payl/söy/öğr/gönd/iste/paylaş kökü) + soru eki
    tr: /(?<![\p{L}\p{N}])(telefon|telefonunuz|telefonunuzu|telefonu|numara|numaranızı|numaranız|cep|gsm)[\s\S]{0,50}?\b(yaz|al|ver|payl|söy|öğr|gönd|iste|alı?n)[\p{L}\p{N}_]*\s+m(?:[ıiuü]s[ıi]n(?:[ıi]z)?|[ıi]y[ıi]m|[ıi]y[ıi]z)/iu,
    en: /\b(phone|telephone|mobile|number)\b\s+\S{0,50}?\b(please|can\s+(?:you|i)|may\s+i|could\s+you|would\s+you|share|provide|give|tell|send|enter|write|type)/i,
  },
  name: {
    // TR: (isim/ad/soyad çekimli formlar) + ≤50 char + (yaz/al/ver/payl/söy/öğr) + soru eki
    // 2026-06-24: "ad" tek başına ÇIKARILDI (yanlış-pozitif: "Email adresinizi" → "ad"
    // matches edip name yakalıyordu). Sadece tam kelime çekimleri.
    tr: /(?<![\p{L}\p{N}])(isim[\p{L}\p{N}_]*|adınız[ıaeu]?|adın[ıa]?\b|adı\b|soyad[\p{L}\p{N}_]*|adsoyad|ad\s+soyad|ad-soyad)[\s\S]{0,50}?\b(yaz|al|ver|payl|söy|öğr|alı?n)[\p{L}\p{N}_]*\s+m(?:[ıiuü]s[ıi]n(?:[ıi]z)?|[ıi]y[ıi]m|[ıi]y[ıi]z)/iu,
    en: /\b(name|full\s+name|surname|first\s+name|last\s+name)\b\s+\S{0,50}?\b(please|can\s+(?:you|i)|may\s+i|could\s+you|would\s+you|share|provide|give|tell|know)/i,
  },
  date: {
    tr: /(?<![\p{L}\p{N}])(hangi\s+tarih|hangi\s+güne?|tarihte|tarihinizi|tarih)[\s\S]{0,30}?\b(tercih|seç|uygun|belirle|belirti|isteme|isteme)[\p{L}\p{N}_]*\s+m(?:[ıiuü]s[ıi]n(?:[ıi]z)?|[ıi]y[ıi]m|[ıi]y[ıi]z)/iu,
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
 */
export function validateFieldReask(
  text: string,
  language: string,
  stage: ConversationStage,
  collectionStep: string | undefined,
  reservationInfo: any,
  currentTour: any,
  tone: string = "standart",
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

  for (const check of checks) {
    if (!check.isFilled) continue;
    if (check.isWaitingStep) continue;  // çelişkili durum — collectionStep meşru istem diyor, saygı duy
    if (!check.pattern.test(text)) continue;

    // 2026-06-23 BUG D revize (exec 6ef50f7b/35ffb749 — aşırı düzeltme kanıtı):
    // SURGICAL replace — komple-replace değil. LLM cevabını cümlelere böl,
    // pattern eşleşen cümle(ler)i at, kalanı (bilgi cevabı) KORU.
    // Sadece field-reask cümlesinin yerine özet+onay koy.
    //
    // Risk azaltma: cümle çok uzun (>120 char) ise muhtemelen bilgi+yutkunma
    // aynı cümlede → agresif kesme yapma, o cümleyi KORU (LLM kendisi mesajı
    // toparlasın — tam mükemmel değil ama bilgi kaybı yutkunma kaybından kötü).
    const sentences = text.split(/(?<=[.!?])\s+|\n+/);
    const matchedSentenceIdxs: number[] = [];
    const keptSentences: string[] = [];
    sentences.forEach((s, idx) => {
      if (check.pattern.test(s) && s.length <= 120) {
        // Kısa cümle pattern içeriyor → at (yutkunma cümlesi).
        matchedSentenceIdxs.push(idx);
      } else {
        keptSentences.push(s);
      }
    });
    const preservedContent = keptSentences.join(" ").trim();

    console.warn("[response-validator] field-reask blocked", {
      field: check.field,
      stage,
      language,
      collectionStep,
      removedSentenceCount: matchedSentenceIdxs.length,
      preservedLen: preservedContent.length,
      textSnippet: text.slice(0, 120),
    });

    // Replacement seçimi (2026-06-23 REVİZE-2):
    //   COMPLETED → kapanış mesajı (rezervasyon tamamlandı).
    //   diğer (CONFIRMING + COLLECTING_INFO change_info sonrası) → TAM ÖZET + onay
    //   currentTour yoksa REDIRECT_MESSAGES fallback (sade "kontrol edip onaylar mısınız")
    let replacementSuffix: string;
    if (stage === "COMPLETED") {
      replacementSuffix = REDIRECT_MESSAGES_COMPLETED[language] || REDIRECT_MESSAGES_COMPLETED.en;
    } else {
      if (currentTour) {
        const summary = formatReservationSummary(currentTour, reservationInfo, language, tone);
        const suffix = FIELD_REASK_CONFIRM_SUFFIX[lang] || FIELD_REASK_CONFIRM_SUFFIX.en;
        replacementSuffix = summary + suffix;
      } else {
        replacementSuffix = REDIRECT_MESSAGES[language] || REDIRECT_MESSAGES.en;
      }
    }

    // Eğer kalan içerik anlamlı (bilgi cevabı) varsa: [bilgi] \n\n [özet+onay].
    // Yoksa (reply sadece yutkunmadan ibaretti) komple özet+onay (eski davranış).
    const finalText = preservedContent.length > 0
      ? `${preservedContent}\n\n${replacementSuffix}`
      : replacementSuffix;

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
