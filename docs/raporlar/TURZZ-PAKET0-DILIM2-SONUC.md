# PAKET-0 · Dilim 2 — B1 (tek tur-dönüştürücü) + B2 (dolu tarih isFull) — Sonuç Raporu

**Tarih:** 2026-10-08 · **Kaynak:** `docs/raporlar/TURZZ-FABLE-DENETIM.md` §8 Grup B · **Uygulayan model:** Opus 5.5 (Fable incelemesine girecek) · **Kapsam:** yalnız B1 + B2; diğer gruplara dokunulmadı (kapsam dışı görülenler §7 "Gözlemler") · **Commit:** `8b3318d` + `c906dbb` · **Push: yapıldı · Deploy: yapıldı** (demo-chat v272, whatsapp-webhook v293 — §7d).

---

## 1. KARAR GEREKLİ (kod yazılmadan önce işaretlendi; en güvenli seçenek uygulandı)

| # | Karar | Uygulanan (en güvenli) | Alternatif |
|---|---|---|---|
| K1 | Dolu tarih listede numaralı mı? | **Numarasız + etiketli** (`• 20.12.2026 (Pazar) (DOLU)`); numaralandırma ve `listedDateIds` **yalnız müsait** tarihleri kapsar; liste yokken global numara da yalnız müsaitleri sayar. "2" hiçbir koşulda dolu tarihe düşemez. | Numaralı + seçilince "dolu" mesajı |
| K2 | Tüm tarihleri dolu olan TUR katalogda görünsün mü? | **Gizli kalır** (eski davranış). Tur seviyesinde filtre: en az bir müsait, geçmemiş tarihi olmayan tur `toBotTours` çıktısına girmez. | "Tamamen dolu" etiketiyle göster (O6/B-DUR/X8/B-TEMA listeleri ve "aktif tur yok" mesajı etkilenir — ayrı ürün kararı) |
| K3 | "Müsait tarihler" başlıklı alternatif listeler dolu tarihi göstersin mi? | **Göstermez** (H-β, H-pax, QUOTA_EXCEEDED, L3 — zaten `hasQuotaForPax` ile filtreli, başlık "müsait" diyor). Dolu satır yalnız tam tarih listesinde (:11, 17-BV) ve gün/yan-niyet listelerinde (:10f, 9b-A) görünür. | Her listede etiketli göster |

---

## 2. Yapılanlar

### B1 — Tek dönüştürücü `toBotTours(raw, lang, today)` (`shared/services/bot-tour.ts`)
- **Beyaz-liste kaldırıldı:** ham satırın **tüm kolonları** taşınır (`...tour`). Yalnız `title`/`destination`/`program_kisa` dile göre `pickLocalized` ile değiştirilir; TR asılları `title_tr`/`destination_tr`. Yeni bir DB kolonu eklendiğinde bot onu otomatik görür.
- Tek tip **`BotTour` / `BotTourDate`** arayüzü (bilinen alanlar adlı; diğer kolonlar index-signature ile taşınır).
- `whatsapp-webhook/index.ts` ve `demo-chat/index.ts`'teki 25'er satırlık elle kopyalar **silindi**; ikisi de tek satır `toBotTours(toursRaw, _prelimLang, today)` çağırır. Artık kullanılmayan `pickLocalized` import'ları kaldırıldı.
- Sonuç: `visa_notes`, `visa_required`, `hotel_name`, `hotel_stars`, `min_pax`, `program_url`, `tur_kategorisi` ve tüm `*_xx` dil kolonları handler'a ulaşır → :10c vize dalı notu/zorunluluğu görür, B-ATTR `min_pax` çalışır, `formatTourDetails` otel/vize alanlarını doldurur.

### B2 — Dolu tarih silinmez, `isFull` işaretlenir
- `toBotTours`: geçmiş tarihler atılır, **dolu tarihler kalır**, her tarihe `isFull = getQuotaRemaining(d) <= 0`.
- `buildDateList` (Dilim-1 primitifi): dolu tarih `• <tarih> (DOLU)` numarasız, `listedDateIds`'e girmez (K1). `resolveListedDate` global fallback'i yalnız müsait tarihleri sayar; hepsi dolu liste → `listedDateIds=[]` (numara hiçbir şey seçmez). Yeni tek-kaynak `isFullDate(d)`.
- **Seçim yolları denetlendi** (dolu tarih hiçbirinden seçilemez):

