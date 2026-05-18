// WhatsApp Cloud API — Read Receipts + Typing Indicator
// Her iki fonksiyon da fire-and-forget pattern ile çağrılmalı (await KULLANMA)

const GRAPH_API_BASE = "https://graph.facebook.com/v18.0";

/**
 * Müşteriye "okundu" (mavi tik) gönder.
 * Tüm hesaplarda çalışır. Hata olursa sessiz geç.
 */
export async function markAsRead(
  phoneNumberId: string,
  accessToken: string,
  messageId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
    if (!res.ok) {
      console.warn(`[wa-status] markAsRead failed: ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[wa-status] markAsRead error:", err);
    return false;
  }
}

/**
 * "Yazıyor..." göstergesi gönder (okundu + typing_indicator birleşik).
 * Meta'nın typing_indicator özelliği bazı hesaplarda henüz aktif olmayabilir.
 * Aktif değilse hata döner — silently false return, ana akışı engellemez.
 * En kötü durumda sadece typing gösterilemez; read receipt ayrıca gönderildi.
 */
export async function showTypingIndicator(
  phoneNumberId: string,
  accessToken: string,
  messageId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
        typing_indicator: { type: "text" },
      }),
    });
    if (!res.ok) {
      // Hesap typing_indicator'ı desteklemeyebilir — normal bir durum
      console.log(`[wa-status] typing_indicator not available (${res.status}), silent skip`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[wa-status] showTypingIndicator error:", err);
    return false;
  }
}
