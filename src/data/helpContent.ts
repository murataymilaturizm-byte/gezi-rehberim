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
- Sol menüden "WhatsApp Yönetimi" sekmesine gidin
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
1. Admin panelinde "WhatsApp Yönetimi" sekmesine gidin
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
- Standart, Kurumsal, Dinamik, Premium, Samimi (plan bazlı erişim)

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
- Başlangıç: 1.000 mesaj/ay | Profesyonel: 5.000 mesaj/ay | Kurumsal: Sınırsız

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
✓ 5.000 mesaj/ay | Sınırsız tur | 3 dile kadar
✓ 4 konuşma üslubu | Kullanıcı profilleri | Otomatik hatırlatıcılar
✓ Takip mesajları | Gelişmiş analitik | Mesaj şablonları

⭐ **KURUMSAL - 7.999 TL/ay**
✓ Sınırsız mesaj | Sınırsız tur | 7 dil
✓ 5 konuşma üslubu | Müşteri memnuniyet anketleri | 7/24 destek

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
- Başlangıç: 1 dil | Profesyonel: 3 dil | Kurumsal: 7 dil`
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
- **E-posta:** info@ai.turzz.com (tüm paketlerde, 24 saat içinde yanıt)
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
✓ WhatsApp bağlantınız aktif mi? (WhatsApp Yönetimi'nden kontrol edin)
✓ Mesaj kotanız dolmuş olabilir mi?
→ Çözüm: WhatsApp Yönetimi sayfasından durumu kontrol edin

**"Turlar listelenmiyor"**
✓ En az 1 tur ve gelecek tarih eklediniz mi?
→ Çözüm: Tur listesini ve tarihlerini kontrol edin

**"Rezervasyon oluşturulamıyor"**
✓ Kota dolu mu? Tarih geçerli mi?
→ Çözüm: Kota ve tarih kontrolü yapın

**Hala çözüm bulamadınız mı?**
→ info@ai.turzz.com adresine ekran görüntüsü ile yazın`
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
- Go to "WhatsApp Management" from the left menu
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
1. Go to "WhatsApp Management" tab in admin panel
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

**Conversation Styles:** Standard, Corporate, Dynamic, Premium, Friendly (plan-based access)

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
- Starter: 1,000 msgs/month | Professional: 5,000 msgs/month | Enterprise: Unlimited

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
✓ 5,000 msgs/month | Unlimited tours | Up to 3 languages
✓ 4 conversation styles | User profiles | Auto reminders
✓ Follow-up messages | Advanced analytics | Message templates

⭐ **ENTERPRISE - 7,999 TL/month**
✓ Unlimited messages | Unlimited tours | All 7 languages
✓ 5 conversation styles | Customer satisfaction surveys | 24/7 support

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
          answer: `**Basic Info:** Edit from "Settings" > "Agency Information":
- Agency name, phone, address, working hours, website, Google Maps link

**WhatsApp Settings:**
- Self-service connection via Meta Embedded Signup in "WhatsApp Management"
- Track connection status on the same page

**Language Settings:**
- Select active languages from "Language Management"
- Starter: 1 language | Professional: 3 languages | Enterprise: 7 languages`
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
- **Email:** info@ai.turzz.com (all plans, response within 24 hours)
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
✓ Is your WhatsApp connection active? (Check in WhatsApp Management)
✓ Has your message quota run out?
→ Solution: Check status in WhatsApp Management page

**"Tours are not listed"**
✓ Have you added at least 1 tour with a future date?
→ Solution: Check your tour list and dates

**"Reservation cannot be created"**
✓ Is quota full? Is the date valid?
→ Solution: Check quota and dates

**Still can't find a solution?**
→ Write to info@ai.turzz.com with a screenshot`
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

**Hinweis:** Starter-Paket: max. 10 Touren. Professional/Enterprise: unbegrenzt.`
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
✓ 5.000 Nachrichten/Monat | Unbegrenzte Touren | Bis zu 3 Sprachen
✓ Kundenprofile | Erinnerungen | Erweiterte Analysen

⭐ **ENTERPRISE - 7.999 TL/Monat**
✓ Unbegrenzte Nachrichten | Unbegrenzte Touren | Alle 7 Sprachen
✓ 24/7 Support | Kundenzufriedenheitsumfragen

**Jährliche Zahlung: 10% Rabatt**
**Kostenlose Testphase:** 14 Tage, keine Kreditkarte erforderlich`
        }
      ]
    },
    {
      titleKey: "settings",
      items: [
        {
          question: "Support und Hilfe",
          answer: `**Support-Kanäle:**
- **E-Mail:** info@ai.turzz.com (alle Pakete)
- **WhatsApp-Support:** Professional und Enterprise
- **24/7 Premium-Support:** Nur Enterprise