| Yol | Dosya | Dolu tarihe karşı |
|---|---|---|
| Blok 8 numara | info-extractor (`resolveListedDate`) | listedDateIds / global yalnız müsait |
| Blok 8.5 gün-ordinal "20'si" | info-extractor | seçim **müsait eşleşmeler** üzerinden; tek dolu eşleşme → `dateRejectedFull` (H-β) |
| Blok 9 yazıyla tarih | info-extractor | önceden de `hasQuotaForPax` → `dateRejectedFull`; **`index_` ("ikinci tarih") artık `resolveListedDate`** (eskiden global `dates[idx]` — dolu tarihi sayardı) |
| Blok 9c "ayın 20" | info-extractor | 8.5 ile aynı kural |
| Blok 9d "yarın" | info-extractor | dolu → `dateRejectedFull` (eskiden "tarih yok" sanılırdı) |
| Blok 10 tek-tarih oto-atama | info-extractor | "tek **seçilebilir** tarih"; **bu turn'de dolu tarih reddedildiyse atama YOK** (bkz. §4.4 regresyon); tek tarihli tur sonradan dolduysa eski `dateRejectedFull` korunur |
| 9b-A telefon-adımı tarih yan-niyeti | process-message | eşleşme yalnız müsait tarihlerde |
| :10g öneri/anafora | process-message | `_pDates` yalnız müsait ("tam 2 tarih" sayımı dahil) |
| X8 en ucuz/pahalı | process-message | dolu tarih fiyatı hesaba girmez |
| CONFIRMING'de seçili tarih sonradan doldu | process-message L3 (değişmedi) | `_quotaFull` dalı artık **canlıda ulaşılabilir** → RPC'den önce yakalar |
| RPC | `create_reservation_with_quota_check` (değişmedi) | son sigorta |

- **:10e "20'si müsait mi?"**: tarih var ama dolu → artık **"Maalesef 20.12.2026 (Pazar) (DOLU) — bu tarihte yer kalmadı"** (7 dil); eskiden "ayın 20'i için müsaitlik görünmüyor" (yanlış bilgi: tarih vardı).

### Suite muhafızı ("PAKET-0 D2", 30 assertion)
- **(a) DB kolonu → BotTour:** `supabase/migrations/*.sql`'den `CREATE TABLE tours` + `ALTER TABLE tours ADD COLUMN` **otomatik çıkarılır** (40 kolon; elle liste yok), her kolon sentinel değerle `toBotTours`'tan geçirilir → **eksik: yok**. Lokalizasyon (en → `title_en`/`destination_en`/`program_kisa_en`) ayrıca doğrulanır.
- **(b) Statik:** iki giriş noktasında `toBotTours(toursRaw,` var; `toplanma_saati: tour.` / `pickLocalized(tour,` / `title_tr: tour.` (elle mapping) **yok**; `remaining_quota > 0` filtresi **yok**.
- **(c) Davranışsal:** geçmiş atılır/dolu kalır/`isFull`; yalnız-dolu tur gizli (K2); 7 dilde `1) müsait / • dolu / 2) müsait` + `listedDateIds=[a,b]`; yalnız-dolu liste `[]`; global fallback dolu tarihi saymaz.

---

## 3. Değişen dosyalar

