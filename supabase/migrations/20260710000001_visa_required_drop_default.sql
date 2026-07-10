-- Panel-2 (2026-07-10): visa_required DEFAULT-false tuzağını kaldır.
--
-- SORUN: kolon `BOOLEAN DEFAULT false` idi → acentenin HİÇ dokunmadığı tur
-- "vize gerekmez" (false) verisi taşıyordu. Bot bunu güvenilmez sayıp mitige
-- ediyordu ama panel 3-durumlu hâle geldi (Belirtilmedi=NULL / Gerekli / Gerekmiyor).
--
-- DEĞİŞİKLİK: yalnız DEFAULT düşürülür → bundan sonra visa_required BELİRTİLMEDEN
-- eklenen tur NULL ("belirtilmedi") alır. Kolon zaten nullable.
--
-- MEVCUT VERİ DOKUNULMAZ: eski false/true satırlar aynen kalır (acente bilinçli
-- girmiş olabilir; toplu NULL'lama YAPILMAZ). Veri-temizliği (eski default-artığı
-- false'ları NULL'a çevirme + "false→gerçek 'vize gerekmez' cevabı" geçişi) AYRI
-- karar — bkz. ARCHITECTURE_GUARDS panel-denetim notu.
--
-- BOT UYUMU: process-message :10c ve helpers.ts zaten `visa_required === true`
-- kesin kontrolü kullanıyor → NULL, false ile aynı "else/veri-yok" dalına düşer
-- (muhafazakâr, davranış değişmez). Bot kodu/redeploy GEREKMEZ.

ALTER TABLE public.tours ALTER COLUMN visa_required DROP DEFAULT;
