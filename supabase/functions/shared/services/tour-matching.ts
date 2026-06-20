// Shared tour matching service — 3 katmanlı eşleştirme:
// 1. Exact (normalize edilmiş)  2. Translation map  3. Fuzzy (Levenshtein-2)

export { findTourById } from "../fsm/tour-matcher.ts";
import { isMeaningfulTourKeyword } from "../constants/tour-matching.ts";

function normalizeNluField(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string" && v.trim().length > 0);
  if (typeof value === "string" && value.trim().length > 0) return [value];
  return [];
}

// ─── Normalize yardımcıları ───────────────────────────────────────────────────

/**
 * Türkçe özel karakterleri karşılaştırma için ASCII'ye çevirir.
 * "İstanbul" → "istanbul", "Kapadokya" → "kapadokya"
 */
function normalizeTurkishChars(text: string): string {
  return text
    .replace(/İ/g, "i").replace(/ı/g, "i")
    .replace(/Ş/g, "s").replace(/ş/g, "s")
    .replace(/Ğ/g, "g").replace(/ğ/g, "g")
    .replace(/Ü/g, "u").replace(/ü/g, "u")
    .replace(/Ö/g, "o").replace(/ö/g, "o")
    .replace(/Ç/g, "c").replace(/ç/g, "c");
}

/** Karşılaştırma için lowercase + Türkçe karakter normalize */
function normalizeForMatch(text: string): string {
  if (!text) return "";
  return normalizeTurkishChars(text.toLowerCase().trim());
}

// ─── Çeviri haritası ─────────────────────────────────────────────────────────

/**
 * Türkçe tur/destinasyon anahtar kelimesi → diğer dillerdeki eşdeğerleri.
 * EN/DE/FR/ES/RU/AR kullanıcıların Türkçe tur isimlerine match etmesi için.
 */
// BUG #4 FIX: Genişletilmiş fallback map — Türkiye'nin yaygın turistik destinasyonları.
// title_xx alanları boş kaldığında yabancı müşterinin kelimelerini TR karşılığına eşler.
// title_xx doluysa zaten direkt matching → bu map fallback'tir.
const TOUR_NAME_TRANSLATIONS: Record<string, string[]> = {
  // Ana destinasyonlar (eski)
  kapadokya: [
    "cappadocia", "cappadoce", "kappadokien", "capadocia",
    "каппадокия", "كابادوكيا", "kappadokia", "kapadokia",
    "cappodocia", "cappadokia",
  ],
  efes: ["ephesus", "ephese", "efeso", "эфес", "أفسس", "ephesos"],
  troya: ["troy", "troie", "troja", "троя", "طروادة"],
  pamukkale: ["pamukkale", "памуккале", "بامو كالي", "cotton castle"],
  antalya: ["antalya", "антальи", "أنطاليا", "antalia"],
  bodrum: ["bodrum", "halicarnassus", "галикарнас"],
  fethiye: ["fethiye", "telmessos"],
  nemrut: ["nemrut", "nemrud", "немрут"],
  istanbul: ["istanbul", "istambul", "стамбул", "إسطنبول", "konstantinopel", "estambul"],
  ankara: ["ankara", "анкара", "أنقرة"],
  izmir: ["izmir", "smyrna", "smyrne", "измир", "إزمير"],
  alanya: ["alanya", "алания", "ألانيا"],
  antalya_belek: ["belek"],
  kapadokya_balon: ["cappadocia balloon", "kappadokien ballon", "hot air balloon cappadocia"],

  // YENİ — Akdeniz/Ege turistik yerleri
  likya: ["lycia", "lycian way", "lykischer weg", "voie lycienne", "ликийская тропа", "الطريق الليكي", "vía licia"],
  oludeniz: ["oludeniz", "blue lagoon", "ölüdeniz", "blaue lagune", "lagon bleu", "голубая лагуна"],
  saklikent: ["saklikent", "saklıkent canyon", "saklikent canyon"],
  demre: ["demre", "myra", "kekova", "santa claus", "sunken city", "battık şehir"],
  konya: ["konya", "mevlana", "rumi", "whirling dervishes", "derwische", "дервиши", "konia"],
  bursa: ["bursa", "uludag", "uludağ", "брusa", "бурса"],
  trabzon: ["trabzon", "trabzond", "трабзон"],
  uzungol: ["uzungol", "uzungöl", "long lake", "узунгёль"],
  ayder: ["ayder", "ayder plateau", "айдер"],
  sumela: ["sumela", "sumela monastery", "sümela", "сумелa"],
  mardin: ["mardin", "midyat", "мардин", "ماردين"],
  hasankeyf: ["hasankeyf", "hasankef"],
  sanliurfa: ["urfa", "sanliurfa", "şanlıurfa", "санлыурфа"],
  gobeklitepe: ["gobekli", "göbekli", "gobeklitepe", "göbeklitepe", "göbekli tepe", "гёбекли"],
  gaziantep: ["gaziantep", "antep", "газиантеп"],
  van: ["van lake", "van gölü", "van gölü", "vansee"],
  abant: ["abant", "abant lake"],
  sapanca: ["sapanca", "sapanca lake", "сапанджа"],
  sile: ["sile", "şile"],
  agva: ["agva", "ağva"],
  salda: ["salda", "salda lake", "salda gölü", "salda see"],

  // YENİ — Aktivite tabanlı turlar
  trekking: ["trekking", "hiking", "wandern", "randonnée", "senderismo", "треккинг"],
  yayla: ["highland", "plateau", "hochland", "плато"],
  kanyon: ["canyon", "schlucht", "ущелье"],
  gol: ["lake", "see", "lac", "lago", "озеро"],
  tekne: ["boat tour", "boat trip", "bootstour", "excursion en bateau", "лодка", "yacht"],
  paragliding: ["paragliding", "parapente", "gleitschirm", "параплан"],
  cruise: ["cruise", "kreuzfahrt", "croisière", "круиз"],
  dalis: ["diving", "scuba", "tauchen", "plongée", "buceo", "дайвинг"],
  safari: ["safari", "jeep safari", "сафари"],
  rafting: ["rafting", "river rafting", "wildwasser"],
};

