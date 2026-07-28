-- F-R1 (2026-07-28): Conversion-paydası = GERÇEK konuşma sayısı (distinct phone).
-- Eski panel-hesabı whatsapp_conversations SATIR-sayısını (user+assistant+system-state
-- dahil) "konuşma" diye kullanıyordu → yapısal-yanıltıcı oran (kanıt: fbad140f 6-ay
-- 1312 satır vs 4 gerçek konuşma). Supabase-js'te distinct-count + default 1000-satır
-- limiti nedeniyle RPC (SECURITY INVOKER → RLS aynen uygulanır; panel-kullanıcı yalnız
-- kendi acentesini sayabilir, super_admin policy'si p_agency_id=null'a izin verir).
CREATE OR REPLACE FUNCTION count_distinct_conversation_phones(
  p_agency_id uuid,
  p_start timestamptz,
  p_end timestamptz
) RETURNS integer
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT COUNT(DISTINCT phone)::int
  FROM whatsapp_conversations
  WHERE created_at >= p_start AND created_at <= p_end
    AND (p_agency_id IS NULL OR agency_id = p_agency_id);
$$;
