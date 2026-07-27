// WhatsApp şablonu meeting_time ({{4}} — tour_reminder) NÖTR fallback (2026-07-27, S1).
// toplanma_saati BOŞSA: Meta pozisyonel param'ı boş kabul etmez (gönderim başarısız →
// onay/hatırlatma mesajı HİÇ GİTMEZ). Eski `|| '09:00'` param'ı dolduruyordu AMA saat
// UYDURUYORDU (müşterinin sakladığı mesaja yanlış 09:00). Çözüm: param'ı dolu tut,
// saat uydurma → şablonun DİLİNDE nötr ifade ("acenteyle teyit ediniz").
//
// ⚠️ TEK SATIR ZORUNLU: newline/tab/4+ ardışık boşluk YOK — Meta parametreyi reddeder.
// Şablonun dili (tour_reminder_de → Almanca), acentenin varsayılan dili DEĞİL.
export const NEUTRAL_MEETING_TIME: Record<string, string> = {
  tr: "acenteyle teyit ediniz",
  en: "please confirm with the agency",
  de: "bitte mit der Agentur bestätigen",
  fr: "veuillez confirmer avec l'agence",
  es: "confirme con la agencia",
  ru: "уточните в агентстве",
  ar: "يرجى التأكيد مع الوكالة",
};

// Meta langCode ("tr", "en_US", "de", ...) → 2-harf taban → nötr metin (fallback tr).
export function neutralMeetingTime(langCode: string): string {
  const base = String(langCode || "tr").slice(0, 2).toLowerCase();
  return NEUTRAL_MEETING_TIME[base] || NEUTRAL_MEETING_TIME.tr;
}
