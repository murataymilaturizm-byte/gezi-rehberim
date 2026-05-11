-- Global hazırlık: çoklu para birimi toggle'ı
-- Not: preferred_currency EKLENMEDI — mevcut primary_currency zaten aynı işlevi görüyor.
-- Bu migration yalnızca yeni show_multi_currency boolean'ı ekliyor.

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS show_multi_currency BOOLEAN DEFAULT true;

UPDATE public.agencies
  SET show_multi_currency = true
  WHERE show_multi_currency IS NULL;

COMMENT ON COLUMN public.agencies.show_multi_currency IS
  'Chatbot fiyat gösteriminde çift para birimi aktif mi (müşteri dili + acente para birimi)';

-- Index — sık okunuyor (her chatbot mesajında)
CREATE INDEX IF NOT EXISTS idx_agencies_show_multi_currency
  ON public.agencies(show_multi_currency)
  WHERE show_multi_currency = true;
