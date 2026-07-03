// Vize-sinyali tespiti — 7 dil. TEK KAYNAK.
//
// 2026-07-03 VISA-GATE fix: :10c vize deterministik katmanının tetiği ham
// NLU intent'ine (visa_support) bağlıydı — canlı kanıt: Haiku "bu tur için
// vize ihtiyacı var mı" / "vize lazım mı" sorularına faq_general dedi →
// :10c bypass → LLM "vize gerekmez" dedi (FIX 3'ün yasakladığı cümle).
// K1/X7 deseni: NLU sınıflaması güvenilmez, deterministik sinyal otorite.
//
// Pattern disiplini: \p{L}\p{N} lookbehind + lookahead YOK (çekim serbest —
// "vizesi", "визы", TR ekleri yakalanır). /iu şart.
// AR notu: "ال" belirlilik takısı kelimeye BİTİŞİK yazılır ("التأشيرة") —
// lookbehind çıplak kökü reddederdi; optional (?:ال)? prefix'i ile kapsanır.
export const VISA_SIGNAL_RE =
  /(?<![\p{L}\p{N}])(vize|visa|visum|visado|виз|(?:ال)?فيزا|(?:ال)?تأشيرة)/iu;

// :10c LOKAL soru-niteliği tamamlayıcısı — QUESTION_SIGNAL_RE'nin kapsamadığı
// "lazım mı / gerekli mi / gerekiyor mu / required / needed" kalıpları.
// BİLİNÇLİ olarak QUESTION_SIGNAL_RE'ye EKLENMEDİ: o global regex PROVIDE
// PROMOTE'un (G13) promote-etme kararında da kullanılıyor — oraya "lazım/
// gerekli/need" eklemek promote'u daraltır (etkileşim: ARCHITECTURE_GUARDS.md
// §4). Bu kalıp SADECE vize tetiğinde kullanılır; lookahead yok (çekim
// serbest: gerekiyor/gerekir/нужна/нужно).
export const VISA_QUESTION_HINT_RE =
  /(?<![\p{L}\p{N}])(lazım|lâzım|gerekli|gerekiyor|gerekir|gerek|şart|ister|istiyor|required|needed|need|necessary|erforderlich|nötig|brauch|obligatoire|nécessaire|necesario|obligatorio|нужн|обязательн|требу|مطلوب|ضروري|يلزم)/iu;
