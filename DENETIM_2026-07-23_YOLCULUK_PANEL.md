# Yolculuk-Tabanlı Tutarlılık + Tüm-Panel Denetimi — 2026-07-23

Senaryo-bazlı denetim (8 yolculuk izi + 15 panel ekranı CRUD/çapraz-ekran/durum-makinesi/yetki).
Tüm bulgular kod üzerinde satır-ref'le doğrulandı. S-fix'ler bu commit'te uygulandı; M/L öneri listesi aşağıda.

## UYGULANAN S-FIX'LER (bu commit)

| # | Bulgu | Fix | Dosya |
|---|---|---|---|
| KRİTİK-6.1 | `Admin.tsx` düşürülmüş `meta_access_token` kolonunu select ediyordu → `loadAgencyPlan` 42703 → **planFeatures null → TÜM plan-gate'li menüler (Şablonlar/Raporlar/CRM) 22.07'den beri her acentede gizli.** Murat'ın "Şablonlar kayıp" şikâyetinin gerçek kökü. | Kolon select'ten çıkarıldı; bağlantı-göstergesi `meta_phone_number_id` | `src/pages/Admin.tsx` |
| Y5-1 | Rezervasyon duplicate-guard ham telefon eşitliği — "0541…" kayıtlıyken "905…" ile ikinci kayıt geçiyordu (çift kota) | RPC'de `normalize_phone()` karşılaştırma; canlı uygulandı + davranışsal SQL kanıtı (kanonik ve +90 varyantı → DUPLICATE) | migration `20260723110000` |
| Y1-A | Şablon gönderimi DB'ye ham `{{1}}…{{7}}` kaydediyordu → panel thread'i + bot LLM geçmişinde çöp | `renderTemplatePreview` (pozisyonel + isimli doldurma), MODE2+MODE3 | `send-template-message/index.ts` |
| 1.11 | Manuel pozisyonel şablon gönderimi hep boş parametre basıyordu (panel "1","2" anahtarlı, builder isim-anahtarlı) | Numerik-anahtar fallback | `send-template-message/index.ts` |
| Y1-D | Canned/FAQ çıkışları `role=user` satırı yazmıyordu → panel 24h-pencere kontrolü yanlış negatif (acente şablona zorlanıyordu) | Çift-satır insert (user+assistant) | `whatsapp-webhook/index.ts` |
| Y2-B | Bot-pause toggle ham telefonla upsert → hayalet profile yazıp etkisiz kalabiliyordu | `normalizePhone` ile kanonik anahtar | `WhatsAppConversations.tsx` |
| Y6-1 | 1-5 bot puanı "/10" gösteriliyor + 0-10 NPS eşikleri **5/5'i detractor sayıyordu**; dağılım 11 bucket | /5 gösterim, 5'li NPS (5=promoter, 4=passive, ≤3=detractor), 1-5 dağılım (canlıda skor verisi 0 — güvenli) | `CustomerFeedback.tsx`, `WhatsAppUserProfiles.tsx`, `ActivityTimeline.tsx` |
| CRM-timeline | `tours(name)` join'i — kolon adı `title` → PostgREST hatası → **rezervasyon timeline'ı tamamen ölüydü** ("Son rezervasyon: Yok") | `tours(title)` | `WhatsAppUserProfiles.tsx` |
| Negatif koltuk | Panel kotayı satılmışın altına düşürebiliyor → bot "sadece -5 yer var" yazıyordu | `Math.max(0, …)` clamp (DOLU semantiği) | `tour-cache.ts`, `demo-chat/tour-loader.ts` |
| 4.2 | PaymentSettings'in boş `en` bloğu tr fallback'ini eziyordu → yabancı müşteriye IBAN'sız ödeme bloğu | Yapısal alanı olmayan dil bloğu yok sayılır | `payment-message.ts` |
| Duplicate-tur | Kopyalamada enjekte `sold_pax/remaining_quota` insert'i sessizce patlatıyordu ("kopyalandı" ama tarihsiz) + Enter çift-submit | Alan ayıklama + hata kontrolü + `duplicating` guard | `ToursList.tsx` |
| Export | Excel export filtreyi yoksayıp tüm kayıtları basıyordu | `getFilteredRegistrations()` | `Admin.tsx` |

