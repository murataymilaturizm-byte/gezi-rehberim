-- Plan özellikleri tablosu oluştur
CREATE TABLE IF NOT EXISTS public.plan_features (
  plan_type TEXT PRIMARY KEY,
  max_tours INTEGER NOT NULL,
  max_languages INTEGER NOT NULL,
  available_styles TEXT[] NOT NULL,
  has_user_profiles BOOLEAN NOT NULL DEFAULT false,
  has_reminders BOOLEAN NOT NULL DEFAULT false,
  has_follow_ups BOOLEAN NOT NULL DEFAULT false,
  has_templates BOOLEAN NOT NULL DEFAULT false,
  has_feedback BOOLEAN NOT NULL DEFAULT false,
  has_analytics BOOLEAN NOT NULL DEFAULT false,
  message_limit INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS politikaları
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plan features are viewable by everyone"
  ON public.plan_features FOR SELECT
  USING (true);

CREATE POLICY "Only super admins can manage plan features"
  ON public.plan_features FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Varsayılan paket özelliklerini ekle
INSERT INTO public.plan_features (
  plan_type, 
  max_tours, 
  max_languages, 
  available_styles, 
  has_user_profiles,
  has_reminders,
  has_follow_ups,
  has_templates,
  has_feedback,
  has_analytics,
  message_limit
) VALUES
  (
    'starter',
    5,
    2,
    ARRAY['professional'],
    false,
    false,
    false,
    false,
    false,
    false,
    500
  ),
  (
    'professional',
    20,
    4,
    ARRAY['professional', 'friendly', 'energetic', 'helpful'],
    true,
    true,
    true,
    true,
    true,
    true,
    2000
  ),
  (
    'enterprise',
    -1,
    7,
    ARRAY['professional', 'friendly', 'energetic', 'helpful'],
    true,
    true,
    true,
    true,
    true,
    true,
    10000
  )
ON CONFLICT (plan_type) DO UPDATE SET
  max_tours = EXCLUDED.max_tours,
  max_languages = EXCLUDED.max_languages,
  available_styles = EXCLUDED.available_styles,
  has_user_profiles = EXCLUDED.has_user_profiles,
  has_reminders = EXCLUDED.has_reminders,
  has_follow_ups = EXCLUDED.has_follow_ups,
  has_templates = EXCLUDED.has_templates,
  has_feedback = EXCLUDED.has_feedback,
  has_analytics = EXCLUDED.has_analytics,
  message_limit = EXCLUDED.message_limit;