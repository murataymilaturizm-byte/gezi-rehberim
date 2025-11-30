-- Add payment tracking fields to registrations table
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS total_amount NUMERIC,
ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC;

-- Add index for better query performance on payment fields
CREATE INDEX IF NOT EXISTS idx_registrations_payment_status ON public.registrations(payment_status);
CREATE INDEX IF NOT EXISTS idx_registrations_source_channel ON public.registrations(source_channel);

-- Add comment to explain the fields
COMMENT ON COLUMN public.registrations.total_amount IS 'Total tour price for this registration';
COMMENT ON COLUMN public.registrations.paid_amount IS 'Total amount paid so far';
COMMENT ON COLUMN public.registrations.deposit_amount IS 'Initial deposit amount if applicable';