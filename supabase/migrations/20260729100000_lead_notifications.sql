-- P7-C (2026-07-29): Lead bildirim katmanı — spam-korumalı kesinleşme bildirimi.
-- ① notified_at: TEK bildirim garantisi (taslak→detay→kesinleşme akışında çift atmaz)
-- ② notify_new_lead: acente bildirim-tercihi (varsayılan AÇIK)
-- ③ sweep_stale_lead_drafts(): detay gelmeyen taslakları N dk sonra kesinleştirir+bildirir
ALTER TABLE public.agency_leads ADD COLUMN IF NOT EXISTS notified_at timestamptz;
ALTER TABLE public.agency_notification_settings ADD COLUMN IF NOT EXISTS notify_new_lead boolean NOT NULL DEFAULT true;

-- ③ SÜPÜRÜCÜ: taslak açıldı ama müşteri detay yazmadı → N dakika sonra mevcut metinle
-- kesinleşmiş sayılır ve TEK bildirim atılır. N=15 dk gerekçesi: WhatsApp'ta müşteri
-- tipik olarak 1-3 dk içinde yanıtlar; 15 dk "hâlâ yazıyor olabilir" toleransı bırakır
-- ama acenteyi geciktirmez (tur-hatırlatma/anket cron'ları günlük çalıştığından bu iş
-- onlara BİNEMEZ — 15 dk çözünürlük gerekiyor, bu yüzden AYRI cron).
CREATE OR REPLACE FUNCTION public.sweep_stale_lead_drafts(p_minutes integer DEFAULT 15)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN
    SELECT id, agency_id, request_text, phone
      FROM public.agency_leads
     WHERE notified_at IS NULL
       AND created_at < now() - make_interval(mins => p_minutes)
     ORDER BY created_at
     LIMIT 200
  LOOP
    BEGIN
      PERFORM public._dispatch_central_notification(
        'agency_new_lead',
        jsonb_build_object('agency_id', r.agency_id, 'lead_id', r.id,
                           'request_text', left(coalesce(r.request_text, ''), 80),
                           'phone', coalesce(r.phone, '-'))
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[sweep_stale_lead_drafts] dispatch failed (id=%): %', r.id, SQLERRM;
    END;
    UPDATE public.agency_leads SET notified_at = now() WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- pg_cron: 15 dakikada bir (job adı idempotent — varsa yeniden kurulur)
DO $$
BEGIN
  PERFORM cron.unschedule('lead-draft-sweeper');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('lead-draft-sweeper', '*/15 * * * *', $$SELECT public.sweep_stale_lead_drafts(15);$$);
