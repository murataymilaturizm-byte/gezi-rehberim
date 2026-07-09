// Değişiklik-niyeti kelime tespiti — TEK KAYNAK (DRY).
//
// 2026-07-03 X9-change fix ile process-message.ts A1/A2/A3 bloğundaki
// blok-scoped _changeKeywordsRe buraya taşındı. İki tüketici:
//   1. process-message.ts A1-log + A2/A3 akış-içi değiştirme dalları
//   2. info-extractor.ts Blok 1 BUG-X9 sigortasının 3. kabul yolu
//      (change-sinyalli pax değişikliği — bkz. docs/ARCHITECTURE_GUARDS.md G8)
//
// Pattern disiplini (Yan #8 / K1 dersi): ASCII \b DEĞİL, \p{L}\p{N}
// lookaround + /iu flag — Türkçe non-ASCII bitişli kelimelerde ("yanlış",
// "aslında") \b boundary tanımaz, yanlış-pozitif/negatif üretir.
// 2026-07-09 V1: "yapalım/yapsak/alalım/alsak/yapar mısın" çekimleri eklendi
// (canlı: CONFIRMING "tarihi 20 aralık yapalım" → "yap" lookahead'e takılıp
// change sayılmıyordu → A3-date girmiyordu → "Tam anlayamadım"). "yap" tek
// başına lookaround'lu kaldı; çekimler açık alternation.
// 2026-07-09 FABLE-denetim (V1-ASCII sınıf-süpürmesi): TR aksansız varyantlar
// eklendi — asl[ıi]nda, de[ğg]i[şs]tir(elim), d[üu]zelt, g[üu]ncelle,
// [şs][öo]yle olsun, yanl[ıi][şs] oldu, eski de[ğg]il. Recall-only genişleme
// (7 tüketici: A1/A2/A3/X9/Blok5b/T23/G8 — davranış sınıfı aynı).
export const CHANGE_KEYWORDS_RE =
  /(?<![\p{L}\p{N}])(asl[ıi]nda|yerine|olsun|de[ğg]i[şs]tir|de[ğg]i[şs]tirelim|yap|yapal[ıi]m|yapsak|yapar\s+m[ıi]s[ıi]n|alal[ıi]m|alsak|d[üu]zelt|g[üu]ncelle|[şs][öo]yle\s+olsun|yanl[ıi][şs]\s+oldu|eski\s+de[ğg]il|actually|instead|change(?:\s+it)?(?:\s+to)?|make\s+it|update|correct|let['’]s\s+say|eigentlich|stattdessen|änder[en]?|korrigier(?:en|e)|lass\s+es|en\s+fait|plut[ôo]t|changer|modifier|corriger|mettons|disons|en\s+realidad|mejor|cambia(?:r)?|modificar|corregir|que\s+sea|вообще-то|вместо|измен(?:ить|и)|исправ(?:ить|ь)|пусть\s+будет|في\s+الواقع|بدلاً|غيّر|عدّل|صحّح|يكون)(?![\p{L}\p{N}])/iu;