| Dosya | Değişiklik |
|---|---|
| `supabase/functions/shared/services/bot-tour.ts` | **yeni** — `toBotTours`, `BotTour`, `BotTourDate` |
| `supabase/functions/whatsapp-webhook/index.ts` | elle tur kopyası (25 satır) → `toBotTours`; `pickLocalized` import silindi |
| `supabase/functions/demo-chat/index.ts` | elle tur kopyası (27 satır) → `toBotTours`; `pickLocalized` import silindi |
| `supabase/functions/shared/services/date-list.ts` | `isFullDate`; `buildDateList` dolu satır numarasız; `resolveListedDate` global yalnız müsait, boş-dizi sözleşmesi |
| `supabase/functions/shared/services/info-extractor.ts` | Blok 8.5/9/9c/9d/10 dolu-tarih kuralları; `index_` → `resolveListedDate` |
| `supabase/functions/shared/handlers/process-message.ts` | :10e dolu cevabı (7 dil); X8 / :10g / 9b-A dolu tarih dışı |
| `supabase/functions/_tests/harness/bot_tour_test.ts` | **yeni** — 32 test (8 senaryo × 4 dil) |
| `scripts/test_behavioral.ts` | +30 assertion "PAKET-0 D2" |
| `docs/ARCHITECTURE_GUARDS.md` | §G18 + başlık |

---

## 4. Kanıtlar (gerçek koşum çıktıları)

**Yöntem:** testler turu **ham DB şeklinde** (`getCachedTours` çıktısı: tüm kolonlar + `dates[].remaining_quota`) üretir ve **gerçek giriş-noktası dönüştürücüsünden** (`toBotTours`) geçirip handler'a verir. "Önce" koşumu: Adım-1'de iki `index.ts`'teki beyaz-liste **aynen** `toBotTours`'a taşındı (davranış birebir), testler buna karşı koşuldu. "Sonra": Adım-2 kök düzeltme.

### 4.1 Harness — ÖNCE (Adım-1, bugünkü davranış)
```
S5a [tr|en|ru|ar] visa_notes dolu → bot NOTU kullanır ... FAILED ×4
S5b [tr|en|ru|ar] visa_required=true + not boş → "vize gerekli" ... FAILED ×4
S5c [tr|en|ru|ar] visa_required=false + not boş → jenerik ("gerekmez" DENMEZ) ... ok ×4      ← regresyon muhafızı
MINPAX [tr|en|ru|ar] min_pax=4 turda B-ATTR doğru cevap ... FAILED ×4
DOLU-a [tr|en|ru|ar] :11 listesi dolu tarihi etiketli+numarasız, "2" müsait 2. ... FAILED ×4
DOLU-b [tr|en|ru|ar] "20'si müsait mi?" → dolu olarak cevaplanır ... FAILED ×4
DOLU-c [tr|en|ru|ar] dolu tarih yazıyla seçilmeye çalışılınca rezervasyon oluşmaz ... ok ×4   ← regresyon muhafızı
DOLU-d [tr|en|ru|ar] CONFIRMING'de seçili tarih dolmuşsa "evet" → RPC YOK ... ok ×4          ← regresyon muhafızı
error: AssertionError: visa_notes metni cevapta olmalı / tur-özel 'vize gerekli' cevabı / min_pax değeri listelenmeli /
       dolu tarih listede GÖRÜNMELİ / sorulan tarih cevapta adıyla geçmeli
FAILED | 12 passed | 20 failed (1s)
```

### 4.2 Harness — SONRA (tüm harness: Dilim-1'in 20'si + Dilim-2'nin 32'si)
```
ok | 52 passed | 0 failed (2s)
```

### 4.3 Senaryo dökümleri (STATE_OUT + bot cevabı)

