// ARAÇ-2 / hesap çekirdeği — SAF JS, sıfır bağımlılık.
// Test edilebilirlik için React'tan tamamen bağımsız tutuldu: aynı fonksiyonlar
// hem sayfada hem davranışsal testte çağrılır (tek doğruluk kaynağı).
//
// FORMÜLLER (onaylı şema):
//   F = Σ sabit giderler
//   v = Σ kişi-başı değişkenler  (yemek = öğün×tutar, konaklama = gece×tutar)
//   n(d) = floor(kapasite × doluluk)        ← koltuk tam sayıdır, AŞAĞI yuvarlanır
//   C(n) = v + F/n                          ← kişi-başı maliyet
//
//   Fiyat önerisi (planlama doluluğu n_plan ile):
//     markup: p_net = C(n_plan) × (1+m)
//     marj:   p_net = C(n_plan) / (1−m)
//     komisyon k: p_liste = p_net / (1−k)
//     KDV:        p_kdvli = p_liste × (1+kdv)
//
//   Senaryo (ilan fiyatı SABİT — acente tek fiyat ilan eder):
//     kâr(n) = n × p_liste × (1−k) − (F + n×v)
//
//   Başabaş:
//     birim katkı = p_liste×(1−k) − v
//     ≤ 0 → başabaş YOK (her ek yolcu zararı büyütür — sessiz tuzak)
//     > 0 → n_be = ceil(F / birim katkı)

import {
  type CalcInput,
  type CostLine,
  OCCUPANCY_SCENARIOS,
} from "./schema";

