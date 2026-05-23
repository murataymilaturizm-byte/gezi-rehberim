-- ============================================================
-- L1 (b/c/d): TRIM trigger + mevcut veriyi normalize + UNIQUE constraint
--
-- ⚠️ ÖNKOŞUL:
--   Önce 20260523000001_detect_meta_duplicates.sql çalıştırılmalı.
--   Duplicate kayıt varsa MANUEL temizlenmeden bu dosyayı ÇALIŞTIRMA →
--   son adımdaki CREATE UNIQUE INDEX duplicate'ler yüzünden patlar.
--   (Aymila zaten temizlendi; bu kontrol diğer 49 acente için.)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- L1(b): TRIM trigger
-- BEFORE INSERT/UPDATE'de meta_phone_number_id, meta_waba_id, whatsapp_phone_number
-- alanlarındaki baş/son boşlukları otomatik temizler. Boş string → NULL.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trim_agency_meta_ids()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.meta_phone_number_id IS NOT NULL THEN
    NEW.meta_phone_number_id := NULLIF(TRIM(NEW.meta_phone_number_id), '');
  END IF;
  IF NEW.meta_waba_id IS NOT NULL THEN
    NEW.meta_waba_id := NULLIF(TRIM(NEW.meta_waba_id), '');
  END IF;
  IF NEW.whatsapp_phone_number IS NOT NULL THEN
    NEW.whatsapp_phone_number := NULLIF(TRIM(NEW.whatsapp_phone_number), '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trim_meta_ids ON public.agencies;
CREATE TRIGGER trg_trim_meta_ids
  BEFORE INSERT OR UPDATE OF meta_phone_number_id, meta_waba_id, whatsapp_phone_number
  ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.trim_agency_meta_ids();

COMMENT ON FUNCTION public.trim_agency_meta_ids() IS
  'L1: meta_phone_number_id, meta_waba_id, whatsapp_phone_number alanlarını otomatik TRIM eder. '
  'Boş string NULL''a düşer. Trailing space sorununu (Aymila case) kalıcı önler.';

-- ────────────────────────────────────────────────────────────
-- L1(c): Mevcut veriyi normalize et (trigger sadece YENİ DML için)
-- ────────────────────────────────────────────────────────────
UPDATE public.agencies
SET
  meta_phone_number_id   = NULLIF(TRIM(meta_phone_number_id), ''),
  meta_waba_id           = NULLIF(TRIM(meta_waba_id), ''),
  whatsapp_phone_number  = NULLIF(TRIM(whatsapp_phone_number), '')
WHERE
  (meta_phone_number_id IS NOT NULL AND meta_phone_number_id <> TRIM(meta_phone_number_id))
  OR (meta_waba_id IS NOT NULL AND meta_waba_id <> TRIM(meta_waba_id))
  OR (whatsapp_phone_number IS NOT NULL AND whatsapp_phone_number <> TRIM(whatsapp_phone_number));

-- ────────────────────────────────────────────────────────────
-- L1(d): UNIQUE constraint (partial — NULL hariç)
-- Henüz Meta bağlamamış acenteler NULL olur → constraint etkilenmez.
-- Aynı meta_phone_number_id'ye ikinci kayıt DB seviyesinde ENGELLENİR.
-- ────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS agencies_meta_phone_number_id_unique
  ON public.agencies(meta_phone_number_id)
  WHERE meta_phone_number_id IS NOT NULL;

COMMENT ON INDEX public.agencies_meta_phone_number_id_unique IS
  'L1: Aynı Meta phone_number_id''ye 2. acente kaydını DB seviyesinde ENGELLER. '
  'Duplicate temizlenmeden çalıştırılırsa CREATE patlar — önce detect SQL ile kontrol et.';
