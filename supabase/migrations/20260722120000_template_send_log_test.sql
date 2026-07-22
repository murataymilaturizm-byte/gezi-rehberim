-- İş3 (2026-07-22): "Kendine test gönder" — test gönderimleri gerçek gönderimlerden
-- ayırt edilebilsin (billing/rapor). MODE2 body.test=true → bu bayrak.
ALTER TABLE public.template_send_log
  ADD COLUMN IF NOT EXISTS test boolean NOT NULL DEFAULT false;
