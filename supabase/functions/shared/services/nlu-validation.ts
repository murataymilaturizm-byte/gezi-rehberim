// 2026-06-20 (Sorun 2 — A gate, asıl koruma):
// NLU'nun has_full_name=true + fullName="<tur cümlesi>" döndürdüğü durumları
// deterministik blokla. CANLI BUG (execution e9fc320d): kullanıcı waiting_for_name
// adımında "efes turuna geçelim" yazdı → NLU CRITICAL RULE'u ihlal etti, fullName=
// "Efes Turuna Geçelim" çıkardı → state-machine isim olarak state'e yazdı → bot
// "Teşekkürler Efes!" diye seslendi, isim adımını atlayıp telefona geçti.
//
// NLU sistem prompt'u (nlu.ts:229-240) bu durumu yasaklıyor AMA LLM compliance
// %100 garanti değil (Haiku kırılganlığı kanıtlandı). Bu gate LLM'den BAĞIMSIZ
// deterministik savunma katmanıdır.
//
// ─── DAR MANTIK (Murat ilkesi) ──────────────────────────────────────────
//
// Reddetme kriteri: NLU'nun döndürdüğü fullName değerinin KELİMELERİ.
//   - Mesajın BÜTÜNÜNE bakmıyoruz (karışık mesajlar meşru: "ben Murat Yılmaz,
//     Antalya turuna geçelim" → NLU doğru parse ederse fullName="Murat Yılmaz",
//     state'e yazılmalı).
//   - Verb listesine (geçelim/alalım/değiştirelim) BAKMIYORUZ — çünkü gerçek
//     soyadlar ("Geçer", "Alıcı") yanlış bloklanır.
//   - SADECE TOUR_KEYWORD_STOPWORDS (turu/turuna/tour/ausflug/circuit/...)
//     içeren fullName tur cümlesinden sızmış demektir → REDDET.
//
// ─── 7 DİL KAPSAMI ──────────────────────────────────────────────────────
//
// TOUR_KEYWORD_STOPWORDS 7 dili kapsıyor (TR/EN/DE/RU/AR/FR/ES).
// Her dilde "tur" muadili kelimeler set'te. Yani "X turuna geçelim" deseninin
// tur kısmı her dilde yakalanır. Örnek:
//   - TR "Efes Turuna Geçelim"          → "turuna" stopword → ❌ REDDET
//   - EN "Switch to Cappadocia tour"    → "tour" stopword   → ❌ REDDET
//   - DE "Kappadokien Ausflug wechseln" → "ausflug" stopword → ❌ REDDET
//   - RU "Тур по Каппадокии"           → "тур" stopword    → ❌ REDDET
//   - AR "جولة أفسس"                   → "جولة" stopword   → ❌ REDDET
//   - FR "Circuit d'Éphèse"             → "circuit" stopword → ❌ REDDET
//   - ES "Excursión a Capadocia"        → "excursión" stopword → ❌ REDDET
//
// ─── BİLİNÇLİ AÇIK BIRAKILAN GRİ ZON ────────────────────────────────────
//
// Tek başına bir tur ADI (örn. NLU fullName="Efes" tek kelime) yakalanmaz;
// bu çift-NLU-hatası gerektiren nadir senaryodur, gate'i geniş tutmamak ve
// gerçek isimleri (Efes gerçek bir isim olabilir — Türkiye'de var) korumak
// için bilinçli bırakıldı. Birinci savunma NLU CRITICAL RULE'dur (2-3 word
// gereksinimi). NLU bu kuralı da çiğnerse tek-kelime fullName state'e sızar
// — kullanıcı bir sonraki adımda fark eder ve change_info ile düzeltir.
// DB-bağımlı katman bilinçli EKLENMEDİ: pure function kalsın, gri zon kabul.

import { TOUR_KEYWORD_STOPWORDS } from "../constants/tour-matching.ts";
import { GIVE_UP_DROP_RE, GIVE_UP_PHRASE_RE } from "../fsm/simple-extractor.ts";

