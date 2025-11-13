-- Make user_id nullable for demo agency
ALTER TABLE public.agencies ALTER COLUMN user_id DROP NOT NULL;

-- Create a demo agency for landing page demo chat
INSERT INTO public.agencies (
  id,
  user_id,
  agency_name,
  city,
  region,
  twilio_account_sid,
  twilio_auth_token,
  twilio_phone_number,
  plan_type,
  subscription_status,
  active,
  message_limit,
  trial_ends_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  NULL,
  'Demo Acente',
  'Demo',
  'Demo',
  'demo_sid',
  'demo_token',
  '+900000000000',
  'professional',
  'active',
  true,
  999999,
  NOW() + INTERVAL '100 years'
) ON CONFLICT (id) DO UPDATE SET
  agency_name = 'Demo Acente',
  active = true;