-- P6-FIX ① (2026-07-28): bot akışındaki ismi CRM profiline taşı — eşleşme DB'de.
-- NEDEN RPC: TS normalizePhone ("05416500303") ile DB normalize_phone ("905416500303")
-- FARKLI kanonik üretiyor. Eşleştirmeyi edge'de yapmak, bu paketle düzeltilen
-- "kanonik-profil ↔ ham-kayıt uyuşmazlığı" drift'ini yeniden üretirdi → tek-kaynak: DB.
-- Davranış: UPDATE-only (profil yoksa no-op → starter'da ücretli CRM sızmaz),
-- yalnız BOŞ full_name doldurulur (elle girilmiş isim EZİLMEZ), yüzey-ayrımı
-- çağıran tarafta (yalnız whatsapp) — bkz. process-message P6-FIX ① bloğu.
CREATE OR REPLACE FUNCTION public.fill_profile_name_if_empty(
  p_agency_id uuid,
  p_phone     text,
  p_full_name text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rows integer := 0;
BEGIN
  IF p_agency_id IS NULL OR COALESCE(TRIM(p_phone), '') = '' OR COALESCE(TRIM(p_full_name), '') = '' THEN
    RETURN 0;
  END IF;
  UPDATE public.whatsapp_user_profiles
     SET full_name = p_full_name
   WHERE agency_id = p_agency_id
     AND normalize_phone(phone) = normalize_phone(p_phone)
     AND COALESCE(NULLIF(TRIM(full_name), ''), NULL) IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END $$;

REVOKE ALL ON FUNCTION public.fill_profile_name_if_empty(uuid, text, text) FROM PUBLIC, anon, authenticated;