/**
 * Girilen kelimenin Türkçe karşılığını bulur.
 * "cappadocia" → "kapadokya", "ephesus" → "efes"
 */
function findTurkishEquivalent(input: string): string | null {
  const normalized = normalizeForMatch(input);
  if (TOUR_NAME_TRANSLATIONS[normalized]) return normalized;
  for (const [trName, aliases] of Object.entries(TOUR_NAME_TRANSLATIONS)) {
    if (aliases.some((a) => normalizeForMatch(a) === normalized)) return trName;
  }
  return null;
}

// ─── Levenshtein fuzzy match ─────────────────────────────────────────────────

/** İki string arasındaki edit mesafesi — yazım hatası toleransı için. */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (Math.abs(a.length - b.length) > 3) return 99; // hızlı red

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev.splice(0, prev.length, ...curr);
  }
  return prev[b.length];
}

/**
 * BUG #2 FIX: Bir turun tüm dil varyantlarını matching için topla.
 * Hem aktif lokalize alanlar (title, destination), hem de DB'de tutulan
 * tüm title_xx (title_tr/en/de/ru/ar/fr/es) ve destination_tr alanlarına bakar.
 * Yabancı müşteri kendi dilinde tur adı yazınca eşleştirme yapılabilsin.
 */
function getTourSearchableTexts(t: any): string[] {
  const fields = [
    t.title,
    t.destination,
    t.title_tr, t.title_en, t.title_de, t.title_ru, t.title_ar, t.title_fr, t.title_es,
    // BUG #3 FIX: destination_xx alanları da matching havuzunda
    t.destination_tr, t.destination_en, t.destination_de, t.destination_ru,
    t.destination_ar, t.destination_fr, t.destination_es,
  ];
  return fields.filter((s) => typeof s === "string" && s.trim().length > 0);
}

/**
 * Sorgu ile tur listesini fuzzy eşleştir (Levenshtein ≤ maxDist).
 * Her tur başlığındaki ve destinasyonundaki kelimelerle karşılaştırır.
 * BUG #2: tüm dil varyantları da fuzzy havuzunda.
 */
function fuzzyMatchTours(query: string, tours: any[], maxDist = 2): any[] {
  const nq = normalizeForMatch(query);
  if (nq.length < 4) return []; // çok kısa kelimeler için bypass
  return tours.filter((t) => {
    const allTexts = getTourSearchableTexts(t);
    const words: string[] = [];
    for (const text of allTexts) {
      words.push(...normalizeForMatch(text).split(/\s+/));
    }
    return words.some((w) => w.length >= 4 && levenshteinDistance(nq, w) <= maxDist);
  });
}

// ─── Tek sorgu için tüm stratejiler ─────────────────────────────────────────

/**
 * Bir sorgu kelimesi için 3 katmanlı tur arama:
 * 1. Exact match (normalize edilmiş)
 * 2. Translation map (Cappadocia → Kapadokya)
 * 3. Fuzzy match (Levenshtein-2)
 */
