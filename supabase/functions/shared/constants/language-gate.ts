// ═══════════════════════════════════════════════════════════════════════════
// KÖK-B: İLK-MESAJ DİL-YAZMASI ASGARİ-SİNYAL KAPISI (2026-07-31)
//
// KÖK: process-message'ta ilk mesajda (messageCount===0) NLU'nun döndüğü dil
// context.language'ı KOŞULSUZ eziyordu ("uzunluk-kapısız", bilinçli C1 tercihi).
// Ölçüm (canlı demo-chat, istekte language:"tr" AÇIKÇA gönderilirken):
//     "pardon" → fr · "ok" → en · "no" → en · "si" → es · "merci" → fr
//     "hello"  → en (DOĞRU)
// Yani "ok" yazan Türk müşteri İngilizce karşılanıyordu. WhatsApp'ta risk daha
// yüksek: orada dil parametresi HİÇ yok, ilk mesaj tek otorite.
//
// ASİMETRİ: akış-ORTASINDA aynı NLU yazması çok daha temkinli — §35
// pendingLangSwitch 2 ARDIŞIK ASCII turn şart koşuyor, gerekçesi de "tek-turn
// NLU yanlış-tespiti". İlk mesajda bu güvenlik yoktu. Bu dosya onu ekler.
//
// KURAL: NLU ilk mesajda dili YALNIZ mesaj güvenilir sinyal taşıyorsa yazar.
//   Güvenilir = (≥2 harfli kelime) VEYA (≥8 harf) VEYA (tek-anlamlı açılış sözcüğü)
//
// ÜÇÜNCÜ ŞART NEDEN VAR: "hello" tek kelime + 5 harf — uzunluk kapısına takılırdı,
// oysa tek-anlamlı bir İngilizce açılıştır ve C1 davranışı (yabancı ilk mesaj
// gecikmesiz doğru dile otursun) korunmalı. Buna karşılık "ok · pardon · merci ·
// no · si" listede DEĞİL: hepsi Türkçede de günlük kullanılan/çok-dilli
// sözcükler — ayırt edici olan UZUNLUK değil ÇOK-ANLAMLILIK.
// ═══════════════════════════════════════════════════════════════════════════

/** Tek noktadan ayarlanabilir eşikler. Değiştirmeden önce korpusu koş. */
export const LANG_MIN_WORDS = 2;
export const LANG_MIN_LETTERS = 8;

/**
 * Tek başına yazıldığında dili GÜVENİLİR şekilde belirleyen açılış sözcükleri.
 * ⚠️ Türkçede de kullanılan hiçbir sözcük buraya EKLENMEZ ("ok", "pardon",
 * "merci", "no", "hi" tartışmalı olduğu için dışarıda) — bu liste büyüdükçe
 * KÖK-B geri gelir. Latin-dışı yazılar zaten detectLanguage ile ayrışıyor;
 * burada bulunmaları yalnız tamamlık içindir.
 */
export const LANG_UNAMBIGUOUS_STARTERS: ReadonlySet<string> = new Set([
  "hello", "hallo", "bonjour", "hola", "buongiorno",
  "guten", "salut", "merhaba", "привет", "здравствуйте", "مرحبا", "السلام",
]);

/**
 * İlk mesaj NLU'nun dil yazmasına yetecek sinyali taşıyor mu?
 * false → NLU dili YAZILMAZ, mevcut (tohum) dil korunur.
 */
export function hasReliableLanguageSignal(message: string): boolean {
  const m = (message || "").trim();
  if (!m) return false;

  const _letters = (m.match(/\p{L}/gu) || []).length;
  const _words = m.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
  if (_words >= LANG_MIN_WORDS || _letters >= LANG_MIN_LETTERS) return true;

  // Tek kısa kelime → yalnız tek-anlamlı açılış sözcüğü geçer.
  const _token = m.toLocaleLowerCase("tr-TR").replace(/[^\p{L}]/gu, "");
  return LANG_UNAMBIGUOUS_STARTERS.has(_token);
}
