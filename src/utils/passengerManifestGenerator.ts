// Faz 2-A: Yolcu Listesi (Manifesto) — PDF çıktısı (jsPDF).
// invoiceGenerator.ts pattern'i takip ediyor. Format nötr/global — kurum/birlik ibaresi yok.
import jsPDF from "jspdf";
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
  vehiclePlate?: string;
  guideName?: string;
}

// PDF içinde Türkçe karakter sorunlarını önlemek için latin-friendly fallback.
// jsPDF default helvetica Türkçe ğüş için kötü render eder — basit replace ile
// okunabilirlik korunur. (Ayrı bir font yüklemeden hızlı çözüm — operasyonel
// yolcu listesi için kabul edilebilir; ileride özel font eklenebilir.)
const sanitizeLatin = (s: string): string => {
  if (!s) return "";
  return s
    .replace(/ğ/g, "g").replace(/Ğ/g, "G")
    .replace(/ü/g, "u").replace(/Ü/g, "U")
    .replace(/ş/g, "s").replace(/Ş/g, "S")
    .replace(/ı/g, "i").replace(/İ/g, "I")
    .replace(/ö/g, "o").replace(/Ö/g, "O")
    .replace(/ç/g, "c").replace(/Ç/g, "C");
};

export const generatePassengerManifestPDF = (
  passengers: ManifestPassenger[],
  context: ManifestContext
) => {
  const t = (key: string, fallback: string) => i18next.t(key, { defaultValue: fallback }) as string;
  const locale = getDateLocale();
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  let y = margin;

  // Başlık
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(
    sanitizeLatin(t("admin.manifest.title", "Yolcu Listesi")),
    pageWidth / 2,
    y + 4,
    { align: "center" }
  );
  y += 10;

  // Tur + tarih bloğu
  const departureText = context.departureDate
    ? format(new Date(context.departureDate), "d MMMM yyyy", { locale })
    : "—";
  const returnText = context.returnDate
    ? format(new Date(context.returnDate), "d MMMM yyyy", { locale })
    : "";
  const dateLine = returnText ? `${departureText} -> ${returnText}` : departureText;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const drawKV = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(sanitizeLatin(label) + ":", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(sanitizeLatin(value || "—"), margin + 32, y);
    y += 5;
  };
  drawKV(t("admin.manifest.tour", "Tur"), context.tourTitle);
  drawKV(t("admin.manifest.date", "Tarih"), dateLine);
  if (context.tourDestination) {
    drawKV(t("admin.manifest.destination", "Destinasyon"), context.tourDestination);
  }
  // Faz 2-B yer tutucu — şu an boş
  drawKV(t("admin.manifest.vehicle", "Araç"), context.vehiclePlate || "—");
  drawKV(t("admin.manifest.guide", "Rehber"), context.guideName || "—");

  y += 4;
  doc.setDrawColor(0);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // Tablo başlığı
  const cols = [
    { key: "order", title: t("admin.manifest.order", "Sıra"), width: 12, align: "center" as const },
    { key: "name", title: t("admin.manifest.fullName", "Ad Soyad"), width: 55, align: "left" as const },
    { key: "id", title: t("admin.manifest.identityNo", "Kimlik No"), width: 35, align: "left" as const },
    { key: "passport", title: t("admin.manifest.passportNo", "Pasaport No"), width: 32, align: "left" as const },
    { key: "birth", title: t("admin.manifest.birthDate", "Doğum Tarihi"), width: 28, align: "center" as const },
    { key: "child", title: t("admin.manifest.isChild", "Çocuk"), width: 14, align: "center" as const },
  ];

  const drawTableHeader = () => {
    doc.setFillColor(31, 41, 55);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    let x = margin;
    const rowH = 7;
    doc.rect(margin, y, pageWidth - margin * 2, rowH, "F");
    for (const c of cols) {
      const tx = c.align === "center" ? x + c.width / 2 : x + 2;
      doc.text(sanitizeLatin(c.title), tx, y + 5, { align: c.align });
      x += c.width;
    }
    y += rowH;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
  };

  drawTableHeader();

  const sorted = [...passengers].sort((a, b) => a.passenger_order - b.passenger_order);
  const rowH = 6;

  for (const p of sorted) {
    // Sayfa sonu kontrolü
    if (y + rowH > pageHeight - margin - 12) {
      doc.addPage();
      y = margin;
      drawTableHeader();
    }

    let x = margin;
    const row = [
      String(p.passenger_order),
      p.full_name || "",
      p.identity_no || "",
      p.passport_no || "",
      p.birth_date ? format(new Date(p.birth_date), "dd.MM.yyyy", { locale }) : "",
      p.is_child ? "X" : "",
    ];

    // Satır border
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y + rowH, pageWidth - margin, y + rowH);

    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      const tx = c.align === "center" ? x + c.width / 2 : x + 2;
      const text = sanitizeLatin(row[i]);
      doc.text(text, tx, y + 4, {
        align: c.align,
        maxWidth: c.width - 3,
      });
      x += c.width;
    }
    y += rowH;
  }

  // Footer — toplam yolcu
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    sanitizeLatin(`${t("admin.manifest.totalPassengers", "Toplam Yolcu")}: ${sorted.length}`),
    margin,
    y
  );

  // Üretim tarihi (sağ alt)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  const genDate = format(new Date(), "dd.MM.yyyy HH:mm", { locale });
  doc.text(
    sanitizeLatin(`${t("admin.manifest.generatedAt", "Oluşturulma")}: ${genDate}`),
    pageWidth - margin,
    pageHeight - margin,
    { align: "right" }
  );

  const fileDate = context.departureDate
    ? format(new Date(context.departureDate), "yyyy-MM-dd")
    : "tarih";
  const safeTitle = (context.tourTitle || "tur").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").toLowerCase();
  doc.save(`${safeTitle}-${fileDate}-yolcu-listesi.pdf`);
};
