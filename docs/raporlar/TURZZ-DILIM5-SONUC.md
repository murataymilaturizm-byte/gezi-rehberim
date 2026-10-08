# PAKET-0 · Dilim 5 — Tarih listesi LLM'e bırakılmaz + geçmiş filtresi tek kaynak — Sonuç Raporu

> Kapsam: teşhis raporu `TURZZ-CANLI-ESKI-VERI-TESHIS.md` öneri 2 + 3. Öneri 1 (post-LLM sayısal muhafız), 4 ve 5 bu dilimde **yok**.
> Commit: `c901dbd` (teşhis raporu) → `b817045` (Dilim-5 kod + test). Migration: **yok** (§4.4).

---

## 1. Teşhis — 11:41 ve 11:49 (TR saati) hangi dallardan geçti

**Düzeltme (kayıt):** canlı kayıtta 11:40:56'daki mesaj **"Kapadokya turu istiyorum"**; "kapadokya turlarını görmek istiyorum" 11:48:58'deki mesaj. İkisi de aynı delikten geçti; testlerde ikisi ayrı ayrı yeniden üretildi.

NLU sonucu DB'ye yazılmıyor. Aşağıdaki niyetler **çıkarım**: harness'te canlı STATE_OUT'u birebir üreten niyetler bunlar (diğerleri farklı stage'e götürüyor, §1.3).

| | 11:41 "Kapadokya turu istiyorum" | 11:49 "kapadokya turlarını görmek istiyorum" |
|---|---|---|
| STATE_IN | `GREETING`, tur yok (stale-reset sonrası taze context, `process-message.ts:505`) | `COMPLETED` (Pamukkale rez.), `historyCutoffAt=08:47:43Z` |
| NLU (çıkarım) | `tour_search` (veya `browse_tours`, ikisi de aynı sonucu verir) | `browse_tours` |
| Tur eşleştirme | `findMatchingTours` (`tour-matching.ts:362`) → Kapadokya Balon Turu | aynı |
| FSM | GREETING → TOUR_SELECTED | COMPLETED → TOUR_SELECTED, son kural `state-machine.ts:1132` (`browse_tours` bilgilendirme listesinde değil, soru kelimesi yok) |
| `:11` kararı (HEAD `c901dbd`, `process-message.ts:4135-4148`) | (a) COLLECTING_INFO değil ✗ · (b) `DATE_QUERY_RE` eşleşmiyor (tarih kelimesi yok) ✗ · (c) yalnız `reservation_intent`/`tour_selected` ✗ · (d) `_isStuckOnTourSelected` rakam ister ✗ | aynı dört koşul ✗ |
| Sonuç | **LLM** → geçmişteki eski listeyi taklit etti (2026, 1.500₺) | **LLM** → 11:41'deki kendi uydurmasını geçmişten kopyaladı (kesim yok sayıldı, §4) |

### 1.2 Aynı deliğe düşen başka ifadeler (7 dil)

| İfade sınıfı | Örnek | Önce | Sonra |
|---|---|---|---|
| Turu adıyla isteme / görme | "X turunu görmek istiyorum", "X turu istiyorum", "I want (to see) the X tour", "Ich möchte die X-Tour sehen", "Je veux voir…", "Quiero ver…", "хочу (посмотреть) тур X", "أريد (أن أرى) جولة X" | LLM | **buildDateList** — yeni (e) koşulu |
| Tarih sorusu, NLU `faq_general` | "X turu ne zaman?", "When is the X tour?", "Когда тур X?", "متى جولة X؟" | LLM — (b) dalı KÖK-6 guard'ıyla kapanıyordu (`DATE_INTENTS` `general_question`'ı sayıyor ama üst guard aynı intent'i reddediyordu) | **buildDateList** (FAQ intent'inde tur adı bu mesajda geçmek şartıyla) |
| Tarih sorusu, NLU `browse_tours` | "X tarihleri" | LLM — `DATE_INTENTS`'te `browse_tours` yoktu | **buildDateList** |
| AR soru işareti | "متى جولة كابادوكيا؟" | Tur bulunamıyordu (`؟` temizlenmiyordu, `tour-matching.ts:426`) → LLM | **buildDateList** |
| RU hâl eki / DE bileşik | "хочу посмотреть туры **в Каппадокию**", "Kappadokien-**Touren**" | Tur eşleşmiyor; RU'da `"посмотреть" нет в нашей системе` (yanlış "tur yok" cevabı) | **Değişmedi** — tur eşleştirme işi, Gözlem G1 |
| COMPLETED/GREETING'de tur adıyla tarih sorusu (FSM stage değiştirmiyor) | rezervasyon sonrası "Kapadokya turu ne zaman?" | LLM | **Değişmedi** — KARAR GEREKLİ K3 |

