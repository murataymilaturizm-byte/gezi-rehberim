// ETAP 3: xlsx-js-style — drop-in API uyumlu, stil yazımını destekler.
import * as XLSX from 'xlsx-js-style';
import { format } from 'date-fns';
import { tr, enUS, de, fr, es, ru, ar } from 'date-fns/locale';
import i18next from 'i18next';
import { COLUMN_ORDER } from './excelColumnDictionary';

const getDateLocale = () => {
  const lang = i18next.language || 'tr';
  const locales: Record<string, typeof tr> = { tr, en: enUS, de, fr, es, ru, ar };
  return locales[lang] || tr;
};

const t = (key: string) => i18next.t(key);

interface Registration {
  id: string;
  full_name: string;
  phone: string;
  pax: number;
  status: string;
  note?: string;
  created_at: string;
  source_channel?: string;
  payment_status?: string;
  total_amount?: number;
  paid_amount?: number;
  deposit_amount?: number;
  tours: {
    title: string;
    destination: string;
  };
  tour_dates: {
    departure_date: string;
    return_date?: string;
    price_adult: number;
  };
}

interface Tour {
  id: string;
  title: string;
  destination: string;
  type: string;
  currency: string;
  min_pax: number;
  created_at: string;
  // Master detay alanları (panelde TourFormDialog'un sorduğu alanlar)
  visa_required?: boolean;
  program_url?: string | null;
  program_kisa?: string | null;
  hareket_noktasi?: string | null;
  toplanma_saati?: string | null;
  tur_sure?: string | null;
  konaklama?: string | null;
  ulasim?: string | null;
  tur_kategorisi?: string | null;
  gezilecek_yerler?: string | null;
  visa_notes?: string | null;
  hotel_name?: string | null;
  hotel_stars?: number | null;
  // Çok dilli master alanlar
  title_en?: string | null; title_de?: string | null; title_fr?: string | null;
  title_es?: string | null; title_ru?: string | null; title_ar?: string | null;
  destination_en?: string | null; destination_de?: string | null; destination_fr?: string | null;
  destination_es?: string | null; destination_ru?: string | null; destination_ar?: string | null;
  program_kisa_en?: string | null; program_kisa_de?: string | null; program_kisa_fr?: string | null;
  program_kisa_es?: string | null; program_kisa_ru?: string | null; program_kisa_ar?: string | null;
  // tour_dates BURADA TUTULMUYOR — export bu alanı YOKSAYAR (Etap 1: master-only).
  // Tarihler panelden ayrı yönetilir.
  tour_dates?: any[];
}

interface ConversationSummary {
  id: string;
  phone: string;
  conversation_date: string;
  summary: string;
  topics?: string[];
  mentioned_tours?: string[];
  sentiment?: string;
  message_count: number;
}

