# WhatsApp Rezervasyon Wizard 🎯

Adım adım, kullanıcı dostu rezervasyon sistemi.

## Özellikler ✨

### 1. Adım Adım Rehberlik
Kullanıcıyı tüm rezervasyon sürecinde yönlendirir:
1. 🎯 Tur Seçimi
2. 📅 Tarih Seçimi
3. 👥 Kişi Sayısı
4. 📝 Özel İstekler
5. ✅ Onay & Tamamlama

### 2. Otomatik Fiyat Hesaplama 💰
- Yetişkin fiyatı
- Çocuk fiyatı (varsa)
- Tek kişi ek ücreti (gerekirse)
- Anlık toplam gösterimi

### 3. Akıllı Validasyon ✅
- Kontenjan kontrolü
- Geçerli numara kontrolü
- Tarih uygunluğu
- Kişi sayısı limitleri

### 4. Güvenli State Yönetimi 🔒
- 15 dakika oturum süresi
- Otomatik temizleme
- İptal seçeneği
- Veritabanında güvenli saklama

## Kullanım Akışı 🔄

### Adım 1: Başlatma
```
Kullanıcı: Kayıt olmak istiyorum
Bot: 🎯 Harika! Rezervasyon yapalım!

Son arama sonuçlarınızdan bir tur seçin:

1. Kapadokya Balayı Turu
   💰 3.500 TL/kişi

2. Efes Antik Kenti Turu
   💰 2.000 TL/kişi

💡 Tur seçmek için numara yazın (örn: 1)
_İptal etmek için "iptal" yazın_
```

### Adım 2: Tur Seçimi
```
Kullanıcı: 1
Bot: ✅ Kapadokya Balayı Turu seçildi!

📅 Müsait Tarihler:

1. 15 May 2025 - 3.500 TL/kişi
   👥 20 kişilik yer

2. 20 May 2025 - 3.500 TL/kişi
   👥 15 kişilik yer

💡 Tarih seçmek için numara yazın (örn: 1)
_İptal etmek için "iptal" yazın_
```

### Adım 3: Tarih Seçimi
```
Kullanıcı: 1
Bot: ✅ Tarih seçildi: 15 Mayıs 2025

👥 Kişi Sayısı

Kaç kişi katılacaksınız?

📝 Format:
• Sadece yetişkin: "2 yetişkin" veya "2"
• Yetişkin + Çocuk: "2 yetişkin 1 çocuk"

💰 Fiyatlar:
• Yetişkin: 3.500 TL
• Çocuk: 2.500 TL

_İptal etmek için "iptal" yazın_
```

### Adım 4: Kişi Sayısı
```
Kullanıcı: 2 yetişkin 1 çocuk
Bot: ✅ Kişi Sayısı Kaydedildi

👥 2 Yetişkin + 1 Çocuk

💰 Toplam Fiyat: 9.500 TL

📝 Özel İstekler

Özel bir isteğiniz var mı?
(Diyet, ulaşım, vb.)

• Varsa yazın
• Yoksa "yok" yazın

_İptal etmek için "iptal" yazın_
```

### Adım 5: Özel İstekler
```
Kullanıcı: Vejetaryen menü
Bot: 📋 REZERVASYON ÖZETİ
══════════════════════════════

🎯 Tur: Kapadokya Balayı Turu
📍 Destinasyon: Kapadokya
📅 Tarih: 15 Mayıs 2025
👥 Kişi: 2 Yetişkin + 1 Çocuk

📝 Özel İstek: Vejetaryen menü

💰 TOPLAM FİYAT: `9.500 TL`

══════════════════════════════

✅ Onaylamak için "onayla" yazın
❌ İptal etmek için "iptal" yazın
```

### Adım 6: Onay & Tamamlama
```
Kullanıcı: onayla
Bot: 🎉 REZERVASYON TAMAMLANDI!

✅ Rezervasyonunuz başarıyla oluşturuldu.

📋 Rezervasyon No: abc12345
🎯 Tur: Kapadokya Balayı Turu
📅 Tarih: 15 Mayıs 2025
👥 Kişi Sayısı: 3
💰 Toplam: 9.500 TL

📞 Kısa süre içinde sizinle iletişime geçeceğiz.

🙏 Bizi tercih ettiğiniz için teşekkür ederiz!
```

