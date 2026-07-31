-- ═══════════════════════════════════════════════════════════════════════════
-- GÜNLÜK KONUŞMA-KARNESİ (2026-07-31)
-- W1–W4 sınıfı delikleri gece nöbeti yerine sistemin kendisi yakalasın.
-- Kaynak: whatsapp_conversations (yeni logging YOK).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.conversation_daily_report (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL,
  agency_id   uuid REFERENCES public.agencies(id) ON DELETE CASCADE,
  phone       text,
  category    text NOT NULL CHECK (category IN ('escape', 'repeat', 'abandoned')),
  snippet     text,                       -- karneyi okurken teşhis eden satır
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.conversation_daily_report IS
  'Günlük konuşma-karnesi bulguları. escape=bot kaçış cümlesi kurdu (meşru yönlendirmeler hariç), repeat=müşteri aynı soruyu tekrarladı (>=0.8 benzerlik), abandoned=akış COMPLETED''a ulaşmadan >2s sessiz kaldı.';

CREATE INDEX IF NOT EXISTS idx_cdr_date     ON public.conversation_daily_report (report_date DESC);
CREATE INDEX IF NOT EXISTS idx_cdr_category ON public.conversation_daily_report (category, report_date DESC);

ALTER TABLE public.conversation_daily_report ENABLE ROW LEVEL SECURITY;

-- Yalnız süper-admin okur. Yazım service_role ile (edge fonksiyonu) — RLS'i atlar.
DROP POLICY IF EXISTS "Super admin reads conversation report" ON public.conversation_daily_report;
CREATE POLICY "Super admin reads conversation report"
  ON public.conversation_daily_report
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- ─── Günlük özet satırının GÖRÜNÜRLÜĞÜ ────────────────────────────────────
-- Karne özeti admin_notifications'a merkezi acente (11111111…) altına yazılıyor.
-- O acentenin user_id'si NULL → mevcut "kendi acenteni oku" policy'si ile HİÇ
-- KİMSE göremezdi. Süper-admin okuma policy'si bu yüzden şart.
DROP POLICY IF EXISTS "Super admin reads all notifications" ON public.admin_notifications;
CREATE POLICY "Super admin reads all notifications"
  ON public.admin_notifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- ─── Cron: her gece 03:00 UTC ─────────────────────────────────────────────
-- Mevcut job'lara BİNMEZ: tour-reminder 09:00, feedback-survey 12:00,
-- lead-draft-sweeper */15. 03:00 seçildi çünkü gece trafiği bitmiş olur ve
-- karne "dünün tamamını" görür.
DO $$
DECLARE
  _url  text := 'https://yaxjygtjtjmzslajuctk.supabase.co/functions/v1/conversation-daily-report';
  _sec  text;
  _anon text;
BEGIN
  -- Kimlik bilgilerini MEVCUT bir job'dan devral (vault/secret kopyalamak yok).
  SELECT (regexp_match(command, '''X-Internal-Secret'', ''([^'']+)'''))[1],
         (regexp_match(command, 'Bearer ([A-Za-z0-9._-]+)'))[1]
    INTO _sec, _anon
  FROM cron.job WHERE jobname = 'feedback-survey-daily' LIMIT 1;

  IF _sec IS NULL OR _anon IS NULL THEN
    RAISE NOTICE 'conversation-daily-report cron KURULMADI — kimlik devralınamadı';
    RETURN;
  END IF;

  PERFORM cron.unschedule('conversation-daily-report')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'conversation-daily-report');

  PERFORM cron.schedule(
    'conversation-daily-report',
    '0 3 * * *',
    format(
      $cmd$SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','X-Internal-Secret',%L,'Authorization',%L),
        body := '{}'::jsonb
      );$cmd$,
      _url, _sec, 'Bearer ' || _anon
    )
  );
END $$;
