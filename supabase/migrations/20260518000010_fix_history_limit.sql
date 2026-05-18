-- ============================================================
-- Fix: process_whatsapp_message_atomic history LIMIT 10 → 20
-- Bir rezervasyon akışı 12-14 mesaj içerir; 10 ile tarih seçimi kayboluyor.
-- Order DESC kalmaya devam ediyor — TypeScript katmanı .reverse() yapıyor.
-- ============================================================

CREATE OR REPLACE FUNCTION process_whatsapp_message_atomic(
  p_message_id TEXT,
  p_agency_id  UUID,
  p_phone      TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_context TEXT;
  v_history JSON;
BEGIN
  -- Atomic dedup: unique constraint catches concurrent duplicates
  BEGIN
    INSERT INTO processed_whatsapp_messages (message_id, agency_id)
    VALUES (p_message_id, p_agency_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'DUPLICATE_MESSAGE');
  END;

  -- Advisory lock: phone+agency scope (xact-level)
  PERFORM pg_advisory_xact_lock(
    hashtext(p_phone),
    hashtext(p_agency_id::text)
  );

  -- Load latest system context
  SELECT content INTO v_context
  FROM whatsapp_conversations
  WHERE phone      = p_phone
    AND agency_id  = p_agency_id
    AND role       = 'system'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Load recent non-system history (DESC, TypeScript caller does .reverse())
  -- LIMIT 20: rezervasyon akışı 12-14 mesaj — 10 ile tarih seçimi kayboluyordu.
  SELECT json_agg(row_to_json(c)) INTO v_history
  FROM (
    SELECT role, content
    FROM whatsapp_conversations
    WHERE phone     = p_phone
      AND agency_id = p_agency_id
      AND role     != 'system'
    ORDER BY created_at DESC
    LIMIT 20
  ) c;

  RETURN json_build_object(
    'success', true,
    'context', v_context,
    'history', COALESCE(v_history, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION process_whatsapp_message_atomic TO service_role;
