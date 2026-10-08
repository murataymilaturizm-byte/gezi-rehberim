// Test yardımcısı (Dilim-8): "şimdi"yi sabitler. Yalnız `Date` değiştirilir (zamanlayıcılar
// gerçek kalır → async akışlar takılmaz). `new Date()` / `Date.now()` sabit anı döner;
// argümanlı `new Date(x)` normal çalışır. fn bitince (hata olsa da) gerçek Date geri gelir.
export async function withFakeNow<T>(iso: string, fn: () => Promise<T> | T): Promise<T> {
  const Real = Date;
  const fixed = new Real(iso).getTime();
  class FakeDate extends Real {
    constructor(...a: any[]) {
      if (a.length === 0) super(fixed);
      else super(...(a as [any]));
    }
    static now() { return fixed; }
  }
  (globalThis as any).Date = FakeDate;
  try { return await fn(); } finally { (globalThis as any).Date = Real; }
}
