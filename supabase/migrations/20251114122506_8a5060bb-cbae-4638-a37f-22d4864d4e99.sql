-- Add language_preference column to agencies table
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS language_preference text DEFAULT 'tr';

COMMENT ON COLUMN public.agencies.language_preference IS 'Preferred language for the agency based on their city/region';