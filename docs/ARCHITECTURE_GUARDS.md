# ARCHITECTURE_GUARDS.md — Deterministik Müdahale Noktaları Haritası

> **YAŞAYAN DOKÜMAN**: Her davranış fix'inden önce ilgili bölüm okunmalı,
> her fix'ten sonra bu dosya aynı commit'te güncellenmelidir.
>
> Son güncelleme: 2026-07-03 (X9-change fix — G8 3. kabul yolu; ilk sürüm aynı gün).
> Satır numaraları ±10 tolerans ile verilmiştir; kod değiştikçe kayar,
> section/fonksiyon adları referans alınmalıdır.

Bu repo, Haiku NLU'nun tutarsızlığına karşı çok sayıda deterministik bypass,
guard ve path önceliği içerir. Bu noktalar birbirini görmez — "bir fix
diğerini bozuyor" regresyonlarının kökü budur. Bu doküman tüm müdahale
noktalarını tek haritada toplar.

---

## 1. STATE HARİTASI

### Stage'ler (`shared/fsm/types.ts`)
```
GREETING → BROWSING → TOUR_SELECTED → COLLECTING_INFO → CONFIRMING → COMPLETED
```

### collectionStep'ler
```
waiting_for_date → waiting_for_pax → waiting_for_name → waiting_for_phone
→ (waiting_for_email, opsiyonel: agency.collectEmail) → ready_for_confirmation
```
Sıra `determineCollectionStep()` (state-machine.ts ~L176) tarafından
deterministik belirlenir; `isAllInfoCollected()` (~L188) ile simetriktir
(dateId + fullName + isValidPax + isValidPhone [+ email] şart).

### FSM geçişleri — `transitions` dizisi (state-machine.ts ~L446-1108)
**İlk eşleşen kazanır** (`transitions.find`). Dizi sırası = öncelik:

| # | From → To | Koşul (özet) | Kaynak fix |
|---|---|---|---|
| T1-T3 | TOUR_SELECTED / COLLECTING_INFO / CONFIRMING → BROWSING | `detectCancellationGuarded` (iptal) | Bug C guard |
| T4 | GREETING → COLLECTING_INFO | selectedTour + (dateId/selectedDate/paxAdult extract VEYA reservation intent) | **O1 ilk-turn** (2026-07-01, commit 9a9f687) |
| T5 | GREETING → TOUR_SELECTED | selectedTour (action mergeReservationInfo ÇAĞIRMAZ — sadece tourId/tourTitle) | — |
| T6 | GREETING → BROWSING | selectedTour yok + browse/search/greeting/general | — |
| T7 | BROWSING → COLLECTING_INFO | tur + reservation intent (action: merge + step) | — |
| T8 | BROWSING → TOUR_SELECTED | selectedTour + reservation intent DEĞİL | — |
| T9 | TOUR_SELECTED → COLLECTING_INFO | hasReservationSignal / positivePattern / **extract-bypass** (dateId-selectedDate-paxAdult varsa informational guard atlanır) / reservation intents / extract+pattern | **O1 PROBLEM 2** (2026-06-29), BUG-X7, BUG 1 |
| T10 | TOUR_SELECTED → TOUR_SELECTED | farklı selectedTour + reservationInfo ≤2 alan → produceTourChangeContext + `collectionStep=undefined` override | ALT-KÖK A (2026-06-25) |
| T11 | COLLECTING_INFO → TOUR_SELECTED | farklı selectedTour + B2 pattern/reservation_intent | B2 (2026-06-09) |
| T12 | COLLECTING_INFO → COLLECTING_INFO | !isAllInfoCollected → silent merge | K7 |
| T13 | COLLECTING_INFO → CONFIRMING | !informational + intent ∈ {provide_info, confirm, confirm_reservation} (**general YOK**) + isAllInfoCollected | **BUG 2 Hayriye** (onay adımı atlanması) |
| T14 | CONFIRMING → COMPLETED | 3 path — aşağıda §4/G1 | **K1 ailesi** |
| T15 | CONFIRMING → COLLECTING_INFO | change_info intent VEYA 3-katman pattern (negative guard → güçlü fiil → zayıf+hedef alan); action NLU-first override | BUG 5, BUG B, BUG-X3, B-3 |
| T16 | COMPLETED → BROWSING | detectCancellationGuarded | — |
| T17 | COMPLETED → COMPLETED | isAfterSalesMessage (FSM intent: support_request/change_info/general_question + ödeme/buluşma/zamanlama pattern'leri) — no-op, context korunur | FIX 2a (dead-code intent map), Murat kararı 2026-06-24 |
| T18/T20 | COMPLETED → BROWSING | hasNewReservationIntent (A5 exclusion dahil) | A5 |
| T19/T21 | COMPLETED → BROWSING | browse_tours/tour_search + selectedTour yok (**general/greeting listeden ÇIKARILDI** — Bug A) | Bug A (2026-06-23) |
| T22 | COMPLETED → TOUR_SELECTED | !informational + selectedTour + reservation intent | — |
| T23 | COMPLETED → TOUR_SELECTED | **FARKLI selectedTour → informational guard BYPASS** + reservation intent değil | FIX A2 (2026-06-25) — ⚠ bkz. §5 D2 açık riski |

Eşleşme yoksa: COLLECTING_INFO'da extract varsa silent merge; aksi halde
no-op (messageCount++/lastUpdated).

---

## 2. UÇTAN UCA ÇALIŞMA SIRASI

Bir mesaj geldiğinde (process-message.ts, "=== N. ===" section'ları):

```
ADAPTER (demo-chat/whatsapp-webhook adapter.ts)
 └─ G10: Stage-aware TTL stale check → sentinel {context:null, stale:{...}}

PROCESS-MESSAGE — LLM ÖNCESİ (erken return'lar):
  1. Input uzunluk limiti (~L47, 2000 char)
  2. KATMAN 1 stale reset — sentinel işleme, "iptal edildi/hoş geldin" (~L77)
  3. A1 erken tarih revalidasyonu — geçmiş/dolu tarih temizle (~L197; COMPLETED atla)
  4. NLU çağrısı: analyzeUserMessage (~L272) → mapNLUIntentToFSMIntent (~L345)
  5. NLU fullName leak gate'leri: tour-keyword (6b, ~L286) + negasyon (Sorun F, ~L296)
  6. NLU dil override + ASCII guard (~L320)
  7. G7 superlatif fiyat (~L389) │ B1 fiyat aralığı (~L456) │ B-DUR süre (~L645)
     │ B-TEMA tema (~L747) — hepsi _isExploreStage guard'lı, deterministik return
  8. G5 erken tur değişimi: shouldApplyEarlyTourChange (~L814) → context mutate
  9. KÖK 5 belirsiz tur listesi (~L838) │ B2 stage koruma intent remap (~L862)
     │ BUG B PROMOTE provide_info→change_info (~L921) │ B-6 negatif cevap (~L942)
 10. F4 sahte-onay + değişiklik dalları (~L995-1103) — DAL 1 açık / DAL 2 belirsiz
 11. Pax guard'ları: negatif (~L1106) │ >9 acente (~L1130) │ >50 ofis (~L1151)
 12. H-β dolu tarih reddi (~L1210) │ H-pax kontenjan (~L1255)
 13. AKIŞ-İÇİ DEĞİŞTİRME AİLESİ (~L1324-1785, hepsi RETURN):
     A1-log → A2 pax → A3-date → A3-name → A4-mini → A3-phone → PROMOSYON → A3-BELİRSİZ

FSM GEÇİŞİ:
 14. processTransition (~L1798) — §1'deki transitions dizisi
 15. Geçersiz tarih cleanup (~L1801) → waiting_for_date'e çek
 16. G3/R6 telefon validasyonu (~L1824) — FAQ intent muafiyeti (D1)

FSM SONRASI DETERMİNİSTİK MESAJLAR (hepsi RETURN, LLM atlanır):
 17. O6 tur listesi boş (~L1862) │ B2 akış-ortası tur listesi (~L1883)
 18. :10 iptal ack (~L1929) │ :10b UNKNOWN_TOUR (~L1938)
 19. :11 tarih listesi — 4 dal: (a) waiting_for_date, (b) tarih sorusu,
     (c) rezervasyon niyeti, (d) _isStuckOnTourSelected (~L1977-2140)
 20. :11a-AUTO-DATE-ACK (~L2142) │ :11a-MANUAL-DATE-ACK / G4 (~L2229)
 21. :11b pax→name (~L2325) │ :11b-PERSIST (~L2350) │ :11c name→phone (~L2426)
 22. :12 email adımı (~L2467)
 23. :13 CONFIRMING ilk-giriş özeti + "evet yazın" yönlendirmesi (~L2501)
 24. :13-PERSIST CONFIRMING no-op özet tekrar (~L2557)
 25. :14 create_reservation RPC — justCompleted koşulu (~L2616)
 26. :14a after-sales iptal/değişiklik (~L3008) │ :14a-3 COMPLETED değişiklik
     yönlendirme (~L3056) │ :14a-2 COMPLETED teşekkür ack (~L3126)
 27. :14b FIX 3 sahte onay sigortası — state koru + özet (~L3166)

LLM:
 28. :15 system prompt (stage + dinamik suffix'ler + midFlowReturnPrompt)
 29. :16 callAI (Haiku)

POST-LLM (cevap düzeltme):
 30. :17a validateFieldReask — dolu alan re-ask bloklama (K4/BUG D)
 31. :17a-2 KÖK 6 suffix — FAQ cevabına akış-dönüş cümlesi
 32. :17b injection post-validation
 33. :18 ödeme mesajı (COMPLETED + paymentInstructions)
 34. :19 kaydet + gönder
```

---

## 3. MÜDAHALE NOKTALARI TABLOSU

### G1 — detectConfirmation + clearPositive (K1 ailesi)
| | |
|---|---|
| Dosya | `state-machine.ts` — detectConfirmation ~L212, CONFIRMING→COMPLETED ~L762 |
| State | CONFIRMING |
| Koşul | Positive pattern (7 dil, `(?<![\p{L}\p{N}])...(?![\p{L}\p{N}])/iu` lookaround) + negative guard (ama/değil/yap/olsun/değiştir/düzelt/güncelle) |
| Sıra | FSM transition T14, Path 1 (ilk kontrol) |
| Kaynak | K1 181ec46 (yanlış-pozitif) + K1-denge 384a736 (yanlış-negatif) |
| **DÜZELTME (taslak vs kod)** | "Path 5 soft-close" diye ayrı bir dal YOK — taslak terminolojisi. Gerçek yapı: T14'ün 3 path'i + :13-PERSIST + FIX 3. **intent=general guard'ı 2026-07-02'de KALDIRILDI** — detectConfirmation TEK otorite (Haiku "evet"i general sınıflıyordu → sessiz kayıt kaybı). :13 özet mesajı "Onaylıyorsanız *evet* yazın" yönlendirmesi içerir (Katman 3). |

T14'ün 3 path'i:
1. **Path 1**: `detectConfirmation` TRUE → geç (intent'ten bağımsız)
2. **Path 2**: `isInformationalMessage` TRUE → kal (FAQ CONFIRMING'i bozmaz)
3. **Path 3**: intent=confirm_reservation + msg≤20 + rakamsız + detectConfirmation
   (KATMAN B çift-doğrulama) + clearPositive lookaround (KATMAN A) — Tulay case

Bilinen açık: "tabi"/"tabiki" pattern'de yok → yanlış-negatif (post-launch
kelime-sözlüğü genişletmesi).

### G2 — Path/section sıralaması (process-message)
§2'deki uçtan uca liste bu haritanın kendisidir. Kritik kural:
**akış-içi değiştirme ailesi (adım 13) FSM'den ÖNCE, R6 (adım 16) FSM'den
SONRA çalışır** — A2/A3 yakalarsa RETURN ile R6'ya hiç ulaşılmaz.

### G3 — R6 telefon validasyonu + D1 muafiyeti
| | |
|---|---|
| Dosya | `process-message.ts` ~L1824-1858 |
| State | COLLECTING_INFO + waiting_for_phone (önceki turn de aynı step) |
| Koşul | `!extractedInfo.phone` + `!isValidPhone(message)` + intent ∉ {general_question, support_request} |
| Sıra | FSM sonrası, deterministik mesajlardan önce |
| Kaynak | R6 (2026-06-26) + D1 muafiyeti (36af597) |

**AÇIK BUG (koddan teyitli)**: muafiyet listesinde `change_info` YOK.
- "aslında 3 **kişi** olsun" → peopleContext var → pax extract edilir →
  **A2 dalı FSM'den önce yakalar** → R6'ya ulaşılmaz ✅
- "aslında 3 olsun" (kişi kelimesi YOK) → BUG-X9 sigortası pax'ı reddeder
  (waiting_for_pax değil + peopleContext yok) → A2 tetiklenmez → FSM no-op →
  R6: telefon yok + geçersiz + intent change_info muafiyette değil →
  **"geçerli telefon değil" yanlış mesajı** ❌
- Fix yönü (uygulanmadı): R6 muafiyetine change_info eklemek TEK BAŞINA
  yetmez — mesaj yutulur ama pax da işlenmez (BUG-X9 reddetti). Kök çözüm
  BUG-X9 sigortasının change-keyword'lü mesajlarda pax'a izin vermesi.

### G4 — :11a-MANUAL-DATE-ACK (BUG-X5)
| | |
|---|---|
| Dosya | gate: `bypass-gates.ts` shouldTriggerManualDateAck ~L192; mesaj: `process-message.ts` ~L2229 |
| Koşul | dateAutoAssigned=false + COLLECTING_INFO + waiting_for_pax'a YENİ geçiş + selectedDate var |
| Ne yapar | Tur adı + tarihi **state'ten** okur (LLM history sızıntısı yok), pax sorar, LLM atlanır |
| Kaynak | BUG-X5 (Antalya tur adı sızıntısı, exec a62db908) |

### G5 — shouldApplyEarlyTourChange (BUG-X6 + ALT-KÖK A)
| | |
|---|---|
| Dosya | `tour-change.ts` ~L78-101; çağrı: `process-message.ts` ~L814 |
| Koşul | selectedTour ≠ currentTour + stage ∈ {TOUR_SELECTED (intent-guard'lı: reservation_intent/tour_selected/change_info VEYA hasReservationSignal), COLLECTING_INFO, CONFIRMING (intent-bağımsız)} |
| Ne yapar | produceTourChangeContext: pax/isim/telefon spread ile KORUNUR (Özge fix), dateId/selectedDate silinir, collectionStep=waiting_for_date |
| **NÜANS** | T10 (TOUR_SELECTED→TOUR_SELECTED, state-machine) AYNI helper'ı kullanır ama sonrasında `collectionStep=undefined` override eder (ALT-KÖK A — TOUR_SELECTED'da tarih beklenmez) |
| Kaynak | BUG-X6, BUG-X7, ALT-KÖK A (2026-06-25) |

### G6 — hasReservationSignal (BUG-X7)
| | |
|---|---|
| Dosya | tanım: `tour-change.ts` ~L135-138 |
| Pattern | `(?<![\p{L}\p{N}])(rezerve\|rezervasyon\|reservation\|booking\|book\|reservar\|réserver\|buchen\|бронирование\|حجز\|kayıt\|yer\s*ayır\|katıl)/iu` — lookahead YOK (çekim eki serbest) |
| **Çağrı noktaları (grep teyitli, taslak "3 yer" diyordu — tanım+2 kullanım)** | 1) `tour-change.ts:~95` shouldApplyEarlyTourChange TOUR_SELECTED guard; 2) `state-machine.ts:~620` T9 TOUR_SELECTED→COLLECTING_INFO condition |

### G7 — Superlatif fiyat handler (BUG-X8)
| | |
|---|---|
| Dosya | `process-message.ts` ~L389-454 |
| Koşul | `_isExploreStage` (GREETING/BROWSING/TOUR_SELECTED) + "en ucuz/pahalı, cheapest..." pattern (7 dil, lookaround) |
| Ne yapar | tours price_adult ASC/DESC sort, deterministik mesaj, LLM atlanır |
| Kaynak | R4 mimari taşıma ile erken katmana alındı |

### G8 — Pax sızıntı sigortası (BUG-X9, iki katman + X9-change 3. kabul yolu)
| | |
|---|---|
| Dosya | `info-extractor.ts` Blok 1 (NLU pax kabul/red/pending) + Blok 9b (pending karar) + Blok 6 (context-aware rakam-sadece kuralı) |
| Koşul | NLU paxAdult/paxChild kabul yolları: (1) `waiting_for_pax`, (2) peopleContext (kişi/person/yetişkin...), (3) **X9-change (2026-07-03)**: CHANGE_KEYWORDS_RE sinyali + isValidPax(1-9) + collectionStep pax-sonrası adım (waiting_for_name/phone/email, ready_for_confirmation) → **PENDING** — Blok 9b'de aynı turn'de kullanıcı-kaynaklı tarih sinyali (dateId/selectedDate/dateRejectedFull) YOKSA kabul. Üçü de değilse silent drop |
| Pending konumu | Bilinçli: Blok 9 SONRASI + Blok 10 ÖNCESİ — Blok 10 auto-assign dateId'si kullanıcı mesajından gelmez, pending iptaline sebep olmamalı. "aslında 3'ü olsun" ayın 3'ü eşleşirse pax İPTAL, tarih akışı kazanır (tarih→pax sızıntı koruması delinmez) |
| Pattern kaynağı | `shared/constants/change-detection.ts` CHANGE_KEYWORDS_RE — process-message A1/A2/A3 `_hasChangeKeyword` ile TEK kaynak (DRY) |
| Kaynak | BUG-X9 ("ondördü olur" 14 pax sızıntısı) + X9-change fix (telefon adımında "aslında 3 olsun" R6'ya takılıyordu) |

### G9 — O1 grubu (birleşik mesaj tarih→ID)
| Parça | Dosya | Ne yapar |
|---|---|---|
| Blok 9 selectedTour fallback | `info-extractor.ts` ~L440-464 | `context.currentTour?.id \|\| params.selectedTour?.id` — tur bu turn'de eşleşti ama state'e yazılmadıysa tarih yine çözülür |
| GREETING→COLLECTING_INFO (T4) | `state-machine.ts` ~L499 | İlk mesajda tur+tarih+pax → TOUR_SELECTED atlanır, veri korunur |
| TOUR_SELECTED informational bypass (T9) | `state-machine.ts` ~L622 | extract varsa informational erken-return atlanır |
| (d) _isStuckOnTourSelected | `process-message.ts` ~L2034 | TOUR_SELECTED + currentTour + !dateId + mesajda rakam → deterministik tarih listesi (FAQ guard'ından BAĞIMSIZ sigorta) |

Kaynak: commit 9a9f687 (2026-07-01/02, 4 katman).

### G10 — K2 adapter stale guard (3 katmanlı)
| | |
|---|---|
| Dosya | `demo-chat/adapter.ts` ~L74 + `whatsapp-webhook/adapter.ts` ~L128 |
| Koşul | `hadReservationInProgress = stage!=="COMPLETED" && !reservationConfirmed && !!reservationInfo.dateId` |
| TTL | GREETING/BROWSING 24h · COLLECTING_INFO/CONFIRMING 45dk · COMPLETED 12h |
| Ne yapar | Stale'de sentinel döner → process-message görünür reset; COMPLETED rezervasyon artık "yarım iptal edildi" sanılmaz |
| Kaynak | K2 (commit 9f54bca) |

### G11 — Eski nesil guard'lar (hepsi HÂLÂ AKTİF — koddan teyitli)
| Guard | Dosya | Durum |
|---|---|---|
| shouldTriggerSummaryReask (:13-PERSIST) | `bypass-gates.ts` ~L255 | Aktif. 5 kapı: CONFIRMING no-op + ready_for_confirmation + !confirmed + intent ∈ {confirm_reservation, general, greeting} |
| buildTourChangePrefix | `tour-change.ts` ~L159 | Aktif. TR+EN tam, diğerleri EN fallback. :11 / :11a-AUTO / H-β prefix'i |
| Kota ön-kontrol | `info-extractor.ts` Blok 8-9 (dateRejectedFull) + `process-message.ts` H-β ~L1210, H-pax ~L1255 | Aktif, Sorun H α/β katmanları |
| fullName negasyon 3-katman | 6b tour-leak gate ~L286 + negasyon leak ~L296 (`nlu-validation.ts` helper'ları) + Blok 3/5 Title-Case guard (Sorun F) | Aktif |
| COMPLETED "teşekkürler" ack | :14a-2 ~L3126 (intent general/greeting → deterministik kapanış, state korunur) | Aktif (Bug A) |
| İsim düzeltme intent-gated override | BUG B PROMOTE ~L921 (provide_info + dolu alan farklı → change_info) + mergeReservationInfo isExplicitCorrection | Aktif |
| FIX 3 sahte onay sigortası | :14b ~L3166 — CONFIRMING + detectConfirmation TRUE ama FSM COMPLETED yapmadıysa state koru + özet tekrar | Aktif (pasif sigorta; K1-denge sonrası teoride ulaşılmaz) |
| validateAIResponse sahte onay | `response-validator.ts` ~L504 — LLM "rezervasyonunuz alındı" uydurmasını 4 stage'de yakalar (48 pattern, 7 dil) | Aktif |
| validateFieldReask | `response-validator.ts` ~L289 — dolu alanın tekrar sorulmasını bloklar; waiting_for_X meşru adım + change_info + changeAck + FAQ istisnalı | Aktif (K4/BUG D + ebf0f17 FAQ fix) |

### G12 — NLU katmanı (guard değil, etkileşim kaynağı)
| Özellik | Kod gerçeği |
|---|---|
| Timeout | 15000 ms; timeout/fail → buildFallbackNLU, **intent="general"** ✅ (taslak doğru) |
| Retry | 2 (503/529 transient) |
| History | **DÜZELTME**: sabit "10 mesaj" değil — `conversationSummary` parametresi (context.ts özeti) prompt'a yazılır |
| availableTours | **BİLİNÇLİ olarak NLU prompt'una GİTMEZ** — tur eşleştirme `tour-matching.ts` fuzzy match'te ✅ |
| paxAdult step-dışı reject | **DÜZELTME**: NLU tarafında DEĞİL — `info-extractor.ts` Blok 1'de (G8/BUG-X9). NLU sadece isValidPax(1-9) doğrular |
| CONFIRMING dikta | nlu.ts ~L162: kısa pozitifler CONFIRMING'de confirm_reservation dönmeli — ama Haiku uymayabiliyor (K1-denge'nin varlık sebebi) |
| Intent map | mapNLUIntentToFSMIntent ~L505: 7 FAQ intent'i → general_question; after_sales/complaint/custom_package/human_handover → support_request; kalanlar birebir |

---

## 4. ETKİLEŞİM NOTLARI (birbirine dokunan guard'lar)

1. **G1 ↔ :13-PERSIST ↔ FIX 3**: T14 Path 1 geçerse ikisine de ulaşılmaz.
   detectConfirmation pattern'i genişletilirse (örn. "tabi" eklenirse) üç
   nokta birden etkilenir — pattern TEK kaynak (state-machine.ts), üçü de
   aynı fonksiyonu çağırır, senkron sorunu yok.
2. **G3 ↔ G8 ↔ A2 ↔ tarih zinciri (Blok 2-9)**: R6'nın önündeki fiili koruma
   A2 dalıdır; A2'nin gözü G8'in pax'ı geçirmesine bağlı. X9-change 3. kabul
   yolu (2026-07-03) bu zinciri kapattı: change-sinyalli pax pending'e alınır,
   Blok 9b tarih çıkmadıysa kabul eder → A2 devralır → R6'ya ulaşılmaz.
   DİKKAT: CHANGE_KEYWORDS_RE'ye kelime eklemek hem A2/A3 dallarını hem G8
   3. yolunu birden etkiler (tek kaynak: constants/change-detection.ts).
   Blok 2-9 tarih zincirine yeni tarih kaynağı eklenirse Blok 9b'nin
   _dateSignalThisTurn kontrolü de kapsamalı.
3. **G5 ↔ T10/T11**: Aynı `produceTourChangeContext` helper'ı; ama T10
   collectionStep'i undefined'a override eder, G5/T11 waiting_for_date
   bırakır. Tur değişiminde adım davranışı stage'e göre farklıdır —
   değiştirirken ikisine birden bak.
4. **G9(T4) ↔ T5**: T4, T5'ten ÖNCE değerlendirilmelidir (dizi sırası).
   T5'in action'ı mergeReservationInfo çağırmaz — T4'ün önüne geçen bir
   transition eklenirse ilk-mesaj verisi yine düşer.
5. **T9 extract-bypass ↔ isInformationalMessage**: informational intent
   listesine yeni intent eklemek T9/T13/T14-Path2/T22/T23'ü birden etkiler
   — 6 farklı transition aynı helper'ı kullanır.
6. **G12 intent map ↔ tüm intent-koşullu guard'lar**: mapNLUIntentToFSMIntent
   değişirse R6 muafiyeti (G3), isAfterSalesMessage (T17), BYPASS_ELIGIBLE
   (:13-PERSIST), _isInfoQuestionFsmIntent (:11) birden etkilenir.
   **FAQ intent listesi 3 yerde tekrar ediyor** (R6 + :11 üst guard'ı +
   :17a-2) — helper'a çıkarma post-launch borcu.
7. **:11a-AUTO ↔ :11a-MANUAL**: AUTO yukarıda RETURN eder; MANUAL'e sadece
   dateAutoAssigned=false düşer. Blok 10'un `tourJustChanged` atlaması
   AUTO'yu kapatır → akış MANUAL'e değil tarih listesine (:11) gider.
8. **validateFieldReask ↔ akış-içi değiştirme (A2/A3)**: A2/A3 "güncelledim"
   ack'i üretir; changeAck guard'ı (2026-06-27) bu mesajları field-reask
   temizliğinden muaf tutar. A2/A3 mesaj şablonu değişirse changeAck
   pattern'i de güncellenmeli.
9. **G10 TTL ↔ K2 mesajı**: hadReservationInProgress koşulu adapter'da
   İKİ dosyada kopyalıdır (demo-chat + whatsapp-webhook) — birinde değişiklik
   diğerine elle taşınmalı (DRY borcu).

---

## 5. AÇIK SORULAR / BİLİNEN RİSKLER

1. ~~**G3 açık bug**: waiting_for_phone'da peopleContext'siz pax değişikliği
   ("aslında 3 olsun") R6'ya takılıyor.~~ **ÇÖZÜLDÜ (2026-07-03, X9-change)**:
   G8'e 3. kabul yolu eklendi — bkz. §3/G8 ve §4 madde 2. R6 muafiyet
   listesine DOKUNULMADI (kök çözüm extract katmanında).
2. **D2 riski (COMPLETED chitchat)**: T23'ün `_isDifferentTour` informational
   bypass'ı niyet sinyali ARAMIYOR — "kapadokya güzelmiş" (aktif rezervasyon
   Antalya iken) yeni akış açar. Teşhis yapıldı (2026-07-02), fix yönü:
   bypass'a hasReservationSignal/hasNewReservationIntent şartı. Uygulanmadı.
3. **"tabi"/"tabiki" yanlış-negatifi**: detectConfirmation pattern'inde yok.
   Kelime-sözlüğü genişletme turu bekliyor (launch-blocker değil).
4. **FAQ intent listesi 3x tekrar** (§4 madde 6) — senkron riski.
5. **K2 guard çift kopya** (§4 madde 9) — adapter'lar arası DRY borcu.
6. **hasReservationSignal negasyon körlüğü**: "rezerve etmiyorum" TRUE döner
   (yorumda kabul edilmiş sınır — detectCancellation sonraki katmanda düzeltir).
7. **:13-PERSIST BYPASS_ELIGIBLE'da "general"**: K1-denge sonrası "evet"
   Path 1'den geçtiği için bu kapıya gerçek onaylar düşmüyor; kalan general'lar
   gerçek belirsiz mesajlar. Ancak NLU bir FAQ'yi yanlışlıkla general derse
   özet-tekrar mesajı FAQ cevabını yutar (yorumda bilinen sınır).
