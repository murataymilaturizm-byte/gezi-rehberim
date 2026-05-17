-- ============================================================
-- Race Condition Fix: DB-based dedup + atomic conversation save
-- ============================================================

-- 1. Processed messages table: idempotency for WhatsApp webhooks
CREATE TABLE IF NOT EXISTS processed_whatsapp_messages (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT        NOT NULL,
  agency_id  UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(message_id, agency_id)
);

CREATE INDEX IF NOT EXISTS idx_pwm_lookup
  ON processed_whatsapp_messages(message_id, agency_id);

CREATE INDEX IF NOT EXISTS idx_pwm_cleanup
  ON processed_whatsapp_messages(processed_at);

ALTER TABLE processed_whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON processed_whatsapp_messages
  FOR ALL TO service_role USING (true);


-- 2. Atomic dedup + advisory lock + context/history preload
--    Returns: {success, error?, context?, history?}
--    error = 'DUPLICATE_MESSAGE' → caller must return 200 immediately
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

  -- Advisory lock: phone+agency scope (xact-level, held for this transaction)
  -- Note: lock is released when this RPC transaction ends.
  -- It prevents a second concurrent call from loading stale context
  -- during the same RPC window, but does NOT lock across the full AI call.
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

  -- Load recent non-system history (DESC, caller does .reverse())
  SELECT json_agg(row_to_json(c)) INTO v_history
  FROM (
    SELECT role, content
    FROM whatsapp_conversations
    WHERE phone     = p_phone
      AND agency_id = p_agency_id
      AND role     != 'system'
    ORDER BY created_at DESC
    LIMIT 10
  ) c;

  RETURN json_build_object(
    'success', true,
    'context', v_context,
    'history', COALESCE(v_history, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION process_whatsapp_message_atomic TO service_role;


-- 3. Atomic conversation save: assistant message + system context in ONE transaction
--    Prevents the bug where bot replies but context is not saved (or vice versa)
CREATE OR REPLACE FUNCTION save_conversation_atomic(
  p_phone             TEXT,
  p_agency_id         UUID,
  p_assistant_message TEXT,
  p_context           TEXT  -- JSON string (stored as-is in TEXT column)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO whatsapp_conversations (phone, agency_id, role, content, created_at)
  VALUES (p_phone, p_agency_id, 'assistant', p_assistant_message, NOW());

  INSERT INTO whatsapp_conversations (phone, agency_id, role, content, created_at)
  VALUES (p_phone, p_agency_id, 'system', p_context, NOW());

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION save_conversation_atomic TO service_role;


-- 4. Cleanup: removes processed_whatsapp_messages older than 24 hours
--    Call via cron or the cleanup-processed-messages edge function
CREATE OR REPLACE FUNCTION cleanup_old_processed_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM processed_whatsapp_messages
  WHERE processed_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_processed_messages TO service_role;
