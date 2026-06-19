# Turzz AI — Rezervasyon Botu Test & Geliştirme Kuralları

> Bu dosya, rezervasyon akışı (FSM) üzerinde çalışırken uyulması gereken
> kalıcı kuralları içerir. Her FSM/prompt/extractor değişikliğinden önce
> ve sonra bu dosyaya bakılır. Claude Code bu dosyayı okuyup kurallara
> uymalıdır.

---

## 1. İki Katmanlı Test Sistemi

Botun iki ayrı katmanı vardır ve her biri ayrı test edilir:

- **State machine (kod mantığı):** hangi adım sırada, hangi alan dolu,
  veri korunuyor mu, onay adımı atlanıyor mu. Deterministik, kodla yazılı.
- **LLM (yorum katmanı):** kullanıcının mesajını doğru intent'e çeviriyor
  mu, doğru cevabı yazıyor mu. Claude API'ye bağlı.

Bu ikisi için **iki ayrı test katmanı** vardır:

### KATMAN 1 — State machine testleri (TOKEN HARCAMAZ)
- **Dosya:** `scripts/test_e2e_reservation_flows.mjs` (+ diğer unit testler)
- **Nasıl çalışır:** NLU çıktısı mock'lanır (intent + extracted veri manuel
  verilir). Gerçek Claude API çağrısı YOKTUR.
- **Ne test eder:** veri koruma, adım geçişleri, onay adımının atlanmaması,
  dolu alanın silinmemesi, iptal/değişiklik mantığı, çok dilli akış.
- **Ne zaman koşulur:** HER FSM/prompt/extractor değişikliğinden sonra,
  ZORUNLU. Maliyetsiz olduğu için sık koşulur.
- **Komut:** `node scripts/test_e2e_reservation_flows.mjs`

### KATMAN 2 — Uçtan uca LLM testleri (TOKEN HARCAR)
- **Dosya:** `scripts/test_e2e_llm_real.mjs`
- **Nasıl çalışır:** Gerçek Claude API çağrılır. Botun gerçekten doğru
  intent'i anlayıp anlamadığını, cevabın state ile tutarlı olup olmadığını
  test eder.
- **Ne test eder:** "14 aralık olur" gerçekten anlaşılıyor mu, "söylemiştim
  ya" ne yapıyor, isim mesajı yanlış intent'e düşüyor mu — LLM yorumuna
  bağlı her şey.
- **Ne zaman koşulur:** ARA SIRA, manuel, kullanıcı (Murat) karar verince.
  Büyük değişiklikten sonra veya launch öncesi. ASLA otomatik/sık koşmaz.
- **Komut:** `node scripts/test_e2e_llm_real.mjs`

---

## 2. AYNA SENKRON KURALI (kritik)

`test_e2e_reservation_flows.mjs` "mirror approach" kullanır: gerçek
`state-machine.ts` mantığının bir KOPYASINI içinde barındırır.

**Risk:** Gerçek kod değişip ayna güncellenmezse, test "geçti" der ama
gerçek kod farklı davranır. Ayna ile gerçek kod zamanla ayrışabilir.

**KURAL:** Şu dosyalardan birinde mantık değişikliği yapıldığında:
- `supabase/functions/shared/fsm/state-machine.ts`
- `supabase/functions/shared/handlers/process-message.ts`
- `supabase/functions/shared/services/info-extractor.ts`
- `supabase/functions/shared/services/tour-matching.ts`
- `supabase/functions/shared/fsm/prompts/stages/index.ts`

→ AYNI commit'te `test_e2e_reservation_flows.mjs` içindeki ayna mantığı
da güncellenmeli. Gerçek kodu değiştirip aynayı güncellememek YASAK.

Katman 2 (gerçek LLM) gerçek kodu çağırdığı için ayna riski taşımaz —
bu yüzden ayna sapması olursa Katman 2 bunu yakalar (ikinci güvence).

---

## 3. Değişiklik İş Akışı (her FSM değişikliğinde)

1. Değişiklikten ÖNCE: `node scripts/test_e2e_reservation_flows.mjs`
   (mevcut durumun yeşil olduğunu gör — baseline)
2. Gerçek kodu değiştir.
3. AYNA SENKRON: aynı değişikliği `test_e2e_reservation_flows.mjs`
   ayna mantığına da uygula (Kural 2).
4. Yeni davranış için yeni test senaryosu ekle (`runScenario(...)`).
5. Değişiklikten SONRA: `node scripts/test_e2e_reservation_flows.mjs`
   (hepsi yeşil mi? kırılma varsa hangi step başarısız net görünür)
6. Tüm testler yeşilse commit et + push et (emek yedeklensin).
7. Büyük değişiklikse veya launch öncesiyse: Katman 2'yi (token'lı)
   manuel koştur.
8. Deploy et: `supabase functions deploy whatsapp-webhook && demo-chat`
   (doğru proje: yaxjygtjtjmzslajuctk — config.toml'da kayıtlı)

---

## 4. "Bitti" Tanımı

Hedef "hiç bug çıkmayacak" DEĞİL (ulaşılamaz). Hedef:
- Katman 1 (token'sız) testlerin hepsi yeşil — kod mantığı sağlam.
- Yaygın akışlar canlıda elle doğrulanmış.
- Beklenmedik girişte bot çökmüyor, güvenli davranıyor (veri silmiyor,
  yanlış onay vermiyor).

Yeni bir kenar durum çıkarsa: önce Katman 1'e test senaryosu olarak
ekle, sonra düzelt, sonra tüm paketi koştur. Panik değil, kontrollü bakım.

---

## 5. Deploy Notları

- **Doğru proje ref:** `yaxjygtjtjmzslajuctk` (Gezi-rehberi, Frankfurt).
  `config.toml`'da kayıtlı, ref vermeden deploy gider.
- **YANLIŞ ref:** `ncuswacwpqcxhmlhvfgq` — bu proje hesapta yok, 403 verir.
  Eğer bir yerde bu ref görünürse YANLIŞTIR, yaxj... ile değiştir.
- Deploy sonrası `supabase functions list` ile versiyonun arttığını
  ve UPDATED_AT'in güncel olduğunu doğrula. (Zaman UTC — TR saatinden
  3 saat geri görünür.)
