
-- Add 360Dialog fields to agencies table
ALTER TABLE public.agencies 
  ADD COLUMN IF NOT EXISTS whatsapp_api_key text,
  ADD COLUMN IF NOT EXISTS threesixty_client_id text,
  ADD COLUMN IF NOT EXISTS whatsapp_connected_at timestamp with time zone;
