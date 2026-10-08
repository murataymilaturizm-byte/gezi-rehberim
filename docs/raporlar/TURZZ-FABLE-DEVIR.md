# Turzz AI — PAKET-0 Opus dilimleri → Fable devir belgesi

**Tarih:** 2026-10-08 · **Hazırlayan:** Opus 5.5 (Dilim 1–8 uygulayıcısı) · **Okuyucu:** Fable (inceleme + kalan işler)
**Kaynak denetim:** `docs/raporlar/TURZZ-FABLE-DENETIM.md` (baz commit `02f0981`) · **Son commit:** bu belgenin commit'i (bkz. §1 sonu)
**Canlı sürüm (2026-10-08 12:37 UTC):** `whatsapp-webhook` **v300**, `demo-chat` **v279** (proje `yaxjygtjtjmzslajuctk`)
**Test durumu:** `npm test` → suite **1654 ✓ / 0 ✗**, harness **154/154**, webhook harness **23/23** (Deno; `--no-check`, bkz. §4.8)

Her dilimin ayrıntılı kanıtı (önce kırmızı / sonra yeşil dökümleri, pre-delete tabloları) kendi raporunda: `TURZZ-PAKET0-DILIM1..4-SONUC.md`, `TURZZ-DILIM5..8-SONUC.md`, canlı teşhis `TURZZ-CANLI-ESKI-VERI-TESHIS.md`. Kalıcı sözleşmeler `docs/ARCHITECTURE_GUARDS.md` §G17–§G23'te.

---

## 1. Commit listesi (Dilim 2–8)

| Dilim | Denetim maddeleri | Commit (kod) | Commit (rapor/doküman) | Deploy (webhook / demo) |
|---|---|---|---|---|
| 2 | B1 `toBotTours` tek dönüştürücü, B2 dolu tarih `isFull` | `8b3318d`, `c906dbb` (dolu tarih sorusuna müsait liste) | `0bcc05a` | v293 / v272 |
| 3 | F1 düşürülen mesaj kaydı, F2 rate-limit fail-open, `:426` catch'siz builder | `db7f99a`, `d45b863` (DROP_REASON tek sabit) | `11e10af` | v294 / v273 |
| 4 | 5 kayıtsız yol + `quota_exceeded`; çift kayıt (dedup öne) | `c1e819c`, `604829d` | `3f52eae`, `c087b6b` | v295→v296 / v274→v275 |
| — | Canlı eski tarih/fiyat teşhisi (salt okuma) | — | `c901dbd` | — |
| 5 | Tur isteme/tarih sorusu → `buildDateList`; LLM geçmişi tek fonksiyon (`loadConversationHistory`) | `b817045` | `3a198e8` | v297 / v276 |
| 6 | D3 tek toplam formülü, G1 tek özet builder, C2 ₺ literal yasağı | `418da82` | `d7170e6` | v298 / v277 |
| 7 | D1 bütçe para birimi, E2 `\b`/non-ASCII, E3 dil tespiti | `0db472b` | `bc4fae2`, `251da64` (G22 başlığında `\b` düzeltmesi) | v299 / v278 |
| 8 | Kontrol karakteri muhafızı, F5 `todayIST`, F4 atomik sayaç, bu devir belgesi | `2055cc7` | bu belgenin + `TURZZ-DILIM8-SONUC.md` commit'i | v300 / v279 |

(Dilim-1: `f4036d2`, `5e53408`, `579f1f6`. H1 harness + Grup A tarih listesi tek primitif; deploy v292 / v271.)

Migration: Dilim 2–8'in **hiçbirinde yok**.

---

## 2. Opus'un "KARAR GEREKLİ" kararları ve gerekçeleri

Durum sütunu: **ONAY** = ürün sahibi açıkça onayladı · **DÜZELT** = ürün sahibi farklı karar verdi, uygulandı · **açık onay yok** = rapor edildi, sonraki dilime geçildi, itiraz gelmedi.

### Dilim 2
| # | Karar | Uygulanan | Gerekçe | Durum |
|---|---|---|---|---|
| K1 | Dolu tarih listede numaralı mı? | Numarasız + "(DOLU)" etiketli; `listedDateIds` yalnız müsait tarihler | "2" yazan müşteri hiçbir koşulda dolu tarihe düşmesin | ONAY |
| K2 | Tüm tarihleri dolu tur katalogda görünsün mü? | Gizli kalır (eski davranış) | Ürün kararı; birçok liste ve "aktif tur yok" mesajı etkilenir | ONAY |
| K3 | "Müsait tarihler" başlıklı alternatif listeler dolu tarihi göstersin mi? | Göstermez | Başlık "müsait" diyor; dolu satır yalnız tam listede | ONAY |