**S5a vize notu (önce → sonra):**
```
ÖNCE [tr] 🛂 Vize gereklilikleri kişisel duruma (uyruk, pasaport türü vb.) göre değişebildiği için … acentemizden almanızı rica ederiz. 📞 …
SONRA[tr] 🛂 *Pamukkale Turu* vize bilgisi: ⏎ e-Vize ile giriş; pasaport 6 ay geçerli olmalı. ⏎ Kişisel durumunuza göre gereklilikler değişebilir — … 📞 …
SONRA[en] 🛂 Visa info for *Pamukkale Tour*: ⏎ e-Vize ile giriş; pasaport 6 ay geçerli olmalı. ⏎ Requirements may vary by personal situation — …
SONRA[ru] 🛂 Визовая информация для *Тур в Памуккале*: ⏎ e-Vize ile giriş; pasaport 6 ay geçerli olmalı. ⏎ Требования могут зависеть от личной ситуации — …
SONRA[ar] 🛂 معلومات التأشيرة لـ *جولة باموكالي*: ⏎ e-Vize ile giriş; pasaport 6 ay geçerli olmalı. ⏎ قد تختلف المتطلبات حسب حالتك الشخصية — …
```
**S5b visa_required=true, not boş:** önce jenerik (4 dil) → sonra `🛂 *Pamukkale Turu* için vize gereklidir. Gereklilikler kişisel duruma göre değişebildiği için …` (en "A visa is required…", ru "требуется виза", ar "التأشيرة مطلوبة").
**S5c visa_required=false, not boş:** önce ve sonra jenerik "kişisel duruma (uyruk, pasaport türü vb.) göre…" — "gerekmez" **denmez** (şema eskiden `DEFAULT false` idi; false güvenilmez — denetim §3.1 kuralı korunuyor).

**MINPAX (min_pax=4):**
```
ÖNCE [tr] Bu bilgi turlarımızda henüz tanımlı değil. Acentemiz size yardımcı olabilir: 📞 …      (en/ru/ar aynı anlam)
SONRA[tr] Minimum katılımcı sayımız: ⏎ 1) Pamukkale Turu — 4 kişi ⏎ Hangisi size uygun? 😊
SONRA[en] Our minimum group size: ⏎ 1) Pamukkale Tour — 4 people …
SONRA[ru] Минимальное число участников: ⏎ 1) Тур в Памуккале — 4 чел. …
SONRA[ar] الحد الأدنى للمشاركين: ⏎ 1) جولة باموكالي — 4 أشخاص …
```

**DOLU-a — :11 listesi + "2"** (d1 10.12 müsait, d2 20.12 DOLU, d3 25.12 müsait):
```
ÖNCE [tr] *Pamukkale Turu* için müsait tarihler: ⏎ 1) 10.12.2026 (Perşembe) - 1.000₺ (10 kişilik yer) ⏎ 2) 25.12.2026 (Cuma) - 1.000₺ (8 kişilik yer)   ← 20.12 hiç yok
SONRA[tr] *Pamukkale Turu* için müsait tarihler: ⏎ 1) 10.12.2026 (Perşembe) - 1.000₺ (10 kişilik yer) ⏎ • 20.12.2026 (Pazar) (DOLU) ⏎ 2) 25.12.2026 (Cuma) - 1.000₺ (8 kişilik yer)
          STATE_OUT: step=waiting_for_date listed=["d1","d3"]
SONRA[en] 1) Dec 10, 2026 (Thursday) … ⏎ • Dec 20, 2026 (Sunday) (FULL) ⏎ 2) Dec 25, 2026 (Friday) …
SONRA[ru] 1) 10 дек 2026 (четверг) … ⏎ • 20 дек 2026 (воскресенье) (ПОЛНО) ⏎ 2) 25 дек 2026 (пятница) …
SONRA[ar] 1) 10 ديسمبر 2026 (الخميس) … ⏎ • 20 ديسمبر 2026 (الأحد) (ممتلئ) ⏎ 2) 25 ديسمبر 2026 (الجمعة) …
"2" →  [tr] *25.12.2026* tarihinde *Pamukkale Turu* için rezervasyon başlatıyorum. … Kaç kişi katılacaksınız? 👥   STATE_OUT: dateId=d3
       [en] … on *Dec 25, 2026* … dateId=d3   [ru] … на *25 дек 2026* … dateId=d3   [ar] … في *25 ديسمبر 2026* … dateId=d3
```

**DOLU-b — "20'si müsait mi?":**
```
ÖNCE [tr] Ayın 20'i için şu an müsaitlik görünmüyor. 😔       [en] No availability for the 20th at the moment.   [ru] На 20-е сейчас нет мест.   [ar] لا يوجد توفر لليوم 20 حالياً.
SONRA[tr] Maalesef 20.12.2026 (Pazar) (DOLU) — bu tarihte yer kalmadı. 😔                         STATE_OUT: dateId=undefined
SONRA[en] Sorry, Dec 20, 2026 (Sunday) (FULL) — this date is fully booked. 😔
SONRA[ru] К сожалению, 20 дек 2026 (воскресенье) (ПОЛНО) — на эту дату мест нет. 😔
SONRA[ar] للأسف، 20 ديسمبر 2026 (الأحد) (ممتلئ) — هذا التاريخ محجوز بالكامل. 😔
```

