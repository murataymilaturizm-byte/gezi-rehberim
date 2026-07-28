-- F-D1 (2026-07-28): agencies.description — "Acente hakkında" metni.
-- NOT/öz-düzeltme: P3-4 denetimi bu alanı "panelde var ama bot okumuyor (ölü-alan)"
-- diye raporlamıştı; gerçekte KOLON DA FORM-ALANI DA YOKTU (grep i18n/toast
-- 'description' anahtarlarını form-alanı sanmıştı). F-D1 bu migration + panel
-- textarea + prompt-satırı (agency.ts 'Hakkında/About', 300-kırp) ile TAM kurulur.
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS description text;
COMMENT ON COLUMN public.agencies.description IS 'Acente hakkında kısa tanıtım (bot promptuna ~300 karakter kırpılarak girer)';
