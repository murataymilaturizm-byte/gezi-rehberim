
-- Add Meta Cloud API columns to agencies table
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS meta_phone_number_id text;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS meta_access_token text;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS meta_waba_id text;
