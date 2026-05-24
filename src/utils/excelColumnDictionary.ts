/**
 * Excel kolon başlığı sözlüğü — IMPORT için (parser kullanır).
 *
 * MİMARİ KARAR (kritik):
 *   Bu sözlük EXPORT i18n'inden BAĞIMSIZ ve KASITLI olarak. Sebep: Acentenin
 *   geçmişte indirdiği Excel dosyaları parser'ın TANIYABİLDİĞİ başlıklarla yazıldı.
 *   i18n string'leri ilerde değişirse (örn. "Programa breve" → "Programa corto"),
 *   canlı türetilen bir sözlük eski export'ları artık tanıyamaz → round-trip kırılır.
 *   Bu sözlük geriye doğru sadece BÜYÜR, asla daralmaz.
 *
 *   EXPORT görünür başlığı i18n'den (bulk.col.*) — acentenin GÜNCEL panel diline göre.
 *   IMPORT alias sözlüğü BURADA — sabit, hardcode, geriye uyumlu, biriken.
 *
 * GERIYE UYUMLULUK:
 *   Mevcut parser'da var olan TR snake_case + TR PascalCase + EN PascalCase
 *   alias'ları (örn. `row.program_kisa || row.Program || row.Description`)
 *   BURAYA TAŞINDI ve kaybedilmedi.
 *
 * SİSTEM KOLONLARI (__tour_id, created_at):
 *   Teknik kalır — yerelleştirme yok (UUID/tarih için anlamsız). Yine de
 *   geriye uyumluluk için birkaç pratik alias (Created At / Oluşturma) kabul edilir.
 *
 * UNIQUENESS GARANTISI:
 *   Module load sırasında runtime check: aynı normalized alias iki teknik kolona
 *   düşerse console.error + ilk wins. Test edildi — çakışma YOK (rapora bakın).
 */

/**
 * Teknik isim (DB kolonu) → o kolonun tanınan tüm başlık varyasyonları (case-insensitive).
 * Her teknik kolon en az şunu içerir:
 *   1. Teknik snake_case (geriye uyumluluk + fallback)
 *   2. 7 dilde yerel başlık
 *   3. Yaygın PascalCase / Title Case formları (Excel export geçmişinden)
 */
