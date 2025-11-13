# WhatsApp Tur Hatırlatma Sistemi 🔔

Otomatik tur hatırlatma sistemi - Tur 3 gün kala otomatik WhatsApp mesajı gönderir.

## Özellikler ✨

### 1. Otomatik Hatırlatmalar
- 📅 Tur 3 gün kala otomatik gönderim
- 🕐 Her gün sabah 09:00'da kontrol
- 📱 WhatsApp üzerinden gönderim
- ✅ Tek seferlik gönderim (tekrar gönderilmez)

### 2. Akıllı Mesaj İçeriği
- Kişiselleştirilmiş selamlama
- Tur detayları (isim, destinasyon, tarih)
- Hareket noktası ve toplanma saati
- Hazırlık önerileri (kimlik, hava durumu, ilaçlar)
- Rezervasyon numarası

### 3. Otomatik Takip
- Gönderilen hatırlatmalar işaretlenir
- Tekrar gönderim önlenir
- Detaylı loglama
- Hata yönetimi

## Sistem Mimarisi 🏗️

### Bileşenler

**1. Edge Function**: `send-tour-reminders`
- 3 gün sonraki turları bulur
- Hatırlatma mesajları oluşturur
- WhatsApp ile gönderir
- Veritabanını günceller

**2. Cron Job**: `daily-tour-reminders`
- Günlük sabah 09:00'da çalışır
- Edge function'ı tetikler
- pg_cron kullanır

**3. Database Field**: `reminder_sent`
- Hatırlatma gönderildi mi?
- Gönderim tarihi
- Index ile hızlı sorgulama

## Hatırlatma Mesajı Formatı 💬

```
🔔 *TUR HATIRLATMASI*

Merhaba Ahmet Yılmaz! 👋

📅 *15 Mayıs 2025 Çarşamba* tarihinde başlayacak turunuza *3 gün* kaldı!

🎯 *Tur:* Kapadokya Balayı Turu
📍 *Destinasyon:* Kapadokya
👥 *Kişi Sayısı:* 2

🚌 *Hareket Noktası:* Ankara Otogarı
🕐 *Toplanma Saati:* 07:00

📋 *Rezervasyon No:* abc12345

💼 *Hazırlıklar:*
✅ Kimliğinizi yanınıza almayı unutmayın
✅ Hava durumuna göre giyinin
✅ Gerekli ilaçlarınızı yanınıza alın

📞 Sorularınız için bizimle iletişime geçebilirsiniz.

🙏 İyi yolculuklar dileriz!
```

## Teknik Detaylar 🔧

### Veritabanı Şeması

```sql
-- registrations tablosuna eklenen alanlar
ALTER TABLE public.registrations
ADD COLUMN reminder_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN reminder_sent BOOLEAN DEFAULT false;

-- Performans için index
CREATE INDEX idx_registrations_reminder 
ON public.registrations(reminder_sent, tour_date_id) 
WHERE reminder_sent = false;
```

### Tarih Hesaplama

```typescript
// 3 gün sonraki tarihi hesapla
const threeDaysFromNow = new Date();
threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
threeDaysFromNow.setHours(0, 0, 0, 0); // Günün başı

const nextDay = new Date(threeDaysFromNow);
nextDay.setDate(nextDay.getDate() + 1); // Gün sonu

// SQL sorgusu
.gte('tour_dates.departure_date', threeDaysFromNow)
.lt('tour_dates.departure_date', nextDay)
.eq('reminder_sent', false)
```

### Cron Job Ayarı

```sql
SELECT cron.schedule(
  'daily-tour-reminders',
  '0 9 * * *', -- Her gün sabah 09:00 (UTC)
  $$
  SELECT net.http_post(
    url:='https://[PROJECT-ID].supabase.co/functions/v1/send-tour-reminders',
    headers:='{"Authorization": "Bearer [ANON-KEY]"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
```

**Not**: Cron zamanı UTC olarak ayarlanmıştır. Türkiye saati için +3 saat eklenmelidir.
- UTC 06:00 = TR 09:00
- UTC 09:00 = TR 12:00

### Rate Limiting

