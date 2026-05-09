-- Atomik rezervasyon fonksiyonu
-- Race condition'ı önler: SELECT + INSERT yerine tek transaction içinde kota kilitleme + kayıt
-- Aynı zamanda duplicate kontrolü de yapar

CREATE OR REPLACE FUNCTION public.create_reservation_with_quota_check(
  p_tour_id        UUID,
  p_tour_date_id   UUID,
  p_full_name      TEXT,
  p_phone          TEXT,
  p_pax            INT,
  p_agency_id      UUID,
  p_source_channel TEXT DEFAULT 'WHATSAPP',
  p_note           TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_quota          INT;
  v_sold           INT;
  v_remaining      INT;
  v_registration_id UUID;
BEGIN
  -- tour_dates satırını KİLİTLE (FOR UPDATE) — eş zamanlı okumalar
  -- bu lock bitene kadar bekler, böylece overbooking önlenir.
  SELECT quota INTO v_quota
  FROM public.tour_dates
  WHERE id = p_tour_date_id
  FOR UPDATE;

  IF v_quota IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'TOUR_DATE_NOT_FOUND');
  END IF;

  -- Mevcut satış sayısını al (iptal olmayanlar)
  SELECT COALESCE(SUM(pax), 0) INTO v_sold
  FROM public.registrations
  WHERE tour_date_id = p_tour_date_id
    AND status != 'CANCELLED';

  v_remaining := v_quota - v_sold;

  -- Kota yetersiz?
  IF v_remaining < p_pax THEN
    RETURN json_build_object(
      'success',   false,
      'error',     'QUOTA_EXCEEDED',
      'remaining', v_remaining
    );
  END IF;

  -- Aynı tur + telefon kombinasyonu zaten var mı?
  IF EXISTS (
    SELECT 1 FROM public.registrations
    WHERE tour_date_id = p_tour_date_id
      AND phone        = p_phone
      AND status      != 'CANCELLED'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'DUPLICATE');
  END IF;

  -- Rezervasyonu oluştur
  INSERT INTO public.registrations (
    tour_id,
    tour_date_id,
    full_name,
    phone,
    pax,
    agency_id,
    status,
    source_channel,
    payment_status,
    note
  ) VALUES (
    p_tour_id,
    p_tour_date_id,
    p_full_name,
    p_phone,
    p_pax,
    p_agency_id,
    'NEW',
    p_source_channel,
    'UNPAID',
    p_note
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

-- RLS: Bu fonksiyon service_role tarafından çağrılır (edge functions), müşteri erişimi yok
REVOKE ALL ON FUNCTION public.create_reservation_with_quota_check FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_reservation_with_quota_check TO service_role;

-- Açıklama
COMMENT ON FUNCTION public.create_reservation_with_quota_check IS
  'Atomic reservation with FOR UPDATE quota lock — prevents race condition overbooking. '
  'Returns JSON: {success, registration_id?, remaining_after?, error?, remaining?}';
