// Fiyat-sorusu sinyali — TEK KAYNAK (2026-07-10, 7-dil paralellik şartı).
//
// Tüketici: process-message :11b A2 fiyat-prefix'i (zengin ilk-mesajda kuyruk
// fiyat sorusu). Gelecek tüketiciler (genel fiyat-soru yönlendirmesi, Approach-B)
// AYNI kaynaktan beslenmeli — kopya-liste açma.
//
// Pattern disiplini: \p{L}\p{N} lookaround + /iu (Yan #8). "fiyatlandırma" gibi
// türevler lookahead'e takılır (bilinçli — politika-sorusu fiyat-hesabı değildir).
export const PRICE_QUESTION_RE =
  /(?<![\p{L}\p{N}])(fiyat[ıi]?|ne\s+kadar|kaç\s+para|kaça|ücret[i]?|how\s+much|price|cost|combien|[çc]a\s+co[ûu]te|cu[áa]nto\s+(?:cuesta|vale|es)|precio|сколько\s+(?:стоит|будет)?|цена|كم\s+(?:السعر|التكلفة|سيكلف)|السعر|بكم|preis|was\s+kostet|wie\s+viel)(?![\p{L}\p{N}])/iu;
