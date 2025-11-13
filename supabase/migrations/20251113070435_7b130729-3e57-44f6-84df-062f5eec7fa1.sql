-- Agencies tablosuna mesaj sayacı ve limit bilgileri ekle
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS monthly_message_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_message_reset_date timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS message_limit integer;

-- Plan tipine göre varsayılan limitleri ayarla
UPDATE public.agencies 
SET message_limit = CASE 
  WHEN plan_type = 'starter' THEN 500
  WHEN plan_type = 'professional' THEN 2000
  WHEN plan_type = 'enterprise' THEN -1  -- -1 = sınırsız
  ELSE 500
END
WHERE message_limit IS NULL;

-- Mesaj sayacını sıfırlama fonksiyonu
CREATE OR REPLACE FUNCTION public.reset_monthly_message_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Her ayın ilk günü mesaj sayaçlarını sıfırla
  UPDATE public.agencies
  SET 
    monthly_message_count = 0,
    last_message_reset_date = now()
  WHERE 
    EXTRACT(DAY FROM last_message_reset_date) != EXTRACT(DAY FROM now())
    AND EXTRACT(DAY FROM now()) = 1;
END;
$$;

-- Eski konuşmaları temizleme fonksiyonu
CREATE OR REPLACE FUNCTION public.cleanup_old_conversations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Başlangıç planı: 30 gün
  DELETE FROM public.whatsapp_conversations
  WHERE 
    agency_id IN (
      SELECT id FROM public.agencies WHERE plan_type = 'starter'
    )
    AND created_at < now() - interval '30 days';

  -- Profesyonel plan: 90 gün
  DELETE FROM public.whatsapp_conversations
  WHERE 
    agency_id IN (
      SELECT id FROM public.agencies WHERE plan_type = 'professional'
    )
    AND created_at < now() - interval '90 days';
    
  -- Konuşma özetlerini de temizle
  DELETE FROM public.whatsapp_conversation_summaries
  WHERE 
    agency_id IN (
      SELECT id FROM public.agencies WHERE plan_type = 'starter'
    )
    AND created_at < now() - interval '30 days';
    
  DELETE FROM public.whatsapp_conversation_summaries
  WHERE 
    agency_id IN (
      SELECT id FROM public.agencies WHERE plan_type = 'professional'
    )
    AND created_at < now() - interval '90 days';
  
  -- Enterprise için temizleme yok (sınırsız)
END;
$$;

COMMENT ON COLUMN public.agencies.monthly_message_count IS 'Aylık gönderilen WhatsApp mesaj sayısı';
COMMENT ON COLUMN public.agencies.last_message_reset_date IS 'Mesaj sayacının son sıfırlanma tarihi';
COMMENT ON COLUMN public.agencies.message_limit IS 'Aylık mesaj limiti (-1 = sınırsız)';
COMMENT ON FUNCTION public.reset_monthly_message_counts() IS 'Her ayın ilk günü mesaj sayaçlarını sıfırlar';
COMMENT ON FUNCTION public.cleanup_old_conversations() IS 'Pakete göre eski konuşmaları temizler';