// DemoChatAdapter — ChannelAdapter interface'ini demo-chat için implement eder.
// WhatsApp'tan farkı: context stateless (frontend taşır), history DB'de, send HTTP response.

/** Context bu kadar saat eskiyse sıfırlanır (bayat state koruması) */
const STALE_CONTEXT_HOURS = 2;

import type { ChannelAdapter } from "../shared/handlers/types.ts";
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
   */
  async loadContext(): Promise<ConversationContext | null> {
    const raw = this._incomingContext;
    if (!raw || typeof raw !== "object") return null;
    const c = raw as any;
    // Minimum geçerlilik kontrolü
    if (typeof c.stage !== "string" || typeof c.language !== "string" || typeof c.tone !== "string") {
      return null;
    }

    // FIX 1: Bayat state koruması (frontend'den gelen state)
    if (c.lastUpdated) {
      const _ageMs = Date.now() - new Date(c.lastUpdated).getTime();
      if (_ageMs > STALE_CONTEXT_HOURS * 3_600_000) {
        console.warn(`[demo-adapter] Context stale (${Math.round(_ageMs / 60000)}min old), resetting`);
        return null;
      }
    }

    const context = { ...c } as ConversationContext;
    // Tone override: frontend'den gelen conversationStyle
    if (this._conversationStyle && context.tone !== this._conversationStyle) {
      context.tone = this._conversationStyle as any;
    }
    return context;
  }

  /**
   * Konuşma geçmişi DB'den yüklenir (WhatsApp ile aynı tablo).
   * ASC sıralı döner (eski → yeni) — process-message bunu bekler.
   */
  async loadHistory(limit = 50): Promise<Array<{ role: string; content: string }>> {
    const { data } = await this._supabase
      .from("whatsapp_conversations")
      .select("role, content")
      .eq("phone", this.identifier)
      .eq("agency_id", this._agencyId)
      .neq("role", "system")
      .order("created_at", { ascending: true })
      .limit(limit);
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
