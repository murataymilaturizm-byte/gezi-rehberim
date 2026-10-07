# TURZZ AI Chatbot — Bağımsız Denetim Raporu (Fable 5.1)

**Tarih:** 2026-10-07 · **Kapsam:** `supabase/functions/shared/handlers/process-message.ts` (ortak handler) + `demo-chat` / `whatsapp-webhook` giriş noktaları + FSM/NLU/extractor/prompt katmanları · **Baz commit:** `02f0981` · **Yöntem:** kod okuma (handler 5.906 satır tamamı + destek modülleri), 5 Faz3 commit diff'i, 3 paralel kaynak-taraması (DB→prompt hattı, test/mock haritası, 7-dil parite — her iddia kaynakta yeniden doğrulandı), **yerel davranışsal koşum** (Deno + stub adapter + stub Supabase, API anahtarı yok → NLU/LLM arıza-modu, deterministik dallar gerçek kod; harness scratchpad'de, repoya girmedi).

**Değiştirilen dosya:** yok (bu rapor hariç). Commit/deploy: yok. Canlı DB/WhatsApp'a yazma: yok.

> **Kanıt işaretleri:** `[KOŞUM]` = yerelde gerçek kodla çalıştırılıp çıktısı alındı · `[KOD]` = satır düzeyinde koddan teyit · `[AJAN]` = tarama ajanının bulgusu, tarafımca kaynakta nokta-doğrulandı · `DOĞRULANMADI` = tahmin/canlı veriye bağımlı.

---

## 0. Yönetici özeti (teknik)

Mimari net: Haiku-NLU → ~40 FSM-öncesi deterministik dal → FSM → ~25 FSM-sonrası deterministik dal → Sonnet LLM → post-validator. Felsefe ("NLU güvenilmez, kritik karar deterministik") doğru ve tutarlı uygulanmış; onay/iptal/tarih-listesi/özet gibi kritik mesajların LLM'e bırakılmaması isabetli. Faz3'ün 5 commit'i bu felsefeyle uyumlu, her biri bildirilen vakayı kapatıyor; **hiçbiri sınıf-düzeyi kök değil**, hepsi yeni bir erken-return dalı.

Asıl risk, dalların sayısı değil, **dalların paylaştığı primitiflerin olmaması**: tarih listesi 4 ayrı yerde 3 farklı indeks semantiğiyle üretiliyor (→ yanlış tarihle rezervasyon, `[KOŞUM]`), özet 6 kopya etiket tablosu + 3 builder ile basılıyor (→ bazı özetlerde 💰 yok), tur nesnesi iki giriş noktasında ayrı ayrı kopyalanıp **vize/otel/min_pax alanları düşürülüyor** (→ acentenin panelde girdiği vize notu bot'a hiç ulaşmıyor, her iki kanalda). NLU arızasında ilk mesajın dili TR'ye çöküyor (RU/AR müşteri Türkçe cevap alıyor, `[KOŞUM]`). Test tarafında 1.000+ assertion var ama **handler'ı import eden tek bir offline test yok**; e2e "ayna" gerçek FSM'den ayrışmış, ~155 kontrol kaynak-metin grep'i. Bu raporun harness'i handler'ın stub'larla import edilebildiğini kanıtlıyor — "import edilemez" varsayımı yanlış.

---

## 1. Faz3 Opus commit'lerinin incelemesi

| Commit | İçerik | Doğruluk | Yan etki | Kök mü yama mı |
|---|---|---|---|---|
| **P1 `e1c67e8`** V5 zengin-mesaj guard + V6 gün-sayısı süre + V7 emoji-onay + V12 "değildi" + V3-R6 anafora muafiyeti | `_richTourName` (pm:1170-1181) 4 filtre dalını tur-adı/tarih varsa atlatıyor; V6 B-DUR2 (pm:1623-1688); V7 `detectConfirmation` emoji-only yolu (sm:234-237); CHANGE_KEYWORDS "yapalım/alalım" | V5/V7/V12 doğru. V6 `_tourDays` yalnız TR `tur_sure` serbest-metnini parse ediyor (pm:1640-1645) — DB TR olduğu sürece çalışır. | `_richTourName` destinasyon ≥4 / başlık-kelimesi ≥5 karakter **substring** eşleşmesi (`includes`) — "Antik" gibi kelimeler yanlış-pozitif üretebilir (DOĞRULANMADI, canlı veriye bağlı). | **Yama (katman üstüne katman).** Kök sorun "filtre dalları niyete değil kelime varlığına tetikleniyor" aynen duruyor; guard önüne guard kondu. Kabul edilebilir — ama sınıf kapanmadı. |
| **P2 `18cfb13`** V10 müsaitlik-sorusu (:10e) + V9 çift-eşleşme (:10f) | pm:3841-3938; extractor Blok 8.5 `availabilityQueryDay`/`dateAmbiguousDay` | Doğru. V9'un "GLOBAL indeks (i+1) — Blok 8 `tour.dates[n-1]` ile birebir" tasarımı (pm:3917) **tam doğru düşünülmüş**. | Yok. | **Yerel kök, global yama.** V9 indeks problemini yalnız kendi listesinde çözdü; aynı sınıf H-pax, QUOTA_EXCEEDED ve L3 listelerinde **açık kaldı** (→ bulgu A1/A2/A3). |
| **P3 `1613dcf`** :10g öneri-sunumu + :10d-2 öneri-onayı + relative-date tamamlama | pm:3785-4025; `proposedDateId` tek-turn bayrağı; R6 muafiyeti (pm:3447) | Doğru. `_anyDateSignal` (pm:3957) "ilk" bağlam-şartlı daraltılmış (FABLE-review2). | `proposedDateId` yalnız `COLLECTING_INFO`'da kapanıyor (pm:3794); FSM başka stage'e taşırsa bayrak bir sonraki turn'e sızar, ancak "farklı tarih / onay-dışı → temizle" dalı (pm:3833-3836) bunu kapatıyor. Risk düşük. | Yeni pending-state yerine `detectConfirmation` reuse (DRY) **iyi karar**. Yine de "öneri → onay" deseni `pendingCancelConfirm`, `pendingFieldUpdateConfirm`, `pendingTourClarification`, `phoneEscalationPending`, `pendingSoftwareBridge`, `pendingLeadCapture` ile **7. tek-turn-pending bayrağı** — ortak bir `pending` mekanizması yok (bkz. G2). |
| **P4 `8ae96db`** V11-a telefon-yok politika + gönüllü e-posta + ısrar eskalasyonu | pm:3128-3254 | Doğru; FSM-öncesi konumu (J-14 deseni) gerekçeli; W3-b "önce yaz sonra vaat et" uygulanmış (pm:3160-3171). | `phoneRefusalCount` telefon verilince sıfırlanmıyor (kozmetik). "istemiyorum" tek başına sinyal değil (bilinçli) → R6'ya düşer → E3-1 kademeli-red 3. tetiklemede köprü açıyor (pm:3481-3497) — çıkmaz yok. | Kök (ürün kararına uygun deterministik dal). |
| **mikro `d2fd6b3`** göreli-tarih NLU guard + ISO görüntü formatı | `hasRelativeDateWord` → NLU `dates[]` yok sayılır (extractor Blok 2); pm:4148-4151 ISO→görüntü | Doğru; canlı vaka ("yarın" → NLU yanlış çapa) kapanır. | "20 aralık, bugün ödeme yaparım" gibi **göreli kelime + net tarih** birlikte gelirse NLU tarihi yok sayılır; simple-extractor regex'i net tarihi ayrıca yakaladığı için pratik etki düşük (DOĞRULANMADI, koşulmadı). | Kök (NLU'nun güvenilmez olduğu alt-alanı deterministik otoriteye devretmek). |

