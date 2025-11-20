-- Ensure whatsapp_conversations table exists with correct schema
-- Table already exists, just ensure indexes are present

-- Create index for efficient queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone_created_at
  ON public.whatsapp_conversations (phone, created_at);

-- Create index for agency filtering (if not exists)
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_agency_id
  ON public.whatsapp_conversations (agency_id);

-- Ensure RLS is enabled
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;