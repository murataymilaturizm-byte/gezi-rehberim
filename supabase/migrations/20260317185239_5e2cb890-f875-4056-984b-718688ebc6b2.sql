
-- Create enum for integration status
CREATE TYPE public.whatsapp_integration_status AS ENUM (
  'pending_review',
  'waiting_info',
  'in_progress',
  'testing',
  'active'
);

-- Create whatsapp_integrations table
CREATE TABLE public.whatsapp_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  status public.whatsapp_integration_status NOT NULL DEFAULT 'pending_review',
  whatsapp_phone TEXT,
  company_name TEXT,
  has_business_manager BOOLEAN DEFAULT false,
  business_manager_id TEXT,
  contact_email TEXT,
  notes TEXT,
  admin_notes TEXT,
  meta_phone_number_id TEXT,
  meta_waba_id TEXT,
  meta_access_token TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  activated_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agency_id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_integrations ENABLE ROW LEVEL SECURITY;

-- Agencies can view their own integration
CREATE POLICY "Agencies can view own integration"
ON public.whatsapp_integrations
FOR SELECT
TO authenticated
USING (agency_id = get_user_agency_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Agencies can insert their own integration request
CREATE POLICY "Agencies can create own integration"
ON public.whatsapp_integrations
FOR INSERT
TO authenticated
WITH CHECK (agency_id = get_user_agency_id(auth.uid()));

-- Agencies can update own integration (for submitting info form)
CREATE POLICY "Agencies can update own integration"
ON public.whatsapp_integrations
FOR UPDATE
TO authenticated
USING (agency_id = get_user_agency_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Super admins can do everything
CREATE POLICY "Super admins can manage all integrations"
ON public.whatsapp_integrations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_integrations_updated_at
BEFORE UPDATE ON public.whatsapp_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
