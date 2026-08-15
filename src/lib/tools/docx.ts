// ARAÇLAR — ORTAK belge dışa aktarma çekirdeği (ARAÇ-1 + ARAÇ-4 paylaşır).
//
// KÜTÜPHANE YOK. Word çıktısı, Word-namespace'li HTML + application/msword Blob
// olarak üretilir (0 KB bağımlılık, UTF-8 güvenli, Word/Google Docs/LibreOffice
// açar ve DÜZENLENEBİLİR).
//
// jsPDF NEDEN YOK: standart fontu Ş/Ğ/İ/ı karakterlerini yok ediyor (ARAÇ-1'de
// ölçüldü) — sözleşme belgesinde kabul edilemez. PDF yolu tarayıcı yazdırmasıdır.
//
// Bu dosya ARAÇ-1'in export.ts'inden çıkarıldı; iki araç aynı fonksiyonları
// çağırır, kopya kod tutulmaz.

/** HTML kaçışı — kullanıcı metni belgeye gömülmeden önce */
export const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Türkçe karakterleri sadeleştirip dosya-adı parçası üretir */
export function slugForFile(raw: string, fallback: string): string {
  return (
    (raw || fallback)
      .toLocaleLowerCase("tr-TR")
      .replace(/[ıİ]/g, "i")
      .replace(/[şŞ]/g, "s")
      .replace(/[ğĞ]/g, "g")
      .replace(/[üÜ]/g, "u")
      .replace(/[öÖ]/g, "o")
      .replace(/[çÇ]/g, "c")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || fallback
  );
}

/** ISO tarihi (yyyy-mm-dd) → "12 Eylül 2026". Boşsa boş döner. */
const AYLAR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
export function trDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${AYLAR[m - 1]} ${y}`;
}

export interface DocSection {
  /** Numaralı madde ise numarası; numarasız bölüm ise null */
  no: number | null;
  baslik: string;
  paragraflar: string[];
  /** Basit tablo (başlık satırı + satırlar) — iptal merdiveni gibi */
  tablo?: { basliklar: string[]; satirlar: string[][] };
}

export interface SignatureBlock {
  rol: string;
  isim: string;
  /** Ek açıklama satırı (ör. teslim beyanı tarihi) */
  altNot?: string;
}

export interface DocSpec {
  baslik: string;
  ustNot: string;
  bolumler: DocSection[];
  imzalar: SignatureBlock[];
  altNot: string;
  markaSatiri: string;
  /** İmza bloklarının üstünde gösterilen beyan (ön bilgilendirme formu için) */
  beyan?: string;
}

function tableHtml(t: NonNullable<DocSection["tablo"]>): string {
  return (
    `<table style="width:100%;border-collapse:collapse;margin:6pt 0 8pt 0;font-size:10pt;">` +
    `<tr>${t.basliklar.map((h) => `<th style="border:1px solid #999;padding:4pt;background:#eee;text-align:left;">${esc(h)}</th>`).join("")}</tr>` +
    t.satirlar
      .map((r) => `<tr>${r.map((c) => `<td style="border:1px solid #999;padding:4pt;">${esc(c)}</td>`).join("")}</tr>`)
      .join("") +
    `</table>`
  );
}

/** Word'ün açtığı HTML gövdesi — DocSpec'ten üretilir (belge-bağımsız) */
export function buildDocHtml(spec: DocSpec): string {
  const body = spec.bolumler
    .map((s) => {
      const baslik =
        s.no === null
          ? `<h2 style="font-size:12pt;margin:16pt 0 6pt 0;">${esc(s.baslik.toLocaleUpperCase("tr-TR"))}</h2>`
          : `<h2 style="font-size:12pt;margin:16pt 0 6pt 0;">MADDE ${s.no} — ${esc(s.baslik.toLocaleUpperCase("tr-TR"))}</h2>`;
      const paras = s.paragraflar
        .map((p) => `<p style="margin:0 0 6pt 0;text-align:justify;">${esc(p)}</p>`)
        .join("");
      return baslik + paras + (s.tablo ? tableHtml(s.tablo) : "");
    })
    .join("");

  const beyanHtml = spec.beyan
    ? `<p style="margin:22pt 0 0 0;padding:8pt;border:1px solid #999;font-size:10pt;">${esc(spec.beyan)}</p>`
    : "";

  // İmza bloğu olmayan belgeler (ör. ARAÇ-5 teklifi) boş tablo basmamalı
  const sigHtml = spec.imzalar.length === 0 ? "" :
    `<table style="width:100%;margin-top:20pt;border-collapse:collapse;"><tr>` +
    spec.imzalar
      .map(
        (s) =>
          `<td style="width:50%;vertical-align:top;padding:0 12pt;">` +
          `<p style="margin:0 0 28pt 0;font-weight:bold;">${esc(s.rol)}</p>` +
          `<p style="margin:0;border-top:1px solid #000;padding-top:4pt;">${esc(s.isim)}</p>` +
          (s.altNot ? `<p style="margin:3pt 0 0 0;font-size:9pt;color:#555;">${esc(s.altNot)}</p>` : "") +
          `<p style="margin:4pt 0 0 0;font-size:9pt;color:#555;">Kaşe / İmza</p></td>`,
      )
      .join("") +
    `</tr></table>`;

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(spec.baslik)}</title>
<style>
  @page { size: A4; margin: 2.2cm; }
  body { font-family: "Times New Roman", serif; font-size: 11pt; line-height: 1.5; color: #000; }
  h1 { font-size: 14pt; text-align: center; margin: 0 0 4pt 0; }
  .note { font-size: 9pt; color: #444; text-align: center; margin: 0 0 14pt 0; font-style: italic; }
  .foot { margin-top: 24pt; border-top: 1px solid #999; padding-top: 6pt; font-size: 9pt; color: #555; }
</style></head>
<body>
<h1>${esc(spec.baslik)}</h1>
${spec.ustNot ? `<p class="note">${esc(spec.ustNot)}</p>` : ""}
${body}
${beyanHtml}
${sigHtml}
<div class="foot">
  <p style="margin:0 0 3pt 0;">${esc(spec.altNot)}</p>
  <p style="margin:0;">${esc(spec.markaSatiri)}</p>
</div>
</body></html>`;
}

/** Blob indir — hiçbir veri ağa çıkmaz, tamamen tarayıcıda üretilir */
export function downloadBlob(content: string, fileName: string, mime: string): void {
  // BOM: Word'ün UTF-8'i doğru tanıması için
  const blob = new Blob(["﻿", content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** .doc indir (Word namespace'li HTML) */
export function downloadDocFromSpec(spec: DocSpec, fileName: string): void {
  downloadBlob(buildDocHtml(spec), fileName, "application/msword;charset=utf-8");
}

/** PDF: tarayıcının yazdırma diyaloğu — önizleme DOM'u basılır */
export function printDocument(): void {
  window.print();
}
