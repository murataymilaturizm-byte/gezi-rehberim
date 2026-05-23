-- ============================================================
-- L1(a) READ-ONLY: Mevcut DB'de duplicate meta_phone_number_id var mı?
--
-- KULLANIM:
--   Bu dosyayı Supabase Studio → SQL Editor'da ÇALIŞTIR.
--   Hiçbir şey değiştirmez (sadece SELECT).
--   Çıktıyı raporla — sonucu görmeden L1(b/c/d) ve UNIQUE constraint
--   ÇALIŞTIRMA (yoksa CREATE UNIQUE INDEX patlar).
-- ============================================================

-- 1) Duplicate meta_phone_number_id'leri listele
--    (trim sonrası aynı olanları da yakalar — trailing space dahil)
SELECT
  TRIM(meta_phone_number_id) AS phone_id_normalized,
  COUNT(*) AS agency_count,
  array_agg(
    json_build_object(
      'id', id,
      'name', name,
      'raw_phone_id', '[' || meta_phone_number_id || ']',  -- köşeli parantezle trailing space görselleştir
      'len', LENGTH(meta_phone_number_id),
      'webhook_subscribed', webhook_subscribed,
      'whatsapp_status', whatsapp_status,
      'has_token', meta_access_token IS NOT NULL,
      'active', active,
      'created_at', created_at
    )
    ORDER BY created_at
  ) AS agency_details
FROM public.agencies
WHERE meta_phone_number_id IS NOT NULL
GROUP BY TRIM(meta_phone_number_id)
HAVING COUNT(*) > 1
ORDER BY agency_count DESC;

-- 2) Trailing/leading whitespace olanları listele (duplicate olmasa bile)
SELECT
  id, name,
  '[' || meta_phone_number_id || ']' AS phone_id_with_brackets,
  LENGTH(meta_phone_number_id) AS len,
  LENGTH(TRIM(meta_phone_number_id)) AS trimmed_len,
  whatsapp_status, active, created_at
FROM public.agencies
WHERE meta_phone_number_id IS NOT NULL
  AND meta_phone_number_id <> TRIM(meta_phone_number_id)
ORDER BY created_at;

-- 3) meta_waba_id ve whatsapp_phone_number için aynı kontrol
SELECT
  TRIM(meta_waba_id) AS waba_id_normalized,
  COUNT(*) AS agency_count,
  array_agg(name ORDER BY created_at) AS names
FROM public.agencies
WHERE meta_waba_id IS NOT NULL
GROUP BY TRIM(meta_waba_id)
HAVING COUNT(*) > 1;

-- ÇIKTI YORUMU:
-- (1) boş satır dönerse → duplicate phone_number_id YOK → L1(b/c/d)'yi güvenle çalıştırabilirsin
-- (1) satır dönerse → ÖNCE manuel temizlik (veri taşıma + duplicate silme) yapmadan L1(d) UNIQUE patlar
-- (2) boş satır dönerse → trailing space YOK
-- (2) satır dönerse → L1(c) normalize bu kayıtları temizleyecek
-- (3) waba_id duplicate → genelde NORMAL (aynı işletme birden fazla acente olabilir farklı phone'larda)
--     ama aynı waba_id + aynı phone_id ise yine duplicate (1.sorgu da yakalar)
