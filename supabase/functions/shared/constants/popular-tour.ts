// ═══════════════════════════════════════════════════════════════════════════
// X9 / B-POPULAR: "En çok satan turunuz hangisi?" (2026-07-31)
//
// Tarama bulgusu (K5/ensatan): bot "sistemimizde satış istatistiği bilgisi
// bulunmuyor" diyordu — oysa registrations tablosu bu sıralamayı verebilir.
//
// 🔒 GİZLİLİK/ALGI KURALI (ürün kararı, kod kadar bağlayıcı):
//    HAM SATIŞ SAYISI ASLA TELAFFUZ EDİLMEZ. "X kere satıldı / 12 rezervasyon"
//    gibi ifade YOK — yalnız SIRALAMA ("En çok tercih edilen turumuz: …").
//    Gerekçe: ham sayı hem rakibe iş hacmi sızdırır hem düşük sayıda
//    ("2 kişi almış") ters-etki yapar. Bu yüzden mesaj şablonlarında sayı
//    yer tutucusu bilerek YOKTUR — eklemek kuralı çiğner.
//
// 🔒 AZ-VERİ SUSMA KURALI: toplam sayım eşiğin altındaysa blok hiç konuşmaz,
//    mevcut davranış (LLM) korunur — zayıf veriyle "en çok tercih edilen"
//    demek yanıltıcı olur.
// ═══════════════════════════════════════════════════════════════════════════

/** Altında blokun SUSTUĞU toplam rezervasyon sayısı. */
export const POPULAR_MIN_TOTAL = 3;

/** Sıralamaya katılan rezervasyon durumları (iptaller hariç). */
export const POPULAR_STATUSES = ["CONFIRMED", "NEW"] as const;

/** Sıralamanın baktığı geçmiş (gün) — eski sezon bugünü temsil etmesin. */
export const POPULAR_LOOKBACK_DAYS = 365;

/**
 * "En çok satan / en popüler / en çok tercih edilen" sorusu — 7 dil.
 * ⚠️ ASCII \b YOK (Yan #8): baş lookbehind + sondan-ekli diller için açık kuyruk.
 */
export const POPULAR_QUERY_RE =
  /(?<![\p{L}\p{N}])(?:en\s+(?:[çc]ok\s+(?:satan|tercih\s+edilen|sat[ıi]lan|gidilen|be[ğg]enilen)|pop[üu]ler|sevilen|gözde|gozde)|hangisi\s+daha\s+pop[üu]ler|best[\s-]?sell(?:er|ing)|most\s+(?:popular|booked|preferred|sold)|top\s+sell(?:er|ing)|beliebteste|meistgebuchte|meistverkaufte|(?:le\s+)?plus\s+populaire|(?:le\s+)?plus\s+vendu|m[áa]s\s+(?:popular|vendido|solicitado)|самый\s+популярн[\p{L}]*|популярнее\s+всего|чаще\s+всего\s+(?:брон|покупа|выбира)|(?:ال)?[أا]كثر\s+(?:شعبية|مبيع[\p{L}]*|طلب[\p{L}]*))/iu;

/** Cevap şablonu — SAYI YER TUTUCUSU YOK (bkz. gizlilik kuralı). */
export const POPULAR_REPLY: Record<string, string> = {
  tr: "En çok tercih edilen turumuz: *{tour}*\nHakkında bilgi almak ister misiniz? 😊",
  en: "Our most preferred tour: *{tour}*\nWould you like more information? 😊",
  de: "Unsere beliebteste Tour: *{tour}*\nMöchten Sie mehr Informationen? 😊",
  fr: "Notre circuit le plus prisé : *{tour}*\nSouhaitez-vous plus d'informations ? 😊",
  es: "Nuestro tour más elegido: *{tour}*\n¿Desea más información? 😊",
  ru: "Наш самый выбираемый тур: *{tour}*\nХотите узнать больше? 😊",
  ar: "الجولة الأكثر تفضيلاً لدينا: *{tour}*\nهل تريد المزيد من المعلومات؟ 😊",
};