**DOLU-c — dolu tarih yazıyla seçilmeye çalışılınca** (önce de rezervasyon oluşmuyordu; mesaj netleşti):
```
ÖNCE [tr] "20.12.2026 (Pazar)" tarihi bu tur için müsait değil. 😔 ⏎ … müsait tarihler: 1) 10.12 … 2) 25.12 …
SONRA[tr] Maalesef *20.12.2026* dolu. 😔 ⏎ Müsait tarihler: ⏎ 1) 10.12.2026 … ⏎ 2) 25.12.2026 … ⏎ Hangi tarihi tercih edersiniz?
SONRA[en] Sorry, *Dec 20, 2026* is fully booked. 😔 ⏎ Available dates: …
STATE_OUT (4 dil): dateId=undefined · rpcCalls: create_reservation_with_quota_check YOK
```
(Sonra koşumunda H-β dalı devreye girdi — eskiden dolu tarih giriş noktasında silindiği için bu dal **canlıda hiç çalışmıyordu**.)

**DOLU-d — CONFIRMING'de seçili tarih sonradan doldu + "evet":**
```
[tr] Seçtiğiniz tarih artık mevcut değil veya kontenjan dolmuş. *Pamukkale Turu* için müsait tarihler: ⏎ 1) 10.12.2026 … ⏎ 2) 25.12.2026 …
STATE_OUT: step=waiting_for_date dateId=undefined pax=2 listed=["d1","d3"] · RPC çağrısı YOK (4 dil)
```

