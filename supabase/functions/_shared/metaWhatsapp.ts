// Meta Cloud API WhatsApp utilities

const GRAPH_API_VERSION = 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Send a text message via Meta Cloud API
 */
export async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const normalizedTo = to.replace('whatsapp:', '').replace('+', '').trim();

    const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizedTo,
        type: 'text',
        text: { body: message },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Meta WhatsApp API error:', response.status, errorText);
      return { success: false, error: `Meta API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (error) {
    console.error('❌ Error sending Meta WhatsApp message:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send a template message via Meta Cloud API
 * Used when 24-hour window has passed
 */
export async function sendWhatsAppTemplate(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  languageCode: string,
  components?: any[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const normalizedTo = to.replace('whatsapp:', '').replace('+', '').trim();

    const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`;

    const body: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizedTo,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };

    if (components && components.length > 0) {
      body.template.components = components;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Meta WhatsApp template error:', response.status, errorText);
      return { success: false, error: `Meta API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (error) {
    console.error('❌ Error sending Meta WhatsApp template:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Extract incoming message data from Meta Cloud API webhook payload
 */
export function extractMetaWebhookData(body: any): {
  from: string;
  message: string;
  messageId: string;
  isStatus: boolean;
  phoneNumberId: string;
} | null {
  try {
    if (body?.object !== 'whatsapp_business_account') {
      return null;
    }

    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    const phoneNumberId = value?.metadata?.phone_number_id || '';

    // Status updates - ignore
    if (value?.statuses && !value?.messages) {
      return { from: '', message: '', messageId: '', isStatus: true, phoneNumberId };
    }

    const messages = value?.messages;
    if (!messages || messages.length === 0) {
      return null;
    }

    const msg = messages[0];
    const from = msg.from || '';
    const messageId = msg.id || '';

    let message = '';
    if (msg.type === 'text') {
      message = msg.text?.body || '';
    } else if (msg.type === 'interactive') {
      if (msg.interactive?.type === 'button_reply') {
        message = msg.interactive.button_reply?.title || '';
      } else if (msg.interactive?.type === 'list_reply') {
        message = msg.interactive.list_reply?.title || '';
      }
    } else if (msg.type === 'image' || msg.type === 'document' || msg.type === 'audio' || msg.type === 'video') {
      message = msg[msg.type]?.caption || `[${msg.type}]`;
    }

    return { from, message, messageId, isStatus: false, phoneNumberId };
  } catch (error) {
    console.error('❌ Error extracting Meta webhook data:', error);
    return null;
  }
}

/**
 * Resolve agency by phone_number_id or fallback
 */
export async function resolveAgencyByPhoneNumberId(
  supabase: any,
  phoneNumberId: string
): Promise<{ agency: any; error: string | null }> {
  // Try matching by meta_phone_number_id
  if (phoneNumberId) {
    const { data: agency, error } = await supabase
      .from('agencies')
      .select('*')
      .eq('meta_phone_number_id', phoneNumberId)
      .eq('active', true)
      .single();

    if (!error && agency) {
      return { agency, error: null };
    }
  }

  // Fallback: find agency that has meta_access_token or whatsapp_api_key set (single-agency setups)
  const { data: agencies } = await supabase
    .from('agencies')
    .select('*')
    .eq('active', true)
    .or('meta_access_token.not.is.null,whatsapp_api_key.not.is.null');

  if (agencies && agencies.length === 1) {
    return { agency: agencies[0], error: null };
  }

  console.error('❌ Could not resolve agency from webhook');
  return { agency: null, error: 'Agency not found' };
}

/**
 * Get Meta WhatsApp credentials - from agency or global env
 */
export function getMetaCredentials(agency: any): {
  phoneNumberId: string;
  accessToken: string;
} {
  // Agency-level credentials (future: Embedded Signup)
  if (agency.meta_phone_number_id && agency.meta_access_token) {
    return {
      phoneNumberId: agency.meta_phone_number_id,
      accessToken: agency.meta_access_token,
    };
  }

  // Global credentials from environment
  return {
    phoneNumberId: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '',
    accessToken: Deno.env.get('WHATSAPP_ACCESS_TOKEN') || '',
  };
}

/**
 * Subscribe app to WABA webhook events.
 * Content-Type + body + res.ok kontrolü — tam formatında.
 */
export async function subscribeAppToWaba(
  wabaId: string,
  accessToken: string
): Promise<{ success: boolean; error?: string; httpStatus?: number }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${wabaId}/subscribed_apps`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscribed_fields: "messages,message_template_status_update",
        }),
      }
    );

    const data = await res.json();

    if (res.ok) {
      // v18.0+ bazen { success: true }, bazen sadece 200 döner — res.ok yeterli
      console.info("[subscribeAppToWaba] Success:", wabaId, JSON.stringify(data));
      return { success: true };
    } else {
      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      console.error("[subscribeAppToWaba] Failed:", res.status, JSON.stringify(data));
      return { success: false, error: errMsg, httpStatus: res.status };
    }
  } catch (err: any) {
    console.error("[subscribeAppToWaba] Exception:", err);
    return { success: false, error: err.message };
  }
}

/**
 * GET subscribed_apps ile gerçekten abone olup olmadığını doğrula.
 */
export async function verifyWabaSubscription(
  wabaId: string,
  accessToken: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${wabaId}/subscribed_apps`,
      { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return false;
    const data = await res.json();
    // data.data[] içinde en az 1 app varsa subscribe olmuş
    return Array.isArray(data?.data) && data.data.length > 0;
  } catch {
    return false;
  }
}

/**
 * Retry'lı subscription — Meta propagation gecikmesi için 0/5/15s dener.
 * POST + GET verify — gerçek sonuç döner.
 */
export async function subscribeAppToWabaWithRetry(
  wabaId: string,
  accessToken: string
): Promise<boolean> {
  const delays = [0, 5000, 15000];

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }

    const result = await subscribeAppToWaba(wabaId, accessToken);

    if (result.success) {
      const verified = await verifyWabaSubscription(wabaId, accessToken);
      if (verified) {
        console.info(`[subscribeWithRetry] Confirmed on attempt ${attempt + 1} for WABA ${wabaId}`);
        return true;
      }
      console.warn(`[subscribeWithRetry] POST ok but GET verify failed (attempt ${attempt + 1})`);
    } else {
      console.warn(`[subscribeWithRetry] Attempt ${attempt + 1} failed: ${result.error}`);
    }
  }

  console.error(`[subscribeWithRetry] All ${delays.length} attempts failed for WABA ${wabaId}`);
  return false;
}
