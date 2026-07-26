# ARCHITECTURE_GUARDS.md — Deterministik Müdahale Noktaları Haritası

> **YAŞAYAN DOKÜMAN**: Her davranış fix'inden önce ilgili bölüm okunmalı,
> her fix'ten sonra bu dosya aynı commit'te güncellenmelidir.
>
> Son güncelleme: 2026-07-09 (FABLE TOPLU-DENETİM — Yan #8 TAM süpürme [injection/sahte-ack RU+AR 26 ölü pattern canlandı, "yirmi şubat" pax-sızıntısı kapandı, TR_MONTHS_GUARD→7-dil tek-kaynak], R6 öneri-onayı muafiyeti, _bookingActionRe malformed-fix, day_/index_ süpürücü [Blok 9e], CHANGE TR-ASCII, ölü-uç temizliği [needsMonthClarification/date_N], 9 PII-log maskelendi, .env untracked. 33/33 + 128-korpus miss=0. Detay §Açık-Sorular-31.).
> Önceki: 2026-07-09 (Faz 5 DİL-PARİTE BÜTÜNCÜL — A: kur tek-zincir [convertPrice kaldırıldı, TL/etiket asla çapraz] + AR translit normalize+alias + confirmation-words.ts TEK KAYNAK [EN confirmed + 7-dil doğal onaylar] + BugA-ack 7-dil. B: AR-rakam ٠-٩ giriş-normalizasyonu + ES "de" tarih-filler + 4 kalan tr+en dict → 7-dil + alias typo'ları. Envanter §6f; korpus 128 vaka + confirmation sınıfı; miss=0.).
> Önceki: 2026-07-09 (Faz 5 Vaka 2 — people-words.ts tek-kaynak; ppl/человек/أشخاص/çocuk X9-kaybı kapandı. 21/21.).
> Önceki: 2026-07-09 (FAZ 4 P3 KAPANIŞ — quota-labels/cancellation-lookaround/agency-etiket/detectLanguage-ü-seed/ascii-dil-geçiş. 29/29 + snapshot 75/75. FAZ 4 P0-P3 7-dil TAMAM.).
> Önceki: 2026-07-09 (FAZ 4 P1 — kritik sinyaller 7-dil: müsaitlik/TOUR_CHANGE/X8/ay-niteleyici-AR/tema-ctx/relative. Baseline 21 gap → fire, 53/53.).
> Önceki: 2026-07-09 (FAZ 4 P0 — dil kapsama envanteri [§6] + 7-dil baseline korpusu + offline proof. Katman-1 boşlukları KANITLANDI.).
> Önceki: 2026-07-09 (NLU-pilot FAZ B — CANLI GEÇİŞ: NLU_MODEL=claude-sonnet-4-6 [secret+redeploy]. Kanıt: A/B model=sonnet-4.6 + cache_read=4497/çağrı; smoke tüm kritik yollar ✅. Geri dönüş: secret unset + redeploy. Detay G12.).
> Önceki: 2026-07-09 (NLU-pilot-A — İş0 göreli-kelime ASCII süperset [relative-date-words.ts TEK KAYNAK; "obür gün" o+ü karışık + bugün/bugun; echo-sanitize REL_ECHO_RE] + İş1 Sonnet-NLU pilotu FAZ A: NLU_MODEL env konfig [default Haiku, davranış değişmez] + koşullu caching [Sonnet array+cache_control] + korumalı A/B debug yolu [demo-chat X-NLU-AB] + korpus/koşum [docs/nlu-ab-corpus.json, scripts/nlu-ab-run.ps1]. FAZ3-P1/P2/P3/P4/mikro aynı gün.).
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
 15b. **V11-a telefon-yok politika dalı (FAZ3-P4)** — R6'dan ÖNCE, FSM-öncesi:
     waiting_for_phone + telefon-yok sinyali → politika mesajı / gönüllü e-posta
     ack / ısrar → contact_request (bkz. G3 altı)
 16. G3/R6 telefon validasyonu (~L1824) — FAQ intent muafiyeti (D1)

FSM SONRASI DETERMİNİSTİK MESAJLAR (hepsi RETURN, LLM atlanır):
 17. O6 tur listesi boş (~L1862) │ B2 akış-ortası tur listesi (~L1883)
 18. :10 iptal ack (~L1929) │ :10b UNKNOWN_TOUR (~L1983) │ **:10c VİZE
     deterministik (G14)** — nluResult HAM intent=visa_support → LLM'e düşmez
 18b. :10e V10 müsaitlik-cevabı (availabilityQueryDay → "müsait ✅"+adım sorusu) │
     :10f V9 çift-eşleşme netleştirme (dateAmbiguousDay → global-indeksli liste +
     waiting_for_date) — ikisi de :11'den ÖNCE (liste tekrarını/sessiz seçimi keser)
 18c. **:10d-2 tarih-öneri ONAY tamamlama (FAZ3-P3)** — context.proposedDateId +
     detectConfirmation("evet") → önerilen tarih SEÇİLİR (DRY, yeni pending-state
     YOK). Farklı tarih yazıldıysa/onay değilse → öneri temizlenir, normal akış.
 18d. **:10g tarih-öneri SUNUMU (FAZ3-P3)** — İş1 V2-b "farketmez/en yakın"
     (waiting_for_date + _anyDateSignal, 7 dil) → EN YAKIN müsait tarihi ÖNER+onay.
     İş3 V3-anafora (dateId DOLU + tam 2 tarih + _v3AnaforaRe "öbür/diğer tarih")
     → seçili OLMAYAN tarihi ÖNER+onay. İkisi de proposedDateId'ye yazar → :10d-2
     kapatır. 3+ tarih/boş dateId → :11 liste. :11'den ÖNCE.
     **İş3 İKİ-KATMAN (bilinçli tasarım)**: (a) CHANGE-KEYWORD'lü form ("aslında
     öbür tarihe alalım") → değişiklik-ailesi (A3-date/:10d P5) DİREKT değiştirir/
     ack'ler (niyet kesin); (b) BARE form ("öbür tarih") → :10g ÖNERİ+onay (niyet
     zayıf, teyit iste). İkisi de doğru — sinyal gücüne göre ayrışır.
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

**V11-a telefon-yok politika dalı (FAZ3-P4, 2026-07-09)** — R6'nın ÖNÜNDE,
FSM-ÖNCESİ (J-14 gibi, "istemiyorum"u cancellation reset'i yutmasın):
- Koşul: `context.stage===COLLECTING_INFO && context.collectionStep===waiting_for_phone && !extractedInfo.phone`. Telefon-extract ÖNCE → numara İÇEREN mesaj dala girmez.
- **Sinyal (deterministik, 7 dil, \p{L}\p{N})**: `_mailAltRe` (mail/e-posta tek başına — telefon adımında mail = telefonla-ver yerine mail niyeti) VEYA `_phoneCtxRe`(telefon/numara) + `_refusalRe`(yok/istemiyorum/kein/pas de...). **"yok" tek başına sinyal DEĞİL** — bağlam-kelime şart.
- **Ürün kararı (a)**: telefon ŞART kalır; nazik gerekçeli politika mesajı ("acente telefonla teyit ediyor"). collectEmail mekanizması DOKUNULMAZ.
- **Gönüllü e-posta (EK alan)**: geçerli e-posta (@) → `reservationInfo.email`'e yazılır + "not ettim ✉️" ack + telefon TEKRAR istenir. :14 RPC `p_email` → `registrations.email` (migration 20260518000002, DEFAULT NULL geriye-uyumlu). E-posta REZERVASYON ŞARTI DEĞİL.
- **Israr eskalasyonu**: `phoneRefusalCount` — 1. ret → politika; 2.+ ret → J-14 deseni: eskalasyon önerisi (`phoneEscalationPending=true`) → "evet" → `complaints(type: contact_request)` insert (trg_notify_agency_support tip-filtresiz → acente bildirimi) + "ilettim" mesajı. Müşteri çıkmazda kalmaz. DB rezervasyonuna dokunulmaz.

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
| Pattern kaynağı | `shared/constants/change-detection.ts` CHANGE_KEYWORDS_RE — process-message A1/A2/A3 `_hasChangeKeyword` ile TEK kaynak (DRY). **people-context: `shared/constants/people-words.ts` (2026-07-09 Faz 5) — 4 tüketici TEK kaynak** |
| Kaynak | BUG-X9 ("ondördü olur" 14 pax sızıntısı) + X9-change fix (telefon adımında "aslında 3 olsun" R6'ya takılıyordu) |
| **Faz 5 — people-context 7-DİL TEK KAYNAK (2026-07-09, Vaka 2)** | Canlı: EN-seed "pamukkale tour dec 10 **for 2 ppl**" → NLU `people={adults:2}` DÖNDÜ ama X9 `_hasPeopleContext` REDDETTİ (ppl listede yok) + simple-extractor da yakalamadı → pax birleşik-mesajda kayboldu, bot yeniden sordu. **4 KOPYA** (info-extractor `_peopleContextRe`, simple-extractor `peopleContext`+`paxPatterns[0]`+`paxChildPatterns`) + EN "ppl"/DE "Personen"(`\bperson\b` uymaz)/RU "человек"(`\b` Kiril)/AR "أشخاص"(`\b` Arapça)/TR "çocuk"(ç-başlangıç) YOKTU/kırıktı (Yan #8). **FIX:** `constants/people-words.ts` TEK KAYNAK — `PEOPLE_CONTEXT_RE` (adult∪child, lookaround) + `PAX_ADULT_RE` (digit→paxAdult) + `PAX_CHILD_RE` (digit→paxChild). **ADULT/CHILD ayrımı:** child yalnız CONTEXT+paxChild, paxAdult'a KARIŞMAZ ("2 çocuk" paxAdult=2 YAPMAZ). X9 kabul dengesi KORUNDU (peopleContext∨waiting_for_pax) ∧ ¬dateOrdinal — "ondördü olur" REDDİ, çıplak "3" pax-adımı, "20'sine" tarih-yolu aynen. **Sınıf (teşhis):** EN ppl / RU человек / AR أشخاص KAYBEDİYORDU (X9+simple ikisi de); DE Personen X9-fail/simple-rescue; FR personnes / ES personas OK. Faz-B "tur+pax bir tur geç" FSM-merge'i AYRI kök (pax extraction'a ulaşmadan kaybolduğu için burada moot) |
| **I-9 rakam-tarih ayna (2026-07-03) + V10/V9 (2026-07-09) + İş0 (FAZ3-P3)** | X9'un AYNASI: waiting_for_pax'ta "20'sine/3'ü" (rakam+tarih-iyelik, _dateOrdinalRe) → NLU-pax İSTİSNASI EZİLİR + Blok 8.5. **V10 soru-guard'ı**: müsaitlik-kelime (müsait/uygun/boş/yer var/available) → `availabilityQueryDay` flag → :10e cevaplar (seçim YOK). AYIRICI müsaitlik-kelimesidir, QUESTION_SIGNAL_RE DEĞİL (zıt-yön: soruyu aşırı-yakalamak seçimi kaçırır > tekrar seçtirmek; "20'si olur mu?" soru-formu SEÇİM kalır). **V9 çift-eşleşme**: gün 2+ tarihte varsa `dateAmbiguousDay` flag → :10f netleştirme (SESSİZ İLK-SEÇİM KALKTI). **İş0 Blok 8.5 yeniden yazımı (KÖK)**: gün-sayısı 3 KAYNAKTAN toplanır — (a) apostroflu _dateOrdinalRe, (b) düz "ayın N", (c) **NLU ÇIPLAK-SAYI** (ay-adsız ordinal'de NLU dates=["20"] → Blok2 selectedDate="20" → eski `!selectedDate` guard'ı bloke ediyor → RAW "20" şablona sızıyordu: `"20" müsait değil`). Çıplak-sayı tarih-adımında yakalanır + `delete selectedDate` (RAW asla state'e/şablona sızmaz). **Ay-niteleyici** ("bu ayın/gelecek ayın", 7 dil, Europe/Istanbul ayı) → o aya SINIRLI eşleşme; o ayda yoksa availabilityQueryDay→:10e "görünmüyor". Routing: tek→SEÇ, çoklu→dateAmbiguousDay, sıfır→:11 liste. Blok 9c: apostrofsuz "ayın 20" day_ prefix çözümü + raw-day_ temizliği. Blok 9d: **relative_ prefix TÜKETİCİSİ** (V8-ucuz) — simple-extractor tourDates ile çağrılıyor (Blok 3), "yarın/öbür gün" tur tarihiyle kesişmezse relative_ISO temizlenir→:11 liste (eski ölü-flag: consumer yoktu, RAW sızardı). **Blok 2 GÖRELİ-KELİME NLU GUARD'ı (FAZ3-mikro FIX2, İş2 kalıntısı)**: canlı vaka — pax adımında "yarın" → NLU konuşma-özetindeki seçili tarihi (20.12) ÇAPA alıp "2026-12-21" ISO üretti → relative_ zinciri HİÇ devreye girmedi → ham ISO şablona sızdı. Kök: göreli ifadelerde NLU dates[] GÜVENİLMEZ (yanlış çapa). Fix: `hasRelativeDateWord(message)` (extractRelativeDate 7-dil setini YENİDEN kullanır, kopya yok) TRUE ise NLU dates YOKSAYILIR → extractRelativeDate/Blok 9d (bugün-çapa, Europe/Istanbul) otorite. Net tarih ("10 aralık") göreli-kelime içermez → guard tetiklenmez. **Yan #8 KÖK**: extractRelativeDate tomorrow/dayAfter/nextWeek grupları `\b` kullanıyordu → non-ASCII ile başlayan göreli kelimeler ("öbür gün"/"übermorgen"/"завтра"/"غدا") HİÇ eşleşmiyordu (gün-adları zaten lookaround'a çevrilmişti) → üçü de `\p{L}\p{N}` lookaround'a çevrildi (7-dil kapsaması gerçekleşti). NLU_SYSTEM_PROMPT'a sabit kural: göreli ifadeleri ISO'ya ÇEVİRME. **İş0 ASCII SÜPERSET (2026-07-09 NLU-pilot-A)**: göreli-kelime setleri `constants/relative-date-words.ts` TEK KAYNAK'a taşındı (month-names deseni). Canlı "obür gün" (o+ü KARIŞIK) eski sette yoktu (öbür/obur vardı) → ham sızdı → 4 TR varyant (öbür/obür/öbur/obur) + bugün/bugun (yeni, offset 0) baked-in. extractRelativeDate + hasRelativeDateWord + echo-sanitize (REL_ECHO_RE) AYNI kaynağı tüketir → kopya-liste senkronsuzluğu (canlı bug sınıfı) kapandı. REL_DAY_NAMES `string[][]` (dış indeks=hafta günü, iç=varyant) → offset semantiği korunur. Tek eşleşme/çıplak "20 kişi" davranışı aynen |
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
| **MODEL KONFİG (2026-07-09 NLU-pilot-A)** | `resolveNluModel(override)` = `override \|\| Deno.env NLU_MODEL \|\| "claude-haiku-4-5-20251001"` (DEFAULT Haiku → secret set edilmedikçe davranış BİREBİR). `nluModelUsesCache(model)` = `/sonnet/i` → koşullu caching (Sonnet system array+cache_control; Haiku düz). `[nlu] MODEL=<model> cache=<bool>` + CACHE_USAGE'a model/cache eklendi. **GEÇİŞ = `supabase secrets set NLU_MODEL=<model>` + REDEPLOY**; env değişimi worker'a yeni deploy'da yansır (çalışan worker restart olmaz — mevcut instance eski env'i taşır; **redeploy ZORUNLU** — canlı doğrulandı: secret set sonrası A/B yolu ancak redeploy'la aktifleşti). |
| **CANLI: NLU = Sonnet-4.6 (2026-07-09 FAZ B geçişi)** | **NLU_MODEL=claude-sonnet-4-6 CANLI** (secret set + demo-chat & whatsapp-webhook redeploy). Kanıt: A/B yolu `model=claude-sonnet-4-6`, canlı CACHE_USAGE `cache_read=4497/çağrı` (koşullu caching aktif). A/B ölçüm referansı: FAZ A `docs/nlu-ab-corpus.json` (25 vaka, 22 aynı / 3 fark; 3 fark deterministik guard'ları bozmuyor, Sonnet halüsinasyon↓). Maliyet: Sonnet-cache'li ≈ Haiku (hatta ~%20↓ sıcak-cache'te; canlı yayılımda cache-hit daha düşük). Smoke (FAZ B): rezervasyon COMPLETED+RPC success ✅, :10c vize ✅, X8 en-ucuz ✅, greeting/tarih-liste ✅, chitchat ✅. **GERİ DÖNÜŞ (tartışmasız, kritik yol bozulursa) = `supabase secrets unset NLU_MODEL` (veya eski değere set) + demo-chat & whatsapp-webhook REDEPLOY** → default otomatik Haiku'ya döner. NOT: birleşik "tur+pax" mesajında pax bir tur geç sorulabilir — MODEL-BAĞIMSIZ FSM-merge davranışı (A/B: iki model de people=2 döndürür), Sonnet regresyonu DEĞİL, veri kaybı yok. |
| **NLU A/B DEBUG YOLU** | demo-chat: `X-NLU-AB` header'ı `NLU_AB_TOKEN` secret'ıyla TAM eşleşirse mesajı iki modelde (Haiku+Sonnet-4.6) NLU'dan geçirip ham çıktıları döndürür. **GÜVENLİK**: token yoksa/yanlışsa yol TAMAMEN kapalı (varlığı gizli, normal akış); STATE'e YAZMAZ, rezervasyona GİRMEZ, DB'ye dokunmaz; rate-limit/sessionId'den ÖNCE (ölçüm izole). Korpus: `docs/nlu-ab-corpus.json` (25 vaka); koşum: `scripts/nlu-ab-run.ps1`. |
| **Prompt caching** | **UYGULANAMIYOR (2026-07-03 incelemesi)**: Haiku 4.5 minimum cache'lenebilir prefix eşiği **4096 token** (önceki denemedeki "2048" bilgisi YANLIŞTI); NLU sabit prefix'i (tool şeması + NLU_SYSTEM_PROMPT ≈ 3.5-4.7k token) eşiğin altında/sınırında → cache_control eklense bile Anthropic sessizce cache kurmaz (canlı kanıt: cache_creation=0). Prompt'u yapay şişirmek/availableTours'u geri koymak anti-pattern. **Yeniden değerlendirme koşulu**: NLU_SYSTEM_PROMPT ~18k karakteri aşarsa system'i array+cache_control formatına çevir (prefix=tools+system birlikte); dinamikler (mesaj/summary/state/tur) messages'ta ZATEN doğru yerde. **KURAL (gelecek NLU prompt değişiklikleri)**: NLU_SYSTEM_PROMPT ve nluTool şemasına ASLA dinamik içerik (tarih, tur listesi, session verisi) interpolasyonu yapma — caching bir gün açıldığında ilk byte farkı tüm cache'i kırar; dinamik her şey contextPrompt'a. Not: ana model (Sonnet, ai.ts) caching AKTİF ve bu kural orada bugün zorunlu. **GÜNCELLEME (2026-07-09 NLU-pilot-A)**: KOŞULLU caching uygulandı — model Sonnet ailesindeyse (eşik 2048, NLU prefix ~3.5-4.7k > 2048) system array+cache_control'e çevrilir; Haiku'da düz kalır (eşik 4096, anlamsız). Yani Sonnet'e GEÇİLİRSE caching otomatik devreye girer. A/B ölçüm CACHE_USAGE loglarından cache_read kanıtı toplanır (scripts/nlu-ab-run.ps1). |

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
11. **Panel backlog** → **KISMEN ÇÖZÜLDÜ (2026-07-10 Panel-1/2/3)**:
    - **Panel-1 (ÇÖZÜLDÜ)**: tur-alan doluluk göstergesi — tek-kaynak
      `src/utils/tourCompleteness.ts` (kritik-alan seti + koşullu konaklama[gecelemeli]/
      vize[yurtdışı] + exampleQuestion→öneri-8 helper kaynağı). ToursList satır-rozeti
      (%+eksik, yeşil/sarı/kırmızı, tooltip'te örnek müşteri sorusu) + TourFormDialog
      kaydet-adımı engellemeyen uyarı + OnboardingChecklist 8. madde "Tur bilgileri
      eksiksiz (X/Y)". 9/9 test.
    - **Panel-2 (ÇÖZÜLDÜ)**: visa_required DEFAULT-false tuzağı — migration
      `20260710000001` DROP DEFAULT (kolon zaten nullable; yeni tur NULL=belirtilmedi;
      mevcut 20 false satır DOKUNULMADI). Form 3-durumlu Select. **BOT DEĞİŞMEDİ**:
      `:10c`/helpers.ts `visa_required === true` kesin kontrolü → NULL, false ile aynı
      else/veri-yok dalı (canlı smoke: "vize gerekli mi" → genel-yönlendirme). **VİZE
      false→GERÇEK-CEVAP GEÇİŞİ NOTU**: eski false'lar hâlâ default-artığı olabilir;
      "visa_required=false → güvenilir 'vize gerekmiyor' cevabı" GEÇİŞİ, eski false'ların
      NULL'a temizlenmesi (veri-temizliği) SONRASI AYRI KARAR — şimdi muhafazakâr korunuyor.
    - **Panel-3 (ÇÖZÜLDÜ)**: ödeme-kaydı silme onayı (RegistrationDetailDialog —
      onaysız→AlertDialog, tutar+tarih+geri-alınamaz).
    - **KALAN panel backlog (öneri 5-9 + nice-to-have, Fable panel-denetimi):**
      (5,M) payment_instructions 7-dil sekmeli giriş (şu an TR+EN; A1 sızıntısı
      kapandı ama non-TR bank-notu GİRİLEMİYOR); (6,L) mobil responsive (Admin
      sidebar drawer + liste→kart); (7,S) enabled_languages onboarding'e belirgin
      bağlama; (8,M) alan-başı bot-bağlantısı helper metinleri (tourCompleteness
      exampleQuestion'dan); (9,S) tours/tour_dates RLS `TO authenticated` daraltma;
      (nice) terminoloji birleştirme, Excel-import↔form parite denetimi, ödeme-silme
      audit-izi (kim sildi). NLU_AB_TOKEN kapatma → Murat kararı (§31).
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
    **FAZ3-mikro FIX1 (2026-07-09) — SORUMLULUK AYRIMI**: isEchoSafe KARAR verir
    (tırnaklı mı jenerik mi), FORMAT ayrı katman GÖRÜNTÜLER. :11 tarih-preamble'da
    değer ISO (YYYY-MM-DD) ise DD.MM.YYYY + gün adı'na çevrilir (getWeekdayName
    TEK KAYNAK) — canlı `'"2026-12-21" tarihi ... müsait değil'` ham-ISO sızıntısı
    kapandı. Çeviri echo-sanitize'a DEĞİL format katmanına konur (sanitize karar,
    format görüntü — sorumluluk ayrımı).
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
29. **NLU-pilot-A (2026-07-09)**: İş0 göreli-kelime ASCII süperset (relative-date-words.ts
    tek kaynak; "obür gün" o+ü karışık kalıntısı + bugün/bugun offset 0; echo-sanitize
    REL_ECHO_RE) ÇÖZÜLDÜ. İş1 Sonnet-NLU pilotu FAZ A = SADECE altyapı+ölçüm, CANLI
    DAVRANIŞ DEĞİŞMEZ (NLU_MODEL default Haiku). **FAZ B (bekliyor)**: A/B fark tablosu
    Sonnet lehine/maliyet kabul edilebilir çıkarsa `secrets set NLU_MODEL=claude-sonnet-4-6`
    + redeploy → canlı geçiş; sonra deterministik guard'ların Sonnet'le hâlâ gerekli
    olup olmadığı ayrı denetim. **Açık**: debug yolu koşumu deploy sonrası (secret gerekli).
    **FAZ B YAPILDI (2026-07-09)**: NLU_MODEL=claude-sonnet-4-6 CANLI (secret+redeploy);
    smoke tüm kritik yollar geçti (RPC success, :10c, X8, chitchat), cache_read=4497
    canlı kanıt. Kalan denetim: deterministik guard'lar Sonnet'le hâlâ gerekli mi
    (guard-azaltma fırsatı) + gerçek trafik cache-hit/maliyet ölçümü (sıcak-cache smoke'u
    prodüksiyonu abartır). Birleşik tur+pax merge nüansı (model-bağımsız) ayrı izlenir.
30. **FAZ 4 KAPANIŞ (2026-07-09) — 7-DİL KAPSAMA TAMAM (P0-P3)**: P0 teşhis+baseline
    korpusu (§6, 121 vaka); P1 kritik sinyaller 7-dil (müsaitlik/TOUR_CHANGE/X8/
    ay-niteleyici/tema-ctx/relative-AR+TR-çekim); P2 LLM prompt blokları 7-dil
    (stage/step/guard/no-fake-confirm/tone → prompts/lang/*.ts bundle, TR/EN inline
    korundu); P3 kapanış (quota-labels 7-dil DRY, detectCancellation lookaround,
    agency-etiket 7-dil, detectLanguage ü-belirsizlik seed-fix, akış-ortası ASCII
    dil-geçiş muhafazakâr). **KALAN BİLİNÇLİ İSTİSNALAR:** (a) NLU_SYSTEM_PROMPT
    İngilizce kalır — yapısal, çıktı yapısal-JSON, kullanıcıya görünmez (G12);
    (b) J-14 acente-özeti iç-metin TR-only — acenteye gider, müşteriye değil;
    (c) enabled_languages panel yönetimi (acente hangi dilleri açar) — panel-backlog;
    (d) agency-blok KURAL metinleri + working-hours gün-adları 5-dilde EN (semantik
    hallucinationGuard'da 7-dil, düşük değer). **Kabul:** davranışsal P1 53/53 +
    P2 snapshot 75/75 + P3 29/29 + 121-korpus miss=0 + 5-dil canlı smoke sahte-onay-yok 5/5.
35. **7-BEKLEME-DURUMU KESİŞİM DENETİMİ (2026-07-22, FABLE; +6.durum 07-24; +7.durum 07-25) — TEMİZ**.
    6 eşzamanlı-olabilir bekleme bağlamı: proposedDateId, pendingTourClarification (A1),
    phoneEscalationPending (V11-a), pendingLangSwitch (P3), B3 feedback-penceresi,
    **pendingCancelConfirm (§35-6, COMPLETED çıplak-iptal teyidi)**.
    **Kesişim-matrisi (bekleme × gereken stage/step):**
    | Durum | Gerekli bağlam | B3 ile çakışır? |
    |---|---|---|
    | proposedDateId | COLLECTING_INFO/waiting_for_date | HAYIR |
    | pendingTourClarification | COLLECTING_INFO/CONFIRMING | HAYIR |
    | phoneEscalationPending | COLLECTING_INFO/waiting_for_phone | HAYIR |
    | pendingLangSwitch | herhangi stage (dile ortogonal) | var ama zararsız |
    | B3 feedback | YALNIZ GREETING/COMPLETED/akış-yok | (kendisi) |
    | **pendingCancelConfirm** | **YALNIZ COMPLETED** | **HAYIR (evet/hayır ≠ rakam/⭐)** |
    | **pendingFieldUpdateConfirm** | **YALNIZ CONFIRMING** | **HAYIR (B3 COMPLETED'da)** |
    **§35-7 pendingFieldUpdateConfirm (PAKET-B, 2026-07-25):** CONFIRMING'de düşük-güven
    alan-değeri (DAL1'e girmedi, change-keyword yok) → değer-echo teyit ("Kişi sayısını 3
    yapayım mı?"); TEK-TURN-ömür. onay→uygula+özet+💰 / ret→değer-AT+onay-sorusu / alakasız→
    temizle. **YALNIZ CONFIRMING'de set** → pendingCancelConfirm (COMPLETED) ile stage-ayrımıyla
    MUTUALLY-EXCLUSIVE (aynı turda ikisi set edilemez). B3 (COMPLETED-penceresi) ile çakışmaz.
    **KÖK-1 DAVRANIŞ-MATRİSİ (CONFIRMING mesajı):** (1) saf-onay(değersiz)→commit; (2) değer +
    düzeltme-sinyali(positive-only ∥ negasyon ∥ change-kw)→DAL1 UYGULA+özet+💰+re-ask (commit
    YOK, sarmalayıcı evet/hayır'dan bağımsız); (3) değer + sinyalsiz→§35-7 değer-echo; (4) değersiz
    belirsiz→_belirsizMsgs; (5) saf-ret→ne-değişecek. F4-L2 DAL1 tespiti **positive-ONLY**
    (negatif-guard DAL1-kapısından çıktı; SAF-ONAY yolunda negatif-guard KALIR → "onaylamıyorum"
    commit ETMEZ). Değer ASLA atılmaz (S2/S3 yanlış-veri kökü kapandı).
    **§35-6 pendingCancelConfirm (2026-07-24):** COMPLETED + iptal-sinyali AMA
    rezervasyon-kelimesi YOK → "Rezervasyonunuzu iptal etmek mi istiyorsunuz?" 7-dil
    teyit; TEK-TURN-ömür (proposedDateId deseni). Sonraki turn: onay (detectConfirmation
    tek-kaynak) → `_fileCancellationRequest` (J-14 ile AYNI complaints yolu) / ret
    (detectNegativeResponse) → "rezervasyon geçerli" ack / alakasız → flag temizle +
    normal akış. **YALNIZ COMPLETED'da set edilebilir → COLLECTING-durumlarıyla (proposedDateId/
    pendingTourClarification/phoneEscalation) mutually-exclusive.** B3 ile çakışmaz:
    confirmation-words rakam/⭐ İÇERMEZ ("evet/ja/да" ≠ B3 puan-deseni); B3 webhook'ta
    process-message'dan ÖNCE koşar ama "evet" parseRating=null → B3 atlar → CHECK yakalar.
    Rezervasyon-KELİMELİ iptal (J-14) TEYİTSİZ direkt kalır (dokunulmadı). Olumsuzlama
    ("iptal etmeyeceğim") yanlış-pozitifi = fazladan 1 teyit sorusu (tasarım-kabul).
    **Bulgular (kod-kanıtlı, LEAK YOK):** (1) **B3-CAPTURE guard'ı** (feedback-capture.ts:
    `step || stage∈{COLLECTING_INFO,CONFIRMING,TOUR_SELECTED,BROWSING} → return false`)
    aktif-akışlı 3 durumu TAM kapsar → feedback-penceresi açık müşteri yeni akışta
    CONFIRMING'de "5" / pax-adımında "3" derse **feedback'e KAÇMAZ** (preloadedContext
    her turn saved-state; pax/date normal akışa gider). B3 ile diğer 3 durum
    **mutually-exclusive**. (2) **proposedDateId TEK-TURN ömürlü** — :10d-2 else-dalı
    (process-message ~L2656-2659) her turn temizler → waiting_for_phone'a stale
    ulaşamaz → "evet" phone-adımında yanlışlıkla tarih-onayına gitmez (phoneEscalation
    @L2161 zaten :10d-2 @L2616'dan önce). (3) pendingLangSwitch dile ortogonal (rakam/
    "evet" lang-taşımaz → çakışmaz). (4) 7b-0 (clarification) tur-eşleşmeden ÖNCE →
    "1" clarification-seçimi olarak tüketilir, tek-atış temizlenir. (5) A2 fiyat-prefix
    tek-site (:11b) → çift-basma yok. **S-fix gerekmedi — tasarım sağlam.** Ayrıca
    doğal-cron kanıtı: 07-11 09:00 UTC tour-reminder-daily → gerçek gönderim (success);
    var-sıra fix TEMPLATE_VAR_ORDERS ↔ Meta gövdeleri tutarlı; reminder CONFIRMED-only
    ↔ feedback CONFIRMED-only tutarlı.
34. **B3 ANKET CEVAP-YAKALAMA — VAAD KAPANDI (2026-07-10)**. Müşteri anket puanı
    artık kaydediliyor (eskiden kayboluyordu). **Şema:** `registrations.feedback_sent_at`
    (timestamptz) + yeni `tour_feedback` tablosu (id, agency_id, registration_id UNIQUE,
    customer_phone, rating int CHECK 1-5, comment, created/updated_at; RLS acente-izole).
    **Gönderim işareti:** send-feedback-survey başarıda `whatsapp_user_profiles.
    last_feedback_sent_at` + `registrations.feedback_sent_at = now()`.
    **Yakalama (whatsapp-webhook, FSM-ÖNCESİ, services/feedback-capture.ts):** yeni dal
    **process-message'dan ÖNCE** çalışır; sıra: dedup/preload → rate-limit → abonelik →
    bot-pause → **B3-CAPTURE** → process-message. Guard'lar (hepsi birden): (a) aktif
    toplama akışı YOK (preloadedContext stage COLLECTING_INFO/CONFIRMING/TOUR_SELECTED/
    BROWSING veya collectionStep varsa **tamamen pas** — pax "3" puan sanılmaz), (b)
    pending pencere (feedback_sent_at + 72h, henüz tour_feedback yok), (c) puan-deseni
    (tek rakam 1-5 / 1-5 ⭐ / yazıyla 1-5 7-dil — TEK KAYNAK constants/rating-words.ts,
    \p{L}\p{N} lookaround; AR-rakam giriş-noktasında ٥→5 normalize; 6+/tarih/tur/kişi
    sinyali → RED). Yakalarsa: tour_feedback UPSERT (reg-başı tek; 2. puan → UPDATE +
    yorum append) + 7-dil teşekkür + (rating≤2) complaints(low_rating) J-14 bildirimi +
    profile.feedback_score/comment (CRM ActivityTimeline 'feedback_received' event'i
    otomatik gösterir). Desen değilse → normal akış (pencere içinde tekrar denenebilir).
    Test: parseRating 29/29 (7-dil + AR-rakam + çakışma-negatifleri) + 128-korpus miss=0
    + canlı: tour_feedback insert/CHECK(1-5)/UNIQUE doğrulandı, throwaway temizlendi.
33. **FAZ6 — KABUL-FIX'LERİ + VAAD DENETİMİ (2026-07-10)**.
    **A-fix'ler (canlı-kanıtlı):** A1 pendingTourClarification (types.ts alanı;
    7c adayları yazar → 7b-0 SONRAKİ mesajı numara/kısmi-ad seçimi olarak dener,
    lokalize-title dahil; eşleşmezse normal-akış/R6; TEK-ATIŞ) — canlı: TR "kültür
    turu" + EN "balloon tour" + numara + alakasız-R6 ✓. A2 fiyat-prefix (:11b,
    TEK-KAYNAK constants/price-question.ts) — canlı "2 kişi için toplam 7.000₺" ✓.
    A3 ack teşekkür-daraltma (TEK-KAYNAK constants/thanks-words.ts) — canlı
    chitchat→LLM, teşekkür→ack ✓. 7-dil şartı: buildTourChangePrefix TR+EN→7-dil.
    **VERİ-BULGUSU:** demo title_en/ru YARIM-ÇEVİRİYDİ ("Cappadocia Balon Turu"
    — keyword-replace çıktısı DB'ye yazılmış) → düzeltildi; translate-tour/import
    çıktıları için denetim-notu.
    **VAAD DENETİMİ (B) ÖZETİ:**
    - **B2/B3 HATIRLATMA+ANKET: HİÇ CANLI TETİKLENMEDİ** — cron'lar aktif
      (09:00/12:00 UTC, her gün "succeeded") AMA `agency_event_templates` **0
      satır** → iki function da her gün "No matchings" ile boş döner
      (reminder_sent=0, last_feedback_sent_at=0 doğruladı). Kök: hiçbir acente
      (demo dahil) panelde eşleştirme kurmamış. Function-kalitesi iyi (plan-gate,
      idempotent flag, 24h-pencere, 500ms rate-limit, template-based=24h-muaf).
      **Boşluklar:** (M) dil-eşleşme fallback'siz — profil-dili≠satır-dili →
      SESSİZ atlama (acente tek-dil kurarsa yabancı müşteri hiç almaz); (S)
      feedback-cron'un gömülü JWT'si 1-karakter kısa (verify_jwt=false olduğundan
      bugün etkisiz — yine de düzeltilmeli, verify açılırsa sessiz ölür); (S)
      cron tanımları migration-dışı (drift); (kozmetik) UTC gün-granül pencere.
    - **B3 EK: ANKET-CEVABI YAKALANMIYOR** — webhook'ta survey/rating ayrımı YOK;
      müşteri "5" yazarsa normal akışa girer, sonuç HİÇBİR YERE yazılmaz, acente
      GÖREMEZ. Vaadın "değerlendirme" yarısı eksik (M/L paket: quick-reply
      butonlu template + button-payload yakalama + feedback tablosu + panel).
    - **B1 CRM/TANIMA:** profil toplama ÇALIŞIYOR (64 profil; dil-tercihi,
      last_interaction, insights[TR-hardcoded 6 keyword — sığ], auto-tag trigger).
      Bot KONUŞMADA kullanım: returningUserName→prompt "adıyla selamla"
      (total_bookings>0 şartı; registrations-trigger +1 canlıda 1 örnek —
      phone-normalize eşleşmesi izlenmeli). TTL-sonrası dil-tercihi/isim profilde
      korunur ✓. Boşluklar: (M) geçmiş-rezervasyon bilgisi konuşmaya taşınmıyor;
      (S) insights keyword'leri 7-dil tek-kaynağa; (M) `send-follow-up-messages`
      CRON'SUZ (tetikleyicisiz ölü function — karar: cron ekle ya da kaldır);
      (M) conversation-state.ts/tour-switch-detector/intelligent-handler eski-
      mimari kalıntıları (index bağlamıyor) — ölü-ağırlık temizliği.
    - **B4 WEBHOOK:** SAĞLAM: HMAC(+eksik-imza reddi), atomik dedup+preload,
      uzun-mesaj 7-dil, Meta 429/5xx tek-retry+Retry-After, PII-mask, bot-pause,
      self-heal subscribe, send-manual-message 24h-pencere kontrolü. **S-FIX'LENDİ:**
      desteklenmeyen-tip nazik yanıt 7-dil (eski: sesli/konum/sticker→TAM SESSİZ;
      caption'sız medya→`[audio]` literal'i NLU'ya) — reaction/edited SESSİZ kalır
      (doğru). M-bulgu: aynı-kullanıcı eşzamanlı FARKLI-id çift mesaj yarışı
      (dedup id-bazlı; context last-write-wins — kuyruk/lock paketi).
32. **FABLE REVIEW-2 (2026-07-09, etkileşim-denetimi tamamlama)** — R6-deseni
    (mekanizmalar tek tek doğru, SIRALAMA yanlış) avı. **Fix'lenen (S):**
    :10g farketmez-dalında FAQ-intent guard'ı YOKTU (KÖK6 sınıfı) — "ilk önce
    iptal şartlarını sorayım" → "ilk" sinyali tarih öneriyordu, soru yutuluyordu
    (:10g, :11-KÖK6'dan ÖNCE) → general_question/support_request dışlandı
    (QUESTION_SIGNAL bilinçli dışlanmadı — "en yakın tarih ne zaman?"a öneri İYİ
    cevap, V10 zıt-yön). + çıplak "ilk" bağlam-şartlı daraltıldı ("ilk defa
    geliyorum" FP'si; ilk→ilk(tarih/gün/uygun/müsait/olan)+ilki).
    **TEMİZ doğrulananlar:** proposedDateId+"evet" diğer yollarla kesişmiyor
    (pre-FSM dalları bare-evet yakalamaz; K1-Katman2 CONFIRMING-only+extract-şartlı;
    V11-a-eskalasyon "evet"i öneriden ÖNCE alır — kabul edilebilir, eskalasyon
    aktif soru); :10e/:10f/Blok8.5 üçgeni tek-flag/turn tutarlı; AR-rakam
    normalize → telefon "٠٥٣٢..." artık extract olur (İYİLEŞME), X9/Blok8/parseInt
    zinciri tutarlı; "yarın 2 kişi" aynı-turn: dates NLU-yoksay + pax NLU-kabul
    (ayrık gate'ler, test-teyitli); confirmation tek-kaynakta K1 dengesi korunmuş
    ("evet ama değiştir" FALSE); CHANGE-ASCII 7-tüketicide FP'siz (A2/A3 değer-şartlı).
    **Doğrulanmış FİİLİ sıra:** normalize(L74) → stale → dil(+P3-seed-fix) → NLU
    (+ascii-lang-switch) → A-gate → X8/B1/B-DUR/B-TEMA/KÖK5 → stage-koruma →
    J-14 → B-6 → extract → 8-PP → K1-Katman2 → A1/A2/A3 → **V11-a(pre-FSM)** →
    FSM → 9b-R6(post-FSM!) → O6 → :10b/:10c/:10d → **:10d-2** → :10e → :10f →
    **:10g** → :11 ailesi → :12/:13/:14 → 17-BV. (9b numarası yanıltıcı — R6
    newContext kullanır, FSM-SONRASI koşar; V11-a ondan önce.) Test 13/13 + 128-korpus miss=0.
31. **FABLE TOPLU-DENETİM (2026-07-09)** — commit-review + sistematik taramalar.
    **DAVRANIŞ-RİSKİ fix'lendi (S):**
    (a) **Yan #8 TAM SÜPÜRME** — `\b` Kiril/Arapça/ö-ş-başlangıçta sınır tanımaz;
    ÖLÜ bulunan ve lookaround'a çevrilenler: validator injection RU(7)+AR(7)+TR
    önceki/özel; response-validator sahte-ack RU(6)+AR(6); state-machine T17
    ödeme-bildirimi (ödedim/оплатил/دفعت) + CONFIRMING negativeGuard; info-extractor
    _DATE_FILLER (şu); TR_MONTHS_GUARD (**"yirmi şubat" pax=20 sızıntısı AÇIKTI**
    → ayrıca MONTH_ALTERNATION tek-kaynağa: guard artık 7-dil, "twenty december"
    de korunur); TR injection `\w`→`\p{L}` ("talimatları" ı-eki).
    Çalışan EN/DE/FR/ES `\b`'leri BİLİNÇLİ dokunulmadı (kazanımsız risk).
    (b) **R6 tarih-öneri-onayı muafiyeti** — :10g telefon-adımında öneri +
    kullanıcı "evet" → R6 (@~2218) :10d-2'den (@~2528) ÖNCE yutuyordu →
    `proposedDateId && detectConfirmation` muafiyeti.
    (c) **_bookingActionRe MALFORMED** — `)|değiştir|change|...` sınırsız
    alternatifler ("exchange" FP!) + отмен/إلغاء ölü → tek grup + lookbehind.
    (d) **day_/index_ kalıntı-sızıntı (Blok 9e)** — tüketiciler tura kapılıyken
    tursuz üretim ham prefix'i state'e bırakıyordu (relative_ sınıf-kardeşi) → süpürücü.
    (e) **CHANGE_KEYWORDS TR ASCII-süperset** (aslinda/degistir/duzelt/guncelle...).
    **ÖLÜ-UÇ temizliği:** needsMonthClarification üretimi kaldırıldı (tüketicisiz
    API); eski Blok 7 date_N çözücüsü kaldırıldı (üreticisiz tüketici).
    **HİJYEN:** 9 maskesiz PII-log noktası maskelendi (isim→ilkharf***, telefon→
    maskPhone, mesaj-slice→len); `.env` untrack+gitignore (içerik publishable-sınıf,
    rotasyon gerekmez). **NLU_AB_TOKEN debug yolu (Murat kararı bekliyor):**
    duruş iyi (token-eşleşmezse sessiz-kapalı, log yok, cross-user veri dönmez)
    AMA rate-limit'ten ÖNCE çalışır (token sızarsa maliyet-amplifikasyonu) +
    `===` timing-teorik. Launch önerisi: (1) `secrets unset NLU_AB_TOKEN`+redeploy
    (hızlı, geri-açılabilir) veya (2) kod-kaldırma (en güçlü; altyapı 1354a03'te,
    revert edilebilir). **KOZMETİK (rapor, kaldırılmadı):** salt-yazım context
    alanları proposedDate/sessionStarted/detectedLanguage/viewedTours; simple.dateId
    Blok 3'te düşüyor (Blok 9 yeniden türetiyor — gereksiz hesap, M-küçük).
    Test: 33/33 davranışsal + 128-korpus miss=0.
28. **FAZ3-mikro ÇÖZÜLDÜ (2026-07-09, İş2 kalıntısı)**: pax adımında "yarın" →
    '"2026-12-21" müsait değil' (ham ISO + yanlış çapa). FIX1 (görüntü formatı):
    :11 preamble ISO değeri DD.MM.YYYY+gün'e çevrilir (format katmanı, sanitize'dan
    ayrı). FIX2 (göreli-kelime NLU guard): hasRelativeDateWord TRUE → NLU dates
    YOKSAY → extractRelativeDate/Blok 9d bugün-çapa otorite. **Bonus kök (Yan #8)**:
    extractRelativeDate tomorrow/dayAfter/nextWeek `\b`→lookaround (öbür gün/
    übermorgen/завтра/غدا artık eşleşir). NLU_SYSTEM_PROMPT sabit kural: göreli→ISO
    çevirme. **Açık kalan**: "bugün" (today) extractRelativeDate setinde YOK — göreli
    kelime sayılmıyor (düşük öncelik; genelde tur bugüne denk gelmez).
27. **FAZ3-P4 ÇÖZÜLDÜ (2026-07-09, V11-a)**: telefon-yok politika dalı — ürün
    kararı (a) telefon ŞART kalır, bot nazikçe gerekçe açıklar (acente telefonla
    teyit). Gönüllü e-posta EK alan (reservationInfo.email → RPC p_email →
    registrations.email; collectEmail zorunlu-adım mekanizması DEĞİŞMEDİ). Israr
    (2.+ ret) → J-14 contact_request eskalasyonu. **complaints.type CHECK yok +
    trg_notify_agency_support tip-filtresiz → yeni "contact_request" tipi şema
    değişikliği GEREKTİRMEDİ.** **Açık kalan**: telefon-yok kullanıcı için
    e-postayı gönüllü almak dışında, e-posta-only rezervasyon akışı YOK (ürün
    kararı gereği — telefon zorunlu). WhatsApp'ta contact_request bildirimi
    müşterinin WhatsApp numarasını (adapter.identifier) taşır — acente oradan döner.
26. **FAZ3-P3 ÇÖZÜLDÜ (2026-07-09)**: İş0 (V9 kalıntısı — çıplak-NLU "20" RAW
    sızıntısı → Blok 8.5 yeniden yazım + ay-niteleyici) + İş1 (V2-b "farketmez"
    → :10g en-yakın öneri + :10d-2 onay-tamamlama, proposedDateId) + İş2 (V8-ucuz
    relative_ tüketici, Blok 9d + simple'a tourDates) + İş3 (V3-anafora "öbür
    tarih" → :10g diğer-tarih öneri, telefon-adımı muafiyeti). **Açık kalanlar
    (M-L, Sonnet-pilotu sonrası)**: "hafta sonu/ay ortası" göreli tarihler (bu
    pakette DEĞİL); paxChild yaş-türetimi ("çocuklar 8 ve 12 yaşında"→2).

## 6. FAZ 4 — DİL KAPSAMA ENVANTERİ (teşhis + P0 baseline, 2026-07-09)

7 hedef dil: TR/EN/DE/FR/ES/RU/AR. Faz 1-3'te eklenen mekanizmaların çoğu
7-dil yazıldı; bazıları bilinçli TR/TR+EN kaldı. Aşağıdaki matris teşhisin
(P0) sonucudur; **✅ tam / ⚠ kısmi / ❌ yok / n-a dil-bağımsız**.

### 6a. Sınıf A — Regex/Sinyal setleri
| Mekanizma (kaynak) | Kapsam | Eksik |
|---|---|---|
| CHANGE_KEYWORDS_RE, QUESTION_SIGNAL_RE, VISA_SIGNAL+HINT, iptal-sinyali/res-ctx (J-14), telefon-yok (P4), farketmez (_anyDateSignal), anafora (_v3AnaforaRe), tema-keywords, B1 fiyat-bağlamı, B-DUR süre, detectCancellation+continuationGuard (J-16) | ✅ 7-dil | — (**FAZ4-P3: detectCancellation `\b`→`\p{L}\p{N}` lookaround — AR/RU sınır kırılganlığı KAPANDI, Yan #8 son üye**) |
| **müsaitlik _availQ (V10/P2)** | ✅ **7-dil (FAZ4-P1)** — `constants/availability-words.ts` TEK KAYNAK | — |
| **X8 superlatif (en ucuz/pahalı)** | ✅ **7-dil (FAZ4-P1)** — ASC/DESC yön eşlemeli | — |
| **TOUR_CHANGE_PHRASE_RE (V12)** | ✅ **7-dil (FAZ4-P1)** — kip-ailesi + wrong-tour, tur-eşleşme guard'lı (A-P2) | — |
| ay-niteleyici (bu ay/gelecek ay, İş0) | ✅ **7-dil (FAZ4-P1)** — AR هذا الشهر/الشهر القادم | — |
| tema-bağlam _themeContextRe (P1) | ✅ **7-dil (FAZ4-P1)** — RU/AR eklendi | — |
| relative-date öbür-gün/gelecek-hafta/gün-adı (İş0) | ✅ **7-dil (FAZ4-P1)** — AR بعد غد/الأسبوع القادم/gün-adları + **TR çekim** (yarına/bugüne/öbür güne; "ki" eki hariç) | — |
| iptal-FAQ-istisnası _cxlFaqRe | ✅ **7-dil (FAZ4-P1)** | — |
| emoji-onay (V7) | n-a | — |

### 6b. Sınıf B — Kullanıcıya-dönük şablonlar
STEP_QUESTIONS, :10c/:10d/:10d-2/:10f/:10g, :11 ailesi, B1, telefon-yok/P4,
J-14, echo-sanitize preambles, netleştirme/onay-yönlendirme → **✅ 7-dil tam**.
Dil-seçimi tüm şablonlarda `_msgs[context.language] || _msgs.tr` (**fallback TR
tutarlı**). **FAZ4-P3: :10e `_remTxt` (kişilik-yer) → 7-dil `constants/quota-labels.ts`
TEK KAYNAK** (3 kopya-site — :11 liste, :10e, quota-full — DRY birleştirildi).
J-14 acente-özeti TR-only ama iç-metin, kullanıcıya görünmez (n-a, bilinçli).

### 6c. Sınıf C — LLM prompt blokları — ✅ 7-DİL (FAZ4-P2)
✅ 7-dil: role, format, injection-guard, translation-directive, tarih-başlığı.
✅ **FAZ4-P2 ile 7-dile yükseltildi** (EN-fallback KALKTI): stage prompt'ları (6 aşama)
+ collection-step (5) + hallucination-guard (7 alt-kural) + no-fake-confirmation +
tarih/dahil-olanlar yasağı (V2/V3a) + tone (4 stil) + ödeme-etiketi.

**PER-LANG DOSYA HARİTASI** (roles deseni): `prompts/lang/{de,fr,es,ru,ar}.ts` →
`LANG_PROMPTS` bundle (stage fn'leri + steps + hallucinationGuard + noFakeConfirmation
+ tones + forbidden + paymentLabel). **TR/EN inline KORUNDU** (stages/index.ts +
tones/tr.ts/en.ts + prompt-builder + agency.ts) — sıfır-regresyon (snapshot ile
doğrulandı, gerçek render). Tüketiciler: stages/index.ts (getStagePrompt/
getCollectionStepPrompt/buildForbiddenAskList → 5-dil bundle dalı), tones/index.ts,
prompt-builder (no-fake), agency.ts (ödeme-etiketi).

**FAZ4-P3: agency-info DATA etiketleri (Agency name/Address/Phone/Website/Working
Hours/Location/Cancellation Policy) → 7-dil** (agency.ts `AGENCY_LABELS`, paymentLabel
deseniyle; EN varsayılan + 5-dil override). **Kalan bilinçli residual:** agency-blok
KURAL metinleri (NO-HALLUCINATION/RULES) DE/FR/ES/RU/AR'da EN — ama semantik olarak
hallucinationGuard'da 7-dil; working-hours GÜN-ADLARI (Monday..) non-TR'de EN (derin,
düşük değer). Ödeme KURALI roles/[lang].ts'de zaten 7-dil.

**Fidelity:** ${...} placeholder + emoji + DB alan-adları (hareket_noktasi vb.) +
"Tuğçe" AYNEN; yasaklar en güçlü form (NIEMALS/JAMAIS/NUNCA/НИКОГДА/أبداً); register
(Sie/vous/usted/Вы/formal). Snapshot 75/75, canlı smoke 5-dil: **sahte-onay-yok 5/5,
cevap-dili-doğru 5/5, uydurma-yasağı DE/FR/ES/AR redirect** (RU tur-programını veriden
betimledi).

**CACHE-ETKİ:** ana-model (Sonnet, ai.ts) prompt'unda dil-bloğu seçimi cache prefix'ini
DİL-BAŞINA ayırır — her dil kendi prefix'ini cache'ler (normal ve kabul; sabit/dinamik
sınır kuralı korunur — bundle metinleri STATİK, dinamikler contextPrompt'ta). Dil başına
ilk çağrı cache_creation, sonrakiler cache_read. TR/EN prefix'i değişmedi → mevcut cache
davranışı aynen.

### 6d. Dil-seçim mekanizması
4 katman (öncelik): açık-niyet (`detectLanguageChangeIntent`, 7-dil) → Unicode-
karakter (`detectLanguage`; saf-ASCII→null) → NLU (yalnız ilk-mesaj/kısa/non-ASCII
kabul; uzun-ASCII'de mevcut korunur) → seed (yalnız demo-chat). `enabled_languages`
whitelist final-gate → desteklenmeyen dil `enabledLangs[0]`, o da yoksa `tr`.
context.language DB'ye (WhatsApp) taşınır, bir kez set→sabit. **Asıl dil-riski
TESPİT değil KAPSAMA:** tespit doğru dili bulsa bile Sınıf A sinyali / Sınıf C
promptu o dili kapsamıyorsa deterministik yol kaçar / prompt EN-fallback'e düşer.

### 6f. DİL-PARİTE ENVANTERİ (Faz 5 bütüncül oturum, 2026-07-09)
TR-referanslı tam boru-hattı denetimi. S-boyut boşluklar AYNI oturumda fix'lendi;
M/L paket önerisi olarak listelendi.

**Dil × boru-hattı-katmanı matrisi (denetim sonucu):**
| Katman | TR | EN | DE | FR | ES | RU | AR |
|---|---|---|---|---|---|---|---|
| Tur-alias/translit | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ S-fix (бодрум/анталья/фетхие + сумела/бурса typo) | ✅ S-fix (باموكالي + normalizeArabicChars + بودروم/فتحية/نمرود) |
| Tarih yazım-biçimi | ✅ | ✅ | ✅ (10. Dez nokta OK) | ✅ ("le" OK; "1er" ordinal → M-küçük) | ✅ S-fix ("10 de diciembre" filler) | ✅ (çekimler month-names'te) | ✅ S-fix (**Arapça-Hint rakam ٠-٩/۰-۹ GİRİŞ-NOKTASI normalizasyonu** — tüm \d zinciri tek noktadan) |
| Sayı/pax (yazıyla) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (NUMBER_WORDS 7-dil; digit-pax people-words 7-dil) |
| Onay (confirmation) | ✅ +aynen | ✅ S-fix (confirmed/sounds good/perfect/yep) | ✅ S-fix (passt/perfekt/in ordnung) | ✅ S-fix (c'est bon/ça marche/entendu) | ✅ S-fix (perfecto/de acuerdo/dale) | ✅ S-fix (хорошо/отлично/договорились) | ✅ S-fix (أؤكد/حسنا/ماشي) |
| Change/cancel/refusal derinliği | ✅ ~15-20 kök (referans) | ~7-17 | ~5-13 | ~7-11 | ~7-12 | ~5-12 | ~6-9 (en sığ) — **M-paket: çekim-derinlik eşitleme** |
| Deterministik dallar | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ A2-sonrası (:11 zincirine girer — canlı smoke) |
| Çıktı şablonları | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ S-fix (4 kalan tr+en dict: _ambiguousMsgs/_confirmQ/_bvMsgs/_bvFall → 7-dil; tarama-aracı satır-temelli düzeltildi — brace-sayaç `${}`'de şaşıyordu) |
| Para/tarih/gün formatı | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (Intl per-currency/lang; **A1 kur tek-zincir**) |

**Faz 5 tek-kaynak eklemeleri:** `confirmation-words.ts` (POS_ALT → detectConfirmation
+ clearPositive, K1-senkron yapısal), `normalizeArabicChars` (tour-matching),
giriş-noktası AR-rakam normalizasyonu (process-message L74).

**KALAN M/L PAKETLERİ (uygulanmadı — öneri):**
1. **M — change/cancel çekim-derinliği**: TR organik zenginliğine karşı AR (~9 kök)
   ve DE/RU sığ; çekim-aileleri + konuşma-dili varyantları (AR lehçe: بدي/عايز).
2. **S-küçük — FR "1er décembre"** ordinal gün formu TEXT_MONTH'a eklenebilir.
3. **M — AR RTL görsel denetim**: emoji/sayı konumları şablonlarda manuel QA
   (kod-analizi yeterli değil, gerçek WhatsApp render'ı gerekir).
4. **L — enabled_languages panel UI** (backlog, #30c).
5. **İzleme — NLU translit-normalize kuralı** (A2 prompt eki) canlı etki ölçümü.

### 6e. Dil-geçiş & belirsizlik kuralları (FAZ4-P3)
**detectLanguage ü/ö/ç BELİRSİZLİĞİ (kalem 4)** — `detectLanguage` TR'yi İLK kontrol
eder; **ü/ö TR+DE, ç TR+FR PAYLAŞILIR** → "günstigste" (ü) TR sanılır, explicit seed'i
(DE dropdown) ezerdi → erken katman (X8) TR şablon basardı. Bu **propagasyon-sırası
DEĞİL** (dil, erken katmandan önce çözülüyor); kök detectLanguage TR-first + paylaşılan
harf. **FIX (fresh-context):** `runtimeDetectedLang==="tr"` AMA mesajda **TR-UNIQUE
harf (ı/ş/ğ/İ/Ş/Ğ) YOKKEN** (yani "tr" yalnız paylaşılan ü/ö/ç'den) + explicit+enabled
seed farklı → **seed otorite**. Clear-TR (ışğ var) ve clear-other bozulmaz; seed yok
(WhatsApp, NLU-dil kullanır) etkilenmez; `enabled_languages` gate `_bestLang`'de korunur.

**AKIŞ-ORTASI ASCII DİL GEÇİŞİ (kalem 5) — MUHAFAZAKÂR TASARIM:** salt/uzun-ASCII
mesajda char-tespiti null → char-switch (L172-178) çalışmaz. NLU `language` alanı
otorite AMA **tek-mesajla geçiş YOK** (yanlış-tetik: TR kullanıcının İngilizce tur adı).
**Şart:** NLU-lang farklı + `enabled` + salt-ASCII → 1. turn `context.pendingLangSwitch`'e
yaz; **2. ARDIŞIK aynı** → **sessiz geç** (görünür onay cümlesi YOK). Araya farklı
sinyal → pending temizlenir (ardışıklık bozulur). **Yalnız context.language/tone;
rezervasyon state'ine DOKUNULMAZ.** "Antalya Rafting olsun" (cümle TR → NLU=tr) geçiş
tetiklemez. NLU'dan SONRA çalışır (nluResult.language gerekli).

### 6e. P0 baseline korpusu + KANIT (docs/nlu-ab-corpus.json)
**121 vaka** (15 çekirdek×7-dil = 105 + 16 dil-özgü tuzak: AR ال-takısı/RTL/فصحى,
RU kiril çekim, DE bileşik/Sie, ES aksansız, EN kısaltma). Her satır: intent +
`det_signal` (availability/tour_change/superlative/relative). (P0'da `gap` işaretleri
Katman-1 boşluklarını kanıtladı; **P1'de tümü kapandı → gap-işaretsiz regresyon-ağı**.) Koşum: `scripts/nlu-ab-run.ps1` — **offline deterministik
proof** (kaynaktan .NET regex; endpoint gerektirmez — Katman-1 sinyalleri
POST-NLU olduğundan canlı NLU onları KANITLAYAMAZ) + opsiyonel canlı-NLU
(`-Token`, Sonnet intent). `-Lang` tek-dil filtre.

**Katman-1 baseline matrisi (dil × sinyal, fire/miss):**
```
                P1-ÖNCESİ (baseline)              →  P1-SONRASI (2026-07-09)
sinyal        TR EN DE FR ES RU AR                   TR EN DE FR ES RU AR
availability  ✓  ✓  ✗  ✗  ✗  ✗  ✗  (5-dil boşluk)   ✓  ✓  ✓  ✓  ✓  ✓  ✓
tour_change   ✓  ✗  ✗  ✗  ✗  ✗  ✗  (6-dil boşluk)   ✓  ✓  ✓  ✓  ✓  ✓  ✓
superlative   ✓  ✓  ✗  ✗  ✗  ✗  ✗  (5-dil boşluk)   ✓  ✓  ✓  ✓  ✓  ✓  ✓
relative      ✗* ✓  ✓  ✓  ✓  ✓  ✓  (*TR çekim,AR    ✓  ✓  ✓  ✓  ✓  ✓  ✓
                                     day-after MISS)
```
**P1 KABUL KRİTERİ KARŞILANDI:** 21/21 gap satırı fire'a döndü; her dil miss=0,
0 regresyon (mevcut fire'lar korundu). Korpus artık gap-işaretsiz **regresyon-ağı**
(det_signal satırları 7-dil fire etmeli; MISS'e dönerse regresyon). Faz 5 temeli.

**TR ÇEKİM KARARI (relative, gerekçe):** REL_TODAY/TOMORROW/DAY_AFTER TR köklerine
KONTROLLÜ yönelme/belirtme eki eklendi (yarın→yarın[aı]?, bugün→bugün[eü]?, öbür
gün→…gün[eüu]?). **"ki" eki KASITLI HARİÇ:** "yarınki program" = o günün programı
(sıfat), tarih SEÇİMİ değil → gün seçtirmemeli (lookahead 'k'yi bloklar). Dar-ek
tercihi: yanlış-seçimi (yarınki→yarın) önler, recall-kaybı minimal (yönelme eki en
yaygın tarih-verme formu). Diğer diller: RU çekimleri REL'de zaten `\S+` ile mevcut;
DE/FR/ES göreli kelimeler zarf (çekimsiz) → ek sorunu yok.

## 7. PANEL SADELEŞTİRME + ÖLÜ KOD (2026-07-24)

### 7a. SSS (FAQ) kullanım-dışı — FAQ_ENABLED bayrağı
- **Bot:** `whatsapp-webhook/index.ts` üstünde tek-kaynak sabit `FAQ_ENABLED = false`.
  `checkFAQ` çağrısı (~L530) `FAQ_ENABLED ? await checkFAQ(...) : null` ile atlanır.
  `services/faq.ts`, `faq_templates` tablosu, `translate-faq` edge fn OLDUĞU GİBİ durur
  — tek satır (`true`) ile geri açılır.
- **Panel:** SSS menü öğesi (AdminSidebar communicationItems) + route (Admin.tsx
  `activeTab==="faq"` render + import + VALID_TABS) KALDIRILDI. `FAQManagement.tsx`
  dosyası durur (erişim yok).
- **Müşteri soruları:** canned-responses (statik, index.ts:491) + normal NLU akışıyla
  cevaplanmaya devam eder — bu akışa DOKUNULMADI.
- **Not (kesişim):** canned statik anahtarları (ödeme/iptal/iletişim/saatler/grup/
  ne-götürmeli) zaten FAQ'tan ÖNCE kontrol ediliyordu → FAQ'ı gölgeliyordu; kapatma
  müşteri-deneyimini bozmaz.

### 7b. Şablonlar ekranı — yalnız Meta görünümü
- `MessageTemplates.tsx`: `tplScope` "meta"ya kilitlendi; Bot|Meta alt-sekme switcher'ı
  kaldırıldı. Ekran = Meta-onaylı şablonlar + 2 sabit otomatik-bildirim kartı
  (AutomatedNotificationsTab) + yönerge kutusu + "Meta'dan Şablonları Çek" + 🧪 test.
- **BOZULMADI (kritik):** Panel statü değişimi gönderimleri — Admin.tsx `handleStatusChange`
  → `send-template-message` MODE3 → `message_templates` (reservation_confirmed/
  reservation_cancelled) okuması — bu UI'dan BAĞIMSIZ, AYNEN çalışır. Yalnız düzenleme
  UI'ı gizlendi; veri + gönderim yolu korundu.
- **Cron etkilenmez:** tour_reminder_tr/tour_feedback_tr `agency_event_templates` +
  `message_templates` üzerinden gider — panel görünümünden bağımsız.

### 7c. Ölü kod
- `adapter.getCompletionTemplateAddendum` (whatsapp adapter) + interface metodu
  (`handlers/types.ts`) SİLİNDİ — çağrısı M-25'te kaldırılmıştı (process-message.ts),
  message_templates'in tek bot-SOHBET okuyucusuydu. Artık message_templates yalnız
  dışa-gönderim (send-template-message) + panel için okunuyor.
- Named `tour_reminder` (7-dil {full_name}) KNOWN_TEMPLATE_TYPES'ta zaten yok (İş1/07-10);
  hiçbir gönderim kullanmıyor (cron `tour_reminder_tr` gönderir). Kod-literali üretmiyor
  (copyDefaultTemplates DB-default'tan kopyalar). DB satırları SİLİNMEDİ (zararsız).

### 7d. Canned cevaplar ACENTE-VERİSİNDEN (2026-07-24)

- `shared/services/canned-responses.ts` (webhook/services'ten SHARED'a taşındı — webhook + demo-chat ortak kullanır). Hardcoded genel metin KALDIRILDI.
- `buildCannedResponse(key, lang, agency)` her anahtarı bir `agencies` alanıyla eşler; 7-dil çerçeve-etiket lokalize, acente-verisi gömülür:
  - contact_info → phone_public (normalize+display) + address; ikisi de boşsa yönlendirme.
  - payment_methods → payment_instructions'tan MÜŞTERİ-DOSTU render (`formatPaymentMethods` — deposit + yöntem-adları 7-dil; **IBAN + LLM-direktifi YOK**; `buildPaymentPromptSummary` prompt-içi talimattır, doğrudan-send için KULLANILMAZ).
  - cancellation_policy → agencies.cancellation_policy; hours → working_hours JSON (7-dil gün-adı); welcome → agency.name (hardcoded "Turzz" değil).
- Alan BOŞ → generic uydurma YASAK → 7-dil yönlendirme ("acentemiz yardımcı olacaktır" + varsa phone_public).
- what_to_bring / group_discount trigger'dan ÇIKARILDI (acente-alanı yok) → normal NLU/LLM cevaplar.
- demo-chat: LLM'den ÖNCE canned kısa-devresi eklendi (DEMO_AGENCY_ID verisiyle; kanal-paritesi).
- Statü-onay/cron gönderim zincirleri etkilenmez (bu yalnız sohbet-içi hızlı-cevap).

### 7e. B-DUR2 + 14a-3 → 7-dil (2026-07-24)
process-message.ts B-DUR2 liste (PM:~858), B-DUR2 yok (PM:~869), 14a-3 COMPLETED değişiklik-yönlendirme (PM:~4042) blokları tr/en'den 7-dile tamamlandı (de/fr/es/ru/ar). NOT: B-DUR2 TETİĞİ `\d günlük` (TR-word regex) — non-TR context.language ile ender kesişir; kod artık 7-dil uyumlu ama pratikte non-TR erişim, müşterinin TR "günlük" kelimesi + non-TR context kombinasyonuna bağlı. HLP prompt-helper'ları (formatReservationSummary vb.) BU KAPSAM DIŞI — ayrı karar.

## 8. UX LAUNCH-PAKETİ (2026-07-24)

- **FIX1 — CONFIRMING özeti + completion TOPLAM tek-kaynak:** `_reservationTotalText()`
  (process-message.ts modül-seviye) HEM özet HEM completion tarafından çağrılır; ikisi de
  live `tours`'tan aynı fiyat/pax okur → tutar HİÇBİR senaryoda farklı olamaz. Para birimi +
  AR-Hint rakam mevcut `formatPriceSync` zincirinden. Özete `💰 Toplam` satırı eklendi.
  KURAL: özet-tutarı ile completion-tutarını AYRI hesaplama — daima bu helper'dan geç.
- **FIX2 — çıkmaz-mesajlarına acente telefonu:** `_agencyPhoneSuffix(phone_public)` (İş1
  normalize deseni: formatPhoneDisplay∘normalizePhone). Eklendi: H-β no-alt, H-pax no-alt
  (yalnız `!_hasAlt`), K2 service_unavailable (webhook). phone_public boşsa "" (kırılma yok).
- **FIX3 — stale-COLLECTING metni:** "rezervasyonunuz iptal edildi" → "oturumunuz zaman
  aşımına uğradı" (DB'de kayıt hiç oluşmadı; "iptal/cancel" kelimesi kaldırıldı). TTL/reset
  davranışı DEĞİŞMEDİ, yalnız metin (7-dil).
- **FIX4 — C1 dil-tespit kapısı:** NLU-dil geçişinden uzunluk-kapısı (`_hasNonAscii||
  _isShortMsg||_isFirstMessage`) KALDIRILDI → uzun (≥200) ASCII yabancı mesaj İLK turda doğru
  dile geçer (eskiden 1-tur TR gecikmesi). Korunan guard'lar: SUPPORTED + `!==context.language`
  + `_isLangEnabled`. Bu blok `nluResult.language` (LLM tespiti, güvenilir) kullanır — char-
  detection değil; pendingLangSwitch (§35) + state-machine DOKUNULMADI.
- **FIX5 — iptal-talebi ack:** 14a "Talebinizi aldık ✅" → 📩 (✅ "iptal tamamlandı" izlenimi
  veriyordu; DB'ye dokunulmuyor, bu talep-alındı mesajı).

### 8b. Canned YALNIZ-BOŞTA (bağlam-duyarlı öncelik, 2026-07-24)
- `isIdleContext(ctx)` (canned-responses.ts): canned kısa-devresi YALNIZ boşta bağlamda
  çalışır. ATLAR (→ FSM/NLU'ya bırakır) eğer: stage ∈ {COMPLETED, COLLECTING_INFO,
  CONFIRMING, TOUR_SELECTED} VEYA collectionStep set VEYA §35 flag'i aktif (proposedDateId /
  phoneEscalationPending / pendingLangSwitch / pendingTourClarification). Böylece canned
  FSM-niyetini GÖLGELEMEZ (COMPLETED "iptal" → J-14/14a talep-akışı çalışır; aktif-akışta
  D1 FAQ-bypass çalışır). Webhook (_preloadedContext parse) + demo-chat (incomingContext)
  AYNI kural (kanal-paritesi).
- Köprü-cümle: boşta-bağlamda canned cancellation_policy cevabının sonuna 7-dil
  "mevcut rezervasyonu iptal/değiştir → yaz, acenteye iletelim" eklenir (güvenlik ağı).
- SINIR (rapor edildi): çıplak "iptal etmek istiyorum" (rezervasyon-kelimesiz) J-14'ün
  `_cxlResCtxRe` guard'ına takılıyor → LLM'e düşer. Guard'ı gevşetmek "iptal etmeyeceğim"
  (olumsuzlama) yanlış-pozitifi riski → AYRI karar (Murat). Gerçekçi ifade
  ("rezervasyonumu iptal...") J-14 → complaints kaydı ile ÇALIŞIR.

## 9. PAKET-A — 6-dil test token/kapı fix'leri (2026-07-25)

Fable 7-kök teşhisinin S-boyutlu kökleri (KÖK-1 yapısal DIŞARIDA — PAKET-B):
- **KÖK-2 (FIX1/2a):** confirmation-words POS_ALT'a rezervasyon-fiili onayları (ar لنحجز/احجز/نحجز/ممتاز · en let's book/book it · tr rezerve ed(elim)? · de buchen wir · fr réservons · es reservemos · ru бронируем/давай забронируем) + kürasyonlu TR typo'ları (onaylyrm/tamm/evt — exact-token, fuzzy YASAK). **FP-disiplini:** tüm tüketiciler onay-bağlamlı (T14/pendingCancelConfirm/F4-L2/phoneEscalation/proposedDateId — onay-dışı tüketici YOK). "onaylamıyorum"→onay-değil korundu (negative-guard).
- **KÖK-2 typo (FIX2b):** NLU sistem-prompt'una tolerans direktifi (yazım-hatası normalize). Levenshtein/fuzzy YASAK (karar).
- **KÖK-4 (FIX3):** COMPLETED prompt'undan "'team will contact' ekle" direktifi 7 dilde KALDIRILDI (validator sahte-onay deseni sayıp tüm cevabı REDIRECT_COMPLETED ile eziyordu — prompt validator'ın kendi tuzağıydı; EN/FR/ES/RU çarpışıyordu, DE/AR gramer-tesadüfüyle kurtuluyordu). roles/*.ts yasak-listesi DOKUNULMADI. Validator DOKUNULMADI.
- **KÖK-5 (FIX4):** X8 (en ucuz/pahalı) guard'ı `_isExploreStage || COMPLETED`. `_isExploreStage`'in KENDİSİ genişletilMEZ (B1 bütçe-parseri COMPLETED'a girip telefon/dekont no'yu fiyat-aralığı sanar — R5 bug). X8 return context'i MUTATE ETMEZ (`newContext: context`) → after-sales state korunur.
- **KÖK-6 (FIX5):** PRICE_QUESTION_RE FR `prix|tarif|coûte*` + RU yapısal fix (`сколько` tek-token da geçer, стоимость/почём); people-words AR ikil-nominatif `شخصان` (X9-kapısı NLU-pax'ı artık atmaz); NLU-prompt AR-ikil örneği.
- **KÖK-7 (FIX6):** _flowKws waiting_for_name çekim-toleranslı (de name[ns]?/ru имя|фамили|зовут — DE "Ihren Namen"/RU "ваше полное имя" bitişiklik-deseninde kaçıp çift isim-sorusu üretiyordu).
- **KÖK-1a token-parçası (FIX7):** change-detection RU `на самом деле|а не|вернее|точнее` (F4-L2/BELİRSİZ MANTIĞI DOKUNULMADI — PAKET-B). tr typo "aslnda" (ı-opsiyonel).
- **S9 mikro (FIX8):** paxTextMap.en çoğul (adults/children); NUMBER_WORDS FR/ES/RU/AR 20'ye (C3 ay-guard 7-dil tek-kaynak MONTH_ALTERNATION yeni sayıları tarih-bağlamında engeller — kanıtlı; AR çok-kelime key'ler tırnaklı).

Kanıt: ampirik regex 14/14 + ay-guard 5/5 + confirm/FP 13/13; canlı 9/9 (AR لنحجز→COMPLETED+﷼; RU/FR fiyat ilk-turda; AR شخصان→pax=2; EN COMPLETED saat-cevabı ✅-duvarı yok; X8 Antalya Rafting 18$/850₺; DE tek isim-sorusu; onaylyrm→onay; onaylamıyorum→onay-değil). state-machine + field-sync 7/7 + phone 19/19.

## 10. CİLA PAKETİ — GO/NO-GO öncesi son dokunuş (2026-07-25)

Mini-tur kalıntıları (4 fix + 1 teşhis). PAKET-A/B mantığı DOKUNULMADI.
- **FIX1 (COMPLETED tekrar-onay):** COMPLETED'da 2. kez saf-onay ("onaylıyorum/onaylyrm")
  → LLM completion bloğunu (🎉+ödeme) yeniden uydurup validator kaçırabiliyordu. Deterministik
  kısa 7-dil ack ("Rezervasyonunuz zaten onaylı ✅"). **GATE:** `context.stage==="COMPLETED" &&
  newContext.stage==="COMPLETED" && !justCompleted && detectConfirmation && !QUESTION_SIGNAL_RE
  && !_CXL_SIGNAL_RE && !CHANGE_KEYWORDS_RE`. justCompleted BU turda false (context zaten COMPLETED)
  → gerçek tamamlama etkilenmez. Teşekkür-reset (Bug-A) çakışmaz (teşekkür ≠ onay-token).
  Haki Lili/05477896545 = TEK kayıt (duplicate DEĞİL) — S-fix. Guard `=== 15. SYSTEM PROMPT ===`
  öncesine yerleşti (FIX3-insurance ile aynı bölge, ondan sonra).
- **FIX2 (para birimi tek-zincir):** `payment-message.ts` kapora/kalan/tam-tutar KENDİ yerel
  `formatPrice`'ını (Intl.NumberFormat(ar-SA)) kullanıyordu → AR'da "٢٤٩٫٥٨ SAR" (Arapça-Hint
  rakam + SAR kodu), completion-toplamı ise `formatPriceSync` ("832﷼", ﷼ + Batı-rakam) →
  AYNI mesajda çapraz etiket/rakam-sistemi. FIX: üç tutar da ORİJİNAL (tourCurrency) +
  `formatPriceSync` completion zincirinden geçer (`showMultiCurrency = agency.show_multi_currency
  !== false` completion ile aynı dual-display kararı). Ölü kod silindi: yerel `formatPrice`,
  `CurrencyConfig`/`CURRENCIES`/`getCurrency`, `convertSync` importu. **Para/tarih tek-zincir
  kuralı (§8 A1) artık kapora bloğunu da kapsıyor.** DE/FR/ES/RU zaten EUR/USD zincir-uyumlu.
- **FIX3 (DE FAQ-dönüş çift isim-sorusu):** KÖK-7 (f4bb147) ana-akışı düzeltti ama FAQ-dönüş
  kaçağı vardı: LLM isim-adımında hint'i ("Namen") yok sayıp FİİL-tabanlı sorunca ("Wie heißen
  Sie?" — "name" kelimesi YOK) `_flowKws.waiting_for_name` regex kaçırıyor → 17a-2 guard kendi
  suffix'ini de ekliyor → çift. RU zaten "зовут" (fiil) kapalıydı; **DE `hei[sß](en/t/e)` · FR
  `appel(le/ez/er)` · ES `cómo se llama`/`llama(rse/s)` · EN `call you`** eklendi (`/iu`,
  \p{L}\p{N} tutarlı). FP: "Es ist heiß draußen"→false (`wie hei[sß]`/`hei[sß]en` gerekiyor).
- **FIX4 (B-6 ret unanchored + FP-disiplini):** `detectNegativeResponse` ANCHORED (`^hayır$`)
  → "onaylamıyorum"/"reddediyorum" ret-FİİLLERİNİ kaçırıyor → CONFIRMING'de ret yutulup
  tarih-listesi (yanlış bağlam) basılıyordu. **Yeni `_REJECT_SIGNAL_RE`** (unanchored, 7-dil
  bare-negatif + ret-fiil aileleri, \p{L}\p{N} lookaround, POZİTİFİ "onaylıyorum" ASLA yakalamaz).
  `detectNegativeResponse` anchored KONTRATI KORUNDU (1152/1186/1596 yes/no-gate'leri bozulmadı).
  **B-6 bloğu F4-Katman-2 DAL1/DAL2 SONRASINA taşındı** → "hayır 3 kişiyiz" (ret+değer) ÖNCE
  DAL1'e (değer-uygula) düşer, B-6 yalnız SAF reddi yakalar = **_l2HasNewValue önceliği yapısal
  garanti**. Ek `!detectConfirmation` guard: "no problem, confirm it" (unanchored "no") onay
  yoluna gider. Kanıt: regex 34/34 (ret 16 + FP 8 + isim-kw 10).
- **DIAG5 (AR after-sales tur-detay kaynağı — YALNIZ RAPOR):** "2 gün 1 gece + 4-yıldızlı termal
  otel" kaynak-zinciri: COMPLETED prompt'u (ar.ts:76-79 "ما بعد البيع — SADECE bu veri") `tourDetails`
  = `formatTourDetails(currentTour,...)` içerir; `currentTour` = `currentTourFull` =
  `findTourById(id, tours)` = **TAM DB satırı** (findTourById null dönerse trimmed TourReference'a
  düşer). Süre/otel prompt'a **4 DB alanından** girer: `tur_sure`(⏱), `hotel_name`+`hotel_stars`
  (🏨 N⭐), `konaklama`(🏨), veya `program_kisa`/`gezilecek_yerler` serbest-metni. Bu alanlar
  DOLUYSA → DB-temelli (grounded); BOŞSA → "⚠️ NOT ON RECORD" listesine girer + LLM'e "uydurma"
  direktifi → yine de basarsa HALÜSİNASYON (M1 ihlali). NOT: `formatTourDetails` AR dalı YOK →
  AR EN-etiketli bloğa düşer (veri akar, etiket İngilizce). Kesin sınıflama: ilgili tur satırında
  `SELECT tur_sure, hotel_name, hotel_stars, konaklama, program_kisa, gezilecek_yerler`.

## 11. SEO/GEO — TEK-HOST + SSG PRERENDER (turzzai.com, 2026-07-25)

**§11.1 TEK-KANONİK-HOST İLKESİ (apex = `turzzai.com`).** Kanonik host **apex**; `www`
apex'e **kalıcı (301/308)** redirect eder. ALTI sinyal AYNI host'ta olmak ZORUNDA, aksi
halde Google "sayfa yönlendirmeli" sınıfına sokar, dizinlenme durur:
1. Sunucu redirect yönü (www→apex, kalıcı) — **Vercel Dashboard** (kod değil).
2. `<link rel="canonical">` — SEOHead `SITE_URL="https://turzzai.com"` (apex).
3. `sitemap.xml` 112 URL — `scripts/generate-sitemap.mjs` `SITE_URL` (apex).
4. `robots.txt` `Sitemap:` satırı (apex).
5. Site-içi linkler — React Router relative (host-agnostik).
6. `og:url` + JSON-LD `url`/`logo` — SEOHead + index.html (apex).
Yeni bir mutlak-URL sinyali eklenirken apex kullan; host karıştırma YASAK.

**§11.2 SSG PRERENDER (pazarlama ham HTML, panel SPA).** Pazarlama + blog rotaları
**build-time prerender** edilir (`vite-react-ssg`, saf Node SSR — Vercel-deterministik,
Chromium YOK). AI crawler'lar (GPTBot/ClaudeBot/PerplexityBot — JS çalıştırmaz) + Google
ham HTML'de başlık/metin/fiyat/meta/schema görür.
- **Entry:** `src/main.tsx` → `ViteReactSSG({ routes })`; rotalar `src/routes.tsx`
  (declarative `<Routes>` yerine `RouteRecord[]` + kök `Layout` provider ağacı + `<Outlet/>`).
- **Head TEK-KAYNAK:** `SEOHead` artık `react-helmet-async` DEĞİL `vite-react-ssg <Head>`
  kullanır (kendi bundled helmet instance'ı → SSG toplar). index.html'den STATİK
  title/description/og KALDIRILDI (Head-inject ile çiftleniyordu → statik-default tüm
  sayfalarda kazanıyordu). Her sayfada TEKİL, sayfa-özel `<title>`/canonical/og/schema.
- **Prerender seti = sitemap.xml:** `vite.config.ts` `ssgOptions.includedRoutes` sitemap'i
  okur → prerender-seti ≡ sitemap-seti (tek-kaynak). Panel (`/admin`,`/auth`,`/reset-password`)
  sitemap'te YOK → prerender-DIŞI (SPA kalır).
- **Panel flash YOK:** `scripts/spa-fallback.mjs` (postbuild) `dist/index.html`'den boş-#root
  `spa-fallback.html` üretir; `vercel.json` panel rotalarını buraya rewrite eder →
  prerender'lı ana sayfa içeriği panelde görünmez. Panel davranışı SPA olarak AYNEN korunur.
- **Vercel:** `cleanUrls: true` (`/foo`→`foo.html`) + catch-all rewrite `/index.html`
  (filesystem'den sonra çalışır → prerender dosyaları kazanır, bilinmeyen→SPA).
- **SSR-safety guard'ları (module-load/render'da browser-API):** `src/ssr-polyfill.ts`
  (main.tsx İLK import — in-memory `localStorage` shim, YALNIZ Node'da; `window` polyfill YOK
  → izomorfik guard'lar bozulmaz), i18n + Supabase client `typeof localStorage` guard,
  ThemeToggle `typeof window` guard. Blog `import.meta.glob(eager)` → build-time bundle'da.
- **KURAL:** yeni bir bileşen render-anında `localStorage`/`window`/`document` OKURSA
  (useState initializer / render gövdesi — effect/handler DEĞİL) prerender çöker →
  `typeof` guard'la veya `<ClientOnly>` (vite-react-ssg) ile sar. Pazarlama sayfası
  render-anında Supabase/react-query fetch YAPMAZ (prerender boş içerik basar).
- **Structured data:** index.html sitewide Organization + SoftwareApplication (apex);
  ana sayfa FAQPage (Index SEOHead `schema`, i18n `faq.items` tek-kaynak, homepage-only);
  blog post sayfaları Article schema (BlogPost). Hepsi prerender çıktısında GÖMÜLÜ (JS-inject değil).
- **robots.txt:** AI/GEO crawler'ları (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot,
  Claude-SearchBot, PerplexityBot, Google-Extended, Meta-ExternalAgent…) AÇIKÇA izinli;
  panel/api Disallow. `public/llms.txt` GEO sinyali (ürün tanımı + önemli sayfa linkleri).

## 12. CİLA-2 — dil-kaynağı + tek-kaynak özet (2026-07-26)

**§12.1 DİL-KAYNAĞI KURALI (context.language stabilitesi).** Deterministik şablonların
(CONFIRMING özeti, completion, re-ask, iptal-ack) dili + kuru TEK stabil kaynaktan gelir:
`newContext.language`. Bu değer **harfsiz mesajla EZİLEMEZ**. KÖK (WhatsApp canlı): NLU dil-
uygulama kapısı (process-message ~L547, FIX4 C1 uzunluk-kapısını kaldırmıştı) `context.language
= nluResult.language`'ı KOŞULSUZ yapıyordu → EN akışın telefon-turn'ünde (CONFIRMING'e geçiş)
NLU dilsiz "05329991307" için "tr" döndürünce EN→TR flip → CONFIRMING özeti TR + ₺-only
(TR para=TRY → dual çöker); sonraki "yes" turn'ünde NLU "en" → completion EN+$. Kanal-tutarsızlık
(demo NLU bağlam-duyarlı "en" döndüğünden flip etmiyordu). **GUARD:** `/\p{L}/u` — mesajda HARF
yoksa (telefon/rakam/emoji) NLU dil-otoritesi taşımaz, yerleşik context.language korunur.
FIX4 C1 korunur (harfli yabancı mesaj hâlâ flip eder). Özet dili+kur bu sayede akışın geri
kalanıyla aynı kaynaktan. ASCII \b YASAK.

**§12.2 ÖZET TEK-KAYNAK (💰 dahil).** CONFIRMING özeti NEREDEN basılırsa basılsın (PHONE→
CONFIRMING geçişi, :13-PERSIST re-ask, FIX3-insurance re-ask, F4-L2 DAL1) toplam satırı AYNI
`_reservationTotalText` (+ `_TOTAL_LABELS`) tek-kaynağından gelir → hiçbir özet 💰'siz kalamaz,
tutar/kur hiçbir yolda farklı olamaz. Yeni bir özet-yolu eklenirse 💰 satırı ZORUNLU.

**§12.3 J-14 iptal-ack + telefon eki 7-dil.** İptal-talebi ack'i ve telefon-eki cümlesi
(`_agencyPhoneSuffix` tek-kaynak 📞) 7-dil tam; hiçbir dil İngilizce'ye düşmez (RU/AR dahil).

**§12.4 Onay typo-toleransı (POS_ALT).** Dil-başı BARIZ typo/yakın-tuş varyantları eklenir
(ru подтверждю/падтверждаю; ar hamza-düşmesi اؤكد/اكد; de umlaut-suz bestatige). Fuzzy/Levenshtein
YASAK, uydurma-kürasyon YASAK. Her yeni token için FP-testi (CONFIRM_NEGATIVE ile ret-vakası false).

## 12.1-REV — DİL-YAZMA İNVARYANTI (CİLA-3, 2026-07-26) — §12.1'İ GEÇERSİZ KILAR

§12.1'in "kök = NLU kapısı" teşhisi EKSİKTİ (tek yazma-noktası varsayımı). Fable trace-kanıtlı
yeniden-teşhis: flip bir SINIF bug'ıydı — `context.language`'a yazan 5 bağımsız nokta, her biri
farklı (veya hiç) guard'lı; tek turn'de 2-3 yazma (ping-pong). Kanıt (`_langTrace` ring, 6 oturum):
- **D (seed-midflow, ANA KÖK — demo AR/DE vakaları):** `5:seed-mid:ar>tr:0` — site UI'ı TR olan
  kullanıcının her turn gönderdiği body.language="tr", tek harfsiz turn'de (telefon) yerleşik dili
  KOŞULSUZ eziyordu. AR×3/3 deterministik flip. → **DAL SİLİNDİ: seed YALNIZ context doğumunda.**
- **A (char TR-paylaşılan-aksan):** `1:char:de>tr:L` — "Ich möchte" (ö) TR sanılıyor. → Mid-flow'da
  yerleşik dil tr-değilken "tr" char-tespiti yalnız TR-UNIQUE harfle (ı/ş/ğ/İ/Ş/Ğ) yazabilir.
- **B (pendingLangSwitch harfsiz-çift — WhatsApp EN vakası sınıfı):** `5:pending:tr>de:0` —
  harfsiz turn'ler pending'i set/complete edebiliyordu (NLU'nun rakam-mesaja döndürdüğü rasgele
  dille). → Harfsiz turn pending'i FREEZE eder (ne set ne complete ne clear).
- **C (NLU tek-turn):** her turn `nlu:tr>de` düzeltme ping-pong'u. → NLU dil-yazması YALNIZ İLK
  MESAJDA (C1 davranışı). Mid-flow NLU farkı pendingLangSwitch'in işi (2 ardışık harfli-ASCII).

**İNVARYANT (yeni kod bu kurallara uyar):**
1. `context.language` YALNIZ şu 4 mekanizmadan yazılır: (i) doğum (createInitialContext—seed
   burada), (ii) explicit intent ("english please" — anında), (iii) char-detect unique-script
   (Kiril/Arap anında; TR yalnız TR-unique harfle), (iv) NLU: ilk-mesaj anında, mid-flow yalnız
   §35 pendingLangSwitch (2 ardışık harfli-ASCII turn).
2. **HARFSİZ mesaj (\p{L} yok: telefon/rakam/emoji) HİÇBİR mekanizmada dil-sinyali DEĞİLDİR.**
3. UI/seed dili yerleşik konuşma dilini ASLA ezmez (mid-flow seed-override YASAK).
4. Her yazma `_traceLang` ring'inden geçer (`context._langTrace`, son 12) — yeni yazma-noktası
   eklenecekse trace ZORUNLU. Deterministik şablonların dili DAİMA `newContext.language`.
Doğrulama standardı: dil-flip sınıfı değişikliklerde tekrar-testi N≥5 (tek yeşil koşum kanıt değil).
