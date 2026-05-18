-- ============================================================
-- Rate Limit Tracking: per-phone (WhatsApp) + per-IP (demo-chat)
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limit_events (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier      TEXT        NOT NULL,        -- phone, IP veya sessionId
  identifier_type TEXT        NOT NULL,        -- 'phone' | 'ip' | 'session'
  agency_id       UUID        REFERENCES agencies(id) ON DELETE CASCADE,
  event_at        TIMESTAMPTZ DEFAULT NOW(),

  CHECK (identifier_type IN ('phone', 'ip', 'session'))
);

CREATE INDEX IF NOT EXISTS idx_rle_lookup
  ON rate_limit_events(identifier, identifier_type, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_rle_cleanup
  ON rate_limit_events(event_at);

ALTER TABLE rate_limit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON rate_limit_events
  FOR ALL TO service_role USING (true);


-- check_rate_limit: penceredeki event sayısını kontrol et + yeni event ekle
-- Döner: {allowed, count, max, reset_at?}
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier      TEXT,
  p_identifier_type TEXT,
  p_window_seconds  INT,
  p_max_requests    INT,
  p_agency_id       UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count       INT;
  v_oldest_at   TIMESTAMPTZ;
BEGIN
  SELECT COUNT(*), MIN(event_at)
  INTO v_count, v_oldest_at
  FROM rate_limit_events
  WHERE identifier      = p_identifier
    AND identifier_type = p_identifier_type
    AND event_at        > NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  IF v_count >= p_max_requests THEN
    RETURN json_build_object(
      'allowed',   false,
      'count',     v_count,
      'max',       p_max_requests,
      'reset_at',  v_oldest_at + (p_window_seconds || ' seconds')::INTERVAL
    );
  END IF;

  INSERT INTO rate_limit_events (identifier, identifier_type, agency_id)
  VALUES (p_identifier, p_identifier_type, p_agency_id);

  RETURN json_build_object(
    'allowed', true,
    'count',   v_count + 1,
    'max',     p_max_requests
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_rate_limit TO service_role;


-- cleanup_old_rate_limit_events: 1 saatten eski kayıtları sil
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limit_events
  WHERE event_at < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_rate_limit_events TO service_role;
