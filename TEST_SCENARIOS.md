# Test Senaryoları - Demo & WhatsApp Paritesi

Bu dokümantasyon, Demo Chat ve WhatsApp entegrasyonunun aynı şekilde çalıştığını doğrulamak için kullanılacak test senaryolarını içerir.

## 🎯 Test Kategorileri

### 1. Response Validation Tests

#### Test 1.1: Kelime Sayısı Limiti - Tur Listesi
**Amaç:** Tour list/search yanıtlarının 300 kelimeyi geçmediğini doğrula

**Test Adımları:**
1. Demo'da: "Kapadokya turları" yaz
2. WhatsApp'ta: "Kapadokya turları" yaz
3. Her iki yanıtı kelime sayısına göre kontrol et

**Beklenen Sonuç:**
- ✅ Her iki yanıt da maksimum 300 kelime
- ✅ Yanıtlar kesik cümle içermiyor
- ✅ Tur listesi tam olarak gösteriliyor

**Manuel Doğrulama:**
```
Demo kelime sayısı: [___]
WhatsApp kelime sayısı: [___]
Her ikisi de ≤300: [✓/✗]
```

---

#### Test 1.2: Yasaklı İfadeler
**Amaç:** Banned phrases'ların yanıtlarda olmadığını doğrula

**Test Adımları:**
1. Demo'da: Tur detayı iste
2. WhatsApp'ta: Aynı tur detayı iste
3. Yanıtlarda şu ifadeleri ara:
   - "Gün 1:", "1. Gün", "Day 1:"
   - "günlük program"
   - "detaylı programı"

**Beklenen Sonuç:**
- ✅ Yanıtlar gün-gün detay içermiyor
- ✅ Genel tur özeti veriliyor
- ✅ Her iki platform aynı yaklaşımda

**Manuel Doğrulama:**
```
Demo'da yasaklı ifade: [✓/✗]
WhatsApp'ta yasaklı ifade: [✓/✗]
```

---

#### Test 1.3: Emoji Kullanımı - Professional Style
**Amaç:** Professional stilinde emoji kullanılmadığını doğrula

**Test Adımları:**
1. Admin panelden conversation_style'ı "professional" yap
2. Demo'da: Selamlaşma mesajı yaz
3. WhatsApp'ta: Selamlaşma mesajı yaz
4. Yanıtlarda emoji ara

**Beklenen Sonuç:**
- ✅ Professional stilinde emoji yok
- ✅ Friendly/casual stilinde emoji var
- ✅ Her iki platform aynı davranıyor

---

### 2. Memory Extraction Tests

#### Test 2.1: Destinasyon Hafızası
**Amaç:** Kullanıcının bahsettiği destinasyonların kaydedildiğini doğrula

**Test Adımları:**
1. Demo'da: "Kapadokya turuna bakmak istiyorum"
2. WhatsApp'ta: "Kapadokya turuna bakmak istiyorum"
3. Database'de whatsapp_user_profiles tablosunu kontrol et
4. preferences.conversation_state.userMemory.preferredDestinations kontrol et

**Beklenen Sonuç:**
- ✅ Her iki platformda "Kapadokya" kaydedilmiş
- ✅ Memory yapısı aynı formatta

**SQL Doğrulama:**
```sql
-- Demo profile
SELECT preferences->'conversation_state'->'userMemory'->'preferredDestinations'
FROM whatsapp_user_profiles 
WHERE phone LIKE 'demo_%'
ORDER BY updated_at DESC LIMIT 1;

-- WhatsApp profile
SELECT preferences->'conversation_state'->'userMemory'->'preferredDestinations'
FROM whatsapp_user_profiles 
WHERE phone NOT LIKE 'demo_%'
ORDER BY updated_at DESC LIMIT 1;
```

---

#### Test 2.2: İlgi Alanı Extraction
**Amaç:** Kullanıcı ilgi alanlarının (balon turu, macera, kültür vb.) doğru çıkarıldığını doğrula

**Test Adımları:**
1. Demo'da: "Balon turuyla rafting aktiviteleri olan bir tur arıyorum"
2. WhatsApp'ta: Aynı mesajı gönder
3. Memory'de interests array'ini kontrol et

