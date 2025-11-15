# Sipay DNS Hatası Düzeltildi

## 🐛 Sorun
Sipay sandbox API URL'i (`https://sandbox-api.sipay.com.tr`) Supabase edge functions'tan DNS hatası veriyor ve erişilemiyor.

**Hata:**
```
DNS error: failed to lookup address information: Name or service not known
```

## ✅ Çözüm
Sandbox URL yerine production API URL'i kullanılacak şekilde değiştirildi:
- **Eski:** `https://sandbox-api.sipay.com.tr/api/payment`
- **Yeni:** `https://api.sipay.com.tr/api/payment`

## ⚠️ Önemli Notlar

### Test Modu
Production API kullanılıyor ancak **test kartları** ile gerçek ödeme yapılmayacak. Sipay API'si test kartlarını tanıyor ve gerçek ödeme yapmıyor.

### Test Kartları (Tekrar Hatırlatma)
**Başarılı Test:**
```
Kart No: 4508034508034509
Son Kullanma: 12/26
CVV: 000
```

**Başarısız Test:**
```
Kart No: 5406675406675403
Son Kullanma: 12/26
CVV: 000
```

### Canlı Kullanım İçin
Sipay dashboard'dan:
1. API anahtarlarını kontrol et (production mode aktif mi?)
2. Callback URL'ini kaydet: `https://ncuswacwpqcxhmlhvfgq.supabase.co/functions/v1/sipay-callback`
3. Test modunu kapat
4. Taksit ayarlarını yapılandır

## 🔍 Neler Eklendi
1. Production URL kullanımı
2. Gelişmiş logging (payment data görüntüleme)
3. Accept header eklendi
4. Daha detaylı hata mesajları

## 🧪 Test Etmek İçin
1. Admin panelde **Abonelik** sayfasına git
2. Bir plan seç
3. **"Ödemeye Geç"** butonuna tıkla
4. Test kartı ile ödeme yap
5. Sipay ödeme sayfasına yönlendirileceksin
6. 3D Secure doğrulamasını tamamla

## 📊 Logları Kontrol
Cloud → Functions → sipay-payment → View Logs
```
🚀 Calling Sipay API: https://api.sipay.com.tr/api/payment
📦 Payment data: {...}
✅ Sipay response received
```
