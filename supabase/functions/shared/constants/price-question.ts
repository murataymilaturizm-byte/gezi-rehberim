// Fiyat-sorusu sinyali — TEK KAYNAK (2026-07-10, 7-dil paralellik şartı).
//
// Tüketici: process-message :11b A2 fiyat-prefix'i (zengin ilk-mesajda kuyruk
// fiyat sorusu). Gelecek tüketiciler (genel fiyat-soru yönlendirmesi, Approach-B)
// AYNI kaynaktan beslenmeli — kopya-liste açma.
//
// Pattern disiplini: \p{L}\p{N} lookaround + /iu (Yan #8). "fiyatlandırma" gibi
// türevler lookahead'e takılır (bilinçli — politika-sorusu fiyat-hesabı değildir).
// 2026-07-25 PAKET-A FIX5a/b (KÖK-6): FR `prix|tarif|coûte*` eklendi ("quel est le prix?"
// kaçıyordu); RU yapısal fix — eski `сколько\s+(?:стоит|будет)?` zorunlu `\s+` + opsiyonel
// fiil → araya kelime girince ("сколько это стоит") lookahead patlıyordu. Artık `сколько`
// tek-token da geçer + стоимость/почём eklendi.
export const PRICE_QUESTION_RE =
  /(?<![\p{L}\p{N}])(fiyat[ıi]?|ne\s+kadar|kaç\s+para|kaça|ücret[i]?|how\s+much|price|cost|combien|prix|tarif|co[ûu]te\p{L}*|cu[áa]nto\s+(?:cuesta|vale|es)|precio|сколько(?:\s+(?:это\s+)?(?:стоит|будет|обойд[её]тся))?|стоимость|поч[её]м|цена|كم\s+(?:السعر|التكلفة|سيكلف)|السعر|بكم|preis|was\s+kostet|wie\s+viel)(?![\p{L}\p{N}])/iu;
