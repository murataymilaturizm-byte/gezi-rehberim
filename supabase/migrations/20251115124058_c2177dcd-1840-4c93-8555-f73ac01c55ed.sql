-- Fix check_api_rate_limit function - ambiguous column reference
DROP FUNCTION IF EXISTS public.check_api_rate_limit(text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.check_api_rate_limit(
  _identifier text,
  _endpoint text,
  _max_requests integer DEFAULT 100,
  _window_minutes integer DEFAULT 15
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_request_count INTEGER;
  current_window_start TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate current window start
  current_window_start := date_trunc('minute', now()) - 
    (EXTRACT(MINUTE FROM now())::INTEGER % _window_minutes || ' minutes')::INTERVAL;
  
  -- Get current request count for this window
  SELECT COALESCE(SUM(api_rate_limits.request_count), 0)
  INTO current_request_count
  FROM public.api_rate_limits
  WHERE 
    api_rate_limits.identifier = _identifier 
    AND api_rate_limits.endpoint = _endpoint
    AND api_rate_limits.window_start >= current_window_start;
  
  -- Check if limit is exceeded
  IF current_request_count >= _max_requests THEN
    RETURN FALSE;
  END IF;
  
  -- Insert or update request count
  INSERT INTO public.api_rate_limits (identifier, endpoint, request_count, window_start)
  VALUES (_identifier, _endpoint, 1, current_window_start)
  ON CONFLICT (identifier, endpoint, window_start) 
  DO UPDATE SET request_count = api_rate_limits.request_count + 1;
  
  RETURN TRUE;
END;
$function$;