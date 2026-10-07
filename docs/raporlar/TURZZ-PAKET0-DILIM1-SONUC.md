# PAKET-0 · Dilim 1 — H1 (Katman-2 harness) + Grup A (A1–A4) — Sonuç Raporu

**Tarih:** 2026-10-07 · **Kaynak:** `docs/raporlar/TURZZ-FABLE-DENETIM.md` §8 Grup A + H1 · **Kapsam dışı (dokunulmadı):** B, C, D, E, F, G, H2 grupları · **Commit:** tek commit, **push/deploy YOK**.

---

## 1. Yapılanlar

### H1 — Katman-2 harness (`supabase/functions/_tests/harness/`)
- `processChatMessage` **gerçek kodla** import edilir; yalnız I/O stub: `mkAdapter` (loadContext/history/save/send), `mkSupabase` (chainable `.from()`, `rpc` adına göre enjekte edilebilir sonuç — ör. `create_reservation_with_quota_check → QUOTA_EXCEEDED`).
- **NLU/LLM enjeksiyonu prod koduna dokunmadan:** `import_map.json` `shared/fsm/nlu.ts` → `stubs/nlu.ts`, `shared/services/ai.ts` → `stubs/ai.ts`, `_shared/error-sink.ts` → `stubs/error-sink.ts` ile değiştirir (Deno import-map tam-URL eşleşmesi; gerçek nlu.ts `?real` sorgusuyla ayrı modül olarak yüklenir → döngü yok).
  - `setNluMode({kind:"fallback"})` → gerçek `analyzeUserMessage`, API anahtarı silinmiş → **gerçek `buildFallbackNLU`** (arıza modu, prod ile birebir); `{kind:"fixed", fn}` → sabit NLUResult.
  - `setAiMode({kind:"fail"})` → `AI_TIMEOUT` (handler fallback yolu); `{kind:"fixed", reply}` → sabit cevap; `lastAiParams` ile prompt okunabilir.
- `runTurn()` → `{reply, stateIn (klon), stateOut, rpcCalls}`; `dumpTurn()` STATE_IN/BOT/STATE_OUT dökümü (`HARNESS_KANIT=<dosya>` ile dosyaya).
- Klasör `_tests` (alt-çizgi): Supabase CLI alt-çizgili klasörleri fonksiyon saymaz (`_shared` kuralı) → deploy etkilenmez.
- **`npm test`** = `scripts/test_all.mjs`: suite (`scripts/test_behavioral.ts`) + harness (`deno test`). Deno PATH / `~/.deno/bin` / `DENO_BIN`'de yoksa **exit 2 + sert hata**; sessiz atlama yok. Harness `--no-check` koşar (prod'da 7 önceden-var-olan tip hatası — §5).

### A4 — Tarih sıralaması tek yerde + temsilî tarih
- `shared/utils/tour-dates.ts` (yeni): `sortTourDates(tours)` (departure_date ASC, girdiyi değiştirmez), `representativeDate(tour)` (kronolojik ilk **kontenjanlı + fiyatlı** tarih; yoksa kronolojik ilk).
- `tour-cache.ts _refreshQuota` çıkışı `sortTourDates`'ten geçer (iki return yolu da) → tüm tüketiciler sıralı veri alır.
- `dates?.[0]` varsayımı **15 yerde** `representativeDate` ile değiştirildi: handler 11 (B1, B-DUR ×2, B-DUR2, B-ATTR ×2, B-TEMA, B2, UNKNOWN_TOUR, :11a-AUTO, :11a-MANUAL, A2 fiyat-prefix), `prompts/helpers.ts` 4 (`formatToursList` ×3 ton, `formatTourDetails`). :11a-AUTO artık önce **atanan tarihin** fiyatını basar.
- Dokunulmayan: info-extractor Blok 10 `dates[0]` (`length === 1` şartlı — doğru), X8 (zaten MIN/MAX).