**Beklenen Sonuç:**
- ✅ Her iki platformda interests: ["balon turu", "macera"]
- ✅ Keywords doğru eşleşiyor (multilingual)

---

#### Test 2.3: Pax (Katılımcı) Sayısı Extraction
**Amaç:** Yetişkin ve çocuk sayısının konuşmadan çıkarıldığını doğrula

**Test Adımları:**
1. Demo'da: "2 yetişkin ve 1 çocukla geleceğiz"
2. WhatsApp'ta: "2 yetişkin ve 1 çocukla geleceğiz"
3. Memory'de lastMentionedPax kontrol et

**Beklenen Sonuç:**
- ✅ lastMentionedPax: { adults: 2, children: 1 }
- ✅ Her iki platformda aynı

**Test Varyasyonları:**
- "3 kişilik bir grup" → adults: 3
- "5 adults and 2 kids" → adults: 5, children: 2
- "Familie mit 3 Kinder" → children: 3

---

#### Test 2.4: Bütçe Aralığı Detection
**Amaç:** Fiyat konuşmalarından bütçe aralığının çıkarıldığını doğrula

**Test Adımları:**
1. Demo'da: "2500 TL civarında turlar var mı?"
2. WhatsApp'ta: Aynı mesajı gönder
3. Memory'de budgetRange kontrol et

**Beklenen Sonuç:**
- ✅ budgetRange: "orta" (2500 TL → orta kategorisi)
- ✅ Her iki platformda aynı

**Bütçe Kategorileri:**
- <1000 TL → "düşük"
- 1000-3000 TL → "orta"
- >3000 TL → "yüksek"

---

### 3. Conversation State Tests

#### Test 3.1: Stage Progression
**Amaç:** Konuşma akışının doğru stage'lerde ilerliyor olduğunu doğrula

**Test Adımları:**
1. Demo'da selamlaşma → currentStage: "initial"
2. "Turları göster" → currentStage: "exploring"
3. Bir tur detayı iste → currentStage: "interested"
4. Rezervasyon başlat → currentStage: "booking"
5. WhatsApp'ta aynı akışı tekrarla

**Beklenen Sonuç:**
- ✅ Her iki platformda stage'ler aynı sırayla ilerliyor
- ✅ Auto-advance çalışıyor

---

#### Test 3.2: Wizard State Tracking
**Amaç:** Wizard akışının state'inin doğru tutulduğunu doğrula

**Test Adımları:**
1. Demo'da rezervasyon başlat
2. Tur seç → wizardStep: "tour_selected"
3. Tarih seç → wizardStep: "date_selection"
4. WhatsApp'ta paralel ilerle

**Beklenen Sonuç:**
- ✅ Her adımda wizardStep güncelleniyor
- ✅ currentTour bilgileri kaydediliyor

---

#### Test 3.3: Conversation Flow History
**Amaç:** Son 10 intent'in conversation_state.conversationFlow'da tutulduğunu doğrula

**Test Adımları:**
1. Demo'da 5 farklı intent mesajı gönder
2. conversationFlow array'ini kontrol et
3. WhatsApp'ta tekrarla

**Beklenen Sonuç:**
- ✅ Son intents sırayla kaydediliyor
- ✅ Maximum 10 intent tutuluyor (FIFO)

---

### 4. Profile Insights Tests

#### Test 4.1: Topics Discussed
**Amaç:** Konuşulan konuların loglandığını doğrula

**Test Adımları:**
1. Demo'da: "Kapadokya ve Pamukkale turlarını merak ediyorum"
2. preferences.conversation_insights.topics_discussed kontrol et
3. WhatsApp'ta tekrarla

**Beklenen Sonuç:**
- ✅ topics_discussed: ["kapadokya", "pamukkale"]
- ✅ Her iki platformda aynı

---

#### Test 4.2: Questions Asked
**Amaç:** Kullanıcı sorularının kaydedildiğini doğrula

**Test Adımları:**
1. Demo'da: "Turda ne zaman toplanılıyor?"
2. conversation_insights.questions_asked kontrol et
3. WhatsApp'ta tekrarla

