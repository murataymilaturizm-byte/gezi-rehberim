# Canlı "eski tarih/fiyat" sorunu — Teşhis Raporu

**Tarih:** 2026-10-08 · **Model:** Opus 5.5 (Fable incelemesine girecek) · **Tür:** SADECE TEŞHİS — kod değişikliği, commit, deploy **yok**; DB'ye **yazma yok** (yalnız `supabase db query --linked` ile `SELECT`).
**Olay:** whatsapp-webhook, 08.10.2026 11:39–11:50 İstanbul (08:39–08:50 UTC). Konuşma: acente **Aymila Turizm** (`fbad140f-a82e-4b9d-9829-ffc175a77f28`, hat `908505002311`), müşteri telefonu `…0303`, 39 satır. (Talimattaki "Turzz Deneme" adlı acente DB'de bulunamadı; "Deneme turizm" adlı acentenin bu saatte konuşması yok. Zaman penceresinde başka acentede yalnız demo-chat'in 1 duman testi var.)

---

## 0. Özet bulgu

"Eski / yeni / eski" sırası **önbellekten değil**, mesajı üreten yolun değişmesinden kaynaklanıyor:

| Saat (UTC) | Müşteri | Bot cevabını üreten | Gösterilen | DB ile uyum |
|---|---|---|---|---|
| 08:41:03 | "Kapadokya turu istiyorum" | **LLM** (serbest metin) | 10.10–7.11.2026, her Cumartesi, 1.500₺ | **UYUŞMUYOR** — bu tarihler sistemde hiç yok |
| 08:43:20 | "Evet" | **Deterministik :11** (`buildDateList`) | 10.07.2027 … 22.12.2027, 1.000₺ / 1.500₺, "• 12.07.2027 (DOLU)" | **UYUŞUYOR** |
| 08:49:06 | "kapadokya turlarını görmek istiyorum" | **LLM** — 08:41'deki kendi uydurmasını geçmişten **birebir kopyaladı** | 08:41 ile aynı 5 satır | **UYUŞMUYOR** |

Üç anda da bot'un elindeki tur verisi (context'e yazılan `currentTour.dates`) **doğru ve güncel** idi. Eski liste, LLM'in **geçmiş konuşma mesajlarından** ve prompt'taki "bugünün tarihi"nden ürettiği uydurmadır. Prompt bunu açıkça yasakladığı halde LLM uydurdu, uydurmayı yakalayan bir denetim de yok.

---

## 1. DB'deki güncel veri vs gösterilen liste

**Kapadokya Balon Turu** (`f7a6372b-3ad7-41c8-aad2-fe23cc2d09bc`), şu anki `tour_dates` (+ satılan, `registrations` CANCELLED hariç):

| departure_date | price_adult | quota | satılan | created_at |
|---|---|---|---|---|
| 2027-07-10 | 1000 | 1000 | 1 | 2026-07-10 10:57 |
| 2027-07-11 | 1000 | 100 | 1 | 2026-07-10 10:59 |
| 2027-07-12 | 1000 | 1 | 1 (→ DOLU) | 2026-07-10 11:09 |
| 2027-07-29 | 1000 | 1000 | 1 | 2026-07-28 08:30 |
| 2027-09-15 | 1500 | 13 | 12 | 2025-11-12 17:52 |
| 2027-12-22 | 1500 | 100 | 4 | 2025-11-12 17:52 |