### A1 + A2 + A3 — Tarih listesi tek primitif
- `shared/services/date-list.ts` (yeni): `buildDateList(tour, dates, ctx, {lang, price?, quota?, weekday?, max?})` → satırları basar (`formatDateForLanguage` + gün adı + `formatPriceSync` + `quotaLabel`) **ve** `ctx.listedDateIds` yazar; `resolveListedDate(n, dates, listedDateIds)` → liste varsa `listedDateIds[n-1]`, liste dışı numara **global'e düşmez**; liste yoksa kronolojik global.
- `types.ts`: `listedDateIds?: string[]`, `pendingPax?: number`.
- info-extractor **Blok 8**: `resolveListedDate` üzerinden çözer.
- Handler: dateId değiştiğinde `listedDateIds` temizlenir (FSM-sonrası tek nokta).
- **7 üretici** bağlandı (hepsi `buildDateList`): L3 revalidasyon · `_buildAvailableDatesText` (H-β + H-pax) · :11 · :10f · 9b-A · QUOTA_EXCEEDED · 17-BV.
- **H-pax (A2):** alternatif tarih varsa dolu `dateId/selectedDate` silinir, `collectionStep=waiting_for_date`, pax niyeti `pendingPax`; H-pax ön-kontrolü `extractedInfo.paxAdult ?? context.pendingPax`. FSM-sonrası **PENDING-PAX UYGULA** (tek nokta): uygun tarih seçilince `paxAdult` yazılır, adım yeniden hesaplanır (tümü doluysa CONFIRMING → :13 özeti), 7-dil ack prefix'i :11b/:11c'ye. Alternatif yoksa eski davranış (state dokunulmaz).
- Yan düzeltmeler aynı primitiften: L3 lokalize başlık + `slice(0,5)` kalktı; QUOTA_EXCEEDED filtresi `hasQuotaForPax(d, totalPax)` (eski `1` — grup sığmayan tarih listelenip yeniden QUOTA_EXCEEDED yiyordu); 17-BV `₺` literal'i kalktı; 9b-A listesi sonrası adım tarihe çekilir (listeden "2" telefon sanılmasın); :10f yerel numara (global indeks "hack"i gereksizleşti). Tüm listelerde gün adı.
- Suite muhafızı "PAKET-0 D1" (43 assertion): statik (handler'da `.map((d, i) => …departure_date` şablonu **yok**, `buildDateList` ≥7 çağrı, `dates[0].` yok, `sortTourDates` tour-cache'te) + `resolveListedDate`/`buildDateList` (7 dil)/`sortTourDates`/`representativeDate` davranışsal.

---

## 2. Değişen dosyalar

| Dosya | Değişiklik |
|---|---|
| `supabase/functions/shared/services/date-list.ts` | **yeni** — `buildDateList`, `resolveListedDate` (72 satır) |
| `supabase/functions/shared/utils/tour-dates.ts` | **yeni** — `sortTourDates`, `representativeDate` (55 satır) |
| `supabase/functions/shared/handlers/process-message.ts` | 7 liste → primitif; 11 `dates[0]` → `representativeDate`; H-pax state + pendingPax; PENDING-PAX UYGULA; :11b/:11c prefix (+130 −117) |
| `supabase/functions/shared/services/info-extractor.ts` | Blok 8 `resolveListedDate` |
| `supabase/functions/shared/utils/tour-cache.ts` | `_refreshQuota` → `sortTourDates` |
| `supabase/functions/shared/fsm/prompts/helpers.ts` | 4× `representativeDate` |
| `supabase/functions/shared/fsm/types.ts` | `listedDateIds`, `pendingPax` |
| `supabase/functions/_tests/harness/{harness.ts, import_map.json, date_list_test.ts, stubs/{nlu,ai,error-sink}.ts}` | **yeni** — Katman-2 harness + 12 test |
| `scripts/test_all.mjs` | **yeni** — `npm test` koşucusu (Deno sert-hata) |
| `scripts/test_behavioral.ts` | +43 assertion "PAKET-0 D1" muhafızı |
| `package.json` | `"test": "node scripts/test_all.mjs"` |
| `docs/ARCHITECTURE_GUARDS.md` | §G17 + başlık |
| `deno.lock` | std/testing/asserts girdileri (deno test) |

