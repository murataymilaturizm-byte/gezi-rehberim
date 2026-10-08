# PAKET-0 · Dilim 7 — D1 + E2 + E3 — Sonuç Raporu

> Kapsam: denetim `TURZZ-FABLE-DENETIM.md` D1 (bütçe para birimi), E2 (`\b` + non-ASCII), E3 (dil tespiti). E1, C1, G2 ve diğer gruplara dokunulmadı.
> Commit: `0db472b` (kod + test). Migration: yok.

---

## 1. D1: bütçe girdisinin para birimi

**Önce (`process-message.ts` B1):**
- Girdi desenleri yalnız `tl|₺` tanıyordu.
- Karşılaştırma ham `price_adult` ile yapılıyordu: EUR'luk turun 120'si TRY'lik turun 1000'iyle aynı ölçekte kıyaslanıyordu.
- Etiket her dilde sabit "… TRY" idi (Dilim-6'da `C2-MUAF` ile muaf tutulmuştu).

**Sonra, yeni modül `shared/services/budget.ts`:**
- `explicitBudgetCurrency(message)`: mesajdaki para birimi belirteci, 7 dilde, en erken konumdaki kazanır:

  | Para birimi | Belirteçler |
  |---|---|
  | TRY | ₺, tl, lira, лир…, ليرة, büyük harf "TRY" ("try" fiili sayılmaz) |
  | EUR | €, eur/euro(s), евро, يورو |
  | USD | $, usd, dolar/dollar/dólar(es), доллар…, دولار |
  | GBP | £, gbp, pound, sterlin, фунт…, جنيه |
  | RUB | ₽, rub, ruble/rouble, руб… |
  | SAR | ﷼, riyal, ريال, büyük harf "SAR" |
  | AED | د.إ, aed, dirham, درهم |

  Sayıya bitişik yazım da tanınıyor ("5000tl", "300usd").
- `resolveBudgetCurrency`: açık belirteç varsa o kullanılır; yoksa örtük para birimi (aşağıda KARAR D1-a).
- `priceInCurrency` / `canConvert`: tur fiyatı bütçe para birimine `convertSync` ile çevriliyor. İki kur da yoksa `null` dönüyor; `convertSync` eksik kurda sessizce 1 varsayıyordu, bu yüzden karar burada veriliyor.
- **B1:** karşılaştırma bütçe para biriminde yapılıyor. Etiket `formatPriceSync(v, bütçeBirimi, lang, null, false)` ile basılıyor ("unter 500€", "under 300$", "до 5.000₽", "5.000₺ altı"). Listedeki tur fiyatları eskisi gibi turun kendi para biriminde (ve açıksa çift gösterimde).
- `utils/currency-display.ts` `userCurrencyFor(lang, languageCurrencies)`: `formatPriceSync`'in kullanıcı para birimi seçimi tek yardımcıya çıkarıldı; bütçe de aynısını kullanıyor.
- `C2-MUAF` işaretleri ve suite D6.C2'deki muafiyet **kaldırıldı**.

### KARAR GEREKLİ (en güvenli seçenek uygulandı)

**D1-a (örtük para birimi):**
- **Uygulanan:** müşterinin fiyatları **gördüğü** para birimi. Çift gösterim açık ve kur varsa `LANG_TO_CURRENCY[lang]` (acente override dahil); aksi hâlde acentenin ana para birimi (`primaryCurrency`).
- **Neden:** Talimat "para birimi yoksa LANG_TO_CURRENCY[lang]" diyor. Bu kural, çift gösterim açık ve kur varken birebir uygulanıyor. Kur yokken ya da acente çift gösterimi kapattığında müşteri ekranda yalnız ₺ görür. Bu durumda "under 300"ü USD saymak hem müşterinin gördüğüyle çelişir, hem de kur yokken bütün TRY turlarını karşılaştırılamaz yapıp filtresiz listeler. TR'de iki kural aynı sonucu verir (tr → TRY).

**D1-b (kur yokken farklı para birimli tur):**
- **Uygulanan:** listede kalıyor, "yaklaşık" işaretlenmiyor, karşılaştırılabilen turların **arkasına** diziliyor.
- **Neden:** Talimattaki kural birebir uygulandı. Sıralama, uyduğu kanıtlanan turları öne alıyor.

**D1-c (etiket biçimi):**
- **Uygulanan:** "500€", "5.000₺" (boşluksuz, binlik nokta).
- **Neden:** `formatPriceSync`'in ev biçimi, talimat onu zorunlu kılıyor. Talimattaki "500 €" yazımı biçim olarak değil anlam olarak okundu. TR etiketi "5000₺ altı" → "5.000₺ altı" oldu; liste davranışı aynı.

---

## 2. E2: `\b` + non-ASCII ölü regex dalları

JS `\b` yalnız ASCII `[A-Za-z0-9_]` için sınır üretir. `\b`'ye **bitişik** karakter non-ASCII ise sınır hiç oluşmaz ve o alternatif ölüdür.

**Tarayıcı (`scripts/lib/regex-boundary.ts`):** regex literal'inde `\b`'ye bitişik alternatiflerin ilk atomuna (öndeki `\b`) ve son atomuna (arkadaki `\b`) bakıyor. Opsiyonel önek grupları ve karakter sınıfları dahil. Grubun içinde non-ASCII olması tek başına ihlal değil: `\b(kayd[ıi]n|rezervasyon)` doğru çalışır, çünkü bitişik harf ASCII.

**Bulgular:** denetimin 5 yeri + 3 ek, toplam **9 regex**. Hepsi `(?<![\p{L}\p{N}])` / `(?![\p{L}\p{N}])` + `/u` ile çevrildi; her biri derlenerek doğrulandı.

| Yer | Ölü alternatif | Etki |
|---|---|---|
| `fsm/nlu.ts:93` (NLU yedek kısa onay) | `да`, `نعم`, `موافق`, `sí` | NLU arızasında RU/AR/ES onay tanınmıyordu |
| `fsm/state-machine.ts:653` (TOUR_SELECTED→COLLECTING_INFO olumlu kalıp) | `да`, `نعم`, `sí` | "да" turu başlatmıyordu |
| `handlers/process-message.ts:2008` (tek-adaylı tur teyidi) | `да`, `давай`, `конечно`, `نعم`, `طيب`, `تمام`, `أجل`, `sí` | teyit tanınmıyordu |
| `fsm/simple-extractor.ts:757-759` (`_SKIP_EMAIL` de/ru/ar) | `überspringen`; RU'nun tamamı; AR'nin tamamı | e-posta atlanamıyordu |
| `fsm/response-validator.ts:30` | `ön kaydınızı aldık` (opsiyonel "ön") | sahte-onay yakalayıcı "ön kayıt"ı kaçırıyordu |
| `fsm/response-validator.ts:120` | `özel teklif …%` | fiyat-manipülasyon yakalayıcı |
| `fsm/validator.ts:55` | `… aç` (injection: "talimatları aç") | |
| `fsm/state-machine.ts:72` (denetimdeki "sm:71 `\w`") | `кроме \w+`, `غير \w+`, `außer \w+` | `\w` Kiril/Arap/ü harfini tutmuyordu → `\p{L}+` + `/u` |

**Statik muhafız (suite D7.E2):** tarayıcının kendi testi (5 örnek: 3 ihlal, 2 temiz) ve `shared/**` (86 dosya) içindeki bütün regex literal'lerinin taranması. HEAD'e karşı 9 yer listelenerek kırmızı.

## 3. E3: dil tespiti

### 3.1 `detectLanguage` (`fsm/language.ts`)
Sıra: TR-özgü (ğ ş ı İ Ş Ğ) → DE-özgü (ä ß) → **ES-özgü** (ñ ¿ ¡ á í ó ú) → **FR-özgü** (œ æ ê ë î ï û ù è à â ô) → Kiril → Arap → TR/DE paylaşılan (ü ö ç; eski öncelik tr).
- `é` (FR+ES paylaşılan) artık tek başına karar vermiyor → `null`, karar NLU'nun. İlk mesajda NLU dili zaten otorite (`nlu-first`).
- **KARAR E3-a:** FR-özgü listeye talimattakilere ek olarak `è à â ô` kondu. Bunlar desteklenen diller arasında yalnız FR'de var; olmasalar "réserver à Paris" tespiti kaybolurdu. `ç` FR listesine konmadı, çünkü TR ile paylaşılıyor ("Ça marche" → tr kalıyor; açık nokta).

### 3.2 Akış ortası 2-ardışık kuralı
- Karakter tabanlı geçiş (`process-message.ts:606`) artık yalnız **yazı sistemi dile özgü** tespitte anlık (Kiril → ru, Arap → ar, `SCRIPT_UNIQUE_LANGS`).
- Latin harfli tespitler (tr/de/es/fr) §P3 pending mekanizmasına **sinyal** olarak gidiyor; bu, ASCII mesajlardaki NLU sinyaliyle aynı kural. 1. mesaj `pendingLangSwitch` yazıyor, 2. ardışık mesaj geçiriyor.
- CİLA-3 TR-paylaşılan-aksan kapısı korundu.
- **KARAR E3-b:** Kiril/Arap anlık bırakıldı. Bu yazı sistemlerinde yanlış tespit olamaz; RU/AR müşterinin ilk mesajı eski dilde cevaplanırsa kötü bir deneyim olur.

### 3.3 `detectLanguageChangeIntent`: soru/istek ayrımı (**önce doğrulandı**)
**Doğrulama (harness, HEAD):** TR akışında "Almanca rehberiniz var mı?" → `_langTrace: ["3:explicit:tr>de:L"]`, yani dil **de'ye geçti**. İddia doğrulandı.

Yan bulgu (ters yön): "İngilizce rehber var mı?" HEAD'de dil değiştirmiyordu, ama yalnız **tesadüfen**: `"İ".toLowerCase()` "i̇" (i + U+0307) ürettiği için "ingilizce" hiç eşleşmiyordu. Aynı hata "İngilizce devam edelim" gibi **gerçek istekleri** de bozuyordu.

**Düzeltme:**
1. Büyük İ önce düz i'ye indiriliyor.
2. Mesajda **hizmet ismi** (rehber/tur/gezi/program, guide/tour, Reiseleiter/Führung, guía/visita, гид/экскурс/тур, مرشد/دليل/جولة) **ve** soru işareti/kalıbı (?, var mı, is there, gibt es, hay, есть ли, هل…) birlikte varsa → dil değişimi isteği **değil**.

İstek cümlelerinde hizmet ismi geçmez; etkilenmezler ("Can we speak English?" → en).

---

## 4. Kanıt (gerçek koşum)

Harness: `supabase/functions/_tests/harness/budget_lang_test.ts`, 21 senaryo. Kur enjeksiyonu için yeni stub `_tests/harness/stubs/exchange-rates.ts`; import map'e eklendi. Varsayılan `{}`, yani harness'in önceki gerçek davranışı (ağ yok → boş kur). Kur: USD bazlı (1 USD = 0.92 EUR = 34.5 TRY = 90 RUB). Turlar: Kapadokya Balon 120 EUR, Pamukkale 1.000 TRY, Efes 30.000 TRY.

### 4.1 Önce: kırmızı (`git stash` ile 9 kod dosyası HEAD'e alındı, aynı test koşuldu)
```
FAILED | 3 passed | 18 failed
D1 [de] kur var   → "Touren in Ihrem Budget (unter 500 TRY): 1) Kappadokien Ballonfahrt — 120€"     (1000 TRY ≈27€ ELENDİ)
D1 [en] kur var   → "Tours within your under 300 TRY budget: 1) Cappadocia Balloon Tour — 130$ (120€)" (1000 TRY ≈29$ ELENDİ)
D1 [ru] kur var   → "Туры в вашем бюджете (до 5000 TRY): …"
D1 [de] kur yok   → FAILED
E2 ×9 (RU/AR/ES onay ×6, DE/RU/AR e-posta atlama ×3) FAILED — örn. TOUR_SELECTED "да" → BOT: LLM_CEVABI, stage değişmedi
E3 detectLanguage "¿Qué incluye el tour?" → fr; fr→es pending yok; tek "¡Hola! ¿Qué tal?" TR akışını es'ye çevirdi;
   "Almanca rehberiniz var mı?" → de; "İngilizce devam edelim" → tr (İ hatası)
geçen 3: D1 [tr] eski davranış koruması, "tek İngilizce kelime" (§P3 zaten koruyordu), "İngilizce rehber var mı?" (İ hatası yüzünden tesadüfen)
```
Suite (HEAD'e karşı): D6.C2 ✗ (`process-message.ts:1499,1501,1502`, C2-MUAF muafiyeti kalkınca), D7.E2 ✗ (9 yer), D7.D1 ✗ ×2, ardından `userCurrencyFor` yok hatası.

### 4.2 Sonra: yeşil
```
ok | 21 passed | 0 failed
D1 [de] kur var → "Touren in Ihrem Budget (unter 500€): 1) Pamukkale Tour — 27€ (1.000₺) 2) Kappadokien Ballonfahrt — 120€"   (Efes ≈800€ yok)
D1 [de] kur yok → "(unter 500€): 1) Kappadokien Ballonfahrt — 120€ 2) Pamukkale Tour — 1.000₺ 3) Efes Antik Kent Turu — 30.000₺"  (yaklaşık işareti yok)
D1 [en]         → "Tours within your under 300$ budget: 1) Pamukkale Tour — 29$ (1.000₺) 2) Cappadocia Balloon Tour — 130$ (120€)"
D1 [ru]         → "Туры в вашем бюджете (до 5.000₽): 1) Тур в Памуккале — 2,609₽ (1.000₺)"
D1 [tr]         → "5.000₺ altı bütçenize uygun turlarımız: 1) Pamukkale Turu — 1.000₺ 2) Kapadokya Balon Turu — 120€"   (Efes yok — eski üyelik aynı)
E2 [ru/ar/es] NLU yedek "да"/"نعم"/"sí" → confirm_reservation; TOUR_SELECTED "да"/"نعم"/"sí" → COLLECTING_INFO
E2 isEmailSkipRequest: de "überspringen", "später bitte"; ru "пропустить", "нет"; ar "تخطي", "لا" → true; e-posta adresi → false
E3 "¿Qué incluye el tour?" → es; fr akışında 1. mesaj: language=fr, pendingLangSwitch=es; 2. "¿Y cuánto cuesta?" → es
E3 TR akışında tek "¡Hola! ¿Qué tal?" → tr kalır; "thanks" → tr, ardından "what time does the tour start" → en
E3 "İngilizce rehber var mı?" → tr, "Almanca rehberiniz var mı?" → tr, "İngilizce devam edelim" → en
```

### 4.3 Suite ("PAKET-0 Dilim-7", 39 ✓)
D7.E2 ×6 (tarayıcı öz-testi ×5 + `shared/**` 86 dosya: "bulunan: yok"), D7.D1 ×13 (B1 tek kaynak, C2-MUAF yok, 11 para birimi örneği, kur yok → dönüştürülemez), D7.E3 ×19 (10 `detectLanguage`, 8 dil-değişim-niyeti, anlık geçişin `SCRIPT_UNIQUE_LANGS`'a sınırlı olduğu). D6.C2 muafiyetsiz: 39 dosya, "bulunan: yok".

### 4.4 `npm test` (tümü)
```
DAVRANIŞSAL TESTLER: 596/596 · suite toplam 1631 ✓ / 0 ✗ (önce 1592; +39 D7)
harness ok | 149 passed | 0 failed (önce 128; +21)
webhook ok | 20 passed | 0 failed
━━━ SONUÇ ━━━  suite=✓  harness=✓  webhook=✓   EXIT=0
```
Tip denetimi (`deno check` webhook + demo): 12 hata = taban çizgisi.

---

## 5. Pre-delete tablosu + net satır

| Silinen / değişen | Neden | Yerine |
|---|---|---|
| B1 ham `x.price` karşılaştırması + `_priced.sort` (ham fiyat) | Para birimleri karışıktı (D1) | `priceInCurrency(...)` ile bütçe biriminde `cmp`; `_byCmp` sıralama |
| B1 `_summary` 3 satırlık sabit "₺/TRY" tablosu + C2-MUAF yorumu (4 satır) | Etiket hep TRY'ydi | `formatPriceSync` ile bütçe biriminde `_fb(...)` |
| `formatPriceSync` içindeki satır içi kullanıcı para birimi ifadesi | Bütçe de aynı kurala ihtiyaç duyuyordu | `userCurrencyFor(...)` (tek kaynak) |
| 9 regex'teki `\b` (ve `sm:72` `\w+`) | Non-ASCII alternatifler ölüydü (E2) | `\p{L}\p{N}` lookaround / `\p{L}+` + `/u` |
| `detectLanguage` 4 satırlık eski karakter setleri (FR, ES'ten önce ve `é` içeriyordu) | "¿Qué…" → fr (E3) | Özgü-harf sırası (7 satır) |
| process-message `:606` Latin harfli anlık char-switch dalı (TR-paylaşılan kapısı dahil) | Tek mesajda dil değişiyordu | Kiril/Arap anlık; Latin → §P3 pending sinyali (kapı oraya taşındı) |
| `detectLanguageChangeIntent` `toLowerCase()` | Büyük İ "i̇" oluyordu | İ → i normalize + hizmet-sorusu dışlaması |
| suite D6.C2 `C2-MUAF` muafiyeti | D1 çözüldü | — |

**Net satır (`git diff --numstat d7170e6 0db472b`):**
- Üretim kodu: **+164 / −54 = net +110**. Bu dilim **eksik davranış ekliyor**: para birimi modeli (`budget.ts` 68 satır, 7 dil × 7 para birimi belirteç tablosu), hizmet-sorusu sınıfı (2 regex, 7 dil) ve dil sırası yorumları. Silinen kopya kod yok denecek kadar az; ölü regex'ler satır sayısını değiştirmeden düzeltildi.
- Test/muhafız: harness +150 (yeni test), stub +13, import map +2/−1, suite +61/−3, tarayıcı `scripts/lib/regex-boundary.ts` +104. Doküman: ARCHITECTURE_GUARDS §G22.

## 6. Açık noktalar / gözlemler
- "Ça marche" (yalnız `ç`) → tr. TR/FR paylaşılan harf, eski öncelik korundu.
- EN etiket cümlesi "Tours within your under 300$ budget" önceki şablondan ("within your under 300 TRY budget") geliyor; dil bilgisi olarak garip, metne dokunulmadı.
- Çift gösterimde çevrilmiş tutar `en-US` biçiminde ("2,609₽"), asıl tutar `tr-TR` biçiminde ("1.000₺"). Bu `formatPriceSync`'in mevcut davranışı.
- `demo-chat/index.ts:227` ön-dil tespiti yalnız boşta (idle) hazır cevap için; context'e yazmıyor. `demo-chat/services/context-manager.ts` ölü kod.

---

## 7. Commit / Push / Deploy (2026-10-08)

**Ön koşul `npm test`:** suite 1631 ✓ / 0 ✗ · harness 149 passed · webhook 20 passed · EXIT=0.

**Push (origin/main):** `d7170e6..0db472b`: `0db472b` fix(bot): PAKET-0 Dilim-7: bütçe para birimi + \b/non-ASCII ölü regex'ler + dil tespiti

**Migration:** yok.

**Deploy (`supabase functions deploy`, proje `yaxjygtjtjmzslajuctk`):**

| Fonksiyon | Sonuç | Versiyon | UPDATED_AT (UTC) |
|---|---|---|---|
| `whatsapp-webhook` | `Deployed Functions.` | **299** | 2026-10-08 12:20:09 |
| `demo-chat` | `Deployed Functions.` | **278** | 2026-10-08 12:20:19 |

İkisi de **ACTIVE** (önceki: whatsapp-webhook v298, demo-chat v277).

**Canlı duman: demo-chat, TR "merhaba"** (yeni session, anon key; rezervasyon/DB test kaydı YOK):
```
[tr] "merhaba" → HTTP 200 (11800 ms) session=smoke-d7-tr-1791462028516
  response: "Merhaba! 😊 Hoş geldiniz!\n\nSize nasıl yardımcı olabilirim? Turlarımızı görmek ister misiniz, yoksa belirli bir destinasyon mu aklınızda var? 🌟"
  state: stage=BROWSING lang=tr dateId=undefined listed=undefined pendingPax=undefined
```
whatsapp-webhook'a canlı mesaj gönderilmedi; deploy hatasız, ACTIVE.

---

## 8. Sade özet

Müşteri "500 € altı" ya da "300 dolar altı" gibi bir bütçe yazdığında bot artık para birimini anlıyor, turları kurla aynı para birimine çevirip doğru olanları listeliyor; eskiden her şeyi TL sanıp yanlış turları eliyordu. Rusça "да", Arapça "نعم", İspanyolca "sí" onayları ve Almanca/Rusça/Arapça "e-postayı atla" cevapları artık tanınıyor; kodda bunları sessizce bozan 9 hatalı kalıp düzeltildi ve yenisinin yazılmasını engelleyen bir test eklendi. Konuşmanın ortasında tek bir yabancı kelime ya da "Almanca rehberiniz var mı?" gibi bir soru artık sohbetin dilini değiştirmiyor; İspanyolca mesajlar da Fransızca sanılmıyor.
