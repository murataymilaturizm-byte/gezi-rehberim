-- Add customer tags and feedback tracking to whatsapp_user_profiles
ALTER TABLE public.whatsapp_user_profiles 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS last_feedback_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_follow_up_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS feedback_score integer,
ADD COLUMN IF NOT EXISTS feedback_comment text,
ADD COLUMN IF NOT EXISTS total_bookings integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_spent numeric DEFAULT 0;

COMMENT ON COLUMN public.whatsapp_user_profiles.tags IS 'Customer tags like VIP, regular, potential, etc.';
COMMENT ON COLUMN public.whatsapp_user_profiles.last_feedback_sent_at IS 'Last time feedback survey was sent';
COMMENT ON COLUMN public.whatsapp_user_profiles.last_follow_up_sent_at IS 'Last time follow-up message was sent';
COMMENT ON COLUMN public.whatsapp_user_profiles.feedback_score IS 'Customer satisfaction score (1-5)';
COMMENT ON COLUMN public.whatsapp_user_profiles.feedback_comment IS 'Customer feedback comment';
COMMENT ON COLUMN public.whatsapp_user_profiles.total_bookings IS 'Total number of bookings made';
COMMENT ON COLUMN public.whatsapp_user_profiles.total_spent IS 'Total amount spent by customer';

-- Create index for tags
CREATE INDEX IF NOT EXISTS idx_whatsapp_user_profiles_tags ON public.whatsapp_user_profiles USING GIN(tags);

-- Create function to auto-update customer tags based on activity
CREATE OR REPLACE FUNCTION public.update_customer_tags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Initialize tags if null
  IF NEW.tags IS NULL THEN
    NEW.tags := ARRAY[]::text[];
  END IF;
  
  -- Remove old auto-tags (keep manual tags)
  NEW.tags := array_remove(NEW.tags, 'vip');
  NEW.tags := array_remove(NEW.tags, 'regular');
  NEW.tags := array_remove(NEW.tags, 'potential');
  NEW.tags := array_remove(NEW.tags, 'inactive');
  
  -- VIP: 3+ bookings or 10000+ TL spent
  IF NEW.total_bookings >= 3 OR NEW.total_spent >= 10000 THEN
    NEW.tags := array_append(NEW.tags, 'vip');
  -- Regular: 2+ bookings
  ELSIF NEW.total_bookings >= 2 THEN
    NEW.tags := array_append(NEW.tags, 'regular');
  -- Potential: messaged but no bookings
  ELSIF NEW.total_bookings = 0 AND NEW.total_messages > 0 THEN
    NEW.tags := array_append(NEW.tags, 'potential');
  END IF;
  
  -- Inactive: no interaction in 90+ days
  IF NEW.last_interaction_at < (NOW() - INTERVAL '90 days') THEN
    NEW.tags := array_append(NEW.tags, 'inactive');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-tagging
DROP TRIGGER IF EXISTS trigger_update_customer_tags ON public.whatsapp_user_profiles;
CREATE TRIGGER trigger_update_customer_tags
  BEFORE INSERT OR UPDATE OF total_bookings, total_spent, last_interaction_at
  ON public.whatsapp_user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_tags();

-- Create function to update booking stats when registration is created
CREATE OR REPLACE FUNCTION public.update_user_booking_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tour_price numeric;
BEGIN
  -- Get tour price
  SELECT td.price_adult * NEW.pax
  INTO tour_price
  FROM public.tour_dates td
  WHERE td.id = NEW.tour_date_id;
  
  -- Update user profile stats
  UPDATE public.whatsapp_user_profiles
  SET 
    total_bookings = total_bookings + 1,
    total_spent = total_spent + COALESCE(tour_price, 0)
  WHERE phone = NEW.phone AND agency_id = NEW.agency_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger for booking stats update
DROP TRIGGER IF EXISTS trigger_update_booking_stats ON public.registrations;
CREATE TRIGGER trigger_update_booking_stats
  AFTER INSERT ON public.registrations
  FOR EACH ROW
  WHEN (NEW.status = 'CONFIRMED')
  EXECUTE FUNCTION public.update_user_booking_stats();