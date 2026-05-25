-- ============================================================
-- TURZZ MERKEZİ BİLDİRİM — PARÇA 2A (Backend)
-- 5/7: pg_net extension + _dispatch_central_notification helper
-- ============================================================
-- AMAÇ:
--   Trigger'lar bu helper'ı çağırır; helper Vault'tan {base_url, anon_key} okur,
--   pg_net.http_post ile dispatch-central-notification edge function'ına post atar.
--
-- YETKİ MODELİ:
--   - Authorization header'da ANON KEY kullanılır (Supabase frontend'te zaten public).
--   - verify_jwt=false (config.toml). Tetikleyici DB; harici çağrı endişesi şu an düşük.
--     Eklenecek koruma: gelecekteki "internal-secret" header check (PARÇA 2B'den sonra opsiyonel).
--   - SERVICE_ROLE_KEY DB'de SAKLANMAZ — edge function kendi env'inden okur (Supabase otomatik inject).
--
-- VAULT KURULUMU (BU MIGRATION'I ÇALIŞTIRMADAN ÖNCE BİR KEZ):
--   SQL Editor'de elle:
--     SELECT vault.create_secret(
--       'https://<PROJECT-REF>.supabase.co/functions/v1',
--       'edge_functions_base_url',
--       'Turzz merkezi bildirim dispatcher base URL'
--     );
--     SELECT vault.create_secret(
--       '<YOUR-ANON-KEY>',
--       'supabase_anon_key',
--       'Public anon key (Supabase Dashboard > API > anon)'
--     );
--   Yeniden çalıştırırsanız vault.create_secret unique-name constraint hatası verir;
--   güncellemek için vault.update_secret(id, new_value) kullanın.
--
-- DEFANSİF: Vault okuması fail olursa veya secret yoksa fonksiyon sessizce döner;
-- tetikleyen INSERT/UPDATE asla bozulmaz. Hatalar NOTICE seviyesinde log'a düşer.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public._dispatch_central_notification(
  p_event_type text,
  p_payload    jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _base_url   text;
  _anon_key   text;
  _request_id bigint;
BEGIN
  -- Vault okuma — fail olursa sessizce dön (trigger zincirini bozma)
  BEGIN
    SELECT decrypted_secret INTO _base_url
      FROM vault.decrypted_secrets
      WHERE name = 'edge_functions_base_url'
      LIMIT 1;

    SELECT decrypted_secret INTO _anon_key
      FROM vault.decrypted_secrets
      WHERE name = 'supabase_anon_key'
      LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[_dispatch_central_notification] vault read failed: %', SQLERRM;
    RETURN;
  END;

  IF _base_url IS NULL OR _anon_key IS NULL THEN
    RAISE NOTICE '[_dispatch_central_notification] missing vault secrets (base_url=% anon_key_set=%)',
      (_base_url IS NOT NULL), (_anon_key IS NOT NULL);
    RETURN;
  END IF;

  -- Async http_post — request kuyruğa girer, fonksiyon hemen döner (tx'i bekletmez).
  BEGIN
    SELECT net.http_post(
      url     := rtrim(_base_url, '/') || '/dispatch-central-notification',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || _anon_key
      ),
      body    := jsonb_build_object(
        'event_type', p_event_type,
        'payload',    p_payload
      ),
      timeout_milliseconds := 5000
    ) INTO _request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[_dispatch_central_notification] http_post failed: %', SQLERRM;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public._dispatch_central_notification(text, jsonb) FROM PUBLIC;
-- Sadece trigger'lar (SECURITY DEFINER) çağırsın — authenticated/anon EXECUTE almasın.
-- SECURITY DEFINER zaten owner (postgres) yetkisiyle çalışıyor; ek grant gereksiz.

COMMENT ON FUNCTION public._dispatch_central_notification(text, jsonb) IS
  'Trigger ↔ edge function bridge. Vault''tan {edge_functions_base_url, supabase_anon_key} okur, pg_net ile dispatch-central-notification''a async post atar. Fail olursa sessizce döner — tetikleyen tx asla bozulmaz.';
