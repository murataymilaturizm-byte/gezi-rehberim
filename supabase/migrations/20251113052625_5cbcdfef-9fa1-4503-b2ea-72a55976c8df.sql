-- Add subscription and trial columns to agencies table
ALTER TABLE public.agencies 
ADD COLUMN plan_type text NOT NULL DEFAULT 'starter',
ADD COLUMN trial_ends_at timestamp with time zone DEFAULT (now() + interval '14 days'),
ADD COLUMN subscription_status text NOT NULL DEFAULT 'trial',
ADD COLUMN subscription_ends_at timestamp with time zone DEFAULT NULL;

-- Add check constraint for plan_type
ALTER TABLE public.agencies 
ADD CONSTRAINT agencies_plan_type_check 
CHECK (plan_type IN ('starter', 'professional', 'enterprise'));

-- Add check constraint for subscription_status
ALTER TABLE public.agencies 
ADD CONSTRAINT agencies_subscription_status_check 
CHECK (subscription_status IN ('trial', 'active', 'expired', 'cancelled'));

-- Create index for faster subscription queries
CREATE INDEX idx_agencies_subscription_status ON public.agencies(subscription_status);
CREATE INDEX idx_agencies_trial_ends_at ON public.agencies(trial_ends_at);
CREATE INDEX idx_agencies_subscription_ends_at ON public.agencies(subscription_ends_at);

-- Add comment for documentation
COMMENT ON COLUMN public.agencies.plan_type IS 'Subscription plan: starter, professional, or enterprise';
COMMENT ON COLUMN public.agencies.trial_ends_at IS 'Trial period end date (14 days from signup)';
COMMENT ON COLUMN public.agencies.subscription_status IS 'Current subscription status: trial, active, expired, or cancelled';
COMMENT ON COLUMN public.agencies.subscription_ends_at IS 'Paid subscription end date (monthly renewal)';