export const COLUMN_DICTIONARY: Record<string, string[]> = {
  // ═══ SİSTEM (salt-okunur) ═══
  __tour_id: ["__tour_id", "tour_id"],
  created_at: [
    "created_at",
    "Created At",
    "Oluşturma", "Oluşturma Tarihi",
    "Erstellt", "Erstellungsdatum",
    "Дата создания",
    "Date de création",
    "Fecha de creación",
    "تاريخ الإنشاء",
  ],

  // ═══ ZORUNLU ═══
  title: [
    "title", "Title",
    "Tur Adı", "Tur Adi", "Başlık",
    "Tour Name", "Tour Title",
    "Tourtitel", "Reisetitel", "Name der Tour",
    "Название", "Название тура",
    "Titre", "Titre du circuit",
    "Título", "Título del tour",
    "العنوان", "عنوان الجولة",
  ],
  destination: [
    "destination", "Destination",
    "Destinasyon", "Hedef", "Varış Yeri",
    "Reiseziel", "Ziel",
    "Направление",
    "Destination ", "Destination du circuit",
    "Destino",
    "الوجهة",
  ],
  type: [
    "type", "Type",
    "Tip", "Tur Tipi",
    "Typ", "Tourtyp",
    "Тип", "Тип тура",
    "Type de circuit",
    "Tipo", "Tipo de tour",
    "النوع", "نوع الجولة",
  ],
  currency: [
    "currency", "Currency",
    "Para Birimi", "Döviz",
    "Währung",
    "Валюта",
    "Devise",
    "Moneda",
    "العملة",
  ],

  // ═══ MASTER DETAY ═══
  min_pax: [
    "min_pax", "MinPax", "Min Pax",
    "Min. Kişi", "Minimum Kişi",
    "Min. Personen", "Mindestpersonen",
    "Мин. участников", "Минимум участников",
    "Min. participants",
    "Min. participantes",
    "الحد الأدنى للأشخاص",
  ],
  visa_required: [
    "visa_required", "VisaRequired",
    "Vize Gerekli", "Vize Gerekli mi",
    "Visum erforderlich",
    "Виза нужна", "Требуется виза",
    "Visa requis",
    "Visa requerida", "Visado requerido",
    "تأشيرة مطلوبة",
  ],
  program_url: [
    "program_url", "ProgramUrl", "Program URL",
    "Program Linki", "Program Bağlantısı",
    "Programm-URL", "Programm-Link",
    "URL программы", "Ссылка на программу",
    "URL du programme",
    "URL del programa",
    "رابط البرنامج",
  ],
  program_kisa: [
    "program_kisa", "Program", "Description",
    "Kısa Program", "Program Özeti",
    "Short Program", "Tour Program",
    "Kurzprogramm", "Programmübersicht",
    "Краткая программа", "Программа тура",
    "Programme court", "Programme",
    "Programa breve", "Programa corto",
    "البرنامج المختصر", "البرنامج",
  ],
  hareket_noktasi: [
    "hareket_noktasi", "MeetingPoint",
    "Hareket Noktası", "Buluşma Yeri", "Kalkış Yeri",
    "Meeting Point", "Departure Point",
    "Treffpunkt", "Abfahrtsort",
    "Место встречи", "Точка отправления",
    "Point de départ", "Point de rencontre",
    "Punto de encuentro", "Punto de salida",
    "نقطة الانطلاق", "نقطة الالتقاء",
  ],
  toplanma_saati: [
    "toplanma_saati", "MeetingTime",
    "Toplanma Saati", "Buluşma Saati",
    "Meeting Time", "Departure Time",
    "Treffzeit", "Abfahrtszeit",
    "Время встречи", "Время сбора",
    "Heure de rencontre",
    "Hora de encuentro",
    "وقت اللقاء",
  ],
  tur_sure: [
    "tur_sure", "Duration",
    "Tur Süresi", "Süre",
    "Tour Duration",
    "Tourdauer", "Dauer",
    "Продолжительность", "Длительность",
    "Durée du circuit", "Durée",
    "Duración del tour", "Duración",
    "مدة الجولة", "المدة",
  ],
  tur_kategorisi: [
    "tur_kategorisi", "Category",
    "Tur Kategorisi", "Kategori",
    "Tour Category",
    "Tourkategorie", "Kategorie",
    "Категория тура", "Категория",
    "Catégorie de circuit", "Catégorie",
    "Categoría del tour", "Categoría",
    "فئة الجولة", "الفئة",
  ],
  gezilecek_yerler: [
    "gezilecek_yerler", "Highlights", "Places",
    "Gezilecek Yerler", "Görülecek Yerler",
    "Places to Visit", "Sights",
    "Sehenswürdigkeiten", "Orte",
    "Места для посещения", "Достопримечательности",
    "Lieux à visiter",
    "Lugares a visitar",
    "أماكن الزيارة",
  ],
  ulasim: [
    "ulasim", "Ulasim", "Transport", "Transportation",
    "Ulaşım",
    "Beförderung", "Verkehrsmittel",
    "Транспорт",
    "Moyen de transport",
    "Transporte",
    "وسيلة النقل",
  ],
  konaklama: [
    "konaklama", "Accommodation",
    "Konaklama", "Konaklama Detayları",
    "Unterkunft",
    "Размещение", "Проживание",
    "Hébergement",
    "Alojamiento",
    "الإقامة",
  ],
  hotel_name: [
    "hotel_name", "HotelName",
    "Otel Adı",
    "Hotel Name",
    "Hotelname",
    "Название отеля", "Отель",
    "Nom de l'hôtel",
    "Nombre del hotel",
    "اسم الفندق",
  ],
  hotel_stars: [
    "hotel_stars", "HotelStars",
    "Otel Yıldızı", "Yıldız",
    "Hotel Stars", "Star Rating",
    "Hotelsterne", "Sterne",
    "Звёзды отеля", "Звезды отеля",
    "Étoiles de l'hôtel",
    "Estrellas del hotel",
    "نجوم الفندق",
  ],
  visa_notes: [
    "visa_notes", "VisaNotes",
    "Vize Notları",
    "Visa Notes",
    "Visum-Hinweise", "Visa-Hinweise",
    "Заметки по визе", "Примечания по визе",
    "Notes sur le visa",
    "Notas de la visa",
    "ملاحظات التأشيرة",
  ],

  // ═══ ÇOK DİLLİ BAŞLIK (her dilin alias'ı language code suffix ile ayrılır) ═══
  // KRITIK: çok dilli alias'lar HER ZAMAN dil kodu içerir (parantez veya suffix).
  // Bare "title" / "Tur Adı" / "Reisetitel" sadece BASE title'a düşer, multilingual'a değil.
  title_en: ["title_en", "TitleEN", "Title (EN)", "Tur Adı (EN)", "Reisetitel (EN)", "Tourtitel (EN)", "Название (EN)", "Titre (EN)", "Título (EN)", "العنوان (EN)"],
  title_de: ["title_de", "TitleDE", "Title (DE)", "Tur Adı (DE)", "Reisetitel (DE)", "Tourtitel (DE)", "Название (DE)", "Titre (DE)", "Título (DE)", "العنوان (DE)"],
  title_fr: ["title_fr", "TitleFR", "Title (FR)", "Tur Adı (FR)", "Reisetitel (FR)", "Tourtitel (FR)", "Название (FR)", "Titre (FR)", "Título (FR)", "العنوان (FR)"],
  title_es: ["title_es", "TitleES", "Title (ES)", "Tur Adı (ES)", "Reisetitel (ES)", "Tourtitel (ES)", "Название (ES)", "Titre (ES)", "Título (ES)", "العنوان (ES)"],
  title_ru: ["title_ru", "TitleRU", "Title (RU)", "Tur Adı (RU)", "Reisetitel (RU)", "Tourtitel (RU)", "Название (RU)", "Titre (RU)", "Título (RU)", "العنوان (RU)"],
  title_ar: ["title_ar", "TitleAR", "Title (AR)", "Tur Adı (AR)", "Reisetitel (AR)", "Tourtitel (AR)", "Название (AR)", "Titre (AR)", "Título (AR)", "العنوان (AR)"],

  destination_en: ["destination_en", "DestinationEN", "Destination (EN)", "Destinasyon (EN)", "Reiseziel (EN)", "Направление (EN)", "Destino (EN)", "الوجهة (EN)"],
  destination_de: ["destination_de", "DestinationDE", "Destination (DE)", "Destinasyon (DE)", "Reiseziel (DE)", "Направление (DE)", "Destino (DE)", "الوجهة (DE)"],
  destination_fr: ["destination_fr", "DestinationFR", "Destination (FR)", "Destinasyon (FR)", "Reiseziel (FR)", "Направление (FR)", "Destino (FR)", "الوجهة (FR)"],
  destination_es: ["destination_es", "DestinationES", "Destination (ES)", "Destinasyon (ES)", "Reiseziel (ES)", "Направление (ES)", "Destino (ES)", "الوجهة (ES)"],
  destination_ru: ["destination_ru", "DestinationRU", "Destination (RU)", "Destinasyon (RU)", "Reiseziel (RU)", "Направление (RU)", "Destino (RU)", "الوجهة (RU)"],
  destination_ar: ["destination_ar", "DestinationAR", "Destination (AR)", "Destinasyon (AR)", "Reiseziel (AR)", "Направление (AR)", "Destino (AR)", "الوجهة (AR)"],

  program_kisa_en: ["program_kisa_en", "ProgramEN", "Short Program (EN)", "Kısa Program (EN)", "Kurzprogramm (EN)", "Краткая программа (EN)", "Programme court (EN)", "Programa breve (EN)", "البرنامج المختصر (EN)"],
  program_kisa_de: ["program_kisa_de", "ProgramDE", "Short Program (DE)", "Kısa Program (DE)", "Kurzprogramm (DE)", "Краткая программа (DE)", "Programme court (DE)", "Programa breve (DE)", "البرنامج المختصر (DE)"],
  program_kisa_fr: ["program_kisa_fr", "ProgramFR", "Short Program (FR)", "Kısa Program (FR)", "Kurzprogramm (FR)", "Краткая программа (FR)", "Programme court (FR)", "Programa breve (FR)", "البرنامج المختصر (FR)"],
  program_kisa_es: ["program_kisa_es", "ProgramES", "Short Program (ES)", "Kısa Program (ES)", "Kurzprogramm (ES)", "Краткая программа (ES)", "Programme court (ES)", "Programa breve (ES)", "البرنامج المختصر (ES)"],
  program_kisa_ru: ["program_kisa_ru", "ProgramRU", "Short Program (RU)", "Kısa Program (RU)", "Kurzprogramm (RU)", "Краткая программа (RU)", "Programme court (RU)", "Programa breve (RU)", "البرنامج المختصر (RU)"],
  program_kisa_ar: ["program_kisa_ar", "ProgramAR", "Short Program (AR)", "Kısa Program (AR)", "Kurzprogramm (AR)", "Краткая программа (AR)", "Programme court (AR)", "Programa breve (AR)", "البرنامج المختصر (AR)"],
};

