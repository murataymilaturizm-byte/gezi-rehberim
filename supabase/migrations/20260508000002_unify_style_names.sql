-- Problem 1: DB üslup adlarını FSM adlarıyla birleştir
-- Eşleştirme: professional→kurumsal, friendly→standart, energetic→dinamik, helpful→premium

UPDATE public.agencies SET conversation_style = 'kurumsal'  WHERE conversation_style = 'professional';
UPDATE public.agencies SET conversation_style = 'standart'  WHERE conversation_style IN ('friendly', 'basic');
UPDATE public.agencies SET conversation_style = 'dinamik'   WHERE conversation_style = 'energetic';
UPDATE public.agencies SET conversation_style = 'premium'   WHERE conversation_style = 'helpful';

-- CHECK constraint'i güncelle
ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS agencies_conversation_style_check;
ALTER TABLE public.agencies ADD CONSTRAINT agencies_conversation_style_check
  CHECK (conversation_style IN ('standart', 'kurumsal', 'dinamik', 'premium'));

-- plan_features.available_styles array'lerini güncelle
UPDATE public.plan_features
  SET available_styles = ARRAY['kurumsal']
  WHERE plan_type = 'starter';

UPDATE public.plan_features
  SET available_styles = ARRAY['standart', 'kurumsal', 'dinamik', 'premium']
  WHERE plan_type IN ('professional', 'enterprise');

-- Problem 3: Plan bazlı üslup kısıtını DB trigger ile uygula
CREATE OR REPLACE FUNCTION public.validate_conversation_style_against_plan()
RETURNS TRIGGER AS $$
DECLARE
  allowed_styles TEXT[];
BEGIN
  -- Plan'ın izin verdiği stilleri al
  SELECT available_styles INTO allowed_styles
  FROM public.plan_features
  WHERE plan_type = NEW.plan_type;

  -- available_styles bulunamazsa kısıt uygulama
  IF allowed_styles IS NULL THEN
    RETURN NEW;
  END IF;

  -- conversation_style izinli listede değilse plan'ın ilk stiline düşür
  IF NEW.conversation_style IS NOT NULL
     AND NOT (NEW.conversation_style = ANY(allowed_styles)) THEN
    NEW.conversation_style := allowed_styles[1];
    RAISE WARNING 'conversation_style "%" not allowed for plan "%" — defaulted to "%"',
      NEW.conversation_style, NEW.plan_type, allowed_styles[1];
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

DROP TRIGGER IF EXISTS enforce_conversation_style_plan ON public.agencies;
CREATE TRIGGER enforce_conversation_style_plan
  BEFORE INSERT OR UPDATE OF conversation_style, plan_type ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_conversation_style_against_plan();

-- Doğrulama sorguları (manuel çalıştır):
-- SELECT plan_type, available_styles FROM plan_features ORDER BY plan_type;
-- SELECT name, plan_type, conversation_style FROM agencies WHERE conversation_style IS NOT NULL;
-- UPDATE agencies SET conversation_style = 'dinamik' WHERE plan_type = 'starter' LIMIT 1;
-- (Sonuç 'kurumsal' olmalı — trigger devreye girmiş olmalı)
