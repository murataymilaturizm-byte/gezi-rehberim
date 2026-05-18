-- ============================================================
-- Email Collection: pazarlama altyapısı
-- whatsapp_user_profiles + registrations + agencies tabloları
-- ============================================================

-- whatsapp_user_profiles: email + opt-in flag
ALTER TABLE whatsapp_user_profiles
  ADD COLUMN IF NOT EXISTS email            TEXT,
  ADD COLUMN IF NOT EXISTS email_opted_in   BOOLEAN DEFAULT false;

-- Basit email format kontrolü (tam doğrulama backend'de)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_format_check'
      AND conrelid = 'whatsapp_user_profiles'::regclass
  ) THEN
    ALTER TABLE whatsapp_user_profiles
      ADD CONSTRAINT email_format_check
      CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$');
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_wup_email
  ON whatsapp_user_profiles(email) WHERE email IS NOT NULL;

-- registrations: email kolonu (rezervasyon özeti ve GDPR için)
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS email TEXT;

-- agencies: acente bazlı email toplama kontrolü (default false)
ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS collect_email BOOLEAN DEFAULT false;


-- ============================================================
-- create_reservation_with_quota_check: p_email parametresi ekle
-- Backward-compatible: DEFAULT NULL → mevcut çağrılar değişmez
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_reservation_with_quota_check(
  p_tour_id        UUID,
  p_tour_date_id   UUID,
  p_full_name      TEXT,
  p_phone          TEXT,
  p_pax            INT,
  p_agency_id      UUID,
  p_source_channel TEXT DEFAULT 'WHATSAPP',
  p_note           TEXT DEFAULT NULL,
  p_email          TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_quota           INT;
  v_sold            INT;
  v_remaining       INT;
  v_registration_id UUID;
BEGIN
  SELECT quota INTO v_quota
  FROM public.tour_dates
  WHERE id = p_tour_date_id
  FOR UPDATE;

  IF v_quota IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'TOUR_DATE_NOT_FOUND');
  END IF;

  SELECT COALESCE(SUM(pax), 0) INTO v_sold
  FROM public.registrations
  WHERE tour_date_id = p_tour_date_id
    AND status != 'CANCELLED';

  v_remaining := v_quota - v_sold;

  IF v_remaining < p_pax THEN
    RETURN json_build_object(
      'success',   false,
      'error',     'QUOTA_EXCEEDED',
      'remaining', v_remaining
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.registrations
    WHERE tour_date_id = p_tour_date_id
      AND phone        = p_phone
      AND status      != 'CANCELLED'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'DUPLICATE');
  END IF;

  INSERT INTO public.registrations (
    tour_id, tour_date_id, full_name, phone, email,
    pax, agency_id, status, source_channel, payment_status, note
  ) VALUES (
    p_tour_id, p_tour_date_id, p_full_name, p_phone, p_email,
    p_pax, p_agency_id, 'NEW', p_source_channel, 'UNPAID', p_note
  )
  RETURNING id INTO v_registration_id;

  RETURN json_build_object(
    'success',         true,
    'registration_id', v_registration_id,
    'remaining_after', v_remaining - p_pax
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.create_reservation_with_quota_check FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_reservation_with_quota_check TO service_role;

COMMENT ON FUNCTION public.create_reservation_with_quota_check IS
  'Atomic reservation with FOR UPDATE quota lock + optional email collection. '
  'p_email is optional (DEFAULT NULL) — backward compatible.';