WhatsApp/Twilio rate limit'lerine uymak için:
```typescript
// Her mesaj arasında 1 saniye bekle
await new Promise(resolve => setTimeout(resolve, 1000));
```

## Kullanım Senaryoları 🎬

### Senaryo 1: Normal Akış
```
Tarih: 12 Mayıs 2025 09:00
Cron Job çalışır

→ 15 Mayıs'ta turu olan 5 rezervasyon bulunur
→ Her birine hatırlatma gönderilir
→ reminder_sent = true olarak işaretlenir

Sonuç: 5 mesaj gönderildi ✅
```

### Senaryo 2: Tekrar Gönderim Engelleme
```
Tarih: 12 Mayıs 2025 09:00 (İlk çalışma)
→ Ahmet'e hatırlatma gönderildi
→ reminder_sent = true

Tarih: 13 Mayıs 2025 09:00 (İkinci çalışma)
→ Ahmet'in kaydı atlanır (reminder_sent = true)
→ Tekrar mesaj gönderilmez ✅
```

### Senaryo 3: Birden Fazla Tarih
```
Tarih: 12 Mayıs 2025 09:00

15 Mayıs turları:
- 3 rezervasyon (3 mesaj gönderilir)

16 Mayıs turları:
- Atlanır (henüz 3 gün kalmadı)

19 Mayıs turları:
- Atlanır (daha fazla gün var)

Sonuç: Sadece 15 Mayıs için gönderim ✅
```

## Manuel Test 🧪

### Edge Function'ı Manuel Çalıştırma

Cron beklemeden test etmek için:

```bash
curl -X POST \
  https://ncuswacwpqcxhmlhvfgq.supabase.co/functions/v1/send-tour-reminders \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Test İçin Tarih Düzenleme

Test amaçlı 3 gün sonraya tarih ekleyin:

```sql
-- Test için 3 gün sonraya tur ekle
UPDATE tour_dates 
SET departure_date = CURRENT_DATE + INTERVAL '3 days'
WHERE id = 'test-tour-date-id';

-- Hatırlatma flag'ini sıfırla
UPDATE registrations 
SET reminder_sent = false, reminder_sent_at = null
WHERE tour_date_id = 'test-tour-date-id';
```

## Monitoring & Loglar 📊

### Edge Function Logları

Loglar şunları gösterir:
- Kaç rezervasyon bulundu
- Kaç mesaj gönderildi
- Hatalar ve başarısız gönderimler
- İşlem süresi

```
🕐 Tour reminder job started at: 2025-05-12T09:00:00Z
📅 Looking for tours between: 2025-05-15 and 2025-05-16
📋 Found 5 registrations to remind
✅ Reminder sent to +905551234567 for tour: Kapadokya Turu
✅ Reminder sent to +905559876543 for tour: Efes Turu
...
✅ Reminder job completed. Sent: 5, Errors: 0
```

### Veritabanı Sorgulama

```sql
-- Hatırlatma gönderilen kayıtlar
SELECT 
  r.full_name,
  r.phone,
  t.title,
  td.departure_date,
  r.reminder_sent_at
FROM registrations r
JOIN tour_dates td ON r.tour_date_id = td.id
JOIN tours t ON r.tour_id = t.id
WHERE r.reminder_sent = true
ORDER BY r.reminder_sent_at DESC;

-- Henüz hatırlatma gönderilmemiş gelecek turlar
SELECT 
  r.full_name,
  t.title,
  td.departure_date,
  td.departure_date - CURRENT_DATE as days_until_tour
FROM registrations r
JOIN tour_dates td ON r.tour_date_id = td.id
JOIN tours t ON r.tour_id = t.id
WHERE r.reminder_sent = false
  AND td.departure_date > CURRENT_DATE
ORDER BY td.departure_date;
```

## Cron Job Yönetimi ⚙️

### Cron Job'ları Listeleme
```sql
SELECT * FROM cron.job;
```

### Cron Job'u Durdurma
```sql
SELECT cron.unschedule('daily-tour-reminders');
```

### Cron Job'u Yeniden Başlatma
```sql
-- Önce sil
SELECT cron.unschedule('daily-tour-reminders');

