// Shared FSM state machine logic
import type {
  ConversationContext,
  ConversationStage,
  ConversationTone,
  StateTransition,
  ProcessingInput,
  InfoCollectionStep,
  ReservationInfo,
} from "./types.ts";
import { produceTourChangeContext, hasReservationSignal } from "../services/tour-change.ts";
import { isValidPax, isValidPhone } from "../utils/validation.ts";
import { CHANGE_KEYWORDS_RE } from "../constants/change-detection.ts";
import { CONFIRM_POSITIVE, CONFIRM_NEGATIVE, CLEAR_POSITIVE_RE } from "../constants/confirmation-words.ts";

export function createInitialContext(
  language: string = "tr",
  tone: ConversationTone = "standart",
): ConversationContext {
  return {
    stage: "GREETING",
    currentTour: null,
    viewedTours: [],
    reservationInfo: {},
    reservationConfirmed: false,
    paymentInfoSent: false,
    language,
    tone,
    messageCount: 0,
    lastUserMessage: "",
    sessionStarted: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    isNewReservation: false,
  };
}

function isInformationalMessage(userMessage: string, detectedIntent: string): boolean {
  const informationalIntents = [
    "general",
    "general_question",
    "faq_general",
    "tour_search",
    "greeting",
    "agency_info",
    "working_hours",
    "payment_methods",
    "cancellation_policy",
    "visa_support",
    "hotel_details",
    "transport_details",
  ];
  if (informationalIntents.includes(detectedIntent)) return true;

  const questionWords =
    /ne zaman|kaç|nedir|nereden|nasıl|hangi|var mı|kaçta|ne kadar|müsait mi|uygun mu|mevcut mu|fiyat|ücret|tarih|program|detay|kaç gün|nerede|hangi otel|nasıl gidilir|saat|adres|iletişim|telefon kaç|nerede buluyor|\?/i;
  return questionWords.test(userMessage);
}

/**
 * Yeni rezervasyon niyeti var mı? NLU'ya bağımlı olmadan pattern matching
 */
function hasNewReservationIntent(userMessage: string, detectedIntent: string): boolean {
  const newReservationPatterns =
    /başka tur|farklı tur|diğer tur|other tour|another tour|different tour|yeni tur|new tour|yeni rezervasyon|new reservation|ikinci rez|başka bir rez|bir daha|tekrar rez|başka bir tura|farklı bir tura|diğer bir tur|bir (kayıt|tur|rezervasyon)? daha|daha (bir|tane) (tur|kayıt|rezervasyon)|(başka|farklı|yeni) (kayıt|rezervasyon)|(başka|farklı|diğer)\s+(bir\s+)?(tur|seyahat|destinasyon|kayıt|rezervasyon)|(başka|farklı|diğer)\s+nere|(arkadaşım|eşim|ailem|annem|babam|kardeşim|çocuğum)\s+için|(ekleyelim|ekleyeyim)\b|one more (booking|reservation|tour)|another (reservation|booking|trip)|add (another|one more)|for my (friend|wife|husband|family|mother|father|sibling)|rezervasyon\s+yap|kayıt\s+yap|rezervasyon\s+oluştur|rezervasyon\s+almak|rezervasyon\s+istiyorum|tur\s+rezervasyonu|make\s+a\s+(reservation|booking)|book\s+(a\s+)?(tour|trip|this)|tur\s+(ara|bak|göster|ist)|neue\s+(reservierung|buchung|tour)|(andere|weitere)\s+(reservierung|buchung|tour)|nouvelle\s+(réservation|reservation|voyage)|(autre|différente?)\s+(réservation|tour|voyage)|nueva\s+(reserva|reservación|viaje)|(otra|diferente)\s+(reserva|tour|viaje)|новая\s+(резервация|бронирование|поездка|тур)|друг(ая|ой)\s+(тур|резервация|поездка)/i;
  if (newReservationPatterns.test(userMessage)) return true;
  // FIX (A5): "exclusion" ifadelerini de yeni rezervasyon niyeti say. Kullanıcı bir destinasyonu
  // negate ediyorsa (örn. "antalya dışında nereler var", "antalya değil başka biryer") aslında
  // "başka bir tur istiyorum" demek istiyor — bunu yakalayıp COMPLETED→BROWSING reset'e yönlendir.
  // Mevcut pattern'leri BOZMADAN ek alternation katmanı:
  const exclusionPatterns =
    /dışında\s+(nere|hangi|başka)|başka\s+nere|başka\s+(bir\s+)?(yer|biryer|destinasyon|şehir)|değil\s+başka|hariç\s+(nere|hangi|başka)|other\s+than|anywhere\s+but|somewhere\s+else|except\s+for|außer\s+\w+\s+(was|wo)|sonst\s+wo|кроме\s+\w+\s+(куда|где)|где[\s-]ещё|à\s+part|sauf|ailleurs|aparte\s+de|excepto|otro\s+(lugar|sitio)|ما\s+عدا|غير\s+\w+\s+أين|أين\s+غير/i;
  if (exclusionPatterns.test(userMessage)) return true;
  if (detectedIntent === "reservation_intent") return true;
  return false;
}

/**
 * Rezervasyon bilgisi birleştirme
 *
 * Kurallar:
 * 1. Mevcut bilgiler ASLA silinmez — sadece eksik olanlar eklenir.
 * 2. Tarih ve kişi sayısı sıralı toplanır (tarih → kişi); bu sıra mantıksal
 *    önyargıyı (tarihsiz kişi sayısı anlamsız) korur.
 * 3. İsim ve telefon KOŞULSUZ merge edilir — extracted'da varsa ve state'te
 *    yoksa direkt yazılır. Sıralama koruması merge katmanında DEĞİL, çağrı
 *    öncesi extractor'ın `expectedInput` filtresinde sağlanır (extractor
 *    sadece beklenen step'te ilgili alanı çıkarır).
 *    NOT: Eski "hasPax/hasName ön koşulu" 2026-06-08'de kaldırıldı — pax
 *    state'e geç merge edildiği senaryolarda isim/telefon sessizce kayboluyordu.
 * 4. Bilgi sorusu gelince (isInformational=true) extracted yok sayılır; mevcut
 *    bilgiler aynen korunur.
 */
function mergeReservationInfo(
  existing: ReservationInfo,
  extracted: Partial<ReservationInfo>,
  isInformational: boolean = false,
  intent?: string,
): ReservationInfo {
  // Bilgi sorusu gelirse mevcut bilgileri değiştirme
  if (isInformational) return { ...existing };

  const merged = { ...existing };

  // 2026-06-23 BUG B FIX: change_info ile açık düzeltme niyetinde isim/telefon
  // override edilebilir. provide_info'da eski güvenli "henüz yoksa ekle" davranışı
  // korunur → F negation savunması (waiting_for_name'de "Murat değil aslında Ahmet"
  // → simple-extractor Blok 3 gate temizleyince merged.fullName boş olur, yeni
  // "Ahmet" yazılır — provide_info yolu) etkilenmez.
  //
  // NOT (2026-06-23 BUG B REVİZE — denenip GERİ ALINDI): stage-bazlı guard
  // eklemek "CONFIRMING'de provide_info ile farklı isim override" için denenmişti
  // AMA processTransition action içinde ctx.stage zaten transition.to ile değişmiş
  // oluyor (state-machine.ts:1028-1037). Yani COLLECTING_INFO→CONFIRMING transition'ında
  // action'a ctx.stage="CONFIRMING" geliyor — kullanıcı SADECE akışı tamamlasa bile.
  // Bu B.5 regresyonunu kırdı (provide_info ile NLU uydurma isim override etti).
  // Çözüm: stage guard'ı KALDIR (orijinal Bug B davranışına dön) + process-message.ts'te
  // CONFIRMING'de provide_info + farklı isim/telefon → intent'i "change_info"'ya
  // PROMOTE et. Bu sayede mevcut isExplicitCorrection guard'ı devreye girer.
  const isExplicitCorrection = intent === "change_info";

  // Tour info: her zaman kabul et
  if (extracted.tourId && extracted.tourId !== "") merged.tourId = extracted.tourId;
  if (extracted.tourTitle && extracted.tourTitle !== "") merged.tourTitle = extracted.tourTitle;

  // 1. Tarih: K1 (son verilen değer kazanır — pax ile simetrik).
  // 2026-06-25 BUG-X4 FIX (canlı exec b71dbb98): Eski "!merged.dateId" koşulu
  // mevcut tarih dolu iken yeni tarihi yutuyordu — kullanıcı CONFIRMING'de
  // "tarihi değiştir" → "10 aralık" derken yeni tarih merge edilmiyordu,
  // özet eski 20 aralık göstermeye devam ediyordu. Bug B fix (isim/telefon
  // isExplicitCorrection guard) 2026-06-23'te eklenmiş ama tarih ATLAMIŞ.
  // Pax ile simetrik: extracted varsa her zaman override (bilgi sorusu
  // durumunda yukarıdaki `if (isInformational) return ...` early-return zaten
  // koruyor, NLU history sızıntısı eski=eski no-op).
  if (extracted.dateId) merged.dateId = extracted.dateId;
  if (extracted.selectedDate) merged.selectedDate = extracted.selectedDate;

  // 2. Kişi sayısı: tarih varsa ekle veya GÜNCELLE (K1: son verilen değer geçerli)
  // 2026-06-26 R6: tek-helper validasyon (1-9). Üçüncü path sigortası — hangi
  // extractor 99 üretirse üretsin merge'e geçmez. Bypass'ı kalıcı kapatır.
  const hasDate = !!(merged.dateId || merged.selectedDate);
  if (hasDate && isValidPax(extracted.paxAdult)) {
    merged.paxAdult = extracted.paxAdult;
  }
  if (extracted.paxChild !== undefined && extracted.paxChild !== null && merged.paxAdult) {
    merged.paxChild = extracted.paxChild;
  }

  // F-E1 (2026-07-28) İKİNCİ KÖK: email/emailSkipped HİÇ merge edilmiyordu —
  // Blok-4 çıkarsa bile state'e geçmiyordu (zorunlu collect_email akışı da dahil;
  // hiçbir acentede toggle açık olmadığından bugüne dek görünmemişti). Gönüllü
  // email her adımda kabul (extractEmail geçerli-format garantisi).
  if ((extracted as any).email && !(merged as any).email) {
    (merged as any).email = (extracted as any).email;
  }
  if ((extracted as any).emailSkipped) (merged as any).emailSkipped = true;

  // 3. İsim: henüz yoksa ekle VEYA change_info düzeltme ise override.
  //    KRİTİK BUG FIX (2026-06-08): Eskiden "hasPax && !merged.fullName" koşulu vardı —
  //    state'e paxAdult henüz merge edilmemişse (kullanıcı pax sormadan isim verdi veya
  //    pax bot tarafından geç işleniyor) isim merge EDİLMEZ, sessizce kaybolurdu.
  //    Çözüm: hasPax kısıtını KALDIR.
  //
  //    2026-06-23 BUG B FIX: change_info düzeltme niyetinde mevcut fullName override.
  //    Canlı bug (exec 3fdf95c2): CONFIRMING'de "ismi değiştirelim haki oğrak" →
  //    extracted.fullName="Haki Oğrak" geldi, AMA merged.fullName="Ahmet Yılmaz" dolu
  //    → !merged.fullName=FALSE → yeni değer yutuldu. provide_info yolu (ilk doldurma)
  //    güvenli davranışta kalır; sadece change_info açık düzeltmeyi geçirir.
  if (extracted.fullName && extracted.fullName !== "" &&
      (!merged.fullName || isExplicitCorrection)) {
    merged.fullName = extracted.fullName;
  }

  // 4. Telefon: henüz yoksa ekle VEYA change_info düzeltme ise override.
  //    Aynı sebeple "hasName" kısıtı kaldırıldı — extractor expectedInput="phone"
  //    iken telefon arar, merge layer ek kısıt yaratmasın.
  //    2026-06-23 BUG B FIX: change_info ile telefon override aynı pattern.
  //    2026-06-26 R6: tek-helper format validasyonu. "abc def" / "telefonum yok"
  //    gibi truthy ama geçersiz string'ler merge'e geçmez.
  if (isValidPhone(extracted.phone) &&
      (!merged.phone || isExplicitCorrection)) {
    merged.phone = extracted.phone;
  }

  return merged;
}