**Beklenen Sonuç:**
- ✅ Soru questions_asked array'ine ekleniyor
- ✅ Son 5 soru tutuluyor

**Multilingual Test:**
- TR: "Ne zaman başlıyor?"
- EN: "When does it start?"
- DE: "Wann beginnt es?"
- RU: "Когда начинается?"

---

#### Test 4.3: Positive/Negative Signals
**Amaç:** Kullanıcı sentiment'inin yakalandığını doğrula

**Test Adımları - Positive:**
1. Demo'da: "Harika, çok beğendim!"
2. conversation_insights.positive_signals kontrol et

**Test Adımları - Negative:**
1. WhatsApp'ta: "Çok pahalı, olmaz"
2. conversation_insights.negative_signals kontrol et

**Beklenen Sonuç:**
- ✅ Positive keywords → positive_signals array'ine ekleniyor
- ✅ Negative keywords → negative_signals array'ine ekleniyor
- ✅ Her iki platformda aynı

---

### 5. Wizard Flow Tests

#### Test 5.1: Complete Reservation Flow
**Amaç:** Rezervasyon wizard'ının baştan sona aynı çalıştığını doğrula

**Test Adımları:**
1. **Demo:**
   - Rezervasyon başlat
   - Tur seç (örn: 1)
   - Tarih seç (örn: 1)
   - Pax gir (örn: "2 yetişkin")
   - İsim gir (örn: "Ahmet Yılmaz")
   - Özel istek (örn: "Hayır")
   - Onay ver (örn: "Evet")

2. **WhatsApp:**
   - Aynı adımları takip et

**Beklenen Sonuç:**
- ✅ Her iki platformda wizard aynı adımlardan geçiyor
- ✅ Demo: "Bu bir demo rezervasyondur" mesajı gösteriliyor
- ✅ WhatsApp: "Acente yetkilimiz sizinle iletişime geçecektir" mesajı gösteriliyor
- ✅ WhatsApp: Gerçek registration kaydı oluşuyor
- ✅ Demo: Registration oluşturulmuyor

---

#### Test 5.2: Wizard Cancellation
**Amaç:** İptal komutunun her platformda çalıştığını doğrula

**Test Adımları:**
1. Demo'da wizard başlat
2. Herhangi bir adımda "iptal" yaz
3. WhatsApp'ta tekrarla

**Beklenen Sonuç:**
- ✅ Her iki platformda wizard iptal ediliyor
- ✅ State temizleniyor
- ✅ İptal mesajı gösteriliyor

**Cancel Keywords Test:**
- "iptal"
- "vazgeç"
- "cancel"
- "stop"

---

#### Test 5.3: Wizard Timeout (15 dakika)
**Amaç:** 15 dakika sonra wizard state'inin expire olduğunu doğrula

**Test Adımları:**
1. Demo'da wizard başlat
2. 16 dakika bekle (veya DB'de created_at'i manuel değiştir)
3. Mesaj gönder
4. WhatsApp'ta tekrarla

**Beklenen Sonuç:**
- ✅ State null dönüyor
- ✅ Yeni wizard başlatılması gerekiyor

---

#### Test 5.4: Price Calculation Accuracy
**Amaç:** Fiyat hesaplamalarının doğru yapıldığını doğrula

**Test Senaryoları:**

**Senaryo A: Sadece Yetişkin**
- Yetişkin: 2
- Çocuk: 0
- Adult Price: 1000₺
- Expected Total: 2000₺

**Senaryo B: Yetişkin + Çocuk**
- Yetişkin: 2
- Çocuk: 1
- Adult Price: 1000₺
- Child Price: 800₺
- Expected Total: 2800₺

**Senaryo C: Child Price Null (80% fallback)**
- Yetişkin: 2
- Çocuk: 1
- Adult Price: 1000₺
- Child Price: null (fallback: 800₺)
- Expected Total: 2800₺

**Test Adımları:**
1. Demo ve WhatsApp'ta her senaryoyu test et
2. Confirmation mesajındaki fiyatı kontrol et

---

### 6. Multilingual Support Tests

#### Test 6.1: Language Detection & Response
**Amaç:** Farklı dillerde aynı functionality'nin çalıştığını doğrula

