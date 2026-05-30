// Faz 2-B: Otobüs Koltuk Planı — PDF çıktısı (jsPDF).
// passengerManifestGenerator.ts pattern'i takip ediyor. Format nötr/global.
import jsPDF from "jspdf";
import { format } from "date-fns";
import { tr, enUS, de, fr, es, ru, ar } from "date-fns/locale";
import i18next from "i18next";

const getDateLocale = () => {
  const lang = i18next.language || "tr";
  const locales: Record<string, typeof tr> = { tr, en: enUS, de, fr, es, ru, ar };
  return locales[lang] || tr;
};

export interface SeatAssignment {
  seat_no: string;
  full_name: string;
  is_child?: boolean;
}

export interface SeatPlanContext {
  tourTitle: string;
  tourDestination?: string;
  departureDate: string;
  returnDate?: string | null;
  vehiclePlate?: string | null;
  guideName?: string | null;
  seatLayout: "2+2" | "2+1";
  seatCount: number;
  assignments: SeatAssignment[];
}

// jsPDF helvetica fontu Türkçe karakterler için yetersiz — basit ASCII fallback.
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

const initials = (name: string): string => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const generateSeatPlanPDF = (ctx: SeatPlanContext) => {
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
    sanitizeLatin(t("admin.seatPlan.title", "Koltuk Planı")),
    pageWidth / 2,
    y + 4,
    { align: "center" }
  );
  y += 10;

  // Tur + tarih bloğu
  const departureText = ctx.departureDate
    ? format(new Date(ctx.departureDate), "d MMMM yyyy", { locale })
    : "—";
  const returnText = ctx.returnDate
    ? format(new Date(ctx.returnDate), "d MMMM yyyy", { locale })
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
  drawKV(t("admin.manifest.tour", "Tur"), ctx.tourTitle);
  drawKV(t("admin.manifest.date", "Tarih"), dateLine);
  if (ctx.tourDestination) {
    drawKV(t("admin.manifest.destination", "Destinasyon"), ctx.tourDestination);
  }
  drawKV(t("admin.seatPlan.vehiclePlate", "Plaka"), ctx.vehiclePlate || "—");
  drawKV(t("admin.seatPlan.guideName", "Rehber"), ctx.guideName || "—");
  drawKV(t("admin.seatPlan.layout", "Düzen"), ctx.seatLayout);

  y += 4;
  doc.setDrawColor(0);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Koltuk grid
  const seatMap = new Map<string, SeatAssignment>();
  for (const a of ctx.assignments) seatMap.set(a.seat_no, a);

  const rowSize = ctx.seatLayout === "2+2" ? 4 : 3;
  const rowCount = Math.ceil(ctx.seatCount / rowSize);

  // Grid metrik — sayfa genişliği - 2*margin ≈ 186mm
  const seatW = 18; // mm
  const seatH = 14;
  const seatGap = 2;
  const aisleGap = 8; // koridor genişliği
  const leftCols = 2;
  const rightCols = rowSize - leftCols; // 2+2=2, 2+1=1

  // Toplam grid genişliği
  const totalW =
    leftCols * seatW + (leftCols - 1) * seatGap + aisleGap + rightCols * seatW + (rightCols - 1) * seatGap;
  const startX = (pageWidth - totalW) / 2;

  doc.setFontSize(7);
  doc.setDrawColor(80, 80, 80);

  for (let r = 0; r < rowCount; r++) {
    // Sayfa sonu kontrolü
    if (y + seatH > pageHeight - margin - 12) {
      doc.addPage();
      y = margin;
    }

    for (let p = 0; p < rowSize; p++) {
      const seatNo = r * rowSize + p + 1;
      if (seatNo > ctx.seatCount) break;

      // Pozisyon hesaplama
      let x = startX;
      if (p < leftCols) {
        x += p * (seatW + seatGap);
      } else {
        x += leftCols * seatW + (leftCols - 1) * seatGap + aisleGap + (p - leftCols) * (seatW + seatGap);
      }

      const assigned = seatMap.get(String(seatNo));

      // Koltuk dikdörtgeni
      if (assigned) {
        if (assigned.is_child) {
          doc.setFillColor(255, 237, 213); // orange-ish for child
        } else {
          doc.setFillColor(219, 234, 254); // blue-ish for adult
        }
        doc.rect(x, y, seatW, seatH, "FD");
      } else {
        doc.setFillColor(248, 250, 252);
        doc.rect(x, y, seatW, seatH, "FD");
      }

      // Koltuk numarası (sol üst)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(100, 100, 100);
      doc.text(String(seatNo), x + 1, y + 3);

      // Yolcu adı (alt satır, kısaltılmış)
      if (assigned) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        const nameShort = sanitizeLatin(assigned.full_name).slice(0, 14);
        doc.text(nameShort, x + seatW / 2, y + seatH - 4, { align: "center" });
        if (assigned.is_child) {
          doc.setFontSize(5);
          doc.setTextColor(180, 90, 0);
          doc.text("[C]", x + seatW - 5, y + 3);
        }
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(180, 180, 180);
        doc.text("—", x + seatW / 2, y + seatH - 4, { align: "center" });
      }
    }

    y += seatH + seatGap;
  }

  // Toplam yolcu
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(
    sanitizeLatin(
      `${t("admin.seatPlan.totalAssigned", "Toplam Atanan")}: ${ctx.assignments.length}/${ctx.seatCount}`
    ),
    margin,
    y
  );

  // Footer
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

  // Dosya adı
  const fileDate = ctx.departureDate
    ? format(new Date(ctx.departureDate), "yyyy-MM-dd")
    : "tarih";
  const safeTitle = (ctx.tourTitle || "tur")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  doc.save(`${safeTitle}-${fileDate}-koltuk-plani.pdf`);
};
