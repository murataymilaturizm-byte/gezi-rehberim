// ARAÇ-5 / teklif belgesinin bölüm üreticisi — TEK KAYNAK.
// Önizleme ve Word çıktısı AYNI yapıdan üretilir; ikinci bir render yolu yoktur.
//
// TEKLİF ≠ SÖZLEŞME: avukat/örnek-iskelet notu yok, imza bloğu yok.
// Yalnız altbilgi marka satırı + (varsa) geçerlilik satırı.

import type { DocSection, DocSpec } from "../docx";
import { trDate } from "../docx";
import { type OfferData, num, sortedPriceRows } from "./schema";

export const OFFER_TITLE = "TUR TEKLİFİ";
export const BRAND_LINE =
  "Bu teklif turzzai.com/araclar üzerindeki ücretsiz araçla hazırlanmıştır.";

/** Tutar biçimi — TR yerel */
function money(v: string, birim: string): string {
  const n = num(v);
  if (!n) return "";
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + " " + birim;
}

export function kdvIbaresi(d: OfferData): string {
  return d.kdvModu === "dahil" ? "Fiyatlara KDV dahildir." : "Fiyatlara KDV dahil değildir.";
}

/** Geçerlilik satırı — tarih girilmemişse hiç basılmaz */
export function validityLine(d: OfferData): string {
  const t = trDate(d.gecerlilikTarihi);
  return t ? `Bu teklif ${t} tarihine kadar geçerlidir.` : "";
}

export function buildOfferSections(d: OfferData): DocSection[] {
  const out: DocSection[] = [];
  const push = (baslik: string, paragraflar: string[], tablo?: DocSection["tablo"]) => {
    const p = paragraflar.filter(Boolean);
    if (!p.length && !tablo) return;
    out.push({ no: null, baslik, paragraflar: p, ...(tablo ? { tablo } : {}) });
  };

  // Acente
  push("Teklifi Veren", [
    d.acenteUnvan && d.acenteUnvan,
    d.acenteTursab && `TÜRSAB belge no: ${d.acenteTursab}`,
    d.acenteAdres && d.acenteAdres,
    [d.acenteTelefon && `Tel: ${d.acenteTelefon}`, d.acenteEposta && `E-posta: ${d.acenteEposta}`].filter(Boolean).join(" · "),
    d.teklifNo && `Teklif no: ${d.teklifNo}`,
  ]);

  // Muhatap
  const muhatap = [d.muhatapAd, d.muhatapFirma].filter(Boolean).join(" — ");
  push("Sayın", [muhatap && `${muhatap}`,
    "Talebiniz doğrultusunda hazırladığımız tur teklifimizi bilgilerinize sunarız."]);

  // Tur özeti
  push("Tur Bilgileri", [
    d.turAdi && `Tur: ${d.turAdi}`,
    d.guzergah && `Güzergâh: ${d.guzergah}`,
    d.tarihler && `Tarihler: ${d.tarihler}`,
    d.sure && `Süre: ${d.sure}`,
  ]);

  // Program — ŞART ③: tek satırlık turda "Gün 1" başlığı BASILMAZ
  const prog = d.program.filter((r) => r.metin.trim());
  if (prog.length === 1) {
    push("Program", [prog[0].metin.trim()]);
  } else if (prog.length > 1) {
    push("Program", prog.map((r, i) => `Gün ${i + 1}: ${r.metin.trim()}`));
  }

  // Fiyat
  const rows = sortedPriceRows(d);
  if (d.priceMode === "tek" && num(d.tekFiyat) > 0) {
    push("Fiyat", [
      `Kişi başı ${money(d.tekFiyat, d.paraBirimi)}`,
      kdvIbaresi(d),
    ]);
  } else if (rows.length) {
    push(
      "Fiyat",
      [kdvIbaresi(d)],
      {
        basliklar: ["Katılımcı sayısı", "Kişi başı fiyat"],
        satirlar: rows.map((r) => [
          r.maxKisi.trim() ? `${r.minKisi}-${r.maxKisi} kişi` : `${r.minKisi} kişi ve üzeri`,
          money(r.fiyat, d.paraBirimi),
        ]),
      },
    );
  }

  // Dahil / hariç
  if (d.dahilHizmetler.length)
    push("Fiyata Dahil Olanlar", d.dahilHizmetler.map((s) => `— ${s.label}`));
  if (d.haricHizmetler.length)
    push("Fiyata Dahil OLMAYANLAR", [
      "Aşağıdaki kalemler teklif bedeline dahil değildir:",
      ...d.haricHizmetler.map((s) => `— ${s.label}`),
    ]);

  // Ödeme
  push("Ödeme Koşulları", [d.odemeOzeti]);

  // Geçerlilik
  push("Teklif Geçerliliği", [validityLine(d)]);

  // Ek notlar
  push("Ek Notlar", d.ekNotlar.trim() ? d.ekNotlar.trim().split(/\n+/) : []);

  return out;
}

export function offerSpec(d: OfferData): DocSpec {
  const baslik = d.turAdi ? `${OFFER_TITLE} — ${d.turAdi}` : OFFER_TITLE;
  return {
    baslik,
    ustNot: "", // teklif ticari belgedir; avukat/örnek-iskelet notu YOK
    bolumler: buildOfferSections(d),
    imzalar: [], // teklifte imza bloğu yok
    altNot: [d.acenteUnvan, d.acenteTelefon, d.acenteEposta].filter(Boolean).join(" · "),
    markaSatiri: BRAND_LINE,
  };
}
