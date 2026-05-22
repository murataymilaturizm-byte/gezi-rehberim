-- ============================================================
-- agencies.billing_cycle — abonelik faturalama periyodu (aylık/yıllık)
-- Şu an plan_type var ama periyot bilgisi sadece payment_transactions.is_yearly'de
-- (geçmiş kayıt). Acentenin "mevcut" faturalama periyodu sorgulanabilir değildi.
--
-- Bu kolon eklendikten sonra:
--   - SubscriptionHistory hero card sabit DB değerine bakar (toggle etkilemez)
--   - "Faturalama: Aylık/Yıllık" rozeti gösterilir
--
-- DOLDURMA (sonraki LS iş kalemi — şimdi DOKUNULMUYOR):
--   - LemonSqueezy webhook variant_id'den is_yearly tespit edip burayı UPDATE etmeli
--   - subscription_created / subscription_updated event'lerinde billing_cycle yazılır
-- ============================================================

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly'));

COMMENT ON COLUMN public.agencies.billing_cycle IS
  'Subscription billing period: monthly or yearly. Default monthly until LS webhook updates from variant_id.';

-- Mevcut acenteler için: payment_transactions tablosunda son başarılı LS ödemesi varsa
-- ondan billing_cycle çıkar; yoksa default 'monthly' kalır.
-- BEST-EFFORT backfill — yanlış değer kaydetmektense default'ta bırakılır.
UPDATE public.agencies a
SET billing_cycle = CASE WHEN pt.is_yearly THEN 'yearly' ELSE 'monthly' END
FROM (
  SELECT DISTINCT ON (agency_id) agency_id, is_yearly
  FROM public.payment_transactions
  WHERE status = 'success'
  ORDER BY agency_id, created_at DESC
) pt
WHERE pt.agency_id = a.id
  AND a.billing_cycle = 'monthly';  -- Sadece default kalanları doldur

-- Index gerek yok — agencies.billing_cycle her zaman tek agency için okunur
-- (RLS user_id üzerinden), küçük string field.
