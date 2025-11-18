-- Add unique constraint to whatsapp_user_profiles for proper upsert
ALTER TABLE public.whatsapp_user_profiles
ADD CONSTRAINT whatsapp_user_profiles_phone_agency_unique 
UNIQUE (phone, agency_id);