- **10.10 / 17.10 / 24.10 / 31.10 / 07.11.2026 tarihli hiçbir `tour_dates` satırı yok** — bu turda da, sistemdeki herhangi bir turda da (tüm acenteler sorgulandı: 0 satır).
- Bu tura ait tüm kayıtlar (`registrations`) mevcut tarih satırlarına bağlı; silinmiş tarihe ait iz yok. (CASCADE silme izi bırakmayacağı için kısa süre var olup silinmiş tarih **tamamen dışlanamaz → doğrulanmadı**. Ancak §2'deki context dökümü, bot'un o anda bu tarihleri görmediğini kanıtlıyor.)
- **`tours` ve `tour_dates` tablolarında `updated_at` kolonu YOK** (information_schema'dan doğrulandı). Panelde bir düzenlemenin ne zaman yapıldığı DB'den okunamıyor. Eski bot mesajları satırların yerinde değiştirildiğini gösteriyor: Temmuz'da "10.07.2026, 15.09.2026 (1.500₺), 22.12.2026" listelenmişti; bugün aynı `id`'ler 2027 tarihli. Hangi düzenlemenin 11:40 civarında yapıldığı **doğrulanmadı**.

---

## 2. Konuşma ve context'in zaman içindeki hali

Kaynak: `whatsapp_conversations` (acente + telefon …0303, 08:30–09:00 UTC). Her bot cevabıyla aynı anda yazılan `role=system` satırı o turun **context**'idir (`currentTour`, `dates`, `listedDateIds`).

```
08:39:46 USER  "Merhaba"
08:39:47 BOT   "Tekrar hoş geldiniz! 👋 …"                          ← stale-reset (taze context)
08:39:47 CTX   stage=GREETING tour=-
08:40:56 USER  "Kapadokya turu istiyorum"
08:41:03 BOT   "*Kapadokya Balon Turu* için müsait tarihler:\n\n1) 10.10.2026 (Cumartesi) - 1.500₺ (79 kişilik yer)\n2) 17.10.2026 … (77 …)\n3) 24.10.2026 … (87 …)\n4) 31.10.2026 … (99 …)\n5) 7.11.2026 … (95 …)\n\nHangi tarihi tercih edersiniz? 😊"
08:41:03 CTX   stage=TOUR_SELECTED tour=Kapadokya Balon Turu(f7a6372b)
               dates=[2027-07-10@1000/r999 2027-07-11@1000/r99 2027-07-12@1000/r0 2027-07-29@1000/r999 2027-09-15@1500/r1 2027-12-22@1500/r96]
               listed=null                                           ← deterministik liste basılmadı
08:43:15 USER  "Evet"
08:43:20 BOT   "*Kapadokya Balon Turu* için müsait tarihler:\n1) 10.07.2027 (Cumartesi) - 1.000₺ (999 kişilik yer)\n2) 11.07.2027 …\n• 12.07.2027 (Pazartesi) (DOLU)\n3) 29.07.2027 …\n4) 15.09.2027 … 1.500₺ (1 kişilik yer)\n5) 22.12.2027 … 1.500₺ (96 kişilik yer)…"
08:43:20 CTX   stage=COLLECTING_INFO step=waiting_for_date … listed=[ad0f80fb,40f1363a,f25a57ac,ecafef02,3f9f92a5]   ← buildDateList
…  (Pamukkale rezervasyonu 08:46–08:47 — deterministik, doğru; COMPLETED 08:47:45)
08:48:58 USER  "kapadokya turlarını görmek istiyorum"
08:49:06 BOT   "*Kapadokya Balon Turu* için müsait tarihler:\n\n1) 10.10.2026 … (79 …) … 5) 7.11.2026 … (95 …)\n\nRezervasyon yapmak ister misiniz? 😊"
08:49:06 CTX   stage=TOUR_SELECTED tour=Kapadokya Balon Turu(f7a6372b) dates=[…aynı 2027 verisi…] listed=null
```

**Her listenin veri kaynağı:**
- **08:43:20 (doğru):** deterministik `:11` (`process-message.ts:4169` → `buildDateList`). Kanıt: `listedDateIds` yazılmış, "• … (DOLU)" biçimi (yalnız `buildDateList` üretir), başlıktan sonra tek `\n`. Veri: o istekteki `tours` dizisi (tour-cache → `toBotTours`).
- **08:41:03 ve 08:49:06 (yanlış):** **LLM serbest metni**. Kanıt: (i) `listedDateIds=null` — `buildDateList` her çağrıda yazar; (ii) "DOLU" satırı yok (DB'de 12.07.2027 dolu); (iii) başlıktan sonra çift `\n\n` (deterministik şablonlarda yok); (iv) aynı istekte context'e yazılan `currentTour.dates` **2027 verisi** — yani bot'un elindeki veri doğruydu, LLM ondan farklı yazdı.
- **(a) tour-cache:** veri doğru geldi (her üç context'te güncel 2027 tarihleri + güncel kalan kontenjan). Bu olayda **neden değil**.
- **(b) `context.currentTour.dates` anlık görüntüsü (`createTourRef`, Dilim-2 §7 Gözlem 1):** bu olayda anlık görüntü de güncel. Listeleri o üretmedi. **Neden değil.**
- **(c) Başka yer → konuşma geçmişi + LLM:** asıl kaynak (§3).

---

## 3. Kök neden — LLM'in tarih uydurması ve geçmiş sızıntısı

### 3.1 08:41 — LLM'e giden prompt'ta tarih YOKTU (yerelde yeniden üretildi)
Aymila'nın gerçek tur verisi (`getCachedTours` şeklinde, DB'den okunarak) ve aynı mesajla, Katman-2 harness'inin sabit-LLM modunda 08:41 turu yeniden koşuldu; LLM'e giden prompt yakalandı. NLU niyeti `tour_search` / `faq_general` / `general` için üç koşum, üçünde de:
- Stage `TOUR_SELECTED`, **deterministik tarih listesi tetiklenmiyor** → LLM çağrılıyor (`process-message.ts:4135-4169`: `:11` yalnız `waiting_for_date` adımında, tarih-sorusu kalıbında ya da `reservation_intent`/`tour_selected` niyetinde tetiklenir; "Kapadokya turu istiyorum" bunların hiçbiri değil).
- Prompt'ta tarih/fiyat geçen satırlar: `📅 CURRENT DATE: Perşembe, 8.10.2026` · `💰 Fiyat: kişi başı 1.000₺` (güncel) · **`⛔ TARİH KONUSUNA GİRME — KESİN YASAK: Tarih LİSTELEME, ÖNERME, UYDURMA`** (`prompts/stages/index.ts:438`) · "Müsait tarih listesi sistem tarafından otomatik gönderilir — sen değil". **Hiçbir tarih listesi yok, 1.500₺ yok, 2026 Ekim/Kasım tarihi yok.**
- Çelişen ton örneği: `prompts/tones/tr.ts:15` → `"Tabii ki! Şu tarihlerde yerimiz var: ..."` (tarih listelemeyi özendiriyor).

### 3.2 LLM'in "kaynağı": eski konuşma geçmişi
08:41'de LLM'e giden geçmiş (RPC'nin önceden yüklediği son 50 mesaj, en eskisi 28.07.2026 12:47) içinde:
```
2026-08-08 08:28:34 BOT "Müsait turlarımız: 🌟 • *Kapadokya Balon Turu* (Kapadokya) — 1.500₺ • *Pamukkale Turu* … 3.500₺ • *Antalya Rafting* … 800₺ …"
2026-08-08 08:28:47 BOT "*Antalya Rafting* için müsait tarihler:\n1) 12.12.2026 (Cumartesi) - 800₺ (91 kişilik yer)\n2) 5.12.2026 (Cumartesi) - 800₺ (93 kişilik yer) …"
```
LLM bu ikisini birleştirmiş: **fiyat** 08.08'deki eski listeden (Kapadokya **1.500₺**; bugünkü prompt 1.000₺ diyor), **biçim** eski Antalya listesinden ("N) DD.MM.YYYY (Cumartesi) - X₺ (N kişilik yer)"), **tarihler** prompt'taki `CURRENT DATE 8.10.2026`'dan sonraki 5 Cumartesi (10.10, 17.10, 24.10, 31.10, 7.11). Kontenjan sayıları (79/77/87/99/95) uydurma. (LLM'in iç akıl yürütmesi gözlenemez — bu eşleştirme güçlü çıkarım, **kesin değil**.)

### 3.3 Geçmiş kesimi WhatsApp'ta çalışmıyor (08:49'un birebir kopyası)
- `shared/services/context-manager.ts:66-68`:
  ```ts
  // preloaded varsa cutoff yoksayılır (preloaded mesajlarda timestamp yok → filter uygulanamaz). Bilinen kabul edilebilir sınır.
  if (preloaded !== null) return preloaded;
  ```
  WhatsApp'ta dedup RPC'si (`process_whatsapp_message_atomic`, son 50 non-system mesaj) her zaman `preloaded` döndürür → **`historyCutoffAt` hiç uygulanmaz** ve işleyicinin istediği **10 mesaj sınırı da yok sayılır** (`process-message.ts:978` `loadHistory(10, …)` → `whatsapp-webhook/adapter.ts:162-166` → 50 mesaj).
- 08:47:45'te rezervasyon tamamlanınca `historyCutoffAt` yazıldı (`state-machine.ts:841`) — amaç eski rezervasyon geçmişinin LLM'e gitmemesi. Ama preloaded yolu bunu atladı. 08:49'da LLM, 08:41'deki **kendi uydurmasını** geçmişte gördü ve birebir kopyaladı (5 satır aynı, yalnız kapanış cümlesi farklı).
- 08:39:47'deki **stale-reset** taze context üretir (`process-message.ts:505` `createInitialContext`) — `historyCutoffAt` yok. Kesim çalışsaydı bile sıfırlama öncesi oturumların geçmişi LLM'e gitmeye devam ederdi. Bu da 08.08 mesajlarının 08:41'de görülmesini açıklıyor.

### 3.4 Uydurma çıktıyı yakalayan denetim yok
LLM sonrası denetimler (`process-message.ts:5731-5735`): `detectEmptyPromise` "rakam içeren cevabı veri sayar" (`response-validator.ts:333-337` `CONCRETE_DATA_RE`) → uydurma liste **geçer**; `validateAIResponse` yalnız sahte-onay kalıplarını arar. Cevaptaki tarih/fiyatı DB ile karşılaştıran bir denetim **yok** (Fable denetimi C1 bulgusu — bu olay onun canlı örneği).

---

## 4. tour-cache değerlendirmesi (bu olayın nedeni değil; risk notu)

- `shared/utils/tour-cache.ts:32` `FRESH_TTL_MS = 5 dk`, `:35` `STALE_TTL_MS = 10 dk` (DB hatasında bayat veri sunma sınırı). `remaining_quota` her istekte DB'den taze hesaplanır (`_refreshQuota`).
- Geçersiz kılma: Realtime (`tours`/`tour_dates` INSERT/UPDATE/DELETE → `invalidateTourCache("realtime")`, `:1-11`, `:155-178`) + panelden HTTP `invalidate-tour-cache` (çağıranlar: `TourFormDialog.tsx`, `ToursList.tsx`, `BulkDateGenerator.tsx`, `BulkTourImport.tsx`, `Admin.tsx`).
- **Çoklu-isolate riski (genel, bu olayda gözlenmedi):** önbellek isolate-içi bellek. HTTP geçersiz kılma isteği yalnız onu karşılayan isolate'i temizler; Realtime aboneliği her isolate'te ayrı kurulur. Abonelik kurulmamış ya da kopmuşsa diğer isolate'ler 5 dakikaya kadar eski veriyle cevap verebilir. Bu olayda üç context'in üçü de güncel veri taşıdığı için **kanıtlanmış etkisi yok**.
- **Edge function logları** (`[tour-cache] HIT/MISS`, `realtimeInvalidations`): CLI v2.98.1'de log komutu yok, Management API erişim token'ı kullanılmadı → **doğrulanmadı**. `system_errors` tablosunda 08:30–09:00 UTC arası kayıt **yok**.

---

## 5. Satır sonu kaybı ("(77 kişilik yer)3) 24.10.2026")

- Bu satır LLM'in ürettiği listede (08:41 / 08:49). Deterministik üreticiler buna dahil değil.
- DB'deki içerikte satır sonları **mevcut**: `"…(77 kişilik yer)\n3) 24.10.2026 …"`.
- Gönderim yolu satır sonlarına dokunmuyor: `whatsapp-webhook/adapter.ts:186-190` → `truncateForWhatsApp` (`utils/format.ts:405-411`) yalnız 1600 karakteri aşınca kırpar (mesaj ~330 karakter).
- Panel satır sonlarını koruyor: `WhatsAppConversations.tsx:636` `whitespace-pre-wrap`.
- Sonuç: kayıp ne DB'de, ne gönderimde, ne panelde yeniden üretilebildi. Kopyalama veya cihaz görünümü kaynaklı olabilir — **doğrulanmadı**. (Hangi ekrandan alındığı bilinirse kontrol edilebilir.)

---

## 6. Önerilen kök düzeltmeler (yama değil) ve etkisi

| # | Kök | Öneri | Etki |
|---|---|---|---|
| K1 | LLM tarih/fiyat uyduruyor ve bunu yakalayan bir denetim yok (§3.4) | **LLM sonrası sayısal muhafız (denetim C1):** cevaptaki her `DD.MM.YYYY` tarihi ve `N₺` fiyatı ilgili turun güncel `dates` kümesinde olmalı. Değilse cevap düşürülür ve aynı turn deterministik `buildDateList` listesiyle (ya da adım sorusuyla) değiştirilir. Tarih içeren LLM cevabı yalnız DB'deki tarihleri içeriyorsa geçer. | Bu olayın iki yanlış mesajı da engellenirdi. Tüm diller ve tüm turlar için geçerli. |
| K2 | Tur seçilip tarih istendiğinde deterministik liste tetiklenmiyor (§3.1) | `:11` tetikleyicisi "tur bu turn'de seçildi + niyet tour_search / 'görmek istiyorum'" durumunu da kapsasın — liste LLM'e hiç bırakılmasın. Ayrıca `tones/tr.ts:15` "Şu tarihlerde yerimiz var" örneği ve diğer dillerdeki eşleri kaldırılsın (yasakla çelişiyor). | En sık yolu baştan deterministik yapar; K1 güvenlik ağı olarak kalır. |
| K3 | WhatsApp'ta geçmiş kesimi ve 10 mesaj sınırı yok sayılıyor (§3.3) | Dedup RPC'si `created_at` döndürsün ya da `since` parametresi alsın. `getConversationHistory` preloaded geçmişe de `since` ve `limit` uygulasın. Stale-reset taze context'e `historyCutoffAt = şimdi` yazsın. | LLM eski oturumların ve kendi eski uydurmalarının yeniden kullanımını görmez; prompt küçülür. RPC değişikliği **migration gerektirir**. |
| K4 | Panel düzenlemesinin zamanı bilinemiyor (§1) | `tours` / `tour_dates`'e `updated_at` + tetikleyici (geriye uyumlu migration). | Bu tür teşhislerde "veri ne zaman değişti" sorusu cevaplanabilir. |
| K5 | Çoklu-isolate önbellek tutarlılığı (§4, gözlenmedi) | Önbelleğe sürüm damgası (ör. tur başına son değişiklik zamanı) ekleyip her istekte ucuz bir karşılaştırma yapmak; ya da yazım sonrası bütün isolate'lere Realtime yayını. | Olası "5 dakika eski veri" penceresini kapatır. Bu olayın nedeni değil, öncelik düşük. |

**Önerilen sıra:** K1 + K2 (doğrudan bu olay) → K3 (geçmiş sızıntısı; migration) → K4 → K5.

---

## 7. Sade özet
Müşteriye gösterilen eski Kapadokya tarihleri ve 1.500₺ fiyatı veritabanından ya da önbellekten gelmedi. Bot'un elindeki veri o anda da doğruydu, ama iki mesajı yapay zekâ kendisi yazdı ve aylar önceki eski bir konuşmadan kalan fiyat ve tarih biçimiyle uydurdu; ikinci seferde kendi ilk uydurmasını kopyaladı. Kalıcı çözüm, tarih listelerinin her zaman sistemden gelmesi, yapay zekânın yazdığı tarih ve fiyatların gönderilmeden önce veritabanıyla karşılaştırılması ve eski konuşmaların yapay zekâya gösterilmemesi.
