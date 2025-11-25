-- Add language_currencies field to agencies table
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS language_currencies JSONB DEFAULT '{
  "tr": "TRY",
  "en": "USD",
  "de": "EUR",
  "ru": "EUR",
  "ar": "SAR",
  "fr": "EUR",
  "es": "EUR"
}'::jsonb;

COMMENT ON COLUMN public.agencies.language_currencies IS 'Currency code for each language (e.g., {"tr": "TRY", "en": "USD"})';
