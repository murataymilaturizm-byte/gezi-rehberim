-- Update RLS policy to allow viewing template FAQs (agency_id = 00000000-0000-0000-0000-000000000000)
DROP POLICY IF EXISTS "Users can view their agency's FAQs" ON faq_templates;

CREATE POLICY "Users can view their agency's FAQs and templates"
ON faq_templates
FOR SELECT
USING (
  agency_id IN ( 
    SELECT agencies.id
    FROM agencies
    WHERE (agencies.user_id = auth.uid())
  )
  OR agency_id = '00000000-0000-0000-0000-000000000000'
);

-- Update delete policy to prevent deletion of template FAQs
DROP POLICY IF EXISTS "Users can delete their agency's FAQs" ON faq_templates;

CREATE POLICY "Users can delete their agency's FAQs only"
ON faq_templates
FOR DELETE
USING (
  agency_id IN ( 
    SELECT agencies.id
    FROM agencies
    WHERE (agencies.user_id = auth.uid())
  )
  AND agency_id != '00000000-0000-0000-0000-000000000000'
);

-- Update update policy to prevent updating template FAQs
DROP POLICY IF EXISTS "Users can update their agency's FAQs" ON faq_templates;

CREATE POLICY "Users can update their agency's FAQs only"
ON faq_templates
FOR UPDATE
USING (
  agency_id IN ( 
    SELECT agencies.id
    FROM agencies
    WHERE (agencies.user_id = auth.uid())
  )
  AND agency_id != '00000000-0000-0000-0000-000000000000'
);