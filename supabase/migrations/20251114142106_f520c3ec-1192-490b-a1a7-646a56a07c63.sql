-- =============================================
-- RATE LIMITING - SPAM KORUMASI
-- =============================================

-- Contact form için rate limiting fonksiyonu
CREATE OR REPLACE FUNCTION public.check_contact_form_rate_limit(_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_submissions integer;
BEGIN
  -- Son 10 dakikadaki submission sayısını kontrol et
  SELECT COUNT(*)
  INTO recent_submissions
  FROM public.contact_forms
  WHERE 
    email = _email 
    AND created_at > (NOW() - INTERVAL '10 minutes');
  
  -- 3'ten fazla submission varsa engelle
  IF recent_submissions >= 3 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Comment ekle
COMMENT ON FUNCTION public.check_contact_form_rate_limit IS 
'Checks if an email has submitted more than 3 contact forms in the last 10 minutes. Returns false if rate limit exceeded.';


-- =============================================
-- INPUT VALIDATION - GÜVENLİK
-- =============================================

-- Email validation fonksiyonu
CREATE OR REPLACE FUNCTION public.is_valid_email(_email text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN _email ~ '^[a-zA-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$';
END;
$$;

-- Phone validation fonksiyonu (Turkish format)
CREATE OR REPLACE FUNCTION public.is_valid_phone(_phone text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- +90XXXXXXXXXX or 05XXXXXXXXX format
  RETURN _phone ~ '^\+?[0-9]{10,15}$';
END;
$$;

-- Sanitize text fonksiyonu (XSS protection)
CREATE OR REPLACE FUNCTION public.sanitize_text(_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove potential script tags and dangerous characters
  RETURN regexp_replace(
    regexp_replace(_text, '<script[^>]*>.*?</script>', '', 'gi'),
    '[<>]', '', 'g'
  );
END;
$$;


-- =============================================
-- CONTACT FORM GÜVENLİK TRIGGER'I
-- =============================================

-- Contact form trigger fonksiyonu
CREATE OR REPLACE FUNCTION public.validate_contact_form()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Email validation
  IF NOT is_valid_email(NEW.email) THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;
  
  -- Rate limiting check
  IF NOT check_contact_form_rate_limit(NEW.email) THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please try again in 10 minutes.';
  END IF;
  
  -- Sanitize message (XSS protection)
  NEW.message := sanitize_text(NEW.message);
  NEW.name := sanitize_text(NEW.name);
  
  -- Length validation
  IF LENGTH(NEW.name) < 2 OR LENGTH(NEW.name) > 100 THEN
    RAISE EXCEPTION 'Name must be between 2 and 100 characters';
  END IF;
  
  IF LENGTH(NEW.message) < 10 OR LENGTH(NEW.message) > 2000 THEN
    RAISE EXCEPTION 'Message must be between 10 and 2000 characters';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger'ı ekle (eğer yoksa)
DROP TRIGGER IF EXISTS validate_contact_form_trigger ON public.contact_forms;

CREATE TRIGGER validate_contact_form_trigger
BEFORE INSERT ON public.contact_forms
FOR EACH ROW
EXECUTE FUNCTION public.validate_contact_form();


-- =============================================
-- İNDEXLER - PERFORMANS
-- =============================================

-- Contact forms email index (rate limiting için)
CREATE INDEX IF NOT EXISTS idx_contact_forms_email_created 
ON public.contact_forms(email, created_at DESC);

-- Contact forms created_at index (cleanup için)
CREATE INDEX IF NOT EXISTS idx_contact_forms_created_at 
ON public.contact_forms(created_at DESC);