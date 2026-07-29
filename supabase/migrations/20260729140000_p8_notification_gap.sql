-- ═══════════════════════════════════════════════════════════════════════════
-- P8 (2026-07-29): Bildirim-deliği kapatma
--
-- P8-0  admin_notifications + registrations → supabase_realtime publication.
--       KÖK: NotificationCenter iki realtime kanalı açıyor (notif-table-*,
--       notif-reg-*) ama HİÇBİRİ ateşlenmiyordu — tablolar publication'da
--       değildi. Sonuç: zil yalnız sayfa YENİLENİNCE güncelleniyordu; açık
--       panelde yeni lead/rezervasyon canlı düşmüyordu. Murat'ın vakası bu.
--
-- P8-1  agencies INSERT → agency_notification_settings satırı otomatik açılsın
--       + mevcut ayarsız acentelere backfill.
--       BİLİNÇLİ: enabled=false + phone=NULL. Telefon TAHMİN EDİLMEZ —
--       whatsapp_phone_number acentenin KENDİ bot numarası (bildirimi kendine
--       gönderirdi), phone_public ise bir gösterim alanı ve 2 acentede boş.
--       Satırın tek işlevi P8-2 uyarı-kartının kancası olmak.
--
-- P8-1b phone_public / whatsapp_phone_number baştaki sekme+boşluk temizliği.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── P8-0: realtime publication ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'admin_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'registrations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.registrations;
  END IF;
END $$;

-- INSERT payload'ının dolu gelmesi için (admin_notifications zaten FULL).
ALTER TABLE public.registrations REPLICA IDENTITY FULL;

-- ─── P8-1: ayar-satırı otomatiği ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._seed_agency_notification_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.agency_notification_settings (agency_id, phone, enabled)
  VALUES (NEW.id, NULL, false)
  ON CONFLICT (agency_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Acente kaydı ASLA bildirim-ayarı yüzünden düşmesin.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public._seed_agency_notification_settings() IS
  'P8-1: her yeni acenteye kapalı (enabled=false, phone=NULL) bildirim-ayarı satırı açar. Telefon tahmin edilmez; panel uyarı-kartı acenteyi numara girmeye yönlendirir.';

DROP TRIGGER IF EXISTS trg_seed_agency_notification_settings ON public.agencies;
CREATE TRIGGER trg_seed_agency_notification_settings
  AFTER INSERT ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public._seed_agency_notification_settings();

-- Backfill: satırı olmayan TÜM acenteler (pasifler dahil — ileride aktifleşirse hazır).
INSERT INTO public.agency_notification_settings (agency_id, phone, enabled)
SELECT a.id, NULL, false
FROM public.agencies a
LEFT JOIN public.agency_notification_settings s ON s.agency_id = a.id
WHERE s.agency_id IS NULL
ON CONFLICT (agency_id) DO NOTHING;

-- ─── P8-1b: baştaki/sondaki sekme-boşluk temizliği ─────────────────────────
UPDATE public.agencies
SET phone_public = btrim(phone_public, E' \t\r\n')
WHERE phone_public IS NOT NULL AND phone_public <> btrim(phone_public, E' \t\r\n');

UPDATE public.agencies
SET whatsapp_phone_number = btrim(whatsapp_phone_number, E' \t\r\n')
WHERE whatsapp_phone_number IS NOT NULL
  AND whatsapp_phone_number <> btrim(whatsapp_phone_number, E' \t\r\n');
