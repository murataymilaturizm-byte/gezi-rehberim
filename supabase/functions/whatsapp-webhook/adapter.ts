// WhatsApp channel adapter — ChannelAdapter interface'ini WhatsApp için implement eder.
// DB kayıt, Meta API gönderimi ve kanal-spesifik template logicini kapsüller.

import type { ConversationContext, ConversationTone } from "../shared/fsm/types.ts";
import type { ChannelAdapter } from "../shared/handlers/types.ts";
import { createInitialContext } from "../shared/fsm/state-machine.ts";
import { getDefaultToneForLanguage } from "../shared/fsm/localization.ts";
import { getConversationHistory } from "../shared/services/context-manager.ts";
import { truncateForWhatsApp } from "./utils/format.ts";
import { sendWhatsAppMessage } from "../_shared/metaWhatsapp.ts";

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

  async loadContext(): Promise<ConversationContext | null> {
    // Önce preloaded (atomic RPC'den gelen)
    let ctxStr = this.preloadedContextStr;
    if (ctxStr === null) {
      const { data } = await this.supabase
        .from("whatsapp_conversations")
        .select("content")
        .eq("phone", this.phone)
        .eq("agency_id", this.agency.id)
        .eq("role", "system")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      ctxStr = data?.content ?? null;
    }

    if (!ctxStr) return null;

    try {
      const parsed = JSON.parse(ctxStr);
      if (!isValidContext(parsed)) return null;

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

      return parsed as ConversationContext;
    } catch (_e) {
      console.warn("[adapter] Context parse failed, will create fresh");
      return null;
    }
  }

  async loadHistory(limit = 50): Promise<Array<{ role: string; content: string }>> {
    // getConversationHistory DESC döndürür; reverse ile ASC yapılır (process-message bunu bekler)
    const raw = await getConversationHistory(this.supabase, this.phone, this.agency.id, this.preloadedHistory, limit);
    return [...raw].reverse(); // DESC → ASC
  }

  async saveResponse(reply: string, newContext: ConversationContext): Promise<void> {
    await saveConversationAtomic(this.supabase, this.phone, this.agency.id, "", reply, newContext);
  }

  async saveTransaction(userMessage: string, reply: string, newContext: ConversationContext): Promise<void> {
    await saveConversationAtomic(this.supabase, this.phone, this.agency.id, userMessage, reply, newContext);
  }

  async sendResponse(reply: string): Promise<void> {
    await sendWhatsAppMessage(this.metaPhoneNumberId, this.metaAccessToken, this.phone, truncateForWhatsApp(reply));
  }

  async sendErrorResponse(message: string): Promise<void> {
    await sendWhatsAppMessage(this.metaPhoneNumberId, this.metaAccessToken, this.phone, message);
  }

  async getCompletionTemplateAddendum(params: {
    tourId: string; tourTitle: string; dateId: string; formattedDate: string;
    fullName: string; pax: number; totalPrice: number; currency: string;
    language: string; agencyId: string;
  }): Promise<string | null> {
    try {
      const { data: template } = await this.supabase
        .from("message_templates")
        .select("content")
        .eq("agency_id", params.agencyId)
        .eq("template_key", "reservation_confirmed")
        .eq("language", params.language)
        .eq("is_active", true)
        .maybeSingle();

      if (!template?.content) return null;

      // Tüm yaygın placeholder varyantlarını replace et
      return template.content
        .replace(/\{full_name\}/g, params.fullName)
        .replace(/\{customer_name\}/g, params.fullName)
        .replace(/\{ad_soyad\}/g, params.fullName)
        .replace(/\{tour_name\}/g, params.tourTitle)
        .replace(/\{tur_adi\}/g, params.tourTitle)
        .replace(/\{date\}/g, params.formattedDate)
        .replace(/\{tarih\}/g, params.formattedDate)
        .replace(/\{pax\}/g, String(params.pax))
        .replace(/\{kisi_sayisi\}/g, String(params.pax))
        .replace(/\{total_amount\}/g, String(params.totalPrice))
        .replace(/\{toplam_tutar\}/g, String(params.totalPrice))
        .replace(/\{currency\}/g, params.currency)
        .replace(/\{para_birimi\}/g, params.currency);
    } catch (_e) {
      return null;
    }
  }
}
