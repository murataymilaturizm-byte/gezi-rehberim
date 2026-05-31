// Faz 2-A: Yolcu Listesi (Manifesto) — Excel çıktısı.
// xlsx-js-style ile stil destekli, src/utils/excelExporter.ts pattern'i takip ediyor.
// Format nötr/global — kurum/birlik ibaresi yok.
//
// PDF ile paralel iyileştirmeler:
//  • Pasaport sütunu KOŞULLU (hiç değer yoksa sütun çıkmaz, varsa en sonda).
//  • Grup renklendirme: aynı registration_id → aynı pastel hücre dolgusu, 5 ton dönüşümlü.
//  • Tur lideri + kaptan bilgi bloğunda görünür (boş olanlar gizli).
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
  // Faz 2-D: bakiye grubu + grup renklendirme tespiti
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
  // Faz 2-D
  tourLeaderName?: string;
  captainName?: string;
  registrationMeta?: ManifestRegistrationMeta[];
}

// PDF'deki pastel palet (RGB) → Excel hex karşılıkları. Baskı-dostu yumuşak tonlar.
const GROUP_PALETTE_HEX: string[] = [
  "E8F4FC", // pastel sky
  "E8F8EE", // pastel sage
  "FDF6E1", // pastel cream
  "FDECEC", // pastel rose
  "F0EBFC", // pastel lavender
];

const STYLE_TITLE = {
  font: { bold: true, sz: 14 },
  alignment: { horizontal: "center" as const, vertical: "center" as const },
};

const STYLE_SUBTITLE = {
  font: { bold: true, sz: 11, color: { rgb: "555555" } },
  alignment: { horizontal: "left" as const },
};

const STYLE_HEADER = {
  font: { bold: true, sz: 10, color: { rgb: "1A1F2E" } },
  fill: { fgColor: { rgb: "F3F4F8" } },
  alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "9CA3AF" } },
    bottom: { style: "thin", color: { rgb: "9CA3AF" } },
    left: { style: "thin", color: { rgb: "9CA3AF" } },
    right: { style: "thin", color: { rgb: "9CA3AF" } },
  },
};

const STYLE_CELL_BASE = {
  font: { sz: 10 },
  alignment: { vertical: "center" as const, wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "DCDDE3" } },
    bottom: { style: "thin", color: { rgb: "DCDDE3" } },
    left: { style: "thin", color: { rgb: "DCDDE3" } },
    right: { style: "thin", color: { rgb: "DCDDE3" } },
  },
};

