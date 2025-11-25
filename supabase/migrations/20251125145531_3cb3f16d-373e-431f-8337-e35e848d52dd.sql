-- Add primary_currency column to agencies
ALTER TABLE public.agencies
ADD COLUMN primary_currency text DEFAULT 'TRY';

COMMENT ON COLUMN public.agencies.primary_currency IS 'Ana para birimi - tüm diller için varsayılan';
COMMENT ON COLUMN public.agencies.language_currencies IS 'Dil bazlı para birimi override - opsiyonel';