-- ============================================================
-- FIX 3: save_conversation_atomic'e p_user_message parametresi ekle
-- Önceki versiyon sadece assistant+system kaydediyordu.
-- Yeni versiyon user+assistant+system atomik olarak kaydeder.
-- ============================================================

CREATE OR REPLACE FUNCTION save_conversation_atomic(
  p_phone             TEXT,
  p_agency_id         UUID,
  p_user_message      TEXT,   -- yeni parametre; boş string → user kaydı atlanır
  p_assistant_message TEXT,
  p_context           TEXT    -- JSON string
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- User mesajını kaydet (varsa)
  IF p_user_message IS NOT NULL AND p_user_message <> '' THEN
    INSERT INTO whatsapp_conversations (phone, agency_id, role, content, created_at)
    VALUES (p_phone, p_agency_id, 'user', p_user_message, v_now);
  END IF;

  -- Assistant mesajını kaydet
  INSERT INTO whatsapp_conversations (phone, agency_id, role, content, created_at)
  VALUES (p_phone, p_agency_id, 'assistant', p_assistant_message, v_now + INTERVAL '1 millisecond');

  -- Context'i kaydet
  INSERT INTO whatsapp_conversations (phone, agency_id, role, content, created_at)
  VALUES (p_phone, p_agency_id, 'system', p_context, v_now + INTERVAL '2 milliseconds');

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION save_conversation_atomic TO service_role;
