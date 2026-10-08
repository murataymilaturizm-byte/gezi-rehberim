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

export type HistoryMessage = { role: string; content: string };

/**
 * LLM/NLU'ya giden konuşma geçmişi — TEK KAYNAK (WhatsApp ve demo-chat adapter'ları
 * bunu çağırır). ASC döner (eskiden yeniye), yalnız user/assistant, en fazla `limit`
 * mesaj — her zaman EN YENİ `limit` mesaj.
 *
 * 2026-10-08 Dilim-5 (canlı olay TURZZ-CANLI-ESKI-VERI-TESHIS.md §3.3): eskiden
 * WhatsApp'ta önyüklenmiş geçmiş (process_whatsapp_message_atomic, son 50, DESC,
 * created_at YOK) kesim zamanını VE limiti yok sayıyordu → rezervasyon tamamlandıktan
 * sonra LLM eski uydurma listeyi geçmişte görüp kopyaladı. Demo-chat ise ASC+limit ile
 * EN ESKİ N mesajı alıyordu.
 *  - `since` (historyCutoffAt) varsa: önyüklemede zaman damgası olmadığından DB
 *    sorgusu (created_at > since) — kesim HER ZAMAN uygulanır.
 *  - `since` yoksa: önyükleme varsa ondan (ek sorgu yok), yoksa DB.
 *  - `excludeLatestUser`: çağıran güncel mesajı geçmiş yüklenmeden ÖNCE kaydettiyse
 *    (WhatsApp erken kayıt) DB'deki en yeni satır o mesajdır — LLM'e userMessage olarak
 *    ayrıca gider, geçmişte tekrar etmesin.
 */
export async function loadConversationHistory(opts: {
  supabase: any;
  phone: string;
  agencyId: string;
  limit: number;
  since?: string;
  /** DESC önyüklenmiş geçmiş (WhatsApp atomic RPC). */
  preloaded?: HistoryMessage[] | null;
  excludeLatestUser?: string | null;
}): Promise<HistoryMessage[]> {
  const { supabase, phone, agencyId, limit, since, preloaded, excludeLatestUser } = opts;
  const isChat = (m: HistoryMessage) => m.role === "user" || m.role === "assistant";

  let desc: HistoryMessage[];
  if (preloaded && !since) {
    // Önyükleme güncel mesaj kaydedilmeden önce alınır → onu içermez.
    desc = preloaded.filter(isChat).slice(0, limit);
  } else {
    let q = supabase
      .from("whatsapp_conversations")
      .select("role, content")
      .eq("phone", phone)
      .eq("agency_id", agencyId)
      .neq("role", "system");
    if (since) q = q.gt("created_at", since);
    const fetchN = excludeLatestUser ? limit + 1 : limit;
    const { data } = await q.order("created_at", { ascending: false }).limit(fetchN);
    desc = ((data ?? []) as HistoryMessage[]).filter(isChat);
    if (excludeLatestUser && desc[0]?.role === "user" && desc[0].content === excludeLatestUser) {
      desc = desc.slice(1);
    }
    desc = desc.slice(0, limit);
  }
  return desc.map(({ role, content }) => ({ role, content })).reverse();
}
