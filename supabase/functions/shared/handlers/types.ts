// Unified channel adapter interface — her kanalın (demo-chat, whatsapp) implement edeceği contract.
// processChatMessage() bu interface üzerinden tüm I/O yapar; channel-specific kod burada soyutlanır.

import type { ConversationContext } from "../fsm/types.ts";

/**
 * Stale state bilgisi — context yaş eşiğini aştığında loadContext döner.
 * process-message bunu görüp kullanıcıya net "yeniden başlıyoruz" mesajı atar
 * ve AI'ya gitmeden early return yapar (history sızıntısı önlenir).
 */
export interface StaleInfo {
  /** Drop edilen state'in son stage'i (debug + mesaj seçimi için) */
  lastStage: string;
  /** Yarım rezervasyon var mıydı? Mesaj farklılaşır */
  hadReservationInProgress: boolean;
  /** Drop sebebini debug log için */
  ageMinutes: number;
  /** Drop edilen state'in dili (mesaj 7 dil seçiminde fallback) */
  lastLanguage?: string;
}

/**
 * loadContext dönüş tipi: context yüklenmişse `context` dolu, stale ise `stale` dolu.
 * - Normal yüklenme: { context: <ConversationContext> }
 * - Hiç state yok: { context: null }
 * - Stale (TTL aşımı): { context: null, stale: {...} } → process-message early return
 */
export interface LoadContextResult {
  context: ConversationContext | null;
  stale?: StaleInfo;
}

export interface ChannelAdapter {
  /** Kullanıcı tanımlayıcı: WhatsApp için phone, demo için sessionId */
  readonly identifier: string;
  /** Channel tanımlayıcı (debug/log için) */
  readonly channel: "demo" | "whatsapp";

  /**
   * Kayıtlı conversation context'i yükle.
   * - Normal: { context: <ConvCtx> }
   * - Hiç state yok: { context: null }
   * - Stage-aware TTL aşılmış (bayat): { context: null, stale: {...} } — process-message visible reset yapar
   */
  loadContext(): Promise<LoadContextResult>;

  /**
   * Conversation history yükle — ASC sıralı (eski → yeni), system rolü hariç.
   * @param limit Kaç mesaj istendiği
   * @param since ISO timestamp — verilirse SADECE bu zamandan SONRAKİ mesajlar döner
   *              (FIX A1 history cutoff — CONFIRMING→COMPLETED onay anı sonrası).
   *              undefined → tüm history (geriye dönük uyumluluk korunur).
   */
  loadHistory(limit?: number, since?: string): Promise<Array<{ role: string; content: string }>>;

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
   * User + assistant + context'i tek atomik işlemle kaydet (opsiyonel).
   * WhatsApp: save_conversation_atomic RPC (user+assistant+system birlikte)
   * Demo: implement etmez → saveResponse fallback kullanılır
   */
  saveTransaction?(userMessage: string, reply: string, newContext: ConversationContext): Promise<void>;
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
  /**
   * Kanalın bildiği "explicit" kullanıcı dili (demo'da i18n.language; WhatsApp'ta yok).
   * Ham mesajdan tahmin etmek yerine bu kullanılır — özellikle ilk mesajda
   * ASCII metin için detection cold-start'ta TR fallback'a düşmesini önler.
   * Mevcut conversation context'in dilinden üstündür (kullanıcı dil seçimi otoritedir).
   */
  seedLanguage?: string;
}

export interface ProcessMessageResult {
  success: boolean;
  /** Kullanıcıya gönderilen nihai yanıt */
  response?: string;
  /** Hata açıklaması (success=false durumunda) */
  error?: string;
  newContext?: ConversationContext;
}
