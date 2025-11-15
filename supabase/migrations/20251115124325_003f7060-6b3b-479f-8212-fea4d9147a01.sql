-- Add unique constraint to api_rate_limits table for ON CONFLICT
ALTER TABLE public.api_rate_limits
ADD CONSTRAINT api_rate_limits_unique UNIQUE (identifier, endpoint, window_start);