export function determineCollectionStep(info: ReservationInfo, collectEmail?: boolean): InfoCollectionStep {
  // dateId ZORUNLU: selectedDate parse edilmiş olabilir ama DB'de eşleşen tur tarihi yoksa
  // dateId null kalır ve bu "tarih hâlâ eksik" anlamına gelir.
  if (!info.dateId) return "waiting_for_date";
  if (!info.paxAdult) return "waiting_for_pax";
  if (!info.fullName) return "waiting_for_name";
  if (!info.phone) return "waiting_for_phone";
  // Email opsiyonel: acente collect_email=true ise, ya email alındı ya da skip edildi olmalı
  if (collectEmail && !info.email && !info.emailSkipped) return "waiting_for_email";
  return "ready_for_confirmation";
}

function isAllInfoCollected(info: ReservationInfo, collectEmail?: boolean): boolean {
  // dateId ZORUNLU: DB'de gerçekten mevcut bir tarih olduğunu garantiler.
  // selectedDate tek başına yeterli değil — DB'de eşleşmeyen tarih rezervasyon kaydında başarısız olur.
  // 2026-06-26 R6: paxAdult/phone için tek-helper FORMAT validasyonu (truthy değil).
  // info.phone="abc def" truthy ama isValidPhone=FALSE → CONFIRMING'e geçmez.
  // info.paxAdult=99 bypass olduysa → isValidPax=FALSE → CONFIRMING'e geçmez.
  const basicDone = !!(
    info.tourId && info.dateId && info.fullName &&
    isValidPax(info.paxAdult) &&
    isValidPhone(info.phone)
  );
  if (!basicDone) return false;
  if (collectEmail) return !!(info.email || info.emailSkipped);
  return true;
}

/**
 * NLU'dan tamamen bağımsız deterministik onay tespiti.
 * SADECE CONFIRMING → COMPLETED geçişinde kullanılır.
 * NLU timeout/hata olsa bile "evet" gibi açık onay kelimeleri yakalar.
 *
 * Negative guard: "evet AMA", "yes BUT change", "tamam FAKAT başka tarih" gibi
 * ifadeler onay sayılmaz — müşteri aslında değiştirmek istiyor.
 */
export function detectConfirmation(message: string, language: string): boolean {
  const msg = message.toLowerCase().trim();

  // 2026-07-09 V7: YALNIZ-EMOJİ onay (WhatsApp gerçeği). Mesaj trim sonrası
  // SADECE onay-emojilerinden oluşuyorsa (👍✅👌🙏💯 + varyant selektörler,
  // 1-3 tekrar) onay say. Metin+emoji karışımı ("👍 ama tarih yanlış") bu
  // yoldan SAYILMAZ → aşağıdaki metin path'leri (negative guard) devreye girer.
  // Red-emoji (👎❌🚫) onay DEĞİL (whitelist'te yok). Path 1 zaten CONFIRMING→
  // COMPLETED transition sınırında → yanlış-pozitif riski çok düşük.
  // Varyasyon selektörü (FE0F), ZWJ (200D), ten tonları (1F3FB-1F3FF), boşluk
  // temizlenir → baz emoji setiyle karşılaştır.
  const _emojiStripped = message.trim().replace(/[️‍\u{1F3FB}-\u{1F3FF}\s]/gu, "");
  if (_emojiStripped.length > 0 && _emojiStripped.length <= 6 && /^(?:👍|✅|👌|🙏|💯|☑|✔)+$/u.test(_emojiStripped)) {
    return true;
  }

  // Negative patterns — bunlar varsa onay değil
  // 2026-06-21 Yan #8 fix: \b ASCII-only → \p{L}\p{N} lookaround.
  // JS \b non-ASCII bitişli kelimelerde (ş/ı) boundary tanımıyor →
  // "evet yanlış" / "evet hatalı" eskiden TRUE (yanlış onay) → şimdi FALSE.
  //
  // 2026-06-25 FIX F4 (canlı bug: "ismi Ahmet yap onaylıyorum"):
  // Eski negative pattern'de değiştirme fiilleri (yap/olsun/değiştir/düzelt/güncelle/
  // değişiklik vb.) YOKTU → "onaylıyorum" pozitif + negative FALSE → detectConfirmation
  // TRUE → state-machine CONFIRMING→COMPLETED transition kazanırdı (ilk sıralı match) →
  // değişiklik niyeti YUTULURDU. CONFIRMING→COLLECTING_INFO (change_info) transition
  // hiç denenmezdi. Fix: değişiklik fiilleri negative pattern'e eklendi, 7 dil eş.
  //
  // GUARD: saf onay (evet/onaylıyorum/tamam onaylıyorum/yes/ok) hâlâ TRUE kalır (F1
  // bozulmaz). "yap"/"olsun" için lookbehind+lookahead ile sıkı kelime sınırı —
  // "yapıyorum" çekim eki sade onay sayılır. "değiştir/düzelt/güncelle/değişiklik"
  // çekim ekleri açık (değiştirelim/değişikliği) — değişiklik niyeti her halükarda.
  // 2026-07-09 Faz 5 A3: TEK KAYNAK constants/confirmation-words.ts —
  // clearPositive (T14 Path-3) ile senkron artık YAPISAL (K1 kuralı).
  const negativePatterns = CONFIRM_NEGATIVE;

  // Positive patterns
  // 2026-06-28 K1 FIX (canlı bug: "kapadokya çok güzel yermiş" → "çok" içinden
  // "ok" alt-string match → yanlış-pozitif onay → COMPLETED + create_reservation RPC).
  // KÖK: JS \b ASCII word-char tabanlı. Türkçe "ç/ğ/ı/ş/ö/ü" non-ASCII → \b
  // bu karakterlerden sonra "ok" başına sınır TANIR → "çok"taki "ok" match olur.
  // Yan #8 fix (2026-06-21) negative pattern'e \p{L}\p{N} lookaround uygulamış
  // AMA positive pattern'de UNUTULMUŞ. Bu fix tamamlama: 7 dil pattern boundary'si
  // ASCII \b yerine Unicode-aware lookaround. /iu flag (u Unicode property için ŞART).
  // 2026-07-09 Faz 5 A3 (V3 kökü): TEK KAYNAK. EN "confirmed" (-ed lookahead'e
  // takılıyordu — CONFIRMING'de çift özet-tekrar döngüsü) + doğal onaylar
  // (sounds good/passt/c'est bon/perfecto/хорошо/aynen) 7 dilde eklendi.
  const positivePatterns = CONFIRM_POSITIVE;

  const langKey = language as keyof typeof positivePatterns;

  // Dile özgü + TR + EN fallback (karışık dil için)
  const hasPositive =
    (positivePatterns[langKey]?.test(msg) ?? false) ||
    positivePatterns.tr.test(msg) ||
    positivePatterns.en.test(msg);

  if (!hasPositive) return false;

  // Negative check — dile özgü + EN fallback
  const hasNegative =
    (negativePatterns[langKey]?.test(msg) ?? false) ||
    negativePatterns.en.test(msg);

  // "evet ama..." veya "yes but..." → onay değil
  return !hasNegative;
}

/**
 * Kullanıcı iptal mi ediyor? "vazgeçtim", "iptal", "istemiyorum" gibi ifadeler.
 * CONFIRMING → COLLECTING_INFO → TOUR_SELECTED gibi aktif state'lerde BROWSING'e dönüş için kullanılır.
 *
 * GUARD (B-4 fix, 2026-06-09): Mesaj cancel pattern içerse bile, devam bağlacı
 * ("ama/fakat/yine de/but/however/...") varsa kullanıcı tereddütünü dile getiriyor,
 * gerçekten iptal etmek istemiyor — iptal sayma. Örnek:
 *   "biraz düşüneyim ama Pamukkale güzel görünüyor" → iptal DEĞİL.
 * Bu, "düşüneyim/pas" gibi zayıf tereddüt ifadelerinin yanlışlıkla tüm rezervasyon
 * bilgisini silmesini engeller.
 */
