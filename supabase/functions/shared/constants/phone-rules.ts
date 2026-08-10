// ═══════════════════════════════════════════════════════════════════════════
// W7-FIX (2026-08-02): TR-BİLİNÇLİ KATI TELEFON DOĞRULAYICI — TEK KAYNAK
//
// KÖK VAKA (canlı sunum, 02.08): Murat telefon-adımında numarayı eksik yazdı →
// bot "geçersiz" demedi, TARİH LİSTESİNİ getirdi. Kök: İKİ doğrulayıcı çelişiyordu:
//   • normalizePhone (extractor, telefonu YAZAR)  → yerel ≥ 10 hane
//   • isValidPhone   (guard'ı SUSTURUR)           → ≥ 7 hane yeterli
// 7-9 haneli girdi ölü bölgeye düşüyordu: extractor yazmıyor AMA guard "telefon
// sayılır" deyip susuyor → mesaj LLM'e → deterministik değil (probda kibar soru,
// canlı sunumda tarih listesi). İkinci delik: 0'lı-10-hane (geçersiz TR) kabul
// edilip CONFIRMING özetine sızıyordu.
//
// KARAR TABLOSU (onaylı):
//   05XXXXXXXXX  (11 hane, 0'lı)        → ✅ kanonik: olduğu gibi
//   5XXXXXXXXX   (10 hane, 0'sız)       → ✅ kanonik: "0" + hane  (müşteri her türlü yazar)
//   90 + 10 hane (12 hane) / +90…       → ✅ kanonik: "0" + son 10 hane
//   +XX…         (TR-dışı uluslararası) → ✅ olduğu gibi ("+" korunur; yabancı müşteri)
//   rakam-ağırlıklı ama yukarıya uymayan → ❌ null → deterministik kibar-red (LLM'e DÜŞMEZ)
//   rakam-ağırlıklı değil               → bu modülün işi değil; mevcut zincir (P2
//                                          muafiyetleri: yan-soru/FAQ/tarih-değişim) aynen
//
// ⚠️ isValidPhone'a DOKUNULMADI — state-machine R6 CONFIRMING kapısı dahil mevcut
//    tüketicileri aynen o gevşek (≥7) semantikte kalır. Katı kurallar YALNIZ burada.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Katı doğrula + kanonikleştir.
 * Dönen değer: TR için "05XXXXXXXXX", TR-dışı için "+XX…", geçersizse null.
 */
export function canonicalTrPhone(raw: string): string | null {
  const cleaned = (raw || "").replace(/[\s\-.()]/g, "");
  if (!cleaned) return null;

  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1);
    if (!/^\d+$/.test(digits)) return null;
    if (digits.startsWith("90")) {
      const rest = digits.slice(2);
      // +90 sonrası tam 10 hane ve 5 ile başlamalı (TR mobil) ya da sabit hat (1-4,8) —
      // uzunluk şartı katı: eksik +90'lı numara da REDDEDİLİR.
      return rest.length === 10 && /^[1-9]/.test(rest) ? "0" + rest : null;
    }
    // TR-dışı uluslararası: mevcut kabul aralığı korunur (7-15 hane).
    return digits.length >= 7 && digits.length <= 15 ? "+" + digits : null;
  }

  if (!/^\d+$/.test(cleaned)) return null;
  if (cleaned.length === 11 && cleaned.startsWith("0") && /^0[1-9]/.test(cleaned)) return cleaned;
  if (cleaned.length === 10 && /^[1-9]/.test(cleaned)) return "0" + cleaned;
  if (cleaned.length === 12 && cleaned.startsWith("90") && /^90[1-9]/.test(cleaned)) {
    return "0" + cleaned.slice(2);
  }
  return null;   // 0'lı-10-hane dahil: eksik/hatalı → kibar-red
}

/**
 * Guard tetikleyicisi: mesaj "telefon yazmaya çalışıyor ama tutmamış" mı?
 * Rakam-ağırlıklı (≥5 rakam ve rakamlar harflerden çok) VE katı-doğrulama null.
 * "10 aralık" / "3 kişi" gibi az-rakamlı girdiler BURAYA GİRMEZ — onlar mevcut
 * guard/muafiyet zincirinde kalır (P2 esnekliği korunur).
 */
export function isBrokenPhoneAttempt(message: string): boolean {
  const m = (message || "").trim();
  if (!m) return false;
  const digits = (m.match(/\d/g) || []).length;
  const letters = (m.match(/\p{L}/gu) || []).length;
  if (digits < 5 || letters > digits) return false;
  return canonicalTrPhone(m) === null;
}

// TON: nötr-yardım (red ama yol gösterir)
/** Kibar-red — 7 dil, örnekli format, adımda kalış mesajı. */
export const PHONE_BROKEN_MSG: Record<string, string> = {
  tr: "Numaranız eksik veya hatalı görünüyor 📱 Lütfen başında 0 ile 11 haneli (örn. 05XX XXX XX XX) ya da +90'lı yazın.",
  en: "Your number looks incomplete or invalid 📱 Please enter 11 digits starting with 0 (e.g. 05XX XXX XX XX) or with +country code",
  de: "Ihre Nummer scheint unvollständig oder fehlerhaft 📱 Bitte 11-stellig mit führender 0 eingeben (z. B. 05XX XXX XX XX) oder mit +Ländervorwahl",
  fr: "Votre numéro semble incomplet ou incorrect 📱 Veuillez saisir 11 chiffres commençant par 0 (ex. 05XX XXX XX XX) ou avec +indicatif",
  es: "Su número parece incompleto o incorrecto 📱 Introduzca 11 dígitos empezando por 0 (ej. 05XX XXX XX XX) o con +prefijo",
  ru: "Ваш номер выглядит неполным или неверным 📱 Введите 11 цифр, начиная с 0 (напр. 05XX XXX XX XX), или с +кодом страны",
  ar: "يبدو رقمك ناقصاً أو غير صحيح 📱 يرجى إدخال 11 رقماً يبدأ بـ 0 (مثال: 05XX XXX XX XX) أو مع رمز الدولة +",
};
