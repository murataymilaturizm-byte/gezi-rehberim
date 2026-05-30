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
}

export interface ManifestContext {
  tourTitle: string;
  tourDestination?: string;
  departureDate: string;
  returnDate?: string | null;
  // Faz 2-B yer tutucular — şu an boş geçilir, ileride doldurulur
  vehiclePlate?: string;
  guideName?: string;
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
  // Faz 2-B yer tutucu — şimdi boş bırakılıyor, ileride doldurulacak
  headerRows.push([t("admin.manifest.vehicle", "Araç"), context.vehiclePlate || "—"]);
  headerRows.push([t("admin.manifest.guide", "Rehber"), context.guideName || "—"]);
  headerRows.push([]);

  // Tablo başlığı
  const tableHeader = [
    t("admin.manifest.order", "Sıra"),
    t("admin.manifest.fullName", "Ad Soyad"),
    t("admin.manifest.identityNo", "Kimlik No"),
    t("admin.manifest.passportNo", "Pasaport No"),
    t("admin.manifest.birthDate", "Doğum Tarihi"),
    t("admin.manifest.isChild", "Çocuk"),
  ];

  // Yolcu satırları — passenger_order ASC
  const sorted = [...passengers].sort((a, b) => a.passenger_order - b.passenger_order);
  const dataRows = sorted.map((p) => [
    p.passenger_order,
    p.full_name || "",
    p.identity_no || "",
    p.passport_no || "",
    p.birth_date ? format(new Date(p.birth_date), "dd.MM.yyyy", { locale }) : "",
    p.is_child ? "✓" : "",
  ]);

  // Toplam yolcu satırı
  const totalRow = [
    "",
    t("admin.manifest.totalPassengers", "Toplam Yolcu"),
    sorted.length,
    "",
    "",
    "",
  ];

  const allRows = [...headerRows, tableHeader, ...dataRows, [], totalRow];
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Stil uygulaması
  // Title (A1) — birleştir + büyük font
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // A1:F1 başlık birleştirme
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

  // Sütun genişlikleri
  ws["!cols"] = [
    { wch: 6 },   // Sıra
    { wch: 30 },  // Ad Soyad
    { wch: 16 },  // Kimlik No
    { wch: 16 },  // Pasaport No
    { wch: 14 },  // Doğum Tarihi
    { wch: 8 },   // Çocuk
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
