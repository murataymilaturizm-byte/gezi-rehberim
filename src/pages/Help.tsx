import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  BookOpen, 
  MessageSquare, 
  Settings, 
  Upload, 
  BarChart3, 
  CreditCard,
  Shield,
  Video,
  CheckCircle2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import turzzLogo from "@/assets/turzz-logo-orange.png";
import { getHelpContent } from "@/data/helpContent";

const Help = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const sections = [
    {
      icon: Settings,
      title: t("help.sections.setup"),
      color: "text-primary",
      bgColor: "bg-primary/10",
      items: [
        {
          question: "İlk Kurulum Nasıl Yapılır?",
          answer: `
**Adım 1: Hesap Oluşturma ve Giriş**
- Anasayfadan "Ücretsiz Dene" butonuna tıklayın
- Email ve şifreniz ile kayıt olun
- Email adresinize gelen doğrulama linkine tıklayın
- 14 günlük ücretsiz deneme otomatik başlar (kredi kartı gerekmez)

**Adım 2: Turlarınızı Ekleyin**
- "Turlar" sekmesine gidin
- "Yeni Tur Ekle" butonuna tıklayın
- Tur bilgilerini doldurun (başlık, açıklama, destinasyon, fiyat, vb.)
- Tur tarihlerini ekleyin
- Kaydedin

**Adım 3: WhatsApp Entegrasyonu Talep Edin**
- Sol menüden "WhatsApp Yönetimi" sekmesine gidin
- WhatsApp Business telefon numaranızı, şirket adınızı girin
- Entegrasyon talebini gönderin
- Ekibimiz Meta Cloud API bağlantınızı kuracak (genelde 1-2 iş günü)
- Not: Tüm teknik altyapıyı biz yönetiyoruz, ekstra API kurulumu gerekmez!

**Adım 4: Test Edin**
- Entegrasyon aktif olduktan sonra kendi numaranızdan "Merhaba" yazın
- Bot yanıt veriyorsa kurulum tamamdır!
- "Kapadokya turları" gibi bir arama yaparak sistemi test edin
          `
        },
        {
          question: "WhatsApp Business Numarası Nasıl Alınır?",
          answer: `
**WhatsApp Business Uygulaması ile:**
1. App Store veya Google Play'den "WhatsApp Business" uygulamasını indirin
2. İş telefon numaranızla kaydolun
3. İşletme bilgilerinizi girin
4. Turzz admin panelinden WhatsApp Yönetimi üzerinden entegrasyon talebini gönderin

**Önemli Notlar:**
- Normal WhatsApp değil, WhatsApp Business kullanmalısınız
- Aynı numara normal WhatsApp'ta da kullanılabilir ama önerilmez
- Bir numara sadece bir cihazda WhatsApp Business olarak kullanılabilir
- Tüm Meta API altyapısını ve kurulumu biz yönetiyoruz!
          `
        }
      ]
    },
    {
      icon: Upload,
      title: t("help.sections.tours"),
      color: "text-secondary",
      bgColor: "bg-secondary/10",
      items: [
        {
          question: "Tur Nasıl Eklenir ve Düzenlenir?",
          answer: `
**Yeni Tur Eklemek:**
1. Admin panelinde "Turlar" sekmesine gidin
2. "Yeni Tur Ekle" butonuna tıklayın
3. Zorunlu alanları doldurun:
   - Tur Başlığı: Açıklayıcı ve çekici bir başlık
   - Destinasyon: Tur yapılacak yer (ör: Kapadokya)
   - Açıklama: Tur detayları, dahil olan hizmetler
   - Fiyat: Kişi başı fiyat (TL)
   - Para Birimi: TRY, USD, EUR vb.
   - Süre: Kaç gün/saat (ör: 1 Gün, 3 Gün 2 Gece)
4. İsteğe bağlı alanlar:
   - Program URL: Detaylı program linki
   - Kişi sayısı limitleri
   - Çocuk fiyatı
   - Tek kişilik ek ücret
5. "Kaydet" butonuna tıklayın

**Tur Düzenlemek:**
- Turlar listesinde düzenlemek istediğiniz turun üzerine tıklayın
- Değişiklikleri yapın ve "Güncelle" butonuna tıklayın
- Değişiklikler anında aktif olur

**Tur Silmek:**
- Tur kartının sağ üst köşesindeki çöp kutusu ikonuna tıklayın
- Onaylayın (rezervasyonlu turlar silinemez)
          `
        },
        {
          question: "Tur Tarihleri Nasıl Yönetilir?",
          answer: `
**Yeni Tarih Eklemek:**
1. "Turlar" sekmesinde bir tur seçin
2. "Tarih Ekle" butonuna tıklayın
3. Kalkış tarihini seçin
4. Kotayı (maksimum kişi sayısı) girin
5. Fiyatları ayarlayın:
   - Yetişkin fiyatı (zorunlu)
   - Çocuk fiyatı (isteğe bağlı)
   - Tek kişilik ek ücreti (isteğe bağlı)
6. "Kaydet"e tıklayın

**Tarihleri Düzenlemek:**
- Tarih listesinde düzenle ikonuna tıklayın
- Değişiklikleri yapın ve kaydedin

**Kota Takibi:**
- Her rezervasyon otomatik olarak kotadan düşer
- Kota dolduğunda o tarih müşterilere gösterilmez
- Kotayı istediğiniz zaman artırabilir veya azaltabilirsiniz

**Geçmiş Tarihleri Temizleme:**
- Sistem otomatik olarak geçmiş tarihleri gizler
- Eski tarihleri manuel olarak da silebilirsiniz
          `
        },
        {
          question: "Rezervasyonları Nasıl Yönetirim?",
          answer: `
**Rezervasyon Listesi:**
- "Rezervasyonlar" sekmesinden tüm rezervasyonları görüntüleyin
- Sıralama: En yeni en üstte
- Filtreleme: Duruma göre filtreleme yapabilirsiniz

**Rezervasyon Durumları:**
1. **YENİ (NEW)**: Müşteri rezervasyon talebi gönderdi
   - Kontrol edin ve onaylayın veya iptal edin
   
2. **BEKLEMEDE (PENDING)**: Ödeme veya ek bilgi bekleniyor
   - Müşteri ile iletişime geçip süreci tamamlayın
   
3. **ONAYLANDI (CONFIRMED)**: Rezervasyon kesinleşti
   - Otomatik olarak onay mesajı gönderilir (şablon mesaj)
   - Tur tarihinden önce hatırlatma gönderilebilir
   
4. **İPTAL (CANCELLED)**: Rezervasyon iptal edildi
   - Otomatik iptal mesajı gönderilir
   - Kota geri eklenir

**Durum Değiştirmek:**
- Rezervasyon satırındaki durum dropdown'ından yeni durumu seçin
- Değişiklik otomatik kaydedilir ve müşteriye bildirim gönderilir

**Excel'e Aktarma:**
- "Excel'e Aktar" butonuna tıklayın
- Tüm rezervasyonlar detaylı şekilde indirilir
- Tarih, fiyat, müşteri bilgileri dahil
          `
        }
      ]
    },
    {
      icon: MessageSquare,
      title: t("help.sections.whatsapp"),
      color: "text-primary",
      bgColor: "bg-primary/10",
      items: [
        {
          question: "WhatsApp Botu Nasıl Çalışır?",
          answer: `
**Bot Yetenekleri:**
1. **Tur Arama**: Müşteriler doğal dilde arama yapabilir
   - Örnek: "Kapadokya turları", "3 günlük Ege turları"
   - AI destekli akıllı arama
   
2. **Fiyat Bilgisi**: Otomatik fiyat ve tarih bilgisi verir
3. **Rezervasyon**: Adım adım rehberlikle rezervasyon alır
4. **Ödeme Linki**: PayTR ile güvenli ödeme linki gönderir (opsiyonel)
5. **Çoklu Dil**: Müşterinin dilini otomatik algılar (7 dil destekli)

**Desteklenen Diller:**
- 🇹🇷 Türkçe
- 🇬🇧 İngilizce
- 🇩🇪 Almanca
- 🇷🇺 Rusça
- 🇸🇦 Arapça
- 🇫🇷 Fransızca
- 🇪🇸 İspanyolca

**Müşteri Deneyimi:**
1. Müşteri WhatsApp'tan mesaj atar
2. Bot anında yanıt verir (7/24)
3. Turları öneri olarak sunar
4. Müşteri seçim yapar
5. Bot rezervasyon işlemini tamamlar
6. Onay mesajı otomatik gönderilir

**Rezervasyon Süreci (Wizard):**
- Müşteri "rezervasyon yapmak istiyorum" der
- Bot adım adım bilgi alır:
  1. Tur seçimi
  2. Tarih seçimi
  3. Kişi sayısı (yetişkin/çocuk)
  4. İsim ve telefon
- Tüm süreç WhatsApp içinde tamamlanır
          `
        },
        {
          question: "Mesaj Şablonları Nasıl Kullanılır?",
          answer: `
**Varsayılan Şablonlar:**
Sistem 3 ana şablon türü sunar:
1. **Rezervasyon Onayı (reservation_confirmed)**
   - Rezervasyon onaylandığında otomatik gönderilir
   - İçerik: Tur adı, tarih, kişi sayısı, toplam tutar
   
2. **Rezervasyon İptali (reservation_cancelled)**
   - İptal durumunda otomatik gönderilir
   - İçerik: İptal nedeni, iade bilgileri
   
3. **Tur Hatırlatması (tour_reminder)**
   - Tur tarihinden önce hatırlatma
   - İçerik: Toplanma yeri, saat, getirmesi gerekenler

**Şablon Değişkenleri:**
Her şablonda kullanılabilen değişkenler:
- {full_name}: Müşteri adı
- {tour_name}: Tur başlığı
- {date}: Tur tarihi
- {pax}: Kişi sayısı
- {total_amount}: Toplam tutar
- {currency}: Para birimi
- {meeting_time}: Toplanma saati
- {meeting_point}: Toplanma yeri

**Şablonları Özelleştirmek:**
1. "Ayarlar" > "Mesaj Şablonları" sekmesine gidin
2. Düzenlemek istediğiniz şablonu seçin
3. Dili seçin
4. İçeriği düzenleyin (değişkenleri koruyun)
5. "Kaydet" butonuna tıklayın

**Yeni Dil Eklemek:**
- "Yeni Şablon Ekle" butonuna tıklayın
- Şablon türünü ve dili seçin
- İçeriği yazın
- Kaydedin

**Otomatik Gönderim:**
- Rezervasyon durumu değiştiğinde otomatik gönderilir
- Manuel gönderim de yapılabilir
- Sistem müşterinin dil tercihine göre doğru şablonu seçer
          `
        },
        {
          question: "Müşteri Profilleri ve Tercihler",
          answer: `
**Otomatik Profil Oluşturma:**
- Her WhatsApp müşterisi için otomatik profil oluşturulur
- İlk mesajdan itibaren kayıt tutulur

**Profilde Tutulan Bilgiler:**
1. **Temel Bilgiler:**
   - Telefon numarası
   - Ad soyad (müşteri verirse)
   - Dil tercihi (otomatik algılanır)

2. **Etkileşim Geçmişi:**
   - Toplam mesaj sayısı
   - Son etkileşim tarihi
   - Son arama sorgusu

3. **Tercihler:**
   - Tercih edilen destinasyonlar
   - Bütçe aralığı
   - Tercih edilen tur tipleri

**Profilleri Görüntülemek:**
- "WhatsApp Kullanıcıları" sekmesine gidin
- Tüm müşteri profillerini görün
- Arama yaparak belirli bir müşteri bulun
- Detayları görüntülemek için profile tıklayın

**Kullanım Senaryoları:**
- Müşteri tekrar geldiğinde geçmiş tercihlerini hatırla
- Kişiselleştirilmiş öneriler sun
- Sadık müşterileri belirle
- İstatistik ve analiz yap
          `
        }
      ]
    },
    {
      icon: BarChart3,
      title: t("help.sections.analytics"),
      color: "text-secondary",
      bgColor: "bg-secondary/10",
      items: [
        {
          question: "Hangi Raporları Görebilirim?",
          answer: `
**Dashboard Ana Ekranı:**
1. **Temel İstatistikler:**
   - Toplam tur sayısı
   - Aktif tur tarihleri
   - Toplam rezervasyon sayısı
   - Bu haftaki yeni rezervasyonlar

2. **Rezervasyon Dağılımı:**
   - Durum bazında dağılım (Yeni, Beklemede, Onaylı, İptal)
   - Pasta grafik ile görselleştirme

3. **Son Rezervasyonlar:**
   - En son 5 rezervasyon
   - Hızlı erişim için özet bilgiler

**Gelişmiş Analitik (İleri Düzey Özellik):**
1. **Popüler Turlar:**
   - En çok rezervasyon alan turlar
   - Tur başına ortalama gelir
   - Trend analizi

2. **Popüler Destinasyonlar:**
   - Destinasyon bazında istatistikler
   - Harita görünümü (yakında)

3. **Aylık Gelir Trendi:**
   - Son 6 ayın gelir grafiği
   - Önceki dönem karşılaştırması
   - Büyüme oranı

**Gelir Analizi:**
- "Gelir Analizi" sekmesine gidin
- Tarih aralığı seçin
- Detaylı gelir raporlarını görüntüleyin:
  - Toplam gelir
  - Ortalama sipariş değeri
  - En karlı turlar
  - Aylık/haftalık karşılaştırmalar

**Excel Raporları:**
- Tüm verileri Excel'e aktarabilirsiniz
- Özel analizler için kullanabilirsiniz
          `
        },
        {
          question: "Kullanım İstatistikleri",
          answer: `
**Mesaj Kullanımı:**
- "Kullanım" sekmesinden mesaj kotanızı görün
- Aylık limit ve kullanılan mesaj sayısı
- Yenileme tarihi

**Plan Bilgileri:**
- Mevcut paketiniz
- Dahil özellikler
- Paket yükseltme seçenekleri

**Uyarılar:**
- Kota %80'e ulaştığında bildirim
- Kota bittiğinde uyarı
- Otomatik mesajlar durduğunda bilgi

**Kullanım Optimizasyonu:**
- Bot yanıtlarını kısaltarak mesaj tasarrufu
- Otomatik yanıtları optimize edin
- Gereksiz mesajları azaltın
          `
        }
      ]
    },
    {
      icon: CreditCard,
      title: t("help.sections.payments"),
      color: "text-primary",
      bgColor: "bg-primary/10",
      items: [
        {
          question: "Abonelik Paketleri ve Fiyatlandırma",
          answer: `
**Mevcut Paketler:**

1. **BAŞLANGIÇ PAKETİ - 2.999 TL/ay**
   ✓ 1.000 WhatsApp mesajı/ay
   ✓ En fazla 10 tur
   ✓ 1 dil seçimi
   ✓ Temel analitik
   ✓ E-posta desteği
   → Küçük acenteler için ideal

2. **PROFESYONEL PAKET - 4.999 TL/ay** (EN POPÜLER)
   ✓ 5.000 WhatsApp mesajı/ay
   ✓ Sınırsız tur
   ✓ 3 dile kadar destek
   ✓ 4 konuşma üslubu
   ✓ Kullanıcı profilleri ve takip
   ✓ Otomatik hatırlatıcılar ve takip mesajları
   ✓ Gelişmiş analitik ve raporlama
   → Büyüyen işletmeler için ideal

3. **KURUMSAL PAKET - 7.999 TL/ay**
   ✓ Sınırsız WhatsApp mesajı
   ✓ Sınırsız tur
   ✓ Tüm 7 dil desteği
   ✓ 5 konuşma üslubu
   ✓ Müşteri memnuniyet anketleri
   ✓ 7/24 premium destek
   → Büyük organizasyonlar için

**Ücretsiz Deneme:**
- 14 gün ücretsiz
- Kredi kartı gerekmez
- Tüm özellikler aktif
- İstediğiniz zaman iptal edebilirsiniz
          `
        },
        {
          question: "Ödeme Yöntemleri ve Faturalama",
          answer: `
**Ödeme Seçenekleri:**
1. Kredi/Banka Kartı (Visa, Mastercard)
2. Havale/EFT
3. Kurumsal faturalandırma

**Fatura Bilgileri:**
- Her ay otomatik fatura kesilir
- Faturalar email ile gönderilir
- "Ayarlar" > "Fatura Geçmişi" bölümünden görüntülenebilir

**Yıllık Ödeme İndirimi:**
- Yıllık ödeme yaparsanız %10 indirim
- Başlangıç: 32.389 TL/yıl (2.699 TL/ay)
- Profesyonel: 53.989 TL/yıl (4.499 TL/ay)
- Kurumsal: 86.389 TL/yıl (7.199 TL/ay)

**Ödeme Güvenliği:**
- Tüm ödemeler SSL ile korunur
- PCI-DSS uyumlu sistem
- Kart bilgileri saklanmaz
          `
        },
        {
          question: "Abonelik Yönetimi",
          answer: `
**Paket Değiştirme:**
1. "Ayarlar" > "Abonelik" sekmesine gidin
2. "Paketi Değiştir" butonuna tıklayın
3. Yeni paketi seçin
4. Onaylayın

**Yükseltme (Upgrade):**
- Anında aktif olur
- Ücret farkı orantılı olarak hesaplanır
- Eski dönem kredisi korunur

**Düşürme (Downgrade):**
- Mevcut dönem sonunda geçerli olur
- Önceden bildirim gönderilir

**İptal Etme:**
- İstediğiniz zaman iptal edebilirsiniz
- Mevcut dönem sonuna kadar kullanım devam eder
- Veri 30 gün boyunca saklanır
- "Ayarlar" > "Abonelik" > "İptal Et"

**Yeniden Başlatma:**
- İptal ettikten sonra tekrar başlatabilirsiniz
- Tüm verileriniz korunmuş olacaktır (30 gün içinde)
          `
        }
      ]
    },
    {
      icon: Settings,
      title: t("help.sections.settings"),
      color: "text-secondary",
      bgColor: "bg-secondary/10",
      items: [
        {
          question: "Acente Bilgileri ve Ayarları",
          answer: `
**Temel Bilgiler:**
1. "Ayarlar" > "Acente Bilgileri" sekmesine gidin
2. Düzenleyebileceğiniz alanlar:
   - Acente adı
   - Telefon numarası
   - Adres bilgileri
   - Çalışma saatleri
   - Web sitesi URL
   - Google Maps linki

**WhatsApp Ayarları:**
- WhatsApp entegrasyonu "WhatsApp Yönetimi" sekmesinden talep edilir
- Entegrasyon durumunu aynı sayfadan takip edebilirsiniz
- Meta Cloud API bağlantısını ekibimiz yönetir

**Bildirim Ayarları:**
- Yeni rezervasyon bildirimleri
- Sistem bildirimleri
- Kullanım uyarıları
          `
        },
        {
          question: "Kullanıcı ve Rol Yönetimi",
          answer: `
**Ekip Üyeleri Ekleme:**
1. "Ayarlar" > "Kullanıcılar" sekmesine gidin
2. "Yeni Kullanıcı Ekle" butonuna tıklayın
3. E-posta adresini girin
4. Rol seçin
5. Davet gönderin

**Roller ve Yetkiler:**
1. **Admin (Yönetici):**
   - Tüm yetkilere sahip
   - Kullanıcı ekleyebilir/çıkarabilir
   - Abonelik yönetimi
   - Tüm ayarlara erişim

2. **Operatör:**
   - Tur ekleme/düzenleme
   - Rezervasyon yönetimi
   - Raporları görüntüleme
   - Ayarlara sınırlı erişim

3. **Görüntüleyici:**
   - Sadece raporları görüntüleme
   - Rezervasyon listesini görme
   - Düzenleme yapamaz

**Kullanıcı Kaldırma:**
- Kullanıcı listesinden sil ikonuna tıklayın
- Onaylayın
- Kullanıcının erişimi anında iptal edilir
          `
        }
      ]
    },
    {
      icon: Shield,
      title: t("help.sections.settings"),
      color: "text-primary",
      bgColor: "bg-primary/10",
      items: [
        {
          question: "Veri Güvenliği ve Gizlilik",
          answer: `
**Güvenlik Önlemleri:**
- SSL/TLS şifreleme (256-bit)
- GDPR uyumlu veri işleme
- Düzenli güvenlik denetimleri
- Otomatik yedekleme (günlük)
- İki faktörlü kimlik doğrulama (yakında)

**Veri Saklama:**
- Tüm veriler Türkiye'de saklanır
- AWS altyapısı kullanılır
- Otomatik yedekleme 30 gün
- İptal sonrası veri 30 gün saklanır

**Gizlilik:**
- Müşteri verileri sadece sizindir
- Turzz verilerinize erişemez (sistem bakımı hariç)
- Üçüncü taraflara satılmaz/paylaşılmaz
- İstendiğinde tüm veriler silinir

**Veri İhracı:**
- "Ayarlar" > "Veri İhracı" bölümünden
- Tüm verilerinizi Excel/JSON formatında indirin
          `
        },
        {
          question: "Destek ve Yardım Alma",
          answer: `
**Destek Kanalları:**

1. **E-posta Desteği:**
   - info@ai.turzz.com
   - Yanıt süresi: 24 saat içinde
   - Tüm paketlerde mevcut

2. **WhatsApp Destek:**
   - Hızlı sorular için
   - Çalışma saatleri: 09:00-18:00
   - Profesyonel ve üzeri paketlerde

3. **Öncelikli Destek:**
   - Profesyonel ve Kurumsal paketlerde
   - Daha hızlı yanıt süresi
   - Telefon desteği

4. **7/24 Premium Destek:**
   - Sadece Kurumsal pakette
   - Her zaman ulaşılabilir
   - Özel destek yöneticisi

**Yardım Kaynakları:**
- Bu yardım sayfası (/yardim)
- Video eğitimler (yakında)
- SSS (Sık Sorulan Sorular)
- Başlangıç rehberi (/nasil-baslarim)

**Teknik Sorunlar:**
- Sisteme giriş yapamıyorum
- WhatsApp bağlantısı çalışmıyor
- Ödeme hatası
- Veri kayboldu
→ Hemen info@ai.turzz.com adresine yazın
          `
        },
        {
          question: "Sık Karşılaşılan Sorunlar ve Çözümleri",
          answer: `
**"Bot yanıt vermiyor"**
✓ WhatsApp entegrasyonunuz aktif mi? (WhatsApp Yönetimi'nden kontrol edin)
✓ WhatsApp Business kullanıyor musunuz?
✓ Mesaj kotanız dolmuş olabilir mi?
→ Çözüm: WhatsApp Yönetimi sayfasından durumu kontrol edin, desteğe yazın

**"Turlar listelenmiyor"**
✓ En az 1 tur ve tarih eklediniz mi?
✓ Tarihler gelecekte mi?
✓ Tur aktif mi?
→ Çözüm: Tur listesini kontrol edin

**"Rezervasyon oluşturulamıyor"**
✓ Kota dolu mu?
✓ Tarih geçerli mi?
✓ Tüm zorunlu alanlar dolu mu?
→ Çözüm: Kota ve tarih kontrolü yapın

**"Şablon mesajı gönderilmiyor"**
✓ Şablon oluşturulmuş mu?
✓ Şablon aktif mi?
✓ Değişkenler doğru yazılmış mı?
→ Çözüm: Şablon ayarlarını kontrol edin

**"Ödeme alınamıyor"**
✓ PayTR entegrasyonu aktif mi?
✓ API bilgileri doğru mu?
→ Çözüm: Ayarlar > Ödeme Entegrasyonu kontrol

**"Rapor verisi görünmüyor"**
✓ Tarih aralığı doğru mu?
✓ En az 1 rezervasyon var mı?
→ Çözüm: Filtreleri kontrol edin

**Hala Çözüm Bulamadınız mı?**
→ info@ai.turzz.com adresine detaylı açıklama ile yazın
→ Ekran görüntüsü eklerseniz daha hızlı çözüm buluruz
          `
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/95 backdrop-blur-lg sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={turzzLogo} alt="Turzz Logo" className="h-14 sm:h-16 w-auto transition-transform duration-300 hover:scale-105" />
              <div className="hidden sm:block">
                <p className="text-sm text-muted-foreground">{t("hero.subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <LanguageSelector />
              <ThemeToggle />
              <Button asChild variant="ghost" className="hidden md:inline-flex hover:scale-105 transition-transform duration-300">
                <a href="/">{t("nav.home")}</a>
              </Button>
              <Button asChild variant="ghost" className="hidden md:inline-flex hover:scale-105 transition-transform duration-300">
                <a href="/nasil-baslarim">{t("nav.gettingStarted")}</a>
              </Button>
              <Button asChild className="bg-gradient-ocean hover:opacity-90 transition-all duration-300 hover:scale-105">
                <a href="/auth">{t("auth.login")}</a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-secondary/5 to-background py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <Badge className="mb-2">
              <BookOpen className="w-3 h-3 mr-1" />
              {t("help.title")}
            </Badge>
            <h2 className="text-4xl font-bold text-foreground">
              Turzz AI Kullanım Kılavuzu
            </h2>
            <p className="text-lg text-muted-foreground">
              Sistemin tüm özelliklerini adım adım öğrenin. Kurulumdan ileri düzey kullanıma kadar her şey burada.
            </p>
            <div className="flex flex-wrap gap-3 justify-center pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Adım adım rehber
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Görsel açıklamalar
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Sorun çözme ipuçları
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto space-y-12">
            {sections.map((section, sectionIndex) => (
              <Card key={sectionIndex} className="border-border/50 shadow-card overflow-hidden">
                <CardHeader className={`${section.bgColor} border-b`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg ${section.bgColor} flex items-center justify-center`}>
                      <section.icon className={`w-6 h-6 ${section.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">{section.title}</CardTitle>
                      <CardDescription>
                        {section.items.length} konuda detaylı açıklama
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <Accordion type="single" collapsible className="w-full">
                    {section.items.map((item, itemIndex) => (
                      <AccordionItem key={itemIndex} value={`item-${sectionIndex}-${itemIndex}`}>
                        <AccordionTrigger className="text-left hover:text-primary">
                          <span className="font-semibold">{item.question}</span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                            {item.answer}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Links */}
          <div className="max-w-5xl mx-auto mt-12">
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardContent className="p-8">
                <div className="text-center space-y-4">
                  <h3 className="text-2xl font-bold text-foreground">Hala Yardıma İhtiyacınız Var mı?</h3>
                  <p className="text-muted-foreground">
                    Destek ekibimiz size yardımcı olmak için hazır
                  </p>
                  <div className="flex flex-wrap gap-4 justify-center pt-4">
                    <Button size="lg" className="gap-2">
                      <MessageSquare className="w-5 h-5" />
                      info@ai.turzz.com
                    </Button>
                    <Button size="lg" variant="outline" onClick={() => navigate("/nasil-baslarim")}>
                      <Video className="w-5 h-5 mr-2" />
                      Başlangıç Rehberi
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Help;
