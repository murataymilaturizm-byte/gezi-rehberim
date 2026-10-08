# PAKET-0 · Dilim 4 — 5 "mesaj kaydedilmiyor" yolu + Dilim-3 §10.4 kararı — Sonuç Raporu

**Tarih:** 2026-10-08 · **Kaynak:** `docs/raporlar/TURZZ-PAKET0-DILIM3-SONUC.md` §5 (5 yol) + §10.4 · **Uygulayan model:** Opus 5.5 (Fable incelemesine girecek) · **Kapsam:** yalnız bu 6 madde; diğer gruplara dokunulmadı · Commit/push/deploy: §8.

Tüm yollar Dilim-3'ün **tek** kayıt noktası `saveInboundMessage` + tek sabit `DROP_REASON` üzerinden; yeni kayıt kopyası yazılmadı. Müşteriye giden mesajlar ve aylık sayaç davranışı **değişmedi** (önce/sonra dökümü §4).

---

## 1. §10.4 kararı — limit adı `quota_exceeded`

- `shared/constants/drop-reasons.ts`: `DROP_REASON.MONTHLY_LIMIT = "quota_exceeded"` (anahtar adı korundu, değer panelin okuduğu ad). `src/components/WhatsAppLogs.tsx:235` (`dropped_reason === "quota_exceeded"` → "quota" rozeti) artık hem müşteri satırını hem `[unavailable]` satırını tanır.
- Suite panel-sözleşme muhafızı genişletildi: `WhatsAppLogs.tsx` içinde ``dropped_reason === "${DROP_REASON.MONTHLY_LIMIT}"`` bulunmalı (abonelik önek muhafızının yanında). Sabit ya da panel değişirse suite kırmızı.
- Soğuma sorgusu içerik **önekine** bakıyor (`[unavailable]%`) — `monthly_limit` ile yazılmış eski satırlar da eşleşir. (`monthly_limit` adı Dilim-3'te ~1 saat canlıdaydı.)
- Not: `process-message`'daki RPC hata kodu `QUOTA_EXCEEDED` (tur kontenjanı) ayrı alan/büyük harf — panel yalnız `metadata.dropped_reason` okur, çakışma yok.

## 2. Yeni sebep adlarının kontrolü (grep: `src/`, `supabase/migrations`, `supabase/functions`)
`unsupported_media`, `agency_not_configured`, `message_too_long`, `rate_limited`, `tours_unavailable`: **0 eşleşme** (sabit dosyası hariç). Panel (`WhatsAppLogs.getFriendlyContent`) bu adları tanımıyor → içerik ham gösterilir. Talimat gereği karar gerekmedi.

---

## 3. Beş yol — önce / sonra (satır no: bu commit sonrası `whatsapp-webhook/index.ts`)

| # | Yol | Önce (HEAD) | Sonra | `dropped_reason` |
|---|---|---|---|---|
| 1 | Desteklenmeyen tip (ses/görsel/video/belge/konum/sticker/kişi kartı), caption'sız — `:233-279` | Acente çözülüp 7-dil "yalnızca yazılı mesaj" cevabı; **kayıt yok** | Acente tespit edildiyse önce kayıt: içerik yer tutucu (`[ses mesajı]`, `[görsel]`, `[video]`, `[belge]`, `[konum]`, `[çıkartma]`, `[kişi kartı]`), `metadata.media_type` + varsa `media_id`. Cevap aynen. | `unsupported_media` |
| 2 | Acente tespit edildi, WhatsApp kimlik bilgisi eksik — `:299-308` | `return 200` ("WhatsApp not configured"); **kayıt yok** | Kayıt + aynı return (müşteriye zaten gönderilemiyor) | `agency_not_configured` |
| 2b | Acente tespit edilemedi — `:282-297` | yalnız `console.error` | Yazılacak `agency_id` yok → **satır yazılamaz**; `logCritical("AGENCY_NOT_FOUND", severity: warning, phoneNumberId)` | — |
| 3 | 2000+ karakter — `:335-342` | 7-dil "çok uzun" cevabı; **kayıt yok** | Metnin **tamamı** (`rawMessage`, kırpılmadan) kaydedilir + `metadata.length`; mesaj işlenmediği için `dropped_reason` var. Cevap aynen. Not: `sanitizeInput` 2000'de kırpar ama bu yolda hiç çağrılmaz; LLM'e giden yolda zaten ≤2000. | `message_too_long` |
| 4 | Rate limit `allowed=false` — `:415-419` | "Çok hızlı" cevabı; **kayıt yok** | Kayıt + aynı cevap | `rate_limited` |
| 5 | Tur verisi yüklenemedi (`TOUR_DATA_UNAVAILABLE`) — `:553-566` | 7-dil "yükleyemedim" cevabı; **kayıt yok**, yalnız tour-cache `console.error` | Kayıt + `logCritical("TOURS_UNAVAILABLE", severity: error)` + aynı cevap | `tours_unavailable` |

Ayrıştırıcı: `_shared/metaWhatsapp.ts extractMetaWebhookData` artık `mediaId` da döndürür (`msg[msg.type].id`; indirme YOK). Caption'lı medya önceden olduğu gibi **metin olarak işlenir** (düşürülmüyor). Tepki/düzenleme/bilinmeyen tipler sessiz ve kayıtsız kalır (mesaj değil — mevcut bilinçli davranış).

---

## 4. Kanıtlar (gerçek koşum, gerçek webhook giriş kodu)

### 4.1 Webhook harness — ÖNCE (yeni testler HEAD koduna karşı)
```
D4-1  desteklenmeyen tip (ses, gerçek Meta audio payload) → [ses mesajı] + unsupported_media + media_id ... FAILED
D4-1b diğer medya tipleri yer tutucuları (görsel/video/belge/konum/sticker) ... FAILED
D4-2  bağlantı bilgisi eksik acente (tespit edildi) → agency_not_configured ... FAILED
D4-2b acente tespit edilemedi → satır YOK, logCritical ... FAILED
D4-3  2000+ karakter → metnin TAMAMI + message_too_long ... FAILED
D4-4  rate limit allowed=false → rate_limited ... FAILED
D4-5  tur verisi yüklenemedi → tours_unavailable + logCritical ... FAILED
D4-§10.4 limit dolu → müşteri + [unavailable] satırı quota_exceeded ... FAILED
(mevcut 7 Dilim-3 testi ... ok ×7)
FAILED | 7 passed | 8 failed
```
Ses testi gerçek Meta Cloud API voice-note şekliyle: `{ type: "audio", audio: { mime_type: "audio/ogg; codecs=opus", sha256, id: "1234567890123456", voice: true } }`.

### 4.2 Ham davranış dökümü — önce / sonra (kaynak `git stash` ile HEAD'e alınıp aynı script koşuldu)
```
===== ÖNCE (HEAD) =====
[1 SES]           müşteriye: ["Şu an yalnızca yazılı mesajları işleyebiliyor…"] | user satırı: [] | logCritical=[]
[2 KIMLIK-EKSIK]  müşteriye: [] | user satırı: [] | logCritical=[]
[2b ACENTE-YOK]   müşteriye: [] | user satırı: [] | logCritical=[]
[3 COK-UZUN]      müşteriye: ["Mesajınız çok uzun, lütfen daha kısa bir mesa…"] | user satırı: [] | logCritical=[]
[4 RATE-LIMIT]    müşteriye: ["Çok hızlı mesaj gönderiyorsunuz. 🙏 Lütfen bi…"] | user satırı: [] | logCritical=[]
[5 TUR-VERISI-YOK] müşteriye: ["Üzgünüm, tur bilgilerini şu an yükleyemedim. …"] | user satırı: [] | logCritical=[]
[§10.4 LIMIT]     user=monthly_limit system=monthly_limit content="[unavailable] monthly_limit"
===== SONRA =====
[1 SES]           müşteriye: ["Şu an yalnızca yazılı mesajları işleyebiliyor…"] | user satırı: [{"content":"[ses mesajı]","meta":{"dropped_reason":"unsupported_media","media_type":"audio","media_id":"1234567890123456"}}]
[2 KIMLIK-EKSIK]  müşteriye: [] | user satırı: [{"content":"Merhaba, tur bilgisi alabilir …(36)","meta":{"dropped_reason":"agency_not_configured"}}]
[2b ACENTE-YOK]   müşteriye: [] | user satırı: [] | logCritical=["AGENCY_NOT_FOUND"]
[3 COK-UZUN]      müşteriye: ["Mesajınız çok uzun, lütfen daha kısa bir mesa…"] | user satırı: [{"content":"Merhaba, Merhaba, Merhaba, Mer…(2253)","meta":{"dropped_reason":"message_too_long","length":2253}}]
[4 RATE-LIMIT]    müşteriye: ["Çok hızlı mesaj gönderiyorsunuz. 🙏 Lütfen bi…"] | user satırı: [{"content":"Fiyat?","meta":{"dropped_reason":"rate_limited"}}]
[5 TUR-VERISI-YOK] müşteriye: ["Üzgünüm, tur bilgilerini şu an yükleyemedim. …"] | user satırı: [{"content":"Kapadokya turu var mı?","meta":{"dropped_reason":"tours_unavailable"}}] | logCritical=["TOURS_UNAVAILABLE"]
[§10.4 LIMIT]     user=quota_exceeded system=quota_exceeded content="[unavailable] quota_exceeded"
```
"müşteriye" sütunu önce ve sonra **birebir aynı**. D4-1b'de görsel/video/belge/konum/sticker yer tutucuları ve `media_type` assertion'larla doğrulandı.

### 4.3 `npm test`
```
━━━ Katman-1 suite ━━━              1550 ✓ / 0 ✗   (Dilim-3 sonu 1543; +7 D4/§10.4 muhafızı, 1 muhafız genişletildi)
━━━ Katman-2 harness ━━━            ok | 60 passed | 0 failed
━━━ Katman-2 webhook harness ━━━    ok | 15 passed | 0 failed   (Dilim-3: 7 + Dilim-4: 8)
━━━ SONUÇ ━━━  suite=✓  harness=✓  webhook=✓      EXIT=0
```
Suite D4 muhafızları: webhook kodunda (yorumlar hariç) **hiçbir** sebep adı string-literal değil — hepsi `DROP_REASON`'dan (eski `message_limit_reached`/`subscription_inactive`/`monthly_limit` dahil); panel sözleşmesi (abonelik öneki + `quota_exceeded`); `saveInboundMessage` çağrı sayısı ≥8 (F1: limit + bot-pause + erken kayıt = 3; D4: 5); 5 yeni `DROP_REASON` anahtarının her biri webhook'ta kullanılıyor.

Tip denetimi: `deno check` (webhook + demo-chat grafiği) **12 → 12** (yeni hata yok; `:208` `success` iki kez önceden vardı).

---

## 5. KARAR GEREKLİ (en güvenli/istenen seçenek uygulandı)

| # | Konu | Uygulanan | Risk / alternatif |
|---|---|---|---|
| K1 | `rate_limited` her mesajda satır yazar | Talimat gereği yazılır | Dakikada 30+ mesaj atan bir kaynak (kötüye kullanım) her mesajda DB yazımı üretir — rate limit'in koruduğu yazım yükünün bir kısmı geri gelir. Alternatif: rate-limit penceresinde yalnız ilk düşürülen mesajı kaydetmek. |
| K2 | Medya yer tutucuları Türkçe | `[ses mesajı]`, `[görsel]` … (panel/acente dili TR) | Panel dili EN olan acentede de TR görünür. Alternatif: `media_type` metadata'sından panelde i18n (panel değişikliği). |
| K3 | Yol 1/2/3 dedup RPC'sinden (`process_whatsapp_message_atomic`, `:368`) **önce** çalışıyor | Davranış sırası korunarak kayıt eklendi | Meta aynı `wamid`'i tekrar teslim ederse (yavaş 200 vb.) bu üç yolda satır **iki kez** yazılabilir. Yol 4/5 dedup'tan sonra. Alternatif: bu üç kontrolü dedup'un arkasına almak (akış sırası değişikliği). |
| K4 | Kayıtlar ekranında rozet | — (bilgi) | `WhatsAppLogs` `quota_exceeded` / `subscription_*` taşıyan **müşteri** satırlarının içeriğini "quota"/"abonelik" rozetiyle değiştirir, ham metin popover'da. Konuşmalar ekranı (`WhatsAppConversations`) metni olduğu gibi gösterir. |

---

## 6. Pre-delete tablosu + net satır farkı

| Silinen / değişen | Neden | Yerine |
|---|---|---|
| `DROP_REASON.MONTHLY_LIMIT = "monthly_limit"` | Panel okumuyordu (§10.4) | `"quota_exceeded"` |
| `extractMetaWebhookData` dönüşü (`msgType` ile bitiyordu) | Medya kimliği kayboluyordu | `+ mediaId` |
| Acente-bulunamadı dalında yalnız `console.error` | Görünmez | `+ logCritical(AGENCY_NOT_FOUND)` (console korunur) |
| 5 yolda "cevap gönder + return" (kayıtsız) | Müşteri mesajı panelde izsiz | `saveInboundMessage(...)` önce; cevap/return aynen |

Silinen kod satırı yok denecek kadar az (3) — bu dilim **eksik davranış ekleme** işi. **Net satır (prod: webhook + `_shared/metaWhatsapp.ts` + `drop-reasons.ts`):** +73 / −10 = **+63**; yalnız kod (yorum/boş hariç) **+53 / −3 = +50**. Net-negatif değil; her yol ~5 satır kayıt çağrısı + açıklama, `MEDIA_PLACEHOLDER` tablosu (9 satır), 5 yeni sabit.

---

## 7. Değişen dosyalar
| Dosya | Değişiklik |
|---|---|
| `supabase/functions/shared/constants/drop-reasons.ts` | `MONTHLY_LIMIT → "quota_exceeded"`; +5 sebep; `MEDIA_PLACEHOLDER`; okuyucu sözleşmesi notu |
| `supabase/functions/_shared/metaWhatsapp.ts` | `extractMetaWebhookData` `mediaId` döndürür |
| `supabase/functions/whatsapp-webhook/index.ts` | 5 yol `saveInboundMessage` + `DROP_REASON`; `AGENCY_NOT_FOUND` ve `TOURS_UNAVAILABLE` logCritical |
| `supabase/functions/_tests/webhook/webhook_harness.ts` | `postRawMessage` (ham Meta mesajı), `agencyNotFound`/`toursDown` senaryoları, env kimlik fallback'i kapalı |
| `supabase/functions/_tests/webhook/webhook_drop_paths_test.ts` | **yeni** — 8 test |
| `supabase/functions/_tests/webhook/webhook_test.ts` | limit beklentisi `quota_exceeded` |
| `scripts/test_behavioral.ts` | D4 muhafızları + panel sözleşmesi genişletildi |

---

## 8. Commit / Push / Deploy
(§8a'ya deploy sonrası eklenecek bölümde.)

---

## 9. Ürün sahibine sade özet
Müşterinin sesli mesajı, fotoğrafı, çok uzun mesajı, çok hızlı yazdığı için cevaplanmayan mesajları ve sistem arızası anlarında attığı mesajlar artık konuşma kaydına düşüyor; acente hiçbir müşteri temasını kaçırmıyor. Müşteriye giden cevaplar hiç değişmedi; değişen tek şey arka planda kayıt ve neden etiketinin tutulması. Aylık limit dolduğunda yazılan etiket artık panelin tanıdığı "kota" etiketi, böylece kayıtlar ekranında doğru rozetle görünüyor.
