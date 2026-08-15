// ARAÇ-5 / Tur Teklifi Oluşturucu — form şeması (tek kaynak).
// Teklif TİCARİ bir belgedir; sözleşme değildir → "örnek iskelet / avukatınıza
// inceletin" notu YOKTUR. Yalnız altbilgi marka satırı kalır.
//
// ŞEMA KARARLARI (2026-08-15, onaylı):
//  · Dahil/hariç önerileri ORTAK service-lists.ts'ten gelir (ARAÇ-4 ile tek kaynak).
//  · Program satırları otomatik "Gün N" numaralanır; TEK satır varsa başlık BASILMAZ (şart ③).
//  · Fiyat tablosu kişi-aralıklı satırlardan oluşur; çakışma/boşluk NAZİK uyarı üretir
//    (engellemez) — yanlış fiyat tablosu teklifin en pahalı hatasıdır.
//  · Logo yalnız ÖNİZLEME ve PDF'de görünür; Word çıktısı düzenleme kopyasıdır (şart ①).
//    Ölçüm: Word, HTML .doc içindeki data-URI görselini gömmüyor (InlineShapes = 0).

export { INCLUDED_SUGGESTIONS, EXCLUDED_SUGGESTIONS } from "../service-lists";
export type { ServiceItem } from "../service-lists";
import type { ServiceItem } from "../service-lists";

export type PriceMode = "aralik" | "tek";
export type VatMode = "dahil" | "haric";

/** Program satırı — etiket otomatik ("Gün N"), kullanıcı yalnız içeriği yazar */
export interface ProgramRow {
  id: string;
  metin: string;
}

/** Fiyat tablosu satırı — kişi aralığı + kişi başı fiyat */
export interface PriceRow {
  id: string;
  minKisi: string;
  maxKisi: string;
  fiyat: string;
}

export interface OfferData {
  // ── a) Acente ──
  acenteUnvan: string;
  acenteTursab: string;      // opsiyonel
  acenteTelefon: string;
  acenteEposta: string;      // opsiyonel
  acenteAdres: string;       // opsiyonel
  /** data: URI — YALNIZ tarayıcıda tutulur, hiçbir yere yüklenmez */
  logoDataUrl: string;
  teklifNo: string;          // opsiyonel

  // ── b) Muhatap ──
  muhatapAd: string;
  muhatapFirma: string;      // opsiyonel

  // ── c) Tur ──
  turAdi: string;
  guzergah: string;          // opsiyonel
  tarihler: string;          // serbest metin (ör. "10-12 Eylül 2026")
  sure: string;              // opsiyonel (ör. "2 gece 3 gün")
  program: ProgramRow[];

  // ── d) Dahil / Hariç ──
  dahilHizmetler: ServiceItem[];
  haricHizmetler: ServiceItem[];

  // ── e) Fiyat ──
  priceMode: PriceMode;
  fiyatSatirlari: PriceRow[];
  tekFiyat: string;          // "tek" modunda kişi başı fiyat
  paraBirimi: string;
  kdvModu: VatMode;

  // ── f) Koşullar ──
  gecerlilikTarihi: string;  // ISO
  odemeOzeti: string;        // opsiyonel (kapora / vade)
  ekNotlar: string;          // opsiyonel
}

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}${idCounter}`;
}

export const INITIAL_OFFER: OfferData = {
  acenteUnvan: "", acenteTursab: "", acenteTelefon: "", acenteEposta: "", acenteAdres: "",
  logoDataUrl: "", teklifNo: "",
  muhatapAd: "", muhatapFirma: "",
  turAdi: "", guzergah: "", tarihler: "", sure: "", program: [],
  dahilHizmetler: [], haricHizmetler: [],
  priceMode: "aralik", fiyatSatirlari: [], tekFiyat: "", paraBirimi: "TL", kdvModu: "haric",
  gecerlilikTarihi: "", odemeOzeti: "", ekNotlar: "",
};

/** Sayı ayrıştırma — TR binlik ayırıcı güvenli (ARAÇ-2'deki num() ile aynı kural) */
export function num(raw: string): number {
  const s = String(raw ?? "").trim().replace(/\s/g, "");
  if (!s) return 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;
  if (lastComma > lastDot) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma) normalized = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s.replace(/,/g, "");
  else normalized = s;
  const n = parseFloat(normalized);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Dolu fiyat satırları, min'e göre SIRALI */
export function sortedPriceRows(d: OfferData): PriceRow[] {
  return d.fiyatSatirlari
    .filter((r) => r.minKisi.trim() && r.fiyat.trim())
    .slice()
    .sort((a, b) => num(a.minKisi) - num(b.minKisi));
}

export interface RangeIssue {
  kind: "cakisma" | "bosluk" | "ters";
  mesaj: string;
}

/**
 * Kişi aralıklarında çakışma / boşluk / ters aralık denetimi.
 * ENGELLEMEZ — yalnız nazik uyarı üretir.
 */
export function rangeIssues(d: OfferData): RangeIssue[] {
  if (d.priceMode !== "aralik") return [];
  const rows = sortedPriceRows(d);
  const issues: RangeIssue[] = [];
  for (const r of rows) {
    const mn = num(r.minKisi), mx = num(r.maxKisi);
    if (mx > 0 && mx < mn) issues.push({ kind: "ters", mesaj: `${r.minKisi}-${r.maxKisi} aralığı ters (üst sınır alt sınırdan küçük).` });
  }
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], b = rows[i + 1];
    const aMax = num(a.maxKisi), bMin = num(b.minKisi);
    if (!aMax) continue;
    if (bMin <= aMax) {
      issues.push({ kind: "cakisma", mesaj: `${a.minKisi}-${a.maxKisi} ile ${b.minKisi}-${b.maxKisi} aralıkları çakışıyor.` });
    } else if (bMin > aMax + 1) {
      issues.push({ kind: "bosluk", mesaj: `${aMax + 1}-${bMin - 1} kişi aralığı için fiyat yok.` });
    }
  }
  return issues;
}

export function missingRequired(d: OfferData): string[] {
  const eksik: string[] = [];
  if (!d.acenteUnvan.trim()) eksik.push("Acente unvanı");
  if (!d.muhatapAd.trim()) eksik.push("Muhatap");
  if (!d.turAdi.trim()) eksik.push("Tur adı");
  const fiyatVar = d.priceMode === "tek" ? !!d.tekFiyat.trim() : sortedPriceRows(d).length > 0;
  if (!fiyatVar) eksik.push("Fiyat");
  return eksik;
}

export function isDirty(d: OfferData): boolean {
  return JSON.stringify(d) !== JSON.stringify(INITIAL_OFFER);
}

/** Logo üst sınırı — taslak JSON'u ve PDF'i şişirmemek için */
export const LOGO_MAX_BYTES = 200 * 1024;
export const LOGO_MAX_WIDTH = 400;
