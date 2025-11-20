-- Add multilingual fields to tours table for title, destination, and program_kisa
ALTER TABLE public.tours 
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS title_de TEXT,
  ADD COLUMN IF NOT EXISTS title_ru TEXT,
  ADD COLUMN IF NOT EXISTS title_ar TEXT,
  ADD COLUMN IF NOT EXISTS title_fr TEXT,
  ADD COLUMN IF NOT EXISTS title_es TEXT,
  
  ADD COLUMN IF NOT EXISTS destination_en TEXT,
  ADD COLUMN IF NOT EXISTS destination_de TEXT,
  ADD COLUMN IF NOT EXISTS destination_ru TEXT,
  ADD COLUMN IF NOT EXISTS destination_ar TEXT,
  ADD COLUMN IF NOT EXISTS destination_fr TEXT,
  ADD COLUMN IF NOT EXISTS destination_es TEXT,
  
  ADD COLUMN IF NOT EXISTS program_kisa_en TEXT,
  ADD COLUMN IF NOT EXISTS program_kisa_de TEXT,
  ADD COLUMN IF NOT EXISTS program_kisa_ru TEXT,
  ADD COLUMN IF NOT EXISTS program_kisa_ar TEXT,
  ADD COLUMN IF NOT EXISTS program_kisa_fr TEXT,
  ADD COLUMN IF NOT EXISTS program_kisa_es TEXT;

-- Add comment explaining the multilingual structure
COMMENT ON COLUMN public.tours.title_en IS 'English translation of tour title';
COMMENT ON COLUMN public.tours.destination_en IS 'English translation of destination';
COMMENT ON COLUMN public.tours.program_kisa_en IS 'English translation of short program description';