function matchByQuery(query: string, tours: any[], checkDest = false): any[] {
  const normalized = normalizeForMatch(query);

  // 1. Exact (normalize) — BUG #2 FIX: tüm dil varyantlarına bak
  let hits = tours.filter((t) => {
    const allTexts = getTourSearchableTexts(t);
    return allTexts.some((text) => {
      const nText = normalizeForMatch(text);
      // checkDest=false ise sadece title alanları sayılır, destination'lara TR-eşdeğer üzerinden bakılır
      return nText.includes(normalized);
    });
  });
  if (hits.length > 0) return hits;

  // 2. Translation map (TR-eşdeğeri)
  const trName = findTurkishEquivalent(query);
  if (trName) {
    hits = tours.filter((t) => {
      const allTexts = getTourSearchableTexts(t);
      return allTexts.some((text) => normalizeForMatch(text).includes(trName));
    });
    if (hits.length > 0) return hits;
  }

  // 3. Fuzzy match (tüm dil varyantları havuzda)
  hits = fuzzyMatchTours(query, tours, 2);
  return hits;
}

// ─── Ana interface ────────────────────────────────────────────────────────────

export interface TourMatchResult {
  selectedTour: any | null;
  multipleMatches: any[];
  /**
   * 2026-06-20 (Bug 2 fix): Kullanıcı tur arıyor (intent tour_search/reservation_intent)
   * AMA hiçbir stratejide eşleşme yok → DB'de gerçekten yok. process-message bu sinyali
   * görür ve deterministik "X turu sistemimizde bulunmuyor" mesajı atar.
   * Null ise: ya eşleşme var ya da kullanıcı tur aramıyor (sinyal yok).
   */
  unknownTourQuery: string | null;
}

function createTourRef(tour: any): any {
  return {
    id: tour.id,
    title: tour.title,
    destination: tour.destination,
    type: tour.type,
    currency: tour.currency,
    dates: tour.dates,
    program_kisa: tour.program_kisa,
    gezilecek_yerler: tour.gezilecek_yerler,
    // 2026-06-20 Bug 4: saat/kalkış/süre state'e taşınmalı, yoksa formatTourDetails
    // bu alanları göremez ve LLM uydurur (Pamukkale 07:00 vs 08:00 canlı bug).
    toplanma_saati: tour.toplanma_saati,
    hareket_noktasi: tour.hareket_noktasi,
    tur_sure: tour.tur_sure,
  };
}

/**
 * NLU output validation gate (2026-06-20 Bug 1 fix).
 *
 * NLU bağlamdan MESAJDA OLMAYAN tur adı UYDURUYORDU (örn. mesaj "efes turu ne zaman"
 * ama NLU destination="Kapadokya" döndürür — "Kapadokya" mesajda yok, history bias).
 * Bu helper NLU çıktısının kullanıcı mesajında gerçekten karşılığı olup olmadığını
 * doğrular. Yoksa NLU output YOKSAYILIR — uydurmaya tour-matching güvenmez.
 *
 * Doğrulama 2 katmanlı:
 *   1. Direkt: NLU kelimesi mesajda (normalize) geçiyor mu?
 *   2. Translation: NLU kelimesi TR ana adlardan biriyse, varyantları
 *      (cappadocia, ephesus, vs.) mesajda geçiyor mu? Yabancı dil senaryosu.
 */
function isNluOutputInMessage(nluWord: string, message: string): boolean {
  if (!nluWord || !nluWord.trim()) return false;
  const normMsg = normalizeForMatch(message);
  const normNlu = normalizeForMatch(nluWord);
  if (normMsg.includes(normNlu)) return true;
  // Translation map: yabancı dil kullanıcısı için
  if (TOUR_NAME_TRANSLATIONS[normNlu]) {
    return TOUR_NAME_TRANSLATIONS[normNlu].some((variant) =>
      normMsg.includes(normalizeForMatch(variant)),
    );
  }
  // Bidirectional: NLU "Cappadocia" demiş olabilir, mesajda "kapadokya"
  for (const [trName, aliases] of Object.entries(TOUR_NAME_TRANSLATIONS)) {
    if (aliases.some((a) => normalizeForMatch(a) === normNlu)) {
      if (normMsg.includes(trName)) return true;
    }
  }
  return false;
}

