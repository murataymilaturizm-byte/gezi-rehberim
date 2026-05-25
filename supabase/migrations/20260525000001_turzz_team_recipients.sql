-- ============================================================
-- TURZZ MERKEZİ BİLDİRİM — PARÇA 1 (Altyapı)
-- 1/4: turzz_team_recipients — Turzz ekibi WhatsApp bildirim alıcıları
-- ============================================================
-- İdempotent: IF NOT EXISTS + DROP/CREATE POLICY pattern.
-- Mevcut RLS/trigger/fonksiyonlar etkilenmez — sadece YENİ tablo + politika.

CREATE TABLE IF NOT EXISTS public.turzz_team_recipients (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone              TEXT        NOT NULL,
  name               TEXT,
  active             BOOLEAN     NOT NULL DEFAULT TRUE,
  notification_types TEXT[]      NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.turzz_team_recipients IS
  'Turzz ekibi WhatsApp bildirim alıcıları. Merkezi WABA''dan gelen sistem bildirimleri (yeni acente kaydı / yeni iletişim talebi / yeni rezervasyon) buraya gider.';
COMMENT ON COLUMN public.turzz_team_recipients.phone IS
  'E.164 formatı tercih edilir (ör. +905XXXXXXXXX, +491XXXXXXXX). Validation app katmanında — DB''de katı constraint yok ki ileride uluslararası formatlara esnek kalalım.';
COMMENT ON COLUMN public.turzz_team_recipients.notification_types IS
  'Hangi olay tipleri alınır: ''new_agency_signup'', ''new_contact_form'', ''new_reservation''. Bir kişi birden fazla tip alabilir.';
COMMENT ON COLUMN public.turzz_team_recipients.active IS
  'FALSE ise bu kişi hiçbir bildirim almaz (geçici devre dışı bırakma için).';

-- Aktif alıcıları olay tipine göre hızlı filtrelemek için GIN index
CREATE INDEX IF NOT EXISTS idx_turzz_team_recipients_active_types
  ON public.turzz_team_recipients USING GIN (notification_types)
  WHERE active = TRUE;

ALTER TABLE public.turzz_team_recipients ENABLE ROW LEVEL SECURITY;

-- RLS: SADECE super_admin tam erişim
DROP POLICY IF EXISTS "turzz_team_recipients_super_admin_all" ON public.turzz_team_recipients;
CREATE POLICY "turzz_team_recipients_super_admin_all"
  ON public.turzz_team_recipients
  FOR ALL
  TO authenticated
  USING      (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

COMMENT ON POLICY "turzz_team_recipients_super_admin_all" ON public.turzz_team_recipients IS
  'Yalnızca super_admin SELECT/INSERT/UPDATE/DELETE yapabilir. service_role (edge function) RLS bypass ile gönderim sırasında okur.';
