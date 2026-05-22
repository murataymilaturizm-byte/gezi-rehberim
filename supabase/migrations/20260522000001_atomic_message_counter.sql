-- K3: Atomic message counter increment (race condition fix)
-- Fire-and-forget UPDATE x = x + 1 yerine atomic RPC.
-- Postgres UPDATE ... SET x = x + 1 zaten atomic; RPC sadece tek noktadan çağrı + log için.
--
-- Kullanım (edge function): supabase.rpc("increment_agency_message_count", { p_agency_id: agency.id })
-- Paralel mesajlarda sayaç kaybı önlenir.

CREATE OR REPLACE FUNCTION public.increment_agency_message_count(p_agency_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.agencies
  SET monthly_message_count = COALESCE(monthly_message_count, 0) + 1
  WHERE id = p_agency_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_agency_message_count FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_agency_message_count TO service_role;

COMMENT ON FUNCTION public.increment_agency_message_count IS
  'K3: Atomic monthly_message_count++ — race-safe (Postgres UPDATE SET col=col+1 native atomic).';
