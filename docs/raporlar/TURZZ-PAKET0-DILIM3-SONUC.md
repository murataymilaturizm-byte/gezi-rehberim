# PAKET-0 · Dilim 3 — F1 (düşürülen mesaj kaydı) + F2 (rate-limit fail-open) + `:426` — Sonuç Raporu

**Tarih:** 2026-10-08 · **Kaynak:** `docs/raporlar/TURZZ-FABLE-DENETIM.md` §8 Grup F (F1, F2) + Dilim-2 raporu §7 Gözlem 5'in `:426` kısmı · **Uygulayan model:** Opus 5.5 (Fable incelemesine girecek) · **Kapsam:** yalnız F1 + F2 + `:426`; diğer return-200 yolları envanterlendi, **düzeltilmedi** (§5) · **Commit:** tek commit · **Push: YAPILMADI · Deploy: YAPILMADI.**

Ön iş: Dilim-2 raporu §8 sade özetindeki "canlıya alınmadı / onay bekliyor" cümlesi gerçek duruma göre düzeltildi (kararlar onaylandı, 8 Ekim'de canlıda: demo-chat v272, whatsapp-webhook v293).

---

## 1. Bulgu — bu dilimde ortaya çıkan asıl hata (`:426`)

Denetim F1'i "limit dolunca müşteri mesajı kaydedilmiyor" olarak tanımlamıştı. Harness gerçek webhook koduyla koşunca durumun **daha kötü** olduğu görüldü:

`whatsapp-webhook/index.ts:421-426` (eski):
```ts
supabase.from("whatsapp_conversations").insert({ … role: "system", content: `[unavailable] ${_reason}` … }).catch(() => {});
```
Postgrest builder'ında `catch` **metodu yok** — doğrulama: önbellekteki çalışma zamanı `esm.sh/@supabase/postgrest-js@2.117.2` builder sınıfında yalnız `then(t,e)` var; dosyadaki `catch(` geçişleri try/catch ve iç promise (`a.catch`). Ayrıca `deno check` aynı satır için `TS2551: Property 'catch' does not exist on type 'PostgrestFilterBuilder…'` veriyordu. Sonuç:
1. `.catch` çağrısı **TypeError** atar; builder tembel olduğu için insert **hiç çalışmaz** → 24 saatlik soğuma kaydı yazılmaz → bildirim **her mesajda** tekrar gider.
2. TypeError dış `catch (error)` bloğuna düşer → müşteriye ayrıca **"teknik bir sorun yaşıyorum"** mesajı gider.

Harness'teki stub builder aslına uygun kuruldu (tembel, yalnız `then`, `catch` yok) — aşağıdaki "önce" dökümü bu davranışı gerçek webhook koduyla gösteriyor.

---

## 2. Yapılanlar

### F1 — Tek "gelen mesajı kaydet (+ sebep)" noktası
`whatsapp-webhook/index.ts` modül seviyesinde **`saveInboundMessage(supabase, agencyId, phone, content, { droppedReason?, meta?, lossIfFail })`**:
- `whatsapp_conversations`'a `{ phone, role: "user", content, agency_id }` yazar; `droppedReason` verilirse `metadata: { dropped_reason, ...meta }`.
- Hata (dönen `error` ya da istisna) → `logCritical("INBOUND_MESSAGE_SAVE_FAIL")`; `lossIfFail` true ise `error`, yedek yazım yolu olan çağıranda `warning`.
- **Üç tüketici** (eski üç ayrı yazım → tek nokta):
  - **Limit/abonelik dalı (yeni):** bildirim mantığından ÖNCE her mesaj kaydedilir. `dropped_reason`: `"monthly_limit"` (+ `message_limit`) / `"subscription_inactive"` (+ `subscription_status`).
  - **Bot-pause yolu:** eski satır şekli aynen (metadata'sız); hata artık görünür.
  - **Normal akış erken kaydı:** başarılıysa `adapter.markUserSaved()` (eski davranış); başarısızsa yedek `saveTransaction` yolu korunur (`lossIfFail:false`).
- 24 saatte 1 bildirim davranışı ve 7 dil metinleri **değişmedi**.

### `:426` — `[unavailable]` soğuma kaydı
`await` + `try/catch` + dönen `error` kontrolü; hata → `logCritical("UNAVAILABLE_MARK_INSERT_FAIL")`. Webhook her durumda 200 döner, müşteriye ek "teknik sorun" mesajı gitmez.

### F2 — `check_rate_limit` RPC hatası: fail-open
Eski: `console.error` + **erken `return 200`** (mesaj cevapsız ve kayıtsız). Yeni: `logCritical("RATE_LIMIT_RPC_FAIL", { failOpen: true })` ve akış **devam eder** (mesaj kaydedilir + işlenir). Gerçek "limit aşıldı" (`allowed=false`) dalı **değişmedi**.

### Panel doğrulaması (KARAR gerekmedi)
`src/components/WhatsAppConversations.tsx`: sorgu `select("id, phone, role, content, created_at, agency_id")` (:231-233); gizlenen yalnız `role==="system"` ve state-JSON (`isSystemOrStateMsg`, :47-53); `role==="user"` satırlar müşteri balonu olarak çizilir (:625-637); realtime INSERT de aynı filtreden geçer (:172-175). → Düşürülen mesajlar acentenin konuşma ekranında **müşteri mesajı olarak görünür**. `metadata` panelde okunmuyor (rozet bu dilimde yok — talimat).

### Test altyapısı
- **Webhook giriş-katmanı harness'i** (`supabase/functions/_tests/webhook/`): GERÇEK `whatsapp-webhook/index.ts` import edilir; ayrı `import_map.json` ile stub'lanan: `std/http/server.ts` (`serve` handler'ı yakalar), `supabase-js` (aslına uygun tembel/catch'siz builder; DB davranışı senaryo başına — 24h soğuma sorgusu **gerçekten yazılmış** satırlara bakar), Meta gönderim/acente çözümü (ağ; ayrıştırma ve imza GERÇEK), okundu-göstergesi, error-sink (Katman-2 stub'ı), `process-message` (yalnız çağrı kaydı). Meta `messages` payload'u → `db.inserts` / gönderilen mesajlar / `processChatMessage` çağrıları / `logCritical`.
- `npm test` artık üç parça koşar: suite + harness + **webhook**.
- Suite "PAKET-0 D3" (5 statik muhafız): webhook kodunda (yorumlar hariç) Postgrest `insert/update/upsert(...).catch(` YOK — **HEAD'e karşı koşulunca kırmızı veriyor** (doğrulandı); `saveInboundMessage` tanımlı ve ≥3 yerde kullanılıyor; helper dışında tek-satır `role:"user"` insert'i yok; limit dalı `dropped_reason` ile kaydediyor; `if (_rle)` bloğunda erken `return` yok + `logCritical` var.

---

## 3. KARAR GEREKLİ (en güvenli seçenek uygulandı)

| # | Karar | Uygulanan | Alternatif |
|---|---|---|---|
| K1 | Bot-pause satırları `dropped_reason` taşısın mı? | **Hayır** — satır şekli eskisiyle birebir (insan devraldı; mesaj "düşürülmüyor", panel zaten görüyor). | `dropped_reason: "bot_paused"` |
| K2 | Sebep sözlüğü | Müşteri satırında talimattaki adlar: `monthly_limit` / `subscription_inactive` (+ ayrıntı `message_limit` / `subscription_status`). `[unavailable]` **system** satırı eski değerleriyle (`message_limit_reached` / `subscription_<status>`) korundu — soğuma sorgusu ve olası tüketiciler kırılmasın. İki sözlük yan yana. | System satırını da yeni adlara geçirmek |
| K3 | Düşürülen mesaj aylık sayaca (`monthly_message_count`) yazılsın mı? | **Hayır** (eski davranış; bot cevap üretmedi). | Saymak |
| K4 | F2 fail-open | Talimat gereği uygulandı. Risk: RPC kesintisi süresince numara-başı hız sınırı çalışmaz (kötüye kullanım/maliyet). `logCritical` ile görünür. | — |

---

## 4. Kanıtlar (gerçek koşum çıktıları)

### 4.1 Webhook harness — ÖNCE (HEAD kodu)
```
F1 aylık mesaj limiti dolu: her mesaj role=user + dropped_reason=monthly_limit kaydedilir; bildirim 24 saatte 1 ... FAILED
F1 abonelik pasif (expired): her mesaj role=user + dropped_reason=subscription_inactive kaydedilir; bildirim 24 saatte 1 ... FAILED
F1/:426 [unavailable] insert hata verince logCritical + 200, teknik-hata mesajı yok ... FAILED
F2 check_rate_limit RPC hatası → fail-open: mesaj işlenir + logCritical ... FAILED
F2 regresyon: allowed=false → eski davranış (yavaşla mesajı, işlenmez) ... ok
Regresyon: bot-pause yolu mesajı role=user kaydeder (metadata'sız, eski şekil) ... ok
Regresyon: normal akış — mesaj kaydedilir + işlenir ... ok
error: AssertionError: 1. mesaj whatsapp_conversations'a role=user yazılmalı      (×2)
error: AssertionError: logCritical çağrılmalı (kayıtlar: yok)
error: AssertionError: processChatMessage çağrılmalı
FAILED | 3 passed | 4 failed
```
Ham davranış dökümü (Meta payload → müşteriye giden / DB):
```
[LIMIT] "Merhaba" → HTTP 200 | müşteriye giden: ["Üzgünüm, hizmetimiz şu anda geçici olarak kullanılamıyor. 🙏 …","Üzgünüm, şu anda teknik bir sorun yaşıyorum. Lütfen birkaç dakika sonr…"]
[LIMIT] "Fiyat nedir?" → HTTP 200 | müşteriye giden: ["Üzgünüm, hizmetimiz şu anda geçici olarak kullanılamıyor. 🙏 …","Üzgünüm, şu anda teknik bir sorun yaşıyorum. …"]
[LIMIT] whatsapp_conversations yazılan: [] | processChatMessage=0 | logCritical=[]
[ABONELIK] — aynı: her mesajda 2 mesaj, yazılan: []
[RATE_RPC_HATA] "Pamukkale fiyatı?" → HTTP 200 | müşteriye giden: [] | whatsapp_conversations yazılan: [] | processChatMessage=0 | logCritical=[]
```

### 4.2 Webhook harness — SONRA
```
F1 aylık mesaj limiti dolu … ok      F1 abonelik pasif (expired) … ok      F1/:426 … ok      F2 RPC hatası fail-open … ok
F2 regresyon allowed=false … ok      Regresyon bot-pause … ok             Regresyon normal akış … ok
ok | 7 passed | 0 failed
```
```
[LIMIT] "Merhaba" → HTTP 200 | müşteriye giden: ["Üzgünüm, hizmetimiz şu anda geçici olarak kullanılamıyor. 🙏 …"]
[LIMIT] "Fiyat nedir?" → HTTP 200 | müşteriye giden: []                                   ← 24h soğuma çalışıyor
[LIMIT] whatsapp_conversations yazılan: [{"role":"user","content":"Merhaba","reason":"monthly_limit"},
        {"role":"system","content":"[unavailable] message_limit_re…","reason":"message_limit_reached"},
        {"role":"user","content":"Fiyat nedir?","reason":"monthly_limit"}] | processChatMessage=0 | logCritical=[]
[ABONELIK] "Merhaba" → 1 bildirim · "Fiyat nedir?" → 0 · yazılan: user(subscription_inactive), system([unavailable] subscription_expired), user(subscription_inactive)
[RATE_RPC_HATA] "Pamukkale fiyatı?" → HTTP 200 | yazılan: [{"role":"user","content":"Pamukkale fiyatı?"}] | processChatMessage=1 | logCritical=["RATE_LIMIT_RPC_FAIL"]
```
`[unavailable]` insert hatası senaryosu: HTTP 200, `logCritical=["UNAVAILABLE_MARK_INSERT_FAIL"]`, "teknik sorun" mesajı yok, müşteri satırı yazılı (test assertion'ları geçti).

### 4.3 `npm test` toplam
```
━━━ Katman-1 suite ━━━              1541 ✓ / 0 ✗   (Dilim-2 sonu 1536; +5 PAKET-0 D3)
━━━ Katman-2 harness ━━━            ok | 60 passed | 0 failed
━━━ Katman-2 webhook harness ━━━    ok | 7 passed | 0 failed
━━━ SONUÇ ━━━  suite=✓  harness=✓  webhook=✓      EXIT=0
```
İlk koşumda yeni F1 statik muhafızı **kendi açıklama yorumumdaki** `.insert(...).catch(` metnini yakaladı (yanlış pozitif); muhafız yorum satırlarını dışlayacak şekilde düzeltildi ve HEAD koduna karşı hâlâ **kırmızı** verdiği doğrulandı.

Tip denetimi: `deno check` (webhook + demo-chat grafiği) **13 → 12** — düşen tek hata `:426` TS2551 (`.catch` builder'da yok); yeni hata yok. Webhook'ta başka bir Postgrest `.catch` zinciri yok; aynı desen diğer edge fonksiyonlarında da taranıp **bulunmadı**.

---

## 5. Webhook return-200 / erken-dönüş envanteri (mesaj kaydediliyor mu?)

Satır numaraları bu commit sonrası `whatsapp-webhook/index.ts`.

| Satır | Yol | Müşteri mesajı kaydı | Durum |
|---|---|---|---|
| 87-117 | GET doğrulama / OPTIONS | — (mesaj yok) | kapsam dışı, sorun değil |
| 157, 171 | İmza geçersiz / eksik → 401 | Hayır | **bilinçli** (güvenlik: imzasız istek güvenilmez) |
| 194-207 | testMode (super_admin) | — | kapsam dışı |
| 215, 220 | Geçersiz payload / durum güncellemesi (okundu/iletildi) | — (müşteri metni yok) | sorun değil |
| 264 | Desteklenmeyen tip (ses/görsel/konum…) → kibar 7-dil yanıt | **Hayır** | **kapsam dışı açık** — müşteri bir şey gönderdi, panelde iz yok |
| 273 | Acente bulunamadı | Hayır (agency_id yok) | yazılacak hedef yok |
| 281 | Acentenin WhatsApp kimlik bilgisi eksik | **Hayır** | **kapsam dışı açık** |
| 324 | Mesaj 2000 karakterden uzun → 7-dil uyarı | **Hayır** | **kapsam dışı açık** |
| 348 | Aynı `wamid` tekrar (dedup) | İlk kopya kayıtlı | sorun değil |
| 398 | Rate limit aşıldı (`allowed=false`) → "çok hızlı" | **Hayır** | **kapsam dışı açık** (davranış talimatla korunur) |
| 495 | Limit dolu / abonelik pasif | **Evet** — `saveInboundMessage` + `dropped_reason` | **bu dilimde düzeltildi (F1)** |
| 530 | Tur verisi yüklenemedi (`TOUR_DATA_UNAVAILABLE`) | **Hayır** (erken kayıttan önce) | **kapsam dışı açık** |
| 573 | Canned (hazır cevap) | Evet — kendi user+assistant çift insert'i | kayıtlı ama tek noktadan geçmiyor (kapsam dışı) |
| 603 | FAQ (kapalı, `FAQ_ENABLED=false`) | Evet — çift insert | aynı |
| 626 | Bot-pause | **Evet** — `saveInboundMessage` | bu dilimde tek noktaya bağlandı |
| 644 | Anket puanı yakalandı | Evet — `feedback-capture.ts:149` çift insert | kayıtlı ama tek noktadan geçmiyor (kapsam dışı) |
| 683→709 | Normal akış | **Evet** — `saveInboundMessage` (yedek: `saveTransaction`) | bu dilimde tek noktaya bağlandı |
| 735 | Dış `catch` | Erken kayıttan önceki istisnalarda **Hayır** | kapsam dışı |

**Kök kural için kalan iş (sonraki dilim adayı):** 264, 281, 324, 398, 530 "mesajı düşür" yolları `saveInboundMessage(..., { droppedReason: "unsupported_type" | "not_configured" | "too_long" | "rate_limited" | "tour_data_unavailable" })`'dan geçmeli; canned/FAQ/anket çift-insert'leri helper'ın çift-satır varyantına taşınmalı.

---

## 6. Pre-delete tablosu + net satır farkı

| Silinen | Neden | Yerine |
|---|---|---|
| `if (_rle) { console.error(...); return new Response(... 200) }` | Altyapı hatası mesajı sessizce düşürüyordu (F2) | `logCritical("RATE_LIMIT_RPC_FAIL")` + akış devam |
| `supabase.from(...).insert({ … [unavailable] … }).catch(() => {})` | Builder'da `catch` yok → insert hiç çalışmıyor + TypeError → müşteriye "teknik sorun" (§1) | `await` + `try/catch` + `error` kontrolü + `logCritical("UNAVAILABLE_MARK_INSERT_FAIL")` |
| Bot-pause yolundaki inline `await supabase.from("whatsapp_conversations").insert({…role:"user"…})` (hata kontrolsüz) | İkinci kopya yazım yolu | `saveInboundMessage(…, { lossIfFail: true })` |
| Normal akış erken kaydının inline `try { insert … } catch { console.error }` bloğu (9 satır) | Üçüncü kopya yazım yolu; hata yalnız console'da | `saveInboundMessage(…, { lossIfFail: false })` + `markUserSaved()` |

**Net satır (prod: `whatsapp-webhook/index.ts`; test/doküman hariç):** +80 / −22 = **+58**; yorum/boş hariç **yalnız kod: +56 / −21 = +35**.
**Net-negatif hedefi tutturulamadı.** Sebep: yeni davranış eklendi (limit dalında mesaj kaydı + iki yeni `logCritical` noktası + `saveInboundMessage` helper'ı ~30 satır). Kopya yazım yolları tarafı net −12.

---

## 7. Değişen dosyalar
| Dosya | Değişiklik |
|---|---|
| `supabase/functions/whatsapp-webhook/index.ts` | `saveInboundMessage`; F1 limit dalı kaydı; `:426` düzeltmesi; F2 fail-open; bot-pause + erken kayıt helper'a bağlandı |
| `supabase/functions/_tests/webhook/` | **yeni** — `webhook_harness.ts`, `webhook_test.ts` (7 test), `import_map.json`, `stubs/{supabase-js,meta,std-server,wa-status,process-message}.ts` |
| `scripts/test_all.mjs` | webhook harness'i `npm test`'e eklendi |
| `scripts/test_behavioral.ts` | +5 statik muhafız "PAKET-0 D3" |
| `docs/ARCHITECTURE_GUARDS.md` | §G19 + başlık |
| `docs/raporlar/TURZZ-PAKET0-DILIM2-SONUC.md` | §8 sade özet gerçek duruma göre düzeltildi |

## 8. Gözlemler (kapsam dışı — DÜZELTİLMEDİ)
1. §5'teki 5 "mesajı düşür" yolu (desteklenmeyen tip, kimlik bilgisi eksik, çok uzun mesaj, rate limit aşıldı, tur verisi yüklenemedi) hâlâ müşteri mesajını kaydetmiyor.
2. **Canlı etki (tahmin, DOĞRULANMADI — canlı log/DB görülmedi):** `:426` hatası yüzünden mesaj limiti dolmuş ya da aboneliği pasif bir acentenin müşterileri şu an her mesajda iki mesaj alıyor ("hizmet kullanılamıyor" + "teknik sorun"). Supabase loglarında `TypeError … .catch is not a function` aranarak doğrulanabilir.
3. Canned/FAQ/anket yolları `role:"user"` satırını kendi çift-insert'leriyle yazıyor — tek noktadan geçmiyor.
4. `deno check`'te kalan 12 önceden-var-olan hata (Dilim-1/2'den devir; webhook `:207` `success` iki kez dahil).

---

## 10. Karar uygulaması (ürün sahibi, 2026-10-08)

**K1 ONAY** (bot-pause satırı metadata'sız) · **K3 ONAY** (düşürülen mesaj sayaca yazılmaz) · **K4** talimatla zaten uygulanmıştı · **K2 DÜZELT:** sebep adları tek sabitte, iki satır da onu kullanır.

### 10.1 Eski adların okunup okunmadığı (grep: `src/`, `supabase/` [functions + migrations/SQL + pg_cron], `scripts/`)
| Eski ad | Okuyan var mı? | Kanıt | Karar |
|---|---|---|---|
| `subscription_<status>` (system satırı) | **EVET** | `src/components/WhatsAppLogs.tsx:221-223` — `meta?.dropped_reason?.startsWith("subscription_")`, öneki atıp durumu ("expired"…) "abonelik" rozetiyle gösterir | **Eski ad korunur**; müşteri satırı buna hizalandı (`subscription_inactive` → `subscription_expired` / `_cancelled` / `_suspended`) |
| `message_limit_reached` (system satırı) | **HAYIR** | panel / SQL / migration / pg_cron / edge / script: 0 eşleşme. (`WhatsAppLogs` içerik araması `"message limit"` — boşluklu, bu adı yakalamaz) | **Yeni ada geçildi:** iki satır da `monthly_limit` |
| `subscription_expired` / `subscription_cancelled` (lemonsqueezy, `subscription_history.event_type`, i18n `eventTypes`) | — | Ayrı alan (abonelik olay tipi), `dropped_reason` değil | Dokunulmadı |

24 saatlik soğuma sorgusu içerik **önekine** bakıyor (`like "[unavailable]%"`) — eski adla yazılmış satırlar da eşleşmeye devam eder; ad değişikliği soğumayı bozmaz.

### 10.2 Uygulama
- `supabase/functions/shared/constants/drop-reasons.ts` (**yeni**): `DROP_REASON = { MONTHLY_LIMIT: "monthly_limit", SUBSCRIPTION_PREFIX: "subscription_" }` + `subscriptionDropReason(status)`; dosya başında okuyucu sözleşmesi (WhatsAppLogs:221) yazılı.
- `whatsapp-webhook/index.ts`: `_reason = _isExpired ? subscriptionDropReason(_subStatus) : DROP_REASON.MONTHLY_LIMIT` — **müşteri satırı** (`droppedReason: _reason`) ve **`[unavailable]` satırı** (`content` + `metadata.dropped_reason`) aynı değeri kullanır. Abonelik satırındaki fazladan `subscription_status` meta'sı kaldırıldı (durum zaten adın içinde); limit satırında `message_limit` meta'sı kaldı.
- Suite muhafızları (+2, biri değişti): iki satırın aynı `_reason`'ı kullandığı; webhook kodunda sebep adı string-literal'i olmadığı; **panel sözleşmesi** — `WhatsAppLogs.tsx`'teki önek `DROP_REASON.SUBSCRIPTION_PREFIX` ile aynı (biri değişirse suite kırmızı).
- Webhook harness'i: abonelik beklentisi `subscription_expired`; her F1 senaryosunda system satırının `dropped_reason`'ı müşteri satırıyla **eşit** olmalı (yeni assertion).

### 10.3 Kanıt (gerçek koşum)
```
[LIMIT]    whatsapp_conversations yazılan: [{"role":"user","content":"Merhaba","reason":"monthly_limit"},
           {"role":"system","content":"[unavailable] monthly_limit","reason":"monthly_limit"},
           {"role":"user","content":"Fiyat nedir?","reason":"monthly_limit"}]
[ABONELIK] whatsapp_conversations yazılan: [{"role":"user","content":"Merhaba","reason":"subscription_expired"},
           {"role":"system","content":"[unavailable] subscription_exp…","reason":"subscription_expired"},
           {"role":"user","content":"Fiyat nedir?","reason":"subscription_expired"}]
━━━ SONUÇ ━━━  suite=✓ (1543 ✓ / 0 ✗)  harness=✓ (60/60)  webhook=✓ (7/7)   EXIT=0
```

### 10.4 Yeni KARAR GEREKLİ (uygulanmadı, bilgi)
- **Panelin `"quota_exceeded"` okuyucusunun yazanı yok** (`WhatsAppLogs.tsx:235`). Limit satırları (`monthly_limit`) panelde "quota" rozeti almaz, ham içerik görünür. Seçenekler: panel okuyucusunu `DROP_REASON.MONTHLY_LIMIT`'e çevirmek (panel değişikliği — bu dilimde yasak) ya da webhook'un `quota_exceeded` yazması.
- **Panel davranışı (bilgi):** `WhatsAppLogs` (Kayıtlar ekranı) `dropped_reason` taşıyan satırın içeriğini rozetli teknik metinle değiştirir, ham metin popover'da görünür — abonelik nedeniyle düşen **müşteri** satırları da bu ekranda "abonelik" rozetiyle listelenir. Konuşmalar ekranı (`WhatsAppConversations`) `metadata` okumaz, müşteri metnini olduğu gibi gösterir.

## 9. Ürün sahibine sade özet
Mesaj limiti dolmuş ya da aboneliği durmuş bir acentenin müşterisi yazdığında, bot cevap vermese de mesaj artık konuşma ekranına kaydediliyor; acente kimin ne yazdığını görebiliyor. Bu sırada bir hata daha bulup düzelttik: aynı durumda müşteriye her mesajda hem "hizmet kullanılamıyor" hem de "teknik sorun" mesajı gidiyordu ve "günde bir kez bildir" kuralı hiç çalışmıyordu; artık müşteri günde tek bildirim alıyor. Hız-sınırı kontrolü arıza verdiğinde de mesajlar artık kaybolmadan işleniyor. Değişiklik commit'lendi, canlıya alınmadı.
