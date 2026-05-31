// Faz 2-A: Yolcu Listesi (Manifesto) — Excel çıktısı.
// xlsx-js-style ile stil destekli, src/utils/excelExporter.ts pattern'i takip ediyor.
// Format nötr/global — kurum/birlik ibaresi yok.
import * as XLSX from "xlsx-js-style";
import { format } from "date-fns";
import { tr, enUS, de, fr, es, ru, ar } from "date-fns/locale";
import i18next from "i18next";

const getDateLocale = () => {
  const lang = i18next.language || "tr";
  const locales: Record<string, typeof tr> = { tr, en: enUS, de, fr, es, ru, ar };
  return locales[lang] || tr;
};

export interface ManifestPassenger {
  passenger_order: number;
  full_name: string;
  identity_no?: string | null;
  passport_no?: string | null;
  birth_date?: string | null;
  is_child?: boolean;
  // Faz 2-D: bakiye grubu tespiti için (aynı registration_id'nin yolcuları aynı bakiyeye bağlı)
  registration_id?: string;
}

// Faz 2-D: rezervasyon-bazlı ödeme/bakiye metası. Bir rezervasyonun N yolcusu aynı
// bakiyeye bağlıdır → bakiye grubun İLK yolcu satırında gösterilir, diğerlerinde boş.
export interface ManifestRegistrationMeta {
  registration_id: string;
  total: number;
  paid: number;
  remaining: number;
  currency: string;
}

export interface ManifestContext {
  tourTitle: string;
  tourDestination?: string;
  departureDate: string;
  returnDate?: string | null;
  vehiclePlate?: string;
  guideName?: string;
  // Faz 2-D: ek personel + bakiye metası
  tourLeaderName?: string;
  captainName?: string;
  registrationMeta?: ManifestRegistrationMeta[];
}

const STYLE_TITLE = {
  font: { bold: true, sz: 14 },
  alignment: { horizontal: "center" as const, vertical: "center" as const },
};

const STYLE_SUBTITLE = {
  font: { bold: true, sz: 11, color: { rgb: "555555" } },
  alignment: { horizontal: "left" as const },
};

const STYLE_HEADER = {
  font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "1F2937" } },
  alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left: { style: "thin", color: { rgb: "000000" } },
    right: { style: "thin", color: { rgb: "000000" } },
  },
};

const STYLE_CELL = {
  font: { sz: 10 },
  alignment: { vertical: "center" as const, wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "CCCCCC" } },
    bottom: { style: "thin", color: { rgb: "CCCCCC" } },
    left: { style: "thin", color: { rgb: "CCCCCC" } },
    right: { style: "thin", color: { rgb: "CCCCCC" } },
  },
};