**Test Dilleri:**
- 🇹🇷 Türkçe
- 🇬🇧 İngilizce
- 🇩🇪 Almanca
- 🇷🇺 Rusça
- 🇸🇦 Arapça
- 🇫🇷 Fransızca
- 🇪🇸 İspanyolca

**Test Adımları (Her Dil İçin):**
1. Demo'da o dilde selamlaşma yap
2. Tur listesi iste
3. Wizard başlat
4. WhatsApp'ta tekrarla

**Beklenen Sonuç:**
- ✅ Her dilde doğru yanıt geliyor
- ✅ Wizard mesajları doğru dilde
- ✅ Memory extraction çalışıyor

**Örnek Test Mesajları:**
```
TR: "Merhaba, turları gösterebilir misin?"
EN: "Hello, can you show me the tours?"
DE: "Hallo, können Sie mir die Touren zeigen?"
RU: "Здравствуйте, можете показать мне туры?"
AR: "مرحبا، هل يمكنك أن تريني الجولات؟"
FR: "Bonjour, pouvez-vous me montrer les circuits?"
ES: "Hola, ¿puedes mostrarme los tours?"
```

---

### 7. Conversation Style Tests

#### Test 7.1: Professional Style
**Admin Setting:** conversation_style = "professional"

**Test Adımları:**
1. Demo'da mesaj gönder
2. WhatsApp'ta mesaj gönder

**Beklenen Sonuç:**
- ✅ Emoji kullanılmıyor
- ✅ Formal dil
- ✅ "Sayın müşterimiz" tarzı hitap

---

#### Test 7.2: Friendly Style
**Admin Setting:** conversation_style = "friendly"

**Test Adımları:**
1. Demo'da mesaj gönder
2. WhatsApp'ta mesaj gönder

**Beklenen Sonuç:**
- ✅ Emojiler var 😊
- ✅ Sıcak, samimi dil
- ✅ "Merhaba" tarzı hitap

---

#### Test 7.3: Casual Style
**Admin Setting:** conversation_style = "casual"

**Test Adımları:**
1. Demo'da mesaj gönder
2. WhatsApp'ta mesaj gönder

**Beklenen Sonuç:**
- ✅ Uygun yerlerde emoji
- ✅ Günlük dil
- ✅ Rahat üslup

---

## 📊 Test Raporu Şablonu

### Test Execution Date: [____]

| Test ID | Test Name | Demo Result | WhatsApp Result | Match | Notes |
|---------|-----------|-------------|-----------------|-------|-------|
| 1.1 | Word Count Limit | ✓/✗ | ✓/✗ | ✓/✗ | |
| 1.2 | Banned Phrases | ✓/✗ | ✓/✗ | ✓/✗ | |
| 1.3 | Emoji - Professional | ✓/✗ | ✓/✗ | ✓/✗ | |
| 2.1 | Destination Memory | ✓/✗ | ✓/✗ | ✓/✗ | |
| 2.2 | Interest Extraction | ✓/✗ | ✓/✗ | ✓/✗ | |
| 2.3 | Pax Extraction | ✓/✗ | ✓/✗ | ✓/✗ | |
| 2.4 | Budget Detection | ✓/✗ | ✓/✗ | ✓/✗ | |
| 3.1 | Stage Progression | ✓/✗ | ✓/✗ | ✓/✗ | |
| 3.2 | Wizard State | ✓/✗ | ✓/✗ | ✓/✗ | |
| 3.3 | Flow History | ✓/✗ | ✓/✗ | ✓/✗ | |
| 4.1 | Topics Discussed | ✓/✗ | ✓/✗ | ✓/✗ | |
| 4.2 | Questions Asked | ✓/✗ | ✓/✗ | ✓/✗ | |
| 4.3 | Sentiment Signals | ✓/✗ | ✓/✗ | ✓/✗ | |
| 5.1 | Complete Wizard | ✓/✗ | ✓/✗ | ✓/✗ | |
| 5.2 | Wizard Cancel | ✓/✗ | ✓/✗ | ✓/✗ | |
| 5.3 | Wizard Timeout | ✓/✗ | ✓/✗ | ✓/✗ | |
| 5.4 | Price Calculation | ✓/✗ | ✓/✗ | ✓/✗ | |
| 6.1 | Multilingual (7 dil) | ✓/✗ | ✓/✗ | ✓/✗ | |
| 7.1 | Professional Style | ✓/✗ | ✓/✗ | ✓/✗ | |
| 7.2 | Friendly Style | ✓/✗ | ✓/✗ | ✓/✗ | |
| 7.3 | Casual Style | ✓/✗ | ✓/✗ | ✓/✗ | |

