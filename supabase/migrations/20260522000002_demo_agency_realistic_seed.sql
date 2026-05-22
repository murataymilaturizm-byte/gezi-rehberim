-- Demo agency (00000000-0000-0000-0000-000000000000) için gerçekçi seed verisi.
-- Test senaryolarının (T1 ödeme bilgisi, T5 adres, T-DİL çok dilli tur)
-- gerçek müşteri deneyimini yansıtması için.
-- SADECE demo agency'yi etkiler — gerçek acenteler dokunulmaz.
--
-- TİPLER (önceki hata düzeltildi):
--   TEXT  : address, phone_public, website_url, working_hours (JSON string!),
--           maps_url, cancellation_policy, primary_currency, title_en/de/ru/ar/fr/es
--   JSONB : payment_instructions
--   BOOL  : collect_email
--
-- COALESCE pattern:
--   TEXT : COALESCE(NULLIF(col, ''), 'default')
--   JSONB: COALESCE(col, jsonb_build_object(...))   ← NULLIF'siz, jsonb cast'siz

UPDATE public.agencies
SET
  address = COALESCE(
    NULLIF(address, ''),
    'Demo Mah. Test Cad. No:1, Kapadokya / Nevşehir'
  ),
  phone_public = COALESCE(
    NULLIF(phone_public, ''),
    '+90 384 000 00 00'
  ),
  website_url = COALESCE(
    NULLIF(website_url, ''),
    'https://demo.turzzai.com'
  ),
  maps_url = COALESCE(
    NULLIF(maps_url, ''),
    'https://maps.google.com/?q=Kapadokya'
  ),
  cancellation_policy = COALESCE(
    NULLIF(cancellation_policy, ''),
    'Tur tarihinden 7 gün önceye kadar tam iade. 3-7 gün arası %50 iade. 3 günden az: iade yok.'
  ),
  -- working_hours TEXT kolonu — JSON string olarak saklanır (formatWorkingHours JSON.parse eder)
  working_hours = COALESCE(
    NULLIF(working_hours, ''),
    '{"monday":{"enabled":true,"open":"09:00","close":"19:00"},"tuesday":{"enabled":true,"open":"09:00","close":"19:00"},"wednesday":{"enabled":true,"open":"09:00","close":"19:00"},"thursday":{"enabled":true,"open":"09:00","close":"19:00"},"friday":{"enabled":true,"open":"09:00","close":"19:00"},"saturday":{"enabled":true,"open":"10:00","close":"18:00"},"sunday":{"enabled":false,"open":"","close":""}}'
  ),
  -- payment_instructions JSONB kolonu — jsonb_build_object zaten JSONB döner, cast gereksiz
  payment_instructions = COALESCE(
    payment_instructions,
    jsonb_build_object(
      'payment_type',       'deposit',
      'deposit_percentage', 30,
      'payment_methods',    jsonb_build_array('bank_transfer', 'credit_card', 'cash'),
      'bank_name',          'Demo Bank',
      'iban',               'TR00 0000 0000 0000 0000 0000 00',
      'account_holder',     'Demo Acente Tur Operatörü',
      'currency',           'TRY',
      'text',               'Lütfen %30 kapora tutarını aşağıdaki hesaba aktarın. Dekont WhatsApp''tan paylaşılabilir.'
    )
  ),
  primary_currency = COALESCE(NULLIF(primary_currency, ''), 'TRY'),
  collect_email = COALESCE(collect_email, true)
WHERE id = '00000000-0000-0000-0000-000000000000';


-- Demo turlarının çok dilli başlıklarını doldur (BUG #2 testleri gerçekçi olsun).
-- Tüm title_xx kolonları TEXT — basit COALESCE + replace pattern.
-- Sadece NULL/boş ise doldurur, mevcut çevirileri korur.
UPDATE public.tours
SET
  title_en = CASE
    WHEN title_en IS NOT NULL AND title_en <> '' THEN title_en
    WHEN title ILIKE '%kapadokya%' THEN replace(replace(title, 'Kapadokya', 'Cappadocia'), 'kapadokya', 'cappadocia')
    WHEN title ILIKE '%efes%'      THEN replace(replace(title, 'Efes', 'Ephesus'), 'efes', 'ephesus')
    WHEN title ILIKE '%troya%'     THEN replace(replace(title, 'Troya', 'Troy'), 'troya', 'troy')
    WHEN title ILIKE '%nemrut%'    THEN replace(title, 'Nemrut', 'Mount Nemrut')
    WHEN title ILIKE '%pamukkale%' THEN title
    WHEN title ILIKE '%istanbul%'  THEN title
    WHEN title ILIKE '%antalya%'   THEN title
    WHEN title ILIKE '%bodrum%'    THEN title
    WHEN title ILIKE '%fethiye%'   THEN title
    ELSE title
  END,
  title_de = CASE
    WHEN title_de IS NOT NULL AND title_de <> '' THEN title_de
    WHEN title ILIKE '%kapadokya%' THEN replace(replace(title, 'Kapadokya', 'Kappadokien'), 'kapadokya', 'kappadokien')
    WHEN title ILIKE '%efes%'      THEN replace(replace(title, 'Efes', 'Ephesos'), 'efes', 'ephesos')
    WHEN title ILIKE '%troya%'     THEN replace(replace(title, 'Troya', 'Troja'), 'troya', 'troja')
    ELSE title
  END,
  title_ru = CASE
    WHEN title_ru IS NOT NULL AND title_ru <> '' THEN title_ru
    WHEN title ILIKE '%kapadokya%' THEN replace(replace(title, 'Kapadokya', 'Каппадокия'), 'kapadokya', 'каппадокия')
    WHEN title ILIKE '%efes%'      THEN replace(replace(title, 'Efes', 'Эфес'), 'efes', 'эфес')
    WHEN title ILIKE '%istanbul%'  THEN replace(replace(title, 'İstanbul', 'Стамбул'), 'istanbul', 'стамбул')
    ELSE title
  END,
  title_ar = CASE
    WHEN title_ar IS NOT NULL AND title_ar <> '' THEN title_ar
    WHEN title ILIKE '%kapadokya%' THEN replace(replace(title, 'Kapadokya', 'كابادوكيا'), 'kapadokya', 'كابادوكيا')
    WHEN title ILIKE '%efes%'      THEN replace(replace(title, 'Efes', 'أفسس'), 'efes', 'أفسس')
    WHEN title ILIKE '%istanbul%'  THEN replace(replace(title, 'İstanbul', 'إسطنبول'), 'istanbul', 'إسطنبول')
    ELSE title
  END,
  title_fr = CASE
    WHEN title_fr IS NOT NULL AND title_fr <> '' THEN title_fr
    WHEN title ILIKE '%kapadokya%' THEN replace(replace(title, 'Kapadokya', 'Cappadoce'), 'kapadokya', 'cappadoce')
    WHEN title ILIKE '%efes%'      THEN replace(replace(title, 'Efes', 'Éphèse'), 'efes', 'éphèse')
    WHEN title ILIKE '%troya%'     THEN replace(replace(title, 'Troya', 'Troie'), 'troya', 'troie')
    ELSE title
  END,
  title_es = CASE
    WHEN title_es IS NOT NULL AND title_es <> '' THEN title_es
    WHEN title ILIKE '%kapadokya%' THEN replace(replace(title, 'Kapadokya', 'Capadocia'), 'kapadokya', 'capadocia')
    WHEN title ILIKE '%efes%'      THEN replace(replace(title, 'Efes', 'Éfeso'), 'efes', 'éfeso')
    ELSE title
  END
WHERE agency_id = '00000000-0000-0000-0000-000000000000';
