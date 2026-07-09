# ARCHITECTURE_GUARDS.md — Deterministik Müdahale Noktaları Haritası

> **YAŞAYAN DOKÜMAN**: Her davranış fix'inden önce ilgili bölüm okunmalı,
> her fix'ten sonra bu dosya aynı commit'te güncellenmelidir.
>
> Son güncelleme: 2026-07-09 (FAZ3-P1 — zengin-mesaj filter-guard G16 [V5] + kalıp paketi V1/V6/V7/V12/V3-R6; FAZ3-P2 aynı gün).
>
> **DEPLOY NOTU**: `process-message` shared handler'dır, edge function
> DEĞİLDİR — `supabase functions deploy process-message` çalışmaz.
> Deploy hedefleri: `demo-chat` + `whatsapp-webhook` (ikisi de shared'ı bundle'lar).
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
| **J-14 (FSM-öncesi!)** | COMPLETED iptal-talebi dalı | Deterministik sinyal (iptal+rezervasyon bağlamı, soru/şart-FAQ hariç) → complaints(type=cancellation_request) insert (notify-trigger acenteye bildirir) + 7 dil "talebinizi ilettim" + RETURN — **DB rezervasyonuna dokunulmaz, T16 reset'i olmaz** | J-14 (2026-07-03) |
| T16 | COMPLETED → BROWSING | detectCancellationGuarded (+J-16 DEĞER-ÖNCELİK guard'ı: extract'te fullName/pax/dateId/phone varsa iptal SAYILMAZ — "boşver, ahmet yılmaz olsun" değişikliktir) | J-16 |
| T17 | COMPLETED → COMPLETED | isAfterSalesMessage (FSM intent: support_request/change_info/general_question + ödeme/buluşma/zamanlama pattern'leri) — no-op, context korunur | FIX 2a (dead-code intent map), Murat kararı 2026-06-24 |
| T18/T20 | COMPLETED → BROWSING | hasNewReservationIntent (A5 exclusion dahil) | A5 |
| T19/T21 | COMPLETED → BROWSING | browse_tours/tour_search + selectedTour yok (**general/greeting listeden ÇIKARILDI** — Bug A) | Bug A (2026-06-23) |
| T22 | COMPLETED → TOUR_SELECTED | !informational + selectedTour + reservation intent | — |
| T23 | COMPLETED → TOUR_SELECTED | **FARKLI selectedTour + NİYET SİNYALİ → informational guard BYPASS** + reservation intent değil. Sinyal sınıfları: hasReservationSignal / hasNewReservationIntent / CHANGE_KEYWORDS_RE / negation (değil-not-nicht...) — sinyal yoksa chitchat COMPLETED'de kalır | FIX A2 (2026-06-25) + **D2 fix (2026-07-03)** |

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
 9b. Bilgi çıkarma: extractAllInfo (~L963) → **8-PP PROVIDE PROMOTE** (G13):
     COLLECTING_INFO + beklenen adımın alanı extract edildi + intent=general +
     soru değil → fsmIntent=provide_info
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
 18. :10 iptal ack (~L1929) │ :10b UNKNOWN_TOUR (~L1983) │ **:10c VİZE
     deterministik (G14)** — nluResult HAM intent=visa_support → LLM'e düşmez
 18b. :10e V10 müsaitlik-cevabı (availabilityQueryDay → "müsait ✅"+adım sorusu) │
     :10f V9 çift-eşleşme netleştirme (dateAmbiguousDay → global-indeksli liste +
     waiting_for_date) — ikisi de :11'den ÖNCE (liste tekrarını/sessiz seçimi keser)
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

**V7 emoji onay (2026-07-09)**: detectConfirmation başında YALNIZ-EMOJİ yolu —
mesaj (varyasyon-selektörü/ZWJ/ten-tonu/boşluk strip sonrası) SADECE 👍✅👌🙏💯☑✔
ise onay. Metin+emoji ("👍 ama tarih yanlış") bu yoldan SAYILMAZ → metin
path'leri (negative guard) devralır. Red-emoji (👎❌) whitelist'te yok.

### G2 — Path/section sıralaması (process-message)
§2'deki uçtan uca liste bu haritanın kendisidir. Kritik kural:
**akış-içi değiştirme ailesi (adım 13) FSM'den ÖNCE, R6 (adım 16) FSM'den
SONRA çalışır** — A2/A3 yakalarsa RETURN ile R6'ya hiç ulaşılmaz.

### G3 — R6 telefon validasyonu + D1 muafiyeti + A-P2 tur-sinyal muafiyeti
| | |
|---|---|
| Dosya | `process-message.ts` ~L1824-1900 |
| State | COLLECTING_INFO + waiting_for_phone (önceki turn de aynı step) |
| Koşul | `!extractedInfo.phone` + `!isValidPhone(message)` + intent ∉ {general_question, support_request} + **A-P2 (2026-07-03): `selectedTour===null && multipleTourMatches.length===0`** — mesajda tour-matcher eşleşmesi varsa kullanıcı TUR konuşuyor, "geçersiz telefon" basılmaz (canlı P2: "tur yanlış, kapadokya olacaktı" R6'ya takılıp YANLIŞ TURLA devam ediyordu) |
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
| TOUR_CHANGE_PHRASE_RE (A-P2, 2026-07-03) | RE genişletildi: `tur+yanlış/hata`, `yanlış+tur`, `olacaktı` (düzeltme kipi — "kapadokya olacaktı"da "tur" geçmez). Tüketiciler tur eşleşmesini AYRICA şart koştuğu için "20 aralık olacaktı" tarih düzeltmesi yanlış tetiklemez. 3 tüketici: 7c belirsiz-liste, B2 stage-koruma istisnası, B-5 gate gevşemesi |
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
| **I-9 rakam-tarih ayna (2026-07-03) + V10/V9 (2026-07-09)** | X9'un AYNASI: waiting_for_pax'ta "20'sine/3'ü" (rakam+tarih-iyelik, _dateOrdinalRe) → NLU-pax İSTİSNASI EZİLİR + Blok 8.5. **V10 soru-guard'ı**: müsaitlik-kelime (müsait/uygun/boş/yer var/available) → `availabilityQueryDay` flag → :10e cevaplar (seçim YOK). AYIRICI müsaitlik-kelimesidir, QUESTION_SIGNAL_RE DEĞİL (zıt-yön: soruyu aşırı-yakalamak seçimi kaçırır > tekrar seçtirmek; "20'si olur mu?" soru-formu SEÇİM kalır). **V9 çift-eşleşme**: gün 2+ tarihte varsa `dateAmbiguousDay` flag → :10f netleştirme (SESSİZ İLK-SEÇİM KALKTI). Blok 9c: apostrofsuz "ayın 20" day_ prefix çözümü + raw-day_ sızıntı temizliği. Tek eşleşme/çıplak "20 kişi" davranışı aynen |
| **İSİM-pending (Blok 5b, A-P1 2026-07-03)** | X9-change'in İSİM kopyası. Koşullar: NLU/simple fullName bulamadı + CHANGE_KEYWORDS_RE + `reservationInfo.fullName` DOLU (değişiklik bağlamı) + **isim-bağlam kelimesi ŞART** (isim/ismi/ad/adım/soyad/name — bağlamsız "aslında yarın gelelim" tipi cümlelerin isim sanılmasını kapıda keser). Aday: change/bağlam/dolgu kelimeleri elendikten sonra kalan TAM 2-3 harf-ağırlıklı kelime; **Title-Case ŞARTI YOK** (canlı kanıt: kullanıcılar "leman tete" küçük yazıyor). ASIL SİGORTA: aday Sorun F gate'lerinden geçer (NegationLeak+TourLeak+onay-blacklist, tek-kaynak). Kabul → extractedInfo.fullName → A3-name/BUG B mevcut haliyle devralır. Kaynak: canlı P1 (CONFIRMING'de "ismi düzelt, Ahmet Yılmaz olacak" yutuluyordu — NLU Sorun F correction-guard'ı meşru düzeltmede de null dönüyor, simple/Blok5 step-gated) |

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

### G13 — PROVIDE PROMOTE (BUG B PROMOTE'un simetriği)
| | |
|---|---|
| Dosya | `process-message.ts` 8-PP bloğu (extractAllInfo'nun hemen ardı, F4 öncesi) |
| State | COLLECTING_INFO + waiting_for_{name/phone/pax/date} |
| Koşul | fsmIntent==="general" + **beklenen adımın TAM O alanı** extract edildi (name→fullName, phone→phone, pax→paxAdult, date→dateId/selectedDate — çapraz alan tetiklemez) + mesaj soru değil (`QUESTION_SIGNAL_RE`, 7 dil + ?/؟, constants/question-detection.ts) |
| Ne yapar | fsmIntent → "provide_info" (sadece intent; NLU ham çıktısı/extract dokunulmaz) → isInformationalMessage FALSE olur → T12 merge YAZAR → step ilerler → :11b/:11c deterministik ack |
| Kaynak | Canlı vaka 771f2a84 "Yılda Fufu" (2026-07-03): intent=general → Kural 4 erken-return → isim düştü + LLM sahte kabul mesajı |
| **Sınıf bulgusu** | mergeReservationInfo Kural 4 (`isInformational → {...existing}`) **alandan bağımsız** — intent=general'da isim/telefon/pax/tarih İLK toplamalarının HEPSİ düşüyordu. Haiku "çıplak veri → general" sapması sistematik veri kaybı sınıfıydı; K1 ("evet"→general) ile aynı kök desen |

### G14 — Vize deterministik cevap + tur-detay veri bütünlüğü (DATA-GAP paketi)
| | |
|---|---|
| Dosya | `process-message.ts` :10c bloğu (UNKNOWN_TOUR sonrası, :11 öncesi) + `prompts/helpers.ts` formatTourDetails |
| :10c koşul | **VISA-GATE revize (2026-07-03)**: `hamIntent==="visa_support"` VEYA `VISA_SIGNAL_RE + soru-niteliği (QUESTION_SIGNAL_RE ∪ VISA_QUESTION_HINT_RE)`. Salt ham intent güvenilmezdi — canlı kanıt: Haiku "vize lazım mı"ya faq_general dedi → bypass → LLM "vize gerekmez" dedi. Soru şartı "vizem hazır" bildirimlerini dışarıda tutar. Sabitler: constants/visa-detection.ts (AR "ال" prefix'i optional). 3 cevap dalı: visa_notes dolu → DB içeriği; visa_required===true + notes boş → "gerekli, acenteye danışın"; diğer her durum (false dahil — şema DEFAULT false, güvenilmez) → genel yönlendirme. Tur bağlamı yokken de deterministik. 7 dil |
| FIX 1 (prompt) | formatTourDetails'e eklendi: konaklama, ulasim, hotel_name(+stars), visa_notes/visa_required, price_child (**sadece >0** — 0/null "belirtilmemiş", şemada 0'ın "ücretsiz" semantiği tanımsız). return_date BİLİNÇLİ eklenmedi (Bug A3 "LLM tarih konuşmaz" + seçilmemiş tarih bağlamında yanıltıcı — doğru yer :11, ayrı iş) |
| FIX 2 (sinyal) | Boş kritik alanlar TEK toplu iç-talimat satırında: "⚠️ SİSTEMDE KAYITLI OLMAYAN bilgiler: [liste]... acenteye yönlendir, ASLA tahmin etme, teknik ifade kullanma". Alan-başına satır değil (8 boş satır prompt şişirir) |
| R6 etkileşimi | visa_support → general_question → R6 muafiyetinde; :10c R6'dan SONRA — telefon adımında vize sorusu her iki katmandan doğru geçer |
| Kaynak | 19 Haziran saat tutarsızlığı teşhisi (Bug 4'ün sınıf genellemesi): alanlar DB'de vardı (migration "for expanded chatbot functionality") ama prompt'a hiç bağlanmamıştı |

### G15 — Sahte-değişiklik-ack validator'ı + Vaka-1 zinciri (PAKET 1, 2026-07-03)
| | |
|---|---|
| Dosya | `response-validator.ts` detectFakeChangeAck + `process-message.ts` 17-BV genişletmesi |
| Tespit kriteri (GEREKÇE) | **Gerçek değişiklik-ack'leri YALNIZ deterministik dallardan çıkar (A2/A3/:10d/PROMOSYON) ve hepsi RETURN'lü — LLM'e hiç ulaşılmaz. LLM cevabındaki her "güncelledim/updated" TANIM GEREĞİ SAHTEDİR** — alan/karşılaştırma kontrolü gerekmez |
| İddia-formu | DAR OLUMLU-ÇEKİM listesi (7 dil, lookaround): güncelledim/güncelliyorum/updated/changing/aktualisiert/обновил/تم تحديث... — koşul/teklif formları ("değiştirmek isterseniz", "güncelleyebilirim", "would you like to change") LİSTEDE YOK → yakalanmaz. Negatif-lookahead yerine whitelist (K1 dersi: koşul çekimleri sonsuz, iddia çekimleri sayılabilir) |
| Replacement | Stage-aware (17-BV geçidi): CONFIRMING→özet+onay (*evet yazın*); tur+tarih→mini liste; step→STEP_QUESTIONS; fallback yönlendirme |
| changeAck ÇAPRAZ NOT | validateFieldReask'teki changeAck guard'ı (2026-06-27) "güncelledim"li cevapları field-reask'ten MUAF tutar — ÇELİŞMEZ: deterministik ack'ler validator'a ulaşmaz; ulaşan her "güncelledim" G15 replace eder |
| **Vaka-1 dersi (4 halka)** | (1) "10 aralik" ASCII ay-adı parser kapsamı dışıydı → extract boş; (2) T15 pattern-fallback tarihi sildi (B-3 TASARIM — doğru); (3) LLM "güncelliyorum" sahte ack'i (bu guard'ın kökü); (4) "1 kişi" → parseInt kırpması Blok 8'de 1. tarihi seçti → silinen tarih YANLIŞ değerle geri geldi → yanlış kayıt. Fix'ler: V1-ASCII (ay regex+map süperset) + V1-ack + V1-parseInt (Blok 8 `/^\d+$/` — Yan #1'in tarih simetriği) |
| **CANLI DERS 2 (FAZ2-kapanış)** | **Unit parse ≠ canlı zincir**: V1-ASCII simple-extractor'ı düzeltti, unit test geçti — ama canlı yol farklıydı (NLU dates=["10 aralik"] → Blok 2 normalizeDateString → info-extractor'daki ÜÇÜNCÜ kopya TEXT_MONTHS, ASCII'siz → Blok 9 eşleşemedi → "Invalid date cleaned up"). ÜÇ kopya ay-listesi (simple map + info-extractor TEXT_MONTHS + elle regex'ler) `constants/month-names.ts` TEK KAYNAĞINA indirildi (MONTH_NAME_TO_NUMBER + MONTH_ALTERNATION, uzun-önce sıralı). KURAL: ay-adı listesi/regex'i gereken her yer bu sabitten türetilir |

### Stage × tourDetails ENVANTERİ (2026-07-03 FAZ2-kapanış — hücre hücre keşfetmeyelim diye)
| Stage | tourDetails prompt'ta? | Not |
|---|---|---|
| GREETING | ❌ (currentTour yok — anlamsız) | default dal |
| BROWSING | ❌ (liste formatToursList ile) | tur detayı seçim sonrası |
| TOUR_SELECTED | ✅ (baştan beri) | TR L~403 + EN L~474 |
| COLLECTING_INFO | ✅ **(FAZ2-kapanış eklendi)** | TR+EN — "bilgi soruları için, SADECE bu veriler" |
| CONFIRMING | ✅ **(FAZ2-kapanış eklendi)** | TR+EN — "soru gelirse buradan cevapla, sonra onayı tekrar iste" |
| COMPLETED | ✅ (PAKET 1 / V2) | TR+EN — after-sales + alan-bağımlı buluşma kuralı |

### G16 — Zengin-mesaj filter-guard'ı (V5, 2026-07-09)
| | |
|---|---|
| Dosya | `process-message.ts` — `_isExploreStage` sonrası `_richTourName`/`_richDate` + 4 filtre dalı koşuluna guard |
| Kök | Canlı N-31: "biz 4 kişilik aileyiz 10 aralıkta pamukkaleye..." → "aile" B-TEMA'yı tetikledi, TÜM mesaj (tur+tarih+pax) yutuldu. Filtre dalları (X8/B1/B-DUR/B-TEMA) LİSTE üretir; spesifik tur/rezervasyon istendiğinde yanlış |
| Tasarım | **Primary sinyal = tur-adı adayı** (destination/title anlamlı-kelime, normalize includes) → X8/B1/B-DUR/B-TEMA'yı atlar. **_richDate** → B-TEMA'yı EK atlar (tema en gevşek). **Pax TEK BAŞINA gate DEĞİL** — B1 "3000 bütçe 2 kişi" korunur |
| Tema-daraltma | Çift-anlamlı kelimeler (aile/tarihi/family/historical) bağlam-kelimesi ister ("aile turu", "tarihi yerler"); tek-anlamlı (romantik/macera/doğa...) aynen. `_themeOnlyAmbiguous && !_themeContextRe` → B-TEMA yanmaz |
| V6 B-DUR2 | Aynı guard'lı yeni gün-arama dalı: "N günlük" → tur_sure gün-sayısı eşleştirme (type-enum B-DUR'dan ayrı); eşleşme yoksa "N günlük yok + mevcut liste" (şablon-yankı YOK) |

### CHANGE_KEYWORDS_RE tüketici listesi (7 — genişletirken HEPSİNİ test et)
A1-log, A2 (pax), A3 (date/name/phone), X9-change (Blok 1 pending), Blok 5b
(isim-pending), T23 (COMPLETED chitchat), G8. + 2026-07-09 V3-R6 tarih muafiyeti.
V1 (2026-07-09): yapalım/yapsak/alalım/alsak/yapar mısın eklendi — "yap" tek
başına lookaround'lu (yapıyorum eşleşmez).

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
| **Prompt caching** | **UYGULANAMIYOR (2026-07-03 incelemesi)**: Haiku 4.5 minimum cache'lenebilir prefix eşiği **4096 token** (önceki denemedeki "2048" bilgisi YANLIŞTI); NLU sabit prefix'i (tool şeması + NLU_SYSTEM_PROMPT ≈ 3.5-4.7k token) eşiğin altında/sınırında → cache_control eklense bile Anthropic sessizce cache kurmaz (canlı kanıt: cache_creation=0). Prompt'u yapay şişirmek/availableTours'u geri koymak anti-pattern. **Yeniden değerlendirme koşulu**: NLU_SYSTEM_PROMPT ~18k karakteri aşarsa system'i array+cache_control formatına çevir (prefix=tools+system birlikte); dinamikler (mesaj/summary/state/tur) messages'ta ZATEN doğru yerde. **KURAL (gelecek NLU prompt değişiklikleri)**: NLU_SYSTEM_PROMPT ve nluTool şemasına ASLA dinamik içerik (tarih, tur listesi, session verisi) interpolasyonu yapma — caching bir gün açıldığında ilk byte farkı tüm cache'i kırar; dinamik her şey contextPrompt'a. Not: ana model (Sonnet, ai.ts) caching AKTİF ve bu kural orada bugün zorunlu |

---

## 3b. AKIŞ-İÇİ DEĞİŞİKLİK AİLESİ — ALAN × BAĞLAM MATRİSİ (2026-07-03)

Ailenin resmi haritası (P1+P2 ortak teşhisinden; A-P1/A-P2 fix'leri sonrası durum).
Ortak kök: değişiklik NİYETİ tespiti ortak (CHANGE_KEYWORDS_RE) ama DEĞER
tespiti alan başına asimetrik — telefon=koşulsuz regex, tarih=step-bağımsız
NLU+Blok9, pax=peopleContext+X9-change, isim=Blok5b-pending (A-P1),
tur=tekil-eşleşme(G5)+RE(7c).

| Alan \ Bağlam | waiting_for_date | waiting_for_pax | waiting_for_name | waiting_for_phone | CONFIRMING |
|---|---|---|---|---|---|
| pax | X9 red (ilk-toplama-öncesi, doğru) | ✅ normal | ✅ X9-change | ✅ X9-change | ✅ A2 |
| tarih | ✅ normal | ✅ :10d P5 ack | ✅ :10d P5 ack | ✅ :10d P5 ack | ✅ A3-date |
| isim | — | — | ✅ normal+G13 | ✅ Blok 5b (A-P1) → A3-name | ✅ Blok 5b (A-P1) → A3-name |
| telefon | — | — | ✅ simple koşulsuz | ✅ normal | ✅ A3-phone/PROMOSYON/BUG B |
| tur | ✅ G5 (tekil) | ✅ G5/7c (A-P2) | ✅ G5/7c (A-P2) | ✅ G5(tekil)/7c(belirsiz) + R6 muaf (A-P2) | ✅ aynı |
| **vazgeçme** | ✅ T1-T3 iptal | ✅ + J-16 eleme | ✅ + J-16 eleme (isim sanılmaz) | ✅ + J-16 | ✅ D-20; COMPLETED'da J-14 talep-iletme (reset değil) |

Tarih hücreleri (P5, 2026-07-03): eski ⚠️ ack'siz merge kapatıldı — :10d bloğu
FSM-SONRASI deterministik kontrol yapar: eski dateId DOLUYDU + yeni FARKLI →
"Tarihi X → Y güncelledim ✨" + mevcut adımın sorusu (STEP_QUESTIONS tek-kaynak).
İlk atama (null→değer) ack üretmez (:11a'nın işi). Çift-ack yapısal sıfır:
A3-date tetiklenirse kendi RETURN'üyle FSM'e hiç ulaşılmaz.

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
10. **G13 ↔ Kural 4 ↔ Hayriye (BUG 2)**: Üçgen denge. Kural 4
    (mergeReservationInfo isInformational erken-return) bilgi sorusu sırasında
    yanlış extract'in state bozmasını engeller — G13 bu korumayı SORU-DEĞİL +
    beklenen-alan-dolu şartıyla deler (soru mesajları QUESTION_SIGNAL_RE ile
    dışarıda). Hayriye guard'ı (T13 general bloku) içeriksiz mesajın CONFIRMING
    tetiklememesini ister — G13 extract-yok durumunda promote etmediği için
    korunur; extract VARSA provide_info semantiği zaten doğru (son alan dolunca
    T13 → :13 özet+onay = normal akış). QUESTION_SIGNAL_RE'yi daraltmak Kural 4
    yüzeyini açar; genişletmek G13'ü körleştirir — değiştirirken üçünü birden test et.
11. **G13 ↔ BUG B PROMOTE**: Koşullar ayrık — BUG B dolu+farklı alan +
    provide_info → change_info; G13 boş+beklenen-alan-doldu + general →
    provide_info. Sıra: BUG B extract'ten ÖNCE (nluResult.updates okur),
    G13 extract'ten SONRA (extractedInfo okur). Çakışma yok.
12. **QUESTION_SIGNAL_RE ↔ G13 ↔ G14/:10c (ZIT YÖNLER)**: Aynı global regex
    iki guard'da TERS amaçla kullanılır — G13'te "soru ise promote ETME"
    (aşırı-yakalama GÜVENLİ), :10c'de "soru ise vize cevabı VER" (kaçırmak
    LLM'e düşürür = TEHLİKELİ). Bu yüzden "lazım mı/gerekli mi/required"
    kalıpları global regex'e EKLENMEDİ (G13'ü daraltırdı) — :10c'ye lokal
    VISA_QUESTION_HINT_RE tamamlayıcısı kondu. QUESTION_SIGNAL_RE'yi
    genişletirken HER İKİ tüketiciyi birden test et.

---

## 5. AÇIK SORULAR / BİLİNEN RİSKLER

1. ~~**G3 açık bug**: waiting_for_phone'da peopleContext'siz pax değişikliği
   ("aslında 3 olsun") R6'ya takılıyor.~~ **ÇÖZÜLDÜ (2026-07-03, X9-change)**:
   G8'e 3. kabul yolu eklendi — bkz. §3/G8 ve §4 madde 2. R6 muafiyet
   listesine DOKUNULMADI (kök çözüm extract katmanında).
2. ~~**D2 riski (COMPLETED chitchat)**: T23 bypass'ı niyet sinyali aramıyor —
   "kapadokya güzelmiş" yeni akış açar.~~ **ÇÖZÜLDÜ (2026-07-03, D2 fix)**:
   bypass 4 sinyal sınıfına bağlandı (hasReservationSignal +
   hasNewReservationIntent + CHANGE_KEYWORDS_RE + negation). Negation sınıfı
   kritikti: FIX A2'nin orijinal vakası "antalya değil pamukkale"
   hasNewReservationIntent'e eşleşmiyor ("değil başka" ister) — negation
   olmadan A2 vakası kırılırdı. Kalıntı risk: NLU chitchat'e `browse_tours`
   derse (informational listesinde yok) T23 hâlâ tetiklenebilir — düşük
   olasılık, gözlem altında.
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
8. ~~**validateFieldReask replacement'ı stage-körü**~~ **ÇÖZÜLDÜ (2026-07-03,
   P7)**: replacement stage-aware — COMPLETED→kapanış, CONFIRMING→özet+onay
   (aynen), COLLECTING_INFO→STEP_QUESTIONS adım sorusu (onay/özet dili YOK).
   FAQ-koruma yolu (2026-06-28 fix) dokunulmadı.
9. **Adım-mesaj uyumu katmanı yok**: no-op kalan + LLM'e düşen adımlarda LLM
   bir SONRAKİ alanı sorabiliyor (771f2a84: waiting_for_name'de "telefon?").
   validateFieldReask sadece DOLU alanın tekrar sorulmasını engeller; boş-ama-
   sırada-olmayan alan sorusu yakalanmıyor. PROVIDE PROMOTE (G13) bu vakayı
   kapattı (step artık ilerliyor) ama sınıf genel olarak açık — post-launch
   değerlendirme.
10. **DATA-GAP kalan riskler** (G14 paketi sonrası): return_date hâlâ hiçbir
    katmanda yok ("dönüş ne zaman?" → :11 listesine dönüş tarihi eklemek ayrı
    iş); hotel_details/transport_details deterministik DEĞİL (FIX 1+2 prompt
    katmanı — M1'e bağlı; vize gibi :10c katmanına alınmaları post-launch
    değerlendirme); price_single hiçbir yerde basılmıyor.
11. **Panel backlog**: Yurtdışı turlarda visa/konaklama/ulaşım koşullu zorunlu
    alan + onboarding doluluk uyarısı (acente kritik alanları boş bırakırsa
    bot "acenteye yönlendir" moduna düşer — panel tarafında önlenmeli).
12. **Kozmetik (düşük öncelik)**: validateFieldReask cümle-silme, silinen
    cümledeki emoji artıklarını bırakabiliyor (😊 👥 sonda kalıyor).
13. ~~**P1 CONFIRMING isim düzeltme yutulması**~~ / ~~**P2 telefon adımında tur
    değişikliği R6'ya takılması**~~ **ÇÖZÜLDÜ (2026-07-03, A-P1+A-P2)** —
    bkz. §3b matrisi, G8 Blok 5b, G5 RE genişletmesi, G3 tur-sinyal muafiyeti.
14. **Seçenek B — birleşik change-dispatch (post-launch)**: A1-log iskeletinin
    gerçek dispatch'e terfisi; A2/A3/X9/Blok5b/BUG B'nin tek çatıda toplanması.
    Launch öncesi büyük refactor riski nedeniyle ertelendi; alan başına dar
    fix'ler (X9-change, A-P1, A-P2) kanıtlanmış desen olarak yeterli.
15. ~~**Ack'siz merge sınıfı**~~ **ÇÖZÜLDÜ (2026-07-03, P5)**: :10d bloğu —
    FSM-sonrası dateId dolu→farklı kontrolü + deterministik ack + adım sorusu.
    §3b matrisi güncellendi (tarih hücreleri ✅).
16. **P4 KURALI (kalıcı)**: Gün adları ASLA LLM'e bırakılmaz — koddan
    hesaplanır (`getWeekdayName`, Intl + Europe/Istanbul sabit TZ). Yeni tarih
    basan HER şablon gün adını bu helper'dan almalı; prompt'ta gün-adı-yasağı
    kuralı var (hallucinationGuard). Canlı kanıt: LLM 12.12.2026'ya "Cuma"
    dedi (gerçek: Cumartesi).
17. ~~**P6 sanitize notu**~~ **TERFİ ETTİ (2026-07-03, İş D)**:
    `shared/services/echo-sanitize.ts` → `isEchoSafe(value)` TEK KAYNAK —
    placeholder + >25 karakter + 3+ kelime + göreli-zaman kelimeleri +
    2-kelimelik yüklem-cümlecikleri jenerik forma düşer; kısa makul değerler
    ("15 ocak", "0532 12") tırnaklı kalır. Bağlı şablonlar: :11 tarih-preamble,
    R6 telefon mesajı. KURAL: kullanıcı metnini tırnak içinde geri basan YENİ
    şablon bu helper'dan geçmeli. (:10b unknownTourQuery tour-matcher çıkarımı —
    cümle-yankı riski düşük, kapsam dışı bırakıldı.)
23. **PAKET 2+3+4 ÇÖZÜLDÜ (2026-07-03)**: J-14 iptal talep-iletme (FSM-öncesi
    dal + complaints notify-trigger); J-16 vazgeçme (detectCancellation
    boşver/kalsın/neyse + Guarded değer-öncelik guard'ı + iki isim-yolunda
    token-eleme); I-9 rakam-tarih ayna (G8 tablosunda); İş D echo-sanitize
    (#17 terfi); M-25 çift onay (completion addendum kaldırıldı — kanal ayrımı
    YAPISAL: addendum yalnız bot-sohbet completion'ıydı; panel/send-template-message
    ve new_reservation/agency_new_reservation DB trigger'ları [ekip+acente,
    müşteriye değil] AYNEN).
18. ~~**Ödeme-FAQ verisi prompt'a bağlanacak**~~ **ÇÖZÜLDÜ (2026-07-03, FAZ1
    İş 1)**: `buildPaymentPromptSummary` (payment-message.ts) IBAN'SIZ özet
    üretir (kapora oranı + yöntem ADLARI + "detaylar onay sonrası" kuralı) →
    PromptContext.paymentInfo → agency.ts ACENTE BİLGİSİ bloğu basar. Kök:
    paymentInfo alanı tanımlıydı ama HİÇBİR shared prompt bileşeni basmıyordu
    (legacy demo-chat kalıntısı — G14 sınıfı). IBAN'lı TAM blok onay-sonrası
    generatePaymentMessage'da AYNEN; veri boşsa satır basılmaz → agency
    guard'ı yönlendirir (FIX 2 deseni).
