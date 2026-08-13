// WhatsApp channel adapter — ChannelAdapter interface'ini WhatsApp için implement eder.
// DB kayıt, Meta API gönderimi ve kanal-spesifik template logicini kapsüller.

/**
 * KATMAN 2: Stage-aware TTL — yarım rezervasyon hassas (45dk), gezinme uzun (24h).
 * Önceki tek STALE_CONTEXT_HOURS=2 hem yarım rezervasyon için fazla uzundu (kullanıcı
 * 1.5hr sonra "müsait değil" şokuyla karşılaşıyordu), hem statik bilgi (tur listesi
 * görüntüleme) için kısaydı (kullanıcı ertesi gün dönerse her şey kayboluyor).
 */
const STAGE_TTL_MS: Record<string, number> = {
  GREETING:        24 * 60 * 60_000,   // Statik bilgi — kullanıcı tur listesine bakmış olabilir
  BROWSING:        24 * 60 * 60_000,   // Soru-cevap, tur araştırma
  COLLECTING_INFO: 45 * 60_000,        // Yarım rezervasyon — niyet hassas, veri eskir
  CONFIRMING:      45 * 60_000,        // Onay bekleyen rezervasyon
  COMPLETED:       12 * 60 * 60_000,   // Rezervasyon bitmiş — sonraki mesaj genelde yeni iş
};
/** Bilinmeyen stage için emniyetli default — yarım rezervasyon riski varsayımı */
const DEFAULT_TTL_MS = 45 * 60_000;

import type { ConversationContext, ConversationTone } from "../shared/fsm/types.ts";
import type { ChannelAdapter, LoadContextResult } from "../shared/handlers/types.ts";
import { createInitialContext } from "../shared/fsm/state-machine.ts";
import { getDefaultToneForLanguage } from "../shared/fsm/localization.ts";
import { getConversationHistory } from "../shared/services/context-manager.ts";
import { truncateForWhatsApp } from "./utils/format.ts";
import { sendWhatsAppMessage } from "../_shared/metaWhatsapp.ts";
// K1: Meta gönderim fail'lerini görünür yapmak için merkezi error sink.
import { logCritical } from "../_shared/error-sink.ts";

function isValidContext(obj: unknown): obj is ConversationContext {
  return (
    obj !== null && typeof obj === "object" &&
    typeof (obj as any).stage === "string" &&
    typeof (obj as any).language === "string" &&
    typeof (obj as any).tone === "string"
  );
}

/** Webhook'un atomic save RPC'sini çağırır. Fallback: ayrı ayrı insert. */
async function saveConversationAtomic(
  supabase: any, phone: string, agencyId: string,
  userMessage: string, assistantMessage: string, context: ConversationContext,
): Promise<void> {
  const { data, error } = await supabase.rpc("save_conversation_atomic", {
    p_phone: phone,
    p_agency_id: agencyId,
    p_user_message: userMessage,
    p_assistant_message: assistantMessage,
    p_context: JSON.stringify(context),
  });
  if (error || !data?.success) {
    console.error("[adapter] save_conversation_atomic failed, fallback:", error?.message || data?.error);
    if (userMessage) {
      await supabase.from("whatsapp_conversations").insert({ phone, agency_id: agencyId, role: "user", content: userMessage });
    }
    await supabase.from("whatsapp_conversations").insert({ phone, agency_id: agencyId, role: "assistant", content: assistantMessage });
    await supabase.from("whatsapp_conversations").insert({ phone, agency_id: agencyId, role: "system", content: JSON.stringify(context) });
  }
}

export class WhatsAppAdapter implements ChannelAdapter {
  readonly channel = "whatsapp" as const;
  /** ChannelAdapter.identifier = WhatsApp phone number */
  readonly identifier: string;
  /** Convenience alias — adapter içi kullanım için */
  readonly phone: string;

  constructor(
    private supabase: any,
    private agency: any,
    phone: string,
    private metaPhoneNumberId: string,
    private metaAccessToken: string,
    private preloadedContextStr: string | null,
    private preloadedHistory: Array<{ role: string; content: string }> | null,
  ) {
    this.phone = phone;
    this.identifier = phone;
  }

