CREATE TABLE public.data_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit data deletion requests"
ON public.data_deletion_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Super admins can view all deletion requests"
ON public.data_deletion_requests
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update deletion requests"
ON public.data_deletion_requests
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));