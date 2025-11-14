-- Varsayılan şablonları herkesin okuyabilmesi için RLS politikasını güncelle
DROP POLICY IF EXISTS "Agencies can view own templates" ON public.message_templates;

CREATE POLICY "Agencies can view own and default templates"
ON public.message_templates
FOR SELECT
USING (
  agency_id = get_user_agency_id(auth.uid()) OR 
  agency_id = '00000000-0000-0000-0000-000000000000' OR
  has_role(auth.uid(), 'super_admin'::app_role)
);