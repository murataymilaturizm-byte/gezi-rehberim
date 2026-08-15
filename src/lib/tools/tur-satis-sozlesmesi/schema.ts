// ARAÇ-4 / Tur Satış Sözleşmesi + Ön Bilgilendirme Formu — form şeması (tek kaynak).
// TEK FORM → İKİ BELGE. Ortak alanlar bir kez girilir, iki belgeye de işlenir.
// Hiçbir alan sunucuya gitmez.
//
// ŞEMA KARARLARI (2026-08-15, onaylı):
//  · TC kimlik alanı YOK (ARAÇ-1 kararı emsal). Müşteri kimliği ad-soyad + iletişim.
//  · Katılımcı SAYISI zorunlu (bedel ve merdiven bu sayıya dayanır); katılımcı
//    ADLARI opsiyonel — gereksiz kişisel veri toplamayız.
//  · Bedel "kişi başı mı toplam mı" SEÇTİRİLİR; belgeye ikisi birden yazılır.
//  · İptal merdiveni varsayılanı gün aralıklarını doldurur, ORANLARI DOLDURMAZ —
//    hazır oran dağıtmak uydurma tarife üretmek olurdu (M8 disiplini).
//  · Ön bilgilendirme formunun AYRI teslim tarihi vardır: belgenin hukuki işlevi
//    "satıştan önce verildi"yi ispatlamaktır.

export type PriceBasis = "kisi" | "toplam";

// ARAÇ-5 (2026-08-15): dahil/hariç öneri listeleri ORTAK modüle taşındı —
// sözleşme (ARAÇ-4) ve teklif (ARAÇ-5) aynı kaynaktan beslenir; iki listenin
// zamanla ayrışması yapısal olarak engellenir. Buradan yeniden dışa aktarılır
// ki ARAÇ-4'ün mevcut import'ları kırılmasın.
export { INCLUDED_SUGGESTIONS, EXCLUDED_SUGGESTIONS } from "../service-lists";
export type { ServiceItem } from "../service-lists";

/** İptal-iade merdiveni satırı */
export interface RefundRow {
  id: string;
  /** Kalkışa kalan süre (ör. "30 gün ve öncesi") */
  sure: string;
  /** İade / kesinti yaklaşımı — ACENTE DOLDURUR, varsayılan BOŞ */
  iade: string;
}

/**
 * M8'in örnek YAPISI: yalnız gün aralıkları + gerekçe ipucu.
 * `iade` alanı bilinçli olarak BOŞ — hazır oran dağıtmıyoruz.
 */
export const M8_LADDER_TEMPLATE: { sure: string; ipucu: string }[] = [
  { sure: "30 gün ve öncesi", ipucu: "Kontenjan kolayca yeniden satılır; erken kararı cezalandırmayın." },
  { sure: "15-30 gün", ipucu: "Tedarikçi avansları devreye girer; kesintiyi gerçek maliyete dayandırın." },
  { sure: "7-15 gün", ipucu: "Yeniden satış ihtimali düşer; kesinti bunu yansıtır." },
  { sure: "0-7 gün", ipucu: "Kontenjan fiilen yanmıştır; tarih değişikliği / isim devri alternatifi sunun." },
];

export interface SalesContractData {
  // ── a) Acente ──
  acenteUnvan: string;
  acenteTursab: string;      // opsiyonel → boşsa satır düşer
  acenteAdres: string;
  acenteTelefon: string;
  acenteEposta: string;      // opsiyonel
  acenteVergi: string;       // opsiyonel

  // ── b) Müşteri (TC kimlik YOK) ──
  musteriAd: string;
  musteriAdres: string;      // opsiyonel
  musteriTelefon: string;    // opsiyonel
  musteriEposta: string;     // opsiyonel
  yetiskinSayisi: string;
  cocukSayisi: string;       // opsiyonel
  katilimciAdlari: string;   // opsiyonel, çok satırlı

  // ── c) Tur ──
  turAdi: string;
  guzergah: string;          // opsiyonel
  baslangicTarihi: string;   // ISO
  bitisTarihi: string;
  tesisAdi: string;          // opsiyonel
  odaTipi: string;           // opsiyonel
  geceSayisi: string;        // opsiyonel
  ulasimTuru: string;        // opsiyonel
  dahilHizmetler: ServiceItem[];
  haricHizmetler: ServiceItem[];

  // ── d) Bedel ──
  bedelTutar: string;
  bedelBazi: PriceBasis;
  paraBirimi: string;
  kaporaTutar: string;       // opsiyonel
  kalanVade: string;         // opsiyonel (ör. "kalkıştan 15 gün önce")
  odemeYollari: string;      // opsiyonel

  // ── e) İptal-iade merdiveni ──
  merdiven: RefundRow[];
  devirAlternatifi: boolean; // tarih değişikliği / isim devri sunuluyor mu

  // ── f) Ek koşullar ──
  ekKosullar: string;        // opsiyonel

  // ── g) Tarihler ──
  sozlesmeTarihi: string;    // ISO
  formTeslimTarihi: string;  // ISO — ön bilgilendirmenin verildiği tarih
  duzenlemeYeri: string;     // opsiyonel

  // ── Şikâyet kanalı ──
  sikayetKanali: string;     // opsiyonel → boşsa acente telefonu kullanılır
}

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}${idCounter}`;
}

export const INITIAL_DATA: SalesContractData = {
  acenteUnvan: "", acenteTursab: "", acenteAdres: "", acenteTelefon: "",
  acenteEposta: "", acenteVergi: "",
  musteriAd: "", musteriAdres: "", musteriTelefon: "", musteriEposta: "",
  yetiskinSayisi: "", cocukSayisi: "", katilimciAdlari: "",
  turAdi: "", guzergah: "", baslangicTarihi: "", bitisTarihi: "",
  tesisAdi: "", odaTipi: "", geceSayisi: "", ulasimTuru: "",
  dahilHizmetler: [], haricHizmetler: [],
  bedelTutar: "", bedelBazi: "kisi", paraBirimi: "TL",
  kaporaTutar: "", kalanVade: "", odemeYollari: "",
  merdiven: [], devirAlternatifi: false,
  ekKosullar: "",
  sozlesmeTarihi: "", formTeslimTarihi: "", duzenlemeYeri: "",
  sikayetKanali: "",
};

/** Zorunlu alanlar — eksikse önizleme uyarı gösterir (engellemez) */
export function missingRequired(d: SalesContractData): string[] {
  const eksik: string[] = [];
  if (!d.acenteUnvan.trim()) eksik.push("Acente unvanı");
  if (!d.musteriAd.trim()) eksik.push("Müşteri adı");
  if (!d.turAdi.trim()) eksik.push("Tur adı");
  if (!d.baslangicTarihi) eksik.push("Başlangıç tarihi");
  if (!d.bedelTutar.trim()) eksik.push("Bedel");
  if (!(parseInt(d.yetiskinSayisi, 10) > 0)) eksik.push("Yetişkin katılımcı sayısı");
  return eksik;
}

export function isDirty(d: SalesContractData): boolean {
  return JSON.stringify(d) !== JSON.stringify(INITIAL_DATA);
}

/** Toplam katılımcı sayısı */
export function participantCount(d: SalesContractData): number {
  const y = parseInt(d.yetiskinSayisi, 10) || 0;
  const c = parseInt(d.cocukSayisi, 10) || 0;
  return y + c;
}