---

## 3. Kanıtlar

### 3.1 S1 (H-pax) ve S6 (QUOTA_EXCEEDED) — ÖNCE kırmızı (4 dil)
Koşum: kaynak değişiklikleri `git stash` ile geri alınmış, testler yeni:
```
S1 [tr] H-pax listesinden '2' → listedeki 2. tarih (d4) + pax=5 ... FAILED
S1 [en] ... FAILED   S1 [ru] ... FAILED   S1 [ar] ... FAILED
S6 [tr] QUOTA_EXCEEDED listesinden '2' → listedeki 2. tarih (d3) ... FAILED
S6 [en] ... FAILED   S6 [ru] ... FAILED   S6 [ar] ... FAILED
S2 [tr|en|ru|ar] L3 revalidasyon listesi lokalize tarih + para birimi ... FAILED
error: AssertionError: listedeki 2. tarih d4 seçilmeli                       (S1 ×4)
error: AssertionError: listedeki 2. tarih d3 (25.12) seçilmeli — global 2. olan d2 DEĞİL (S6 ×4)
error: AssertionError: ham ISO tarih basılmamalı                             (S2 ×4)
FAILED | 0 passed | 12 failed (821ms)
```
Eski davranış dökümü (ham):
```
### S6a [tr] "evet" → RPC QUOTA_EXCEEDED
BOT      : Üzgünüm, seçtiğiniz tarih için kontenjan dolmuş. 😔 Başka bir tarih seçer misiniz? ⏎ 1) 20.12.2026 - 1.000₺ ⏎ 2) 25.12.2026 - 1.000₺ ⏎ 3) 5.01.2027 - 1.000₺
### S6b [tr] "2"
BOT      : 📋 Tur: *Pamukkale Turu* ⏎ 📅 Tarih: 20.12.2026 ⏎ 👥 Kişi sayısı: 2 … Onaylıyorsanız *evet* yazın ✅
STATE_OUT: stage=CONFIRMING … dateId=d2 selectedDate=2026-12-20       ← kullanıcı 25.12 (liste 2.) istedi, 20.12 (global 2.) seçildi
### S6b [en] "2"  → Date: Dec 20, 2026 · dateId=d2      ### S6b [ru] "2" → 20 дек 2026 · dateId=d2      ### S6b [ar] "2" → 20 ديسمبر 2026 · dateId=d2

### S1a [tr] "5 kişi"   (d1 seçili, 1 yer)
BOT      : *5 kişi* için *10.12.2026* tarihinde sadece *1 yer* var. 😔 ⏎ Müsait tarihler: ⏎ 1) 20.12.2026 - 1.000₺ (10 kişilik yer) ⏎ 2) 5.01.2027 - 1.000₺ (10 kişilik yer)
STATE_OUT: step=waiting_for_pax dateId=d1 pax=undefined                ← state dokunulmadı
### S1b [tr] "2"
BOT      : *2 kişi* için *10.12.2026* tarihinde sadece *1 yer* var. 😔 … 1) 20.12.2026 … 2) 25.12.2026 … 3) 5.01.2027
STATE_OUT: step=waiting_for_pax dateId=d1 pax=undefined                ← "2" pax sanıldı, DÖNGÜ
### S1b [en] "2" → "Only *1 seats* available for *2 people*…" step=waiting_for_pax · [ru] "Для *2 человек*…" · [ar] "لـ *2 أشخاص*…" — hepsi döngü

### S2 [ru] L3
BOT      : … Доступные даты для *Pamukkale Turu*: ⏎ 1) 2026-12-10 – 1.000 TRY ⏎ 2) 2026-12-20 – 1.000 TRY   ← ham ISO, TRY kodu, TR başlık (ar/en aynı)
```

