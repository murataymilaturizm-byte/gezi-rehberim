-- ============================================================
-- FAZ 2A — Acente Bildirim Sistemi (Backend)
-- 2/3: complaints AFTER INSERT → 'agency_new_support'
-- ============================================================
-- Faz 1 _notify_new_contact_form pattern'inin birebir kopyası.
-- complaints tablosu mevcut (20251125080314); INSERT 3 yerden geliyor:
--   - process-message.ts:285  → type='complaint' (NLU intent)
--   - process-message.ts:974  → type='after_sales_action' (post-tour talep)
--   - demo-chat/services/reservation.ts:97
-- Hepsi tablo üzerinden geçtiği için TEK trigger noktası yeterli.
--
-- Defansif: dış EXCEPTION WHEN OTHERS — pg_net/vault fail olsa bile complaints INSERT'i
-- ASLA geri alınmaz. Faz 1 pattern'i ile aynı.

CREATE OR REPLACE FUNCTION public._notify_agency_support()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public._dispatch_central_notification(
      'agency_new_support',
      jsonb_build_object(
        'complaint_id', NEW.id,
        'agency_id',    NEW.agency_id,
        'phone',        NEW.phone,        -- müşterinin telefonu (acente buradan dönüş yapar)
        'message',      NEW.message,
        'type',         NEW.type,         -- 'complaint' | 'feedback' | 'after_sales_action'
        'status',       NEW.status
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[_notify_agency_support] swallowed error (id=%): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_agency_support ON public.complaints;
CREATE TRIGGER trg_notify_agency_support
  AFTER INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public._notify_agency_support();

COMMENT ON TRIGGER trg_notify_agency_support ON public.complaints IS
  'Faz 2 acente bildirimi: yeni talep/şikayet. Dispatcher event_type=''agency_new_support'' alarak agency_notification_settings''ten hedef çözer.';
