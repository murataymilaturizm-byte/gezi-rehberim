# PAKET-0 · Dilim 8 (son Opus dilimi) — Sonuç Raporu

> Kapsam: (1) suite'teki backspace'li regex + kontrol karakteri muhafızı, (2) F5 `todayIST()`, (3) F4 atomik aylık sayaç, (4) Fable devir belgesi `TURZZ-FABLE-DEVIR.md`.
> Commit: `2055cc7` (kod + test). Migration: yok. Dilim-7 kararları (D1-a, D1-b, E3-a, E3-b): ürün sahibi tarafından **ONAYLANDI**.

---

## 1. `scripts/test_behavioral.ts:6871`: görünmez backspace'li regex

**Bulgu:** `CTA.ALAN` testindeki regex `/\bcta.([a-zA-Z]+)/g` dosyada gerçek `\b` değil, **backspace karakteri (0x08)** içeriyordu. Kalıp hiçbir şeyle eşleşmiyor, `kullanilan` hep boş kalıyor, test her sayfada boşuna geçiyordu.

**Düzeltme:** `/\bcta\.([a-zA-Z]+)/g`. Nokta da kaçışlandı: kalıp "cta + herhangi karakter" değil, `cta.` olmalı.

**Gerçekten eşleşiyor mu, kırmızı çıkan var mı?**
```
                       eski (0x08)   yeni
RehberSozlesmesi            0          4   (endBtn, endDesc, endSecondary, endTitle)
TurKarHesaplayici           0          4
TurSatisSozlesmesi          0          4
TurTeklifi                  0          4
TransferSozlesmesi          0          4
```
Bulunan 20 kullanımın hepsi `src/lib/blog-anatomy.ts` `CtaTexts` arayüzünde geçerli → **kırmızı çıkan yok**, düzeltilecek kod yok.

**Testin bir daha boşa düşmemesi için:** her sayfada "en az bir `cta.<alan>` okundu" şartı eklendi (`CTA.ALAN … okundu (4)` ×5). HEAD'deki hâliyle bu şart kırmızı verirdi (0 eşleşme).

**Suite muhafızı (D8.CTL):** `scripts/`, `supabase/functions/`, `src/` altında 503 kaynak dosya (.ts/.tsx/.js/.mjs/.cjs) taranıyor. Kontrol karakterleri (0x00–0x08, 0x0B, 0x0C, 0x0E–0x1F) **kırmızı**.
- Dedektör öz-testi: backspace'li regex yakalanıyor, normal `\b` metni temiz.
- Muhafızın kendisi karakter sınıfını `String.fromCharCode` ile kuruyor, kendi kaynağına kontrol karakteri yazmıyor.
- Bugün "bulunan: yok". HEAD'de bu tek satır bulunurdu (HEAD suite'inde 1 adet 0x08).
- **KARAR (kapsam):** talimat "regex literal içinde `\x08`" diyordu. Muhafız **her** kontrol karakterini yasaklıyor, çünkü kaynakta meşru kullanımı yok ve aynı araç hatası başka karakter de üretebilir.
- Aynı hata Dilim-7'de `ARCHITECTURE_GUARDS.md` §G22 başlığında da oluşmuş ve düzeltilmişti (`251da64`). Muhafız .md taramıyor; yalnız kod.

## 2. F5: tek `todayIST()`

**Yeni:** `shared/utils/date.ts`: `todayIST(now?)` = `toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" })` → "YYYY-MM-DD".

| Yer | Önce | Sonra |
|---|---|---|
| `whatsapp-webhook/index.ts` `toBotTours(…, today)` | UTC `toISOString().split("T")[0]` | `todayIST()` |
| `demo-chat/index.ts` `toBotTours(…, today)` | UTC | `todayIST()` |
| `process-message.ts` L3 erken revalidation `_today` | UTC `slice(0,10)` | `todayIST()` |
| `process-message.ts` stale hatırlatma + :10g en yakın tarih | satır içi Istanbul (2 kopya) | `todayIST()` |
| `prompts/helpers.ts` LLM "CURRENT DATE" başlığı (+ gün adı) | UTC tarih + makine-yerel gün adı | `todayIST()` + o günün adı |
| `prompts/helpers.ts` tur detayı "ilk tarih" filtresi | UTC | `todayIST()` |

