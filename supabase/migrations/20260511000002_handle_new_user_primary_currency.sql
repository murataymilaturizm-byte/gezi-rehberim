-- handle_new_user trigger'ını signup metadata'dan primary_currency okuyacak şekilde güncelle.
-- Mevcut trigger yalnızca profiles'a INSERT yapıyordu.
-- Bu migration, agency kaydı oluşturan trigger'a primary_currency desteği ekler.
-- NOT: Eğer DB'de farklı bir handle_new_user versiyonu mevcutsa bu CREATE OR REPLACE
--      onu tamamen geçersiz kılar. Supabase Dashboard'dan trigger'ı doğrulayın.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _agency_currency TEXT;
BEGIN
  -- Profile oluştur (mevcut davranış korunuyor)
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;

  -- agency_currency metadata'dan oku, varsayılan TRY
  _agency_currency := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'agency_currency'), ''),
    'TRY'
  );

  -- Agency'yi oluştur (zaten var ise atla)
  INSERT INTO public.agencies (
    user_id,
    name,
    city,
    region,
    language_preference,
    plan_type,
    subscription_status,
    trial_ends_at,
    primary_currency,
    twilio_account_sid,
    twilio_auth_token
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'agency_name'), ''), 'Yeni Acente'),
    COALESCE(NEW.raw_user_meta_data->>'agency_city', ''),
    NEW.raw_user_meta_data->>'agency_region',
    COALESCE(NEW.raw_user_meta_data->>'agency_lang', 'tr'),
    COALESCE(NEW.raw_user_meta_data->>'agency_plan', 'starter'),
    'trial',
    COALESCE(
      (NEW.raw_user_meta_data->>'agency_trial_ends')::timestamptz,
      NOW() + INTERVAL '14 days'
    ),
    _agency_currency,
    'TEMP_SID',
    'TEMP_TOKEN'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET primary_currency = EXCLUDED.primary_currency
    WHERE agencies.primary_currency IS NULL OR agencies.primary_currency = 'TRY';

  RETURN NEW;
END;
$$;
