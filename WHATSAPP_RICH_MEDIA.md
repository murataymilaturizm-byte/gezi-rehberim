# WhatsApp Zengin Medya Desteği 📱✨

Bu doküman, WhatsApp bot'unuzun zengin medya ve interaktif mesajlaşma özelliklerini açıklar.

## Yeni Özellikler 🎉

### 1. Zengin Metin Formatı
WhatsApp mesajlarında artık aşağıdaki formatlar kullanılıyor:

- **Bold (Kalın)**: `*metin*` → *metin*
- **Italic (İtalik)**: `_metin_` → _metin_
- **Strikethrough (Üstü Çizili)**: `~metin~` → ~metin~
- **Monospace (Kod)**: `` `metin` `` → `metin`

### 2. Hızlı Cevap Butonları
Kullanıcılara numaralı seçenekler sunuluyor:

```
📱 Hızlı Seçenekler:

✅ 1. Kayıt olmak istiyorum
📞 2. Daha fazla bilgi
🔍 3. Başka turlar

_Yukarıdaki seçeneklerden birinin numarasını yazabilirsiniz_
```

Kullanıcı sadece "1", "2" veya "3" yazarak seçim yapabilir.

### 3. Gelişmiş Tur Formatı
Tur sonuçları artık daha organize ve okunabilir:

```
🎉 *Harika! 3 Muhteşem Tur Buldum!*
──────────────────────────────

*1. KAPADOKYA TURU*
····················
📍 *Destinasyon:* Kapadokya
✨ _Peri bacaları, yeraltı şehirleri ve balon turu_

📅 *Tarih:* 15 May 2025 → 17 May
⏱️ *Süre:* 2 Gece 3 Gün

💰 *FİYAT:* `3.500 TL` /kişi
✅ *Kontenjan:* 15 kişilik yer mevcut

🗺️ *Gezilecek Yerler:*
   • Göreme Açık Hava Müzesi
   • Uçhisar Kalesi
   • Derinkuyu Yeraltı Şehri
   _...ve daha fazlası_

📄 Detaylı program: [URL]

──────────────────────────────
```

### 4. Medya Desteği 📸

#### Tur Fotoğrafları Gönderme
Bot artık tur fotoğraflarını WhatsApp mesajı ile birlikte gönderebilir.

**Not:** Tur fotoğrafları göndermek için `tours` tablosuna `image_url` kolonu eklemeniz gerekir:

```sql
ALTER TABLE tours ADD COLUMN image_url TEXT;
```

Sonra turlarınıza fotoğraf URL'leri ekleyin:
```sql
UPDATE tours 
SET image_url = 'https://example.com/kapadokya.jpg' 
WHERE id = 'your-tour-id';
```

#### Medya Kullanımı
```typescript
// Fotoğraf ile mesaj gönderme
await sendWhatsAppMessage(
  userPhone, 
  message, 
  agency,
  ['https://example.com/tur-fotografi.jpg'] // MediaUrl array
);
```

### 5. Akıllı Konuşma Yönetimi
Bot artık kullanıcının önceki seçimlerini hatırlıyor ve buna göre cevap veriyor.

## Kullanım Örnekleri 💡

### Örnek 1: Tur Arama
```
Kullanıcı: Kapadokya turları
Bot: [Zengin formatlı tur listesi + Hızlı cevap butonları]
Kullanıcı: 1
Bot: [Kayıt formu bilgileri]
```

### Örnek 2: Hızlı Kayıt
```
Kullanıcı: Kayıt olmak istiyorum
Bot: [Kayıt için gerekli format açıklaması]
Kullanıcı: Kayıt: Kapadokya Turu 15.05.2025 Ahmet Yılmaz 05551234567 2 kişi
Bot: ✅ Kayıt Başarılı! [Detaylı onay mesajı]
```

### Örnek 3: Genel Sohbet
```
Kullanıcı: Merhaba
Bot: Merhaba! 👋 Size nasıl yardımcı olabilirim?

📱 Hızlı Seçenekler:

🗺️ 1. Tüm turları göster
👤 2. Danışman ile görüş
```

## Twilio Interactive Messages (İleri Seviye) 🚀

**Not:** Aşağıdaki özellikler Twilio WhatsApp Business API gerektirir (Sandbox'ta çalışmaz).

### Liste Mesajları
WhatsApp'ın native liste özelliğini kullanmak için:

```typescript
// Twilio Content Template kullanımı
const response = await fetch(
  `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: `whatsapp:${twilioPhone}`,
      To: `whatsapp:${userPhone}`,
      ContentSid: 'YOUR_CONTENT_SID', // Twilio'dan alacağınız
      ContentVariables: JSON.stringify({
        '1': 'Kapadokya Turu',
        '2': '3500 TL',
        '3': '15 May 2025'
      })
    })
  }
);
```

### Reply Buttons
Native WhatsApp butonları için:

1. Twilio Console'da Content Template oluşturun
2. ContentSid'yi alın
3. Yukarıdaki gibi kullanın

## Yapılandırma ⚙️

### Gerekli Twilio Ayarları
- ✅ Twilio Account SID
- ✅ Twilio Auth Token
- ✅ Twilio WhatsApp Phone Number
- ⚠️ WhatsApp Business API (Interactive messages için)

### Veritabanı Güncellemeleri
```sql
-- Tur fotoğrafları için (opsiyonel)
ALTER TABLE tours ADD COLUMN image_url TEXT;

-- Örnek fotoğraf ekleme
UPDATE tours 
SET image_url = 'https://example.com/kapadokya.jpg' 
WHERE title LIKE '%Kapadokya%';
```

## Performans İyileştirmeleri 📊

1. **Konuşma Geçmişi**: Son 10 mesaj saklanıyor
2. **Akıllı Kategorizasyon**: AI ile mesaj intent'i belirleniyor
3. **Hızlı Cevaplar**: Kullanıcı deneyimi iyileştirildi
4. **Zengin Format**: Bilgiler daha organize gösteriliyor

## Gelecek Geliştirmeler 🔮

- [ ] Carousel (çoklu fotoğraf) desteği
- [ ] Lokasyon paylaşımı
- [ ] PDF katalog/brochure gönderme
- [ ] Video desteği
- [ ] WhatsApp status updates
- [ ] Template mesajlar (pazarlama)

## Sorun Giderme 🔧

### Butonlar çalışmıyor
- Kullanıcının tam olarak "1", "2" veya "3" yazdığından emin olun
- Konuşma geçmişinin düzgün kaydedildiğini kontrol edin

### Fotoğraflar gönderilmiyor
- `tours` tablosunda `image_url` kolonunun olduğundan emin olun
- URL'lerin geçerli ve erişilebilir olduğunu kontrol edin
- Twilio'nun medya dosyası boyut limitlerini kontrol edin (max 5MB)

### Format bozuk görünüyor
- WhatsApp Web/App'in güncel versiyonunu kullanın
- Bazı karakterler escape edilmeli (`&`, `<`, `>`)

## Destek 💬

Sorunlar için:
1. Edge function loglarını kontrol edin
2. WhatsApp mesaj geçmişini veritabanında kontrol edin
3. Twilio Console'da mesaj loglarına bakın

---

**Notlar:**
- Twilio Sandbox ile test ederken bazı özellikler kısıtlı olabilir
- Production için WhatsApp Business API başvurusu yapmanız gerekir
- Template mesajlar Meta tarafından onaylanmalıdır
