# Tur Satış Chatbotu 🌍

Modern bir seyahat acentesi için Türkçe AI destekli tur arama ve rezervasyon platformu.

## ✨ Özellikler

- 💬 **Akıllı Chat Asistanı**: Doğal dille tur arama ("Günübirlik Kapadokya 20 Temmuz")
- 🎯 **Otomatik Anlama**: Türkçe tarih, destinasyon ve tur tipi algılama
- 🏖️ **Gerçek Zamanlı Arama**: Filtrelenmiş tur sonuçları
- 📝 **Ön Kayıt Sistemi**: Hızlı rezervasyon formu
- 🎨 **Modern UI/UX**: Deniz temalı, gradient tasarım
- 🔐 **Admin Panel**: Tur ve rezervasyon yönetimi

## 🛠️ Teknoloji Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: TailwindCSS + shadcn/ui
- **Backend**: Lovable Cloud (Supabase)
- **Database**: PostgreSQL
- **Tarih İşlemleri**: date-fns (TR locale)

## 📦 Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev
```

Uygulama http://localhost:8080 adresinde çalışacaktır.

## 🗄️ Veritabanı Yapısı

### Tours (Turlar)
- Tur bilgileri: başlık, destinasyon, tip (günübirlik/2-3 gece)
- Program URL, vize gereklilikleri, minimum katılımcı

### Tour Dates (Tur Tarihleri)
- Kalkış/dönüş tarihleri
- Fiyatlar (yetişkin, çocuk, tek kişilik)
- Kontenjan bilgisi

### Registrations (Kayıtlar)
- Müşteri bilgileri (ad, telefon)
- Tur/tarih seçimi
- Durum takibi (Yeni, Beklemede, Onaylı, İptal)

## 🎨 Tasarım Sistemi

- **Primary**: Turkuaz-mavi (deniz teması) `hsl(189 85% 45%)`
- **Secondary**: Coral-turuncu (aksan) `hsl(16 90% 65%)`
- **Gradients**: Ocean, Sunset, Hero gradyanları
- **Shadows**: Soft, Card gölgelendirmeleri

## 🚀 Özellikler

### Ana Sayfa (/)
- Sol: Chat widget (mesaj gönderme, hızlı butonlar)
- Sağ: Tur kartları (fiyat, tarih, kontenjan, ön kayıt)

### Admin Panel (/admin)
- Tur listesi görüntüleme
- Rezervasyon listesi ve durum takibi

### Akıllı Ayrıştırma
```typescript
"Günübirlik Kapadokya 20 Temmuz"
↓
{
  intent: "tour.search",
  entities: {
    destination: "Kapadokya",
    type: "daytrip",
    date_iso: "2026-07-20"
  }
}
```

## 📱 Kullanım

1. Ana sayfada chat asistanına mesaj yazın
2. Örnek: "2 gece Kapadokya Mayıs"
3. Uygun turları görüntüleyin
4. "Ön Kayıt" butonu ile rezervasyon yapın

## 🔐 Güvenlik

- RLS (Row Level Security) politikaları
- Public okuma erişimi
- Güvenli kayıt oluşturma

## 📊 Seed Veriler

Proje 2 örnek Kapadokya turu ile gelir:
- Günübirlik tur (20-22 Temmuz 2026)
- 2 Gece 3 Gün (1-3 Mayıs 2026)

## 🌐 Deployment

Lovable platformu üzerinden tek tıkla yayınlayabilirsiniz:
1. "Publish" butonuna tıklayın
2. Custom domain bağlayabilirsiniz

## 📝 Geliştirme Notları

- Tarih ayrıştırma: TR ay adları desteklenir
- Type-safe: Full TypeScript
- Responsive: Mobile-first tasarım
- SEO-ready: Meta tags hazır

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📄 Lisans

Bu proje MIT lisansı altındadır.

---

**URL**: https://lovable.dev/projects/68410288-52e1-4968-9da2-539398d16600

Lovable ile ❤️ ile yapıldı
