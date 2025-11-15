-- Add INSERT policy for agencies to create their own payment transactions
CREATE POLICY "Agencies can create own transactions"
ON public.payment_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  agency_id = get_user_agency_id(auth.uid()) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);