---

## 2. Kök düzeltme A — tarih listesi yalnız `buildDateList`

Yeni erken-return dalı **yok**; mevcut `_isUserAskingDates` kararına bağlandı (`process-message.ts:4144-4174`, liste bloğu `:4195`):

- **(e) `_isTourListRequest`** — `TOUR_SELECTED` + tur **bu mesajda** eşleşti ve FSM'in seçtiği tur o (`selectedTour.id === currentTour.id`) + talep fiili (`TOUR_REQUEST_RE`, 7 dil) + bilgi isteği değil (`TOUR_INFO_REQUEST_RE`: bilgi/hakkında/detay/program/anlat, information/about/details, …, 7 dil). Sabitler: `shared/constants/date-detection.ts:26`, `:51`.
- **(b) `_isDateQuestion`** — KÖK-6 guard'ı yalnız (a)'ya ait (orijinal gerekçesi: waiting_for_date'te "iptal şartları"). Bilgi-intent'inde (b) için ek şart: tur adı bu mesajda geçti.
- (c) için KÖK-6 guard'ı aynen korundu; (d) aynen.
- `DATE_INTENTS += "browse_tours"`; `tour-matching.ts:426` noktalama temizliğine Arapça `؟ ،`.

### KARAR GEREKLİ (en güvenli seçenek uygulandı)

| # | Karar | Uygulanan | Neden |
|---|---|---|---|
| K1 | (b) artık FAQ intent'lerinde de çalışıyor — hangi şartla? | Yalnız tur **bu mesajda adıyla** geçtiyse | "İptal ne zamana kadar?" gibi tur-dışı FAQ'nin tarih listesine dönmesini engeller |
| K2 | Bilgi isteği ("Kapadokya turu hakkında bilgi almak istiyorum") | LLM'de kaldı (harness A4 ×4) | Tur anlatımı LLM'in işi; prompt'ta tarih yasağı zaten var |
| K3 | COMPLETED/GREETING'de tur adıyla tarih sorusu (FSM stage'i değiştirmiyor) | **Dokunulmadı** | FSM geçiş kuralı değişikliği gerekir (`state-machine.ts:1132` "switch signal"); bu dilimin kapsamı dışı. LLM'e artık kesim öncesi geçmiş gitmiyor (B), ama cevap LLM'den. Ayrı karar |

---

## 3. Prompt envanteri — tarih yasağıyla çelişen örnekler

Yasak metni: `prompts/stages/index.ts:438` ("⛔ TARİH KONUSUNA GİRME — KESİN YASAK") ve `:452`.

