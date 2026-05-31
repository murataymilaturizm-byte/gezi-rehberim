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
  // Faz 2-D: bakiye grubu tespiti
  registration_id?: string;
}

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
  drawKV(t("admin.manifest.vehicle", "Araç"), context.vehiclePlate || "—");
  drawKV(t("admin.manifest.guide", "Rehber"), context.guideName || "—");
  // Faz 2-D: ek personel
  if (context.tourLeaderName) {
    drawKV(t("admin.manifest.tourLeader", "Tur Lideri"), context.tourLeaderName);
  }
  if (context.captainName) {
    drawKV(t("admin.manifest.captain", "Kaptan"), context.captainName);
  }

  y += 4;
  doc.setDrawColor(0);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // Tablo başlığı — Faz 2-D düzeltme: sütun genişlikleri yeniden dağıtıldı.
  // Toplam = 10+50+28+26+22+14+36 = 186mm (A4 yazılabilir alan).
  // "Çocuk" (14mm) başlığı sığacak boyuta çıkarıldı; "Bakiye" (36mm) para formatı
  // için yeterli genişlik aldı. Truncate (maxWidth) tüm hücrelerde aktif.
  const cols = [
    { key: "order", title: t("admin.manifest.order", "Sıra"), width: 10, align: "center" as const },
    { key: "name", title: t("admin.manifest.fullName", "Ad Soyad"), width: 50, align: "left" as const },
    { key: "id", title: t("admin.manifest.identityNo", "Kimlik No"), width: 28, align: "left" as const },
    { key: "passport", title: t("admin.manifest.passportNo", "Pasaport No"), width: 26, align: "left" as const },
    { key: "birth", title: t("admin.manifest.birthDate", "Doğum Tarihi"), width: 22, align: "center" as const },
    { key: "child", title: t("admin.manifest.isChild", "Çocuk"), width: 14, align: "center" as const },
    { key: "balance", title: t("admin.manifest.balance", "Bakiye"), width: 36, align: "right" as const },
  ];

  // Faz 2-D: bakiye eşleştirme map'i — grup ilk yolcusunda göster
  const metaByReg = new Map((context.registrationMeta || []).map((m) => [m.registration_id, m]));
  const formatMoney = (n: number, currency: string) => {
    try {
      return new Intl.NumberFormat(i18next.language || "tr", {
        style: "currency", currency, maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `${n.toFixed(0)} ${currency}`;
    }
  };
  let prevRegId: string | undefined;

  // Faz 2-D düzeltme: align'a göre 3 farklı tx hesabı.
  //   left:   tx = x + 2          (sol kenardan padding)
  //   center: tx = x + width/2    (sütun ortası)
  //   right:  tx = x + width - 2  (sağ kenardan padding) ← önceki kod right'ı left gibi
  //                                                       hesaplıyordu → balance metni
  //                                                       sola hizalanıp çocuk sütununa
  //                                                       taşıyordu.
  const computeTx = (x: number, w: number, align: "left" | "center" | "right") => {
    if (align === "center") return x + w / 2;
    if (align === "right") return x + w - 2;
    return x + 2;
  };

  const drawTableHeader = () => {
    doc.setFillColor(31, 41, 55);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    let x = margin;
    const rowH = 7;
    doc.rect(margin, y, pageWidth - margin * 2, rowH, "F");
    for (const c of cols) {
      const tx = computeTx(x, c.width, c.align);
      doc.text(sanitizeLatin(c.title), tx, y + 5, {
        align: c.align,
        maxWidth: c.width - 2, // başlık sütun dışına taşmasın
      });
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
    // Faz 2-D: bakiye sadece grubun ilk yolcusunda
    const isGroupFirst = p.registration_id && p.registration_id !== prevRegId;
    if (p.registration_id) prevRegId = p.registration_id;
    const meta = isGroupFirst && p.registration_id ? metaByReg.get(p.registration_id) : undefined;
    const balanceText =
      meta && meta.remaining > 0
        ? formatMoney(meta.remaining, meta.currency)
        : meta && meta.remaining === 0 && meta.total > 0
        ? t("admin.manifest.paid", "Tamamı ödendi")
        : "";

    const row = [
      String(p.passenger_order),
      p.full_name || "",
      p.identity_no || "",
      p.passport_no || "",
      p.birth_date ? format(new Date(p.birth_date), "dd.MM.yyyy", { locale }) : "",
      p.is_child ? "X" : "",
      balanceText,
    ];

    // Satır border
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y + rowH, pageWidth - margin, y + rowH);

    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      const tx = computeTx(x, c.width, c.align);
      const text = sanitizeLatin(row[i]);
      doc.text(text, tx, y + 4, {
        align: c.align,
        maxWidth: c.width - 2,
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