**Hilfsquellen:** Diese Hilfeseite, Startleitfaden (/nasil-baslarim)`
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
- Стартовый план: до 10 туров. Professional/Enterprise: без ограничений

**Статусы бронирования:**
- НОВОЕ → ОЖИДАНИЕ → ПОДТВЕРЖДЕНО → ОТМЕНЕНО
- Смена статуса автоматически уведомляет клиента

**Экспорт в Excel:** Скачайте все бронирования с деталями`
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

**Стили общения:** Стандартный, Корпоративный, Динамичный, Премиум, Дружественный

**Правило Meta 24 часа:** Свободные сообщения в течение 24 часов после сообщения клиента`
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
✓ 5 000 сообщений/мес | Безлимитные туры | До 3 языков
✓ Профили клиентов | Напоминания | Расширенная аналитика

⭐ **КОРПОРАТИВНЫЙ - 7 999 TL/мес**
✓ Безлимитные сообщения и туры | Все 7 языков | Поддержка 24/7

**Годовая оплата: скидка 10%**
**Пробный период:** 14 дней бесплатно, без кредитной карты`
        }
      ]
    },
    {
      titleKey: "settings",
      items: [
        {
          question: "Поддержка и помощь",
          answer: `**Каналы поддержки:**
- **Email:** info@ai.turzz.com (все планы)
- **WhatsApp:** Professional и Enterprise
- **Премиум 24/7:** Только Enterprise

**Ресурсы:** Эта страница помощи, руководство по началу работы`
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
- الباقة الأساسية: حتى 10 جولات. Professional/Enterprise: غير محدود

**حالات الحجز:** جديد → معلق → مؤكد → ملغى
**تصدير إلى Excel:** تحميل جميع الحجوزات مع التفاصيل`
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

**أنماط المحادثة:** قياسي، مؤسسي، ديناميكي، بريميوم، ودي`
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
✓ 5,000 رسالة/شهر | جولات غير محدودة | حتى 3 لغات

⭐ **المؤسسية - 7,999 ليرة/شهر**
✓ رسائل وجولات غير محدودة | جميع اللغات السبع | دعم 24/7

**الدفع السنوي: خصم 10%**
**فترة تجريبية:** 14 يوماً مجاناً`
        }
      ]
    },
    {
      titleKey: "settings",
      items: [
        {
          question: "الدعم والمساعدة",
          answer: `**قنوات الدعم:**
- **البريد الإلكتروني:** info@ai.turzz.com (جميع الباقات)
- **دعم واتساب:** الباقات الاحترافية والمؤسسية
- **دعم بريميوم 24/7:** المؤسسية فقط`
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
- Forfait Starter : max 10 circuits. Professional/Enterprise : illimité

**Statuts de réservation :** Nouveau → En attente → Confirmé → Annulé
**Export Excel :** Téléchargez toutes les réservations avec les détails`
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

**Styles de conversation :** Standard, Entreprise, Dynamique, Premium, Amical`
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
✓ 5 000 messages/mois | Circuits illimités | Jusqu'à 3 langues

⭐ **ENTREPRISE - 7 999 TL/mois**
✓ Messages et circuits illimités | 7 langues | Support 24/7

**Paiement annuel : 10% de réduction**
**Essai gratuit :** 14 jours, sans carte de crédit`
        }
      ]
    },
    {
      titleKey: "settings",
      items: [
        {
          question: "Support et aide",
          answer: `**Canaux de support :**
- **Email :** info@ai.turzz.com (tous les forfaits)
- **Support WhatsApp :** Professional et Enterprise
- **Support Premium 24/7 :** Enterprise uniquement`
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
- Plan Starter: máx. 10 tours. Professional/Enterprise: ilimitados

**Estados de reserva:** Nuevo → Pendiente → Confirmado → Cancelado
**Exportar a Excel:** Descargue todas las reservas con detalles`
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

**Estilos de conversación:** Estándar, Corporativo, Dinámico, Premium, Amigable`
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
✓ 5.000 mensajes/mes | Tours ilimitados | Hasta 3 idiomas

⭐ **EMPRESARIAL - 7.999 TL/mes**
✓ Mensajes y tours ilimitados | 7 idiomas | Soporte 24/7

**Pago anual: 10% de descuento**
**Prueba gratuita:** 14 días, sin tarjeta de crédito`
        }
      ]
    },
    {
      titleKey: "settings",
      items: [
        {
          question: "Soporte y ayuda",
          answer: `**Canales de soporte:**
- **Email:** info@ai.turzz.com (todos los planes)
- **Soporte WhatsApp:** Professional y Enterprise
- **Soporte Premium 24/7:** Solo Enterprise`
        }
      ]
    }
  ]
};

export function getHelpContent(language: string): HelpSection[] {
  return helpContent[language] || helpContent['tr'];
}

export default helpContent;
