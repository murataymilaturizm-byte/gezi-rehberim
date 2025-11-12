-- Add more detailed fields to tours table for chatbot to provide better information

ALTER TABLE public.tours 
ADD COLUMN program_kisa text,
ADD COLUMN hareket_noktasi text,
ADD COLUMN toplanma_saati time,
ADD COLUMN tur_sure text,
ADD COLUMN konaklama text,
ADD COLUMN ulasim text,
ADD COLUMN tur_kategorisi text,
ADD COLUMN gezilecek_yerler text;

-- Add comments for clarity
COMMENT ON COLUMN public.tours.program_kisa IS 'Kısa program açıklaması';
COMMENT ON COLUMN public.tours.hareket_noktasi IS 'Hareket noktası/Bilet noktası';
COMMENT ON COLUMN public.tours.toplanma_saati IS 'Toplanma saati';
COMMENT ON COLUMN public.tours.tur_sure IS 'Tur süresi (örn: 3 gün, 8 saat)';
COMMENT ON COLUMN public.tours.konaklama IS 'Konaklama detayları';
COMMENT ON COLUMN public.tours.ulasim IS 'Ulaşım detayları';
COMMENT ON COLUMN public.tours.tur_kategorisi IS 'Tur kategorisi';
COMMENT ON COLUMN public.tours.gezilecek_yerler IS 'Gezilecek yerler (virgülle ayrılmış)';