/**
 * Sabit teknik kolon sırası. Export ve şablon bu sırayı kullanır — kolonlar
 * tüm dillerde aynı pozisyonda görünür (sadece görsel başlık dile göre değişir).
 */
export const COLUMN_ORDER: string[] = Object.keys(COLUMN_DICTIONARY);

/**
 * Header normalizasyonu: case-insensitive + Türkçe karakter ASCII'leştirme +
 * whitespace collapse + trim. Aynı görünen ama farklı yazılmış başlıkları eşler.
 *   "Tur  Adı" / "tur adi" / "TUR ADI" / "Tur Adı " → "tur adi"
 */
function normalize(s: string): string {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Pre-computed lookup map: normalized alias → technical name ──────────────
// Module load sırasında doldurulur. Çakışma varsa console.error (ilk yazılan kazanır).
const _ALIAS_TO_TECHNICAL = new Map<string, string>();
const _CONFLICTS: Array<{ alias: string; first: string; second: string }> = [];

for (const [technical, aliases] of Object.entries(COLUMN_DICTIONARY)) {
  for (const alias of aliases) {
    const norm = normalize(alias);
    if (!norm) continue;
    const existing = _ALIAS_TO_TECHNICAL.get(norm);
    if (existing && existing !== technical) {
      _CONFLICTS.push({ alias, first: existing, second: technical });
      continue; // first wins
    }
    _ALIAS_TO_TECHNICAL.set(norm, technical);
  }
}

if (_CONFLICTS.length > 0) {
  // eslint-disable-next-line no-console
  console.error("[excelColumnDictionary] Alias conflicts detected:", _CONFLICTS);
}

/**
 * Verilen Excel başlık string'ini teknik isme çevir.
 * Tanınmazsa null döner — caller "unrecognized column" uyarısı gösterir.
 */
export function resolveColumn(header: string): string | null {
  return _ALIAS_TO_TECHNICAL.get(normalize(header)) ?? null;
}

/**
 * Bir satırı (Excel'den okunmuş, key'leri YEREL başlık olan obje) normalized
 * teknik isimli bir objeye çevir. Tanınmayan header'ları `unknown` set'ine ekler.
 */
export function normalizeRow(
  rawRow: Record<string, any>,
  unknownHeaders?: Set<string>,
): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [header, value] of Object.entries(rawRow)) {
    const technical = resolveColumn(header);
    if (technical) {
      out[technical] = value;
    } else if (unknownHeaders && header && header.trim()) {
      unknownHeaders.add(header);
    }
  }
  return out;
}
