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
