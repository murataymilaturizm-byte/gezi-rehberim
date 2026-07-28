-- P5-2 (2026-07-28): HAVALE/EFT manuel ödeme akışı (acente → Turzz).
-- NOT: agencies.payment_instructions (müşteri→acente) ile AYRI kavram — karıştırma.

-- 1) Platform banka-bilgisi (tek-satır; süper-admin düzenler, acenteler okur)
CREATE TABLE IF NOT EXISTS public.platform_payment_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  iban text,
  account_holder text,
  bank_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.platform_payment_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.platform_payment_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read platform payment" ON public.platform_payment_settings;
CREATE POLICY "authenticated read platform payment" ON public.platform_payment_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "super admin update platform payment" ON public.platform_payment_settings;
CREATE POLICY "super admin update platform payment" ON public.platform_payment_settings
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 2) Ödeme talepleri
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  plan text NOT NULL,
  amount numeric,
  period text NOT NULL CHECK (period IN ('monthly','yearly')),
  reference_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid
);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status, created_at DESC);
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
-- RLS (tours-emsali daraltma; service_role qual=true AÇIĞI YOK):
--   SELECT: kendi acentesi VEYA super_admin
--   INSERT: kendi acentesi VE status=pending (acente onay-alanlarına yazamaz)
--   UPDATE: YALNIZ super_admin (onay/red)
DROP POLICY IF EXISTS "pr select own or super" ON public.payment_requests;
CREATE POLICY "pr select own or super" ON public.payment_requests
  FOR SELECT TO authenticated
  USING (agency_id = get_user_agency_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS "pr insert own pending" ON public.payment_requests;
CREATE POLICY "pr insert own pending" ON public.payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = get_user_agency_id(auth.uid()) AND status = 'pending');
DROP POLICY IF EXISTS "pr update super only" ON public.payment_requests;
CREATE POLICY "pr update super only" ON public.payment_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 3) ONAY RPC'si — ATOMİK + UZATMA MAX-KURALI (tek-yer):
--    yeni-bitiş = greatest(mevcut-bitiş, şimdi) + period
--    → erken ödeyen kalan-günleri KAYBETMEZ; süresi geçmiş bugünden başlar.
--    SECURITY DEFINER ama içeride super_admin-check (yetkisiz çağrı exception).
CREATE OR REPLACE FUNCTION public.approve_payment_request(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req payment_requests%ROWTYPE;
  v_new_end timestamptz;
  v_interval interval;
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'super_admin required';
  END IF;
  SELECT * INTO v_req FROM payment_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'request not pending'; END IF;

  v_interval := CASE v_req.period WHEN 'yearly' THEN interval '1 year' ELSE interval '1 month' END;
  UPDATE agencies
     SET subscription_ends_at = greatest(coalesce(subscription_ends_at, now()), now()) + v_interval,
         plan_type = v_req.plan,
         subscription_status = 'active'
   WHERE id = v_req.agency_id
   RETURNING subscription_ends_at INTO v_new_end;

  UPDATE payment_requests
     SET status = 'approved', approved_at = now(), approved_by = auth.uid()
   WHERE id = p_request_id;

  -- P5-2d: acenteye in-app bildirim (admin_notifications — NotificationCenter)
  INSERT INTO admin_notifications (agency_id, type, title, description, metadata)
  VALUES (v_req.agency_id, 'payment_approved', '✅', '', jsonb_build_object('plan', v_req.plan, 'ends_at', v_new_end));

  RETURN jsonb_build_object('success', true, 'new_ends_at', v_new_end);
END $$;