export const exportPassengerManifestToExcel = (
  passengers: ManifestPassenger[],
  context: ManifestContext
) => {
  const t = (key: string, fallback: string) => i18next.t(key, { defaultValue: fallback }) as string;
  const locale = getDateLocale();
  const wb = XLSX.utils.book_new();

  // Header bloğu: tur + tarih + araç/rehber yer tutucu
  const departureText = context.departureDate
    ? format(new Date(context.departureDate), "d MMMM yyyy", { locale })
    : "—";
  const returnText = context.returnDate
    ? format(new Date(context.returnDate), "d MMMM yyyy", { locale })
    : "";

  const headerRows: (string | number)[][] = [
    [t("admin.manifest.title", "Yolcu Listesi")],
    [],
    [t("admin.manifest.tour", "Tur"), context.tourTitle],
    [t("admin.manifest.date", "Tarih"), returnText ? `${departureText} → ${returnText}` : departureText],
  ];
  if (context.tourDestination) {
    headerRows.push([t("admin.manifest.destination", "Destinasyon"), context.tourDestination]);
  }
  headerRows.push([t("admin.manifest.vehicle", "Araç"), context.vehiclePlate || "—"]);
  headerRows.push([t("admin.manifest.guide", "Rehber"), context.guideName || "—"]);
  // Faz 2-D: ek personel — tur lideri + kaptan
  if (context.tourLeaderName) {
    headerRows.push([t("admin.manifest.tourLeader", "Tur Lideri"), context.tourLeaderName]);
  }
  if (context.captainName) {
    headerRows.push([t("admin.manifest.captain", "Kaptan"), context.captainName]);
  }
  headerRows.push([]);

  // Tablo başlığı — Faz 2-D: Bakiye sütunu eklendi
  const tableHeader = [
    t("admin.manifest.order", "Sıra"),
    t("admin.manifest.fullName", "Ad Soyad"),
    t("admin.manifest.identityNo", "Kimlik No"),
    t("admin.manifest.passportNo", "Pasaport No"),
    t("admin.manifest.birthDate", "Doğum Tarihi"),
    t("admin.manifest.isChild", "Çocuk"),
    t("admin.manifest.balance", "Bakiye"),
  ];

  // Yolcu satırları — passenger_order ASC zaten DepartureDetailDialog'da grup-bazlı
  // sıralanmış olarak geliyor. Burada sırayı KORU; sadece bakiye için "grup ilk yolcusu"
  // mantığını uygula: aynı registration_id'nin yolcuları arka arkaya geliyor → her
  // grubun ilk yolcu satırında bakiye göster, diğerlerinde boş.
  const sorted = [...passengers];
  const metaByReg = new Map((context.registrationMeta || []).map((m) => [m.registration_id, m]));
  const formatMoney = (n: number, currency: string) => {
    try {
      return new Intl.NumberFormat(i18next.language || "tr", {
        style: "currency", currency, maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return `${n.toFixed(2)} ${currency}`;
    }
  };
  let prevRegId: string | undefined;
  const dataRows = sorted.map((p) => {
    const isGroupFirst = p.registration_id && p.registration_id !== prevRegId;
    if (p.registration_id) prevRegId = p.registration_id;
    const meta = isGroupFirst && p.registration_id ? metaByReg.get(p.registration_id) : undefined;
    const balanceText =
      meta && meta.remaining > 0
        ? formatMoney(meta.remaining, meta.currency)
        : meta && meta.remaining === 0 && meta.total > 0
        ? t("admin.manifest.paid", "Tamamı ödendi")
        : "";
    return [
      p.passenger_order,
      p.full_name || "",
      p.identity_no || "",
      p.passport_no || "",
      p.birth_date ? format(new Date(p.birth_date), "dd.MM.yyyy", { locale }) : "",
      p.is_child ? "✓" : "",
      balanceText,
    ];
  });

  // Toplam yolcu satırı
  const totalRow = [
    "",
    t("admin.manifest.totalPassengers", "Toplam Yolcu"),
    sorted.length,
    "",
    "",
    "",
    "",
  ];

  const allRows = [...headerRows, tableHeader, ...dataRows, [], totalRow];
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Stil uygulaması
  // Title (A1) — birleştir + büyük font
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // A1:G1 başlık birleştirme (7 sütun)
  ];
  const titleCell = XLSX.utils.encode_cell({ r: 0, c: 0 });
  if (ws[titleCell]) ws[titleCell].s = STYLE_TITLE;

  // Subtitle satırları (Tur/Tarih/Destinasyon/Araç/Rehber) — A sütunu bold
  const subtitleStart = 2; // 0-indexed: A3
  for (let r = subtitleStart; r < subtitleStart + headerRows.length - subtitleStart - 1; r++) {
    const labelCell = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[labelCell]) ws[labelCell].s = STYLE_SUBTITLE;
  }

  // Tablo başlığı stil — headerRows.length satırından sonra
  const tableHeaderRow = headerRows.length;
  for (let c = 0; c < tableHeader.length; c++) {
    const cell = XLSX.utils.encode_cell({ r: tableHeaderRow, c });
    if (ws[cell]) ws[cell].s = STYLE_HEADER;
  }

  // Yolcu satırları stil
  for (let i = 0; i < dataRows.length; i++) {
    for (let c = 0; c < tableHeader.length; c++) {
      const cell = XLSX.utils.encode_cell({ r: tableHeaderRow + 1 + i, c });
      if (ws[cell]) ws[cell].s = STYLE_CELL;
    }
  }

  // Toplam satır
  const totalRowIndex = tableHeaderRow + 1 + dataRows.length + 1;
  for (let c = 0; c < tableHeader.length; c++) {
    const cell = XLSX.utils.encode_cell({ r: totalRowIndex, c });
    if (ws[cell]) {
      ws[cell].s = {
        ...STYLE_CELL,
        font: { ...STYLE_CELL.font, bold: true },
        fill: { fgColor: { rgb: "F3F4F6" } },
      };
    }
  }

  // Sütun genişlikleri — Faz 2-D: Bakiye sütunu eklendi
  ws["!cols"] = [
    { wch: 6 },   // Sıra
    { wch: 28 },  // Ad Soyad
    { wch: 15 },  // Kimlik No
    { wch: 15 },  // Pasaport No
    { wch: 13 },  // Doğum Tarihi
    { wch: 7 },   // Çocuk
    { wch: 18 },  // Bakiye
  ];

  // Satır yükseklikleri (başlık biraz yüksek)
  ws["!rows"] = [{ hpt: 22 }];

  XLSX.utils.book_append_sheet(wb, ws, t("admin.manifest.sheetName", "Yolcu Listesi"));

  // Dosya adı: tur-tarih-yolcu-listesi.xlsx
  const fileDate = context.departureDate
    ? format(new Date(context.departureDate), "yyyy-MM-dd")
    : "tarih";
  const safeTitle = (context.tourTitle || "tur").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").toLowerCase();
  const filename = `${safeTitle}-${fileDate}-yolcu-listesi.xlsx`;

  XLSX.writeFile(wb, filename);
};
