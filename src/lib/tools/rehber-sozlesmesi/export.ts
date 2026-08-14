// ARAÇ-1 / belge dışa aktarma — TIKLAMADA lazy import edilir.
// Araç sayfasını açmayan kullanıcı bu kodu İNDİRMEZ; araç sayfasında bile
// yalnız "indir" tıklanınca yüklenir → blog/landing LCP'sine etki SIFIR.
//
// KÜTÜPHANE SEÇİMİ (ölçüldü, tasarım raporunda):
//  - PDF  → tarayıcı yazdırma (0 KB). jsPDF standart fontu Ş/Ğ/İ/ı karakterlerini
//           YOK EDİYOR (ölçüldü) → sözleşme belgesi için kabul edilemez.
//  - Word → Word-namespace'li HTML + application/msword Blob (0 KB, UTF-8 güvenli,
//           Word/Google Docs/LibreOffice açar ve DÜZENLENEBİLİR).

import type { ContractData } from "./schema";
import { buildClauses, signatureBlocks, BRAND_LINE, LAWYER_NOTE_TOP, LAWYER_NOTE_BOTTOM, DOC_TITLE, trDate } from "./clauses";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Dosya adı: tur adı + tarih (Türkçe karakterler sadeleştirilir) */
export function fileNameFor(d: ContractData, ext: string): string {
  const slug = (d.turAdi || "rehber-sozlesmesi")
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıİ]/g, "i").replace(/[şŞ]/g, "s").replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u").replace(/[öÖ]/g, "o").replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "rehber-sozlesmesi";
  const tarih = d.duzenlemeTarihi || new Date().toISOString().slice(0, 10);
  return `rehber-sozlesmesi-${slug}-${tarih}.${ext}`;
}

/** Word'ün açtığı HTML gövdesi (UTF-8 → Türkçe karakter sorunu yok) */
export function buildDocHtml(d: ContractData): string {
  const clauses = buildClauses(d);
  const sigs = signatureBlocks(d);

  const body = clauses
    .map(
      (c) =>
        `<h2 style="font-size:12pt;margin:16pt 0 6pt 0;">MADDE ${c.no} — ${esc(c.baslik.toLocaleUpperCase("tr-TR"))}</h2>` +
        c.paragraflar.map((p) => `<p style="margin:0 0 6pt 0;text-align:justify;">${esc(p)}</p>`).join(""),
    )
    .join("");

  const sigHtml =
    `<table style="width:100%;margin-top:28pt;border-collapse:collapse;"><tr>` +
    sigs
      .map(
        (s) =>
          `<td style="width:50%;vertical-align:top;padding:0 12pt;">` +
          `<p style="margin:0 0 28pt 0;font-weight:bold;">${esc(s.rol)}</p>` +
          `<p style="margin:0;border-top:1px solid #000;padding-top:4pt;">${esc(s.isim)}</p>` +
          `<p style="margin:4pt 0 0 0;font-size:9pt;color:#555;">Kaşe / İmza</p></td>`,
      )
      .join("") +
    `</tr></table>`;

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(DOC_TITLE)}</title>
<style>
  @page { size: A4; margin: 2.2cm; }
  body { font-family: "Times New Roman", serif; font-size: 11pt; line-height: 1.5; color: #000; }
  h1 { font-size: 14pt; text-align: center; margin: 0 0 4pt 0; }
  .note { font-size: 9pt; color: #444; text-align: center; margin: 0 0 14pt 0; font-style: italic; }
  .foot { margin-top: 24pt; border-top: 1px solid #999; padding-top: 6pt; font-size: 9pt; color: #555; }
</style></head>
<body>
<h1>${esc(DOC_TITLE)}</h1>
<p class="note">${esc(LAWYER_NOTE_TOP)}</p>
${body}
${sigHtml}
<div class="foot">
  <p style="margin:0 0 3pt 0;">${esc(LAWYER_NOTE_BOTTOM)}</p>
  <p style="margin:0;">${esc(BRAND_LINE)}</p>
</div>
</body></html>`;
}

/** .doc indir — hiçbir veri ağa çıkmaz, Blob tamamen tarayıcıda üretilir */
export function downloadDoc(d: ContractData): void {
  const html = buildDocHtml(d);
  // BOM: Word'ün UTF-8'i doğru tanıması için
  const blob = new Blob(["﻿", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileNameFor(d, "doc");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** PDF: tarayıcının yazdırma diyaloğu (Save as PDF) — önizleme DOM'u basılır */
export function printDocument(): void {
  window.print();
}

/** Taslak indir/yükle — kullanıcının KENDİ diskine; bizde hiçbir kayıt tutulmaz */
export function downloadDraft(d: ContractData): void {
  const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileNameFor(d, "taslak.json");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { trDate };
