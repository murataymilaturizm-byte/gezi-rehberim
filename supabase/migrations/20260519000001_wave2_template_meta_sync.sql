-- Wave 2: Meta template sync columns + send log table

-- message_templates: Meta status tracking
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS meta_template_id  TEXT,
  ADD COLUMN IF NOT EXISTS meta_status       TEXT,       -- APPROVED | PENDING | REJECTED | IN_APPEAL
  ADD COLUMN IF NOT EXISTS meta_category     TEXT,       -- UTILITY | MARKETING | AUTHENTICATION
  ADD COLUMN IF NOT EXISTS meta_last_synced_at TIMESTAMPTZ;

-- template_send_log: Track every manual template send
CREATE TABLE IF NOT EXISTS public.template_send_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id         UUID        NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  template_type     TEXT        NOT NULL,
  language          TEXT        NOT NULL,
  recipient_phone   TEXT        NOT NULL,
  recipient_name    TEXT,
  registration_id   UUID        REFERENCES public.registrations(id) ON DELETE SET NULL,
  success           BOOLEAN     NOT NULL,
  error_message     TEXT,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_send_log_agency_id ON public.template_send_log(agency_id);
CREATE INDEX IF NOT EXISTS idx_template_send_log_sent_at   ON public.template_send_log(sent_at DESC);

-- RLS
ALTER TABLE public.template_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency users can read own send log"
  ON public.template_send_log FOR SELECT
  USING (
    agency_id IN (
      SELECT id FROM public.agencies WHERE user_id = auth.uid()
    )
  );
