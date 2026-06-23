// 2026-06-20 (Bug 1 v2 — state geçişi tam çözümü):
// Tour-change transformasyonu tek-kaynak. İki çağrı yeri var:
//
//   1. state-machine.ts:512-524 (TOUR_SELECTED → TOUR_SELECTED): pattern bazlı,
//      kullanıcı "yeni tur" / "başka tur" gibi açık değişim istediğinde.
//   2. state-machine.ts:540-552 (COLLECTING_INFO → TOUR_SELECTED): pattern bazlı,
//      mid-flow "aslında başka tur" gibi mesajlarda.
//   3. process-message.ts erken-müdahale (YENİ): tour-matching kanıtsal selectedTour
//      farklıysa, stage koruma intent'i ezmeden ÖNCE deterministik uygula.
//
// Üçü de produceTourChangeContext'i çağırır → davranış BİREBİR aynı, çakışma yok.
// Erken müdahale state'i güncelleyince, state-machine'in transition condition'ı
// (`selectedTour.id !== ctx.currentTour.id`) artık equal görür → kendiliğinden atlar.
//
// Özge fix korunur: pax/isim/phone/email kişi-bağımlı alanlar SPREAD ile KORUNUR.
// Sadece tur değişimi sebebiyle geçersiz olan dateId/selectedDate temizlenir.

import type { ConversationContext, InfoCollectionStep } from "../fsm/types.ts";

/**
 * Tour-change transformasyonunun deterministik core'u.
 *
 * @param context Mevcut state (CONFIRMING dahil herhangi bir stage)
 * @param newTour Yeni tur (TourReference benzeri obj; id + title + opsiyonel dates)
 * @returns Güncellenmiş context. stage'i değiştirmez (caller ihtiyaca göre ayarlar).
 *
 * NOT: stage burada DEĞİŞTİRİLMEZ — bazı çağıranlar TOUR_SELECTED'e geçer
 * (state-machine), bazıları COLLECTING_INFO'ya çeker (process-message erken
 * müdahale). Caller stage'i ayrıca set eder.
 */
export function produceTourChangeContext(
  context: ConversationContext,
  newTour: any,
): ConversationContext {
  return {
    ...context,
    currentTour: newTour,
    viewedTours: [...(context.viewedTours || []), newTour.id],
    reservationInfo: {
      ...context.reservationInfo,                  // Özge fix: pax/isim/phone KORU
      tourId: newTour.id,
      tourTitle: newTour.title,
      dateId: undefined,                           // yeni tur → eski tarih geçersiz
      selectedDate: undefined,
    },
    collectionStep: "waiting_for_date" as InfoCollectionStep,
  };
}

/**
 * process-message erken-müdahale gate'i:
 *   - tour-matching farklı bir tur buldu (selectedTour mevcut currentTour'dan farklı)
 *   - AND stage COLLECTING_INFO veya CONFIRMING (stage koruma intent'i ezdiği yerler)
 *
 * BROWSING / TOUR_SELECTED / COMPLETED / GREETING'de mevcut state-machine transition'ları
 * zaten doğru çalışıyor → erken müdahaleye gerek yok.
 *
 * COMPLETED özellikle hariç: after-sales mantığı bozulmasın.
 */
export function shouldApplyEarlyTourChange(
  context: ConversationContext,
  selectedTour: any,
): boolean {
  if (!selectedTour) return false;
  if (selectedTour.id === context.currentTour?.id) return false;
  return context.stage === "COLLECTING_INFO" || context.stage === "CONFIRMING";
}

// ─── 2026-06-23 SORUN D — tur değişim ack prefix ─────────────────────────
//
// CANLI BUG: Kullanıcı mid-flow "aslında Pamukkale" yazınca state güncellenir
// (currentTour=Pamukkale, dateId silinir, waiting_for_date) ama bot SESSİZ —
// sadece yeni turun tarih listesini sunar. Kullanıcı tur değişiminin uygulandığını
// ancak başlığı fark ederse anlıyor — şeffaflık eksik.
//
// FIX: bypass mesajlarının önüne kısa ack prefix ekle. 3 yer: :11 tarih listesi,
// :11a-AUTO-DATE-ACK, H-β dolu tarih reddi (pax bypass dahil — tutarlılık).
//
// ŞABLON KARARI (Murat 2026-06-23):
//   "Şimdi *${title}* için devam ediyoruz."
//
// Gerekçe:
//   - Türkçe ek-uyumu yok (Pamukkale'YE / Balon Turu'NA / Efes'E sorun olmaz)
//   - Tekrar yok ("Pamukkale Turu turuna geçtim" gibi çift "tur" çakışması yok)
//   - Müşteri-odaklı sıcak ton ("geçtim" tek-yönlü, "devam ediyoruz" karşılıklı)
//
// FALLBACK: çok-dil eşitleme fazında 5 dil eklenecek. Şimdi TR+EN, diğerleri EN.
export function buildTourChangePrefix(
  oldTourId: string | undefined,
  newTourId: string | undefined,
  newTourTitle: string,
  lang: string,
): string {
  if (!oldTourId || !newTourId || oldTourId === newTourId) return "";
  if (!newTourTitle || !newTourTitle.trim()) return "";
  const prefixes: Record<string, string> = {
    tr: `Şimdi *${newTourTitle}* için devam ediyoruz. `,
    en: `Now continuing with *${newTourTitle}*. `,
  };
  return prefixes[lang] || prefixes.en;
}
