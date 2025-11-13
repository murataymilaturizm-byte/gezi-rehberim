-- Allow agencies to update their own data
CREATE POLICY "Agencies can update own data" 
ON public.agencies 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());