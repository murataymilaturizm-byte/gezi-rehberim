-- P4-3 (2026-07-28): TUR-DIŞI TALEP kayıtları (uçak/otel/transfer/vize…).
-- registrations'a tip-alanı DEĞİL ayrı tablo (rezervasyon-raporları/conversion kirlenmesin).
CREATE TABLE IF NOT EXISTS public.agency_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  phone text,
  full_name text,
  request_text text NOT NULL,
  requested_date text,
  pax integer,
  source_stage text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agency_leads_agency ON public.agency_leads(agency_id, created_at DESC);

ALTER TABLE public.agency_leads ENABLE ROW LEVEL SECURITY;

-- RLS: tours-emsali — service_role qual=true AÇIĞI TEKRARLANMAZ (Murat şartı):
-- edge-fonksiyonlar service_role-key ile RLS'i zaten BYPASS eder; açık qual=true
-- policy YAZILMAZ. Panel-kullanıcı yalnız kendi acentesi (+super_admin).
DROP POLICY IF EXISTS "Agencies manage own leads" ON public.agency_leads;
CREATE POLICY "Agencies manage own leads" ON public.agency_leads
  FOR ALL TO authenticated
  USING (agency_id = get_user_agency_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (agency_id = get_user_agency_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));
