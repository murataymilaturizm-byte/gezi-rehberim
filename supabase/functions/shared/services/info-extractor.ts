// Unified info extraction service — replaces webhook's 10 inline extraction blocks.
// Davranış whatsapp-webhook/index.ts'deki inline bloklar ile EŞDEĞERDİR (Faz 1).

import type { ConversationContext } from "../fsm/types.ts";
import { extractNameAndPhone, extractEmail, isEmailSkipRequest, formatName, normalizePhone, hasRelativeDateWord } from "../fsm/simple-extractor.ts";
import { findTourById } from "../fsm/tour-matcher.ts";
import { getNextExpectedInput } from "../fsm/state-machine.ts";
import { isNluFullNameNegationLeak, isNluFullNameTourLeak } from "./nlu-validation.ts";
import { hasQuotaForPax, getQuotaRemaining } from "./quota-check.ts";
import { isValidPax } from "../utils/validation.ts";
import { CHANGE_KEYWORDS_RE } from "../constants/change-detection.ts";
import { AVAILABILITY_RE } from "../constants/availability-words.ts";
import { PEOPLE_CONTEXT_RE } from "../constants/people-words.ts";
import { MONTH_NAME_TO_NUMBER, MONTH_ALTERNATION } from "../constants/month-names.ts";

// getLocalizedTourTitle ve _TOUR_TITLE_TRANSLATIONS tanımları aşağıda,
// normalizeDateString'den sonra yer almaktadır.

/**
 * NLU field'ını string listesine normalize eder.
 * NLU bazen string, bazen string[], bazen null/undefined döndürebilir.
 */
function normalizeNluField(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string" && v.trim().length > 0);
  if (typeof value === "string" && value.trim().length > 0) return [value];
  return [];
}

/** 7 dil ay ismi → ay numarası */
// 2026-07-03 FAZ2-kapanış İş 1: LOKAL KOPYA LİSTE KALDIRILDI — canlı bug
// "10 aralik" bu listenin ASCII'sizliğinden Blok 9'da eşleşemiyordu (V1-ASCII
// yalnız simple-extractor'ı düzeltmişti; kopya listeler senkronsuzdu).
// TEK KAYNAK: constants/month-names.ts (TR ASCII varyantları dahil).
const TEXT_MONTHS = MONTH_NAME_TO_NUMBER;

const _monthPattern = MONTH_ALTERNATION;
// DAY MONTH [YEAR] — "20 aralık", "22. Dezember", "22.Dezember", "20 december 2026"
// [.\s]+ → nokta, boşluk veya ikisi (boşluksuz "22.Dezember" de kabul)
const TEXT_MONTH_REGEX = new RegExp(
  `(\\d{1,2})[.\\s]+(${_monthPattern})(?:[.\\s]+(\\d{4}))?`,
  "i",
);
// MONTH DAY [YEAR] — "december 22", "Dec 22" (EN gün-sonu format)
const TEXT_MONTH_DAY_REGEX = new RegExp(
  `(${_monthPattern})\\.?\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?`,
  "i",
);

/**
 * Tarih string'ini YYYY-MM-DD formatına normalize eder.
 * Desteklenen formatlar:
 * - YYYY-MM-DD (zaten ISO — dokunma)
 * - DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY
 * - "20 aralık", "20 december", "20 марта" vb. (7 dil metin ay)
 * - Tanınmayan format → olduğu gibi döner
 *
 * BUG 3 FIX (2026-06-XX): "14 aralık olur" / "14 aralık olsun" gibi onay/dolgu
 * eklerini taşıyan stringlerde regex partial-match doğru çalışıyor AMA bazı
 * çağıran tarafların ham string'i DB lookup'a göndermesi bug'a yol açıyordu.
 * İki ek koruma:
 *   (1) PREPROCESS: yaygın onay/dolgu sözcüklerini kaldır ("olur/olsun/tamam/
 *       uygun/işte/lütfen/şu/bu/tarih/gün") → çekirdek tarih ifadesi kalır.
 *   (2) TÜRKÇE LOWERCASE: toLowerCase() yerine toLocaleLowerCase("tr-TR") —
 *       Türkçe ı/İ/I/i case-folding'i doğru handle edilir ("14 ARALIK" →
 *       "14 aralık", dotless ı korunur).
 */