function normalizeForGate(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritic temizle (ı/İ uyumu için ayrıca lower)
    .replace(/[?!.,;:()*"']/g, "")
    .trim();
}

/**
 * NLU full_name çıktısının tur-değişim cümlesi sızıntısı olup olmadığını döndür.
 *
 * @param fullName NLU'nun döndürdüğü fullName değeri
 * @returns true → tur kelimesi içeriyor, state'e YAZMA (BLOCKED)
 *          false → temiz isim, state'e yazılabilir
 */
export function isNluFullNameTourLeak(fullName: string): boolean {
  if (!fullName || typeof fullName !== "string") return false;
  const words = normalizeForGate(fullName).split(/\s+/).filter(Boolean);
  return words.some((w) => TOUR_KEYWORD_STOPWORDS.has(w));
}

// 2026-06-21 SORUN F — NEGATION/CORRECTION tokens (TR + EN).
//
// HARD TEST kanıtı: NLU CRITICAL RULE "2-3 proper noun words" ihlal edildi —
// Haiku "Murat değil aslında Ahmet" (5 word) full_name döndürdü → state'e
// ham yazıldı → reservationName="Murat değil aslında Ahmet" (absürt).
//
// ─── KAPSAM: TR + EN only ──────────────────────────────────────────────
// Yan #8 ile aynı disiplin — DE/FR/ES/RU/AR çok-dil eşitleme fazına alındı.
// Demo agency tek-dilli (Sorun E), test edilemeyen tokenleri eklemek Ege
// tuzağı. "no" (ES/EN evrensel) yanlış pozitif riski yüksek, çok-dil fazında
// dikkatli ekle.
//
// ─── TAM KELİME EŞLEŞMESI (substring DEĞİL) ────────────────────────────
// Murat onayı (2026-06-21): "Değil" diye soyad olmaz → "Ahmet Değil" 2-word
// edge'ini kasıtlı reddediyoruz, döngü riski yok.
// Set.has() tam kelime kontrolü → "Değildağ" / "Geçer" gibi türev soyadlar
// KORUNUR (substring "değil" / "geç" yakalanmaz).
const NEGATION_TOKENS = new Set<string>([
  // TR — hem orijinal hem ASCII-fallback (normalizeForGate NFD diacritic
  // strip yapıyor → "değil" → "degil"; defansif olarak iki formu da koy.
  // Mevcut TOUR_KEYWORD_STOPWORDS da aynı pattern: "ausflug"/"ausfluge").
  "değil", "degil",
  "aslında", "aslinda",
  "yerine",        // i ASCII, normalize değişmez
  // EN — ASCII zaten
  "not", "actually", "instead", "scratch",
  // ─── ÇOK-DİL EŞİTLEME FAZINA ALINDI (post-launch + Sorun E sonrası) ─
  //   DE: nicht
  //   FR: pas
  //   ES: "no" (DİKKAT — yanlış pozitif riski, careful testing)
  //   RU: не
  //   AR: لا
]);

/**
 * NLU full_name çıktısında negation/correction token var mı?
 *
 * Kullanım: process-message A gate yanına ek savunma. K2 (nlu.ts:432) word
 * count + 4+ word negation kontrol yapıyor; K3 (burada) her durumda
 * 2-word edge'leri ("Ahmet Değil") + sanity sigortası.
 *
 * @returns true → negation cümlesi sızıntı, state'e YAZMA
 *          false → temiz isim, kabul
 */
export function isNluFullNameNegationLeak(fullName: string): boolean {
  if (!fullName || typeof fullName !== "string") return false;
  const words = normalizeForGate(fullName).split(/\s+/).filter(Boolean);
  return words.some((w) => NEGATION_TOKENS.has(w));
}

/**
 * M1 (isim-katmanı sınıf-fix, 2026-07-27) — NLU give-up sızıntı guard'ı.
 * Canlı FAIL: DE "vergiss es" / FR "laisse tomber" isim adımında NLU'dan
 * fullName olarak döndü → "Vielen Dank, Vergiss!" (J-16 yalnız deterministik
 * yolu koruyordu). Kural: fullName'in TÜM token'ları GIVE_UP_DROP_RE
 * (tek-kaynak, simple-extractor) vazgeçme/dolgu setindense → sızıntı, REDDET.
 * KISMİ eşleşme REDDETMEZ: "Egal Schmidt" → "schmidt" sette değil → temiz isim
 * (FP-disiplini: yalnız TAM-kompozisyon reddedilir).
 */
export function isNluFullNameGiveUpLeak(fullName: string): boolean {
  if (!fullName || typeof fullName !== "string") return false;
  if (GIVE_UP_PHRASE_RE.test(fullName.trim())) return true;
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  return words.every((w) => GIVE_UP_DROP_RE.test(w));
}
