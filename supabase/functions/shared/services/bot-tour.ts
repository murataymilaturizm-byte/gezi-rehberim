// ═══════════════════════════════════════════════════════════════════════════
// B1+B2 (PAKET-0 Dilim-2, 2026-10-08): DB → bot tur nesnesi TEK DÖNÜŞTÜRÜCÜ.
//
// Kök (denetim TURZZ-FABLE-DENETIM.md Grup B): whatsapp-webhook/index.ts ve
// demo-chat/index.ts turu ayrı ayrı elle BEYAZ-LİSTE ile kopyalıyordu →
// visa_notes / visa_required / hotel_name / hotel_stars / min_pax / program_url
// düşüyordu: :10c vize dalı panelde girilen notu hiç göremiyor, B-ATTR min_pax
// her zaman boş, formatTourDetails otel/vizeyi "kayıtlı değil" sanıyordu (her iki kanal).
// Ayrıca dolu tarihler giriş noktasında SİLİNİYORDU → "Sorun H α: dolu tarihi
// etiketle, gizleme" kuralı ve H-β "dolu" mesajı canlıda ulaşılmazdı (B2).
//
// Sözleşme:
//   - Beyaz-liste YOK: ham satırın TÜM kolonları taşınır (yeni DB kolonu eklenince
//     bot otomatik görür). Yalnız title/destination/program_kisa dile göre
//     lokalize edilir; TR asılları title_tr/destination_tr olarak kalır (eşleştirme).
//   - dates: geçmiş tarihler atılır, dolu tarihler KALIR ve `isFull` işaretlenir.
//     Seçim/RPC tarafı hasQuotaForPax ile korunur; liste tarafı (buildDateList)
//     dolu tarihi numarasız + etiketli basar, listedDateIds'e almaz.
//   - Tur seviyesinde: HİÇ müsait (dolu-olmayan, geçmemiş) tarihi olmayan tur
//     katalogdan gizlenir (eski davranış — bkz. Dilim-2 raporu "KARAR GEREKLİ").
// ═══════════════════════════════════════════════════════════════════════════
import { pickLocalized } from "../fsm/localization.ts";
import { getQuotaRemaining } from "./quota-check.ts";

export interface BotTourDate {
  id: string;
  departure_date: string;
  price_adult?: number | null;
  price_child?: number | null;
  price_single?: number | null;
  quota?: number | null;
  remaining_quota?: number | null;
  /** remaining_quota <= 0 — liste etiketi + seçim dışı (B2). */
  isFull: boolean;
  [col: string]: unknown;
}

export interface BotTour {
  id: string;
  /** Dile göre lokalize (pickLocalized). TR asıl: title_tr. */
  title: string;
  destination: string;
  program_kisa: string;
  title_tr: string;
  destination_tr: string;
  currency?: string | null;
  type?: string | null;
  min_pax?: number | null;
  visa_required?: boolean | null;
  visa_notes?: string | null;
  hotel_name?: string | null;
  hotel_stars?: number | null;
  program_url?: string | null;
  toplanma_saati?: string | null;
  hareket_noktasi?: string | null;
  tur_sure?: string | null;
  konaklama?: string | null;
  ulasim?: string | null;
  gezilecek_yerler?: string | null;
  tur_kategorisi?: string | null;
  dates: BotTourDate[];
  /** DB'de olup burada adı geçmeyen kolonlar da AYNEN taşınır. */
  [col: string]: unknown;
}

export function toBotTours(raw: any[], lang: string, today: string): BotTour[] {
  return (raw || [])
    .map((tour: any): BotTour => ({
      ...tour,
      title: pickLocalized(tour, "title", lang),
      destination: pickLocalized(tour, "destination", lang),
      program_kisa: pickLocalized(tour, "program_kisa", lang),
      title_tr: tour.title,
      destination_tr: tour.destination,
      dates: (tour.dates || [])
        .filter((d: any) => d.departure_date >= today)
        .map((d: any) => ({ ...d, isFull: getQuotaRemaining(d) <= 0 })),
    }))
    .filter((t) => t.dates.some((d) => !d.isFull));
}