/** "1.234,56" / "1234.56" / "" → number. Geçersizse 0. */
export function num(raw: string | number | undefined | null): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  if (!raw) return 0;
  // Kullanıcı hem "1.500" (TR binlik) hem "1500.5" yazabilir.
  // Kural: son ayırıcı ondalıksa ondalık say, değilse binlik ayırıcı say.
  const s = String(raw).trim().replace(/\s/g, "");
  if (!s) return 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;
  if (lastComma > lastDot) {
    // Virgül sonda → TR ondalık: "12.000,50" → 12000.50
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // Yalnız nokta var. TR kullanıcısı "12.000" yazdığında BİNLİK kasteder;
    // "1500.50" yazdığında ondalık. Ayrım: 3'erli gruplama deseni.
    // (Bu araç TR-tek-dil; ilk sürümde "12.000" → 12 okunuyordu — sessiz veri kaybı.)
    const thousandsPattern = /^\d{1,3}(\.\d{3})+$/;
    normalized = thousandsPattern.test(s) ? s.replace(/\./g, "") : s.replace(/,/g, "");
  } else {
    normalized = s;
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function sumLines(lines: CostLine[]): number {
  return lines.reduce((acc, l) => acc + num(l.amount), 0);
}

export interface ScenarioRow {
  doluluk: number;
  n: number;
  kisiBasiMaliyet: number;
  gelir: number;
  maliyet: number;
  kar: number;
}

export type WarningKind = "none" | "negatif-katki" | "kapasite-asimi" | "riskli";

export interface CalcResult {
  /** Sonuç paneli anlamlı mı? (kapasite > 0 ve en az bir gider girilmiş) */
  valid: boolean;
  F: number;
  v: number;
  kapasite: number;
  nPlan: number;
  /** Planlama doluluğundaki kişi-başı maliyet */
  cPlan: number;
  /** KDV hariç, komisyon öncesi net fiyat */
  pNet: number;
  /** KDV hariç ilan (liste) fiyatı — komisyon dahil edilmiş */
  pListe: number;
  /** KDV dahil ilan fiyatı */
  pKdvli: number;
  /** En yakın 50'ye yukarı yuvarlanmış öneri (KDV hariç) */
  pYuvarlak: number;
  /** Senaryolarda kullanılan fiyat — "öner" modunda pListe, "test" modunda kullanıcının fiyatı */
  effectivePrice: number;
  scenarios: ScenarioRow[];
  breakeven: { possible: boolean; n: number | null; birimKatki: number };
  warning: WarningKind;
}

/** En yakın `step` katına YUKARI yuvarla (fiyat önerisini kullanışlı kılar) */
export function roundUpTo(value: number, step = 50): number {
  if (value <= 0) return 0;
  return Math.ceil(value / step) * step;
}

export function calculate(input: CalcInput): CalcResult {
  // ── Sabit giderler ──
  const F =
    num(input.arac) +
    num(input.rehber) +
    num(input.soforKonaklama) +
    num(input.parkGecis) +
    sumLines(input.digerSabit);

  // ── Kişi-başı değişkenler (çarpanlar burada uygulanır) ──
  const v =
    num(input.muze) +
    num(input.yemekOgun) * num(input.yemekTutar) +
    num(input.konaklamaGece) * num(input.konaklamaTutar) +
    num(input.sigorta) +
    sumLines(input.digerDegisken);

  const kapasite = Math.floor(num(input.kapasite));
  const m = num(input.karOrani) / 100;
  const k = num(input.komisyon) / 100;
  const kdv = num(input.kdv) / 100;

  const valid = kapasite > 0 && F + v > 0;

  const nPlan = Math.max(1, Math.floor(kapasite * input.planlamaDoluluk));
  const cPlan = valid ? v + F / nPlan : 0;

  // ── Fiyat önerisi ──
  let pNet = 0;
  if (valid) {
    if (input.karModu === "markup") {
      pNet = cPlan * (1 + m);
    } else {
      // marj modu: %100 ve üstü matematiksel olarak tanımsız → maliyete düşür
      pNet = m < 1 ? cPlan / (1 - m) : cPlan;
    }
  }
  // Komisyon: acenteye kalan pNet olacak şekilde liste fiyatı büyütülür
  const pListe = k < 1 ? pNet / (1 - k) : pNet;
  const pYuvarlak = roundUpTo(pListe, 50);
  // KDV dahil fiyat İLAN EDİLEN (yuvarlanmış) fiyattan türetilir — panelde
  // gösterilen üç sayı (ilan / KDV dahil / senaryolar) aynı fiyattan gelmeli.
  const pKdvli = pYuvarlak * (1 + kdv);

  // ── Senaryolarda kullanılacak fiyat ──
  // "öner" modunda YUVARLANMIŞ fiyat kullanılır: acente 1.737,90 değil 1.750
  // ilan eder. Panelde gösterilen fiyat ile tablonun hesabı aynı sayı olmalı —
  // aksi hâlde kullanıcı iki farklı fiyat görür (ilk sürümde bu tutarsızlık vardı).
  const effectivePrice =
    input.priceMode === "test" ? num(input.kendiFiyat) : pYuvarlak;

  // ── Doluluk senaryoları (ilan fiyatı SABİT) ──
  const scenarios: ScenarioRow[] = OCCUPANCY_SCENARIOS.map((d) => {
    const n = Math.floor(kapasite * d);
    const gelir = n * effectivePrice * (1 - k);
    const maliyet = F + n * v;
    return {
      doluluk: d,
      n,
      kisiBasiMaliyet: n > 0 ? v + F / n : 0,
      gelir,
      maliyet,
      kar: gelir - maliyet,
    };
  });

  // ── Başabaş ──
  const birimKatki = effectivePrice * (1 - k) - v;
  const possible = valid && birimKatki > 0;
  const nBe = possible ? Math.ceil(F / birimKatki) : null;

  // ── Uyarı (üç seviye — üçü farklı şey söyler) ──
  let warning: WarningKind = "none";
  if (valid && effectivePrice > 0) {
    if (birimKatki <= 0) warning = "negatif-katki";
    else if (nBe !== null && nBe > kapasite) warning = "kapasite-asimi";
    else if (nBe !== null && nBe > kapasite * 0.85) warning = "riskli";
  }

  return {
    valid,
    F,
    v,
    kapasite,
    nPlan,
    cPlan,
    pNet,
    pListe,
    pKdvli,
    pYuvarlak,
    effectivePrice,
    scenarios,
    breakeven: { possible, n: nBe, birimKatki },
    warning,
  };
}

/** Para biçimlendirme — TR yerel, 2 hane (0 ise tam sayı gösterilir) */
export function money(value: number, symbol: string): string {
  if (!Number.isFinite(value)) return "—";
  const hasFraction = Math.abs(value % 1) > 0.004;
  return (
    value.toLocaleString("tr-TR", {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: hasFraction ? 2 : 0,
    }) + " " + symbol
  );
}

export const WARNING_TEXT: Record<Exclude<WarningKind, "none">, string> = {
  "negatif-katki":
    "Bu fiyat kişi-başı değişken maliyeti karşılamıyor — doluluk arttıkça zarar büyür.",
  "kapasite-asimi":
    "Bu fiyatla tur tamamen dolsa bile maliyet kurtarılmıyor.",
  riskli:
    "Başabaş noktası kapasitenin çok yakınında — bu maliyet yapısıyla tur riskli.",
};
