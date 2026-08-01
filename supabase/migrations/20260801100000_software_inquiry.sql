-- ═══════════════════════════════════════════════════════════════════════════
-- W5-REV (2026-08-01): YAZILIM-TALEBİ YAKALAMA — acente-bazlı bayrakla kapılı
--
-- Click-to-WhatsApp reklamıyla Aymila'nın GERÇEK botuna acente sahipleri
-- gelecek ve rolden çıkıp yazılımın kendisini soracaklar. Ölçüm (31 Tem):
-- bu soruların 6/6'sı iz bırakmadan kayboluyordu.
--
-- ⚠️ KAPSAM: yalnız Aymila (Turzz'un tanıtım/demo kanalı). Diğer acentelerin
--    MÜŞTERİ kanalına Turzz-satışı sızmamalı — bayrak default FALSE.
--    Panel UI yok: süper-admin işi, SQL yeterli (ileride kanal-ortağı modeli
--    gelirse UI o zaman eklenir).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS software_inquiry_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.agencies.software_inquiry_enabled IS
  'W5: bu acentenin botu "Turzz yazılımını almak istiyorum" tipi talepleri yakalar mı. Yalnız tanıtım/demo kanalı olan acentelerde TRUE olmalı — müşteri kanallarına Turzz satışı sızmasın.';

-- Yalnız Aymila Turizm (Turzz tanıtım kanalı)
UPDATE public.agencies
SET software_inquiry_enabled = true
WHERE id = 'fbad140f-a82e-4b9d-9829-ffc175a77f28';

-- ─── Lead kategorisi ────────────────────────────────────────────────────────
-- Panelde ve bildirimde "yazılım talebi mi, tur-dışı hizmet mi" TEK BAKIŞTA
-- ayrılabilsin. Mevcut satırlar 'service' (geriye uyumlu varsayılan).
ALTER TABLE public.agency_leads
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'service';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agency_leads_category_chk'
  ) THEN
    ALTER TABLE public.agency_leads
      ADD CONSTRAINT agency_leads_category_chk
      CHECK (category IN ('service', 'software_inquiry'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agency_leads_category
  ON public.agency_leads (category, created_at DESC);

COMMENT ON COLUMN public.agency_leads.category IS
  'service = tur-dışı müşteri hizmeti (uçak/otel/transfer/vize) · software_inquiry = Turzz yazılımını soran acente sahibi (W5)';
