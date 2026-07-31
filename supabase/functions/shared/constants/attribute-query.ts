// ═══════════════════════════════════════════════════════════════════════════
// B-ATTR: TUR-BAĞLAMSIZ ÖZNİTELİK SORUSU TESPİTİ (W4 kökü, 2026-07-31)
//
// KÖK VAKA (canlı WhatsApp, 30 Tem 14:46 UTC / 17:46 yerel):
//   müşteri: "Hangi şehirden çıkışlı, hiç bilgi yok"
//   bot:     "Turlarımızın kalkış yeri bilgileri için lütfen acentemizle
//             iletişime geçin: 📞 +90 541 650 03 03"
//   4 dk sonra tur seçilince: "🚌 Kalkış noktası: Nevşehir Merkez" — veri VARDI.
//
// NEDEN oluyordu: tur seçilmemişken prompt'a giden tur listesi (formatToursList)
// yalnız başlık/destinasyon/gezilecek_yerler/fiyat/ilk-tarih taşıyor.
// hareket_noktasi · toplanma_saati · konaklama · ulasim · price_child prompt'a
// HİÇ girmiyor → LLM alanı "boş" görüyor → prompt kuralı (stages/index.ts:67 ve
// _defaultGuard:336) gereği acenteye yönlendiriyor. Kural doğru, veri eksikti.
//
// ÇÖZÜM: prompt kurallarına DOKUNMADAN (uydurma bariyeri onlar), LLM'e hiç
// bırakmadan DB'den deterministik karşılaştırmalı liste üret. Desen B-DUR2'den
// ("3 günlük turlarınız") alındı — o blok bu sınıfta zaten doğru çalışıyordu.
//
// ⚠️ ASCII \b KULLANILMAZ (Yan #8) — TR/RU/AR harfleri sınır saymıyor.
//    Desenler BAŞTAN (?<![\p{L}\p{N}]) lookbehind ile sarılır; kelime ORTASINDA
//    eşleşme böyle engellenir.
// ⚠️ KUYRUK lookahead'i BİLEREK YOK: bunlar SAP desenleri ve TR/RU sondan-ekli
//    dillerdir — "kalk|otelden al|проживани|saat kaç" saplarına (?![\p{L}\p{N}])
//    eklenince "kalkıyor · alıyor musunuz · проживание · saat kaçta" hepsi
//    KAÇIYORDU (ilk korpus koşumunda 6 pozitif kırmızı verdi). Sap + serbest ek.
// ═══════════════════════════════════════════════════════════════════════════

export type AttrKey = "child_price" | "accommodation" | "transport" | "time" | "departure";

/**
 * SIRA ÖNEMLİ — en dar desen önce.
 * "otelde konaklama dahil mi" → accommodation
 * "otelden alıyor musunuz"    → transport
 * İkisi de "otel" içerdiği için accommodation ÖNCE denenir ve kendi
 * anahtar kelimeleriyle (konaklama/otel dahil) ayrışır.
 */
