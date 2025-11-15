-- Update conversation_style constraint to include 'basic'
ALTER TABLE agencies DROP CONSTRAINT IF EXISTS agencies_conversation_style_check;

ALTER TABLE agencies ADD CONSTRAINT agencies_conversation_style_check 
CHECK (conversation_style IN ('basic', 'friendly', 'professional', 'energetic', 'helpful'));

-- Update Aymila Turizm to use basic style
UPDATE agencies SET conversation_style = 'basic' WHERE agency_name = 'Aymila Turizm';