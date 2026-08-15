// ARAÇ-2 / Tur Kâr-Fiyat Hesaplayıcı — girdi şeması (tek kaynak).
// Hiçbir alan sunucuya gitmez; şema yalnız tarayıcı-içi hesap içindir.
//
// ŞEMA KARARLARI (2026-08-14, onaylı):
//  · Kâr modu SEÇTİRİLİR: markup (maliyet üzerine) ↔ marj (satıştan pay).
//    "%30 kâr" iki farklı hesaptır; seçtirmezsek araç sessizce yanlış fiyat verir.
//  · Çarpanları kullanıcı yapmaz: yemek = öğün×tutar, konaklama = gece×tutar.
//  · Satış komisyonu OPSİYONEL; boşsa formülden tamamen düşer (ARAÇ-1 disiplini).
//  · Para birimi yalnız ETİKET — kur dönüşümü YOK (sunucusuzluk ilkesi).
//  · KDV yalnız satış fiyatı görünümüdür; girdi-KDV indirimi modellenmez.

export type Currency = "TRY" | "EUR" | "USD";
export type ProfitMode = "markup" | "marj";
export type PriceMode = "oner" | "test";

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  TRY: "₺",
  EUR: "€",
  USD: "$",
};

/** Serbest gider satırı (+satır ekle) */
export interface CostLine {
  id: string;
  label: string;
  amount: string;
}

/** Senaryo tablosunda gösterilen doluluk oranları */
export const OCCUPANCY_SCENARIOS = [0.5, 0.7, 0.85, 1.0] as const;

/** Planlama doluluğu seçenekleri (önerilen fiyat bu doluluktan hesaplanır) */
export const PLANNING_OPTIONS = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0] as const;

export interface CalcInput {
  // ── a) Sabit giderler (tur başına, kişi sayısından bağımsız) ──
  arac: string;
  rehber: string;
  soforKonaklama: string;
  parkGecis: string;
  digerSabit: CostLine[];

  // ── b) Kişi-başı değişkenler ──
  muze: string;
  yemekOgun: string;
  yemekTutar: string;
  konaklamaGece: string;
  konaklamaTutar: string;
  sigorta: string;
  digerDegisken: CostLine[];

  // ── c) Parametreler ──
  kapasite: string;
  planlamaDoluluk: number;
  karModu: ProfitMode;
  karOrani: string;
  komisyon: string; // opsiyonel — boşsa formülden düşer
  kdv: string;
  paraBirimi: Currency;

  // ── Mod: fiyat öner ↔ fiyatımı test et ──
  priceMode: PriceMode;
  kendiFiyat: string; // yalnız "test" modunda kullanılır (KDV hariç liste fiyatı)
}

export const DEFAULT_INPUT: CalcInput = {
  arac: "",
  rehber: "",
  soforKonaklama: "",
  parkGecis: "",
  digerSabit: [],
  muze: "",
  yemekOgun: "",
  yemekTutar: "",
  konaklamaGece: "",
  konaklamaTutar: "",
  sigorta: "",
  digerDegisken: [],
  kapasite: "",
  planlamaDoluluk: 0.7,
  karModu: "markup",
  karOrani: "25",
  komisyon: "",
  kdv: "20",
  paraBirimi: "TRY",
  priceMode: "oner",
  kendiFiyat: "",
};

/** Sabit gider alanlarının etiketleri (form + sonuç dökümü tek kaynaktan) */
export const FIXED_FIELDS = [
  { key: "arac", label: "Otobüs / araç kirası" },
  { key: "rehber", label: "Rehber ücreti" },
  { key: "soforKonaklama", label: "Şoför konaklama-yemek" },
  { key: "parkGecis", label: "Park / geçiş / köprü" },
] as const;

/** Kişi-başı tekil alanlar (çarpanlı olanlar ayrı ele alınır) */
export const VARIABLE_FIELDS = [
  { key: "muze", label: "Müze / ören yeri girişleri" },
  { key: "sigorta", label: "Sigorta" },
] as const;

export function newLine(): CostLine {
  // Math.random yok — kararlı, artan id (prerender/SSR güvenli)
  lineCounter += 1;
  return { id: `l${lineCounter}`, label: "", amount: "" };
}
let lineCounter = 0;
