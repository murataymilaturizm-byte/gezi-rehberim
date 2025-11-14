-- Add conversation_style column to agencies table
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS conversation_style TEXT DEFAULT 'professional' CHECK (conversation_style IN ('friendly', 'professional', 'energetic', 'helpful'));

-- Add comment
COMMENT ON COLUMN public.agencies.conversation_style IS 'WhatsApp bot konuşma üslubu: friendly (samimi), professional (kurumsal), energetic (enerjik), helpful (nazik)';

-- Update existing agencies to professional
UPDATE public.agencies 
SET conversation_style = 'professional' 
WHERE conversation_style IS NULL;