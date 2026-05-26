-- ============================================================
-- FAZ 2A — Acente Bildirim Sistemi (Backend)
-- 3/3: _notify_new_reservation — Turzz event'inin yanına acente event'i ekle
-- ============================================================
-- Mevcut Faz 1 trigger (trg_notify_new_reservation) AYNEN kalır — yalnızca arkasındaki
-- function CREATE OR REPLACE ile güncellenir. Trigger'a dokunmaya gerek yok (function
-- ismi aynı, signature aynı).
--
-- Davranış değişikliği:
--   ÖNCE: 1 PERFORM → 'new_reservation' (Turzz ekibi)
--   SONRA: 2 PERFORM → 'new_reservation' (Turzz ekibi) + 'agency_new_reservation' (acente)
--
-- Aynı payload iki event'e gider; dispatcher event_type prefix'ine göre hedefi ayırır:
--   - 'new_reservation'        → turzz_team_recipients (Faz 1, log agency_id=TURZZ_CENTRAL)
--   - 'agency_new_reservation' → agency_notification_settings (Faz 2, log agency_id=NEW.agency_id)
--
-- İkinci PERFORM da kendi BEGIN/EXCEPTION bloğuyla sarılı — biri fail olsa diğeri etkilenmez,
-- her halükarda registrations INSERT'i bozulmaz.

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
  _payload   jsonb;
BEGIN
  -- Tek JOIN — iki dispatch çağrısı için aynı payload kullanılır.
  BEGIN
    SELECT t.title, td.departure_date, t.currency
      INTO _tour_name, _tour_date, _currency
    FROM public.tours t
    LEFT JOIN public.tour_dates td ON td.id = NEW.tour_date_id
    WHERE t.id = NEW.tour_id;

    _payload := jsonb_build_object(
      'registration_id', NEW.id,
      'agency_id',       NEW.agency_id,
      'full_name',       NEW.full_name,
      'tour_name',       COALESCE(_tour_name, ''),
      'date',            COALESCE(_tour_date::text, ''),
      'pax',             NEW.pax,
      'total_amount',    NEW.total_amount,
      'currency',        COALESCE(_currency, 'TRY')
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[_notify_new_reservation] payload build failed (id=%): %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  -- 1) Turzz ekibi (Faz 1)
  BEGIN
    PERFORM public._dispatch_central_notification('new_reservation', _payload);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[_notify_new_reservation/team] swallowed error (id=%): %', NEW.id, SQLERRM;
  END;

  -- 2) Acente (Faz 2)
  BEGIN
    PERFORM public._dispatch_central_notification('agency_new_reservation', _payload);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[_notify_new_reservation/agency] swallowed error (id=%): %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Trigger'a dokunmuyoruz; mevcut trg_notify_new_reservation function adı üzerinden
-- otomatik olarak yeni versiyonu çağırır. (DROP/CREATE TRIGGER yok.)

COMMENT ON FUNCTION public._notify_new_reservation() IS
  'Faz 1+2: rezervasyon INSERT''inde iki paralel dispatch — Turzz ekibi (new_reservation) ve acente (agency_new_reservation). Her biri kendi BEGIN/EXCEPTION ile izole.';
