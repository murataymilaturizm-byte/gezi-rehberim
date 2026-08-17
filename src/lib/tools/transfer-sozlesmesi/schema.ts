// ARAÇ-6 / Transfer & Araç Kiralama Sözleşmesi — form şeması (tek kaynak).
// Acente ↔ taşıma firması arası hizmet sözleşmesi. Hiçbir alan sunucuya gitmez.
//
// KARARLAR (2026-08-15 — onay döngüsü olmadan verildi, raporda gerekçeli):
//  · TC kimlik alanı YOK (ARAÇ-1/4 emsali). Şoför kimliği ad + telefon ile temsil edilir.
//  · İKİ MOD: tek-sefer ↔ sezonluk dönem. Mod, tarih alanlarını VE bedel bazını
//    birlikte değiştirir; iki mod aynı formda karışmaz.
//  · Yetki belgesi alanı NÖTR etiketli ("D2 / turizm taşımacılığı yetki belgesi no")
//    ve opsiyoneldir — hangi belgenin zorunlu olduğu taşıma türüne göre değişir,
//    araç bunu belirlemeye kalkışmaz.
//  · Masraf sahipliği (yakıt/geçiş/otopark) İŞARETLİ SEÇİM: acente ↔ taşıyıcı ↔
//    belirtilmedi. "Belirtilmedi" seçilirse o satır belgeden düşer — ARAÇ-1 disiplini.
//  · İkame araç maddesi HER ZAMAN basılır (M4-#7'nin özü); süresi ve kapasitesi
//    forma bağlıdır.

export type WorkMode = "tek-sefer" | "donem";
export type FeeBasis = "sefer" | "gunluk" | "donemlik";
export type CostOwner = "acente" | "tasiyici" | "";

/** Araç satırı — çoklu araç desteklenir */
export interface VehicleRow {
  id: string;
  tip: string;      // ör. "45 kişilik otobüs"
  plaka: string;    // opsiyonel
  koltuk: string;   // opsiyonel
}

/** Şoför satırı — opsiyonel, boşsa madde düşer */
export interface DriverRow {
  id: string;
  ad: string;
  telefon: string;
}

/** Masraf kalemleri — kime ait olduğu işaretlenir */
export const COST_ITEMS = [
  { key: "yakit", label: "Yakıt" },
  { key: "gecis", label: "Köprü / otoyol geçiş ücretleri" },
  { key: "otopark", label: "Otopark" },
  { key: "soforKonaklama", label: "Şoför konaklama ve yemek" },
] as const;
export type CostKey = (typeof COST_ITEMS)[number]["key"];

export interface TransferData {
  // ── a) Acente ──
  acenteUnvan: string;
  acenteTursab: string;      // opsiyonel
  acenteAdres: string;       // opsiyonel
  acenteTelefon: string;
  acenteYetkili: string;     // opsiyonel

  // ── b) Taşıyıcı ──
  tasiyiciUnvan: string;
  tasiyiciYetkiBelge: string; // opsiyonel (D2 / turizm taşımacılığı)
  tasiyiciAdres: string;      // opsiyonel
  tasiyiciTelefon: string;
  araclar: VehicleRow[];
  soforler: DriverRow[];

  // ── c) İş ──
  mod: WorkMode;
  isAdi: string;              // güzergâh / tur adı
  guzergah: string;           // opsiyonel
  // tek-sefer modu
  seferTarihi: string;        // ISO
  seferSaati: string;         // opsiyonel
  bulusmaNoktasi: string;     // opsiyonel
  // dönem modu
  donemBaslangic: string;     // ISO
  donemBitis: string;         // ISO
  donemGunler: string;        // opsiyonel serbest (ör. "hafta sonları")

  // ── d) Bedel ──
  bedelTutar: string;
  bedelBazi: FeeBasis;
  paraBirimi: string;
  masraflar: Record<CostKey, CostOwner>;
  odemeVadesi: string;        // opsiyonel

  // ── e) Koşullar ──
  ikameSure: string;          // opsiyonel — ikame aracın temin süresi (saat)
  ikameKapasite: boolean;     // ikame araç eşdeğer kapasitede olmalı
  bildirimSaat: string;       // opsiyonel — gecikme/iptal bildirim süresi (saat)
  sigortaBeyani: boolean;     // taşıyıcı zorunlu sigortaları beyan ediyor
  fesihGun: string;           // opsiyonel — dönem sözleşmesinde fesih bildirim süresi

  // ── f) Ek ──
  ekKosullar: string;         // opsiyonel
  sozlesmeTarihi: string;     // ISO
  duzenlemeYeri: string;      // opsiyonel
}

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}${idCounter}`;
}

export const INITIAL_TRANSFER: TransferData = {
  acenteUnvan: "", acenteTursab: "", acenteAdres: "", acenteTelefon: "", acenteYetkili: "",
  tasiyiciUnvan: "", tasiyiciYetkiBelge: "", tasiyiciAdres: "", tasiyiciTelefon: "",
  araclar: [], soforler: [],
  mod: "tek-sefer",
  isAdi: "", guzergah: "",
  seferTarihi: "", seferSaati: "", bulusmaNoktasi: "",
  donemBaslangic: "", donemBitis: "", donemGunler: "",
  bedelTutar: "", bedelBazi: "sefer", paraBirimi: "TL",
  masraflar: { yakit: "", gecis: "", otopark: "", soforKonaklama: "" },
  odemeVadesi: "",
  ikameSure: "", ikameKapasite: true, bildirimSaat: "", sigortaBeyani: true, fesihGun: "",
  ekKosullar: "", sozlesmeTarihi: "", duzenlemeYeri: "",
};

/** Mod değişince bedel bazı da anlamlı olana çekilir (iki mod karışmasın) */
export function defaultFeeBasis(mod: WorkMode): FeeBasis {
  return mod === "tek-sefer" ? "sefer" : "donemlik";
}

export const FEE_BASIS_LABEL: Record<FeeBasis, string> = {
  sefer: "sefer başına",
  gunluk: "gün başına",
  donemlik: "dönem karşılığı",
};

/** Moda göre geçerli bedel bazı seçenekleri */
export function feeBasisOptions(mod: WorkMode): FeeBasis[] {
  return mod === "tek-sefer" ? ["sefer", "gunluk"] : ["gunluk", "donemlik", "sefer"];
}

export function missingRequired(d: TransferData): string[] {
  const eksik: string[] = [];
  if (!d.acenteUnvan.trim()) eksik.push("Acente unvanı");
  if (!d.tasiyiciUnvan.trim()) eksik.push("Taşıyıcı unvanı");
  if (!d.isAdi.trim()) eksik.push("İş / güzergâh adı");
  if (!d.bedelTutar.trim()) eksik.push("Bedel");
  if (d.mod === "tek-sefer" && !d.seferTarihi) eksik.push("Sefer tarihi");
  if (d.mod === "donem" && !d.donemBaslangic) eksik.push("Dönem başlangıcı");
  return eksik;
}

export function isDirty(d: TransferData): boolean {
  return JSON.stringify(d) !== JSON.stringify(INITIAL_TRANSFER);
}

/** Dolu araç satırları */
export function filledVehicles(d: TransferData): VehicleRow[] {
  return d.araclar.filter((v) => v.tip.trim() || v.plaka.trim() || v.koltuk.trim());
}

/** Dolu şoför satırları */
export function filledDrivers(d: TransferData): DriverRow[] {
  return d.soforler.filter((s) => s.ad.trim() || s.telefon.trim());
}
