// Müsaitlik-sorusu kelime seti — TEK KAYNAK (2026-07-09 FAZ4-P1, İş1).
//
// Tüketici: info-extractor Blok 8.5 V10 soru-guard'ı (_availQ). Gün-ordinal
// + müsaitlik-kelimesi → :10e cevaplar (SEÇİM değil). Eskiden TR+EN'di →
// DE/FR/ES/RU/AR "20'si müsait mi" SEÇİM sanılıyordu (V10 bug'ı 5 dilde).
//
// ASİMETRİK-MALİYET KARARI (P2-V10): bu set soru/seçim AYRIMINI belirler.
// AŞIRI-yakalama → seçimi soru sanır → seçim KAÇAR (kötü). Bu yüzden DAR ve
// KESİN: yalnız müsaitlik/boşluk anlamı taşıyan kelimeler; genel kelime YOK.
// Ek güvenlik: V10 yalnız gün-ordinal (1-31) VARSA tetiklenir → bağlam zaten dar.
//
// Pattern disiplini: \p{L}\p{N} lookaround + /iu (Yan #8). RU çekim için
// [\p{L}]* eki (доступн/свободн kökleri). AR konuşma "فاضي" dahil.
export const AVAILABILITY_RE =
  /(?<![\p{L}\p{N}])(müsait|musait|uygun|boş|bos|dolu|yer\s*var|yer\s*kaldı|yer\s*kaldi|müsaitlik|musaitlik|available|availability|free|open|vacant|verfügbar|verfugbar|verfügbarkeit|verfugbarkeit|frei|disponible|disponibilité|disponibilite|disponibilidad|libre|доступн[\p{L}]*|свободн[\p{L}]*|есть\s*мест[\p{L}]*|متاح|متوفر|فاضي)(?![\p{L}\p{N}])/iu;