export const ATTR_PATTERNS: ReadonlyArray<{ key: AttrKey; re: RegExp }> = [
  {
    key: "child_price",
    re: /(?<![\p{L}\p{N}])(?:[çc]ocuk\s*(?:[üu]cret|fiyat|indirim|tarife|ka[çc]\s*para)|[çc]ocuklar\s*i[çc]in\s*(?:[üu]cret|fiyat)|child(?:ren)?\s*(?:price|fee|rate|cost)|kids?\s*price|kinder(?:preis|tarif)|preis\s*f[üu]r\s*kinder|(?:tarif|prix)\s*enfant|precio\s*(?:ni[ñn]o|infantil)|tarifa\s*infantil|(?:цена|стоимость|тариф)\s*(?:для\s*)?(?:дет|ребен)|детск\p{L}*\s*(?:цена|тариф|билет)|سعر\s*(?:ال)?[أا]طفال)/iu,
  },
  {
    key: "accommodation",
    re: /(?<![\p{L}\p{N}])(?:konaklama|konaklamal[ıi]|otelde\s*kal|otel\s*dahil|accommodation|hotel\s*(?:included|stay)|unterkunft|[üu]bernachtung|hotel\s*inklusive|h[ée]bergement|h[ôo]tel\s*inclus|alojamiento|hotel\s*incluido|проживани|размещени|отель\s*включ|(?:ال)?إقامة|الفندق\s*مشمول)/iu,
  },
  {
    key: "transport",
    re: /(?<![\p{L}\p{N}])(?:otelden\s*al|ula[şs][ıi]m|servis\s*var|ara[çc]\s*(?:var|dahil)|transfer|kendi\s*arab|transport(?:ation)?|pick[\s-]?up|shuttle|own\s*car|abholung|eigene[sm]?\s*auto|prise\s*en\s*charge|propre\s*voiture|recogida|coche\s*propio|транспорт|забира[ею]т|свое[йм]?\s*машин|(?:ال)?نقل|الاستقبال)/iu,
  },
  {
    key: "time",
    re: /(?<![\p{L}\p{N}])(?:saat\s*ka[çc]|ka[çc]ta\s*(?:kalk|ba[şs]la|toplan)|kalk[ıi][şs]\s*saati|toplanma\s*saati|ne\s*zaman\s*toplan|what\s*time|departure\s*time|meeting\s*time|um\s*wie\s*viel\s*uhr|abfahrtszeit|uhrzeit|[àa]\s*quelle\s*heure|heure\s*de\s*d[ée]part|a\s*qu[ée]\s*hora|hora\s*de\s*salida|во\s*сколько|время\s*отправлени|في\s*[أا]ي\s*ساعة|وقت\s*(?:ال)?انطلاق)/iu,
  },
  {
    key: "departure",
    re: /(?<![\p{L}\p{N}])(?:nereden\s*(?:kalk|hareket|[çc][ıi]k)|kalk[ıi][şs]\s*(?:yeri|noktas[ıi])|hareket\s*(?:yeri|noktas[ıi])|hangi\s*[şs]ehirden|nerede\s*bulu[şs]|toplanma\s*(?:yeri|noktas[ıi])|departure\s*(?:point|city|location)|where\s*(?:does|do)\s*(?:it|they|the\s*tours?)\s*(?:depart|start|leave)|which\s*city|pick[\s-]?up\s*point|meeting\s*point|abfahrtsort|treffpunkt|von\s*wo|welche\s*stadt|point\s*de\s*d[ée]part|lieu\s*de\s*rendez[\s-]?vous|d['’]o[ùu]\s*part|punto\s*de\s*(?:salida|encuentro)|desde\s*d[óo]nde|мест[оа]\s*(?:отправлени|встреч)|откуда\s*(?:отправ|выезж|начина)|نقطة\s*(?:ال)?(?:انطلاق|اجتماع)|من\s*[أا]ين)/iu,
  },
];

/** Mesajda öznitelik sorusu varsa anahtarını döner, yoksa null. */
export function detectAttributeQuery(message: string): AttrKey | null {
  const m = message || "";
  if (!m) return null;
  for (const { key, re } of ATTR_PATTERNS) {
    if (re.test(m)) return key;
  }
  return null;
}

/** Liste başlıkları — 7 dil × 5 öznitelik. */
export const ATTR_HEADERS: Record<AttrKey, Record<string, string>> = {
  departure: {
    tr: "Kalkış noktalarımız:", en: "Our departure points:", de: "Unsere Abfahrtsorte:",
    fr: "Nos points de départ :", es: "Nuestros puntos de salida:",
    ru: "Наши места отправления:", ar: "نقاط انطلاقنا:",
  },
  time: {
    tr: "Toplanma saatlerimiz:", en: "Our meeting times:", de: "Unsere Treffzeiten:",
    fr: "Nos heures de rendez-vous :", es: "Nuestras horas de encuentro:",
    ru: "Время сбора:", ar: "أوقات التجمع لدينا:",
  },
  accommodation: {
    tr: "Turlarımızda konaklama:", en: "Accommodation in our tours:",
    de: "Unterkunft in unseren Touren:", fr: "Hébergement dans nos circuits :",
    es: "Alojamiento en nuestros tours:", ru: "Проживание в наших турах:",
    ar: "الإقامة في جولاتنا:",
  },
  transport: {
    tr: "Turlarımızda ulaşım:", en: "Transport in our tours:",
    de: "Transport in unseren Touren:", fr: "Transport dans nos circuits :",
    es: "Transporte en nuestros tours:", ru: "Транспорт в наших турах:",
    ar: "النقل في جولاتنا:",
  },
  child_price: {
    tr: "Çocuk fiyatlarımız:", en: "Our child prices:", de: "Unsere Kinderpreise:",
    fr: "Nos tarifs enfant :", es: "Nuestros precios para niños:",
    ru: "Цены для детей:", ar: "أسعار الأطفال لدينا:",
  },
};

/** Liste sonu sorusu. */
export const ATTR_FOOTER: Record<string, string> = {
  tr: "Hangisi size uygun? 😊", en: "Which one suits you? 😊",
  de: "Welche passt zu Ihnen? 😊", fr: "Laquelle vous convient ? 😊",
  es: "¿Cuál le conviene? 😊", ru: "Какой вам подходит? 😊",
  ar: "أيها يناسبك؟ 😊",
};

/** Tur sayısı gösterilenden fazlaysa eklenen satır. */
export const ATTR_MORE: Record<string, string> = {
  tr: "(İlk {n} tur gösteriliyor — hangi turla ilgileniyorsunuz?)",
  en: "(Showing first {n} tours — which tour are you interested in?)",
  de: "(Erste {n} Touren — welche Tour interessiert Sie?)",
  fr: "(Les {n} premiers circuits — quel circuit vous intéresse ?)",
  es: "(Primeros {n} tours — ¿qué tour le interesa?)",
  ru: "(Показаны первые {n} тура — какой тур вас интересует?)",
  ar: "(أول {n} جولات — ما الجولة التي تهمك؟)",
};

/** Çocuk fiyat satırı etiketleri ("Çocuk: X / Yetişkin: Y"). */
export const ATTR_CHILD_LABELS: Record<string, { child: string; adult: string }> = {
  tr: { child: "Çocuk", adult: "Yetişkin" },
  en: { child: "Child", adult: "Adult" },
  de: { child: "Kind", adult: "Erwachsener" },
  fr: { child: "Enfant", adult: "Adulte" },
  es: { child: "Niño", adult: "Adulto" },
  ru: { child: "Ребёнок", adult: "Взрослый" },
  ar: { child: "طفل", adult: "بالغ" },
};

/**
 * HİÇBİR turda o öznitelik yoksa kullanılan tek yedek — W4'ün eski davranışı
 * ARTIK YALNIZ BURADA. {phone} varsa telefon eklenir, yoksa cümle telefonsuz biter.
 */
export const ATTR_NO_DATA: Record<string, string> = {
  tr: "Bu bilgi turlarımızda henüz tanımlı değil. Acentemiz size yardımcı olabilir{phone}.",
  en: "This information is not yet defined for our tours. Our agency can help you{phone}.",
  de: "Diese Angabe ist für unsere Touren noch nicht hinterlegt. Unsere Agentur hilft Ihnen gerne{phone}.",
  fr: "Cette information n'est pas encore définie pour nos circuits. Notre agence peut vous aider{phone}.",
  es: "Esta información aún no está definida en nuestros tours. Nuestra agencia puede ayudarle{phone}.",
  ru: "Эта информация пока не указана для наших туров. Наше агентство поможет вам{phone}.",
  ar: "هذه المعلومة غير محددة بعد في جولاتنا. يمكن لوكالتنا مساعدتك{phone}.",
};
