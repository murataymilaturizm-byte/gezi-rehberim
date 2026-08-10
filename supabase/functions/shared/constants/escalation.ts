// ═══════════════════════════════════════════════════════════════════════════
// F-D4-1 (2026-07-31): "İLETTİM" DEDİKTEN SONRA YAZIM BAŞARISIZSA NE DENİR
//
// W3-b'de agency_leads için kurulan kalıbın complaints tarafına taşınması.
// Denetimde (D4) üç yerde aynı desen bulundu: complaints.insert(...).then(()=>{})
// hemen ardından müşteriye "ilettim / talebinizi aldık" deniyordu. Insert
// düşerse müşteri iletildiğini sanır, acentede HİÇBİR İZ kalmaz.
//
// En pahalı olanı pm:2868 — telefon vermek İSTEMEYEN müşterinin escalation'ı:
// kayıt düşmezse o müşteriye ulaşmanın başka yolu yoktur.
//
// KURAL: bu mesaj ASLA "ilettim/aldık" demez. Müşteriyi doğrudan acenteye
// yönlendirir; telefon yoksa tekrar denemesini ister.
// ═══════════════════════════════════════════════════════════════════════════

/** {phone} → " 📞 +90…" (varsa) ya da boş string. */
// TON: ciddi (son çare — sistem kaydedemedi; 🙏 ölçülü, neşe YOK)
export const ESCALATION_FAILED: Record<string, string> = {
  tr: "Talebinizi şu an sistemimize kaydedemedim 🙏 Lütfen doğrudan acentemizle iletişime geçin{phone} — ya da birkaç dakika sonra tekrar yazın.",
  en: "I couldn't save your request just now 🙏 Please contact our agency directly{phone} — or write again in a few minutes.",
  de: "Ich konnte Ihre Anfrage gerade nicht speichern 🙏 Bitte wenden Sie sich direkt an unsere Agentur{phone} — oder schreiben Sie in einigen Minuten erneut.",
  fr: "Je n'ai pas pu enregistrer votre demande 🙏 Veuillez contacter directement notre agence{phone} — ou réécrivez dans quelques minutes.",
  es: "No he podido guardar su solicitud 🙏 Por favor contacte directamente con nuestra agencia{phone} — o escriba de nuevo en unos minutos.",
  ru: "Мне не удалось сохранить вашу заявку 🙏 Пожалуйста, свяжитесь с агентством напрямую{phone} — или напишите через несколько минут.",
  ar: "لم أتمكن من حفظ طلبك الآن 🙏 يرجى التواصل مع وكالتنا مباشرة{phone} — أو اكتب مرة أخرى بعد بضع دقائق.",
};

/** Mesajı dile + telefona göre kurar. */
export function buildEscalationFailed(lang: string, phone?: string | null): string {
  const _t = ESCALATION_FAILED[lang] || ESCALATION_FAILED.tr;
  const _p = (phone || "").trim();
  return _t.replace("{phone}", _p ? `: 📞 ${_p}` : "");
}