**Genel yargı:** 5/5 commit bildirilen vakayı doğru kapatıyor, regresyon izi bulamadım. Ortak zaaf: her commit yeni bir `RETURN`'lü dal ekliyor; handler'daki erken-return sayısı ~76 (ARCHITECTURE_GUARDS.md:1477) ve her dal kendi listesini/özetini/indeksini elle kuruyor. Faz3'ün "kök" olması için eksik olan şey commit'lerin içeriği değil, **dalların üzerine oturduğu ortak primitiflerin yokluğu** (§2.3).

---

## 2. Mimari: sorumluluk sınırları, çift-karar, ölü yollar

### 2.1 Katmanlar (fiilî)
```
adapter.loadContext (TTL: GREETING/BROWSING 24h · COLLECTING/CONFIRMING 45dk · COMPLETED 12h)
 → uzunluk/sanitize/AR-rakam normalize (pm:371-395)
 → stale-reset (pm:446-545) → L3 tarih revalidasyonu (pm:622-676) → lead/yazılım yakalama (pm:685-950)
 → NLU analyzeUserMessage (pm:970) → dil yazma kuralları (pm:979-1115)
 → NİTELİK ÖN-TESPİT (X8/X9/B1/B-DUR/B-DUR2/B-ATTR/B-TEMA, pm:1157-1834)  [RETURN]
 → tur eşleştirme (pm:1840) → pending-cevap dalları (§35-6/§35-7/7b-0) → erken tur değişimi (7b/7c)
 → intent yükseltmeleri (B2 / BUG-B / RESERVATION PROMOTE, pm:2084-2187) → J-14 iptal
 → extractAllInfo (pm:2242) → PROVIDE PROMOTE → F4 DAL1/DAL2/B-6 → pax guard'ları → H-β/H-pax
 → AKIŞ-İÇİ DEĞİŞTİRME (A2/A3/A4-mini/PROMOSYON/§35-7, pm:2652-3126) [RETURN] → V11-a telefon-yok
 → processTransition (pm:3264) → 9b-A → R6 → O6 → B2 → :10..:14 deterministik dallar [RETURN]
 → system prompt + callAI (pm:5496-5652) → validateAIResponse / 17-BV / validateFieldReask / KÖK6 / K4
```

### 2.2 Aynı kararın birden fazla yerde verildiği noktalar `[KOD]`

| Karar | Yerler | Risk |
|---|---|---|
| "Kullanıcı rezervasyon niyetinde mi?" | handler RESERVATION PROMOTE (pm:2174-2187) + PROVIDE PROMOTE (pm:2271-2284) + BUG-B PROMOTE (pm:2150-2158) **ve** FSM T9'da `hasReservationSignal`/`positivePattern` bypass (sm:648-671) | Handler intent'i değiştiriyor, FSM yine mesaj-pattern'e bakıyor; iki katman farklı pattern seti kullanıyor (FSM `positivePattern` sm:648 `\b`'li ve RU/AR için **ölü**, bkz. E2). |
| "Onay mı?" (`detectConfirmation`) | 8 çağrı: DAL1 sinyali (pm:2319), B-6 guard (pm:2435), A4-mini (pm:3011), V11-a eskalasyon (pm:3152), R6 muafiyeti (pm:3447), :10d-2 (pm:3800), T14 (sm:804/821), FIX3 (pm:5401), FIX1 (pm:5475), §35-6/7 (pm:1863/1901) | Tek kaynak (`confirmation-words.ts`) iyi; ama sıra-bağımlılığı var — ör. CONFIRMING'de "evet" önce DAL1 `_l2HasConfirmSignal`'a (değer varsa uygula), yoksa FSM T14'e düşüyor; R6 muafiyeti :10d-2'den **önce** olduğu için ayrıca muafiyet gerekti (pm:3443-3447 kendisi de bunu yazıyor). |
| "Tur değişti mi?" | 7b-0 netleştirme-seçimi (pm:1947), G5 erken değişim (pm:2023), 7c belirsiz liste (pm:2047), FSM T10/T11 (sm:692-728), B2 stage-koruma istisnası (pm:2099-2112), `tourSwitchWarning` LLM uyarısı (pm:5542) | G5 context'i **mutate** ettiği için FSM T10/T11 "kendiliğinden atlıyor" (pm:2019-2022) — yani FSM'deki iki transition fiilen yalnız TOUR_SELECTED'da canlı; COLLECTING/CONFIRMING'de ölü-yol. |
| "Tarih değişti → ack" | A3-date (pm:2937, keyword'lü) · :10d P5 (pm:3751, keyword'süz, FSM-sonrası) · 9b-A (pm:3313, telefon adımı) · §35-7 echo-teyit (pm:3107, CONFIRMING) | 4 yol, 4 farklı mesaj şablonu; davranış "sinyal gücüne göre" diye gerekçelendirilmiş (ARCHITECTURE_GUARDS §18d) — kabul, ama tek builder yok. |
| FAQ-intent muafiyet listesi | R6 (pm:3423), `_isInfoQuestionFsmIntent` (pm:4046), `_isInfoQuestionForFlowReturn` (pm:5787), :10g guard (pm:3996) | Kodun kendi TODO'su (pm:3418-3422) — 3 yerine 4 kopya. |
| Özet etiket tablosu | `_CONFIRM_LABELS` (pm:292), `_labelsA2` (pm:2770), `_labelsA3` (pm:2849), :13 `_labels` (pm:4661), :13-PERSIST `_labels` (pm:4754), FIX3 `_fix3Labels` (pm:5427) — **6 kopya**, 3 builder (`_buildUpdatedSummary`, `_buildA3Reply`, inline :13) | A2/A3 özetlerinde **💰 Toplam satırı yok** (pm:2787-2794, 2915-2922); :13/:13-PERSIST/PAKET-B'de var. Aynı rezervasyonun özeti hangi daldan basıldığına göre toplam gösteriyor/göstermiyor. → bulgu G1 |
| Tarih listesi | L3 (pm:637-648) · `_buildAvailableDatesText` (pm:2530-2550) · :11 (pm:4100-4119) · :10f (pm:3909-3920) · 9b-A (pm:3371) · QUOTA_EXCEEDED (pm:4971-4980) · 17-BV (pm:5698-5705) | **3 farklı indeks semantiği** (global / filtrelenmiş-yerel / slice'lı-yerel) — seçim tarafı (extractor Blok 8) yalnız global biliyor. → bulgu grubu A |

### 2.3 Ölü / ulaşılmaz / fire-and-forget `[KOD]`
- **FIX3** (pm:5398-5463): kendi yorumuyla "canlı log'da hiç görülmedi… INSURANCE". 65 satır özet-kopyası.
- **A1 LOG-ONLY** (pm:2652-2712): 2026-06-27'den beri "davranış değiştirmez, sadece log basar" — kalıcı iskele.
- **`agency.language_preference`** (pm:1095-1096): yalnız `!context.language` iken okunuyor; `createInitialContext(lang)` (pm:602) dili her zaman set ettiğinden **fiilen hiç çalışmıyor**. Panelde böyle bir ayar varsa müşteriye vaat edilmiş ama etkisiz. `[AJAN]`+`[KOD]`
- **`DEMO_TOURS`** (`demo-chat/config/demo-tours.ts:51`): `supabase/functions` altında dış kullanım bulunamadı; demo canlı DB'den `getCachedTours` ile okuyor (demo-chat/index.ts:248). DOĞRULANMADI (seed script'i başka yerde olabilir).
- **F-D4-1 kuralına aykırı fire-and-forget:** `complaint_feedback` insert (pm:1121) ve 14a-3 (pm:5314-5320) — ikincisi vaat cümlesi kurmadığı için kabul edilebilir, ilki `.then(()=>{})` tek-kollu.
- **FSM `isInformationalMessage` soru-kelimeleri TR-only** (sm:55) — 7 dilin FSM'i aynı fonksiyondan geçiyor; TR dışı dillerde "soru" yalnız `?` ile anlaşılıyor. `isAfterSalesMessage` booking/timing pattern'leri TR-only (sm:442-448). `hasNewReservationIntent` AR içermiyor (sm:64).