**Değiştirilen 14 örnek satır** (silinmedi, **nötr örnekle değiştirildi**: şablonun kapanış backtick'i son satırda):

| Dosya:satır | Eski | Yeni |
|---|---|---|
| `tones/tr.ts:15` | Tabii ki! Şu tarihlerde yerimiz var: ... | Tabii ki! Bu turla ilgili merak ettiğiniz başka bir şey var mı? |
| `tones/tr.ts:42` | Süper! 🔥 O tarih için yerimiz var! 💫 | Süper! 🔥 Hemen yardımcı oluyorum! 💫 |
| `tones/en.ts:14` | Of course! We have availability on these dates: ... | Of course! Is there anything else you'd like to know about this tour? |
| `tones/en.ts:40` | Awesome! 🔥 We have availability for that date! 💫 | Awesome! 🔥 Happy to help with that! 💫 |
| `lang/de.ts:204` | Gerne! Wir haben Verfügbarkeit an diesen Terminen: ... | Gerne! Möchten Sie noch etwas über diese Tour wissen? |
| `lang/de.ts:230` | Fantastisch! 🔥 Wir haben Verfügbarkeit für dieses Datum! 💫 | Fantastisch! 🔥 Ich helfe Ihnen gerne weiter! 💫 |
| `lang/es.ts:203` | ¡Por supuesto! Tenemos disponibilidad en estas fechas: ... | ¡Por supuesto! ¿Hay algo más que le gustaría saber sobre este tour? |
| `lang/es.ts:229` | ¡Increíble! 🔥 ¡Tenemos disponibilidad para esa fecha! 💫 | ¡Increíble! 🔥 ¡Con gusto le ayudo! 💫 |
| `lang/fr.ts:205` | Bien sûr ! Nous avons des disponibilités à ces dates : ... | Bien sûr ! Souhaitez-vous savoir autre chose sur ce circuit ? |
| `lang/fr.ts:231` | Génial ! 🔥 Nous avons des disponibilités pour cette date ! 💫 | Génial ! 🔥 Je m'en occupe avec plaisir ! 💫 |
| `lang/ru.ts:206` | Конечно! У нас есть места на эти даты: ... | Конечно! Хотите узнать что-нибудь ещё об этом туре? |
| `lang/ru.ts:232` | Круто! 🔥 У нас есть места на эту дату! 💫 | Круто! 🔥 С радостью помогу! 💫 |
| `lang/ar.ts:206` | بكل تأكيد! لدينا أماكن متاحة في هذه التواريخ: ... | بكل تأكيد! هل تود معرفة أي شيء آخر عن هذه الجولة؟ |
| `lang/ar.ts:232` | رائع! 🔥 لدينا أماكن متاحة لذلك التاريخ! 💫 | رائع! 🔥 يسعدني مساعدتك! 💫 |

**Taranıp bırakılanlar (yasakla çelişmiyor):**
- Tarih **biçimi** kuralları: `roles/ar.ts:32`, `roles/de.ts:24`, `roles/fr.ts:27`, `roles/es.ts:33` ("25.12.2026" biçim örneği), `stages/index.ts:354` (gün adını sistemin verdiği listeden kullan). Tarih önermiyor, biçim tarif ediyor.
- `stages/index.ts:452` "Kullanıcı tarih sorarsa 'Müsait tarihleri kontrol ediyorum 📅' de": liste vaat etmiyor ama listenin geleceğini ima ediyor. (b)/(e) genişlediği için bu cümleden sonra liste gelen durum arttı; metne dokunulmadı.
- `process-message.ts` içindeki "disponibilidad"/"tarihlerimiz" geçen metinler **deterministik şablonlar**, prompt değil.

Suite `D5.PROMPT` muhafızı 7 dosyada vaat kalıbını (`yerimiz var|have availability|…|أماكن متاحة`) yasaklar.

---

## 4. Kök düzeltme B — geçmiş filtresi

### 4.1 Tek fonksiyon
`shared/services/context-manager.ts:70` **`loadConversationHistory`** — WhatsApp ve demo-chat adapter'larının `loadHistory`'si yalnız bunu çağırır (`whatsapp-webhook/adapter.ts:162`, `demo-chat/adapter.ts:103`).
- Her zaman **en yeni `limit`** mesaj, ASC, yalnız user/assistant.
- `since` (historyCutoffAt) varsa: **DB sorgusu** (`created_at > since`). Önyüklemede (`process_whatsapp_message_atomic`, son 50, DESC) zaman damgası yok, bu yüzden kesim varken önyükleme kullanılmaz (`:84`).
- `since` yoksa: önyükleme varsa ondan `slice(0, limit)` (ek sorgu yok), yoksa DB.
- Eski `getConversationHistory` (önyüklemede kesim ve limiti yok sayan) silindi.

### 4.2 Yan düzeltme: demo-chat en ESKİ N mesajı alıyordu
Eski demo `loadHistory` `order(ascending:true).limit(10)` ile oturumun **ilk** 10 mesajını LLM'e veriyordu. Tek kaynak en yenileri alıyor (harness B2).

### 4.3 Çift mesaj
WhatsApp güncel mesajı AI'dan önce kaydediyor (`whatsapp-webhook/index.ts:723`). Kesim varken DB'den okunduğunda bu satır geçmişte de görünürdü. `markUserSaved(rawMessage)` içeriği tutuyor; `excludeLatestUser` en yeni satır bu içerikse düşüyor (harness B2 "tekrar etmez").

### 4.4 Kesim yazanlar, migration
- Rezervasyon tamamlanması: mevcut `state-machine.ts:841` (CONFIRMING→COMPLETED), değişmedi.
- **Yeni:** "Tekrar hoş geldiniz" sıfırlaması `process-message.ts:510` `_freshCtx.historyCutoffAt = new Date().toISOString()`.
- **Migration gerekmedi:** `historyCutoffAt` zaten context JSON'unda (`whatsapp_conversations` system satırı / demo'da frontend state); yeni kolon yok.

