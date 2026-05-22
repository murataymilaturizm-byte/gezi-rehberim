// Merkezi finansal hesap kütüphanesi (frontend tarafı).
// Edge ikizi: supabase/functions/shared/utils/finance.ts — mantık BİREBİR aynıdır.
// Tek sorumluluk: para hesabında tutarlılık. Math.round + NULL/NaN/negatif → 0.

function _safeAmount(input: unknown): number {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * pax × priceAdult + childCount × (priceChild ?? priceAdult)
 * Fiyat NULL/0/negatif → 0.
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
  const _childP = priceChild == null ? _adultP : _safeAmount(priceChild);
  const total = _pax * _adultP + _children * _childP;
  return Math.round(total);
}

/** TEK yuvarlama kuralı: Math.round. */
export function calculateDeposit(total: number | null | undefined, depositPercentage: number | null | undefined): number {
  const _total = _safeAmount(total);
  const _pct = _safeAmount(depositPercentage);
  if (_total <= 0 || _pct <= 0) return 0;
  if (_pct >= 100) return Math.round(_total);
  return Math.round((_total * _pct) / 100);
}

/** Negatif olmaz. */
export function calculateRemaining(total: number | null | undefined, paid: number | null | undefined): number {
  const _total = _safeAmount(total);
  const _paid = _safeAmount(paid);
  return Math.max(0, _total - _paid);
}

/** UI uyarı/onay diyaloğu için. */
export function isOverpayment(total: number | null | undefined, paidAfter: number | null | undefined): boolean {
  const _total = _safeAmount(total);
  const _paid = _safeAmount(paidAfter);
  return _total > 0 && _paid > _total + 0.01;
}

/**
 * Yüzdeyi 0-100 aralığına zorlar. Geçersizse fallback (default 30).
 * Edge tarafı `safeDepositPercentage` ile aynı davranış — frontend admin formları için.
 */
export function safeDepositPercentage(input: unknown, fallback: number = 30): number {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n) || n < 0 || n > 100) return fallback;
  return Math.round(n);
}
