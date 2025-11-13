-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  plan_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  is_yearly BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_id TEXT,
  sipay_response JSONB,
  callback_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Agencies can view own transactions"
  ON public.payment_transactions
  FOR SELECT
  USING ((agency_id = get_user_agency_id(auth.uid())) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can manage transactions"
  ON public.payment_transactions
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Create index
CREATE INDEX idx_payment_transactions_agency_id ON public.payment_transactions(agency_id);
CREATE INDEX idx_payment_transactions_order_id ON public.payment_transactions(order_id);