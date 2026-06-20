// 2026-06-20 (Bug 1 + 2 refactor): tour-matcher.ts artık yalnızca `findTourById`
// içerir. Eski `matchTour` (keyword-based, BUG 2 "turu" yanlış pozitifinin kaynağı),
// `createTourReference` (sadece matchTour'da kullanılırdı) ve `formatTourList`
// (hiçbir yerden çağrılmıyordu) SİLİNDİ.
//
// Tur eşleştirme tek noktada: services/tour-matching.ts:findMatchingTours.
// KANITSAL strateji (mesaj kelimeleri stopword filtreli) + NLU validation gate.
//
// findTourById tek sorumluluk: ID ile tur listesinde ara, döndür.

export function findTourById(tourId: string, availableTours: any[]): any | null {
  return availableTours.find((t) => t.id === tourId) || null;
}
