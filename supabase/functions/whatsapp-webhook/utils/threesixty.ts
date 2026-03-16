// 360Dialog WhatsApp API utilities

const DEFAULT_BASE_URL = 'https://waba-v2.360dialog.io';

/**
 * Send a text message via 360Dialog WhatsApp API
 */
export async function send360Message(
  apiKey: string,
  to: string,
  messageText: string,
  baseUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Normalize phone: remove + prefix and whatsapp: prefix
    const normalizedTo = to
      .replace('whatsapp:', '')
      .replace('+', '')
      .trim();

    const url = `${baseUrl || DEFAULT_BASE_URL}/v1/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'D360-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizedTo,
        type: 'text',
        text: { body: messageText },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 360Dialog API error:', response.status, errorText);
      return { success: false, error: `360Dialog error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (error) {
    console.error('❌ Error sending 360Dialog message:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send a template message via 360Dialog WhatsApp API
 * Used when 24-hour window has passed
 */
export async function send360Template(
  apiKey: string,
  to: string,
  templateName: string,
  languageCode: string,
  components?: any[],
  baseUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const normalizedTo = to
      .replace('whatsapp:', '')
      .replace('+', '')
      .trim();

    const url = `${baseUrl || DEFAULT_BASE_URL}/v1/messages`;

    const body: any = {
      messaging_product: 'whatsapp',
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
        'D360-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 360Dialog template error:', response.status, errorText);
      return { success: false, error: `360Dialog error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (error) {
    console.error('❌ Error sending 360Dialog template:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Extract incoming message data from 360Dialog webhook payload
 */
export function extract360WebhookData(body: any): {
  from: string;
  message: string;
  messageId: string;
  isStatus: boolean;
} | null {
  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Status updates - ignore
    if (value?.statuses && !value?.messages) {
      return { from: '', message: '', messageId: '', isStatus: true };
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
      // Handle button replies and list replies
      if (msg.interactive?.type === 'button_reply') {
        message = msg.interactive.button_reply?.title || '';
      } else if (msg.interactive?.type === 'list_reply') {
        message = msg.interactive.list_reply?.title || '';
      }
    } else if (msg.type === 'image' || msg.type === 'document' || msg.type === 'audio' || msg.type === 'video') {
      message = msg[msg.type]?.caption || `[${msg.type}]`;
    }

    return { from, message, messageId, isStatus: false };
  } catch (error) {
    console.error('❌ Error extracting 360Dialog webhook data:', error);
    return null;
  }
}

/**
 * Resolve agency by phone number from webhook
 */
export async function resolveAgencyByPhone(
  supabase: any,
  phoneNumberId: string,
  webhookBody: any
): Promise<{ agency: any; error: string | null }> {
  // Try to get the business phone number from the webhook
  const displayPhone = webhookBody?.entry?.[0]?.changes?.[0]?.value?.metadata?.display_phone_number;
  const phoneId = webhookBody?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

  if (displayPhone) {
    // Normalize: remove + and spaces
    const normalized = displayPhone.replace(/[\s+\-()]/g, '');
    
    const { data: agency, error } = await supabase
      .from('agencies')
      .select('*')
      .eq('whatsapp_phone_number', displayPhone)
      .single();

    if (!error && agency) {
      return { agency, error: null };
    }

    // Try with normalized version
    const { data: agency2, error: error2 } = await supabase
      .from('agencies')
      .select('*')
      .like('whatsapp_phone_number', `%${normalized.slice(-10)}`)
      .single();

    if (!error2 && agency2) {
      return { agency: agency2, error: null };
    }
  }

  // Fallback: find agency that has whatsapp_api_key set (for single-agency setups)
  const { data: agencies } = await supabase
    .from('agencies')
    .select('*')
    .not('whatsapp_api_key', 'is', null)
    .eq('active', true);

  if (agencies && agencies.length === 1) {
    return { agency: agencies[0], error: null };
  }

  console.error('❌ Could not resolve agency from webhook');
  return { agency: null, error: 'Agency not found' };
}
