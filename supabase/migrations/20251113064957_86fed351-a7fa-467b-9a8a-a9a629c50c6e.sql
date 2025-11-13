-- Rezervasyon hatırlatma takibi için alan ekle
ALTER TABLE public.registrations
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_registrations_reminder 
ON public.registrations(reminder_sent, tour_date_id) 
WHERE reminder_sent = false;