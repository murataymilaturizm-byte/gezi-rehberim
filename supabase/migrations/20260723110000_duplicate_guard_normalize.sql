-- Y5-1 (yolculuk-denetimi): duplicate-guard ham telefon eşitliği → normalize karşılaştırma.
-- registrations.phone HAM saklanır (İş1 DOKUNMA şartı); guard artık normalize_phone()
-- (migration 20260723100000) ile format-toleranslı: "+90541...", "0541...", "90541..."
-- aynı kişi sayılır. Tek değişiklik DUPLICATE bloğu — gerisi 20260522000005 ile birebir.
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
  p_total_amount   NUMERIC DEFAULT NULL
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
  -- O5: Server-side pax bound. WhatsApp flow zaten 50 üstü reddediyor;
  -- bu defansif sınır (abuse / direkt RPC çağrısı / test).
  IF p_pax IS NULL OR p_pax < 1 OR p_pax > 50 THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_PAX', 'pax', p_pax);
  END IF;

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

  -- Y5-1 FIX: format-toleranslı duplicate guard (ham eşitlik yerine kanonik karşılaştırma)
  IF EXISTS (
    SELECT 1 FROM public.registrations
    WHERE tour_date_id = p_tour_date_id
      AND normalize_phone(phone) = normalize_phone(p_phone)
      AND status != 'CANCELLED'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'DUPLICATE');
  END IF;

  -- K3 (önceki migration): total_amount snapshot — caller hesaplı tutarı geçer
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

COMMENT ON FUNCTION public.create_reservation_with_quota_check IS
  'Atomic reservation with quota lock + total_amount snapshot + pax bound (1-50) + normalized duplicate guard (Y5-1).';
