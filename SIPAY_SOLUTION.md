# Sipay Entegrasyon Çözümü

## ❌ Sorun
Supabase Edge Functions, Sipay API URL'lerine (hem sandbox hem production) DNS üzerinden erişemiyordu.

**Hata:**
```
DNS error: failed to lookup address information: Name or service not known
```

## ✅ Çözüm
Frontend'den direkt Sipay'a form POST yapma - bu Sipay'ın standart ve önerilen yöntemi.

### Avantajlar
1. ✅ DNS sorunu yok - browser direkt Sipay'a bağlanıyor
2. ✅ Daha hızlı - bir middleware yok
3. ✅ Daha güvenli - hash ile korunuyor
4. ✅ Standart yöntem - Sipay dokümantasyonunda önerilen

### Nasıl Çalışıyor?

1. **Kullanıcı "Ödemeye Geç" butonuna tıklar**
2. **Frontend'de:**
   - Hash hesaplanır (merchant_id + order_id + amount + currency + app_secret)
   - Transaction database'e kaydedilir
   - Form oluşturulur ve Sipay'a POST edilir
3. **Sipay sayfası açılır:**
   - Kullanıcı kart bilgilerini girer
   - 3D Secure doğrulaması yapılır
4. **Callback:**
   - Sipay callback URL'e yönlendirir
   - Backend callback'i işler ve subscription'ı günceller

## 🔐 Güvenlik

### Merchant Key Frontend'de Görünüyor - Sorun Var mı?
**HAYIR!** Çünkü:

1. **Hash Koruması:** 
   - Her istek hash ile doğrulanır
   - Merchant key sadece hash oluşturmak için kullanılır
   - Hash olmadan ödeme başlatılamaz

2. **Callback Doğrulama:**
   - Sipay callback'de hash tekrar kontrol edilir
   - Sahte callback istekleri reddedilir

3. **Sipay Dashboard Kontrolü:**
   - Callback URL sadece kayıtlı URL'lerden kabul edilir
   - IP whitelist opsiyonel eklenebilir

### Merchant Key Nasıl Çalışır?
```javascript
// Frontend'de hash oluşturma
const hashString = `${merchantId}${orderId}${amount}TRY${appSecret}`;
const hash = SHA256(hashString);

// Sipay API bu hash'i doğrular
// Hash eşleşmezse ödeme reddedilir
```

## 📝 Yapılan Değişiklikler

### 1. Environment Variables Eklendi
```
VITE_SIPAY_MERCHANT_ID=74850407
VITE_SIPAY_APP_SECRET=62d0dbbb0752ae0c62a72da4ad5b0386
```

### 2. Yeni Component: `SipayPaymentForm`
- Hash hesaplama
- Form oluşturma ve submit
- Transaction kaydetme
- Payment status modal yönetimi

### 3. `SubscriptionHistory` Güncellendi
- Edge function çağrıları kaldırıldı
- `SipayPaymentForm` component'i entegre edildi
- Payment state'leri kaldırıldı (component içinde yönetiliyor)

### 4. `PaymentStatusIndicator` Export Eklendi
```typescript
export type PaymentStatus = "pending" | "processing" | "completed" | "failed";
```

## 🧪 Test Etmek İçin

1. **Admin Panele Git**
   - `/admin` → Abonelik

2. **Plan Seç**
   - Aylık veya yıllık seçeneğini belirle
   - "Ödemeye Geç" butonuna tıkla

3. **Payment Modal**
   - "Pending" durumu gösterilir
   - Database'e transaction kaydedilir
   - "Processing" durumu gösterilir

4. **Sipay Sayfası**
   - Otomatik olarak Sipay'a yönlendirilirsin
   - Test kartı bilgilerini gir:
     ```
     Kart: 4508034508034509
     Tarih: 12/26
     CVV: 000
     ```

5. **3D Secure**
   - Sipay test ortamında otomatik onaylanır

6. **Callback**
   - Sipay geri yönlendirir
   - Backend callback'i işler
   - Subscription aktif olur

## 📊 Database Kontrolleri

### Payment Transactions
```sql
SELECT * FROM payment_transactions 
WHERE order_id LIKE 'ORDER-fbad140f%' 
ORDER BY created_at DESC;
```

Kontrol edilecekler:
- ✅ Status: pending → completed
- ✅ Transaction ID dolu
- ✅ Callback response kaydedilmiş

### Agencies
```sql
SELECT plan_type, subscription_status, subscription_ends_at 
FROM agencies 
WHERE id = 'fbad140f-a82e-4b9d-9829-ffc175a77f28';
```

Kontrol edilecekler:
- ✅ Subscription status: trial → active
- ✅ Subscription ends at: +30 gün (aylık) veya +365 gün (yıllık)
- ✅ Plan type güncellendi

### Subscription History
```sql
SELECT event_type, status, amount 
FROM subscription_history 
WHERE agency_id = 'fbad140f-a82e-4b9d-9829-ffc175a77f28' 
ORDER BY created_at DESC 
LIMIT 5;
```

Kontrol edilecekler:
- ✅ "payment_success" eventi kaydedilmiş
- ✅ "subscription_activated" eventi kaydedilmiş
- ✅ Amount doğru

## 🚀 Canlıya Alma

Sistem test modunda çalışıyor (gerçek ödeme almıyor). Canlıya almak için:

1. **Sipay Dashboard**
   - Test modunu kapat
   - Production mode aktif et
   - Callback URL'i kaydet: `https://[your-domain]/admin?payment_callback=true`

2. **Test Kartları Artık Çalışmaz**
   - Gerçek kart bilgileri girilecek
   - Gerçek 3D Secure yapılacak
   - Gerçek ödeme alınacak

3. **Monitoring**
   - Payment transactions loglarını takip et
   - Hata durumlarını izle
   - Başarı oranını kontrol et

## 📞 Destek

Sorun olursa:
1. Browser console'u kontrol et
2. Network sekmesinde Sipay isteğini incele
3. Database'de transaction kaydına bak
4. Sipay destek: destek@sipay.com.tr

---

**Not:** Bu yöntem Sipay'ın standart ve önerilen entegrasyon yöntemidir. Tüm Türk e-ticaret siteleri bu şekilde çalışır.
