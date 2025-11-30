-- Create registration_payments table to track payment history
CREATE TABLE IF NOT EXISTS public.registration_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  payment_method TEXT,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.registration_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Agencies can view own registration payments"
  ON public.registration_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.registrations
      WHERE registrations.id = registration_payments.registration_id
      AND (registrations.agency_id = get_user_agency_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role))
    )
  );

CREATE POLICY "Agencies can insert own registration payments"
  ON public.registration_payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.registrations
      WHERE registrations.id = registration_payments.registration_id
      AND (registrations.agency_id = get_user_agency_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role))
    )
  );

CREATE POLICY "Agencies can update own registration payments"
  ON public.registration_payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.registrations
      WHERE registrations.id = registration_payments.registration_id
      AND (registrations.agency_id = get_user_agency_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role))
    )
  );

CREATE POLICY "Agencies can delete own registration payments"
  ON public.registration_payments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.registrations
      WHERE registrations.id = registration_payments.registration_id
      AND (registrations.agency_id = get_user_agency_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role))
    )
  );

-- Create index for faster queries
CREATE INDEX idx_registration_payments_registration_id ON public.registration_payments(registration_id);
CREATE INDEX idx_registration_payments_payment_date ON public.registration_payments(payment_date DESC);