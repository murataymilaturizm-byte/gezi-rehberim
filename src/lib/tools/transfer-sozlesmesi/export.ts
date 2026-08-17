// ARAÇ-6 / dışa aktarma — TIKLAMADA lazy import edilir.
// ORTAK docx çekirdeği (../docx) kullanılır — yeni kütüphane YOK.

import { downloadDocFromSpec, downloadBlob, printDocument, slugForFile } from "../docx";
import { transferSpec } from "./clauses";
import type { TransferData } from "./schema";

function baseName(d: TransferData): string {
  const slug = slugForFile(d.isAdi, "tasima-sozlesmesi");
  const tarih = d.sozlesmeTarihi || new Date().toISOString().slice(0, 10);
  return `${slug}-${tarih}`;
}

export function downloadContract(d: TransferData): void {
  downloadDocFromSpec(transferSpec(d), `tasima-sozlesmesi-${baseName(d)}.doc`);
}

export function downloadDraft(d: TransferData): void {
  downloadBlob(JSON.stringify(d, null, 2), `tasima-sozlesmesi-${baseName(d)}.taslak.json`, "application/json");
}

export { printDocument };
