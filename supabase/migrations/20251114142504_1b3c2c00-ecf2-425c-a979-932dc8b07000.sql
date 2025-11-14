-- API Rate Limiting Tablosu
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL, -- IP adresi veya user_id
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_endpoint 
ON public.api_rate_limits(identifier, endpoint, window_start);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start 
ON public.api_rate_limits(window_start);

-- Rate limit kontrolü için fonksiyon
CREATE OR REPLACE FUNCTION public.check_api_rate_limit(
  _identifier TEXT,
  _endpoint TEXT,
  _max_requests INTEGER DEFAULT 100,
  _window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_count INTEGER;
  window_start TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Mevcut window'u bul
  window_start := date_trunc('minute', now()) - (EXTRACT(MINUTE FROM now())::INTEGER % _window_minutes || ' minutes')::INTERVAL;
  
  -- Mevcut window'daki request sayısını al
  SELECT COALESCE(SUM(request_count), 0)
  INTO request_count
  FROM public.api_rate_limits
  WHERE 
    identifier = _identifier 
    AND endpoint = _endpoint
    AND window_start >= window_start;
  
  -- Limit aşıldı mı kontrol et
  IF request_count >= _max_requests THEN
    RETURN FALSE;
  END IF;
  
  -- Request'i kaydet veya güncelle
  INSERT INTO public.api_rate_limits (identifier, endpoint, request_count, window_start)
  VALUES (_identifier, _endpoint, 1, window_start)
  ON CONFLICT (id) 
  DO UPDATE SET request_count = api_rate_limits.request_count + 1;
  
  RETURN TRUE;
END;
$$;

-- Eski rate limit kayıtlarını temizleme fonksiyonu
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1 saatten eski kayıtları sil
  DELETE FROM public.api_rate_limits
  WHERE window_start < now() - INTERVAL '1 hour';
END;
$$;

-- RLS politikaları (sadece service role erişebilir)
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Kimse direkt erişemez, sadece fonksiyonlar üzerinden
CREATE POLICY "No direct access to rate limits"
ON public.api_rate_limits
FOR ALL
USING (false);