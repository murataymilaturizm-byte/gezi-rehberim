# WhatsApp Bot - Gelişmiş Özellikler 🚀

Bu doküman WhatsApp bot'unuzun gelişmiş konuşma yönetimi ve kullanıcı profili özelliklerini açıklar.

## Yeni Özellikler 🎯

### 1. Kullanıcı Profilleri 👤

Her WhatsApp kullanıcısı için otomatik profil oluşturuluyor:

#### Profil Bilgileri:
- **İsim**: Kullanıcı kendini tanıttığında otomatik kaydedilir
- **Telefon**: WhatsApp numarası
- **Toplam Mesaj Sayısı**: Kaç mesaj gönderdiği
- **Son Etkileşim**: En son ne zaman mesaj attı
- **İlk Etkileşim**: İlk mesaj tarihi

#### Tercihler:
- **Tercih Edilen Destinasyonlar**: Aradığı/kayıt olduğu destinasyonlar
- **Bütçe Aralığı**: Bütçe beklentisi
- **Tercih Edilen Tur Tipi**: Günübirlik, 2 gece, 3 gece, vb.
- **Son Arama Sorgusu**: En son ne aradı

### 2. Akıllı Konuşma Geçmişi 💬

#### Özellikler:
- **20 Mesaj Hafızası**: Eskiden 10 mesajdı, şimdi 20 mesaj saklanıyor
- **Bağlamsal Yanıtlar**: Bot önceki konuşmaları hatırlıyor
- **Profil Tabanlı Öneriler**: Kullanıcının tercihlerine göre tur öneriyor

#### Örnek Senaryo:
```
Kullanıcı (İlk gün): Kapadokya turları
Bot: [Kapadokya turlarını gösterir]

Kullanıcı (Ertesi gün): Merhaba
Bot: Merhaba! Dün Kapadokya turlarına bakmıştınız. 
     Başka bir destinasyon mu düşünüyorsunuz?

Kullanıcı: Benzer turlar var mı?
Bot: Elbette! Size Kapadokya'ya benzer doğa ve 
     kültür turları önerebilirim...
```

### 3. Konuşma Özetleri 📊

Sistem her gün otomatik olarak konuşmaların özetini oluşturuyor:

#### Özet İçeriği:
- **Ana Konular**: Neler konuşuldu?
- **Bahsedilen Turlar**: Hangi turlardan bahsedildi?
- **Duygu Analizi**: Kullanıcı memnun mu, nötr mü, mutsuz mu?
- **Mesaj Sayısı**: O gün kaç mesaj atıldı

#### Kullanım Alanları:
- Bot daha iyi context ile yanıt veriyor
- Müşteri hizmetleri için özet rapor
- Hangi turlara ilgi var analizi

### 4. Otomatik Tercih Güncelleme 🔄

Bot konuşmalardan otomatik bilgi topluyor:

#### İsim Öğrenme:
```
Kullanıcı: Adım Mehmet
Bot: Merhaba Mehmet! Size nasıl yardımcı olabilirim?
[Otomatik olarak profile "Mehmet" kaydedilir]
```

#### Destinasyon Tercihleri:
```
Kullanıcı: Kapadokya turları
Bot: [Turları gösterir]
[Otomatik olarak "Kapadokya" tercih listesine eklenir]

Kullanıcı (Sonra): Tur arıyorum
Bot: Kapadokya turlarını beğenmiştiniz. 
     Benzer destinasyonlar önerebilirim...
```

#### Kayıt Bilgileri:
```
Kullanıcı: Kayıt: Kapadokya Turu 15.05.2025 Ahmet Yılmaz 05551234567 2 kişi
[Otomatik olarak isim ve destinasyon profilde güncellenir]
```

## Veritabanı Tabloları 🗄️

### whatsapp_user_profiles
Kullanıcı profil bilgilerini saklar:

```sql
-- Profil görüntüleme
SELECT 
  phone, 
  full_name, 
  total_messages,
  preferred_destinations,
  last_search_query,
  last_interaction_at
FROM whatsapp_user_profiles
WHERE agency_id = 'your-agency-id'
ORDER BY last_interaction_at DESC;

-- Aktif kullanıcılar (son 7 gün)
SELECT COUNT(*) as active_users
FROM whatsapp_user_profiles
WHERE agency_id = 'your-agency-id'
  AND last_interaction_at > NOW() - INTERVAL '7 days';

-- En çok mesaj atan kullanıcılar
SELECT phone, full_name, total_messages
FROM whatsapp_user_profiles
WHERE agency_id = 'your-agency-id'
ORDER BY total_messages DESC
LIMIT 10;
```

### whatsapp_conversation_summaries
Günlük konuşma özetlerini saklar:

```sql
-- Bugünün konuşma özetleri
SELECT 
  phone,
  summary,
  topics,
  mentioned_tours,
  sentiment,
  message_count
FROM whatsapp_conversation_summaries
WHERE agency_id = 'your-agency-id'
  AND conversation_date = CURRENT_DATE;

-- En çok bahsedilen turlar
SELECT 
  UNNEST(mentioned_tours) as tour_name,
  COUNT(*) as mention_count
FROM whatsapp_conversation_summaries
WHERE agency_id = 'your-agency-id'
  AND conversation_date > CURRENT_DATE - 30
GROUP BY tour_name
ORDER BY mention_count DESC;
```