### Overall Results
- **Total Tests:** 20
- **Passed:** [__]
- **Failed:** [__]
- **Match Rate:** [__]%

### Critical Issues Found
1. 
2. 
3. 

### Recommendations
1. 
2. 
3. 

---

## 🔧 Automated Test Queries

### Database Verification Queries

```sql
-- 1. Compare Memory Structure
SELECT 
  phone,
  preferences->'conversation_state'->'userMemory' as memory
FROM whatsapp_user_profiles 
WHERE phone IN ('demo_[SESSION_ID]', '[WHATSAPP_PHONE]')
ORDER BY phone;

-- 2. Compare Conversation State
SELECT 
  phone,
  preferences->'conversation_state'->'currentStage' as stage,
  preferences->'conversation_state'->'wizardStep' as wizard_step,
  preferences->'conversation_state'->'conversationFlow' as flow
FROM whatsapp_user_profiles 
WHERE phone IN ('demo_[SESSION_ID]', '[WHATSAPP_PHONE]')
ORDER BY phone;

-- 3. Compare Conversation Insights
SELECT 
  phone,
  preferences->'conversation_insights'->'topics_discussed' as topics,
  preferences->'conversation_insights'->'questions_asked' as questions,
  preferences->'conversation_insights'->'positive_signals' as positive,
  preferences->'conversation_insights'->'negative_signals' as negative
FROM whatsapp_user_profiles 
WHERE phone IN ('demo_[SESSION_ID]', '[WHATSAPP_PHONE]')
ORDER BY phone;

-- 4. Check Wizard State
SELECT 
  phone,
  preferences->'wizard_state' as wizard_state
FROM whatsapp_user_profiles 
WHERE phone IN ('demo_[SESSION_ID]', '[WHATSAPP_PHONE]')
  AND preferences->'wizard_state' IS NOT NULL
ORDER BY phone;

-- 5. Verify Registrations (WhatsApp only)
SELECT 
  phone,
  tour_id,
  tour_date_id,
  pax,
  full_name,
  note,
  status,
  created_at
FROM registrations
WHERE phone = '[WHATSAPP_PHONE]'
ORDER BY created_at DESC
LIMIT 5;
```

---

## 🚀 Quick Start Testing Guide

### 1. Preparation
- [ ] Admin panelde test agency oluştur
- [ ] En az 3 farklı tur ve tarih ekle
- [ ] conversation_style'ı belirle (test için)

### 2. Demo Test
- [ ] Demo chat'i aç
- [ ] Test senaryolarını sırayla uygula
- [ ] Her adımda database'i kontrol et

### 3. WhatsApp Test
- [ ] WhatsApp sandbox/production'da aynı testleri çalıştır
- [ ] Database'de paralel sonuçları kontrol et

### 4. Compare & Report
- [ ] SQL queries ile karşılaştır
- [ ] Match rate hesapla
- [ ] Issues dokümante et

---

## 📝 Notes

- Test öncesi database'i backup al
- Her test sonrası user profile'ı temizlemek istersen, phone'u başka bir değerle değiştirebilirsin
- Multilingual testler için her dilde native speaker'ın doğrulaması önerilir
- Wizard timeout testleri için DB'de `created_at` manuel güncellenebilir

---

## 🔗 Related Documentation

- [WHATSAPP_RESERVATION_WIZARD.md](./WHATSAPP_RESERVATION_WIZARD.md)
- [WHATSAPP_SETUP.md](./WHATSAPP_SETUP.md)
- Database Schema: `whatsapp_user_profiles` table
- Edge Functions: `demo-chat` & `whatsapp-webhook`