---

## 3. Halüsinasyon riski: fiyat / saat / müsaitlik / tur bilgisi

### 3.1 Veri hattı `[KOD]`+`[AJAN doğrulandı]`
- **Şema:** `tours.toplanma_saati time` — tur başına **tek** değer (migration `20251112152524…sql:6`). Şehir/alış-noktası/tarih bazlı ikinci bir saat kolonu veya tablosu **yok**. `tour_dates`'te saat yok. Dahil/hariç, itinerary kolonu yok.
- **Yükleme:** `tour-cache.ts:84` `select("*, dates:tour_dates(*)")` — tüm kolonlar gelir, **sıralama yok**.
- **Giriş noktası kopyası:** `whatsapp-webhook/index.ts:472-495` ve `demo-chat/index.ts:270-294` turu yeni bir nesneye **beyaz-liste** ile kopyalar. Taşınan: title/destination(+7 dil), type, currency, program_kisa, gezilecek_yerler, toplanma_saati, hareket_noktasi, tur_sure, konaklama, ulasim, filtrelenmiş dates. **Düşen:** `visa_notes`, `visa_required`, `hotel_name`, `hotel_stars`, `min_pax`, `program_url`.
- **Prompt:** GREETING/BROWSING listesi `formatToursList` (helpers.ts:26-141) → başlık, destinasyon, `dates[0].price_adult`, ilk tarih (+ton'a göre gezilecek_yerler/program_kisa). **Saat, kalkış noktası, süre, çocuk fiyatı listede yok.** Para birimi sabit `₺`/`" TRY"` (helpers.ts:59, 90, 92, 113, 115, 135, 137). TOUR_SELECTED ve sonrası `formatTourDetails` (helpers.ts:194-299) → saat `🕐 Toplanma saati` (:265), kalkış noktası, süre, fiyat `formatPriceSync` ile (fx verilirse).
- **Guard çelişkisi:** stage guard "Kalkış saati için toplanma_saati alanını kullan" diyor (stages/index.ts:337) ama GREETING/BROWSING'de alan prompta **girmiyor**. Roles dosyaları "net fiyat tutarı yazma" derken (roles/tr.ts:42, en.ts:43 …) `formatTourDetails` prompta fiyat koyuyor `[AJAN]` (çelişkiyi kendim satır satır doğrulamadım — DOĞRULANMADI).
- **Post-LLM:** `response-validator.ts` yalnız sahte-onay (validateAIResponse), injection fiyat-manipülasyonu (yalnız şüpheli girişte), boş-vaat ve sahte-ack yakalıyor. **Cevaptaki rakam/saat/tarihi DB ile karşılaştıran kontrol yok.** `detectEmptyPromise` rakam içeren cevabı "veri" sayıyor → uydurma fiyat bu geçidi geçer.

### 3.2 "Pamukkale'de iki farklı alınış saati" — olası kökler (sıralı)
1. **LLM uydurması, saat alanının prompta girmediği yolda.** Kodun kendi notları: tour-matching.ts:303 "LLM uydurur (Pamukkale 07:00 vs 08:00 canlı bug)", helpers.ts:167/209 "DB'de 07:30 ama prompt'a girmediği için LLM saat uyduruyor". Bu yol BROWSING listesinde (saat yok) ve **birden fazla Pamukkale turu eşleşip `currentTour` boş kaldığında** açık kalır: mesajda tur adı geçtiği için B-ATTR `_richTourName` ile atlanır (pm:1701), tur çözülmezse LLM saat-sız liste prompt'uyla cevaplar. `[KOŞUM S8]`: tek "Pamukkale Turu" tam-eşleşmesi varken tur **sessizce seçildi** (stage TOUR_SELECTED) — çözülünce prompta saat girer, risk yalnız çözülemeyen/çoklu eşleşmede.
2. **Serbest-metin alanları:** `program_kisa` / `ulasim` / `hareket_noktasi` içinde `toplanma_saati`'nden farklı bir saat yazılmış olabilir → LLM ikisini de görür. DOĞRULANMADI (canlı DB görülmedi).
3. **İki ayrı Pamukkale turu** farklı `toplanma_saati` ile. DOĞRULANMADI.
4. **History sızıntısı:** önceki turn'de B-ATTR "1) Pamukkale Turu — 07:30" basmışsa LLM bunu kopyalar (doğru); ama 1'deki uydurma bir kez history'ye girdiyse sonraki turn'lerde **kendi uydurmasını** kopyalar. Deterministik düzeltme yok.

**Sonuç:** Bot saati DB'den alabiliyor (tur seçiliyse ve tek saat varsa), ama **uydurmasını engelleyen yapısal bir kapı yok**; kapı yalnız prompt-kuralı. Fiyat için aynı durum. Müsaitlik/tarih için ise deterministik dallar (:11, :10e/f, H-β/H-pax, L3, RPC γ) LLM'i fiilen devre dışı bırakıyor — **müsaitlik/tarih tarafı sağlam, saat/fiyat-yorumu tarafı prompt-bağımlı**.

---

## 4. Keşif aşaması senaryoları

| Senaryo | Yol | Değerlendirme |
|---|---|---|
| **Tur karşılaştırma** ("Kapadokya mı Pamukkale mi?") | İki eşleşme → `multipleTourMatches` → `getMultipleTourWarning` + BROWSING prompt → **tamamen LLM**. Deterministik karşılaştırma dalı yok. Prompt listesinde süre/saat/kalkış yok (§3.1). | LLM-bağımlı; fiyat ₺ sabit (yabancı dilde yanlış sembol). Test yok. |
| **Belirsiz istek** ("bir yere gitmek istiyorum") | NLU general/tour_search → BROWSING → LLM liste. | Kabul edilebilir. |
| **Konu dışı** | `offTopicBrevityPrompt` (pm:5599-5607) yalnız intent general/greeting'de; tur-dışı **hizmet talebi** (otel/transfer) P4-3 lead yakalamaya gider (pm:869-931). | Lead yolu yalnız TR prompt'ta "talebinizi iletebilirim ✍️" sunuyor; EN + 5 dil "acenteyle iletişime geçin" (stages/index.ts:66/336/350 vs :85/373/383) `[AJAN]` → **dil bazlı farklı ürün davranışı**. |
| **Tek adımda tur değiştirme** ("aslında Kapadokya") | COLLECTING/CONFIRMING: G5 intent-bağımsız (tour-change.ts:100) ✔ · TOUR_SELECTED: intent veya `hasReservationSignal` şart, yoksa FSM T10 (reservationInfo ≤2 alan) ✔ · Çoklu eşleşme: 7c `TOUR_CHANGE_PHRASE_RE` (7 dil, tour-matching.ts:46) ✔ | Sağlam. Tek boşluk: 7c yalnız COLLECTING/CONFIRMING'de; TOUR_SELECTED'da çoklu eşleşme LLM'e düşer. |
| **Tarih değiştirme onayı** | Keyword'lü → A3-date doğrudan değiştirir + ack (pm:2937); keyword'süz COLLECTING → merge "son değer kazanır" (sm:134) + :10d P5 ack, **teyit sorulmaz**; keyword'süz CONFIRMING → §35-7 echo-teyit (pm:3107). | Tasarım tutarlı (CONFIRMING'de teyit, öncesinde doğrudan). `[KOŞUM S6b]` QUOTA_EXCEEDED sonrası "2" → **yanlış tarih sessizce seçildi** (bulgu A1). |
| **Telefon adımında pax değişikliği** | "aslında 3 kişi olsun" → A2 (keyword + peopleContext) ✔ · "aslında 3 olsun" → X9-change pending (info-extractor Blok 1) → FSM merge → W6-cila ack (pm:3453-3472) | Kod yolu var; ARCHITECTURE_GUARDS G3 hâlâ "AÇIK BUG" diyor → **doküman-kod sapması**. NLU'nun çıplak "3"e `people_count` döndürmesi gerekir → DOĞRULANMADI. |
| **Pax > kontenjan** | H-pax (pm:2605-2650) | `[KOŞUM S1]` **çıkmaz döngü** (bulgu A2). |

