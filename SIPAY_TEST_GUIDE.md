# Sipay Ödeme Testi Rehberi

## ✅ Entegrasyon Kontrol

Tüm gerekli bileşenler hazır:
- ✅ Sipay API anahtarları (SIPAY_MERCHANT_ID, SIPAY_APP_SECRET) eklendi
- ✅ Edge functions (sipay-payment, sipay-callback) oluşturuldu
- ✅ Ödeme UI bileşenleri (SubscriptionHistory, PaymentStatusIndicator) hazır
- ✅ Config.toml ayarları yapıldı

## 🧪 Test Adımları

### 1. Giriş Yap
1. Uygulamaya giriş yap (trendyol1@turzz.com)
2. Admin paneline git

### 2. Abonelik Sayfasına Git
1. Sol menüden **"Abonelik"** seçeneğine tıkla
2. Mevcut planını ve trial durumunu gör

### 3. Test Senaryoları

#### Senaryo A: Aylık Plan Satın Alma
1. Bir plan kartındaki **"Satın Al"** butonuna tıkla
2. **"Aylık"** seçeneğini seç
3. **"Ödemeye Geç"** butonuna tıkla
4. Ödeme durumu modalı açılacak:
   - ⏳ "Pending" - Ödeme başlatılıyor
   - 🔄 "Processing" - Sipay'a yönlendiriliyor
5. Sipay ödeme sayfasına yönlendirileceksin

#### Senaryo B: Yıllık Plan Satın Alma (%10 İndirimli)
1. **"Yıllık"** seçeneğini seç
2. İndirimli fiyatı gör
3. Ödeme işlemini başlat

## 💳 Test Kartları (Sipay Sandbox)

### Başarılı Ödeme Testi
```
Kart No: 4508034508034509
Son Kullanma: 12/26
CVV: 000
```

### Başarısız Ödeme Testi
```
Kart No: 5406675406675403
Son Kullanma: 12/26
CVV: 000
```

## 🔍 Test Sırasında Kontrol Edilecekler

### Frontend Kontrolleri
1. ✅ Ödeme butonu çalışıyor mu?
2. ✅ Modal doğru durumları gösteriyor mu? (pending → processing → completed/failed)
3. ✅ Sipay'a yönlendirme yapılıyor mu?
4. ✅ Fiyatlar doğru gösteriliyor mu?
   - Starter: 2,999₺/ay
   - Professional: 4,999₺/ay  
   - Enterprise: 7,999₺/ay
5. ✅ Yıllık seçimde %10 indirim uygulanıyor mu?

### Backend Kontrolleri (Console Logs)
1. Tarayıcı konsolunu aç (F12)
2. Network sekmesine git
3. Şunları kontrol et:
   - `sipay-payment` fonksiyonu başarıyla çağrıldı mı?
   - Response'da `payment_url` var mı?
   - `order_id` oluşturuldu mu?

### Database Kontrolleri
1. Admin panelde "Cloud" butonuna tıkla
2. "Payment Transactions" tablosuna bak
3. Kontrol et:
   - ✅ Yeni kayıt oluşturuldu mu?
   - ✅ Status "pending" olarak başladı mı?
   - ✅ Order ID ve tutarlar doğru mu?

## 🎯 Sipay Ödeme Sayfasında

1. Test kartı bilgilerini gir
2. 3D Secure doğrulaması yapılacak (test modda otomatik)
3. Ödeme tamamlanınca callback tetiklenecek

## 🔄 Callback Sonrası

### Başarılı Ödeme
1. `payment_transactions` tablosunda status "completed" olmalı
2. `agencies` tablosunda:
   - `subscription_status` = "active"
   - `subscription_ends_at` ayarlanmalı
   - `plan_type` güncellenmiş olmalı
3. `subscription_history` tablosuna yeni kayıt eklenmiş olmalı

### Başarısız Ödeme
1. `payment_transactions` status = "failed"
2. `subscription_history`'de failed kaydı
3. Kullanıcı mevcut plan ile devam eder

## 🐛 Debug İçin Log Kontrolleri

### Edge Function Logları
Admin panelde:
1. Cloud → Functions
2. "sipay-payment" seç → View Logs
3. "sipay-callback" seç → View Logs

Kontrol edilecek loglar:
```
🚀 Calling Sipay API
✅ Sipay response received
📥 Sipay callback received
🔍 Processing payment for order
✅ Transaction status updated
🎉 Subscription activated
```

## 📋 Test Checklist

- [ ] Aylık plan satın alma testi
- [ ] Yıllık plan satın alma testi
- [ ] Başarılı kart ile ödeme
- [ ] Başarısız kart ile ödeme
- [ ] Modal durum geçişleri
- [ ] Sipay'a yönlendirme
- [ ] Callback işleme
- [ ] Database güncellemeleri
- [ ] Subscription aktivasyonu
- [ ] Hata durumları

## ⚠️ Önemli Notlar

1. **Test Modu**: Şu anda sandbox URL kullanılıyor (`https://sandbox-api.sipay.com.tr`)
2. **Canlıya Geçiş**: `sipay-payment/index.ts` dosyasında URL'i `https://api.sipay.com.tr` olarak değiştir
3. **Email**: Şu anda billing@turzzai.com kullanılıyor - gerçek kullanıcı email'i eklenebilir
4. **Callback URL**: Sipay dashboard'da kayıtlı olmalı (SIPAY_SETUP.md'de açıklama var)

## 🚀 Canlıya Alma Öncesi

1. [ ] Tüm test senaryoları başarılı
2. [ ] Sipay'dan prodüksiyon API anahtarları al
3. [ ] Lovable'da secret'ları güncelle
4. [ ] `sipay-payment/index.ts`'de sandbox URL'i prod URL ile değiştir
5. [ ] Sipay dashboard'da callback URL'i kaydet
6. [ ] Son bir kez tüm akışı test et

## 📞 Destek

Sorun olursa:
1. Edge function loglarını kontrol et
2. Network sekmesini kontrol et
3. Database'de transaction kayıtlarına bak
4. Sipay desteğe başvur: destek@sipay.com.tr
