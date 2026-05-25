-- ============================================================
-- TURZZ MERKEZİ BİLDİRİM — PARÇA 1 (Altyapı)
-- 3/4: agencies tablosuna TURZZ_CENTRAL_AGENCY_ID placeholder satırı
-- ============================================================
-- AMAÇ:
--   template_send_log.agency_id NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE.
--   Merkezi gönderim için bu UUID kullanılır — FK ihlalini önlemek üzere agencies tablosunda
--   rezerve sistem satırı oluşturulur. Bu yaklaşım FK'yi koruyarak diğer tabloları bozmaz.
--
-- İZOLASYON GARANTİLERİ (sızıntı incelemesi):
--   1) user_id = NULL  → get_user_agency_id() hiçbir kullanıcı için bu id'yi döndürmez
--      (SELECT id FROM agencies WHERE user_id = _user_id LIMIT 1). Yani normal acente
--      RLS kontrolleri (agency_id = get_user_agency_id(auth.uid())) bu satıra erişim VERMEZ.
--   2) active = FALSE  → "aktif acente" filtresi olan akışlar (örn. webhook resolver) bu satırı
--      görmezden gelir. resolveAgencyByPhoneNumberId .eq('active', true) kullanıyor.
--   3) name = 'Turzz (System)' prefix'i ile insan-okur format — super_admin paneli bu satırı
--      görür, ancak ismiyle ayırt edilir. PARÇA 2 UI'sı liste filtresine
--      "WHERE id != TURZZ_CENTRAL_AGENCY_ID" eklemelidir (bu PARÇA 1'in dışında — uyarı eklendi).
--   4) Hiçbir alt tabloya (tours/tour_dates/registrations/whatsapp_conversations) bu id ile
--      satır eklenmez. ON DELETE CASCADE FK'leri bu satırı tek başına bırakır.
--
-- PARÇA 2 UYARILARI (uygulama tarafı izolasyonu):
--   - AgencyManagement.tsx loadAgencies() filtre eklenmeli (PARÇA 2).
--   - İstatistik/sayım sorgularına dikkat — getCentralAgencyId() helper'ı PARÇA 2'de
--     frontend için tek-kaynak constant olarak konacak.

INSERT INTO public.agencies (
  id,
  name,
  active,
  user_id,
  plan_type,
  subscription_status
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Turzz (System)',
  FALSE,
  NULL,
  'enterprise',
  'active'
) ON CONFLICT (id) DO NOTHING;

-- Sistem satırının kim olduğunu DB seviyesinde dökümante et (super_admin SQL Editor'de görsün).
COMMENT ON TABLE public.agencies IS
  'Tur acenteleri. REZERVE id: ''11111111-1111-1111-1111-111111111111'' = Turzz merkezi sistem placeholder''ı (active=FALSE, user_id=NULL) — template_send_log FK için kullanılır, normal acente akışlarına dahil değildir.';