### 3.2 S1 ve S6 — SONRA yeşil (4 dil, `npm test` çıktısı)
```
S1 [tr] … ok   S1 [en] … ok   S1 [ru] … ok   S1 [ar] … ok
S6 [tr] … ok   S6 [en] … ok   S6 [ru] … ok   S6 [ar] … ok
S2 [tr] … ok   S2 [en] … ok   S2 [ru] … ok   S2 [ar] … ok
ok | 12 passed | 0 failed (1s)
```

### 3.3 QUOTA_EXCEEDED sonrası "2" → 25.12 (STATE_IN/OUT + bot)
```
### S6a [tr] "evet" → RPC QUOTA_EXCEEDED
STATE_IN : stage=CONFIRMING step=ready_for_confirmation lang=tr dateId=d1 selectedDate=2026-12-10 pax=2 pendingPax=undefined listed=undefined
BOT      : Üzgünüm, seçtiğiniz tarih için kontenjan dolmuş. 😔 Başka bir tarih seçer misiniz? ⏎ 1) 20.12.2026 (Pazar) - 1.000₺ (10 kişilik yer) ⏎ 2) 25.12.2026 (Cuma) - 1.000₺ (10 kişilik yer) ⏎ 3) 5.01.2027 (Salı) - 1.000₺ (10 kişilik yer)
STATE_OUT: stage=COLLECTING_INFO step=waiting_for_date lang=tr dateId=undefined selectedDate=undefined pax=2 pendingPax=undefined listed=["d2","d3","d4"]
### S6b [tr] "2"
STATE_IN : stage=COLLECTING_INFO step=waiting_for_date lang=tr dateId=undefined … pax=2 listed=["d2","d3","d4"]
BOT      : 📋 Tur: *Pamukkale Turu* ⏎ 📅 Tarih: 25.12.2026 ⏎ 👥 Kişi sayısı: 2 ⏎ 👤 Ad-Soyad: Ali Veli ⏎ 📱 Telefon: 05551112233 ⏎ 💰 Toplam: *2.000₺* ⏎ Bilgiler doğru mu? Onaylıyorsanız *evet* yazın ✅
STATE_OUT: stage=CONFIRMING step=ready_for_confirmation lang=tr dateId=d3 selectedDate=2026-12-25 pax=2 pendingPax=undefined listed=undefined
### S6b [en] "2" → Date: Dec 25, 2026 · dateId=d3     [ru] → 25 дек 2026 · dateId=d3     [ar] → 25 ديسمبر 2026 · dateId=d3
```

### 3.4 H-pax: d1 dolu iken "5 kişi" → liste → "2" → doğru tarih + 5 kişi
```
### S1a [tr] "5 kişi"
STATE_IN : stage=COLLECTING_INFO step=waiting_for_pax lang=tr dateId=d1 selectedDate=2026-12-10 pax=undefined pendingPax=undefined listed=undefined
BOT      : *5 kişi* için *10.12.2026* tarihinde sadece *1 yer* var. 😔 ⏎ Müsait tarihler: ⏎ 1) 20.12.2026 (Pazar) - 1.000₺ (10 kişilik yer) ⏎ 2) 5.01.2027 (Salı) - 1.000₺ (10 kişilik yer) ⏎ Başka tarih seçer misiniz?
STATE_OUT: stage=COLLECTING_INFO step=waiting_for_date lang=tr dateId=undefined selectedDate=undefined pax=undefined pendingPax=5 listed=["d2","d4"]
### S1b [tr] "2"
STATE_IN : … step=waiting_for_date dateId=undefined pendingPax=5 listed=["d2","d4"]
BOT      : *5.01.2027* için *5 kişi* olarak aldım ✨ Teşekkürler! 😊 Ad ve soyadınızı alabilir miyim?
STATE_OUT: stage=COLLECTING_INFO step=waiting_for_name lang=tr dateId=d4 selectedDate=2027-01-05 pax=5 pendingPax=undefined listed=undefined
### S1b [en] "2" → "Noted *5 people* for *Jan 5, 2027* ✨ Thank you! 😊 May I have your full name?" dateId=d4 pax=5
### S1b [ru] "2" → "Записал *5 чел.* на *5 янв 2027* ✨ Спасибо! 😊 Назовите, пожалуйста, ваше имя и фамилию." dateId=d4 pax=5
### S1b [ar] "2" → "سجّلت *5 أشخاص* ليوم *5 يناير 2027* ✨ شكراً لك! 😊 هل يمكنني الحصول على الاسم الكامل؟" dateId=d4 pax=5
```
(d3 = 25.12, 2 yer — 5 kişiyi taşımadığı için listede yok; 4 dilde doğrulandı.)

