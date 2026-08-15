// ARAÇ-5 / teklif dışa aktarma — TIKLAMADA lazy import edilir.
// ORTAK docx çekirdeği kullanılır (../docx) — yeni kütüphane YOK.
//
// LOGO NOTU (ölçüm): Word, HTML .doc içindeki data-URI görselini gömmüyor
// (COM ile ölçüldü: InlineShapes = 0). Bu yüzden logo Word çıktısına HİÇ
// yazılmaz — bozuk görsel kutusu yerine sessizce yok sayılır. Logo, önizleme
// ve PDF (tarayıcı yazdırması) yolunda görünür.

import { downloadDocFromSpec, downloadBlob, printDocument, slugForFile } from "../docx";
import { offerSpec } from "./document";
import type { OfferData } from "./schema";

function baseName(d: OfferData): string {
  const slug = slugForFile(d.turAdi, "tur-teklifi");
  const tarih = new Date().toISOString().slice(0, 10);
  return d.teklifNo.trim() ? `${slug}-${slugForFile(d.teklifNo, "no")}` : `${slug}-${tarih}`;
}

/** Teklif (.doc) — logo YAZILMAZ (yukarıdaki ölçüm gereği) */
export function downloadOffer(d: OfferData): void {
  downloadDocFromSpec(offerSpec(d), `tur-teklifi-${baseName(d)}.doc`);
}

/** Taslak indir — kullanıcının KENDİ diskine; bizde kayıt tutulmaz */
export function downloadDraft(d: OfferData): void {
  downloadBlob(JSON.stringify(d, null, 2), `tur-teklifi-${baseName(d)}.taslak.json`, "application/json");
}

export { printDocument };
