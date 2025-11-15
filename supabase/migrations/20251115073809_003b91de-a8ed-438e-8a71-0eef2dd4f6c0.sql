-- Add enabled_languages array to agencies table
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS enabled_languages text[] DEFAULT ARRAY['tr'];

-- Update existing agencies to have their current language_preference in enabled_languages
UPDATE public.agencies 
SET enabled_languages = ARRAY[COALESCE(language_preference, 'tr')]
WHERE enabled_languages IS NULL OR array_length(enabled_languages, 1) IS NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_agencies_enabled_languages ON public.agencies USING GIN(enabled_languages);

-- Add comment
COMMENT ON COLUMN public.agencies.enabled_languages IS 'Array of enabled language codes for this agency based on their plan';