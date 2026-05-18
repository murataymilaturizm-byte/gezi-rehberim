// Unified channel adapter interface — her kanalın (demo-chat, whatsapp) implement edeceği contract.
// processChatMessage() bu interface üzerinden tüm I/O yapar; channel-specific kod burada soyutlanır.

import type { ConversationContext } from "../fsm/types.ts";

export interface ChannelAdapter {
  /** Kullanıcı tanımlayıcı: WhatsApp için phone, demo için sessionId */
  readonly identifier: string;
  /** Channel tanımlayıcı (debug/log için) */
  readonly channel: "demo" | "whatsapp";

  /** Kayıtlı conversation context'i yükle (yoksa null) */
  loadContext(): Promise<ConversationContext | null>;

  /**
   * Conversation history yükle — ASC sıralı (eski → yeni), system rolü hariç.
   * @param limit Kaç mesaj istendiği
   */
  loadHistory(limit?: number): Promise<Array<{ role: string; content: string }>>;

  /**
   * Bot cevabını ve güncel context'i kaydet.
   * WhatsApp: save_conversation_atomic RPC (atomic assistant+system)
   * Demo: whatsapp_conversations'a user+assistant birlikte
   */
  saveResponse(reply: string, newContext: ConversationContext): Promise<void>;

  /** Cevabı kullanıcıya ilet (WA API veya HTTP response) */
  sendResponse(reply: string): Promise<void>;

  /** Erken çıkış gerektiren hata/uyarı mesajı gönder (rate limit, too long vb.) */
  sendErrorResponse(message: string): Promise<void>;

  /**
   * Rezervasyon tamamlandığında kanal-spesifik ek içerik (opsiyonel).
   * WhatsApp: DB'den message_templates tablosunu sorgular.
   * Demo: null döner.
   */
  getCompletionTemplateAddendum?(params: {
    tourId: string;
    dateId: string;
    fullName: string;
    pax: number;
    language: string;
    agencyId: string;
  }): Promise<string | null>;
}

export interface ProcessMessageInput {
  /** Sanitize edilmemiş ham mesaj (sanitize processChatMessage içinde yapılır) */
  message: string;
  adapter: ChannelAdapter;
  /** Agency tüm alanlarıyla (any — her kanalın farklı agency shape'i olabilir) */
  agency: any;
  supabase: any;
  /** getCachedTours ile önceden yüklenen, dile göre localize edilmiş tur listesi */
  tours: any[];
  paymentInstructions: any | null;
  languageCurrencies: any | null;
  primaryCurrency: string;
  /** Dönen kullanıcı adı (WhatsApp profil tablosundan, demo için null) */
  returningUserName?: string | null;
}

export interface ProcessMessageResult {
  success: boolean;
  /** Kullanıcıya gönderilen nihai yanıt */
  response?: string;
  /** Hata açıklaması (success=false durumunda) */
  error?: string;
  newContext?: ConversationContext;
}
