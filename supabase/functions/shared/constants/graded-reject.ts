// ═══════════════════════════════════════════════════════════════════════════
// E3-1 + E4-2 (2026-08-10): KADEMELİ-RED — determinizmin robotlaşma bedelini öde
//
// Canlı kanıt (E3 probu): telefon-adımında aynı bozuk numara 3 kez → ÜÇ KEZ
// BİREBİR AYNI cümle. Determinizm kasıtlıydı (W7: LLM piyangosunu kapattık) ama
// müşteri "bot beni duymuyor" hisseder ve bırakır. AI-fallback'te daha kötüsü:
// kesinti günü "birkaç dakika sonra tekrar yazın" saatlerce aynı kaldı — vaat
// yalan oldu.
//
// DESEN: oturum-bazlı ardışık sayaç (context.guardStreak = {key, count}).
//   1. tetikleme → mevcut metin (değişmez)
//   2. tetikleme → YARDIM-İÇERİKLİ alternatif (farklı yazım önerisi + köprü teklifi)
//   3. tetikleme → OTOMATİK köprü: talep kanal-içi kayda geçer (W3-b checked),
//                  müşteri döngüden çıkar.
//
// KAPSAM (bu tur): phone_step (W7 kibar-redi + R6 "geçerli telefon değil" —
// AYNI anahtar: müşteri için aynı döngü) + ai_fallback. Tarih-reddi BİLİNÇLİ
// dışarıda: o zincir zaten alternatif üretiyor (müsait-tarih listesi basıyor,
// deneyim kısır değil) ve canlı-smoke assertleri o metne kilitli — sonraki tur.
// ═══════════════════════════════════════════════════════════════════════════

/** 2. tetikleme — telefon-adımı: farklı yazım önerisi + köprü TEKLİFİ. */
// TON: nötr-yardım (2. deneme — çözüm önerir)
export const PHONE_RETRY_MSG: Record<string, string> = {
  tr: "Hâlâ olmadı 🙏 Numaranızı boşluksuz tek satır yazmayı deneyin (örn. 05321234567) — ya da isterseniz talebinizi bu haliyle acentemize ileteyim, sizi arasınlar.",
  en: "Still not working 🙏 Try typing your number in one line without spaces (e.g. 05321234567) — or I can forward your request to our agency as it is, and they'll call you.",
  de: "Es klappt noch nicht 🙏 Versuchen Sie die Nummer in einer Zeile ohne Leerzeichen (z. B. 05321234567) — oder ich leite Ihre Anfrage so an unsere Agentur weiter, und man ruft Sie an.",
  fr: "Toujours pas 🙏 Essayez d'écrire votre numéro sur une ligne sans espaces (ex. 05321234567) — ou je peux transmettre votre demande telle quelle à notre agence, qui vous appellera.",
  es: "Aún no funciona 🙏 Intente escribir su número en una línea sin espacios (ej. 05321234567) — o puedo trasladar su solicitud tal cual a nuestra agencia para que le llamen.",
  ru: "Пока не получилось 🙏 Попробуйте написать номер одной строкой без пробелов (напр. 05321234567) — или я передам вашу заявку агентству как есть, и вам перезвонят.",
  ar: "لم ينجح بعد 🙏 جرّب كتابة رقمك في سطر واحد دون مسافات (مثال: 05321234567) — أو يمكنني إحالة طلبك كما هو إلى وكالتنا ليتصلوا بك.",
};

/** 3. tetikleme — otomatik köprü: kayıt AÇILDI, müşteri döngüden çıktı. */
// TON: nötr-işlem (talep kayda geçti)
export const PHONE_BRIDGE_MSG: Record<string, string> = {
  tr: "Talebinizi rezervasyon bilgilerinizle birlikte acentemize ilettim 📩 Sizinle iletişime geçecekler. Dilerseniz numaranızı daha sonra buradan da yazabilirsiniz.",
  en: "I've forwarded your request with your reservation details to our agency 📩 They will get in touch with you. You can also send your number here later if you like.",
  de: "Ich habe Ihre Anfrage mit Ihren Reservierungsdaten an unsere Agentur weitergeleitet 📩 Man wird sich bei Ihnen melden. Sie können Ihre Nummer später auch hier senden.",
  fr: "J'ai transmis votre demande avec vos informations de réservation à notre agence 📩 Elle vous contactera. Vous pourrez aussi envoyer votre numéro ici plus tard.",
  es: "He trasladado su solicitud con sus datos de reserva a nuestra agencia 📩 Se pondrán en contacto con usted. También puede enviar su número aquí más tarde.",
  ru: "Я передал вашу заявку с данными бронирования в агентство 📩 С вами свяжутся. Позже вы также можете написать свой номер здесь.",
  ar: "أحلت طلبك مع بيانات حجزك إلى وكالتنا 📩 سيتواصلون معك. يمكنك أيضاً إرسال رقمك هنا لاحقاً.",
};

/** AI-fallback 2.+ ardışık basım — "birkaç dakika" vaadi yerine kayıt-gerçeği.
 *  (Mesaj GERÇEKTEN kaydediliyor: inbound whatsapp_conversations'a düşüyor.) */
// TON: ciddi (teknik sorun itirafı — dürüst, vaatsiz)
export const AI_FALLBACK_REPEAT_MSG: Record<string, string> = {
  tr: "Şu anda teknik bir sorun yaşıyoruz 🙏 Mesajınız bize ulaştı — sorun giderilir giderilmez buradan yanıtlayacağız.",
  en: "We're having a technical issue right now 🙏 Your message has reached us — we'll reply here as soon as it's resolved.",
  de: "Wir haben gerade ein technisches Problem 🙏 Ihre Nachricht ist bei uns angekommen — wir antworten hier, sobald es behoben ist.",
  fr: "Nous rencontrons actuellement un problème technique 🙏 Votre message nous est bien parvenu — nous vous répondrons ici dès que possible.",
  es: "Estamos teniendo un problema técnico 🙏 Su mensaje nos ha llegado — le responderemos aquí en cuanto se resuelva.",
  ru: "У нас сейчас техническая неполадка 🙏 Ваше сообщение получено — мы ответим здесь, как только всё восстановится.",
  ar: "نواجه حالياً مشكلة تقنية 🙏 وصلتنا رسالتك — سنرد عليك هنا فور حل المشكلة.",
};

/** Sayaç ilerlet: aynı anahtar ardışıksa +1, değilse 1'e döner. */
export function bumpGuardStreak(
  ctx: Record<string, unknown>,
  key: string,
): number {
  const prev = (ctx.guardStreak as { key?: string; count?: number } | undefined) ?? {};
  const count = prev.key === key ? (prev.count ?? 0) + 1 : 1;
  ctx.guardStreak = { key, count };
  return count;
}
