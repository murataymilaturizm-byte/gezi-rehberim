-- P2-A (2026-07-28): whatsapp_conversations → Supabase Realtime publication.
-- Panel Konuşmalar ekranı postgres_changes INSERT aboneliğiyle canlı güncellenir.
-- RLS zaten agency-scoped ("Agencies can view own conversations") → realtime
-- event'leri de aynı policy'den süzülür (başka acentenin mesajı DÜŞMEZ).
-- İdempotent: canlıda 2026-07-28'de elle uygulandı; tekrar-koşum hatasız geçer.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
  END IF;
END $$;
