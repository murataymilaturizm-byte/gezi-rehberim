-- =============================================
-- KRİTİK GÜVENLİK DÜZELTMELERİ - DÜZELTİLMİŞ VERSİYON
-- =============================================

-- 1. AGENCIES TABLOSU - RLS POLİCY GÜÇLENDİRME
-- Twilio credentials sadece kendi agency'si tarafından görülebilir

DROP POLICY IF EXISTS "Agencies can view own data" ON public.agencies;

CREATE POLICY "Agencies can view own data securely" 
ON public.agencies 
FOR SELECT 
TO authenticated
USING (
  user_id = auth.uid() OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS "Agencies can update own data" ON public.agencies;

CREATE POLICY "Agencies can update own data securely" 
ON public.agencies 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());


-- 2. get_user_agency_id FONKSÄ°YONUNU GÜÇLENDÄ°R (DROP YERÄ°NE CREATE OR REPLACE)

CREATE OR REPLACE FUNCTION public.get_user_agency_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id 
  FROM public.agencies 
  WHERE user_id = _user_id 
  LIMIT 1
$$;


-- 3. REGISTRATIONS POLICY'LERÄ°NÄ° GÜÇLENDİR

DROP POLICY IF EXISTS "Agencies can view own registrations" ON public.registrations;
DROP POLICY IF EXISTS "Agencies can manage own registrations" ON public.registrations;

CREATE POLICY "Agencies can view own registrations securely" 
ON public.registrations 
FOR SELECT 
TO authenticated
USING (
  agency_id = get_user_agency_id(auth.uid()) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Agencies can insert own registrations" 
ON public.registrations 
FOR INSERT 
TO authenticated
WITH CHECK (
  agency_id = get_user_agency_id(auth.uid()) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Agencies can update own registrations" 
ON public.registrations 
FOR UPDATE 
TO authenticated
USING (
  agency_id = get_user_agency_id(auth.uid()) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  agency_id = get_user_agency_id(auth.uid()) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Agencies can delete own registrations" 
ON public.registrations 
FOR DELETE 
TO authenticated
USING (
  agency_id = get_user_agency_id(auth.uid()) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);


-- 4. WHATSAPP USER PROFILES GÜVENLİK GÜÇLENDİRME

DROP POLICY IF EXISTS "Agencies can view own user profiles" ON public.whatsapp_user_profiles;
DROP POLICY IF EXISTS "Agencies can manage own user profiles" ON public.whatsapp_user_profiles;

CREATE POLICY "Agencies can view own user profiles securely" 
ON public.whatsapp_user_profiles 
FOR SELECT 
TO authenticated
USING (
  agency_id = get_user_agency_id(auth.uid()) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Agencies can insert own user profiles" 
ON public.whatsapp_user_profiles 
FOR INSERT 
TO authenticated
WITH CHECK (
  agency_id = get_user_agency_id(auth.uid()) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Agencies can update own user profiles" 
ON public.whatsapp_user_profiles 
FOR UPDATE 
TO authenticated
USING (
  agency_id = get_user_agency_id(auth.uid()) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  agency_id = get_user_agency_id(auth.uid()) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Agencies can delete own user profiles" 
ON public.whatsapp_user_profiles 
FOR DELETE 
TO authenticated
USING (
  agency_id = get_user_agency_id(auth.uid()) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);


-- 5. TÜM FONKSİYONLARA SEARCH_PATH EKLE

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_customer_tags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.tags IS NULL THEN
    NEW.tags := ARRAY[]::text[];
  END IF;
  
  NEW.tags := array_remove(NEW.tags, 'vip');
  NEW.tags := array_remove(NEW.tags, 'regular');
  NEW.tags := array_remove(NEW.tags, 'potential');
  NEW.tags := array_remove(NEW.tags, 'inactive');
  
  IF NEW.total_bookings >= 3 OR NEW.total_spent >= 10000 THEN
    NEW.tags := array_append(NEW.tags, 'vip');
  ELSIF NEW.total_bookings >= 2 THEN
    NEW.tags := array_append(NEW.tags, 'regular');
  ELSIF NEW.total_bookings = 0 AND NEW.total_messages > 0 THEN
    NEW.tags := array_append(NEW.tags, 'potential');
  END IF;
  
  IF NEW.last_interaction_at < (NOW() - INTERVAL '90 days') THEN
    NEW.tags := array_append(NEW.tags, 'inactive');
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_booking_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  tour_price numeric;
BEGIN
  SELECT td.price_adult * NEW.pax
  INTO tour_price
  FROM public.tour_dates td
  WHERE td.id = NEW.tour_date_id;
  
  UPDATE public.whatsapp_user_profiles
  SET 
    total_bookings = total_bookings + 1,
    total_spent = total_spent + COALESCE(tour_price, 0)
  WHERE phone = NEW.phone AND agency_id = NEW.agency_id;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_monthly_message_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.agencies
  SET 
    monthly_message_count = 0,
    last_message_reset_date = now()
  WHERE 
    EXTRACT(DAY FROM last_message_reset_date) != EXTRACT(DAY FROM now())
    AND EXTRACT(DAY FROM now()) = 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_conversations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  DELETE FROM public.whatsapp_conversations
  WHERE 
    agency_id IN (SELECT id FROM public.agencies WHERE plan_type = 'starter')
    AND created_at < now() - interval '30 days';

  DELETE FROM public.whatsapp_conversations
  WHERE 
    agency_id IN (SELECT id FROM public.agencies WHERE plan_type = 'professional')
    AND created_at < now() - interval '90 days';
    
  DELETE FROM public.whatsapp_conversation_summaries
  WHERE 
    agency_id IN (SELECT id FROM public.agencies WHERE plan_type = 'starter')
    AND created_at < now() - interval '30 days';
    
  DELETE FROM public.whatsapp_conversation_summaries
  WHERE 
    agency_id IN (SELECT id FROM public.agencies WHERE plan_type = 'professional')
    AND created_at < now() - interval '90 days';
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$function$;