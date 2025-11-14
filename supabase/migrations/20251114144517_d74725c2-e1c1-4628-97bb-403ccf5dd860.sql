-- Add whatsapp_status column to agencies table
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS whatsapp_status TEXT DEFAULT 'pending' CHECK (whatsapp_status IN ('pending', 'active', 'rejected'));

-- Update existing agencies with phone numbers to 'active' status
UPDATE public.agencies 
SET whatsapp_status = 'active' 
WHERE twilio_phone_number IS NOT NULL 
  AND twilio_phone_number != '' 
  AND twilio_phone_number != 'TEMP_PHONE';

-- Add comment
COMMENT ON COLUMN public.agencies.whatsapp_status IS 'WhatsApp entegrasyon durumu: pending (beklemede), active (aktif), rejected (reddedildi)';