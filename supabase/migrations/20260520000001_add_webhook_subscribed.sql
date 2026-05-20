-- agencies tablosuna webhook_subscribed kolonu ekle
-- false = subscription henüz doğrulanmamış / kurulmamış
-- true = subscribed_apps POST + GET verify başarılı

ALTER TABLE public.agencies
ADD COLUMN IF NOT EXISTS webhook_subscribed BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.agencies.webhook_subscribed IS
  'Meta WABA subscribed_apps subscription doğrulandı mı? Embedded Signup Step 6''da set edilir.';