export function detectCancellation(text: string, language: string): boolean {
  const patterns: Record<string, RegExp> = {
    // TR: iptal + reset/baştan başla kalıpları
    // 2026-07-03 J-16: bitişik "boşver" + "kalsın" + "neyse" eklendi (canlı:
    // "boşver kalsın" ayrık "bo[sş] ver"e uymuyordu → iptal sayılmadı → isim yazıldı)
    // 2026-07-09 FAZ4-P3 (Yan #8 son üye): \b → \p{L}\p{N} lookaround /iu.
    // AR/RU non-ASCII sınır \b'de tanınmıyordu ("إلغاء"/"отмена" kelime-sınırı
    // hatalı) → lookaround ile 7-dil sınırı doğru. TR/EN regresyon: ASCII sınırı
    // lookaround ile aynı sonucu verir (davranış değişmez).
    tr: /(?<![\p{L}\p{N}])(vazge[cç]tim|vazgeçiyorum|iptal|istemiyorum|olmas[ıi]n|gerek yok|bo[sş] ?ver|kals[ıi]n|neyse|ba[sş]ka zaman|d[uü][sş][uü]neyim|d[uü][sş][uü]neyim de|pas|paslıyorum|ba[sş]tan ba[sş]la|ba[sş]tan ba[sş]lamak|ba[sş]tan ba[sş]layal[ıi]m|yeniden ba[sş]la|yeniden ba[sş]lamak|s[ıi]f[ıi]rla|ba[sş]a dön)(?![\p{L}\p{N}])/iu,
    en: /(?<![\p{L}\p{N}])(cancel|nevermind|never mind|forget it|don'?t want|skip it|maybe later|not now|pass|leave it|restart|reset|start over|start fresh|begin again|from scratch|new conversation)(?![\p{L}\p{N}])/iu,
    de: /(?<![\p{L}\p{N}])(abbrechen|stornieren|möchte nicht|will nicht|vergiss es|vergessen|später|nicht mehr|lass es sein|neu starten|von vorne|nochmal|neu anfangen)(?![\p{L}\p{N}])/iu,
    ru: /(?<![\p{L}\p{N}])(отмена|отменить|не хочу|неважно|забудь|забудьте|позже|потом|не надо|заново|сначала|начать заново)(?![\p{L}\p{N}])/iu,
    ar: /(?<![\p{L}\p{N}])(إلغاء|لا أريد|انس الأمر|لاحقا|ليس الآن|اتركها|البدء من جديد|إعادة|ابدأ من جديد)(?![\p{L}\p{N}])/iu,
    fr: /(?<![\p{L}\p{N}])(annuler|j'abandonne|peu importe|laisse tomber|laissez tomber|plus tard|pas maintenant|oublie|recommencer|depuis le début|repartir)(?![\p{L}\p{N}])/iu,
    es: /(?<![\p{L}\p{N}])(cancelar|olvídalo|olvidalo|no quiero|déjalo|dejalo|más tarde|otro día|olvida|reiniciar|empezar de nuevo|desde el principio)(?![\p{L}\p{N}])/iu,
  };
  const langKey = language as keyof typeof patterns;
  const hasCancel = (patterns[langKey]?.test(text) ?? false) || patterns.en.test(text);
  if (!hasCancel) return false;

  // GUARD: devam bağlacı (ama/fakat/yine de) varsa tereddüt → iptal değil
  const continuationGuard =
    /(?<![\p{L}\p{N}])(ama|fakat|ancak|yine de|gene de|but|however|though|although|aber|jedoch|trotzdem|cependant|néanmoins|toutefois|pero|sin embargo|no obstante|однако|но|тем не менее|لكن|مع ذلك|ولكن)(?![\p{L}\p{N}])/iu;
  if (continuationGuard.test(text)) return false;

  return true;
}

/**
 * 2026-06-23 BUG C FIX (exec 28ac50f3 canlı kanıt):
 * detectCancellation regex'i "iptal" kelimesini niyet/bilgi-sorusu ayırt etmeden
 * yakalıyordu. "iptal şartları nedir?" mesajı → mapNLUIntentToFSMIntent →
 * general_question (cancellation_policy bilgi-sorusu kovasında) → AMA transition
 * koşulu sadece regex'e bakıyordu → CONFIRMING→BROWSING tetiklendi → reservationInfo={}
 * → hazır rezervasyon UÇUYORDU.
 *
 * Intent-farkındalıklı sarmalayıcı: mapNLUIntentToFSMIntent ile general_question
 * kovasına düşen 7 NLU intent'i (cancellation_policy, faq_general, payment_methods,
 * agency_info, working_hours, visa_support, hotel_details, transport_details)
 * iptal NİYETİ DEĞİL, BİLGİ sorusudur — regex'i bypass et.
 *
 * Gerçek iptal niyeti güvende:
 *   - "vazgeçtim" → NLU genelde "general" → FSM "general" (general_question DEĞİL) → regex çalışır
 *   - "rezervasyonu iptal et" → NLU "after_sales" → FSM "support_request" → regex çalışır
 *   - "iptal istemiyorum" / "cancel" → kısa belirsizler → "general" kovası → regex çalışır
 *
 * 4 transition tek-kaynak (DRY): TOUR_SELECTED/COLLECTING_INFO/CONFIRMING/COMPLETED
 * → BROWSING. Aynı kökü 4 yerde fix etmek yerine helper'a sarıldı.
 */
function detectCancellationGuarded(input: { userMessage: string; language: string; detectedIntent: string; extractedInfo?: any }): boolean {
  if (input.detectedIntent === "general_question") return false;
  // 2026-07-03 J-16 DEĞER-ÖNCELİK guard'ı: "boşver, 3 kişi olsun" / "boşver,
  // ahmet yılmaz olsun" — vazgeçme kelimesiyle BİRLİKTE somut değer geliyorsa
  // kullanıcı TERK etmiyor, DEĞİŞTİRİYOR. Extract'te değer varsa iptal sayma;
  // değişiklik/toplama dalları devralır. Saf "boşver kalsın" extract üretmez
  // (blacklist/eleme) → iptal akışı çalışır.
  const _e = input.extractedInfo as any;
  if (_e && (_e.fullName || _e.paxAdult || _e.dateId || _e.selectedDate || _e.phone)) return false;
  return detectCancellation(input.userMessage, input.language);
}

/**
 * Kullanıcı net "hayır/no" dedi mi? CONFIRMING aşamasında onay/iptal/değişiklik
 * intentlerinin hiçbiri tetiklenmeyince state takılı kalıyordu. Bu helper, "hayır"ı
 * NET RED olarak yakalar — state SİLİNMEZ, ama bot'a netleştirme cue'su verir
 * ("neyi değiştirmek istersiniz, yoksa iptal mi?" şeklinde sormak için).
 *
 * Sadece kısa, başta gelen "hayır/no" gibi tek-kelimelik redleri yakalar — "hayırlı
 * olsun" gibi cümlede geçen kullanımları YANLIŞLIKLA yakalamaz (^...\b).
 */
export function detectNegativeResponse(text: string, language: string): boolean {
  const patterns: Record<string, RegExp> = {
    tr: /^\s*(hayır|yok|olmaz|hayir|hayır\.|hayır!)\s*$/i,
    en: /^\s*(no|nope|nah|no\.|no!)\s*$/i,
    de: /^\s*(nein|nö)\s*$/i,
    fr: /^\s*(non)\s*$/i,
    es: /^\s*(no)\s*$/i,
    ru: /^\s*(нет)\s*$/i,
    ar: /^\s*(لا)\s*$/i,
  };
  const langKey = language as keyof typeof patterns;
  return (patterns[langKey]?.test(text) ?? false) || patterns.en.test(text);
}

export function getCancellationMessage(language: string): string {
  const messages: Record<string, string> = {
    tr: "Tamam, sorun değil! 😊 Başka bir konuda yardımcı olabilirim. Hangi tur ilginizi çeker?",
    en: "No problem! 😊 I can help you with something else. Which tour interests you?",
    de: "Kein Problem! 😊 Ich kann Ihnen mit etwas anderem helfen. Welche Tour interessiert Sie?",
    ru: "Без проблем! 😊 Я могу помочь вам с чем-то другим. Какой тур вас интересует?",
    ar: "لا مشكلة! 😊 يمكنني مساعدتك في شيء آخر. ما الجولة التي تهمك؟",
    fr: "Pas de problème ! 😊 Je peux vous aider avec autre chose. Quel circuit vous intéresse ?",
    es: "¡No hay problema! 😊 Puedo ayudarte con otra cosa. ¿Qué tour te interesa?",
  };
  return messages[language] || messages.en;
}

/**
 * K6: After-sales mesajı mı? COMPLETED state'de mevcut rezervasyon context'ini korumak için.
 * detectCancellation ve hasNewReservationIntent'ten sonra çağrılır — onlar önce yakalanır.
 * Ödeme bildirimi, değişiklik/iptal isteği, durum sorma, buluşma/transfer soruları vs.
 */
/**
 * K6: After-sales mesajı mı? COMPLETED state'de mevcut rezervasyon context'ini korumak için.
 * detectCancellation ve hasNewReservationIntent'ten sonra çağrılır — onlar önce yakalanır.
 * Kapsam: ödeme bildirimi, rezervasyon değişiklik/iptal isteği, durum sorma,
 *          buluşma/transfer soruları, "ne zaman arayacaksınız" vb.
 */
function isAfterSalesMessage(userMessage: string, detectedIntent: string): boolean {
  // NLU'dan after-sales intent geldiyse direkt yakala.
  // 2026-06-24 FIX 2a (SORUN 3 dead code — exec ffb73402):
  //   Eski liste NLU intent isimleriydi (cancellation_policy/payment_methods/...)
  //   ama state-machine'e FSM intent gelir (mapNLUIntentToFSMIntent sonrası).
  //   NLU "cancellation_policy" → FSM "general_question" — eski listede YOK → silent dead code.
  //   Düzeltme: liste FSM intent isimlerine çevrildi.
  //     - support_request: NLU'da after_sales/complaint_feedback/custom_package/human_handover
  //     - change_info: aynı (NLU=FSM)
  //     - general_question: NLU'da agency_info/working_hours/payment_methods/cancellation_policy/
  //       visa_support/hotel_details/transport_details/faq_general (7 bilgi-sorgu intent kovası)
  //   COMPLETED'de bilgi sorgulama → COMPLETED→COMPLETED no-op → LLM after-sales prompt'uyla
  //   cevaplar (state korunur, K4 validateFieldReask hâlâ field-reask yutkunmasını engeller).
  const afterSalesIntents = [
    "support_request", "change_info", "general_question",
  ];
  if (afterSalesIntents.includes(detectedIntent)) return true;

  const msg = userMessage.toLowerCase();

  // ÖDEME BİLDİRİMİ — 7 dil
  const paymentPatterns =
    // 2026-07-09 FABLE-denetim: \b → lookaround. "ödedim" (ö-başlangıç),
    // "оплатил" (Kiril), "دفعت" (Arapça) \b'de HİÇ eşleşmiyordu → T17 ödeme-
    // bildirimi bu formlarda ölüydü (Yan #8).
    /(?<![\p{L}\p{N}])(ödedim|ödeme\s+yaptım|havale\s+yaptım|para\s+gönderdim|eft\s+yaptım|banka\s+transfer|dekont|makbuz|paid|i\s+paid|payment\s+sent|transferred|receipt|bank\s+transfer|bezahlt|habe\s+bezahlt|überwiesen|beleg|оплатил|оплатила|перевёл|перевела|чек|квитанцию|دفعت|أرسلت\s+الدفع|payé|j['']ai\s+payé|reçu|pagué|hice\s+el\s+pago|recibo)(?![\p{L}\p{N}])/iu;
  if (paymentPatterns.test(msg)) return true;

  // REZERVASYON SORGU / DEĞİŞİKLİK / İPTAL — Türkçe çekim ekleri dahil
  // "rezervasyonum/rezervasyonumu/rezervasyonumuz" + eylem
  const bookingActionPatterns =
    /rezervasyon\w{0,8}\s+.{0,25}?(iptal|değiştir|değişiklik|sorgu|durum|teyit|onay|haber|ne\s+zaman|nasıl|hakkında)|rezervasyonum(u|uz|a|da|dan)?\s+(iptal|değiştir|değişiklik|durum|teyit|onay)/i;
  if (bookingActionPatterns.test(msg)) return true;

  // ZAMANLAMA / ACENTE İLETİŞİM SORULARI
  const timingPatterns =
    /ne\s+zaman\s+(arayacak|ulaşacak|haberleşecek|teyit\s+edecek|onaylayacak|yazacak)|arayacak\s*mısınız|haber\s+verecek\s*misiniz|ne\s+zaman\s+haber|teyit\s+(geldi|bekliyorum|edecek|gelecek)|onay\s+(bekliyorum|geldi|gelecek)|when\s+(will\s+)?(you\s+)?(call|contact|reach|confirm)|wann\s+(rufen|kontaktieren|bestätigen)|когда\s+(позвоните|свяжетесь)|متى\s+ستتصل|quand\s+allez[\s-]vous\s+appeler|cuándo\s+van\s+a\s+llamar/i;
  if (timingPatterns.test(msg)) return true;

  // BULUŞMA / KALKIŞ / TRANSFER / HAZIRLIK
  const meetingPatterns =
    /buluşma\s*(yeri|noktası|saati)|toplanma\s*(yeri|noktası|saati)|kalkış\s*(yeri|saati|noktası)|karşılama\s*(yeri|saati|noktası|transfer)?|havalimanı\s*(transfer|karşılama)|transfer\b|ne\s+getireyim|ne\s+giyeyim|yanımda\s+ne|hazırlık\s*(yapayım|nasıl)|meeting\s+point|pickup\s+(point|location|time)|pick[\s-]up|Treffpunkt|abholen|место\s+встречи|что\s+взять|نقطة\s+الاجتماع|point\s+de\s+rencontre|punto\s+de\s+encuentro/i;
  if (meetingPatterns.test(msg)) return true;

  // İNGİLİZCE / DİĞER DİL BOOKING ACTIONS
  const intlBookingPatterns =
    /booking\s+(change|cancel|status|confirm|modify)|cancel\s+(my\s+)?booking|change\s+(my\s+)?booking|modify\s+(my\s+)?booking|confirmation\s+(email|message|received)|what\s+to\s+(bring|wear|pack)|Buchung\s+(ändern|stornieren|status)|изменить\s+бронирование|отменить\s+бронирование|статус\s+брони|تعديل\s+الحجز|إلغاء\s+الحجز|changer\s+(ma\s+)?réservation|annuler\s+(ma\s+)?réservation|cambiar\s+(mi\s+)?reserva|cancelar\s+(mi\s+)?reserva/i;
  if (intlBookingPatterns.test(msg)) return true;

  return false;
}

function resetForNewReservation(ctx: ConversationContext): Partial<ConversationContext> {
  return {
    currentTour: null,
    reservationInfo: {},
    reservationConfirmed: false,
    paymentInfoSent: false,
    collectionStep: undefined,
    viewedTours: [],
    isNewReservation: true,
  };
}

const transitions: StateTransition[] = [
  // ── İPTAL GEÇİŞLERİ (en üstte — önce kontrol edilir) ────────────────────
  // Kullanıcı aktif bir flow'dayken "vazgeçtim/iptal/istemiyorum" derse BROWSING'e dön.
  {
    from: "TOUR_SELECTED",
    to: "BROWSING",
    condition: (_ctx, input) => detectCancellationGuarded(input),
    action: (ctx) => ({
      ...ctx,
      currentTour: null,
      reservationInfo: {},
      collectionStep: undefined,
      justCancelled: true,
    }),
  },
  {
    from: "COLLECTING_INFO",
    to: "BROWSING",
    condition: (_ctx, input) => detectCancellationGuarded(input),
    action: (ctx) => ({
      ...ctx,
      currentTour: null,
      reservationInfo: {},
      reservationConfirmed: false,
      collectionStep: undefined,
      justCancelled: true,
    }),
  },
  {
    from: "CONFIRMING",
    to: "BROWSING",
    condition: (_ctx, input) => detectCancellationGuarded(input),
    action: (ctx) => ({
      ...ctx,
      currentTour: null,
      reservationInfo: {},
      reservationConfirmed: false,
      collectionStep: undefined,
      justCancelled: true,
    }),
  },
  // ─────────────────────────────────────────────────────────────────────────

  // GREETING → COLLECTING_INFO (kök çözüm — 2026-07-01 ilk-turn takılması)
  // Birleşik ilk mesaj ("pamukkale 3 kişi 20 aralık") tek turn'de:
  //   selectedTour dolu + extractedInfo.dateId/pax dolu → doğrudan COLLECTING_INFO'ya geç.
  // Aksi halde GREETING → TOUR_SELECTED tetiklenir, o action mergeReservationInfo
  // ÇAĞIRMAZ (sadece tourId/tourTitle yazar) → dateId/pax veri kaybı + LLM
  // TOUR_SELECTED prompt'unda "kontrol ediyorum" der → takılma.
  // DARlık: extract yoksa VE reservation intent değilse tetiklenmez → saf "pamukkale"
  //   mesajı hâlâ GREETING → TOUR_SELECTED yolunu izler (regresyon yok).
  // Action: BROWSING → COLLECTING_INFO ile BİRE BİR simetrik (mergeReservationInfo +
  //   determineCollectionStep). Kanıtlanmış deseni tekrar ediyor.
  {
    from: "GREETING",
    to: "COLLECTING_INFO",
    condition: (_ctx, input) => {
      if (input.selectedTour === null) return false;
      const hasExtractedDateOrPax =
        !!(input.extractedInfo as any).dateId
        || !!(input.extractedInfo as any).selectedDate
        || !!(input.extractedInfo as any).paxAdult;
      const isReservationAction =
        input.detectedIntent === "reservation_intent" ||
        input.detectedIntent === "tour_selected" ||
        input.detectedIntent === "provide_info" ||
        input.detectedIntent === "confirm";
      return hasExtractedDateOrPax || isReservationAction;
    },
    action: (ctx, input) => {
      const tour = input.selectedTour || ctx.currentTour;
      const merged = mergeReservationInfo({ tourId: tour!.id, tourTitle: tour!.title }, input.extractedInfo, false, input.detectedIntent);
      return {
        ...ctx,
        currentTour: tour,
        viewedTours: input.selectedTour ? [...ctx.viewedTours, input.selectedTour.id] : ctx.viewedTours,
        reservationInfo: merged,
        collectionStep: determineCollectionStep(merged, ctx.collectEmail),
      };
    },
  },

  // GREETING → TOUR_SELECTED
  {
    from: "GREETING",
    to: "TOUR_SELECTED",
    condition: (ctx, input) => input.selectedTour !== null,
    action: (ctx, input) => ({
      ...ctx,
      currentTour: input.selectedTour,
      viewedTours: [...ctx.viewedTours, input.selectedTour!.id],
      reservationInfo: {
        tourId: input.selectedTour!.id,
        tourTitle: input.selectedTour!.title,
      },
    }),
  },

  // GREETING → BROWSING
  {
    from: "GREETING",
    to: "BROWSING",
    condition: (ctx, input) =>
      input.selectedTour === null &&
      (input.detectedIntent === "browse_tours" ||
        input.detectedIntent === "tour_search" ||
        input.detectedIntent === "greeting" ||
        input.detectedIntent === "general"),
  },

  // BROWSING → COLLECTING_INFO
  {
    from: "BROWSING",
    to: "COLLECTING_INFO",
    condition: (ctx, input) => {
      const hasSelectedTour = input.selectedTour !== null;
      const hasCurrentTour = ctx.currentTour !== null;
      const isReservationAction =
        input.detectedIntent === "reservation_intent" ||
        input.detectedIntent === "tour_selected" ||
        input.detectedIntent === "provide_info" ||
        input.detectedIntent === "confirm";
      return (hasSelectedTour || hasCurrentTour) && isReservationAction;
    },
    action: (ctx, input) => {
      const tour = input.selectedTour || ctx.currentTour;
      const merged = mergeReservationInfo({ tourId: tour!.id, tourTitle: tour!.title }, input.extractedInfo, false, input.detectedIntent);
      return {
        ...ctx,
        currentTour: tour,
        viewedTours: input.selectedTour ? [...ctx.viewedTours, input.selectedTour.id] : ctx.viewedTours,
        reservationInfo: merged,
        collectionStep: determineCollectionStep(merged, ctx.collectEmail),
      };
    },
  },

  // BROWSING → TOUR_SELECTED
  {
    from: "BROWSING",
    to: "TOUR_SELECTED",
    condition: (ctx, input) =>
      input.selectedTour !== null &&
      input.detectedIntent !== "reservation_intent" &&
      input.detectedIntent !== "tour_selected" &&
      input.detectedIntent !== "provide_info" &&
      input.detectedIntent !== "confirm",
    action: (ctx, input) => ({
      ...ctx,
      currentTour: input.selectedTour,
      viewedTours: [...ctx.viewedTours, input.selectedTour!.id],
      reservationInfo: {
        tourId: input.selectedTour!.id,
        tourTitle: input.selectedTour!.title,
      },
    }),
  },

  // TOUR_SELECTED → COLLECTING_INFO
  {
    from: "TOUR_SELECTED",
    to: "COLLECTING_INFO",
    condition: (ctx, input) => {
      // 2026-06-19: Açık rezervasyon/olumlu pattern her zaman geç — NLU "general"
      // döndürse bile (isInformational true) bu pattern'ler net niyet ifadesidir.
      // Aksi halde TOUR_SELECTED'da kalır → process-message'daki deterministik tarih
      // listesi (waiting_for_date bloğu) tetiklenmez → LLM "Hangi tarihte?" der ama
      // tarih listesini göstermez (canlı bug 2026-06-19).
      //
      // 2026-06-25 BUG-X7 FIX: inline reservationPattern (\b sıkı sınır, sadece
      // "rezervasyon" uzun form) hasReservationSignal helper'ı ile değiştirildi.
      // Helper "rezerve" kökünü + çekim eki + 7 dil + ek kelimeler (kayıt/yer ayır/
      // katıl) kapsar — DRY (tour-change.ts ile aynı helper).
      const positivePattern = /^\s*(evet|tamam|olur|peki|tabii|yes|ok(?:ay)?|sure|ja|oui|s[íi]|да|نعم)\b/i;
      if (hasReservationSignal(input.userMessage)) return true;
      if (positivePattern.test(input.userMessage)) return true;
      // 2026-06-29 PROBLEM 2 fix: NLU tour_search/general'ı "informational" sayıp
      // erken-return ile transition'ı kesiyor. AMA birleşik mesajda ("pamukkale 3 kişi
      // 20 aralık" → NLU tour_search + dateId/pax çözüldü) gerçek rezervasyon başlatma
      // niyeti var. Bypass: extractedInfo'da dateId/selectedDate/paxAdult VARSA
      // informational guard'ı atla — değerlendirmeye devam et (aşağıdaki reservationIntents
      // / hasExtractedInfo + pattern dalları transition'ı tetikleyebilir).
      // Daraltma: SADECE extract var ise bypass. Saf bilgi sorusu ("pamukkale ne kadar?"
      // — extract yok) HÂLÂ informational sayılır → mevcut davranış korunur.
      const _hasExtractedDateOrPax =
        !!(input.extractedInfo as any).dateId
        || !!(input.extractedInfo as any).selectedDate
        || !!(input.extractedInfo as any).paxAdult;
      if (isInformationalMessage(input.userMessage, input.detectedIntent) && !_hasExtractedDateOrPax) return false;
      const reservationIntents = ["reservation_intent", "provide_info", "confirm", "tour_selected"];
      if (reservationIntents.includes(input.detectedIntent)) return true;
      const hasExtractedInfo = Object.keys(input.extractedInfo).length > 0;
      const hasPaxPattern = /\d+\s*(kişi|person|people|yetişkin|adult|çocuk|child)/i.test(input.userMessage);
      const hasPhonePattern = /\b05\d{9}\b|\b\+\d{7,}/i.test(input.userMessage);
      // Tarih bilgisi gelince geçiş yap — "5 Mart 2027" gibi geçersiz tarihler de yakalanır (BUG 1)
      const hasDateInfo = !!(input.extractedInfo as any).selectedDate || !!(input.extractedInfo as any).dateId;
      return hasExtractedInfo && (hasPaxPattern || hasPhonePattern || hasDateInfo);
    },
    action: (ctx, input) => {
      const merged = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo, false, input.detectedIntent);
      return {
        ...ctx,
        reservationInfo: merged,
        collectionStep: determineCollectionStep(merged, ctx.collectEmail),
        isNewReservation: false,
      };
    },
  },

  // TOUR_SELECTED → TOUR_SELECTED (tur değişimi)
  // BUG FIX (2026-06-09): reservationInfo eskiden { tourId, tourTitle } ile TAMAMEN
  // sıfırlanıyordu — pax/isim/phone hepsi siliniyordu. Eğer NLU yanlışlıkla
  // "reservation_intent" döndürür ve tour-matcher false-positive ile farklı bir
  // selectedTour set ederse, kullanıcı mid-rezervasyon ismi/telefonu vermiş
  // olsa bile silinip baştan soruluyordu. Şimdi spread ile kişi-bağımlı alanlar
  // (pax/isim/phone/email) KORUNUR, sadece tur değişimi sebebiyle artık geçersiz
  // olan tarih/dateId temizlenir.
  {
    from: "TOUR_SELECTED",
    to: "TOUR_SELECTED",
    condition: (ctx, input) =>
      input.selectedTour !== null &&
      input.selectedTour.id !== ctx.currentTour?.id &&
      Object.keys(ctx.reservationInfo).length <= 2,
    // 2026-06-20: helper'a refactor (tek-kaynak tour-change). Davranış birebir aynı.
    // 2026-06-25 ALT-KÖK A FIX: collectionStep undefined ile override.
    // produceTourChangeContext collectionStep'i "waiting_for_date" yapar — bu
    // COLLECTING_INFO/CONFIRMING bağlamında doğru (KÖK 5), ama TOUR_SELECTED'da
    // YANLIŞ. Kullanıcı henüz rezervasyon başlatmadı; "Kapadokya daha iyi mi"
    // gibi karşılaştırma sorusunda tur bağlamı güncellenir AMA tarih sorulmaz.
    // :11 (a) collectionStep===waiting_for_date kontrolü → FALSE → tarih listesi
    // gelmez → LLM bilgi/karşılaştırma cevabı verir.
    action: (ctx, input) => ({
      ...produceTourChangeContext(ctx, input.selectedTour!),
      collectionStep: undefined,
    }),
  },

  // COLLECTING_INFO → TOUR_SELECTED (tur değişimi — B2: genişletilmiş pattern)
  // "aslında başka tur" / "Kapadokya'ya geç" / "farklı tur" gibi geçişleri de yakalar.
  // NOT: selectedTour null ise geçiş olmaz; o durumda B2 deterministik listesi devreye girer (process-message).
  // BUG FIX (2026-06-09): Aynı pax/isim/phone koruması burada da — bu transition
  // false-positive olarak en sık tetiklendiği yerdi (özge yılmazer case).
  {
    from: "COLLECTING_INFO",
    to: "TOUR_SELECTED",
    condition: (ctx, input) =>
      input.selectedTour !== null &&
      input.selectedTour.id !== ctx.currentTour?.id &&
      (/yeni tur|başka tur|tur değiştir|switch tour|change tour|different tour|farklı tur|diğer tur|tur\s*değişt|aslında\s+.{0,20}?tur|bunun\s+yerine\s+.{0,20}?tur|andere tour|другой тур|tour différent|tour diferente|جولة أخرى/i.test(input.userMessage) ||
       input.detectedIntent === "reservation_intent"),
    // 2026-06-20: helper'a refactor (tek-kaynak tour-change). Davranış birebir aynı.
    action: (ctx, input) => produceTourChangeContext(ctx, input.selectedTour!),
  },

  // COLLECTING_INFO → COLLECTING_INFO
  // KRİTİK: Bilgi sorusu gelince mevcut bilgileri KORU.
  // K7: Tüm bilgi doluysa (allInfoCollected) intent ne olursa olsun CONFIRMING'e geç.
  {
    from: "COLLECTING_INFO",
    to: "COLLECTING_INFO",
    condition: (ctx, input) => {
      const isInfo = isInformationalMessage(input.userMessage, input.detectedIntent);
      // Bilgi sorusu gelirse ekstraksiyonu dışarıda bırak; sadece mevcut bilgilerle kontrol et
      const merged = isInfo
        ? { ...ctx.reservationInfo }
        : mergeReservationInfo(ctx.reservationInfo, input.extractedInfo, false, input.detectedIntent);  // K7 check, change_info için override aktif
      // K7: Tüm bilgi tamamsa bu transition'ı atla → COLLECTING_INFO→CONFIRMING devralır
      return !isAllInfoCollected(merged, ctx.collectEmail);
    },
    action: (ctx, input) => {
      const isInfo = isInformationalMessage(input.userMessage, input.detectedIntent);
      // Bilgi sorusu gelirse mevcut bilgileri değiştirme
      const merged = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo, isInfo, input.detectedIntent);
      return {
        ...ctx,
        reservationInfo: merged,
        collectionStep: determineCollectionStep(merged, ctx.collectEmail),
      };
    },
  },

  // COLLECTING_INFO → CONFIRMING
  // KRİTİK: Bilgi sorusu gelince CONFIRMING'e GEÇMEİ
  // Kullanıcı açıkça bilgi sunmadıkça bu geçiş tetiklenMEZ
  //
  // BUG 2 FIX (Hayriye case, 2026-06-XX): "general" intent valid listeden ÇIKARILDI.
  // Önceki davranış: NLU isim/telefon mesajına "general" intent dönüyordu ve allInfoCollected=true
  // ise CONFIRMING'e atlanıyordu — kullanıcı açıkça "evet/onaylıyorum" demeden. Sonra bir sonraki
  // turda detectConfirmation veya confirm_reservation intent ile COMPLETED'a sıçranıyor, onay
  // adımı tamamen atlanmış oluyordu (LAUNCH-BLOCKER bug).
  // Yeni davranış: yalnızca provide_info (somut veri sundu) veya açık confirm intent CONFIRMING'e
  // geçirir. "general" intent → COLLECTING_INFO'da kalır, bot kullanıcıdan açık veri ister.
  {
    from: "COLLECTING_INFO",
    to: "CONFIRMING",
    condition: (ctx, input) => {
      // Bilgi sorusu gelirse kesinlikle CONFIRMING'e geçme
      if (isInformationalMessage(input.userMessage, input.detectedIntent)) return false;
      // Yalnızca AÇIK NIYET ile CONFIRMING'e geç — "general" kabul edilmez.
      const validIntents = ["provide_info", "confirm", "confirm_reservation"];
      if (!validIntents.includes(input.detectedIntent)) return false;
      const merged = mergeReservationInfo(ctx.reservationInfo, input.extractedInfo, false, input.detectedIntent);
      return isAllInfoCollected(merged, ctx.collectEmail);
    },
    action: (ctx, input) => ({
      ...ctx,
      reservationInfo: mergeReservationInfo(ctx.reservationInfo, input.extractedInfo, false, input.detectedIntent),
      collectionStep: "ready_for_confirmation" as InfoCollectionStep,
    }),
  },

  // CONFIRMING → COMPLETED
  // KRİTİK: Sadece açık onay kelimesiyle tetiklenir.
  // detectConfirmation NLU'dan bağımsız çalışır — NLU timeout olsa bile "evet" yakalar.
  {
    from: "CONFIRMING",
    to: "COMPLETED",
    condition: (ctx, input) => {
      // 1. Deterministik onay tespiti — NLU'ya bakmadan geç.
      //    2026-07-02 K1 REVIZE (canlı yanlış-negatif kanıtı — kayıp rezervasyon):
      //    Eski "belt-and-suspenders" intent guard (intent=general iken bloklama)
      //    KALDIRILDI. Haiku canlıda "evet"i intent=general sınıflandırıyor →
      //    transition FAIL → RPC yok → sessiz kayıt kaybı (yanlış-pozitiften bile
      //    sinsi). Deterministik pattern TEK otorite. K1 yanlış-pozitif koruması
      //    detectConfirmation'ın İÇİNDE (lookaround boundary + negative guard
      //    "ama/değil/değiştir") — bu satırın dışına ihtiyaç yok. Test:
      //    "çok teşekkürler"/"kapadokya güzelmiş" → detectConfirmation FALSE (K1
      //    korunur); "evet"/"onaylıyorum"/"tamam" → TRUE (yanlış-negatif kapanır).
      if (detectConfirmation(input.userMessage, ctx.language)) return true;
      // 2. Bilgi sorusu gelirse kesinlikle CONFIRMING'de kal.
      if (isInformationalMessage(input.userMessage, input.detectedIntent)) return false;
      // 3. NLU "confirm_reservation" — Tulay case bug (2026-06-19): NLU "tulay tabi"
      //    gibi mesajları "ANY positive word" kuralıyla yanlışlıkla confirm_reservation
      //    yapıyordu. Tek başına intent'e GÜVENMİYORUZ; ek kısıt: mesaj kısa olmalı,
      //    rakam içermemeli VE en az bir net positive kelime barındırmalı.
      if (input.detectedIntent !== "confirm_reservation") return false;
      const msg = input.userMessage.trim();
      if (msg.length > 20) return false;                // uzun mesaj → şüpheli
      if (/\d/.test(msg)) return false;                  // rakam → telefon/sayı, onay değil
      // 2026-06-28 K1 EKSİK YOL fix (canlı bug: "çok teşekkürler" → intent=confirm_reservation
      // (Haiku yanlış sınıflandırma) + clearPositive "çok"→"ok" ASCII \b match → COMPLETED
      // + RPC. Path 3 detectConfirmation'dan AYRI clearPositive pattern kullanıyordu.
      //
      // KATMAN B (çift-doğrulama): NLU confirm_reservation dese BİLE detectConfirmation
      // pattern doğrulaması ŞART. Haiku sınıflandırma sapmasına karşı sigorta.
      if (!detectConfirmation(input.userMessage, ctx.language)) return false;
      // KATMAN A (boundary fix): Net positive pattern — \b → \p{L}\p{N} lookaround
      // (Yan #8 fix tamamlama, detectConfirmation ile aynı kanıtlanmış desen).
      // ASCII \b Türkçe non-ASCII öncüllü kelimelerde ("çok"→"ok") yanlış-pozitif yaratıyordu.
      // 2026-07-09 Faz 5 A3: TEK KAYNAK CLEAR_POSITIVE_RE (confirmation-words.ts,
      // POS_ALT birleşimi) — detectConfirmation ile drift ARTIK YAPISAL OLARAK imkânsız.
      return CLEAR_POSITIVE_RE.test(msg);
    },
    action: (ctx) => ({
      ...ctx,
      reservationConfirmed: true,
      collectionStep: undefined,
      // 2026-06-24 FIX A1: rezervasyon onay anı timestamp'i.
      // adapter.loadHistory(limit, since) bu zamandan sonraki mesajları döner →
      // NLU/LLM history'de eski rezervasyonu görmez (S1/S2/S3 ortak kök çözümü).
      historyCutoffAt: new Date().toISOString(),
    }),
  },

  // CONFIRMING → COLLECTING_INFO (değişiklik) — BUG 5 FIX
  // Önceki sürüm yumuşak pattern'ler ("değil", "farklı") yüzünden masum soru
  // cümlelerini ("Tarih farklı değil mi?", "Doğru değil mi?") change_info olarak
  // yorumlayıp rezervasyon bilgilerini siliyordu. Şimdi 3 katmanlı:
  //   1. Negative guard — "değil mi" / "öyle değil" / "n'est-ce pas" soru/teyit kalıpları → false
  //   2. Güçlü değişiklik fiilleri ("değiştir", "change", "düzelt", "güncelle") → tek başına yeterli
  //   3. Zayıf sinyaller ("yanlış", "değil", "farklı", "eksik", "fazla") → MUTLAKA bir hedef
  //      alanla (tarih/pax/isim/telefon) eşleşmeli
  // "olsun" / "olarak değiştir" — yeni değer önerme niyeti, güçlü sinyal.
  {
    from: "CONFIRMING",
    to: "COLLECTING_INFO",
    condition: (ctx, input) => {
      // NLU açık değişiklik intent'i — en güvenilir sinyal
      if (input.detectedIntent === "change_info") return true;

      const msg = input.userMessage.toLowerCase();

      // 1. NEGATIVE GUARD: soru/teyit kalıpları değişiklik talebi DEĞİL
      // Türkçe "değil mi?" / "öyle değil mi" / "doğru değil mi" + diğer dillerde eşdeğerleri
      // 2026-07-09 FABLE-denetim: \b→lookaround ("öyle" ö-başlangıç + RU/AR ölüydü).
      const negativeGuard = /(?<![\p{L}\p{N}])(değil\s+mi|öyle\s+değil|doğru\s+değil|n['']?est[\s-]?ce\s+pas|isn['']?t\s+(it|that)|right\?|правильно\?|صحيح\?)/iu;
      if (negativeGuard.test(msg)) return false;

      // 2. GÜÇLÜ DEĞİŞİKLİK FİİLLERİ — tek başına yeterli (açık niyet)
      const strongChangeIntent =
        /değiştir|olsun\b|olarak\s+değiştir|change|modify|edit|düzelt|güncelle|update|fix|correct|ändern|stattdessen|corriger|corregir|en\s+lugar|изменить|вместо|تعديل|بدلاً/i;
      if (strongChangeIntent.test(msg)) return true;

      // 3. ZAYIF SİNYALLER ("yanlış", "değil", "farklı", "eksik", "fazla") — MUTLAKA hedef alanla
      // tetiklensin. Tek başına "değil" / "farklı" yanlış-pozitif yaratıyordu.
      // 2026-06-21 Yan #8 fix: \b → \p{L}\p{N} lookaround. weakKeywords'te
      // yanlış/hatalı/farklı TR'de ş/ı bitişli — eskiden "tarih yanlış" /
      // "isim hatalı" change_info zayıf sinyal kaçıyordu.
      const weakKeywords = /(?<![\p{L}\p{N}])(yanlış|wrong|incorrect|hatalı|değil|farklı|eksik|fazla|falsch|неправильно|خطأ)(?![\p{L}\p{N}])/iu;
      // fieldPattern: adı (ı bitişli) eskiden kaçıyordu.
      const fieldPattern =
        /(?<![\p{L}\p{N}])(tarih|date|gün|day|datum|tag|дата|день|تاريخ|يوم|jour|día|fecha|isim|ismi|adım|adı|adın|soyad|surname|name|namen?|имя|اسم|إسم|nom|nombre|telefon|numara|phone|tel|gsm|cep|handy|телефон|номер|هاتف|رقم|téléphone|teléfono|ki[şs]i|yeti[şs]kin|[çc]ocuk|pax|person|people|adult|child|kinder|personen|человек|людей|дети|أشخاص|أطفال|personnes|enfants|personas|niños)(?![\p{L}\p{N}])/iu;
      if (weakKeywords.test(msg) && fieldPattern.test(msg)) return true;

      return false;
    },
    action: (ctx, input) => {
      const msg = input.userMessage.toLowerCase();
      const info = { ...ctx.reservationInfo };
      const _ext = input.extractedInfo as any;

      // 2026-06-23 BUG B FIX — NLU-first override:
      // Canlı bug (exec 3fdf95c2): "ismi değiştirelim haki oğrak" → NLU
      // extracted.fullName="Haki Oğrak" geldi AMA pattern eşleşmesine bağlı
      // dallanma "Ahmet Yılmaz" üzerine yazmadı. Yeni davranış: NLU bir alan
      // çıkardıysa pattern'e BAKMA, DİREKT uygula (NLU güçlü sinyal).
      // Pattern fallback SADECE NLU hiçbir şey çıkarmadığında (kullanıcı sadece
      // "tarihi değiştirmek istiyorum" gibi yeni değer vermeden yazdığında) devreye girer.
      let _appliedAny = false;
      if (_ext.fullName) {
        info.fullName = _ext.fullName;
        _appliedAny = true;
      }
      if (_ext.phone) {
        info.phone = _ext.phone;
        _appliedAny = true;
      }
      if (_ext.paxAdult) {
        info.paxAdult = _ext.paxAdult;
        if (_ext.paxChild !== undefined) info.paxChild = _ext.paxChild;
        _appliedAny = true;
      }
      if (_ext.dateId || _ext.selectedDate) {
        if (_ext.dateId) {
          // Geçerli tarih: dateId çözüldü → dateId + görünen tarih BİRLİKTE yaz.
          info.dateId = _ext.dateId;
          if (_ext.selectedDate) info.selectedDate = _ext.selectedDate;
        } else if (_ext.selectedDate) {
          // 2026-07-27 OLGU-A fix: dateId ÇÖZÜLEMEDİ ama tarih metni parse edildi
          // (turda OLMAYAN tarih, örn "15 Aralık yap"). ESKİ davranış: yeni
          // selectedDate yazılıp ESKİ dateId stale kalıyordu → özet 15.12 gösterip
          // rezervasyon 10.12'ye (eski dateId) yazılıyordu (SESSİZ desenkron;
          // görünen≠kayıtlı, canlı kanıt selectedDate=2026-12-15 & dateId=…004).
          // FIX: stale dateId'yi SİL → selectedDate present + dateId absent kalır →
          // aşağı akıştaki mevcut invalid-date guard'ı (process-message _invalidDate
          // ForPreamble) devralır: "X müsait değil" + müsait tarih listesi +
          // waiting_for_date. Böylece "15 Aralık yap" ≡ "tarihi 15 Aralık yap"
          // (iki ifade-yolu TEK yola birleşir). Pax kota-guard'ının tarih simetriği.
          info.selectedDate = _ext.selectedDate;
          delete info.dateId;
        }
        _appliedAny = true;
      }

      if (_appliedAny) {
        console.log(`[state-machine] change_info NLU-first override applied (fullName=${!!_ext.fullName}, phone=${!!_ext.phone}, pax=${!!_ext.paxAdult}, date=${!!(_ext.dateId || _ext.selectedDate)})`);
      }

      // Çok dilli alan pattern'leri — NLU sessiz kaldığında fallback
      // 2026-06-25 BUG-X3 FIX: phonePattern/paxPattern/datePattern \b ASCII boundary
      // Türkçe çekim ekini ("telefonu", "tarihi", "kişiyi") reddediyordu → fallback
      // else dalı tarihi siliyor + waiting_for_date'e düşürüyordu. Canlı kanıt
      // (exec 6ae3a5b4-f592-440a): "telefonu düzeltmek istiyorum" → tarih SİLİNDİ →
      // tarih listesi gösterildi (kullanıcı telefon düzeltmek istedi!).
      // Yan #8 disiplini: lookbehind ASCII-boundary değil \p{L}\p{N} lookaround,
      // lookahead YOK (çekim eki serbest — "telefonu"/"tarihi"/"kişiyi" yakalanır).
      // namePattern zaten partial match (boundary yok) — dokunulmadı.
      const namePattern   = /isim|ismi|adım|adı|adın|soyad|surname|name|namen?|имя|اسم|إسم|nom|nombre/i;
      const phonePattern  = /(?<![\p{L}\p{N}])(telefon|numara|phone|tel|gsm|cep|handy|телефон|номер|هاتف|رقم|téléphone|teléfono)/iu;
      const paxPattern    = /(?<![\p{L}\p{N}])(ki[şs]i|yeti[şs]kin|[çc]ocuk|pax|person|people|adult|child|kinder|personen|человек|людей|дети|أشخاص|أطفال|personnes|enfants|personas|niños)/iu;
      const datePattern   = /(?<![\p{L}\p{N}])(tarih|date|gün|day|datum|tag|дата|день|تاريخ|يوم|jour|día|fecha)/iu;

      // B-3 fix (2026-06-09): Veri silme YALNIZCA kullanıcı yeni değeri verdiyse
      // veya açıkça reset istediyse yapılır. Yeni değer YOKSA mevcut alan KORUNUR.
      //
      // 2026-06-23 BUG B FIX: Pattern fallback SADECE NLU hiçbir alan çıkarmadığında
      // çalışır. Bu sayede "ismi değiştirelim haki oğrak" mesajında pattern dalı YERİNE
      // NLU dalı kullanılır (yukarıdaki _appliedAny). Pattern fallback artık SADECE
      // kullanıcının yeni değer VERMEDİĞİ "telefonum yanlış olabilir" gibi belirsiz
      // niyetlerde devreye girer.
      if (!_appliedAny) {
        if (namePattern.test(msg)) {
          // _ext.fullName yok zaten (yukarıda kontrol edildi) → fullName KORUNUR
        } else if (phonePattern.test(msg)) {
          // aynı: phone KORUNUR
        } else if (paxPattern.test(msg)) {
          // aynı: pax KORUNUR
        } else if (datePattern.test(msg)) {
          // Tarih değişiklik talebi + NLU yeni tarih ÇIKARMADI → eski tarih sil.
          delete info.dateId;
          delete info.selectedDate;
        } else {
          // Belirsiz "değiştir" / "olsun" — en yaygın: tarih değişimi. Sadece tarih reset.
          delete info.dateId;
          delete info.selectedDate;
        }
      }

      return {
        ...ctx,
        reservationInfo: info,
        collectionStep: determineCollectionStep(info, ctx.collectEmail),
      };
    },
  },

  // ===== COMPLETED STATE TRANSITIONS =====

  // COMPLETED → BROWSING (iptal / reset / baştan başla) — en yüksek öncelik
  // "vazgeçtim", "baştan başlayalım", "sıfırla", "restart" gibi kalıpları yakalar.
  // NOT: after-sales'den ÖNCE kontrol edilir — "iptal" tek başına conversation reset anlamına gelir.
  {
    from: "COMPLETED",
    to: "BROWSING",
    condition: (_ctx, input) => detectCancellationGuarded(input),
    action: (ctx) => ({
      ...ctx,
      ...resetForNewReservation(ctx),
      stage: "BROWSING" as ConversationStage,
      justCancelled: true,
    }),
  },

  // COMPLETED → COMPLETED (after-sales — mevcut rezervasyon context'ini koru)
  // K6: "Rezervasyonumu değiştirmek istiyorum", "ödedim", "ne zaman arayacaksınız" vs.
  // detectCancellation ve hasNewReservationIntent'ten SONRA kontrol edilir.
  // Bu transition, COMPLETED → BROWSING (greeting/general) geçişinden ÖNCE çalışır.
  //
  // 2026-06-24 KARAR (Murat yön değişikliği):
  //   Rezervasyon ONAYLANDIKTAN SONRA (COMPLETED) isim/telefon değişikliği state'e
  //   YAZILMAZ — DB'ye yazılmış rezervasyona dokunmak yalan vaat üretir (bot DB
  //   güncellemiyor). Bunun yerine process-message.ts'te yeni 14a-3 bypass:
  //   COMPLETED + change_info VEYA (provide_info + farklı değer) → acente
  //   yönlendirme deterministik mesajı.
  //   Bu transition sadece state'i KORUR (no-op spread), HİÇBİR merge yapmaz.
  //   Daha önceki Fix 1 change_info merge bloğu KALDIRILDI.
  //
  // CONFIRMING'deki Bug B fix change_info merge (mergeReservationInfo isExplicitCorrection
  // guard'ı) KORUNUR — rezervasyon onayı ÖNCESİ değişiklik akışı serbest kalır.
  {
    from: "COMPLETED",
    to: "COMPLETED",
    condition: (_ctx, input) => isAfterSalesMessage(input.userMessage, input.detectedIntent),
    action: (ctx) => ({ ...ctx }), // Tüm context (reservationInfo, currentTour) aynen korunur
  },

  // COMPLETED → BROWSING (YENİ REZERVASYON KASTI — currentTour'u önemseme)
  // "başka rezervasyon", "yeni tur", "başka nereler var" gibi mesajlarda selectedTour
  // dolu olsa bile (örn. "pamukkale değil başka nereler"), FRESH START yap.
  // Bu transition COMPLETED → TOUR_SELECTED #17'den ÖNCE çalışır — kasıt baskın.
  {
    from: "COMPLETED",
    to: "BROWSING",
    condition: (_ctx, input) => hasNewReservationIntent(input.userMessage, input.detectedIntent),
    action: (ctx) => ({
      ...ctx,
      ...resetForNewReservation(ctx),
      stage: "BROWSING" as ConversationStage,
    }),
  },

  // COMPLETED → BROWSING (tur araması — tur seçilmemişse)
  // "Turları görmek istiyorum", "Turlarınızı öğrenebilir miyim" gibi açık keşif niyetleri.
  //
  // 2026-06-23 BUG A FIX: "greeting" ve "general" allow-list'ten ÇIKARILDI.
  // Canlı bug (exec 4858c2f0): COMPLETED'de "teşekkür ederim" → NLU intent=general →
  // bu transition tetiklenip resetForNewReservation ile reservationInfo={} → state UÇTU.
  // Sonra BROWSING prompt'unda LLM "telefon ver" diyordu (state silindiği için eksik
  // gördü). Artık general/greeting bu transition'ı tetiklemiyor — process-message.ts'te
  // COMPLETED after-sales ack bypass'ı deterministik kapanış mesajı atıyor, state KORUNUYOR.
  // browse_tours / tour_search → yeni tur arama niyeti, BROWSING'e geçiş DOĞRU.
  {
    from: "COMPLETED",
    to: "BROWSING",
    condition: (_ctx, input) =>
      ["browse_tours", "tour_search"].includes(input.detectedIntent) &&
      input.selectedTour === null,
    action: (ctx) => ({
      ...ctx,
      ...resetForNewReservation(ctx),
      stage: "BROWSING" as ConversationStage,
    }),
  },

  // COMPLETED → BROWSING (yeni rezervasyon niyeti, tur belirtilmemiş)
  {
    from: "COMPLETED",
    to: "BROWSING",
    condition: (ctx, input) =>
      hasNewReservationIntent(input.userMessage, input.detectedIntent) && input.selectedTour === null,
    action: (ctx) => ({
      ...ctx,
      ...resetForNewReservation(ctx),
      stage: "BROWSING" as ConversationStage,
    }),
  },

  // COMPLETED → BROWSING (tour_search intent — kullanıcı yeni tur arıyor, tur seçilmedi)
  // "ege turu istiyorum" gibi mesajlarda NLU tour_search döndürür ama isInformationalMessage
  // bunu bilgi sorusu sayıp diğer transition'ları engeller. Bu geçiş generic kaçış kapısı.
  {
    from: "COMPLETED",
    to: "BROWSING",
    condition: (ctx, input) =>
      input.detectedIntent === "tour_search" && input.selectedTour === null,
    action: (ctx) => ({
      ...ctx,
      ...resetForNewReservation(ctx),
      stage: "BROWSING" as ConversationStage,
    }),
  },

  // COMPLETED → TOUR_SELECTED (rezervasyon niyetiyle — aynı veya farklı tur)
  {
    from: "COMPLETED",
    to: "TOUR_SELECTED",
    condition: (ctx, input) => {
      if (isInformationalMessage(input.userMessage, input.detectedIntent)) return false;
      const reservationIntents = ["reservation_intent", "tour_selected", "provide_info", "confirm"];
      return input.selectedTour !== null && reservationIntents.includes(input.detectedIntent);
    },
    action: (ctx, input) => ({
      ...ctx,
      ...resetForNewReservation(ctx),
      stage: "TOUR_SELECTED" as ConversationStage,
      currentTour: input.selectedTour,
      viewedTours: [input.selectedTour!.id],
      reservationInfo: {
        tourId: input.selectedTour!.id,
        tourTitle: input.selectedTour!.title,
      },
      collectionStep: "waiting_for_date" as InfoCollectionStep,
    }),
  },

  // COMPLETED → TOUR_SELECTED (herhangi tur seçildi, bilgi amaçlı değil, rezervasyon intent dışı)
  // id eşleşme kontrolü KALDIRILDI: aynı turu tekrar seçme de artık çalışır.
  //
  // FIX (A2): informational guard'a "farklı tur seçildi" exception'ı.
  // Eskiden: intent "tour_search" gibi informational sayıldığı için → return false →
  // COMPLETED'den çıkamıyordu. "antalya değil pamukkale" / "pamukkale" gibi mesajlarda
  // NLU tour_search döner, selectedTour=Pamukkale olur AMA hiçbir transition fire etmez,
  // state COMPLETED+Antalya'da kilitli kalır.
  //
  // Yeni davranış: selectedTour FARKLI bir tur ise (id !== ctx.currentTour?.id) informational
  // guard bypass edilir. KRİTİK: AYNI turun adı yazılırsa (örn "Antalya turum hakkında bilgi")
  // selectedTour.id === ctx.currentTour.id olur → bypass DEVREYE GİRMEZ → informational guard
  // korunur → after-sales mantığı aynen çalışır.
  //
  // Sıra: detectCancellation (line 612) + isAfterSalesMessage (line 628) → hasNewReservationIntent
  // (line 639) — bu transition'lar yukarıda zaten var. Bu fix ONLAR'DAN SONRA çalışır.
  {
    from: "COMPLETED",
    to: "TOUR_SELECTED",
    condition: (ctx, input) => {
      const _isDifferentTour =
        input.selectedTour !== null && input.selectedTour.id !== ctx.currentTour?.id;
      // 2026-07-03 D2 FIX: _isDifferentTour bypass'ı NİYET SİNYALİ şartına bağlandı.
      // Eski davranış farklı tur ADI geçmesini yeterli sayıyordu → COMPLETED'de
      // chitchat ("kapadokya güzelmiş", aktif rezervasyon Antalya iken) yeni akış
      // açıyordu — kullanıcı sohbet ediyordu, resetForNewReservation state'i uçurdu.
      // Sinyal sınıfları (yeni kelime yaması değil, boşluğu sınıf olarak kapatır):
      //   1. hasReservationSignal — rezervasyon/kayıt/booking (7 dil)
      //   2. hasNewReservationIntent — başka/yeni tur + exclusion kalıpları
      //   3. CHANGE_KEYWORDS_RE — ikame/düzeltme (yerine/aslında/instead/statt...)
      //      tek-kaynak: constants/change-detection.ts (X9-change ile aynı, DRY)
      //   4. negation — "antalya DEĞİL pamukkale" tarzı ikame; FIX A2'nin orijinal
      //      vakası hasNewReservationIntent'e EŞLEŞMİYOR ("değil başka" ister,
      //      "değil pamukkale" uymaz) → bu sınıf olmadan A2 vakası kırılırdı.
      // Sinyal YOKSA bypass kapalı → informational guard normal işler → chitchat
      // (intent tour_search/general/faq_general → informational TRUE) transition'ı
      // tetikleyemez → COMPLETED korunur → :14a-2 / LLM after-sales cevap verir.
      const _negationRe = /(?<![\p{L}\p{N}])(değil|deil|not|nicht|pas|не|ليس|مش)(?![\p{L}\p{N}])/iu;
      const _hasSwitchSignal =
        hasReservationSignal(input.userMessage) ||
        hasNewReservationIntent(input.userMessage, input.detectedIntent) ||
        CHANGE_KEYWORDS_RE.test(input.userMessage) ||
        _negationRe.test(input.userMessage);
      const _bypassInformational = _isDifferentTour && _hasSwitchSignal;
      if (!_bypassInformational && isInformationalMessage(input.userMessage, input.detectedIntent)) {
        return false;
      }
      return (
        input.selectedTour !== null &&
        !["reservation_intent", "tour_selected", "provide_info", "confirm"].includes(input.detectedIntent)
      );
    },
    action: (ctx, input) => ({
      ...ctx,
      ...resetForNewReservation(ctx),
      stage: "TOUR_SELECTED" as ConversationStage,
      currentTour: input.selectedTour,
      viewedTours: [input.selectedTour!.id],
      reservationInfo: {
        tourId: input.selectedTour!.id,
        tourTitle: input.selectedTour!.title,
      },
    }),
  },
];

