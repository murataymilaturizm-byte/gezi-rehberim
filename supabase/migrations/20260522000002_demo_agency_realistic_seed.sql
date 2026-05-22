-- Demo agency (00000000-0000-0000-0000-000000000000) için gerçekçi seed verisi.
-- Test senaryolarının (T1 ödeme bilgisi, T5 adres, T-DİL çok dilli tur)
-- gerçek müşteri deneyimini yansıtması için.
-- SADECE demo agency'yi etkiler — gerçek acenteler dokunulmaz.

UPDATE public.agencies
SET
  address          = COALESCE(NULLIF(address, ''),          'Demo Mah. Test Cad. No:1, Kapadokya / Nevşehir'),
  phone_public     = COALESCE(NULLIF(phone_public, ''),     '+90 384 000 00 00'),
  website_url      = COALESCE(NULLIF(website_url, ''),      'https://demo.turzzai.com'),
  maps_url         = COALESCE(NULLIF(maps_url, ''),         'https://maps.google.com/?q=Kapadokya'),
  cancellation_policy = COALESCE(
    NULLIF(cancellation_policy, ''),
    'Tur tarihinden 7 gün önceye kadar tam iade. 3-7 gün arası %50 iade. 3 günden az: iade yok.'
  ),
  working_hours = COALESCE(
    working_hours,
    '{"monday":{"enabled":true,"open":"09:00","close":"19:00"},"tuesday":{"enabled":true,"open":"09:00","close":"19:00"},"wednesday":{"enabled":true,"open":"09:00","close":"19:00"},"thursday":{"enabled":true,"open":"09:00","close":"19:00"},"friday":{"enabled":true,"open":"09:00","close":"19:00"},"saturday":{"enabled":true,"open":"10:00","close":"18:00"},"sunday":{"enabled":false,"open":"","close":""}}'::jsonb
  ),
  payment_instructions = COALESCE(
    payment_instructions,
    jsonb_build_object(
      'payment_type',        'deposit',
      'deposit_percentage',  30,
      'payment_methods',     jsonb_build_array('bank_transfer', 'credit_card', 'cash'),
      'bank_name',           'Demo Bank',
      'iban',                'TR00 0000 0000 0000 0000 0000 00',
      'account_holder',      'Demo Acente Tur Operatörü',
      'currency',            'TRY',
      'text',                'Lütfen %30 kapora tutarını aşağıdaki hesaba aktarın. Dekont WhatsApp''tan paylaşılabilir.'
    )
  ),
  primary_currency = COALESCE(NULLIF(primary_currency, ''), 'TRY'),
  collect_email    = COALESCE(collect_email, true)
WHERE id = '00000000-0000-0000-0000-000000000000';

-- Demo turlarının çok dilli başlıklarını doldur (BUG #2 testleri gerçekçi olsun).
-- Sadece DEMO agency'nin turları — diğerleri dokunulmaz.
-- NULL ise doldurur, dolu ise üzerine yazmaz.
UPDATE public.tours
SET
  title_en = CASE
    WHEN title_en IS NOT NULL AND title_en <> '' THEN title_en
    WHEN title ILIKE '%kapadokya%'   THEN replace(title, 'Kapadokya', 'Cappadocia')
    WHEN title ILIKE '%pamukkale%'   THEN title
    WHEN title ILIKE '%efes%'        THEN replace(title, 'Efes', 'Ephesus')
    WHEN title ILIKE '%istanbul%'    THEN title
    WHEN title ILIKE '%antalya%'     THEN title
    WHEN title ILIKE '%bodrum%'      THEN title
    WHEN title ILIKE '%troya%'       THEN replace(title, 'Troya', 'Troy')
    WHEN title ILIKE '%fethiye%'     THEN title
    WHEN title ILIKE '%nemrut%'      THEN replace(title, 'Nemrut', 'Mount Nemrut')
    ELSE title
  END,
  title_de = CASE
    WHEN title_de IS NOT NULL AND title_de <> '' THEN title_de
    WHEN title ILIKE '%kapadokya%'   THEN replace(title, 'Kapadokya', 'Kappadokien')
    WHEN title ILIKE '%efes%'        THEN replace(title, 'Efes', 'Ephesos')
    WHEN title ILIKE '%troya%'       THEN replace(title, 'Troya', 'Troja')
    ELSE title
  END,
  title_ru = CASE
    WHEN title_ru IS NOT NULL AND title_ru <> '' THEN title_ru
    WHEN title ILIKE '%kapadokya%'   THEN replace(title, 'Kapadokya', 'Каппадокия')
    WHEN title ILIKE '%efes%'        THEN replace(title, 'Efes', 'Эфес')
    WHEN title ILIKE '%istanbul%'    THEN replace(title, 'İstanbul', 'Стамбул')
    ELSE title
  END,
  title_ar = CASE
    WHEN title_ar IS NOT NULL AND title_ar <> '' THEN title_ar
    WHEN title ILIKE '%kapadokya%'   THEN replace(title, 'Kapadokya', 'كابادوكيا')
    WHEN title ILIKE '%efes%'        THEN replace(title, 'Efes', 'أفسس')
    WHEN title ILIKE '%istanbul%'    THEN replace(title, 'İstanbul', 'إسطنبول')
    ELSE title
  END,
  title_fr = CASE
    WHEN title_fr IS NOT NULL AND title_fr <> '' THEN title_fr
    WHEN title ILIKE '%kapadokya%'   THEN replace(title, 'Kapadokya', 'Cappadoce')
    WHEN title ILIKE '%efes%'        THEN replace(title, 'Efes', 'Éphèse')
    WHEN title ILIKE '%troya%'       THEN replace(title, 'Troya', 'Troie')
    ELSE title
  END,
  title_es = CASE
    WHEN title_es IS NOT NULL AND title_es <> '' THEN title_es
    WHEN title ILIKE '%kapadokya%'   THEN replace(title, 'Kapadokya', 'Capadocia')
    WHEN title ILIKE '%efes%'        THEN replace(title, 'Efes', 'Éfeso')
    ELSE title
  END
WHERE agency_id = '00000000-0000-0000-0000-000000000000';

COMMENT ON COLUMN public.agencies.id IS
  'Demo agency 00000000-0000-0000-0000-000000000000 — testler için gerçekçi seed (20260522000002 migration).';
