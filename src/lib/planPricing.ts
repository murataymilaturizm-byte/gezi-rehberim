// Merkezi plan fiyat config'i — LemonSqueezy ile senkron tutulmalı.
// Fiyat değişikliğinde SADECE bu dosya güncellenir; PricingSection, SuperAdminDashboard,
// SubscriptionHistory, vb. hepsi bu kaynağı kullanır.
//
// Platform geleneği: TRY-bazlı abonelik. Diğer para birimleri runtime'da
// useCurrencyConverter ile dönüştürülür (sadece UI gösterimi için).

export const PLAN_PRICES_TRY = {
  starter: 3999,
  professional: 5999,
  enterprise: 7999,
} as const;

export type PlanType = keyof typeof PLAN_PRICES_TRY;

export function getPlanPriceTRY(plan: string): number {
  return (PLAN_PRICES_TRY as Record<string, number>)[plan] ?? 0;
}
