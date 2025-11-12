# WhatsApp Entegrasyonu 📱

Bu proje WhatsApp üzerinden tur arama ve rezervasyon desteği sunar.

## 🚀 Kurulum Seçenekleri

### Seçenek 1: Twilio WhatsApp API (Önerilen)

1. **Twilio Hesabı Oluşturun**
   - https://www.twilio.com/try-twilio adresine gidin
   - Hesap oluşturun ve WhatsApp sandbox'ı aktifleştirin

2. **Webhook URL'ini Ayarlayın**
   ```
   https://ncuswacwpqcxhmlhvfgq.supabase.co/functions/v1/whatsapp-webhook
   ```
   
3. **Twilio Console'da**
   - Messaging → Try it out → Send a WhatsApp message
   - "WHEN A MESSAGE COMES IN" webhook URL'ini yukarıdaki URL ile değiştirin
   - HTTP POST seçin

4. **Test Edin**
   - Twilio'nun verdiği numaraya WhatsApp'tan mesaj gönderin
   - Örnek: "Günübirlik Kapadokya 20 Temmuz"

### Seçenek 2: n8n Workflow

1. **n8n Workflow Oluşturun**
   ```
   Webhook Trigger → HTTP Request → WhatsApp Node
   ```

2. **HTTP Request Node Ayarları**
   - URL: `https://ncuswacwpqcxhmlhvfgq.supabase.co/functions/v1/whatsapp-webhook`
   - Method: POST
   - Body:
     ```json
     {
       "message": "{{ $json.message }}",
       "from": "{{ $json.from }}"
     }
     ```

3. **WhatsApp Node'u Bağlayın**
   - Response'u WhatsApp'a geri gönderin

### Seçenek 3: WhatsApp Business API

1. **Meta Business Suite**
   - https://business.facebook.com adresinden WhatsApp Business API'ye başvurun
   - Webhook URL'ini ekleyin:
     ```
     https://ncuswacwpqcxhmlhvfgq.supabase.co/functions/v1/whatsapp-webhook
     ```

2. **Verify Token** (opsiyonel güvenlik için edge function'a eklenebilir)

## 📝 Kullanım Örnekleri

### Kullanıcı Mesajları
```
"Günübirlik Kapadokya 20 Temmuz"
"2 gece Ayvalık Mayıs"
"3 gece tur 4 kişi"
```

### Bot Cevapları
```
🎯 *2 Tur Bulundu!*

1️⃣ *Kapadokya Günübirlik Tur*
📍 Kapadokya
📅 2026-07-20
💰 5.200 TRY /kişi
👥 30 kontenjan
📄 https://example.com/program/kapadokya.pdf

📝 Ön kayıt için lütfen acentemizle iletişime geçin.
```

## 🔧 Edge Function Detayları

**Endpoint**: `/functions/v1/whatsapp-webhook`

**Request Format**:
```json
{
  "Body": "Günübirlik Kapadokya 20 Temmuz",
  "From": "whatsapp:+905551234567"
}
```

**Response Format**:
```json
{
  "success": true,
  "message": "WhatsApp formatında yanıt",
  "tours": [...]
}
```

## 🎯 Özellikler

- ✅ Türkçe doğal dil anlama
- ✅ Tarih, destinasyon, tur tipi algılama
- ✅ Otomatik tur arama
- ✅ WhatsApp formatında güzel sonuçlar
- ✅ Emoji desteği
- ✅ En fazla 3 tur gösterme (uzun mesaj önleme)

## 🔐 Güvenlik

Edge function'da isterseniz verification token ekleyebilirsiniz:

```typescript
const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
if (req.method === 'GET') {
  // Webhook verification
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge);
  }
}
```

## 📊 Test

```bash
# Local test
curl -X POST https://ncuswacwpqcxhmlhvfgq.supabase.co/functions/v1/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{"Body": "Günübirlik Kapadokya 20 Temmuz"}'
```

## 🆘 Sorun Giderme

**Problem**: Webhook çalışmıyor
- Edge function loglarını kontrol edin
- CORS ayarlarını kontrol edin
- Twilio'da webhook URL'inin doğru olduğundan emin olun

**Problem**: Türler bulunamıyor
- Database'de tour_dates tablosunda veri olduğundan emin olun
- Tarih formatının doğru olduğunu kontrol edin (YYYY-MM-DD)

## 🚀 İleri Seviye

- **Kayıt Oluşturma**: Direkt WhatsApp'tan ön kayıt alabilirsiniz
- **Ödeme Linkleri**: Her tura ödeme linki ekleyebilirsiniz
- **Durum Bildirimleri**: Kayıt durumu değişikliklerinde WhatsApp mesajı gönderin
- **Çoklu Dil**: İngilizce, Almanca vb. dil desteği ekleyin

---

**Hazırlayan**: Lovable AI
**Proje URL**: https://lovable.dev/projects/68410288-52e1-4968-9da2-539398d16600
