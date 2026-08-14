// ARAÇ-1 / Rehber Sözleşmesi Oluşturucu — form şeması (tek kaynak).
// KARAR: T.C. kimlik alanı YOK. Rehber kimliği yalnız opsiyonel
// "ruhsat / çalışma kartı no" ile temsil edilir; boşsa ilgili madde cümlesi düşer.
// Hiçbir alan sunucuya gitmez — şema yalnız tarayıcı-içi belge üretimi içindir.

export type Currency = "TRY" | "EUR" | "USD";
export type FeeBasis = "tur" | "gun" | "saat";
export type PaymentTiming = "pesin" | "tur_sonu" | "kismi";
export type PaymentMethod = "banka" | "nakit" | "";
export type ExpenseOwner = "acente" | "rehber" | "";

/** Masraf kalemleri — hiçbiri seçilmezse masraf maddesi belgeden düşer */
export const EXPENSE_ITEMS = [
  { key: "konaklama", label: "Konaklama" },
  { key: "ulasim", label: "Ulaşım" },
  { key: "yemek", label: "Yemek" },
  { key: "muze", label: "Müze / giriş ücretleri" },
] as const;
export type ExpenseKey = (typeof EXPENSE_ITEMS)[number]["key"];

export const GUIDE_LANGUAGES = [
  "Türkçe", "İngilizce", "Almanca", "Rusça", "Arapça", "Fransızca", "İspanyolca", "İtalyanca",
] as const;

export interface ContractData {
  // 1) Taraflar — acente
  acenteUnvan: string;
  acenteAdres: string;
  acenteVergi: string;        // opsiyonel → boşsa cümleden düşer
  acenteTursab: string;       // opsiyonel
  acenteYetkili: string;
  // 1) Taraflar — rehber
  rehberAd: string;
  rehberKartNo: string;       // opsiyonel (ruhsat / çalışma kartı no)
  rehberAdres: string;
  rehberTelefon: string;      // opsiyonel
  rehberIban: string;         // opsiyonel

  // 2) İş tanımı
  turAdi: string;
  guzergah: string;           // opsiyonel
  baslangicTarihi: string;    // ISO yyyy-mm-dd
  bitisTarihi: string;
  diller: string[];
  calismaSuresi: string;      // opsiyonel (ör. "günlük 8 saat")
  grupBuyuklugu: string;      // opsiyonel

  // 3) Ücret
  ucretTutar: string;
  ucretParaBirimi: Currency;
  ucretBazi: FeeBasis;
  odemeZamani: PaymentTiming;
  odemeGun: string;           // tur_sonu/kismi için gün sayısı
  odemeYontemi: PaymentMethod;
  masraflar: Record<ExpenseKey, ExpenseOwner>;

  // 4) İptal
  acenteIptalGun: string;     // opsiyonel → boşsa iptal maddesinin acente fıkrası sadeleşir
  acenteIptalUcret: "tam" | "kismi" | "yok" | "";
  rehberIptalGun: string;
  rehberIkame: boolean;       // rehber yerine ikame bulma yükümlülüğü

  // 5) Mücbir sebep
  mucbirSebep: boolean;

  // 6) Yürürlük ve fesih (Ek-1 — iptal koşullarından BAĞIMSIZ madde)
  yururlukFesih: boolean;
  fesihBildirimGun: string;   // opsiyonel → boşsa "yazılı bildirimle" ifadesi kalır

  // 7) Gizlilik / kişisel veri
  gizlilik: boolean;

  // 8) Uyuşmazlık
  yetkiliYer: string;         // opsiyonel → boşsa madde düşer

  // 9) Ek koşullar
  ekKosullar: string;         // opsiyonel → boşsa madde düşer

  // 10) Belge meta
  duzenlemeYeri: string;
  duzenlemeTarihi: string;    // ISO
  nushaSayisi: string;
}

export const INITIAL_DATA: ContractData = {
  acenteUnvan: "", acenteAdres: "", acenteVergi: "", acenteTursab: "", acenteYetkili: "",
  rehberAd: "", rehberKartNo: "", rehberAdres: "", rehberTelefon: "", rehberIban: "",
  turAdi: "", guzergah: "", baslangicTarihi: "", bitisTarihi: "", diller: [],
  calismaSuresi: "", grupBuyuklugu: "",
  ucretTutar: "", ucretParaBirimi: "TRY", ucretBazi: "tur",
  odemeZamani: "tur_sonu", odemeGun: "7", odemeYontemi: "banka",
  masraflar: { konaklama: "", ulasim: "", yemek: "", muze: "" },
  acenteIptalGun: "", acenteIptalUcret: "", rehberIptalGun: "", rehberIkame: false,
  mucbirSebep: true,
  yururlukFesih: true, fesihBildirimGun: "",
  gizlilik: true,
  yetkiliYer: "",
  ekKosullar: "",
  duzenlemeYeri: "", duzenlemeTarihi: "", nushaSayisi: "2",
};

/** Belgenin anlamlı olması için gereken asgari alanlar (yokluğunda belge sakat kalır) */
export const REQUIRED_FIELDS: Array<{ key: keyof ContractData; label: string }> = [
  { key: "acenteUnvan", label: "Acente unvanı" },
  { key: "acenteAdres", label: "Acente adresi" },
  { key: "acenteYetkili", label: "Acente yetkilisi" },
  { key: "rehberAd", label: "Rehber ad-soyad" },
  { key: "rehberAdres", label: "Rehber adresi" },
  { key: "turAdi", label: "Tur adı" },
  { key: "baslangicTarihi", label: "Başlangıç tarihi" },
  { key: "bitisTarihi", label: "Bitiş tarihi" },
  { key: "ucretTutar", label: "Ücret tutarı" },
];

export function missingRequired(d: ContractData): string[] {
  const out = REQUIRED_FIELDS.filter((f) => !String(d[f.key] ?? "").trim()).map((f) => f.label);
  if (d.diller.length === 0) out.push("Rehberlik dili");
  return out;
}

/** Formda kullanıcı bir şey doldurdu mu? (beforeunload uyarısı için) */
export function isDirty(d: ContractData): boolean {
  return JSON.stringify(d) !== JSON.stringify(INITIAL_DATA);
}
