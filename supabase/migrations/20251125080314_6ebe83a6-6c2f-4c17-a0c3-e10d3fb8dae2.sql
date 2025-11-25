-- Add new fields to agencies table for expanded chatbot functionality
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS phone_public text,
ADD COLUMN IF NOT EXISTS website_url text,
ADD COLUMN IF NOT EXISTS working_hours text,
ADD COLUMN IF NOT EXISTS maps_url text,
ADD COLUMN IF NOT EXISTS payment_methods_text text,
ADD COLUMN IF NOT EXISTS cancellation_policy text;

-- Add new fields to tours table for visa and hotel details
ALTER TABLE tours
ADD COLUMN IF NOT EXISTS visa_notes text,
ADD COLUMN IF NOT EXISTS hotel_name text,
ADD COLUMN IF NOT EXISTS hotel_stars integer;

-- Create complaints/feedback table (optional but useful)
CREATE TABLE IF NOT EXISTS public.complaints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  phone text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'complaint', -- 'complaint' or 'feedback'
  status text NOT NULL DEFAULT 'new', -- 'new', 'reviewed', 'resolved'
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on complaints table
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- RLS policies for complaints
CREATE POLICY "Agencies can view own complaints"
ON public.complaints
FOR SELECT
USING (
  agency_id = get_user_agency_id(auth.uid()) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Agencies can update own complaints"
ON public.complaints
FOR UPDATE
USING (
  agency_id = get_user_agency_id(auth.uid()) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Agencies can insert own complaints"
ON public.complaints
FOR INSERT
WITH CHECK (
  agency_id = get_user_agency_id(auth.uid()) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Add trigger for updated_at
CREATE TRIGGER update_complaints_updated_at
BEFORE UPDATE ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_complaints_agency_id ON public.complaints(agency_id);
CREATE INDEX IF NOT EXISTS idx_complaints_phone ON public.complaints(phone);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);