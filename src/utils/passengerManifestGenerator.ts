// Faz 2-A: Yolcu Listesi (Manifesto) — PDF çıktısı (jsPDF).
// Format nötr/global — kurum/birlik ibaresi yok.
//
// Modern kurumsal düzen + grup renklendirme:
//  • Başlık + iki-kolon bilgi bloğu (sol: tur/tarih/destinasyon/araç, sağ: rehber/lider/kaptan)
//  • Hafif gri tablo başlığı (koyu lacivert YERİNE — baskı-dostu kurumsal ton)
//  • Aynı registration_id'deki yolcular AYNI pastel arka plan rengini paylaşır.
//    5 yumuşak ton dönüşümlü atanır — yan yana gruplar farklı renk olur, ayrım net kalır.
//    Renkler %85+ luminance: siyah metin her zaman okunur, yazıcı dostu.
//  • Pasaport sütunu KOŞULLU: hiçbir yolcuda yoksa sütun çıkmaz; varsa EN SONDA görünür.
//    Sütun genişlikleri her iki duruma göre A4 yazılabilir alana (~186mm) yeniden dağıtılır
//    → çakışma yok, sayısal sütunlar (bakiye/sıra/doğum) doğru hizalı kalır.
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
  // Faz 2-D: bakiye grubu + grup renklendirme tespiti
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

// Grup renklendirme paleti — 5 yumuşak pastel ton, dönüşümlü ata.
// RGB değerleri ~%88-95 luminance — siyah metnin okunabilirliği korunur,
// renksiz/siyah-beyaz yazıcıda hafif gri tonu olarak çıkar (operasyonel kabul).
// Renkler ANLAMSAL DEĞİL — sadece grup ayrımı için.
const GROUP_PALETTE: Array<[number, number, number]> = [
  [232, 244, 252], // pastel sky
  [232, 248, 238], // pastel sage
  [253, 246, 225], // pastel cream
  [253, 236, 236], // pastel rose
  [240, 235, 252], // pastel lavender
];

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

