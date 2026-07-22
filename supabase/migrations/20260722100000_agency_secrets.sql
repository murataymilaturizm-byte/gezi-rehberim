-- TOKEN GÜVENLİK AYRIŞTIRMASI (2026-07-22, Panel-Denetim-2 🔴 launch-öncesi-şart).
--
-- SORUN: agencies.meta_access_token vb. secret kolonlar acente-client SELECT'ine
-- açıktı (RLS satır-bazlı, kolon korumaz). Aymila kaydına MERKEZİ TourBot token'ı
-- yazılmıştı → cross-tenant erişim riski.
--
-- ÇÖZÜM: secret kolonları agency_secrets tablosuna taşı; RLS service_role-only
-- (authenticated'a HİÇBİR policy → deny). Edge-function'lar zaten service-role.
--
-- FAZ 1 (bu migration): tablo + veri kopyası. Kolonlar HENÜZ agencies'te (okuyucular
-- güncellenip deploy edilene kadar canlı bot bozulmasın). DROP ayrı migration (Faz 2).

CREATE TABLE IF NOT EXISTS public.agency_secrets (
  agency_id uuid PRIMARY KEY REFERENCES public.agencies(id) ON DELETE CASCADE,
  meta_access_token text,
  meta_verify_token text,
  whatsapp_api_key text,
  twilio_auth_token text,
  -- İş1c: manuel-bağlantıda merkezi token kazanırsa token'ın KENDİSİ yazılmaz;
  -- bu bayrak set edilir, gönderimde env WHATSAPP_ACCESS_TOKEN kullanılır.
  uses_central_token boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agency_secrets ENABLE ROW LEVEL SECURITY;
-- authenticated/anon'a HİÇBİR policy → RLS default-deny. Yalnız service_role
-- (RLS bypass) okur/yazar. Edge-function'lar service-role ile çalışır.

-- Mevcut değerleri taşı (secret'ı olan her acente).
INSERT INTO public.agency_secrets (agency_id, meta_access_token, meta_verify_token, whatsapp_api_key, twilio_auth_token)
SELECT id, meta_access_token, meta_verify_token, whatsapp_api_key, twilio_auth_token
FROM public.agencies
WHERE meta_access_token IS NOT NULL OR meta_verify_token IS NOT NULL
   OR whatsapp_api_key IS NOT NULL OR twilio_auth_token IS NOT NULL
ON CONFLICT (agency_id) DO NOTHING;
