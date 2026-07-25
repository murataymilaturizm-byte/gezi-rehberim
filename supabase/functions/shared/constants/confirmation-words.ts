// Onay-kelime setleri — TEK KAYNAK (2026-07-09 Faz 5 A3).
//
// İKİ TÜKETİCİ artık aynı kaynaktan türer (K1 notundaki "ikisi senkron kalmalı"
// kuralı YAPISALLAŞTI — kopya-drift biter):
//   1. state-machine detectConfirmation (pozitif + negatif per-dil)
//   2. state-machine T14 Path-3 clearPositive (tüm-dil birleşimi, Katman A)
//
// CANLI KÖKLER (V3 teşhisi): EN "confirmed" lookahead'e takılıyordu (yalnız
// "confirm" vardı, -ed bloklu) → CONFIRMING'de iki kez özet-tekrar döngüsü.
// Doğal onaylar (sounds good / passt / c'est bon / perfecto / хорошо) hiçbir
// dilde yoktu — TR'nin organik zenginliğine (14 kök) karşı 5-7 kök.
//
// FP DİSİPLİNİ: "perfect/perfekt/perfecto" sınıfı yalnız ONAY-SORUSU bağlamlı
// tüketicilerde çalışır (T14 CONFIRMING-transition, :10d-2 tarih-öneri onayı,
// V11-a eskalasyon onayı, A3 not-confirmation guard'ı) — hepsinde "kabul"
// semantiği doğru; keşif-stage'lerinde detectConfirmation ÇAĞRILMAZ (Path
// sınırları koruyor, 2026-07-09 doğrulandı). Yeni tüketici eklerken bu
// varsayımı yeniden doğrula.
//
// Pattern disiplini: \p{L}\p{N} lookaround + /iu (Yan #8 — \b YASAK).

// Per-dil POZİTİF alternation gövdeleri (RegExp'e gömülür).
// 2026-07-25 PAKET-A FIX1/FIX2a: rezervasyon-fiili onayları (KÖK-2: "لنحجز/let's book"
// gibi doğal "hadi rezerve edelim" ifadeleri hiçbir dilde onay sayılmıyordu → CONFIRMING
// deadlock) + kürasyonlu sık typo'lar (exact-token, fuzzy YOK). FP-disiplini: tüm
// tüketiciler onay-bağlamlı (T14/pendingCancelConfirm/F4-L2/phoneEscalation/proposedDateId).
const POS_ALT: Record<string, string> = {
  tr: "evet|onayl[ıi]yorum|tamam|ok|olur|kabul|do[ğg]ru|onayla(?:d[ıi]m|d[ıi]k)?|tasdik|kesinlikle|kesinleştir(?:d[ıi]m|d[ıi]k)?|tamamdır|onaylıorum|peki|tabii|aynen|rezerve\\s+ed(?:elim|iyorum)?|onaylyrm|onaylıyrm|onylıyorum|tamm|evt",
  en: "yes|confirm(?:ed)?|approve[d]?|ok|okay|sure|right|correct|definitely|agreed|deal|absolutely|yep|yeah|yup|sounds\\s+good|perfect|go\\s+ahead|let'?s\\s+book|book\\s+it",
  de: "ja|best[äa]tig(?:en|t)?|ok|richtig|genau|stimmt|einverstanden|natürlich|passt|perfekt|in\\s+ordnung|jawohl|buchen\\s+wir|lass\\s+uns\\s+buchen",
  fr: "oui|confirm[ée]?|d'accord|ok|exact|parfait|absolument|c'est\\s+bon|[çc]a\\s+marche|entendu|tr[èe]s\\s+bien|r[ée]servons",
  es: "si|s[íi]|confirm(?:o|ado)|vale|ok|correcto|claro|exacto|perfecto|de\\s+acuerdo|est[áa]\\s+bien|dale|reservemos",
  ru: "да|подтверждаю|ок|верно|правильно|согласен|согласна|конечно|хорошо|отлично|договорились|именно|бронируем|давай\\s+забронируем",
  ar: "نعم|أكد|أؤكد|موافق|موافقه|تمام|صحيح|بالتأكيد|حسنا|ماشي|اوكي|أوكي|ايوه|أجل|لنحجز|احجز|نحجز|ممتاز",
};

const _wrap = (body: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, "iu");

export const CONFIRM_POSITIVE: Record<string, RegExp> = Object.fromEntries(
  Object.entries(POS_ALT).map(([l, b]) => [l, _wrap(b)]),
) as Record<string, RegExp>;

// NEGATİF setler (onayı iptal eden kelimeler) — state-machine'den taşındı
// (F4: değiştirme fiilleri dahil). TR lookaround; diğerleri de lookaround'a
// yükseltildi (eski \b — Yan #8 tutarlılığı, davranış: ASCII'de birebir aynı,
// RU/AR'da sınır artık DOĞRU).
export const CONFIRM_NEGATIVE: Record<string, RegExp> = {
  tr: /(?<![\p{L}\p{N}])(ama|fakat|ancak|lakin|değil|yok|hayır|istemiyorum|vazgeçtim|olmaz|bekle|dur|aslında|sanki|acaba|mı\?|mi\?|değil mi|yanlış|hata|hatalı|yap|olsun)(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])(değiştir|düzelt|güncelle|değişiklik)/iu,
  // NOT: "correct" negatifte KALIR (orijinal davranış) — "correct the phone" =
  // değişiklik talebi. Bunun bedeli: çıplak "correct" onay SAYILMAZ (pozitifte
  // olsa da negatif ezer) — orijinalde de böyleydi, semantik değiştirilmedi.
  en: /(?<![\p{L}\p{N}])(but|however|except|not|no|don't|wait|hold|change|actually|wrong|mistake|rather|instead|unless|modify|edit|update|correct|fix|make\s+it)(?![\p{L}\p{N}])/iu,
  de: /(?<![\p{L}\p{N}])(aber|jedoch|nicht|nein|warte|ändern|eigentlich|falsch|stattdessen|korrigieren|aktualisieren|bearbeiten|mach\s+es)(?![\p{L}\p{N}])/iu,
  fr: /(?<![\p{L}\p{N}])(mais|cependant|non|pas|attends|changer|plutôt|en fait|faux|modifier|corriger|éditer|mettre\s+à\s+jour|fais\s+en|faites\s+en)(?![\p{L}\p{N}])/iu,
  es: /(?<![\p{L}\p{N}])(pero|sin embargo|no|espera|cambiar|en realidad|incorrecto|equivocado|modificar|corregir|actualizar|editar|hazlo|hazla)(?![\p{L}\p{N}])/iu,
  ru: /(?<![\p{L}\p{N}])(но|однако|нет|не|подожди|изменить|вообще-то|неправильно|ошибка|исправить|обновить|редактировать|сделай)(?![\p{L}\p{N}])/iu,
  ar: /(?<![\p{L}\p{N}])(لكن|لا|ليس|انتظر|تغيير|في الواقع|خطأ|تعديل|تحديث|اجعل)(?![\p{L}\p{N}])/iu,
};

// T14 Path-3 clearPositive (Katman A) — TÜM dillerin birleşimi. Aynı POS_ALT
// kaynağından türediği için detectConfirmation ile ASLA drift etmez.
export const CLEAR_POSITIVE_RE = _wrap(Object.values(POS_ALT).join("|"));