export const exportPassengerManifestToExcel = (
  passengers: ManifestPassenger[],
  context: ManifestContext
) => {
  const t = (key: string, fallback: string) => i18next.t(key, { defaultValue: fallback }) as string;
  const locale = getDateLocale();
  const wb = XLSX.utils.book_new();

  // ── Pasaport sütunu var mı? ──
  const hasAnyPassport = passengers.some((p) => !!(p.passport_no || "").trim());

  // ── Tablo başlığı + sütun genişlikleri (pasaport varsa/yoksa) ──
  type ColKey = "order" | "name" | "id" | "birth" | "child" | "balance" | "passport";
  interface ColDef {
    key: ColKey;
    title: string;
    width: number; // wch
    align?: "left" | "center" | "right";
  }
  const colsWithPassport: ColDef[] = [
    { key: "order", title: t("admin.manifest.order", "Sıra"), width: 6, align: "center" },
    { key: "name", title: t("admin.manifest.fullName", "Ad Soyad"), width: 28, align: "left" },
    { key: "id", title: t("admin.manifest.identityNo", "Kimlik No"), width: 15, align: "left" },
    { key: "birth", title: t("admin.manifest.birthDate", "Doğum Tarihi"), width: 13, align: "center" },
    { key: "child", title: t("admin.manifest.isChild", "Çocuk"), width: 7, align: "center" },
    { key: "balance", title: t("admin.manifest.balance", "Bakiye"), width: 18, align: "right" },
    { key: "passport", title: t("admin.manifest.passportNo", "Pasaport No"), width: 15, align: "left" },
  ];
  const colsNoPassport: ColDef[] = [
    { key: "order", title: t("admin.manifest.order", "Sıra"), width: 6, align: "center" },
    { key: "name", title: t("admin.manifest.fullName", "Ad Soyad"), width: 34, align: "left" },
    { key: "id", title: t("admin.manifest.identityNo", "Kimlik No"), width: 18, align: "left" },
    { key: "birth", title: t("admin.manifest.birthDate", "Doğum Tarihi"), width: 13, align: "center" },
    { key: "child", title: t("admin.manifest.isChild", "Çocuk"), width: 7, align: "center" },
    { key: "balance", title: t("admin.manifest.balance", "Bakiye"), width: 21, align: "right" },
  ];
  const cols: ColDef[] = hasAnyPassport ? colsWithPassport : colsNoPassport;
  const ncols = cols.length;

  // ── Header bloğu ──
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
  if (context.tourLeaderName) {
    headerRows.push([t("admin.manifest.tourLeader", "Tur Lideri"), context.tourLeaderName]);
  }
  if (context.captainName) {
    headerRows.push([t("admin.manifest.captain", "Kaptan"), context.captainName]);
  }
  headerRows.push([]);

  // ── Yolcu satırları + grup renk indeksi ──
  // passenger_order ASC zaten DepartureDetailDialog'da grup-bazlı sıralanmış olarak
  // geliyor. Burada sırayı KORU.
  const sorted = [...passengers];

  const groupColorIdx = new Map<string, number>();
  let nextColorIdx = 0;
  for (const p of sorted) {
    if (p.registration_id && !groupColorIdx.has(p.registration_id)) {
      groupColorIdx.set(p.registration_id, nextColorIdx % GROUP_PALETTE_HEX.length);
      nextColorIdx++;
    }
  }

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
  const rowMeta: Array<{ colorIdx: number | null }> = [];
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
    const rowData: Record<ColKey, string | number> = {
      order: p.passenger_order,
      name: p.full_name || "",
      id: p.identity_no || "",
      birth: p.birth_date ? format(new Date(p.birth_date), "dd.MM.yyyy", { locale }) : "",
      child: p.is_child ? "✓" : "",
      balance: balanceText,
      passport: p.passport_no || "",
    };
    rowMeta.push({
      colorIdx: p.registration_id ? (groupColorIdx.get(p.registration_id) ?? null) : null,
    });
    return cols.map((c) => rowData[c.key]);
  });

  // ── Toplam satır ──
  const totalRow: (string | number)[] = new Array(ncols).fill("");
  totalRow[0] = "";
  totalRow[1] = t("admin.manifest.totalPassengers", "Toplam Yolcu");
  totalRow[2] = sorted.length;

  const tableHeader = cols.map((c) => c.title);
  const allRows = [...headerRows, tableHeader, ...dataRows, [], totalRow];
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // ── Stil uygulaması ──
  // Title (A1) — birleştir + büyük font
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: ncols - 1 } },
  ];
  const titleCell = XLSX.utils.encode_cell({ r: 0, c: 0 });
  if (ws[titleCell]) ws[titleCell].s = STYLE_TITLE;

  // Subtitle (Tur/Tarih/...) — A sütunu bold
  const subtitleStart = 2; // 0-indexed: A3
  for (let r = subtitleStart; r < subtitleStart + headerRows.length - subtitleStart - 1; r++) {
    const labelCell = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[labelCell]) ws[labelCell].s = STYLE_SUBTITLE;
  }

  // Tablo başlığı
  const tableHeaderRow = headerRows.length;
  for (let c = 0; c < ncols; c++) {
    const cell = XLSX.utils.encode_cell({ r: tableHeaderRow, c });
    if (ws[cell]) ws[cell].s = STYLE_HEADER;
  }

  // Yolcu satırları + grup renk dolgusu
  for (let i = 0; i < dataRows.length; i++) {
    const colorIdx = rowMeta[i].colorIdx;
    const fill =
      colorIdx != null
        ? { fgColor: { rgb: GROUP_PALETTE_HEX[colorIdx] } }
        : undefined;
    for (let c = 0; c < ncols; c++) {
      const cell = XLSX.utils.encode_cell({ r: tableHeaderRow + 1 + i, c });
      if (!ws[cell]) continue;
      const colDef = cols[c];
      ws[cell].s = {
        ...STYLE_CELL_BASE,
        font: {
          ...STYLE_CELL_BASE.font,
          bold: colDef.key === "balance" && !!dataRows[i][c],
        },
        alignment: {
          ...STYLE_CELL_BASE.alignment,
          horizontal: (colDef.align || "left") as "left" | "center" | "right",
        },
        ...(fill ? { fill } : {}),
      };
    }
  }

  // Toplam satırı
  const totalRowIndex = tableHeaderRow + 1 + dataRows.length + 1;
  for (let c = 0; c < ncols; c++) {
    const cell = XLSX.utils.encode_cell({ r: totalRowIndex, c });
    if (ws[cell]) {
      ws[cell].s = {
        ...STYLE_CELL_BASE,
        font: { ...STYLE_CELL_BASE.font, bold: true },
        fill: { fgColor: { rgb: "EEF1F6" } },
      };
    }
  }

  // Sütun genişlikleri
  ws["!cols"] = cols.map((c) => ({ wch: c.width }));

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