---

## 5. Kanıt (gerçek koşum)

Harness: `supabase/functions/_tests/harness/history_datelist_test.ts`. **Gerçek** `WhatsAppAdapter` (önyüklü geçmiş = RPC biçimi: son 50, DESC, created_at yok) ve gerçek `DemoChatAdapter`, canlıdaki gibi `whatsapp_conversations` satırları: 08.08 "Müsait turlarımız… Kapadokya Balon Turu — 1.500₺" + "Antalya Rafting… 12.12.2026" listeleri + 20 ara mesaj. Tur verisi canlı DB'nin kopyası (2027: 10/11/12(dolu)/29.07 @1.000₺, 15.09 & 22.12 @1.500₺), `toBotTours` ile.

### 5.1 Önce: kırmızı (kod değişiklikleri `git stash` ile HEAD'e alınıp aynı test koşuldu)
```
FAILED | 5 passed | 23 failed
A1 ×8 (tr/en/ru/ar × istiyorum/görmek)  FAILED  — "LLM çağrılmamalı — liste deterministik"
A2 ×4  FAILED · A3 ×4  FAILED · B1 ×4  FAILED · B2 WhatsApp limit FAILED ("10 mesaj (giden 24)")
B2 demo en-yeni FAILED ("en yeni sonda") · B3 FAILED ("historyCutoffAt yazılmalı (değer: undefined)")
geçen 5 = regresyon bekçisi: A4 bilgi isteği ×4, B2 çift-mesaj
```
Önce dökümü (STATE_IN/BOT/STATE_OUT):
```
A1 [tr/görmek]  STATE_IN : stage=GREETING  → BOT: LLM_CEVABI → STATE_OUT: stage=TOUR_SELECTED listed=undefined
A2 [tr]         STATE_IN : stage=COMPLETED → BOT: LLM_CEVABI → STATE_OUT: stage=TOUR_SELECTED listed=undefined
A3 [tr]         STATE_IN : stage=TOUR_SELECTED → BOT: LLM_CEVABI
B1 [tr] LLM'e giden geçmiş (24): "turlarınız neler", "Müsait turlarımız: …1.500₺", "antalya", "*Antalya Rafting* …12.12.2026", "ara mesaj 0" … "ara mesaj 19"
```
Canlı olay birebir: A1/A2 TOUR_SELECTED'a geçiyor, `listedDateIds` yok, cevap LLM'den; LLM'e eski 1.500₺ listesi ve eski tarih listesi gidiyor.

### 5.2 Sonra: yeşil
```
ok | 28 passed | 0 failed
```
```
A1 [tr/istiyorum] STATE_IN: GREETING
  BOT: *Kapadokya Balon Turu* için müsait tarihler: ⏎ 1) 10.07.2027 (Cumartesi) - 1.000₺ (999 kişilik yer) ⏎ 2) 11.07.2027 (Pazar) - 1.000₺ (99 kişilik yer)
       ⏎ • 12.07.2027 (Pazartesi) (DOLU) ⏎ 3) 29.07.2027 … ⏎ 4) 15.09.2027 (Çarşamba) - 1.500₺ (1 kişilik yer) ⏎ 5) 22.12.2027 … - 1.500₺ (96 kişilik yer) ⏎ ⏎ Hangi tarihi tercih edersiniz?
  STATE_OUT: TOUR_SELECTED listed=["k1","k2","k4","k5","k6"]      (lastAiParams = null → LLM çağrılmadı)
A1 [en] Available dates for *Cappadocia Balloon Tour*: … • Jul 12, 2027 (Monday) (FULL) …
A1 [ru] Доступные даты для *Полёт на воздушном шаре в Каппадокии*: … • 12 июл 2027 (понедельник) (ПОЛНО) …
A1 [ar] التواريخ المتاحة لـ *جولة بالون في كابادوكيا*: … • 12 يوليو 2027 (الاثنين) (ممتلئ) …
A2 [tr] STATE_IN: COMPLETED → "Şimdi *Kapadokya Balon Turu* için devam ediyoruz. *Kapadokya Balon Turu* için müsait tarihler: 1) 10.07.2027 …" → TOUR_SELECTED listed=[5]
A3 [tr/en/ru/ar] faq_general "ne zaman / When / Когда / متى" → aynı buildDateList çıktısı, LLM yok
A4 [tr/en/ru/ar] bilgi isteği → LLM_CEVABI (liste yok)
```
**Rezervasyon tamamlandıktan sonra yeni soru (B1, `lastAiParams.history`):**
```
B1 [tr] lastAiParams.history (4): ["user:ara mesaj 16","assistant:ara mesaj 17","user:ara mesaj 18","assistant:ara mesaj 19"]
B1 [en|ru|ar] aynı 4 mesaj
```
Kesim öncesi mesaj yok, ≤10.
B2: WhatsApp kesimsiz → 10 mesaj (eskiden 24), demo → en yeni 10, çift mesaj yok. B3: stale-reset `historyCutoffAt` yazıyor.

