// ═══════════════════════════════════════════════════════════════════════════
// E4-1 (2026-08-10): "EN KISA SÜREDE" VAATLERİNİN YERİNE GERÇEKÇİ KAPANIŞ
//
// Denetim bulgusu: 13 noktada "en kısa sürede dönecekler" vaadi vardı ve
// hiçbirinin arkasında ölçülebilir bir şey yoktu — dönüş hızı tamamen acentenin
// elinde. Müşteri "ne kadar süre?" bilmiyor, dönüş gelmezse ne yapacağı da
// söylenmiyordu.
//
// YENİ KAPANIŞ: "genellikle çalışma saatleri içinde dönüş yapılır"
//   + working_hours KISA SERBEST-METİNSE gerçek aralık parantezde basılır
//   + "dönüş alamazsanız buradan tekrar yazabilirsiniz 🤝" (kontrol müşteride)
//
// ⚠️ working_hours İKİ FORMATTA yaşıyor (canlı tespit): Aymila'da JSON
//    ({"monday":{"enabled":true,...}}), Demo'da serbest metin ("Pazartesi-Cuma:
//    09:00-18:00…"). JSON'u ham basmak felaket olur → yalnız kısa (≤60 kr),
//    süslü-parantezsiz değer basılır; aksi halde saat kısmı sessizce atlanır.
// ═══════════════════════════════════════════════════════════════════════════

// TON: nötr-güven (gerçekçi vaat + kontrol müşteride)
const CLOSING: Record<string, { base: string; withHours: string }> = {
  tr: {
    base: "Acentemiz genellikle çalışma saatleri içinde dönüş yapar — dönüş alamazsanız buradan tekrar yazabilirsiniz 🤝",
    withHours: "Acentemiz genellikle çalışma saatleri içinde ({hours}) dönüş yapar — dönüş alamazsanız buradan tekrar yazabilirsiniz 🤝",
  },
  en: {
    base: "Our agency usually responds within working hours — if you don't hear back, feel free to write here again 🤝",
    withHours: "Our agency usually responds within working hours ({hours}) — if you don't hear back, feel free to write here again 🤝",
  },
  de: {
    base: "Unsere Agentur meldet sich in der Regel innerhalb der Geschäftszeiten — falls nicht, schreiben Sie gerne erneut hier 🤝",
    withHours: "Unsere Agentur meldet sich in der Regel innerhalb der Geschäftszeiten ({hours}) — falls nicht, schreiben Sie gerne erneut hier 🤝",
  },
  fr: {
    base: "Notre agence répond généralement pendant les heures d'ouverture — sans retour, n'hésitez pas à réécrire ici 🤝",
    withHours: "Notre agence répond généralement pendant les heures d'ouverture ({hours}) — sans retour, n'hésitez pas à réécrire ici 🤝",
  },
  es: {
    base: "Nuestra agencia suele responder en horario laboral — si no recibe respuesta, escriba de nuevo aquí 🤝",
    withHours: "Nuestra agencia suele responder en horario laboral ({hours}) — si no recibe respuesta, escriba de nuevo aquí 🤝",
  },
  ru: {
    base: "Наше агентство обычно отвечает в рабочие часы — если ответа нет, напишите здесь ещё раз 🤝",
    withHours: "Наше агентство обычно отвечает в рабочие часы ({hours}) — если ответа нет, напишите здесь ещё раз 🤝",
  },
  ar: {
    base: "عادةً ما ترد وكالتنا خلال ساعات العمل — إذا لم تصلك إجابة، اكتب هنا مرة أخرى 🤝",
    withHours: "عادةً ما ترد وكالتنا خلال ساعات العمل ({hours}) — إذا لم تصلك إجابة، اكتب هنا مرة أخرى 🤝",
  },
};

/** working_hours değeri parantez içinde basılabilir mi? (JSON/uzun metin → hayır) */
function _printableHours(raw: string | null | undefined): string | null {
  const s = (raw || "").trim();
  if (!s || s.length > 60) return null;
  if (s.includes("{") || s.includes("}") || s.includes('"')) return null;   // JSON formatı
  return s;
}

export function buildFollowupClosing(lang: string, workingHours?: string | null): string {
  const t = CLOSING[lang] || CLOSING.tr;
  const h = _printableHours(workingHours);
  return h ? t.withHours.replace("{hours}", h) : t.base;
}
