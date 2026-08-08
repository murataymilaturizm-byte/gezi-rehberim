// ═══════════════════════════════════════════════════════════════════════════
// GÜNLÜK KONUŞMA-KARNESİ desenleri (2026-07-31)
//
// Amaç: W1–W4 sınıfı delikleri gece nöbeti yerine sistem yakalasın.
// Bu dosya YALNIZ tespit desenleri — karne hiçbir müşteri mesajını değiştirmez.
// ═══════════════════════════════════════════════════════════════════════════

/** Bot cevabında "kaçış" sinyali: bilgiyi veremeyip yönlendiren/pas geçen cümleler. */
export const ESCAPE_RE =
  /(?:acentemizle\s+ileti[şs]ime\s+ge[çc]|acentemizi?\s+aray|acentemizden\s+[öo][ğg]ren|acentemiz\s+size\s+yard[ıi]mc[ıi]|ileti[şs]ime\s+ge[çc]iniz|sistemimde\s+bulunmuyor|sistemimizde\s+(?:bulunmuyor|yok)|bilgi\s+(?:mevcut\s+de[ğg]il|bulunmuyor)|yard[ıi]mc[ıi]\s+olam[ıi]yorum|contact\s+(?:our|the)\s+agency|not\s+available\s+in\s+(?:our|the)\s+system|wenden\s+Sie\s+sich|contactez\s+notre|contacte\s+con\s+nuestra|свяжитесь\s+с\s+(?:нашим|нами)|تواصل\s+مع)/iu;

/**
 * MEŞRU YÖNLENDİRMELER — kaçış sayılmaz, ayrıca SAYILIR (anormal artış sinyali).
 *
 * Her kalıbın gerekçesi zorunlu: hangi talimattan geliyor, neden meşru.
 * ⚠️ Buraya "şimdilik gürültü yapıyor" diye kalıp eklemek karneyi kör eder —
 *    yalnız ürün kararı gereği doğru olan yönlendirmeler girer.
 */
export const LEGIT_REDIRECTS: ReadonlyArray<{ re: RegExp; why: string }> = [
  {
    // stages/index.ts:488 (COMPLETED / after-sales) — bot rezervasyonu KENDİ
    // değiştiremez/iptal edemez; bu kritik iş kuralı, kasıtlı yönlendirme.
    re: /(?:rezervasyon\s+(?:de[ğg]i[şs]ikli[ğg]i|iptali?)|de[ğg]i[şs]iklik\s+ve\s+iptal|iptal\s+(?:etmek|talebiniz)|change\s+or\s+cancel|cancel(?:lation)?\s+request)/iu,
    why: "after-sales iptal/değişiklik — bot yetkili değil (stages/index.ts:488)",
  },
  {
    // stages/index.ts:345 — "dahil olanlar/hariç olanlar" DB'de TUTULMUYOR.
    // Uydurmaktansa yönlendirmek doğru; veri eklenirse bu kalıp kaldırılmalı.
    re: /(?:dahil\s+olan\s+(?:hizmet|servis)|fiyata\s+(?:neler\s+)?dahil|dahil\s+olanlar[ıi]n\s+tam\s+listesi|what\s+is\s+included|included\s+services)/iu,
    why: "fiyata dahil/hariç verisi şemada yok — uydurma yerine yönlendirme (stages/index.ts:345)",
  },
  {
    // Ödeme teyidi/dekont: para hareketini bot doğrulayamaz, acente teyit eder.
    re: /(?:dekont|[öo]demenizi\s+teyit|[öo]deme\s+teyid|payment\s+confirmation)/iu,
    why: "ödeme teyidi insan onayı gerektirir — kasıtlı (P5 havale akışı)",
  },
  {
    // Lisans/belge (TÜRSAB vb.) için şemada kolon YOK → dürüst yönlendirme.
    re: /(?:t[üu]rsab|lisans|sertifika|belge(?:niz|si)|licen[cs]e|certificat)/iu,
    why: "acente lisans/belge alanı şemada yok — dürüst yönlendirme (D1 adayı)",
  },
  {
    // W8 politikası: 50+ kişi grup — insan pazarlığı gerekir (big_group sebebi).
    re: /(?:50\+|[5-9]\d\s*ki[şs]i|b[üu]y[üu]k\s*grup|large\s*group|ofisle\s*ileti[şs]im)/iu,
    why: "50+ grup — fiyat/organizasyon insan pazarlığı ister (W8 big_group)",
  },
  {
    // W8 politikası: vize desteği acente işi (visa sebebi).
    re: /(?:vize|visa|visum|виз[аы]|تأشير)/iu,
    why: "vize desteği acente işi — meşru yönlendirme (W8 visa)",
  },
];

/** İki metnin bigram-Dice benzerliği (0..1). Tekrar-soru tespiti için. */
export function similarity(a: string, b: string): number {
  const norm = (s: string) =>
    (s || "").toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const grams = (s: string) => {
    const g = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2));
    return g;
  };
  const gx = grams(x), gy = grams(y);
  if (gx.size === 0 || gy.size === 0) return 0;
  let inter = 0;
  for (const g of gx) if (gy.has(g)) inter++;
  return (2 * inter) / (gx.size + gy.size);
}

/** Tekrar-soru eşiği — birebir eşitlik "peki nereden kalkıyor"u kaçırırdı. */
export const REPEAT_SIMILARITY = 0.8;

/** Terk eşiği: son mesajdan bu yana bu kadar süre geçtiyse akış terk sayılır. */
export const ABANDON_AFTER_MINUTES = 120;

/**
 * Terk sayılan aşamalar. COMPLETED BİLEREK YOK: rezervasyon bitmiş, sonrasında
 * gelen after-sales sohbeti "terk" değildir (kullanıcı kenar-notu).
 * GREETING/BROWSING de yok: henüz akış başlamamış, terk edilecek bir şey yok.
 */
export const ABANDON_STAGES: ReadonlySet<string> = new Set([
  "TOUR_SELECTED", "COLLECTING_INFO", "CONFIRMING",
]);