### 3.5 EN akışında L3 listesi — lokalize tarih + para birimi
```
### S2 [en] L3
STATE_IN : stage=COLLECTING_INFO step=waiting_for_name lang=en dateId=dx-gecmis selectedDate=2026-01-01 pax=2
BOT      : The date you selected is no longer available or fully booked. Available dates for *Pamukkale Tour*: ⏎ 1) Dec 10, 2026 (Thursday) - 1.000₺ (10 spots) ⏎ 2) Dec 20, 2026 (Sunday) - 1.000₺ (10 spots)
STATE_OUT: stage=COLLECTING_INFO step=waiting_for_date lang=en dateId=undefined … listed=["d1","d2"]
### S2 [ru] → "Доступные даты для *Тур в Памуккале*: 1) 10 дек 2026 (четверг) - 1.000₺ (10 мест) …"   ### S2 [ar] → "… *جولة باموكالي*: 1) 10 ديسمبر 2026 (الخميس) - 1.000₺ (10 مقاعد) …"
```
Öncesi: `1) 2026-12-10 – 1.000 TRY`, başlık `Pamukkale Turu`. Sonrası `formatPriceSync` zinciri; harness'te kur servisi yok → tek-para fallback `1.000₺` (canlıda EN için `… $ (1.000₺)` dual). "1 seats"/"1 мест" tekil-çoğul kusuru önceden vardı, kapsam dışı.

### 3.6 Suite toplam + Deno'suz sert hata
```
▶ deno: C:\Users\LENOVO\.deno\bin\deno.exe
━━━ Katman-1 suite: scripts/test_behavioral.ts ━━━   → 1506 ✓ / 0 ✗  (öncesi 1463; +43 PAKET-0 D1 muhafızı)
━━━ Katman-2 harness ━━━                               → ok | 12 passed | 0 failed
━━━ SONUÇ ━━━  suite=✓  harness=✓
```
Deno'suz koşum (deno.exe geçici olarak yeniden adlandırıldı, PATH'ten çıkarıldı, `DENO_BIN` geçersiz):
```
✖ SERT HATA: Deno bulunamadı (PATH, ~/.deno/bin, DENO_BIN).
  Testler ATLANMADI — KOŞULMADI. Kurulum: https://deno.land  (irm https://deno.land/install.ps1 | iex)
  Deno'suz 'yeşil' rapor yok; bu çıkış kodu (2) kasıtlıdır.
EXIT=2
```
Regresyon: `npm run typecheck` (frontend) 72 hata — **değişmedi** (önceden 72, admin paneli, kapsam dışı). `deno check` handler grafiği: 5 hata — **değişmedi** (önceden 5: error-sink, PromptContext.fx ×2, agencyDescription, X8 `_top.price`); `tour-cache.ts` 2 hata önceden vardı. Yeni dosyalarda tip hatası yok.

---

## 4. Pre-delete tablosu + net satır farkı

