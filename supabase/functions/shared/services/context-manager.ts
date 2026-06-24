// Context management service — NLU context building + conversation history
// Webhook'un inline 25 satır NLU context bloğunu ve DB history sorgusunu kapsüller.

import type { ConversationContext } from "../fsm/types.ts";

/**
 * FSM context'inden NLU için durum metni üretir.
 * Webhook'un satır 565–588 arasındaki stage/step/reservation/status bloğunu karşılar.
 * (Conversation history dahil DEĞİL — çağıran taraf ekler.)
 */
export function buildNLUContextBase(context: ConversationContext): string {
  let ctx = `Current stage: ${context.stage}.`;

  if (context.collectionStep) {
    ctx += ` Collection step: ${context.collectionStep}.`;
  }

  if (context.currentTour) {
    ctx += ` Selected tour: ${context.currentTour.title}.`;
  }

  if (context.reservationInfo) {
    const info = context.reservationInfo;
    const collected: string[] = [];
    if (info.selectedDate) collected.push(`date: ${info.selectedDate}`);
    if (info.paxAdult) collected.push(`pax: ${info.paxAdult}`);
    if (info.fullName) collected.push(`name: ${info.fullName}`);
    if (info.phone) collected.push(`phone: ${info.phone}`);
    if (collected.length > 0) {
      ctx += ` Reservation info collected: ${collected.join(", ")}.`;
    }
  }

  if (context.stage === "COMPLETED" && context.reservationConfirmed) {
    ctx += ` STATUS: RESERVATION COMPLETED - any tour questions are purely informational.`;
  }

  if (
    context.collectionStep === "ready_for_confirmation" ||
    (context.reservationInfo?.fullName &&
      context.reservationInfo?.phone &&
      context.reservationInfo?.paxAdult &&
      context.reservationInfo?.dateId)
  ) {
    ctx += ` STATUS: READY FOR CONFIRMATION - waiting for user to confirm booking.`;
  }

  return ctx;
}

/**
 * Konuşma geçmişini DESC sırayla döndürür (yeniden eskiye).
 * Preloaded: process_whatsapp_message_atomic RPC DESC döndürür — olduğu gibi geçer.
 * DB fallback: DESC sorgular.
 * Çağıran taraf (webhook) tek bir .reverse() ile ASC'ye çevirerek kullanır.
 * Limit 20: bir rezervasyon akışı 12-14 mesaj, 10 ile tarih seçimi kayboluyordu.
 */
export async function getConversationHistory(
  supabase: any,
  phone: string,
  agencyId: string,
  preloaded: Array<{ role: string; content: string }> | null,
  limit = 20,
  since?: string,
): Promise<Array<{ role: string; content: string }>> {
  // 2026-06-24 FIX A1: preloaded varsa cutoff yoksayılır (preloaded mesajlarda
  // timestamp yok → filter uygulanamaz). Bilinen kabul edilebilir sınır.
  if (preloaded !== null) return preloaded;

  let q = supabase
    .from("whatsapp_conversations")
    .select("role, content")
    .eq("phone", phone)
    .eq("agency_id", agencyId)
    .neq("role", "system");
  // 2026-06-24 FIX A1: cutoff varsa SADECE sonrasını getir (history kirlenmesi).
  if (since) q = q.gt("created_at", since);
  const { data } = await q.order("created_at", { ascending: false }).limit(limit);

  return data ?? [];
}
