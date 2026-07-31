-- ═══════════════════════════════════════════════════════════════════════════
-- F-D3-1 (2026-07-31): agencies → supabase_realtime publication
--
-- Denetim (D3-c) bulgusu: Admin.tsx:460 `agencies` UPDATE'e abone (WhatsApp
-- bağlantı-durumu rozeti) ama tablo publication'da DEĞİLDİ → kanal hiç
-- ateşlenmiyor, rozet ancak sayfa yenilenince güncelleniyordu.
-- P8-0'da admin_notifications + registrations eklenirken bu üçüncüsü atlanmıştı;
-- aynı desen, aynı idempotent kurgu.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'agencies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agencies;
  END IF;
END $$;

-- UPDATE payload'ında meta_access_token/meta_phone_number_id/whatsapp_status
-- alanlarının dolu gelmesi için (Admin.tsx bu üçünü okuyor).
ALTER TABLE public.agencies REPLICA IDENTITY FULL;
