-- WhatsApp kullanıcı profilleri tablosu
CREATE TABLE IF NOT EXISTS public.whatsapp_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  agency_id UUID NOT NULL,
  full_name TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  first_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  total_messages INTEGER DEFAULT 0,
  last_search_query TEXT,
  preferred_destinations TEXT[],
  budget_range TEXT,
  preferred_tour_type TEXT,
  language_preference TEXT DEFAULT 'tr',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index'ler
CREATE INDEX idx_whatsapp_user_profiles_phone ON public.whatsapp_user_profiles(phone);
CREATE INDEX idx_whatsapp_user_profiles_agency_id ON public.whatsapp_user_profiles(agency_id);
CREATE INDEX idx_whatsapp_user_profiles_last_interaction ON public.whatsapp_user_profiles(last_interaction_at DESC);

-- RLS politikaları
ALTER TABLE public.whatsapp_user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agencies can view own user profiles"
  ON public.whatsapp_user_profiles
  FOR SELECT
  USING (
    (agency_id = get_user_agency_id(auth.uid())) 
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Agencies can manage own user profiles"
  ON public.whatsapp_user_profiles
  FOR ALL
  USING (
    (agency_id = get_user_agency_id(auth.uid())) 
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Updated_at trigger fonksiyonu (eğer yoksa)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Updated_at trigger
CREATE TRIGGER update_whatsapp_user_profiles_updated_at
  BEFORE UPDATE ON public.whatsapp_user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Konuşma özetleri tablosu (gelişmiş context için)
CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  agency_id UUID NOT NULL,
  summary TEXT NOT NULL,
  topics TEXT[],
  mentioned_tours TEXT[],
  sentiment TEXT DEFAULT 'neutral',
  conversation_date DATE DEFAULT CURRENT_DATE,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index'ler
CREATE INDEX idx_whatsapp_summaries_phone ON public.whatsapp_conversation_summaries(phone);
CREATE INDEX idx_whatsapp_summaries_agency ON public.whatsapp_conversation_summaries(agency_id);
CREATE INDEX idx_whatsapp_summaries_date ON public.whatsapp_conversation_summaries(conversation_date DESC);

-- RLS politikaları
ALTER TABLE public.whatsapp_conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agencies can view own conversation summaries"
  ON public.whatsapp_conversation_summaries
  FOR SELECT
  USING (
    (agency_id = get_user_agency_id(auth.uid())) 
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Agencies can manage own conversation summaries"
  ON public.whatsapp_conversation_summaries
  FOR ALL
  USING (
    (agency_id = get_user_agency_id(auth.uid())) 
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );