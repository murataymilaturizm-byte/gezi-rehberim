-- ============================================================
-- ENTERPRISE message_limit: -1 (sınırsız) → 50000 (madde 3)
--
-- KÖK SEBEP: Token maliyeti koruması.
-- Anthropic Claude AI çağrılarının token maliyeti ciddi. Enterprise -1 olunca
-- büyük bir firma günde 50.000 mesaj atarsa Anthropic faturası abonelik gelirini
-- AŞAR → her mesajda zarar. 50.000/ay sağlam bir tavan (suistimali önler ama
-- normal kullanımı kısıtlamaz).
--
-- Tur ve dil sınırsız (-1) KALSIN — token harcamaz.
-- Sadece MESAJ limitli.
--
-- whatsapp-webhook'taki K2 plan_features kontrolü zaten enforce ediyor;
-- Enterprise artık 50000 limitiyle çalışacak (mevcut canned mesaj devreye girer).
-- ============================================================

UPDATE public.plan_features
SET message_limit = 50000
WHERE plan_type = 'enterprise';

-- Mevcut Enterprise acentelerin agencies.message_limit alanlarını da güncelle
-- (yeni planda her acente plan_features ile sync; -1 olanlar 50000 olur).
UPDATE public.agencies
SET message_limit = 50000
WHERE plan_type = 'enterprise' AND (message_limit = -1 OR message_limit IS NULL);

-- Doğrulama (manuel kontrol için):
-- SELECT plan_type, message_limit, max_tours, max_languages
-- FROM public.plan_features ORDER BY plan_type;
--
-- SELECT plan_type, COUNT(*) FROM public.agencies
-- WHERE message_limit = 50000 GROUP BY plan_type;

COMMENT ON COLUMN public.plan_features.message_limit IS
  'Aylık mesaj limiti. Enterprise=50000 (token maliyeti tavanı). '
  'Starter=1000, Professional=5000. -1 değeri ARTIK KULLANILMIYOR.';
