-- Mevcut registrations tablosuna kaynak kanal ve ödeme durumu alanları ekle
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS source_channel TEXT DEFAULT 'WHATSAPP' CHECK (source_channel IN ('WHATSAPP', 'PHONE', 'OFFICE', 'INSTAGRAM', 'OTHER')),
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'DEPOSIT', 'PAID'));

-- Mevcut kayıtlar için source_channel'ı WHATSAPP yap
UPDATE registrations 
SET source_channel = 'WHATSAPP' 
WHERE source_channel IS NULL;

-- Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_registrations_source_channel ON registrations(source_channel);
CREATE INDEX IF NOT EXISTS idx_registrations_payment_status ON registrations(payment_status);