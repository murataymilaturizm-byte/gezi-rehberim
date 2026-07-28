-- P6-FIX (2026-07-28): CRM otomatik-etiketleme vaadinin TAMİRİ (yeni özellik değil).
--
-- KÖK-BULGU (canlı): whatsapp_user_profiles.phone İş1 (2026-07-23, 6fc61e3) ile E.164
-- kanonik forma normalize edildi ("905416500303") ama registrations.phone ham formatta
-- kaldı ("05416500303" / "0541 650 03 03"). sync_user_booking_stats TAM-STRING
-- eşleştirdiğinden (WHERE phone = v_phone) o tarihten beri SESSİZCE 0 satır güncelliyor.
-- Kanıt: tüm DB'de tam-eşleşme=0, format-farkı=3 → total_bookings/total_spent donmuş →
-- VIP/regular/potential otomatik-etiketleri de yanlış (trigger o iki kolona bağlı).
--
-- 1) KÖK FIX: eşleşme normalize_phone() ile (RPC'nin duplicate-guard'ındaki emsalin aynısı).
-- 2) BACKFILL: mevcut profillerin sayaçları registrations'tan yeniden hesaplanır (idempotent).
--    Elle girilmiş full_name'ler KORUNUR; yalnız BOŞ olanlar doldurulur.

-- ─── 1) KÖK: normalize-farkında sayaç trigger'ı ──────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_user_booking_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_was_confirmed boolean := false;
  v_is_confirmed  boolean := false;
  v_phone         text;
  v_agency_id     uuid;
  v_pax           integer;
  v_price         numeric;
  v_delta_count   integer := 0;
  v_delta_spent   numeric := 0;
BEGIN
  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
    v_was_confirmed := (OLD.status = 'CONFIRMED');
  END IF;
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    v_is_confirmed := (NEW.status = 'CONFIRMED');
  END IF;

  IF v_was_confirmed = v_is_confirmed THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_is_confirmed AND NOT v_was_confirmed THEN
    v_phone := NEW.phone; v_agency_id := NEW.agency_id;
    v_pax := COALESCE(NEW.pax, 1); v_delta_count := 1;
  ELSIF v_was_confirmed AND NOT v_is_confirmed THEN
    v_phone := OLD.phone; v_agency_id := OLD.agency_id;
    v_pax := COALESCE(OLD.pax, 1); v_delta_count := -1;
  END IF;

  SELECT COALESCE(td.price_adult, 0) * v_pax INTO v_price
  FROM public.tour_dates td
  WHERE td.id = COALESCE(NEW.tour_date_id, OLD.tour_date_id);

  v_delta_spent := COALESCE(v_price, 0) * v_delta_count;

  -- P6-FIX: TAM-STRING yerine normalize_phone eşleşmesi (kanonik profil ↔ ham kayıt).
  -- Profil YOKSA 0 satır (sessiz, güvenli) — UPDATE-only: starter planında profil
  -- satırı hiç oluşmadığından ücretli CRM özelliği sızmaz.
  UPDATE public.whatsapp_user_profiles
  SET total_bookings = GREATEST(0, COALESCE(total_bookings, 0) + v_delta_count),
      total_spent    = GREATEST(0, COALESCE(total_spent, 0) + v_delta_spent)
  WHERE normalize_phone(phone) = normalize_phone(v_phone)
    AND agency_id = v_agency_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- ─── 2) BACKFILL (idempotent — yeniden koşulabilir) ─────────────────────────
-- total_bookings/total_spent CONFIRMED kayıtlardan yeniden hesaplanır.
-- UPDATE OF total_bookings/total_spent → trigger_update_customer_tags (BEFORE UPDATE)
-- otomatik ateşlenir → vip/regular/potential etiketleri de bu adımda düzelir.
WITH stats AS (
  SELECT p.id AS profile_id,
         COUNT(r.id)::int AS cnt,
         COALESCE(SUM(COALESCE(td.price_adult, 0) * COALESCE(r.pax, 1)), 0) AS spent
  FROM public.whatsapp_user_profiles p
  LEFT JOIN public.registrations r
         ON r.agency_id = p.agency_id
        AND normalize_phone(r.phone) = normalize_phone(p.phone)
        AND r.status = 'CONFIRMED'
  LEFT JOIN public.tour_dates td ON td.id = r.tour_date_id
  GROUP BY p.id
)
UPDATE public.whatsapp_user_profiles p
   SET total_bookings = s.cnt,
       total_spent    = s.spent
  FROM stats s
 WHERE p.id = s.profile_id
   AND (COALESCE(p.total_bookings, 0) <> s.cnt OR COALESCE(p.total_spent, 0) <> s.spent);

-- Boş full_name'leri en güncel CONFIRMED/NEW kayıttan doldur (elle girilmiş olan EZİLMEZ).
WITH names AS (
  SELECT DISTINCT ON (p.id) p.id AS profile_id, r.full_name
  FROM public.whatsapp_user_profiles p
  JOIN public.registrations r
    ON r.agency_id = p.agency_id
   AND normalize_phone(r.phone) = normalize_phone(p.phone)
  WHERE COALESCE(NULLIF(TRIM(p.full_name), ''), NULL) IS NULL
    AND COALESCE(NULLIF(TRIM(r.full_name), ''), NULL) IS NOT NULL
  ORDER BY p.id, r.created_at DESC
)
UPDATE public.whatsapp_user_profiles p
   SET full_name = n.full_name
  FROM names n
 WHERE p.id = n.profile_id;