type ColAlign = "left" | "center" | "right";
interface ColDef {
  key: "order" | "name" | "id" | "birth" | "child" | "balance" | "passport";
  title: string;
  align: ColAlign;
  width: number;
}

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

  // ── Pasaport sütunu var mı? ──
  // Bir yolcuda bile gerçek pasaport numarası varsa sütunu göster.
  const hasAnyPassport = passengers.some((p) => !!(p.passport_no || "").trim());

  // ── Sütun tanımı + A4 yazılabilir alana (~186mm) dağılım ──
  // Pasaport varsa: 10+50+28+22+14+36+26 = 186
  // Pasaport yoksa: 10+62+34+22+14+44     = 186  (pasaport 26mm'si Ad Soyad'a +12, Kimlik'e +6, Bakiye'ye +8 dağılır)
  const cols: ColDef[] = hasAnyPassport
    ? [
        { key: "order", title: t("admin.manifest.order", "Sıra"), align: "center", width: 10 },
        { key: "name", title: t("admin.manifest.fullName", "Ad Soyad"), align: "left", width: 50 },
        { key: "id", title: t("admin.manifest.identityNo", "Kimlik No"), align: "left", width: 28 },
        { key: "birth", title: t("admin.manifest.birthDate", "Doğum Tarihi"), align: "center", width: 22 },
        { key: "child", title: t("admin.manifest.isChild", "Çocuk"), align: "center", width: 14 },
        { key: "balance", title: t("admin.manifest.balance", "Bakiye"), align: "right", width: 36 },
        { key: "passport", title: t("admin.manifest.passportNo", "Pasaport No"), align: "left", width: 26 },
      ]
    : [
        { key: "order", title: t("admin.manifest.order", "Sıra"), align: "center", width: 10 },
        { key: "name", title: t("admin.manifest.fullName", "Ad Soyad"), align: "left", width: 62 },
        { key: "id", title: t("admin.manifest.identityNo", "Kimlik No"), align: "left", width: 34 },
        { key: "birth", title: t("admin.manifest.birthDate", "Doğum Tarihi"), align: "center", width: 22 },
        { key: "child", title: t("admin.manifest.isChild", "Çocuk"), align: "center", width: 14 },
        { key: "balance", title: t("admin.manifest.balance", "Bakiye"), align: "right", width: 44 },
      ];

  // ── BAŞLIK ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 25, 40);
  doc.text(
    sanitizeLatin(t("admin.manifest.title", "Yolcu Listesi")),
    pageWidth / 2,
    y + 4,
    { align: "center" }
  );
  y += 7;

  // Tur adı — alt başlık olarak ortalanmış
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 95);
  doc.text(sanitizeLatin(context.tourTitle || ""), pageWidth / 2, y + 4, {
    align: "center",
    maxWidth: pageWidth - margin * 2,
  });
  y += 7;

  // İnce ayraç
  doc.setDrawColor(200, 205, 215);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // ── İKİ-KOLON BİLGİ BLOĞU ──
  const departureText = context.departureDate
    ? format(new Date(context.departureDate), "d MMMM yyyy", { locale })
    : "";
  const returnText = context.returnDate
    ? format(new Date(context.returnDate), "d MMMM yyyy", { locale })
    : "";
  const dateLine = returnText ? `${departureText} -> ${returnText}` : departureText;

  const colGap = 8;
  const infoColW = (pageWidth - margin * 2 - colGap) / 2;
  const leftX = margin;
  const rightX = margin + infoColW + colGap;

  const drawInfoColumn = (
    items: Array<[string, string | undefined | null]>,
    colX: number,
    startY: number,
    colW: number
  ): number => {
    let cy = startY;
    for (const [label, value] of items) {
      if (!value || !value.trim()) continue;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(110, 110, 125);
      doc.text(sanitizeLatin(label.toUpperCase()), colX, cy);
      cy += 3.4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 30);
      const wrapped = doc.splitTextToSize(sanitizeLatin(value), colW);
      doc.text(wrapped, colX, cy);
      cy += 4 * wrapped.length + 2.5;
    }
    return cy;
  };

  const leftItems: Array<[string, string | undefined | null]> = [
    [t("admin.manifest.date", "Tarih"), dateLine],
    [t("admin.manifest.destination", "Destinasyon"), context.tourDestination],
    [t("admin.manifest.vehicle", "Araç"), context.vehiclePlate],
  ];
  const rightItems: Array<[string, string | undefined | null]> = [
    [t("admin.manifest.guide", "Rehber"), context.guideName],
    [t("admin.manifest.tourLeader", "Tur Lideri"), context.tourLeaderName],
    [t("admin.manifest.captain", "Kaptan"), context.captainName],
  ];

  const leftEndY = drawInfoColumn(leftItems, leftX, y, infoColW);
  const rightEndY = drawInfoColumn(rightItems, rightX, y, infoColW);
  y = Math.max(leftEndY, rightEndY) + 3;

  // İkinci ayraç (bilgi → tablo geçişi)
  doc.setDrawColor(220, 222, 230);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // ── BAKIYE FORMATLAMA ──
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

  // ── HİZALAMA YARDIMCISI ──
  // align'a göre 3 farklı tx (Faz 2-D düzeltmesi — right hizalama çakışma fix'i korunur)
  //   left:   tx = x + 2          (sol kenardan padding)
  //   center: tx = x + width/2    (sütun ortası)
  //   right:  tx = x + width - 2  (sağ kenardan padding) ← bakiye/çocuk çakışmasını önler
  const computeTx = (x: number, w: number, align: ColAlign) => {
    if (align === "center") return x + w / 2;
    if (align === "right") return x + w - 2;
    return x + 2;
  };

  // ── GRUP RENK ATAMASI ──
  // Sıralı yolcuları gez; her yeni registration_id'ye palet'ten sıradaki rengi ver.
  // Modulo ile döner — gruplar > 5 olduğunda yan yana iki grup farklı renkte kalır.
  const sorted = [...passengers].sort((a, b) => a.passenger_order - b.passenger_order);
  const groupColorIdx = new Map<string, number>();
  let nextColorIdx = 0;
  for (const p of sorted) {
    if (p.registration_id && !groupColorIdx.has(p.registration_id)) {
      groupColorIdx.set(p.registration_id, nextColorIdx % GROUP_PALETTE.length);
      nextColorIdx++;
    }
  }

  // ── TABLO BAŞLIĞI ──
  const headerH = 8;
  const drawTableHeader = () => {
    // Hafif gri arka plan + ince border (kurumsal/baskı-dostu)
    doc.setFillColor(243, 244, 248);
    doc.setDrawColor(180, 185, 195);
    doc.setLineWidth(0.35);
    doc.rect(margin, y, pageWidth - margin * 2, headerH, "FD");

    doc.setTextColor(40, 45, 60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    let hx = margin;
    for (const c of cols) {
      const tx = computeTx(hx, c.width, c.align);
      doc.text(sanitizeLatin(c.title), tx, y + 5.5, {
        align: c.align,
        maxWidth: c.width - 2,
      });
      hx += c.width;
    }
    y += headerH;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setLineWidth(0.2);
  };

  drawTableHeader();

  // ── YOLCU SATIRLARI ──
  let prevRegId: string | undefined;
  const rowH = 6.8;

  for (const p of sorted) {
    // Sayfa sonu kontrolü
    if (y + rowH > pageHeight - margin - 14) {
      doc.addPage();
      y = margin;
      drawTableHeader();
    }

    // Bakiye sadece grubun ilk yolcusunda görünür (mevcut davranış)
    const isGroupFirst = p.registration_id && p.registration_id !== prevRegId;
    if (p.registration_id) prevRegId = p.registration_id;
    const meta = isGroupFirst && p.registration_id ? metaByReg.get(p.registration_id) : undefined;
    const balanceText =
      meta && meta.remaining > 0
        ? formatMoney(meta.remaining, meta.currency)
        : meta && meta.remaining === 0 && meta.total > 0
        ? t("admin.manifest.paid", "Tamamı ödendi")
        : "";

    // Satır arka planı — grup rengi (varsa)
    const colorIdx = p.registration_id ? groupColorIdx.get(p.registration_id) : undefined;
    if (colorIdx != null) {
      const [r, g, b] = GROUP_PALETTE[colorIdx];
      doc.setFillColor(r, g, b);
      doc.rect(margin, y, pageWidth - margin * 2, rowH, "F");
    }

    // İnce alt çizgi
    doc.setDrawColor(220, 222, 230);
    doc.setLineWidth(0.15);
    doc.line(margin, y + rowH, pageWidth - margin, y + rowH);

    // Hücre değerleri (key bazlı dict — pasaport opsiyonel olduğu için key'le erişim)
    const rowData: Record<ColDef["key"], string> = {
      order: String(p.passenger_order),
      name: p.full_name || "",
      id: p.identity_no || "",
      birth: p.birth_date ? format(new Date(p.birth_date), "dd.MM.yyyy", { locale }) : "",
      child: p.is_child ? "X" : "",
      balance: balanceText,
      passport: p.passport_no || "",
    };

    doc.setTextColor(25, 30, 45);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    let cx = margin;
    for (const c of cols) {
      const tx = computeTx(cx, c.width, c.align);
      // Bakiye sütununu hafif vurgula (kalın), sayısal beton hissi
      if (c.key === "balance" && rowData.balance) {
        doc.setFont("helvetica", "bold");
      }
      doc.text(sanitizeLatin(rowData[c.key]), tx, y + 4.6, {
        align: c.align,
        maxWidth: c.width - 2,
      });
      if (c.key === "balance" && rowData.balance) {
        doc.setFont("helvetica", "normal");
      }
      cx += c.width;
    }
    y += rowH;
  }

  // ── FOOTER ──
  y += 5;
  doc.setDrawColor(180, 185, 195);
  doc.setLineWidth(0.35);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Toplam yolcu rozeti — sol alt
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 25, 40);
  doc.text(
    sanitizeLatin(t("admin.manifest.totalPassengers", "Toplam Yolcu")) + ": ",
    margin,
    y
  );
  // sayıyı biraz daha belirgin
  const labelText = sanitizeLatin(t("admin.manifest.totalPassengers", "Toplam Yolcu")) + ": ";
  const labelW = doc.getTextWidth(labelText);
  doc.setFontSize(11);
  doc.text(String(sorted.length), margin + labelW, y);

  // Üretim tarihi (sağ alt)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(130, 135, 145);
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
