# PAKET-0 · Dilim 6 — D3 + G1 + C2 (tutar ve özet tutarlılığı) — Sonuç Raporu

> Kapsam: denetim `TURZZ-FABLE-DENETIM.md` D3, G1, C2. E1, C1, G2 ve diğer gruplara dokunulmadı.
> Commit: `418da82` (kod + test). Migration: yok.

---

## 1. D3: tek toplam formülü

**Önce:** `_reservationTotalText` (`process-message.ts:153`) kendi formülünü kullanıyordu: `paxChild × (priceChild || priceAdult)`. Açık `price_child = 0` yetişkin fiyatına dönüyordu. RPC snapshot (`_totalAmountForRpc`) ve kapora (`calculateTotal`, `finance.ts:37`: `priceChild == null ? adult : priceChild`) ise 0'ı "ücretsiz" sayıyordu. Sonuç: aynı rezervasyonda özet **3.000₺**, kayıt ve kapora **2.000** üzerinden.

**Sonra:** `_reservationTotalText` → `calculateTotal(paxAdult, priceAdult, paxChild, priceChild)`. Semantik RPC/kapora ile aynı: `null` → yetişkin fiyatı, `0` → ücretsiz.

**Toplam hesaplayan diğer yerler (grep):**

| Yer | Durum |
|---|---|
| `process-message.ts` completion (`_reservationTotalText`) | Düzeltilen fonksiyondan geçiyor |
| `process-message.ts` RPC `_totalAmountForRpc` | Zaten `calculateTotal` |
| `process-message.ts` kapora (completion + AI-yolu §18) | Zaten `calculateTotal` |
| `process-message.ts` A2 fiyat-sorusu öneki (`price_adult * pax`) | **`calculateTotal(pax, price_adult)`'a bağlandı** (yalnız çocuksuz dalda çalışıyor; sonuç aynı, formül tek) |
| `send-template-message/index.ts:386` | Zaten `calculateTotal` |
| `whatsapp-webhook/services/intelligent-handler.ts:31` | Ölü kod (Dilim-5 Gözlem G2): index'ten erişilmiyor, dokunulmadı |

## 2. G1: tek özet builder

**Önce:** 6 etiket tablosu kopyası vardı: `_CONFIRM_LABELS`, `_labelsA2`, `_labelsA3`, :13 `_labels`, :13-PERSIST `_labels`, FIX3 `_fix3Labels`. Özet de 4 ayrı yerde elle kuruluyordu. A2/A3 özetlerinde **💰 Toplam yoktu**. 17-BV yedek özeti `formatReservationSummary` ile kuruluyordu (yalnız TR/EN, 💰 yok).

**Sonra:**
- **Tek tablo `_CONFIRM_LABELS`:** etiketler + dört soru metni. 7 dil metinleri birebir taşındı:
  - `reask`: DAL1 / pendingFieldUpdateConfirm
  - `confirm`: A2/A3
  - `confirmYes`: :13 ve 17-BV
  - `persist`: :13-PERSIST ve FIX3
- **Tek builder `_buildUpdatedSummary`:** her özette 💰 Toplam bu fonksiyondan, `calculateTotal` ile hesaplanıyor. İnce sarmalayıcı `_summaryWithAsk(info, tour, lang, …, ask)` özet + soruyu birleştiriyor.
- **Builder'ı çağıran yerler:** A2, A3 (`_buildA3Reply` async oldu; 4 çağrı `await`), :13, :13-SUM (zaten çağırıyordu), :13-PERSIST, FIX3, DAL1, pendingFieldUpdateConfirm ve 17-BV.
- **Silinenler:** 5 kopya tablo, 4 elle kurulan özet bloğu, 17-BV'nin kendi 7-dil soru tablosu. `formatReservationSummary` importu process-message'tan kalktı.

### KARAR GEREKLİ (en güvenli seçenek uygulandı)

| # | Karar | Uygulanan | Neden |
|---|---|---|---|
| K1 | 17-BV soru metni de/fr/es/ru/ar'da :13'ten biraz farklıydı ("Sind **diese** Angaben… Antworten Sie **mit** *ja*", "Всё верно?") | :13'ün metni (`confirmYes`) kullanıldı; TR/EN zaten birebir aynıydı | Aynı anlam, tek kaynak. Yalnız nadir 17-BV yedek yolunda görünür |
| K2 | `response-validator.ts` `validateFieldReask` CONFIRMING yedeği `formatReservationSummary` kullanıyor (TR/EN, 💰 yok) | **Dokunulmadı** | fsm katmanında, senkron (builder async: kur), ve suite'te 10+ test çıktı biçimine bağlı. Builder'a bağlamak imza değişikliği ister; ayrı iş |
| K3 | Tarih satırı: builder tarih yoksa "📅 Tarih: henüz seçilmedi" basar, eski kopyalar satırı atlıyordu | Builder davranışı | Bağlanan dallarda tarih zaten dolu (CONFIRMING / tüm alanlar dolu); fark yalnız tarihsiz CONFIRMING gibi olmaması gereken durumda görünür |