### Dilim 3
| # | Karar | Uygulanan | Gerekçe | Durum |
|---|---|---|---|---|
| K1 | Bot-pause satırı `dropped_reason` taşısın mı? | Hayır | Mesaj düşmüyor, insan devraldı | ONAY |
| K2 | Sebep adları sözlüğü | (Opus: iki sözlük yan yana) | — | **DÜZELT** → tek sabit `DROP_REASON` |
| K3 | Düşürülen mesaj aylık sayaca yazılsın mı? | Hayır | Bot cevap üretmedi | ONAY |
| K4 | F2 fail-open | Talimat gereği; RPC kesintisinde hız sınırı yok, `logCritical` ile görünür | — | talimat |

### Dilim 4
| # | Karar | Uygulanan | Gerekçe | Durum |
|---|---|---|---|---|
| §10.4 | Limit sebep adı | `quota_exceeded` (panel okuyucusunun adı) | Panel rozeti çalışsın | talimat |
| K1 | `rate_limited` her mesajda satır yazar | Yazar | Talimat; kötüye kullanımda yazım yükü riski raporlandı | KABUL |
| K2 | Medya yer tutucuları Türkçe | `[ses mesajı]` vb. | Panel dili TR | KABUL |
| K3 | 3 yol dedup'tan önce → çift kayıt riski | (Opus: sıra korunmuştu) | — | **DÜZELT** → dedup tüm kayıt yollarının önüne taşındı (`604829d`) |

### Dilim 5
| # | Karar | Uygulanan | Gerekçe | Durum |
|---|---|---|---|---|
| K1 | Tarih sorusu (b) dalı FAQ intent'lerinde hangi şartla? | Yalnız tur **bu mesajda adıyla** geçtiyse | "İptal ne zamana kadar?" tarih listesine dönmesin | açık onay yok |
| K2 | Tur hakkında **bilgi** isteği | LLM'de kaldı | Tur anlatımı LLM'in işi; prompt'ta tarih yasağı var | açık onay yok |
| K3 | COMPLETED/GREETING'de "X turu ne zaman?" (FSM stage değiştirmiyor) | Dokunulmadı | FSM geçiş kuralı değişikliği gerekir → **Fable'a kaldı** (§3.3) | açık onay yok |

### Dilim 6
| # | Karar | Uygulanan | Gerekçe | Durum |
|---|---|---|---|---|
| K1 | 17-BV soru metni de/fr/es/ru/ar'da :13'ten farklıydı | :13 metni (`confirmYes`) | Aynı anlam, tek kaynak | açık onay yok |
| K2 | `response-validator.ts` `validateFieldReask` CONFIRMING yedeği (`formatReservationSummary`, TR/EN, 💰 yok) | Dokunulmadı | fsm katmanı senkron, 10+ suite testi biçime bağlı → **Fable'a kaldı** (§3.2) | açık onay yok |
| K3 | Builder tarih yoksa "henüz seçilmedi" basar | Builder davranışı | Bağlanan dallarda tarih zaten dolu | açık onay yok |
| C2-MUAF | Bütçe yankısı ₺ literal'i | Muaf (D1'e kadar) | Girdinin para birimi çözülmemişti | Dilim-7'de kaldırıldı |

### Dilim 7 (dördü de ONAY)
| # | Karar | Uygulanan | Gerekçe |
|---|---|---|---|
| D1-a | Para birimi yazılmamış bütçe | Müşterinin **gördüğü** para birimi: çift gösterim + kur varsa `LANG_TO_CURRENCY[lang]`, yoksa acente ana para birimi | Kur yokken "under 300"ü USD saymak tüm turları karşılaştırılamaz yapıp filtresiz listelerdi |
| D1-b | Kur yokken farklı para birimli tur | Listede kalır, "yaklaşık" işaretlenmez, sona dizilir | Talimat; uyduğu kanıtlananlar önde |
| E3-a | FR-özgü harf listesi | Talimattakilere ek `è à â ô` | Yalnız FR'de var; yoksa "réserver à Paris" algılanmazdı. `ç` TR ile paylaşılan → eklenmedi |
| E3-b | Akış ortası 2-ardışık kuralı Kiril/Arap'a da mı? | Hayır: Kiril/Arap anlık, Latin harfli 2-ardışık | Yazı sistemi dile özgü, yanlış tespit olamaz |