---

## 5. 7-dil eşitliği

**İyi durumda:** Kullanıcıya giden 90+ inline sözlüğün hepsi 7 dil (`[AJAN]` numaralandırdı, rastgele 12'sini kendim doğruladım); sabit sözlükler (`canned-responses`, `fallback-response`, `payment-message`, `quota-labels`, `step-questions`, `lead-detection`, `graded-reject`, `escalation`, `attribute-query`) 7 dil; sinyal regex'lerinin büyük çoğunluğu `\p{L}\p{N}` lookaround'a çevrilmiş.

**Bir dilde olup diğerinde eksik/farklı `[KOD]`:**
- `\b` ile **ölü** alternatifler (JS `\b` non-ASCII'de sınır tanımaz): sm:648 T9 `positivePattern` (`да`, `نعم`, `sí` hiç eşleşmez → RU/AR/ES "evet" ile TOUR_SELECTED→COLLECTING geçişi pattern yolundan kapalı; intent yoluyla hâlâ açık), nlu.ts:93 fallback-onay (RU/AR/ES ölü), pm:1965 P9-C tek-aday olumlama (RU/AR/ES ölü), simple-extractor.ts:756-759 `_SKIP_EMAIL` de/ru/ar ölü, sm:71 `\w` (RU/AR/"außer München" ölü).
- `language.ts:14` FR seti ES'ten **önce** ve `é` içeriyor → "¿Qué precio…?" → **fr** (`[KOD]`, satır sırası); ES konuşması tek turn'de FR'ye kayar (char-switch pm:563-577, <200 karakter yeterli).
- `month-names.ts` **"octubre" yok** (`grep -c` = 0); ES Ekim tarihi çözülmez.
- TR-only prompt kuralları: stages/index.ts:50 (aynı destinasyonu listele), :325 ("her Cuma" uydurma yasağı), lead-capture "✍️" (yukarıda) `[AJAN]`.
- `buildPaymentPromptSummary` TR/EN (payment-message.ts:42-66) ve 5 LLM-add-on TR/EN (pm:5545-5606) — LLM'e gidiyor, müşteriye değil; düşük.
- **Para birimi deterministik bloklardan sonra bozulmuş mu?** Çoğu dal `formatPriceSync` üzerinden (dil→para birimi + tur para birimi dual) ✔. Bozuk noktalar: L3 revalidasyon (pm:645 `toLocaleString("tr-TR") + currency kodu`, `[KOŞUM S2]` EN'de "1.000 TRY"), B1 bütçe etiketi her dilde "TRY" + ham fiyat karşılaştırması (`[KOŞUM S3]` DE "unter 500 TRY" → 120€'luk tur listelendi, 1000₺'lik elendi), 17-BV `${price}₺` (pm:5702), prompt listesi ₺ (helpers.ts), `formatPriceSync` ana tutar `tr-TR` gruplama (currency-display.ts:87) vs çevrilmiş tutar `en-US` (:108) `[AJAN]`.

---

## 6. Dayanıklılık

| Konu | Durum `[KOD]` | Not |
|---|---|---|
| **NLU_TIMEOUT (15 sn)** | nlu.ts:112-123 abort → `throw NLU_TIMEOUT` → retry döngüsü **yalnız 503/529**'u yeniden dener (:467) → timeout dış `catch`'e düşer (:563) → `buildFallbackNLU`. Yani timeout'ta **retry yok**, tek şans. | Fallback NLU'nun dil çıktısı `detectFallbackLanguage` (:42-51) → çoğu mesajda "tr"; tool-use dönmezse `language:"tr"` sabit (:494). İlk mesajda NLU dili **otorite** (pm:1102-1105) → script tespiti ezilir. `[KOŞUM S4]` RU "Хочу забронировать…" ve AR mesaj → `lang=tr`, Türkçe fallback cevabı. → bulgu E1 |
| **LLM arızası** | ai.ts: 25 sn × 2 deneme, 429 Retry-After'lı; E4-2 2.+ ardışık arızada gerçekçi mesaj (pm:5645-5648). | Sağlam. En kötü toplam gecikme ≈ 15 + 25×2 + bekleme ≈ 65 sn+. |
| **Oturum sıfırlama** | Adapter TTL sentinel → pm:446-545 görünür reset + P9-C tek-adaylı hatırlatma; state restore bilinçli yok. | Doğru. "eski konuşmayı sildim" ifadesi için ayrı dal yok; `detectCancellation` "baştan başla/sıfırla" yakalar (sm:311). |
| **Meta 24h penceresi** | Bot yalnız gelen mesaja cevap verir → pencere tanım gereği açık. Canned yolu artık user satırını da yazıyor (webhook:513-516, Y1-D) → panel pencere kontrolü doğru. | Risk yok. Proaktif gönderimler (reminder/follow-up) kapsam dışı. |
| **Aynı mesajın iki kez gelmesi** | `process_whatsapp_message_atomic` RPC işlemden **önce** (webhook:306-317) → DUPLICATE → 200. Meta retry'ı işlem sürerken gelse bile yutulur. ✔ | İyi tasarım. **Demo-chat'te dedup yok** (sessionId); hızlı çift gönderim load/save yarışı → DOĞRULANMADI. Test yok (H2). |
| **Senkron işleme** | Webhook 200'ü `processChatMessage` **bittikten sonra** döner (webhook:638-677). | Meta'nın zaman aşımı eşiği DOĞRULANMADI; 65 sn'lik kötü-durumda Meta retry eder (dedup yutar) ama tekrarlayan yavaşlıkta webhook'un devre-dışı bırakılma riski var. Kök katman: ack-then-process (`EdgeRuntime.waitUntil`). → F3 |
| **Kota/kredi bitmesi** | Mesaj limiti/abonelik: webhook:386-435 → müşteriye 24h'de 1 kez bildirim, **müşteri mesajı conversations'a yazılmıyor** (yalnız `[unavailable]` system satırı) → acente panelde müşterinin ne yazdığını **görmez**; 24h içinde ikinci mesaj tamamen sessiz. | → F1. Tur verisi yüklenemezse (TOUR_DATA_UNAVAILABLE) nazik mesaj ✔. Anthropic kredi bitmesi = LLM arızası yolu ✔. |
| **Rate-limit RPC hatası** | webhook:341-345 `return 200` — cevap yok, mesaj kaybı, log dışında iz yok. | → F2 (fail-closed yerine fail-open olmalı). |
| **Aylık sayaç** | okuma-değiştir-yazma (webhook:370, 660) vs canned yolunda RPC increment (:522) → eşzamanlı mesajlarda düşük sayım. | → F4 |
| **Saat dilimi** | `today` UTC (webhook:471, demo, pm:625) vs Europe/Istanbul (pm:501, 4000). | 00:00-03:00 İstanbul arasında "bugün kalkmış" tur hâlâ listelenir/rezerve edilebilir. → F5 |

---

## 7. Test kapsamı: ne korunuyor, ne korunmuyor

`[AJAN]` haritası, kilit iddialar kaynakta doğrulandı (test_behavioral.ts:5779-5780, :4916-4923; e2e:212; `.github` yok).

- **Handler hiç import edilmiyor.** `test_behavioral.ts` gerçek extractor/matcher/validator/`processTransition`/`detectConfirmation` modüllerini çağırıyor (~480-520 gerçek davranışsal çağrı) — **değerli**. Ama handler'ın 76 erken-return'ü, sıra-bağımlılıkları ve inline mantığı test dışı; ~110-130 assertion **test dosyasına kopyalanmış** mantığı (`_evaluateLayer2`, `_shouldTriggerDateList`, `_applyFlowReturnSuffix`…) test ediyor, ~22'si kaynak-metin grep'i. `test_e2e_reservation_flows.mjs` "ayna" FSM'i gerçek FSM'den ayrışmış (iptal regex'i `\b` vs lookaround; `detectCancellationGuarded` yok) + 155 kaynak-substring kontrolü.
- **"Test yeşil ≠ canlı çalışıyor" somut örnekleri:** X8 testi TR+EN regex + `price` üst-alan mock'u (gerçek: 7 dil + `dates[].price_adult` min/max); `nlu-ab-run.ps1` Sonnet ölçerken prod Haiku; grep kontrolleri erken-return gölgesinde geçer; e2e'de NLU her adımda elle "mükemmel" `extracted` alıyor → gerçek NLU+extractor zinciri atlanıyor.
- **Testsiz kritik yollar:** NLU timeout/fallback, dedup, 24h/limit/abonelik kapısı, `create_reservation` RPC hata dalları (QUOTA_EXCEEDED/DUPLICATE/…), 7-dil para birimi, tur karşılaştırma, off-topic LLM yolu, WhatsApp adapter TTL, webhook imza/rate-limit.
- **CI yok, npm test yok;** `node scripts/test_e2e_reservation_flows.mjs` Deno yoksa **sessizce atlıyor** (e2e:59-65, 110-112). Deno makinede `~/.deno/bin`'de var ama PATH'te yok → "çalıştırdım, yeşil" raporu Deno'suz koşumda boş olabilir.
- **Bu denetimin harness'i** (`scratchpad/harness.ts`, repoya girmedi): `processChatMessage` stub adapter + stub `supabase` + `--allow-net` (esm.sh cache) ile **import edilip koşturulabiliyor**; API anahtarı olmadan NLU/LLM arıza-moduna düşüyor, deterministik dallar gerçek. 8 senaryo, 4'ü bug kanıtladı (S1, S2, S3, S4, S5, S6, S7). "Modülü import etmek supabase-js zincirini çeker" (test_behavioral.ts:5779) engeli **gerçek değil**.

---

## 8. Bulgular (kök-gruplu)

Önem ölçeği: **KRİTİK** = yanlış rezervasyon / veri kaybı / müşteri çıkmazı · **YÜKSEK** = ürün vaadi canlıda çalışmıyor veya dil/arıza-modunda bozuk davranış · **ORTA** = yanlış/eksik mesaj, tutarsızlık · **DÜŞÜK** = kozmetik/teorik.

### Grup A — Kök: "Liste indeksi ≠ seçim indeksi" (tek tarih-listesi primitifi yok)

| ID | Önem | Alan | Kanıt | Kök neden | Düzeltme katmanı | Diller |
|---|---|---|---|---|---|---|
| **A1** | **KRİTİK** | Rezervasyon doğruluğu | `[KOŞUM S6]` CONFIRMING "evet" → RPC QUOTA_EXCEEDED → liste "1) 20.12 2) 25.12 3) 5.01" (dolu d1 filtrelenmiş, **yerel** indeks, pm:4971-4980) → kullanıcı "2" → extractor Blok 8 `tour.dates[n-1]` (**global**, info-extractor.ts:577-585) → **20.12.2026 seçildi, özet 20.12 gösterdi**; kullanıcı 25.12 istemişti. | Liste üreten 7 yer, seçim çözen 1 yer; indeks sözleşmesi yok. V9 (:10f) bunu bildiği için global indeks kullandı (pm:3917) ama diğer listeler kullanmadı. | **Kök:** tek `buildDateList(tour, filter, lang)` helper'ı → satırları basar **ve** `context.listedDateIds: string[]` yazar; Blok 8 `listedDateIds[n-1]` çözer (yoksa global fallback). Tüm 7 liste bu helper'dan geçer. | 7 |
| **A2** | **YÜKSEK** | Müşteri çıkmazı | `[KOŞUM S1]` d1 (1 yer) seçiliyken "5 kişi" → H-pax listesi (yerel indeks, pm:2538-2549) basıldı, **state `waiting_for_pax` + dateId=d1 korundu** (pm:2609-2613 bilinçli) → kullanıcı "2" → **pax=2 sanıldı** → "2 kişi için … sadece 1 yer" → aynı liste tekrar. Rakamla liste seçimi imkânsız; kullanıcı tarihi yazıyla yazmak zorunda. | H-pax tarih listesi basıp adımı tarihe çekmiyor; Blok 8 `expectedInput === "date"` şartı. | A1 helper'ı + H-pax sonrası `collectionStep = waiting_for_date` (pax niyeti `pendingPax` olarak saklanıp tarih seçilince uygulanır). | 7 |
| **A3** | **ORTA** | Mesaj kalitesi / dil | `[KOŞUM S2]` EN akışında L3 revalidasyonu: "1) 2026-12-10 – 1.000 TRY" (ham ISO, `tr-TR` sayı, para kodu, pm:643-647; başlık lokalize edilmemiş pm:663 `_resTour.title`), `.slice(0,5)` yerel indeks. | Dal, diğer listelerden önce (2026-06) yazılmış, `formatDateForLanguage`/`formatPriceSync` zincirine hiç bağlanmamış. | A1 helper'ı. | 7 (TR dahil ISO) |
| **A4** | **ORTA** | Sıralama | `tour-cache.ts:84` `select("*, dates:tour_dates(*)")` ORDER BY yok; webhook/demo sort etmiyor (`grep sort(` = 0). `dates[0]` "ilk/temsilî tarih-fiyat" varsayımı: B1 (pm:1441), B-DUR (1572/1596), B-DUR2 (1650), B-ATTR (1738/1743), B-TEMA (1814), B2 (3584), UNKNOWN (3640), :11a-AUTO (4258), `formatToursList` (helpers). X8 bunu CİLA-4-C'de kendi içinde düzeltti (pm:1202-1210), diğerleri düzeltilmedi. | PostgREST embed sırası tanımsız; "ilk tarih" kavramı kodda tanımlı değil. | **Kök:** `_refreshQuota` çıkışında `dates.sort(departure_date)` (tek yer) + `representativePrice(tour)` helper'ı (min fiyat veya en yakın tarih). | 7 |

### Grup B — Kök: Giriş noktası tur-nesnesi beyaz-listesi (iki kopya mapping)

| ID | Önem | Alan | Kanıt | Kök neden | Düzeltme katmanı | Diller |
|---|---|---|---|---|---|---|
| **B1** | **YÜKSEK** | Ürün vaadi (vize/otel) | `whatsapp-webhook/index.ts:472-495` ve `demo-chat/index.ts:270-294` tur nesnesini elle kopyalar; `visa_notes`, `visa_required`, `hotel_name`, `hotel_stars`, `min_pax`, `program_url` **taşınmaz**. :10c vize dalı `_visaTour?.visa_notes` (pm:3702) ve `visa_required === true` (pm:3713) **her zaman false** → daima jenerik "acenteye danışın" (`[KOŞUM S5]`). B-ATTR `min_pax` (pm:1729) daima null. `formatTourDetails` otel/vize "SİSTEMDE KAYITLI OLMAYAN" (`[AJAN]`). Acente panelde vize notu girse bile bot kullanmaz. | DB→bot nesne dönüşümü iki giriş noktasında ayrı ayrı elle yazılmış; shared tarafında `BotTour` tipi/dönüştürücü yok. | **Kök:** `shared/utils/tour-cache.ts` (veya yeni `shared/services/bot-tour.ts`) içinde tek `toBotTours(raw, lang, today)` fonksiyonu; iki giriş noktası yalnız onu çağırır. Beyaz-liste yerine "bilinen alanlar + dates filtresi". Suite'e "DB kolonu → BotTour alanı" eşleme testi. | 7 |
| **B2** | **ORTA** | Müsaitlik şeffaflığı | Giriş noktaları `remaining_quota > 0` tarihleri **önden siler** (webhook:493, demo:290-291) → "Sorun H α: dolu tarihi ETİKETLE, gizleme" (pm:4110-4116) ve `quotaLabel(…, isFull)` canlıda **ulaşılmaz**; L3 `_quotaFull` dalı (pm:627) ulaşılmaz — dolu tarih "artık mevcut değil" olarak görünür; "20'si müsait mi?" (:10e) dolu tarih için "görünmüyor" der (doğru ama gerekçesiz). | Filtre giriş noktasında, etiketleme handler'da — iki katman aynı kararı farklı veriyor. | B1 dönüştürücüsünde dolu tarihleri **tut, `isFull` işaretle**; seçim/RPC tarafı zaten `hasQuotaForPax` ile korunuyor. | 7 |

### Grup C — Kök: LLM'e giden tur verisi eksik/ham, çıkışta sayısal doğrulama yok

| ID | Önem | Alan | Kanıt | Kök neden | Düzeltme katmanı | Diller |
|---|---|---|---|---|---|---|
| **C1** | **YÜKSEK** | Halüsinasyon (saat/fiyat) | §3.1-3.2. `formatToursList` (helpers.ts:26-141) saat/kalkış/süre içermez, `₺`/`TRY` sabit; guard alanı "kullan" diyor (stages:337) ama alan yok; çoklu eşleşmede B-ATTR atlanır (pm:1701 `_richTourName`); `response-validator.ts`'de rakam/saat/tarih ↔ DB kontrolü **yok**. Pamukkale 07:00/08:00 canlı izleri kodda (tour-matching.ts:303, helpers.ts:167/209). | Liste prompt'u "kısa" tutulmak için alanlar kırpılmış; validator yalnız sahte-onay sınıfı için yazılmış. | (1) `formatToursList`'e `toplanma_saati`/`hareket_noktasi`/`tur_sure` + `formatPriceSync` (fx) — "veri yoksa satır yok" kuralı; (2) post-LLM **sayısal muhafız**: cevaptaki `HH:MM` ve para tutarlarını `tours[]` kümesiyle karşılaştır, kümede yoksa cümleyi düşür/şablona çevir (17-BV deseniyle aynı yer); (3) çoklu-eşleşme + öznitelik sorusu → B-ATTR'ı `multipleTourMatches` üzerinde çalıştır. | 7 |
| **C2** | **ORTA** | Para birimi / veri | 17-BV replacement listesi `${d.price_adult}₺` (pm:5702) tur para birimini ve dual-currency'yi yok sayar. `createTourRef` fallback'i (tour-matching.ts:292-308) `konaklama/ulasim` taşımaz `[AJAN]`. | Yama-dalları ortak fiyat helper'ına bağlanmamış. | `formatPriceSync` zorunlu (lint/suite muhafızı: handler'da `₺` literal'i yasak). | 6 (TR hariç) |
| **C3** | **DÜŞÜK** | Prompt tutarlılığı | Roles "net fiyat yazma" vs `formatTourDetails` fiyat basıyor `[AJAN]`; `antiContradictionPrompt` "'tarih bulunamadı' deme" (pm:5564) — tur tarihsizse LLM'i yalan söylemeye zorlayabilir (O6/D3 dalları çoğu durumu kesiyor). | Prompt kuralları farklı zamanlarda eklenmiş. | Prompt kural envanteri + çelişki temizliği (tek doküman). | 7 |

### Grup D — Kök: Para birimi semantiği girdi tarafında tanımsız

| ID | Önem | Alan | Kanıt | Kök neden | Düzeltme katmanı | Diller |
|---|---|---|---|---|---|---|
| **D1** | **ORTA** | B1 bütçe | `[KOŞUM S3]` DE "Touren unter 500" → etiket "unter 500 TRY", **ham** `price_adult` karşılaştırması (pm:1443-1446): 120 EUR'luk tur "500'ün altında" listelendi, 1000 TRY'lik elendi. Girdi regex'leri yalnız `tl|₺` (pm:1323-1356). | Kullanıcı sayısının para birimi hiç modellenmemiş; turlar arası para birimi karışık olabilir. | Girdi para birimini çöz (`€/eur/dolar/$` + yoksa `LANG_TO_CURRENCY[lang]`), karşılaştırmayı tek para biriminde yap (`convertSync`), etiketi o birimde bas. | 6 |
| **D2** | **DÜŞÜK** | Format | `formatPriceSync` ana tutar `tr-TR` gruplama (currency-display.ts:87), çevrilmiş tutar `en-US` (:108) → "142€ (5.000₺)" karışık `[AJAN]`. | İki satır farklı zamanda yazılmış. | Tek `Intl.NumberFormat(localeFor(lang))`. | 6 |
| **D3** | **DÜŞÜK** | Tutar tutarlılığı | `[KOŞUM S7]` `price_child = 0` (açık sıfır = çocuk ücretsiz): özet/completion `_reservationTotalText` `priceChild \|\| priceAdult` (pm:156-157) → **3.000₺**; RPC snapshot + kapora `calculateTotal` `priceChild == null ? adult : 0` (finance.ts:37) → **2.000**. Panel boş bırakınca `null` yazıyor (BulkDateGenerator.tsx:143) → yalnız açık 0'da tetiklenir. | İki toplam formülü. | `_reservationTotalText` `calculateTotal`'ı çağırsın (tek kaynak kuralının kendi ihlali). | 7 |

### Grup E — Kök: NLU arıza-modu ve dil tespiti

| ID | Önem | Alan | Kanıt | Kök neden | Düzeltme katmanı | Diller |
|---|---|---|---|---|---|---|
| **E1** | **YÜKSEK** | Dayanıklılık × dil | `[KOŞUM S4]` ilk mesaj RU/AR + NLU arızası (timeout/outage/key) → `detectLanguage` ru/ar bulur (language.ts:16-17) → `buildFallbackNLU` dili `detectFallbackLanguage` (nlu.ts:42-51) veya sabit `"tr"` (:494) → ilk-mesaj NLU otoritesi (pm:1102-1105) **script tespitini ezer** → `lang=tr`, Türkçe cevap. NLU_TIMEOUT retry edilmiyor (nlu.ts:467 yalnız 503/529). | Fallback NLU "başarılı NLU" ile aynı güven düzeyinde tüketiliyor; `NLUResult`'ta "degraded" işareti yok. | **Kök:** `NLUResult.degraded = true` (fallback/timeout/no-tool) → dil yazma kapıları degraded'de **kapalı**, `detectLanguage` otorite; timeout'a 1 retry (503/529 ile aynı sınıf). | ru, ar, (ASCII olmayan tüm diller) |
| **E2** | **ORTA** | Ölü regex dalları | `\b` non-ASCII bitişiğinde: sm:648 (`да`/`نعم`/`sí`), nlu.ts:93, pm:1965, simple-extractor.ts:756-759 (`_SKIP_EMAIL` de/ru/ar), sm:71 `\w`. Kodun kendi kuralı "ASCII \b YOK — \p{L}\p{N} lookaround" (pm:169, 182) ihlal ediliyor. | Kural var, muhafızı yok. | Suite'e **statik muhafız**: `shared/**` içinde `\b` + non-ASCII alternatif içeren regex literal'i → kırmızı. 5 yeri lookaround'a çevir. | ru, ar, es, de |
| **E3** | **ORTA** | Akış-ortası dil kayması | `language.ts:14` FR seti ES'ten önce, `é` içeriyor → "¿Qué…?" → fr; char-switch (pm:563-577) <200 karakterde tek turn'de dili değiştirir. `detectLanguageChangeIntent` substring ("İngilizce rehber var mı?" → en) `[AJAN]`, DOĞRULANMADI. | Script-tespiti dil-aileleri arasında ayrım yapamıyor; explicit-intent regex'i soru/istek ayırmıyor. | `detectLanguage` ES-özgü (`ñ ¿ ¡ í ó`) FR'den önce; FR yalnız FR-özgü (`œ æ ê ë`); char-switch mid-flow için 2-ardışık kuralı (pending ile aynı). | es, fr, tr→en |
| **E4** | **DÜŞÜK** | Dil kapsaması kalıntıları | "octubre" yok (month-names.ts); `isInformationalMessage` TR-only (sm:55); `isAfterSalesMessage` booking/timing TR-only (sm:442-448); `hasNewReservationIntent` AR yok (sm:64); TR-only prompt kuralları (stages:50, :325) ve lead "✍️" yalnız TR (stages:66/336/350 vs :85/373/383) `[AJAN]`; `agency.language_preference` ölü (pm:1095 vs :602). | Parite süpürmeleri sözlüklere odaklanmış, FSM/prompt-kuralı/ayar katmanı atlanmış. | Parite envanterine FSM-yardımcıları + stage-prompt kuralları eklensin; `language_preference` ya `createInitialContext` varsayılanı olsun ya panelden kalksın. | es, ar, en+5 (lead) |

### Grup F — Kök: Webhook giriş noktasında "mesajı düşür" yolları iz bırakmıyor

| ID | Önem | Alan | Kanıt | Kök neden | Düzeltme katmanı | Diller |
|---|---|---|---|---|---|---|
| **F1** | **YÜKSEK** | Kota/abonelik | webhook:386-435: limit/abonelik dolunca müşteriye 24h'de 1 bildirim, **müşteri mesajı `whatsapp_conversations`'a yazılmıyor** (yalnız `[unavailable]` system satırı :421-426) → acente müşterinin ne yazdığını görmez; 24h içindeki sonraki mesajlar tamamen sessiz. Lead kaybı. | "Bot kapalı" = "kayıt kapalı" sanılmış; bot-pause yolu (:583-585) doğru yapıyor (mesajı kaydediyor). | Limit dalında da `role=user` satırı yaz + `metadata.dropped_reason`; panelde "bot cevaplamadı" rozeti. Ürün kararı gerekirse: limit aşımında salt-kayıt modu. | 7 |
| **F2** | **ORTA** | Sessiz kayıp | webhook:341-345 `check_rate_limit` RPC hatası → `return 200`, cevap yok, kayıt yok, müşteriye sinyal yok. | Fail-closed. | Fail-open (hata → `allowed=true` + `logCritical`). | 7 |
| **F3** | **ORTA** | Gecikme / Meta | Senkron işleme (webhook:638-677); kötü-durum ≈65 sn+. Dedup RPC işlem **öncesi** (:306) → retry yutulur ✔. Meta'nın eşiği/devre-dışı bırakma politikası DOĞRULANMADI. | Webhook = işlemci. | `EdgeRuntime.waitUntil(process…)` ile **önce 200, sonra işle**; dedup zaten önde olduğu için güvenli. | 7 |
| **F4** | **DÜŞÜK** | Faturalama | Aylık sayaç okuma-değiştir-yazma (webhook:370/660) vs canned yolunda RPC increment (:522); eşzamanlı mesajlarda düşük sayım. Demo-chat'te dedup/idempotency yok (sessionId yarışı) DOĞRULANMADI. | İki sayaç yolu. | Her yolda `increment_agency_message_count` RPC. | — |
| **F5** | **DÜŞÜK** | Saat dilimi | `today` UTC (webhook:471, demo, pm:625) vs Europe/Istanbul (pm:501/4000). 00:00-03:00 İstanbul'da bugün kalkmış tur hâlâ rezerve edilebilir. | Tek `todayIstanbul()` helper'ı yok. | `shared/utils/date.ts` `todayIST()`; 4 yer onu kullanır. | — |

### Grup G — Kök: Primitif eksikliği (özet/pending/liste) + doküman sapması

| ID | Önem | Alan | Kanıt | Kök neden | Düzeltme katmanı | Diller |
|---|---|---|---|---|---|---|
| **G1** | **ORTA** | Özet tutarlılığı | 6 etiket tablosu kopyası (pm:292, 2770, 2849, 4661, 4754, 5427), 3 builder. A2/A3 özetlerinde **💰 Toplam yok** (pm:2787-2794, 2915-2922) — pax değişince toplam değişir ama müşteri görmez; DAL1/PAKET-B/:13/:13-PERSIST/FIX3'te var. "Tek kaynak" kuralının (pm:147-148) kendi ihlali. | A2/A3 PAKET-B'den (2026-07-25) önce yazılmış, geri taşınmamış. | `_buildUpdatedSummary`'yi tek builder yap; A2/A3/:13/:13-PERSIST/FIX3 onu çağırsın; 5 kopya tablo silinir (net-negatif kod). | 7 |
| **G2** | **ORTA** | Çift-karar | §2.2 tablosu: niyet-yükseltme ×2 katman, onay ×8 çağrı (sıra-bağımlı muafiyetler pm:3443-3447), tur-değişim ×6 yer (FSM T10/T11 COLLECTING/CONFIRMING'de ölü), FAQ muafiyet listesi ×4 (kod TODO pm:3418), **7 ayrı tek-turn pending bayrağı** her biri kendi temizlik/çakışma kuralıyla. | Her canlı vaka için yeni dal; dalları birleştiren refactor turu hiç yapılmamış. | (1) `FAQ_INTENTS` sabiti; (2) `context.pending: {kind, payload, turn}` tek alanı + tek temizleme noktası; (3) FSM T10/T11'i kaldır **veya** G5'i FSM'e taşı (ikisinden biri). | 7 |
| **G3** | **DÜŞÜK** | Ölü kod | FIX3 (pm:5398-5463), A1 LOG-ONLY (pm:2652-2712), `language_preference`, `DEMO_TOURS` (DOĞRULANMADI), tek-kollu `.then` (pm:1121). | Sigorta-kodu silinmiyor. | Pre-delete tablosu ile temizlik; FIX3 için "1 ay log'da görülmediyse sil" kuralı zaten yorumda. | — |
| **G4** | **DÜŞÜK** | Doküman | ARCHITECTURE_GUARDS G3 "AÇIK BUG: aslında 3 olsun" vs kodda X9-change + W6-cila (pm:3453-3472); G11 "buildTourChangePrefix TR+EN" vs 7 dil (tour-change.ts:169); satır referansları ±10 toleransı aşmış (ör. "R6 ~L1824" → gerçek pm:3405). | Doküman 1.511 satır, elle senkron. | Satır referansı yerine section-id; "AÇIK BUG" girdileri için koşum-kanıtı zorunlu. | — |

### Grup H — Test

| ID | Önem | Alan | Kanıt | Kök neden | Düzeltme katmanı |
|---|---|---|---|---|---|
| **H1** | **YÜKSEK** | Kapsam yanılsaması | §7. Handler offline test edilmiyor; e2e ayna ayrışmış (e2e:212 `\b` vs sm:311 lookaround, `detectCancellationGuarded` yok); 155 + 22 kaynak-grep; CI yok; Deno yoksa sessiz atlama (e2e:59-65). Bu rapor harness'i handler'ın import edilebildiğini gösterdi. | "Handler import edilemez" varsayımı (test_behavioral.ts:5779) sorgulanmamış. | **Katman-2 harness** (stub adapter + stub supabase + NLU/LLM enjekte edilebilir) repoya; A1/A2/S4/S6 senaryoları ilk testler; `npm test` + pre-push gate (Deno PATH kontrolü **sert** hata). |
| **H2** | **ORTA** | Mock'un gerçeği maskelemesi | X8 testi TR+EN regex + `price` üst-alan (gerçek 7 dil + `dates[].price_adult`); NLU her testte mükemmel `extracted`; `nlu-ab-run.ps1` Sonnet ölçüyor, prod Haiku (nlu.ts:26); e2e "completed" simüle (e2e:467). Testsiz: NLU timeout, dedup, 24h/limit, RPC hata dalları, 7-dil kur, karşılaştırma, off-topic LLM yolu. | Fixture şemaları gerçek `getCachedTours` şemasından türetilmiyor. | Fixture'ları tek `mkTour()` fabrikasından üret (DB şemasıyla aynı alanlar); kopya-mantık testlerini (`_evaluateLayer2` vb.) harness'e taşı; ayna e2e'yi emekli et. |

---

## 9. Önerilen düzeltme sırası

**Paket 0 — Lansman öncesi ŞART** (yanlış rezervasyon / müşteri çıkmazı / ürün vaadi / arıza-modu)
1. **A1 + A2 + A3 + A4** — tek `buildDateList` primitifi + `listedDateIds` seçim sözleşmesi + `dates.sort` tek yerde. Kanıt: S1/S6 harness senaryoları yeşil, 7 listenin tamamı helper'dan geçiyor (grep muhafızı: handler'da `departure_date` + `i + 1` şablonu kalmadı).
2. **B1 (+B2)** — `toBotTours()` tek dönüştürücü; vize/otel/min_pax alanları taşınır; dolu tarihler `isFull` ile tutulur. Kanıt: S5'te `visa_notes` doluyken 🛂 notlu cevap; "DB kolonu → BotTour" eşleme testi.
3. **E1** — `NLUResult.degraded` + dil-yazma kapıları + timeout retry. Kanıt: S4 harness'te RU/AR mesaj → `lang=ru/ar`.
4. **F1 + F2** — düşürülen müşteri mesajı her zaman kaydedilir; rate-limit RPC hatası fail-open. Kanıt: webhook birim-harness'i (payload → DB satırı).
5. **H1** — harness repoya + `npm test` + Deno sert-kontrol. (1-4'ün kanıtı buradan geçer.)

**Paket 1 — Lansman öncesi önerilir** (halüsinasyon yüzeyi + dil)
6. **C1** — liste prompt'una saat/kalkış/süre + `formatPriceSync`; post-LLM sayısal muhafız (HH:MM ve tutar ↔ `tours[]`); çoklu-eşleşmede B-ATTR.
7. **D1** — bütçe girdisinin para birimi; **C2** — `₺` literal yasağı muhafızı.
8. **E2** — `\b` statik muhafız + 5 düzeltme; **E3** — `detectLanguage` sırası.
9. **G1** — tek özet builder (5 kopya tablo silinir).

**Paket 2 — Sonra** (tutarlılık, temizlik, ölçek)
10. **G2** — `pending` tek alanı, `FAQ_INTENTS`, FSM T10/T11 vs G5 kararı.
11. **F3** — ack-then-process; **F4/F5** — sayaç RPC, `todayIST()`.
12. **E4, D2, D3, C3, G3, G4, H2** — parite kalıntıları, format, çocuk-fiyat formülü, prompt envanteri, ölü kod, doküman, fixture fabrikası.

**Disiplin notu:** Paket 0'daki her madde "yeni dal ekleme" değil "mevcut dalları tek primitife bağlama" işidir; her biri net-negatif satır sayısıyla kapanmalı (pre-delete tablosu), kanıtı harness koşumu olmalı, substring testi kabul edilmemeli.

---

## 10. Ürün sahibine sade özet

Bot'un iskeleti sağlam: rezervasyonun kritik adımları (tarih listesi, onay, iptal, kontenjan) yapay zekâya bırakılmıyor, kurallarla yürüyor ve Faz3'teki beş düzeltme bildirilen sorunları doğru kapatmış. Buna rağmen bugün canlıda iki ciddi açık var: kontenjan dolunca veya kişi sayısı fazla gelince basılan tarih listesinden müşteri "2" diye seçtiğinde **yanlış tarihe rezervasyon** yapılabiliyor ya da müşteri döngüde kalıyor, ve panelde girilen **vize/otel bilgileri bot'a hiç ulaşmıyor** (her iki kanalda). Yapay zekâ arızasında Rusça/Arapça yazan müşteriye Türkçe cevap gidiyor, mesaj limiti dolduğunda müşterinin yazdıkları panelde görünmüyor. Saat/fiyat uydurma riski müsaitlikten farklı olarak yalnız prompt kuralıyla sınırlı; Pamukkale'deki çift saatin kökü büyük olasılıkla tur henüz netleşmeden sorulan sorularda saat bilgisinin prompta girmemesi (canlı veriyle doğrulanmalı). Testler çok ama ana işleyiciyi hiçbiri çalıştırmıyor; bu denetimde yazılan küçük koşum düzeneği bunun mümkün olduğunu gösterdi — Paket 0'daki beş iş lansman öncesi şart, geri kalanı sonraya bırakılabilir.
