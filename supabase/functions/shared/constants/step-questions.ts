// COLLECTING_INFO adım soruları — TEK KAYNAK (DRY).
//
// 2026-07-03 P5+P7 paketi ile eklendi. İki tüketici:
//   1. process-message.ts P5 tarih-değişim ack'i (deterministik "güncelledim"
//      prefix'i + mevcut adımın sorusu)
//   2. response-validator.ts P7 stage-aware replacement (COLLECTING_INFO'da
//      özet+onay yerine adım sorusu)
// Metinler :11b/:11c deterministik geçiş mesajlarıyla aynı tonda tutuldu.
export const STEP_QUESTIONS: Record<string, Record<string, string>> = {
  waiting_for_pax: {
    tr: "Kaç kişi katılacaksınız? 👥",
    en: "How many people will join? 👥",
    de: "Wie viele Personen nehmen teil? 👥",
    ru: "Сколько человек участвует? 👥",
    ar: "كم شخصاً سيشارك؟ 👥",
    fr: "Combien de personnes participeront ? 👥",
    es: "¿Cuántas personas participarán? 👥",
  },
  waiting_for_name: {
    tr: "Ad ve soyadınızı alabilir miyim? 👤",
    en: "May I have your full name? 👤",
    de: "Darf ich Ihren vollständigen Namen haben? 👤",
    ru: "Могу я узнать ваше полное имя? 👤",
    ar: "هل يمكنني معرفة اسمك الكامل؟ 👤",
    fr: "Puis-je avoir votre nom complet ? 👤",
    es: "¿Puedo tener su nombre completo? 👤",
  },
  waiting_for_phone: {
    tr: "Telefon numaranızı alabilir miyim? 📱",
    en: "May I have your phone number? 📱",
    de: "Darf ich Ihre Telefonnummer haben? 📱",
    ru: "Могу я узнать ваш номер телефона? 📱",
    ar: "هل يمكنني الحصول على رقم هاتفك؟ 📱",
    fr: "Puis-je avoir votre numéro de téléphone ? 📱",
    es: "¿Puedo tener su número de teléfono? 📱",
  },
  waiting_for_email: {
    tr: "E-posta adresinizi alabilir miyim? 📧",
    en: "May I have your email address? 📧",
    de: "Darf ich Ihre E-Mail-Adresse haben? 📧",
    ru: "Могу я узнать ваш адрес электронной почты? 📧",
    ar: "هل يمكنني الحصول على بريدك الإلكتروني؟ 📧",
    fr: "Puis-je avoir votre adresse e-mail ? 📧",
    es: "¿Puedo tener su correo electrónico? 📧",
  },
};
