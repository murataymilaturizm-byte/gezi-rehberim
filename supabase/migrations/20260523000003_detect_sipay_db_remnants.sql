-- ============================================================
-- READ-ONLY: Sipay DB artıklarını tespit (sadece SELECT, hiçbir şey değiştirmez)
--
-- Sipay kodu (edge functions + frontend) kaldırıldı. DB'de sipay-spesifik
-- sütun KALDI — payment_transactions tablosunda `sipay_response JSONB`.
-- (Kaynak: 20251113062054 migration, payment_transactions oluşturma)
--
-- KARAR: DB'deki sipay_response kolonu silinmeli mi?
--   - Kullanılan: HİÇBİR YERDE okunmuyor artık (frontend hiç bakmıyor; edge'de hiç insert yok)
--   - Riski: NULL olarak yaz/oku → zarar yok, sadece şişme
--   - Veri kaybı: kolon silinince geçmiş Sipay yanıtları (varsa) kaybolur
--
-- AŞAĞIDAKİ SQL SADECE TESPİT EDER. Kararı SEN ver.
-- ============================================================

-- 1) payment_transactions tablosundaki sipay-spesifik kolon var mı?
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payment_transactions'
  AND column_name IN ('sipay_response', 'callback_response');

-- 2) payment_transactions'daki sipay_response kolonu KULLANILMIŞ MI?
--    NULL olmayan satır var mı (geçmişte Sipay ile ödeme yapıldı mı)?
SELECT
  COUNT(*) AS total_rows,
  COUNT(sipay_response) AS rows_with_sipay_response,
  COUNT(callback_response) AS rows_with_callback_response
FROM public.payment_transactions;

-- 3) Eğer (2) sıfır dönüyorsa → kolon hiç kullanılmamış, güvenle silinebilir.
--    Eğer (2) > 0 dönüyorsa → geçmiş kayıtlar var, silmeden ÖNCE JSON arşivleme öner.

-- ============================================================
-- KOLON SİLME (opsiyonel — sen karar ver, OTOMATİK ÇALIŞTIRMA):
-- Yukarıdaki (2) sorgusu HER İKİ kolon için 0 dönerse aşağıyı uncomment edebilirsin.
-- 0 dönmüyorsa: önce arşivle (örn. pg_dump), sonra düşür.
-- ============================================================
--
-- ALTER TABLE public.payment_transactions DROP COLUMN IF EXISTS sipay_response;
-- ALTER TABLE public.payment_transactions DROP COLUMN IF EXISTS callback_response;
--
-- COMMIT;
--
-- NOT: payment_transactions tablosunun KENDİSİ KALSIN — LemonSqueezy webhook
-- bu tabloya yazıyor (order_id, amount, status, plan_type, is_yearly).
-- Sadece sipay-spesifik kolonları temizliyoruz.
