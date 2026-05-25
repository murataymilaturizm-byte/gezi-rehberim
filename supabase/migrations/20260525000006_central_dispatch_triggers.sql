-- ============================================================
-- TURZZ MERKEZİ BİLDİRİM — PARÇA 2A (Backend)
-- 6/7: AFTER INSERT trigger'ları (registrations / agencies / contact_forms)
-- ============================================================
-- Mevcut trigger'lar KORUNUR:
--   - registrations: trigger_update_booking_stats (20251114123331)
--   - auth.users:   handle_new_user (handle_new_user_complete.sql)
-- Bu migration ek (yeni) trigger'lar ekler; mevcutları bozmaz.
--
-- TÜM TRIGGER'LAR SECURITY DEFINER + dış EXCEPTION WHEN OTHERS ile sarılıdır:
--   pg_net fail olsa, vault boş olsa, herhangi bir hata olsa bile INSERT geri ALINMAZ.

-- ────────────────────────────────────────────────────────────────────────────
-- 6.1 — registrations AFTER INSERT → 'new_reservation'
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._notify_new_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tour_name text;
  _tour_date date;
  _currency  text;
BEGIN
  BEGIN
    SELECT t.title, td.departure_date, t.currency
      INTO _tour_name, _tour_date, _currency
    FROM public.tours t
    LEFT JOIN public.tour_dates td ON td.id = NEW.tour_date_id
    WHERE t.id = NEW.tour_id;

    PERFORM public._dispatch_central_notification(
      'new_reservation',
      jsonb_build_object(
        'registration_id', NEW.id,
        'agency_id',       NEW.agency_id,
        'full_name',       NEW.full_name,
        'tour_name',       COALESCE(_tour_name, ''),
        'date',            COALESCE(_tour_date::text, ''),
        'pax',             NEW.pax,
        'total_amount',    NEW.total_amount,
        'currency',        COALESCE(_currency, 'TRY')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[_notify_new_reservation] swallowed error (id=%): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_reservation ON public.registrations;
CREATE TRIGGER trg_notify_new_reservation
  AFTER INSERT ON public.registrations
  FOR EACH ROW
  EXECUTE FUNCTION public._notify_new_reservation();

COMMENT ON TRIGGER trg_notify_new_reservation ON public.registrations IS
  'Turzz merkezi bildirim: yeni rezervasyon. Mevcut trigger_update_booking_stats ile birlikte çalışır.';

-- ────────────────────────────────────────────────────────────────────────────
-- 6.2 — agencies AFTER INSERT → 'new_agency_signup'
--    ZORUNLU FİLTRELER:
--      a) NEW.id <> TURZZ_CENTRAL_AGENCY_ID  (kendini tetiklemesin)
--      b) NEW.user_id IS NOT NULL            (placeholder/sistem kayıtları skip)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._notify_new_agency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Turzz sistem placeholder'ı (PARÇA 1'de eklenen) kendini tetiklemesin
  IF NEW.id = '11111111-1111-1111-1111-111111111111'::uuid THEN
    RETURN NEW;
  END IF;

  -- user_id NULL → sistem/placeholder kayıtları, gerçek acente değil
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public._dispatch_central_notification(
      'new_agency_signup',
      jsonb_build_object(
        'id',         NEW.id,
        'name',       NEW.name,
        'plan_type',  NEW.plan_type,
        'user_id',    NEW.user_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[_notify_new_agency] swallowed error (id=%): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_agency ON public.agencies;
CREATE TRIGGER trg_notify_new_agency
  AFTER INSERT ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public._notify_new_agency();

COMMENT ON TRIGGER trg_notify_new_agency ON public.agencies IS
  'Turzz merkezi bildirim: yeni acente kaydı. Filtre: id <> TURZZ_CENTRAL_AGENCY_ID ve user_id IS NOT NULL.';

-- ────────────────────────────────────────────────────────────────────────────
-- 6.3 — contact_forms AFTER INSERT → 'new_contact_form'
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._notify_new_contact_form()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public._dispatch_central_notification(
      'new_contact_form',
      jsonb_build_object(
        'id',      NEW.id,
        'name',    NEW.name,
        'email',   NEW.email,
        'message', NEW.message
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[_notify_new_contact_form] swallowed error (id=%): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_contact_form ON public.contact_forms;
CREATE TRIGGER trg_notify_new_contact_form
  AFTER INSERT ON public.contact_forms
  FOR EACH ROW
  EXECUTE FUNCTION public._notify_new_contact_form();

COMMENT ON TRIGGER trg_notify_new_contact_form ON public.contact_forms IS
  'Turzz merkezi bildirim: yeni iletişim talebi.';