/**
 * Yeni strateji sıralaması (2026-06-20 Bug 1/2 kök çözümü):
 *
 *   Strateji 1 (KANITSAL — mesaj kelimeleri):
 *     Kullanıcı mesajının kendi kelimelerinden (stopword filtreli) match dene.
 *     Bu KANITSAL kaynaktır: kelime zaten kullanıcının yazdığı şey.
 *
 *   Strateji 2 (NLU tour_name, validated):
 *     NLU'nun çıkardığı tur adı mesajda DOĞRULANIRSA kullan.
 *     NLU bağlamdan uydurmuşsa (mesajda yok) YOKSAY.
 *
 *   Strateji 3 (NLU destination, validated):
 *     Aynı validation gate.
 *
 * UNKNOWN_TOUR sinyali:
 *   Strateji 1'de anlamlı kelime kaldı (stopword sonrası) AMA hiçbir tur'la
 *   eşleşmedi VE intent tour_search/reservation_intent → kullanıcı bir tur
 *   arıyor ama DB'de yok → process-message'da deterministik "X turu yok" mesajı.
 */
export function findMatchingTours(
  message: string,
  nluEntities: any,
  availableTours: any[],
  expectedInput: string,
  intent: string,
): TourMatchResult {
  const tourNames = normalizeNluField(nluEntities?.tour_name);
  const destinations = normalizeNluField(nluEntities?.destination);

  // B-5 fix (2026-06-09): isim/telefon adımında tur eşleştirme kapalı (Özge bug).
  // 2026-06-20 (Bug 1 v2 — gevşetme): İKİ KATMANLI gate. B-5 fix sadece kullanıcı
  // AÇIKÇA tur sorduğunda gevşer.
  //
  // Canlı bug (execution 0a643c9d): kullanıcı waiting_for_name adımındayken
  // "Efes Antik Turu nedir?" yazınca tour-matching tamamen kapalıydı → erken
  // müdahale tetiklenmiyordu → currentTour Kapadokya'da kaldı.
  //
  // Yeni mantık: hasNluTourSignal = (NLU tour_name VEYA destination çıkardı)
  //              AND (intent açıkça tur sorgulama — provide_info DEĞİL).
  // İki katman birden olmalı. Özge bug korunur: NLU "Özge Yılmazer"i tour_name
  // diye yorumlasa bile intent=provide_info kaldığı için 2. katman KAPATIR.
  if (expectedInput === "name" || expectedInput === "phone") {
    // 2026-06-20 (Sorun 1 — change_info eklendi):
    // Canlı bug (execution eef20d45): waiting_for_name'de "Efes turu rezervasyonu
    // istiyorum" → NLU intent=change_info, tour_name="Efes Turu". Mevcut listede
    // change_info yoktu → hasNluTourSignal=false → tour-matching kapalı →
    // erken müdahale tetiklenmedi → LLM "hangisini istersiniz" sordurdu.
    // change_info eklendi. 2. katman gate (hasNluTourSignal AND tour sinyal)
    // "tarihimi değiştirmek istiyorum" gibi non-tur change_info'ları korur.
    const explicitTourIntent =
      intent === "tour_search" ||
      intent === "browse_tours" ||
      intent === "faq_general" ||
      intent === "reservation_intent" ||
      intent === "change_info";
    const hasNluTourSignal =
      (tourNames.length > 0 || destinations.length > 0) && explicitTourIntent;
    if (!hasNluTourSignal) {
      return { selectedTour: null, multipleMatches: [], unknownTourQuery: null };
    }
    // hasNluTourSignal=true → düş, normal tour-matching mantığı devam eder
  }

  const tourIntents = [
    "browse_tours",
    "tour_search",
    "select_tour",
    "hotel_details",
    "transport_details",
    "reservation_intent",
  ];

  const shouldMatch = tourIntents.includes(intent) || tourNames.length > 0 || destinations.length > 0;
  if (!shouldMatch) {
    return { selectedTour: null, multipleMatches: [], unknownTourQuery: null };
  }

  let selectedTour: any = null;
  let multipleMatches: any[] = [];

  // ─── Strateji 1: KANITSAL — Mesaj kelimeleri (öncelikli) ─────────────────
  // Mesaj kelimelerine STOPWORD filtre uygula ("turu", "tour" gibi kelimeler
  // tüm turlarda var → yanlış pozitif kaynağı; ELE). Geriye kalan anlamlı
  // kelimelere matchByQuery (exact + translation + fuzzy).
  const msgWords = message
    .split(/\s+/)
    .map((w) => w.replace(/[?!.,;:()*"']/g, "")) // noktalama temizle
    .filter(isMeaningfulTourKeyword); // 3+ harf + stopword değil

  const seenTourIds = new Set<string>();
  for (const word of msgWords) {
    const matches = matchByQuery(word, availableTours, true);
    for (const m of matches) {
      if (!seenTourIds.has(m.id)) {
        seenTourIds.add(m.id);
        multipleMatches.push(m);
      }
    }
  }
  if (multipleMatches.length === 1) {
    selectedTour = createTourRef(multipleMatches[0]);
    multipleMatches = [];
  }

  // ─── Strateji 2: NLU tour_name (validated) ────────────────────────────────
  if (!selectedTour && multipleMatches.length === 0) {
    for (const name of tourNames) {
      if (selectedTour || multipleMatches.length > 0) break;
      // NLU validation gate: NLU çıktısı mesajda gerçekten var mı?
      if (!isNluOutputInMessage(name, message)) continue; // uydurma → atla
      const matches = matchByQuery(name, availableTours, false);
      if (matches.length === 1) {
        selectedTour = createTourRef(matches[0]);
      } else if (matches.length > 1) {
        multipleMatches = matches;
      }
    }
  }

  // ─── Strateji 3: NLU destination (validated) ──────────────────────────────
  if (!selectedTour && multipleMatches.length === 0) {
    for (const dest of destinations) {
      if (selectedTour || multipleMatches.length > 0) break;
      if (!isNluOutputInMessage(dest, message)) continue; // uydurma → atla
      const matches = matchByQuery(dest, availableTours, true);
      if (matches.length === 1) {
        selectedTour = createTourRef(matches[0]);
      } else if (matches.length > 1) {
        multipleMatches = matches;
      }
    }
  }

  // ─── UNKNOWN_TOUR sinyali (2026-06-20 B dalı) ──────────────────────────────
  // Strateji 1'de anlamlı kelime KALDI (stopword sonrası) AMA hiçbir match yok VE
  // intent gerçek tur arama → kullanıcı bir tur arıyor ama DB'de yok.
  // process-message bu sinyali görür → deterministik "X turu sistemimizde yok".
  let unknownTourQuery: string | null = null;
  const isBookingIntent = intent === "tour_search" || intent === "reservation_intent";
  const noMatchAtAll = !selectedTour && multipleMatches.length === 0;
  if (isBookingIntent && noMatchAtAll && msgWords.length > 0) {
    // En uzun anlamlı kelimeyi sinyal olarak gönder (deterministik mesajda kullanılır)
    unknownTourQuery = msgWords.reduce((a, b) => (b.length > a.length ? b : a));
  }

  // ─── 2026-06-20: EGE BUG TEŞHİS LOG'U ──────────────────────────────────────
  // Canlı bug (execution a2a42648): kullanıcı BROWSING'de "ege" yazdı, log
  // "UNKNOWN_TOUR signal: ege" görüldü. Behavioral test'te tours array'inde
  // "Ege Turu" varken matchByQuery("ege", tours, true) → [Ege Turu] döner ✓.
  // Production'da bulunamıyor. Olası kökler: (1) tours cache'de Ege Turu yok,
  // (2) title field'ı boş veya farklı formatta, (3) tour objesi alan adları
  // (title_xx vs destination_xx) farklı.
  //
  // Bu log SADECE UNKNOWN_TOUR sinyali tetiklendiğinde çalışır → noise düşük.
  // tours preview'i ilk 10 turu listeler → Ege Turu var mı + title yapısı görünür.
  // Yan teşhis için matchByQuery'yi tekrar çağırıp her kelime için kaç hit
  // bulduğunu yan log'lar.
  if (unknownTourQuery) {
    const _toursPreview = (availableTours || []).slice(0, 12).map((t) => ({
      id: t?.id?.slice?.(0, 8),
      title: t?.title,
      title_tr: t?.title_tr,
      destination: t?.destination,
      destination_tr: t?.destination_tr,
    }));
    const _wordHits: Record<string, number> = {};
    for (const w of msgWords) {
      try {
        _wordHits[w] = matchByQuery(w, availableTours || [], true).length;
      } catch {
        _wordHits[w] = -1;
      }
    }
    console.log("[tour-matching] DEBUG UNKNOWN_TOUR teşhisi:", JSON.stringify({
      query: unknownTourQuery,
      msgWords,
      wordHits: _wordHits,
      intent,
      toursCount: availableTours?.length ?? 0,
      nluTourNames: tourNames,
      nluDestinations: destinations,
      toursPreview: _toursPreview,
    }, null, 2));
  }

  return { selectedTour, multipleMatches, unknownTourQuery };
}
