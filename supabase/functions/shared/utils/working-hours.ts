// Çalışma saatleri yerelleştirme — TEK KAYNAK (CİLA-4-F(iii), 2026-07-26).
// KÖK (C4 TR-sızıntı): acente working_hours değeri serbest-TR metin olabilir
// ("Hafta içi 09:00 - 18:00") ve payment bloğu + canned hours bunu DE/RU/AR
// cevabına ham basıyordu. Bu util: (1) JSON gün-yapısı → yerelleştirilmiş
// gün-adları (canned'daki eski formatHours mantığı BURAYA taşındı), (2) serbest
// TR-metin → kürasyonlu ifade-sözlüğüyle yerelleştirme ("Hafta içi"→"Wochentags").
// Sözlük DAR tutulur (bariz kalıplar); eşleşmeyen ham metin AYNEN kalır.
// Tüketiciler: canned-responses.ts (hours) + payment-message.ts (Çalışma Saatleri).

type L7 = Record<string, string>;
const pick = (m: L7, lang: string): string => m[lang] || m.tr;

const DAY_NAMES: Record<string, L7> = {
  monday:    { tr: "Pazartesi", en: "Monday", de: "Montag", fr: "Lundi", es: "Lunes", ru: "Понедельник", ar: "الاثنين" },
  tuesday:   { tr: "Salı", en: "Tuesday", de: "Dienstag", fr: "Mardi", es: "Martes", ru: "Вторник", ar: "الثلاثاء" },
  wednesday: { tr: "Çarşamba", en: "Wednesday", de: "Mittwoch", fr: "Mercredi", es: "Miércoles", ru: "Среда", ar: "الأربعاء" },
  thursday:  { tr: "Perşembe", en: "Thursday", de: "Donnerstag", fr: "Jeudi", es: "Jueves", ru: "Четверг", ar: "الخميس" },
  friday:    { tr: "Cuma", en: "Friday", de: "Freitag", fr: "Vendredi", es: "Viernes", ru: "Пятница", ar: "الجمعة" },
  saturday:  { tr: "Cumartesi", en: "Saturday", de: "Samstag", fr: "Samedi", es: "Sábado", ru: "Суббота", ar: "السبت" },
  sunday:    { tr: "Pazar", en: "Sunday", de: "Sonntag", fr: "Dimanche", es: "Domingo", ru: "Воскресенье", ar: "الأحد" },
};
const CLOSED: L7 = { tr: "Kapalı", en: "Closed", de: "Geschlossen", fr: "Fermé", es: "Cerrado", ru: "Закрыто", ar: "مغلق" };

// Serbest-metin TR kalıpları — kürasyonlu (bariz olanlar; uydurma genişletme YOK).
const TR_PHRASES: Array<{ re: RegExp; l7: L7 }> = [
  { re: /hafta\s*içi/giu,  l7: { tr: "Hafta içi", en: "Weekdays", de: "Wochentags", fr: "En semaine", es: "Entre semana", ru: "По будням", ar: "أيام الأسبوع" } },
  { re: /hafta\s*sonu/giu, l7: { tr: "Hafta sonu", en: "Weekends", de: "Am Wochenende", fr: "Le week-end", es: "Fines de semana", ru: "По выходным", ar: "عطلة نهاية الأسبوع" } },
  { re: /her\s*gün/giu,    l7: { tr: "Her gün", en: "Every day", de: "Täglich", fr: "Tous les jours", es: "Todos los días", ru: "Ежедневно", ar: "كل يوم" } },
  { re: /(?<![\p{L}\p{N}])pzt\s*[-–]\s*cum(?![\p{L}\p{N}])/giu, l7: { tr: "Pzt-Cum", en: "Mon-Fri", de: "Mo-Fr", fr: "Lun-Ven", es: "Lun-Vie", ru: "Пн-Пт", ar: "الاثنين-الجمعة" } },
  { re: /kapal[ıi]/giu,    l7: CLOSED },
];

/**
 * working_hours değerini hedef dile yerelleştirir.
 * - JSON gün-yapısı ({monday:{enabled,open,close},...}) → gün-adlı çok-satır.
 * - Serbest metin → TR-kalıp sözlüğüyle değiştirme; kalan kısımlar aynen.
 */
export function localizeWorkingHours(raw: string | null | undefined, lang: string): string {
  if (!raw) return "";
  try {
    const data = JSON.parse(String(raw));
    if (data && typeof data === "object" && data.monday !== undefined) {
      const lines: string[] = [];
      for (const key of Object.keys(DAY_NAMES)) {
        const name = pick(DAY_NAMES[key], lang);
        const day = data[key];
        lines.push(day && day.enabled ? `${name}: ${day.open} - ${day.close}` : `${name}: ${pick(CLOSED, lang)}`);
      }
      return lines.join("\n");
    }
  } catch { /* ham metin */ }
  let out = String(raw);
  for (const { re, l7 } of TR_PHRASES) {
    out = out.replace(re, pick(l7, lang));
  }
  return out;
}