19. **KURAL (kalıcı, FAZ1 İş 2)**: LLM ASENKRON İŞ VAADİ VEREMEZ — tek-turn
    sistem ("kontrol ediyorum" dedikten sonra dönemez). İki katman:
    (i) hallucinationGuard prompt kuralı (TR+EN); (ii) 17-BV post-LLM guard'ı —
    `detectEmptyPromise` (vaat kalıbı VAR + somut veri YOK) → deterministik
    replacement (tur+tarih varsa mini liste / adım sorusu / yönlendirme).
    Vaat+veri birlikte → dokunulmaz.
20. **RESERVATION PROMOTE (FAZ1 İş 2a)**: keşif stage'lerinde (GREETING/
    BROWSING/TOUR_SELECTED) + TUR EŞLEŞMESİ ŞARTIYLA hasReservationSignal →
    fsmIntent=reservation_intent (G13/X7 deseni). Canlı kök: "pamukkale
    rezervasyon" / "yer ayırtabilir miyim" → NLU reservation_intent vermiyordu →
    T4/T7/:11(c) intent-bazlı koşullar kaçırıyordu → LLM boş vaadi. Guard'lar:
    FAQ intent'leri + iptal/şart/iade kelimeleri + mid-flow kapsam DIŞI
    (B2/Özge korunur).
