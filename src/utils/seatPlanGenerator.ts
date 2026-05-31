// Faz 2-D: Koltuk Planı PDF — iki kolonlu tek-sayfa layout.
//   SOL kolon: otobüs koltuk grid (kapı boşluğu desteği)
//   SAĞ kolon: tur bilgileri (tur, tarih, plaka, rehber, tur lideri, kaptan, doluluk)
// 46 koltuk (2+2) tek sayfaya rahat sığar. invoiceGenerator.ts/jsPDF pattern.
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
  // Faz 2-D
  tourLeaderName?: string | null;
  captainName?: string | null;
  doorRow?: number | null; // null = kapı yok
  seatLayout: "2+2" | "2+1";
  seatCount: number;
  assignments: SeatAssignment[];
}

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

export const generateSeatPlanPDF = (ctx: SeatPlanContext) => {
  const t = (key: string, fallback: string) => i18next.t(key, { defaultValue: fallback }) as string;
  const locale = getDateLocale();
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();   // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297
  const margin = 12;

  // ─── Başlık (sayfa üstü, ortalı) ────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(
    sanitizeLatin(t("admin.seatPlan.title", "Koltuk Planı")),
    pageWidth / 2,
    margin + 5,
    { align: "center" }
  );

  // ─── İki kolon layout hesaplama ─────────────────────────────────────────
  // Sol kolon: koltuk grid (yaklaşık 120mm)
  // Sağ kolon: bilgi paneli (yaklaşık 60mm)
  const headerH = 12; // Başlık alanı
  const contentY = margin + headerH;
  const contentH = pageHeight - margin - contentY - 6; // alt boşluk 6mm footer
  const colGap = 6;
  const leftColW = 120;
  const rightColX = margin + leftColW + colGap;
  const rightColW = pageWidth - rightColX - margin;

  // ─── SAĞ KOLON — Tur bilgi bloğu ────────────────────────────────────────
  const departureText = ctx.departureDate
    ? format(new Date(ctx.departureDate), "d MMMM yyyy", { locale })
    : "—";
  const returnText = ctx.returnDate
    ? format(new Date(ctx.returnDate), "d MMMM yyyy", { locale })
    : "";
  const dateLine = returnText ? `${departureText} -> ${returnText}` : departureText;

  // Sağ kolon arka plan (very subtle box)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(rightColX, contentY, rightColW, contentH, 2, 2, "FD");

  // Sağ kolon içerik
  let ry = contentY + 6;
  const rPad = 4;
  const rTextX = rightColX + rPad;

  const drawInfoRow = (label: string, value: string | null | undefined) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(sanitizeLatin(label.toUpperCase()), rTextX, ry);
    ry += 3.5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    const txt = sanitizeLatin(value || "—");
    // Multi-line wrap eğer uzunsa
    const split = doc.splitTextToSize(txt, rightColW - 2 * rPad);
    doc.text(split, rTextX, ry);
    ry += 4 * split.length + 2;
  };

  drawInfoRow(t("admin.manifest.tour", "Tur"), ctx.tourTitle);
  drawInfoRow(t("admin.manifest.date", "Tarih"), dateLine);
  if (ctx.tourDestination) {
    drawInfoRow(t("admin.manifest.destination", "Destinasyon"), ctx.tourDestination);
  }
  drawInfoRow(t("admin.seatPlan.vehiclePlate", "Plaka"), ctx.vehiclePlate);
  drawInfoRow(t("admin.seatPlan.guideName", "Rehber"), ctx.guideName);
  // Faz 2-D
  if (ctx.tourLeaderName) {
    drawInfoRow(t("admin.manifest.tourLeader", "Tur Lideri"), ctx.tourLeaderName);
  }
  if (ctx.captainName) {
    drawInfoRow(t("admin.manifest.captain", "Kaptan"), ctx.captainName);
  }
  drawInfoRow(
    t("admin.seatPlan.layout", "Düzen"),
    `${ctx.seatLayout} · ${ctx.seatCount} ${t("admin.seatPlan.seats", "koltuk")}`
  );
  drawInfoRow(
    t("admin.seatPlan.totalAssigned", "Toplam Atanan"),
    `${ctx.assignments.length} / ${ctx.seatCount}`
  );

  // ─── SOL KOLON — Koltuk grid ─────────────────────────────────────────────
  const seatMap = new Map<string, SeatAssignment>();
  for (const a of ctx.assignments) seatMap.set(a.seat_no, a);

  const rowSize = ctx.seatLayout === "2+2" ? 4 : 3;
  const rowCount = Math.ceil(ctx.seatCount / rowSize);
  const hasDoor = ctx.doorRow != null && ctx.doorRow > 0 && ctx.doorRow < rowCount;
  const visualRowCount = rowCount + (hasDoor ? 1 : 0);

  // Sol kolon arka plan ("araç çerçevesi")
  doc.setFillColor(250, 250, 251);
  doc.setDrawColor(200, 200, 205);
  doc.roundedRect(margin, contentY, leftColW, contentH, 3, 3, "FD");

  // Grid metrik — sol kolonda kullanılabilir alan
  const gridPad = 5;
  const gridX = margin + gridPad;
  const gridY = contentY + gridPad + 4; // 4mm üst başlık için
  const gridW = leftColW - 2 * gridPad;
  const gridAvailH = contentH - 2 * gridPad - 6; // 6 alt boşluk

  // Sıra yüksekliği: visualRowCount + gap'lere bölünür
  const seatGap = 1.2;
  const rowH = Math.min(10, Math.max(7, (gridAvailH - (visualRowCount - 1) * seatGap) / visualRowCount));

  // Sütun yapısı: 2+2 → sol(2)|koridor|sağ(2). 2+1 → sol(2)|koridor|sağ(1)
  const leftCols = 2;
  const rightCols = rowSize - leftCols;
  const aisleW = 6;
  const seatColGap = 0.8;
  const seatW = (gridW - aisleW - (leftCols - 1 + rightCols - 1) * seatColGap) / rowSize;

  // Görsel sıra → fiziksel sıra (kapı varsa virtualRow door_row+1'i atlamalı)
  const isDoorVisualRow = (visualRow: number) => hasDoor && visualRow === (ctx.doorRow as number) + 1;

  // Üst yön etiketi (küçük "ÖN" - sade)
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(sanitizeLatin(t("admin.seatPlan.front", "ÖN")), gridX + gridW / 2, contentY + 4, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // Sıra döngüsü — visualRow 1..visualRowCount
  for (let vr = 1; vr <= visualRowCount; vr++) {
    const yTop = gridY + (vr - 1) * (rowH + seatGap);

    if (isDoorVisualRow(vr)) {
      // Kapı satırı — tüm genişlikte dashed işaret
      doc.setDrawColor(180, 180, 185);
      doc.setLineDashPattern([1.5, 1.5], 0);
      doc.setFillColor(243, 244, 246);
      doc.rect(gridX, yTop, gridW, rowH * 0.6, "FD");
      doc.setLineDashPattern([], 0);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 105);
      doc.text(
        sanitizeLatin(t("admin.seatPlan.door", "GİRİŞ").toUpperCase()),
        gridX + gridW / 2,
        yTop + rowH * 0.4,
        { align: "center" }
      );
      doc.setTextColor(0, 0, 0);
      continue;
    }

    // Fiziksel sıra (1..rowCount) — kapı'dan sonraki vr'lerde -1 ofset
    const physicalRow = hasDoor && vr > (ctx.doorRow as number) + 1 ? vr - 1 : vr;

    // Bu sıradaki koltuklar
    for (let p = 0; p < rowSize; p++) {
      const seatNo = (physicalRow - 1) * rowSize + p + 1;
      if (seatNo > ctx.seatCount) break;

      // X hesaplama: sol koltuklar → koridor → sağ koltuklar
      let x = gridX;
      if (p < leftCols) {
        x += p * (seatW + seatColGap);
      } else {
        x +=
          leftCols * seatW +
          (leftCols - 1) * seatColGap +
          aisleW +
          (p - leftCols) * (seatW + seatColGap);
      }

      const assigned = seatMap.get(String(seatNo));

      // Koltuk dikdörtgeni
      if (assigned) {
        if (assigned.is_child) {
          doc.setFillColor(255, 237, 213);
        } else {
          doc.setFillColor(219, 234, 254);
        }
        doc.setDrawColor(140, 140, 160);
      } else {
        doc.setFillColor(252, 252, 253);
        doc.setDrawColor(200, 200, 205);
      }
      doc.roundedRect(x, yTop, seatW, rowH, 0.8, 0.8, "FD");

      // Koltuk numarası (sol üst, küçük)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(110, 110, 115);
      doc.text(String(seatNo), x + 0.7, yTop + 2.2);

      // Yolcu adı (orta, bold)
      if (assigned) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(0, 0, 0);
        const maxChars = Math.max(8, Math.floor(seatW * 0.9));
        const nameShort = sanitizeLatin(assigned.full_name).slice(0, maxChars);
        doc.text(nameShort, x + seatW / 2, yTop + rowH - 1.8, {
          align: "center",
          maxWidth: seatW - 1,
        });
        if (assigned.is_child) {
          doc.setFontSize(5);
          doc.setTextColor(180, 90, 0);
          doc.text("C", x + seatW - 1.5, yTop + 2.2, { align: "right" });
        }
      }
    }
  }

  // ─── Footer ──────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  const genDate = format(new Date(), "dd.MM.yyyy HH:mm", { locale });
  doc.text(
    sanitizeLatin(`${t("admin.manifest.generatedAt", "Oluşturulma")}: ${genDate}`),
    pageWidth - margin,
    pageHeight - 5,
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