## İptal İşlemi ❌

Herhangi bir adımda iptal edilebilir:
```
Kullanıcı: iptal
Bot: ❌ Rezervasyon iptal edildi.

💬 Size başka nasıl yardımcı olabilirim?
```

## Fiyat Hesaplama Mantığı 💰

### Temel Hesaplama
```typescript
// Yetişkin fiyatı
totalPrice = pax_adult * price_adult

// Çocuk fiyatı (varsa)
if (pax_child > 0 && price_child) {
  totalPrice += pax_child * price_child
}

// Tek kişi ek ücreti
if (pax_adult === 1 && pax_child === 0 && price_single) {
  totalPrice += price_single
}
```

### Örnek Senaryolar

**Senaryo 1: İki Yetişkin**
- 2 yetişkin × 3.500 TL = 7.000 TL

**Senaryo 2: Bir Yetişkin (Tek Kişi)**
- 1 yetişkin × 3.500 TL = 3.500 TL
- Tek kişi ek: +500 TL
- **Toplam: 4.000 TL**

**Senaryo 3: İki Yetişkin + Bir Çocuk**
- 2 yetişkin × 3.500 TL = 7.000 TL
- 1 çocuk × 2.500 TL = 2.500 TL
- **Toplam: 9.500 TL**

**Senaryo 4: Bir Yetişkin + İki Çocuk**
- 1 yetişkin × 3.500 TL = 3.500 TL
- 2 çocuk × 2.500 TL = 5.000 TL
- (Tek kişi ek yok, çünkü çocuk var)
- **Toplam: 8.500 TL**

## Teknik Detaylar 🔧

### State Yönetimi
Wizard state kullanıcı profilinin `preferences` alanında JSON olarak saklanır:

```typescript
interface WizardState {
  step: 'tour_selection' | 'date_selection' | 'pax_selection' | 
        'special_requests' | 'confirmation';
  selected_tour?: any;
  selected_date?: any;
  pax_adult?: number;
  pax_child?: number;
  special_requests?: string;
  created_at: string;
}
```

### Oturum Süresi
- **Süre**: 15 dakika
- **Otomatik Temizleme**: Süresi dolan state'ler otomatik silinir
- **İptal**: Kullanıcı istediği zaman "iptal" yazarak çıkabilir

### Validasyon Kuralları
```typescript
// Kişi sayısı limitleri
pax_adult: 1-20 arası
pax_child: 0-10 arası

// Kontenjan kontrolü
total_pax <= tour_date.quota

// Tarih numarası
1 <= date_number <= available_dates.length

// Tur numarası
1 <= tour_number <= available_tours.length
```

## Veritabanı Entegrasyonu 💾

### Kayıt Oluşturma
```sql
INSERT INTO registrations (
  tour_id,
  tour_date_id,
  full_name,
  phone,
  pax,
  status,
  note,
  agency_id
) VALUES (
  'tour-uuid',
  'date-uuid',
  'Kullanıcı Adı',
  '+905551234567',
  3,
  'NEW',
  'WhatsApp Wizard Rezervasyon
   Yetişkin: 2
   Çocuk: 1
   Özel İstek: Vejetaryen menü',
  'agency-uuid'
);
```

### State Saklama
```sql
-- Wizard state preferences içinde saklanır
UPDATE whatsapp_user_profiles
SET preferences = jsonb_set(
  preferences,
  '{wizard_state}',
  '{
    "step": "date_selection",
    "selected_tour": {...},
    "created_at": "2025-01-13T10:00:00Z"
  }'::jsonb
)
WHERE phone = '+905551234567'
  AND agency_id = 'agency-uuid';
```

## Hata Yönetimi ⚠️

### Yaygın Hatalar & Çözümler

**1. Kontenjan Yetersiz**
```
❌ Toplam kişi sayısı (5) kontenjanı (3) aşıyor.

Lütfen daha az kişi sayısı belirtin.
```