### Gözlem: A2/A3 hangi durumda özet basıyor
CONFIRMING'de "aslında 3 kişiyiz" gibi değişiklik kelimesi + yeni değer içeren mesajları A2/A3'ten **önce** PAKET-B DAL1 yakalıyor. Bunun nedeni `_l2CorrectionSignal`'in `CHANGE_KEYWORDS_RE`'yi içermesi; DAL1 özeti zaten 💰'lıydı. A2/A3'ün özet dalı, tüm alanlar doluyken stage COLLECTING_INFO olduğunda çalışıyor (change_info geçişi sonrası; response-validator'daki "BUG D REVİZE-2" durumu). Harness iki stage'i de ölçüyor (§4).

## 3. C2: para birimi

Denetimin işaret ettiği 17-BV satırı (`${d.price_adult}₺`) Dilim-1'de `buildDateList`'e bağlanmıştı. Handler/servislerdeki deterministik tur listeleri zaten `formatPriceSync` kullanıyor. Taramada kalan sabit literaller:

| Yer | Durum |
|---|---|
| `prompts/helpers.ts` `formatToursList` (4 ton: standart `${price}₺`, kurumsal `price + " TRY"`, dinamik `${price}₺`, premium `price + " TRY"`) | **`_listPrice` → `formatPriceSync(price, tour.currency, lang, null, false)`**. LLM prompt'una giden tur listesi EUR turu "250₺" diye veriyordu |
| `prompts/helpers.ts` `formatTourDetails` fx'siz yedeği `${amount}₺` | **`_listPrice`** |
| `process-message.ts` bütçe yankısı (`5000₺ altı` / `under 5000 TRY`, 3 satır) | **KARAR GEREKLİ → `C2-MUAF`**: müşterinin yazdığı bütçe sayısının yankısı, tur fiyatı değil. Girdinin para birimi denetim D1'in konusu; `formatPriceSync`'e bağlamak TRY varsayımını gizlerdi. Satırlar işaretlendi, gerekçe yorumda |

**Statik muhafız (suite D6.C2):** `shared/handlers`, `shared/services` ve `shared/fsm/prompts` (+ alt dizinler, 38 dosya). Yorum satırları ve `C2-MUAF` işaretli satırlar hariç, aşağıdaki kalıplar kırmızı:
- `}` sonrası `₺` veya `TRY`
- `+ "₺"` / `+ " TRY"` birleştirmesi

`formatPriceSync`'in kendisi `utils/`'te, kapsam dışı. Kullanıcının istediği iki dizin + prompt dizini taranıyor: EUR kanıtının listeleri orada.

---

## 4. Kanıt (gerçek koşum)

Harness: `supabase/functions/_tests/harness/summary_total_test.ts`, 40 senaryo, TR/EN/RU/AR. Acente tek para birimi (`show_multi_currency:false`), böylece tutar metni deterministik. Ödeme talimatı %50 kapora + havale (`runTurn`'e `paymentInstructions` parametresi eklendi).

- **T:** `price_child = 0` ve `null`, 2 yetişkin + 1 çocuk, birim 1.000₺. Akış: telefon → :13 özet → "evet" → completion. Ölçülenler: özet 💰, completion "• Toplam", RPC `p_total_amount`, kapora ve kalan (kapora + kalan = toplam).
- **G:** A2 (pax 2→3) ve A3 (isim, telefon), hem COLLECTING_INFO-tüm-alanlar-dolu (A2/A3 dalı, önek kontrolüyle) hem CONFIRMING. Güncel özette 💰 doğru tutar.
- **E:** EUR turu (250€). Prompt tur listesi 4 tonda "250€", ₺/TRY yok; tur detayı ₺'siz; CONFIRMING özeti "500€".

### 4.1 Önce: kırmızı (`git stash` ile kod HEAD'e alınıp aynı test koşuldu)
```
FAILED | 20 passed | 20 failed
T  price_child=0 ×4          FAILED — "özet 💰 = 2000 (bulunan 3000)"
G  COLLECTING_INFO (A2/A3) ×12 FAILED — "güncel toplam 3 × 1.000" / "Values are not equal" (💰 satırı yok)
E  prompt listesi ×4          FAILED — "standart: 250€ olmalı → … 💰 250₺"
geçen 20: T price_child=null ×4 (iki formül null'da aynı), G CONFIRMING ×12 (DAL1 zaten 💰'lı), E özet ×4
```
```
T1 [tr] price_child=0 (ÖNCE)
  BOT: 📋 Tur: *Pamukkale Turu* ⏎ 📅 Tarih: 10.03.2027 ⏎ 👥 Kişi sayısı: 2 yetişkin, 1 çocuk ⏎ 👤 Ad-Soyad: Ali Veli ⏎ 📱 Telefon: 05321234567
       ⏎ 💰 Toplam: *3.000₺* ⏎ ⏎ Bilgiler doğru mu? Onaylıyorsanız *evet* yazın ✅          ← RPC/kapora 2.000
G-A2 [tr/COLLECTING_INFO] (ÖNCE)
  BOT: *Kişi sayısını* 2 → 3 olarak güncelledim. ✨ ⏎ ⏎ 📋 Tur: … ⏎ 👥 Kişi sayısı: 3 ⏎ 👤 … ⏎ 📱 … ⏎ ⏎ Bilgiler doğru mu, onaylıyor musunuz? ✅   ← 💰 YOK
```

### 4.2 Sonra: yeşil
```
ok | 40 passed | 0 failed
```
```
T1 [tr] price_child=0  → 💰 Toplam: *2.000₺*  ⏎ Bilgiler doğru mu? Onaylıyorsanız *evet* yazın ✅
T2 [tr] price_child=0 "evet" → ✅ *Rezervasyonunuz onaylandı, Ali Veli!* 🎉 … • *Kişi:* 2 yetişkin, 1 çocuk … • *Toplam:* 2.000₺
       💳 ÖDEME BİLGİLERİ ⏎ Kapora (%50) ⏎ Kapora Tutarı: 1.000₺ ⏎ Kalan Tutar: 1.000₺ (Tur gününde)      RPC p_total_amount = 2000
T2 [ar] price_child=0 "نعم" → • *الإجمالي:* 2.000₺ … مبلغ الوديعة: 1.000₺ ⏎ المتبقي: 1.000₺
T  price_child=null ×4 → özet = completion = RPC = 3000, kapora 1.500 + kalan 1.500
G-A2 [tr/COLLECTING_INFO] → *Kişi sayısını* 2 → 3 olarak güncelledim. ✨ ⏎ ⏎ 📋 … ⏎ 👥 Kişi sayısı: 3 ⏎ … ⏎ 💰 Toplam: *3.000₺* ⏎ ⏎ Bilgiler doğru mu, onaylıyor musunuz? ✅
G-A3 isim/telefon [tr/COLLECTING_INFO] → *Ad-Soyadı* / *Telefonu* … ⏎ 💰 Toplam: *2.000₺*
E  → standart "💰 250€", kurumsal "Fiyat/Price: 250€", dinamik "💎 250€", premium "| 250€ |"; özet "💰 … *500€*"
```

### 4.3 Suite muhafızları ("PAKET-0 Dilim-6", 10 ✓; HEAD'e karşı 10 ✗)
```
✓ D6.D3 _reservationTotalText calculateTotal cagiriyor
✓ D6.D3 handlers/services'te kendi toplam formulu YOK        (HEAD: bulunan process-message.ts)
✓ D6.G1 ozet etiket tablosu TEK (bulunan 1)                   (HEAD: 6)
✓ D6.G1 kopya tablo adlari yok
✓ D6.G1 ozet 💰 satiri yalniz builder'da (bulunan 1)           (HEAD: 4)
✓ D6.G1 _summaryWithAsk "confirm" / "confirmYes" / "persist" / "reask" kullaniliyor
✓ D6.C2 38 dosyada fiyat yaninda sabit ₺/TRY literal'i YOK    (HEAD: process-message.ts:1474,1476,1477, prompts/helpers.ts:61,92,94,115,117,…)
```

### 4.4 `npm test` (tümü)
```
DAVRANIŞSAL TESTLER: 596/596 · suite toplam 1592 ✓ / 0 ✗ (önce 1582; +10 D6)
harness ok | 128 passed | 0 failed (önce 88; +40)
webhook ok | 20 passed | 0 failed
━━━ SONUÇ ━━━  suite=✓  harness=✓  webhook=✓   EXIT=0
```
Tip denetimi (`deno check` webhook + demo): 12 hata = taban çizgisi. process-message'taki tek hata önceden vardı (`:1240`, üstteki tablo genişlediği için artık `:1261`).

---

## 5. Pre-delete tablosu + net satır

| Silinen | Neden | Yerine |
|---|---|---|
| `_reservationTotalText` içindeki `paxChild × (priceChild \|\| priceAdult)` formülü | Açık 0'ı yetişkin fiyatına çeviriyordu; RPC/kapora ile çelişki (D3) | `calculateTotal(...)` |
| A2 `_labelsA2` (9 satır) + elle özet (15 satır) | Kopya; 💰 yoktu | `_summaryWithAsk(..., "confirm")` |
| A3 `_labelsA3` (9 satır) + `_buildA3Reply` içi elle özet (15 satır) | Kopya; 💰 yoktu | `_summaryWithAsk(..., "confirm")` |
| :13 `_labels` + pax/toplam/özet kurulumu (~50 satır) | Kopya | `_summaryWithAsk(..., "confirmYes")` |
| :13-PERSIST `_labels` + kurulum (~45 satır) | Kopya | `_summaryWithAsk(..., "persist")` |
| FIX3 `_fix3Labels` + kurulum (~38 satır) | Kopya | `_summaryWithAsk(..., "persist")` |
| 17-BV `formatReservationSummary` + `_confirmQ` 7-dil tablosu (12 satır) | TR/EN-only özet, 💰 yok, soru kopyası | `_summaryWithAsk(..., "confirmYes")` |
| DAL1 + pendingFieldUpdateConfirm'deki iki satırlık özet+soru birleştirme | Tekrar | `_summaryWithAsk(..., "reask")` |
| `helpers.ts` 4 liste fonksiyonunda + `formatTourDetails` yedeğinde sabit `₺`/` TRY` | Para birimini yok sayıyordu (C2) | `_listPrice` → `formatPriceSync` |
| `import { formatReservationSummary }` (process-message) | Kullanılmıyor | — |

**Net satır (`git diff --numstat 3a198e8 418da82`):**
- Üretim kodu: `process-message.ts` +67 / −244, `helpers.ts` +17 / −8 → **+84 / −252 = net −168**.
- Test/muhafız: harness +3/−1, yeni test dosyası +144, suite +47. Doküman: ARCHITECTURE_GUARDS §G21.
- Toplam (test dahil): +278 / −253 = +25.

---

## 6. Commit / Push / Deploy (2026-10-08)

**Ön koşul `npm test`:** suite 1592 ✓ / 0 ✗ · harness 128 passed · webhook 20 passed · EXIT=0.

**Push (origin/main):** `3a198e8..418da82`: `418da82` fix(bot): PAKET-0 Dilim-6: tek toplam formülü + tek özet builder + ₺ literal yasağı

**Migration:** yok.

**Deploy (`supabase functions deploy`, proje `yaxjygtjtjmzslajuctk`):**

| Fonksiyon | Sonuç | Versiyon | UPDATED_AT (UTC) |
|---|---|---|---|
| `whatsapp-webhook` | `Deployed Functions.` | **298** | 2026-10-08 11:05:36 |
| `demo-chat` | `Deployed Functions.` | **277** | 2026-10-08 11:05:44 |

İkisi de **ACTIVE** (önceki: whatsapp-webhook v297, demo-chat v276).

**Canlı duman: demo-chat, TR "merhaba"** (yeni session, anon key; rezervasyon/DB test kaydı YOK):
```
[tr] "merhaba" → HTTP 200 (9311 ms) session=smoke-d6-tr-1791457554745
  response: "Merhaba! 😊\n\nSize nasıl yardımcı olabilirim? Hangi destinasyona ilgi duyuyorsunuz?\n\n• 🗺️ Ege Turu\n• 🗺️ Kapadokya Kültür Turu\n• 🗺️ Pamukkale Turu\n• 🗺️ Antalya Rafting\n• 🗺️ Efes Antik Kent Turu\n• 🗺️ Kapadokya Balon Turu\n\nHangi tur ilginizi çekiyor? ✨"
  state: stage=BROWSING lang=tr dateId=undefined listed=undefined pendingPax=undefined
```
whatsapp-webhook'a canlı mesaj gönderilmedi; deploy hatasız, ACTIVE.

---

## 7. Sade özet

Çocuk fiyatı "0" (ücretsiz) girilen turlarda müşteriye gösterilen toplam ile kaydedilen tutar ve kapora artık aynı; eskiden özet çocuğu yetişkin fiyatından sayıp fazla tutar gösteriyordu. Rezervasyon özeti artık tek yerden üretiliyor ve müşteri kişi sayısını, ismini ya da telefonunu düzelttiğinde de güncel toplamı görüyor; bu sırada 168 satır tekrarlanan kod silindi. Euro gibi farklı para birimli turlar yapay zekâya giden listelerde artık ₺ ile değil kendi para birimiyle yazılıyor ve yeni bir test, ileride kodun içine sabit ₺ yazılmasını engelliyor.