## Kullanım Senaryoları 🎬

### Senaryo 1: Dönüş Yapan Müşteri
```
1. Müşteri ilk gün Kapadokya turlarına bakar
2. Bot destinasyonu tercihlerine ekler
3. Müşteri ertesi gün yazar: "Başka turlar var mı?"
4. Bot: "Kapadokya'yı beğenmiştiniz! Benzer doğa turları:
   - Pamukkale Turu
   - Efes Turu"
```

### Senaryo 2: Kayıt Olan Müşteri
```
1. Müşteri kayıt olur: "Kayıt: Kapadokya 15.05.2025 Ali Demir..."
2. Bot ismi ve destinasyonu profile kaydeder
3. Müşteri sonra yazar: "Merhaba"
4. Bot: "Merhaba Ali! Kapadokya turunuz için kayıt aldık. 
   Başka bir şey yardımcı olabilirim?"
```

### Senaryo 3: Tercih Bazlı Öneri
```
1. Müşteri birkaç kez günübirlik turlar arar
2. Bot tercihlerine "günübirlik" ekler
3. Müşteri: "Tur önerisi"
4. Bot: "Size günübirlik turları öneriyorum:
   - Günübirlik Efes Turu
   - Günübirlik Pamukkale Turu"
```

## Analytics & İzleme 📈

### Kullanıcı İstatistikleri
```sql
-- Toplam kullanıcı sayısı
SELECT COUNT(*) FROM whatsapp_user_profiles 
WHERE agency_id = 'your-agency-id';

-- Aktif kullanıcılar (son 30 gün)
SELECT COUNT(*) FROM whatsapp_user_profiles 
WHERE agency_id = 'your-agency-id'
  AND last_interaction_at > NOW() - INTERVAL '30 days';

-- Ortalama mesaj sayısı
SELECT AVG(total_messages) FROM whatsapp_user_profiles 
WHERE agency_id = 'your-agency-id';
```

### Popüler Destinasyonlar
```sql
SELECT 
  UNNEST(preferred_destinations) as destination,
  COUNT(*) as popularity
FROM whatsapp_user_profiles
WHERE agency_id = 'your-agency-id'
  AND preferred_destinations IS NOT NULL
GROUP BY destination
ORDER BY popularity DESC;
```

### Dönüşüm Analizi
```sql
-- Kayıt olan kullanıcılar
SELECT 
  up.phone,
  up.full_name,
  up.total_messages,
  COUNT(r.id) as registration_count
FROM whatsapp_user_profiles up
LEFT JOIN registrations r ON r.phone = up.phone
WHERE up.agency_id = 'your-agency-id'
GROUP BY up.phone, up.full_name, up.total_messages
HAVING COUNT(r.id) > 0
ORDER BY registration_count DESC;
```

## Otomatik Süreçler ⚙️

### Profil Oluşturma
Her yeni mesajda otomatik olarak:
1. Profil kontrolü yapılır
2. Yoksa yeni profil oluşturulur
3. Varsa mesaj sayısı ve son etkileşim güncellenir

### Tercih Güncelleme
Bot şunları otomatik kaydeder:
- İsim (konuşmadan öğrenirse)
- Aranan destinasyonlar
- Kayıt olunan turlar
- Son arama sorgusu

### Özet Oluşturma
Her gün otomatik olarak:
- Son 24 saatin mesajları analiz edilir
- AI ile özet oluşturulur
- Konular ve duygular belirlenir
- Veritabanına kaydedilir

## Gelecek Geliştirmeler 🔮

- [ ] Bütçe takibi ve fiyat önerileri
- [ ] Otomatik hatırlatmalar (tur tarihi yaklaştığında)
- [ ] Müşteri segmentasyonu (VIP, aktif, pasif)
- [ ] Kişiselleştirilmiş kampanya mesajları
- [ ] Çoklu dil desteği
- [ ] Ses mesajı desteği
- [ ] Müşteri memnuniyeti anketi

## Best Practices 💡

### 1. Privacy (Gizlilik)
- Kullanıcı bilgileri güvenli saklanır
- RLS politikaları ile korunur
- Sadece ilgili acente erişebilir

### 2. Performance (Performans)
- Konuşma geçmişi 20 mesaj ile sınırlı
- Index'ler ile hızlı sorgular
- Arka planda özet oluşturma

### 3. User Experience (Kullanıcı Deneyimi)
- Tekrar selamlaşma yapılmaz
- Tercihlere göre öneriler
- Bağlamsal ve akıllı yanıtlar

## Sorun Giderme 🔧

### Profil oluşturulmuyor
- Edge function loglarını kontrol edin
- RLS politikalarını kontrol edin
- Agency_id'nin doğru olduğunu doğrulayın

### Tercihler güncellenmiyor
- updateUserPreferences fonksiyonunu kontrol edin
- Veritabanı bağlantısını test edin

### Özet oluşturulmuyor
- createConversationSummary manuel çalıştırın
- AI API yanıtlarını logları kontrol edin

---

**Not**: Bu özellikler otomatik çalışır, manuel ayar gerekmez!
