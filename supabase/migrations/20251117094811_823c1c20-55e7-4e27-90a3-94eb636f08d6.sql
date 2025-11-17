-- Create FAQ table for automated responses
CREATE TABLE IF NOT EXISTS public.faq_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  language TEXT DEFAULT 'tr',
  is_active BOOLEAN DEFAULT true,
  category TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.faq_templates ENABLE ROW LEVEL SECURITY;

-- Policies for FAQ templates
CREATE POLICY "Users can view their agency's FAQs"
  ON public.faq_templates
  FOR SELECT
  USING (
    agency_id IN (
      SELECT id FROM public.agencies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their agency's FAQs"
  ON public.faq_templates
  FOR INSERT
  WITH CHECK (
    agency_id IN (
      SELECT id FROM public.agencies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their agency's FAQs"
  ON public.faq_templates
  FOR UPDATE
  USING (
    agency_id IN (
      SELECT id FROM public.agencies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their agency's FAQs"
  ON public.faq_templates
  FOR DELETE
  USING (
    agency_id IN (
      SELECT id FROM public.agencies WHERE user_id = auth.uid()
    )
  );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_faq_templates_agency_id ON public.faq_templates(agency_id);
CREATE INDEX IF NOT EXISTS idx_faq_templates_language ON public.faq_templates(language);
CREATE INDEX IF NOT EXISTS idx_faq_templates_keywords ON public.faq_templates USING GIN(keywords);

-- Trigger for updated_at
CREATE TRIGGER update_faq_templates_updated_at
  BEFORE UPDATE ON public.faq_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();