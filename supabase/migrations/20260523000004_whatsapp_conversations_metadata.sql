-- ============================================================
-- whatsapp_conversations.metadata JSONB — manuel mesaj ayırt etme
--
-- BUG: send-manual-message edge function'ı `metadata` alanını insert'e set
-- ediyordu ama kolon DB'de YOKTU. Supabase strict mode: unknown kolon → insert FAIL.
-- Insert error kontrolü de yoktu → SILENT FAIL → manuel mesaj DB'ye yazılmıyor
-- → frontend re-fetch sonrası mesaj görünmüyor.
--
-- Bu kolon eklendikten sonra:
--   - send-manual-message insert başarılı olur → frontend re-fetch görür
--   - Geçmişte "agent manual" mı "bot" mu ayırt edilebilir
--   - WhatsAppLogs.tsx zaten metadata bekliyordu (TS hatası kalkar)
-- ============================================================

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.whatsapp_conversations.metadata IS
  'Mesaj kaynağı + ek bilgi. Örn: {"sent_by": "agency_manual", "meta_message_id": "wamid..."} '
  '"sent_by" değerleri: agency_manual (panelden), bot (otomatik), template (kampanya), system (FSM state).';

-- Yararlı index: agency'nin manuel mesajlarını sayma/listeleme için
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_metadata_sent_by
  ON public.whatsapp_conversations((metadata->>'sent_by'))
  WHERE metadata->>'sent_by' IS NOT NULL;
