# Sipay Ödeme Entegrasyonu Kurulum Rehberi

## 1. Sipay Hesabı Oluşturma

1. [Sipay](https://www.sipay.com.tr) web sitesine gidin
2. "Üye Ol" veya "Demo Talep Et" butonuna tıklayın
3. İşletme bilgilerinizi doldurun ve başvurunuzu tamamlayın
4. Sipay ekibi tarafından onaylandıktan sonra hesabınız aktif olacak

## 2. API Bilgilerini Alma

Sipay hesabınız aktif olduktan sonra:

1. Sipay Dashboard'a giriş yapın
2. **Ayarlar > API Bilgileri** bölümüne gidin
3. Aşağıdaki bilgileri kopyalayın:
   - **Merchant ID** (Üye İşyeri Numarası)
   - **App Secret** (Uygulama Gizli Anahtarı)

## 3. Test Modu (Sandbox)

Geliştirme aşamasında test modunu kullanmanız önerilir:

1. Sipay Dashboard'da **Test Modu**nu aktif edin
2. Test API bilgilerini kullanın
3. Test kartları ile ödeme denemeleri yapın

### Test Kartları

**Başarılı Ödeme:**
- Kart No: 4508034508034509
- Son Kullanma: 12/26
- CVV: 000

**Başarısız Ödeme:**
- Kart No: 5406675406675403
- Son Kullanma: 12/26
- CVV: 000

## 4. Lovable'da Kurulum

✅ **TAMAMLANDI**: API anahtarları eklendi
- `SIPAY_MERCHANT_ID` - Üye işyeri numaranız
- `SIPAY_APP_SECRET` - Gizli anahtar

## 5. Sipay API Özellikleri

### Desteklenen İşlemler

- ✅ **Tek Çekim**: Karttan anında tahsilat
- ✅ **Taksitli Ödeme**: 2-12 taksit seçenekleri
- ✅ **3D Secure**: Güvenli ödeme (zorunlu)
- ✅ **Kart Saklama**: Tekrarlayan ödemeler için
- ✅ **İade**: Kısmi veya tam iade

### API Endpoint'leri

**Prodüksiyon:**
- Base URL: `https://api.sipay.com.tr`
- Payment: `/api/payment`
- 3D Secure Callback: `/api/callback3d`

**Test (Sandbox):**
- Base URL: `https://sandbox-api.sipay.com.tr`
- Payment: `/api/payment`
- 3D Secure Callback: `/api/callback3d`

## 6. Ödeme Akışı

```
1. Kullanıcı plan seçer (Aylık/Yıllık)
2. Ödeme sayfası açılır
3. Kart bilgileri girilir
4. 3D Secure doğrulaması yapılır
5. Ödeme onaylanır
6. Subscription aktif olur
7. Fatura oluşturulur
8. Email bildirim gönderilir
```

## 7. Güvenlik

- ✅ API anahtarları backend'de saklanır
- ✅ Kart bilgileri hiç sunucuya gelmez
- ✅ 3D Secure zorunlu
- ✅ SSL/TLS ile şifreli iletişim
- ✅ Sipay PCI-DSS uyumlu

## 8. Önemli Notlar

1. **Test Modunda Çalışın**: Canlıya geçmeden önce tüm senaryoları test edin
2. **Callback URL**: Sipay dashboard'da callback URL'inizi kaydedin
3. **Webhook**: Ödeme durumu bildirimleri için webhook ayarlayın
4. **Loglama**: Tüm ödeme işlemlerini loglayın
5. **Hata Yönetimi**: Kullanıcı dostu hata mesajları gösterin

## 9. Sipay Dashboard Ayarları

### Yapılması Gerekenler:

1. **Callback URL Ekleme:**
   - Dashboard > Ayarlar > Callback URL
   - URL: `https://[your-project].supabase.co/functions/v1/sipay-callback`

2. **IP Whitelist:**
   - Supabase IP adreslerini ekleyin (opsiyonel)

3. **Taksit Ayarları:**
   - Hangi taksit seçeneklerinin aktif olacağını belirleyin

4. **Komisyon Oranları:**
   - Banka ve taksit bazlı komisyon oranlarını kontrol edin

## 10. Canlıya Alma Checklist

- [ ] Test modunda tüm senaryolar test edildi
- [ ] Sipay Dashboard'da prodüksiyon API anahtarları alındı
- [ ] Lovable'da prodüksiyon API anahtarları güncellendi
- [ ] Callback URL kaydedildi
- [ ] Ödeme bildirimleri test edildi
- [ ] Fatura oluşturma test edildi
- [ ] Email bildirimleri çalışıyor
- [ ] Hata senaryoları test edildi
- [ ] Kullanıcı deneyimi incelendi

## 11. Destek

- **Sipay Teknik Destek**: destek@sipay.com.tr
- **Sipay Telefon**: +90 212 xxx xx xx
- **Dokümantasyon**: https://docs.sipay.com.tr

## 12. Yaygın Hatalar ve Çözümleri

### Hata: "Invalid merchant_id"
- **Çözüm**: SIPAY_MERCHANT_ID'nin doğru girildiğini kontrol edin

### Hata: "Invalid signature"
- **Çözüm**: SIPAY_APP_SECRET'ın doğru olduğunu kontrol edin

### Hata: "3D Secure failed"
- **Çözüm**: Test kartını kontrol edin veya gerçek kartla deneyin

### Hata: "Transaction declined"
- **Çözüm**: Kart limitini veya kart durumunu kontrol edin

## 13. Sistem Gereksinimleri

Entegrasyon şu şekilde çalışacak:

1. **Frontend (React)**:
   - Ödeme formu
   - 3D Secure redirect sayfası
   - Ödeme sonuç sayfası

2. **Backend (Supabase Edge Function)**:
   - Ödeme başlatma
   - Callback işleme
   - Subscription güncelleme
   - Fatura oluşturma

3. **Database**:
   - Payment transactions tablosu
   - Subscription_history kaydı

## Sonraki Adımlar

Entegrasyon kurulumu tamamlandı. Şimdi:

1. Test modunda ödeme yaparak sistemi test edin
2. Farklı kartlar ve senaryoları deneyin
3. Hata durumlarını kontrol edin
4. Canlıya geçmeden önce Sipay'dan onay alın

---

**Not**: Bu döküman sürekli güncellenecektir. Sipay API'sinde yapılan değişiklikler için [Sipay Changelog](https://docs.sipay.com.tr/changelog) sayfasını takip edin.