(D1-c etiket biçimi "500€" = `formatPriceSync` ev biçimi, bilgi.)

### Dilim 8
| # | Karar | Uygulanan | Gerekçe |
|---|---|---|---|
| K1 | Kontrol karakteri muhafızının kapsamı | Yalnız regex içi `\x08` değil: `scripts/`, `supabase/functions/`, `src/` içinde 0x00–0x08, 0x0B, 0x0C, 0x0E–0x1F **tümü** | Kaynakta meşru kullanımı yok; aynı araç hatası başka kontrol karakteri de üretebilir. 503 dosyada bugün 0 |
| K2 | F5 kapsamı | Talimattaki 3 giriş + `prompts/helpers.ts` (LLM'e verilen "CURRENT DATE" başlığı ve tur detayındaki ilk tarih) | Aynı hata sınıfı, process-message prompt yolu. Eski başlık İstanbul 01:30'da dünün tarihini veriyordu |
| K3 | F4: ay sıfırlamasında eski sayaçla limit kontrolü | Düzeltildi (`_msgCount = 0`) | Sayaç alanının kök hatası: geçen ay limiti dolan acentenin yeni aydaki ilk mesajı düşürülüyordu |
| K4 | Ay sınırında eşzamanlı iki "sıfırlama" UPDATE'i bir artışı ezebilir | Dokunulmadı (raporlandı) | Atomik çözüm migration ister (RPC içinde koşullu sıfırlama); talimatta migration yoktu |

---

## 3. Fable'a kalan işler

Her madde: **ne** · **nerede** · **neden kaldı** · **önerilen kök**.

### 3.1 E1: NLU arızasında dil (YÜKSEK, denetim E1)
- **Ne:** İlk mesaj RU/AR + NLU arızası (timeout/outage/anahtar) → `buildFallbackNLU` dili `detectFallbackLanguage` ya da `"tr"` → ilk-mesaj NLU otoritesi (`nlu-first`) karakter tespitini ezer → Türkçe cevap. `NLU_TIMEOUT` retry edilmiyor.
- **Not (Dilim 7–8'den):** `detectLanguage` artık ES/FR'yi ayırıyor ve Kiril/Arap tespiti akış ortasında anlık. Ancak ilk mesajın NLU-öncelik kapısı `NLUResult`'ta "degraded" işareti olmadığı için değişmedi. Harness'te `setNluMode({ kind: "fallback" })` gerçek fallback'i koşar.
- **Önerilen kök:** `NLUResult.degraded`; degraded'de dil yazma kapıları kapalı, `detectLanguage` otorite; timeout'a 1 retry.

### 3.2 C1 + response-validator yedek özeti (YÜKSEK, denetim C1 + Dilim-6 K2)
- **C1 durumu:** `formatToursList` fiyatı artık turun para biriminde (Dilim-6). Ama saat/kalkış/süre alanları hâlâ yok, **post-LLM sayısal muhafız** (cevaptaki `HH:MM` ve tutarları `tours[]` ile karşılaştır) yok. Canlı teşhis raporundaki öneri 1 de bu.
- **Yedek özet:** `fsm/response-validator.ts` `validateFieldReask` CONFIRMING dalı hâlâ `formatReservationSummary` kullanıyor (TR/EN, 💰 yok, 5 dilde İngilizce). Tek builder `_buildUpdatedSummary` process-message'ta ve async (kur). Öneri: validator yalnız "değiştir" kararı dönsün, metni çağıran (process-message) `_summaryWithAsk` ile kursun; suite'teki ~10 `validateFieldReask` testinin beklentisi güncellenmeli.

### 3.3 G2 + rezervasyon sonrası "X turu ne zaman?" tur geçişi (ORTA, denetim G2 + Dilim-5 K3)
- **G2:** onay ×8 çağrı, tur-değişim ×6 yer, 7 ayrı tek-turn pending bayrağı. Öneri: `FAQ_INTENTS` sabiti, `context.pending {kind,payload,turn}` tek alanı, FSM T10/T11 kararı.
- **Tur geçişi:** COMPLETED'de başka tur için "Kapadokya turu ne zaman?" FSM'de bilgilendirme sayılıyor (`state-machine.ts` son COMPLETED→TOUR_SELECTED kuralı "switch signal" istiyor). Bot o tura geçmiyor, cevap LLM'den geliyor (artık eski geçmiş gitmiyor). Öneri: farklı tur + tarih sorusu (`DATE_QUERY_RE`) bir switch sinyali sayılsın; (b) dalı gibi deterministik `buildDateList`.

### 3.4 `createTourRef` üçüncü kopya (Dilim-2 Gözlem 1)
- `services/tour-matching.ts` `createTourRef` DB→bot tur nesnesini elle kuruyor. `toBotTours` dışında kalan son dönüştürücü; `konaklama/ulasim` gibi alanları taşımıyor (denetim C2 notu). Öneri: `toBotTours` çıktısını referansla taşımak (seçili tur için `findTourById`).

### 3.5 F3: önce 200, sonra işle (ORTA, denetim F3)
- Webhook senkron işliyor (kötü durumda ≈65 sn). Dedup Dilim-4'ten beri **bütün** kayıt yollarının önünde, yani `EdgeRuntime.waitUntil(process…)` ile önce 200 dönmek artık güvenli. Meta'nın yeniden deneme/devre dışı bırakma eşiği doğrulanmadı.

### 3.6 RU/DE çekimli tur adı eşleşmesi (Dilim-5 Gözlem G1)
- "хочу посмотреть туры **в Каппадокию**" → tur bulunamıyor, müşteri yanlış `"посмотреть" нет в нашей системе` cevabı alıyor (`process-message` bilinmeyen-tur dalı). "Kappadokien-**Touren**" de eşleşmiyor. Kök: `tour-matching` morfolojisi (RU hâl ekleri, DE bileşik kelime). Yalın hâl ("тур Каппадокия") çalışıyor.

### 3.7 Çok dilli vize/kalkış alanları (Dilim-2 Gözlem 2)
- Vize notu, kalkış noktası gibi serbest metin tur alanları yalnız TR. Yabancı dilde prompt/listeye TR metin giriyor. Öneri: panelde dil başına alan ya da `translate-tour` hattına dahil etmek.

### 3.8 Harness `--no-check` / önceden var olan tip hataları
- `deno check whatsapp-webhook/index.ts demo-chat/index.ts` → **12 hata**. Bu dilimlerde yeni hata eklenmedi, taban çizgisi sabit:

  | Dosya | Hata sayısı |
  |---|---|
  | `_shared/error-sink.ts` | 1 |
  | `constants/rating-words.ts` | 4 (TS1530 `\p` /u'suz) |
  | `prompts/agency.ts` | 1 |
  | `prompts/stages/index.ts` | 2 (`fx`/`agencyDescription` PromptContext'te yok) |
  | `process-message.ts` | 1 (önceden `:1240`, artık `:1261` civarı) |
  | `tour-cache.ts` | 2 |
  | `whatsapp-webhook/index.ts` | 1 (`:208` `success` iki kez) |

- Harness ve webhook harness bu yüzden `--no-check` koşuyor. Öneri: 12 hatayı kapatıp harness'i `--check`'e almak (`npm run typecheck` tuzağı için memory notu: `npx tsc --noEmit` sıfır dosya denetler).

### 3.9 E2E ayna emekliliği
- Denetim (`TURZZ-FABLE-DENETIM.md` :139–144): `scripts/test_behavioral.ts` handler'ı import etmiyor, ~110–130 assertion handler mantığının **test dosyasına kopyalanmış** hâlini sınıyor (ayna). `scripts/test_e2e_reservation_flows.mjs` NLU'ya her adımda elle "mükemmel" `extracted` veriyor; gerçek NLU+extractor zinciri atlanıyor (`test_e2e_llm_real.mjs` ayrı).
- Katman-2 harness (`_tests/harness`, GERÇEK `processChatMessage`) Dilim 1–8 boyunca 154 senaryoya çıktı. Öneri: aynanın ve e2e akışlarının kapsadığı senaryoları harness'e taşıyıp kopya mantığı emekliye ayırmak (çift bakım + "test yeşil ≠ canlı çalışıyor" riski). Hangi suite bölümlerinin ayna olduğu dosyada ayrıca işaretli değil; ilk adım envanter.

### 3.10 Diğer açık gözlemler (dilim raporlarından)
- `create_reservation_with_quota_check` (`migrations/20260723140000_reservation_rpc_ownership.sql`) **tarih kontrolü yapmıyor**. Geçmiş tarih yalnız bot katmanında engelleniyor (Dilim-8 F5). DB katmanı için migration gerekir.
- `fsm/simple-extractor.ts` `extractRelativeDate` ("yarın") UTC çapası; İstanbul 00:00–03:00'te bir gün kayar. Blok 9d (İstanbul çapası) otorite olduğu için etkisi sınırlı, doğrulanmadı.
- Ay sınırında eşzamanlı sıfırlama yarışı (Dilim-8 K4).
- Ölü kod: `whatsapp-webhook/services/conversation.ts` + `handlers/{general-chat,greeting,tour-search}.ts` + `services/{intelligent-handler,tour}.ts`; `demo-chat/services/context-manager.ts`.
- `nlu-validation.ts:54` isim kapısında Arapça `؟ ،` temizlenmiyor.
- "Ça marche" (yalnız ç) → tr; `é`-yalnız mesaj → NLU karar verir.
- EN bütçe cümlesi "Tours within your under 300$ budget" (şablon dil bilgisi).
- `tours`/`tour_dates` tablolarında `updated_at` yok (canlı teşhis).
- Demo turların tarihleri: Oct 2026–Mar 2027 tarih ekleme önerisi ürün sahibinin onayını bekliyor (yazılmadı).

---

## 4. Bekleyen canlı testler (WhatsApp, gerçek numara: yalnız ürün sahibi)

Webhook'a canlı mesaj gönderilmedi (kural). Demo-chat'te yalnız TR "merhaba" duman testi yapıldı (her dilimde HTTP 200). Aşağıdakiler gerçek WhatsApp numarasıyla doğrulanmalı:

| # | Dilim | Senaryo | Beklenen |
|---|---|---|---|
| 1 | Dilim-1 (A2 H-pax) | Seçili tarihin kontenjanı yetmezken "5 kişi" → listeden "2" | Listedeki 2. tarih (global 2. değil) + 5 kişi |
| 2 | Dilim-1/2 (dolu tarih) | Tarih adımında dolu tarihi seçme ve "20'si müsait mi?" sorusu | "(DOLU)" + numaralı müsait liste; "2" → listedeki 2. müsait tarih |
| 3 | Dilim-5 (Kapadokya fiyat) | Panelden Kapadokya Balon Turu fiyatı/tarihi değiştirilir → "Merhaba" (stale-reset) → "kapadokya turlarını görmek istiyorum" | Liste DB'nin **yeni** tarih/fiyatıyla, `(DOLU)` satırlı (`buildDateList`); eski 1.500₺ / 2026 listesi yok |
| 4 | Dilim-5 | Rezervasyon tamamla → "Kapadokya turunu görmek istiyorum" | Deterministik liste (LLM uydurması değil) |
| 5 | Dilim-7 | DE/EN müşteri "unter 500 €" / "under $300" | Etiket müşteri para biriminde, liste kurla doğru |
| 6 | Dilim-8 | (Opsiyonel) İstanbul 00:00–03:00 arası, dün kalkmış tarih | Listelenmez / rezerve edilemez |

---

## 5. Çalışma notları (Fable için)
- **Tek komut:** `npm test` (= `scripts/test_all.mjs`: suite + `_tests/harness` + `_tests/webhook`). Deno yoksa sert hata. Deno yolu: `~/.deno/bin/deno.exe`.
- **Kanıt dökümü:** `HARNESS_KANIT=<dosya>` → `dumpTurn` STATE_IN/BOT/STATE_OUT yazar. `HARNESS_VERBOSE=1` logları açar.
- **Harness araçları:** `setNluMode` (fixed/fallback), `setAiMode` + `lastAiParams` (LLM'e giden prompt/geçmiş), `setRates` (kur, `stubs/exchange-rates.ts`), `withFakeNow` (`_tests/fake-now.ts`). Webhook harness'te gerçek dedup sözleşmesi, `db.agencyCount`, `processCalls[].tours` var.
- **Önce kırmızı yöntemi:** kod dosyaları `git stash push -- <dosyalar>` ile HEAD'e alınır, testler ve stub'lar yerinde kalır, aynı test koşulur, `git stash pop`.
- **Dosya yazma tuzakları:** process-message.ts karışık CRLF/LF. Şablon string içinde `\b` backspace'e dönüşebiliyor (Dilim-7'de iki kez oldu); D8.CTL muhafızı artık yakalar. Yamalarda `scratchpad/rep.cjs` deseni (LF/CRLF toleranslı, tek eşleşme şartı) kullanıldı.
- **Statik muhafız aileleri (suite):** PAKET-0 D1–D4, D5.*, D6.*, D7.*, D8.*; kaynak tarayıcı `scripts/lib/regex-boundary.ts`.
