-- TOKEN GÜVENLİK AYRIŞTIRMASI FAZ 2 (2026-07-22): secret kolonları DROP.
--
-- Faz 1 (20260722100000): agency_secrets tablosu + veri kopyası.
-- Okuyucular/yazıcılar güncellenip DEPLOY edildi (edge → agency_secrets;
-- panel-client token'ı hiç okumaz/yazmaz, superadmin admin-set-token action'dan).
-- Artık agencies + whatsapp_integrations secret kolonları KULLANILMIYOR → DROP.
--
-- whatsapp_integrations.meta_access_token: acente-okunabilir (own-RLS) idi →
-- İKİNCİ sızıntı yüzeyi. Kimse OKUMUYOR (yalnız yazılıyordu) → DROP güvenli.

ALTER TABLE public.agencies
  DROP COLUMN IF EXISTS meta_access_token,
  DROP COLUMN IF EXISTS meta_verify_token,
  DROP COLUMN IF EXISTS whatsapp_api_key,
  DROP COLUMN IF EXISTS twilio_auth_token;

ALTER TABLE public.whatsapp_integrations
  DROP COLUMN IF EXISTS meta_access_token;
