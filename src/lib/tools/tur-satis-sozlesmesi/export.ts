// ARAÇ-4 / belge dışa aktarma — TIKLAMADA lazy import edilir.
// Araç sayfasını açmayan kullanıcı bu kodu İNDİRMEZ.
// ORTAK çekirdek (../docx) kullanılır — yeni kütüphane YOK, kopya kod YOK.
//
// İKİ AYRI DOSYA indirilir (zip yok — basitlik kararı).

import { downloadDocFromSpec, downloadBlob, printDocument, slugForFile } from "../docx";
import { contractSpec, prebriefSpec } from "./clauses";
import type { SalesContractData } from "./schema";

function baseName(d: SalesContractData): string {
  const slug = slugForFile(d.turAdi, "paket-tur");
  const tarih = d.sozlesmeTarihi || new Date().toISOString().slice(0, 10);
  return `${slug}-${tarih}`;
}

/** Belge 1: Paket Tur Satış Sözleşmesi (.doc) */
export function downloadContract(d: SalesContractData): void {
  downloadDocFromSpec(contractSpec(d), `tur-satis-sozlesmesi-${baseName(d)}.doc`);
}

/** Belge 2: Ön Bilgilendirme Formu (.doc) */
export function downloadPrebrief(d: SalesContractData): void {
  downloadDocFromSpec(prebriefSpec(d), `on-bilgilendirme-formu-${baseName(d)}.doc`);
}

/** Taslak indir/yükle — kullanıcının KENDİ diskine; bizde kayıt tutulmaz */
export function downloadDraft(d: SalesContractData): void {
  downloadBlob(JSON.stringify(d, null, 2), `tur-satis-${baseName(d)}.taslak.json`, "application/json");
}

export { printDocument };
