-- handle_new_user trigger TAMAMLAMA
-- Eksik alanlar: message_limit (plan_features'tan), enabled_languages (kayıt dilinden),
-- user_roles INSERT (eğer sistem kullanıyorsa).
-- Mevcut çalışan alanlar (primary_currency, plan_type, trial_ends_at) AYNEN korunuyor.
--
-- ÖNEMLİ: SECURITY DEFINER trigger — user_roles ekleme bu trigger ile yapılır,
-- ama RLS bypass yapması istenmeyen durumlar için role 'agency' hardcoded.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _agency_currency  TEXT;
  _agency_lang      TEXT;
  _agency_plan      TEXT;
  _plan_msg_limit   INTEGER;
BEGIN
  -- Profile (mevcut davranış)
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;

  _agency_currency := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'agency_currency'), ''), 'TRY');
  _agency_lang     := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'agency_lang'), ''), 'tr');
  _agency_plan     := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'agency_plan'), ''), 'starter');

  -- Plan'a göre message_limit'i plan_features'tan çek
  SELECT message_limit INTO _plan_msg_limit
  FROM public.plan_features
  WHERE plan_type = _agency_plan
  LIMIT 1;

  -- plan_features'ta plan yoksa makul default (starter limiti)
  IF _plan_msg_limit IS NULL THEN
    _plan_msg_limit := 1000;
  END IF;

  -- Agency (eksik alanlar EKLENDI: message_limit + enabled_languages)
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
    twilio_auth_token,
    -- YENİ EKSİKLER:
    message_limit,
    monthly_message_count,
    enabled_languages
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'agency_name'), ''), 'Yeni Acente'),
    COALESCE(NEW.raw_user_meta_data->>'agency_city', ''),
    NEW.raw_user_meta_data->>'agency_region',
    _agency_lang,
    _agency_plan,
    'trial',
    COALESCE(
      (NEW.raw_user_meta_data->>'agency_trial_ends')::timestamptz,
      NOW() + INTERVAL '14 days'
    ),
    _agency_currency,
    'TEMP_SID',
    'TEMP_TOKEN',
    _plan_msg_limit,                    -- YENİ
    0,                                  -- YENİ: monthly_message_count başlangıç
    ARRAY[_agency_lang]                 -- YENİ: en az kayıt dilinde aktif
  )
  ON CONFLICT (user_id) DO UPDATE
    SET primary_currency = COALESCE(EXCLUDED.primary_currency, agencies.primary_currency)
    WHERE agencies.primary_currency IS NULL OR agencies.primary_currency = 'TRY';

  -- user_roles: yeni kullanıcıya 'agency' rolü
  -- ON CONFLICT — daha önce eklenmişse atla, hata vermez.
  -- Tablo veya enum yoksa exception yakala (hata trigger'ı patlatmasın).
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'agency'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE '[handle_new_user] user_roles tablosu yok — atlandı';
    WHEN undefined_object THEN
      RAISE NOTICE '[handle_new_user] app_role enum yok — atlandı';
    WHEN OTHERS THEN
      RAISE NOTICE '[handle_new_user] user_roles INSERT atlandı: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;


-- DÜZELTİCİ UPDATE: mevcut NULL message_limit / boş enabled_languages acenteleri tamir et
-- (yalnızca eksik kayıtları doldurur; dolu olanlar dokunulmaz).
UPDATE public.agencies a
SET
  message_limit = COALESCE(
    a.message_limit,
    (SELECT pf.message_limit FROM public.plan_features pf WHERE pf.plan_type = a.plan_type LIMIT 1),
    1000
  ),
  enabled_languages = CASE
    WHEN a.enabled_languages IS NULL OR array_length(a.enabled_languages, 1) IS NULL
      THEN ARRAY[COALESCE(a.language_preference, 'tr')]
    ELSE a.enabled_languages
  END,
  monthly_message_count = COALESCE(a.monthly_message_count, 0)
WHERE
  a.message_limit IS NULL
  OR a.enabled_languages IS NULL
  OR array_length(a.enabled_languages, 1) IS NULL
  OR a.monthly_message_count IS NULL;


-- Mevcut acentelere user_roles 'agency' default ekle (eksikse)
-- super_admin'leri etkilemez (zaten rolü var).
INSERT INTO public.user_roles (user_id, role)
SELECT a.user_id, 'agency'::app_role
FROM public.agencies a
WHERE a.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = a.user_id
  )
ON CONFLICT (user_id, role) DO NOTHING;