export const exportRegistrationsToExcel = (registrations: Registration[]) => {
  const locale = getDateLocale();
  const data = registrations.map((reg) => {
    const totalAmount = reg.total_amount || (reg.tour_dates.price_adult * reg.pax);
    const paidAmount = reg.paid_amount || 0;
    const remainingAmount = totalAmount - paidAmount;

    return {
      [t('admin.excel.registrationId')]: reg.id.substring(0, 8),
      [t('admin.registrations.name')]: reg.full_name,
      [t('admin.registrations.phone')]: reg.phone,
      [t('admin.registrations.tour')]: reg.tours.title,
      [t('admin.excel.destination')]: reg.tours.destination,
      [t('admin.registrations.date')]: format(new Date(reg.tour_dates.departure_date), 'dd MMMM yyyy', { locale }),
      [t('admin.registrations.pax')]: reg.pax,
      [t('admin.registrations.unitPrice')]: reg.tour_dates.price_adult,
      [t('admin.registrations.totalAmount')]: totalAmount,
      [t('admin.registrations.paidAmount')]: paidAmount,
      [t('admin.registrations.remainingAmount')]: remainingAmount,
      [t('admin.registrations.paymentStatus')]: t(`admin.paymentStatusLabels.${reg.payment_status || 'UNPAID'}`),
      [t('admin.registrations.status')]: t(`admin.status.${(reg.status || 'NEW').toLowerCase()}`),
      [t('admin.registrations.source')]: t(`admin.sourceChannel.${reg.source_channel || 'WHATSAPP'}`),
      [t('admin.registrations.note')]: reg.note || '-',
      [t('admin.registrations.createdAt')]: format(new Date(reg.created_at), 'dd MMMM yyyy HH:mm', { locale })
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 15 },
    { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 15 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 18 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, t('admin.excel.registrationsSheet'));

  const fileName = `${t('admin.excel.registrationsFile')}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

/**
 * Tur master export — 1 SATIR = 1 TUR.
 *
 * ETAP 1 TASARIM KARARI:
 * - Tarih/fiyat/kontenjan (tour_dates) Excel'de YOK. Tarihler panelden eklenir
 *   ("Toplu Tarih Oluştur" akışı). Excel yalnızca tur MASTER bilgisini içerir.
 * - Kolon başlıkları TEKNİK (snake_case, DB kolon adıyla aynı) — import parser'ın
 *   tanıyabilmesi için yerelleşmez. Talimatlar sheet'i yerel dilde açıklar.
 * - __tour_id ve created_at SALT-OKUNUR sistem kolonları — export'tan dolu döner;
 *   import bu etapta __tour_id'yi YOKSAYAR (Etap 2'de UPSERT eşleşmesi için).
 * - Aynı dosya format'ı BulkTourImport.downloadTemplate ile birebir uyumlu.
 *
 * KOLON LİSTESİ (TourFormDialog INITIAL_FORM + tours DB master = aynı set):
 *   Sistem: __tour_id (🔒), created_at (🔒)
 *   Zorunlu: title, destination, type, currency
 *   Master detay: min_pax, visa_required, program_url, program_kisa,
 *                 hareket_noktasi, toplanma_saati, tur_sure, tur_kategorisi,
 *                 gezilecek_yerler, ulasim, konaklama, hotel_name, hotel_stars,
 *                 visa_notes
 *   Çok dilli: title_{en,de,fr,es,ru,ar}, destination_{en,de,fr,es,ru,ar},
 *              program_kisa_{en,de,fr,es,ru,ar}
 *   Toplam: 2 sistem + 4 zorunlu + 14 master + 18 çok dilli = 38 kolon.
 */
export const exportToursToExcel = (tours: Tour[]) => {
  const locale = getDateLocale();

  // Boolean'ı evet/hayır olarak yazmak — i18n key kullanmak yerine teknik string
  // (import parser her iki dilde de "evet/hayır/yes/no/true/false" anlıyor).
  const _yesNo = (v?: boolean | null): string => (v === true ? "evet" : v === false ? "hayır" : "");

  // Görünür başlık çözücüsü:
  //   - Sistem kolonları (__tour_id, created_at) TEKNİK kalır (i18n YOK).
  //   - Diğer kolonlar acentenin GÜNCEL panel diline göre yerelleşir.
  //   - defaultValue TR — i18n eksikse Türkçe fallback.
  const _SYSTEM_KEYS = new Set(["__tour_id", "created_at"]);
  const _TR_DEFAULTS: Record<string, string> = {
    title: "Tur Adı", destination: "Destinasyon", type: "Tip", currency: "Para Birimi",
    min_pax: "Min. Kişi", visa_required: "Vize Gerekli", program_url: "Program URL",
    program_kisa: "Kısa Program", hareket_noktasi: "Hareket Noktası",
    toplanma_saati: "Toplanma Saati", tur_sure: "Tur Süresi", tur_kategorisi: "Tur Kategorisi",
    gezilecek_yerler: "Gezilecek Yerler", ulasim: "Ulaşım", konaklama: "Konaklama",
    hotel_name: "Otel Adı", hotel_stars: "Otel Yıldızı", visa_notes: "Vize Notları",
    title_en: "Tur Adı (EN)", title_de: "Tur Adı (DE)", title_fr: "Tur Adı (FR)",
    title_es: "Tur Adı (ES)", title_ru: "Tur Adı (RU)", title_ar: "Tur Adı (AR)",
    destination_en: "Destinasyon (EN)", destination_de: "Destinasyon (DE)",
    destination_fr: "Destinasyon (FR)", destination_es: "Destinasyon (ES)",
    destination_ru: "Destinasyon (RU)", destination_ar: "Destinasyon (AR)",
    program_kisa_en: "Kısa Program (EN)", program_kisa_de: "Kısa Program (DE)",
    program_kisa_fr: "Kısa Program (FR)", program_kisa_es: "Kısa Program (ES)",
    program_kisa_ru: "Kısa Program (RU)", program_kisa_ar: "Kısa Program (AR)",
  };
  const _h = (tech: string): string => {
    if (_SYSTEM_KEYS.has(tech)) return tech;  // __tour_id, created_at teknik kalır
    return i18next.t(`bulk.col.${tech}`, { defaultValue: _TR_DEFAULTS[tech] ?? tech });
  };

  // Tur master değerini teknik anahtardan al (yerelleşmemiş — DB değeri).
  const _val = (tour: Tour, tech: string): any => {
    switch (tech) {
      case "__tour_id": return tour.id;
      case "created_at": return tour.created_at ? format(new Date(tour.created_at), "yyyy-MM-dd", { locale }) : "";
      case "title": return tour.title ?? "";
      case "destination": return tour.destination ?? "";
      case "type": return tour.type ?? "DAYTRIP";
      case "currency": return tour.currency ?? "TRY";
      case "min_pax": return tour.min_pax ?? 1;
      case "visa_required": return _yesNo(tour.visa_required);
      case "program_url": return tour.program_url ?? "";
      case "program_kisa": return tour.program_kisa ?? "";
      case "hareket_noktasi": return tour.hareket_noktasi ?? "";
      case "toplanma_saati": return tour.toplanma_saati ?? "";
      case "tur_sure": return tour.tur_sure ?? "";
      case "tur_kategorisi": return tour.tur_kategorisi ?? "";
      case "gezilecek_yerler": return tour.gezilecek_yerler ?? "";
      case "ulasim": return tour.ulasim ?? "";
      case "konaklama": return tour.konaklama ?? "";
      case "hotel_name": return tour.hotel_name ?? "";
      case "hotel_stars": return tour.hotel_stars ?? "";
      case "visa_notes": return tour.visa_notes ?? "";
      default: return (tour as any)[tech] ?? "";
    }
  };

  // Sabit teknik sıra (COLUMN_ORDER) — sadece görünür başlık yerelleşir.
  // 1 satır = 1 TUR. tour_dates KULLANILMAZ.
  const data = tours.map((tour) => {
    const row: Record<string, any> = {};
    for (const tech of COLUMN_ORDER) {
      row[_h(tech)] = _val(tour, tech);
    }
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  // Sütun genişlikleri — okunabilirlik için ölçekli
  worksheet["!cols"] = [
    { wch: 38 }, { wch: 12 },                           // __tour_id, created_at
    { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, // title, destination, type, currency
    { wch: 8 },  { wch: 10 }, { wch: 30 }, { wch: 60 }, // min_pax, visa_required, program_url, program_kisa
    { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, // hareket_noktasi, toplanma_saati, tur_sure, tur_kategorisi
    { wch: 40 }, { wch: 22 }, { wch: 30 }, { wch: 22 }, // gezilecek_yerler, ulasim, konaklama, hotel_name
    { wch: 10 }, { wch: 30 },                           // hotel_stars, visa_notes
    { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, // title_xx
    { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, // destination_xx
    { wch: 60 }, { wch: 60 }, { wch: 60 }, { wch: 60 }, { wch: 60 }, { wch: 60 }, // program_kisa_xx
  ];

  // ETAP 3: Renkli başlık grupları — şablonla AYNI sözleşme (turuncu=zorunlu, mavi=opsiyonel, gri=sistem).
  // xlsx-js-style ile yazılır. Dictionary'deki COLUMN_ORDER ile kolon indeksi eşleşir.
  const REQUIRED_EXPORT = new Set(["title", "destination", "type", "currency"]);
  const SYSTEM_EXPORT = new Set(["__tour_id", "created_at"]);
  const _styleReq = {
    fill: { fgColor: { rgb: "FFD8A8" } },
    font: { color: { rgb: "7C2D12" }, bold: true },
    alignment: { vertical: "center", horizontal: "left" },
  };
  const _styleOpt = {
    fill: { fgColor: { rgb: "DBEAFE" } },
    font: { color: { rgb: "1E3A8A" }, bold: true },
    alignment: { vertical: "center", horizontal: "left" },
  };
  const _styleSys = {
    fill: { fgColor: { rgb: "E5E7EB" } },
    font: { color: { rgb: "374151" }, bold: true, italic: true },
    alignment: { vertical: "center", horizontal: "left" },
  };
  COLUMN_ORDER.forEach((tech, idx) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c: idx });
    if (!worksheet[ref]) return;
    if (SYSTEM_EXPORT.has(tech)) worksheet[ref].s = _styleSys;
    else if (REQUIRED_EXPORT.has(tech)) worksheet[ref].s = _styleReq;
    else worksheet[ref].s = _styleOpt;
  });

  // Talimatlar sheet'i — yerel dilde açıklama (export ile şablon aynı format
  // kullandığı için iki sheet'te de bu açıklama lazım).
  const _instr = (key: string, fallback: string) => i18next.t(key, { defaultValue: fallback });
  const instructions = [
    { Kolon: "__tour_id",      Tip: "🔒", Açıklama: _instr("bulk.tpl.__tour_id", "Sistem kimliği — DEĞİŞTİRMEYİN/SİLMEYİN. Mevcut turu güncellemek için gereklidir (Etap 2)."), Örnek: "(otomatik)" },
    { Kolon: "created_at",     Tip: "🔒", Açıklama: _instr("bulk.tpl.created_at", "Tur oluşturma tarihi — sistem alanı, salt-okunur."), Örnek: "2026-05-24" },
    { Kolon: "title",          Tip: _instr("bulk.tpl.req", "ZORUNLU"), Açıklama: _instr("bulk.tpl.title", "Tur başlığı (Türkçe)"), Örnek: "Kapadokya Balon Turu" },
    { Kolon: "destination",    Tip: _instr("bulk.tpl.req", "ZORUNLU"), Açıklama: _instr("bulk.tpl.destination", "Şehir/bölge"), Örnek: "Kapadokya" },
    { Kolon: "type",           Tip: _instr("bulk.tpl.req", "ZORUNLU"), Açıklama: _instr("bulk.tpl.type", "Tur tipi: DAYTRIP (günübirlik), N2 (2 gece), N3 (3+ gece)"), Örnek: "DAYTRIP" },
    { Kolon: "currency",       Tip: _instr("bulk.tpl.req", "ZORUNLU"), Açıklama: _instr("bulk.tpl.currency", "Para birimi: TRY, USD, EUR, GBP, SAR, AED, RUB"), Örnek: "TRY" },
    { Kolon: "min_pax",        Tip: _instr("bulk.tpl.opt", "Opsiyonel"), Açıklama: _instr("bulk.tpl.minPax", "Minimum kişi sayısı (sayı)"), Örnek: "2" },
    { Kolon: "visa_required",  Tip: _instr("bulk.tpl.opt", "Opsiyonel"), Açıklama: _instr("bulk.tpl.visa", "Vize gerekli mi: evet / hayır"), Örnek: "hayır" },
    { Kolon: "program_url",    Tip: _instr("bulk.tpl.opt", "Opsiyonel"), Açıklama: _instr("bulk.tpl.programUrl", "Tur programı PDF/web linki (opsiyonel)"), Örnek: "https://..." },
    { Kolon: "program_kisa",   Tip: _instr("bulk.tpl.opt", "Opsiyonel"), Açıklama: _instr("bulk.tpl.program", "Tur programı/içeriği — botun müşteriye anlattığı kısa açıklama"), Örnek: "Sabah 04:30 alış, balon uçuşu, kahvaltı..." },
    { Kolon: "hareket_noktasi",Tip: _instr("bulk.tpl.opt", "Opsiyonel"), Açıklama: _instr("bulk.tpl.meetingPoint", "Kalkış/buluşma yeri"), Örnek: "Otel lobisi" },
    { Kolon: "toplanma_saati", Tip: _instr("bulk.tpl.opt", "Opsiyonel"), Açıklama: _instr("bulk.tpl.meetingTime", "Saat — HH:MM formatı"), Örnek: "09:00" },
    { Kolon: "tur_sure",       Tip: _instr("bulk.tpl.opt", "Opsiyonel"), Açıklama: _instr("bulk.tpl.duration", "Tur süresi"), Örnek: "1 gün / 2 gece 3 gün" },
    { Kolon: "tur_kategorisi", Tip: _instr("bulk.tpl.opt", "Opsiyonel"), Açıklama: _instr("bulk.tpl.category", "Kültür / Doğa / Macera / Deniz vb."), Örnek: "Macera" },
    { Kolon: "gezilecek_yerler",Tip: _instr("bulk.tpl.opt", "Opsiyonel"), Açıklama: _instr("bulk.tpl.places", "Virgülle ayrılmış yer listesi"), Örnek: "Göreme, Uçhisar, Peri Bacaları" },
    { Kolon: "ulasim",         Tip: _instr("bulk.tpl.opt", "Opsiyonel"), Açıklama: _instr("bulk.tpl.transport", "Ulaşım şekli"), Örnek: "Klimalı otobüs" },
    { Kolon: "konaklama",      Tip: _instr("bulk.tpl.opt", "N2/N3"), Açıklama: _instr("bulk.tpl.accommodation", "Konaklama açıklaması (oda tipi, yemek dahil mi)"), Örnek: "2 gece çift kişilik oda + kahvaltı" },
    { Kolon: "hotel_name",     Tip: _instr("bulk.tpl.opt", "Opsiyonel"), Açıklama: _instr("bulk.tpl.hotelName", "Otel adı (varsa)"), Örnek: "Hotel Sultanahmet Palace" },
    { Kolon: "hotel_stars",    Tip: _instr("bulk.tpl.opt", "Opsiyonel"), Açıklama: _instr("bulk.tpl.hotelStars", "Otel yıldızı (1-5 arası sayı)"), Örnek: "4" },
    { Kolon: "visa_notes",     Tip: _instr("bulk.tpl.opt", "Opsiyonel"), Açıklama: _instr("bulk.tpl.visaNotes", "Vize ile ilgili açıklama"), Örnek: "Schengen vizesi şart" },
    { Kolon: "title_{en,de,fr,es,ru,ar}",      Tip: _instr("bulk.tpl.opt", "Opsiyonel"), Açıklama: _instr("bulk.tpl.titleMulti", "Yurtdışı müşteri için tur başlığı çevirisi (boş bırakılabilir)"), Örnek: "Cappadocia Balloon Tour" },
    { Kolon: "destination_{en,de,fr,es,ru,ar}",Tip: _instr("bulk.tpl.opt", "Opsiyonel"), Açıklama: _instr("bulk.tpl.destMulti", "Yurtdışı müşteri için destinasyon çevirisi"), Örnek: "Cappadocia" },
    { Kolon: "program_kisa_{en,de,fr,es,ru,ar}",Tip: _instr("bulk.tpl.opt", "Opsiyonel"), Açıklama: _instr("bulk.tpl.programMulti", "Yurtdışı müşteri için program özeti çevirisi (en azından en önerilir)"), Örnek: "04:30 pickup, 1-hour balloon flight..." },
    // ETAP 3: Renk açıklamaları — başlık hücreleri renk gruplarıyla işaretli.
    { Kolon: "—", Tip: "🟠", Açıklama: _instr("bulk.tpl.colorRequired", "Turuncu başlık = ZORUNLU alan. Boş bırakılamaz."), Örnek: "" },
    { Kolon: "—", Tip: "🔵", Açıklama: _instr("bulk.tpl.colorOptional", "Mavi başlık = Opsiyonel. Doldurursanız bot daha iyi yanıt verir, ama zorunlu değil."), Örnek: "" },
    { Kolon: "—", Tip: "⚪", Açıklama: _instr("bulk.tpl.colorSystem", "Gri başlık = Sistem alanı. DOKUNMAYIN — otomatik dolar/değiştirmeyin."), Örnek: "" },
    // Tarih notu en altta — kritik UX bilgisi
    { Kolon: "—", Tip: "ℹ️", Açıklama: _instr("bulk.tpl.dateNotice", "Tur TARİHLERİ, FİYAT ve KONTENJAN bu Excel'de YOKTUR. Tarihleri panelden 'Toplu Tarih Oluştur' ile ekleyin."), Örnek: "" },
  ];
  const wsInstructions = XLSX.utils.json_to_sheet(instructions);
  wsInstructions["!cols"] = [{ wch: 32 }, { wch: 14 }, { wch: 70 }, { wch: 50 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, t("admin.excel.toursSheet"));
  XLSX.utils.book_append_sheet(
    workbook,
    wsInstructions,
    _instr("bulk.tpl.sheetInstructions", "Talimatlar"),
  );

  const fileName = `${t("admin.excel.toursFile")}_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

export const exportConversationSummariesToExcel = (summaries: ConversationSummary[]) => {
  const locale = getDateLocale();
  const data = summaries.map((summary) => ({
    [t('admin.registrations.phone')]: summary.phone,
    [t('admin.registrations.date')]: format(new Date(summary.conversation_date), 'dd MMMM yyyy', { locale }),
    [t('admin.excel.summary')]: summary.summary,
    [t('admin.excel.topics')]: summary.topics?.join(', ') || '-',
    [t('admin.excel.mentionedTours')]: summary.mentioned_tours?.join(', ') || '-',
    [t('admin.excel.sentiment')]: summary.sentiment || '-',
    [t('admin.excel.messageCount')]: summary.message_count
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 50 }, { wch: 30 }, { wch: 30 }, { wch: 15 }, { wch: 12 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, t('admin.excel.conversationsSheet'));

  const fileName = `${t('admin.excel.conversationsFile')}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

export const exportAnalyticsToExcel = (analytics: {
  revenueByMonth: Array<{ month: string; revenue: number; registrations: number }>;
  topDestinations: Array<{ destination: string; count: number; revenue: number }>;
  conversionRates: Array<{ date: string; conversations: number; registrations: number; rate: number }>;
}) => {
  const workbook = XLSX.utils.book_new();

  const revenueData = analytics.revenueByMonth.map((item) => ({
    [t('admin.excel.month')]: item.month,
    [t('admin.excel.revenue')]: item.revenue,
    [t('admin.excel.registrationCount')]: item.registrations,
    [t('admin.excel.avgRevenue')]: Math.round(item.revenue / (item.registrations || 1))
  }));
  const revenueSheet = XLSX.utils.json_to_sheet(revenueData);
  revenueSheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, revenueSheet, t('admin.excel.monthlyRevenueSheet'));

  const destinationData = analytics.topDestinations.map((item) => ({
    [t('admin.excel.destination')]: item.destination,
    [t('admin.excel.registrationCount')]: item.count,
    [t('admin.excel.totalRevenue')]: item.revenue,
    [t('admin.excel.avgRevenue')]: Math.round(item.revenue / (item.count || 1))
  }));
  const destinationSheet = XLSX.utils.json_to_sheet(destinationData);
  destinationSheet['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, destinationSheet, t('admin.excel.popularDestinationsSheet'));

  const conversionData = analytics.conversionRates.map((item) => ({
    [t('admin.registrations.date')]: item.date,
    [t('admin.excel.conversations')]: item.conversations,
    [t('admin.excel.registrationCount')]: item.registrations,
    [t('admin.excel.conversionRate')]: (item.rate * 100).toFixed(2)
  }));
  const conversionSheet = XLSX.utils.json_to_sheet(conversionData);
  conversionSheet['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, conversionSheet, t('admin.excel.conversionRatesSheet'));

  const fileName = `${t('admin.excel.analyticsFile')}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};
