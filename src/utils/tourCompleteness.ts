// Tur-alan doluluk hesabı — TEK KAYNAK (2026-07-10 Panel-1).
//
// Amaç: "panel verisi → bot cevap kalitesi" köprüsünü görünür kılmak. Bot bu
// alanlar boşsa müşteriye "bilmiyorum" der veya acenteye yönlendirir; panel
// acenteyi eksiği görüp doldurmaya teşvik eder.
//
// Bu dosya İKİ tüketiciyi besler (ileride öneri-8 form-helper metinleri de
// aynı `exampleQuestion` alanından gelecek — şimdiden o yapıda):
//   1. ToursList satır-rozeti (doluluk %) + eksik-alan tooltip'i
//   2. TourFormDialog kaydet-adımı bilgilendirme uyarısı (engellemeyen)
//
// KOŞULLU ALANLAR (yanlış "eksik" üretmemek için):
//   - konaklama: yalnız konaklamalı turlarda (type !== DAYTRIP) sayılır
//   - vize durumu: yalnız yurtdışı/uluslararası kategoride sayılır; İş-2
//     3-durumlu visa_required'da NULL ("belirtilmedi") = EKSİK sayılır
//   (cancellation_policy acente-seviyesi → burada DEĞİL, onboarding'de.)

import { isInternationalCategory } from "@/components/admin/tour-form/TourCategories";

export interface TourCriticalField {
  key: string;
  label: string;
  /** Bot bu alan boşken yanıtlayamadığı örnek müşteri sorusu (helper metni kaynağı). */
  exampleQuestion: string;
}

/** Her turda beklenen çekirdek alanlar (koşulsuz). */
const BASE_FIELDS: TourCriticalField[] = [
  { key: "hareket_noktasi", label: "Kalkış yeri", exampleQuestion: "Tur nereden kalkıyor?" },
  { key: "toplanma_saati", label: "Buluşma saati", exampleQuestion: "Saat kaçta buluşuyoruz?" },
  { key: "tur_sure", label: "Tur süresi", exampleQuestion: "Tur ne kadar sürüyor?" },
  { key: "ulasim", label: "Ulaşım", exampleQuestion: "Ulaşım nasıl sağlanıyor?" },
  { key: "gezilecek_yerler", label: "Gezilecek yerler", exampleQuestion: "Nereleri geziyoruz?" },
];

/** Konaklamalı turda ek beklenen alan. */
const OVERNIGHT_FIELD: TourCriticalField = {
  key: "konaklama", label: "Konaklama", exampleQuestion: "Nerede konaklıyoruz?",
};

/** Yurtdışı turda ek beklenen alan (NULL = belirtilmedi = eksik). */
const VISA_FIELD: TourCriticalField = {
  key: "visa_required", label: "Vize durumu", exampleQuestion: "Vize gerekiyor mu?",
};

/** Tur şekline göre beklenen kritik-alan setini döndürür. */
export function criticalFieldsForTour(tour: { type?: string; tur_kategorisi?: string }): TourCriticalField[] {
  const fields = [...BASE_FIELDS];
  if (tour.type && tour.type !== "DAYTRIP") fields.push(OVERNIGHT_FIELD);
  if (isInternationalCategory(tour.tur_kategorisi ?? "")) fields.push(VISA_FIELD);
  return fields;
}

/** Bir alanın "dolu" sayılıp sayılmadığı (visa 3-durumlu: NULL/undefined = eksik). */
function isFieldFilled(tour: Record<string, any>, key: string): boolean {
  const v = tour[key];
  if (key === "visa_required") return v === true || v === false; // NULL/undefined = belirtilmedi = eksik
  return typeof v === "string" ? v.trim().length > 0 : v != null && v !== "";
}

export interface TourCompleteness {
  filled: number;
  total: number;
  percent: number;
  missing: TourCriticalField[];
  /** Renk sınıfı: tam=yeşil, 1-2 eksik=sarı, 3+=kırmızı. */
  level: "complete" | "partial" | "poor";
}

export function computeTourCompleteness(tour: Record<string, any>): TourCompleteness {
  const fields = criticalFieldsForTour(tour);
  const missing = fields.filter((f) => !isFieldFilled(tour, f.key));
  const total = fields.length;
  const filled = total - missing.length;
  const percent = total === 0 ? 100 : Math.round((filled / total) * 100);
  const level: TourCompleteness["level"] =
    missing.length === 0 ? "complete" : missing.length <= 2 ? "partial" : "poor";
  return { filled, total, percent, missing, level };
}
