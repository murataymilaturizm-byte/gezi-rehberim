// Soru-sinyali tespiti — 7 dil (TR/EN/DE/FR/ES/RU/AR).
//
// 2026-07-03 PROVIDE PROMOTE fix ile eklendi. Tüketici: process-message.ts
// PROVIDE PROMOTE guard'ı — COLLECTING_INFO'da beklenen alan extract edilmiş
// olsa bile mesaj SORU ise intent yükseltilmez (mergeReservationInfo Kural 4'ün
// asıl koruduğu sınıf: "3 gün mü sürüyor?" pax=3 yazılmasın).
//
// Tasarım kararları:
// - "?" VE Arapça "؟" soru işaretleri dahil.
// - Kelimelerde \p{L}\p{N} LOOKBEHIND var, lookahead YOK (çekim eki serbest —
//   "nasılsınız" yakalanır). Bu bilinçli AŞIRI-yakalama: soru tespitinde
//   yanlış-pozitif GÜVENLİ taraftır (promote edilmez → mevcut davranış korunur);
//   yanlış-negatif ise veri bozulması riskidir.
// - state-machine.ts isInformationalMessage'ın TR-ağırlıklı listesinden ayrı
//   tutuldu — o liste 6+ transition'ın davranışını belirliyor, oraya dokunmak
//   geniş yüzey. Bu sabit yalnız promote kararı için.
export const QUESTION_SIGNAL_RE =
  /[?؟]|(?<![\p{L}\p{N}])(ne\s+zaman|ne\s+kadar|kaç|nedir|nereden|nerede|nasıl|hangi|neden|niçin|niye|var\s+mı|müsait\s+mi|uygun\s+mu|mevcut\s+mu|değil\s+mi|what|when|where|which|how|why|who|is\s+there|are\s+there|can\s+i|could\s+you|do\s+you|does\s+it|was\b|wann|wo\b|wie|welche[rsn]?|warum|wieso|gibt\s+es|quoi|quand|où|comment|quel(?:le)?s?|pourquoi|combien|est[\s-]ce|qué|cuándo|dónde|cómo|cuál(?:es)?|por\s+qué|quién|cuánt[oa]s?|hay\s|что|когда|где|как|какой|какая|какие|почему|зачем|кто|сколько|есть\s+ли|ما(?:ذا)?|متى|أين|كيف|أي|لماذا|كم|هل|مين)/iu;