**2. Geçersiz Numara**
```
❌ Lütfen 1-3 arası bir numara girin.

_İptal etmek için "iptal" yazın_
```

**3. Tur Bulunamadı**
```
❌ Tur bulunamadı. Lütfen önce bir tur arayın.

Örnek: "Kapadokya turları"
```

**4. Session Süresi Doldu**
```
❌ Oturum süresi doldu. Lütfen tekrar başlayın.

"Kayıt olmak istiyorum" yazarak yeni rezervasyon başlatın.
```

## Kullanıcı Deneyimi İyileştirmeleri 🎨

### 1. Emoji Kullanımı
Her adımda anlamlı emoji'ler kullanılır:
- 🎯 Tur seçimi
- 📅 Tarih
- 👥 Kişi sayısı
- 📝 Notlar
- ✅ Onay
- ❌ İptal
- 💰 Fiyat

### 2. Formatlanmış Mesajlar
- **Bold** başlıklar
- `Monospace` fiyatlar
- _İtalik_ yardım metinleri
- Ayırıcılar (═══)

### 3. Açık Talimatlar
Her adımda kullanıcıya ne yapması gerektiği açıkça belirtilir:
- "Numara yazın (örn: 1)"
- '"onayla" yazarak onaylayın'
- "İptal etmek için 'iptal' yazın"

### 4. Özet Görüntüleme
Onay adımında tüm bilgiler tekrar gösterilir:
- Seçilen tur
- Tarih
- Kişi sayısı
- Özel istekler
- **Toplam fiyat** (vurgulu)

## Admin Paneli Entegrasyonu 📊

Oluşturulan rezervasyonlar Admin panelinde görünür:
- Dashboard'da yeni kayıtlar
- Registrations sekmesinde detaylar
- WhatsApp Konuşmaları'nda mesaj geçmişi
- Kullanıcı Profilleri'nde tercihler

## Test Senaryoları 🧪

### Senaryo 1: Normal Akış
```
1. "Kayıt olmak istiyorum"
2. "1" (Tur seçimi)
3. "1" (Tarih seçimi)
4. "2 yetişkin" (Kişi sayısı)
5. "yok" (Özel istek yok)
6. "onayla" (Onay)
✅ Rezervasyon tamamlandı
```

### Senaryo 2: Özel İstekli
```
1. "Kayıt olmak istiyorum"
2. "2" (Tur seçimi)
3. "2" (Tarih seçimi)
4. "1 yetişkin 2 çocuk"
5. "Bebek arabası gerekli"
6. "onayla"
✅ Rezervasyon tamamlandı
```

### Senaryo 3: İptal
```
1. "Kayıt olmak istiyorum"
2. "1" (Tur seçimi)
3. "iptal"
✅ Rezervasyon iptal edildi
```

### Senaryo 4: Hatalı Giriş
```
1. "Kayıt olmak istiyorum"
2. "abc" (Geçersiz numara)
❌ Hata mesajı göster
2. "1" (Doğru numara)
✅ Devam et
```

## Gelecek Geliştirmeler 🔮

- [ ] Birden fazla tur seçimi (paket tur)
- [ ] İndirim kodu desteği
- [ ] Ön ödeme seçeneği
- [ ] Takvim görünümü
- [ ] Fotoğraf gönderme (kimlik, vb.)
- [ ] Otomatik hatırlatıcılar
- [ ] Whatsapp payment entegrasyonu (gelecekte)

## Sorun Giderme 🔧

### Wizard başlamıyor
- Önce bir tur arama yapılmalı
- Konuşma geçmişinde turlar olmalı

### State kayboluyor
- 15 dakika oturum süresi kontrolü
- Veritabanı bağlantısı kontrolü

### Fiyatlar yanlış
- tour_dates tablosunda fiyatları kontrol edin
- price_child ve price_single null olabilir

### Rezervasyon oluşturulmuyor
- RLS politikalarını kontrol edin
- Gerekli alanların dolu olduğunu doğrulayın
- Edge function loglarına bakın

---

**Önemli**: Wizard aktifken kullanıcının her mesajı wizard tarafından işlenir. Normal sohbet veya tur arama yapmak için önce "iptal" yazması gerekir.
