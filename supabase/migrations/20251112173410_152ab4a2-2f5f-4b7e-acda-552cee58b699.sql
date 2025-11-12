-- Multi-tenant yapı için migration

-- 1. Roller için enum oluştur
CREATE TYPE public.app_role AS ENUM ('super_admin', 'agency');

-- 2. User roles tablosu
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Profiles tablosu (ek kullanıcı bilgileri için)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Agencies tablosu (Acenteler ve Twilio bilgileri)
CREATE TABLE public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  agency_name TEXT NOT NULL,
  twilio_account_sid TEXT NOT NULL,
  twilio_auth_token TEXT NOT NULL,
  twilio_phone_number TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

-- 5. Mevcut tablolara agency_id ekle
ALTER TABLE public.tours ADD COLUMN agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE;
ALTER TABLE public.tour_dates ADD COLUMN agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE;
ALTER TABLE public.registrations ADD COLUMN agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_conversations ADD COLUMN agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE;

-- 6. Security definer function (RLS için)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 7. Kullanıcının agency_id'sini döndüren function
CREATE OR REPLACE FUNCTION public.get_user_agency_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.agencies WHERE user_id = _user_id LIMIT 1
$$;

-- 8. Profile oluşturma trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 9. RLS Policies

-- user_roles policies
CREATE POLICY "Super admins can view all user roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can manage user roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

-- profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Super admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

-- agencies policies
CREATE POLICY "Agencies can view own data"
  ON public.agencies FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can manage agencies"
  ON public.agencies FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

-- tours policies (güncelleme)
DROP POLICY IF EXISTS "Turlar herkese açık" ON public.tours;
DROP POLICY IF EXISTS "Herkes tur ekleyebilir" ON public.tours;
DROP POLICY IF EXISTS "Herkes tur güncelleyebilir" ON public.tours;
DROP POLICY IF EXISTS "Herkes tur silebilir" ON public.tours;

CREATE POLICY "Agencies can view own tours"
  ON public.tours FOR SELECT
  USING (agency_id = public.get_user_agency_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Agencies can create own tours"
  ON public.tours FOR INSERT
  WITH CHECK (agency_id = public.get_user_agency_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Agencies can update own tours"
  ON public.tours FOR UPDATE
  USING (agency_id = public.get_user_agency_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Agencies can delete own tours"
  ON public.tours FOR DELETE
  USING (agency_id = public.get_user_agency_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

-- tour_dates policies (güncelleme)
DROP POLICY IF EXISTS "Tur tarihleri herkese açık" ON public.tour_dates;
DROP POLICY IF EXISTS "Herkes tur tarihi ekleyebilir" ON public.tour_dates;
DROP POLICY IF EXISTS "Herkes tur tarihi güncelleyebilir" ON public.tour_dates;
DROP POLICY IF EXISTS "Herkes tur tarihi silebilir" ON public.tour_dates;

CREATE POLICY "Agencies can view own tour dates"
  ON public.tour_dates FOR SELECT
  USING (agency_id = public.get_user_agency_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Agencies can manage own tour dates"
  ON public.tour_dates FOR ALL
  USING (agency_id = public.get_user_agency_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

-- registrations policies (güncelleme)
DROP POLICY IF EXISTS "Kayıtlar herkese açık" ON public.registrations;
DROP POLICY IF EXISTS "Herkes kayıt oluşturabilir" ON public.registrations;

CREATE POLICY "Agencies can view own registrations"
  ON public.registrations FOR SELECT
  USING (agency_id = public.get_user_agency_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Agencies can manage own registrations"
  ON public.registrations FOR ALL
  USING (agency_id = public.get_user_agency_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

-- whatsapp_conversations policies (güncelleme)
DROP POLICY IF EXISTS "Konuşmalar herkese açık" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Herkes konuşma ekleyebilir" ON public.whatsapp_conversations;

CREATE POLICY "Agencies can view own conversations"
  ON public.whatsapp_conversations FOR SELECT
  USING (agency_id = public.get_user_agency_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Agencies can manage own conversations"
  ON public.whatsapp_conversations FOR ALL
  USING (agency_id = public.get_user_agency_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));