### 5.3 Statik muhafız: WhatsApp ve demo-chat aynı fonksiyon (suite "PAKET-0 Dilim-5", 29 ✓)
`D5.STATIK` ×8 (iki adapter `loadConversationHistory` çağırır + kendi `whatsapp_conversations` sorgusu yok; eski fonksiyon silinmiş; önyükleme yalnız `!since`; stale-reset kesim yazar; `_isTourListRequest` `_isUserAskingDates`'in içinde), `D5.PROMPT` ×7, `D5.REGEX` ×14. HEAD'e karşı: 14 ✗ (1 ✓: eski WhatsApp adapter zaten kendi sorgusunu yapmıyordu), ardından regex muhafızı `TypeError` (sabitler yok).

### 5.4 `npm test` (tümü)
```
DAVRANIŞSAL TESTLER: 596/596 · suite toplam 1582 ✓ / 0 ✗ (önce 1553; +29 D5)
harness ok | 88 passed | 0 failed (önce 60; +28)
webhook ok | 20 passed | 0 failed
━━━ SONUÇ ━━━  suite=✓  harness=✓  webhook=✓   EXIT=0
```
Tip denetimi (`deno check` webhook + demo): 12 hata = taban çizgisi; hiçbiri bu dilimin satırlarında değil (process-message `:1240`, webhook `:208` vb. önceden vardı).

---

## 6. Pre-delete tablosu + net satır

| Silinen / değişen | Neden | Yerine |
|---|---|---|
| `getConversationHistory` (context-manager, yorumlarla 27 satır) | Önyüklemede kesim ve limiti yok sayıyordu (olayın 2. kökü) | `loadConversationHistory` (tek kaynak) |
| demo `loadHistory` gövdesi (ASC+limit, 9 satır) | En eski N mesajı alıyordu; WhatsApp'tan ayrı kopya | `loadConversationHistory` çağrısı |
| WhatsApp `loadHistory` gövdesi (getConversationHistory + reverse) | Aynı | `loadConversationHistory` çağrısı |
| `userAlreadySaved` boolean + `markUserSaved()` | İçerik bilinmeden DB'den okunan geçmişte çift mesaj | `savedUserContent` + `markUserSaved(content)` |
| `_isUserAskingDates` üst `!_isInfoQuestionFsmIntent` guard'ı | (b)'yi de öldürüyordu (A3 deliği) | guard (a) ve (c)'ye taşındı; (b) → `_isDateQuestion` |
| 14 prompt örnek satırı | Yasakla çelişen tarih/müsaitlik vaadi | Nötr örnek (§3) |
| `DATE_INTENTS` (4 intent) | `browse_tours` eksik | +`browse_tours` |
| tour-matching noktalama regex'i | `؟ ،` yok | +`؟ ،` |

**Net satır (`git diff --numstat c901dbd b817045`):**
- Üretim kodu (adapter ×2, webhook index, context-manager, process-message, date-detection, tour-matching, 7 prompt): **+163 / −72 = +91**. Artışın çoğu: 7-dil regex sabitleri (+45, date-detection) ve açıklama yorumları; `loadConversationHistory` iki kopyanın yerini aldı.
- Test/muhafız: harness +11/−4, yeni test dosyası +208, suite +46. Doküman: ARCHITECTURE_GUARDS §G20.

---

## 7. Gözlemler (bu dilimde dokunulmadı)

- **G1: RU hâl eki / DE bileşik tur eşleşmiyor.** "хочу посмотреть туры в Каппадокию" → tur bulunamıyor, müşteri `"посмотреть" нет в нашей системе` cevabı alıyor (yanlış "tur yok"; `process-message.ts:3700` bilinmeyen-tur dalı). "Kappadokien-Touren" da eşleşmiyor. Bu tur-eşleştirme (morfoloji) işi; tur seçilmeden (e) devreye giremez.
- **G2: Ölü eski geçmiş kodu.** `whatsapp-webhook/services/conversation.ts` `getConversationHistory` ve onu kullanan `handlers/{general-chat,greeting,tour-search}.ts`, `services/{intelligent-handler,tour}.ts` webhook `index.ts`'ten erişilmiyor (yalnız birbirlerini import ediyorlar). Silme ayrı karar.
- **G3:** `nlu-validation.ts:54` (isim kapısı) aynı noktalama sınıfında `؟ ،` yok, tur eşleştirmeyle ilgisiz.
- **G4: Maliyet.** Kesim yazılmış konuşmalarda (rezervasyon sonrası, stale-reset sonrası) WhatsApp her mesajda önyükleme yerine 1 ek DB sorgusu yapar (`phone+agency_id` filtreli, `limit 11`).
- **G5: Saat kayması.** Kesim zamanı edge-function saatinden, `created_at` DB saatinden; sınırdaki tek mesaj içeri/dışarı kayabilir (mevcut CONFIRMING→COMPLETED mekanizmasıyla aynı sınır).
- **G6:** Teşhis raporundaki bulgu sürüyor: `tours`/`tour_dates`'te `updated_at` yok.

---

## 8. Commit / Push / Deploy (2026-10-08)

**Ön koşul `npm test`:** suite 1582 ✓ / 0 ✗ · harness 88 passed · webhook 20 passed · EXIT=0.

**Push (origin/main):** `c087b6b..b817045`
- `c901dbd` docs(rapor): canlı eski tarih/fiyat teşhisi
- `b817045` fix(bot): PAKET-0 Dilim-5: tur isteme/tarih sorusu yalnız buildDateList + LLM geçmişi tek fonksiyon

**Migration:** yok.

**Deploy (`supabase functions deploy`, proje `yaxjygtjtjmzslajuctk`):**

| Fonksiyon | Sonuç | Versiyon | UPDATED_AT (UTC) |
|---|---|---|---|
| `whatsapp-webhook` | `Deployed Functions.` | **297** | 2026-10-08 09:39:07 |
| `demo-chat` | `Deployed Functions.` | **276** | 2026-10-08 09:39:16 |

İkisi de **ACTIVE** (önceki: whatsapp-webhook v296, demo-chat v275).

**Canlı duman: demo-chat, TR "merhaba"** (yeni session, anon key; rezervasyon/DB test kaydı YOK):
```
[tr] "merhaba" → HTTP 200 (11012 ms) session=smoke-d5-tr-1791452379113
  response: "Merhaba! 😊 Hoş geldiniz!\n\nSize nasıl yardımcı olabilirim? Hangi destinasyona tur düşünüyorsunuz? 🌟\n\nİsterseniz popüler turlarımıza göz atabilirsiniz:\n\n• Ege Turu (İzmir-Çeşme-Alaçatı)\n• Kapadokya Kültür Turu\n• Kapadokya Balon Turu\n• Pamukkale Turu\n• Antalya Rafting\n• Efes Antik Kent Turu\n\nHangi tur ilginizi çekiyor? ✨"
  state: stage=BROWSING lang=tr dateId=undefined listed=undefined pendingPax=undefined
```
whatsapp-webhook'a canlı mesaj gönderilmedi (gerçek numara gerekir); deploy hatasız, ACTIVE.

---

## 9. Sade özet

Müşteri bir turu istediğinde, görmek istediğinde ya da tarihini sorduğunda tarih listesini artık yapay zekâ yazmıyor; liste her seferinde veritabanındaki güncel tarihlerden, dolu günler işaretlenerek hazırlanıyor. Yapay zekâya giden konuşma geçmişi WhatsApp ve demo'da artık aynı yerden geliyor: rezervasyon bittiğinde ya da "Tekrar hoş geldiniz" ile sohbet sıfırlandığında eski mesajlar (eski fiyat ve tarih listeleri) yapay zekâya hiç gönderilmiyor. Rusça ve Almanca bazı çekimli tur adları ("в Каппадокию") hâlâ tanınmıyor; bu ayrı bir düzeltme olarak bekliyor.