**KARAR (kapsam):** talimat webhook/demo-chat/process-message diyordu. `prompts/helpers.ts` aynı sınıftan (process-message'ın prompt yolu) ve eklendi. Eski başlık İstanbul 01:30'da LLM'e **dünün** tarihini veriyordu; kırmızı kanıtta "Perşembe, 10.03.2027" yazıyordu: tarih UTC, gün adı yerel → kendi içinde de tutarsız.

**Kapsam dışı (raporlandı):**
- `create_reservation_with_quota_check` DB'de tarih kontrolü yapmıyor; geçmiş tarih yalnız bot katmanında engelleniyor (migration ister).
- `simple-extractor` göreceli tarih ("yarın") UTC çapası.

## 3. F4: aylık sayaç tek atomik yol

| Yol | Önce | Sonra |
|---|---|---|
| Hazır cevap (canned) | RPC `increment_agency_message_count` | `incrementMonthlyMessageCount(…, "canned_response")` |
| FAQ (`FAQ_ENABLED=false`, kod duruyor) | `update({ monthly_message_count: _msgCount + 1 })`: okuma-değiştir-yazma | aynı yardımcı (`"faq_response"`) |
| Ana akış | okuma-değiştir-yazma | aynı yardımcı (`"main_flow"`) |

- Yardımcı tek RPC çağrısı (`UPDATE … SET n = n + 1`, Postgres'te atomik). Hata akışı bozmaz, `logCritical(MESSAGE_COUNTER_FAIL)` ile görünür (eski davranış korundu).
- **KARAR (yan kök):** ay sıfırlamasında `_msgCount` sıfırlamadan önce okunuyor ve güncellenmiyordu. Geçen ay limiti dolan acentenin yeni aydaki **ilk** mesajı "limit doldu" diye düşürülüyordu. `let` + `_msgCount = 0` ile düzeltildi.
- **Dokunulmadı (raporlandı):** ay sınırında eşzamanlı iki sıfırlama UPDATE'i, aradaki bir artışı ezebilir. Atomik çözüm (RPC içinde koşullu sıfırlama) migration ister.
- Demo-chat sayaç tutmuyor (yol yok).

---

## 4. Kanıt (gerçek koşum)

**Webhook harness genişletmeleri** (`_tests/webhook/`):
- `db.agencyCount` acentenin DB'deki sayacı. RPC atomik artırıyor; `update({monthly_message_count})` üzerine yazıyor (gerçek DB gibi).
- Acente çözümü o anki DB değerini okuyor.
- Senaryoya `tours` eklendi; `processChatMessage` stub'ı handler'a giden turları kaydediyor.
- `_tests/fake-now.ts` `withFakeNow`: yalnız `Date` değişiyor, zamanlayıcılar gerçek.

### 4.1 Önce: kırmızı (`git stash` ile 4 kod dosyası HEAD'e alındı, aynı testler koşuldu)
```
webhook  F4 eşzamanlı iki mesaj → +2 ............ FAILED  "sayaç 7 → 9 olmalı (bulunan 8)"
webhook  F4 ay sıfırlaması, ilk mesaj işlenir .... FAILED  "limit doldu sayılmamalı — sayaç bu ay 0"
webhook  F5 İstanbul 01:30 tur listesi ........... FAILED  "dünkü tarih listede olmamalı → d-0310,d-0311,d-0312"
harness  F5 [tr|en|ru|ar] dünkü tarih + onay ..... FAILED ×4 "dünkü tura rezervasyon RPC'si çağrılmamalı"
         BOT [tr]: ✅ *Rezervasyonunuz onaylandı, Ali Veli!* 🎉 … • *Tarih:* 10.03.2027 … • *Toplam:* 2.000₺
harness  F5 CURRENT DATE ......................... FAILED  "📅 CURRENT DATE: Perşembe, 10.03.2027"
suite    ✗ D8.F5 ×7 (UTC gün kesiti ×4, satır içi Istanbul ×1, toBotTours(todayIST()) ×2), ✗ D8.F4 ×2
```
Eski kodda İstanbul 01:30'da (UTC 22:30, önceki gün) **dün kalkmış tura rezervasyon onaylanıyordu**.

### 4.2 Sonra: yeşil
```
webhook  ok | 3 passed  (eşzamanlı iki mesaj: sayaç 7 → 9, 2 RPC çağrısı, +1 hesaplı UPDATE yok;
                         ay sıfırlaması: ilk mesaj işlendi, sayaç 1; İstanbul 01:30: handler'a d-0311, d-0312 gitti, d-0310 gitmedi)
harness  ok | 5 passed
  F5 [tr] STATE_IN CONFIRMING dateId=d-0310 + "evet"
          BOT: Seçtiğiniz tarih artık mevcut değil veya kontenjan dolmuş. *Pamukkale Turu* için müsait tarihler: ⏎ 1) 12.03.2027 (Cuma) - 1.000₺ (10 kişilik yer)
          RPC çağrısı yok, dateId temizlendi (en/ru/ar aynı)
  F5 CURRENT DATE → "Perşembe, 11.03.2027"
```

### 4.3 `npm test` (tümü)
```
DAVRANIŞSAL TESTLER: 596/596 · suite toplam 1654 ✓ / 0 ✗ (önce 1631; +18 D8, +5 CTA "okundu")
harness ok | 154 passed | 0 failed (önce 149; +5)
webhook ok | 23 passed | 0 failed (önce 20; +3)
━━━ SONUÇ ━━━  suite=✓  harness=✓  webhook=✓   EXIT=0
```
Tip denetimi: 12 hata = taban çizgisi (dökümü devir belgesi §3.8).

---

## 5. Pre-delete tablosu + net satır

| Silinen / değişen | Neden | Yerine |
|---|---|---|
| Suite regex'teki 0x08 | Görünmez karakter, kalıp ölüydü | `\bcta\.` |
| 3 yerde UTC gün kesiti + 2 yerde satır içi Istanbul hesabı (process-message, webhook, demo-chat) | İki ayrı "bugün" (F5) | `todayIST()` |
| `helpers.ts` `now.toISOString()` tarih + `now.getDay()` gün adı + ilk-tarih UTC filtresi | LLM'e UTC tarih | `todayIST()` |
| Webhook canned try/catch RPC bloğu (14 satır) | Üç yolda üç kopya | `incrementMonthlyMessageCount` |
| Webhook FAQ + ana akış `update({ … _msgCount + 1 })` blokları (2 × 15 satır) | Okuma-değiştir-yazma (F4) | aynı yardımcı |
| `const _msgCount` | Sıfırlamada eski değer kalıyordu | `let` + sıfırlamada 0 |

**Net satır (`git diff --numstat 251da64 2055cc7`):**
- Üretim kodu (webhook, demo-chat, process-message, helpers, date.ts): **+53 / −55 = net −2**.
- Test/muhafız: suite +63/−1, `today_ist_test.ts` +39, `webhook_counter_today_test.ts` +50, `fake-now.ts` +16, webhook stub/harness +21/−9. Doküman: ARCHITECTURE_GUARDS §G23.

## 6. Devir belgesi
`docs/raporlar/TURZZ-FABLE-DEVIR.md`:
- Dilim 2–8 commit + deploy tablosu
- Her dilimin KARAR GEREKLİ kararları, gerekçeleri ve onay durumları
- Fable'a kalan 10 iş başlığı: E1; C1 + response-validator yedek özeti; G2 + rezervasyon sonrası tur geçişi; createTourRef; F3; RU/DE çekimli tur adı; çok dilli vize/kalkış; harness `--no-check` + 12 tip hatası dökümü; E2E ayna emekliliği; diğer açık gözlemler
- Bekleyen 6 canlı WhatsApp testi
- Harness çalışma notları

---

## 7. Commit / Push / Deploy (2026-10-08)

**Ön koşul `npm test`:** suite 1654 ✓ / 0 ✗ · harness 154 · webhook 23 · EXIT=0.

**Push (origin/main):** `251da64..2055cc7`: `2055cc7` fix(bot): PAKET-0 Dilim-8: kontrol karakteri muhafızı + todayIST (F5) + atomik aylık sayaç (F4)

**Migration:** yok.

**Deploy (`supabase functions deploy`, proje `yaxjygtjtjmzslajuctk`):**

| Fonksiyon | Sonuç | Versiyon | UPDATED_AT (UTC) |
|---|---|---|---|
| `whatsapp-webhook` | `Deployed Functions.` | **300** | 2026-10-08 12:37:19 |
| `demo-chat` | `Deployed Functions.` | **279** | 2026-10-08 12:37:30 |

İkisi de **ACTIVE** (önceki: whatsapp-webhook v299, demo-chat v278).

**Canlı duman: demo-chat, TR "merhaba"** (yeni session, anon key; rezervasyon/DB test kaydı YOK):
```
[tr] "merhaba" → HTTP 200 (11412 ms) session=smoke-d8-tr-1791463057622
  response: "Merhaba! 😊\n\nSize nasıl yardımcı olabilirim? İsterseniz popüler turlarımıza göz atabilirsiniz:\n\n• *Ege Turu* - İzmir, Çeşme, Alaçatı (4.500₺)\n• *Kapadokya Kültür Turu* - Göreme, Derinkuyu (2.500₺)\n• *Pamukkale Turu* - Travertenler, Hierapolis (3.500₺)\n• *Antalya Rafting* - Köprülü Kanyon (850₺)\n• *Efes Antik Kent Turu* - Efes, Artemis Tapınağı (900₺)\n• *Kapadokya Balon Turu* - Göreme Vad…"
  state: stage=BROWSING lang=tr dateId=undefined listed=undefined pendingPax=undefined
```
whatsapp-webhook'a canlı mesaj gönderilmedi; deploy hatasız, ACTIVE.

---

## 8. Sade özet

Gece yarısından sonraki ilk üç saatte bot, bir önceki gün kalkmış turları hâlâ listeleyip rezervasyonunu onaylayabiliyordu; artık "bugün" her yerde İstanbul saatine göre hesaplanıyor. Aynı anda gelen mesajlar aylık mesaj sayacını eksik sayıyordu ve ay başında limiti geçen ay dolmuş acentelerin ilk mesajı düşürülüyordu; ikisi de düzeltildi. Bir testin görünmez bir karakter yüzünden hiçbir şeyi kontrol etmeden geçtiği bulundu ve düzeltildi (kontrol ettiği alanların hepsi doğru çıktı); Fable'ın devralacağı işler ve alınan bütün kararlar devir belgesinde toplandı.
