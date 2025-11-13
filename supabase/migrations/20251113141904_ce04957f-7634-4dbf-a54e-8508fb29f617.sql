-- Merkezi Twilio yapısına geçiş
-- Agencies tablosundan Twilio credentials kaldır, WhatsApp numarası ekle

-- WhatsApp telefon numarası kolonu ekle (nullable, daha sonra doldurulacak)
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS whatsapp_phone_number text;

-- Eski Twilio kolonlarını nullable yap (geriye dönük uyumluluk için)
ALTER TABLE public.agencies 
ALTER COLUMN twilio_account_sid DROP NOT NULL,
ALTER COLUMN twilio_auth_token DROP NOT NULL,
ALTER COLUMN twilio_phone_number DROP NOT NULL;

-- WhatsApp numara benzersizliği için index
CREATE UNIQUE INDEX IF NOT EXISTS idx_agencies_whatsapp_phone 
ON public.agencies(whatsapp_phone_number) 
WHERE whatsapp_phone_number IS NOT NULL;

-- Yorum ekle
COMMENT ON COLUMN public.agencies.whatsapp_phone_number IS 'WhatsApp Business telefon numarası (E.164 formatında, ör: +905551234567)';
COMMENT ON COLUMN public.agencies.twilio_account_sid IS 'DEPRECATED - Merkezi Twilio kullanılıyor';
COMMENT ON COLUMN public.agencies.twilio_auth_token IS 'DEPRECATED - Merkezi Twilio kullanılıyor';
COMMENT ON COLUMN public.agencies.twilio_phone_number IS 'DEPRECATED - whatsapp_phone_number kullanın';