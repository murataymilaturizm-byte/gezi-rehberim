-- Contact forms table
CREATE TABLE public.contact_forms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text
);

-- Enable RLS
ALTER TABLE public.contact_forms ENABLE ROW LEVEL SECURITY;

-- RLS Policies - only super admins can view/manage
CREATE POLICY "Super admins can view all contact forms"
  ON public.contact_forms
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Anyone can submit contact forms"
  ON public.contact_forms
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Super admins can update contact forms"
  ON public.contact_forms
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Index for better performance
CREATE INDEX idx_contact_forms_created_at ON public.contact_forms(created_at DESC);
CREATE INDEX idx_contact_forms_status ON public.contact_forms(status);