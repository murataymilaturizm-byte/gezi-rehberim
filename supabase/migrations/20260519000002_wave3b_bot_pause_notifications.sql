-- Wave 3B: Bot pause + admin notifications

-- 1. Bot pause on whatsapp_user_profiles
ALTER TABLE public.whatsapp_user_profiles
  ADD COLUMN IF NOT EXISTS bot_paused       BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS bot_paused_until TIMESTAMPTZ;

-- 2. Admin notifications table
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID        NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL,   -- new_reservation | ai_failure | cancellation | message
  title       TEXT        NOT NULL,
  description TEXT,
  metadata    JSONB,
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notif_agency
  ON public.admin_notifications(agency_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_notif_unread
  ON public.admin_notifications(agency_id, is_read)
  WHERE is_read = false;

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency users read own notifications"
  ON public.admin_notifications FOR SELECT
  USING (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()));

CREATE POLICY "Agency users update own notifications"
  ON public.admin_notifications FOR UPDATE
  USING (agency_id IN (SELECT id FROM public.agencies WHERE user_id = auth.uid()));

-- Realtime
ALTER TABLE public.admin_notifications REPLICA IDENTITY FULL;
