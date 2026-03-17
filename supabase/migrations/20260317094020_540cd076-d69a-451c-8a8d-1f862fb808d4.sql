CREATE POLICY "Users can create own agency"
ON public.agencies
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());