### 4.4 Suite — eski muhafızın yakaladığı regresyon
İlk Adım-2 koşumunda suite **2 kırmızı** verdi:
```
✗ H.16 KRİTİK: Blok 9 string '15 Aralık' DOLU tarih → dateId yazılmaz
✗ H.18: Blok 10 tek-tarih DOLU → dateAutoAssigned YOK, dateRejectedFull VAR
```
Çözümleme (extractor doğrudan koşturuldu): `{"dateId":"D_OK","sel":"2026-12-21","rej":{"departureDate":"2026-12-15",…},"auto":true}` — Blok 9 dolu 15.12'yi doğru reddetti, ardından Blok 10 "tek seçilebilir tarih" kuralıyla **21.12'yi sessizce atadı** (müşteri 15'ini istedi). Kök düzeltme: Blok 10 `!extractedInfo.dateRejectedFull` şartı + tek tarihli tur sonradan dolduysa eski `dateRejectedFull` yolu. Sonra: 0 kırmızı.

### 4.5 Toplam
```
━━━ Katman-1 suite: scripts/test_behavioral.ts ━━━   1536 ✓ / 0 ✗   (Dilim-1 sonu 1506; +30 PAKET-0 D2)
━━━ Katman-2 harness ━━━                               ok | 52 passed | 0 failed   (Dilim-1: 20 + Dilim-2: 32)
━━━ SONUÇ ━━━  suite=✓  harness=✓                   EXIT=0
```
Tip denetimi: `deno check` (handler + 2 giriş noktası grafiği) HEAD'de 13 hata → değişiklikten sonra **13** (hepsi önceden var: error-sink, rating-words ×4, PromptContext.fx ×2, agencyDescription, X8 `_top.price`, tour-cache ×2, whatsapp-webhook:174/426). Frontend `npm run typecheck` 72 → **72**.

---

## 5. Pre-delete tablosu + net satır farkı

| Silinen | Neden | Yerine |
|---|---|---|
| `whatsapp-webhook/index.ts` elle tur kopyası (25 satır, `pickLocalized` ×3 + 19 alan beyaz-listesi + `remaining_quota > 0` filtresi) | 6+ DB alanını düşürüyordu (B1), dolu tarihi siliyordu (B2) | `toBotTours(toursRaw, _prelimLang, today)` |
| `demo-chat/index.ts` aynı kopya (27 satır) | aynı | aynı |
| iki `index.ts`'te `pickLocalized` import'u | kullanılmıyor | — |
| `buildDateList` her satırı numaralı basma | dolu tarih numaralanırdı | dolu → `•` numarasız, `listedDateIds` dışı |
| `resolveListedDate` global `dates[n-1]` | dolu tarihi sayardı | yalnız müsait tarihler |
| `matchDateWithTourDates` `index_` global `tourDates[idx]` | Blok 8 sözleşmesinin dışındaydı | `resolveListedDate` |
| Blok 10 `currentTour.dates.length === 1` | dolu tarih artık dizide | tek **seçilebilir** tarih + red-sonrası atama yasağı |
| :10e "görünmüyor" dalının dolu-tarih durumu | yanlış bilgi | ayrı "DOLU" cevabı |

**Net satır (prod: `shared` + iki giriş noktası; test/doküman hariç):** +168 / −89 = **+79**. Yorum/boş satırlar hariç **yalnız kod: +115 / −83 = +32**.
**Net-negatif hedefi tutturulamadı.** Dağılım: `bot-tour.ts` 80 satır (çalışan dönüştürücü ~15 satır — silinen 52 satırın yerine; geri kalanı istenen tek tip `BotTour`/`BotTourDate` arayüzü ~35 satır + sözleşme yorumu); :10e 7-dil "dolu" cevabı +17; extractor dolu-tarih kuralları +19. Giriş noktaları tarafı net −47.

---

## 6. Açık kalanlar
- Push ve deploy **yapıldı** (§7d; önceki canlı sürüm demo-chat v271 / whatsapp-webhook v292).
- K1/K2/K3 onaylandı (§7b).
- Harness `--no-check` koşmaya devam ediyor (önceden-var-olan 13 tip hatası; Dilim-1'den devir).

## 7. Gözlemler (kapsam dışı — DÜZELTİLMEDİ)
1. **`createTourRef`** (`services/tour-matching.ts:292`) üçüncü bir beyaz-liste: eşleşen turu context'e yazarken yalnız 9 alan taşıyor. B1'i etkilemiyor çünkü vize/min_pax/otel okuyan dallar turu `findTourById(id, tours)` ile tam listeden tazeliyor; ancak `context.currentTour.dates` **persist edilen bir anlık görüntü** ve Blok 10 bunu okuyor → kontenjan sonradan değişirse bayat olabilir (önceden de vardı).
2. **Çok-dilli alan yok:** `visa_notes`, `hareket_noktasi`, `konaklama`, `ulasim`, `gezilecek_yerler` için `_xx` kolonu yok → EN/RU/AR müşteriye vize notu Türkçe gidiyor (S5a dökümünde görülüyor). Denetim E4/C sınıfı.
3. **:10e cevabı waiting_for_date'te adım sorusu/liste eklemiyor** (DOLU-b ve eski "görünmüyor" cevabında da) — `constants/step-questions.ts`'te `waiting_for_date` anahtarı yok (yalnız pax/name/phone/email); müşteri "dolu" cevabından sonra alternatif tarih listesi görmüyor.
4. H-pax mesajında "*1 seats*" / "*1 мест*" tekil-çoğul (Dilim-1'den devir).
5. `deno check` grafiğinde `whatsapp-webhook/index.ts:174` (`success` iki kez) ve `:426` (Postgrest builder'da `.catch` yok — K2 `[unavailable]` insert'i hata verirse yakalanmaz) — önceden var.

---

## 7b. Kararlar (ürün sahibi, 2026-10-08)
- §1 K1/K2/K3 **onaylandı** (uygulanan hâliyle).
- §7 Gözlem 2 (vize notu çevirisi) ve Gözlem 1 (`createTourRef` kopyası): bu dilimde **dokunulmadı** (talimat).

## 7c. Son düzeltme — tarih adımında dolu tarih sorusu → müsait liste (Gözlem 3)

**Bulgu:** tarih adımında dolu tarih iki yoldan gelebiliyor. Düz seçim ("20'si" → Blok 8.5 → H-β) zaten "dolu + numaralı müsait liste" veriyordu; **müsaitlik sorusu** ("20'si müsait mi?" → :10e) yalnız "dolu" deyip bırakıyordu (liste yok, `listedDateIds` yok → "2" yazılsa global sıraya düşerdi).

**Düzeltme (yeni dal/metin YOK):**
- H-β'nın mevcut 7-dil "Müsait tarihler: … / Hangi tarihi tercih edersiniz?" metinleri **birebir** tek kaynağa (`_AVAIL_DATES_TXT` + `_availDatesBlock`) taşındı; H-β artık onu çağırıyor (çıktısı değişmedi — DOLU-c/DOLU-e "seçim" testleri önce ve sonra yeşil).
- :10e: `waiting_for_date` adımında sorulan gün müsait değilse (dolu ya da yok) aynı blok eklenir; liste mevcut `_buildAvailableDatesText` → `buildDateList` (lokalize tarih, yalnız müsait, `listedDateIds` yazılır). Müsait tarih yoksa mevcut cevap aynen. Diğer adımlarda (ör. pax adımında "20'si de müsait mi") davranış değişmedi.

**Harness — ÖNCE (`--filter DOLU-e`):**
```
DOLU-e [tr|en|ru|ar] tarih adımı "seçim": dolu 20'si → "dolu" + numaralı müsait liste → "2" ... ok ×4     ← H-β zaten doğru
DOLU-e [tr|en|ru|ar] tarih adımı "soru":  dolu 20'si → "dolu" + numaralı müsait liste → "2" ... FAILED ×4
FAILED | 4 passed | 4 failed
### DOLU-e1 [tr] soru "20'si müsait mi?"   BOT: Maalesef 20.12.2026 (Pazar) (DOLU) — bu tarihte yer kalmadı. 😔                 listed=undefined
### DOLU-e1 [en] soru "is the 20 available?" BOT: Sorry, Dec 20, 2026 (Sunday) (FULL) — this date is fully booked. 😔          listed=undefined
### DOLU-e1 [ru] / [ar] — aynı: liste yok, listed=undefined
```
**Harness — SONRA:**
```
### DOLU-e1 [tr] soru "20'si müsait mi?"
BOT      : Maalesef 20.12.2026 (Pazar) (DOLU) — bu tarihte yer kalmadı. 😔 ⏎ Müsait tarihler: ⏎ 1) 10.12.2026 (Perşembe) - 1.000₺ (10 kişilik yer) ⏎ 2) 25.12.2026 (Cuma) - 1.000₺ (8 kişilik yer) ⏎ Hangi tarihi tercih edersiniz?
STATE_OUT: step=waiting_for_date dateId=undefined listed=["d1","d3"]
### DOLU-e2 [tr] "2" → *25.12.2026* tarihinde *Pamukkale Turu* için rezervasyon başlatıyorum. … Kaç kişi katılacaksınız? 👥   dateId=d3
### DOLU-e1 [en] … this date is fully booked. 😔 ⏎ Available dates: ⏎ 1) Dec 10, 2026 (Thursday) … ⏎ 2) Dec 25, 2026 (Friday) … ⏎ Which date do you prefer?   listed=["d1","d3"]
### DOLU-e2 [en] "2" → Starting reservation for *Pamukkale Tour* on *Dec 25, 2026*. …   dateId=d3
### DOLU-e1 [ru] … на эту дату мест нет. 😔 ⏎ Доступные даты: ⏎ 1) 10 дек 2026 (четверг) … ⏎ 2) 25 дек 2026 (пятница) …   listed=["d1","d3"]
### DOLU-e2 [ru] "2" → Начинаю бронирование *Тур в Памуккале* на *25 дек 2026*. …   dateId=d3
### DOLU-e1 [ar] … هذا التاريخ محجوز بالكامل. 😔 ⏎ التواريخ المتاحة: ⏎ 1) 10 ديسمبر 2026 (الخميس) … ⏎ 2) 25 ديسمبر 2026 (الجمعة) …   listed=["d1","d3"]
### DOLU-e2 [ar] "2" → أبدأ حجز *جولة باموكالي* في *25 ديسمبر 2026*. …   dateId=d3
```
**Toplam (`npm test`):** suite **1536 ✓ / 0 ✗**, harness **ok | 60 passed | 0 failed** (Dilim-1 20 + Dilim-2 32 + son düzeltme 8), EXIT=0.

## 7d. Deploy (2026-10-08, ürün sahibi onayı sonrası)

**Ön koşul `npm test`:** suite 1536 ✓ / 0 ✗ · harness ok | 60 passed | 0 failed · EXIT=0.

**Push (origin/main):** `579f1f6..c906dbb`
- `8b3318d` — fix(bot): PAKET-0 Dilim-2 — tek tur-dönüştürücü toBotTours (B1) + dolu tarih isFull (B2)
- `c906dbb` — fix(bot): Dilim-2 son düzeltme — tarih adımında dolu tarih sorusuna müsait liste

**Deploy (`supabase functions deploy`, proje `yaxjygtjtjmzslajuctk`):**
| Fonksiyon | Sonuç | Versiyon | UPDATED_AT (UTC) |
|---|---|---|---|
| `demo-chat` | `Deployed Functions on project yaxjygtjtjmzslajuctk: demo-chat` | **272** | 2026-10-08 06:51:30 |
| `whatsapp-webhook` | `Deployed Functions on project yaxjygtjtjmzslajuctk: whatsapp-webhook` | **293** | 2026-10-08 06:51:37 |

(ikisi de `ACTIVE`; önceki: demo-chat v271, whatsapp-webhook v292)

**Canlı duman testi — demo-chat** (yeni session'lar, anon key; rezervasyon/DB test kaydı YOK):
```
[tr] "merhaba" → HTTP 200 (8822 ms) session=smoke-d2-tr-1791442313658
  response: "Merhaba! 😊 Hoş geldiniz!

Size turlarımız hakkında bilgi vermekten mutluluk duyarım. Hangi destinasyona ilgi duyuyorsunuz? İsterseniz tüm turlarımıza göz atabiliriz! ✨"
  state: stage=BROWSING lang=tr dateId=undefined listed=undefined pendingPax=undefined
[en] "hello" → HTTP 200 (6191 ms) session=smoke-d2-en-1791442326490
  response: "Hi there! 😊 Welcome to Demo Turizm (İzmir)!

I'm here to help you find the perfect tour. We have amazing options including Cappadocia tours, Ephesus, Pamukkale, Aegean coast trips and more!

Which destination interests you, or would you like me to show you our popular tours? ✨"
  state: stage=BROWSING lang=en dateId=undefined listed=undefined pendingPax=undefined
```
İki dilde 200 + normal karşılama; `toBotTours` canlı bundle'da çözüldü (tur listesi EN cevapta görünüyor — Cappadocia/Ephesus/Pamukkale). `whatsapp-webhook`'a canlı mesaj gönderilmedi (gerçek numara gerekir); aynı shared kodu bundle'lıyor, `ACTIVE`.

## 8. Ürün sahibine sade özet
Acentenin panelde girdiği vize notu, vize zorunluluğu, minimum kişi sayısı ve otel bilgisi artık bot'a ulaşıyor; eskiden iki giriş noktası bu alanları yol üstünde düşürüyordu ve bot her vize sorusuna genel bir "acenteye danışın" cevabı veriyordu. Dolu tarihler artık listede "DOLU" etiketiyle numarasız görünüyor, "20'si müsait mi?" sorusuna "dolu" deniyor ve dolu bir tarih hiçbir yoldan seçilemiyor ya da rezerve edilemiyor; bunlar dört dilde gerçek bot koduyla önce kırmızı, sonra yeşil kanıtlandı. Dolu tarihin gösterimine dair üç ürün kararı onaylandı ve değişiklik 8 Ekim 2026'da canlıya alındı (demo-chat v272, whatsapp-webhook v293; canlı duman testi TR/EN 200).
