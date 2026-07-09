// Göreli-tarih kelime süpersetleri — TEK KAYNAK (2026-07-09 FAZ NLU-pilot-A İş0).
//
// CANLI DERS (Yan #8 + ASCII kalıntısı): "obür gün" (ASCII 'o' + 'bür') →
// extractRelativeDate seti "öbür" (tam-aksanlı) ve "obur" (tam-ASCII) içeriyordu
// ama KARIŞIK "obür" yoktu → çözülemedi → ham "obür gün" tırnaklı şablona sızdı
// ('"obür gün" müsait değil'). Aynı senkronsuzluk month-names.ts'te de yaşanmıştı
// (kopya listeler). KURAL: göreli-kelime seti gereken HER yer bu sabitten türetilir.
//
// Tüketiciler: simple-extractor (extractRelativeDate offset semantiği +
// hasRelativeDateWord), echo-sanitize (isEchoSafe göreli-kelime yankı sınıfı).
//
// Her değer bir regex-alternation GÖVDESİ (RegExp'e gömülür). ASCII + aksanlı
// TÜM TR varyantları (öbür/obür/öbur/obur, yarın/yarin, bugün/bugun) baked-in.

// 2026-07-09 FAZ4-P1 TR ÇEKİM KAPSAMI: kök + KONTROLLÜ yönelme/belirtme eki
// (a/e/ı/i/u/ü — "yarına ayarla", "bugüne", "öbür güne"). "ki" eki KASITLI HARİÇ:
// "yarınki program" = tarih SEÇİMİ değil, o günün programı (sıfat) → gün seçtirmemeli.
// Lookahead 'k'yi zaten bloklar (ek listesinde 'k' yok). Karar-gerekçe: eki dar
// tutmak yanlış-seçimi (yarınki→yarın) önler; recall-kaybı minimal (yönelme
// ekleri en yaygın tarih-verme formu).
export const REL_TODAY: Record<string, string> = {
  tr: "bugün[eü]?|bugun[eu]?",
  en: "today",
  de: "heute",
  ru: "сегодня",
  ar: "اليوم",
  fr: "aujourd'hui|aujourdhui",
  es: "hoy",
};

export const REL_TOMORROW: Record<string, string> = {
  tr: "yarın[aı]?|yarin[ai]?",
  en: "tomorrow",
  de: "morgen",
  ru: "завтра",
  ar: "غدا|غداً",
  fr: "demain",
  es: "mañana|manana",
};

export const REL_DAY_AFTER: Record<string, string> = {
  // TR: [öo]b[üu]r/ertesi + gün/gun + KONTROLLÜ yönelme eki [eüu] ("öbür güne")
  tr: "(?:[öo]b[üu]r|ertesi)\\s*g[üu]n[eüu]?",
  en: "day\\s*after\\s*tomorrow",
  de: "übermorgen|uebermorgen",
  ru: "послезавтра",
  fr: "après[\\s-]?demain|apres[\\s-]?demain",
  es: "pasado\\s*ma[nñ]ana",
  ar: "بعد\\s*غد|بعد\\s*بكرة", // فصحى بعد غد + konuşma بعد بكرة
};

export const REL_NEXT_WEEK: Record<string, string> = {
  tr: "haftaya|gelecek\\s*hafta|önümüzdeki\\s*hafta|onumuzdeki\\s*hafta",
  en: "next\\s*week",
  de: "nächste\\s*woche|naechste\\s*woche",
  ru: "следующ\\S+\\s+недел\\S+|на\\s+следующ\\S+\\s+недел\\S+",
  fr: "la\\s*semaine\\s*prochaine|semaine\\s*prochaine",
  es: "la\\s*pr[oó]xima\\s*semana|pr[oó]xima\\s*semana",
  ar: "الأسبوع\\s*القادم|الأسبوع\\s*المقبل|الأسبوع\\s*الجاي",
};

// Gün adları — DIŞ indeks = hafta günü (0=Pazar..6=Cumartesi, JS getDay ile
// hizalı), İÇ dizi = o günün varyantları (ASCII+aksanlı). extractRelativeDate
// "bir sonraki o gün" offset'ini DIŞ indeksten hesaplar → indeks semantiği
// KORUNMALI (varyant eklerken satır içine, yeni satır AÇMA). echo sınıfı düzler.
export const REL_DAY_NAMES: Record<string, string[][]> = {
  tr: [["pazar"], ["pazartesi"], ["salı", "sali"], ["çarşamba", "carsamba"], ["perşembe", "persembe"], ["cuma"], ["cumartesi"]],
  en: [["sunday"], ["monday"], ["tuesday"], ["wednesday"], ["thursday"], ["friday"], ["saturday"]],
  de: [["sonntag"], ["montag"], ["dienstag"], ["mittwoch"], ["donnerstag"], ["freitag"], ["samstag"]],
  ru: [["воскресенье"], ["понедельник"], ["вторник"], ["среда"], ["четверг"], ["пятница"], ["суббота"]],
  fr: [["dimanche"], ["lundi"], ["mardi"], ["mercredi"], ["jeudi"], ["vendredi"], ["samedi"]],
  es: [["domingo"], ["lunes"], ["martes"], ["miércoles", "miercoles"], ["jueves"], ["viernes"], ["sábado", "sabado"]],
  // AR: ال-prefix'li (çıplak "أحد"=birisi ile karışmasın). 0=Pazar..6=Cumartesi.
  ar: [["الأحد"], ["الإثنين", "الاثنين"], ["الثلاثاء"], ["الأربعاء"], ["الخميس"], ["الجمعة"], ["السبت"]],
};

// \p{L}\p{N} lookaround sarmalayıcı (Yan #8 dersi — non-ASCII sınır).
export function relRegex(body: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, "iu");
}

// echo-sanitize için "HERHANGİ göreli-kelime" — yankı sınıfı (tırnaklı basma).
// Göreli-tarih grupları + gün adları + yankı-only ekstralar (günlük/daily
// = süre-yankısı; sonra/later = belirsiz zaman). Tek regex, tek kaynak.
const _echoExtras = ["günlük", "gunluk", "daily", "sonra", "later"];
const _allRelBodies = [
  ...Object.values(REL_TODAY),
  ...Object.values(REL_TOMORROW),
  ...Object.values(REL_DAY_AFTER),
  ...Object.values(REL_NEXT_WEEK),
  ...Object.values(REL_DAY_NAMES).map((weekdays) => weekdays.flat().join("|")),
  _echoExtras.join("|"),
];
export const REL_ECHO_RE = relRegex(_allRelBodies.join("|"));