Testler: tsc ✓, vite build ✓, state-machine suite ✓, field-sync 7/7 ✓, duplicate-guard SQL davranışsal ✓.
Deploy: whatsapp-webhook, send-template-message, demo-chat.

## M/L BULGULAR (öneri listesi — uygulanMAdı)

### 🔴 LAUNCH-ÖNCESİ-ŞART önerilir

1. **Güvenlik — auth'suz edge uçları (L):** `send-template-message` `verify_jwt=false` + hiçbir modda sahiplik kontrolü yok → internetten herkes herhangi bir acentenin numarasından şablon gönderebilir. Aynı sınıf: webhook `testMode` dalı (env token'la serbest gönderim, imza muafiyeti) ve `dispatch-central-notification` (merkez numaradan spam). Öneri: service-role/JWT+sahiplik kontrolü; testMode dalının kaldırılması.
2. **CASCADE veri imhası (L):** Tur/tarih silme → CONFIRMED kayıtlar + ödeme geçmişi sessizce silinir (`ON DELETE CASCADE`); onay dialogu "N kayıt var" demiyor. Öneri: silme öncesi kayıt sayısı uyarısı + CONFIRMED kayıt varken silmeyi engelleyen trigger (veya soft-delete).
3. **Panel kota güvenliği dışında (L):** Manuel kayıt düz insert (RPC değil — kota+duplicate atlanır), yolcu ekleme pax+1 kota kontrolsüz, kota satılmışın altına indirilebilir (bot tarafı artık clamp'li ama oversell hâlâ mümkün). Öneri: manuel kayıt da RPC'den geçsin; quota alanına `min=sold` validasyonu.

### 🟠 M (launch-sonrası kuyruk)

4. **Y3/Y1-C — bot "benim rezervasyonum" bilmiyor:** FSM `registrations` okumaz; 12h TTL sonrası tam amnezi; panelden tarih değişince bot eski tarihi söyler (≤12h) ya da hiç bilmez. Öneri: "kayıtlı rezervasyonum" deterministik lookup (phone→registrations).
5. **Y7 — IBAN değişimi:** Eski IBAN gönderilmiş mesajda kalır; COMPLETED'da müşteri "IBAN neydi?" sorunca bot ne eskiyi ne yeniyi verir ("onaydan sonra iletilir" metni aşama-yanlış). Öneri: COMPLETED+ödenmemişte payment-bloğunu yeniden servis eden dal.
6. **Y2 — acente araya-mesajı botun kendi sözü gibi geçmişe girer** (fiyat/saat sözleri çelişki üretebilir); panel reply bot'u durdurmaz (pauseBot hep false). Öneri: `sent_by=agency_manual` satırlarını history projeksiyonunda etiketle/dışla + reply'da opsiyonel oto-pause.
7. **Y8 — dil kapatma:** context kalıcı fallback'e döner (toggle-sıra bağımlı), cron'lar `enabled_languages`'ı hiç okumaz → kapalı dilde şablon gitmeye devam eder YA DA müşteri sonsuza dek hatırlatmasız kalır (tr fallback yok); `language_preference` hiç uzlaştırılmaz.
8. **Y5-2 — iptal-talebi guard'ı açmıyor:** complaints'e yazılır, kayıt NEW kalır → müşteri acente onaylayana dek yeniden kayıt olamaz (mesaj acenteye yönlendiriyor — bilinçli kabul edilebilir, dokümante edildi).
9. **1.5/1.7 — sessiz-sonsuz cron hatası:** Eşleştirilmiş şablon silinir/onayı düşerse hatırlatmalar sessizce durur (panelde uyarı yok). Öneri: matching-badge şablonun var+APPROVED olduğunu da kontrol etsin + cron hata sayacı panele.
10. **2.2 — SSS düzenlemesi çevirileri güncellemez** (6 dil bayat kalır) + `translate-faq` sahiplik kontrolsüz (çapraz-acente insert + LLM maliyeti).
11. **1.9 — cron'lar agency.active/subscription'ı okumaz** (pasif acente göndermeye devam eder).
12. **8.2 — superadmin "ekstra mesaj" limiti bot tarafından hiç uygulanmıyor** (plan_features.message_limit her zaman kazanır).
13. **3.1 — disconnect Meta webhook'unu bırakır** + tek-acente fallback yanlış tenant'a yönlendirebilir.
14. **4.1 — cash_office adresi:** bot `office_address/working_hours` okur, panel bu alanları hiç yazmaz → "Ofiste Nakit" hep adressiz.
15. **5.1/5.2 — plan düşüşünde dil listesi budanmaz**; Dil&Para + Şablon sekmeleri `enabled_languages`'ı yoksayar (üç ekran farklı dil modeli).
16. **8.3 — superadmin acente oluşturma `signUp`** oturumu değiştirir (edge fn + `auth.admin.createUser` olmalı).
17. **Raporlar tutarsızlıkları:** dönüşüm oranı mesaj-satırı sayıyor (konuşma değil); iki destinasyon ekranı farklı ciro formülü; çoklu-para tek para gibi toplanıyor; RevenueAnalytics hardcoded fiyat + uydurma %70/30 bölünme.
18. **Ödeme LWW:** `paid_amount` client read-modify-write (iki sekme çakışır); pax değişince `total_amount` güncellenmez; "UNPAID" ödeme satırlarını öksüz bırakır.
19. **Statü yan-etki asimetrisi:** liste statü değişimi WhatsApp şablonu gönderir, detail-dialog aynı değişiklikte göndermez; CANCELLED→CONFIRMED kota kontrolsüz; `reminder_sent` resetlenmez.
20. **Konuşmalar ekranı realtime değil** (gelen mesaj görünmez, refresh butonu da yok).
21. **Dashboard bayatlığı:** dashboard'dan manuel kayıt KPI'ları tazelemez; sayaçlar farklı CANCELLED filtreleri kullanır; sefer-doluluk filtrelenmiş listeden hesaplanıyor.

### Bölüm C — Sınıflama

- **Kimlik**: Y5-1 (fixli), Y2-B (fixli), CRM ilike-son-10-hane. Telefon sınıfı İş1+bu turla büyük ölçüde kapandı; **gizli-üye ihtimali en yüksek sınıf: dil-kodu/şablon-dili** (üç ekran + iki cron farklı dil modeli kullanıyor — Y8 ailesi).
- **Okuma-yazma-ayrışması**: Y1-A (fixli), 6.1 (fixli), 4.1/4.2 (4.2 fixli), 8.2 — *panel yazdığını botun okuduğu her nokta şüpheli; şema değişikliklerinde select-listeleri taranmalı* (6.1 dersi).
- **Zamanlama-penceresi**: Y1-D (fixli), Y1-B (teorik), Y2-A pause-TTL, cache-TTL 5dk.
- **Yaşam-döngüsü**: CASCADE (L), şablon-silme→cron sessiz ölüm, dil-kapatma, disconnect-artığı. *Bu sınıfta gizli üye ihtimali yüksek: her DELETE/pasifleştirme yolunun "bağımlıları kim" analizi eksik.*

## MURAT'IN ELLE DENEYECEKLERİ (kod karar veremedi)

1. **Panel yenile → Şablonlar/Raporlar/CRM menüleri geri geldi mi?** (6.1 fix'i sonrası — en kritik doğrulama)
2. Konuşmalar'da bir müşteriye yanıt yaz → tek thread'de mi düşüyor, Meta hatası kalktı mı? (İş1+Y2-B sonrası)
3. CRM'de bir müşteri aç → Aktivite sekmesinde rezervasyonlar artık listeleniyor mu?
4. Şablon test-gönderimi → panele düşen kayıt değişkenleri dolu mu ({{1}} yok)?
5. Bir tur tarihinin kotasını satılmışın altına indir → bot artık "dolu" mu diyor (negatif yok)?
6. Yabancı dilde (EN) rezervasyonu tamamla → ödeme bloğunda IBAN görünüyor mu?
7. Tur kopyala → yeni turda tarihler kopyalandı mı?
8. Excel export → yalnız filtredeki kayıtlar mı geliyor?
