-- Launch-öncesi güvenlik: dispatch-central-notification artık yalnız iç çağrı kabul
-- ediyor (X-Internal-Secret header == env INTERNAL_FUNCTION_SECRET). DB-trigger köprüsü
-- bu header'ı Vault'taki 'internal_function_secret'ten okuyup ekler. Secret yoksa
-- fonksiyon yine sessizce döner (tetikleyen tx asla bozulmaz). Authorization anon
-- kalır (gateway verify_jwt=false; asıl doğrulama header ile fonksiyon içinde).
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
  _base_url    text;
  _anon_key    text;
  _internal    text;
  _request_id  bigint;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO _base_url
      FROM vault.decrypted_secrets WHERE name = 'edge_functions_base_url' LIMIT 1;
    SELECT decrypted_secret INTO _anon_key
      FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1;
    SELECT decrypted_secret INTO _internal
      FROM vault.decrypted_secrets WHERE name = 'internal_function_secret' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[_dispatch_central_notification] vault read failed: %', SQLERRM;
    RETURN;
  END;

  IF _base_url IS NULL OR _internal IS NULL THEN
    RAISE NOTICE '[_dispatch_central_notification] missing vault secrets (base_url=% internal_set=%)',
      (_base_url IS NOT NULL), (_internal IS NOT NULL);
    RETURN;
  END IF;

  BEGIN
    SELECT net.http_post(
      url     := rtrim(_base_url, '/') || '/dispatch-central-notification',
      headers := jsonb_build_object(
        'Content-Type',      'application/json',
        'X-Internal-Secret', _internal,
        'Authorization',     'Bearer ' || COALESCE(_anon_key, '')
      ),
      body    := jsonb_build_object('event_type', p_event_type, 'payload', p_payload),
      timeout_milliseconds := 5000
    ) INTO _request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[_dispatch_central_notification] http_post failed: %', SQLERRM;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public._dispatch_central_notification(text, jsonb) FROM PUBLIC;
