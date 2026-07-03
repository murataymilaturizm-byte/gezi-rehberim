// Ay adı → ay numarası — TEK KAYNAK (2026-07-03 FAZ2-kapanış İş 1).
//
// CANLI DERS: "10 aralik" (ASCII) unit-testte parse ediliyordu (V1-ASCII
// simple-extractor'ı düzeltmişti) ama CANLI ZİNCİR farklı yoldan geçti —
// NLU dates=["10 aralik"] → Blok 2 normalizeDateString → TEXT_MONTHS
// (info-extractor'daki ÜÇÜNCÜ kopya liste, ASCII'siz!) → çevrilemedi →
// Blok 9 eşleşemedi → "Invalid date cleaned up: 10 aralik". Kopya listeler
// (simple-extractor monthNames + info-extractor TEXT_MONTHS + elle regex'ler)
// senkronsuz yaşıyordu — bug tam bu senkronsuzluktan doğdu.
//
// KURAL: Ay-adı listesi/regex'i gereken HER yer bu sabitten türetilmeli.
// Tüketiciler: info-extractor (TEXT_MONTHS + TEXT_MONTH_REGEX'ler),
// simple-extractor (monthNames + ay-adı regex'leri).
export const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  // TR — aksanlı + ASCII varyantlar
  ocak: 1, şubat: 2, subat: 2, mart: 3, nisan: 4, mayıs: 5, mayis: 5, haziran: 6,
  temmuz: 7, ağustos: 8, agustos: 8, eylül: 9, eylul: 9, ekim: 10,
  kasım: 11, kasim: 11, aralık: 12, aralik: 12,
  // EN — tam form
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  // EN — kısa form
  jan: 1, feb: 2, mar: 3, apr: 4,
  jun: 6, jul: 7, aug: 8, sep: 9, sept: 9,
  oct: 10, nov: 11, dec: 12,
  // DE (aksanlı + ASCII)
  januar: 1, februar: 2, märz: 3, maerz: 3, mai: 5, juni: 6, juli: 7,
  oktober: 10, dezember: 12,
  // FR (aksanlı + ASCII)
  janvier: 1, "février": 2, fevrier: 2, mars: 3, avril: 4, juin: 6, juillet: 7,
  "août": 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, "décembre": 12, decembre: 12,
  // ES
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, noviembre: 11, diciembre: 12,
  // RU (nominative + genitive)
  "январь": 1, "января": 1, "февраль": 2, "февраля": 2,
  "март": 3, "марта": 3, "апрель": 4, "апреля": 4,
  "май": 5, "мая": 5, "июнь": 6, "июня": 6,
  "июль": 7, "июля": 7, "август": 8, "августа": 8,
  "сентябрь": 9, "сентября": 9, "октябрь": 10, "октября": 10,
  "ноябрь": 11, "ноября": 11, "декабрь": 12, "декабря": 12,
  // AR
  "يناير": 1, "فبراير": 2,
  "مارس": 3, "أبريل": 4,
  "مايو": 5, "يونيو": 6,
  "يوليو": 7, "أغسطس": 8,
  "سبتمبر": 9, "أكتوبر": 10,
  "نوفمبر": 11, "ديسمبر": 12,
};

// Regex alternation'ı — uzun anahtarlar önce (jul öncesinde juillet eşleşsin)
export const MONTH_ALTERNATION = Object.keys(MONTH_NAME_TO_NUMBER)
  .sort((a, b) => b.length - a.length)
  .join("|");