// 2026-07-09 Faz 5 B: ES bağlaç "de/del" eklendi — "10 de diciembre" day-month
// arasındaki "de" yüzünden TEXT_MONTH_REGEX'e uymuyordu (denetim kanıtı).
// \b(de)\b yalnız AYRIK "de"yi siler — "dezember/december" İÇİNDEKİ de'ye dokunmaz.
// 2026-07-09 FABLE-denetim: \b → lookaround ("şu" ş-başlangıç \b'de hiç
// eşleşmiyordu — Yan #8 süpürmesi). /giu.
const _DATE_FILLER_REGEX = /(?<![\p{L}\p{N}])(olur|olsun|tamam|uygun|işte|şu|bu|tarih|gün|lütfen|please|fine|good|ok|okay|de|del)(?![\p{L}\p{N}])/giu;
export function normalizeDateString(dateStr: string): string {
  if (!dateStr) return dateStr;
  // Önişlemci: dolgu sözcüklerini temizle, çoklu boşluğu tek boşluğa indir
  const stripped = dateStr.replace(_DATE_FILLER_REGEX, "").replace(/\s+/g, " ").trim();
  // Türkçe-aware lowercase (ı/İ/I/i için)
  const cleaned = stripped.toLocaleLowerCase("tr-TR").trim();

  // 1. Zaten ISO formatı
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // 2. DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY
  const dmy = dateStr.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;

  // 3a. "20 aralık" / "22. Dezember" / "20 december 2026" vb. — DAY MONTH
  const textMatch = cleaned.match(TEXT_MONTH_REGEX);
  if (textMatch) {
    const day = parseInt(textMatch[1]);
    const monthName = textMatch[2].toLowerCase();
    const month = TEXT_MONTHS[monthName];
    if (month && day >= 1 && day <= 31) {
      let year = textMatch[3] ? parseInt(textMatch[3]) : new Date().getFullYear();
      if (!textMatch[3]) {
        const candidate = new Date(year, month - 1, day);
        if (candidate < new Date()) year++;
      }
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // 3b. "december 22" / "Dec 22, 2026" vb. — MONTH DAY (EN formatı)
  const monthDayMatch = cleaned.match(TEXT_MONTH_DAY_REGEX);
  if (monthDayMatch) {
    const monthName = monthDayMatch[1].toLowerCase();
    const day = parseInt(monthDayMatch[2]);
    const month = TEXT_MONTHS[monthName];
    if (month && day >= 1 && day <= 31) {
      let year = monthDayMatch[3] ? parseInt(monthDayMatch[3]) : new Date().getFullYear();
      if (!monthDayMatch[3]) {
        const candidate = new Date(year, month - 1, day);
        if (candidate < new Date()) year++;
      }
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return dateStr; // Tanınmayan format — olduğu gibi bırak
}

/**
 * Tur başlığını hedef dile çevirir.
 * DB'de title_en/de/... boşsa translation map'ten otomatik çeviri yapar.
 * Bilinmeyen turlar için TR orijinali döner (fallback).
 */
export function getLocalizedTourTitle(title: string, language: string): string {
  if (!title || language === "tr") return title;
  // 1. zaten localized (pickLocalized != TR): döner
  // 2. TR ise map'e bak
  const lower = title.toLowerCase().trim();
  const map = _TOUR_TITLE_TRANSLATIONS[lower];
  if (map?.[language]) return map[language];
  // 3. Keyword-based replace (kısmi eşleşme için)
  for (const [trKey, translations] of Object.entries(_TOUR_TITLE_TRANSLATIONS)) {
    if (lower.includes(trKey) && translations[language]) {
      return title.replace(new RegExp(trKey, "gi"), translations[language]);
    }
  }
  return title;
}

/** Yaygın Türkçe tur başlıklarının çevirileri (DB'de title_en boşsa fallback) */
const _TOUR_TITLE_TRANSLATIONS: Record<string, Record<string, string>> = {
  "kapadokya balon turu": {
    en: "Cappadocia Balloon Tour",
    de: "Kappadokien Ballonfahrt",
    ru: "Полёт на воздушном шаре в Каппадокии",
    ar: "جولة بالون في كابادوكيا",
    fr: "Tour en Ballon de Cappadoce",
    es: "Tour en Globo de Capadocia",
  },
  "kapadokya turu": {
    en: "Cappadocia Tour", de: "Kappadokien Tour",
    ru: "Тур в Каппадокию", ar: "جولة كابادوكيا",
    fr: "Circuit de Cappadoce", es: "Tour de Capadocia",
  },
  "pamukkale turu": {
    en: "Pamukkale Tour", de: "Pamukkale Tour",
    ru: "Тур в Памуккале", ar: "جولة باموكالي",
    fr: "Circuit de Pamukkale", es: "Tour de Pamukkale",
  },
  "efes turu": {
    en: "Ephesus Tour", de: "Ephesus Tour",
    ru: "Тур в Эфес", ar: "جولة أفسس",
    fr: "Circuit d'Éphèse", es: "Tour de Éfeso",
  },
  "istanbul turu": {
    en: "Istanbul Tour", de: "Istanbul Tour",
    ru: "Тур по Стамбулу", ar: "جولة إسطنبول",
    fr: "Circuit d'Istanbul", es: "Tour de Estambul",
  },
  "antalya turu": {
    en: "Antalya Tour", de: "Antalya Tour",
    ru: "Тур в Анталию", ar: "جولة أنطاليا",
    fr: "Circuit d'Antalya", es: "Tour de Antalya",
  },
};

/**
 * 3-katmanlı tarih eşleştirme:
 * 1. Exact string match
 * 2. ISO normalize edilmiş exact match
 * 3. Year-agnostic (gün+ay) partial match — "20 Aralık" gibi yılsız tarihler için
 */
function matchDateWithTourDates(dateStr: string, tourDates: any[]): any | null {
  if (!dateStr || tourDates.length === 0) return null;

  // Özel prefix'ler (simple-extractor'dan gelebilir)
  if (dateStr.startsWith("index_")) {
    const idx = parseInt(dateStr.split("_")[1]);
    if (!isNaN(idx) && idx >= 0 && idx < tourDates.length) return tourDates[idx];
    return null;
  }
  if (dateStr.startsWith("day_")) {
    const day = parseInt(dateStr.split("_")[1]);
    const matches = tourDates.filter((d) => {
      const p = d.departure_date?.match(/\d{4}-\d{2}-(\d{2})/);
      return p && parseInt(p[1]) === day;
    });
    return matches.length === 1 ? matches[0] : null;
  }

  // 1. Exact match
  const exact = tourDates.find((d) => d.departure_date === dateStr);
  if (exact) return exact;

  // 2. Normalize (DD.MM.YYYY → YYYY-MM-DD) sonra exact match
  const normalized = normalizeDateString(dateStr);
  if (normalized !== dateStr) {
    const normMatch = tourDates.find((d) => d.departure_date === normalized);
    if (normMatch) return normMatch;
  }

  // 3. Year-agnostic: gün + ay eşleştir
  const isoSel = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoSel) {
    const partial = tourDates.find((d) => {
      const p = d.departure_date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return p && p[2] === isoSel[2] && p[3] === isoSel[3];
    });
    if (partial) return partial;
  }

  return null;
}

export interface ExtractAllInfoParams {
  message: string;
  nluResult: any;
  fsmIntent: string;   // mapNLUIntentToFSMIntent sonrası, override uygulanmış
  context: ConversationContext;
  tours: any[];        // getCachedTours çıktısı
  /**
   * 2026-06-25 KÖK 5 devamı (exec a90c71af): tur değişimi (erken-müdahale)
   * SONRASI çağrıldığında Blok 10 (tek-tarih otomatik atama) ATLAYACAK.
   * Yeni turun tek tarihi olsa bile kullanıcı seçmeli — sessiz atama yapılmaz.
   * Canlı bug: Pamukkale (20.12) → Kapadokya geçişinde Kapadokya tek-tarihli
   * (18.12) → Blok 10 sessizce atadı → özet "Tarih: 18.12" göründü, kullanıcı
   * onaylamadı. produceTourChangeContext dateId/selectedDate'i silmişti ama
   * Blok 10 yeniden atadı.
   */
  tourJustChanged?: boolean;
  /**
   * 2026-06-29 O1 fix: birleşik mesajda (tur+tarih aynı turn) tour-matching
   * selectedTour'u yeni bulur AMA state-machine context.currentTour'a henüz
   * yazmamıştır. Blok 9 (dateId resolution) context.currentTour'a bağımlıydı →
   * dateId resolve edilmiyor → "müsait değil" yanlış mesajı.
   * Fallback: bu turn'de matchlenen selectedTour, context.currentTour eksikse
   * Blok 9'da aktif tur olarak kullanılır.
   */
  selectedTour?: any;
}

/**
 * Webhook'taki 10 inline extraction bloğunu tek fonksiyona toplar.
 * Sıralama ve öncelik webhook ile aynıdır — Faz 1'de davranış değişmez.
 */
export function extractAllInfo(params: ExtractAllInfoParams): Record<string, any> {
  const { message, nluResult, fsmIntent, context, tours } = params;

  // === Blok 1: NLU updates (en yüksek öncelik) — placeholder/hallucination koruması ===
  const _rawUpdates: Record<string, any> = nluResult.updates || {};
  const extractedInfo: Record<string, any> = {};
  // AI bazen "<UNKNOWN>", "N/A", "bilinmiyor" gibi dummy değerler döndürür — reservationInfo'ya sızmasın
  const _isPlaceholder = (s: string): boolean =>
    /^<.*>$|^undefined$|^null$|^n\/?a$|^-+$|^\?+$|^bilinmiyor$|^belirtilmedi$|^not\s+provided$|^unknown$/i.test(s.trim());

  // 2026-06-26 BUG-X9 FIX (Seçenek D): NLU paxAdult sigortası — peopleContext zorunlu.
  // Canlı bug (exec X9): "Ondördü olur" → NLU çift kullanım (Haiku tarih sayısını
  // hem dates hem people_count'a koydu) → paxAdult=14 SIZINTI → DB 14×900=12.600₺.
  // Sigorta: mesajda kişi-bağlamı (kişi/insan/yetişkin/...) YOKSA NLU paxAdult
  // reddedilir. waiting_for_pax istisna (bot zaten kişi sayısı sordu).
  const _msgLower = (message || "").toLowerCase();
  // 2026-07-09 Faz 5 (Vaka 2): TEK KAYNAK PEOPLE_CONTEXT_RE (people-words.ts).
  // Eski elle-liste EN "ppl"/DE "Personen"/RU "человек"(\b)/AR "أشخاص"(\b) kaçırıyordu
  // → birleşik ilk-mesajda NLU pax reddediliyordu. Lookaround + 7-dil ile kapandı.
  const _hasPeopleContext = PEOPLE_CONTEXT_RE.test(_msgLower);
  const _isWaitingForPax = context.collectionStep === "waiting_for_pax";
  // 2026-07-03 I-9 (X9'un AYNA simetriği): waiting_for_pax'ta "yok yok 20'sine
  // alalım" → NLU 20'yi people_count sandı, waiting_for_pax istisnası GEÇİRDİ →
  // pax=20 → grup mesajı. Oysa "yirmisine" (yazı) doğru tarih değişikliği
  // yapıyordu — tutarsızlık. Tespit: rakam + TARİH-İYELİK eki ("20'si/20sine/
  // 20'sinde") → pax İSTİSNASINI EZ (NLU pax reddedilir); aşağıda Blok 8.5
  // gün-eşleştirme tarih zincirine yönlendirir. Çıplak "20" ve "20 kişi"
  // pax kalır (peopleContext/tam-rakam yolları değişmedi).
  // Kapsam: apostroflu HER iyelik ("3'ü", "5'i", "20'sine") + apostrofsuz
  // yalnız s'li form ("20sine") — apostrofsuz s'siz ("3u") kapsam dışı
  // (yanlış-pozitif riski). "20 kişi" hiçbirine uymaz.
  const _dateOrdinalRe = /(\d{1,2})['’](?:s?[ıiuü])(?:ne|nde|ni|nü|nu)?(?![\p{L}\p{N}])|(\d{1,2})s[ıi](?:ne|nde|ni)?(?![\p{L}\p{N}])/iu;
  const _hasDateOrdinal = _dateOrdinalRe.test(message || "");
  const _shouldAcceptNluPax = (_hasPeopleContext || _isWaitingForPax) && !_hasDateOrdinal;

  // 2026-07-03 X9-change fix (ÜÇÜNCÜ kabul yolu — bkz. ARCHITECTURE_GUARDS.md G8):
  // Canlı bug: waiting_for_phone'da "aslında 3 olsun" → peopleContext yok →
  // X9 pax'ı reddeder → A2 değişiklik dalı körleşir → R6 "geçerli telefon girin"
  // yanlış mesajı. Ön-şartlar (Blok 1'de): change-sinyali (CHANGE_KEYWORDS_RE,
  // process-message A2 ile TEK kaynak) + isValidPax(1-9) + collectionStep pax'ın
  // ZATEN toplandığı bir adım (değişiklik bağlamı, ilk toplama değil).
  // KARAR BURADA VERİLMEZ: "aslında 3'ü olsun" bir TARİH değişikliği olabilir
  // (ayın 3'ü) ve tarih eşleşmesi Blok 2-9'da SONRA belli olur. Pending'e al,
  // Blok 10 SONRASI tarih çıkmadıysa kabul et (X9'un tarih→pax sızıntı
  // koruması delinmez — tarih eşleşirse pax İPTAL, tarih akışı kazanır).
  const _paxAlreadyCollectedStep =
    context.collectionStep === "waiting_for_name" ||
    context.collectionStep === "waiting_for_phone" ||
    context.collectionStep === "waiting_for_email" ||
    context.collectionStep === "ready_for_confirmation";
  const _hasChangeSignal = CHANGE_KEYWORDS_RE.test(message || "");
  let _pendingChangePaxAdult: number | null = null;
  let _pendingChangePaxChild: number | null = null;

  for (const [k, v] of Object.entries(_rawUpdates)) {
    if (k === "fullName" && typeof v === "string" && v.trim()) {
      if (_isPlaceholder(v)) continue;
      // Tek kelimeli isim (soyad yok) kabul etme — BUG 3
      const _nameWords = v.trim().split(/\s+/);
      if (_nameWords.length < 2) continue;
      extractedInfo[k] = formatName(v.trim());
    } else if (k === "phone" && typeof v === "string" && v.trim()) {
      // KRİTİK: normalizePhone null dönerse FALLBACK YOK — placeholder DB'ye sızmasın
      const normalized = normalizePhone(v.trim());
      if (normalized) extractedInfo[k] = normalized;
    } else if ((k === "paxAdult" || k === "paxChild") && !_shouldAcceptNluPax) {
      // 2026-06-26 BUG-X9: peopleContext yok + waiting_for_pax değil → NLU pax REDDET
      // (tarih sayısı sızıntısı engellenir — "ondördü olur" → 14 yutulmaz).
      // 2026-07-03 X9-change: change-sinyalli + pax-toplandı adımı + geçerli değer
      // ise PENDING'e al — Blok 10 sonrası tarih eşleşmediyse kabul edilecek.
      const _nPax = typeof v === "number" ? v : Number(v);
      if (_hasChangeSignal && _paxAlreadyCollectedStep && Number.isFinite(_nPax)) {
        if (k === "paxAdult" && isValidPax(_nPax)) {
          _pendingChangePaxAdult = _nPax;
          console.log(`[info-extractor] X9-change: NLU paxAdult=${_nPax} PENDING (change-sinyal + ${context.collectionStep}, tarih zinciri bekleniyor)`);
          continue;
        }
        if (k === "paxChild" && _nPax >= 0 && _nPax <= 9) {
          _pendingChangePaxChild = _nPax;
          continue;
        }
      }
      console.log(`[info-extractor] BUG-X9: NLU ${k}=${v} reddedildi (peopleContext yok + waiting_for_pax değil)`);
      continue;
    } else {
      extractedInfo[k] = v;
    }
  }

  // === Blok 2: NLU entities.dates → normalize (string veya string[] olabilir) ===
  // 2026-07-09 FAZ3-mikro FIX 2 (İş2 kalıntısı): GÖRELİ-KELİME NLU GUARD'I.
  // Canlı vaka: pax adımında "yarın" → NLU konuşma özetindeki seçili tarihi
  // (20.12) ÇAPA alıp "2026-12-21" üretti → relative_ zinciri (Blok 9d) hiç
  // devreye girmedi → ham ISO şablona sızdı. Kök: göreli ifadelerde NLU dates[]
  // GÜVENİLMEZ (yanlış çapadan hesaplıyor). Mesajda göreli-tarih kelimesi varsa
  // (hasRelativeDateWord — extractRelativeDate 7-dil seti) NLU dates'i BU TURN
  // YOKSAY → extractRelativeDate/Blok 9d (bugün-çapa, Europe/Istanbul) otorite.
  // Net tarih ("10 aralık") göreli-kelime içermez → guard TETİKLENMEZ, NLU geçer.
  const nluDates = normalizeNluField(nluResult.entities?.dates);
  if (nluDates.length > 0 && !hasRelativeDateWord(message)) {
    extractedInfo.selectedDate = normalizeDateString(nluDates[0]);
  } else if (nluDates.length > 0) {
    console.log(`[info-extractor] FIX2 göreli-kelime NLU guard: NLU dates=${JSON.stringify(nluDates)} YOKSAYILDI (extractRelativeDate/Blok 9d otorite)`);
  }

  // === Blok 3: simple-extractor (isim, telefon, paxAdult, tarih) ===
  // 2026-07-09 V8-ucuz: tourDates GEÇİRİLİYOR — extractRelativeDate (yarın/öbür
  // gün, 7 dil) artık tur tarihleriyle kesişebilir (eşleşme→dateId; yoksa
  // relative_ISO → Blok 9c temizler → :11 liste). Önceden tourDates'siz
  // çağrılıyordu → relative_ prefix üretiliyor ama tüketicisi yoktu (yarım-bağlı).
  const _b3Tour = context.currentTour ? findTourById(context.currentTour.id, tours) : null;
  const simple = extractNameAndPhone(message, context.collectionStep, _b3Tour?.dates);
  // 2026-06-21 SORUN F GERÇEK KÖK: simple-extractor.ts:450 mesajdan Title-Case
  // fullName extract ediyor (Blok 5 mantığının kopyası). simple.fullName ile
  // gelen değeri AYNI gate sigortasından geçir (K3 tek-kaynak). Canlı exec
  // 9f040077 kanıtı: simple-extractor "Murat Değil Aslında Ahmet" Title-Case
  // dönüyordu → state'e ham yazılıyordu.
  if (simple.fullName && !extractedInfo.fullName) {
    if (!isNluFullNameNegationLeak(simple.fullName) && !isNluFullNameTourLeak(simple.fullName)) {
      extractedInfo.fullName = simple.fullName;
    }
    // else: silent drop, sonraki turn'de bot yeniden sorar
  }
  if (simple.phone && !extractedInfo.phone) extractedInfo.phone = simple.phone;
  if (simple.paxAdult && !extractedInfo.paxAdult) extractedInfo.paxAdult = simple.paxAdult;
  // 2026-06-25 FIX KÖK 2: paxChild fallback (NLU çıkarmadıysa simple-extractor "X çocuk" pattern)
  if (typeof simple.paxChild === "number" && extractedInfo.paxChild === undefined) {
    extractedInfo.paxChild = simple.paxChild;
  }
  if (simple.selectedDate && !extractedInfo.selectedDate) extractedInfo.selectedDate = simple.selectedDate;

  // === Blok 4: Email adımı (waiting_for_email) ===
  if (context.collectionStep === "waiting_for_email") {
    const emailFound = extractEmail(message);
    const skipFound = isEmailSkipRequest(message, context.language);
    if (emailFound) extractedInfo.email = emailFound;
    else if (skipFound) extractedInfo.emailSkipped = true;
  }

  // === Blok 5: Context-aware — isim (esnek mod) ===
  const expectedInput = getNextExpectedInput(context);

  if (expectedInput === "name" && !extractedInfo.fullName) {
    // 2026-07-03 J-16: vazgeçme+dolgu token elemesi (simple-extractor ile simetrik)
    const _giveUpDropRe5 = /^(boşver|bosver|kalsın|kalsin|neyse|vazgeç|vazgec|vazgeçtim|vazgectim|olsun|lütfen|lutfen|nevermind|forget|it)$/i;
    const words = message.trim().split(/\s+/)
      .map((w) => w.replace(/[.,!?;:"'()]/gu, ""))
      .filter((w) => w && !_giveUpDropRe5.test(w));
    if (
      words.length >= 2 &&
      words.length <= 4 &&
      !message.includes("?") &&
      !/\d/.test(message) &&
      words.every((w) => w.length >= 2)
    ) {
      // 2026-06-21 SORUN F GERÇEK KÖK: Blok 5 fallback path NLU K2+K3 gate'lerini
      // atlatıyordu. Canlı log (exec 9f040077): K2 4-word+negation reddetti
      // (updates.fullName silent drop), Blok 1/Blok 5 fallback mesajı direkt
      // parse edip Title-Case yazdı: "Murat Değil Aslında Ahmet".
      //
      // FIX: blacklist'e negation/correction tokens ekle (TR+EN, NLU_VALIDATION
      // ile aynı kapsam) + candidate'ı isNluFullNameNegationLeak+TourLeak gate
      // sigortasından geçir (K3 ile tek-kaynak savunma).
      const blacklist = [
        "evet", "hayır", "tamam", "olur", "haydi", "hadi", "rezervasyon",
        "onaylıyorum", "iptal", "cancel",
        // 2026-06-21 Sorun F: negation/correction (TR + EN)
        "değil", "aslında", "yerine",
        "not", "actually", "instead", "scratch",
      ];
      if (!blacklist.some((w) => message.toLowerCase().includes(w))) {
        const _candidate = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        // ASIL SİGORTA: candidate gate kontrolü (K3 ile aynı helper'lar, tek-kaynak)
        if (!isNluFullNameNegationLeak(_candidate) && !isNluFullNameTourLeak(_candidate)) {
          extractedInfo.fullName = _candidate;
        }
      }
    }
  }

  // === Blok 5b: Change-sinyalli İSİM pending (A-P1, 2026-07-03) ===
  // Canlı vaka P1: CONFIRMING'de "ismi düzelt, Ahmet Yılmaz olacak" → NLU Sorun F
  // correction-guard'ı yüzünden fullName null döner (meşru düzeltmeyi de yutar),
  // simple-extractor + Blok 5 step-gated (yalnız waiting_for_name) → CONFIRMING'de
  // fullName'in TEK kaynağı NLU'ydu → A3-name/BUG B körleşiyordu, isim sessizce
  // yutulup ESKİ isimle özet basılıyordu. X9-change (pax) deseninin İSİM kopyası.
  //
  // TITLE-CASE ŞARTI YOK (kritik tasarım kararı — canlı kanıt: kullanıcılar
  // "fulya koko", "leman tete" gibi küçük yazıyor; waiting_for_name yolu da
  // küçük harf kabul ediyor, pending yolu aynı toleransta).
  //
  // KOŞULLAR (dördü birden):
  //   1. NLU/simple fullName BULAMADI (bulduysa dokunma)
  //   2. CHANGE_KEYWORDS_RE — değişiklik sinyali
  //   3. context.reservationInfo.fullName DOLU — değişiklik bağlamı (ilk toplama değil)
  //   4. İSİM-BAĞLAM kelimesi mesajda VAR (isim/ismi/ad/adım/soyad/name...) — ŞART.
  //      Gerekçe: bağlam kelimesiz "aslında X Y" mesajlarında ("aslında yarın
  //      gelelim", "aslında daha erken olsun") kalan 2 kelime gate'lerden geçip
  //      İSİM SANILIRDI — gate'ler negation/tur/onay yakalar ama rastgele kelime
  //      çiftini yakalayamaz. Bağlam-kelimesiz meşru vaka ("aslında ahmet yılmaz")
  //      NLU'nun kolay vakası zaten (prompt "extract just X" der). Ayrıca bu şart
  //      "tarihi değiştir, öbürü olsun" tipi mesajları KAPIDA keser.
  //
  // ADAY TESPİTİ (konum+eleme): kelimelerden change-keyword / isim-bağlam / dolgu
  // elenetir; kalan tam 2-3 kelime, her biri harf-ağırlıklı + rakamsız + 2+ karakter.
  // ASIL SİGORTA (Sorun F tek-kaynak): aday isNluFullNameNegationLeak +
  // isNluFullNameTourLeak + onay-blacklist gate'lerinden geçmeli — "Murat değil
  // aslında Ahmet" (negation), "Efes Turuna Geçelim" (tour-leak) burada ölür.
  if (
    !extractedInfo.fullName &&
    (context.reservationInfo as any)?.fullName &&
    CHANGE_KEYWORDS_RE.test(message) &&
    /(?<![\p{L}\p{N}])(isim|ismi(?:m|mi)?|ad[ıi](?:m|mı|mi|n[ıi])?|ad|soyad[ıi]?|soyisim|name|namen?|имя|اسم|nom|nombre)(?![\p{L}\p{N}])/iu.test(message)
  ) {
    const _nameCtxRe = /^(isim|ismi|ismim|ismimi|ad|adı|adi|adım|adim|adını|adini|soyad|soyadı|soyadi|soyisim|name|namen|имя|اسم|nom|nombre)$/iu;
    const _fillerRe = /^(olacak|olacaktı|olacakti|olsun|olarak|olmalı|olmali|lütfen|lutfen|please|bi|bir|şey|sey|yeni|ve|de|da|mi|mı|mu|mü|artık|artik)$/iu;
    const _confirmRe = /^(evet|hayır|hayir|tamam|olur|onay\S*|iptal|cancel|yes|no|ok|okay)$/iu;
    const _tokens = message
      .split(/\s+/)
      .map((w) => w.replace(/[.,!?;:"'()]/gu, "").trim())
      .filter(Boolean);
    const _kept = _tokens.filter(
      (w) => !_nameCtxRe.test(w) && !_fillerRe.test(w) && !CHANGE_KEYWORDS_RE.test(w),
    );
    const _allWordLike = _kept.every(
      (w) => w.length >= 2 && !/\d/.test(w) && /^[\p{L}''.-]+$/u.test(w),
    );
    if ((_kept.length === 2 || _kept.length === 3) && _allWordLike) {
      const _candidate = _kept
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
      if (
        !isNluFullNameNegationLeak(_candidate) &&
        !isNluFullNameTourLeak(_candidate) &&
        !_kept.some((w) => _confirmRe.test(w))
      ) {
        extractedInfo.fullName = formatName(_candidate);
        console.log(`[info-extractor] A-P1 isim-pending: change-sinyalli isim kabul (step=${context.collectionStep}) — A3-name/BUG B devralacak`);
      }
    }
  }

  // === Blok 6: Context-aware — kişi sayısı (sadece düz rakam) ===
  // 2026-06-19 (Yan #1 fix): parseInt("5 temmuz")=5 tuzağı kapatıldı. Daha önce
  // mesaj başında rakam varsa pax yazılıyordu — "5 temmuz" tarihi pax=5 oldu.
  // Artık SADECE mesajın TAMAMI rakamsa kabul edilir. "3" → pax=3; "5 temmuz"
  // veya "11 aralık 2 kişi" → reddedilir (ikincisini Blok 5 zaten "kişi" ile yakalar).
  if (!extractedInfo.paxAdult && expectedInput === "pax") {
    const trimmed = message.trim();
    if (/^\d+$/.test(trimmed)) {
      const n = parseInt(trimmed);
      if (n >= 1 && n <= 50) extractedInfo.paxAdult = n;
    }
  }

  // 2026-07-09 FABLE-denetim: eski "Blok 7: date_N prefix çözümü" KALDIRILDI —
  // repo genelinde "date_N" ÜRETEN tek satır yok (üreticisiz tüketici; eski NLU
  // format kalıntısı). index_/day_ prefix'leri ayrı ve canlı (Blok 9/9c + aşağıda
  // kalıntı-temizlik).

  // === Blok 8: Numeric tarih girişi ("1", "2", "3") ===
  // 2026-06-22 Sorun H β fix: kontenjan check, dolu ise dateRejectedFull flag set
  // 2026-07-03 V1-parseInt (Yan #1'in TARİH simetriği — canlı Vaka 1 halka 4):
  // parseInt("1 kişi")=1 kuyruğu kırpıyordu → waiting_for_date'te "1 kişi"
  // mesajı LİSTE 1. TARİHİ SEÇİMİ sanıldı → silinen tarih YANLIŞ değerle geri
  // yazıldı → kullanıcı yanlış tarihle onayladı. Blok 6 pax'ta aynı fix
  // 2026-06-19'da yapılmıştı; tarih tarafı atlanmıştı. Artık SADECE mesajın
  // TAMAMI rakamsa liste seçimi sayılır ("1" ✓, "1 kişi" ✗).
  if (!extractedInfo.dateId && context.currentTour && (expectedInput === "date" || expectedInput === "date_selection") && /^\d+$/.test(message.trim())) {
    const n = parseInt(message.trim());
    if (!isNaN(n) && n >= 1) {
      const tour = findTourById(context.currentTour.id, tours);
      if (tour?.dates && n <= tour.dates.length) {
        const candidate = tour.dates[n - 1];
        if (hasQuotaForPax(candidate, 1)) {
          extractedInfo.selectedDate = candidate.departure_date;
          extractedInfo.dateId = candidate.id;
        } else {
          extractedInfo.dateRejectedFull = {
            departureDate: candidate.departure_date,
            remaining: getQuotaRemaining(candidate),
          };
        }
      }
    }
  }

  // === Blok 8.5: GÜN-ORDİNAL tarih eşleştirme (I-9 + V9 + İş 0, 2026-07-09) ===
  // Gün-sayısı KAYNAKLARI (3): apostroflu iyelik ("20'si/20'sine"), "ayın N",
  // ve NLU çıplak-sayı (dates=["20"] → Blok 2 selectedDate="20"). İş 0 kökü:
  // NLU ay-adsız ordinal'de çıplak "20" döndürüyordu → Blok 2 selectedDate="20"
  // → eski `!selectedDate` guard'ı Blok 8.5'i bloke ediyor → Blok 9 "20"yi
  // çözemiyor → RAW "20" şablona sızıyor ('"20" müsait değil'). "araığın 20'si"
  // çalışıyordu çünkü NLU orada Aralık'ı çıkarıp "20 aralık"/ISO dönüyor.
  {
    const _bareDate = typeof extractedInfo.selectedDate === "string" && /^\d{1,2}$/.test(extractedInfo.selectedDate);
    const _atDateStep = getNextExpectedInput(context) === "date" ||
      context.collectionStep === "waiting_for_date" || context.collectionStep === undefined;
    let _ordDay: number = NaN;
    const _apos = (message || "").match(_dateOrdinalRe);
    if (_apos) _ordDay = parseInt(_apos[1] || _apos[2]);
    if (isNaN(_ordDay)) {
      const _ayin = (message || "").match(/ay[ıi]n?\s*(\d{1,2})/i);
      if (_ayin) _ordDay = parseInt(_ayin[1]);
    }
    if (isNaN(_ordDay) && _bareDate && _atDateStep) _ordDay = parseInt(extractedInfo.selectedDate as string);

    if (_ordDay >= 1 && _ordDay <= 31 && !extractedInfo.dateId && context.currentTour) {
      // RAW çıplak-sayı ASLA state'e/şablona sızmasın.
      if (_bareDate) delete extractedInfo.selectedDate;

      // AY-NİTELEYİCİ: "bu ay(ın)" / "gelecek/önümüzdeki ay(ın)" / next month...
      // → o aya SINIRLI eşleşme (kullanıcı belirli ayı kastediyor).
      let _targetMonth: number | null = null;
      // Europe/Istanbul ayı (P4 dersi — UTC sunucusunda ay-sınırında kaymasın).
      const _istMonth = parseInt(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul", month: "numeric" }));
      // 2026-07-09 FAZ4-P1: AR ay-niteleyici eklendi (هذا الشهر / الشهر القادم).
      if (/(?<![\p{L}\p{N}])(bu\s+ay|this\s+month|dieser\s+monat|ce\s+mois|este\s+mes|этот\s+месяц|هذا\s+الشهر)/iu.test(message || "")) {
        _targetMonth = _istMonth;
      } else if (/(?<![\p{L}\p{N}])(gelecek\s+ay|[öo]n[üu]m[üu]zdeki\s+ay|next\s+month|n[äa]chsten?\s+monat|mois\s+prochain|pr[óo]ximo\s+mes|следующ\S*\s+месяц|الشهر\s+القادم|الشهر\s+المقبل)/iu.test(message || "")) {
        _targetMonth = _istMonth + 1 > 12 ? 1 : _istMonth + 1;
      }

      const _ordTour = findTourById(context.currentTour.id, tours);
      let _ordMatches = (_ordTour?.dates || []).filter((d: any) => {
        const p = d.departure_date?.match(/\d{4}-(\d{2})-(\d{2})/);
        return p && parseInt(p[2]) === _ordDay;
      });
      if (_targetMonth !== null) {
        _ordMatches = _ordMatches.filter((d: any) => {
          const p = d.departure_date?.match(/\d{4}-(\d{2})-\d{2}/);
          return p && parseInt(p[1]) === _targetMonth;
        });
      }
      // V10 soru-guard'ı: müsaitlik-kelimesi → :10e (seçim değil). Ayırıcı
      // müsaitlik-kelime, QUESTION_SIGNAL değil (zıt-yön dersi).
      // 2026-07-09 FAZ4-P1: TR+EN → 7-dil TEK KAYNAK (availability-words.ts).
      const _availQ = AVAILABILITY_RE.test(message || "");
      if (_availQ) {
        (extractedInfo as any).availabilityQueryDay = _ordDay;
      } else if (_ordMatches.length === 1) {
        const cand = _ordMatches[0];
        if (hasQuotaForPax(cand, 1)) {
          extractedInfo.selectedDate = cand.departure_date;
          extractedInfo.dateId = cand.id;
          console.log(`[info-extractor] Blok 8.5 gün-ordinal=${_ordDay}${_targetMonth ? ` ay=${_targetMonth}` : ""} → dateId eşleşti`);
        } else {
          extractedInfo.dateRejectedFull = { departureDate: cand.departure_date, remaining: getQuotaRemaining(cand) };
        }
      } else if (_ordMatches.length > 1) {
        // V9 çift-eşleşme → :10f netleştirme (SESSİZ İLK-SEÇİM YOK).
        (extractedInfo as any).dateAmbiguousDay = _ordDay;
        console.log(`[info-extractor] V9 Blok 8.5: gün=${_ordDay} çok eşleşme (${_ordMatches.length}) → netleştirme`);
      } else {
        // Sıfır eşleşme: RAW temizlendi (yukarıda) → :11 liste devralır (yanıltıcı
        // tırnaklı "20 müsait değil" YOK). Ay-niteleyicili sıfırda availabilityQueryDay
        // ile ":10e görünmüyor" tercih edilir (kullanıcı belirli ay istedi).
        if (_targetMonth !== null) (extractedInfo as any).availabilityQueryDay = _ordDay;
        console.log(`[info-extractor] Blok 8.5: gün=${_ordDay} eşleşme YOK → ${_targetMonth ? ":10e görünmüyor" : ":11 liste"}`);
      }
    }
  }

  // === Blok 9: String tarih eşleştirme (DD.MM.YYYY, YYYY-MM-DD, gün+ay) ===
  // 2026-06-22 Sorun H β fix: aynı kontenjan check.
  // 2026-06-29 O1 fix: birleşik mesajda (tur+tarih aynı turn) context.currentTour
  // henüz null olabilir; bu turn'de matchlenen selectedTour'u fallback kullan.
  // Tek tarih senaryosunda context.currentTour zaten dolu → fallback devreye girmez.
  const _activeTourIdForDate = context.currentTour?.id || params.selectedTour?.id;
  if (extractedInfo.selectedDate && !extractedInfo.dateId && _activeTourIdForDate) {
    const tour = findTourById(_activeTourIdForDate, tours);
    if (tour?.dates?.length > 0) {
      const matched = matchDateWithTourDates(extractedInfo.selectedDate, tour.dates);
      if (matched) {
        if (hasQuotaForPax(matched, 1)) {
          extractedInfo.selectedDate = matched.departure_date;
          extractedInfo.dateId = matched.id;
        } else {
          extractedInfo.dateRejectedFull = {
            departureDate: matched.departure_date,
            remaining: getQuotaRemaining(matched),
          };
          // selectedDate'i de SIL — kullanıcının yazımı state'e işlenmesin
          delete extractedInfo.selectedDate;
        }
      }
    }
  }

  // === Blok 9c: "ayın 20" (apostrofsuz) day_ prefix çözümü + V9 (2026-07-09) ===
  // simple-extractor "ayın 20"yi day_20 üretir (tourDates'siz çağrıldığı için).
  // Blok 9 matchDateWithTourDates day_ prefix'i tek-eşleşmede çözer, çoklu-
  // eşleşmede null döner → RAW "day_20" selectedDate'te KALIR (state sızıntısı).
  // Burada: tek→seç, çoklu→V9 netleştirme flag + raw temizle, sıfır→raw temizle.
  {
    const _dayPfx = (extractedInfo.selectedDate as any)?.match?.(/^day_(\d+)$/);
    if (_dayPfx && !extractedInfo.dateId && context.currentTour) {
      const _pd = parseInt(_dayPfx[1]);
      const _pTour = findTourById(context.currentTour.id, tours);
      const _pMatches = (_pTour?.dates || []).filter((d: any) => {
        const p = d.departure_date?.match(/\d{4}-\d{2}-(\d{2})/);
        return p && parseInt(p[1]) === _pd;
      });
      delete extractedInfo.selectedDate; // raw day_ ASLA state'e sızmasın
      if (_pMatches.length === 1 && hasQuotaForPax(_pMatches[0], 1)) {
        extractedInfo.selectedDate = _pMatches[0].departure_date;
        extractedInfo.dateId = _pMatches[0].id;
      } else if (_pMatches.length > 1) {
        (extractedInfo as any).dateAmbiguousDay = _pd;
        console.log(`[info-extractor] V9 Blok 9c: 'ayın ${_pd}' çok eşleşme → netleştirme`);
      }
    }
  }

  // === Blok 9d: relative_ prefix TÜKETİCİSİ (V8-ucuz, 2026-07-09) ===
  // simple-extractor artık tourDates ile çağrılıyor (Blok 3) → "yarın/öbür gün"
  // (extractRelativeDate, 7 dil) tur tarihiyle KESİŞİRSE dateId dolar (done).
  // Kesişmezse selectedDate="relative_YYYY-MM-DD" kalır — ESKİDEN tüketicisi
  // yoktu (ölü-flag dersi), RAW "relative_..." şablona sızardı. Burada:
  // eşleşme YOK demek → o tarihte tur yok → RAW temizle → :11 liste devralır
  // (yanıltıcı 'relative_2026-07-10 müsait değil' ASLA). NOT: "hafta sonu/ay
  // ortası" bu pakette DEĞİL (M-L, Sonnet-pilotu sonrası → Açık Sorular).
  if (typeof extractedInfo.selectedDate === "string" && extractedInfo.selectedDate.startsWith("relative_")) {
    const _relIso = extractedInfo.selectedDate.slice("relative_".length);
    delete extractedInfo.selectedDate;
    if (!extractedInfo.dateId && _activeTourIdForDate) {
      const _rt = findTourById(_activeTourIdForDate, tours);
      const _rm = (_rt?.dates || []).find((d: any) => d.departure_date === _relIso);
      if (_rm && hasQuotaForPax(_rm, 1)) {
        extractedInfo.selectedDate = _rm.departure_date;
        extractedInfo.dateId = _rm.id;
        console.log(`[info-extractor] Blok 9d: göreli tarih ${_relIso} → dateId eşleşti`);
      } else {
        console.log(`[info-extractor] Blok 9d: göreli tarih ${_relIso} tur tarihlerinde yok → :11 liste`);
      }
    }
  }

  // === Blok 9e: day_/index_ KALINTI-TEMİZLİK (FABLE-denetim, 2026-07-09) ===
  // day_ (simple, tourDates yokken) ve index_ (simple "ikinci tarih", şartsız)
  // prefix'lerinin tüketicileri (Blok 9/9c) AKTİF TURA kapılı — tur yokken
  // (BROWSING, tursuz "ikinci tarih") ham "index_1"/"day_20" selectedDate'te
  // KALIYORDU → state-machine selectedDate'i transition-sinyali sayar + şablon
  // sızıntı riski (relative_ vakasının sınıf-kardeşi). Çözülemeyen prefix ASLA
  // state'e sızmaz — sil, akış normal yoluna (liste/LLM) düşer.
  if (typeof extractedInfo.selectedDate === "string" && /^(?:day|index)_/.test(extractedInfo.selectedDate)) {
    console.log(`[info-extractor] Blok 9e: çözülemeyen prefix "${extractedInfo.selectedDate}" temizlendi (tur bağlamı yok)`);
    delete extractedInfo.selectedDate;
  }

  // === Blok 9b: X9-change pending pax kararı (2026-07-03) ===
  // Blok 1'de pending'e alınan change-sinyalli pax burada karara bağlanır —
  // kullanıcı-kaynaklı tarih sinyalleri (Blok 2-9) tamamlandı, Blok 10 (otomatik
  // atama) henüz çalışmadı. Bilinçli konum: Blok 10'un auto-assign dateId'si
  // kullanıcının mesajından GELMEZ, pending iptaline sebep olmamalı.
  // Tarih çıktıysa (dateId/selectedDate/dateRejectedFull) sayı TARİH'ti
  // ("aslında 3'ü olsun" = ayın 3'ü) → pax İPTAL, tarih akışı kazanır —
  // X9'un tarih→pax sızıntı koruması delinmez.
  if (_pendingChangePaxAdult !== null) {
    const _dateSignalThisTurn =
      !!extractedInfo.dateId || !!extractedInfo.selectedDate || !!extractedInfo.dateRejectedFull;
    if (_dateSignalThisTurn) {
      console.log(`[info-extractor] X9-change: pending paxAdult=${_pendingChangePaxAdult} İPTAL (aynı turn'de tarih sinyali var — tarih akışı kazanır)`);
    } else {
      extractedInfo.paxAdult = _pendingChangePaxAdult;
      if (_pendingChangePaxChild !== null) extractedInfo.paxChild = _pendingChangePaxChild;
      console.log(`[info-extractor] X9-change: pending paxAdult=${_pendingChangePaxAdult} KABUL (tarih sinyali yok, A2 dalı devralacak)`);
    }
  }

  // === Blok 10: Tek tarih otomatik seçim ===
  // 2026-06-21 Sorun C fix: dateAutoAssigned flag eklendi. process-message
  // :11a-AUTO-DATE-ACK bu flag'i görür → kullanıcıya seçilen tarihi onaylatır.
  // Flag SADECE Blok 10 set eder; kullanıcı kendi tarih verdiyse (Blok 2/3/8/9)
  // bayrak yok → bypass tetiklenmez → çift mesaj riski sıfır.
  //
  // 2026-06-22 Sorun H β fix: tek tarihli tur DOLU ise otomatik atama yapma.
  //
  // 2026-06-25 KÖK 5 devamı: tur değişimi (erken-müdahale) sonrası ATLAYACAK.
  // produceTourChangeContext eski dateId/selectedDate'i sildi + waiting_for_date
  // ayarladı; Blok 10 yeni turun tek tarihini sessizce atamasın → kullanıcı
  // yeni turun tarihini onaylasın (deterministik :11 tarih listesi tetiklenir).
  if (
    !params.tourJustChanged &&
    !extractedInfo.dateId &&
    !extractedInfo.selectedDate &&
    context.currentTour?.dates?.length === 1 &&
    (fsmIntent === "provide_info" || fsmIntent === "confirm" || fsmIntent === "reservation_intent")
  ) {
    const single = context.currentTour.dates[0];
    if (hasQuotaForPax(single, 1)) {
      extractedInfo.selectedDate = single.departure_date;
      extractedInfo.dateId = single.id;
      extractedInfo.dateAutoAssigned = true;     // :11a-AUTO-DATE-ACK sinyali
    } else {
      extractedInfo.dateRejectedFull = {
        departureDate: single.departure_date,
        remaining: getQuotaRemaining(single),
      };
    }
  }

  return extractedInfo;
}
