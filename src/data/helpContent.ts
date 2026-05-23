// Multi-language help content for the Help page
// Updated to reflect current system features (Meta Embedded Signup, correct plan limits, etc.)

export interface HelpItem {
  question: string;
  answer: string;
}

export interface HelpSection {
  titleKey: string; // maps to help.sections.* in i18n
  items: HelpItem[];
}

type HelpContent = Record<string, HelpSection[]>;

const helpContent: HelpContent = {
  tr: [
    {
      titleKey: "setup",
      items: [
        {
          question: "İlk Kurulum Nasıl Yapılır?",
          answer: `**Adım 1: Hesap Oluşturma ve Giriş**
- Anasayfadan "Ücretsiz Dene" butonuna tıklayın
- Email ve şifreniz ile kayıt olun
- Email adresinize gelen doğrulama linkine tıklayın
- 14 günlük ücretsiz deneme otomatik başlar (kredi kartı gerekmez)

**Adım 2: Turlarınızı Ekleyin**
- "Turlar" sekmesine gidin
- "Yeni Tur Ekle" butonuna tıklayın
- Tur bilgilerini doldurun (başlık, destinasyon, fiyat, süre vb.)
- Tur tarihlerini ekleyin ve kaydedin

**Adım 3: WhatsApp Bağlantısı (Meta Embedded Signup)**
- Sol menüden "Chat Bot Ayarları" > "WhatsApp Entegrasyonu" sekmesine gidin
- "Connect with Facebook" butonuna tıklayın
- Facebook/Meta Business hesabınızla giriş yapın
- WhatsApp Business numaranızı seçin ve izinleri onaylayın
- Bağlantı otomatik olarak kurulur (5-10 dakika)
- Herhangi bir teknik bilgi veya Twilio hesabı gerekmez!

**Adım 4: Test Edin**
- Bağlantı aktif olduktan sonra kendi numaranızdan "Merhaba" yazın
- Bot yanıt veriyorsa kurulum tamamdır!
- "Kapadokya turları" gibi bir arama yaparak sistemi test edin`
        },
        {
          question: "WhatsApp Business Numarası Nasıl Bağlanır?",
          answer: `**Meta Embedded Signup ile Bağlantı (Önerilen):**
1. Admin panelinde "Chat Bot Ayarları" > "WhatsApp Entegrasyonu" sekmesine gidin
2. "Connect with Facebook" butonuna tıklayın
3. Facebook hesabınızla giriş yapın
4. Meta Business hesabınızı seçin (yoksa oluşturulacak)
5. WhatsApp Business numaranızı seçin
6. İzinleri onaylayın - bağlantı otomatik kurulur

**Önemli Notlar:**
- Normal WhatsApp değil, WhatsApp Business kullanmanız gerekir
- Twilio hesabı veya API kurulumu gerekmez - Meta Cloud API kullanılır
- Bağlantı tamamen self-servis, 5-10 dakikada tamamlanır
- Bir numara aynı anda sadece bir platformda kullanılabilir`
        }
      ]
    },
    {
      titleKey: "tours",
      items: [
        {
          question: "Tur Nasıl Eklenir ve Düzenlenir?",
          answer: `**Yeni Tur Eklemek:**
1. Admin panelinde "Turlar" sekmesine gidin
2. "Yeni Tur Ekle" butonuna tıklayın
3. Zorunlu alanları doldurun:
   - Tur Başlığı, Destinasyon, Fiyat, Para Birimi, Süre
4. İsteğe bağlı: Program URL, kişi sayısı limitleri, çocuk fiyatı
5. "Kaydet" butonuna tıklayın

**Not:** Başlangıç paketinde en fazla 10 tur eklenebilir. Profesyonel ve Kurumsal paketlerde tur sayısı sınırsızdır.

**Tur Düzenlemek:**
- Turlar listesinde düzenlemek istediğiniz turun üzerine tıklayın
- Değişiklikleri yapın ve "Güncelle" butonuna tıklayın

**Tur Silmek:**
- Tur kartının sağ üst köşesindeki çöp kutusu ikonuna tıklayın
- Rezervasyonlu turlar silinemez`
        },
        {
          question: "Tur Tarihleri Nasıl Yönetilir?",
          answer: `**Yeni Tarih Eklemek:**
1. "Turlar" sekmesinde bir tur seçin
2. "Tarih Ekle" butonuna tıklayın
3. Kalkış tarihini seçin, kotayı ve fiyatları girin
4. "Kaydet"e tıklayın

**Kota Takibi:**
- Her rezervasyon otomatik olarak kotadan düşer
- Kota dolduğunda o tarih müşterilere gösterilmez
- Kotayı istediğiniz zaman artırabilir veya azaltabilirsiniz

**Geçmiş Tarihleri:** Sistem otomatik olarak geçmiş tarihleri gizler`
        },
        {
          question: "Rezervasyonları Nasıl Yönetirim?",
          answer: `**Rezervasyon Durumları:**
- **YENİ (NEW):** Müşteri rezervasyon talebi gönderdi
- **BEKLEMEDE (PENDING):** Ödeme veya ek bilgi bekleniyor
- **ONAYLANDI (CONFIRMED):** Rezervasyon kesinleşti - otomatik onay mesajı gönderilir
- **İPTAL (CANCELLED):** Rezervasyon iptal edildi - kota geri eklenir

**Durum Değiştirmek:**
- Rezervasyon satırındaki durum dropdown'ından yeni durumu seçin
- Değişiklik otomatik kaydedilir ve müşteriye bildirim gönderilir

**Excel'e Aktarma:**
- "Excel'e Aktar" butonuyla tüm rezervasyonları detaylı şekilde indirin`
        }
      ]
    },
    {
      titleKey: "whatsapp",
      items: [
        {
          question: "WhatsApp Botu Nasıl Çalışır?",
          answer: `**Bot Yetenekleri:**
1. **Tur Arama:** Doğal dilde akıllı arama (ör: "Kapadokya turları", "3 günlük Ege turları")
2. **Fiyat ve Tarih Bilgisi:** Otomatik fiyat, tarih ve kota bilgisi
3. **Akıllı Rezervasyon Wizard'ı:** Adım adım rehberli rezervasyon süreci
4. **Çoklu Dil:** Müşterinin dilini otomatik algılar (7 dil: TR, EN, DE, RU, AR, FR, ES)
5. **Müşteri Profilleri:** Otomatik tercih ve geçmiş takibi

**Konuşma Üslupları:**
- Samimi/Dostane (Standart), Kurumsal, Enerjik/Dinamik, Premium (plan bazlı erişim; 4 stil)

**Meta 24 Saat Kuralı:**
- Müşteri mesaj attığında 24 saat içinde serbest mesaj gönderilebilir
- 24 saat sonrası için onaylı şablon mesajları kullanılır`
        },
        {
          question: "Mesaj Şablonları Nasıl Kullanılır?",
          answer: `**Varsayılan Şablonlar:**
1. **Rezervasyon Onayı:** Otomatik gönderilir - tur adı, tarih, kişi sayısı, tutar
2. **Rezervasyon İptali:** İptal durumunda otomatik gönderilir
3. **Tur Hatırlatması:** Tur tarihinden önce hatırlatma (Profesyonel+ paketlerde)

**Şablon Değişkenleri:** {full_name}, {tour_name}, {date}, {pax}, {total_amount}, {currency}

**Şablonları Özelleştirmek:**
- "Chat Bot Ayarları" > "Mesaj Şablonları" sekmesine gidin
- Dili seçin, içeriği düzenleyin ve kaydedin
- Her dil için ayrı şablon oluşturabilirsiniz

**Not:** Mesaj şablonları Profesyonel ve Kurumsal paketlerde kullanılabilir.`
        },
        {
          question: "Müşteri Profilleri ve Tercihler",
          answer: `**Otomatik Profil Oluşturma:**
- Her WhatsApp müşterisi için otomatik profil oluşturulur
- Telefon numarası, ad, dil tercihi, etkileşim geçmişi, tercih edilen destinasyonlar takip edilir

**Otomatik Etiketleme:** VIP, düzenli müşteri, potansiyel müşteri gibi etiketler

**Profilleri Görüntülemek:**
- "WhatsApp Kullanıcıları" sekmesine gidin
- Tüm müşteri profillerini görün ve detayları inceleyin

**Not:** Müşteri profilleri Profesyonel ve Kurumsal paketlerde kullanılabilir.`
        }
      ]
    },
    {
      titleKey: "analytics",
      items: [
        {
          question: "Hangi Raporları Görebilirim?",
          answer: `**Dashboard Ana Ekranı:**
- Toplam tur sayısı, aktif tarihler, toplam ve haftalık rezervasyonlar
- Rezervasyon dağılımı (pasta grafik)
- Popüler destinasyonlar ve son rezervasyonlar

**Gelişmiş Analitik (Profesyonel+ paketlerde):**
- Popüler turlar ve destinasyon analitiği
- Aylık gelir trendi ve karşılaştırması
- Müşteri segmentasyonu

**Excel Raporları:** Tüm verileri Excel'e aktarabilirsiniz`
        },
        {
          question: "Kullanım İstatistikleri",
          answer: `**Mesaj Kullanımı:**
- "Kullanım" sekmesinden mesaj kotanızı görün
- Başlangıç: 1.000 mesaj/ay | Profesyonel: 5.000 mesaj/ay | Kurumsal: 50.000 mesaj/ay

**Uyarılar:**
- Kota %80'e ulaştığında bildirim
- Kota bittiğinde otomatik mesajlar durur
- Paket yükseltme seçenekleri sunulur`
        }
      ]
    },
    {
      titleKey: "payments",
      items: [
        {
          question: "Abonelik Paketleri ve Fiyatlandırma",
          answer: `**Mevcut Paketler:**

💼 **BAŞLANGIÇ - 2.999 TL/ay**
✓ 1.000 WhatsApp mesajı/ay | En fazla 10 tur | 1 dil
✓ Temel analitik | E-posta desteği | Standart konuşma üslubu

🚀 **PROFESYONEL - 4.999 TL/ay** (EN POPÜLER)
✓ 5.000 mesaj/ay | 50 tura kadar | 4 dile kadar
✓ 4 konuşma üslubu | Kullanıcı profilleri | Otomatik hatırlatıcılar
✓ Takip mesajları | Gelişmiş analitik | Mesaj şablonları

⭐ **KURUMSAL - İletişime Geçin**
✓ 50.000 mesaj/ay | Sınırsız tur | 7 dil
✓ 4 konuşma üslubu | Müşteri memnuniyet anketleri | 7/24 destek

**Yıllık Ödeme (%10 indirim):**
- Başlangıç: 32.389 TL/yıl (2.699 TL/ay)
- Profesyonel: 53.989 TL/yıl (4.499 TL/ay)
- Kurumsal: 86.389 TL/yıl (7.199 TL/ay)

**Ücretsiz Deneme:** 14 gün, kredi kartı gerekmez, tüm özellikler aktif`
        },
        {
          question: "Ödeme Yöntemleri ve Faturalama",
          answer: `**Ödeme Seçenekleri:**
- Kredi/Banka Kartı (Visa, Mastercard)
- Havale/EFT

**Fatura:** Her ay otomatik kesilir ve email ile gönderilir

**Ödeme Güvenliği:** SSL ile korunur, PCI-DSS uyumlu, kart bilgileri saklanmaz`
        },
        {
          question: "Abonelik Yönetimi",
          answer: `**Paket Değiştirme:**
- "Abonelik Geçmişi" sekmesinden yeni paketi seçin
- Yükseltme anında aktif olur
- Düşürme mevcut dönem sonunda geçerli olur

**İptal:** İstediğiniz zaman, taahhüt yok. Mevcut dönem sonuna kadar kullanım devam eder. Veriler 30 gün saklanır.`
        }
      ]
    },
    {
      titleKey: "settings",
      items: [
        {
          question: "Acente Bilgileri ve Ayarları",
          answer: `**Temel Bilgiler:** "Chat Bot Ayarları" > "Acente Bilgileri" sekmesinden düzenlenebilir:
- Acente adı, telefon, adres, çalışma saatleri, web sitesi, Google Maps linki

**WhatsApp Entegrasyonu:**
- "Chat Bot Ayarları" > "WhatsApp Entegrasyonu" sekmesinden Meta Embedded Signup ile self-servis bağlantı
- Bağlantı durumunu aynı sayfadan takip edebilirsiniz

**Dil Ayarları:**
- "Dil Yönetimi" sekmesinden aktif dilleri seçin
- Başlangıç: 1 dil | Profesyonel: 4 dil | Kurumsal: 7 dil`
        },
        {
          question: "Veri Güvenliği ve Gizlilik",
          answer: `**Güvenlik Önlemleri:**
- SSL/TLS şifreleme (256-bit)
- GDPR uyumlu veri işleme
- Düzenli güvenlik denetimleri ve otomatik yedekleme

**Gizlilik:**
- Müşteri verileri sadece size aittir
- Üçüncü taraflara satılmaz/paylaşılmaz
- İstendiğinde tüm veriler silinir`
        },
        {
          question: "Destek ve Yardım Alma",
          answer: `**Destek Kanalları:**
- **E-posta:** info@turzzai.com (tüm paketlerde, 24 saat içinde yanıt)
- **WhatsApp Destek:** Profesyonel ve Kurumsal paketlerde (09:00-18:00)
- **7/24 Premium Destek:** Sadece Kurumsal pakette

**Yardım Kaynakları:**
- Bu yardım sayfası (/yardim)
- Başlangıç rehberi (/nasil-baslarim)
- Destek talepleri (admin panelinden)`
        },
        {
          question: "Sık Karşılaşılan Sorunlar ve Çözümleri",
          answer: `**"Bot yanıt vermiyor"**
✓ WhatsApp bağlantınız aktif mi? (Chat Bot Ayarları > WhatsApp Entegrasyonu'ndan kontrol edin)
✓ Mesaj kotanız dolmuş olabilir mi?
→ Çözüm: WhatsApp Entegrasyonu sayfasından durumu kontrol edin

**"Turlar listelenmiyor"**
✓ En az 1 tur ve gelecek tarih eklediniz mi?
→ Çözüm: Tur listesini ve tarihlerini kontrol edin

**"Rezervasyon oluşturulamıyor"**
✓ Kota dolu mu? Tarih geçerli mi?
→ Çözüm: Kota ve tarih kontrolü yapın

**Hala çözüm bulamadınız mı?**
→ info@turzzai.com adresine ekran görüntüsü ile yazın`
        }
      ]
    }
  ],
  en: [
    {
      titleKey: "setup",
      items: [
        {
          question: "How to Set Up for the First Time?",
          answer: `**Step 1: Create Account and Log In**
- Click "Try Free" on the homepage
- Register with your email and password
- Click the verification link sent to your email
- 14-day free trial starts automatically (no credit card required)

**Step 2: Add Your Tours**
- Go to the "Tours" tab
- Click "Add New Tour"
- Fill in tour details (title, destination, price, duration, etc.)
- Add tour dates and save

**Step 3: Connect WhatsApp (Meta Embedded Signup)**
- Go to "Chat Bot Settings" > "WhatsApp Integration" from the left menu
- Click the "Connect with Facebook" button
- Log in with your Facebook/Meta Business account
- Select your WhatsApp Business number and approve permissions
- Connection is established automatically (5-10 minutes)
- No technical knowledge or Twilio account required!

**Step 4: Test**
- Send "Hello" from your own number after connection is active
- If the bot responds, setup is complete!`
        },
        {
          question: "How to Connect a WhatsApp Business Number?",
          answer: `**Connect via Meta Embedded Signup (Recommended):**
1. Go to "Chat Bot Settings" > "WhatsApp Integration" tab in admin panel
2. Click "Connect with Facebook" button
3. Log in with your Facebook account
4. Select your Meta Business account (will be created if you don't have one)
5. Select your WhatsApp Business number
6. Approve permissions - connection is established automatically

**Important Notes:**
- You must use WhatsApp Business, not regular WhatsApp
- No Twilio account or API setup required - Meta Cloud API is used
- Connection is fully self-service, completed in 5-10 minutes
- A number can only be used on one platform at a time`
        }
      ]
    },
    {
      titleKey: "tours",
      items: [
        {
          question: "How to Add and Edit Tours?",
          answer: `**Adding a New Tour:**
1. Go to "Tours" tab in admin panel
2. Click "Add New Tour"
3. Fill required fields: Title, Destination, Price, Currency, Duration
4. Optional: Program URL, participant limits, child price
5. Click "Save"

**Note:** Starter plan allows up to 10 tours. Professional and Enterprise plans have unlimited tours.

**Editing:** Click on the tour you want to edit, make changes and click "Update"

**Deleting:** Click the trash icon - tours with reservations cannot be deleted`
        },
        {
          question: "How to Manage Tour Dates?",
          answer: `**Adding a New Date:**
1. Select a tour in the "Tours" tab
2. Click "Add Date", select departure date, set quota and prices
3. Click "Save"

**Quota Tracking:**
- Each reservation automatically reduces quota
- Sold-out dates are hidden from customers
- You can adjust quota anytime

**Past Dates:** System automatically hides past dates`
        },
        {
          question: "How to Manage Reservations?",
          answer: `**Reservation Statuses:**
- **NEW:** Customer sent reservation request
- **PENDING:** Payment or additional info pending
- **CONFIRMED:** Reservation confirmed - automatic confirmation message sent
- **CANCELLED:** Reservation cancelled - quota restored

**Changing Status:** Select new status from the dropdown - saved automatically

**Excel Export:** Download all reservations with full details`
        }
      ]
    },
    {
      titleKey: "whatsapp",
      items: [
        {
          question: "How Does the WhatsApp Bot Work?",
          answer: `**Bot Capabilities:**
1. **Tour Search:** Natural language smart search (e.g., "Cappadocia tours", "3-day Aegean tours")
2. **Price & Date Info:** Automatic pricing, dates and availability
3. **Smart Reservation Wizard:** Step-by-step guided booking process
4. **Multi-language:** Auto-detects customer's language (7 languages: TR, EN, DE, RU, AR, FR, ES)
5. **Customer Profiles:** Automatic preference and history tracking

**Conversation Styles:** Friendly/Warm (Standard), Corporate, Energetic/Dynamic, Premium (plan-based access)

**Meta 24-Hour Rule:**
- Free messages can be sent within 24 hours of customer message
- Approved template messages are used after 24 hours`
        },
        {
          question: "How to Use Message Templates?",
          answer: `**Default Templates:**
1. **Reservation Confirmation:** Sent automatically - tour name, date, participants, amount
2. **Reservation Cancellation:** Sent automatically on cancellation
3. **Tour Reminder:** Reminder before tour date (Professional+ plans)

**Template Variables:** {full_name}, {tour_name}, {date}, {pax}, {total_amount}, {currency}

**Customizing Templates:**
- Go to "Chat Bot Settings" > "Message Templates"
- Select language, edit content, and save

**Note:** Message templates are available in Professional and Enterprise plans.`
        },
        {
          question: "Customer Profiles and Preferences",
          answer: `**Automatic Profile Creation:**
- A profile is automatically created for each WhatsApp customer
- Phone number, name, language preference, interaction history, preferred destinations are tracked

**Automatic Tagging:** VIP, regular customer, potential customer labels

**Viewing Profiles:** Go to "WhatsApp Users" tab to view all customer profiles

**Note:** Customer profiles are available in Professional and Enterprise plans.`
        }
      ]
    },
    {
      titleKey: "analytics",
      items: [
        {
          question: "What Reports Can I View?",
          answer: `**Dashboard Main Screen:**
- Total tours, active dates, total and weekly reservations
- Reservation distribution (pie chart)
- Popular destinations and recent reservations

**Advanced Analytics (Professional+ plans):**
- Popular tours and destination analytics
- Monthly revenue trends and comparisons
- Customer segmentation

**Excel Reports:** Export all data to Excel`
        },
        {
          question: "Usage Statistics",
          answer: `**Message Usage:**
- View your message quota from the "Usage" tab
- Starter: 1,000 msgs/month | Professional: 5,000 msgs/month | Enterprise: 50,000 msgs/month

**Alerts:**
- Notification when quota reaches 80%
- Automatic messages stop when quota runs out
- Plan upgrade options are offered`
        }
      ]
    },
    {
      titleKey: "payments",
      items: [
        {
          question: "Subscription Plans and Pricing",
          answer: `**Available Plans:**

💼 **STARTER - 2,999 TL/month**
✓ 1,000 WhatsApp messages/month | Up to 10 tours | 1 language
✓ Basic analytics | Email support | Standard conversation style

🚀 **PROFESSIONAL - 4,999 TL/month** (MOST POPULAR)
✓ 5,000 msgs/month | Up to 50 tours | Up to 4 languages
✓ 4 conversation styles | User profiles | Auto reminders
✓ Follow-up messages | Advanced analytics | Message templates

⭐ **ENTERPRISE - Contact Us**
✓ 50,000 messages/month | Unlimited tours | All 7 languages
✓ 4 conversation styles | Customer satisfaction surveys | 24/7 support

**Annual Payment (10% discount):**
- Starter: 32,389 TL/year (2,699 TL/month)
- Professional: 53,989 TL/year (4,499 TL/month)
- Enterprise: 86,389 TL/year (7,199 TL/month)

**Free Trial:** 14 days, no credit card required, all features active`
        },
        {
          question: "Payment Methods and Billing",
          answer: `**Payment Options:**
- Credit/Debit Card (Visa, Mastercard)
- Bank Transfer

**Billing:** Automatic monthly invoice sent via email

**Payment Security:** SSL protected, PCI-DSS compliant, card info not stored`
        },
        {
          question: "Subscription Management",
          answer: `**Changing Plans:**
- Select new plan from "Subscription History"
- Upgrades activate immediately
- Downgrades apply at end of current period

**Cancellation:** Anytime, no commitment. Usage continues until end of current period. Data stored for 30 days.`
        }
      ]
    },
    {
      titleKey: "settings",
      items: [
        {
          question: "Agency Information and Settings",
          answer: `**Basic Info:** Edit from "Chat Bot Settings" > "Agency Information":
- Agency name, phone, address, working hours, website, Google Maps link

**WhatsApp Integration:**
- Self-service connection via Meta Embedded Signup in "Chat Bot Settings" > "WhatsApp Integration"
- Track connection status on the same page

**Language Settings:**
- Select active languages from "Language Management"
- Starter: 1 language | Professional: 4 languages | Enterprise: 7 languages`
        },
        {
          question: "Data Security and Privacy",
          answer: `**Security Measures:**
- SSL/TLS encryption (256-bit)
- GDPR compliant data processing
- Regular security audits and automatic backups

**Privacy:**
- Customer data belongs only to you
- Not sold/shared with third parties
- All data deleted upon request`
        },
        {
          question: "Support and Getting Help",
          answer: `**Support Channels:**
- **Email:** info@turzzai.com (all plans, response within 24 hours)
- **WhatsApp Support:** Professional and Enterprise plans (09:00-18:00)
- **24/7 Premium Support:** Enterprise plan only

**Help Resources:**
- This help page (/yardim)
- Getting started guide (/nasil-baslarim)
- Support tickets (from admin panel)`
        },
        {
          question: "Common Issues and Solutions",
          answer: `**"Bot is not responding"**
✓ Is your WhatsApp connection active? (Check in Chat Bot Settings > WhatsApp Integration)
✓ Has your message quota run out?
→ Solution: Check status in WhatsApp Integration page

**"Tours are not listed"**
✓ Have you added at least 1 tour with a future date?
→ Solution: Check your tour list and dates

**"Reservation cannot be created"**
✓ Is quota full? Is the date valid?
→ Solution: Check quota and dates

**Still can't find a solution?**
→ Write to info@turzzai.com with a screenshot`
        }
      ]
    }
  ],
  de: [
    {
      titleKey: "setup",
      items: [
        {
          question: "Wie richte ich das System ein?",
          answer: `**Schritt 1: Konto erstellen und anmelden**
- Klicken Sie auf "Kostenlos testen" auf der Startseite
- Registrieren Sie sich mit E-Mail und Passwort
- Klicken Sie auf den Bestätigungslink in Ihrer E-Mail
- 14-tägige kostenlose Testphase startet automatisch (keine Kreditkarte erforderlich)

**Schritt 2: Touren hinzufügen**
- Gehen Sie zum Tab "Touren"
- Klicken Sie auf "Neue Tour hinzufügen"
- Füllen Sie die Tourdetails aus und speichern Sie

**Schritt 3: WhatsApp verbinden (Meta Embedded Signup)**
- Gehen Sie zu "WhatsApp-Verwaltung"
- Klicken Sie auf "Mit Facebook verbinden"
- Melden Sie sich mit Ihrem Facebook/Meta Business-Konto an
- Wählen Sie Ihre WhatsApp Business-Nummer und genehmigen Sie die Berechtigungen
- Verbindung wird automatisch hergestellt (5-10 Minuten)

**Schritt 4: Testen**
- Senden Sie "Hallo" von Ihrer eigenen Nummer und prüfen Sie die Bot-Antwort`
        },
        {
          question: "Wie verbinde ich meine WhatsApp Business-Nummer?",
          answer: `**Verbindung über Meta Embedded Signup:**
1. Gehen Sie zum Tab "WhatsApp-Verwaltung"
2. Klicken Sie auf "Mit Facebook verbinden"
3. Melden Sie sich mit Facebook an
4. Wählen Sie Ihr Meta Business-Konto
5. Wählen Sie Ihre WhatsApp Business-Nummer
6. Genehmigen Sie die Berechtigungen

**Wichtige Hinweise:**
- Kein Twilio-Konto oder API-Setup erforderlich
- Self-Service-Verbindung in 5-10 Minuten
- Meta Cloud API wird verwendet`
        }
      ]
    },
    {
      titleKey: "tours",
      items: [
        {
          question: "Wie füge ich Touren hinzu?",
          answer: `**Neue Tour hinzufügen:**
1. Gehen Sie zum Tab "Touren" und klicken Sie auf "Neue Tour"
2. Füllen Sie die Pflichtfelder aus: Titel, Ziel, Preis, Währung, Dauer
3. Klicken Sie auf "Speichern"

**Hinweis:** Starter-Paket: max. 10 Touren. Professional: bis zu 50 Touren. Enterprise: unbegrenzt.`
        },
        {
          question: "Wie verwalte ich Tourdaten?",
          answer: `**Neues Datum hinzufügen:**
1. Wählen Sie eine Tour im Tab "Touren"
2. Klicken Sie auf "Datum hinzufügen", wählen Sie das Abreisedatum und legen Sie Kontingent und Preise fest
3. Klicken Sie auf "Speichern"

**Kontingent-Tracking:**
- Jede Reservierung reduziert automatisch das Kontingent
- Ausgebuchte Termine werden für Kunden ausgeblendet
- Kontingent kann jederzeit angepasst werden

**Vergangene Daten:** Das System blendet vergangene Daten automatisch aus`
        },
        {
          question: "Wie verwalte ich Reservierungen?",
          answer: `**Reservierungsstatus:**
- **NEU:** Anfrage eingegangen
- **AUSSTEHEND:** Zahlung oder Info ausstehend
- **BESTÄTIGT:** Reservierung bestätigt - automatische Bestätigungsnachricht
- **STORNIERT:** Reservierung storniert - Kontingent wiederhergestellt

**Excel-Export:** Alle Reservierungen mit Details herunterladen`
        }
      ]
    },
    {
      titleKey: "whatsapp",
      items: [
        {
          question: "Wie funktioniert der WhatsApp-Bot?",
          answer: `**Bot-Funktionen:**
1. **Toursuche:** Intelligente Suche in natürlicher Sprache
2. **Preis- und Termininfo:** Automatische Preise, Termine und Verfügbarkeit
3. **Reservierungs-Assistent:** Schritt-für-Schritt-Buchung
4. **Mehrsprachig:** Erkennt automatisch die Sprache des Kunden (7 Sprachen)
5. **Kundenprofile:** Automatische Präferenz- und Verlaufsverfolgung

**Gesprächsstile:** Standard, Unternehmen, Dynamisch, Premium, Freundlich (planabhängig)`
        },
        {
          question: "Wie verwende ich Nachrichtenvorlagen?",
          answer: `**Standardvorlagen:**
1. **Reservierungsbestätigung:** Automatisch gesendet - Tourname, Datum, Teilnehmer, Betrag
2. **Reservierungsstornierung:** Automatisch bei Stornierung gesendet
3. **Tour-Erinnerung:** Erinnerung vor dem Tourdatum (Professional+ Pakete)

**Vorlagenvariablen:** {full_name}, {tour_name}, {date}, {pax}, {total_amount}, {currency}

**Vorlagen anpassen:**
- Gehen Sie zu "Chat Bot Einstellungen" > "Nachrichtenvorlagen"
- Sprache auswählen, Inhalt bearbeiten und speichern

**Hinweis:** Nachrichtenvorlagen sind in Professional und Enterprise Paketen verfügbar.`
        },
        {
          question: "Kundenprofile und Präferenzen",
          answer: `- Automatische Profilerstellung für jeden WhatsApp-Kunden
- Verfolgung von Telefonnummer, Name, Sprachpräferenz, Interaktionsverlauf
- Automatische Tags: VIP, Stammkunde, potenzieller Kunde

**Hinweis:** Kundenprofile sind in den Paketen Professional und Enterprise verfügbar.`
        }
      ]
    },
    {
      titleKey: "analytics",
      items: [
        {
          question: "Welche Berichte kann ich sehen?",
          answer: `**Dashboard:**
- Gesamttouren, aktive Termine, Reservierungen
- Beliebte Reiseziele und aktuelle Buchungen

**Erweiterte Analysen (Professional+):**
- Beliebte Touren und Zielanalysen
- Monatliche Umsatztrends

**Excel-Berichte:** Alle Daten nach Excel exportieren`
        }
      ]
    },
    {
      titleKey: "payments",
      items: [
        {
          question: "Abonnementpakete und Preise",
          answer: `💼 **STARTER - 2.999 TL/Monat**
✓ 1.000 Nachrichten/Monat | Max. 10 Touren | 1 Sprache

🚀 **PROFESSIONAL - 4.999 TL/Monat** (BELIEBTESTE)
✓ 5.000 Nachrichten/Monat | Bis zu 50 Touren | Bis zu 4 Sprachen
✓ Kundenprofile | Erinnerungen | Erweiterte Analysen

⭐ **ENTERPRISE - Kontaktieren Sie uns**
✓ 50.000 Nachrichten/Monat | Unbegrenzte Touren | Alle 7 Sprachen
✓ 24/7 Support | Kundenzufriedenheitsumfragen

**Jährliche Zahlung: 10% Rabatt**
**Kostenlose Testphase:** 14 Tage, keine Kreditkarte erforderlich`
        },
        {
          question: "Zahlungsmethoden und Abrechnung",
          answer: `**Zahlungsoptionen:**
- Kredit-/Debitkarte (Visa, Mastercard)
- Banküberweisung

**Rechnung:** Automatisch monatlich per E-Mail gesendet

**Zahlungssicherheit:** SSL-geschützt, PCI-DSS konform, Kartendaten werden nicht gespeichert`
        },
        {
          question: "Abonnementverwaltung",
          answer: `**Paket wechseln:**
- Neues Paket im "Abonnementverlauf" auswählen
- Upgrades werden sofort aktiviert
- Downgrades gelten am Ende des aktuellen Zeitraums

**Kündigung:** Jederzeit möglich, keine Verpflichtung. Nutzung läuft bis zum Ende des aktuellen Zeitraums. Daten werden 30 Tage gespeichert.`
        }
      ]
    },
    {
      titleKey: "settings",
      items: [
        {
          question: "Support und Hilfe",
          answer: `**Support-Kanäle:**
- **E-Mail:** info@turzzai.com (alle Pakete)
- **WhatsApp-Support:** Professional und Enterprise
- **24/7 Premium-Support:** Nur Enterprise

**Hilfsquellen:** Diese Hilfeseite, Startleitfaden (/nasil-baslarim)`
        },
        {
          question: "Datensicherheit und Datenschutz",
          answer: `**Sicherheitsmaßnahmen:**
- SSL/TLS-Verschlüsselung (256-Bit)
- DSGVO-konforme Datenverarbeitung
- Regelmäßige Sicherheitsprüfungen und automatische Backups

**Datenschutz:**
- Kundendaten gehören nur Ihnen
- Nicht an Dritte verkauft/weitergegeben
- Alle Daten auf Anfrage gelöscht`
        },
        {
          question: "Häufige Probleme und Lösungen",
          answer: `**"Bot antwortet nicht"**
✓ Ist Ihre WhatsApp-Verbindung aktiv? (Prüfen in Chat Bot Einstellungen > WhatsApp Integration)
✓ Ist Ihr Nachrichtenkontingent aufgebraucht?
→ Lösung: Status auf der WhatsApp Integrationsseite prüfen

**"Touren werden nicht angezeigt"**
✓ Haben Sie mindestens 1 Tour mit einem zukünftigen Datum hinzugefügt?
→ Lösung: Tourliste und Termine prüfen

**Noch keine Lösung gefunden?**
→ Schreiben Sie an info@turzzai.com mit einem Screenshot`
        }
      ]
    }
  ],
  ru: [
    {
      titleKey: "setup",
      items: [
        {
          question: "Как выполнить первоначальную настройку?",
          answer: `**Шаг 1: Создание аккаунта**
- Нажмите "Попробовать бесплатно" на главной странице
- Зарегистрируйтесь с помощью email и пароля
- Подтвердите email по ссылке
- 14-дневный бесплатный пробный период начнётся автоматически

**Шаг 2: Добавьте туры**
- Перейдите на вкладку "Туры" и добавьте туры с датами

**Шаг 3: Подключите WhatsApp (Meta Embedded Signup)**
- Перейдите в "Управление WhatsApp"
- Нажмите "Подключить через Facebook"
- Войдите через Facebook/Meta Business аккаунт
- Выберите номер WhatsApp Business и подтвердите разрешения
- Подключение происходит автоматически (5-10 минут)

**Шаг 4: Протестируйте**
- Отправьте "Привет" со своего номера для проверки`
        }
      ]
    },
    {
      titleKey: "tours",
      items: [
        {
          question: "Как управлять турами и бронированиями?",
          answer: `**Добавление тура:**
- Вкладка "Туры" > "Добавить тур" > заполните данные и сохраните
- Стартовый план: до 10 туров. Professional: до 50 туров. Enterprise: без ограничений

**Статусы бронирования:**
- НОВОЕ → ОЖИДАНИЕ → ПОДТВЕРЖДЕНО → ОТМЕНЕНО
- Смена статуса автоматически уведомляет клиента

**Экспорт в Excel:** Скачайте все бронирования с деталями`
        },
        {
          question: "Как управлять датами туров?",
          answer: `**Добавление новой даты:**
1. Выберите тур на вкладке "Туры"
2. Нажмите "Добавить дату", выберите дату отправления, установите квоту и цены
3. Нажмите "Сохранить"

**Отслеживание квоты:**
- Каждое бронирование автоматически уменьшает квоту
- Заполненные даты скрываются от клиентов
- Квоту можно изменить в любое время

**Прошедшие даты:** Система автоматически скрывает прошедшие даты`
        }
      ]
    },
    {
      titleKey: "whatsapp",
      items: [
        {
          question: "Как работает WhatsApp-бот?",
          answer: `**Возможности бота:**
1. Умный поиск туров на естественном языке
2. Автоматическая информация о ценах и датах
3. Пошаговый мастер бронирования
4. Мультиязычность: автоопределение языка (7 языков)
5. Профили клиентов и отслеживание предпочтений

**Стили общения:** Дружественный/Тёплый (Стандарт), Корпоративный, Энергичный/Динамичный, Премиум

**Правило Meta 24 часа:** Свободные сообщения в течение 24 часов после сообщения клиента`
        },
        {
          question: "Как использовать шаблоны сообщений?",
          answer: `**Стандартные шаблоны:**
1. **Подтверждение бронирования:** Отправляется автоматически - название тура, дата, участники, сумма
2. **Отмена бронирования:** Отправляется автоматически при отмене
3. **Напоминание о туре:** Напоминание перед датой тура (планы Professional+)

**Переменные шаблона:** {full_name}, {tour_name}, {date}, {pax}, {total_amount}, {currency}

**Настройка шаблонов:** Перейдите в "Настройки Chat Bot" > "Шаблоны сообщений", выберите язык, редактируйте и сохраните`
        },
        {
          question: "Профили клиентов и предпочтения",
          answer: `**Автоматическое создание профиля:**
- Профиль создаётся автоматически для каждого WhatsApp-клиента
- Отслеживаются: номер телефона, имя, языковые предпочтения, история взаимодействий

**Автоматические теги:** VIP, постоянный клиент, потенциальный клиент

**Просмотр профилей:** Перейдите на вкладку "Пользователи WhatsApp"

**Примечание:** Профили клиентов доступны в планах Professional и Enterprise.`
        }
      ]
    },
    {
      titleKey: "analytics",
      items: [
        {
          question: "Какие отчёты доступны?",
          answer: `**Панель управления:** Общие туры, бронирования, популярные направления

**Расширенная аналитика (Professional+):** Тренды доходов, анализ направлений, сегментация клиентов

**Экспорт:** Все данные в Excel`
        }
      ]
    },
    {
      titleKey: "payments",
      items: [
        {
          question: "Тарифные планы и цены",
          answer: `💼 **СТАРТОВЫЙ - 2 999 TL/мес**
✓ 1 000 сообщений/мес | До 10 туров | 1 язык

🚀 **ПРОФЕССИОНАЛЬНЫЙ - 4 999 TL/мес** (САМЫЙ ПОПУЛЯРНЫЙ)
✓ 5 000 сообщений/мес | До 50 туров | До 4 языков
✓ Профили клиентов | Напоминания | Расширенная аналитика

⭐ **КОРПОРАТИВНЫЙ - Связаться с нами**
✓ 50 000 сообщений/мес | Безлимитные туры | Все 7 языков | Поддержка 24/7

**Годовая оплата: скидка 10%**
**Пробный период:** 14 дней бесплатно, без кредитной карты`
        },
        {
          question: "Способы оплаты и выставление счетов",
          answer: `**Варианты оплаты:**
- Кредитная/дебетовая карта (Visa, Mastercard)
- Банковский перевод

**Счёт:** Автоматически ежемесячно отправляется по email

**Безопасность платежей:** Защита SSL, соответствие PCI-DSS, данные карты не хранятся`
        },
        {
          question: "Управление подпиской",
          answer: `**Смена плана:**
- Выберите новый план в "История подписки"
- Апгрейды активируются немедленно
- Даунгрейды применяются в конце текущего периода

**Отмена:** В любое время, без обязательств. Использование продолжается до конца текущего периода. Данные хранятся 30 дней.`
        }
      ]
    },
    {
      titleKey: "settings",
      items: [
        {
          question: "Поддержка и помощь",
          answer: `**Каналы поддержки:**
- **Email:** info@turzzai.com (все планы)
- **WhatsApp:** Professional и Enterprise
- **Премиум 24/7:** Только Enterprise

**Ресурсы:** Эта страница помощи, руководство по началу работы`
        },
        {
          question: "Безопасность данных и конфиденциальность",
          answer: `**Меры безопасности:**
- Шифрование SSL/TLS (256-бит)
- Обработка данных в соответствии с GDPR
- Регулярные проверки безопасности и автоматическое резервное копирование

**Конфиденциальность:**
- Данные клиентов принадлежат только вам
- Не продаются/не передаются третьим лицам
- Все данные удаляются по запросу`
        },
        {
          question: "Распространённые проблемы и решения",
          answer: `**"Бот не отвечает"**
✓ Активно ли ваше подключение к WhatsApp? (Проверьте в Настройки Chat Bot > Интеграция WhatsApp)
✓ Исчерпан ли лимит сообщений?
→ Решение: Проверьте статус на странице интеграции WhatsApp

**"Туры не отображаются"**
✓ Добавили ли вы хотя бы 1 тур с будущей датой?
→ Решение: Проверьте список туров и даты

**Всё ещё не можете найти решение?**
→ Напишите на info@turzzai.com со скриншотом`
        }
      ]
    }
  ],
  ar: [
    {
      titleKey: "setup",
      items: [
        {
          question: "كيفية الإعداد لأول مرة؟",
          answer: `**الخطوة 1: إنشاء حساب**
- انقر على "جرب مجاناً" في الصفحة الرئيسية
- سجل باستخدام بريدك الإلكتروني وكلمة المرور
- انقر على رابط التحقق المرسل إلى بريدك الإلكتروني
- تبدأ الفترة التجريبية المجانية لمدة 14 يوماً تلقائياً

**الخطوة 2: أضف جولاتك**
- انتقل إلى علامة التبويب "الجولات" وأضف جولاتك مع التواريخ

**الخطوة 3: ربط واتساب (Meta Embedded Signup)**
- انتقل إلى "إدارة واتساب"
- انقر على "الاتصال عبر فيسبوك"
- سجل الدخول بحساب فيسبوك/Meta Business
- اختر رقم واتساب للأعمال ووافق على الأذونات
- يتم الاتصال تلقائياً (5-10 دقائق)

**الخطوة 4: اختبر** - أرسل "مرحبا" من رقمك للتحقق`
        }
      ]
    },
    {
      titleKey: "tours",
      items: [
        {
          question: "كيف تدير الجولات والحجوزات؟",
          answer: `**إضافة جولة:** علامة التبويب "الجولات" > "إضافة جولة" > املأ البيانات واحفظ
- الباقة الأساسية: حتى 10 جولات. Professional: حتى 50 جولة. Enterprise: غير محدود

**حالات الحجز:** جديد → معلق → مؤكد → ملغى
**تصدير إلى Excel:** تحميل جميع الحجوزات مع التفاصيل`
        },
        {
          question: "كيف تدير تواريخ الجولات؟",
          answer: `**إضافة تاريخ جديد:**
1. اختر جولة في علامة التبويب "الجولات"
2. انقر على "إضافة تاريخ"، اختر تاريخ المغادرة وحدد الحصة والأسعار
3. انقر على "حفظ"

**تتبع الحصة:**
- كل حجز يقلل الحصة تلقائياً
- التواريخ الممتلئة تُخفى عن العملاء
- يمكن تعديل الحصة في أي وقت

**التواريخ الماضية:** يخفي النظام التواريخ الماضية تلقائياً`
        }
      ]
    },
    {
      titleKey: "whatsapp",
      items: [
        {
          question: "كيف يعمل بوت واتساب؟",
          answer: `**إمكانيات البوت:**
1. بحث ذكي عن الجولات باللغة الطبيعية
2. معلومات الأسعار والتواريخ تلقائياً
3. معالج حجز خطوة بخطوة
4. متعدد اللغات: كشف تلقائي للغة (7 لغات)
5. ملفات تعريف العملاء وتتبع التفضيلات

**أنماط المحادثة:** ودي/دافئ (قياسي)، مؤسسي، نشيط/ديناميكي، بريميوم`
        },
        {
          question: "كيف تستخدم قوالب الرسائل؟",
          answer: `**القوالب الافتراضية:**
1. **تأكيد الحجز:** يُرسل تلقائياً - اسم الجولة، التاريخ، المشاركون، المبلغ
2. **إلغاء الحجز:** يُرسل تلقائياً عند الإلغاء
3. **تذكير الجولة:** تذكير قبل تاريخ الجولة (خطط Professional+)

**متغيرات القالب:** {full_name}, {tour_name}, {date}, {pax}, {total_amount}, {currency}

**تخصيص القوالب:** انتقل إلى "إعدادات Chat Bot" > "قوالب الرسائل"، اختر اللغة وعدّل واحفظ`
        },
        {
          question: "ملفات تعريف العملاء والتفضيلات",
          answer: `**إنشاء الملف الشخصي تلقائياً:**
- يُنشأ ملف تعريف لكل عميل واتساب تلقائياً
- يتتبع: رقم الهاتف، الاسم، تفضيل اللغة، تاريخ التفاعل

**التصنيف التلقائي:** VIP، عميل منتظم، عميل محتمل

**عرض الملفات:** انتقل إلى علامة التبويب "مستخدمو واتساب"

**ملاحظة:** ملفات تعريف العملاء متاحة في خطتي Professional وEnterprise.`
        }
      ]
    },
    {
      titleKey: "payments",
      items: [
        {
          question: "باقات الاشتراك والأسعار",
          answer: `💼 **الأساسية - 2,999 ليرة/شهر**
✓ 1,000 رسالة/شهر | حتى 10 جولات | لغة واحدة

🚀 **الاحترافية - 4,999 ليرة/شهر** (الأكثر شعبية)
✓ 5,000 رسالة/شهر | حتى 50 جولة | حتى 4 لغات

⭐ **المؤسسية - تواصل معنا**
✓ 50,000 رسالة/شهر | جولات غير محدودة | جميع اللغات السبع | دعم 24/7

**الدفع السنوي: خصم 10%**
**فترة تجريبية:** 14 يوماً مجاناً`
        },
        {
          question: "طرق الدفع والفوترة",
          answer: `**خيارات الدفع:**
- بطاقة ائتمان/خصم (Visa, Mastercard)
- تحويل بنكي

**الفاتورة:** تُرسل تلقائياً شهرياً عبر البريد الإلكتروني

**أمان الدفع:** محمي بـ SSL، متوافق مع PCI-DSS، لا تُخزَّن بيانات البطاقة`
        },
        {
          question: "إدارة الاشتراك",
          answer: `**تغيير الخطة:**
- اختر خطة جديدة من "سجل الاشتراكات"
- الترقيات تُفعَّل فوراً
- الخفض يُطبَّق في نهاية الفترة الحالية

**الإلغاء:** في أي وقت، بدون التزامات. يستمر الاستخدام حتى نهاية الفترة الحالية. البيانات محفوظة 30 يوماً.`
        }
      ]
    },
    {
      titleKey: "settings",
      items: [
        {
          question: "الدعم والمساعدة",
          answer: `**قنوات الدعم:**
- **البريد الإلكتروني:** info@turzzai.com (جميع الباقات)
- **دعم واتساب:** الباقات الاحترافية والمؤسسية
- **دعم بريميوم 24/7:** المؤسسية فقط`
        },
        {
          question: "أمان البيانات والخصوصية",
          answer: `**تدابير الأمان:**
- تشفير SSL/TLS (256-بت)
- معالجة البيانات وفق GDPR
- مراجعات أمنية منتظمة ونسخ احتياطي تلقائي

**الخصوصية:**
- بيانات العملاء تخصك وحدك
- لا تُباع/لا تُشارك مع أطراف ثالثة
- يتم حذف جميع البيانات عند الطلب`
        },
        {
          question: "المشكلات الشائعة والحلول",
          answer: `**"البوت لا يستجيب"**
✓ هل اتصال واتساب نشط؟ (تحقق في إعدادات Chat Bot > تكامل واتساب)
✓ هل انتهت حصة رسائلك؟
→ الحل: تحقق من الحالة في صفحة تكامل واتساب

**"الجولات غير مدرجة"**
✓ هل أضفت جولة واحدة على الأقل بتاريخ مستقبلي؟
→ الحل: تحقق من قائمة الجولات والتواريخ

**لم تجد حلاً؟**
→ اكتب إلى info@turzzai.com مع لقطة شاشة`
        }
      ]
    }
  ],
  fr: [
    {
      titleKey: "setup",
      items: [
        {
          question: "Comment effectuer la première configuration ?",
          answer: `**Étape 1 : Créer un compte**
- Cliquez sur "Essai gratuit" sur la page d'accueil
- Inscrivez-vous avec votre email et mot de passe
- Cliquez sur le lien de vérification envoyé à votre email
- L'essai gratuit de 14 jours commence automatiquement

**Étape 2 : Ajoutez vos circuits**
- Allez dans l'onglet "Circuits" et ajoutez vos circuits avec les dates

**Étape 3 : Connecter WhatsApp (Meta Embedded Signup)**
- Allez dans "Gestion WhatsApp"
- Cliquez sur "Se connecter avec Facebook"
- Connectez-vous avec votre compte Facebook/Meta Business
- Sélectionnez votre numéro WhatsApp Business et approuvez les autorisations
- La connexion s'établit automatiquement (5-10 minutes)

**Étape 4 : Testez** - Envoyez "Bonjour" depuis votre numéro pour vérifier`
        }
      ]
    },
    {
      titleKey: "tours",
      items: [
        {
          question: "Comment gérer les circuits et les réservations ?",
          answer: `**Ajouter un circuit :** Onglet "Circuits" > "Ajouter" > remplir et sauvegarder
- Forfait Starter : max 10 circuits. Professional : jusqu'à 50 circuits. Enterprise : illimité

**Statuts de réservation :** Nouveau → En attente → Confirmé → Annulé
**Export Excel :** Téléchargez toutes les réservations avec les détails`
        },
        {
          question: "Comment gérer les dates des circuits ?",
          answer: `**Ajouter une nouvelle date :**
1. Sélectionnez un circuit dans l'onglet "Circuits"
2. Cliquez sur "Ajouter une date", sélectionnez la date de départ et définissez le quota et les prix
3. Cliquez sur "Enregistrer"

**Suivi du quota :**
- Chaque réservation réduit automatiquement le quota
- Les dates complètes sont masquées pour les clients
- Le quota peut être ajusté à tout moment

**Dates passées :** Le système masque automatiquement les dates passées`
        }
      ]
    },
    {
      titleKey: "whatsapp",
      items: [
        {
          question: "Comment fonctionne le bot WhatsApp ?",
          answer: `**Capacités du bot :**
1. Recherche intelligente de circuits en langage naturel
2. Informations automatiques sur les prix et les dates
3. Assistant de réservation étape par étape
4. Multilingue : détection automatique de la langue (7 langues)
5. Profils clients et suivi des préférences

**Styles de conversation :** Amical/Chaleureux (Standard), Entreprise, Énergique/Dynamique, Premium`
        },
        {
          question: "Comment utiliser les modèles de messages ?",
          answer: `**Modèles par défaut :**
1. **Confirmation de réservation :** Envoyé automatiquement - nom du circuit, date, participants, montant
2. **Annulation de réservation :** Envoyé automatiquement en cas d'annulation
3. **Rappel de circuit :** Rappel avant la date du circuit (forfaits Professional+)

**Variables de modèle :** {full_name}, {tour_name}, {date}, {pax}, {total_amount}, {currency}

**Personnalisation :** Allez dans "Paramètres Chat Bot" > "Modèles de messages", sélectionnez la langue, modifiez et enregistrez`
        },
        {
          question: "Profils clients et préférences",
          answer: `**Création automatique du profil :**
- Un profil est créé automatiquement pour chaque client WhatsApp
- Suivi : numéro de téléphone, nom, préférence linguistique, historique d'interaction

**Étiquettes automatiques :** VIP, client régulier, client potentiel

**Affichage des profils :** Allez dans l'onglet "Utilisateurs WhatsApp"

**Remarque :** Les profils clients sont disponibles dans les forfaits Professional et Enterprise.`
        }
      ]
    },
    {
      titleKey: "payments",
      items: [
        {
          question: "Forfaits et tarification",
          answer: `💼 **STARTER - 2 999 TL/mois**
✓ 1 000 messages/mois | Max 10 circuits | 1 langue

🚀 **PROFESSIONNEL - 4 999 TL/mois** (LE PLUS POPULAIRE)
✓ 5 000 messages/mois | Jusqu'à 50 circuits | Jusqu'à 4 langues

⭐ **ENTREPRISE - Contactez-nous**
✓ 50 000 messages/mois | Circuits illimités | 7 langues | Support 24/7

**Paiement annuel : 10% de réduction**
**Essai gratuit :** 14 jours, sans carte de crédit`
        },
        {
          question: "Méthodes de paiement et facturation",
          answer: `**Options de paiement :**
- Carte de crédit/débit (Visa, Mastercard)
- Virement bancaire

**Facture :** Automatiquement envoyée mensuellement par email

**Sécurité des paiements :** Protégé par SSL, conforme PCI-DSS, données de carte non stockées`
        },
        {
          question: "Gestion de l'abonnement",
          answer: `**Changer de forfait :**
- Sélectionnez un nouveau forfait dans "Historique des abonnements"
- Les mises à niveau s'activent immédiatement
- Les réductions s'appliquent à la fin de la période actuelle

**Résiliation :** À tout moment, sans engagement. L'utilisation continue jusqu'à la fin de la période actuelle. Les données sont conservées 30 jours.`
        }
      ]
    },
    {
      titleKey: "settings",
      items: [
        {
          question: "Support et aide",
          answer: `**Canaux de support :**
- **Email :** info@turzzai.com (tous les forfaits)
- **Support WhatsApp :** Professional et Enterprise
- **Support Premium 24/7 :** Enterprise uniquement`
        },
        {
          question: "Sécurité des données et confidentialité",
          answer: `**Mesures de sécurité :**
- Chiffrement SSL/TLS (256-bit)
- Traitement des données conforme au RGPD
- Audits de sécurité réguliers et sauvegardes automatiques

**Confidentialité :**
- Les données clients vous appartiennent uniquement
- Non vendues/partagées avec des tiers
- Toutes les données supprimées sur demande`
        },
        {
          question: "Problèmes courants et solutions",
          answer: `**"Le bot ne répond pas"**
✓ Votre connexion WhatsApp est-elle active ? (Vérifiez dans Paramètres Chat Bot > Intégration WhatsApp)
✓ Votre quota de messages est-il épuisé ?
→ Solution : Vérifiez l'état sur la page d'intégration WhatsApp

**"Les circuits ne sont pas listés"**
✓ Avez-vous ajouté au moins 1 circuit avec une date future ?
→ Solution : Vérifiez votre liste de circuits et les dates

**Toujours pas de solution ?**
→ Écrivez à info@turzzai.com avec une capture d'écran`
        }
      ]
    }
  ],
  es: [
    {
      titleKey: "setup",
      items: [
        {
          question: "¿Cómo realizar la configuración inicial?",
          answer: `**Paso 1: Crear cuenta**
- Haga clic en "Prueba gratuita" en la página principal
- Regístrese con su email y contraseña
- Haga clic en el enlace de verificación enviado a su email
- La prueba gratuita de 14 días comienza automáticamente

**Paso 2: Agregue sus tours**
- Vaya a la pestaña "Tours" y agregue sus tours con fechas

**Paso 3: Conectar WhatsApp (Meta Embedded Signup)**
- Vaya a "Gestión de WhatsApp"
- Haga clic en "Conectar con Facebook"
- Inicie sesión con su cuenta de Facebook/Meta Business
- Seleccione su número de WhatsApp Business y apruebe los permisos
- La conexión se establece automáticamente (5-10 minutos)

**Paso 4: Pruebe** - Envíe "Hola" desde su número para verificar`
        }
      ]
    },
    {
      titleKey: "tours",
      items: [
        {
          question: "¿Cómo gestionar tours y reservas?",
          answer: `**Agregar tour:** Pestaña "Tours" > "Agregar" > completar y guardar
- Plan Starter: máx. 10 tours. Professional: hasta 50 tours. Enterprise: ilimitados

**Estados de reserva:** Nuevo → Pendiente → Confirmado → Cancelado
**Exportar a Excel:** Descargue todas las reservas con detalles`
        },
        {
          question: "¿Cómo gestionar las fechas de los tours?",
          answer: `**Agregar nueva fecha:**
1. Seleccione un tour en la pestaña "Tours"
2. Haga clic en "Agregar fecha", seleccione la fecha de salida y establezca cuota y precios
3. Haga clic en "Guardar"

**Seguimiento de cuota:**
- Cada reserva reduce automáticamente la cuota
- Las fechas completas se ocultan a los clientes
- La cuota se puede ajustar en cualquier momento

**Fechas pasadas:** El sistema oculta automáticamente las fechas pasadas`
        }
      ]
    },
    {
      titleKey: "whatsapp",
      items: [
        {
          question: "¿Cómo funciona el bot de WhatsApp?",
          answer: `**Capacidades del bot:**
1. Búsqueda inteligente de tours en lenguaje natural
2. Información automática de precios y fechas
3. Asistente de reservas paso a paso
4. Multilingüe: detección automática del idioma (7 idiomas)
5. Perfiles de clientes y seguimiento de preferencias

**Estilos de conversación:** Amigable/Cálido (Estándar), Corporativo, Enérgico/Dinámico, Premium`
        },
        {
          question: "¿Cómo usar las plantillas de mensajes?",
          answer: `**Plantillas predeterminadas:**
1. **Confirmación de reserva:** Enviada automáticamente - nombre del tour, fecha, participantes, monto
2. **Cancelación de reserva:** Enviada automáticamente al cancelar
3. **Recordatorio de tour:** Recordatorio antes de la fecha del tour (planes Professional+)

**Variables de plantilla:** {full_name}, {tour_name}, {date}, {pax}, {total_amount}, {currency}

**Personalizar plantillas:** Vaya a "Configuración Chat Bot" > "Plantillas de mensajes", seleccione el idioma, edite y guarde`
        },
        {
          question: "Perfiles de clientes y preferencias",
          answer: `**Creación automática de perfil:**
- Se crea un perfil automáticamente para cada cliente de WhatsApp
- Seguimiento: número de teléfono, nombre, preferencia de idioma, historial de interacciones

**Etiquetas automáticas:** VIP, cliente regular, cliente potencial

**Ver perfiles:** Vaya a la pestaña "Usuarios de WhatsApp"

**Nota:** Los perfiles de clientes están disponibles en los planes Professional y Enterprise.`
        }
      ]
    },
    {
      titleKey: "payments",
      items: [
        {
          question: "Planes de suscripción y precios",
          answer: `💼 **STARTER - 2.999 TL/mes**
✓ 1.000 mensajes/mes | Máx. 10 tours | 1 idioma

🚀 **PROFESIONAL - 4.999 TL/mes** (MÁS POPULAR)
✓ 5.000 mensajes/mes | Hasta 50 tours | Hasta 4 idiomas

⭐ **EMPRESARIAL - Contáctenos**
✓ 50.000 mensajes/mes | Tours ilimitados | 7 idiomas | Soporte 24/7

**Pago anual: 10% de descuento**
**Prueba gratuita:** 14 días, sin tarjeta de crédito`
        },
        {
          question: "Métodos de pago y facturación",
          answer: `**Opciones de pago:**
- Tarjeta de crédito/débito (Visa, Mastercard)
- Transferencia bancaria

**Factura:** Enviada automáticamente cada mes por email

**Seguridad de pago:** Protegido por SSL, cumple PCI-DSS, datos de tarjeta no almacenados`
        },
        {
          question: "Gestión de suscripción",
          answer: `**Cambiar plan:**
- Seleccione un nuevo plan en "Historial de suscripciones"
- Las actualizaciones se activan inmediatamente
- Las reducciones se aplican al final del período actual

**Cancelación:** En cualquier momento, sin compromiso. El uso continúa hasta el final del período actual. Los datos se conservan 30 días.`
        }
      ]
    },
    {
      titleKey: "settings",
      items: [
        {
          question: "Soporte y ayuda",
          answer: `**Canales de soporte:**
- **Email:** info@turzzai.com (todos los planes)
- **Soporte WhatsApp:** Professional y Enterprise
- **Soporte Premium 24/7:** Solo Enterprise`
        },
        {
          question: "Seguridad de datos y privacidad",
          answer: `**Medidas de seguridad:**
- Cifrado SSL/TLS (256-bit)
- Procesamiento de datos conforme a GDPR
- Auditorías de seguridad regulares y copias de seguridad automáticas

**Privacidad:**
- Los datos de clientes son solo suyos
- No se venden/comparten con terceros
- Todos los datos eliminados bajo solicitud`
        },
        {
          question: "Problemas comunes y soluciones",
          answer: `**"El bot no responde"**
✓ ¿Está activa su conexión de WhatsApp? (Verifique en Configuración Chat Bot > Integración WhatsApp)
✓ ¿Se agotó su cuota de mensajes?
→ Solución: Verifique el estado en la página de integración WhatsApp

**"Los tours no aparecen listados"**
✓ ¿Ha añadido al menos 1 tour con una fecha futura?
→ Solución: Verifique su lista de tours y fechas

**¿Todavía no encontró solución?**
→ Escriba a info@turzzai.com con una captura de pantalla`
        }
      ]
    }
  ]
};

export function getHelpContent(language: string): HelpSection[] {
  return helpContent[language] || helpContent['tr'];
}

export default helpContent;
