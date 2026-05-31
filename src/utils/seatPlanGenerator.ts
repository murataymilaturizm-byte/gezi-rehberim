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
  const leftCols = 2;
  const rightCols = rowSize - leftCols; // 2+2 → 2, 2+1 → 1
  const doorRowNumRaw =
    ctx.doorRow != null && ctx.doorRow > 0 ? ctx.doorRow : null;

  // Faz 2-D2: Kapı modeli — kapı bir EK satır DEĞİL, koltuk sırasının SAĞ tarafına gömülü.
  // Numaralandırma sürekli, ctx.seatCount kadar koltuk render edilir. Kapı sırasında
  // SOL `leftCols` koltuk numaralanır; SAĞ `rightCols` pozisyon "ORTA KAPI" ile kaplanır.
  // Tek-pas algoritma: ekran (SeatPlanDialog) ve PDF aynı mantığı paylaşır.
  const seatPosMap = new Map<number, { vr: number; pIdx: number }>();
  let _seatCounter = 1;
  let _vr = 1;
  let _doorReached = false;
  while (_seatCounter <= ctx.seatCount) {
    const isDoorRow = doorRowNumRaw != null && _vr === doorRowNumRaw;
    if (isDoorRow) _doorReached = true;
    const seatsInThisRow = isDoorRow ? leftCols : rowSize;
    for (let i = 0; i < seatsInThisRow && _seatCounter <= ctx.seatCount; i++) {
      seatPosMap.set(_seatCounter, { vr: _vr, pIdx: i });
      _seatCounter++;
    }
    _vr++;
  }
  const visualRowCount = _vr - 1;
  const hasDoor = _doorReached;
  const doorRowNum = hasDoor ? (doorRowNumRaw as number) : null;

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
  const rowH = Math.min(
    10,
    Math.max(
      7,
      (gridAvailH - Math.max(0, visualRowCount - 1) * seatGap) /
        Math.max(1, visualRowCount)
    )
  );

  // Sütun yapısı: 2+2 → sol(2)|koridor|sağ(2). 2+1 → sol(2)|koridor|sağ(1)
  const aisleW = 6;
  const seatColGap = 0.8;
  const seatW =
    (gridW - aisleW - (leftCols - 1 + Math.max(0, rightCols - 1)) * seatColGap) /
    rowSize;

  // pIdx → x dönüştürme (0-indexed, koridor sol+sağ arası)
  const pIdxToX = (pIdx: number): number => {
    if (pIdx < leftCols) return gridX + pIdx * (seatW + seatColGap);
    return (
      gridX +
      leftCols * seatW +
      (leftCols - 1) * seatColGap +
      aisleW +
      (pIdx - leftCols) * (seatW + seatColGap)
    );
  };

  // Üst yön etiketi (küçük "ÖN" - sade)
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(sanitizeLatin(t("admin.seatPlan.front", "ÖN")), gridX + gridW / 2, contentY + 4, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // Koltuk döngüsü — seatNo 1..seatCount sırayla, seatPosMap'ten pozisyon al.
  for (let seatNo = 1; seatNo <= ctx.seatCount; seatNo++) {
    const pos = seatPosMap.get(seatNo);
    if (!pos) continue;
    const yTop = gridY + (pos.vr - 1) * (rowH + seatGap);
    const x = pIdxToX(pos.pIdx);

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

  // Kapı — SADECE kapı sırasının SAĞ tarafı. Sol koltuklar yukarıdaki döngüde
  // normal koltuk olarak çizildi; bu blok onların sağındaki boşluğu doldurur.
  if (hasDoor && doorRowNum != null) {
    const doorYTop = gridY + (doorRowNum - 1) * (rowH + seatGap);
    const doorX = pIdxToX(leftCols); // sağ tarafın başlangıcı
    const doorW =
      rightCols * seatW + Math.max(0, rightCols - 1) * seatColGap;
    doc.setDrawColor(180, 180, 185);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(doorX, doorYTop, doorW, rowH, 0.8, 0.8, "FD");
    doc.setLineDashPattern([], 0);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 105);
    doc.text(
      sanitizeLatin(
        t("admin.seatPlan.middleDoor", "ORTA KAPI").toUpperCase()
      ),
      doorX + doorW / 2,
      doorYTop + rowH / 2 + 1,
      { align: "center" }
    );
    doc.setTextColor(0, 0, 0);
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
