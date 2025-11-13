-- Create subscription history table
CREATE TABLE public.subscription_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  plan_type text,
  amount numeric(10, 2),
  currency text DEFAULT 'TRY',
  payment_method text,
  transaction_id text,
  status text NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add check constraints
ALTER TABLE public.subscription_history 
ADD CONSTRAINT subscription_history_event_type_check 
CHECK (event_type IN ('trial_started', 'trial_ended', 'payment_success', 'payment_failed', 'plan_changed', 'subscription_activated', 'subscription_expired', 'subscription_cancelled'));

ALTER TABLE public.subscription_history 
ADD CONSTRAINT subscription_history_status_check 
CHECK (status IN ('success', 'failed', 'pending', 'cancelled'));

-- Create indexes
CREATE INDEX idx_subscription_history_agency_id ON public.subscription_history(agency_id);
CREATE INDEX idx_subscription_history_created_at ON public.subscription_history(created_at DESC);
CREATE INDEX idx_subscription_history_event_type ON public.subscription_history(event_type);

-- Enable RLS
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Agencies can view own subscription history"
ON public.subscription_history
FOR SELECT
USING ((agency_id = get_user_agency_id(auth.uid())) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can manage subscription history"
ON public.subscription_history
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Add comments
COMMENT ON TABLE public.subscription_history IS 'Tracks all subscription-related events including payments, plan changes, and status updates';
COMMENT ON COLUMN public.subscription_history.event_type IS 'Type of event: trial_started, trial_ended, payment_success, payment_failed, plan_changed, subscription_activated, subscription_expired, subscription_cancelled';
COMMENT ON COLUMN public.subscription_history.status IS 'Event status: success, failed, pending, cancelled';