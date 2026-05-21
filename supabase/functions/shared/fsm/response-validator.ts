// Response validator — AI'nın yetkisiz rezervasyon onayı iddiasını engeller.
//
// Aktif stage'ler (gerçek tehlike): COLLECTING_INFO, CONFIRMING
// Pasif stage'ler (false-positive riski yüksek): GREETING, BROWSING, TOUR_SELECTED, COMPLETED
//
// Mantık: Kullanıcı henüz tur seçmemişse veya bilgi toplamaya başlanmamışsa
// AI "yapıldı" diyemez zaten. Asıl tehlike bilgi toplama ve onay aşamasıdır.

import type { ConversationStage } from "./types.ts";

// Stage'ler validator çalıştırılacak
// TOUR_SELECTED eklendi: AI'nın "rezervasyonunuz oluşturuldu" demesini bu aşamada da engelle
const ACTIVE_STAGES: ConversationStage[] = ["TOUR_SELECTED", "COLLECTING_INFO", "CONFIRMING"];

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
  /\bücretsiz\s+(yapabilirim|sunabilirim|yapıyorum|veriyorum|yaptım)\b/i,
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
const REDIRECT_MESSAGES: Record<string, string> = {
  tr: "Lütfen bilgilerinizi kontrol edip onaylar mısınız?",
  en: "Please review your information and confirm to proceed.",
  de: "Bitte überprüfen Sie Ihre Angaben und bestätigen Sie.",
  fr: "Veuillez vérifier vos informations et confirmer.",
  es: "Por favor revise su información y confirme.",
  ru: "Пожалуйста, проверьте ваши данные и подтвердите.",
  ar: "يرجى مراجعة بياناتك والتأكيد.",
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

  const redirect = REDIRECT_MESSAGES[language] || REDIRECT_MESSAGES.en;
  return { text: redirect, wasModified: true, matchedPattern: matched };
}