21. **PAKET 1 ÇÖZÜLDÜ (2026-07-03)**: Vaka 1 (sahte güncelleme ack'i + yanlış
    tarihle kayıt) → G15 4-halka zinciri; Vaka 2 (COMPLETED'da yanlış tur
    verisi) → COMPLETED prompt'una ${tourDetails} + buluşma kuralı alan-bağımlı
    yeniden yazıldı (G14 COMPLETED satırları ✅); Vaka 3 (dahil-olanlar
    uydurması) → V3a hallucinationGuard yasağı (şemada alan YOK — liste sayma,
    kişi başı fiyat + acenteye yönlendir).
22. **V3b (panel backlog — G14 paketiyle birlikte)**: tours'a
    included_services/excluded_services kolonları + panel formu; sonra V3a
    yasağı veri-varsa-bas davranışına evrilir (FIX 1+2 deseni).
25. **FAZ3-P1 ÇÖZÜLDÜ (2026-07-09)**: V5 (zengin-mesaj filter-guard, G16) +
    V1 (CHANGE_KEYWORDS çekim) + V6 (B-DUR2 gün-arama) + V7 (emoji onay) +
    V12 (tur-change kip kardeşleri) + V3-R6 (tarih muafiyeti). **V5 kalıntı:
    "çocuklar 8 ve 12 yaşında" → paxChild=2 türetimi bu paket DIŞI** (çocuk-yaş
    → child sayısı; price_child etkisi) — ayrı küçük iş.
24. **Ölü-flag dersi kapandı (2026-07-09, V9)**: `needsMonthClarification`
    simple-extractor'da üretiliyordu ama TÜKETİCİSİ YOKTU → sessiz ilk-seçim.
    Ders: flag üretmek ≠ davranış; her flag'in tüketici dalı olmalı. V9 ile
    ordinal çift-eşleşme (`dateAmbiguousDay`) :10f netleştirme dalına bağlandı.
    NOT: eski `needsMonthClarification` (ayinMatch tourDates yolu) hâlâ
    tüketicisiz — düşük öncelik, o yol Blok 3'te tourDates'siz çağrıldığı için
    fiilen ölü; V9 dateAmbiguousDay onu işlevsel olarak ikame ediyor.
