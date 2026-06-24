# Turzz Bot — Durum & Devir Notu

**Son güncelleme**: 2026-06-24 (Fix A1 history cutoff sonrası)

═══════════════════════════════════════════════════════════════════════════
## KAPANDI — COMPLETED-Sonrası Grup (Bütüncül)
═══════════════════════════════════════════════════════════════════════════

### Commit Zinciri

| Commit | Konu |
|---|---|
| **e898a04** | Fix 1+2: COMPLETED post-satış handler (change_info merge + FSM intent + bilgi/eylem guard) |
| **910ee60** | 4-Dal yön değişikliği: COMPLETED'de DB yalan vaadi yok — değişiklik → acente yönlendirme |
| **38e7c43** | **Fix A1**: history cutoff (CONFIRMING→COMPLETED onay anı) — S1/S2/S3 tek kökten çözüldü |

Canlı doğrulandı (exec 6deb4d59, da8e63aa).

### 4 Dal Davranışı (Hepsi Canlı Yeşil)

| Dal | Senaryo | Davranış |
|---|---|---|
| **DAL 1 — Değişiklik** | İsim/telefon/tarih/kişi değiştirme talebi | Acente yönlendirme (`process-message.ts:14a-3`), state KORUNUR — DB yalan vaadi yok |
| **DAL 2 — Yeni Rezervasyon** | "Kapadokya turu" → yeni akış | Temiz yeni akış (S1 ÇÖZÜLDÜ, exec **6deb4d59**: art arda 2 rezervasyon, ikincide eski Pamukkale geçmiyor) |
| **DAL 3 — Bilgi** | İptal şartı / ödeme / saat / tur detayı | LLM after-sales prompt'uyla cevaplar (FSM intent `general_question` → COMPLETED→COMPLETED no-op) |
| **DAL 4 — Kapanış** | "Teşekkürler" | Bug A deterministik kapanış (S2/S3 ÇÖZÜLDÜ, exec **da8e63aa**: iptal şartı → teşekkür → telefon istemiyor) |

### Kök Tespiti

**"Telefon isteme" tekrar eden semptomunun kökü = conversation history kirlenmesi.**

State temizleniyordu (`resetForNewReservation` çalışıyordu) AMA `loadHistory(10)` NLU prompt'una + AI çağrısına eski rezervasyon mesajlarını gönderiyordu. LLM "yarım rezervasyon" sanıp telefon/yeni adım istiyordu.

**Fix A1** (`historyCutoffAt` CONFIRMING→COMPLETED onay anına timestamp, `loadHistory` `created_at > cutoff` filtresi) **tek noktadan S1+S2+S3** çözdü.

**M1 (Haiku compliance) kırılganlığına güvenmeden, deterministik kod katmanı.**

### Mimari Katmanlar (Birikmiş)

1. **Stage/Transition** (`state-machine.ts`): COMPLETED→COMPLETED, COMPLETED→BROWSING, COMPLETED→TOUR_SELECTED transitions; `isAfterSalesMessage` FSM intent listesi
2. **Bypass/Intent** (`process-message.ts`): 14a (iptal/değiştir regex), 14a-2 (Bug A kapanış), 14a-3 (acente yönlendirme), Bug C `detectCancellationGuarded`
3. **Validator** (`response-validator.ts` K4): `validateAIResponse` (sahte rezervasyon iddiası), `validateFieldReask` (dolu alan yutkunması)
4. **History** (Fix A1 — yeni katman): conversation context'in temporal sınırı

═══════════════════════════════════════════════════════════════════════════
## AÇIK — SIRADAKİ GRUP: Rezervasyon-Esnası
═══════════════════════════════════════════════════════════════════════════