| Silinen / değişen | Neden silindi | Yerine |
|---|---|---|
| L3 inline `_alts.map(… d.departure_date … toLocaleString("tr-TR") … currency)` + `slice(0,5)` | ham ISO, TR sayı, para kodu, yerel indeks | `buildDateList` |
| `_buildAvailableDatesText` inline map (`formatDateForLanguage`+`formatPriceSync`+`quotaLabel`+`${i+1})`) | yerel indeks, Blok 8 ile uyumsuz | `buildDateList` |
| :11 inline map (gün adı, fiyat, kontenjan etiketi) | kopya şablon | `buildDateList` |
| :10f "GLOBAL indeks (i+1)" özel hilesi | artık gereksiz | `buildDateList` + `listedDateIds` |
| 9b-A `_pdDates.slice(0,4).map(...)` | kopya şablon | `buildDateList({max:4})` |
| QUOTA_EXCEEDED inline map + `hasQuotaForPax(d, 1)` | yerel indeks → yanlış tarih (A1) | `buildDateList` + `hasQuotaForPax(d, totalPax)` |
| 17-BV inline map `${d.price_adult}₺` | para birimi yok sayılıyordu | `buildDateList` |
| 11× `t.dates?.[0]` / 4× `tour.dates?.[0]` | sırasız embed → rastgele "ilk tarih" | `representativeDate` |
| H-pax "state'e dokunma" yorumu + davranışı | çıkmaz döngü (A2) | tarih sıfırla + `pendingPax` |
| `_firstDate`/`_fd` ara değişken yorumları | — | — |

**Net satır farkı (prod kodu, `supabase/functions/shared`):** +159 / −127 = **+32** (handler +130 / −117 = +13; yeni modüller 127 satır, ~60'ı sözleşme yorumu). **Hedef (net-negatif) tutturulamadı** — sebep: `pendingPax` mekanizması (+~45 satır: H-pax state değişimi + PENDING-PAX UYGULA + 7-dil ack) ve repo yorum-yoğunluğu standardı. Liste şablonları tarafı net-negatif (−117 handler satırı 7 çağrıya indi); kök-davranış eklemesi (A2) pozitif. Test/harness/doküman satırları (yeni dosyalar) hariç.

---

## 5. Açık kalanlar
- **Önceden-var-olan tip hataları** (harness bu yüzden `--no-check`): `_shared/error-sink.ts:67`, `prompts/agency.ts:59` (`agencyDescription`), `prompts/stages/index.ts:405/423` (`fx`), `process-message.ts:1220` (X8 `_top.price`), `tour-cache.ts:185-186`. `test_e2e_reservation_flows.mjs`'in `deno check` fazı bu yüzden zaten kırmızıydı (bu dilimden önce de). Düzeltilmeli ki harness `--check` ile koşsun (Paket 2 adayı).
- **E2E ayna** (`test_e2e_reservation_flows.mjs`) gerçek FSM'den ayrışmış (denetim H1); bu dilim onu emekli etmedi — `npm test` onu çağırmıyor. Karar bekliyor: emekli et / harness'e taşı.
- `deno.lock`'a std/testing girdileri eklendi (deno test); ağ gerekmeden çalışması için `--allow-net` hâlâ veriliyor (esm.sh cache). CI'da `deno cache` ön-adımı gerekir.
- Harness'te kur servisi yok → dual-currency kolu test edilmiyor (`formatPriceSync` tek-para fallback). `getExchangeRatesOnce` import-map ile stub'lanabilir (D grubu dilimi).
- "1 seats" / "1 мест" tekil-çoğul (H-pax mesajı) — kozmetik, önceden vardı.
- Grup A dışı tüm bulgular (B1 vize/otel alanı, E1 NLU-arıza dili, F1/F2, C1 …) **dokunulmadı**.

---

## 6. Ürün sahibine sade özet
Kontenjan dolunca ya da kişi sayısı sığmayınca bot'un bastığı tarih listesinden "2" diyen müşteriye artık **listedeki** tarih seçiliyor (eskiden yanlış tarihle rezervasyon veya sonsuz döngü vardı); bu dört dilde gerçek bot koduyla önce kırmızı, sonra yeşil kanıtlandı. Tarih listeleri yedi yerde ayrı ayrı elle yazılırken tek bir yere indirildi, tarih/para birimi her dilde doğru formatlanıyor ve "ilk tarih" varsayımı veritabanı sırasına bağlı olmaktan çıktı. Ayrıca bot'un ana işleyicisini gerçekten çalıştıran bir test düzeneği repoya girdi ve `npm test` tek komutla her şeyi koşuyor — Deno yoksa sessizce geçmek yerine hata veriyor.