-- Sonra tekrar oluştur
SELECT cron.schedule(...);
```

### Cron Job Geçmişi
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-tour-reminders')
ORDER BY start_time DESC
LIMIT 10;
```

## Sorun Giderme 🔧

### Hatırlatmalar gönderilmiyor

**1. Cron job çalışıyor mu?**
```sql
SELECT * FROM cron.job WHERE jobname = 'daily-tour-reminders';
```

**2. Extension'lar aktif mi?**
```sql
SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
```

**3. Edge function loglarını kontrol et**
- Supabase Dashboard → Functions → send-tour-reminders → Logs

**4. Tarih kontrolü**
```sql
-- 3 gün sonraki turları kontrol et
SELECT 
  td.departure_date,
  COUNT(*) as registration_count
FROM tour_dates td
JOIN registrations r ON r.tour_date_id = td.id
WHERE td.departure_date = CURRENT_DATE + INTERVAL '3 days'
  AND r.reminder_sent = false
GROUP BY td.departure_date;
```

### Twilio hataları

**1. Credentials kontrolü**
```sql
SELECT 
  agency_name,
  twilio_phone_number IS NOT NULL as has_phone,
  twilio_account_sid IS NOT NULL as has_sid,
  twilio_auth_token IS NOT NULL as has_token
FROM agencies;
```

**2. Twilio Dashboard'da logs kontrol et**
- https://console.twilio.com/

**3. Rate limit kontrolü**
- Çok fazla mesaj gönderiliyor olabilir
- Bekleme süresini artırın (1000ms → 2000ms)

### Aynı mesaj tekrar gönderiliyor

**1. reminder_sent flag kontrolü**
```sql
SELECT id, full_name, reminder_sent, reminder_sent_at
FROM registrations
WHERE tour_date_id = 'problem-tour-date-id';
```

**2. Index var mı?**
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'registrations' 
  AND indexname = 'idx_registrations_reminder';
```

## Performans Optimizasyonu ⚡

### 1. Index Kullanımı
```sql
-- Mevcut index'i kontrol et
EXPLAIN ANALYZE
SELECT * FROM registrations
WHERE reminder_sent = false
  AND tour_date_id IN (
    SELECT id FROM tour_dates 
    WHERE departure_date = CURRENT_DATE + 3
  );
```

### 2. Batch Processing
Çok fazla kayıt varsa batch'ler halinde işle:
```typescript
const BATCH_SIZE = 50;
for (let i = 0; i < registrations.length; i += BATCH_SIZE) {
  const batch = registrations.slice(i, i + BATCH_SIZE);
  await processBatch(batch);
  await sleep(5000); // 5 saniye bekle
}
```

### 3. Paralel Gönderim
```typescript
// Dikkatli kullanın - rate limit'e takılabilir
await Promise.all(
  registrations.map(reg => sendReminder(reg))
);
```

## Gelecek Geliştirmeler 🔮

- [ ] Özelleştirilebilir hatırlatma süresi (1 gün, 7 gün)
- [ ] Birden fazla hatırlatma (7 gün + 1 gün kala)
- [ ] Email hatırlatması da gönder
- [ ] Kullanıcı tercihine göre hatırlatma (açma/kapama)
- [ ] Hatırlatma template'leri (özelleştirilebilir mesajlar)
- [ ] Dashboard'da hatırlatma istatistikleri
- [ ] Hava durumu bilgisi ekleme
- [ ] Tur sonrası teşekkür mesajı

## Maliyet Analizi 💵

### Twilio Maliyeti
- WhatsApp mesajı: ~$0.005 (her mesaj)
- 100 hatırlatma/gün = $0.50/gün
- 3000 hatırlatma/ay = $15/ay

### Supabase Maliyeti
- Edge function çağrısı: Ücretsiz (belirli limitlere kadar)
- Cron job: Ücretsiz
- Veritabanı: Mevcut plan dahilinde

---

**Önemli Notlar:**
1. Cron job UTC saat diliminde çalışır (Türkiye +3 saat)
2. Twilio credentials doğru ayarlanmalı
3. Test aşamasında küçük gruplarla deneyin
4. Rate limit'lere dikkat edin
5. Logları düzenli kontrol edin