### S4 — Onay Tekrarı
- **Semptom**: CONFIRMING'de "evet" / "onaylıyorum" ilk seferde onay saymıyor, **2. "evet"** te kabul ediyor.
- **Olası kökler** (canlı exec log olmadan kesin değil):
  - `shouldTriggerSummaryReask` edge case
  - CONFIRMING transition no-op (state-machine'e `confirm_reservation` ulaşmıyor)
  - `detectConfirmation` doğru çalışıyor ama action sonrası başka bir bypass return ediyor
- **Bekleniyor**: Murat'tan exec ID + STATE_INPUT/OUTPUT + intent log

### Pax Karışması (Yeni Gözlem — Bu Seans)
- **Semptom**: "yirmi aralık" (tarih) NLU tarafından `pax=20` olarak da yorumlandı.
- **Kanıt**: exec **d9210ba4** — `totalPax: 20`
- **Kök hipotezi**: NLU `people_count` ekstraksiyonu tarih kelimelerini de sızdırıyor; veya info-extractor numeric blok tarih sayısını pax sayar.
- **Aile**: Rezervasyon-esnası — Fix A1 ile alakasız, ayrı teşhis.

═══════════════════════════════════════════════════════════════════════════
## AÇIK — Diğer Gruplar (Sonraki Sıra)
═══════════════════════════════════════════════════════════════════════════

### WhatsApp COMPLETED Sahte-İptal
- **Hipotez**: Muhtemelen Fix A1 ile büyük ölçüde çözüldü (aynı history kökü).
- **Test gereken**: WhatsApp tarafında ayrıca canlı test edilmeli.
- **Doğru davranış**: Timeout/iptal SADECE `reservationConfirmed === false` durumunda; COMPLETED'de iptal yok.

### Diğer Backlog (Launch Sonrası)
- **NLU_TIMEOUT**: 15sn tolerans uzun, fallback intent="general" yetersiz davranış üretiyor. Resilience iyileştirme.
- **Çok-dil eşitleme**: TR+EN dışı 5 dil (DE/FR/ES/RU/AR) bypass mesajları + pattern setleri açık liste (post-launch genişletme).
- **Kredi alarmı**: Anthropic API kredi tükenmesi durumunda graceful degradation + monitor + Slack alert.

═══════════════════════════════════════════════════════════════════════════
## Bilinen Sınırlar (Launch Kabul)
═══════════════════════════════════════════════════════════════════════════

- **H-α etiketleme**: Dolu tur/tarih listede gizleniyor (`(DOLU)` etiketi yerine). Auto-date tek-müsait-tarihte devreye girip listeyi atlıyor, α katmanı pratikte ulaşılamaz. Kabul edilebilir UX. Post-launch iyileştirme kuyruğu.
- **preloadedHistory + cutoff**: whatsapp-webhook bazı handler'lar `preloadedHistory` parametresi geçiyor; timestamp olmadığı için cutoff filtre uygulanamaz. Düşük frekans; ana akış (`processChatMessage`) etkilenmez.

═══════════════════════════════════════════════════════════════════════════
## Test Durumu
═══════════════════════════════════════════════════════════════════════════

- **deno check**: ✅ tüm shared dosyalar
- **behavioral**: **322/322** (HC.1-HC.6 dahil)
- **e2e PRESENCE**: **200/200** (A1 PRESENCE 5 yeni dahil)

═══════════════════════════════════════════════════════════════════════════
## Önemli Sabitler
═══════════════════════════════════════════════════════════════════════════

- **Demo agency_id**: `00000000-0000-0000-0000-000000000000`
- **Supabase project**: `yaxjygtjtjmzslajuctk` (Frankfurt) — DOĞRU
- **Yanlış proje** (geçmişte karışmıştı): `ncuswacwpqcxhmlhvfgq`
- **Deploy**: Murat'ın yetkili oturumu — Claude Code deploy etmez

═══════════════════════════════════════════════════════════════════════════
## Murat İlkeleri (Hatırlatma)
═══════════════════════════════════════════════════════════════════════════

- **(A)** Yama değil kök
- **(B)** Bir kökü düzeltip aynı kökün başka kopyalarını bırakma (DRY)
- **(C)** Deterministik post-LLM düzeltme — M1 LLM compliance'ına güvenme
- **Murat ilkesi "DUR"**: Karar verilmeden ilerleme YOK
- **Ege tuzağı**: Test yeşil ≠ canlı çalışıyor — 3 nokta (state + log + bot cevabı) birden
