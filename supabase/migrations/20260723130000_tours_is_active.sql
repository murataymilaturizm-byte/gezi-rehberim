-- İş2 (CASCADE koruması): turlara is_active. Pasif tur bot listesinde görünmez
-- AMA mevcut kayıtlar + cron hatırlatmaları yaşar (silme yerine güvenli gizleme).
-- default true → mevcut turların davranışı değişmez (korpus etkilenmez).
ALTER TABLE public.tours ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_tours_agency_active ON public.tours(agency_id, is_active);
COMMENT ON COLUMN public.tours.is_active IS
  'false = pasif: bot listesinde gizli, yeni rezervasyon alınmaz; mevcut kayıtlar + hatırlatma cron''u çalışmaya devam eder (İş2 CASCADE koruması).';
