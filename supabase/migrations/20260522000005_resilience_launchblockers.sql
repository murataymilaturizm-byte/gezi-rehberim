-- ============================================================
-- DAYANIKLILIK LAUNCH-BLOCKER MIGRATION
-- K3: system_errors tablosu (merkezi hata kaydı)
-- K2: lemonsqueezy_failed_events + payment_transactions event_id dedup
-- O5: create_reservation_with_quota_check pax bound (1-50)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- K3: SYSTEM ERRORS TABLOSU
-- Merkezi hata kaydı — edge function'lardan logCritical() ile insert.
-- Admin panelinde "Sistem Hataları" görünümünde okunur (sonra).
-- PII maskeleme INSERT'te edge function tarafında yapılır (log-mask.ts).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_errors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event         TEXT NOT NULL,            -- "META_SEND_FAIL", "LS_HANDLER_ERROR", vb.
  severity      TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('critical', 'error', 'warning')),
  error_message TEXT NOT NULL,
  error_stack   TEXT,
  context       JSONB DEFAULT '{}'::jsonb, -- PII maskelenmiş bağlam
  agency_id     UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,               -- Admin "incelendi" işaretlerse doldur
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_errors_event_created ON public.system_errors(event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_errors_agency_created ON public.system_errors(agency_id, created_at DESC) WHERE agency_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_errors_unresolved ON public.system_errors(created_at DESC) WHERE resolved_at IS NULL;

-- RLS: sadece service_role (edge function) yazar; sadece super_admin görür.
ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_errors_service_insert" ON public.system_errors;
CREATE POLICY "system_errors_service_insert" ON public.system_errors
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "system_errors_super_admin_read" ON public.system_errors;
CREATE POLICY "system_errors_super_admin_read" ON public.system_errors
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "system_errors_super_admin_update" ON public.system_errors;
CREATE POLICY "system_errors_super_admin_update" ON public.system_errors
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

COMMENT ON TABLE public.system_errors IS
  'K3: Merkezi kritik hata kaydı. Edge functions logCritical() ile yazar. Super admin görür.';

-- ────────────────────────────────────────────────────────────
-- K2: LEMONSQUEEZY FAILED EVENTS — webhook handler fail olunca
-- ham payload + hata burada saklanır → admin "yeniden işle" yapabilir.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lemonsqueezy_failed_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      TEXT NOT NULL,             -- meta.webhook_id
  event_name    TEXT NOT NULL,
  payload       JSONB NOT NULL,            -- Tam payload (manuel reprocess için)
  error_message TEXT NOT NULL,
  retry_count   INT NOT NULL DEFAULT 0,    -- Manuel yeniden işleme sayısı
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ls_failed_events_event_id ON public.lemonsqueezy_failed_events(event_id);
CREATE INDEX IF NOT EXISTS idx_ls_failed_events_unresolved ON public.lemonsqueezy_failed_events(created_at DESC) WHERE resolved_at IS NULL;

ALTER TABLE public.lemonsqueezy_failed_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ls_failed_events_service_all" ON public.lemonsqueezy_failed_events;
CREATE POLICY "ls_failed_events_service_all" ON public.lemonsqueezy_failed_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ls_failed_events_super_admin_read" ON public.lemonsqueezy_failed_events;
CREATE POLICY "ls_failed_events_super_admin_read" ON public.lemonsqueezy_failed_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

COMMENT ON TABLE public.lemonsqueezy_failed_events IS
  'K2: LemonSqueezy webhook handler fail olunca buraya kaydedilir. 200 LS''ye döner, ama event kaybolmaz.';

-- ────────────────────────────────────────────────────────────
-- K2: LS_PROCESSED_EVENTS — TÜM event tipleri için dedup marker.
-- Webhook her event'i işledikten SONRA buraya event_id ile insert atar.
-- Sonraki retry'da bu kayıt bulunursa skip (duplicate). Önceki sadece payment_*
-- event'lerini kapsıyordu; subscription_created vb. event'ler hala duplicate
-- subscription_history kaydı oluşturuyordu.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ls_processed_events (
  event_id     TEXT PRIMARY KEY,           -- meta.webhook_id (LS unique)
  event_name   TEXT NOT NULL,
  agency_id    UUID,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ls_processed_events_processed_at
  ON public.ls_processed_events(processed_at DESC);

ALTER TABLE public.ls_processed_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ls_processed_events_service_all" ON public.ls_processed_events;
CREATE POLICY "ls_processed_events_service_all" ON public.ls_processed_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ls_processed_events_super_admin_read" ON public.ls_processed_events;
CREATE POLICY "ls_processed_events_super_admin_read" ON public.ls_processed_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

COMMENT ON TABLE public.ls_processed_events IS
  'K2: LemonSqueezy webhook dedup — event_id PK ile her event tek seferlik işlenir.';

-- payment_transactions order_id zaten payment event'lerinde "LS-{eventId}" formatında
-- maybeSingle check ile kontrol ediliyordu (eski davranış). Partial unique index'le
-- DB seviyesinde de garantiye al — race condition olsa bile çift kayıt önlenir.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_ls_event_unique
  ON public.payment_transactions(order_id)
  WHERE order_id LIKE 'LS-%';

COMMENT ON INDEX public.idx_payment_transactions_ls_event_unique IS
  'K2: payment_transactions LS-prefix order_id tek seferlik DB garanti (race koruması).';

-- ────────────────────────────────────────────────────────────
-- O5: RPC pax bound (1-50) — abuse koruması
-- WhatsApp flow zaten 50 üstü reddediyor (process-message.ts:196-213),
-- ama RPC direkt çağrılırsa veya başka kanaldan pax=99999 gelirse de güvende.
-- ────────────────────────────────────────────────────────────
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

  IF EXISTS (
    SELECT 1 FROM public.registrations
    WHERE tour_date_id = p_tour_date_id
      AND phone        = p_phone
      AND status      != 'CANCELLED'
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

REVOKE ALL ON FUNCTION public.create_reservation_with_quota_check FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_reservation_with_quota_check TO service_role;

COMMENT ON FUNCTION public.create_reservation_with_quota_check IS
  'Atomic reservation with quota lock + total_amount snapshot + pax bound (1-50). '
  'O5: INVALID_PAX error if pax<1 or >50.';
