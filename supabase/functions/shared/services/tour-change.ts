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
 *   - AND stage TOUR_SELECTED / COLLECTING_INFO / CONFIRMING (kullanıcı bağlamı
 *     bir tura kilitlendi AMA başka tur seçebilir — state-machine transition'larının
 *     yeterli olmadığı yerler).
 *
 * 2026-06-25 BUG-X6 FIX: TOUR_SELECTED eklendi. Eski yorum yanlış varsayıma
 * dayanıyordu — TOUR_SELECTED → COLLECTING_INFO transition action `...ctx` ile
 * eski currentTour'u kopyalıyor, input.selectedTour'u görmezden geliyordu →
 * keşifte tur kilitledikten sonra başka tur "rezerve et" deyince eski tur
 * tarihlerini gösteriyordu.
 *
 * 2026-06-25 ALT-KÖK A FIX: TOUR_SELECTED için intent guard eklendi. X6 fix
 * tour_search ("Kapadokya daha iyi mi" karşılaştırma sorusu) intent'inde de
 * erken-müdahaleyi tetikliyordu → stage zorla COLLECTING_INFO + waiting_for_date
 * → :11 tarih listesi → kullanıcı bilgi sorduğu halde rezervasyon başlıyordu.
 * Fix: TOUR_SELECTED'da SADECE açık rezervasyon/değişiklik niyetinde tetikle
 * (reservation_intent/tour_selected/change_info). tour_search/faq_general/general
 * → state-machine transition'larına bırak (tarih sormaz, collectionStep undefined).
 *
 * COLLECTING_INFO/CONFIRMING — KÖK 5 davranışı intent-bağımsız KORUNUR:
 * mid-flow tur değişimi (kullanıcı zaten rezervasyon yapıyor) tarih yenilenir.
 *
 * BROWSING / COMPLETED / GREETING hâlâ HARİÇ: BROWSING transition action zaten
 * input.selectedTour kullanıyor (line 512-522), COMPLETED after-sales mantığı,
 * GREETING ilk seçim.
 */
export function shouldApplyEarlyTourChange(
  context: ConversationContext,
  selectedTour: any,
  intent: string,
  message: string = "",
): boolean {
  if (!selectedTour) return false;
  if (selectedTour.id === context.currentTour?.id) return false;

  // 2026-06-25 ALT-KÖK A + BUG-X7: TOUR_SELECTED için intent guard
  // X7 (canlı): NLU "rezerve edelim"i bazen tour_search sınıflıyor → intent guard
  // tek başına yetmiyor → mesaj-tabanlı rezervasyon sinyali ile telafi (C ilkesi).
  if (context.stage === "TOUR_SELECTED") {
    const _isResIntent = intent === "reservation_intent"
        || intent === "tour_selected"
        || intent === "change_info";
    if (_isResIntent) return true;
    if (hasReservationSignal(message)) return true;  // ★ X7: NLU tutarsızlığı telafi
    return false;
  }

  // COLLECTING_INFO / CONFIRMING: KÖK 5 davranışı korunur (intent-bağımsız)
  return context.stage === "COLLECTING_INFO" || context.stage === "CONFIRMING";
}

/**
 * 2026-06-25 BUG-X7 FIX (canlı exec 9fb51754):
 * Mesaj-tabanlı rezervasyon sinyali tespiti. NLU intent yanlış sınıflasa bile
 * (M1 tutarsızlık — "rezerve edelim" bazen tour_search dönüyor) deterministik
 * yakalama. C ilkesi: kritik karar NLU intent'ine değil, mesaj metnine bağlı.
 *
 * PATTERN STRATEJİSİ (X3 deseni — Yan #8 ailesi):
 *   - lookbehind (?<![\p{L}\p{N}]) ASCII boundary değil → ş/ı bitişlilerde de çalışır
 *   - lookahead YOK → çekim eki serbest:
 *     "rezerve" + "edelim"/"etmek" çekim → match
 *     "rezervasyon" + "umuz"/"unu" çekim → match
 *     "katıl" + "mak"/"ım"/"acağız" → match
 *
 * KAPSAM (7 dil):
 *   TR: rezerve/rezervasyon/kayıt/yer ayır/katıl
 *   EN: reservation/booking/book
 *   ES: reservar
 *   FR: réserver
 *   DE: buchen
 *   RU: бронирование
 *   AR: حجز
 *
 * KULLANIM:
 *   - shouldApplyEarlyTourChange TOUR_SELECTED guard (X7 fix)
 *   - state-machine.ts:556 TOUR_SELECTED → COLLECTING_INFO condition (DRY)
 *
 * YANLIŞ POZİTİF: "rezerve etmiyorum" / "katıl-ma" gibi negatif kullanım
 * teorik olarak yakalar AMA pratik etki düşük (kullanıcı bu kalıbı CONFIRMING
 * öncesinde nadir kullanır; detectCancellation/negation sonraki transition'da
 * düzeltir). Mevcut state-machine pattern'ında da aynı tür risk vardı, sorun
 * bildirilmedi.
 */
export function hasReservationSignal(message: string): boolean {
  if (!message) return false;
  return /(?<![\p{L}\p{N}])(rezerve|rezervasyon|reservation|booking|book|reservar|réserver|buchen|бронирование|حجز|kayıt|yer\s*ayır|katıl)/iu.test(message);
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