  async loadContext(): Promise<LoadContextResult> {
    // Önce preloaded (atomic RPC'den gelen)
    let ctxStr = this.preloadedContextStr;
    let dbCreatedAt: string | null = null;
    if (ctxStr === null) {
      const { data } = await this.supabase
        .from("whatsapp_conversations")
        .select("content, created_at")
        .eq("phone", this.phone)
        .eq("agency_id", this.agency.id)
        .eq("role", "system")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      ctxStr = data?.content ?? null;
      dbCreatedAt = data?.created_at ?? null;
    }

    if (!ctxStr) return { context: null };

    try {
      const parsed = JSON.parse(ctxStr);
      if (!isValidContext(parsed)) return { context: null };

      // KATMAN 2: Stage-aware TTL — stage'e göre eşik seç (yarım rezervasyon hassas).
      // Önceki davranış tek STALE_CONTEXT_HOURS=2'ydi → yarım rezervasyonda fazla uzun,
      // gezinmede fazla kısa. Şimdi parsed.stage'e göre TTL.
      const _staleRef = parsed.lastUpdated || dbCreatedAt;
      if (_staleRef) {
        const _ageMs = Date.now() - new Date(_staleRef).getTime();
        const _stage = String(parsed.stage || "BROWSING");
        const _ttlMs = STAGE_TTL_MS[_stage] ?? DEFAULT_TTL_MS;
        if (_ageMs > _ttlMs) {
          const _ageMin = Math.round(_ageMs / 60000);
          const _ttlMin = Math.round(_ttlMs / 60000);
          console.warn(`[adapter] Context stale: stage=${_stage} age=${_ageMin}min > ttl=${_ttlMin}min — resetting with sentinel`);
          // KATMAN 1: sentinel dön → process-message visible reset yapar
          // (eski davranış silent null'du → AI history sızıntısıyla saçmalardı).
          return {
            context: null,
            stale: {
              lastStage: _stage,
              // 2026-06-29 K2 FIX: COMPLETED + reservationConfirmed istisnası. Eski
              // koşul sadece dateId'ye bakıyordu → COMPLETED rezervasyon (dateId dolu,
              // RPC success) 12h TTL sonrası yanıltıcı "Önceki yarım rezervasyonunuz
              // iptal edildi" mesajı gönderiyordu. DB'de kayıt korunur (veri kaybı yok),
              // ama mesaj yanlış. 3 katmanlı sigorta: stage + reservationConfirmed + dateId.
              hadReservationInProgress: parsed.stage !== "COMPLETED"
                && !parsed.reservationConfirmed
                && !!(parsed.reservationInfo && parsed.reservationInfo.dateId),
              ageMinutes: _ageMin,
              lastLanguage: parsed.language,
              // P9-C: hatırlatma-önerisi verisi (yalnız metin + tek-adaylı öneri;
              // state restore YOK — tarih güncel müsaitlikten yeniden sorulur)
              lastTourId: parsed.reservationInfo?.tourId || parsed.currentTour?.id,
              lastTourTitle: parsed.reservationInfo?.tourTitle || parsed.currentTour?.title,
              lastSelectedDate: parsed.reservationInfo?.selectedDate,
            },
          };
        }
      }

      // Agency tone override (DB'deki üslup, her yüklemede güncellenir)
      const agencyTone = (this.agency as any).conversation_style as ConversationTone | null;
      if (agencyTone) parsed.tone = agencyTone;

      // Dil limiti: agency'nin etkin dillerini zorla
      const enabledLangs: string[] = (this.agency as any).enabled_languages || ["tr"];
      if (!enabledLangs.includes(parsed.language)) {
        console.warn(`[adapter] Language "${parsed.language}" not in enabled=[${enabledLangs}], fallback to "${enabledLangs[0]}"`);
        parsed.language = enabledLangs[0];
        parsed.tone = (agencyTone ?? getDefaultToneForLanguage(parsed.language)) as ConversationTone;
      }

      return { context: parsed as ConversationContext };
    } catch (_e) {
      console.warn("[adapter] Context parse failed, will create fresh");
      return { context: null };
    }
  }

  async loadHistory(limit = 50, since?: string): Promise<Array<{ role: string; content: string }>> {
    // getConversationHistory DESC döndürür; reverse ile ASC yapılır (process-message bunu bekler)
    // 2026-06-24 FIX A1: since varsa cutoff sonrası mesajlar filtrelenir.
    const raw = await getConversationHistory(this.supabase, this.phone, this.agency.id, this.preloadedHistory, limit, since);
    return [...raw].reverse(); // DESC → ASC
  }

  async saveResponse(reply: string, newContext: ConversationContext): Promise<void> {
    await saveConversationAtomic(this.supabase, this.phone, this.agency.id, "", reply, newContext);
  }

  // P2-A BULGU-1 (2026-07-28): webhook user-mesajını AI'dan ÖNCE ayrı-insert etti mi?
  // Ettiyse saveTransaction user'ı TEKRAR yazmaz ("" → RPC ve fallback atlar; saveResponse
  // ile aynı kanıtlı yol). Realtime paneli mesajı atıldığı saniye gösterir.
  private userAlreadySaved = false;
  markUserSaved(): void { this.userAlreadySaved = true; }

  async saveTransaction(userMessage: string, reply: string, newContext: ConversationContext): Promise<void> {
    await saveConversationAtomic(
      this.supabase, this.phone, this.agency.id,
      this.userAlreadySaved ? "" : userMessage, reply, newContext,
    );
  }

  async sendResponse(reply: string): Promise<void> {
    // K1: Meta gönderim sonucunu KONTROL et. Önceden silent loss vardı —
    // token expired/429/5xx olduğunda webhook OK dönüyor ama müşteri mesaj almıyordu.
    const _result = await sendWhatsAppMessage(
      this.metaPhoneNumberId, this.metaAccessToken, this.phone, truncateForWhatsApp(reply),
    );
    if (!_result.success) {
      // K1 + K3: hata error sink'e gider → admin panelinde "Sistem Hataları"nda görünür.
      // PII (phone) burada maskelenmez — error-sink içinde log-mask.ts otomatik maskeler.
      await logCritical({
        event: "META_SEND_FAIL",
        error: _result.error || `Meta send failed status=${_result.status}`,
        context: {
          phone: this.phone,                  // log-mask.ts otomatik mask
          status: _result.status,
          replyLen: reply.length,
          channel: "whatsapp",
        },
        agencyId: this.agency?.id ?? null,
        severity: "critical",
      });
      // throw etmiyoruz — process-message akışı bozulmasın, webhook 200 dönsün
      // (Meta retry storm önleme). Görünürlük log + DB üzerinden sağlanır.
    }
  }

  async sendErrorResponse(message: string): Promise<void> {
    // sendErrorResponse zaten hata akışı içinde çağrılır — yeni hata logu üst üste yığılmasın.
    // Sadece console.error yap, error-sink'e gönderme.
    const _result = await sendWhatsAppMessage(
      this.metaPhoneNumberId, this.metaAccessToken, this.phone, message,
    );
    if (!_result.success) {
      console.error("[adapter] sendErrorResponse: Meta send also failed", {
        status: _result.status, error: _result.error,
      });
    }
  }
}
