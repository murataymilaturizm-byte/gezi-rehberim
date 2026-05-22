// Merkezi finansal hesap kütüphanesi (edge function tarafı).
// Tüm bot/template/dashboard hesapları BU dosyadan geçer.
// Frontend ikizi: src/lib/finance.ts — mantık BİREBİR aynıdır.
//
// Tek sorumluluk: para hesabında tutarlılık. Yuvarlama → Math.round (banker's),
// NULL/NaN/negatif değerler → güvenli 0, payment > total → cap.

/**
 * Sayıyı pozitif, sonlu sayıya zorla. NaN/Infinity/negatif → 0.
 * Internal helper — dışarıdan toUnsafe input'lar buradan geçer.
 */
function _safeAmount(input: unknown): number {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * Yetişkin + (varsa) çocuk × fiyat → toplam tutar.
 * Fiyat NULL/0/negatif ise → 0 döner. Bot caller bu durumda rezervasyon yapmamalı.
 *
 * @param pax           - Yetişkin sayısı (≥ 0)
 * @param priceAdult    - Yetişkin fiyatı
 * @param childCount    - Çocuk sayısı (opsiyonel)
 * @param priceChild    - Çocuk fiyatı (opsiyonel; verilmezse adult fiyatı kullanılır)
 */
export function calculateTotal(
  pax: number | null | undefined,
  priceAdult: number | null | undefined,
  childCount: number | null | undefined = 0,
  priceChild: number | null | undefined = null,
): number {
  const _pax = Math.floor(_safeAmount(pax));
  const _children = Math.floor(_safeAmount(childCount));
  const _adultP = _safeAmount(priceAdult);
  // Çocuk fiyatı verilmemişse adult fiyatına düş (mevcut akış davranışı)
  const _childP = priceChild == null ? _adultP : _safeAmount(priceChild);
  const total = _pax * _adultP + _children * _childP;
  // Yuvarlama: toplamda kuruş kaybı olmasın (TRY = decimals 0 → round identity)
  return Math.round(total);
}

/**
 * Kapora hesabı. Yüzde 0-100 dışındaysa safeDepositPercentage helper'ı kullanılmalı.
 * TEK yuvarlama kuralı: Math.round (banker's). Math.ceil/floor kullanılmaz.
 *
 * Helper sadece sayıyı hesaplar — fiyat/yüzde validasyonu çağıran tarafta.
 */
export function calculateDeposit(total: number | null | undefined, depositPercentage: number | null | undefined): number {
  const _total = _safeAmount(total);
  const _pct = _safeAmount(depositPercentage);
  if (_total <= 0 || _pct <= 0) return 0;
  if (_pct >= 100) return Math.round(_total);
  return Math.round((_total * _pct) / 100);
}

/**
 * Kalan tutar. Negatif olmaz (Math.max(0, ...)).
 * UI "fazla ödeme" durumunu ayrıca işaretleyebilir (hasOverpayment).
 */
export function calculateRemaining(total: number | null | undefined, paid: number | null | undefined): number {
  const _total = _safeAmount(total);
  const _paid = _safeAmount(paid);
  return Math.max(0, _total - _paid);
}

/**
 * Aşırı ödeme tespiti — UI uyarı/onay diyaloğu için.
 * Math.round(epsilon) bazı float operasyonlarında 0.0001 farkı gizlemek için: toleransla karşılaştır.
 */
export function isOverpayment(total: number | null | undefined, paidAfter: number | null | undefined): boolean {
  const _total = _safeAmount(total);
  const _paid = _safeAmount(paidAfter);
  return _total > 0 && _paid > _total + 0.01;
}
