-- ============================================================
-- TURZZ MERKEZİ BİLDİRİM — PARÇA 1 (Altyapı)
-- 4/4: template_send_log — super_admin SELECT politikası
-- ============================================================
-- Mevcut "Agency users can read own send log" politikası KORUNUR.
-- PostgreSQL permissive RLS politikaları OR'lanır → super_admin politikası eklemek
-- acentenin kendi-kaydı erişimini bozmaz, sadece super_admin için yeni erişim açar.

DROP POLICY IF EXISTS "template_send_log_super_admin_read" ON public.template_send_log;
CREATE POLICY "template_send_log_super_admin_read"
  ON public.template_send_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

COMMENT ON POLICY "template_send_log_super_admin_read" ON public.template_send_log IS
  'Super admin tüm gönderim kayıtlarını görür (merkezi bildirim dahil — TURZZ_CENTRAL_AGENCY_ID satırları). Acente kendi loglarını okuma politikası ayrıca aktif.';
