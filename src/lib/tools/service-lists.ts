// ARAÇLAR — ORTAK hizmet öneri listeleri (ARAÇ-4 sözleşme + ARAÇ-5 teklif).
//
// NEDEN AYRI DOSYA: iki araç da aynı "dahil / hariç" kalemlerini önerir. Liste
// her araçta ayrı tutulursa zamanla ayrışır — acente sözleşmede gördüğü kalemi
// teklifte göremez. Tek kaynak bunu yapısal olarak engeller.
//
// KURAL: hiçbiri ÖN-İŞARETLİ değildir. Araçlar bu listeyi yalnız ÖNERİ olarak
// gösterir; hangisinin geçerli olduğuna acente karar verir, serbestçe ekler/siler.

/** Fiyata dahil olabilecek yaygın kalemler */
export const INCLUDED_SUGGESTIONS = [
  "Ulaşım (belirtilen araç ile)",
  "Konaklama (belirtilen tesis ve oda tipinde)",
  "Belirtilen öğünler",
  "Profesyonel rehberlik hizmeti",
  "Programda belirtilen müze / ören yeri girişleri",
  "Zorunlu seyahat sigortası",
  "Araç içi ikramlar",
  "Otopark, köprü ve geçiş ücretleri",
] as const;

/**
 * Fiyata dahil OLMAYAN kalemler — anlaşmazlıkların ana kaynağı olduğu için
 * her iki belgede de ayrı ve vurgulu başlık altında yazılır.
 */
export const EXCLUDED_SUGGESTIONS = [
  "Kişisel harcamalar",
  "Yiyecek-içecek (programda belirtilenler dışında)",
  "Alkollü ve alkolsüz içecekler",
  "Programda belirtilmeyen müze / ören yeri girişleri",
  "Seyahat sigortası (yaptırılmadıysa)",
  "Tek kişilik oda farkı",
  "Bahşişler",
  "Opsiyonel (ekstra) turlar",
  "Vize, pasaport ve harç işlemleri",
  "Sağlık giderleri",
] as const;

/** Seçilebilir/serbest hizmet kalemi — iki araç da bu tipi kullanır */
export interface ServiceItem {
  id: string;
  label: string;
}
