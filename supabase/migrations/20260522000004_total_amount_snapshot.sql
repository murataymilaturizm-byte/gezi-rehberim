-- ============================================================
-- K3: total_amount SNAPSHOT — rezervasyon oluşturulurken o anki fiyatla kayıt
-- Amaç: Tur fiyatı sonradan değişse bile geçmiş rezervasyonların audit-trail'i
-- bozulmasın. Frontend artık registrations.total_amount kolonunu okuyabilir.
-- KORUMA: Mevcut FOR UPDATE quota lock + duplicate check BOZULMAZ.
-- Backward-compatible: p_total_amount DEFAULT NULL → eski caller'lar çalışmaya devam eder.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_reservation_with_quota_check(
  p_tour_id        UUID,
  p_tour_date_id   UUID,
  p_full_name      TEXT,
  p_phone          TEXT,
  p_pax            INT,
  p_agency_id      UUID,
  p_source_channel TEXT    DEFAULT 'WHATSAPP',
  p_note           TEXT    DEFAULT NULL,
  p_email          TEXT    DEFAULT NULL,
  p_total_amount   NUMERIC DEFAULT NULL    -- K3: caller hesaplar (Math.round, kuruş yok)
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
  v_total_amount    NUMERIC;
  v_price_adult     NUMERIC;
BEGIN
  -- FOR UPDATE: kontenjan kilidi (eş zamanlı rezervasyon korunur)
  SELECT quota, price_adult INTO v_quota, v_price_adult
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

  -- K3: total_amount fallback — caller değer vermediyse DB fiyatından hesapla.
  -- Caller hesabı her zaman tercih edilir (currency/child-pax dahil daha doğru).
  IF p_total_amount IS NOT NULL AND p_total_amount >= 0 THEN
    v_total_amount := p_total_amount;
  ELSE
    v_total_amount := COALESCE(v_price_adult, 0) * p_pax;
  END IF;

  INSERT INTO public.registrations (
    tour_id, tour_date_id, full_name, phone, email,
    pax, agency_id, status, source_channel, payment_status, note,
    total_amount, paid_amount
  ) VALUES (
    p_tour_id, p_tour_date_id, p_full_name, p_phone, p_email,
    p_pax, p_agency_id, 'NEW', p_source_channel, 'UNPAID', p_note,
    v_total_amount, 0
  )
  RETURNING id INTO v_registration_id;

  RETURN json_build_object(
    'success',         true,
    'registration_id', v_registration_id,
    'remaining_after', v_remaining - p_pax,
    'total_amount',    v_total_amount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.create_reservation_with_quota_check FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_reservation_with_quota_check TO service_role;

COMMENT ON FUNCTION public.create_reservation_with_quota_check IS
  'Atomic reservation with FOR UPDATE quota lock + total_amount SNAPSHOT (K3). '
  'p_total_amount caller-side calculation (Math.round, child-pax) — falls back to price_adult × pax.';

-- ============================================================
-- OPSİYONEL düzeltici UPDATE — mevcut NULL total_amount'ları o anki fiyatla doldur.
-- DİKKAT: Bu "o anki fiyat" — geçmiş rezervasyonun gerçek tutarı OLMAYABİLİR
-- (fiyat değişmişse fark olur). Bundan sonraki rezervasyonlar snapshot olarak korunur.
-- Bu kısmı çalıştırma KARARI size ait — alttaki satırın başındaki -- işaretini kaldırın.
-- ============================================================
-- UPDATE public.registrations r
-- SET total_amount = COALESCE(td.price_adult, 0) * r.pax
-- FROM public.tour_dates td
-- WHERE r.tour_date_id = td.id
--   AND (r.total_amount IS NULL OR r.total_amount = 0)
--   AND r.status != 'CANCELLED';
