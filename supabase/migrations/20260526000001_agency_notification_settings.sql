-- ============================================================
-- FAZ 2A — Acente Bildirim Sistemi (Backend)
-- 1/3: agency_notification_settings — acente bildirim ayarları
-- ============================================================
-- Acente, Turzz'un merkezi numarasından "yeni rezervasyon" / "yeni talep" bildirimi alabilir.
-- Bu tablo acentenin bildirim numarası + aç-kapa tercihlerini tutar (1:1 acente↔ayar).
--
-- RLS pattern: complaints tablosundakiyle birebir (get_user_agency_id + super_admin bypass).

CREATE TABLE IF NOT EXISTS public.agency_notification_settings (
  agency_id              UUID        PRIMARY KEY REFERENCES public.agencies(id) ON DELETE CASCADE,
  phone                  TEXT,         -- E.164 tercih edilir (+90...). Validation app katmanı.
  enabled                BOOLEAN     NOT NULL DEFAULT FALSE,  -- Genel aç/kapa
  notify_new_reservation BOOLEAN     NOT NULL DEFAULT TRUE,
  notify_support         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.agency_notification_settings IS
  'Acente WhatsApp bildirim tercihleri. Turzz merkezi numarasından gönderilen ''agency_new_reservation'' / ''agency_new_support'' event''lerinin hedef numarası ve toggle''ları.';
COMMENT ON COLUMN public.agency_notification_settings.phone IS
  'E.164 formatı tercih edilir (ör. +905XXXXXXXXX). Validation app katmanında.';
COMMENT ON COLUMN public.agency_notification_settings.enabled IS
  'Genel aç/kapa. FALSE ise acente hiçbir bildirim almaz (event-bazlı toggle''lar override edilmez, fonksiyon erken döner).';

CREATE INDEX IF NOT EXISTS idx_ans_enabled ON public.agency_notification_settings(enabled) WHERE enabled = TRUE;

ALTER TABLE public.agency_notification_settings ENABLE ROW LEVEL SECURITY;

-- ─── RLS politikaları — complaints pattern'ine birebir ──────────────────────
DROP POLICY IF EXISTS "ans_agency_select" ON public.agency_notification_settings;
CREATE POLICY "ans_agency_select"
  ON public.agency_notification_settings
  FOR SELECT
  USING (
    agency_id = public.get_user_agency_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "ans_agency_insert" ON public.agency_notification_settings;
CREATE POLICY "ans_agency_insert"
  ON public.agency_notification_settings
  FOR INSERT
  WITH CHECK (
    agency_id = public.get_user_agency_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "ans_agency_update" ON public.agency_notification_settings;
CREATE POLICY "ans_agency_update"
  ON public.agency_notification_settings
  FOR UPDATE
  USING (
    agency_id = public.get_user_agency_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    agency_id = public.get_user_agency_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "ans_agency_delete" ON public.agency_notification_settings;
CREATE POLICY "ans_agency_delete"
  ON public.agency_notification_settings
  FOR DELETE
  USING (
    agency_id = public.get_user_agency_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- ─── updated_at trigger (mevcut helper'ı yeniden kullan) ────────────────────
DROP TRIGGER IF EXISTS update_agency_notification_settings_updated_at ON public.agency_notification_settings;
CREATE TRIGGER update_agency_notification_settings_updated_at
  BEFORE UPDATE ON public.agency_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