export function processTransition(context: ConversationContext, input: ProcessingInput): ConversationContext {
  // STATE_INPUT — FSM geçişi öncesi tam input durumu (tarih debug için kritik)
  console.info("STATE_INPUT", {
    currentStage: context.stage,
    collectionStep: context.collectionStep,
    detectedIntent: input.detectedIntent,
    // Tarih bilgisi hangi kaynaktan geliyor?
    hasExtractedDate: !!(input.extractedInfo as any)?.selectedDate,
    hasExtractedDateId: !!(input.extractedInfo as any)?.dateId,
    extractedDate: (input.extractedInfo as any)?.selectedDate,
    // Context'te mevcut tarih
    hasContextDate: !!(context.reservationInfo as any)?.selectedDate,
    hasContextDateId: !!(context.reservationInfo as any)?.dateId,
    // Diğer reservation bilgileri
    hasName: !!(input.extractedInfo as any)?.fullName || !!context.reservationInfo?.fullName,
    hasPhone: !!(input.extractedInfo as any)?.phone || !!context.reservationInfo?.phone,
    hasPax: !!(input.extractedInfo as any)?.paxAdult || !!context.reservationInfo?.paxAdult,
    // Seçili tur
    currentTourId: context.currentTour?.id,
    inputTourId: (input as any).selectedTour?.id,
  });

  const transition = transitions.find((t) => t.from === context.stage && t.condition(context, input));

  if (!transition) {
    // COLLECTING_INFO'daysa ve bilgi sorusu değilse extracted info'yu güncelle
    if (context.stage === "COLLECTING_INFO" && Object.keys(input.extractedInfo).length > 0) {
      const isInfo = isInformationalMessage(input.userMessage, input.detectedIntent);
      const merged = mergeReservationInfo(context.reservationInfo, input.extractedInfo, isInfo, input.detectedIntent);
      return {
        ...context,
        reservationInfo: merged,
        collectionStep: determineCollectionStep(merged, context.collectEmail),
        lastUserMessage: input.userMessage,
        messageCount: context.messageCount + 1,
        lastUpdated: new Date().toISOString(),
      };
    }

    return {
      ...context,
      lastUserMessage: input.userMessage,
      messageCount: context.messageCount + 1,
      lastUpdated: new Date().toISOString(),
    };
  }

  let newContext: ConversationContext = {
    ...context,
    stage: transition.to,
    lastUserMessage: input.userMessage,
    messageCount: context.messageCount + 1,
    lastUpdated: new Date().toISOString(),
  };

  if (transition.action) {
    newContext = transition.action(newContext, input);
  }

  // STATE_OUTPUT — geçiş sonrası yeni durum (tarih "kayboldu mu?" kontrolü)
  // 2026-06-24: phone alanı eklendi (COMPLETED change_info güncelleme teşhisi için).
  console.info("STATE_OUTPUT", {
    fromStage: context.stage,
    toStage: newContext.stage,
    newCollectionStep: newContext.collectionStep,
    reservationDateId: newContext.reservationInfo?.dateId,
    reservationDate: newContext.reservationInfo?.selectedDate,
    reservationPax: newContext.reservationInfo?.paxAdult,
    reservationName: newContext.reservationInfo?.fullName,
    reservationPhone: newContext.reservationInfo?.phone,
  });

  return newContext;
}

export function getNextExpectedInput(context: ConversationContext): string {
  if (context.stage === "GREETING") return "greeting_or_tour_selection";
  if (context.stage === "BROWSING") return "tour_selection";
  if (context.stage === "TOUR_SELECTED" && !context.reservationInfo.dateId) return "date_selection";
  if (context.stage === "COLLECTING_INFO") {
    if (context.collectionStep === "waiting_for_date") return "date";
    if (context.collectionStep === "waiting_for_pax") return "pax";
    if (context.collectionStep === "waiting_for_name") return "name";
    if (context.collectionStep === "waiting_for_phone") return "phone";
  }
  if (context.stage === "CONFIRMING") return "confirmation";
  return "general";
}
