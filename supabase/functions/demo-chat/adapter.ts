// DemoChatAdapter — ChannelAdapter interface'ini demo-chat için implement eder.
// WhatsApp'tan farkı: context stateless (frontend taşır), history DB'de, send HTTP response.

/**
 * KATMAN 2: Stage-aware TTL — WhatsApp adapter ile aynı eşikler.
 * Demo-chat'te de yarım rezervasyon 45dk, gezinme 24h.
 * (Demo'da kullanıcı genelde tek seferlik test ediyor ama yine de tutarlı olsun.)
 */
const STAGE_TTL_MS: Record<string, number> = {
  GREETING:        24 * 60 * 60_000,
  BROWSING:        24 * 60 * 60_000,
  COLLECTING_INFO: 45 * 60_000,
  CONFIRMING:      45 * 60_000,
  COMPLETED:       12 * 60 * 60_000,
};
const DEFAULT_TTL_MS = 45 * 60_000;

import type { ChannelAdapter, LoadContextResult } from "../shared/handlers/types.ts";
import type { ConversationContext } from "../shared/fsm/types.ts";

export class DemoChatAdapter implements ChannelAdapter {
  readonly channel = "demo" as const;
  /** sessionId kullanıcı tanımlayıcısı olarak */
  readonly identifier: string;

  constructor(
    private _supabase: any,
    private _agencyId: string,
    sessionId: string,
    /** Frontend'den gelen raw context (JSON body'den) */
    private _incomingContext: unknown,
    /** Frontend'den gelen conversationStyle (tone override) */
    private _conversationStyle?: string,
  ) {
    this.identifier = sessionId;
  }

  /**
   * Context frontend'den (stateless) gelir — DB sorgusu yok.
   * conversationStyle varsa tone override edilir.
   *
   * KATMAN 1+2: stage-aware stale check, sentinel ile process-message visible reset yapar.
   */
  async loadContext(): Promise<LoadContextResult> {
    const raw = this._incomingContext;
    if (!raw || typeof raw !== "object") return { context: null };
    const c = raw as any;
    // Minimum geçerlilik kontrolü
    if (typeof c.stage !== "string" || typeof c.language !== "string" || typeof c.tone !== "string") {
      return { context: null };
    }

    // KATMAN 2: Stage-aware TTL (önceki tek STALE_CONTEXT_HOURS=2'nin yerine)
    if (c.lastUpdated) {
      const _ageMs = Date.now() - new Date(c.lastUpdated).getTime();
      const _stage = String(c.stage || "BROWSING");
      const _ttlMs = STAGE_TTL_MS[_stage] ?? DEFAULT_TTL_MS;
      if (_ageMs > _ttlMs) {
        const _ageMin = Math.round(_ageMs / 60000);
        const _ttlMin = Math.round(_ttlMs / 60000);
        console.warn(`[demo-adapter] Context stale: stage=${_stage} age=${_ageMin}min > ttl=${_ttlMin}min — resetting with sentinel`);
        // KATMAN 1: sentinel — process-message visible reset
        return {
          context: null,
          stale: {
            lastStage: _stage,
            hadReservationInProgress: !!(c.reservationInfo && c.reservationInfo.dateId),
            ageMinutes: _ageMin,
            lastLanguage: c.language,
          },
        };
      }
    }

    const context = { ...c } as ConversationContext;
    // Tone override: frontend'den gelen conversationStyle
    if (this._conversationStyle && context.tone !== this._conversationStyle) {
      context.tone = this._conversationStyle as any;
    }
    return { context };
  }

  /**
   * Konuşma geçmişi DB'den yüklenir (WhatsApp ile aynı tablo).
   * ASC sıralı döner (eski → yeni) — process-message bunu bekler.
   */
  async loadHistory(limit = 50, since?: string): Promise<Array<{ role: string; content: string }>> {
    let q = this._supabase
      .from("whatsapp_conversations")
      .select("role, content")
      .eq("phone", this.identifier)
      .eq("agency_id", this._agencyId)
      .neq("role", "system");
    // 2026-06-24 FIX A1: cutoff varsa SADECE sonrasını getir (history kirlenmesi).
    if (since) q = q.gt("created_at", since);
    const { data } = await q.order("created_at", { ascending: true }).limit(limit);
    return (data || []).filter((m: any) => m.role === "user" || m.role === "assistant");
  }

  /**
   * Atomik kayıt: user + assistant mesajları tek insert'te.
   * Context DB'ye kaydedilmez — frontend konuşma state'ini taşır.
   */
  async saveTransaction(
    userMessage: string,
    reply: string,
    _newContext: ConversationContext,
  ): Promise<void> {
    const rows: any[] = [];
    if (userMessage) {
      rows.push({ phone: this.identifier, role: "user", content: userMessage, agency_id: this._agencyId });
    }
    rows.push({ phone: this.identifier, role: "assistant", content: reply, agency_id: this._agencyId });
    if (rows.length > 0) {
      await this._supabase.from("whatsapp_conversations").insert(rows);
    }
  }

  /**
   * Fallback: saveTransaction desteklenmediğinde (saveTransaction zaten tanımlı;
   * bu sadece tip uyumluluğu için).
   */
  async saveResponse(reply: string, _newContext: ConversationContext): Promise<void> {
    await this._supabase.from("whatsapp_conversations").insert({
      phone: this.identifier,
      role: "assistant",
      content: reply,
      agency_id: this._agencyId,
    });
  }

  /**
   * Demo-chat HTTP yanıtı processChatMessage result'dan alınır.
   * Bu metod no-op — HTTP response index.ts'te result.response olarak kurulur.
   */
  async sendResponse(_reply: string): Promise<void> {}

  /**
   * Hata mesajı — no-op (process-message result.response'da görünür).
   */
  async sendErrorResponse(_message: string): Promise<void> {}
}
