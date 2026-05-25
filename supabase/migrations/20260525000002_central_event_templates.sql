-- ============================================================
-- TURZZ MERKEZİ BİLDİRİM — PARÇA 1 (Altyapı)
-- 2/4: central_event_templates — Olay tipi → Meta template eşleştirmesi
-- ============================================================
-- İdempotent. Seed VERİSİ YOK — eşleştirmeyi PARÇA 2'deki super_admin UI girecek.

CREATE TABLE IF NOT EXISTS public.central_event_templates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT        NOT NULL,
  template_key TEXT        NOT NULL,
  language     TEXT        NOT NULL DEFAULT 'tr',
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Aynı olay+dil için tek eşleştirme (aktif olsun olmasın — duplicate'i baştan engelle).
-- "Tek aktif eşleştirme" semantiği UI seviyesinde (active'i değiştirirken eskisi pasifleştirilir).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_central_event_templates_event_lang
  ON public.central_event_templates (event_type, language);

COMMENT ON TABLE  public.central_event_templates IS
  'Olay tipi (new_agency_signup / new_contact_form / new_reservation) → Meta onaylı template_key + language eşleştirmesi. Merkezi bildirim gönderiminde hangi şablon kullanılacağını belirler.';
COMMENT ON COLUMN public.central_event_templates.event_type IS
  'Geçerli değerler: ''new_agency_signup'', ''new_contact_form'', ''new_reservation''. Validation app katmanında.';
COMMENT ON COLUMN public.central_event_templates.template_key IS
  'Meta WhatsApp Business Manager''da kayıtlı, APPROVED durumdaki template adı (örn. "turzz_new_agency_v1"). PARÇA 2 UI''sı super_admin''e mevcut Meta template''lerini sunar.';
COMMENT ON COLUMN public.central_event_templates.language IS
  'Meta''da kayıtlı dil kodu (sync-meta-templates ile aynı normalize format — örn. ''tr'', ''en'').';

ALTER TABLE public.central_event_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "central_event_templates_super_admin_all" ON public.central_event_templates;
CREATE POLICY "central_event_templates_super_admin_all"
  ON public.central_event_templates
  FOR ALL
  TO authenticated
  USING      (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

COMMENT ON POLICY "central_event_templates_super_admin_all" ON public.central_event_templates IS
  'Yalnızca super_admin yönetir. service_role (edge function) RLS bypass ile event → template çözümlemesi için okur.';
