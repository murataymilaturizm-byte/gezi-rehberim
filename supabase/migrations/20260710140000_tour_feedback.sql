-- B3 anket cevap-yakalama (2026-07-10): puanların kaydedilmesi.
--
-- 1) registrations.feedback_sent_at — anket TEMPLATE'i bu rezervasyona gönderilince
--    yazılır (send-feedback-survey). Yakalama penceresi: SONRASI + 72 saat içi.
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS feedback_sent_at timestamptz;

-- 2) tour_feedback — müşteri puanı + opsiyonel yorum. Rezervasyon başına TEK kayıt.
CREATE TABLE IF NOT EXISTS public.tour_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL UNIQUE REFERENCES public.registrations(id) ON DELETE CASCADE,
  customer_phone text,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tour_feedback_agency ON public.tour_feedback(agency_id);
CREATE INDEX IF NOT EXISTS idx_tour_feedback_registration ON public.tour_feedback(registration_id);

ALTER TABLE public.tour_feedback ENABLE ROW LEVEL SECURITY;

-- Acente izolasyonu: acente kendi puanlarını görür (webhook service_role RLS'i bypass eder).
DROP POLICY IF EXISTS "Agencies can view own feedback" ON public.tour_feedback;
CREATE POLICY "Agencies can view own feedback" ON public.tour_feedback
  FOR SELECT TO authenticated
  USING (agency_id = public.get_user_agency_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins manage feedback" ON public.tour_feedback;
CREATE POLICY "Super admins manage feedback" ON public.tour_feedback
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
